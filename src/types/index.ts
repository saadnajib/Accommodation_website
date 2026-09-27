export type Role = 'renter' | 'owner' | 'admin'

export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected'

/**
 * A user as serialized by the API for the current viewer. `email`/`phone` are only present for
 * the signed-in user themself, admins, or once contact has been unlocked.
 */
export interface User {
  id: string
  name: string
  email?: string
  role: Role
  phone?: string
  avatarUrl?: string
  bio?: string
  verification: VerificationStatus
  /** Paid "Verified Tenant Pass": pre-verified once, reused on every application. */
  hasTenantPass: boolean
  createdAt: string
}

export type PropertyType = 'room' | 'studio' | 'apartment' | 'house' | 'shared'

export type ListingStatus = 'draft' | 'pending_review' | 'active' | 'paused' | 'rented' | 'rejected'

export interface Listing {
  id: string
  ownerId: string
  title: string
  description: string
  type: PropertyType
  city: string
  area: string
  /** Exact address is private; the API only sends it to the owner, admins, or after contact is unlocked. */
  address?: string
  price: number
  currency: string
  deposit: number
  billsIncluded: boolean
  availableFrom: string
  minStayMonths: number
  bedrooms: number
  bathrooms: number
  sizeSqm: number
  furnished: boolean
  amenities: string[]
  houseRules: string[]
  images: string[]
  status: ListingStatus
  /** Paid boost: appears first in search and on the home page. */
  featured: boolean
  featuredUntil?: string | null
  views: number
  createdAt: string
  updatedAt?: string
  rejectionReason?: string
  /** Only on the owner's own listings (GET /me/listings). */
  applicantsCount?: number
  /** Only on admin listing rows (GET /admin/listings). */
  ownerName?: string
}

/** Compact listing attached to application rows (GET /me/applications). */
export interface ListingSummary {
  id: string
  title: string
  city: string
  area: string
  price: number
  currency: string
  images?: string[]
  image?: string
  status?: ListingStatus
}

export type ApplicationStatus =
  | 'submitted'
  | 'under_review'
  | 'verified'
  | 'rejected'
  | 'sent_to_owner'
  | 'owner_accepted'
  | 'owner_declined'
  | 'awaiting_fees'
  | 'contact_unlocked'
  | 'completed'
  | 'cancelled'

export interface TimelineEvent {
  status: ApplicationStatus
  at: string
  note?: string | null
  by: Role | 'system'
}

export type IdType = 'passport' | 'national_id' | 'driving_licence'

/**
 * Verification summary as serialized per viewer: owners get only idType/submittedAt/hasProofOfIncome,
 * renters additionally the masked ID number, admins also the private file ids.
 */
export interface RenterVerification {
  idType: IdType
  submittedAt: string
  hasProofOfIncome: boolean
  idNumberMasked?: string | null
  idDocumentFileId?: string | null
  selfieFileId?: string | null
  proofOfIncomeFileId?: string | null
}

export interface RenterProfile {
  occupation: string
  employer?: string
  monthlyIncome: number
  occupants: number
  hasPets: boolean
  smoker: boolean
  aboutMe: string
  references?: string
}

export interface Application {
  id: string
  listingId: string
  renterId: string
  ownerId: string
  /** Price the renter proposes (may be lower than list price). */
  proposedPrice: number
  /** Price the admin/owner agreed on; defaults to proposed. */
  agreedPrice: number
  moveInDate: string
  stayMonths: number
  message: string
  agreementAccepted: boolean
  agreementAcceptedAt?: string
  verification?: RenterVerification
  profile?: RenterProfile
  status: ApplicationStatus
  /** Renter and admin only. */
  renterFee?: number
  /** Owner and admin only. */
  ownerFee?: number
  renterFeePaid: boolean
  ownerFeePaid: boolean
  contactUnlocked: boolean
  /** Admin only. */
  adminNotes?: string
  createdAt: string
  updatedAt?: string
}

export interface Message {
  id: string
  applicationId: string
  fromId: string
  text: string
  at: string
}

export interface Review {
  id: string
  applicationId: string
  fromId: string
  toId: string
  rating: number
  text: string
  at: string
}

export interface Notification {
  id: string
  userId?: string
  title: string
  body: string
  link?: string
  read: boolean
  at: string
}

export interface FeeSettings {
  /** Renter service fee as a fraction of one month's agreed rent. */
  renterFeeRate: number
  /** Owner success fee as a fraction of one month's agreed rent. */
  ownerFeeRate: number
  /** Minimum fee charged to each side. */
  minFee: number
  /** One-off price for the Verified Tenant Pass. */
  tenantPassPrice: number
  /** Price to feature a listing for 30 days. */
  featuredListingPrice: number
  currency: string
}

export interface UploadedFile {
  id: string
  kind: 'listing_photo' | 'id_document' | 'selfie' | 'proof_of_income'
  mime: string
  size: number
  name: string
  url: string
  createdAt: string
}

export interface Rating { avg: number; count: number }

/* ---------- AI team (GET /admin/agents, /admin/proposals) ---------- */

/** How much an AI employee may do on its own for one action. */
export type Autonomy = 'auto' | 'approve' | 'never'

export type AgentRunStatus = 'running' | 'succeeded' | 'failed' | 'skipped'

export interface AgentRun {
  id: string
  /** Present on GET /admin/agents/runs rows. */
  agentKey?: string
  agentName?: string
  /** What started the run (e.g. 'schedule' | 'manual'); optional, not in the base contract. */
  trigger?: string | null
  status: AgentRunStatus
  summary: string | null
  startedAt: string
  finishedAt: string | null
  itemsReviewed: number
  proposalsCreated: number
  autoExecuted: number
  costCents: number
}

export interface Agent {
  key: string
  name: string
  title: string
  description: string
  schedule: 'cycle' | 'daily'
  enabled: boolean
  lastRun: AgentRun | null
  pendingProposals: number
}

export interface AgentsOverview {
  configured: boolean
  model: string
  intervalMinutes: number
  budgetCents: number
  spentThisMonthCents: number
  agents: Agent[]
}

export interface AgentPolicyAction {
  key: string
  label: string
  targetType: 'listing' | 'application' | 'user' | 'settings' | 'none' | string
  description: string
  defaultAutonomy: Autonomy
  autonomy: Autonomy
  autoMinConfidence: number
  /** Optional: the built-in threshold, used by "Reset to defaults" when present. */
  defaultAutoMinConfidence?: number
}

export type AgentPolicyPatch = Record<string, { autonomy?: Autonomy; autoMinConfidence?: number }>

export type ProposalStatus = 'pending' | 'approved' | 'rejected' | 'executed' | 'failed' | 'expired'
export type ProposalRisk = 'low' | 'medium' | 'high'

export interface ProposalPayload {
  message?: string
  suggestedPrice?: number
  currentPrice?: number
  rejectionReason?: string
  text?: string
  adviceOnly?: boolean
  [key: string]: unknown
}

export interface Proposal {
  id: string
  agentKey: string
  agentName: string
  action: string
  actionLabel: string
  targetType: string
  targetId: string | null
  target: { title: string; link: string | null } | null
  payload: ProposalPayload | null
  rationale: string
  confidence: number
  risk: ProposalRisk
  status: ProposalStatus
  decidedBy: string | { id?: string; name?: string } | null
  decidedAt: string | null
  decisionNote: string | null
  executedAt: string | null
  result: unknown
  createdAt: string
}
