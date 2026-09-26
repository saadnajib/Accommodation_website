import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Check, ChevronDown, Eye, ExternalLink, Pause, Play, Search, Sparkles, Store, X } from 'lucide-react'
import { Badge, Button, Card, EmptyState, Input, ListingStatusBadge, PageHeader, Tabs } from '@/components/ui'
import { useStore } from '@/store/useStore'
import { PROPERTY_TYPES } from '@/lib/status'
import { cn, formatDate, formatMoney, timeAgo } from '@/lib/utils'
import type { Listing, ListingStatus } from '@/types'
import { ActionModal } from '@/components/admin/ActionModal'
import { InfoRow } from '@/components/admin/AdminBits'

const TABS: Array<{ value: ListingStatus; label: string }> = [
  { value: 'pending_review', label: 'Pending review' },
  { value: 'active', label: 'Live' },
  { value: 'paused', label: 'Paused' },
  { value: 'rented', label: 'Rented' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'draft', label: 'Drafts' },
]

export default function AdminListingsPage() {
  const listings = useStore((s) => s.listings)
  const users = useStore((s) => s.users)
  const setListingStatus = useStore((s) => s.setListingStatus)
  const updateListing = useStore((s) => s.updateListing)
  const toast = useStore((s) => s.toast)
  const [params, setParams] = useSearchParams()
  const ownerFilter = params.get('owner')
  const [tab, setTab] = useState<ListingStatus>(() => {
    const t = params.get('tab') as ListingStatus | null
    if (t && TABS.some((x) => x.value === t)) return t
    // Filtering by owner: open the first tab that has something for them.
    if (ownerFilter) return TABS.find((x) => listings.some((l) => l.ownerId === ownerFilter && l.status === x.value))?.value ?? 'pending_review'
    return 'pending_review'
  })
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [rejecting, setRejecting] = useState<Listing | null>(null)

  const userById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users])
  const owner = ownerFilter ? userById.get(ownerFilter) : undefined

  const scoped = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return listings.filter((l) => {
      if (ownerFilter && l.ownerId !== ownerFilter) return false
      if (!needle) return true
      return [l.title, l.city, l.area, userById.get(l.ownerId)?.name ?? ''].some((s) => s.toLowerCase().includes(needle))
    })
  }, [listings, ownerFilter, q, userById])

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    scoped.forEach((l) => { c[l.status] = (c[l.status] ?? 0) + 1 })
    return c
  }, [scoped])

  const rows = scoped.filter((l) => l.status === tab).sort((a, b) =>
    tab === 'pending_review' ? a.createdAt.localeCompare(b.createdAt) : b.createdAt.localeCompare(a.createdAt))

  const approve = (l: Listing) => {
    setListingStatus(l.id, 'active')
    toast({ title: 'Listing approved', body: `“${l.title}” is now live.`, tone: 'success' })
  }
  const pause = (l: Listing) => {
    setListingStatus(l.id, 'paused')
    toast({ title: 'Listing paused', body: 'It is hidden from search until reactivated.', tone: 'info' })
  }
  const toggleFeatured = (l: Listing) => {
    updateListing(l.id, { featured: !l.featured })
    toast({ title: l.featured ? 'Featured boost removed' : 'Listing featured (complimentary)', tone: 'success' })
  }

  return (
    <div>
      <PageHeader title="Listings" description="Moderate new ads, keep live inventory healthy and comp featured boosts." />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input className="flex-1" id="listing-search" aria-label="Search listings" placeholder="Search title, city or owner…"
          left={<Search className="h-4 w-4" />} value={q} onChange={(e) => setQ(e.target.value)} />
        {owner && (
          <span className="inline-flex items-center gap-2 self-start rounded-full bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-800 ring-1 ring-brand-200 sm:self-auto">
            Owner: {owner.name}
            <button type="button" aria-label="Clear owner filter" className="rounded-full p-0.5 hover:bg-brand-100"
              onClick={() => { params.delete('owner'); setParams(params, { replace: true }) }}>
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        )}
      </div>

      <Tabs<ListingStatus> className="mb-5" value={tab} onChange={setTab}
        tabs={TABS.map((t) => ({ ...t, count: counts[t.value] ?? 0 }))} />

      {rows.length === 0 ? (
        <EmptyState icon={<Store className="h-6 w-6" />} title={`No ${TABS.find((t) => t.value === tab)?.label.toLowerCase()} listings`}
          description={tab === 'pending_review' ? 'New listings from owners will appear here for moderation.' : undefined} />
      ) : (
        <ul className="space-y-3">
          {rows.map((l) => {
            const ownerUser = userById.get(l.ownerId)
            const expanded = !!open[l.id]
            const panelId = `listing-detail-${l.id}`
            return (
              <li key={l.id}>
                <Card className={cn('overflow-hidden transition-shadow', expanded && 'shadow-lift')}>
                  <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                    <div className="flex min-w-0 flex-1 gap-4">
                      <img src={l.images[0]} alt={l.title} loading="lazy" className="h-20 w-24 shrink-0 overflow-hidden rounded-xl bg-ink-100 object-cover text-[0px] sm:h-20 sm:w-28" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <ListingStatusBadge status={l.status} />
                          {l.featured && <Badge tone="warning"><Sparkles className="h-3 w-3" /> Featured</Badge>}
                        </div>
                        <p className="mt-1 truncate font-semibold text-ink-900" title={l.title}>{l.title}</p>
                        <p className="truncate text-sm text-ink-500">
                          {ownerUser?.name ?? 'Unknown owner'} · {l.city} · <span className="font-medium text-ink-900">{formatMoney(l.price, l.currency)}</span>/mo
                        </p>
                        <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-ink-400">
                          <span>Created {timeAgo(l.createdAt)}</span>
                          <span className="inline-flex items-center gap-1"><Eye className="h-3.5 w-3.5" /> {l.views} views</span>
                        </p>
                        {l.status === 'rejected' && l.rejectionReason && <p className="mt-1 text-xs text-red-700">Reason: {l.rejectionReason}</p>}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      {l.status === 'pending_review' && (<>
                        <Button size="sm" onClick={() => approve(l)}><Check className="h-4 w-4" /> Approve</Button>
                        <Button size="sm" variant="ghost" className="text-red-700 hover:bg-red-50" onClick={() => setRejecting(l)}>Reject</Button>
                      </>)}
                      {l.status === 'active' && (<>
                        <Button size="sm" variant="outline" onClick={() => pause(l)}><Pause className="h-4 w-4" /> Pause</Button>
                        <Button size="sm" variant={l.featured ? 'outline' : 'accent'} onClick={() => toggleFeatured(l)}>
                          <Sparkles className="h-4 w-4" /> {l.featured ? 'Unfeature' : 'Feature'}
                        </Button>
                      </>)}
                      {(l.status === 'paused' || l.status === 'rejected') && (
                        <Button size="sm" variant="outline" onClick={() => approve(l)}><Play className="h-4 w-4" /> {l.status === 'paused' ? 'Reactivate' : 'Approve'}</Button>
                      )}
                      <Link to={`/listings/${l.id}`} className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-brand-700 hover:bg-brand-50">
                        Preview <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                      <button type="button" aria-expanded={expanded} aria-controls={panelId}
                        onClick={() => setOpen((o) => ({ ...o, [l.id]: !o[l.id] }))}
                        className="inline-flex h-9 items-center gap-1 rounded-xl px-2 text-sm font-medium text-ink-500 hover:bg-ink-100 hover:text-ink-900">
                        Details <ChevronDown className={cn('h-4 w-4 transition-transform', expanded && 'rotate-180')} />
                      </button>
                    </div>
                  </div>

                  {expanded && (
                    <div id={panelId} className="grid gap-5 border-t border-ink-100 bg-ink-50/50 p-4 animate-fade-in sm:p-5 md:grid-cols-3">
                      <div className="md:col-span-2">
                        <p className="text-xs font-medium uppercase tracking-wide text-ink-400">Description</p>
                        <p className="mt-1 whitespace-pre-line text-sm text-ink-700">{l.description}</p>
                        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                          <InfoRow label="Exact address" className="col-span-2 sm:col-span-3">{l.address} · {l.area}, {l.city}</InfoRow>
                          <InfoRow label="Type">{PROPERTY_TYPES.find((t) => t.value === l.type)?.label ?? l.type}</InfoRow>
                          <InfoRow label="Size">{l.bedrooms} bd · {l.bathrooms} ba · {l.sizeSqm} m²</InfoRow>
                          <InfoRow label="Deposit">{formatMoney(l.deposit, l.currency)}</InfoRow>
                          <InfoRow label="Available">{formatDate(l.availableFrom)}</InfoRow>
                          <InfoRow label="Min. stay">{l.minStayMonths} months</InfoRow>
                          <InfoRow label="Bills / furnished">{l.billsIncluded ? 'Bills incl.' : 'Bills extra'} · {l.furnished ? 'Furnished' : 'Unfurnished'}</InfoRow>
                        </dl>
                      </div>
                      <div className="space-y-4">
                        <TagList title="Amenities" items={l.amenities} />
                        <TagList title="House rules" items={l.houseRules} />
                        {ownerUser && (
                          <div>
                            <p className="text-xs font-medium uppercase tracking-wide text-ink-400">Owner contact</p>
                            <p className="mt-1 text-sm text-ink-700">{ownerUser.email}{ownerUser.phone ? <><br />{ownerUser.phone}</> : null}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </Card>
              </li>
            )
          })}
        </ul>
      )}

      {rejecting && (
        <ActionModal
          open
          onClose={() => setRejecting(null)}
          title="Reject listing"
          body={<>The owner is notified with your reason and can edit and resubmit <b>“{rejecting.title}”</b>.</>}
          confirmLabel="Reject listing"
          variant="danger"
          noteLabel="Reason shown to the owner"
          noteRequired
          placeholder="e.g. Photos are too dark — please add at least three daylight photos of the room."
          onConfirm={(reason) => {
            setListingStatus(rejecting.id, 'rejected', reason)
            toast({ title: 'Listing rejected', body: 'The owner has been notified.', tone: 'info' })
          }}
        />
      )}
    </div>
  )
}

function TagList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-ink-400">{title}</p>
      {items.length === 0 ? <p className="mt-1 text-sm text-ink-400">None</p> : (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {items.map((i) => <Badge key={i} tone="neutral">{i}</Badge>)}
        </div>
      )}
    </div>
  )
}
