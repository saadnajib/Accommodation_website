import { Bath, BedDouble, CalendarDays, MapPin, Ruler, Sparkles } from 'lucide-react'
import type { PropertyType } from '@/types'
import { formatDate, formatMoney } from '@/lib/utils'
import { propertyTypeLabel } from './utils'
import { Thumb } from './OwnerUi'

export interface ListingPreviewData {
  title: string
  type: PropertyType | ''
  city: string
  area: string
  price: number
  currency: string
  bedrooms: number
  bathrooms: number
  sizeSqm: number
  availableFrom: string
  billsIncluded: boolean
  featured?: boolean
  image?: string
}

/** Non-interactive replica of the public listing card, used for previews in the owner area. */
export function ListingPreviewCard({ data }: { data: ListingPreviewData }) {
  const available = data.availableFrom
    ? new Date(data.availableFrom) <= new Date() ? 'Available now' : `From ${formatDate(data.availableFrom, { day: 'numeric', month: 'short' })}`
    : 'Date not set'
  return (
    <article className="overflow-hidden rounded-2xl border border-ink-200/80 bg-white shadow-card">
      <div className="relative aspect-[4/3] bg-ink-100">
        <Thumb src={data.image} alt={data.title || 'Listing cover photo'} className="h-full w-full rounded-none" />
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-ink-900/40 to-transparent" />
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {data.featured && (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent-400 px-2.5 py-1 text-xs font-bold text-ink-900 shadow-sm">
              <Sparkles className="h-3 w-3" /> Featured
            </span>
          )}
          {data.type && <span className="rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-ink-700 shadow-sm">{propertyTypeLabel(data.type)}</span>}
        </div>
        <p className="absolute bottom-3 left-3 rounded-lg bg-white/95 px-2.5 py-1 text-sm font-bold text-ink-900 shadow-sm">
          {formatMoney(data.price || 0, data.currency)}<span className="text-xs font-medium text-ink-500"> /month</span>
        </p>
      </div>
      <div className="p-4">
        <p className="flex items-center gap-1 text-xs font-medium text-ink-400">
          <MapPin className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{data.area || 'Area'} · {data.city || 'City'}</span>
        </p>
        <h3 className="mt-1 line-clamp-2 text-base font-semibold leading-snug text-ink-900">{data.title || 'Your listing title'}</h3>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500">
          <span className="inline-flex items-center gap-1"><BedDouble className="h-3.5 w-3.5" /> {data.bedrooms === 0 ? 'Studio' : `${data.bedrooms} bed${data.bedrooms === 1 ? '' : 's'}`}</span>
          <span className="inline-flex items-center gap-1"><Bath className="h-3.5 w-3.5" /> {data.bathrooms} bath</span>
          <span className="inline-flex items-center gap-1"><Ruler className="h-3.5 w-3.5" /> {data.sizeSqm} m²</span>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-ink-500"><CalendarDays className="h-3.5 w-3.5" /> {available}</span>
          {data.billsIncluded && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-800 ring-1 ring-inset ring-brand-200">Bills included</span>}
        </div>
      </div>
    </article>
  )
}
