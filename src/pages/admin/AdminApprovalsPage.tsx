import { useCallback, useMemo, useState, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Bot, Check, CheckCheck, ChevronDown, ChevronUp, Info, MessageSquareText, X } from 'lucide-react'
import { Badge, Button, Card, EmptyState, Modal, PageHeader, Select, Tabs, Textarea } from '@/components/ui'
import { AgentChip, ConfidenceBar, ProposalStatusBadge, RiskBadge, TargetLink } from '@/components/admin/agents'
import { useLoad, useStore } from '@/store/useStore'
import { cn, formatMoney, timeAgo } from '@/lib/utils'
import type { Proposal, ProposalStatus } from '@/types'

type Tab = 'pending' | 'executed' | 'rejected' | 'all'
type Decision = 'approve' | 'reject'

const TAB_STATUSES: Record<Tab, ProposalStatus[] | null> = {
  pending: ['pending'],
  // "Executed" = everything that went through: ran, failed while running, or acknowledged advice.
  executed: ['executed', 'failed', 'approved'],
  rejected: ['rejected', 'expired'],
  all: null,
}

const isAdviceOnly = (p: Proposal) => p.payload?.adviceOnly === true
const KNOWN_PAYLOAD_KEYS = new Set(['message', 'suggestedPrice', 'currentPrice', 'price', 'rejectionReason', 'text', 'adviceOnly', 'currency', 'title'])

