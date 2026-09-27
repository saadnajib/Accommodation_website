/**
 * Runs an approved (or policy-approved) proposal through the same server code the admin UI uses.
 * Employees never call these functions directly.
 */
import { and, eq, gte, like } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { now } from '../lib/crypto.js'
import { auditAs, notify, notifyAdmins } from '../lib/audit.js'
import { moderateListing } from '../lib/listingModeration.js'
import { recordFeePayment, setAgreedPrice, transition } from '../lib/stateMachine.js'
import { DEFAULT_FEES, getFees, setFees, type FeeSettings } from '../lib/fees.js'
import { NUDGE_COOLDOWN_HOURS } from './actions.js'
import { agentName } from './roster.js'

export type Proposal = typeof schema.agentProposals.$inferSelect
export type ExecActor = { kind: 'admin'; id: string } | { kind: 'agent'; key: string }

class ExecError extends Error {}

const actorIdOf = (a: ExecActor) => (a.kind === 'admin' ? a.id : `agent:${a.key}`)
const str = (x: unknown) => (typeof x === 'string' ? x.trim() : '')

function loadListing(id: string | null) {
  const l = id ? db.select().from(schema.listings).where(eq(schema.listings.id, id)).get() : undefined
  if (!l) throw new ExecError('Listing not found')
  return l
}
function loadApplication(id: string | null) {
  const a = id ? db.select().from(schema.applications).where(eq(schema.applications.id, id)).get() : undefined
  if (!a) throw new ExecError('Application not found')
  return a
}

export const renterAppLink = (id: string) => `/dashboard/applications/${id}`
export const ownerAppLink = (id: string) => `/owner/applications/${id}`

/** True when a 'Reminder…' notification with this link reached this user within the cooldown window. */
export function nudgedRecently(userId: string, link: string) {
  const since = new Date(Date.now() - NUDGE_COOLDOWN_HOURS * 3600_000).toISOString()
  const N = schema.notifications
  return !!db.select({ id: N.id }).from(N)
    .where(and(eq(N.userId, userId), like(N.title, 'Reminder%'), eq(N.link, link), gte(N.at, since))).get()
}

