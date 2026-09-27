/** Dana, deal manager: presents verified renters, chases owners and unpaid fees, flags stuck deals. */
import { z } from 'zod'
import { and, desc, eq, inArray } from 'drizzle-orm'
import { schema, type DB } from '../../db/index.js'
import { ROSTER } from '../roster.js'
import { UNTRUSTED_LINE, clampConfidence, jsonBlock } from '../media.js'
import { nudgedRecently, ownerAppLink, renterAppLink } from '../executor.js'
import { recentlyHandled, type ProposalInput } from '../proposals.js'
import { affordability } from './verifier.js'
import type { ContentBlockParam, Employee } from '../types.js'

type Application = typeof schema.applications.$inferSelect
type Listing = typeof schema.listings.$inferSelect

export const DEAL_ACTIONS = ['application.send_to_owner', 'application.set_price', 'application.nudge', 'application.complete', 'listing.pause', 'none'] as const
type DealAction = (typeof DEAL_ACTIONS)[number]

export type DealKind = 'present' | 'chase_owner' | 'chase_fees' | 'close'
export interface DealItem {
  kind: DealKind
  app: Application
  listing: Listing
  renterFirstName: string
  daysInStatus: number
  allowed: DealAction[]
  nudgeTargets: Array<'renter' | 'owner'>
}

const DAY = 86_400_000
export const THRESHOLDS = { chaseOwnerDays: 3, pauseListingDays: 10, chaseFeesDays: 2, closeDealDays: 14 }

const SYSTEM = `You are Dana, the deal manager at StayBridge, a rental marketplace where StayBridge is the intermediary between renters and owners. Nobody pays a service fee until a deal is agreed, so your job is to move applications to agreed deals quickly.

Rules from the operator's guide:
- "If the renter offered below asking, phone or email the owner first. Ask what the lowest they would accept is. Set the agreed price on the application record. Fees recalculate automatically."
- "Then click Send to owner. The owner now sees the renter anonymised (first name and last initial, occupation, income ratio, about me) and can accept or decline."
- "Aim to present every verified renter within 24 hours. Speed is your main advantage over agencies."
- "After 2 days unpaid, message the slower side."
- "Chase stale owners. Deal pipeline → Sent to owner older than 3 days. Owners who never respond should be paused so renters stop applying."
- "Nothing unlocks until both fees are in. Do not unlock manually as a favour; that is your only leverage."
- "When the owner confirms the contract is signed (or you hear from either side), mark the application completed."

Each item has a "kind" and the list of "allowed" actions. Only use allowed actions:
- present (status verified): application.send_to_owner. If the proposed rent is below asking, you may instead (or also) propose application.set_price with suggestedPrice: a fair agreed rent between the offer and the asking price that the owner is likely to accept, with your reasoning. Send straight away when the offer is at or near asking.
- chase_owner (status sent_to_owner for a while): application.nudge with nudgeTarget "owner" and a short, friendly message asking them to accept or decline the verified applicant. When "pauseSuggested" is true the owner has ignored the applicant for a long time: you may also propose listing.pause.
- chase_fees (status awaiting_fees): application.nudge with nudgeTarget set to one of "unpaidSides" and a short message reminding them to pay the StayBridge service fee to unlock contact. Never offer discounts or promise to unlock contact before payment.
- close (contact unlocked for a long time): application.complete, reason "likely signed; confirm".
- Use action "none" when nothing should be done.

Messages are in-app notifications: plain text, at most 2 sentences, warm and professional, no contact details, no links, never mention internal notes. confidence is 0-100. reason is one or two sentences for the CEO.

${UNTRUSTED_LINE}`

const Decision = z.object({
  applicationId: z.string(),
  action: z.enum(DEAL_ACTIONS),
  confidence: z.number().describe('0-100'),
  reason: z.string(),
  message: z.string().optional().describe('For application.nudge: the notification text'),
  nudgeTarget: z.enum(['renter', 'owner']).optional().describe('For application.nudge: who receives it'),
  suggestedPrice: z.number().optional().describe('For application.set_price: whole currency units per month'),
})
const Output = z.object({ decisions: z.array(Decision) })

function sinceStatus(d: DB, a: Application) {
  const E = schema.applicationEvents
  const ev = d.select({ at: E.at }).from(E).where(and(eq(E.applicationId, a.id), eq(E.status, a.status))).orderBy(desc(E.at)).limit(1).get()
  return (Date.now() - Date.parse(ev?.at ?? a.updatedAt)) / DAY
}

