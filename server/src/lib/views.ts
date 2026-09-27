import type { Request } from 'express'
import { SESSION_COOKIE } from './session.js'
import { sha256 } from './crypto.js'

/** In-memory dedupe of listing views: one count per visitor + listing per hour. Resets on restart (acceptable). */
const TTL_MS = 60 * 60 * 1000
const MAX_ENTRIES = 50_000
const seen = new Map<string, number>()

function visitorKey(req: Request) {
  const token = req.cookies?.[SESSION_COOKIE]
  if (typeof token === 'string' && token) return `s:${sha256(token)}`
  // Anonymous visitors: fall back to IP + user agent.
  return `a:${sha256(`${req.ip ?? ''}|${req.headers['user-agent'] ?? ''}`)}`
}

/** Returns true the first time a visitor views a listing within the TTL window. */
export function shouldCountView(req: Request, listingId: string) {
  const t = Date.now()
  const key = `${visitorKey(req)}:${listingId}`
  const exp = seen.get(key)
  if (exp && exp > t) return false
  if (seen.size >= MAX_ENTRIES) {
    for (const [k, e] of seen) if (e <= t) seen.delete(k)
    if (seen.size >= MAX_ENTRIES) seen.clear()
  }
  seen.set(key, t + TTL_MS)
  return true
}

export function clearViewCache() { seen.clear() }
