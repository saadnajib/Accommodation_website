import type { Application, ApplicationStatus, Role } from '@/types'

/** Statuses after which an application can no longer move forward. */
export const TERMINAL_STATUSES: ApplicationStatus[] = ['rejected', 'owner_declined', 'cancelled', 'completed']
/** Terminal statuses that represent a negative outcome (rendered in red). */
export const FAILED_STATUSES: ApplicationStatus[] = ['rejected', 'owner_declined', 'cancelled']

export const isTerminal = (s: ApplicationStatus) => TERMINAL_STATUSES.includes(s)
export const isFailed = (s: ApplicationStatus) => FAILED_STATUSES.includes(s)

export function actorLabel(by: Role | 'system', viewer?: Role) {
  if (viewer && by === viewer) return 'You'
  switch (by) {
    case 'renter': return 'Renter'
    case 'owner': return 'Owner'
    case 'admin': return 'StayBridge team'
    default: return 'System'
  }
}

export type AttentionKind = 'pay' | 'message' | 'review'

/**
 * What (if anything) the renter needs to do next on an application. `reviewed` is true/false once the
 * application detail has been loaded (it carries `myReview`); unknown counts as "not yet reviewed".
 */
export function renterAttention(app: Application, reviewed?: boolean): AttentionKind | null {
  if (app.status === 'awaiting_fees' && !app.renterFeePaid) return 'pay'
  if (app.status === 'contact_unlocked') return 'message'
  if (app.status === 'completed' && !reviewed) return 'review'
  return null
}

export const ID_TYPE_LABELS: Record<'passport' | 'national_id' | 'driving_licence', string> = {
  passport: 'Passport',
  national_id: 'National ID card',
  driving_licence: 'Driving licence',
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}