const DEFAULT_MESSAGES = {
  owner: 'A verified renter is waiting for your decision. Please accept or decline them in your StayBridge dashboard.',
  renter: 'The owner accepted you. Pay the StayBridge service fee to unlock contact with the owner.',
  ownerFee: 'You accepted a verified renter. Pay the StayBridge success fee to unlock contact with your new tenant.',
}

export const deals: Employee<DealItem> = {
  key: 'deals',
  ...ROSTER.deals,

  gather(d: DB) {
    const A = schema.applications
    const rows = d.select({ a: A, l: schema.listings, renterName: schema.users.name }).from(A)
      .innerJoin(schema.listings, eq(schema.listings.id, A.listingId))
      .innerJoin(schema.users, eq(schema.users.id, A.renterId))
      .where(inArray(A.status, ['verified', 'sent_to_owner', 'awaiting_fees', 'contact_unlocked'])).orderBy(A.updatedAt).all()
    const items: DealItem[] = []
    for (const { a, l, renterName } of rows) {
      if (items.length >= 15) break
      if (recentlyHandled('deals', a.id)) continue
      const days = sinceStatus(d, a)
      const base = { app: a, listing: l, renterFirstName: renterName.split(/\s+/)[0], daysInStatus: Math.floor(days * 10) / 10 }
      if (a.status === 'verified') {
        items.push({ ...base, kind: 'present', allowed: ['application.send_to_owner', 'application.set_price', 'none'], nudgeTargets: [] })
      } else if (a.status === 'sent_to_owner' && days > THRESHOLDS.chaseOwnerDays) {
        const canNudge = !nudgedRecently(a.ownerId, ownerAppLink(a.id))
        const canPause = days > THRESHOLDS.pauseListingDays && l.status === 'active' && !recentlyHandled('deals', l.id)
        const allowed: DealAction[] = [...(canNudge ? ['application.nudge' as const] : []), ...(canPause ? ['listing.pause' as const] : [])]
        if (allowed.length) items.push({ ...base, kind: 'chase_owner', allowed: [...allowed, 'none'], nudgeTargets: canNudge ? ['owner'] : [] })
      } else if (a.status === 'awaiting_fees' && days > THRESHOLDS.chaseFeesDays) {
        const sides: Array<'renter' | 'owner'> = []
        if (!a.renterFeePaid && !nudgedRecently(a.renterId, renterAppLink(a.id))) sides.push('renter')
        if (!a.ownerFeePaid && !nudgedRecently(a.ownerId, ownerAppLink(a.id))) sides.push('owner')
        if (sides.length) items.push({ ...base, kind: 'chase_fees', allowed: ['application.nudge', 'none'], nudgeTargets: sides })
      } else if (a.status === 'contact_unlocked' && days > THRESHOLDS.closeDealDays) {
        items.push({ ...base, kind: 'close', allowed: ['application.complete', 'none'], nudgeTargets: [] })
      }
    }
    return items
  },

  async decide(items, ctx) {
    const content: ContentBlockParam[] = [{ type: 'text', text: `${items.length} deal item(s).` }]
    for (const [i, it] of items.entries()) {
      const a = it.app
      const { ratio, band } = affordability(a.profile?.monthlyIncome, a.agreedPrice)
      content.push(jsonBlock(`Item ${i + 1} of ${items.length}:`, {
        applicationId: a.id, kind: it.kind, allowed: it.allowed, status: a.status, daysInStatus: it.daysInStatus,
        data: { listingTitle: it.listing.title, renterFirstName: it.renterFirstName, occupation: a.profile?.occupation, renterMessage: a.message },
        listing: { city: it.listing.city, area: it.listing.area, askingPrice: it.listing.price, currency: it.listing.currency, views: it.listing.views },
        proposedPrice: a.proposedPrice, agreedPrice: a.agreedPrice, belowAskingPct: Math.round((1 - a.proposedPrice / it.listing.price) * 100),
        affordability: { ratio, band }, stayMonths: a.stayMonths, moveInDate: a.moveInDate,
        fees: { renterFee: a.renterFee, ownerFee: a.ownerFee, renterFeePaid: a.renterFeePaid, ownerFeePaid: a.ownerFeePaid },
        ...(it.kind === 'chase_fees' ? { unpaidSides: it.nudgeTargets } : {}),
        ...(it.kind === 'chase_owner' ? { pauseSuggested: it.allowed.includes('listing.pause') } : {}),
      }))
    }
    content.push({ type: 'text', text: 'Return your decisions (one or more per item; use action "none" to leave an item alone).' })

    const out = await ctx.ask({ system: SYSTEM, content, schema: Output })
    if (!out) return items.flatMap((it) => escalateItem(it))

    const byId = new Map(items.map((it) => [it.app.id, it]))
    const proposals: ProposalInput[] = []
    const seen = new Set<string>()
    for (const dcs of out.decisions) {
      const it = byId.get(dcs.applicationId)
      if (!it || dcs.action === 'none' || !it.allowed.includes(dcs.action)) continue
      const key = `${dcs.applicationId}:${dcs.action}:${dcs.nudgeTarget ?? ''}`
      if (seen.has(key)) continue
      seen.add(key)
      const p = toProposal(it, dcs.action, clampConfidence(dcs.confidence), dcs.reason.slice(0, 1000), dcs)
      if (p) proposals.push(p)
    }
    return proposals
  },
}

