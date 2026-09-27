import { Router } from 'express'
import { z } from 'zod'
import { and, asc, eq, inArray, or, sql } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { validate, v } from '../middleware/validate.js'
import { requireAuth } from '../middleware/auth.js'
import { forbidden } from '../lib/errors.js'
import { serializeMessage, serializeUser } from '../lib/serialize.js'
import { notify } from '../lib/audit.js'
import { newId, now } from '../lib/crypto.js'
import { idParams, loadApplicationFor } from './common.js'

export const messagesRouter = Router()

const conversationLink = (appId: string) => `/messages/${appId}`

messagesRouter.get('/me/conversations', requireAuth, (req, res) => {
  const viewer = req.user!
  const A = schema.applications
  const isAdmin = viewer.role === 'admin'
  const apps = db.select().from(A)
    .where(and(eq(A.contactUnlocked, true), isAdmin ? undefined : or(eq(A.renterId, viewer.id), eq(A.ownerId, viewer.id)))).all()
  if (!apps.length) { res.json({ items: [] }); return }
  const ids = apps.map((a) => a.id)
  const listings = new Map(db.select({ id: schema.listings.id, title: schema.listings.title }).from(schema.listings)
    .where(inArray(schema.listings.id, [...new Set(apps.map((a) => a.listingId))])).all().map((l) => [l.id, l]))
  const users = new Map(db.select().from(schema.users).where(inArray(schema.users.id, [...new Set(apps.flatMap((a) => [a.renterId, a.ownerId]))])).all().map((u) => [u.id, u]))
  // Latest message per application.
  const M = schema.messages
  const last = new Map<string, typeof M.$inferSelect>()
  for (const m of db.select().from(M).where(inArray(M.applicationId, ids)).orderBy(asc(M.at), asc(sql`rowid`)).all()) last.set(m.applicationId, m)
  // Unread = unread "New message" notifications for this conversation.
  const N = schema.notifications
  const unread = new Map<string, number>()
  for (const n of db.select({ link: N.link, n: sql<number>`count(*)` }).from(N)
    .where(and(eq(N.userId, viewer.id), eq(N.read, false), eq(N.title, 'New message'))).groupBy(N.link).all()) {
    if (n.link) unread.set(n.link, n.n)
  }
  const items = apps.map((a) => {
    const counterpartId = viewer.id === a.renterId ? a.ownerId : a.renterId // admins see the renter as counterpart
    const lm = last.get(a.id)
    return {
      application: { id: a.id, status: a.status, listing: { id: a.listingId, title: listings.get(a.listingId)?.title ?? '' } },
      counterpart: serializeUser(users.get(counterpartId)!, viewer, true),
      ...(isAdmin ? { owner: serializeUser(users.get(a.ownerId)!, viewer, true) } : {}),
      lastMessage: lm ? serializeMessage(lm) : undefined,
      unread: unread.get(conversationLink(a.id)) ?? 0,
      _sort: lm?.at ?? a.updatedAt,
    }
  })
  items.sort((x, y) => y._sort.localeCompare(x._sort))
  res.json({ items: items.map(({ _sort, ...rest }) => rest) })
})

messagesRouter.get('/applications/:id/messages', requireAuth, validate(idParams, 'params'), (req, res) => {
  const viewer = req.user!
  const a = loadApplicationFor(viewer, v<{ id: string }>(req, 'params').id)
  if (!a.contactUnlocked) throw forbidden('Messaging opens once both service fees are paid')
  const M = schema.messages
  const rows = db.select().from(M).where(eq(M.applicationId, a.id)).orderBy(asc(M.at), asc(sql`rowid`)).all()
  // Reading the thread clears its "New message" notifications.
  db.update(schema.notifications).set({ read: true })
    .where(and(eq(schema.notifications.userId, viewer.id), eq(schema.notifications.link, conversationLink(a.id)), eq(schema.notifications.title, 'New message'))).run()
  res.json({ items: rows.map(serializeMessage) })
})

const messageSchema = z.object({ text: z.string().trim().min(1, 'Write a message').max(2000) })
messagesRouter.post('/applications/:id/messages', requireAuth, validate(idParams, 'params'), validate(messageSchema), (req, res) => {
  const viewer = req.user!
  const a = loadApplicationFor(viewer, v<{ id: string }>(req, 'params').id)
  if (viewer.id !== a.renterId && viewer.id !== a.ownerId) throw forbidden('Only the renter and owner can message here')
  if (!a.contactUnlocked) throw forbidden('Messaging opens once both service fees are paid')
  const { text } = v<z.infer<typeof messageSchema>>(req)
  const row = { id: newId('m'), applicationId: a.id, fromId: viewer.id, text, at: now() }
  db.insert(schema.messages).values(row).run()
  notify(viewer.id === a.renterId ? a.ownerId : a.renterId, 'New message', text.slice(0, 80), conversationLink(a.id))
  res.status(201).json({ message: serializeMessage(row) })
})
