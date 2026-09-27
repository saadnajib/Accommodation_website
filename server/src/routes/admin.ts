import { Router } from 'express'
import { z } from 'zod'
import fs from 'node:fs'
import { and, desc, eq, inArray, or, sql, type SQL } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { validate, v } from '../middleware/validate.js'
import { requireRole } from '../middleware/auth.js'
import { forbidden, notFound } from '../lib/errors.js'
import { serializeAdminUser, serializeListing } from '../lib/serialize.js'
import { audit, auditAs } from '../lib/audit.js'
import { clearSession } from '../lib/session.js'
import { DEFAULT_FEES, getFees, setFees } from '../lib/fees.js'
import { env } from '../lib/env.js'
import { absolutePath } from '../lib/files.js'
import { clearViewCache } from '../lib/views.js'
import { APPLICATION_STATUSES } from '../lib/stateMachine.js'
import { bootstrap } from '../bootstrap.js'
import { seedDemo } from '../seed.js'
import { getListingById, getUserById, idParams, idSchema, likeCol, ratingFor } from './common.js'
import { LISTING_STATUSES, expireFeatured } from './listings.js'
import { moderateListing } from '../lib/listingModeration.js'

export const adminRouter = Router()
adminRouter.use('/admin', requireRole('admin'))

const opt = <T extends z.ZodType>(s: T) => z.preprocess((x) => (x === '' ? undefined : x), s.optional())

/* ---------- Overview ---------- */

adminRouter.get('/admin/overview', (_req, res) => {
  const A = schema.applications
  const revenueCollected = db.select({ s: sql<number>`coalesce(sum(${schema.payments.amount}), 0)` }).from(schema.payments).where(eq(schema.payments.status, 'succeeded')).get()?.s ?? 0
  const purchasesCollected = db.select({ s: sql<number>`coalesce(sum(${schema.purchases.amount}), 0)` }).from(schema.purchases).get()?.s ?? 0
  const revenuePending = db.select({
    s: sql<number>`coalesce(sum((CASE WHEN ${A.renterFeePaid} = 1 THEN 0 ELSE ${A.renterFee} END) + (CASE WHEN ${A.ownerFeePaid} = 1 THEN 0 ELSE ${A.ownerFee} END)), 0)`,
  }).from(A).where(eq(A.status, 'awaiting_fees')).get()?.s ?? 0

  const pipeline: Record<string, number> = Object.fromEntries(APPLICATION_STATUSES.map((s) => [s, 0]))
  for (const r of db.select({ status: A.status, n: sql<number>`count(*)` }).from(A).groupBy(A.status).all()) pipeline[r.status] = r.n
  const usersByRole: Record<string, number> = { renter: 0, owner: 0, admin: 0 }
  for (const r of db.select({ role: schema.users.role, n: sql<number>`count(*)` }).from(schema.users).groupBy(schema.users.role).all()) usersByRole[r.role] = r.n
  expireFeatured()
  const L = schema.listings
  const countListings = (where: SQL | undefined) => db.select({ n: sql<number>`count(*)` }).from(L).where(where).get()?.n ?? 0

  const E = schema.applicationEvents
  const recent = db.select({ e: E, renterName: schema.users.name, listingTitle: L.title }).from(E)
    .innerJoin(A, eq(A.id, E.applicationId))
    .innerJoin(schema.users, eq(schema.users.id, A.renterId))
    .innerJoin(L, eq(L.id, A.listingId))
    .orderBy(desc(E.at), desc(sql`${E}.rowid`)).limit(15).all()

  const pendingApprovals = db.select({ n: sql<number>`count(*)` }).from(schema.agentProposals).where(eq(schema.agentProposals.status, 'pending')).get()?.n ?? 0

  res.json({
    revenueCollected,
    revenuePending,
    purchasesCollected,
    pendingApprovals,
    counts: {
      pendingApprovals,
      toVerify: pipeline.submitted + pipeline.under_review,
      readyToSend: pipeline.verified,
      waitingOnOwner: pipeline.sent_to_owner,
      awaitingFees: pipeline.awaiting_fees,
      completed: pipeline.completed,
      listingsPending: countListings(eq(L.status, 'pending_review')),
      listingsLive: countListings(eq(L.status, 'active')),
      listingsFeatured: countListings(and(eq(L.status, 'active'), eq(L.featured, true))),
      usersByRole,
    },
    pipeline,
    recentEvents: recent.map((r) => ({
      application: { id: r.e.applicationId, renterName: r.renterName, listingTitle: r.listingTitle },
      status: r.e.status, by: r.e.by, note: r.e.note ?? undefined, at: r.e.at,
    })),
  })
})

