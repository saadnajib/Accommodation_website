import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core'

/* Users & auth */
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['renter', 'owner', 'admin'] }).notNull(),
  phone: text('phone'),
  bio: text('bio'),
  avatarUrl: text('avatar_url'),
  verification: text('verification', { enum: ['unverified', 'pending', 'verified', 'rejected'] }).notNull().default('unverified'),
  hasTenantPass: integer('has_tenant_pass', { mode: 'boolean' }).notNull().default(false),
  failedLogins: integer('failed_logins').notNull().default(0),
  lockedUntil: text('locked_until'),
  createdAt: text('created_at').notNull(),
})

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(), // sha256 of the cookie token; the raw token never touches the DB
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: text('created_at').notNull(),
  expiresAt: text('expires_at').notNull(),
  ip: text('ip'),
  userAgent: text('user_agent'),
}, (t) => [index('sessions_user_idx').on(t.userId)])

/* Listings */
export const listings = sqliteTable('listings', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull().references(() => users.id),
  title: text('title').notNull(),
  description: text('description').notNull(),
  type: text('type', { enum: ['room', 'studio', 'apartment', 'house', 'shared'] }).notNull(),
  city: text('city').notNull(),
  area: text('area').notNull(),
  address: text('address').notNull(), // private: only revealed after contact unlock
  price: integer('price').notNull(),
  currency: text('currency').notNull().default('USD'),
  deposit: integer('deposit').notNull(),
  billsIncluded: integer('bills_included', { mode: 'boolean' }).notNull().default(false),
  availableFrom: text('available_from').notNull(),
  minStayMonths: integer('min_stay_months').notNull(),
  bedrooms: integer('bedrooms').notNull(),
  bathrooms: integer('bathrooms').notNull(),
  sizeSqm: integer('size_sqm').notNull(),
  furnished: integer('furnished', { mode: 'boolean' }).notNull().default(false),
  amenities: text('amenities', { mode: 'json' }).$type<string[]>().notNull().default([]),
  houseRules: text('house_rules', { mode: 'json' }).$type<string[]>().notNull().default([]),
  images: text('images', { mode: 'json' }).$type<string[]>().notNull().default([]), // public URLs: /api/files/<id> or https://
  status: text('status', { enum: ['draft', 'pending_review', 'active', 'paused', 'rented', 'rejected'] }).notNull().default('draft'),
  featured: integer('featured', { mode: 'boolean' }).notNull().default(false),
  featuredUntil: text('featured_until'),
  views: integer('views').notNull().default(0),
  rejectionReason: text('rejection_reason'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (t) => [index('listings_owner_idx').on(t.ownerId), index('listings_status_city_idx').on(t.status, t.city)])

/* Applications (the deal record) */
export const applications = sqliteTable('applications', {
  id: text('id').primaryKey(),
  listingId: text('listing_id').notNull().references(() => listings.id),
  renterId: text('renter_id').notNull().references(() => users.id),
  ownerId: text('owner_id').notNull().references(() => users.id),
  proposedPrice: integer('proposed_price').notNull(),
  agreedPrice: integer('agreed_price').notNull(),
  moveInDate: text('move_in_date').notNull(),
  stayMonths: integer('stay_months').notNull(),
  message: text('message').notNull(),
  agreementAccepted: integer('agreement_accepted', { mode: 'boolean' }).notNull(),
  agreementAcceptedAt: text('agreement_accepted_at'),
  agreementVersion: text('agreement_version').notNull().default('v1'),
  // Verification: sensitive. ID number stored masked only; documents referenced by file id (admin-only access).
  idType: text('id_type', { enum: ['passport', 'national_id', 'driving_licence'] }),
  idNumberMasked: text('id_number_masked'),
  idDocumentFileId: text('id_document_file_id'),
  selfieFileId: text('selfie_file_id'),
  proofOfIncomeFileId: text('proof_of_income_file_id'),
  verificationSubmittedAt: text('verification_submitted_at'),
  profile: text('profile', { mode: 'json' }).$type<RenterProfileJson>(),
  status: text('status').notNull().default('submitted'),
  renterFee: integer('renter_fee').notNull(),
  ownerFee: integer('owner_fee').notNull(),
  renterFeePaid: integer('renter_fee_paid', { mode: 'boolean' }).notNull().default(false),
  ownerFeePaid: integer('owner_fee_paid', { mode: 'boolean' }).notNull().default(false),
  contactUnlocked: integer('contact_unlocked', { mode: 'boolean' }).notNull().default(false),
  adminNotes: text('admin_notes').notNull().default(''),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (t) => [index('apps_renter_idx').on(t.renterId), index('apps_owner_idx').on(t.ownerId), index('apps_listing_idx').on(t.listingId), index('apps_status_idx').on(t.status)])

export interface RenterProfileJson {
  occupation: string
  employer?: string
  monthlyIncome: number
  occupants: number
  hasPets: boolean
  smoker: boolean
  aboutMe: string
  references?: string
}

export const applicationEvents = sqliteTable('application_events', {
  id: text('id').primaryKey(),
  applicationId: text('application_id').notNull().references(() => applications.id, { onDelete: 'cascade' }),
  status: text('status').notNull(),
  by: text('by', { enum: ['renter', 'owner', 'admin', 'system'] }).notNull(),
  actorId: text('actor_id'),
  note: text('note'),
  at: text('at').notNull(),
}, (t) => [index('events_app_idx').on(t.applicationId)])

export const payments = sqliteTable('payments', {
  id: text('id').primaryKey(),
  applicationId: text('application_id').notNull().references(() => applications.id),
  payerId: text('payer_id').notNull().references(() => users.id),
  side: text('side', { enum: ['renter', 'owner'] }).notNull(),
  amount: integer('amount').notNull(),
  currency: text('currency').notNull(),
  provider: text('provider').notNull().default('mock'),
  providerRef: text('provider_ref'),
  status: text('status', { enum: ['succeeded', 'failed', 'refunded'] }).notNull(),
  recordedBy: text('recorded_by'), // admin id when marked offline
  createdAt: text('created_at').notNull(),
})

export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  applicationId: text('application_id').notNull().references(() => applications.id, { onDelete: 'cascade' }),
  fromId: text('from_id').notNull().references(() => users.id),
  text: text('text').notNull(),
  at: text('at').notNull(),
}, (t) => [index('messages_app_idx').on(t.applicationId)])

