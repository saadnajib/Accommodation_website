import { eq } from 'drizzle-orm'
import { db, schema } from './db/index.js'
import { env } from './lib/env.js'
import { hashPassword, newId, now } from './lib/crypto.js'
import { seedDemo } from './seed.js'

/** Creates the admin account from env on first start; optionally seeds demo data. */
export async function bootstrap() {
  const admin = db.select().from(schema.users).where(eq(schema.users.role, 'admin')).get()
  if (!admin) {
    db.insert(schema.users).values({
      id: newId('u'), name: 'StayBridge Admin', email: env.ADMIN_EMAIL, passwordHash: await hashPassword(env.ADMIN_PASSWORD),
      role: 'admin', verification: 'verified', hasTenantPass: false, failedLogins: 0, createdAt: now(),
    }).run()
    console.log(`Created admin account ${env.ADMIN_EMAIL}`)
  }
  if (env.SEED_DEMO === 'true') {
    const anyListing = db.select({ id: schema.listings.id }).from(schema.listings).limit(1).get()
    if (!anyListing) { await seedDemo(); console.log('Seeded demo data') }
  }
}
