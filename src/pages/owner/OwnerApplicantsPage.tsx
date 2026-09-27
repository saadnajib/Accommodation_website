import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Briefcase, CalendarDays, ChevronDown, ChevronRight, Hourglass, ShieldCheck, Users } from 'lucide-react'
import { coverImage, useLoad, useMyApplications, useStore } from '@/store/useStore'
import { ApplicationStatusBadge, Avatar, Badge, Card, EmptyState, PageHeader, Select, Tabs } from '@/components/ui'
import { Thumb } from '@/components/owner/OwnerUi'
import {
  CLOSED_STATUSES, IN_PROGRESS_STATUSES, affordabilityRatio, isVerifying, priceDeltaPct, ratioTone,
} from '@/components/owner/utils'
import { cn, formatDate, formatMoney } from '@/lib/utils'
import type { Application, ApplicationStatus, Listing, ListingSummary, User } from '@/types'

type TabKey = 'decision' | 'progress' | 'placed' | 'closed'

const TAB_STATUSES: Record<TabKey, ApplicationStatus[]> = {
  decision: ['sent_to_owner'],
  progress: IN_PROGRESS_STATUSES,
  placed: ['completed'],
  closed: CLOSED_STATUSES,
}

const EMPTY_COPY: Record<TabKey, { title: string; description: string }> = {
  decision: { title: 'No applicants waiting for you', description: "When StayBridge has verified a renter for one of your homes, they'll appear here for your decision." },
  progress: { title: 'Nothing in progress', description: 'Applicants you accept move here while fees are paid and the contract is signed.' },
  placed: { title: 'No placements yet', description: 'Tenants you have signed a contract with will show up here.' },
  closed: { title: 'No closed applications', description: 'Declined, withdrawn or rejected applications are kept here for reference.' },
}