/* ---------- Users ---------- */

const usersQuery = z.object({ q: opt(z.string().trim().max(100)), role: opt(z.enum(['renter', 'owner', 'admin'])) })
adminRouter.get('/admin/users', validate(usersQuery, 'query'), (req, res) => {
  const f = v<z.infer<typeof usersQuery>>(req, 'query')
  const U = schema.users
  const where: SQL[] = []
  if (f.role) where.push(eq(U.role, f.role))
  if (f.q) where.push(or(likeCol(U.name, f.q), likeCol(U.email, f.q))!)
  const rows = db.select().from(U).where(where.length ? and(...where) : undefined).orderBy(desc(U.createdAt)).all()
  const appCounts = new Map<string, number>()
  const listingCounts = new Map<string, number>()
  const ids = rows.map((u) => u.id)
  if (ids.length) {
    for (const r of db.select({ id: schema.applications.renterId, n: sql<number>`count(*)` }).from(schema.applications)
      .where(inArray(schema.applications.renterId, ids)).groupBy(schema.applications.renterId).all()) appCounts.set(r.id, r.n)
    for (const r of db.select({ id: schema.listings.ownerId, n: sql<number>`count(*)` }).from(schema.listings)
      .where(inArray(schema.listings.ownerId, ids)).groupBy(schema.listings.ownerId).all()) listingCounts.set(r.id, r.n)
  }
  res.json({
    items: rows.map((u) => ({ ...serializeAdminUser(u), applicationsCount: appCounts.get(u.id) ?? 0, listingsCount: listingCounts.get(u.id) ?? 0, rating: ratingFor(u.id) })),
  })
})

const verificationSchema = z.object({ verification: z.enum(['unverified', 'pending', 'verified', 'rejected']) })
adminRouter.patch('/admin/users/:id/verification', validate(idParams, 'params'), validate(verificationSchema), (req, res) => {
  const { id } = v<{ id: string }>(req, 'params')
  const { verification } = v<z.infer<typeof verificationSchema>>(req)
  if (id === req.user!.id) throw forbidden('You cannot change your own verification')
  const u = getUserById(id)
  if (!u) throw notFound()
  db.update(schema.users).set({ verification }).where(eq(schema.users.id, id)).run()
  audit(req, 'user.verification', id, { from: u.verification, to: verification })
  res.json({ user: serializeAdminUser(getUserById(id)!) })
})

/* ---------- Listings ---------- */

const listingsQuery = z.object({ status: opt(z.enum(LISTING_STATUSES)), q: opt(z.string().trim().max(100)), owner: opt(idSchema) })
adminRouter.get('/admin/listings', validate(listingsQuery, 'query'), (req, res) => {
  const f = v<z.infer<typeof listingsQuery>>(req, 'query')
  expireFeatured()
  const L = schema.listings
  const where: SQL[] = []
  if (f.status) where.push(eq(L.status, f.status))
  if (f.owner) where.push(eq(L.ownerId, f.owner))
  if (f.q) where.push(or(likeCol(L.title, f.q), likeCol(L.city, f.q), likeCol(L.area, f.q), likeCol(schema.users.name, f.q))!)
  const rows = db.select({ l: L, ownerName: schema.users.name }).from(L).innerJoin(schema.users, eq(schema.users.id, L.ownerId))
    .where(where.length ? and(...where) : undefined).orderBy(desc(L.createdAt)).all()
  res.json({ items: rows.map((r) => ({ ...serializeListing(r.l, req.user), ownerName: r.ownerName })) })
})

