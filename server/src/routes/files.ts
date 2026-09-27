import { Router } from 'express'
import multer from 'multer'
import fs from 'node:fs'
import { eq, or } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { requireAuth } from '../middleware/auth.js'
import { uploadLimiter } from '../middleware/security.js'
import { detectType, storeBytes, absolutePath } from '../lib/files.js'
import { badRequest, forbidden, notFound } from '../lib/errors.js'
import { now } from '../lib/crypto.js'
import { serializeFile } from '../lib/serialize.js'

export const filesRouter = Router()

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024, files: 8, fields: 5 } })

const KINDS = {
  listing_photo: { visibility: 'public', allowed: ['image/jpeg', 'image/png', 'image/webp'], roles: ['owner', 'admin'] },
  id_document: { visibility: 'private', allowed: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'], roles: ['renter'] },
  selfie: { visibility: 'private', allowed: ['image/jpeg', 'image/png', 'image/webp'], roles: ['renter'] },
  proof_of_income: { visibility: 'private', allowed: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'], roles: ['renter'] },
} as const

/** POST /api/files?kind=listing_photo  (multipart, field "files") → { files: [...] } */
filesRouter.post('/', requireAuth, uploadLimiter, upload.array('files', 8), (req, res) => {
  const kind = String(req.query.kind ?? '') as keyof typeof KINDS
  const spec = KINDS[kind]
  if (!spec) throw badRequest('Unknown file kind')
  if (!(spec.roles as readonly string[]).includes(req.user!.role)) throw forbidden()
  const incoming = (req.files as Express.Multer.File[] | undefined) ?? []
  if (!incoming.length) throw badRequest('No files received')
  const out = []
  for (const f of incoming) {
    const type = detectType(f.buffer, [...spec.allowed])
    if (!type) throw badRequest(`"${f.originalname}" is not an allowed file type`)
    const { id, rel } = storeBytes(f.buffer, type.ext)
    const row = {
      id, ownerId: req.user!.id, kind, visibility: spec.visibility, mime: type.mime, size: f.size, storagePath: rel,
      originalName: f.originalname.replace(/[^\w.\- ]/g, '_').slice(0, 120), createdAt: now(),
    }
    db.insert(schema.files).values(row).run()
    out.push(serializeFile(row))
  }
  res.status(201).json({ files: out })
})

/** GET /api/files/:id — public files: anyone. Private: uploader or admin only. */
filesRouter.get('/:id', (req, res) => {
  const f = db.select().from(schema.files).where(eq(schema.files.id, req.params.id)).get()
  if (!f) throw notFound()
  if (f.visibility === 'private') {
    const u = req.user
    if (!u) throw notFound() // don't reveal existence
    if (u.role !== 'admin' && u.id !== f.ownerId) throw notFound()
    res.setHeader('Cache-Control', 'private, no-store')
  } else {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
  }
  const abs = absolutePath(f.storagePath)
  if (!fs.existsSync(abs)) throw notFound()
  res.setHeader('Content-Type', f.mime)
  res.setHeader('Content-Disposition', `inline; filename="${f.id}"`)
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox") // neutralise SVG/PDF script execution
  fs.createReadStream(abs).pipe(res)
})

/** Used by other routes to confirm a file id belongs to the caller and is of a kind. */
export function assertOwnFile(userId: string, id: string | undefined, kinds: string[]) {
  if (!id) return null
  const f = db.select().from(schema.files).where(or(eq(schema.files.id, id))).get()
  if (!f || f.ownerId !== userId || !kinds.includes(f.kind)) throw badRequest('Invalid file reference')
  return f
}