export default function AdminApprovalsPage() {
  const [tab, setTab] = useState<Tab>('pending')
  const [agent, setAgent] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState<Decision | null>(null)
  const [bulkConfirm, setBulkConfirm] = useState<Decision | null>(null)

  const proposals = useStore((s) => s.proposals)
  const proposalsQuery = useStore((s) => s.proposalsQuery)
  const agents = useStore((s) => s.agentsOverview?.agents)
  const pendingCount = useStore((s) => s.adminOverview?.pendingApprovals)
  const fetchProposals = useStore((s) => s.fetchProposals)
  const fetchAgents = useStore((s) => s.fetchAgents)
  const approveProposal = useStore((s) => s.approveProposal)
  const rejectProposal = useStore((s) => s.rejectProposal)
  const bulkProposals = useStore((s) => s.bulkProposals)
  const toast = useStore((s) => s.toast)

  const query = useMemo(() => ({ status: tab === 'pending' ? 'pending' as const : 'all' as const, agent: agent || undefined, limit: tab === 'pending' ? 100 : 200 }), [tab, agent])
  const queryKey = JSON.stringify(query)
  const { loading, error, reload } = useLoad(
    () => Promise.all([fetchProposals(query), fetchAgents({ quiet: true })]),
    [queryKey, fetchProposals, fetchAgents],
  )

  const fresh = proposalsQuery === queryKey
  const visible = useMemo(() => {
    if (!fresh || !proposals) return []
    const statuses = TAB_STATUSES[tab]
    return proposals
      .filter((p) => !statuses || statuses.includes(p.status))
      .filter((p) => !agent || p.agentKey === agent)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [fresh, proposals, tab, agent])

  const pendingVisible = visible.filter((p) => p.status === 'pending')
  // Selection only counts cards that are still pending and on screen.
  const selectedIds = pendingVisible.filter((p) => selected.has(p.id)).map((p) => p.id)
  const selectedHighRisk = pendingVisible.filter((p) => selected.has(p.id) && p.risk === 'high').length
  const allSelected = pendingVisible.length > 0 && selectedIds.length === pendingVisible.length

  const employeeOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const a of agents ?? []) map.set(a.key, `${a.name} · ${a.title}`)
    for (const p of proposals ?? []) if (!map.has(p.agentKey)) map.set(p.agentKey, p.agentName)
    return [{ value: '', label: 'All employees' }, ...[...map].map(([value, label]) => ({ value, label }))]
  }, [agents, proposals])

  const toggle = useCallback((id: string) => setSelected((s) => {
    const next = new Set(s)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  }), [])

  const decide = useCallback(async (p: Proposal, decision: Decision, note?: string) => {
    const advice = isAdviceOnly(p)
    const updated = decision === 'approve' ? await approveProposal(p.id, note) : await rejectProposal(p.id, note)
    setSelected((s) => { if (!s.has(p.id)) return s; const n = new Set(s); n.delete(p.id); return n })
    const verb = decision === 'approve' ? (advice ? 'Acknowledged' : updated.status === 'executed' ? 'Approved and executed' : updated.status === 'failed' ? 'Approved, but it failed' : 'Approved') : (advice ? 'Dismissed' : 'Rejected')
    toast({
      title: verb,
      body: updated.status === 'failed' ? resultText(updated.result) ?? undefined : `${p.actionLabel}${p.target?.title ? ` · ${p.target.title}` : ''}`,
      tone: updated.status === 'failed' ? 'error' : 'success',
    })
  }, [approveProposal, rejectProposal, toast])

  const runBulk = async (decision: Decision) => {
    if (!selectedIds.length) return
    setBulkBusy(decision)
    setBulkConfirm(null)
    try {
      const results = await bulkProposals(selectedIds, decision)
      const ok = results.filter((r) => r.ok !== false).length
      const failed = results.length - ok
      setSelected(new Set())
      toast({
        title: `${decision === 'approve' ? 'Approved' : 'Rejected'} ${ok} proposal${ok === 1 ? '' : 's'}`,
        body: failed ? `${failed} could not be ${decision === 'approve' ? 'approved' : 'rejected'}: ${results.find((r) => r.ok === false)?.error ?? 'unknown error'}` : undefined,
        tone: failed ? 'error' : 'success',
      })
      // Bulk results may not include full proposals; refetch to be sure the list is accurate.
      reload()
    } catch { /* toasted by the store */ } finally { setBulkBusy(null) }
  }

  const onBulk = (decision: Decision) => {
    if (decision === 'approve' && selectedHighRisk > 0) setBulkConfirm('approve')
    else void runBulk(decision)
  }

  const tabs: Array<{ value: Tab; label: string; count?: number }> = [
    { value: 'pending', label: 'Pending', count: pendingCount ?? (tab === 'pending' && fresh ? visible.length : undefined) },
    { value: 'executed', label: 'Executed' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'all', label: 'All' },
  ]

  return (
    <div className="pb-4">
      <PageHeader title="Approvals" description="Decisions your AI team wants you to sign off. Nothing here happens until you approve it."
        action={<Link to="/admin/ai-team" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:text-brand-800"><Bot className="h-4 w-4" /> Manage AI team</Link>} />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs tabs={tabs} value={tab} onChange={(v) => { setTab(v); setSelected(new Set()) }} />
        <Select aria-label="Filter by employee" className="sm:w-64" value={agent} onChange={(e) => { setAgent(e.target.value); setSelected(new Set()) }} options={employeeOptions} />
      </div>

      {tab === 'pending' && pendingVisible.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1 text-sm text-ink-500">
          <label className="inline-flex cursor-pointer items-center gap-2">
            <input type="checkbox" className="h-4 w-4 rounded border-ink-300 accent-brand-700" checked={allSelected}
              onChange={() => setSelected(allSelected ? new Set() : new Set(pendingVisible.map((p) => p.id)))} />
            Select all ({pendingVisible.length})
          </label>
          <span className="hidden text-xs text-ink-400 md:inline">Tip: focus a card and press <kbd className="rounded border border-ink-200 bg-white px-1">A</kbd> to approve or <kbd className="rounded border border-ink-200 bg-white px-1">R</kbd> to reject.</span>
        </div>
      )}

      {!fresh && (loading || !error) ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-40 animate-pulse rounded-2xl bg-ink-100" />)}</div>
      ) : error && !fresh ? (
        <EmptyState icon={<AlertTriangle className="h-6 w-6" />} title="Could not load approvals" description={error}
          action={<Button variant="outline" onClick={reload}>Try again</Button>} />
      ) : visible.length === 0 ? (
        tab === 'pending'
          ? <EmptyState icon={<CheckCheck className="h-6 w-6" />} title="Inbox zero." description="The AI team has nothing waiting for you." />
          : <EmptyState icon={<Bot className="h-6 w-6" />} title="Nothing here yet" description={agent ? 'No proposals from this employee in this view.' : 'Decided proposals will show up here.'} />
      ) : (
        <ul className="space-y-3">
          {visible.map((p) => (
            <li key={p.id}>
              <ProposalCard p={p} selected={selected.has(p.id)} onToggle={toggle} onDecide={decide} />
            </li>
          ))}
        </ul>
      )}

      {selectedIds.length > 0 && (
        <div className="sticky bottom-3 z-30 mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-ink-200 bg-white/95 p-3 shadow-lift backdrop-blur" role="region" aria-label="Bulk actions">
          <span className="text-sm font-semibold text-ink-900">{selectedIds.length} selected
            {selectedHighRisk > 0 && <span className="ml-2 font-normal text-red-700">({selectedHighRisk} high risk)</span>}
          </span>
          <div className="flex flex-1 justify-end gap-2 sm:flex-none">
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
            <Button size="sm" variant="outline" loading={bulkBusy === 'reject'} disabled={!!bulkBusy} onClick={() => onBulk('reject')}><X className="h-4 w-4" /> Reject selected</Button>
            <Button size="sm" loading={bulkBusy === 'approve'} disabled={!!bulkBusy} onClick={() => onBulk('approve')}><Check className="h-4 w-4" /> Approve selected</Button>
          </div>
        </div>
      )}

      <Modal open={bulkConfirm !== null} onClose={() => setBulkConfirm(null)} title="Approve high-risk proposals?" size="sm"
        footer={<>
          <Button variant="ghost" onClick={() => setBulkConfirm(null)}>Cancel</Button>
          <Button variant="danger" onClick={() => void runBulk('approve')}>Approve {selectedIds.length}</Button>
        </>}>
        <p className="text-sm text-ink-600">
          Your selection includes <b>{selectedHighRisk}</b> high-risk proposal{selectedHighRisk === 1 ? '' : 's'}. Approving executes them immediately through the same rules as the admin screens.
        </p>
      </Modal>
    </div>
  )
}

