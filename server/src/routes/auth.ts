import { Router } from 'express'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { hashPassword, verifyPassword, newId, now } from '../lib/crypto.js'
import { createSession, clearSession, revokeAllSessions } from '../lib/session.js'
import { validate, v } from '../middleware/validate.js'
import { requireAuth } from '../middleware/auth.js'
import { authLimiter } from '../middleware/security.js'
import { badRequest, conflict, tooMany, unauthorized } from '../lib/errors.js'
import { serializeMe } from '../lib/serialize.js'
import { audit } from '../lib/audit.js'
import { getFees } from '../lib/fees.js'

export const authRouter = Router()

const password = z.string().min(10, 'Use at least 10 characters').max(200)
  .refine((p) => /[a-zA-Z]/.test(p) && /[0-9]/.test(p), 'Use letters and numbers')

const signupSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.email().max(200).transform((e) => e.toLowerCase()),
  password,
  role: z.enum(['renter', 'owner']), // admin accounts are never self-registered
  phone: z.string().trim().max(40).optional(),
})

authRouter.post('/signup', authLimiter, validate(signupSchema), async (req, res) => {
  const body = v<z.infer<typeof signupSchema>>(req)
  const exists = db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, body.email)).get()
  if (exists) throw conflict('An account with that email already exists')
  const user = {
    id: newId('u'), name: body.name, email: body.email, passwordHash: await hashPassword(body.password), role: body.role,
    phone: body.phone ?? null, bio: null, avatarUrl: null, verification: 'unverified' as const, hasTenantPass: false,
    failedLogins: 0, lockedUntil: null, createdAt: now(),
  }
  db.insert(schema.users).values(user).run()
  await createSession(res, req, user.id)
  req.user = user
  audit(req, 'auth.signup', user.id)
  res.status(201).json({ user: serializeMe(user) })
})

const loginSchema = z.object({ email: z.email().transform((e) => e.toLowerCase()), password: z.string().min(1).max(200) })
const MAX_FAILED = 8
const LOCK_MS = 15 * 60_000

authRouter.post('/login', authLimiter, validate(loginSchema), async (req, res) => {
  const { email, password } = v<z.infer<typeof loginSchema>>(req)
  const user = db.select().from(schema.users).where(eq(schema.users.email, email)).get()
  // Constant-ish time: always run a hash verification even when the user is missing.
  const ok = user ? await verifyPassword(password, user.passwordHash) : (await verifyPassword(password, DUMMY_HASH), false)
  if (user?.lockedUntil && new Date(user.lockedUntil) > new Date()) throw tooMany('Account temporarily locked. Try again later.')
  if (!user || !ok) {
    if (user) {
      const failed = user.failedLogins + 1
      db.update(schema.users).set({ failedLogins: failed, lockedUntil: failed >= MAX_FAILED ? new Date(Date.now() + LOCK_MS).toISOString() : null }).where(eq(schema.users.id, user.id)).run()
    }
    audit(req, 'auth.login_failed', user?.id, { email })
    throw unauthorized('Wrong email or password')
  }
  db.update(schema.users).set({ failedLogins: 0, lockedUntil: null }).where(eq(schema.users.id, user.id)).run()
  await createSession(res, req, user.id)
  req.user = user
  audit(req, 'auth.login', user.id)
  res.json({ user: serializeMe(user) })
})
const DUMMY_HASH = 'scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='

authRouter.post('/logout', (req, res) => {
  clearSession(res, req)
  res.status(204).end()
})

authRouter.get('/me', (req, res) => {
  res.json({ user: req.user ? serializeMe(req.user) : null, fees: getFees() })
})

const profileSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  bio: z.string().trim().max(1000).nullable().optional(),
})
authRouter.patch('/me', requireAuth, validate(profileSchema), (req, res) => {
  const patch = v<z.infer<typeof profileSchema>>(req)
  db.update(schema.users).set(patch).where(eq(schema.users.id, req.user!.id)).run()
  const user = db.select().from(schema.users).where(eq(schema.users.id, req.user!.id)).get()!
  res.json({ user: serializeMe(user) })
})

const pwSchema = z.object({ currentPassword: z.string().min(1), newPassword: password })
authRouter.post('/change-password', requireAuth, authLimiter, validate(pwSchema), async (req, res) => {
  const { currentPassword, newPassword } = v<z.infer<typeof pwSchema>>(req)
  if (!(await verifyPassword(currentPassword, req.user!.passwordHash))) throw badRequest('Current password is wrong')
  db.update(schema.users).set({ passwordHash: await hashPassword(newPassword) }).where(eq(schema.users.id, req.user!.id)).run()
  revokeAllSessions(req.user!.id) // log out every other device
  await createSession(res, req, req.user!.id)
  audit(req, 'auth.password_changed', req.user!.id)
  res.status(204).end()
})
