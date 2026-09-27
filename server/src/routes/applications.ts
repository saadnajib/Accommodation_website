import { Router } from 'express'
import { z } from 'zod'
import { and, asc, desc, eq, inArray, notInArray, or, sql, type SQL } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { validate, v } from '../middleware/validate.js'
import { requireAuth, requireRole, type DbUser } from '../middleware/auth.js'
import { badRequest, conflict, forbidden, notFound } from '../lib/errors.js'
import {
  OWNER_VISIBLE_STATUSES, serializeApplication, serializeEvent, serializeListing, serializeReview, serializeUser,
} from '../lib/serialize.js'
import { audit, notifyAdmins } from '../lib/audit.js'
import { newId, now } from '../lib/crypto.js'
import { AGREEMENT_VERSION, computeFees, getFees } from '../lib/fees.js'
import {
  APPLICATION_STATUSES, TERMINAL_STATUSES, VERIFYING_STATUSES, allowedNext, recordFeePayment, roleMayTarget, setAgreedPrice, transition,
} from '../lib/stateMachine.js'
import { assertOwnFile } from './files.js'
import { agentEvents } from '../agents/events.js'
import { cardBody, cardRef, dateString, getListingById, getUserById, idParams, idSchema, likeCol, listingSummary, loadApplicationFor } from './common.js'

export const applicationsRouter = Router()

type Application = typeof schema.applications.$inferSelect

/* ---------- Submit ---------- */

const submitSchema = z.object({
  listingId: idSchema,
  proposedPrice: z.number().int().min(1).max(10_000_000),
  moveInDate: dateString,
  stayMonths: z.number().int().min(1).max(120),
  message: z.string().trim().max(2000).default(''),
  agreementAccepted: z.literal(true, { error: 'You must accept the agreement' }),
  verification: z.object({
    idType: z.enum(['passport', 'national_id', 'driving_licence']),
    idNumber: z.string().trim().min(4).max(40).regex(/^[A-Za-z0-9 -]+$/, 'Use letters and digits only'),
    idDocumentFileId: idSchema,
    selfieFileId: idSchema,
    proofOfIncomeFileId: idSchema.optional(),
  }),
  profile: z.object({
    occupation: z.string().trim().min(1).max(100),
    employer: z.string().trim().max(120).optional(),
    monthlyIncome: z.number().int().min(0).max(10_000_000),
    occupants: z.number().int().min(1).max(20),
    hasPets: z.boolean(),
    smoker: z.boolean(),
    aboutMe: z.string().trim().max(2000).default(''),
    references: z.string().trim().max(1000).optional(),
  }),
})

/** Keep only the last four characters; the rest of the ID number is discarded and never stored. */
export function maskIdNumber(raw: string) {
  const clean = raw.replace(/[\s-]/g, '')
  return '*'.repeat(Math.max(0, clean.length - 4)) + clean.slice(-4)
}

applicationsRouter.post('/applications', requireRole('renter'), validate(submitSchema), (req, res) => {
  const body = v<z.infer<typeof submitSchema>>(req)
  const renter = req.user!
  const listing = getListingById(body.listingId)
  if (!listing) throw notFound('Listing not found')
  if (listing.status !== 'active') throw conflict('This listing is not accepting applications')
  const A = schema.applications
  const open = db.select({ id: A.id }).from(A)
    .where(and(eq(A.renterId, renter.id), eq(A.listingId, listing.id), notInArray(A.status, [...TERMINAL_STATUSES]))).get()
  if (open) throw conflict('You already have an open application for this listing')
  if (body.proposedPrice < Math.ceil(listing.price * 0.4) || body.proposedPrice > listing.price * 2) {
    throw badRequest('Proposed rent must be between 40% and 200% of the asking price', [{ path: 'proposedPrice', message: 'Out of range' }])
  }
  const vf = body.verification
  assertOwnFile(renter.id, vf.idDocumentFileId, ['id_document'])
  assertOwnFile(renter.id, vf.selfieFileId, ['selfie'])
  assertOwnFile(renter.id, vf.proofOfIncomeFileId, ['proof_of_income'])

  const { renterFee, ownerFee } = computeFees(body.proposedPrice, getFees(), { hasTenantPass: renter.hasTenantPass })
  const at = now()
  const row: Application = {
    id: newId('a'), listingId: listing.id, renterId: renter.id, ownerId: listing.ownerId,
    proposedPrice: body.proposedPrice, agreedPrice: body.proposedPrice, moveInDate: body.moveInDate, stayMonths: body.stayMonths,
    message: body.message, agreementAccepted: true, agreementAcceptedAt: at, agreementVersion: AGREEMENT_VERSION,
    idType: vf.idType, idNumberMasked: maskIdNumber(vf.idNumber), idDocumentFileId: vf.idDocumentFileId, selfieFileId: vf.selfieFileId,
    proofOfIncomeFileId: vf.proofOfIncomeFileId ?? null, verificationSubmittedAt: at, profile: body.profile,
    status: 'submitted', renterFee, ownerFee, renterFeePaid: false, ownerFeePaid: false, contactUnlocked: false, adminNotes: '',
    createdAt: at, updatedAt: at,
  }
  db.transaction(() => {
    db.insert(A).values(row).run()
    db.insert(schema.applicationEvents).values({ id: newId('ev'), applicationId: row.id, status: 'submitted', by: 'renter', actorId: renter.id, note: null, at }).run()
    if (renter.verification === 'unverified') db.update(schema.users).set({ verification: 'pending' }).where(eq(schema.users.id, renter.id)).run()
    notifyAdmins('New application to verify', `${renter.name} applied for "${listing.title}".`, '/admin/verification')
    audit(req, 'application.submit', row.id, { listingId: listing.id })
  })
  agentEvents.emit('application.submitted', row.id)
  res.status(201).json({ application: serializeApplication(row, renter) })
})

