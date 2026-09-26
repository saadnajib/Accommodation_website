import type { Application, ApplicationStatus, RenterVerification } from '@/types'
import type { Tone } from '@/lib/status'

/** Statuses that end a deal without success. */
export const CLOSED_STATUSES: ApplicationStatus[] = ['rejected', 'owner_declined', 'cancelled']
/** Statuses where no further admin action is possible. */
export const TERMINAL_STATUSES: ApplicationStatus[] = [...CLOSED_STATUSES, 'completed']

export const isTerminal = (s: ApplicationStatus) => TERMINAL_STATUSES.includes(s)
export const isClosed = (s: ApplicationStatus) => CLOSED_STATUSES.includes(s)

export const ID_TYPE_LABEL: Record<RenterVerification['idType'], string> = {
  passport: 'Passport',
  national_id: 'National ID card',
  driving_licence: 'Driving licence',
}

export const BY_LABEL: Record<string, string> = {
  renter: 'Renter',
  owner: 'Owner',
  admin: 'Admin',
  system: 'System',
}

export const DAY_MS = 86_400_000

/** When the application entered its current status. */
export function statusEnteredAt(app: Application) {
  for (let i = app.timeline.length - 1; i >= 0; i--) {
    if (app.timeline[i].status === app.status) return app.timeline[i].at
  }
  return app.createdAt
}

export function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / DAY_MS)
}

/** Income-to-rent ratio with a traffic-light tone. */
export function affordability(monthlyIncome: number | undefined, rent: number) {
  if (!monthlyIncome || rent <= 0) return { ratio: 0, label: 'No income data', tone: 'neutral' as Tone, verdict: 'Unknown' }
  const ratio = monthlyIncome / rent
  const tone: Tone = ratio >= 3 ? 'success' : ratio >= 2 ? 'warning' : 'danger'
  const verdict = ratio >= 3 ? 'Comfortable' : ratio >= 2 ? 'Stretch' : 'At risk'
  return { ratio, label: `${ratio.toFixed(1)}× rent`, tone, verdict }
}

export function collectedRevenue(apps: Application[]) {
  return apps.reduce((sum, a) => sum + (a.renterFeePaid ? a.renterFee : 0) + (a.ownerFeePaid ? a.ownerFee : 0), 0)
}

export function pendingRevenue(apps: Application[]) {
  return apps
    .filter((a) => a.status === 'awaiting_fees')
    .reduce((sum, a) => sum + (a.renterFeePaid ? 0 : a.renterFee) + (a.ownerFeePaid ? 0 : a.ownerFee), 0)
}

/** What the admin should do next, per status (admin-voiced, unlike APPLICATION_STATUS.description). */
export const ADMIN_NEXT_STEP: Record<ApplicationStatus, string> = {
  submitted: 'New in the queue. Start the review to let the renter know we are on it.',
  under_review: 'Check the ID, selfie, income proof and profile, then approve or reject.',
  verified: 'Renter is verified. Present them to the owner when you are ready.',
  rejected: 'Closed. The renter was told why.',
  sent_to_owner: 'Waiting for the owner. Record their decision if they told you by phone or email.',
  owner_accepted: 'Owner accepted. Fees are now due from both sides.',
  owner_declined: 'Closed. No fees are charged.',
  awaiting_fees: 'Collect both service fees. Contact unlocks automatically once both are paid.',
  contact_unlocked: 'Renter and owner can talk. Mark the deal completed once the contract is signed.',
  completed: 'Deal closed. Both sides can leave reviews.',
  cancelled: 'Closed without a deal.',
}
