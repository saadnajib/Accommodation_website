import type { Request } from 'express'
import { db, schema } from '../db/index.js'
import { newId, now } from './crypto.js'

export function audit(req: Request, action: string, target?: string, meta?: Record<string, unknown>) {
  db.insert(schema.auditLog).values({ id: newId('aud'), actorId: req.user?.id ?? null, action, target: target ?? null, meta: meta ?? null, ip: req.ip ?? null, at: now() }).run()
}

export function notify(userId: string, title: string, body: string, link?: string) {
  db.insert(schema.notifications).values({ id: newId('n'), userId, title, body, link: link ?? null, read: false, at: now() }).run()
}
