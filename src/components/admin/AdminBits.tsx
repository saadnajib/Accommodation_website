import type { ReactNode } from 'react'
import { BadgeCheck, ExternalLink, FileImage, FileText, Zap } from 'lucide-react'
import { ApplicationStatusBadge, Badge } from '@/components/ui'
import { APPLICATION_STATUS } from '@/lib/status'
import { cn, formatDate, timeAgo } from '@/lib/utils'
import { fileUrl } from '@/lib/api'
import type { TimelineEvent } from '@/types'
import { affordability, BY_LABEL } from './helpers'

export function TenantPassBadge({ className }: { className?: string }) {
  return (
    <Badge tone="brand" className={className}>
      <BadgeCheck className="h-3 w-3" /> Tenant Pass
    </Badge>
  )
}

export function PriorityBadge() {
  return (
    <Badge tone="warning">
      <Zap className="h-3 w-3" /> Priority
    </Badge>
  )
}

export function AffordabilityBadge({ income, rent, showVerdict }: { income?: number; rent: number; showVerdict?: boolean }) {
  const a = affordability(income, rent)
  return (
    <Badge tone={a.tone} className="tabular-nums">
      {a.label}{showVerdict && a.ratio > 0 ? ` · ${a.verdict}` : ''}
    </Badge>
  )
}

/**
 * Chip linking to a private uploaded document (GET /api/files/:id). Opens in a new tab; the admin's
 * session cookie authorises the request.
 */
export function FilePill({ fileId, label, image }: { fileId: string; label: string; image?: boolean }) {
  const Icon = image ? FileImage : FileText
  return (
    <a href={fileUrl(fileId)} target="_blank" rel="noopener noreferrer"
      className="flex min-w-0 items-center gap-3 rounded-xl border border-ink-200 bg-ink-50/60 p-3 transition-colors hover:border-brand-300 hover:bg-brand-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
      <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', image ? 'bg-sky-50 text-sky-600' : 'bg-red-50 text-red-600')}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink-900">{label}</p>
        <p className="flex items-center gap-1 text-xs text-brand-700">Open in new tab <ExternalLink className="h-3 w-3" /></p>
      </div>
    </a>
  )
}

/** Paid / unpaid dot with label. */
export function PaidDot({ paid, label }: { paid: boolean; label: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 text-[11px] font-semibold', paid ? 'text-emerald-700' : 'text-ink-400')} title={`${label} fee ${paid ? 'paid' : 'unpaid'}`}>
      <span className={cn('h-2 w-2 rounded-full', paid ? 'bg-emerald-500' : 'bg-ink-200 ring-1 ring-inset ring-ink-300')} />
      {label}
    </span>
  )
}

/** Definition-list row used across the detail page. */
export function InfoRow({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0', className)}>
      <dt className="text-xs font-medium uppercase tracking-wide text-ink-400">{label}</dt>
      <dd className="mt-0.5 break-words text-sm text-ink-900">{children}</dd>
    </div>
  )
}

const dotTone: Record<string, string> = {
  neutral: 'bg-ink-300', info: 'bg-sky-500', success: 'bg-emerald-500', warning: 'bg-amber-500', danger: 'bg-red-500', brand: 'bg-brand-600',
}

export function Timeline({ events }: { events: TimelineEvent[] }) {
  // Newest first; events sharing a timestamp keep their logical order (later index first).
  const ordered = events.map((e, i) => ({ e, i })).sort((a, b) => b.e.at.localeCompare(a.e.at) || b.i - a.i).map((x) => x.e)
  return (
    <ol className="relative space-y-5 before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-px before:bg-ink-200">
      {ordered.map((e, i) => (
        <li key={`${e.status}-${e.at}-${i}`} className="relative pl-7">
          <span className={cn('absolute left-0 top-1 h-[15px] w-[15px] rounded-full ring-4 ring-white', dotTone[APPLICATION_STATUS[e.status].tone])} />
          <div className="flex flex-wrap items-center gap-2">
            <ApplicationStatusBadge status={e.status} />
            <span className="text-xs text-ink-400">by {BY_LABEL[e.by] ?? e.by}</span>
          </div>
          <p className="mt-1 text-xs text-ink-400" title={new Date(e.at).toLocaleString()}>
            {formatDate(e.at, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} · {timeAgo(e.at)}
          </p>
          {e.note && <p className="mt-1.5 rounded-lg bg-ink-50 px-3 py-2 text-sm text-ink-700">{e.note}</p>}
        </li>
      ))}
    </ol>
  )
}