/* ---------- Lists ---------- */

function decorate(apps: Application[], viewer: DbUser) {
  const listingIds = [...new Set(apps.map((a) => a.listingId))]
  const userIds = [...new Set(apps.flatMap((a) => [a.renterId, a.ownerId]))]
  const listings = new Map(listingIds.length ? db.select().from(schema.listings).where(inArray(schema.listings.id, listingIds)).all().map((l) => [l.id, l]) : [])
  const users = new Map(userIds.length ? db.select().from(schema.users).where(inArray(schema.users.id, userIds)).all().map((u) => [u.id, u]) : [])
  return apps.map((a) => {
    const l = listings.get(a.listingId)!
    const counterpartId = viewer.id === a.ownerId ? a.renterId : viewer.id === a.renterId ? a.ownerId : a.renterId
    const counterpart = users.get(counterpartId)!
    return {
      ...serializeApplication(a, viewer)!,
      listing: listingSummary(l),
      counterpart: serializeUser(counterpart, viewer, a.contactUnlocked),
      ...(viewer.role === 'admin' ? { owner: serializeUser(users.get(a.ownerId)!, viewer) } : {}),
    }
  })
}

const listQuery = z.object({
  status: z.preprocess((x) => (x === '' ? undefined : x), z.enum(APPLICATION_STATUSES).optional()),
  q: z.preprocess((x) => (x === '' ? undefined : x), z.string().trim().max(100).optional()),
})

applicationsRouter.get('/me/applications', requireAuth, validate(listQuery, 'query'), (req, res) => {
  const viewer = req.user!
  const f = v<z.infer<typeof listQuery>>(req, 'query')
  const A = schema.applications
  if (viewer.role === 'renter') {
    const where = [eq(A.renterId, viewer.id), ...(f.status ? [eq(A.status, f.status)] : [])]
    const rows = db.select().from(A).where(and(...where)).orderBy(desc(A.updatedAt)).all()
    res.json({ items: decorate(rows, viewer) })
    return
  }
  if (viewer.role === 'owner') {
    const statuses = f.status ? [f.status].filter((s) => OWNER_VISIBLE_STATUSES.has(s)) : [...OWNER_VISIBLE_STATUSES]
    const rows = statuses.length
      ? db.select().from(A).where(and(eq(A.ownerId, viewer.id), inArray(A.status, statuses))).orderBy(desc(A.updatedAt)).all()
      : []
    const verifyingCounts: Record<string, number> = {}
    for (const r of db.select({ listingId: A.listingId, n: sql<number>`count(*)` }).from(A)
      .where(and(eq(A.ownerId, viewer.id), inArray(A.status, [...VERIFYING_STATUSES]))).groupBy(A.listingId).all()) verifyingCounts[r.listingId] = r.n
    res.json({ items: decorate(rows, viewer), verifyingCounts })
    return
  }
  // admin
  const where: SQL[] = []
  if (f.status) where.push(eq(A.status, f.status))
  if (f.q) where.push(or(likeCol(schema.users.name, f.q), likeCol(schema.users.email, f.q), likeCol(schema.listings.title, f.q), likeCol(A.id, f.q))!)
  const rows = db.select({ a: A }).from(A)
    .innerJoin(schema.users, eq(schema.users.id, A.renterId))
    .innerJoin(schema.listings, eq(schema.listings.id, A.listingId))
    .where(where.length ? and(...where) : undefined).orderBy(desc(A.updatedAt)).all().map((r) => r.a)
  res.json({ items: decorate(rows, viewer) })
})

/* ---------- Detail ---------- */

function eventsFor(appId: string, viewer: DbUser) {
  const E = schema.applicationEvents
  return db.select().from(E).where(eq(E.applicationId, appId)).orderBy(asc(E.at), asc(sql`rowid`)).all().map((e) => serializeEvent(e, viewer))
}

function actorFor(viewer: DbUser, a: Application): 'admin' | 'owner' | 'renter' {
  if (viewer.role === 'admin') return 'admin'
  return viewer.id === a.ownerId ? 'owner' : 'renter'
}

