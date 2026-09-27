import { describe, it, expect, afterAll } from 'vitest'
import request from 'supertest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import zlib from 'node:zlib'

// Environment must be set before any server module (env.ts reads it at import time).
const uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'staybridge-test-'))
process.env.NODE_ENV = 'test'
process.env.SESSION_SECRET = 'test-session-secret-0123456789abcdefghijklmnop'
process.env.UPLOAD_DIR = uploadDir
process.env.DATABASE_URL = ':memory:'
process.env.SEED_DEMO = 'false'
process.env.ADMIN_EMAIL = 'admin@test.local'
process.env.ADMIN_PASSWORD = 'AdminPass!2026'
process.env.CORS_ORIGINS = ''

const dbm = await import('../db/index.js')
dbm.setDb(dbm.openDatabase(':memory:'))
const { createApp } = await import('../app.js')
const { bootstrap } = await import('../bootstrap.js')
await bootstrap({ quiet: true })
const app = createApp()

afterAll(() => { fs.rmSync(uploadDir, { recursive: true, force: true }) })

/* ---------- helpers ---------- */

function crc32(buf: Buffer) {
  let c = ~0
  for (const b of buf) {
    c ^= b
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c >>> 0
}
function chunk(type: string, data: Buffer) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}
/** A real, minimal 1×1 RGB PNG. */
function png() {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(1, 0); ihdr.writeUInt32BE(1, 4); ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(Buffer.from([0, 200, 120, 40]))), chunk('IEND', Buffer.alloc(0)),
  ])
}

const H = { 'X-Requested-With': 'fetch' }
function client() {
  const a = request.agent(app)
  return {
    get: (u: string) => a.get(u),
    post: (u: string, body?: object) => a.post(u).set(H).send(body ?? {}),
    patch: (u: string, body: object) => a.patch(u).set(H).send(body),
    put: (u: string, body: object) => a.put(u).set(H).send(body),
    del: (u: string) => a.delete(u).set(H),
    upload: (kind: string, name = 'photo.png') => a.post(`/api/files?kind=${kind}`).set(H).attach('files', png(), name),
  }
}
type Client = ReturnType<typeof client>

async function signup(name: string, email: string, role: 'renter' | 'owner') {
  const c = client()
  const r = await c.post('/api/auth/signup', { name, email, password: 'Secret-pass-123', role, phone: '+1 555 0100' })
  expect(r.status).toBe(201)
  return { c, user: r.body.user as { id: string; name: string; email: string } }
}
async function login(email: string, password: string) {
  const c = client()
  const r = await c.post('/api/auth/login', { email, password })
  expect(r.status).toBe(200)
  return c
}

const card = { number: '4242 4242 4242 4242', exp: '12/30', cvc: '123' }
const listingInput = (over: Record<string, unknown> = {}) => ({
  title: 'Bright studio close to the park', description: 'A lovely light-filled studio, recently renovated, close to transport and shops.',
  type: 'studio', city: 'Porto', area: 'Bonfim', address: 'Rua Secreta 12, 4000-123 Porto', price: 1000, deposit: 2000,
  billsIncluded: true, availableFrom: '2026-11-01', minStayMonths: 6, bedrooms: 0, bathrooms: 1, sizeSqm: 35, furnished: true,
  amenities: ['Wi-Fi'], houseRules: ['No smoking'], images: ['https://images.unsplash.com/photo-1?w=1200'], ...over,
})

/* ---------- shared state across the ordered scenario ---------- */
const s = {} as {
  renter: Client; renterUser: { id: string }; owner: Client; ownerUser: { id: string }; admin: Client; other: Client
  listingId: string; berlinId: string; draftId: string; appId: string; idDocId: string; selfieId: string
}

