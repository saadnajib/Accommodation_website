import { Router, type Request } from 'express'
import { z } from 'zod'
import { and, asc, desc, eq, gte, inArray, isNotNull, lte, ne, or, sql, type SQL } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { validate, v } from '../middleware/validate.js'
import { requireRole } from '../middleware/auth.js'
import { badRequest, conflict, notFound } from '../lib/errors.js'
import { serializeListing, serializeUser, OWNER_VISIBLE_STATUSES } from '../lib/serialize.js'
import { audit, notify, notifyAdmins } from '../lib/audit.js'
import { newId, now } from '../lib/crypto.js'
import { getFees } from '../lib/fees.js'
import { shouldCountView } from '../lib/views.js'
import {
  boolQuery, cardBody, dateString, getListingById, getUserById, idParams, likeCol, ratingFor, renterUnlockedListing,
} from './common.js'

export const listingsRouter = Router()

export const LISTING_TYPES = ['room', 'studio', 'apartment', 'house', 'shared'] as const
export const LISTING_STATUSES = ['draft', 'pending_review', 'active', 'paused', 'rented', 'rejected'] as const
type Listing = typeof schema.listings.$inferSelect

/** Treat "" in query strings as absent. */
const q = <T extends z.ZodType>(s: T) => z.preprocess((x) => (x === '' ? undefined : x), s.optional())

/** Featured boosts expire lazily. */
export function expireFeatured() {
  db.update(schema.listings).set({ featured: false })
    .where(and(eq(schema.listings.featured, true), isNotNull(schema.listings.featuredUntil), lte(schema.listings.featuredUntil, now()))).run()
}

/* ---------- Search ---------- */

const searchSchema = z.object({
  city: q(z.string().trim().max(80)),
  type: q(z.enum(LISTING_TYPES)),
  min: q(z.coerce.number().int().min(0).max(10_000_000)),
  max: q(z.coerce.number().int().min(0).max(10_000_000)),
  beds: q(z.coerce.number().int().min(0).max(50)),
  furnished: q(boolQuery),
  bills: q(boolQuery),
  stay: q(z.coerce.number().int().min(1).max(120)),
  q: q(z.string().trim().max(100)),
  sort: z.preprocess((x) => (x === '' ? undefined : x), z.enum(['featured', 'price_asc', 'price_desc', 'newest']).default('featured')),
  page: z.preprocess((x) => (x === '' ? undefined : x), z.coerce.number().int().min(1).max(10_000).default(1)),
  limit: z.preprocess((x) => (x === '' ? undefined : x), z.coerce.number().int().min(1).max(50).default(12)),
})

listingsRouter.get('/listings', validate(searchSchema, 'query'), (req, res) => {
  const f = v<z.infer<typeof searchSchema>>(req, 'query')
  expireFeatured()
  const L = schema.listings
  const where: SQL[] = [eq(L.status, 'active')]
  if (f.city) where.push(sql`lower(${L.city}) = lower(${f.city})`)
  if (f.type) where.push(eq(L.type, f.type))
  if (f.min !== undefined) where.push(gte(L.price, f.min))
  if (f.max !== undefined) where.push(lte(L.price, f.max))
  if (f.beds !== undefined) where.push(gte(L.bedrooms, f.beds))
  if (f.furnished !== undefined) where.push(eq(L.furnished, f.furnished))
  if (f.bills !== undefined) where.push(eq(L.billsIncluded, f.bills))
  if (f.stay !== undefined) where.push(lte(L.minStayMonths, f.stay))
  if (f.q) where.push(or(likeCol(L.title, f.q), likeCol(L.description, f.q), likeCol(L.city, f.q), likeCol(L.area, f.q))!)
  const cond = and(...where)
  const order = {
    featured: [desc(L.featured), desc(L.createdAt)],
    price_asc: [asc(L.price), desc(L.createdAt)],
    price_desc: [desc(L.price), desc(L.createdAt)],
    newest: [desc(L.createdAt)],
  }[f.sort]
  const total = db.select({ n: sql<number>`count(*)` }).from(L).where(cond).get()?.n ?? 0
  const rows = db.select().from(L).where(cond).orderBy(...order).limit(f.limit).offset((f.page - 1) * f.limit).all()
  const cities = db.selectDistinct({ city: L.city }).from(L).where(eq(L.status, 'active')).orderBy(asc(L.city)).all().map((r) => r.city)
  res.json({ items: rows.map((l) => serializeListing(l, req.user)), total, page: f.page, limit: f.limit, cities })
})

