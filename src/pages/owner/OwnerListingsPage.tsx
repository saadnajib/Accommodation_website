import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, CalendarDays, Eye, Home, KeyRound, Pause, Pencil, Play, Plus, Sparkles, Star, Users } from 'lucide-react'
import { useCurrentUser, useStore } from '@/store/useStore'
import { Button, Card, EmptyState, ListingStatusBadge, Modal, PageHeader, Tabs } from '@/components/ui'
import { ButtonLink, Thumb } from '@/components/owner/OwnerUi'
import { FeatureListingModal } from '@/components/owner/FeatureListingModal'
import { cn, formatDate, formatMoney } from '@/lib/utils'
import type { Listing, ListingStatus } from '@/types'

type Filter = 'all' | 'live' | 'pending' | 'paused' | 'rented' | 'rejected'

const FILTER_STATUSES: Record<Exclude<Filter, 'all'>, ListingStatus[]> = {
  live: ['active'],
  pending: ['pending_review', 'draft'],
  paused: ['paused'],
  rented: ['rented'],
  rejected: ['rejected'],
}

function matches(l: Listing, f: Filter) {
  return f === 'all' || FILTER_STATUSES[f].includes(l.status)
}

export default function OwnerListingsPage() {
  const me = useCurrentUser()
  const allListings = useStore((s) => s.listings)
  const allApps = useStore((s) => s.applications)
  const setListingStatus = useStore((s) => s.setListingStatus)
  const toast = useStore((s) => s.toast)
  const [filter, setFilter] = useState<Filter>('all')
  const [featuring, setFeaturing] = useState<Listing | null>(null)
  const [renting, setRenting] = useState<Listing | null>(null)

  const meId = me?.id
  const listings = useMemo(
    () => allListings.filter((l) => l.ownerId === meId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [allListings, meId],
  )
  const applicantCount = useMemo(() => {
    const m = new Map<string, number>()
    for (const a of allApps) if (a.ownerId === meId) m.set(a.listingId, (m.get(a.listingId) ?? 0) + 1)
    return m
  }, [allApps, meId])

  const visible = listings.filter((l) => matches(l, filter))
  const tabs: Array<{ value: Filter; label: string; count: number }> = [
    { value: 'all', label: 'All', count: listings.length },
    { value: 'live', label: 'Live', count: listings.filter((l) => matches(l, 'live')).length },
    { value: 'pending', label: 'Pending', count: listings.filter((l) => matches(l, 'pending')).length },
    { value: 'paused', label: 'Paused', count: listings.filter((l) => matches(l, 'paused')).length },
    { value: 'rented', label: 'Rented', count: listings.filter((l) => matches(l, 'rented')).length },
    { value: 'rejected', label: 'Rejected', count: listings.filter((l) => matches(l, 'rejected')).length },
  ]

  const togglePause = (l: Listing) => {
    if (l.status === 'active') {
      setListingStatus(l.id, 'paused')
      toast({ title: 'Listing paused', body: `“${l.title}” is hidden from search until you resume it.`, tone: 'info' })
    } else if (l.status === 'paused') {
      setListingStatus(l.id, 'active')
      toast({ title: 'Listing is live again', body: `“${l.title}” is visible in search.`, tone: 'success' })
    }
  }
  const confirmRented = () => {
    if (!renting) return
    setListingStatus(renting.id, 'rented')
    toast({ title: 'Marked as rented', body: 'Congratulations! The listing is no longer shown in search.', tone: 'success' })
    setRenting(null)
  }

  /** `table` = compact icon buttons for the desktop table; otherwise labelled buttons for cards. */
  const actions = (l: Listing, table: boolean) => {
    const canToggle = l.status === 'active' || l.status === 'paused'
    const pauseLabel = l.status === 'active' ? 'Pause' : 'Resume'
    const PauseIcon = l.status === 'active' ? Pause : Play
    return (
      <div className={cn('flex gap-1.5', table ? 'flex-nowrap justify-end' : 'flex-wrap')}>
        <ButtonLink to={`/owner/listings/${l.id}/edit`} variant="outline" size="sm" aria-label={`Edit ${l.title}`}>
          <Pencil className="h-3.5 w-3.5" /> Edit
        </ButtonLink>
        {canToggle && (
          <Button variant="outline" size="sm" onClick={() => togglePause(l)} aria-label={`${pauseLabel} ${l.title}`} title={pauseLabel} className={table ? 'w-9 px-0' : ''}>
            <PauseIcon className="h-3.5 w-3.5" />{!table && ` ${pauseLabel}`}
          </Button>
        )}
        {canToggle && (
          <Button variant={table ? 'outline' : 'ghost'} size="sm" onClick={() => setRenting(l)} aria-label={`Mark ${l.title} as rented`} title="Mark as rented" className={table ? 'w-9 px-0' : ''}>
            <KeyRound className="h-3.5 w-3.5" />{!table && ' Mark rented'}
          </Button>
        )}
        {l.status === 'active' && !l.featured && (
          <Button variant="accent" size="sm" onClick={() => setFeaturing(l)}>
            <Sparkles className="h-3.5 w-3.5" /> Feature
          </Button>
        )}
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="My listings"
        description="Manage your homes, pause them when you're away and boost them to get seen first."
        action={<ButtonLink to="/owner/listings/new"><Plus className="h-4 w-4" /> New listing</ButtonLink>}
      />

      {listings.length === 0 ? (
        <EmptyState
          icon={<Home className="h-6 w-6" />}
          title="You haven't posted a home yet"
          description="It takes about 5 minutes. We review it, then start sending you verified applicants."
          action={<ButtonLink to="/owner/listings/new"><Plus className="h-4 w-4" /> Post your first listing</ButtonLink>}
        />
      ) : (
        <>
          <Tabs tabs={tabs} value={filter} onChange={setFilter} className="mb-4" />

          {visible.length === 0 ? (
            <EmptyState icon={<Home className="h-6 w-6" />} title="Nothing here" description="No listings match this filter." />
          ) : (
            <>
              {/* Desktop table */}
              <Card className="relative hidden overflow-x-auto xl:block">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-ink-100 bg-ink-50/60 text-xs uppercase tracking-wide text-ink-400">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Listing</th>
                      <th className="px-3 py-3 font-semibold">Price</th>
                      <th className="px-3 py-3 font-semibold">Status</th>
                      <th className="px-3 py-3 font-semibold">Activity</th>
                      <th className="px-4 py-3 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {visible.map((l) => (
                      <tr key={l.id} className="align-middle transition-colors hover:bg-ink-50/60">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Thumb src={l.images[0]} alt={l.title} className="h-12 w-16" />
                            <div className="min-w-0 max-w-[14rem]">
                              <Link to={`/owner/listings/${l.id}/edit`} className="flex items-center gap-1.5 font-semibold text-ink-900 hover:text-brand-800">
                                <span className="truncate">{l.title}</span>
                                {l.featured && <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" aria-label="Featured" />}
                              </Link>
                              <p className="truncate text-xs text-ink-400">{l.area} · {l.city}</p>
                              <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-400"><CalendarDays className="h-3 w-3" /> From {formatDate(l.availableFrom, { day: 'numeric', month: 'short' })}</p>
                              {l.status === 'rejected' && l.rejectionReason && (
                                <p className="mt-0.5 truncate text-xs text-red-600" title={l.rejectionReason}>{l.rejectionReason}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 font-semibold text-ink-900">{formatMoney(l.price, l.currency)}<span className="text-xs font-normal text-ink-400">/mo</span></td>
                        <td className="px-3 py-3"><ListingStatusBadge status={l.status} /></td>
                        <td className="whitespace-nowrap px-3 py-3 text-xs text-ink-600">
                          <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5 text-ink-400" /> {l.views.toLocaleString('en-US')} views</span>
                          <span className="mt-1 flex items-center gap-1"><Users className="h-3.5 w-3.5 text-ink-400" /> {applicantCount.get(l.id) ?? 0} applicants</span>
                        </td>
                        <td className="w-[1%] px-4 py-3">{actions(l, true)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>

              {/* Mobile / tablet cards */}
              <div className="grid gap-3 md:grid-cols-2 xl:hidden">
                {visible.map((l) => (
                  <Card key={l.id} className="overflow-hidden">
                    <div className="flex gap-3 p-4">
                      <Thumb src={l.images[0]} alt={l.title} className="h-20 w-24" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <Link to={`/owner/listings/${l.id}/edit`} className="line-clamp-2 text-sm font-semibold text-ink-900 hover:text-brand-800">{l.title}</Link>
                          {l.featured && <Star className="mt-0.5 h-4 w-4 shrink-0 fill-amber-400 text-amber-400" aria-label="Featured" />}
                        </div>
                        <p className="mt-0.5 truncate text-xs text-ink-400">{l.area} · {l.city}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-ink-900">{formatMoney(l.price, l.currency)}<span className="text-xs font-normal text-ink-400">/mo</span></span>
                          <ListingStatusBadge status={l.status} />
                        </div>
                      </div>
                    </div>
                    {l.status === 'rejected' && l.rejectionReason && (
                      <p className="mx-4 mb-3 flex items-start gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {l.rejectionReason}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-ink-100 px-4 py-2.5 text-xs text-ink-500">
                      <span className="inline-flex items-center gap-1"><Eye className="h-3.5 w-3.5" /> {l.views} views</span>
                      <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {applicantCount.get(l.id) ?? 0} applicants</span>
                      <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> {formatDate(l.availableFrom, { day: 'numeric', month: 'short' })}</span>
                    </div>
                    <div className="border-t border-ink-100 px-4 py-3">{actions(l, false)}</div>
                  </Card>
                ))}
              </div>
            </>
          )}
        </>
      )}

      <FeatureListingModal listing={featuring} onClose={() => setFeaturing(null)} />

      <Modal
        open={!!renting}
        onClose={() => setRenting(null)}
        title="Mark as rented?"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRenting(null)}>Cancel</Button>
            <Button onClick={confirmRented}><KeyRound className="h-4 w-4" /> Mark as rented</Button>
          </>
        }
      >
        <p className="text-sm text-ink-600">
          “{renting?.title}” will be removed from search and stop receiving new applications. If you placed a tenant through StayBridge,
          confirming the tenancy on the applicant's page does this automatically.
        </p>
      </Modal>
    </div>
  )
}
