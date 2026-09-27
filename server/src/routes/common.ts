import { z } from 'zod'
import { and, eq, sql } from 'drizzle-orm'
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core'
import { db, schema } from '../db/index.js'
import { notFound } from '../lib/errors.js'
import { OWNER_VISIBLE_STATUSES } from '../lib/serialize.js'
import type { DbUser } from '../middleware/auth.js'

export const idSchema = z.string().regex(/^[\w-]{3,40}$/, 'Invalid id')
export const idParams = z.object({ id: idSchema })

export const cardSchema = z.object({
  number: z.string().transform((s) => s.replace(/[\s-]/g, '')).pipe(z.string().regex(/^\d{12,19}$/, 'Invalid card number')),
  exp: z.string().trim().regex(/^(0[1-9]|1[0-2])\s*\/\s*(\d{2}|\d{4})$/, 'Use MM/YY'),
  cvc: z.string().trim().regex(/^\d{3,4}$/, 'Invalid CVC'),
  name: z.string().trim().max(100).optional(),
})
export const cardBody = z.object({ card: cardSchema })
/** Only the last four digits of a card are ever kept, and only as a provider reference. */
export const cardRef = (card: z.infer<typeof cardSchema>) => `mock_${card.number.slice(-4)}`

/** Parses "true"/"false"/"1"/"0" query flags. */
export const boolQuery = z.enum(['true', 'false', '1', '0']).transform((s) => s === 'true' || s === '1')

/** Accepts YYYY-MM-DD or a full ISO timestamp; stores ISO. */
export const dateString = z.string().trim().max(40).refine((s) => /^\d{4}-\d{2}-\d{2}/.test(s) && !Number.isNaN(Date.parse(s)), 'Invalid date')
  .transform((s) => new Date(s).toISOString())

export function getUserById(id: string) {
  return db.select().from(schema.users).where(eq(schema.users.id, id)).get()
}

export function getListingById(id: string) {
  return db.select().from(schema.listings).where(eq(schema.listings.id, id)).get()
}

/**
 * Loads an application the viewer may see, or throws 404 (never 403, to avoid revealing existence).
 * Owners only see applications once they have been sent to them.
 */
export function loadApplicationFor(viewer: DbUser, id: string) {
  const a = db.select().from(schema.applications).where(eq(schema.applications.id, id)).get()
  if (!a) throw notFound()
  if (viewer.role === 'admin') return a
  if (viewer.id === a.renterId) return a
  if (viewer.id === a.ownerId && OWNER_VISIBLE_STATUSES.has(a.status)) return a
  throw notFound()
}

export function ratingFor(userId: string) {
  const r = db.select({ avg: sql<number | null>`avg(${schema.reviews.rating})`, count: sql<number>`count(*)` })
    .from(schema.reviews).where(eq(schema.reviews.toId, userId)).get()
  return { avg: r?.avg ? Math.round(r.avg * 100) / 100 : 0, count: r?.count ?? 0 }
}

/** True if `userId` (a renter) has a contact-unlocked application on the listing. */
export function renterUnlockedListing(userId: string, listingId: string) {
  return !!db.select({ id: schema.applications.id }).from(schema.applications)
    .where(and(eq(schema.applications.renterId, userId), eq(schema.applications.listingId, listingId), eq(schema.applications.contactUnlocked, true))).get()
}

export function listingSummary(l: typeof schema.listings.$inferSelect) {
  const image = l.images[0]
  return { id: l.id, title: l.title, city: l.city, area: l.area, image, images: image ? [image] : [], price: l.price, currency: l.currency, status: l.status }
}

/** Escapes LIKE wildcards in user input. */
export const likeTerm = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`

/** Case-insensitive (ASCII) substring match with wildcards in the input escaped. */
export const likeCol = (col: SQLiteColumn, q: string) => sql`${col} LIKE ${likeTerm(q)} ESCAPE '\\'`
