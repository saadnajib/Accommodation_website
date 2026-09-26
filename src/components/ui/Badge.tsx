import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import type { Tone } from '@/lib/status'
import { APPLICATION_STATUS, LISTING_STATUS, VERIFICATION_STATUS } from '@/lib/status'
import type { ApplicationStatus, ListingStatus, VerificationStatus } from '@/types'

const tones: Record<Tone, string> = {
  neutral: 'bg-ink-100 text-ink-700 ring-ink-200',
  info: 'bg-sky-50 text-sky-700 ring-sky-200',
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  warning: 'bg-amber-50 text-amber-800 ring-amber-200',
  danger: 'bg-red-50 text-red-700 ring-red-200',
  brand: 'bg-brand-50 text-brand-800 ring-brand-200',
}

export function Badge({ tone = 'neutral', children, className, dot }: { tone?: Tone; children: ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset whitespace-nowrap', tones[tone], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  )
}

export function ApplicationStatusBadge({ status }: { status: ApplicationStatus }) {
  const s = APPLICATION_STATUS[status]
  return <Badge tone={s.tone} dot>{s.label}</Badge>
}
export function ListingStatusBadge({ status }: { status: ListingStatus }) {
  const s = LISTING_STATUS[status]
  return <Badge tone={s.tone} dot>{s.label}</Badge>
}
export function VerificationBadge({ status }: { status: VerificationStatus }) {
  const s = VERIFICATION_STATUS[status]
  return <Badge tone={s.tone}>{s.label}</Badge>
}
