/**
 * Application state machine: the single source of truth for which role may move an application
 * from which status to which, plus the side effects of each transition (mirrors the client store's
 * former `advanceApplication`).
 */
import { eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { newId, now } from './crypto.js'
import { auditAs, notify, notifyAdmins } from './audit.js'
import { HttpError } from './errors.js'
import { computeFees, getFees } from './fees.js'

type Application = typeof schema.applications.$inferSelect
export type Actor = 'renter' | 'owner' | 'admin' | 'system'

export const APPLICATION_STATUSES = [
  'submitted', 'under_review', 'verified', 'rejected', 'sent_to_owner', 'owner_accepted', 'owner_declined',
  'awaiting_fees', 'contact_unlocked', 'completed', 'cancelled',
] as const
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number]

export const TERMINAL_STATUSES = new Set<string>(['rejected', 'owner_declined', 'completed', 'cancelled'])
/** Before the owner has seen the application: the "verifying" bucket shown to owners as a count only. */
export const VERIFYING_STATUSES = ['submitted', 'under_review', 'verified'] as const

const TABLE: Record<Actor, Partial<Record<string, readonly string[]>>> = {
  admin: {
    submitted: ['under_review', 'verified', 'rejected'],
    under_review: ['verified', 'rejected'],
    verified: ['sent_to_owner'],
    sent_to_owner: ['owner_accepted', 'owner_declined'],
    contact_unlocked: ['completed'],
  },
  owner: {
    sent_to_owner: ['owner_accepted', 'owner_declined'],
    contact_unlocked: ['completed'],
  },
  renter: {},
  system: {
    owner_accepted: ['awaiting_fees'],
    awaiting_fees: ['contact_unlocked'],
  },
}

export function canTransition(from: string, to: string, by: Actor) {
  if (to === 'cancelled') {
    if (TERMINAL_STATUSES.has(from)) return false
    if (by === 'admin') return true
    if (by === 'renter') return from !== 'contact_unlocked'
    return false
  }
  return !!TABLE[by][from]?.includes(to)
}

/** Whether `by` can ever move an application into `to` (distinguishes 403 from 409 in the route). */
export function roleMayTarget(to: string, by: Actor) {
  if (to === 'cancelled') return by === 'admin' || by === 'renter'
  return Object.values(TABLE[by]).some((targets) => targets?.includes(to))
}

/** Statuses the given actor could move to from the application's current status (for UI hints). */
export function allowedNext(from: string, by: Actor) {
  return APPLICATION_STATUSES.filter((to) => canTransition(from, to, by))
}

/**
 * Validate and apply one transition, write the event + audit row, run side effects, and return the fresh row.
 * Runs inside a transaction (nested calls become savepoints in better-sqlite3).
 */
export function transition(app: Application, to: string, by: Actor, actorId: string | null, note?: string | null, ip?: string | null): Application {
  return db.transaction(() => {
    // Re-read inside the transaction so concurrent requests can't both pass the check.
    const cur = db.select().from(schema.applications).where(eq(schema.applications.id, app.id)).get()
    if (!cur) throw new HttpError(404, 'Not found', 'not_found')
    if (!canTransition(cur.status, to, by)) {
      throw new HttpError(409, `Cannot move an application from ${cur.status} to ${to}`, 'invalid_transition')
    }
    let finalNote = note?.trim() || null
    if (by === 'admin' && cur.status === 'sent_to_owner' && (to === 'owner_accepted' || to === 'owner_declined')) {
      finalNote = `${finalNote ?? ''} (recorded by admin on owner's behalf)`.trim()
    }
    const at = now()
    const patch: Partial<Application> = { status: to, updatedAt: at }
    if (to === 'contact_unlocked') patch.contactUnlocked = true
    db.update(schema.applications).set(patch).where(eq(schema.applications.id, cur.id)).run()
    db.insert(schema.applicationEvents).values({ id: newId('ev'), applicationId: cur.id, status: to, by, actorId, note: finalNote, at }).run()
    auditAs(actorId, 'application.transition', cur.id, { from: cur.status, to, by }, ip)

    runSideEffects(cur, to, by, finalNote, ip)
    return db.select().from(schema.applications).where(eq(schema.applications.id, cur.id)).get()!
  })
}

