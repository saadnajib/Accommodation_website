import { Link, useLocation, useNavigate } from 'react-router-dom'
import { BedDouble, Bath, CalendarDays, Heart, MapPin, Ruler, Sparkles } from 'lucide-react'
import type { Listing } from '@/types'
import { useIsSaved, useStore } from '@/store/useStore'
import { cn, formatDate, formatMoney } from '@/lib/utils'
import { bedsLabel, typeLabel } from './helpers'

export function ListingCard({ listing }: { listing: Listing }) {
  const saved = useIsSaved(listing.id)
  const role = useStore((s) => s.me?.role)
  const toggleSaved = useStore((s) => s.toggleSaved)
  const toast = useStore((s) => s.toast)
  const nav = useNavigate()
  const loc = useLocation()

  const onSave = () => {
    if (!role) {
      nav('/login', { state: { from: loc.pathname + loc.search } })
      return
    }
    if (role !== 'renter') {
      toast({ title: 'Saving homes is for renter accounts', tone: 'info' })
      return
    }
    toggleSaved(listing.id)
      .then(() => toast({ title: saved ? 'Removed from saved homes' : 'Saved to your homes', tone: saved ? 'info' : 'success' }))
      .catch(() => {})
  }

  const available = new Date(listing.availableFrom) <= new Date() ? 'Available now' : `From ${formatDate(listing.availableFrom, { day: 'numeric', month: 'short' })}`

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-ink-200/80 bg-white shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lift">
      <Link to={`/listings/${listing.id}`} className="flex h-full flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 rounded-2xl">
        <div className="relative aspect-[4/3] overflow-hidden bg-ink-100">
          {listing.images[0] ? (
            <img src={listing.images[0]} alt={listing.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
          ) : (
            <div className="grid h-full w-full place-items-center text-ink-300"><MapPin className="h-8 w-8" /></div>
          )}
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-ink-900/40 to-transparent" />
          <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
            {listing.featured && (
              <span className="inline-flex items-center gap-1 rounded-full bg-accent-400 px-2.5 py-1 text-xs font-bold text-ink-900 shadow-sm">
                <Sparkles className="h-3 w-3" /> Featured
              </span>
            )}
            <span className="rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-ink-700 shadow-sm backdrop-blur">{typeLabel(listing.type)}</span>
          </div>
          <p className="absolute bottom-3 left-3 rounded-lg bg-white/95 px-2.5 py-1 text-sm font-bold text-ink-900 shadow-sm">
            {formatMoney(listing.price, listing.currency)}<span className="text-xs font-medium text-ink-500"> /month</span>
          </p>
        </div>
        <div className="flex flex-1 flex-col p-4">
          <p className="flex items-center gap-1 text-xs font-medium text-ink-400">
            <MapPin className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{listing.area} · {listing.city}</span>
          </p>
          <h3 className="mt-1 line-clamp-2 text-base font-semibold leading-snug text-ink-900 transition-colors group-hover:text-brand-800">{listing.title}</h3>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500">
            <span className="inline-flex items-center gap-1"><BedDouble className="h-3.5 w-3.5" /> {bedsLabel(listing.bedrooms)}</span>
            <span className="inline-flex items-center gap-1"><Bath className="h-3.5 w-3.5" /> {listing.bathrooms} bath</span>
            <span className="inline-flex items-center gap-1"><Ruler className="h-3.5 w-3.5" /> {listing.sizeSqm} m²</span>
          </div>
          <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-4">
            <span className="inline-flex items-center gap-1 text-xs font-medium text-ink-500"><CalendarDays className="h-3.5 w-3.5" /> {available}</span>
            {listing.billsIncluded && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-800 ring-1 ring-inset ring-brand-200">Bills included</span>}
          </div>
        </div>
      </Link>
      <button
        type="button"
        onClick={onSave}
        aria-label={saved ? 'Remove from saved homes' : 'Save home'}
        aria-pressed={saved}
        className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/95 text-ink-700 shadow-sm backdrop-blur transition-transform hover:scale-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        <Heart className={cn('h-4.5 w-4.5 transition-colors', saved ? 'fill-red-500 text-red-500' : 'text-ink-700')} />
      </button>
    </article>
  )
}