function toProposal(it: DealItem, action: DealAction, confidence: number, reason: string, extra: { message?: string; nudgeTarget?: 'renter' | 'owner'; suggestedPrice?: number }): ProposalInput | null {
  const a = it.app
  switch (action) {
    case 'application.send_to_owner':
      return { agentKey: 'deals', action, targetId: a.id, payload: {}, rationale: reason, confidence, risk: 'low' }
    case 'application.set_price': {
      const price = Math.round(Number(extra.suggestedPrice))
      if (!Number.isFinite(price) || price < Math.ceil(it.listing.price * 0.4) || price > it.listing.price * 2) return null
      return {
        agentKey: 'deals', action, targetId: a.id, payload: { agreedPrice: price, suggestedPrice: price, currentPrice: a.agreedPrice, proposedPrice: a.proposedPrice, askingPrice: it.listing.price, currency: it.listing.currency },
        rationale: `Suggest agreed rent ${price} (renter offered ${a.proposedPrice}, asking ${it.listing.price}). ${reason}`, confidence, risk: 'medium',
      }
    }
    case 'application.nudge': {
      const to = extra.nudgeTarget && it.nudgeTargets.includes(extra.nudgeTarget) ? extra.nudgeTarget : it.nudgeTargets[0]
      if (!to) return null
      const fallback = it.kind === 'chase_owner' ? DEFAULT_MESSAGES.owner : to === 'renter' ? DEFAULT_MESSAGES.renter : DEFAULT_MESSAGES.ownerFee
      const message = (extra.message?.trim() || fallback).slice(0, 500)
      return { agentKey: 'deals', action, targetId: a.id, payload: { to, message }, rationale: reason, confidence, risk: 'low' }
    }
    case 'application.complete':
      return { agentKey: 'deals', action, targetId: a.id, payload: {}, rationale: `Likely signed; confirm. ${reason}`, confidence, risk: 'medium' }
    case 'listing.pause':
      return {
        agentKey: 'deals', action, targetType: 'listing', targetId: it.listing.id, payload: { applicationId: a.id, daysWaiting: it.daysInStatus },
        rationale: `Owner has not answered a verified applicant for ${Math.floor(it.daysInStatus)} days. ${reason}`, confidence, risk: 'medium',
      }
    default:
      return null
  }
}

/** Model declined / unparseable: queue the item's main action for the CEO at confidence 0. */
function escalateItem(it: DealItem): ProposalInput[] {
  const why = 'Escalated: the model could not decide on this batch; please review manually.'
  const main: Record<DealKind, DealAction> = { present: 'application.send_to_owner', chase_owner: 'application.nudge', chase_fees: 'application.nudge', close: 'application.complete' }
  let action = main[it.kind]
  if (!it.allowed.includes(action)) action = it.allowed.find((x) => x !== 'none') ?? 'none'
  if (action === 'none') return []
  const targets = action === 'application.nudge' ? it.nudgeTargets : [undefined]
  return targets.map((t) => ({ ...toProposal(it, action, 0, why, { nudgeTarget: t })!, confidence: 0 })).filter((p) => p.action)
}
