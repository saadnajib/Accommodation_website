/**
 * Admin listing moderation, shared by PATCH /admin/listings/:id and the AI employees' executor so both
 * go through the same patch rules, audit row and owner notifications.
 */
import { eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { now } from './crypto.js'
import { auditAs, notify } from './audit.js'

type Listing = typeof schema.listings.$inferSelect
export type ListingStatus = Listing['status']

export interface ModerationPatch {
  status?: ListingStatus
  rejectionReason?: string
  featured?: boolean
}

/** Owner notifications for admin moderation decisions. */
export function notifyListingModeration(l: Listing, status: string, reason?: string | null) {
  if (status === 'active') notify(l.ownerId, 'Listing approved', `"${l.title}" is now live.`, `/owner/listings/${l.id}/edit`)
  if (status === 'rejected') notify(l.ownerId, 'Listing needs changes', reason || `"${l.title}" was not approved.`, `/owner/listings/${l.id}/edit`)
}

/** Apply an admin moderation patch, write the audit row, notify the owner on approve/reject; returns the fresh row. */
export function moderateListing(l: Listing, body: ModerationPatch, actorId: string | null, ip?: string | null): Listing {
  const patch: Partial<Listing> = { updatedAt: now() }
  if (body.status) {
    patch.status = body.status
    if (body.status === 'rejected') patch.rejectionReason = body.rejectionReason || null
    if (body.status === 'active' || body.status === 'pending_review') patch.rejectionReason = null
  } else if (body.rejectionReason !== undefined) {
    patch.rejectionReason = body.rejectionReason || null
  }
  if (body.featured !== undefined) {
    patch.featured = body.featured
    // Admin-granted features don't expire; paid ones keep their end date.
    if (!body.featured) patch.featuredUntil = null
    else if (!(l.featuredUntil && new Date(l.featuredUntil) > new Date())) patch.featuredUntil = null
  }
  db.update(schema.listings).set(patch).where(eq(schema.listings.id, l.id)).run()
  const fresh = db.select().from(schema.listings).where(eq(schema.listings.id, l.id)).get()!
  auditAs(actorId, 'listing.moderate', l.id, { from: l.status, ...body }, ip)
  if (body.status && body.status !== l.status) notifyListingModeration(fresh, body.status, fresh.rejectionReason)
  return fresh
}
