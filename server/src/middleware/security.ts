import type { NextFunction, Request, Response } from 'express'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { env } from '../lib/env.js'
import { forbidden } from '../lib/errors.js'

export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'blob:', 'https://images.unsplash.com'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: env.isProd ? [] : null,
    },
  },
  crossOriginResourcePolicy: { policy: 'same-origin' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  hsts: env.isProd ? { maxAge: 15552000, includeSubDomains: true } : false,
})

/** CORS: only the configured dev origins, with credentials. In production the client is same-origin. */
export function cors(req: Request, res: Response, next: NextFunction) {
  const origin = req.headers.origin
  if (origin && env.corsOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    res.setHeader('Vary', 'Origin')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Requested-With')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
  }
  if (req.method === 'OPTIONS') { res.sendStatus(204); return }
  next()
}

/**
 * CSRF defence in depth:
 *  1. Session cookie is SameSite=Lax, so cross-site POSTs don't carry it.
 *  2. Every state-changing request must carry X-Requested-With: fetch (a custom header forces a CORS preflight).
 *  3. If Origin/Referer is present it must match an allowed origin or the host.
 */
export function csrfGuard(req: Request, _res: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next()
  if (req.headers['x-requested-with'] !== 'fetch') return next(forbidden('Missing request header'))
  const origin = req.headers.origin ?? (req.headers.referer ? safeOrigin(req.headers.referer) : undefined)
  if (origin) {
    const host = req.headers.host
    const allowed = env.corsOrigins.includes(origin) || (host && (origin === `https://${host}` || origin === `http://${host}`))
    if (!allowed) return next(forbidden('Cross-site request blocked'))
  }
  next()
}
function safeOrigin(url: string) { try { return new URL(url).origin } catch { return undefined } }

// Rate limits are disabled under NODE_ENV=test so the integration suite can exercise many logins quickly.
const skip = () => env.NODE_ENV === 'test'
export const apiLimiter = rateLimit({ skip, windowMs: 60_000, limit: 300, standardHeaders: 'draft-7', legacyHeaders: false })
export const authLimiter = rateLimit({ skip, windowMs: 15 * 60_000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Too many attempts, try again later' } })
export const uploadLimiter = rateLimit({ skip, windowMs: 60_000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false })
