import type { NextFunction, Request, Response } from 'express'
import type { ZodType } from 'zod'
import { badRequest } from '../lib/errors.js'

export function validate<T>(schema: ZodType<T>, source: 'body' | 'query' | 'params' = 'body') {
  return (req: Request, _res: Response, next: NextFunction) => {
    const r = schema.safeParse(req[source])
    if (!r.success) {
      return next(badRequest('Validation failed', r.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }))))
    }
    // Express 5 makes req.query a getter; stash validated data on res.locals instead of mutating.
    ;(req as Request & { validated: Record<string, unknown> }).validated ??= {}
    ;(req as Request & { validated: Record<string, unknown> }).validated[source] = r.data
    next()
  }
}

export function v<T = unknown>(req: Request, source: 'body' | 'query' | 'params' = 'body'): T {
  return (req as Request & { validated?: Record<string, unknown> }).validated?.[source] as T
}
