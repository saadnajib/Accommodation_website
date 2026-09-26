import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, MapPin } from 'lucide-react'
import type { Application } from '@/types'
import { ApplicationStatusBadge } from '@/components/ui'
import { useListing } from '@/store/useStore'
import { formatMoney, timeAgo } from '@/lib/utils'

/** Compact clickable row card for a renter's application. */
export function ApplicationRow({ application, extra }: { application: Application; extra?: ReactNode }) {
  const listing = useListing(application.listingId)
  return (
    <div className="group rounded-2xl border border-ink-200/80 bg-white shadow-card transition-all hover:-translate-y-0.5 hover:shadow-lift">
      <Link to={`/dashboard/applications/${application.id}`} className="flex items-center gap-3 p-3 sm:gap-4 sm:p-4 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-ink-100 sm:h-20 sm:w-24">
          {listing?.images[0] && <img src={listing.images[0]} alt={listing.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="min-w-0 truncate text-sm font-semibold text-ink-900 group-hover:text-brand-800 sm:text-base">{listing?.title ?? 'Listing removed'}</p>
          </div>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-400">
            <MapPin className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{listing ? `${listing.area}, ${listing.city}` : '—'}</span>
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <ApplicationStatusBadge status={application.status} />
            <span className="text-sm font-semibold text-ink-900">{formatMoney(application.agreedPrice, listing?.currency)}<span className="text-xs font-normal text-ink-400">/mo</span></span>
            <span className="text-xs text-ink-400">Submitted {timeAgo(application.createdAt)}</span>
          </div>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-ink-300 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-700" />
      </Link>
      {extra && <div className="border-t border-ink-100 px-3 py-2.5 sm:px-4">{extra}</div>}
    </div>
  )
}