/* ---------- Detail ---------- */

listingsRouter.get('/listings/:id', validate(idParams, 'params'), (req, res) => {
  const { id } = v<{ id: string }>(req, 'params')
  let l = getListingById(id)
  if (!l) throw notFound()
  const viewer = req.user
  const isOwner = viewer?.id === l.ownerId
  const isAdmin = viewer?.role === 'admin'
  const hasApplication = viewer?.role === 'renter' && !!db.select({ id: schema.applications.id }).from(schema.applications)
    .where(and(eq(schema.applications.listingId, l.id), eq(schema.applications.renterId, viewer.id))).get()
  if (l.status !== 'active' && !isOwner && !isAdmin && !hasApplication) throw notFound()

  if (l.status === 'active' && !isOwner && !isAdmin && shouldCountView(req, l.id)) {
    db.update(schema.listings).set({ views: sql`${schema.listings.views} + 1` }).where(eq(schema.listings.id, l.id)).run()
    l = { ...l, views: l.views + 1 }
  }
  const unlocked = viewer?.role === 'renter' && hasApplication && renterUnlockedListing(viewer.id, l.id)
  const owner = getUserById(l.ownerId)!
  const L = schema.listings
  const similar = db.select().from(L)
    .where(and(eq(L.status, 'active'), ne(L.id, l.id), or(eq(L.city, l.city), eq(L.type, l.type))))
    .orderBy(sql`CASE WHEN ${L.city} = ${l.city} THEN 0 ELSE 1 END`, desc(L.featured), desc(L.createdAt)).limit(4).all()
  const saved = viewer?.role === 'renter'
    ? !!db.select().from(schema.savedListings).where(and(eq(schema.savedListings.userId, viewer.id), eq(schema.savedListings.listingId, l.id))).get()
    : false
  res.json({
    listing: serializeListing(l, viewer, unlocked),
    owner: serializeUser(owner, viewer, unlocked),
    ownerRating: ratingFor(owner.id),
    similar: similar.map((s) => serializeListing(s, viewer)),
    saved,
  })
})

/* ---------- Create / edit ---------- */

const text = (min: number, max: number) => z.string().trim().min(min).max(max)
const stringList = z.array(z.string().trim().min(1).max(60)).max(40)
const imageList = z.array(z.string().trim().min(1).max(500)).max(20)

const listingFields = {
  title: text(3, 120),
  description: text(10, 5000),
  type: z.enum(LISTING_TYPES),
  city: text(1, 80),
  area: text(1, 80),
  address: text(3, 200),
  price: z.number().int().min(1).max(1_000_000),
  currency: z.string().regex(/^[A-Z]{3}$/),
  deposit: z.number().int().min(0).max(10_000_000),
  billsIncluded: z.boolean(),
  availableFrom: dateString,
  minStayMonths: z.number().int().min(1).max(120),
  bedrooms: z.number().int().min(0).max(50),
  bathrooms: z.number().int().min(0).max(50),
  sizeSqm: z.number().int().min(1).max(100_000),
  furnished: z.boolean(),
  amenities: stringList,
  houseRules: stringList,
  images: imageList,
}

const createSchema = z.object({
  ...listingFields,
  currency: listingFields.currency.optional(),
  amenities: stringList.default([]),
  houseRules: stringList.default([]),
  images: imageList.default([]),
  status: z.enum(['draft', 'pending_review']).default('pending_review'),
})
const patchSchema = z.object({ ...listingFields, status: z.enum(LISTING_STATUSES) }).partial()

