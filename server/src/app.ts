import express from 'express'
import cookieParser from 'cookie-parser'
import path from 'node:path'
import fs from 'node:fs'
import { securityHeaders, cors, csrfGuard, apiLimiter } from './middleware/security.js'
import { attachUser } from './middleware/auth.js'
import { errorHandler, notFoundHandler } from './middleware/errors.js'
import { authRouter } from './routes/auth.js'
import { filesRouter } from './routes/files.js'
import { apiRouter } from './routes/index.js'
import { env } from './lib/env.js'

export function createApp() {
  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', env.isProd ? 1 : false)
  app.use(securityHeaders)
  app.use(cors)
  app.use(cookieParser())
  app.use(express.json({ limit: '1mb' }))
  app.use(attachUser)

  app.use('/api', apiLimiter, csrfGuard)
  app.get('/api/health', (_req, res) => { res.json({ ok: true }) })
  app.use('/api/auth', authRouter)
  app.use('/api/files', filesRouter)
  app.use('/api', apiRouter)
  app.use('/api', notFoundHandler)

  // Production: serve the built client from ../dist with SPA fallback.
  const dist = path.resolve(process.cwd(), '../dist')
  if (fs.existsSync(dist)) {
    app.use(express.static(dist, { index: false, maxAge: '1y', immutable: true, setHeaders: (res, p) => { if (p.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache') } }))
    app.get('*splat', (_req, res) => { res.setHeader('Cache-Control', 'no-cache'); res.sendFile(path.join(dist, 'index.html')) })
  }

  app.use(errorHandler)
  return app
}
