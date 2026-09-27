/**
 * Every object leaving the API goes through one of these so that privacy rules are enforced
 * server-side and never depend on the client hiding fields.
 */
import type { schema } from '../db/index.js'

type User = typeof schema.users.$inferSelect
type Listing = typeof schema.listings.$inferSelect
type Application = typeof schema.applications.$inferSelect
type Viewer = User | null

export const OWNER_VISIBLE_STATUSES = new Set(['sent_to_owner', 'owner_accepted', 'owner_declined', 'awaiting_fees', 'contact_unlocked', 'completed', 'cancelled'])

export function publicName(name: string) {
  const [first, ...rest] = name.trim().split(/\s+/)
  const last = rest.at(-1)
  return last ? `${first} ${last[0]}.` : first
}

/** The signed-in user's own record. */
export function serializeMe(u: User) {
  return {
    id: u.id, name: u.name, email: u.email, role: u.role, phone: u.phone ?? undefined, bio: u.bio ?? undefined,
    avatarUrl: u.avatarUrl ?? undefined, verification: u.verification, hasTenantPass: u.hasTenantPass, createdAt: u.createdAt,
  }
}

/** Another user as seen by `viewer`. Contact details only for admins or when `unlocked`. */
export function serializeUser(u: User, viewer: Viewer, unlocked = false) {
  const full = viewer?.role === 'admin' || viewer?.id === u.id || unlocked
  return {
    id: u.id,
    name: full ? u.name : publicName(u.name),
    role: u.role,
    verification: u.verification,
    hasTenantPass: u.hasTenantPass,
    bio: u.bio ?? undefined,
    avatarUrl: u.avatarUrl ?? undefined,
    createdAt: u.createdAt,
    ...(full ? { email: u.email, phone: u.phone ?? undefined } : {}),
  }
}

/** Listing: exact address only for the owner, admins, or a viewer with an unlocked application on it. */
export function serializeListing(l: Listing, viewer: Viewer, unlocked = false) {
  const full = viewer?.role === 'admin' || viewer?.id === l.ownerId || unlocked
  const { address, ...rest } = l
  return { ...rest, address: full ? address : undefined, rejectionReason: full ? l.rejectionReason ?? undefined : undefined }
}

/**
 * Application as seen by `viewer`.
 * - renter: everything about themselves; owner contact hidden until unlocked; adminNotes never.
 * - owner: nothing before sent_to_owner (caller must 404); renter identity anonymised until unlocked; masked ID number and
 *          document ids never; renter fee amount never; adminNotes never.
 * - admin: everything.
 */
export function serializeApplication(a: Application, viewer: Viewer) {
  const isAdmin = viewer?.role === 'admin'
  const isRenter = viewer?.id === a.renterId
  const isOwner = viewer?.id === a.ownerId
  const base = {
    id: a.id, listingId: a.listingId, renterId: a.renterId, ownerId: a.ownerId,
    proposedPrice: a.proposedPrice, agreedPrice: a.agreedPrice, moveInDate: a.moveInDate, stayMonths: a.stayMonths,
    message: a.message, agreementAccepted: a.agreementAccepted, agreementAcceptedAt: a.agreementAcceptedAt ?? undefined,
    status: a.status, contactUnlocked: a.contactUnlocked, createdAt: a.createdAt, updatedAt: a.updatedAt,
    renterFeePaid: a.renterFeePaid, ownerFeePaid: a.ownerFeePaid,
    profile: a.profile ?? undefined,
  }
  const verification = a.verificationSubmittedAt ? {
    idType: a.idType!, submittedAt: a.verificationSubmittedAt,
    hasProofOfIncome: !!a.proofOfIncomeFileId,
  } : undefined
  if (isAdmin) {
    return {
      ...base, renterFee: a.renterFee, ownerFee: a.ownerFee, adminNotes: a.adminNotes,
      verification: verification && { ...verification, idNumberMasked: a.idNumberMasked, idDocumentFileId: a.idDocumentFileId, selfieFileId: a.selfieFileId, proofOfIncomeFileId: a.proofOfIncomeFileId },
    }
  }
  if (isRenter) {
    return { ...base, renterFee: a.renterFee, verification: verification && { ...verification, idNumberMasked: a.idNumberMasked } }
  }
  if (isOwner) {
    return { ...base, ownerFee: a.ownerFee, verification }
  }
  return null
}

export function serializeFile(f: typeof schema.files.$inferSelect) {
  return { id: f.id, kind: f.kind, mime: f.mime, size: f.size, name: f.originalName, url: `/api/files/${f.id}`, createdAt: f.createdAt }
}