export default function OwnerApplicantsPage() {
  const apps = useMyApplications()
  const fetchMyApplications = useStore((s) => s.fetchMyApplications)
  const { loading } = useLoad(() => fetchMyApplications(), [fetchMyApplications])
  const fullListings = useStore((s) => s.listingsById)
  const summaries = useStore((s) => s.listingSummaries)
  const usersById = useStore((s) => s.usersById)
  const verifyingCounts = useStore((s) => s.verifyingCounts)
  const [pickedTab, setTab] = useState<TabKey | null>(null)
  const [listingFilter, setListingFilter] = useState('')
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())

  // Open the first tab that has something in it (usually "Needs decision") until the user picks one.
  const tab: TabKey = pickedTab ?? (Object.keys(TAB_STATUSES) as TabKey[]).find((k) => apps.some((a) => TAB_STATUSES[k].includes(a.status))) ?? 'decision'
  const listingById = useMemo(() => ({ get: (id: string): Listing | ListingSummary | undefined => fullListings[id] ?? summaries[id] }), [fullListings, summaries])
  const userById = useMemo(() => ({ get: (id: string): User | undefined => usersById[id] }), [usersById])

  const inScope = apps.filter((a) => !listingFilter || a.listingId === listingFilter)
  // The API never sends applications still being verified to owners — only counts per listing.
  const verifyingCount = listingFilter ? verifyingCounts[listingFilter] ?? 0 : Object.values(verifyingCounts).reduce((sum, n) => sum + n, 0)
  const visible = inScope.filter((a) => !isVerifying(a.status))
  const inTab = visible.filter((a) => TAB_STATUSES[tab].includes(a.status))

  const listingOptions = useMemo(() => {
    const ids = [...new Set([...apps.map((a) => a.listingId), ...Object.keys(verifyingCounts)])]
    return ids.map((id) => ({ value: id, label: listingById.get(id)?.title ?? 'Removed listing' }))
  }, [apps, listingById, verifyingCounts])

  const groupMap = new Map<string, Application[]>()
  for (const a of inTab) groupMap.set(a.listingId, [...(groupMap.get(a.listingId) ?? []), a])
  const groups = [...groupMap.entries()]

  const tabs = (Object.keys(TAB_STATUSES) as TabKey[]).map((k) => ({
    value: k,
    label: { decision: 'Needs decision', progress: 'In progress', placed: 'Placed', closed: 'Closed' }[k],
    count: visible.filter((a) => TAB_STATUSES[k].includes(a.status)).length,
  }))

  const toggle = (id: string) => setCollapsed((c) => {
    const n = new Set(c)
    if (n.has(id)) n.delete(id)
    else n.add(id)
    return n
  })

  return (
    <div>
      <PageHeader
        title="Applicants"
        description="Every applicant here has been identity- and income-checked by StayBridge before reaching you."
      />

      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Tabs tabs={tabs} value={tab} onChange={setTab} />
        {listingOptions.length > 1 && (
          <Select
            className="md:w-72" name="listing-filter" aria-label="Filter by listing" value={listingFilter}
            onChange={(e) => setListingFilter(e.target.value)} placeholder="All listings" options={listingOptions}
          />
        )}
      </div>

      {verifyingCount > 0 && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-dashed border-ink-200 bg-white/60 px-4 py-3 text-sm text-ink-500">
          <Hourglass className="h-4 w-4 shrink-0 text-ink-400" />
          <span>
            <span className="font-semibold text-ink-700">{verifyingCount} applicant{verifyingCount === 1 ? ' is' : 's are'} being verified by StayBridge.</span>{' '}
            You'll see their profile{verifyingCount === 1 ? '' : 's'} once verification is complete.
          </span>
        </div>
      )}

      {groups.length === 0 && loading ? (
        <div className="space-y-3">{[0, 1].map((i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-ink-100" />)}</div>
      ) : groups.length === 0 ? (
        <EmptyState icon={<Users className="h-6 w-6" />} {...EMPTY_COPY[tab]} />
      ) : (
        <div className="space-y-4">
          {groups.map(([listingId, list]) => {
            const listing = listingById.get(listingId)
            const open = !collapsed.has(listingId)
            return (
              <Card key={listingId} className="overflow-hidden">
                <button
                  type="button" onClick={() => toggle(listingId)} aria-expanded={open}
                  className="flex w-full items-center gap-3 border-b border-ink-100 bg-ink-50/50 px-4 py-3 text-left transition-colors hover:bg-ink-50"
                >
                  <Thumb src={coverImage(listing)} alt={listing?.title ?? 'Listing'} className="h-10 w-14" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink-900">{listing?.title ?? 'Removed listing'}</p>
                    <p className="truncate text-xs text-ink-400">
                      {listing ? `${listing.area} · ${listing.city} · ${formatMoney(listing.price, listing.currency)}/mo` : ''}
                    </p>
                  </div>
                  <Badge tone="brand">{list.length}</Badge>
                  <ChevronDown className={cn('h-4 w-4 shrink-0 text-ink-400 transition-transform', !open && '-rotate-90')} />
                </button>
                {open && (
                  <ul className="divide-y divide-ink-100">
                    {list.map((a) => <ApplicantRow key={a.id} app={a} listing={listing} renter={userById.get(a.renterId)} />)}
                  </ul>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ApplicantRow({ app, listing, renter }: { app: Application; listing?: Listing | ListingSummary; renter?: User }) {
  // The API anonymises the renter ("Jonas W.") until contact is unlocked.
  const name = renter?.name ?? 'StayBridge renter'
  const ratio = affordabilityRatio(app)
  const asking = listing?.price ?? app.proposedPrice
  const delta = priceDeltaPct(app.proposedPrice, asking)
  const ratioCls = { success: 'text-emerald-700', warning: 'text-amber-700', danger: 'text-red-700', neutral: 'text-ink-500' }[ratioTone(ratio)]
  return (
    <li>
      <Link to={`/owner/applications/${app.id}`} className="group flex flex-col gap-3 px-4 py-4 transition-colors hover:bg-brand-50/40 sm:px-5 lg:flex-row lg:items-center">
        <div className="flex min-w-0 items-center gap-3 lg:w-64 lg:shrink-0">
          <Avatar name={name} src={app.contactUnlocked ? renter?.avatarUrl : undefined} />
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-1.5 font-semibold text-ink-900">
              <span className="truncate">{name}</span>
              {renter?.verification === 'verified' && <ShieldCheck className="h-4 w-4 text-brand-600" aria-label="Verified by StayBridge" />}
            </p>
            <p className="flex items-center gap-1 truncate text-xs text-ink-500">
              <Briefcase className="h-3 w-3 shrink-0" /> {app.profile?.occupation ?? 'Occupation not shared'}
            </p>
          </div>
        </div>

        <dl className="grid flex-1 grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-ink-400">Offer</dt>
            <dd className="font-semibold text-ink-900">
              {formatMoney(app.proposedPrice, listing?.currency)}
              {delta !== 0 && <span className={cn('ml-1 text-xs font-medium', delta < 0 ? 'text-amber-700' : 'text-emerald-700')}>{delta > 0 ? '+' : ''}{delta}%</span>}
            </dd>
            <dd className="text-[11px] text-ink-400">asking {formatMoney(asking, listing?.currency)}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-ink-400">Income / rent</dt>
            <dd className={cn('font-semibold', ratioCls)}>{ratio ? `${ratio.toFixed(1)}×` : '—'}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-ink-400">Move-in</dt>
            <dd className="flex items-center gap-1 font-medium text-ink-700"><CalendarDays className="h-3.5 w-3.5 text-ink-400" /> {formatDate(app.moveInDate, { day: 'numeric', month: 'short' })}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-ink-400">Stay</dt>
            <dd className="font-medium text-ink-700">{app.stayMonths} months</dd>
          </div>
        </dl>

        <div className="flex items-center justify-between gap-3 lg:w-44 lg:justify-end">
          <ApplicationStatusBadge status={app.status} />
          <ChevronRight className="h-4 w-4 text-ink-300 transition-transform group-hover:translate-x-0.5 group-hover:text-ink-500" />
        </div>
      </Link>
    </li>
  )
}
