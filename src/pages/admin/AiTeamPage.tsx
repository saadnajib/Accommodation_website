import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Bot, Clock, Cpu, History, Inbox, Info, KeyRound, Play, RotateCcw, Save, Wallet, Zap } from 'lucide-react'
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, PageHeader, Select, Stat, Toggle } from '@/components/ui'
import { AgentAvatar, RunStatusBadge } from '@/components/admin/agents'
import { AUTONOMY, formatCents, scheduleLabel } from '@/components/admin/agentHelpers'
import { useLoad, useStore } from '@/store/useStore'
import { isApiError } from '@/lib/api'
import { cn, timeAgo } from '@/lib/utils'
import type { Agent, AgentPolicyAction, AgentPolicyPatch, AgentRun, AgentsOverview, Autonomy } from '@/types'

/** Built-in thresholds from server/src/agents/actions.ts, used by "Reset to defaults" when the API omits them. */
const DEFAULT_MIN_CONFIDENCE: Record<string, number> = {
  'listing.approve': 80, 'listing.reject': 95, 'listing.pause': 90, 'listing.feature': 100,
  'application.start_review': 0, 'application.verify': 85, 'application.reject': 100,
  'application.send_to_owner': 70, 'application.set_price': 100, 'application.record_owner_decision': 100,
  'application.mark_fee_paid': 100, 'application.complete': 100, 'application.cancel': 100, 'application.nudge': 60,
  'user.notify': 70, 'settings.fees': 100, 'ceo.brief': 0,
}

type Draft = Record<string, { autonomy: Autonomy; autoMinConfidence: string }>
const toDraft = (actions: AgentPolicyAction[] | null): Draft =>
  Object.fromEntries((actions ?? []).map((a) => [a.key, { autonomy: a.autonomy, autoMinConfidence: String(a.autoMinConfidence) }]))

const TARGET_LABEL: Record<string, string> = { listing: 'Listing', application: 'Application', user: 'User', settings: 'Settings', none: '—' }

export default function AiTeamPage() {
  const info = useStore((s) => s.agentsOverview)
  const runs = useStore((s) => s.agentRuns)
  const pendingApprovals = useStore((s) => s.adminOverview?.pendingApprovals)
  const fetchAgents = useStore((s) => s.fetchAgents)
  const fetchAgentPolicy = useStore((s) => s.fetchAgentPolicy)
  const fetchAgentRuns = useStore((s) => s.fetchAgentRuns)
  const runAllAgents = useStore((s) => s.runAllAgents)
  const toast = useStore((s) => s.toast)
  const [runsAgent, setRunsAgent] = useState('')
  const [runningAll, setRunningAll] = useState(false)
  const runsRef = useRef<HTMLDivElement>(null)

  const { loading, error, reload } = useLoad(() => Promise.all([fetchAgents(), fetchAgentPolicy()]), [fetchAgents, fetchAgentPolicy])
  const runsLoad = useLoad(() => fetchAgentRuns({ agent: runsAgent || undefined, limit: 30 }), [runsAgent, fetchAgentRuns])
  const reloadRuns = runsLoad.reload

  // While any employee is mid-run, refresh every 5s so status and counts settle on their own.
  const anyRunning = !!info?.agents.some((a) => a.lastRun?.status === 'running')
  useEffect(() => {
    if (!anyRunning) return
    const t = setInterval(() => {
      void fetchAgents({ quiet: true }).catch(() => {})
      reloadRuns()
    }, 5000)
    return () => clearInterval(t)
  }, [anyRunning, fetchAgents, reloadRuns])

  const runAll = async () => {
    setRunningAll(true)
    try {
      const runs = await runAllAgents()
      const done = runs.filter((r) => r.status !== 'running')
      toast({
        title: runs.length ? `Started ${runs.length} employee${runs.length === 1 ? '' : 's'}` : 'Nobody to run',
        body: done.length ? done.map((r) => `${r.agentName ?? r.agentKey ?? 'Employee'}: ${r.summary ?? RUN_WORD[r.status]}`).join(' · ') : runs.length ? 'Results will appear below as each run finishes.' : 'All employees are disabled or already running.',
        tone: 'success',
      })
      reloadRuns()
    } catch { /* toasted by the store */ } finally { setRunningAll(false) }
  }

  const showRuns = (key: string) => {
    setRunsAgent(key)
    runsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const pending = pendingApprovals ?? info?.agents.reduce((n, a) => n + (a.pendingProposals ?? 0), 0) ?? 0

  return (
    <div>
      <PageHeader title="AI team" description="Four AI employees run day-to-day operations. You approve the decisions that matter."
        action={
          <div className="flex flex-wrap gap-2">
            <Link to="/admin/approvals" className="inline-flex h-11 items-center gap-2 rounded-xl border border-ink-200 bg-white px-4 text-sm font-semibold text-ink-900 hover:bg-ink-50">
              <Inbox className="h-4 w-4" /> Approvals{pending ? <Badge tone="warning">{pending}</Badge> : null}
            </Link>
            <Button onClick={() => void runAll()} loading={runningAll} disabled={!info?.configured || runningAll}>
              <Play className="h-4 w-4" /> Run everyone now
            </Button>
          </div>
        } />

      {!info && loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-ink-100" />)}</div>
      ) : !info ? (
        <EmptyState icon={<AlertTriangle className="h-6 w-6" />} title="Could not load the AI team" description={error ?? undefined} action={<Button variant="outline" onClick={reload}>Try again</Button>} />
      ) : (
        <>
          {info.configured ? <TeamStats info={info} pending={pending} /> : <SetupCard info={info} />}

          <h2 className="mb-3 mt-8 text-lg font-semibold text-ink-900">Employees</h2>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {info.agents.map((a) => <EmployeeCard key={a.key} agent={a} configured={info.configured} intervalMinutes={info.intervalMinutes} onShowRuns={showRuns} onRan={reloadRuns} />)}
          </div>
        </>
      )}

      <PolicyCard />

      <div ref={runsRef} className="scroll-mt-24">
        <Card className="mt-8">
          <CardHeader title="Recent runs" description="Every run records what it reviewed, what it proposed and what it cost."
            action={<Select aria-label="Filter runs by employee" className="w-full sm:w-56" value={runsAgent} onChange={(e) => setRunsAgent(e.target.value)}
              options={[{ value: '', label: 'All employees' }, ...(info?.agents ?? []).map((a) => ({ value: a.key, label: a.name }))]} />} />
          <RunsTable runs={runs} loading={runsLoad.loading} agents={info?.agents ?? []} />
        </Card>
      </div>
    </div>
  )
}

