import type { Request, Response } from 'express'
import { and, eq, gt, lt } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { env } from './env.js'
import { now, randomToken, sha256 } from './crypto.js'

export const SESSION_COOKIE = 'sb_session'
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14 // 14 days
const ABSOLUTE_MAX_MS = 1000 * 60 * 60 * 24 * 30

export async function createSession(res: Response, req: Request, userId: string) {
  const token = randomToken(32)
  const expires = new Date(Date.now() + SESSION_TTL_MS)
  db.insert(schema.sessions).values({
    id: sha256(token), userId, createdAt: now(), expiresAt: expires.toISOString(),
    ip: req.ip ?? null, userAgent: (req.headers['user-agent'] ?? '').slice(0, 200),
  }).run()
  setCookie(res, token, expires)
}

function setCookie(res: Response, token: string, expires: Date) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true, secure: env.isProd, sameSite: 'lax', path: '/', expires,
  })
}

export function clearSession(res: Response, req: Request) {
  const token = req.cookies?.[SESSION_COOKIE]
  if (token) db.delete(schema.sessions).where(eq(schema.sessions.id, sha256(token))).run()
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, secure: env.isProd, sameSite: 'lax', path: '/' })
}

export function revokeAllSessions(userId: string) {
  db.delete(schema.sessions).where(eq(schema.sessions.userId, userId)).run()
}

/** Returns the user for a valid session cookie, sliding the expiry. */
export function resolveSession(req: Request, res: Response) {
  const token = req.cookies?.[SESSION_COOKIE]
  if (!token || typeof token !== 'string' || token.length > 128) return null
  const id = sha256(token)
  const nowIso = now()
  const row = db.select().from(schema.sessions).where(and(eq(schema.sessions.id, id), gt(schema.sessions.expiresAt, nowIso))).get()
  if (!row) return null
  const user = db.select().from(schema.users).where(eq(schema.users.id, row.userId)).get()
  if (!user) return null
  // Sliding expiry, capped at an absolute maximum from creation.
  const created = new Date(row.createdAt).getTime()
  const next = new Date(Math.min(Date.now() + SESSION_TTL_MS, created + ABSOLUTE_MAX_MS))
  if (next.getTime() - new Date(row.expiresAt).getTime() > 60 * 60 * 1000) {
    db.update(schema.sessions).set({ expiresAt: next.toISOString() }).where(eq(schema.sessions.id, id)).run()
    setCookie(res, token, next)
  }
  return user
}

export function purgeExpiredSessions() {
  db.delete(schema.sessions).where(lt(schema.sessions.expiresAt, now())).run()
}
