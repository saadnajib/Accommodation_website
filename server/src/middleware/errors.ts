import type { NextFunction, Request, Response } from 'express'
import { HttpError } from '../lib/errors.js'
import { env } from '../lib/env.js'

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: 'Not found' })
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, code: err.code, details: err.details })
    return
  }
  const e = err as { type?: string; status?: number; code?: string; message?: string }
  if (e?.type === 'entity.too.large') { res.status(413).json({ error: 'Payload too large' }); return }
  if (e?.type === 'entity.parse.failed') { res.status(400).json({ error: 'Malformed JSON' }); return }
  if (e?.code === 'LIMIT_FILE_SIZE') { res.status(413).json({ error: 'File too large' }); return }
  if (e?.code === 'LIMIT_UNEXPECTED_FILE') { res.status(400).json({ error: 'Unexpected file field' }); return }
  console.error('[unhandled]', env.isProd ? e?.message : err)
  res.status(500).json({ error: 'Something went wrong' })
}