const FILE_URL = /^\/api\/files\/([\w-]{3,40})$/
/** Images must be https URLs or listing photos uploaded by the listing's owner (admins may reuse any listing photo). */
function checkImages(images: string[], ownerId: string, isAdmin: boolean) {
  const out: string[] = []
  for (const raw of images) {
    const m = raw.match(FILE_URL)
    if (m) {
      const f = db.select().from(schema.files).where(eq(schema.files.id, m[1])).get()
      if (!f || f.kind !== 'listing_photo' || (!isAdmin && f.ownerId !== ownerId)) throw badRequest('Invalid image reference', [{ path: 'images', message: raw }])
      out.push(`/api/files/${f.id}`)
      continue
    }
    let url: URL
    try { url = new URL(raw) } catch { throw badRequest('Images must be uploaded photos or https URLs', [{ path: 'images', message: raw }]) }
    if (url.protocol !== 'https:' || url.username || url.password) throw badRequest('Images must be https URLs', [{ path: 'images', message: raw }])
    out.push(url.toString())
  }
  return out
}

listingsRouter.post('/listings', requireRole('owner'), validate(createSchema), (req, res) => {
  const body = v<z.infer<typeof createSchema>>(req)
  const images = checkImages(body.images, req.user!.id, false)
  const at = now()
  const row: Listing = {
    id: newId('l'), ownerId: req.user!.id, title: body.title, description: body.description, type: body.type, city: body.city,
    area: body.area, address: body.address, price: body.price, currency: body.currency ?? getFees().currency, deposit: body.deposit,
    billsIncluded: body.billsIncluded, availableFrom: body.availableFrom, minStayMonths: body.minStayMonths, bedrooms: body.bedrooms,
    bathrooms: body.bathrooms, sizeSqm: body.sizeSqm, furnished: body.furnished, amenities: body.amenities, houseRules: body.houseRules,
    images, status: body.status, featured: false, featuredUntil: null, views: 0, rejectionReason: null, createdAt: at, updatedAt: at,
  }
  db.insert(schema.listings).values(row).run()
  audit(req, 'listing.create', row.id, { status: row.status })
  if (row.status === 'pending_review') notifyAdmins('Listing pending review', `"${row.title}" was submitted for review.`, '/admin/listings')
  res.status(201).json({ listing: serializeListing(row, req.user) })
})

const OWNER_STATUS_MOVES: Record<string, string[]> = {
  draft: ['pending_review'],
  rejected: ['pending_review'],
  active: ['paused', 'rented'],
  paused: ['active', 'rented'],
}

/** Admin moderation side effects, shared with /admin/listings/:id. */
export function notifyListingModeration(l: Listing, status: string, reason?: string | null) {
  if (status === 'active') notify(l.ownerId, 'Listing approved', `"${l.title}" is now live.`, `/owner/listings/${l.id}/edit`)
  if (status === 'rejected') notify(l.ownerId, 'Listing needs changes', reason || `"${l.title}" was not approved.`, `/owner/listings/${l.id}/edit`)
}

listingsRouter.patch('/listings/:id', requireRole('owner', 'admin'), validate(idParams, 'params'), validate(patchSchema), (req, res) => {
  const { id } = v<{ id: string }>(req, 'params')
  const body = v<z.infer<typeof patchSchema>>(req)
  const l = getListingById(id)
  const isAdmin = req.user!.role === 'admin'
  if (!l || (!isAdmin && l.ownerId !== req.user!.id)) throw notFound()
  const patch: Partial<Listing> = { ...body, updatedAt: now() }
  if (body.images) patch.images = checkImages(body.images, l.ownerId, isAdmin)
  if (body.status && body.status !== l.status) {
    if (!isAdmin && !OWNER_STATUS_MOVES[l.status]?.includes(body.status)) {
      throw conflict(`A listing cannot move from ${l.status} to ${body.status}`)
    }
    if (body.status === 'pending_review') patch.rejectionReason = null
  } else {
    delete patch.status
  }
  db.update(schema.listings).set(patch).where(eq(schema.listings.id, l.id)).run()
  const fresh = getListingById(l.id)!
  audit(req, 'listing.update', l.id, { fields: Object.keys(body), from: l.status, to: fresh.status })
  if (patch.status === 'pending_review') notifyAdmins('Listing pending review', `"${fresh.title}" was submitted for review.`, '/admin/listings')
  if (isAdmin && patch.status) notifyListingModeration(fresh, patch.status, fresh.rejectionReason)
  res.json({ listing: serializeListing(fresh, req.user) })
})

