/**
 * Demo data seed: the same story as the client's former in-browser seed (src/data/seed.ts), with the same ids.
 * Every demo user signs in with DEMO_PASSWORD. The admin account comes from bootstrap (env), not from here.
 */
import { eq } from 'drizzle-orm'
import { pathToFileURL } from 'node:url'
import { db, schema } from './db/index.js'
import { hashPassword } from './lib/crypto.js'

export const DEMO_PASSWORD = 'Demo!Pass2026'

const DAY = 86_400_000
const t = (days: number, base: number) => new Date(base + days * DAY).toISOString()
const img = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1200&q=70`

type User = typeof schema.users.$inferInsert
type Listing = typeof schema.listings.$inferInsert
type Application = typeof schema.applications.$inferInsert
type Actor = 'renter' | 'owner' | 'admin' | 'system'

export async function seedDemo() {
  const base = Date.now()
  const d = (days: number) => t(days, base)
  const adminIds = db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.role, 'admin')).all().map((a) => a.id)
  const adminId = adminIds[0] ?? null

  const people: Array<Omit<User, 'passwordHash'>> = [
    { id: 'u_owner1', name: 'Marco Benedetti', email: 'marco@staybridge.demo', role: 'owner', phone: '+39 333 010 2244', verification: 'verified', hasTenantPass: false, createdAt: d(-120), bio: 'I manage a few family apartments in Milan and Berlin. Long-term tenants preferred.' },
    { id: 'u_owner2', name: 'Aisha Rahman', email: 'aisha@staybridge.demo', role: 'owner', phone: '+44 7700 900123', verification: 'verified', hasTenantPass: false, createdAt: d(-90), bio: 'Renting out rooms in my London townhouse.' },
    { id: 'u_renter1', name: 'Jonas Weber', email: 'jonas@staybridge.demo', role: 'renter', phone: '+49 151 2233 4455', verification: 'verified', hasTenantPass: true, createdAt: d(-40), bio: 'Software engineer relocating for work. Tidy, quiet, non-smoker.' },
    { id: 'u_renter2', name: 'Priya Nair', email: 'priya@staybridge.demo', role: 'renter', verification: 'unverified', hasTenantPass: false, createdAt: d(-5), bio: 'Master student starting in September.' },
    { id: 'u_renter3', name: 'Tom Okafor', email: 'tom@staybridge.demo', role: 'renter', verification: 'pending', hasTenantPass: false, createdAt: d(-12) },
  ]
  // Hash before opening the (synchronous) transaction; each user gets their own salt.
  const users: User[] = []
  for (const p of people) users.push({ ...p, passwordHash: await hashPassword(DEMO_PASSWORD), failedLogins: 0 })

  const L = (x: Omit<Listing, 'currency' | 'updatedAt'>): Listing => ({ ...x, currency: 'USD', updatedAt: x.createdAt })
  const listings: Listing[] = [
    L({
      id: 'l_1', ownerId: 'u_owner1', title: 'Sunny 2-bed apartment near Navigli canals', type: 'apartment',
      description: 'Bright, recently renovated apartment on the third floor with a balcony overlooking a quiet courtyard. Ten minutes on foot to Porta Genova metro. Ideal for a couple or two professionals. Bills for water and building are included; electricity is metered separately.',
      city: 'Milan', area: 'Navigli', address: 'Via Vigevano 18, 20144 Milano', price: 1650, deposit: 3300, billsIncluded: true,
      availableFrom: d(14), minStayMonths: 12, bedrooms: 2, bathrooms: 1, sizeSqm: 78, furnished: true,
      amenities: ['Wi-Fi', 'Washing machine', 'Dishwasher', 'Balcony', 'Elevator', 'Heating', 'Desk / workspace'],
      houseRules: ['No smoking', 'No parties', 'Professionals only'],
      images: [img('photo-1502672260266-1c1ef2d93688'), img('photo-1522708323590-d24dbb6b0267'), img('photo-1484154218962-a197022b5858')],
      status: 'active', featured: true, views: 412, createdAt: d(-20),
    }),
    L({
      id: 'l_2', ownerId: 'u_owner2', title: 'Large double room in Victorian townhouse', type: 'room',
      description: 'A generous double room with bay window and original fireplace in a friendly professional houseshare of three. Shared kitchen and two bathrooms. Garden at the back. Five minutes to Clapham North tube.',
      city: 'London', area: 'Clapham', address: '42 Landor Road, SW9 9PJ', price: 1100, deposit: 1100, billsIncluded: true,
      availableFrom: d(7), minStayMonths: 6, bedrooms: 1, bathrooms: 2, sizeSqm: 18, furnished: true,
      amenities: ['Wi-Fi', 'Washing machine', 'Garden', 'Heating', 'Desk / workspace', 'Bike storage'],
      houseRules: ['No smoking', 'No pets', 'Quiet hours after 10pm', 'Professionals only'],
      images: [img('photo-1505693416388-ac5ce068fe85'), img('photo-1560448204-e02f11c3d0e2')],
      status: 'active', featured: true, views: 288, createdAt: d(-15),
    }),
    L({
      id: 'l_3', ownerId: 'u_owner1', title: 'Compact studio in Prenzlauer Berg', type: 'studio',
      description: 'Cosy studio with a separate kitchenette and a small courtyard-facing window. Perfect for a single person who wants to be in the heart of Berlin. Tram stop at the door.',
      city: 'Berlin', area: 'Prenzlauer Berg', address: 'Schönhauser Allee 120, 10437 Berlin', price: 890, deposit: 1780, billsIncluded: false,
      availableFrom: d(30), minStayMonths: 12, bedrooms: 0, bathrooms: 1, sizeSqm: 32, furnished: true,
      amenities: ['Wi-Fi', 'Heating', 'Elevator', 'Bike storage'],
      houseRules: ['No smoking', 'No parties'],
      images: [img('photo-1536376072261-38c75010e6c9'), img('photo-1493809842364-78817add7ffb')],
      status: 'rented', featured: false, views: 190, createdAt: d(-70),
    }),
    L({
      id: 'l_4', ownerId: 'u_owner2', title: 'Family house with garden in Richmond', type: 'house',
      description: 'Semi-detached three-bedroom house with a large south-facing garden and off-street parking. Close to good schools and Richmond Park. Unfurnished, long lets only.',
      city: 'London', area: 'Richmond', address: '7 Sheen Park, TW9 1UW', price: 3400, deposit: 5100, billsIncluded: false,
      availableFrom: d(45), minStayMonths: 24, bedrooms: 3, bathrooms: 2, sizeSqm: 130, furnished: false,
      amenities: ['Garden', 'Parking', 'Heating', 'Washing machine', 'Dishwasher', 'Pets allowed'],
      houseRules: ['No smoking'],
      images: [img('photo-1568605114967-8130f3a36994'), img('photo-1600596542815-ffad4c1539a9'), img('photo-1600585154340-be6161a56a0c')],
      status: 'active', featured: false, views: 96, createdAt: d(-6),
    }),
    L({
      id: 'l_5', ownerId: 'u_owner1', title: 'Shared room for students near Politecnico', type: 'shared',
      description: 'One bed in a twin room in a lively student flat. Kitchen, living room, and fast fibre internet shared with four other students. Bills included, flexible contracts by semester.',
      city: 'Milan', area: 'Città Studi', address: 'Via Pascoli 40, 20133 Milano', price: 420, deposit: 420, billsIncluded: true,
      availableFrom: d(3), minStayMonths: 4, bedrooms: 1, bathrooms: 1, sizeSqm: 20, furnished: true,
      amenities: ['Wi-Fi', 'Washing machine', 'Heating', 'Desk / workspace'],
      houseRules: ['No smoking', 'Students welcome', 'Quiet hours after 10pm'],
      images: [img('photo-1555854877-bab0e564b8d5'), img('photo-1502005229762-cf1b2da7c5d6')],
      status: 'active', featured: false, views: 341, createdAt: d(-4),
    }),
    L({
      id: 'l_6', ownerId: 'u_owner2', title: 'Modern 1-bed with river view in Canary Wharf', type: 'apartment',
      description: 'Twelfth-floor apartment with floor-to-ceiling windows, concierge, and residents gym. Ideal for finance professionals. Furnished to a high standard.',
      city: 'London', area: 'Canary Wharf', address: '1 Pan Peninsula Square, E14 9HN', price: 2600, deposit: 3900, billsIncluded: false,
      availableFrom: d(21), minStayMonths: 12, bedrooms: 1, bathrooms: 1, sizeSqm: 55, furnished: true,
      amenities: ['Wi-Fi', 'Gym', 'Elevator', 'Security', 'Air conditioning', 'Dishwasher', 'Washing machine'],
      houseRules: ['No smoking', 'No pets', 'Professionals only'],
      images: [img('photo-1512917774080-9991f1c4c750'), img('photo-1567767292278-a4f21aa2d36e')],
      status: 'active', featured: true, views: 523, createdAt: d(-11),
    }),
    L({
      id: 'l_7', ownerId: 'u_owner1', title: 'Attic loft with terrace in Kreuzberg', type: 'apartment',
      description: 'Characterful top-floor loft with exposed beams and a private roof terrace. Open-plan living, one bedroom, and a home office nook. No lift.',
      city: 'Berlin', area: 'Kreuzberg', address: 'Oranienstraße 45, 10969 Berlin', price: 1450, deposit: 2900, billsIncluded: false,
      availableFrom: d(10), minStayMonths: 12, bedrooms: 1, bathrooms: 1, sizeSqm: 64, furnished: false,
      amenities: ['Wi-Fi', 'Balcony', 'Heating', 'Desk / workspace', 'Pets allowed'],
      houseRules: ['No smoking', 'Couples welcome'],
      images: [img('photo-1493663284031-b7e3aefcae8e'), img('photo-1513694203232-719a280e022f')],
      status: 'active', featured: false, views: 150, createdAt: d(-3),
    }),
    L({
      id: 'l_8', ownerId: 'u_owner2', title: 'Ensuite room in quiet Islington flatshare', type: 'room',
      description: 'Private ensuite room in a two-person flat share with a working professional. Newly fitted kitchen. Excellent transport links from Highbury & Islington.',
      city: 'London', area: 'Islington', address: '15 Highbury Grove, N5 2EA', price: 1250, deposit: 1250, billsIncluded: true,
      availableFrom: d(18), minStayMonths: 6, bedrooms: 1, bathrooms: 1, sizeSqm: 16, furnished: true,
      amenities: ['Wi-Fi', 'Washing machine', 'Heating', 'Dishwasher'],
      houseRules: ['No smoking', 'No pets', 'Quiet hours after 10pm'],
      images: [img('photo-1616594039964-ae9021a400a0'), img('photo-1598928506311-c55ded91a20c')],
      status: 'pending_review', featured: false, views: 0, createdAt: d(-1),
    }),
    L({
      id: 'l_9', ownerId: 'u_owner1', title: 'Garden apartment in Lisbon Graça', type: 'apartment',
      description: 'Ground-floor two-bedroom with a private garden and lemon tree, five minutes from the Miradouro. Tiled floors, high ceilings, and lots of light.',
      city: 'Lisbon', area: 'Graça', address: 'Rua da Graça 88, 1170-165 Lisboa', price: 1300, deposit: 2600, billsIncluded: false,
      availableFrom: d(25), minStayMonths: 12, bedrooms: 2, bathrooms: 1, sizeSqm: 70, furnished: true,
      amenities: ['Wi-Fi', 'Garden', 'Washing machine', 'Air conditioning', 'Pets allowed'],
      houseRules: ['No smoking', 'Couples welcome'],
      images: [img('photo-1560185007-cde436f6a4d0'), img('photo-1560185127-6ed189bf02f4')],
      status: 'active', featured: false, views: 77, createdAt: d(-2),
    }),
    L({
      id: 'l_10', ownerId: 'u_owner2', title: 'Penthouse studio with skyline view', type: 'studio',
      description: 'Compact but luxurious studio on the top floor with a wraparound terrace. Concierge building with pool. Short walk to Barcelona beach.',
      city: 'Barcelona', area: 'Poblenou', address: 'Carrer de Pujades 200, 08005 Barcelona', price: 1500, deposit: 3000, billsIncluded: false,
      availableFrom: d(35), minStayMonths: 12, bedrooms: 0, bathrooms: 1, sizeSqm: 40, furnished: true,
      amenities: ['Wi-Fi', 'Air conditioning', 'Elevator', 'Gym', 'Security', 'Balcony'],
      houseRules: ['No smoking', 'No parties'],
      images: [img('photo-1545324418-cc1a3fa10c00'), img('photo-1502672023488-70e25813eb80')],
      status: 'paused', featured: false, views: 205, createdAt: d(-30),
    }),
  ]

  type Ev = { status: string; at: number; by: Actor; note?: string }
  type SeedApp = Omit<Application, 'updatedAt' | 'agreementVersion'> & { timeline: Ev[] }
  const actorFor = (a: SeedApp, by: Actor) => (by === 'renter' ? a.renterId : by === 'owner' ? a.ownerId : by === 'admin' ? adminId : null)
  // Documents in the old client seed were file names only; demo applications have no stored files (file ids null).
  const apps: SeedApp[] = [
    {
      id: 'a_1', listingId: 'l_1', renterId: 'u_renter1', ownerId: 'u_owner1',
      proposedPrice: 1600, agreedPrice: 1600, moveInDate: d(20), stayMonths: 12,
      message: 'Hi, I am relocating to Milan for a permanent engineering role and looking for a long-term home. Happy to sign for 12 months or longer.',
      agreementAccepted: true, agreementAcceptedAt: d(-8),
      idType: 'passport', idNumberMasked: '*****4821', verificationSubmittedAt: d(-8),
      profile: { occupation: 'Software engineer', employer: 'Nordic Cloud AB', monthlyIncome: 6200, occupants: 1, hasPets: false, smoker: false, aboutMe: 'Quiet, tidy, and mostly working from the office. I enjoy cooking and cycling at weekends.', references: 'Previous landlord in Stockholm, available on request.' },
      status: 'awaiting_fees',
      timeline: [
        { status: 'submitted', at: -8, by: 'renter' },
        { status: 'under_review', at: -7, by: 'admin' },
        { status: 'verified', at: -6, by: 'admin', note: 'ID and income verified. Strong candidate.' },
        { status: 'sent_to_owner', at: -5, by: 'admin' },
        { status: 'owner_accepted', at: -2, by: 'owner', note: 'Happy to proceed at 1,600.' },
        { status: 'awaiting_fees', at: -2, by: 'system' },
      ],
      renterFee: 640, ownerFee: 560, renterFeePaid: false, ownerFeePaid: true, contactUnlocked: false, adminNotes: 'Owner already paid. Waiting on renter.', createdAt: d(-8),
    },
    {
      id: 'a_2', listingId: 'l_2', renterId: 'u_renter3', ownerId: 'u_owner2',
      proposedPrice: 1100, agreedPrice: 1100, moveInDate: d(10), stayMonths: 6,
      message: 'Starting a new job in the City in two weeks. Looking for a friendly houseshare.',
      agreementAccepted: true, agreementAcceptedAt: d(-3),
      idType: 'driving_licence', idNumberMasked: '******9931', verificationSubmittedAt: d(-3),
      profile: { occupation: 'Junior analyst', employer: 'Barrow & Co', monthlyIncome: 3100, occupants: 1, hasPets: false, smoker: false, aboutMe: 'Sociable but respectful of shared spaces. Gym in the mornings, home most evenings.' },
      status: 'under_review',
      timeline: [
        { status: 'submitted', at: -3, by: 'renter' },
        { status: 'under_review', at: -2, by: 'admin' },
      ],
      renterFee: 550, ownerFee: 385, renterFeePaid: false, ownerFeePaid: false, contactUnlocked: false, adminNotes: '', createdAt: d(-3),
    },
    {
      id: 'a_3', listingId: 'l_6', renterId: 'u_renter1', ownerId: 'u_owner2',
      proposedPrice: 2400, agreedPrice: 2400, moveInDate: d(25), stayMonths: 12,
      message: 'Interested in the river-view apartment as a backup option while I finalise my Milan move.',
      agreementAccepted: true, agreementAcceptedAt: d(-6),
      idType: 'passport', idNumberMasked: '*****4821', verificationSubmittedAt: d(-6),
      profile: { occupation: 'Software engineer', employer: 'Nordic Cloud AB', monthlyIncome: 6200, occupants: 1, hasPets: false, smoker: false, aboutMe: 'Quiet, tidy, and mostly working from the office.' },
      status: 'owner_declined',
      timeline: [
        { status: 'submitted', at: -6, by: 'renter' },
        { status: 'under_review', at: -6, by: 'admin' },
        { status: 'verified', at: -5, by: 'admin' },
        { status: 'sent_to_owner', at: -4, by: 'admin' },
        { status: 'owner_declined', at: -1, by: 'owner', note: 'Went with a tenant who could move in sooner.' },
      ],
      renterFee: 960, ownerFee: 840, renterFeePaid: false, ownerFeePaid: false, contactUnlocked: false, adminNotes: '', createdAt: d(-6),
    },
    {
      id: 'a_4', listingId: 'l_5', renterId: 'u_renter2', ownerId: 'u_owner1',
      proposedPrice: 400, agreedPrice: 400, moveInDate: d(5), stayMonths: 5,
      message: 'Master student at Politecnico from September. Looking for a semester contract.',
      agreementAccepted: true, agreementAcceptedAt: d(-1),
      idType: 'national_id', idNumberMasked: '****2210', verificationSubmittedAt: d(-1),
      profile: { occupation: 'Student', employer: 'Politecnico di Milano', monthlyIncome: 1200, occupants: 1, hasPets: false, smoker: false, aboutMe: 'Studying architecture. I keep regular hours and like a clean kitchen.', references: 'Parents act as guarantors.' },
      status: 'submitted',
      timeline: [{ status: 'submitted', at: -1, by: 'renter' }],
      renterFee: 200, ownerFee: 140, renterFeePaid: false, ownerFeePaid: false, contactUnlocked: false, adminNotes: '', createdAt: d(-1),
    },
    {
      id: 'a_5', listingId: 'l_3', renterId: 'u_renter3', ownerId: 'u_owner1',
      proposedPrice: 890, agreedPrice: 890, moveInDate: d(-40), stayMonths: 12,
      message: 'Looking for a base in Berlin for a year.',
      agreementAccepted: true, agreementAcceptedAt: d(-60),
      idType: 'driving_licence', idNumberMasked: '******9931', verificationSubmittedAt: d(-60),
      profile: { occupation: 'Junior analyst', monthlyIncome: 3100, occupants: 1, hasPets: false, smoker: false, aboutMe: 'Sociable but respectful.' },
      status: 'completed',
      timeline: [
        { status: 'submitted', at: -60, by: 'renter' },
        { status: 'under_review', at: -59, by: 'admin' },
        { status: 'verified', at: -58, by: 'admin' },
        { status: 'sent_to_owner', at: -57, by: 'admin' },
        { status: 'owner_accepted', at: -55, by: 'owner' },
        { status: 'awaiting_fees', at: -55, by: 'system' },
        { status: 'contact_unlocked', at: -53, by: 'system', note: 'Both service fees received.' },
        { status: 'completed', at: -45, by: 'admin', note: 'Contract signed, keys handed over.' },
      ],
      renterFee: 445, ownerFee: 312, renterFeePaid: true, ownerFeePaid: true, contactUnlocked: true, adminNotes: 'Smooth deal.', createdAt: d(-60),
    },
  ]

  const payments: Array<typeof schema.payments.$inferInsert> = [
    { id: 'pay_a1_owner', applicationId: 'a_1', payerId: 'u_owner1', side: 'owner', amount: 560, currency: 'USD', provider: 'mock', providerRef: 'mock_4242', status: 'succeeded', createdAt: d(-2) },
    { id: 'pay_a5_owner', applicationId: 'a_5', payerId: 'u_owner1', side: 'owner', amount: 312, currency: 'USD', provider: 'mock', providerRef: 'mock_4242', status: 'succeeded', createdAt: d(-54) },
    { id: 'pay_a5_renter', applicationId: 'a_5', payerId: 'u_renter3', side: 'renter', amount: 445, currency: 'USD', provider: 'mock', providerRef: 'mock_1881', status: 'succeeded', createdAt: d(-53) },
  ]

  const messages = [
    { id: 'm_1', applicationId: 'a_5', fromId: 'u_owner1', text: 'Hi Tom, great to be connected. When would you like to view the studio?', at: d(-53) },
    { id: 'm_2', applicationId: 'a_5', fromId: 'u_renter3', text: 'Hello Marco! Thursday afternoon works well for me.', at: t(-53, base + 60_000) },
    { id: 'm_3', applicationId: 'a_5', fromId: 'u_owner1', text: 'Perfect, see you at 3pm. I will bring the contract draft.', at: d(-52) },
  ]

  const reviews = [
    { id: 'r_1', applicationId: 'a_5', fromId: 'u_renter3', toId: 'u_owner1', rating: 5, text: 'Marco was responsive and the studio was exactly as described.', at: d(-30) },
    { id: 'r_2', applicationId: 'a_5', fromId: 'u_owner1', toId: 'u_renter3', rating: 5, text: 'Tom pays on time and keeps the place spotless. Would rent to again.', at: d(-28) },
  ]

  const notifications: Array<typeof schema.notifications.$inferInsert> = [
    { id: 'n_1', userId: 'u_renter1', title: 'Owner accepted your application', body: 'Marco accepted your offer for the Navigli apartment. Pay the service fee to unlock contact.', link: '/dashboard/applications/a_1', read: false, at: d(-2) },
    { id: 'n_2', userId: 'u_renter1', title: 'Owner declined', body: 'The Canary Wharf owner chose another tenant this time.', link: '/dashboard/applications/a_3', read: true, at: d(-1) },
    { id: 'n_3', userId: 'u_owner1', title: 'New verified applicant', body: 'A verified renter is waiting for your decision on the Navigli apartment.', link: '/owner/applications/a_1', read: false, at: d(-5) },
    // The client seed addressed these to "u_admin"; here they go to every bootstrap admin.
    ...adminIds.flatMap((id, i) => [
      { id: i ? `n_4_${i}` : 'n_4', userId: id, title: 'New application to verify', body: 'Priya Nair applied for the Città Studi shared room.', link: '/admin/verification', read: false, at: d(-1) },
      { id: i ? `n_5_${i}` : 'n_5', userId: id, title: 'Listing pending review', body: 'Aisha submitted "Ensuite room in quiet Islington flatshare".', link: '/admin/listings', read: false, at: d(-1) },
    ]),
  ]

  db.transaction(() => {
    db.insert(schema.users).values(users).run()
    db.insert(schema.listings).values(listings).run()
    for (const { timeline, ...a } of apps) {
      const last = timeline.at(-1)!
      db.insert(schema.applications).values({ ...a, agreementVersion: 'v1', updatedAt: d(last.at) }).run()
      timeline.forEach((e, i) => {
        db.insert(schema.applicationEvents).values({
          id: `ev_${a.id}_${i}`, applicationId: a.id!, status: e.status, by: e.by, actorId: actorFor({ ...a, timeline }, e.by), note: e.note ?? null,
          at: t(e.at, base + i), // +i ms keeps same-day events in order
        }).run()
      })
    }
    db.insert(schema.payments).values(payments).run()
    db.insert(schema.messages).values(messages).run()
    db.insert(schema.reviews).values(reviews).run()
    db.insert(schema.notifications).values(notifications).run()
    db.insert(schema.savedListings).values([
      { userId: 'u_renter1', listingId: 'l_2', at: d(-10) },
      { userId: 'u_renter1', listingId: 'l_9', at: d(-2) },
    ]).run()
    db.insert(schema.purchases).values({ id: 'pur_pass_renter1', userId: 'u_renter1', product: 'tenant_pass', listingId: null, amount: 29, currency: 'USD', provider: 'mock', createdAt: d(-39) }).run()
  })
}

/* `npm run db:seed`: create the admin (if needed) and seed an empty database. */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { openDatabase, setDb } = await import('./db/index.js')
  const { bootstrap } = await import('./bootstrap.js')
  setDb(openDatabase())
  await bootstrap()
  if (db.select({ id: schema.listings.id }).from(schema.listings).limit(1).get()) console.log('Database already has listings; nothing to seed.')
  else { await seedDemo(); console.log(`Seeded demo data. Demo users sign in with ${DEMO_PASSWORD}`) }
}
