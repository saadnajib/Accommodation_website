import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui'
import { cn } from '@/lib/utils'
import type { Tone } from '@/lib/status'
import type { AgentRunStatus, ProposalRisk, ProposalStatus } from '@/types'
import { agentTone, PROPOSAL_STATUS, RISK, RUN_STATUS } from './agentHelpers'

export function AgentAvatar({ agentKey, name, size = 'md', className }: { agentKey: string; name: string; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const sizes = { sm: 'h-7 w-7 text-xs', md: 'h-9 w-9 text-sm', lg: 'h-12 w-12 text-lg' }
  return (
    <span aria-hidden className={cn('inline-flex shrink-0 items-center justify-center rounded-full font-bold ring-1 ring-inset', sizes[size], agentTone(agentKey), className)}>
      {(name || agentKey || '?').charAt(0).toUpperCase()}
    </span>
  )
}

/** Avatar + name chip used on proposal cards. */
export function AgentChip({ agentKey, name }: { agentKey: string; name: string }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <AgentAvatar agentKey={agentKey} name={name} size="sm" />
      <span className="truncate text-sm font-semibold text-ink-900">{name}</span>
    </span>
  )
}

export function RunStatusBadge({ status }: { status: AgentRunStatus }) {
  const s = RUN_STATUS[status] ?? { label: status, tone: 'neutral' as Tone }
  return <Badge tone={s.tone} dot>{s.label}</Badge>
}

export function RiskBadge({ risk }: { risk: ProposalRisk }) {
  const r = RISK[risk] ?? { label: risk, tone: 'neutral' as Tone }
  return <Badge tone={r.tone}>{r.label}</Badge>
}

export function ProposalStatusBadge({ status }: { status: ProposalStatus }) {
  const s = PROPOSAL_STATUS[status] ?? { label: status, tone: 'neutral' as Tone }
  return <Badge tone={s.tone} dot>{s.label}</Badge>
}

/** Link to a record: in-app paths use the router, anything else opens normally. */
export function TargetLink({ link, children, className }: { link: string | null | undefined; children: ReactNode; className?: string }) {
  if (!link) return <span className={className}>{children}</span>
  if (link.startsWith('/')) return <Link to={link} className={cn('hover:text-brand-700 hover:underline', className)}>{children}</Link>
  return <a href={link} target="_blank" rel="noopener noreferrer" className={cn('hover:text-brand-700 hover:underline', className)}>{children}</a>
}

/** Confidence 0–100 as a small bar with the number. */
export function ConfidenceBar({ value, className }: { value: number; className?: string }) {
  const v = Math.max(0, Math.min(100, Math.round(value ?? 0)))
  const tone = v >= 80 ? 'bg-emerald-500' : v >= 60 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <span className={cn('inline-flex items-center gap-2', className)} title={`${v}% confident`}>
      <span className="relative block h-1.5 w-20 overflow-hidden rounded-full bg-ink-100" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={v} aria-label="Confidence">
        <span className={cn('absolute inset-y-0 left-0 rounded-full', tone)} style={{ width: `${v}%` }} />
      </span>
      <span className="text-xs tabular-nums text-ink-500">{v}%</span>
    </span>
  )
}
