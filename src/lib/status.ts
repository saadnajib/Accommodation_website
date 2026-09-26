import type { ApplicationStatus, ListingStatus, VerificationStatus } from '@/types'

export const APPLICATION_STATUS: Record<ApplicationStatus, { label: string; tone: Tone; description: string }> = {
  submitted: { label: 'Submitted', tone: 'neutral', description: 'Your application is in the queue for review.' },
  under_review: { label: 'Under review', tone: 'info', description: 'Our team is checking your identity and profile.' },
  verified: { label: 'Verified', tone: 'success', description: 'You passed verification. We are preparing to present you to the owner.' },
  rejected: { label: 'Not approved', tone: 'danger', description: 'We could not approve this application.' },
  sent_to_owner: { label: 'Sent to owner', tone: 'info', description: 'We presented your profile to the owner and are waiting for their decision.' },
  owner_accepted: { label: 'Owner accepted', tone: 'success', description: 'The owner wants to proceed. Service fees are due next.' },
  owner_declined: { label: 'Owner declined', tone: 'danger', description: 'The owner chose another tenant this time.' },
  awaiting_fees: { label: 'Awaiting fees', tone: 'warning', description: 'Both sides need to pay the service fee to unlock contact.' },
  contact_unlocked: { label: 'Contact unlocked', tone: 'success', description: 'You can now contact each other and finalise the agreement.' },
  completed: { label: 'Completed', tone: 'success', description: 'Deal closed. Enjoy your new home!' },
  cancelled: { label: 'Cancelled', tone: 'neutral', description: 'This application was withdrawn.' },
}

export const LISTING_STATUS: Record<ListingStatus, { label: string; tone: Tone }> = {
  draft: { label: 'Draft', tone: 'neutral' },
  pending_review: { label: 'Pending review', tone: 'warning' },
  active: { label: 'Live', tone: 'success' },
  paused: { label: 'Paused', tone: 'neutral' },
  rented: { label: 'Rented', tone: 'info' },
  rejected: { label: 'Rejected', tone: 'danger' },
}

export const VERIFICATION_STATUS: Record<VerificationStatus, { label: string; tone: Tone }> = {
  unverified: { label: 'Not verified', tone: 'neutral' },
  pending: { label: 'Pending', tone: 'warning' },
  verified: { label: 'Verified', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'danger' },
}

export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'brand'

/** Ordered pipeline used for progress indicators (happy path). */
export const PIPELINE: ApplicationStatus[] = [
  'submitted',
  'under_review',
  'verified',
  'sent_to_owner',
  'owner_accepted',
  'awaiting_fees',
  'contact_unlocked',
  'completed',
]

export function pipelineIndex(status: ApplicationStatus) {
  const i = PIPELINE.indexOf(status)
  return i === -1 ? -1 : i
}

export const PROPERTY_TYPES = [
  { value: 'room', label: 'Private room' },
  { value: 'shared', label: 'Shared room' },
  { value: 'studio', label: 'Studio' },
  { value: 'apartment', label: 'Apartment' },
  { value: 'house', label: 'House' },
] as const

export const AMENITIES = [
  'Wi-Fi', 'Washing machine', 'Dishwasher', 'Air conditioning', 'Heating', 'Balcony', 'Garden',
  'Parking', 'Elevator', 'Gym', 'Pets allowed', 'Desk / workspace', 'TV', 'Bike storage', 'Security',
]

export const HOUSE_RULES = ['No smoking', 'No pets', 'No parties', 'Quiet hours after 10pm', 'Couples welcome', 'Students welcome', 'Professionals only']