export const reviews = sqliteTable('reviews', {
  id: text('id').primaryKey(),
  applicationId: text('application_id').notNull().references(() => applications.id),
  fromId: text('from_id').notNull().references(() => users.id),
  toId: text('to_id').notNull().references(() => users.id),
  rating: integer('rating').notNull(),
  text: text('text').notNull(),
  at: text('at').notNull(),
}, (t) => [index('reviews_to_idx').on(t.toId)])

export const notifications = sqliteTable('notifications', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  body: text('body').notNull(),
  link: text('link'),
  read: integer('read', { mode: 'boolean' }).notNull().default(false),
  at: text('at').notNull(),
}, (t) => [index('notifications_user_idx').on(t.userId)])

export const savedListings = sqliteTable('saved_listings', {
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  listingId: text('listing_id').notNull().references(() => listings.id, { onDelete: 'cascade' }),
  at: text('at').notNull(),
}, (t) => [index('saved_user_idx').on(t.userId)])

/* Uploaded files. `visibility` controls who may fetch the bytes. */
export const files = sqliteTable('files', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull().references(() => users.id),
  kind: text('kind', { enum: ['listing_photo', 'id_document', 'selfie', 'proof_of_income'] }).notNull(),
  visibility: text('visibility', { enum: ['public', 'private'] }).notNull(),
  mime: text('mime').notNull(),
  size: integer('size').notNull(),
  storagePath: text('storage_path').notNull(), // relative to UPLOAD_DIR, random name, no user input
  originalName: text('original_name').notNull(),
  createdAt: text('created_at').notNull(),
})

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value', { mode: 'json' }).notNull(),
})

export const auditLog = sqliteTable('audit_log', {
  id: text('id').primaryKey(),
  actorId: text('actor_id'),
  action: text('action').notNull(),
  target: text('target'),
  meta: text('meta', { mode: 'json' }),
  ip: text('ip'),
  at: text('at').notNull(),
}, (t) => [index('audit_actor_idx').on(t.actorId)])

export const purchases = sqliteTable('purchases', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  product: text('product', { enum: ['tenant_pass', 'featured_listing'] }).notNull(),
  listingId: text('listing_id'),
  amount: integer('amount').notNull(),
  currency: text('currency').notNull(),
  provider: text('provider').notNull().default('mock'),
  createdAt: text('created_at').notNull(),
})

