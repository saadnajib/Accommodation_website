export type Role = 'renter' | 'owner' | 'admin'

export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected'

export interface User {
  id: string
  name: string
  email: string
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
  /** Exact address is private; only revealed after contact is unlocked. */
  address: string
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
  views: number
  createdAt: string
  rejectionReason?: string
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
  note?: string
  by: Role | 'system'
}

export interface RenterVerification {
  idType: 'passport' | 'national_id' | 'driving_licence'
  idNumberMasked: string
  idDocumentName: string
  selfieName: string
  proofOfIncomeName?: string
  submittedAt: string
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
  timeline: TimelineEvent[]
  renterFee: number
  ownerFee: number
  renterFeePaid: boolean
  ownerFeePaid: boolean
  contactUnlocked: boolean
  adminNotes: string
  createdAt: string
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
  userId: string
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