/* ---------- Featuring (mock payment) ---------- */

listingsRouter.post('/listings/:id/feature', requireRole('owner'), validate(idParams, 'params'), validate(cardBody), (req, res) => {
  const { id } = v<{ id: string }>(req, 'params')
  const l = getListingById(id)
  if (!l || l.ownerId !== req.user!.id) throw notFound()
  if (l.status === 'rented' || l.status === 'rejected') throw conflict('This listing cannot be featured')
  const fees = getFees()
  const base = l.featured && l.featuredUntil && new Date(l.featuredUntil) > new Date() ? new Date(l.featuredUntil) : new Date()
  const until = new Date(base.getTime() + 30 * 86_400_000).toISOString()
  db.transaction(() => {
    db.insert(schema.purchases).values({
      id: newId('pur'), userId: req.user!.id, product: 'featured_listing', listingId: l.id, amount: fees.featuredListingPrice,
      currency: fees.currency, provider: 'mock', createdAt: now(),
    }).run()
    db.update(schema.listings).set({ featured: true, featuredUntil: until, updatedAt: now() }).where(eq(schema.listings.id, l.id)).run()
  })
  audit(req, 'listing.feature', l.id, { until })
  res.json({ listing: serializeListing(getListingById(l.id)!, req.user) })
})

/* ---------- Saved ---------- */

function toggleSave(req: Request, save: boolean) {
  const { id } = v<{ id: string }>(req, 'params')
  const userId = req.user!.id
  const S = schema.savedListings
  const existing = db.select().from(S).where(and(eq(S.userId, userId), eq(S.listingId, id))).get()
  if (save) {
    const l = getListingById(id)
    if (!l || (l.status !== 'active' && !existing)) throw notFound()
    if (!existing) db.insert(S).values({ userId, listingId: id, at: now() }).run()
    return true
  }
  if (existing) db.delete(S).where(and(eq(S.userId, userId), eq(S.listingId, id))).run()
  return false
}
listingsRouter.post('/listings/:id/save', requireRole('renter'), validate(idParams, 'params'), (req, res) => { res.json({ saved: toggleSave(req, true) }) })
listingsRouter.delete('/listings/:id/save', requireRole('renter'), validate(idParams, 'params'), (req, res) => { res.json({ saved: toggleSave(req, false) }) })

/* ---------- Owner's and renter's lists ---------- */

listingsRouter.get('/me/listings', requireRole('owner'), (req, res) => {
  expireFeatured()
  const rows = db.select().from(schema.listings).where(eq(schema.listings.ownerId, req.user!.id)).orderBy(desc(schema.listings.createdAt)).all()
  const ids = rows.map((r) => r.id)
  const counts = new Map<string, number>()
  if (ids.length) {
    const A = schema.applications
    for (const r of db.select({ listingId: A.listingId, n: sql<number>`count(*)` }).from(A)
      .where(and(inArray(A.listingId, ids), inArray(A.status, [...OWNER_VISIBLE_STATUSES]))).groupBy(A.listingId).all()) counts.set(r.listingId, r.n)
  }
  res.json({ items: rows.map((l) => ({ ...serializeListing(l, req.user), applicantsCount: counts.get(l.id) ?? 0 })) })
})

listingsRouter.get('/me/saved', requireRole('renter'), (req, res) => {
  const rows = db.select({ l: schema.listings }).from(schema.savedListings)
    .innerJoin(schema.listings, eq(schema.listings.id, schema.savedListings.listingId))
    .where(eq(schema.savedListings.userId, req.user!.id)).orderBy(desc(schema.savedListings.at)).all()
  res.json({ items: rows.map((r) => serializeListing(r.l, req.user, renterUnlockedListing(req.user!.id, r.l.id))) })
})
