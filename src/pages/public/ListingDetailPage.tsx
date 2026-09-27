import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, Bath, BedDouble, CalendarDays, Check, ChevronLeft, ChevronRight, Clock, Eye, Heart, Home, Info, Lock, MapPin,
  Maximize2, Receipt, Ruler, Share2, ShieldCheck, Sofa, Sparkles, Wallet,
} from 'lucide-react'
import { useCurrentUser, useIsSaved, useListing, useLoad, useStore, useUser, useUserRating } from '@/store/useStore'
import { useShallow } from 'zustand/react/shallow'
import type { Listing } from '@/types'
import { computeFees } from '@/lib/fees'
import { Avatar, Badge, Button, Card, EmptyState, ListingStatusBadge, Modal, Rating, VerificationBadge } from '@/components/ui'
import { ListingCard } from '@/components/listings/ListingCard'
import { bedsLabel, publicName, typeLabel } from '@/components/listings/helpers'
import { cn, formatDate, formatMoney } from '@/lib/utils'

export default function ListingDetailPage() {
  const { id } = useParams()
  const listing = useListing(id)
  const user = useCurrentUser()
  const owner = useUser(listing?.ownerId)
  const rating = useUserRating(listing?.ownerId)
  const saved = useIsSaved(id ?? '')
  const fees = useStore((s) => s.fees)
  const fetchListing = useStore((s) => s.fetchListing)
  const toggleSaved = useStore((s) => s.toggleSaved)
  // The API counts a view once per session on GET.
  const { loading } = useLoad(() => (id ? fetchListing(id) : Promise.resolve(null)), [id, fetchListing])
  const similar = useStore(useShallow((s) => (id ? s.similarByListing[id] ?? [] : []).map((x) => s.listingsById[x]).filter((l): l is Listing => !!l).slice(0, 3)))
  const toast = useStore((s) => s.toast)
  const nav = useNavigate()
  const loc = useLocation()

  const [imgIdx, setImgIdx] = useState(0)
  const [lightbox, setLightbox] = useState(false)

  // Reset gallery when navigating between listings.
  const [lastId, setLastId] = useState(id)
  if (lastId !== id) { setLastId(id); setImgIdx(0) }


  if (!listing && loading) {
    return <div className="container-x flex min-h-[60vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-200 border-t-brand-700" aria-label="Loading" /></div>
  }

  if (!listing) {
    return (
      <div className="container-x py-16">
        <EmptyState
          icon={<Home className="h-6 w-6" />}
          title="This home isn’t available"
          description="It may have been rented, paused by the owner, or the link is incorrect. There are plenty of other verified homes waiting."
          action={<Button onClick={() => nav('/listings')}>Browse homes</Button>}
        />
      </div>
    )
  }

  const images = listing.images
  const img = images[imgIdx] ?? images[0]
  const { renterFee } = computeFees(listing.price, fees, { hasTenantPass: user?.hasTenantPass })
  const baseFee = computeFees(listing.price, fees).renterFee
  const money = (n: number) => formatMoney(n, listing.currency)

  const onApply = () => {
    if (!user) { nav('/login', { state: { from: `/apply/${listing.id}` } }); return }
    if (user.role === 'renter') nav(`/apply/${listing.id}`)
  }
  const onSave = () => {
    if (!user) { nav('/login', { state: { from: loc.pathname } }); return }
    if (user.role !== 'renter') { toast({ title: 'Saving homes is for renter accounts', tone: 'info' }); return }
    toggleSaved(listing.id)
      .then(() => toast({ title: saved ? 'Removed from saved homes' : 'Saved to your homes', tone: saved ? 'info' : 'success' }))
      .catch(() => {})
  }
  const onShare = async () => {
    const url = window.location.href
    try {
      if (navigator.share) { await navigator.share({ title: listing.title, url }); return }
      await navigator.clipboard.writeText(url)
      toast({ title: 'Link copied', body: 'Share it with a friend or flatmate.', tone: 'success' })
    } catch {
      /* user dismissed share sheet */
    }
  }
  const step = (d: number) => setImgIdx((i) => (i + d + images.length) % images.length)

  const applyHint = !user
    ? 'Sign in or create a free account to apply.'
    : user.role !== 'renter'
      ? user.id === listing.ownerId ? 'This is your listing.' : `Applications are for renter accounts. You are signed in as ${user.role}.`
      : listing.status !== 'active' ? 'This listing is not accepting applications right now.' : null
  const canApply = !user || (user.role === 'renter' && listing.status === 'active')
  const memberSince = owner ? formatDate(owner.createdAt, { month: 'long', year: 'numeric' }) : null

  return (
    <div className="container-x pb-28 pt-6 sm:pt-8 lg:pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/listings" className="inline-flex items-center gap-1 text-sm font-medium text-ink-500 hover:text-ink-900"><ArrowLeft className="h-4 w-4" /> All homes</Link>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onShare}><Share2 className="h-4 w-4" /> Share</Button>
          <Button variant="outline" size="sm" onClick={onSave} aria-pressed={saved}>
            <Heart className={cn('h-4 w-4', saved && 'fill-red-500 text-red-500')} /> {saved ? 'Saved' : 'Save'}
          </Button>
        </div>
      </div>

      {listing.status !== 'active' && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Preview only — this listing is <strong>{listing.status.replace('_', ' ')}</strong> and not visible to renters.</span>
        </div>
      )}

      {/* Gallery */}
      <div className="mt-4 grid gap-3 animate-fade-up lg:grid-cols-[1fr_180px]">
        <div className="group relative overflow-hidden rounded-2xl bg-ink-100">
          {img ? (
            <button type="button" onClick={() => setLightbox(true)} className="block w-full" aria-label="Open photo gallery">
              <img src={img} alt={`${listing.title} — photo ${imgIdx + 1}`} className="aspect-[16/10] w-full object-cover transition-transform duration-500 group-hover:scale-[1.02] lg:aspect-[16/9]" />
            </button>
          ) : (
            <div className="grid aspect-[16/9] place-items-center text-ink-300"><Home className="h-10 w-10" /></div>
          )}
          <div className="pointer-events-none absolute left-3 top-3 flex gap-1.5">
            {listing.featured && <span className="inline-flex items-center gap-1 rounded-full bg-accent-400 px-2.5 py-1 text-xs font-bold text-ink-900 shadow-sm"><Sparkles className="h-3 w-3" /> Featured</span>}
          </div>
          {images.length > 1 && (
            <>
              <button type="button" onClick={() => step(-1)} aria-label="Previous photo" className="absolute left-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-ink-800 shadow opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"><ChevronLeft className="h-5 w-5" /></button>
              <button type="button" onClick={() => step(1)} aria-label="Next photo" className="absolute right-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-ink-800 shadow opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"><ChevronRight className="h-5 w-5" /></button>
            </>
          )}
          {img && (
            <span className="pointer-events-none absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-lg bg-ink-900/70 px-2 py-1 text-xs font-medium text-white">
              <Maximize2 className="h-3 w-3" /> {imgIdx + 1} / {images.length}
            </span>
          )}
        </div>
        {images.length > 1 && (
          <div className="flex gap-2 overflow-x-auto no-scrollbar lg:flex-col lg:overflow-visible">
            {images.map((src, i) => (
              <button key={src + i} type="button" onClick={() => setImgIdx(i)} aria-label={`Show photo ${i + 1}`} aria-current={i === imgIdx}
                className={cn('shrink-0 overflow-hidden rounded-xl ring-2 transition-all', i === imgIdx ? 'ring-brand-600' : 'ring-transparent opacity-70 hover:opacity-100')}>
                <img src={src} alt={`${listing.title} thumbnail ${i + 1}`} loading="lazy" className="h-16 w-24 object-cover sm:h-20 sm:w-28 lg:h-24 lg:w-full" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
        {/* Main */}
        <div className="min-w-0 space-y-8">
          <div className="animate-fade-up">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="brand">{typeLabel(listing.type)}</Badge>
              {listing.billsIncluded && <Badge tone="success">Bills included</Badge>}
              {listing.furnished && <Badge>Furnished</Badge>}
              {listing.status !== 'active' && <ListingStatusBadge status={listing.status} />}
            </div>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">{listing.title}</h1>
            <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-500">
              <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4 text-brand-700" /> {listing.area}, {listing.city}</span>
              <span className="inline-flex items-center gap-1"><Eye className="h-4 w-4" /> {listing.views.toLocaleString()} views</span>
              <span className="inline-flex items-center gap-1"><Clock className="h-4 w-4" /> Listed {formatDate(listing.createdAt)}</span>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Fact icon={Home} label="Type" value={typeLabel(listing.type)} />
            <Fact icon={BedDouble} label="Bedrooms" value={bedsLabel(listing.bedrooms)} />
            <Fact icon={Bath} label="Bathrooms" value={String(listing.bathrooms)} />
            <Fact icon={Ruler} label="Size" value={`${listing.sizeSqm} m²`} />
            <Fact icon={Sofa} label="Furnished" value={listing.furnished ? 'Yes' : 'No'} />
          </div>

          <section>
            <h2 className="text-xl font-semibold text-ink-900">About this home</h2>
            <p className="mt-3 whitespace-pre-line leading-relaxed text-ink-600">{listing.description}</p>
          </section>

          {listing.amenities.length > 0 && (
            <section>
              <h2 className="text-xl font-semibold text-ink-900">Amenities</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {listing.amenities.map((a) => (
                  <span key={a} className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3 py-1.5 text-sm text-ink-700"><Check className="h-3.5 w-3.5 text-brand-600" /> {a}</span>
                ))}
              </div>
            </section>
          )}

          {listing.houseRules.length > 0 && (
            <section>
              <h2 className="text-xl font-semibold text-ink-900">House rules</h2>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {listing.houseRules.map((r) => (
                  <li key={r} className="flex items-center gap-2 rounded-xl bg-white px-3 py-2.5 text-sm text-ink-700 ring-1 ring-ink-200"><ShieldCheck className="h-4 w-4 text-ink-400" /> {r}</li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h2 className="text-xl font-semibold text-ink-900">Location</h2>
            <div className="mt-3 overflow-hidden rounded-2xl border border-ink-200 bg-gradient-to-br from-brand-50 to-white">
              <div className="flex items-center gap-4 p-5">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white text-brand-700 shadow-card"><MapPin className="h-6 w-6" /></span>
                <div>
                  <p className="font-semibold text-ink-900">{listing.area}, {listing.city}</p>
                  <p className="mt-0.5 flex items-start gap-1.5 text-sm text-ink-500"><Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Exact address and contact details are shared after both sides confirm via StayBridge.</p>
                </div>
              </div>
            </div>
          </section>

          {/* Owner */}
          <Card className="p-5 sm:p-6">
            <h2 className="text-xl font-semibold text-ink-900">About the owner</h2>
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <Avatar name={publicName(owner)} src={owner?.avatarUrl} size="lg" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-lg font-semibold text-ink-900">{publicName(owner)}</p>
                  {owner && <VerificationBadge status={owner.verification} />}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-500">
                  {rating.count > 0 ? <Rating value={rating.avg} count={rating.count} /> : <span>No reviews yet</span>}
                  {memberSince && <span>Member since {memberSince}</span>}
                </div>
              </div>
            </div>
            {owner?.bio && <p className="mt-4 text-sm leading-relaxed text-ink-600">{owner.bio}</p>}
            <div className="mt-4 flex items-start gap-2 rounded-xl bg-ink-50 px-3 py-2.5 text-xs text-ink-500">
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Exact address and contact details are shared after both sides confirm via StayBridge. Until then, all communication goes through our team.
            </div>
          </Card>
        </div>

        {/* Price box */}
        <aside className="lg:row-span-1">
          <Card className="p-5 sm:p-6 lg:sticky lg:top-24">
            <p className="text-3xl font-bold text-ink-900">{money(listing.price)}<span className="text-base font-medium text-ink-400"> / month</span></p>
            <dl className="mt-5 divide-y divide-ink-100 text-sm">
              <Row icon={Wallet} label="Deposit" value={money(listing.deposit)} />
              <Row icon={Receipt} label="Bills" value={listing.billsIncluded ? 'Included' : 'Not included'} />
              <Row icon={Clock} label="Minimum stay" value={`${listing.minStayMonths} month${listing.minStayMonths === 1 ? '' : 's'}`} />
              <Row icon={CalendarDays} label="Available from" value={new Date(listing.availableFrom) <= new Date() ? 'Now' : formatDate(listing.availableFrom)} />
            </dl>

            <Button full size="lg" className="mt-5" onClick={onApply} disabled={!canApply}>Apply to rent</Button>
            {applyHint && <p className="mt-2 text-center text-xs text-ink-400">{applyHint}</p>}

            <div className="mt-5 rounded-xl bg-brand-50 p-4">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="font-medium text-brand-900">Est. StayBridge service fee</span>
                <span className="font-bold text-brand-900">
                  {user?.hasTenantPass && renterFee !== baseFee && <span className="mr-1.5 text-xs font-medium text-brand-700/70 line-through">{money(baseFee)}</span>}
                  {money(renterFee)}
                </span>
              </div>
              <p className="mt-1 text-xs text-brand-800/80">Only charged if the owner accepts you.</p>
              {user?.hasTenantPass
                ? <p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand-800"><Sparkles className="h-3 w-3" /> Tenant Pass discount applied</p>
                : <Link to="/pricing" className="mt-2 inline-block text-xs font-semibold text-brand-700 hover:underline">Save 20% with a Tenant Pass</Link>}
            </div>

            <ul className="mt-5 space-y-2 text-xs text-ink-500">
              <li className="flex items-start gap-2"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" /> Listing reviewed by the StayBridge team</li>
              <li className="flex items-start gap-2"><Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" /> Contact unlocks only after both sides commit</li>
            </ul>
          </Card>
        </aside>
      </div>

      {similar.length > 0 && (
        <section className="mt-16">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-2xl font-bold text-ink-900">Similar homes in {listing.city}</h2>
            <Link to={`/listings?city=${encodeURIComponent(listing.city)}`} className="text-sm font-semibold text-brand-700 hover:underline">See all in {listing.city}</Link>
          </div>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {similar.map((l) => <ListingCard key={l.id} listing={l} />)}
          </div>
        </section>
      )}

      {/* Mobile apply bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-lg font-bold text-ink-900">{money(listing.price)}<span className="text-sm font-medium text-ink-400"> /mo</span></p>
            <p className="truncate text-xs text-ink-400">Fee {money(renterFee)} · only if accepted</p>
          </div>
          <Button onClick={onApply} disabled={!canApply}>Apply to rent</Button>
        </div>
      </div>

      <Modal open={lightbox} onClose={() => setLightbox(false)} title={`${imgIdx + 1} / ${images.length}`} size="lg">
        {img && (
          <div className="relative">
            <img src={img} alt={`${listing.title} — photo ${imgIdx + 1}`} className="max-h-[70vh] w-full rounded-xl object-contain" />
            {images.length > 1 && (
              <div className="mt-3 flex justify-center gap-2">
                <Button variant="outline" size="sm" onClick={() => step(-1)}><ChevronLeft className="h-4 w-4" /> Previous</Button>
                <Button variant="outline" size="sm" onClick={() => step(1)}>Next <ChevronRight className="h-4 w-4" /></Button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}

function Fact({ icon: Icon, label, value }: { icon: typeof Home; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-ink-200 bg-white p-3">
      <Icon className="h-4 w-4 text-brand-700" />
      <p className="mt-2 text-xs text-ink-400">{label}</p>
      <p className="text-sm font-semibold text-ink-900">{value}</p>
    </div>
  )
}

function Row({ icon: Icon, label, value }: { icon: typeof Home; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <dt className="inline-flex items-center gap-2 text-ink-500"><Icon className="h-4 w-4 text-ink-400" /> {label}</dt>
      <dd className="font-semibold text-ink-900">{value}</dd>
    </div>
  )
}