export function applicationDetail(a: Application, viewer: DbUser) {
  const listing = getListingById(a.listingId)!
  const renter = getUserById(a.renterId)!
  const owner = getUserById(a.ownerId)!
  const isRenter = viewer.id === a.renterId
  const messagesCount = db.select({ n: sql<number>`count(*)` }).from(schema.messages).where(eq(schema.messages.applicationId, a.id)).get()?.n ?? 0
  const myReview = db.select().from(schema.reviews).where(and(eq(schema.reviews.applicationId, a.id), eq(schema.reviews.fromId, viewer.id))).get()
  return {
    application: serializeApplication(a, viewer),
    listing: serializeListing(listing, viewer, isRenter && a.contactUnlocked),
    renter: serializeUser(renter, viewer, a.contactUnlocked),
    owner: serializeUser(owner, viewer, a.contactUnlocked),
    events: eventsFor(a.id, viewer),
    messagesCount,
    myReview: myReview ? serializeReview(myReview) : undefined,
    allowedTransitions: allowedNext(a.status, actorFor(viewer, a)),
  }
}

applicationsRouter.get('/applications/:id', requireAuth, validate(idParams, 'params'), (req, res) => {
  const a = loadApplicationFor(req.user!, v<{ id: string }>(req, 'params').id)
  res.json(applicationDetail(a, req.user!))
})

/* ---------- Transitions ---------- */

const transitionSchema = z.object({
  status: z.enum(APPLICATION_STATUSES),
  note: z.string().trim().max(1000).optional(),
})

applicationsRouter.post('/applications/:id/transition', requireAuth, validate(idParams, 'params'), validate(transitionSchema), (req, res) => {
  const viewer = req.user!
  const { status, note } = v<z.infer<typeof transitionSchema>>(req)
  const a = loadApplicationFor(viewer, v<{ id: string }>(req, 'params').id)
  const by = actorFor(viewer, a)
  if (!roleMayTarget(status, by)) throw forbidden('You cannot make this change')
  if (by === 'owner' && status === 'owner_declined' && (!note || note.length < 5)) {
    throw badRequest('Please give a short reason (at least 5 characters)', [{ path: 'note', message: 'Required' }])
  }
  const fresh = transition(a, status, by, viewer.id, note, req.ip)
  res.json({ application: serializeApplication(fresh, viewer), events: eventsFor(fresh.id, viewer) })
})

/* ---------- Admin edits ---------- */

const priceSchema = z.object({ agreedPrice: z.number().int().min(1).max(10_000_000) })
applicationsRouter.patch('/applications/:id/price', requireRole('admin'), validate(idParams, 'params'), validate(priceSchema), (req, res) => {
  const { agreedPrice } = v<z.infer<typeof priceSchema>>(req)
  const a = loadApplicationFor(req.user!, v<{ id: string }>(req, 'params').id)
  setAgreedPrice(a, agreedPrice, req.user!.id, req.ip)
  res.json({ application: serializeApplication(loadApplicationFor(req.user!, a.id), req.user!) })
})

const notesSchema = z.object({ adminNotes: z.string().max(5000) })
applicationsRouter.patch('/applications/:id/notes', requireRole('admin'), validate(idParams, 'params'), validate(notesSchema), (req, res) => {
  const { adminNotes } = v<z.infer<typeof notesSchema>>(req)
  const a = loadApplicationFor(req.user!, v<{ id: string }>(req, 'params').id)
  db.update(schema.applications).set({ adminNotes, updatedAt: now() }).where(eq(schema.applications.id, a.id)).run()
  audit(req, 'application.notes', a.id)
  res.json({ application: serializeApplication(loadApplicationFor(req.user!, a.id), req.user!) })
})

/* ---------- Fees ---------- */

applicationsRouter.post('/applications/:id/pay', requireRole('renter', 'owner'), validate(idParams, 'params'), validate(cardBody), (req, res) => {
  const viewer = req.user!
  const { card } = v<z.infer<typeof cardBody>>(req)
  const a = loadApplicationFor(viewer, v<{ id: string }>(req, 'params').id)
  const side = viewer.id === a.renterId ? 'renter' : 'owner'
  const fresh = recordFeePayment(a, side, { payerId: viewer.id, providerRef: cardRef(card), actorId: viewer.id, ip: req.ip })
  res.json({ application: serializeApplication(fresh, viewer) })
})

const markPaidSchema = z.object({ side: z.enum(['renter', 'owner']) })
applicationsRouter.post('/applications/:id/mark-paid', requireRole('admin'), validate(idParams, 'params'), validate(markPaidSchema), (req, res) => {
  const { side } = v<z.infer<typeof markPaidSchema>>(req)
  const a = loadApplicationFor(req.user!, v<{ id: string }>(req, 'params').id)
  const fresh = recordFeePayment(a, side, { payerId: side === 'renter' ? a.renterId : a.ownerId, recordedBy: req.user!.id, actorId: req.user!.id, ip: req.ip })
  res.json({ application: serializeApplication(fresh, req.user!) })
})