function runSideEffects(a: Application, to: string, _by: Actor, note: string | null, ip?: string | null) {
  const listing = db.select().from(schema.listings).where(eq(schema.listings.id, a.listingId)).get()
  const title = listing?.title ?? 'your listing'
  const renterLink = `/dashboard/applications/${a.id}`
  const ownerLink = `/owner/applications/${a.id}`
  switch (to) {
    case 'verified':
      db.update(schema.users).set({ verification: 'verified' }).where(eq(schema.users.id, a.renterId)).run()
      notify(a.renterId, 'You are verified', `Your application for "${title}" passed verification.`, renterLink)
      break
    case 'rejected':
      notify(a.renterId, 'Application not approved', note ?? `We could not approve your application for "${title}".`, renterLink)
      break
    case 'sent_to_owner':
      notify(a.ownerId, 'New verified applicant', `A verified renter is waiting for your decision on "${title}".`, ownerLink)
      notify(a.renterId, 'Presented to owner', `We sent your profile to the owner of "${title}".`, renterLink)
      break
    case 'owner_accepted': {
      const fresh = db.select().from(schema.applications).where(eq(schema.applications.id, a.id)).get()!
      transition(fresh, 'awaiting_fees', 'system', null, null, ip)
      const renter = db.select({ name: schema.users.name }).from(schema.users).where(eq(schema.users.id, a.renterId)).get()
      notify(a.renterId, 'Owner accepted your application', `Pay the service fee to unlock contact for "${title}".`, renterLink)
      notifyAdmins('Owner accepted', `Owner accepted ${renter?.name ?? 'the renter'} for "${title}". Fees pending.`, `/admin/applications/${a.id}`)
      break
    }
    case 'owner_declined':
      notify(a.renterId, 'Owner declined', `The owner of "${title}" chose another tenant this time.`, renterLink)
      break
    case 'contact_unlocked':
      notify(a.renterId, 'Contact unlocked', `You can now message the owner of "${title}".`, `/messages/${a.id}`)
      notify(a.ownerId, 'Contact unlocked', `You can now message your new tenant for "${title}".`, `/messages/${a.id}`)
      break
    case 'completed':
      db.update(schema.listings).set({ status: 'rented', updatedAt: now() }).where(eq(schema.listings.id, a.listingId)).run()
      notify(a.renterId, 'Deal completed', 'Congratulations on your new home! Please leave a review.', renterLink)
      notify(a.ownerId, 'Deal completed', `"${title}" is now marked as rented.`, ownerLink)
      break
  }
}

/**
 * Record one side's service fee as paid and, when both sides are paid, unlock contact.
 * Used by both the card payment route and the admin "mark paid" route.
 */
export function recordFeePayment(app: Application, side: 'renter' | 'owner', opts: { payerId: string; recordedBy?: string | null; providerRef?: string | null; actorId: string; ip?: string | null }) {
  return db.transaction(() => {
    const cur = db.select().from(schema.applications).where(eq(schema.applications.id, app.id)).get()
    if (!cur) throw new HttpError(404, 'Not found', 'not_found')
    if (cur.status !== 'awaiting_fees') throw new HttpError(409, 'Fees can only be paid once the owner has accepted', 'invalid_state')
    const paid = side === 'renter' ? cur.renterFeePaid : cur.ownerFeePaid
    if (paid) throw new HttpError(409, 'This fee has already been paid', 'already_paid')
    const listing = db.select({ currency: schema.listings.currency }).from(schema.listings).where(eq(schema.listings.id, cur.listingId)).get()
    db.insert(schema.payments).values({
      id: newId('pay'), applicationId: cur.id, payerId: opts.payerId, side, amount: side === 'renter' ? cur.renterFee : cur.ownerFee,
      currency: listing?.currency ?? 'USD', provider: opts.recordedBy ? 'offline' : 'mock', providerRef: opts.providerRef ?? null,
      status: 'succeeded', recordedBy: opts.recordedBy ?? null, createdAt: now(),
    }).run()
    db.update(schema.applications).set(side === 'renter' ? { renterFeePaid: true, updatedAt: now() } : { ownerFeePaid: true, updatedAt: now() })
      .where(eq(schema.applications.id, cur.id)).run()
    auditAs(opts.actorId, opts.recordedBy ? 'payment.mark_paid' : 'payment.paid', cur.id, { side }, opts.ip)
    const fresh = db.select().from(schema.applications).where(eq(schema.applications.id, cur.id)).get()!
    if (fresh.renterFeePaid && fresh.ownerFeePaid && !fresh.contactUnlocked) {
      return transition(fresh, 'contact_unlocked', 'system', null, 'Both service fees received.', opts.ip)
    }
    return fresh
  })
}

/**
 * Change the agreed rent and recompute both fees. Locked once any fee is paid, contact is unlocked, or the application
 * is closed. Shared by PATCH /applications/:id/price and the AI employees' executor.
 */
export function setAgreedPrice(app: Application, agreedPrice: number, actorId: string | null, ip?: string | null): Application {
  const a = db.select().from(schema.applications).where(eq(schema.applications.id, app.id)).get()
  if (!a) throw new HttpError(404, 'Not found', 'not_found')
  if (a.renterFeePaid || a.ownerFeePaid || a.contactUnlocked || TERMINAL_STATUSES.has(a.status)) {
    throw new HttpError(409, 'The price is locked once a fee has been paid or the application is closed', 'conflict')
  }
  const renter = db.select({ hasTenantPass: schema.users.hasTenantPass }).from(schema.users).where(eq(schema.users.id, a.renterId)).get()
  const fees = computeFees(agreedPrice, getFees(), { hasTenantPass: renter?.hasTenantPass })
  db.update(schema.applications).set({ agreedPrice, ...fees, updatedAt: now() }).where(eq(schema.applications.id, a.id)).run()
  auditAs(actorId, 'application.price', a.id, { from: a.agreedPrice, to: agreedPrice }, ip)
  return db.select().from(schema.applications).where(eq(schema.applications.id, a.id)).get()!
}