const RUN_WORD: Record<AgentRun['status'], string> = { running: 'running', succeeded: 'done', failed: 'failed', skipped: 'skipped' }

function SetupCard({ info }: { info: AgentsOverview }) {
  return (
    <Card className="border-amber-300 bg-amber-50/60">
      <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <span className="w-fit rounded-xl bg-amber-100 p-2.5 text-amber-800"><KeyRound className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-ink-900">The AI team is not switched on yet</h3>
          <p className="mt-1 text-sm text-ink-600">
            Add <code className="rounded bg-white px-1.5 py-0.5 text-[13px] ring-1 ring-amber-200">ANTHROPIC_API_KEY</code> to <code className="rounded bg-white px-1.5 py-0.5 text-[13px] ring-1 ring-amber-200">server/.env</code> and restart the server.
            Until then nobody runs and nothing is proposed. You can still set the policy below.
          </p>
          <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
            <SetupValue label="Model" value={info.model || '—'} />
            <SetupValue label="Runs every" value={`${info.intervalMinutes} min`} />
            <SetupValue label="Monthly budget" value={formatCents(info.budgetCents)} />
          </dl>
        </div>
      </CardBody>
    </Card>
  )
}

function SetupValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-white/70 px-3 py-2 ring-1 ring-amber-200">
      <dt className="text-xs font-medium text-ink-500">{label}</dt>
      <dd className="truncate font-semibold text-ink-900" title={value}>{value}</dd>
    </div>
  )
}