describe('auth', () => {
  it('signup, me, logout, login', async () => {
    const { c, user } = await signup('Jonas Wagner', 'jonas@test.local', 'renter')
    expect(user).not.toHaveProperty('passwordHash')
    const me = await c.get('/api/auth/me')
    expect(me.body.user.email).toBe('jonas@test.local')
    expect(me.body.user).not.toHaveProperty('failedLogins')
    expect(me.body.fees.renterFeeRate).toBeTypeOf('number')
    expect((await c.post('/api/auth/logout')).status).toBe(204)
    expect((await c.get('/api/auth/me')).body.user).toBeNull()
    s.renter = await login('jonas@test.local', 'Secret-pass-123')
    s.renterUser = (await s.renter.get('/api/auth/me')).body.user
    expect(s.renterUser.id).toBe(user.id)
  })

  it('duplicate signup is 409 and admin cannot self-register', async () => {
    const c = client()
    expect((await c.post('/api/auth/signup', { name: 'X Y', email: 'jonas@test.local', password: 'Secret-pass-123', role: 'renter' })).status).toBe(409)
    expect((await c.post('/api/auth/signup', { name: 'X Y', email: 'x@test.local', password: 'Secret-pass-123', role: 'admin' })).status).toBe(400)
  })

  it('locks the account after 8 failed logins', async () => {
    await signup('Victim User', 'victim@test.local', 'renter')
    const c = client()
    for (let i = 0; i < 8; i++) expect((await c.post('/api/auth/login', { email: 'victim@test.local', password: 'wrong-password-1' })).status).toBe(401)
    const locked = await c.post('/api/auth/login', { email: 'victim@test.local', password: 'Secret-pass-123' })
    expect(locked.status).toBe(429)
  })

  it('requires the CSRF header on state-changing requests', async () => {
    const r = await request(app).post('/api/auth/login').send({ email: 'jonas@test.local', password: 'Secret-pass-123' })
    expect(r.status).toBe(403)
    const cross = await request(app).post('/api/auth/login').set(H).set('Origin', 'https://evil.example').send({ email: 'a@b.co', password: 'x' })
    expect(cross.status).toBe(403)
  })
})

