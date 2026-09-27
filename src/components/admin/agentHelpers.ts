import type { Tone } from '@/lib/status'
import type { AgentRunStatus, Autonomy, ProposalRisk, ProposalStatus } from '@/types'

/** Stable colour per AI employee (known keys first, then a hash over a small palette). */
const AGENT_TONES: Record<string, string> = {
  moderator: 'bg-violet-100 text-violet-800 ring-violet-200',
  verifier: 'bg-sky-100 text-sky-800 ring-sky-200',
  deals: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  growth: 'bg-amber-100 text-amber-800 ring-amber-200',
}
const PALETTE = [
  'bg-rose-100 text-rose-800 ring-rose-200',
  'bg-indigo-100 text-indigo-800 ring-indigo-200',
  'bg-teal-100 text-teal-800 ring-teal-200',
  'bg-orange-100 text-orange-800 ring-orange-200',
  'bg-fuchsia-100 text-fuchsia-800 ring-fuchsia-200',
]
export function agentTone(key: string) {
  if (AGENT_TONES[key]) return AGENT_TONES[key]
  let h = 0
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) | 0
  return PALETTE[Math.abs(h) % PALETTE.length]
}

export const RUN_STATUS: Record<AgentRunStatus, { label: string; tone: Tone }> = {
  running: { label: 'Running', tone: 'info' },
  succeeded: { label: 'Succeeded', tone: 'success' },
  failed: { label: 'Failed', tone: 'danger' },
  skipped: { label: 'Skipped', tone: 'neutral' },
}
export const RISK: Record<ProposalRisk, { label: string; tone: Tone }> = {
  low: { label: 'Low risk', tone: 'success' },
  medium: { label: 'Medium risk', tone: 'warning' },
  high: { label: 'High risk', tone: 'danger' },
}
export const PROPOSAL_STATUS: Record<ProposalStatus, { label: string; tone: Tone }> = {
  pending: { label: 'Waiting for you', tone: 'warning' },
  approved: { label: 'Approved', tone: 'brand' },
  rejected: { label: 'Rejected', tone: 'neutral' },
  executed: { label: 'Executed', tone: 'success' },
  failed: { label: 'Failed', tone: 'danger' },
  expired: { label: 'Expired', tone: 'neutral' },
}
export const AUTONOMY: Record<Autonomy, { label: string; help: string }> = {
  auto: { label: 'Auto', help: 'Executes on its own when confidence is at or above the threshold; otherwise waits for you.' },
  approve: { label: 'Approve', help: 'Always waits in your Approvals inbox before anything happens.' },
  never: { label: 'Never', help: 'Advice only. The employee may recommend it, but nothing executes even if you approve.' },
}

/** Money from integer cents, e.g. 1234 → "$12.34". */
export function formatCents(cents: number | null | undefined) {
  const v = (cents ?? 0) / 100
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)
}

export const scheduleLabel = (schedule: 'cycle' | 'daily', intervalMinutes?: number) =>
  schedule === 'daily' ? 'Once a day' : intervalMinutes ? `Every ${intervalMinutes} min` : 'Every cycle'