function TeamStats({ info, pending }: { info: AgentsOverview; pending: number }) {
  const pct = info.budgetCents > 0 ? Math.min(100, (info.spentThisMonthCents / info.budgetCents) * 100) : 0
  const tone = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-brand-600'
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Card className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink-500">Spent this month</p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-ink-900">{formatCents(info.spentThisMonthCents)}</p>
            <p className="mt-1 text-xs text-ink-400">of {formatCents(info.budgetCents)} budget</p>
          </div>
          <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-700"><Wallet className="h-5 w-5" /></div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink-100" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label="Budget used">
          <div className={cn('h-full rounded-full transition-all', tone)} style={{ width: `${pct}%` }} />
        </div>
        {pct >= 100 && <p className="mt-2 text-xs font-medium text-red-700">Budget reached: runs are skipped until next month.</p>}
      </Card>
      <Stat label="Model" value={<span className="block truncate text-lg" title={info.model}>{info.model}</span>} icon={<Cpu className="h-5 w-5" />} tone="ink" />
      <Stat label="Cycle interval" value={`${info.intervalMinutes} min`} sub="Daily employees run once a day" icon={<Clock className="h-5 w-5" />} tone="brand" />
      <Link to="/admin/approvals" className="block rounded-2xl transition-transform hover:-translate-y-0.5 [&>div]:h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
        <Stat label="Pending approvals" value={pending} sub={pending ? 'Waiting for your decision' : 'Inbox zero'} icon={<Inbox className="h-5 w-5" />} tone={pending ? 'accent' : 'green'} />
      </Link>
    </div>
  )
}

function EmployeeCard({ agent: a, configured, intervalMinutes, onShowRuns, onRan }: {
  agent: Agent; configured: boolean; intervalMinutes: number; onShowRuns: (key: string) => void; onRan: () => void
}) {
  const runAgent = useStore((s) => s.runAgent)
  const setAgentEnabled = useStore((s) => s.setAgentEnabled)
  const toast = useStore((s) => s.toast)
  const [running, setRunning] = useState(false)
  const r = a.lastRun

  const runNow = async () => {
    setRunning(true)
    try {
      const run = await runAgent(a.key)
      if (run.status === 'running') toast({ title: `${a.name} is on it`, body: 'The run started. Results will appear here when it finishes.', tone: 'info' })
      else toast({ title: `${a.name}: ${RUN_WORD[run.status]}`, body: run.summary ?? undefined, tone: run.status === 'failed' ? 'error' : 'success' })
      onRan()
    } catch (e) {
      if (isApiError(e, 409)) toast({ title: 'Already running', body: `${a.name} is already working on a run.`, tone: 'info' })
    } finally { setRunning(false) }
  }

  const onToggle = (enabled: boolean) => {
    void setAgentEnabled(a.key, enabled).then(
      () => toast({ title: enabled ? `${a.name} is back on duty` : `${a.name} paused`, tone: 'success' }),
      () => {},
    )
  }

  return (
    <Card className={cn('flex flex-col', !a.enabled && 'opacity-80')}>
      <div className="flex items-start gap-3 border-b border-ink-100 px-5 py-4">
        <AgentAvatar agentKey={a.key} name={a.name} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-ink-900">{a.name}</h3>
            <span className="text-sm text-ink-500">{a.title}</span>
          </div>
          <p className="mt-0.5 text-xs text-ink-400">{scheduleLabel(a.schedule, intervalMinutes)}{a.pendingProposals ? ` · ${a.pendingProposals} waiting for you` : ''}</p>
        </div>
        <Toggle checked={a.enabled} onChange={onToggle} label={a.enabled ? 'On' : 'Off'} />
      </div>
      <CardBody className="flex flex-1 flex-col gap-3">
        <p className="text-sm text-ink-600">{a.description}</p>
        <div className="rounded-xl bg-ink-50 px-3 py-2.5">
          {r ? (
            <>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-500">
                <RunStatusBadge status={r.status} />
                <span title={new Date(r.startedAt).toLocaleString()}>{timeAgo(r.finishedAt ?? r.startedAt)}</span>
                <span>·</span>
                <span className="tabular-nums">{formatCents(r.costCents)}</span>
              </div>
              {r.summary && <p className="mt-1.5 line-clamp-2 break-words text-sm text-ink-700" title={r.summary}>{r.summary}</p>}
              <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                <Count label="Reviewed" value={r.itemsReviewed} />
                <Count label="Proposed" value={r.proposalsCreated} />
                <Count label="Auto" value={r.autoExecuted} />
              </div>
            </>
          ) : <p className="text-sm text-ink-400">No runs yet.</p>}
        </div>
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
          <Button size="sm" variant="outline" loading={running} disabled={running || !configured || r?.status === 'running'} onClick={() => void runNow()}
            title={!configured ? 'Add ANTHROPIC_API_KEY first' : undefined}>
            <Play className="h-4 w-4" /> {r?.status === 'running' ? 'Running…' : 'Run now'}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onShowRuns(a.key)}><History className="h-4 w-4" /> View runs</Button>
          {a.pendingProposals > 0 && (
            <Link to="/admin/approvals" className="ml-auto text-sm font-semibold text-brand-700 hover:text-brand-800">Review {a.pendingProposals} →</Link>
          )}
        </div>
      </CardBody>
    </Card>
  )
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-white px-2 py-1.5 ring-1 ring-ink-100">
      <p className="text-base font-bold tabular-nums text-ink-900">{value ?? 0}</p>
      <p className="text-[11px] text-ink-400">{label}</p>
    </div>
  )
}