describe('listings', () => {
  it('owner creates a listing → pending_review, hidden from the public', async () => {
    const o = await signup('Marta Ferreira', 'marta@test.local', 'owner')
    s.owner = o.c; s.ownerUser = o.user
    s.admin = await login('admin@test.local', 'AdminPass!2026')
    s.other = (await signup('Other Renter', 'other@test.local', 'renter')).c

    const up = await s.owner.upload('listing_photo')
    expect(up.status).toBe(201)
    const photoUrl = up.body.files[0].url
    expect(photoUrl).toMatch(/^\/api\/files\//)
    // Public photos are fetchable by anyone.
    expect((await request(app).get(photoUrl)).status).toBe(200)

    const r = await s.owner.post('/api/listings', listingInput({ images: [photoUrl, 'https://images.unsplash.com/photo-2'] }))
    expect(r.status).toBe(201)
    expect(r.body.listing.status).toBe('pending_review')
    s.listingId = r.body.listing.id

    // Renters cannot create listings; data: URLs and foreign file refs are rejected.
    expect((await s.renter.post('/api/listings', listingInput())).status).toBe(403)
    expect((await s.owner.post('/api/listings', listingInput({ images: ['data:image/png;base64,AAAA'] }))).status).toBe(400)
    expect((await s.owner.post('/api/listings', listingInput({ images: ['/api/files/f_doesnotexist'] }))).status).toBe(400)

    const list = await request(app).get('/api/listings')
    expect(list.body.items.map((l: { id: string }) => l.id)).not.toContain(s.listingId)
    expect((await request(app).get(`/api/listings/${s.listingId}`)).status).toBe(404)
    expect((await s.owner.get(`/api/listings/${s.listingId}`)).status).toBe(200)
  })

  it('admin approves; listing goes live and owner is notified', async () => {
    const r = await s.admin.patch(`/api/admin/listings/${s.listingId}`, { status: 'active' })
    expect(r.status).toBe(200)
    expect(r.body.listing.status).toBe('active')
    const n = await s.owner.get('/api/me/notifications')
    expect(n.body.items.some((x: { title: string }) => x.title === 'Listing approved')).toBe(true)
    expect(n.body.unread).toBeGreaterThan(0)
  })

  it('search filters work and inactive listings stay hidden', async () => {
    const b = await s.owner.post('/api/listings', listingInput({ title: 'Cheap Berlin room with balcony', city: 'Berlin', area: 'Mitte', type: 'room', price: 500, furnished: false, bedrooms: 1 }))
    s.berlinId = b.body.listing.id
    await s.admin.patch(`/api/admin/listings/${s.berlinId}`, { status: 'active' })
    const d = await s.owner.post('/api/listings', listingInput({ title: 'Draft only listing in Berlin', city: 'Berlin', status: 'draft' }))
    expect(d.body.listing.status).toBe('draft')
    s.draftId = d.body.listing.id

    const ids = async (qs: string) => (await request(app).get(`/api/listings?${qs}`)).body.items.map((l: { id: string }) => l.id)
    expect(await ids('city=berlin')).toEqual([s.berlinId])
    expect(await ids('max=600')).toEqual([s.berlinId])
    expect(await ids('min=900&city=Porto')).toEqual([s.listingId])
    expect(await ids('type=studio')).toEqual([s.listingId])
    expect(await ids('furnished=false')).toEqual([s.berlinId])
    expect(await ids('beds=1')).toEqual([s.berlinId])
    expect(await ids('q=balcony')).toEqual([s.berlinId])
    expect(await ids('q=%25')).toEqual([]) // LIKE wildcard is escaped
    expect(await ids('sort=price_asc')).toEqual([s.berlinId, s.listingId])
    const all = await request(app).get('/api/listings?limit=1&page=2&sort=price_desc')
    expect(all.body).toMatchObject({ total: 2, page: 2, limit: 1 })
    expect(all.body.items[0].id).toBe(s.berlinId)
    expect(all.body.cities).toEqual(['Berlin', 'Porto'])
    expect(await ids('')).not.toContain(s.draftId)
    expect((await request(app).get('/api/listings?limit=51')).status).toBe(400)
    expect((await request(app).get('/api/listings?sort=cheapest')).status).toBe(400)
    expect((await request(app).get('/api/listings?type=castle')).status).toBe(400)

    // Owner status moves: active→paused ok, paused→draft not allowed.
    expect((await s.owner.patch(`/api/listings/${s.berlinId}`, { status: 'paused' })).body.listing.status).toBe('paused')
    expect((await s.owner.patch(`/api/listings/${s.berlinId}`, { status: 'draft' })).status).toBe(409)
    expect((await s.renter.patch(`/api/listings/${s.berlinId}`, { title: 'Hijacked title here' })).status).toBe(403)
    expect(await ids('city=Berlin')).toEqual([])
  })

  it('renter cannot see the address; views are deduped per session', async () => {
    const r1 = await s.renter.get(`/api/listings/${s.listingId}`)
    expect(r1.status).toBe(200)
    expect(r1.body.listing.address).toBeUndefined()
    expect(r1.body.owner.email).toBeUndefined()
    expect(r1.body.owner.name).toBe('Marta F.')
    const before = r1.body.listing.views
    const r2 = await s.renter.get(`/api/listings/${s.listingId}`)
    expect(r2.body.listing.views).toBe(before)
    const r3 = await s.other.get(`/api/listings/${s.listingId}`)
    expect(r3.body.listing.views).toBe(before + 1)
    const own = await s.owner.get(`/api/listings/${s.listingId}`)
    expect(own.body.listing.address).toContain('Rua Secreta')
  })

  it('save / unsave', async () => {
    expect((await s.renter.post(`/api/listings/${s.listingId}/save`)).body.saved).toBe(true)
    expect((await s.renter.get('/api/me/saved')).body.items).toHaveLength(1)
    expect((await s.renter.del(`/api/listings/${s.listingId}/save`)).body.saved).toBe(false)
    expect((await s.owner.post(`/api/listings/${s.listingId}/save`)).status).toBe(403)
  })
})

describe('application lifecycle', () => {
  const apply = (over: Record<string, unknown> = {}) => ({
    listingId: s.listingId, proposedPrice: 950, moveInDate: '2026-12-01', stayMonths: 12, message: 'Hello, I would love to rent this.',
    agreementAccepted: true,
    verification: { idType: 'passport', idNumber: 'X1234 5678', idDocumentFileId: s.idDocId, selfieFileId: s.selfieId },
    profile: { occupation: 'Engineer', monthlyIncome: 5000, occupants: 1, hasPets: false, smoker: false, aboutMe: 'Tidy and quiet.' },
    ...over,
  })

  it('renter applies with uploaded documents → 201; duplicates → 409', async () => {
    const doc = await s.renter.upload('id_document', 'passport.png')
    const selfie = await s.renter.upload('selfie', 'me.png')
    expect(doc.status).toBe(201)
    s.idDocId = doc.body.files[0].id
    s.selfieId = selfie.body.files[0].id

    // Owners can't upload renter documents; fake bytes are rejected by magic-byte sniffing.
    expect((await s.owner.upload('id_document')).status).toBe(403)
    const fake = await request.agent(app).post('/api/files?kind=selfie').set(H).attach('files', Buffer.from('<svg/>'), 'x.png')
    expect([401, 400]).toContain(fake.status)

    expect((await s.renter.post('/api/applications', apply({ proposedPrice: 100 }))).status).toBe(400)
    expect((await s.renter.post('/api/applications', apply({ agreementAccepted: false }))).status).toBe(400)
    expect((await s.renter.post('/api/applications', apply({ listingId: s.draftId }))).status).toBe(409)
    const otherDoc = await s.other.upload('id_document')
    expect((await s.renter.post('/api/applications', apply({ verification: { idType: 'passport', idNumber: '12345678', idDocumentFileId: otherDoc.body.files[0].id, selfieFileId: s.selfieId } }))).status).toBe(400)

    const r = await s.renter.post('/api/applications', apply())
    expect(r.status).toBe(201)
    expect(r.body.application.status).toBe('submitted')
    expect(r.body.application.verification.idNumberMasked).toBe('*****5678')
    expect(JSON.stringify(r.body)).not.toContain('X1234')
    s.appId = r.body.application.id
    expect((await s.renter.get('/api/auth/me')).body.user.verification).toBe('pending')

    expect((await s.renter.post('/api/applications', apply())).status).toBe(409)
    const adminNotifs = await s.admin.get('/api/me/notifications')
    expect(adminNotifs.body.items[0].title).toBe('New application to verify')
  })

  it('owner cannot see the application while it is being verified', async () => {
    expect((await s.owner.get(`/api/applications/${s.appId}`)).status).toBe(404)
    expect((await s.owner.post(`/api/applications/${s.appId}/transition`, { status: 'owner_accepted' })).status).toBe(404)
    const mine = await s.owner.get('/api/me/applications')
    expect(mine.body.items).toHaveLength(0)
    expect(mine.body.verifyingCounts).toEqual({ [s.listingId]: 1 })
    const ml = await s.owner.get('/api/me/listings')
    expect(ml.body.items.find((l: { id: string }) => l.id === s.listingId).applicantsCount).toBe(0)
  })

  it('renter cannot fetch another renter\'s application (404)', async () => {
    expect((await s.other.get(`/api/applications/${s.appId}`)).status).toBe(404)
    expect((await s.other.get(`/api/applications/${s.appId}/messages`)).status).toBe(404)
    expect((await s.other.post(`/api/applications/${s.appId}/transition`, { status: 'cancelled' })).status).toBe(404)
  })

  it('admin verifies and sends to owner; owner sees an anonymised renter', async () => {
    expect((await s.admin.post(`/api/applications/${s.appId}/transition`, { status: 'bogus' })).status).toBe(400)
    expect((await s.admin.post(`/api/applications/${s.appId}/transition`, { status: 'sent_to_owner' })).status).toBe(409)
    for (const status of ['under_review', 'verified', 'sent_to_owner']) {
      const r = await s.admin.post(`/api/applications/${s.appId}/transition`, { status })
      expect(r.status).toBe(200)
      expect(r.body.application.status).toBe(status)
    }
    expect((await s.renter.get('/api/auth/me')).body.user.verification).toBe('verified')
    await s.admin.patch(`/api/applications/${s.appId}/notes`, { adminNotes: 'secret admin note' })

    const r = await s.owner.get(`/api/applications/${s.appId}`)
    expect(r.status).toBe(200)
    expect(r.body.renter.name).toBe('Jonas W.')
    expect(r.body.renter.email).toBeUndefined()
    expect(r.body.renter.phone).toBeUndefined()
    expect(r.body.application.renterFee).toBeUndefined()
    expect(r.body.application.adminNotes).toBeUndefined()
    expect(r.body.application.verification.idNumberMasked).toBeUndefined()
    expect(r.body.application.verification.idDocumentFileId).toBeUndefined()
    expect(JSON.stringify(r.body)).not.toContain('secret admin note')
    expect(JSON.stringify(r.body)).not.toContain(s.idDocId)
    expect(r.body.allowedTransitions).toEqual(['owner_accepted', 'owner_declined'])
    const list = await s.owner.get('/api/me/applications')
    expect(list.body.items).toHaveLength(1)
    expect(list.body.items[0].counterpart.name).toBe('Jonas W.')

    // Renter never sees admin notes either.
    const rr = await s.renter.get(`/api/applications/${s.appId}`)
    expect(rr.body.application.adminNotes).toBeUndefined()
    expect(rr.body.owner.email).toBeUndefined()
    expect(rr.body.listing.address).toBeUndefined()
  })

  it('owner is limited by the state machine; accept → awaiting_fees', async () => {
    expect((await s.owner.post(`/api/applications/${s.appId}/transition`, { status: 'verified' })).status).toBe(403)
    expect((await s.owner.post(`/api/applications/${s.appId}/transition`, { status: 'cancelled' })).status).toBe(403)
    expect((await s.owner.post(`/api/applications/${s.appId}/transition`, { status: 'completed' })).status).toBe(409)
    expect((await s.owner.post(`/api/applications/${s.appId}/transition`, { status: 'owner_declined' })).status).toBe(400)
    const r = await s.owner.post(`/api/applications/${s.appId}/transition`, { status: 'owner_accepted', note: 'Welcome!' })
    expect(r.status).toBe(200)
    expect(r.body.application.status).toBe('awaiting_fees')
    expect(r.body.events.map((e: { status: string }) => e.status).slice(-2)).toEqual(['owner_accepted', 'awaiting_fees'])
    expect(r.body.events.at(-1).by).toBe('system')
    const rn = await s.renter.get('/api/me/notifications')
    expect(rn.body.items.some((n: { title: string }) => n.title === 'Owner accepted your application')).toBe(true)
  })

  it('messaging is closed before unlock', async () => {
    expect((await s.renter.get(`/api/applications/${s.appId}/messages`)).status).toBe(403)
    expect((await s.renter.post(`/api/applications/${s.appId}/messages`, { text: 'hi' })).status).toBe(403)
  })

  it('both sides pay → contact_unlocked; full contact and address revealed', async () => {
    expect((await s.admin.patch(`/api/applications/${s.appId}/price`, { agreedPrice: 900 })).body.application.agreedPrice).toBe(900)
    const r1 = await s.renter.post(`/api/applications/${s.appId}/pay`, { card })
    expect(r1.status).toBe(200)
    expect(r1.body.application.renterFeePaid).toBe(true)
    expect(r1.body.application.contactUnlocked).toBe(false)
    expect((await s.renter.post(`/api/applications/${s.appId}/pay`, { card })).status).toBe(409)
    expect((await s.admin.patch(`/api/applications/${s.appId}/price`, { agreedPrice: 800 })).status).toBe(409)
    expect((await s.owner.post(`/api/applications/${s.appId}/pay`, { card: { ...card, number: '12' } })).status).toBe(400)
    const r2 = await s.owner.post(`/api/applications/${s.appId}/pay`, { card })
    expect(r2.body.application.status).toBe('contact_unlocked')
    expect(r2.body.application.contactUnlocked).toBe(true)

    const rv = await s.renter.get(`/api/applications/${s.appId}`)
    expect(rv.body.owner.email).toBe('marta@test.local')
    expect(rv.body.owner.name).toBe('Marta Ferreira')
    expect(rv.body.listing.address).toContain('Rua Secreta')
    expect((await s.renter.get(`/api/listings/${s.listingId}`)).body.listing.address).toContain('Rua Secreta')
    const ov = await s.owner.get(`/api/applications/${s.appId}`)
    expect(ov.body.renter.name).toBe('Jonas Wagner')
    expect(ov.body.renter.email).toBe('jonas@test.local')
    // Still hidden from an unrelated renter.
    expect((await s.other.get(`/api/listings/${s.listingId}`)).body.listing.address).toBeUndefined()
    // Renter can't cancel once contact is unlocked.
    expect((await s.renter.post(`/api/applications/${s.appId}/transition`, { status: 'cancelled' })).status).toBe(409)
  })

  it('messaging works after unlock (participants only)', async () => {
    const m = await s.renter.post(`/api/applications/${s.appId}/messages`, { text: 'Hi Marta, when can I view it?' })
    expect(m.status).toBe(201)
    expect((await s.renter.post(`/api/applications/${s.appId}/messages`, { text: 'x'.repeat(2001) })).status).toBe(400)
    expect((await s.admin.post(`/api/applications/${s.appId}/messages`, { text: 'admin here' })).status).toBe(403)
    const conv = await s.owner.get('/api/me/conversations')
    expect(conv.body.items).toHaveLength(1)
    expect(conv.body.items[0].counterpart.name).toBe('Jonas Wagner')
    expect(conv.body.items[0].unread).toBe(1)
    expect(conv.body.items[0].lastMessage.text).toContain('Hi Marta')
    const list = await s.owner.get(`/api/applications/${s.appId}/messages`)
    expect(list.body.items).toHaveLength(1)
    expect((await s.owner.get('/api/me/conversations')).body.items[0].unread).toBe(0)
    expect((await s.admin.get(`/api/applications/${s.appId}/messages`)).status).toBe(200)
  })

  it('private files: 404 for others, 200 for uploader and admin; traversal → 404', async () => {
    expect((await s.other.get(`/api/files/${s.idDocId}`)).status).toBe(404)
    expect((await s.owner.get(`/api/files/${s.idDocId}`)).status).toBe(404)
    expect((await request(app).get(`/api/files/${s.idDocId}`)).status).toBe(404)
    expect((await s.renter.get(`/api/files/${s.idDocId}`)).status).toBe(200)
    const adm = await s.admin.get(`/api/files/${s.idDocId}`)
    expect(adm.status).toBe(200)
    expect(adm.headers['content-type']).toBe('image/png')
    expect((await s.admin.get('/api/files/..%2F..%2Fpackage.json')).status).toBe(404)
    expect((await s.admin.get('/api/files/%2e%2e%2f%2e%2e%2f.env')).status).toBe(404)
    // The admin sees document ids on the application.
    const a = await s.admin.get(`/api/applications/${s.appId}`)
    expect(a.body.application.verification.idDocumentFileId).toBe(s.idDocId)
  })

  it('reviews only after completion; owner completes → listing rented', async () => {
    expect((await s.renter.post(`/api/applications/${s.appId}/reviews`, { rating: 5, text: 'Great place to live!' })).status).toBe(409)
    const done = await s.owner.post(`/api/applications/${s.appId}/transition`, { status: 'completed' })
    expect(done.body.application.status).toBe('completed')
    expect((await s.owner.get(`/api/listings/${s.listingId}`)).body.listing.status).toBe('rented')
    const rv = await s.renter.post(`/api/applications/${s.appId}/reviews`, { rating: 5, text: 'Great place to live!' })
    expect(rv.status).toBe(201)
    expect((await s.renter.post(`/api/applications/${s.appId}/reviews`, { rating: 4, text: 'Second review attempt' })).status).toBe(409)
    expect((await s.owner.post(`/api/applications/${s.appId}/reviews`, { rating: 9, text: 'Invalid rating value' })).status).toBe(400)
    const list = await request(app).get(`/api/users/${s.ownerUser.id}/reviews`)
    expect(list.body).toMatchObject({ count: 1, avg: 5 })
    expect(list.body.items[0].from.name).toBe('Jonas W.')
    expect((await s.renter.get(`/api/applications/${s.appId}`)).body.myReview.rating).toBe(5)
  })

  it('tenant pass purchase', async () => {
    const r = await s.other.post('/api/me/tenant-pass', { card })
    expect(r.body.user.hasTenantPass).toBe(true)
    expect((await s.other.post('/api/me/tenant-pass', { card })).status).toBe(409)
  })

  it('notifications mark-read', async () => {
    expect((await s.renter.get('/api/me/notifications?limit=100')).status).toBe(400)
    const n = await s.renter.get('/api/me/notifications?limit=5')
    expect(n.body.items.length).toBeLessThanOrEqual(5)
    expect(n.body.unread).toBeGreaterThan(0)
    expect((await s.renter.post('/api/me/notifications/read', { id: n.body.items[0].id })).status).toBe(204)
    await s.renter.post('/api/me/notifications/read')
    expect((await s.renter.get('/api/me/notifications')).body.unread).toBe(0)
  })
})

describe('admin', () => {
  it('overview returns numbers; admin routes are admin-only', async () => {
    const r = await s.admin.get('/api/admin/overview')
    expect(r.status).toBe(200)
    expect(r.body.revenueCollected).toBeGreaterThan(0)
    expect(r.body.revenuePending).toBe(0)
    expect(r.body.pipeline.completed).toBe(1)
    expect(r.body.counts.usersByRole.renter).toBe(3)
    expect(r.body.counts.listingsPending).toBe(0)
    expect(r.body.recentEvents[0].application.listingTitle).toBeTypeOf('string')
    expect((await s.renter.get('/api/admin/overview')).status).toBe(403)
    expect((await request(app).get('/api/admin/overview')).status).toBe(401)
  })

  it('users, verification, settings, audit', async () => {
    const users = await s.admin.get('/api/admin/users?role=renter&q=jonas')
    expect(users.body.items).toHaveLength(1)
    expect(users.body.items[0]).toMatchObject({ applicationsCount: 1 })
    expect(users.body.items[0]).not.toHaveProperty('passwordHash')
    const me = (await s.admin.get('/api/auth/me')).body.user
    expect((await s.admin.patch(`/api/admin/users/${me.id}/verification`, { verification: 'rejected' })).status).toBe(403)
    expect((await s.admin.patch(`/api/admin/users/${s.renterUser.id}/verification`, { verification: 'nope' })).status).toBe(400)
    const put = await s.admin.put('/api/admin/settings', { fees: { minFee: 120 } })
    expect(put.body.fees.minFee).toBe(120)
    expect((await request(app).get('/api/auth/me')).body.fees.minFee).toBe(120)
    const audit = await s.admin.get('/api/admin/audit?limit=10')
    expect(audit.body.items.length).toBe(10)
    const listings = await s.admin.get('/api/admin/listings?status=draft')
    expect(listings.body.items[0].ownerName).toBe('Marta Ferreira')
    expect(listings.body.items[0].address).toBeTypeOf('string')
  })

  it('reset-demo wipes and reseeds in test env', async () => {
    const r = await s.admin.post('/api/admin/reset-demo')
    expect(r.status).toBe(204)
    expect((await s.admin.get('/api/admin/overview')).status).toBe(401) // sessions were wiped
    expect((await client().post('/api/auth/login', { email: 'jonas@test.local', password: 'Secret-pass-123' })).status).toBe(401)

    const pub = await request(app).get('/api/listings')
    expect(pub.body.total).toBe(7)
    expect(pub.body.items.slice(0, 3).every((l: { featured: boolean }) => l.featured)).toBe(true)

    const jonas = await login('jonas@staybridge.demo', 'Demo!Pass2026')
    const a1 = await jonas.get('/api/applications/a_1')
    expect(a1.body.application).toMatchObject({ status: 'awaiting_fees', ownerFeePaid: true, renterFeePaid: false, renterFee: 640 })
    expect(a1.body.owner.name).toBe('Marco B.')
    expect(a1.body.events).toHaveLength(6)
    expect((await jonas.get('/api/me/saved')).body.items.map((l: { id: string }) => l.id).sort()).toEqual(['l_2', 'l_9'])
    // Paying the renter side of a_1 unlocks it.
    const paid = await jonas.post('/api/applications/a_1/pay', { card })
    expect(paid.body.application.status).toBe('contact_unlocked')

    const marco = await login('marco@staybridge.demo', 'Demo!Pass2026')
    const conv = await marco.get('/api/me/conversations')
    expect(conv.body.items.map((c: { application: { id: string } }) => c.application.id).sort()).toEqual(['a_1', 'a_5'])
    expect((await marco.get('/api/applications/a_4')).status).toBe(404) // still being verified
    const reviews = await request(app).get('/api/users/u_owner1/reviews')
    expect(reviews.body.count).toBe(1)

    const admin = await login('admin@test.local', 'AdminPass!2026')
    const ov = await admin.get('/api/admin/overview')
    expect(ov.body.counts.toVerify).toBe(2)
    expect(ov.body.counts.listingsPending).toBe(1)
    expect((await admin.get('/api/me/notifications')).body.items.length).toBeGreaterThanOrEqual(2)
  })
})
