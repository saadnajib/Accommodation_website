import { Router } from 'express'
import { z } from 'zod'
import { and, desc, eq, inArray } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { validate, v } from '../middleware/validate.js'
import { requireAuth } from '../middleware/auth.js'
import { conflict, forbidden, notFound } from '../lib/errors.js'
import { serializeReview, serializeUser } from '../lib/serialize.js'
import { audit, notify } from '../lib/audit.js'
import { newId, now } from '../lib/crypto.js'
import { getUserById, idParams, loadApplicationFor, ratingFor } from './common.js'

export const reviewsRouter = Router()

const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  text: z.string().trim().min(10, 'Write at least 10 characters').max(1000),
})

reviewsRouter.post('/applications/:id/reviews', requireAuth, validate(idParams, 'params'), validate(reviewSchema), (req, res) => {
  const viewer = req.user!
  const a = loadApplicationFor(viewer, v<{ id: string }>(req, 'params').id)
  if (viewer.id !== a.renterId && viewer.id !== a.ownerId) throw forbidden('Only the renter and owner can review this stay')
  if (a.status !== 'completed') throw conflict('Reviews open once the deal is completed')
  const R = schema.reviews
  if (db.select({ id: R.id }).from(R).where(and(eq(R.applicationId, a.id), eq(R.fromId, viewer.id))).get()) {
    throw conflict('You have already reviewed this stay')
  }
  const { rating, text } = v<z.infer<typeof reviewSchema>>(req)
  const toId = viewer.id === a.renterId ? a.ownerId : a.renterId
  const row = { id: newId('r'), applicationId: a.id, fromId: viewer.id, toId, rating, text, at: now() }
  db.insert(R).values(row).run()
  notify(toId, 'New review', `${viewer.name.split(/\s+/)[0]} left you a ${rating}-star review.`)
  audit(req, 'review.create', row.id, { applicationId: a.id })
  res.status(201).json({ review: serializeReview(row) })
})

reviewsRouter.get('/users/:id/reviews', validate(idParams, 'params'), (req, res) => {
  const { id } = v<{ id: string }>(req, 'params')
  if (!getUserById(id)) throw notFound()
  const R = schema.reviews
  const rows = db.select().from(R).where(eq(R.toId, id)).orderBy(desc(R.at)).all()
  const authors = new Map(rows.length ? db.select().from(schema.users).where(inArray(schema.users.id, [...new Set(rows.map((r) => r.fromId))])).all().map((u) => [u.id, u]) : [])
  res.json({
    items: rows.map((r) => ({ ...serializeReview(r), from: serializeUser(authors.get(r.fromId)!, req.user) })),
    ...ratingFor(id),
  })
})
