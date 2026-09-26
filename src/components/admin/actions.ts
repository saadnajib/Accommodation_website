import { useCallback } from 'react'
import type { Application, ApplicationStatus } from '@/types'
import { useStore } from '@/store/useStore'
import { isTerminal } from './helpers'

export interface ActionSpec {
  key: string
  label: string
  to: ApplicationStatus
  variant: 'primary' | 'secondary' | 'outline' | 'danger' | 'accent' | 'ghost'
  /** Confirmation modal copy. */
  title: string
  body: string
  confirmLabel: string
  noteLabel: string
  noteRequired?: boolean
  /** Toast shown after the action. */
  toast: string
  toastTone?: 'success' | 'info'
  /** Append a suffix to the timeline note (e.g. recorded on owner's behalf). */
  noteSuffix?: string
}

export const CANCEL_ACTION: ActionSpec = {
  key: 'cancel', label: 'Cancel application', to: 'cancelled', variant: 'ghost',
  title: 'Cancel this application?', body: 'The deal is closed and removed from the active pipeline. Both sides keep their history. This cannot be undone.',
  confirmLabel: 'Cancel application', noteLabel: 'Reason for cancelling', noteRequired: true, toast: 'Application cancelled', toastTone: 'info',
}

export const START_REVIEW: ActionSpec = {
  key: 'start', label: 'Start review', to: 'under_review', variant: 'primary',
  title: 'Start review', body: 'Mark this application as under review so the renter knows we are on it.',
  confirmLabel: 'Start review', noteLabel: 'Note (optional)', toast: 'Review started',
}

export const APPROVE_VERIFICATION: ActionSpec = {
  key: 'verify', label: 'Approve verification', to: 'verified', variant: 'primary',
  title: 'Approve verification', body: 'Confirms the renter’s identity and profile check. The renter is marked as verified across StayBridge and notified.',
  confirmLabel: 'Approve', noteLabel: 'Verification note (optional)', toast: 'Renter verified',
}

export const REJECT_VERIFICATION: ActionSpec = {
  key: 'reject', label: 'Reject', to: 'rejected', variant: 'danger',
  title: 'Reject application', body: 'The renter is notified with your reason. Be specific and kind — they may re-apply.',
  confirmLabel: 'Reject application', noteLabel: 'Reason shown to the renter', noteRequired: true, toast: 'Application rejected', toastTone: 'info',
}

export const SEND_TO_OWNER: ActionSpec = {
  key: 'send', label: 'Send to owner', to: 'sent_to_owner', variant: 'primary',
  title: 'Present renter to owner', body: 'The owner receives the verified profile (first name + last initial only) and is asked to accept or decline.',
  confirmLabel: 'Send to owner', noteLabel: 'Note (optional)', toast: 'Sent to owner',
}

export const OWNER_ACCEPTED: ActionSpec = {
  key: 'accept', label: 'Record owner accepted', to: 'owner_accepted', variant: 'primary',
  title: 'Record owner acceptance', body: 'Use this when the owner confirmed by phone or email. Fees become due for both sides immediately.',
  confirmLabel: 'Record acceptance', noteLabel: 'Note (optional)', toast: 'Owner acceptance recorded', noteSuffix: '(recorded by admin on owner’s behalf)',
}

export const OWNER_DECLINED: ActionSpec = {
  key: 'decline', label: 'Record owner declined', to: 'owner_declined', variant: 'outline',
  title: 'Record owner decline', body: 'The renter is told the owner chose another tenant. No fees are charged.',
  confirmLabel: 'Record decline', noteLabel: 'Owner’s reason', noteRequired: true, toast: 'Owner decline recorded', toastTone: 'info', noteSuffix: '(recorded by admin on owner’s behalf)',
}

export const MARK_COMPLETED: ActionSpec = {
  key: 'complete', label: 'Mark deal completed', to: 'completed', variant: 'primary',
  title: 'Mark deal completed', body: 'Contract signed and keys handed over. The listing is marked as rented and both sides are invited to review.',
  confirmLabel: 'Complete deal', noteLabel: 'Note (optional)', toast: 'Deal completed',
}

/** Context-aware primary actions for the detail page (cancel is separate). */
export function actionsFor(status: ApplicationStatus): ActionSpec[] {
  switch (status) {
    case 'submitted': return [START_REVIEW]
    case 'under_review': return [APPROVE_VERIFICATION, REJECT_VERIFICATION]
    case 'verified': return [SEND_TO_OWNER]
    case 'sent_to_owner': return [OWNER_ACCEPTED, OWNER_DECLINED]
    case 'contact_unlocked': return [MARK_COMPLETED]
    default: return []
  }
}

export const canCancel = (status: ApplicationStatus) => !isTerminal(status)

/** Returns a function that applies an action to an application, with toast. */
export function useRunAction() {
  const advance = useStore((s) => s.advanceApplication)
  const toast = useStore((s) => s.toast)
  return useCallback((app: Application, spec: ActionSpec, note?: string) => {
    const trimmed = note?.trim() ?? ''
    const full = [trimmed, spec.noteSuffix].filter(Boolean).join(' ') || undefined
    advance(app.id, spec.to, 'admin', full)
    toast({ title: spec.toast, body: trimmed || undefined, tone: spec.toastTone ?? 'success' })
  }, [advance, toast])
}

/** Mark a fee as received (offline payment) and toast; contact unlocks automatically when both are paid. */
export function useMarkFee() {
  const payFee = useStore((s) => s.payFee)
  const toast = useStore((s) => s.toast)
  return useCallback((app: Application, side: 'renter' | 'owner') => {
    payFee(app.id, side)
    const other = side === 'renter' ? app.ownerFeePaid : app.renterFeePaid
    toast(other
      ? { title: 'Both fees received', body: 'Contact is now unlocked for renter and owner.', tone: 'success' }
      : { title: `${side === 'renter' ? 'Renter' : 'Owner'} fee marked as received`, body: `Waiting on the ${side === 'renter' ? 'owner' : 'renter'}.`, tone: 'success' })
  }, [payFee, toast])
}
