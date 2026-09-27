import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle, ArrowRight, Bell, Building2, CheckCircle2, Clock, CreditCard, Eye, MessageSquare, Plus, Sparkles, UserCheck, Wallet,
} from 'lucide-react'
import { coverImage, useCurrentUser, useLoad, useMyApplications, useMyListings, useStore } from '@/store/useStore'
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, PageHeader, Select, Stat } from '@/components/ui'
import { ButtonLink, Thumb } from '@/components/owner/OwnerUi'
import { FeatureListingModal } from '@/components/owner/FeatureListingModal'
import { greeting } from '@/components/owner/utils'
import { cn, formatMoney, timeAgo } from '@/lib/utils'
import type { Listing } from '@/types'

interface ActionItem {
  key: string
  icon: ReactNode
  tone: string
  title: ReactNode
  body: ReactNode
  cta?: { label: string; to: string; variant?: 'primary' | 'accent' | 'outline' }
}

export default function OwnerOverviewPage() {
  const me = useCurrentUser()
  const listings = useMyListings()
  const apps = useMyApplications()
  const listingById = useStore((s) => s.listingsById)
  const summaries = useStore((s) => s.listingSummaries)
  const userById = useStore((s) => s.usersById)
  const verifyingCounts = useStore((s) => s.verifyingCounts)
  const notifications = useStore((s) => s.notifications).slice(0, 5)
  const fees = useStore((s) => s.fees)
  const markRead = useStore((s) => s.markNotificationRead)
  const fetchMyListings = useStore((s) => s.fetchMyListings)
  const fetchMyApplications = useStore((s) => s.fetchMyApplications)
  const fetchNotifications = useStore((s) => s.fetchNotifications)
  const { loading } = useLoad(() => Promise.all([fetchMyListings(), fetchMyApplications(), fetchNotifications()]), [fetchMyListings, fetchMyApplications, fetchNotifications])
  const [featuring, setFeaturing] = useState<Listing | null>(null)
  const [upsellId, setUpsellId] = useState('')

  const live = listings.filter((l) => l.status === 'active')
  const totalViews = listings.reduce((sum, l) => sum + l.views, 0)
  const waiting = apps.filter((a) => a.status === 'sent_to_owner')
  const placed = apps.filter((a) => a.status === 'completed')
  const feesPaid = apps.filter((a) => a.ownerFeePaid).reduce((sum, a) => sum + (a.ownerFee ?? 0), 0)
  // Owners never receive applications still being verified — only a count per listing.
  const verifying = Object.values(verifyingCounts).reduce((sum, n) => sum + n, 0)
  const upsellCandidates = live.filter((l) => !l.featured)
  const upsellListing = upsellCandidates.find((l) => l.id === upsellId) ?? upsellCandidates[0]

  const actions: ActionItem[] = []
  for (const a of apps) {
    const l = listingById[a.listingId] ?? summaries[a.listingId]
    // The API already anonymises the renter's name until contact is unlocked.
    const name = userById[a.renterId]?.name ?? 'StayBridge renter'
    const title = l?.title ?? 'your listing'
    if (a.status === 'sent_to_owner') {
      actions.push({
        key: a.id, icon: <UserCheck className="h-5 w-5" />, tone: 'bg-sky-50 text-sky-700',
        title: <>Verified applicant waiting: {name}</>, body: <>Offered {formatMoney(a.proposedPrice, l?.currency)} /month for “{title}”.</>,
        cta: { label: 'Review applicant', to: `/owner/applications/${a.id}` },
      })
    } else if (a.status === 'awaiting_fees' && !a.ownerFeePaid) {
      actions.push({
        key: a.id, icon: <CreditCard className="h-5 w-5" />, tone: 'bg-amber-50 text-amber-700',
        title: <>Pay the success fee to unlock contact</>, body: <>You accepted {name} for “{title}”. Fee: {formatMoney(a.ownerFee ?? 0, l?.currency ?? fees.currency)}.</>,
        cta: { label: 'Pay success fee', to: `/owner/applications/${a.id}`, variant: 'accent' },
      })
    } else if (a.status === 'contact_unlocked') {
      actions.push({
        key: a.id, icon: <MessageSquare className="h-5 w-5" />, tone: 'bg-emerald-50 text-emerald-700',
        title: <>Contact unlocked with {name}</>, body: <>Arrange a viewing and sign the contract for “{title}”.</>,
        cta: { label: 'Message tenant', to: `/messages/${a.id}`, variant: 'outline' },
      })
    }
  }
  for (const l of listings) {
    if (l.status === 'pending_review') {
      actions.push({
        key: l.id, icon: <Clock className="h-5 w-5" />, tone: 'bg-ink-100 text-ink-600',
        title: <>“{l.title}” is being reviewed</>, body: <>Our team usually approves new listings within 24 hours.</>,
        cta: { label: 'View', to: `/owner/listings/${l.id}/edit`, variant: 'outline' },
      })
    } else if (l.status === 'rejected') {
      actions.push({
        key: l.id, icon: <AlertTriangle className="h-5 w-5" />, tone: 'bg-red-50 text-red-700',
        title: <>“{l.title}” needs changes</>, body: <>{l.rejectionReason ?? 'StayBridge could not approve this listing yet.'}</>,
        cta: { label: 'Edit listing', to: `/owner/listings/${l.id}/edit` },
      })
    }
  }

  const firstName = me?.name.split(' ')[0] ?? 'there'

  return (
    <div>
      <PageHeader
        title={`${greeting()}, ${firstName}`}
        description="Here's how your homes are doing on StayBridge."
        action={<ButtonLink to="/owner/listings/new"><Plus className="h-4 w-4" /> Post a new listing</ButtonLink>}
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-5">
        <Stat label="Live listings" value={live.length} sub={`${listings.length} total`} icon={<Building2 className="h-5 w-5" />} />
        <Stat label="Total views" value={totalViews.toLocaleString('en-US')} sub="across all listings" icon={<Eye className="h-5 w-5" />} tone="ink" />
        <Stat label="Awaiting decision" value={waiting.length} sub={verifying ? `${verifying} being verified` : 'verified applicants'} icon={<UserCheck className="h-5 w-5" />} tone="accent" />
        <Stat label="Placements" value={placed.length} sub="tenants placed" icon={<CheckCircle2 className="h-5 w-5" />} tone="green" />
        <div className="col-span-2 xl:col-span-1">
          <Stat label="Fees paid to date" value={formatMoney(feesPaid, fees.currency)} sub="success fees" icon={<Wallet className="h-5 w-5" />} tone="ink" />
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <Card>
            <CardHeader
              title={<span className="flex items-center gap-2">Action required {actions.length > 0 && <Badge tone="warning">{actions.length}</Badge>}</span>}
              description="Things that need your attention to keep deals moving."
            />
            {actions.length === 0 ? (
              <CardBody>
                <div className="flex items-center gap-3 rounded-xl bg-emerald-50 px-4 py-4 text-sm text-emerald-800">
                  <CheckCircle2 className="h-5 w-5 shrink-0" />
                  You're all caught up. We'll notify you as soon as a verified applicant is ready.
                </div>
              </CardBody>
            ) : (
              <ul className="divide-y divide-ink-100">
                {actions.map((it) => (
                  <li key={it.key} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <span className={cn('shrink-0 rounded-xl p-2.5', it.tone)}>{it.icon}</span>
                      <div className="min-w-0">
                        <p className="font-semibold text-ink-900">{it.title}</p>
                        <p className="mt-0.5 text-sm text-ink-500">{it.body}</p>
                      </div>
                    </div>
                    {it.cta && (
                      <ButtonLink to={it.cta.to} size="sm" variant={it.cta.variant ?? 'primary'} className="self-start sm:self-center">
                        {it.cta.label} <ArrowRight className="h-4 w-4" />
                      </ButtonLink>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Your listings"
              action={<Link to="/owner/listings" className="text-sm font-semibold text-brand-700 hover:text-brand-800">Manage all</Link>}
            />
            {listings.length === 0 && loading ? (
              <CardBody><div className="space-y-2">{[0, 1].map((i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-ink-100" />)}</div></CardBody>
            ) : listings.length === 0 ? (
              <CardBody>
                <EmptyState
                  icon={<Building2 className="h-6 w-6" />}
                  title="No listings yet"
                  description="Post your first home and we'll bring you verified tenants."
                  action={<ButtonLink to="/owner/listings/new"><Plus className="h-4 w-4" /> Post your first listing</ButtonLink>}
                />
              </CardBody>
            ) : (
              <ul className="divide-y divide-ink-100">
                {listings.slice(0, 4).map((l) => (
                  <li key={l.id}>
                    <Link to={`/owner/listings/${l.id}/edit`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-ink-50">
                      <Thumb src={coverImage(l)} alt={l.title} className="h-12 w-16" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink-900">{l.title}</p>
                        <p className="truncate text-xs text-ink-400">{l.area} · {l.city} · {formatMoney(l.price, l.currency)}/mo</p>
                      </div>
                      <span className="hidden items-center gap-1 text-xs text-ink-400 sm:inline-flex"><Eye className="h-3.5 w-3.5" /> {l.views}</span>
                      {l.featured && <Sparkles className="h-4 w-4 text-amber-500" aria-label="Featured" />}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          {upsellListing && (
            <Card className="overflow-hidden border-amber-200 bg-gradient-to-br from-amber-50 via-white to-white">
              <CardBody className="py-5">
                <div className="flex items-center gap-2">
                  <span className="rounded-xl bg-accent-400 p-2 text-ink-900"><Sparkles className="h-5 w-5" /></span>
                  <h3 className="text-lg font-semibold text-ink-900">Get seen first</h3>
                </div>
                <p className="mt-2 text-sm text-ink-600">
                  Feature a listing for 30 days: top of search, a spot on the home page and a Featured badge — only{' '}
                  <span className="font-semibold text-ink-900">{formatMoney(fees.featuredListingPrice, fees.currency)}</span>.
                </p>
                {upsellCandidates.length > 1 && (
                  <Select
                    className="mt-3"
                    label="Listing to feature"
                    name="upsell-listing"
                    value={upsellListing.id}
                    onChange={(e) => setUpsellId(e.target.value)}
                    options={upsellCandidates.map((l) => ({ value: l.id, label: l.title }))}
                  />
                )}
                <Button variant="accent" full className="mt-4" onClick={() => setFeaturing(upsellListing)}>
                  <Sparkles className="h-4 w-4" /> Feature {upsellCandidates.length > 1 ? 'this listing' : `“${upsellListing.title.slice(0, 24)}${upsellListing.title.length > 24 ? '…' : ''}”`}
                </Button>
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader title={<span className="flex items-center gap-2"><Bell className="h-4 w-4 text-ink-400" /> Recent notifications</span>} />
            {notifications.length === 0 ? (
              <CardBody><p className="text-sm text-ink-400">No notifications yet.</p></CardBody>
            ) : (
              <ul className="divide-y divide-ink-100">
                {notifications.map((n) => {
                  const inner = (
                    <div className="flex gap-3">
                      <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.read ? 'bg-ink-200' : 'bg-brand-600')} />
                      <div className="min-w-0">
                        <p className={cn('text-sm', n.read ? 'text-ink-600' : 'font-semibold text-ink-900')}>{n.title}</p>
                        <p className="mt-0.5 line-clamp-2 text-xs text-ink-500">{n.body}</p>
                        <p className="mt-1 text-[11px] text-ink-400">{timeAgo(n.at)}</p>
                      </div>
                    </div>
                  )
                  return (
                    <li key={n.id}>
                      {n.link ? (
                        <Link to={n.link} onClick={() => void markRead(n.id)} className="block px-5 py-3 transition-colors hover:bg-ink-50">{inner}</Link>
                      ) : (
                        <div className="px-5 py-3">{inner}</div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>

          <div className="rounded-2xl bg-ink-900 text-white shadow-card">
            <div className="px-5 py-5">
              <h3 className="text-lg font-semibold">How StayBridge works for owners</h3>
              <ol className="mt-3 space-y-2 text-sm text-ink-200">
                <li><span className="font-semibold text-white">1.</span> We verify every applicant's ID, income and profile.</li>
                <li><span className="font-semibold text-white">2.</span> You only see verified applicants and decide.</li>
                <li><span className="font-semibold text-white">3.</span> Pay the success fee only when you accept a tenant.</li>
              </ol>
            </div>
          </div>
        </div>
      </div>

      <FeatureListingModal listing={featuring} onClose={() => setFeaturing(null)} />
    </div>
  )
}
