import fs from 'node:fs'
import path from 'node:path'
import { env } from './env.js'
import { newId } from './crypto.js'

export const uploadRoot = path.resolve(process.cwd(), env.UPLOAD_DIR)
fs.mkdirSync(uploadRoot, { recursive: true })

const SIGNATURES: Array<{ mime: string; ext: string; test: (b: Buffer) => boolean }> = [
  { mime: 'image/jpeg', ext: 'jpg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: 'image/png', ext: 'png', test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mime: 'image/webp', ext: 'webp', test: (b) => b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP' },
  { mime: 'application/pdf', ext: 'pdf', test: (b) => b.subarray(0, 5).toString() === '%PDF-' },
]

/** Sniff the real type from magic bytes; the client-supplied MIME is never trusted. */
export function detectType(buf: Buffer, allowed: string[]) {
  const sig = SIGNATURES.find((s) => allowed.includes(s.mime) && s.test(buf))
  return sig ? { mime: sig.mime, ext: sig.ext } : null
}

/** Store bytes under a random name in a two-level directory; returns the relative path. */
export function storeBytes(buf: Buffer, ext: string) {
  const id = newId('f')
  const rel = path.join(id.slice(2, 4), `${id}.${ext}`)
  const abs = path.join(uploadRoot, rel)
  fs.mkdirSync(path.dirname(abs), { recursive: true })
  fs.writeFileSync(abs, buf, { mode: 0o600 })
  return { id, rel }
}

export function absolutePath(rel: string) {
  const abs = path.resolve(uploadRoot, rel)
  if (!abs.startsWith(uploadRoot + path.sep)) throw new Error('Path escape')
  return abs
}