/** Performs the action; returns a short human-readable result. Throws on failure. */
function perform(p: Proposal, actor: ExecActor): string {
  const payload = p.payload ?? {}
  const actorId = actorIdOf(actor)
  const tag = `[AI: ${agentName(p.agentKey)}]`
  const appTransition = (to: string, publicNote: string) => {
    const a = loadApplication(p.targetId)
    const fresh = transition(a, to, 'admin', actorId, `${tag} ${publicNote}`.trim())
    return `Application moved to ${fresh.status}`
  }

  switch (p.action) {
    /* ----- listings ----- */
    case 'listing.approve': {
      const l = loadListing(p.targetId)
      if (l.status !== 'pending_review') throw new ExecError(`Listing is ${l.status}, not pending review`)
      moderateListing(l, { status: 'active' }, actorId)
      return 'Listing is live'
    }
    case 'listing.reject': {
      const l = loadListing(p.targetId)
      if (l.status !== 'pending_review') throw new ExecError(`Listing is ${l.status}, not pending review`)
      const reason = str(payload.rejectionReason) || str(payload.rejectionReasonForOwner) || p.rationale
      moderateListing(l, { status: 'rejected', rejectionReason: reason.slice(0, 1000) }, actorId)
      return 'Listing rejected; owner notified'
    }
    case 'listing.pause': {
      const l = loadListing(p.targetId)
      if (l.status !== 'active') throw new ExecError(`Listing is ${l.status}, not active`)
      moderateListing(l, { status: 'paused' }, actorId)
      notify(l.ownerId, 'Listing paused', `We paused "${l.title}" because applicants have been waiting for a reply. Reactivate it when you are ready to respond.`, `/owner/listings/${l.id}/edit`)
      return 'Listing paused; owner notified'
    }
    case 'listing.feature': {
      const l = loadListing(p.targetId)
      if (l.status !== 'active') throw new ExecError(`Listing is ${l.status}, not active`)
      moderateListing(l, { featured: true }, actorId)
      return 'Listing featured'
    }

    /* ----- applications ----- */
    case 'application.start_review': return appTransition('under_review', 'Review started')
    case 'application.verify': return appTransition('verified', 'Verification passed')
    case 'application.reject':
      return appTransition('rejected', str(payload.renterFacingReason) || 'We could not verify your application.')
    case 'application.send_to_owner': return appTransition('sent_to_owner', 'Presented to owner')
    case 'application.record_owner_decision': {
      const d = str(payload.decision)
      if (d !== 'accept' && d !== 'decline') throw new ExecError('payload.decision must be accept or decline')
      return appTransition(d === 'accept' ? 'owner_accepted' : 'owner_declined', str(payload.note) || `Owner ${d === 'accept' ? 'accepted' : 'declined'}`)
    }
    case 'application.complete': return appTransition('completed', 'Deal marked completed')
    case 'application.cancel': return appTransition('cancelled', str(payload.note) || 'Application closed')
    case 'application.set_price': {
      const price = Number(payload.agreedPrice ?? payload.suggestedPrice)
      if (!Number.isInteger(price) || price < 1 || price > 10_000_000) throw new ExecError('payload.agreedPrice must be a positive whole number')
      const fresh = setAgreedPrice(loadApplication(p.targetId), price, actorId)
      return `Agreed price set to ${fresh.agreedPrice}; fees ${fresh.renterFee}/${fresh.ownerFee}`
    }
    case 'application.mark_fee_paid': {
      if (actor.kind !== 'admin') throw new ExecError('Only the CEO can record a payment')
      const side = str(payload.side)
      if (side !== 'renter' && side !== 'owner') throw new ExecError('payload.side must be renter or owner')
      const a = loadApplication(p.targetId)
      const fresh = recordFeePayment(a, side, { payerId: side === 'renter' ? a.renterId : a.ownerId, recordedBy: actor.id, actorId: actor.id })
      return `${side} fee recorded; status ${fresh.status}`
    }
    case 'application.nudge': {
      const a = loadApplication(p.targetId)
      const to = str(payload.to)
      if (to !== 'renter' && to !== 'owner') throw new ExecError('payload.to must be renter or owner')
      const message = str(payload.message)
      if (!message) throw new ExecError('payload.message is required')
      const userId = to === 'renter' ? a.renterId : a.ownerId
      const link = to === 'renter' ? renterAppLink(a.id) : ownerAppLink(a.id)
      if (nudgedRecently(userId, link)) throw new ExecError(`A reminder was already sent to the ${to} in the last ${NUDGE_COOLDOWN_HOURS} hours`)
      const listing = db.select({ title: schema.listings.title }).from(schema.listings).where(eq(schema.listings.id, a.listingId)).get()
      notify(userId, `Reminder: ${listing?.title ?? 'your application'}`, message.slice(0, 1000), link)
      return `Reminder sent to the ${to}`
    }

    /* ----- users / settings / CEO ----- */
    case 'user.notify': {
      const u = p.targetId ? db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.id, p.targetId)).get() : undefined
      if (!u) throw new ExecError('User not found')
      const message = str(payload.message)
      if (!message) throw new ExecError('payload.message is required')
      const link = str(payload.link)
      notify(u.id, (str(payload.title) || 'A message from StayBridge').slice(0, 120), message.slice(0, 1000), link.startsWith('/') ? link : undefined)
      return 'Notification sent'
    }
    case 'settings.fees': {
      if (actor.kind !== 'admin') throw new ExecError('Only the CEO can change fees')
      const f = (payload.fees ?? {}) as Partial<FeeSettings>
      const next: FeeSettings = { ...DEFAULT_FEES, ...getFees() }
      if (typeof f.renterFeeRate === 'number' && f.renterFeeRate >= 0 && f.renterFeeRate <= 2) next.renterFeeRate = f.renterFeeRate
      if (typeof f.ownerFeeRate === 'number' && f.ownerFeeRate >= 0 && f.ownerFeeRate <= 2) next.ownerFeeRate = f.ownerFeeRate
      if (Number.isInteger(f.minFee) && f.minFee! >= 0) next.minFee = f.minFee!
      if (Number.isInteger(f.tenantPassPrice) && f.tenantPassPrice! >= 0) next.tenantPassPrice = f.tenantPassPrice!
      if (Number.isInteger(f.featuredListingPrice) && f.featuredListingPrice! >= 0) next.featuredListingPrice = f.featuredListingPrice!
      setFees(next)
      auditAs(actorId, 'settings.fees', 'fees', { ...f })
      return 'Fee settings updated'
    }
    case 'ceo.brief': {
      const text = str(payload.text)
      if (!text) throw new ExecError('payload.text is required')
      notifyAdmins('Daily brief', text.slice(0, 1200), '/admin/approvals')
      return 'Brief delivered to admins'
    }
    default:
      throw new ExecError(`Unknown action ${p.action}`)
  }
}

/**
 * Execute a proposal and record the outcome on it (executed / failed) plus an 'agent.execute' audit row.
 * Never throws: failures are stored on the proposal.
 */
export function execute(proposal: Proposal, actor: ExecActor): Proposal {
  const P = schema.agentProposals
  let status: 'executed' | 'failed'
  let result: string
  try {
    result = perform(proposal, actor)
    status = 'executed'
  } catch (e) {
    status = 'failed'
    result = e instanceof Error ? e.message : String(e)
  }
  db.update(P).set({ status, result, executedAt: now() }).where(eq(P.id, proposal.id)).run()
  auditAs(actorIdOf(actor), 'agent.execute', proposal.targetId ?? undefined, {
    proposalId: proposal.id, agentKey: proposal.agentKey, action: proposal.action, status, result,
  })
  return db.select().from(P).where(eq(P.id, proposal.id)).get()!
}