function Hint({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex">
      <button type="button" className="rounded-full text-ink-300 hover:text-ink-500 focus-visible:text-ink-500 focus-visible:outline-none" aria-label={text}>
        <Info className="h-3.5 w-3.5" />
      </button>
      <span role="tooltip" className="pointer-events-none absolute bottom-full right-0 z-20 mb-1.5 hidden w-60 rounded-lg bg-ink-900 px-3 py-2 text-xs font-normal leading-snug text-white shadow-lift group-hover:block group-focus-within:block">
        {text}
      </span>
    </span>
  )
}

function PolicyCard() {
  const policy = useStore((s) => s.agentPolicy)
  const saveAgentPolicy = useStore((s) => s.saveAgentPolicy)
  const toast = useStore((s) => s.toast)
  const [draft, setDraft] = useState<Draft>(() => toDraft(policy))
  const [saving, setSaving] = useState(false)

  // Refresh the form when the server copy changes, unless the admin already edited it.
  const [seen, setSeen] = useState(policy)
  if (seen !== policy) {
    setSeen(policy)
    if (JSON.stringify(toDraft(seen)) === JSON.stringify(draft)) setDraft(toDraft(policy))
  }

  const errors = useMemo(() => {
    const e: Record<string, string> = {}
    for (const [k, d] of Object.entries(draft)) {
      const n = Number(d.autoMinConfidence)
      if (d.autoMinConfidence.trim() === '' || !Number.isFinite(n) || n < 0 || n > 100) e[k] = '0–100'
    }
    return e
  }, [draft])

  const changes = useMemo(() => {
    const out: AgentPolicyPatch = {}
    for (const a of policy ?? []) {
      const d = draft[a.key]
      if (!d) continue
      const patch: AgentPolicyPatch[string] = {}
      if (d.autonomy !== a.autonomy) patch.autonomy = d.autonomy
      const n = Math.round(Number(d.autoMinConfidence))
      if (!errors[a.key] && n !== a.autoMinConfidence) patch.autoMinConfidence = n
      if (Object.keys(patch).length) out[a.key] = patch
    }
    return out
  }, [policy, draft, errors])
  const dirty = Object.keys(changes).length > 0
  const valid = Object.keys(errors).length === 0

  const set = (key: string, patch: Partial<Draft[string]>) => setDraft((d) => ({ ...d, [key]: { ...d[key], ...patch } }))

  const resetDefaults = () => setDraft(Object.fromEntries((policy ?? []).map((a) => [a.key, {
    autonomy: a.defaultAutonomy,
    autoMinConfidence: String(a.defaultAutoMinConfidence ?? DEFAULT_MIN_CONFIDENCE[a.key] ?? a.autoMinConfidence),
  }])))

  const save = async () => {
    if (!dirty || !valid || saving) return
    setSaving(true)
    try {
      const next = await saveAgentPolicy(changes)
      setDraft(toDraft(next))
      toast({ title: 'Policy saved', body: `${Object.keys(changes).length} action${Object.keys(changes).length === 1 ? '' : 's'} updated.`, tone: 'success' })
    } catch { /* toasted by the store */ } finally { setSaving(false) }
  }

  const isDefault = (policy ?? []).every((a) => {
    const d = draft[a.key]
    return d && d.autonomy === a.defaultAutonomy && Number(d.autoMinConfidence) === (a.defaultAutoMinConfidence ?? DEFAULT_MIN_CONFIDENCE[a.key] ?? Number(d.autoMinConfidence))
  })

  return (
    <Card className="mt-8">
      <CardHeader title="Autonomy policy" description="What each employee may do on its own. “Auto” actions below the confidence threshold wait for you instead. * marks the built-in default."
        action={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="ghost" onClick={resetDefaults} disabled={!policy || isDefault}><RotateCcw className="h-4 w-4" /> Reset to defaults</Button>
            <Button size="sm" onClick={() => void save()} loading={saving} disabled={!dirty || !valid}><Save className="h-4 w-4" /> Save policy</Button>
          </div>
        } />
      {!policy ? (
        <CardBody><div className="space-y-2">{[0, 1, 2, 3].map((i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-ink-100" />)}</div></CardBody>
      ) : (
        <div>
          <div className="hidden grid-cols-[minmax(0,1fr)_6rem_12.5rem_7rem] gap-4 border-b border-ink-100 px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-400 md:grid">
            <span>Action</span><span>Target</span>
            <span className="inline-flex items-center gap-1">Autonomy <Hint text="Auto: runs by itself above the threshold. Approve: always waits for you. Never: advice only, nothing executes." /></span>
            <span className="inline-flex items-center gap-1">Min confidence <Hint text="Only used for Auto. Below this confidence (0–100) the action waits in Approvals." /></span>
          </div>
          <ul className="divide-y divide-ink-100">
            {policy.map((a) => {
              const d = draft[a.key] ?? { autonomy: a.autonomy, autoMinConfidence: String(a.autoMinConfidence) }
              const changed = !!changes[a.key]
              return (
                <li key={a.key} className={cn('grid grid-cols-2 gap-x-3 gap-y-2 px-5 py-3 md:grid-cols-[minmax(0,1fr)_6rem_12.5rem_7rem] md:items-center md:gap-4', changed && 'bg-amber-50/50')}>
                  <div className="col-span-2 min-w-0 md:col-span-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink-900">
                      {a.label}
                      {d.autonomy !== a.defaultAutonomy && <Badge tone="brand">Custom</Badge>}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-500">{a.description}</p>
                    <p className="mt-0.5 font-mono text-[11px] text-ink-300">{a.key}</p>
                  </div>
                  <div className="col-span-2 text-xs text-ink-500 md:col-span-1 md:text-sm">
                    <span className="md:hidden">Target: </span>{TARGET_LABEL[a.targetType] ?? a.targetType}
                  </div>
                  <div className="min-w-0">
                    <label className="mb-1 flex items-center gap-1 text-xs font-medium text-ink-500 md:hidden" htmlFor={`aut-${a.key}`}>Autonomy <Hint text={AUTONOMY[d.autonomy].help} /></label>
                    <div className="flex items-center gap-1.5">
                      <Select id={`aut-${a.key}`} className="min-w-0 flex-1" value={d.autonomy} aria-label={`Autonomy for ${a.label}`}
                        onChange={(e) => set(a.key, { autonomy: e.target.value as Autonomy })}
                        options={(['auto', 'approve', 'never'] as const).map((v) => ({ value: v, label: AUTONOMY[v].label + (v === a.defaultAutonomy ? ' *' : '') }))} />
                      <span className="hidden md:inline-flex"><Hint text={AUTONOMY[d.autonomy].help} /></span>
                    </div>
                  </div>
                  <div className="min-w-0">
                    <label className="mb-1 block text-xs font-medium text-ink-500 md:hidden" htmlFor={`conf-${a.key}`}>Min confidence</label>
                    <input id={`conf-${a.key}`} type="number" inputMode="numeric" min={0} max={100} step={1}
                      value={d.autoMinConfidence} disabled={d.autonomy !== 'auto'} aria-label={`Minimum confidence for ${a.label}`}
                      onChange={(e) => set(a.key, { autoMinConfidence: e.target.value })}
                      title={d.autonomy !== 'auto' ? 'Only used when autonomy is Auto' : undefined}
                      className={cn('h-11 w-full rounded-xl border border-ink-200 bg-white px-3.5 tabular-nums text-ink-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25 disabled:bg-ink-50 disabled:text-ink-300',
                        errors[a.key] && 'border-red-400')} />
                    {errors[a.key] && <p className="mt-1 text-xs text-red-600">Enter {errors[a.key]}</p>}
                  </div>
                </li>
              )
            })}
          </ul>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 px-5 py-3">
            <p className="flex items-center gap-1.5 text-xs text-ink-400"><Zap className="h-3.5 w-3.5" /> No employee ever moves money, reveals contact details or unlocks a deal, whatever the policy says.</p>
            <Button size="sm" onClick={() => void save()} loading={saving} disabled={!dirty || !valid}><Save className="h-4 w-4" /> Save policy{dirty ? ` (${Object.keys(changes).length})` : ''}</Button>
          </div>
        </div>
      )}
    </Card>
  )
}

function RunsTable({ runs, loading, agents }: { runs: AgentRun[] | null; loading: boolean; agents: Agent[] }) {
  const names = useMemo(() => Object.fromEntries(agents.map((a) => [a.key, a.name])), [agents])
  if (!runs && !loading) {
    return <CardBody><EmptyState className="border-0" icon={<History className="h-6 w-6" />} title="Runs are not available" description="The runs log could not be loaded." /></CardBody>
  }
  if (!runs) {
    return <CardBody><div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-10 animate-pulse rounded-xl bg-ink-100" />)}</div></CardBody>
  }
  if (runs.length === 0) {
    return <CardBody><EmptyState className="border-0" icon={<Bot className="h-6 w-6" />} title="No runs yet" description={loading ? 'Loading…' : 'Runs appear here once the AI team starts working.'} /></CardBody>
  }
  const nameOf = (r: AgentRun) => r.agentName ?? (r.agentKey ? names[r.agentKey] : undefined) ?? r.agentKey ?? 'Employee'
  return (
    <div className={cn(loading && 'opacity-60 transition-opacity')}>
      {/* Mobile: stacked rows */}
      <ul className="divide-y divide-ink-100 md:hidden">
        {runs.map((r) => (
          <li key={r.id} className="px-5 py-3">
            <div className="flex items-center gap-2">
              <AgentAvatar agentKey={r.agentKey ?? nameOf(r)} name={nameOf(r)} size="sm" />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink-900">{nameOf(r)}</span>
              <RunStatusBadge status={r.status} />
            </div>
            {r.summary && <p className="mt-1.5 break-words text-sm text-ink-600">{r.summary}</p>}
            <p className="mt-1 text-xs text-ink-400">
              {r.trigger ? `${r.trigger} · ` : ''}{r.itemsReviewed} reviewed · {r.proposalsCreated} proposed · {r.autoExecuted} auto · {formatCents(r.costCents)} · {timeAgo(r.startedAt)}
            </p>
          </li>
        ))}
      </ul>
      {/* Desktop: table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink-100 text-left text-xs font-semibold uppercase tracking-wide text-ink-400">
              <th className="px-5 py-2.5">Employee</th>
              <th className="px-3 py-2.5">Trigger</th>
              <th className="px-3 py-2.5">Status</th>
              <th className="px-3 py-2.5">Summary</th>
              <th className="px-3 py-2.5 text-right">Items</th>
              <th className="px-3 py-2.5 text-right">Proposals</th>
              <th className="px-3 py-2.5 text-right">Auto</th>
              <th className="px-3 py-2.5 text-right">Cost</th>
              <th className="px-5 py-2.5 text-right">When</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {runs.map((r) => (
              <tr key={r.id} className="align-top">
                <td className="px-5 py-3">
                  <span className="inline-flex items-center gap-2 whitespace-nowrap font-medium text-ink-900">
                    <AgentAvatar agentKey={r.agentKey ?? nameOf(r)} name={nameOf(r)} size="sm" /> {nameOf(r)}
                  </span>
                </td>
                <td className="px-3 py-3 capitalize text-ink-500">{r.trigger ?? '—'}</td>
                <td className="px-3 py-3"><RunStatusBadge status={r.status} /></td>
                <td className="max-w-md px-3 py-3 text-ink-600"><span className="line-clamp-2 break-words" title={r.summary ?? undefined}>{r.summary ?? '—'}</span></td>
                <td className="px-3 py-3 text-right tabular-nums">{r.itemsReviewed}</td>
                <td className="px-3 py-3 text-right tabular-nums">{r.proposalsCreated}</td>
                <td className="px-3 py-3 text-right tabular-nums">{r.autoExecuted}</td>
                <td className="px-3 py-3 text-right tabular-nums">{formatCents(r.costCents)}</td>
                <td className="whitespace-nowrap px-5 py-3 text-right text-ink-400" title={new Date(r.startedAt).toLocaleString()}>{timeAgo(r.startedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
