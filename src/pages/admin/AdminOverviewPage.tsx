import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight, Banknote, Clock, Hourglass, Inbox, ListChecks, Send, ShieldCheck, Store, Users, Wallet, HandCoins, CircleCheck,
} from 'lucide-react'
import { ApplicationStatusBadge, Card, CardBody, CardHeader, EmptyState, PageHeader, Stat } from '@/components/ui'
import { useAdminListings, useLoad, useMyApplications, useStore } from '@/store/useStore'
import { APPLICATION_STATUS, PIPELINE } from '@/lib/status'
import { cn, formatMoney, timeAgo } from '@/lib/utils'
import { daysSince, statusEnteredAt, BY_LABEL } from '@/components/admin/helpers'

interface QueueItem { key: string; to: string; icon: typeof ShieldCheck; tone: string; title: string; sub: string; age: string; sortAt: string }

export default function AdminOverviewPage() {
  const overview = useStore((s) => s.adminOverview)
  const applications = useMyApplications()
  const pendingListings = useAdminListings()
  const usersById = useStore((s) => s.usersById)
  const summaries = useStore((s) => s.listingSummaries)
  const fees = useStore((s) => s.fees)
  const fetchAdminOverview = useStore((s) => s.fetchAdminOverview)
  const fetchMyApplications = useStore((s) => s.fetchMyApplications)
  const fetchAdminListings = useStore((s) => s.fetchAdminListings)
  const { loading } = useLoad(
    () => Promise.all([fetchAdminOverview(), fetchMyApplications(), fetchAdminListings({ status: 'pending_review' })]),
    [fetchAdminOverview, fetchMyApplications, fetchAdminListings],
  )

  // KPIs come straight from GET /admin/overview.
  const c = overview?.counts
  const roles = { renter: c?.usersByRole.renter ?? 0, owner: c?.usersByRole.owner ?? 0, admin: c?.usersByRole.admin ?? 0 }
  const m = {
    collected: overview?.revenueCollected ?? 0,
    pending: overview?.revenuePending ?? 0,
    purchases: overview?.purchasesCollected ?? 0,
    toVerify: c?.toVerify ?? 0,
    readyToSend: c?.readyToSend ?? overview?.pipeline.verified ?? 0,
    waitingOwner: c?.waitingOnOwner ?? 0,
    awaitingFees: c?.awaitingFees ?? 0,
    completed: c?.completed ?? overview?.pipeline.completed ?? 0,
    pendingListings: c?.listingsPending ?? 0,
    liveListings: c?.listingsLive ?? 0,
    featured: c?.listingsFeatured ?? 0,
    users: roles.renter + roles.owner + roles.admin,
    roles,
  }

  // Funnel from the per-status pipeline counts: "reached" = currently at this stage or any later happy-path stage.
  const funnel = useMemo(() => {
    const p = overview?.pipeline ?? {}
    return PIPELINE.map((stage, i) => ({
      stage,
      now: p[stage] ?? 0,
      reached: PIPELINE.slice(i).reduce((sum, s) => sum + (p[s] ?? 0), 0),
    }))
  }, [overview])
  const funnelMax = Math.max(1, ...funnel.map((f) => f.reached))
  const closedCount = (overview?.pipeline.rejected ?? 0) + (overview?.pipeline.owner_declined ?? 0) + (overview?.pipeline.cancelled ?? 0)

  const queue = useMemo(() => {
    const items: QueueItem[] = []
    for (const a of applications) {
      const renter = usersById[a.renterId]
      const listing = summaries[a.listingId]
      const since = statusEnteredAt(a)
      const who = renter?.name ?? 'Unknown renter'
      const what = listing?.title ?? 'Unknown listing'
      if (a.status === 'submitted' || a.status === 'under_review') {
        items.push({ key: `v-${a.id}`, to: `/admin/applications/${a.id}`, icon: ShieldCheck, tone: 'bg-brand-50 text-brand-700',
          title: `Verify ${who}${renter?.hasTenantPass ? ' (Tenant Pass · priority)' : ''}`, sub: what, age: timeAgo(since), sortAt: renter?.hasTenantPass ? '0' : since })
      } else if (a.status === 'verified') {
        items.push({ key: `s-${a.id}`, to: `/admin/applications/${a.id}`, icon: Send, tone: 'bg-sky-50 text-sky-700',
          title: `Present ${who} to owner`, sub: what, age: timeAgo(since), sortAt: since })
      } else if (a.status === 'sent_to_owner' && daysSince(since) >= 3) {
        items.push({ key: `o-${a.id}`, to: `/admin/applications/${a.id}`, icon: Clock, tone: 'bg-ink-100 text-ink-700',
          title: `Chase owner decision for ${who}`, sub: what, age: `waiting ${daysSince(since)}d`, sortAt: since })
      } else if (a.status === 'awaiting_fees' && daysSince(since) > 3) {
        const missing = [!a.renterFeePaid && 'renter', !a.ownerFeePaid && 'owner'].filter(Boolean).join(' & ')
        items.push({ key: `f-${a.id}`, to: `/admin/applications/${a.id}`, icon: HandCoins, tone: 'bg-amber-50 text-amber-700',
          title: `Chase ${missing} fee`, sub: `${who} · ${what}`, age: `due ${daysSince(since)}d`, sortAt: since })
      }
    }
    for (const l of pendingListings) {
      if (l.status !== 'pending_review') continue
      items.push({ key: `l-${l.id}`, to: '/admin/listings', icon: Store, tone: 'bg-amber-50 text-amber-700',
        title: `Moderate listing “${l.title}”`, sub: `${usersById[l.ownerId]?.name ?? l.ownerName ?? 'Owner'} · ${l.city}`, age: timeAgo(l.createdAt), sortAt: l.createdAt })
    }
    return items.sort((a, b) => a.sortAt.localeCompare(b.sortAt))
  }, [applications, pendingListings, usersById, summaries])

  const activity = (overview?.recentEvents ?? []).slice(0, 10)

  const cur = fees.currency

  return (
    <div>
      <PageHeader title="Operations overview" description="Everything that needs your attention across verification, deals and listings." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Revenue collected" value={formatMoney(m.collected, cur)} sub={`${m.completed} deal${m.completed === 1 ? '' : 's'} completed${m.purchases ? ` · +${formatMoney(m.purchases, cur)} add-ons` : ''}`} icon={<Wallet className="h-5 w-5" />} tone="green" />
        <Stat label="Pending revenue" value={formatMoney(m.pending, cur)} sub={`${m.awaitingFees} deal${m.awaitingFees === 1 ? '' : 's'} awaiting fees`} icon={<Banknote className="h-5 w-5" />} tone="accent" />
        <Link to="/admin/verification" className="block rounded-2xl transition-transform hover:-translate-y-0.5 [&>div]:h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
          <Stat label="To verify" value={m.toVerify} sub={`${m.readyToSend} verified, ready to send`} icon={<ShieldCheck className="h-5 w-5" />} tone="brand" />
        </Link>
        <Link to="/admin/applications" className="block rounded-2xl transition-transform hover:-translate-y-0.5 [&>div]:h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
          <Stat label="Waiting on owner" value={m.waitingOwner} sub="Presented, decision pending" icon={<Hourglass className="h-5 w-5" />} tone="ink" />
        </Link>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <MiniStat label="Awaiting fees" value={m.awaitingFees} to="/admin/applications" />
        <MiniStat label="Listings to review" value={m.pendingListings} to="/admin/listings" highlight={m.pendingListings > 0} />
        <MiniStat label="Live listings" value={m.liveListings} sub={`${m.featured} featured`} to="/admin/listings" />
        <MiniStat label="Users" value={m.users} sub={`${m.roles.renter} renters · ${m.roles.owner} owners · ${m.roles.admin} admin`} to="/admin/users" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader title="Deal pipeline" description="Applications that reached each stage (light) and sit there now (dark)."
            action={<Link to="/admin/applications" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:text-brand-800">Open board <ArrowRight className="h-4 w-4" /></Link>} />
          <CardBody>
            <ul className="space-y-2.5">
              {funnel.map((f) => (
                <li key={f.stage} className="grid grid-cols-[7.5rem_1fr_auto] items-center gap-3 sm:grid-cols-[9rem_1fr_auto]">
                  <span className="truncate text-sm text-ink-600">{APPLICATION_STATUS[f.stage].label}</span>
                  <div className="relative h-6 overflow-hidden rounded-lg bg-ink-100" role="img" aria-label={`${f.reached} reached, ${f.now} currently at ${APPLICATION_STATUS[f.stage].label}`}>
                    <div className="absolute inset-y-0 left-0 rounded-lg bg-brand-200 transition-all duration-500" style={{ width: `${(f.reached / funnelMax) * 100}%` }} />
                    <div className="absolute inset-y-0 left-0 rounded-lg bg-brand-700 transition-all duration-500" style={{ width: `${(f.now / funnelMax) * 100}%` }} />
                  </div>
                  <span className="w-16 text-right text-xs tabular-nums text-ink-500"><b className="text-ink-900">{f.now}</b> / {f.reached}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-ink-400">{closedCount} closed without a deal (rejected, declined or cancelled).</p>
          </CardBody>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader title="Today’s queue" description={`${queue.length} item${queue.length === 1 ? '' : 's'} need action`} />
          <CardBody className="p-2 sm:p-2">
            {queue.length === 0 && loading ? (
              <div className="space-y-2 p-2">{[0, 1, 2].map((i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-ink-100" />)}</div>
            ) : queue.length === 0 ? (
              <EmptyState className="m-2 border-0" icon={<CircleCheck className="h-6 w-6" />} title="Inbox zero" description="Nothing needs your attention right now." />
            ) : (
              <ul className="max-h-[26rem] overflow-y-auto">
                {queue.map((q) => (
                  <li key={q.key}>
                    <Link to={q.to} className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-ink-50">
                      <span className={cn('rounded-lg p-2', q.tone)}><q.icon className="h-4 w-4" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink-900">{q.title}</span>
                        <span className="block truncate text-xs text-ink-400">{q.sub}</span>
                      </span>
                      <span className="shrink-0 text-xs text-ink-400">{q.age}</span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-ink-300 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-700" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Recent activity" description="Latest status changes across all applications" />
        {activity.length === 0 ? (
          <CardBody><EmptyState icon={<Inbox className="h-6 w-6" />} title="No activity yet" /></CardBody>
        ) : (
          <ul className="divide-y divide-ink-100">
            {activity.map((e, i) => {
              const a = e.application
              return (
                <li key={`${a.id}-${e.at}-${i}`}>
                  <Link to={`/admin/applications/${a.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 transition-colors hover:bg-ink-50">
                    <ApplicationStatusBadge status={e.status} />
                    <span className="min-w-0 flex-1 text-sm">
                      <span className="font-medium text-ink-900">{a.renterName ?? 'Unknown renter'}</span>
                      <span className="text-ink-400"> · </span>
                      <span className="text-ink-600">{a.listingTitle ?? 'Unknown listing'}</span>
                      {e.note && <span className="mt-0.5 block truncate text-xs text-ink-400">“{e.note}”</span>}
                    </span>
                    <span className="text-xs text-ink-400">{BY_LABEL[e.by]} · {timeAgo(e.at)}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <div className="mt-6 flex flex-wrap gap-2 text-sm">
        <QuickLink to="/admin/verification" icon={ShieldCheck}>Verification queue</QuickLink>
        <QuickLink to="/admin/applications" icon={ListChecks}>Deal pipeline</QuickLink>
        <QuickLink to="/admin/listings" icon={Store}>Moderate listings</QuickLink>
        <QuickLink to="/admin/users" icon={Users}>Users</QuickLink>
      </div>
    </div>
  )
}

function MiniStat({ label, value, sub, to, highlight }: { label: string; value: number; sub?: string; to: string; highlight?: boolean }) {
  return (
    <Link to={to} className={cn('rounded-2xl border bg-white p-4 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-lift', highlight ? 'border-amber-300' : 'border-ink-200/80')}>
      <p className="text-xs font-medium text-ink-500">{label}</p>
      <p className="mt-0.5 text-xl font-bold tabular-nums text-ink-900">{value}</p>
      {sub && <p className="mt-0.5 truncate text-xs text-ink-400">{sub}</p>}
    </Link>
  )
}

function QuickLink({ to, icon: Icon, children }: { to: string; icon: typeof ShieldCheck; children: string }) {
  return (
    <Link to={to} className="inline-flex items-center gap-2 rounded-xl border border-ink-200 bg-white px-3 py-2 font-medium text-ink-700 transition-colors hover:border-brand-300 hover:text-brand-800">
      <Icon className="h-4 w-4" /> {children}
    </Link>
  )
}