const moderateSchema = z.object({
  status: z.enum(LISTING_STATUSES).optional(),
  rejectionReason: z.string().trim().max(1000).optional(),
  featured: z.boolean().optional(),
})
adminRouter.patch('/admin/listings/:id', validate(idParams, 'params'), validate(moderateSchema), (req, res) => {
  const { id } = v<{ id: string }>(req, 'params')
  const body = v<z.infer<typeof moderateSchema>>(req)
  const l = getListingById(id)
  if (!l) throw notFound()
  const fresh = moderateListing(l, body, req.user!.id, req.ip)
  res.json({ listing: serializeListing(fresh, req.user) })
})

/* ---------- Settings ---------- */

adminRouter.get('/admin/settings', (_req, res) => { res.json({ fees: getFees() }) })

const feesSchema = z.object({
  fees: z.object({
    renterFeeRate: z.number().min(0).max(2),
    ownerFeeRate: z.number().min(0).max(2),
    minFee: z.number().int().min(0).max(100_000),
    tenantPassPrice: z.number().int().min(0).max(100_000),
    featuredListingPrice: z.number().int().min(0).max(100_000),
    currency: z.string().regex(/^[A-Z]{3}$/),
  }).partial(),
})
adminRouter.put('/admin/settings', validate(feesSchema), (req, res) => {
  const { fees } = v<z.infer<typeof feesSchema>>(req)
  const next = { ...DEFAULT_FEES, ...getFees(), ...fees }
  setFees(next)
  audit(req, 'settings.fees', 'fees', fees)
  res.json({ fees: next })
})

/* ---------- Audit ---------- */

const auditQuery = z.object({ limit: z.preprocess((x) => (x === '' ? undefined : x), z.coerce.number().int().min(1).max(200).default(100)) })
adminRouter.get('/admin/audit', validate(auditQuery, 'query'), (req, res) => {
  const { limit } = v<z.infer<typeof auditQuery>>(req, 'query')
  const AL = schema.auditLog
  const rows = db.select({ a: AL, actorName: schema.users.name }).from(AL).leftJoin(schema.users, eq(schema.users.id, AL.actorId))
    .orderBy(desc(AL.at), desc(sql`${AL}.rowid`)).limit(limit).all()
  res.json({ items: rows.map((r) => ({ ...r.a, actorName: r.actorName ?? undefined })) })
})

/* ---------- Demo reset ---------- */

/** Deletes every row (children before parents) and uploaded files, then recreates the admin and the demo data. */
export async function resetDemoData() {
  const stored = db.select({ path: schema.files.storagePath }).from(schema.files).all()
  db.transaction(() => {
    for (const t of [
      schema.agentProposals, schema.agentRuns,
      schema.auditLog, schema.notifications, schema.savedListings, schema.reviews, schema.messages, schema.payments,
      schema.applicationEvents, schema.applications, schema.purchases, schema.listings, schema.files, schema.sessions,
      schema.settings, schema.users,
    ]) db.delete(t).run()
  })
  for (const f of stored) {
    try { fs.rmSync(absolutePath(f.path), { force: true }) } catch { /* ignore missing/escaped paths */ }
  }
  clearViewCache()
  await bootstrap({ quiet: true })
  if (!db.select({ id: schema.listings.id }).from(schema.listings).limit(1).get()) await seedDemo()
}

adminRouter.post('/admin/reset-demo', async (req, res) => {
  if (env.isProd) throw forbidden('Demo reset is disabled in production')
  const actor = req.user!.email
  await resetDemoData()
  // Every session (including the caller's) was deleted with the users; clear the cookie too.
  auditAs(null, 'admin.reset_demo', undefined, { by: actor }, req.ip)
  clearSession(res, req)
  res.status(204).end()
})

