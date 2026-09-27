import { Router } from 'express'
import { z } from 'zod'
import { and, desc, eq, sql } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { validate, v } from '../middleware/validate.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { conflict } from '../lib/errors.js'
import { serializeMe, serializeNotification } from '../lib/serialize.js'
import { audit } from '../lib/audit.js'
import { newId, now } from '../lib/crypto.js'
import { getFees } from '../lib/fees.js'
import { cardBody, getUserById, idSchema } from './common.js'

export const meRouter = Router()

const notifQuery = z.object({
  limit: z.preprocess((x) => (x === '' ? undefined : x), z.coerce.number().int().min(1).max(50).default(20)),
})
meRouter.get('/me/notifications', requireAuth, validate(notifQuery, 'query'), (req, res) => {
  const { limit } = v<z.infer<typeof notifQuery>>(req, 'query')
  const N = schema.notifications
  const items = db.select().from(N).where(eq(N.userId, req.user!.id)).orderBy(desc(N.at), desc(sql`rowid`)).limit(limit).all()
  const unread = db.select({ n: sql<number>`count(*)` }).from(N).where(and(eq(N.userId, req.user!.id), eq(N.read, false))).get()?.n ?? 0
  res.json({ items: items.map(serializeNotification), unread })
})

const readSchema = z.object({ id: idSchema.optional() })
meRouter.post('/me/notifications/read', requireAuth, validate(readSchema), (req, res) => {
  const { id } = v<z.infer<typeof readSchema>>(req)
  const N = schema.notifications
  db.update(N).set({ read: true }).where(and(eq(N.userId, req.user!.id), id ? eq(N.id, id) : undefined)).run()
  res.status(204).end()
})

meRouter.post('/me/tenant-pass', requireRole('renter'), validate(cardBody), (req, res) => {
  v<z.infer<typeof cardBody>>(req) // mock payment: card validated, never stored
  if (req.user!.hasTenantPass) throw conflict('You already have a Tenant Pass')
  const fees = getFees()
  db.transaction(() => {
    db.insert(schema.purchases).values({
      id: newId('pur'), userId: req.user!.id, product: 'tenant_pass', listingId: null, amount: fees.tenantPassPrice, currency: fees.currency,
      provider: 'mock', createdAt: now(),
    }).run()
    db.update(schema.users).set({ hasTenantPass: true }).where(eq(schema.users.id, req.user!.id)).run()
  })
  audit(req, 'purchase.tenant_pass', req.user!.id)
  res.json({ user: serializeMe(getUserById(req.user!.id)!) })
})
