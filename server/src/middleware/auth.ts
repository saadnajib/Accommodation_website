import type { NextFunction, Request, Response } from 'express'
import type { schema } from '../db/index.js'
import { resolveSession } from '../lib/session.js'
import { forbidden, unauthorized } from '../lib/errors.js'

export type DbUser = typeof schema.users.$inferSelect
export type Role = DbUser['role']

declare module 'express-serve-static-core' {
  interface Request { user: DbUser | null }
}

export function attachUser(req: Request, res: Response, next: NextFunction) {
  req.user = resolveSession(req, res)
  next()
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(unauthorized())
  next()
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(unauthorized())
    if (!roles.includes(req.user.role)) return next(forbidden())
    next()
  }
}
