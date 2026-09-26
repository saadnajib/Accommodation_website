import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Columns3, List, ListChecks, Search, Zap } from 'lucide-react'
import { ApplicationStatusBadge, Avatar, Card, EmptyState, Input, PageHeader, Select } from '@/components/ui'
import { useStore } from '@/store/useStore'
import { APPLICATION_STATUS, PIPELINE } from '@/lib/status'
import { cn, formatMoney, timeAgo } from '@/lib/utils'
import type { Application, ApplicationStatus, Listing, User } from '@/types'
import { PaidDot } from '@/components/admin/AdminBits'
import { CLOSED_STATUSES, isClosed, statusEnteredAt } from '@/components/admin/helpers'

type View = 'board' | 'list'
type StatusFilter = 'all' | 'open' | 'closed' | ApplicationStatus

interface Row { app: Application; renter?: User; listing?: Listing }

const columns: Array<{ key: string; label: string; statuses: ApplicationStatus[] }> = [
  ...PIPELINE.map((s) => ({ key: s, label: APPLICATION_STATUS[s].label, statuses: [s] })),
  { key: 'closed', label: 'Closed', statuses: CLOSED_STATUSES },
]

function initialView(): View {
  if (typeof window === 'undefined' || !window.matchMedia) return 'board'
  return window.matchMedia('(min-width: 768px)').matches ? 'board' : 'list'
}