function ProposalCard({ p, selected, onToggle, onDecide }: {
  p: Proposal
  selected: boolean
  onToggle: (id: string) => void
  onDecide: (p: Proposal, decision: Decision, note?: string) => Promise<void>
}) {
  const [noteOpen, setNoteOpen] = useState(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState<Decision | null>(null)
  const [confirm, setConfirm] = useState(false)
  const pending = p.status === 'pending'
  const advice = isAdviceOnly(p)
  const approveLabel = advice ? 'Acknowledge' : 'Approve'
  const rejectLabel = advice ? 'Dismiss' : 'Reject'

  const run = async (decision: Decision) => {
    if (busy) return
    setConfirm(false)
    setBusy(decision)
    try { await onDecide(p, decision, note.trim() || undefined) } catch { /* toasted by the store */ } finally { setBusy(null) }
  }
  const request = (decision: Decision) => {
    if (!pending || busy) return
    if (decision === 'approve' && p.risk === 'high' && !advice) setConfirm(true)
    else void run(decision)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (!pending || e.metaKey || e.ctrlKey || e.altKey) return
    const t = e.target as HTMLElement
    if (t.closest('textarea, input, select')) return
    const k = e.key.toLowerCase()
    if (k === 'a') { e.preventDefault(); request('approve') }
    else if (k === 'r') { e.preventDefault(); request('reject') }
  }

  const decider = typeof p.decidedBy === 'string' ? p.decidedBy : p.decidedBy?.name
  const result = resultText(p.result)

  return (
    <Card tabIndex={0} onKeyDown={onKeyDown} aria-label={`${p.actionLabel} proposed by ${p.agentName}`}
      className={cn('p-4 outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-brand-500 sm:p-5', selected && 'border-brand-400 ring-1 ring-brand-400')}>
      <div className="flex items-start gap-3">
        {pending && (
          <input type="checkbox" className="mt-1.5 h-4 w-4 shrink-0 rounded border-ink-300 accent-brand-700" checked={selected}
            onChange={() => onToggle(p.id)} aria-label={`Select ${p.actionLabel}`} />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <AgentChip agentKey={p.agentKey} name={p.agentName} />
            <span className="text-sm text-ink-400">proposes</span>
            <span className="text-sm font-semibold text-ink-900">{p.actionLabel}</span>
            <span className="ml-auto flex flex-wrap items-center gap-2">
              {!pending && <ProposalStatusBadge status={p.status} />}
              {advice && <Badge tone="info">Advice only</Badge>}
              <RiskBadge risk={p.risk} />
            </span>
          </div>

          {p.target?.title && (
            <p className="mt-2 break-words text-base font-semibold text-ink-900">
              <TargetLink link={p.target.link}>{p.target.title}</TargetLink>
            </p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-400">
            <ConfidenceBar value={p.confidence} />
            <span title={new Date(p.createdAt).toLocaleString()}>{timeAgo(p.createdAt)}</span>
          </div>

          {p.rationale && <p className="mt-3 whitespace-pre-line break-words text-sm text-ink-700">{p.rationale}</p>}

          <PayloadDetails p={p} />

          {advice && pending && (
            <p className="mt-3 flex items-start gap-2 rounded-xl bg-sky-50 px-3 py-2 text-xs text-sky-800">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Advice only — approving records your acknowledgement, nothing executes.
            </p>
          )}

          {!pending && (
            <div className="mt-3 space-y-2 text-xs text-ink-500">
              {(p.decidedAt || decider) && (
                <p>
                  {p.status === 'rejected' ? 'Rejected' : p.status === 'expired' ? 'Expired' : 'Decided'}
                  {decider ? ` by ${decider}` : ''}{p.decidedAt ? ` · ${timeAgo(p.decidedAt)}` : ''}
                  {p.executedAt && p.status === 'executed' ? ` · executed ${timeAgo(p.executedAt)}` : ''}
                </p>
              )}
              {p.decisionNote && <p className="rounded-lg bg-ink-50 px-3 py-2 text-ink-700">“{p.decisionNote}”</p>}
              {result && (p.status === 'executed' || p.status === 'failed' || p.status === 'approved') && (
                <p className={cn('rounded-lg px-3 py-2', p.status === 'failed' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-800')}>
                  <span className="font-semibold">{p.status === 'failed' ? 'Failed: ' : 'Result: '}</span>{result}
                </p>
              )}
            </div>
          )}

          {pending && (
            <>
              {noteOpen && (
                <Textarea className="mt-3" rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500}
                  placeholder="Optional note for the audit log (and the employee)" aria-label="Decision note" autoFocus />
              )}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button size="sm" loading={busy === 'approve'} disabled={!!busy} onClick={() => request('approve')}>
                  <Check className="h-4 w-4" /> {approveLabel}
                </Button>
                <Button size="sm" variant="outline" loading={busy === 'reject'} disabled={!!busy} onClick={() => request('reject')}>
                  <X className="h-4 w-4" /> {rejectLabel}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setNoteOpen((o) => !o)} aria-expanded={noteOpen}>
                  <MessageSquareText className="h-4 w-4" /> {noteOpen ? 'Hide note' : 'Add note'}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      <Modal open={confirm} onClose={() => setConfirm(false)} title="Approve a high-risk action?" size="sm"
        footer={<>
          <Button variant="ghost" onClick={() => setConfirm(false)}>Cancel</Button>
          <Button variant="danger" loading={busy === 'approve'} onClick={() => void run('approve')}>Yes, approve</Button>
        </>}>
        <div className="space-y-3 text-sm text-ink-600">
          <p><b className="text-ink-900">{p.agentName}</b> wants to <b className="text-ink-900">{p.actionLabel.toLowerCase()}</b>{p.target?.title ? <> on <b className="text-ink-900">{p.target.title}</b></> : null}. This executes immediately.</p>
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Optional note" aria-label="Decision note" />
        </div>
      </Modal>
    </Card>
  )
}

function PayloadDetails({ p }: { p: Proposal }) {
  const fees = useStore((s) => s.fees)
  const [expanded, setExpanded] = useState(false)
  const pl = p.payload ?? {}
  const currency = typeof pl.currency === 'string' ? pl.currency : fees.currency
  const current = typeof pl.currentPrice === 'number' ? pl.currentPrice : typeof pl.price === 'number' ? pl.price : undefined
  const extras = Object.entries(pl).filter(([k, v]) => !KNOWN_PAYLOAD_KEYS.has(k) && (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') && v !== '')
  const text = typeof pl.text === 'string' ? pl.text : ''
  const long = text.length > 280

  return (
    <div className="mt-3 space-y-2">
      {typeof pl.message === 'string' && pl.message && (
        <div className="rounded-xl border border-ink-100 bg-ink-50 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">Message preview</p>
          <p className="mt-1 whitespace-pre-line break-words text-sm text-ink-700">{pl.message}</p>
        </div>
      )}
      {typeof pl.suggestedPrice === 'number' && (
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-xl border border-ink-100 bg-ink-50 px-3 py-2 text-sm">
          <span className="text-ink-500">Suggested price</span>
          <span className="text-base font-bold tabular-nums text-ink-900">{formatMoney(pl.suggestedPrice, currency)}</span>
          {current !== undefined && (
            <span className="text-ink-500">currently <span className="tabular-nums line-through">{formatMoney(current, currency)}</span>
              {current > 0 && <span className={cn('ml-1.5 font-semibold', pl.suggestedPrice < current ? 'text-red-700' : 'text-emerald-700')}>
                {pl.suggestedPrice >= current ? '+' : ''}{Math.round(((pl.suggestedPrice - current) / current) * 100)}%
              </span>}
            </span>
          )}
        </div>
      )}
      {typeof pl.rejectionReason === 'string' && pl.rejectionReason && (
        <div className="rounded-xl border border-red-100 bg-red-50/60 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-red-700">Reason sent to the user</p>
          <p className="mt-1 break-words text-sm text-ink-700">{pl.rejectionReason}</p>
        </div>
      )}
      {text && (
        <div className="rounded-xl border border-ink-100 bg-ink-50 px-3 py-2">
          <p className={cn('whitespace-pre-line break-words text-sm text-ink-700', long && !expanded && 'line-clamp-4')}>{text}</p>
          {long && (
            <button type="button" onClick={() => setExpanded((x) => !x)} className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-800">
              {expanded ? <>Show less <ChevronUp className="h-3.5 w-3.5" /></> : <>Read more <ChevronDown className="h-3.5 w-3.5" /></>}
            </button>
          )}
        </div>
      )}
      {extras.length > 0 && (
        <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
          {extras.map(([k, v]) => (
            <div key={k} className="flex min-w-0 gap-1.5">
              <dt className="shrink-0 text-ink-400">{humanize(k)}:</dt>
              <dd className="min-w-0 break-words font-medium text-ink-700">{String(v)}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}

function humanize(key: string) {
  const s = key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_.]/g, ' ')
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

/** Human-readable execution result (string, or an object with message/summary/error). */
function resultText(result: unknown): string | null {
  if (result == null || result === '') return null
  if (typeof result === 'string') return result
  if (typeof result === 'number' || typeof result === 'boolean') return String(result)
  if (typeof result === 'object') {
    const r = result as Record<string, unknown>
    for (const k of ['message', 'summary', 'error', 'detail']) if (typeof r[k] === 'string' && r[k]) return r[k] as string
    try { const s = JSON.stringify(result); return s.length > 240 ? `${s.slice(0, 240)}…` : s } catch { return null }
  }
  return null
}