export default function AdminApplicationsPage() {
  const applications = useStore((s) => s.applications)
  const users = useStore((s) => s.users)
  const listings = useStore((s) => s.listings)
  const [view, setView] = useState<View>(initialView)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')

  const rows = useMemo<Row[]>(() => {
    const userById = new Map(users.map((u) => [u.id, u]))
    const listingById = new Map(listings.map((l) => [l.id, l]))
    const needle = q.trim().toLowerCase()
    return applications
      .map((app) => ({ app, renter: userById.get(app.renterId), listing: listingById.get(app.listingId) }))
      .filter(({ app, renter, listing }) => {
        if (status === 'open' && (isClosed(app.status) || app.status === 'completed')) return false
        if (status === 'closed' && !isClosed(app.status)) return false
        if (status !== 'all' && status !== 'open' && status !== 'closed' && app.status !== status) return false
        if (!needle) return true
        return (renter?.name.toLowerCase().includes(needle) ?? false) || (listing?.title.toLowerCase().includes(needle) ?? false)
      })
      .sort((a, b) => statusEnteredAt(b.app).localeCompare(statusEnteredAt(a.app)))
  }, [applications, users, listings, q, status])

  const statusOptions = [
    { value: 'all', label: 'All statuses' },
    { value: 'open', label: 'Open deals' },
    { value: 'closed', label: 'Closed (no deal)' },
    ...(Object.keys(APPLICATION_STATUS) as ApplicationStatus[]).map((s) => ({ value: s, label: APPLICATION_STATUS[s].label })),
  ]

  return (
    <div>
      <PageHeader title="Deal pipeline" description="Every application from submission to signed contract." />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end">
        <Input
          className="flex-1"
          id="pipeline-search"
          aria-label="Search applications"
          placeholder="Search renter or listing…"
          left={<Search className="h-4 w-4" />}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Select
          className="sm:w-52"
          id="pipeline-status"
          aria-label="Filter by status"
          options={statusOptions}
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusFilter)}
        />
        <div className="inline-flex shrink-0 self-start rounded-xl bg-ink-100 p-1 sm:self-auto" role="group" aria-label="View">
          {([['board', Columns3, 'Board'], ['list', List, 'List']] as const).map(([v, Icon, label]) => (
            <button key={v} type="button" onClick={() => setView(v)} aria-pressed={view === v}
              className={cn('inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors',
                view === v ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-900')}>
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={<ListChecks className="h-6 w-6" />} title="No applications match" description="Try a different search or status filter." />
      ) : view === 'board' ? (
        <Board rows={rows} />
      ) : (
        <ListView rows={rows} />
      )}
    </div>
  )
}

function Board({ rows }: { rows: Row[] }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-3 sm:mx-0 sm:px-0">
      <div className="flex gap-3">
        {columns.map((col) => {
          const items = rows.filter((r) => col.statuses.includes(r.app.status))
          const tone = col.key === 'closed' ? 'bg-ink-300' : {
            neutral: 'bg-ink-300', info: 'bg-sky-500', success: 'bg-emerald-500', warning: 'bg-amber-500', danger: 'bg-red-500', brand: 'bg-brand-600',
          }[APPLICATION_STATUS[col.statuses[0]].tone]
          return (
            <section key={col.key} className="flex w-64 shrink-0 flex-col rounded-2xl bg-ink-100/70 p-2" aria-label={col.label}>
              <header className="flex items-center gap-2 px-2 pb-2 pt-1">
                <span className={cn('h-2 w-2 rounded-full', tone)} />
                <h2 className="flex-1 font-sans text-sm font-semibold text-ink-700">{col.label}</h2>
                <span className="rounded-full bg-white px-2 text-xs font-semibold text-ink-500">{items.length}</span>
              </header>
              <div className="flex max-h-[65vh] min-h-24 flex-col gap-2 overflow-y-auto">
                {items.length === 0 && <p className="px-2 py-6 text-center text-xs text-ink-400">Empty</p>}
                {items.map((r) => <DealCard key={r.app.id} row={r} />)}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}

function DealCard({ row: { app, renter, listing } }: { row: Row }) {
  return (
    <Link to={`/admin/applications/${app.id}`}
      className="block rounded-xl border border-ink-200/80 bg-white p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
      <div className="flex items-center gap-2">
        <Avatar name={renter?.name ?? '?'} src={renter?.avatarUrl} size="sm" />
        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-ink-900">{renter?.name ?? 'Unknown renter'}</p>
        {renter?.hasTenantPass && <Zap className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-label="Tenant Pass" />}
      </div>
      <p className="mt-2 line-clamp-2 text-xs text-ink-500">{listing?.title ?? 'Unknown listing'}</p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold tabular-nums text-ink-900">{formatMoney(app.agreedPrice, listing?.currency)}<span className="text-xs font-normal text-ink-400">/mo</span></span>
        <span className="text-[11px] text-ink-400">{timeAgo(statusEnteredAt(app))}</span>
      </div>
      {isClosed(app.status) && <div className="mt-2"><ApplicationStatusBadge status={app.status} /></div>}
      {(app.status === 'awaiting_fees' || app.status === 'contact_unlocked') && (
        <div className="mt-2 flex gap-3 border-t border-ink-100 pt-2">
          <PaidDot paid={app.renterFeePaid} label="Renter" />
          <PaidDot paid={app.ownerFeePaid} label="Owner" />
        </div>
      )}
    </Link>
  )
}

function ListView({ rows }: { rows: Row[] }) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-ink-100 bg-ink-50/70 text-xs uppercase tracking-wide text-ink-400">
            <tr>
              <th className="px-4 py-3 font-medium">Renter</th>
              <th className="px-4 py-3 font-medium">Listing</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Agreed</th>
              <th className="px-4 py-3 font-medium">Fees</th>
              <th className="px-4 py-3 font-medium">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {rows.map(({ app, renter, listing }) => (
              <tr key={app.id} className="transition-colors hover:bg-ink-50">
                <td className="px-4 py-3">
                  <Link to={`/admin/applications/${app.id}`} className="flex items-center gap-2 font-medium text-ink-900 hover:text-brand-700">
                    <Avatar name={renter?.name ?? '?'} src={renter?.avatarUrl} size="sm" />
                    <span className="truncate">{renter?.name ?? 'Unknown renter'}</span>
                  </Link>
                </td>
                <td className="max-w-[16rem] truncate px-4 py-3 text-ink-600">{listing?.title ?? '—'}</td>
                <td className="px-4 py-3"><ApplicationStatusBadge status={app.status} /></td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatMoney(app.agreedPrice, listing?.currency)}
                  {listing && app.agreedPrice !== listing.price && <span className="block text-xs text-ink-400 line-through">{formatMoney(listing.price, listing.currency)}</span>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-0.5">
                    <PaidDot paid={app.renterFeePaid} label="Renter" />
                    <PaidDot paid={app.ownerFeePaid} label="Owner" />
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-ink-500">{timeAgo(statusEnteredAt(app))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
