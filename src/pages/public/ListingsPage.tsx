import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowUpDown, Home, Search, SlidersHorizontal, X } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { PROPERTY_TYPES } from '@/lib/status'
import { Button, EmptyState, Input, Label, Modal, Select, Toggle } from '@/components/ui'
import { ListingCard } from '@/components/listings/ListingCard'
import { sortFeaturedFirst, typeLabel } from '@/components/listings/helpers'
import { cn, formatMoney } from '@/lib/utils'
import type { Listing, PropertyType } from '@/types'

type SortKey = 'featured' | 'price_asc' | 'price_desc' | 'newest'

const SORTS: Array<{ value: SortKey; label: string }> = [
  { value: 'featured', label: 'Featured first' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'newest', label: 'Newest' },
]

const FILTER_KEYS = ['q', 'city', 'type', 'min', 'max', 'beds', 'furnished', 'bills', 'stay'] as const
type FilterKey = (typeof FILTER_KEYS)[number]

const num = (v: string | null) => (v && !Number.isNaN(Number(v)) ? Number(v) : undefined)

export default function ListingsPage() {
  const [params, setParams] = useSearchParams()
  const listings = useStore((s) => s.listings)
  const [sheet, setSheet] = useState(false)

  const f = {
    q: params.get('q') ?? '',
    city: params.get('city') ?? '',
    type: params.get('type') ?? '',
    min: params.get('min') ?? '',
    max: params.get('max') ?? '',
    beds: params.get('beds') ?? '',
    furnished: params.get('furnished') === '1',
    bills: params.get('bills') === '1',
    stay: params.get('stay') ?? '',
  }
  const sort = (SORTS.some((s) => s.value === params.get('sort')) ? params.get('sort') : 'featured') as SortKey

  const setParam = (key: FilterKey | 'sort', value: string | boolean) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      const v = typeof value === 'boolean' ? (value ? '1' : '') : value
      if (v && !(key === 'sort' && v === 'featured')) next.set(key, v)
      else next.delete(key)
      return next
    }, { replace: true })
  }
  const clearAll = () => {
    setParams((prev) => {
      const next = new URLSearchParams()
      const s = prev.get('sort')
      if (s) next.set('sort', s)
      return next
    }, { replace: true })
  }

  const active = useMemo(() => listings.filter((l) => l.status === 'active'), [listings])
  const cities = useMemo(() => Array.from(new Set(active.map((l) => l.city))).sort(), [active])

  const results = useMemo(() => {
    const q = f.q.trim().toLowerCase()
    const min = num(f.min), max = num(f.max), beds = num(f.beds), stay = num(f.stay)
    const out = active.filter((l) => {
      if (q && !`${l.title} ${l.description} ${l.area} ${l.city} ${l.amenities.join(' ')}`.toLowerCase().includes(q)) return false
      if (f.city && l.city.toLowerCase() !== f.city.toLowerCase()) return false
      if (f.type && l.type !== f.type) return false
      if (min !== undefined && l.price < min) return false
      if (max !== undefined && l.price > max) return false
      if (beds !== undefined && l.bedrooms < beds) return false
      if (f.furnished && !l.furnished) return false
      if (f.bills && !l.billsIncluded) return false
      if (stay !== undefined && l.minStayMonths > stay) return false
      return true
    })
    const cmp: Record<SortKey, (a: Listing, b: Listing) => number> = {
      featured: sortFeaturedFirst,
      price_asc: (a, b) => a.price - b.price,
      price_desc: (a, b) => b.price - a.price,
      newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
    }
    return out.sort(cmp[sort])
  }, [active, f.q, f.city, f.type, f.min, f.max, f.beds, f.furnished, f.bills, f.stay, sort])

  const currency = active[0]?.currency ?? 'USD'
  const chips: Array<{ key: FilterKey; label: string }> = []
  if (f.q) chips.push({ key: 'q', label: `“${f.q}”` })
  if (f.city) chips.push({ key: 'city', label: f.city })
  if (f.type) chips.push({ key: 'type', label: typeLabel(f.type as PropertyType) })
  if (f.min) chips.push({ key: 'min', label: `Min ${formatMoney(Number(f.min), currency)}` })
  if (f.max) chips.push({ key: 'max', label: `Max ${formatMoney(Number(f.max), currency)}` })
  if (f.beds) chips.push({ key: 'beds', label: `${f.beds}+ bedrooms` })
  if (f.furnished) chips.push({ key: 'furnished', label: 'Furnished' })
  if (f.bills) chips.push({ key: 'bills', label: 'Bills included' })
  if (f.stay) chips.push({ key: 'stay', label: `Min stay ≤ ${f.stay} mo` })

  const panel = (
    <FilterPanel f={f} cities={cities} setParam={setParam} onClear={clearAll} hasFilters={chips.length > 0} />
  )

  return (
    <div className="container-x py-8 sm:py-10">
      <div className="animate-fade-up">
        <h1 className="text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">
          {f.city ? `Homes in ${f.city}` : 'Find your next home'}
        </h1>
        <p className="mt-2 text-ink-500">Every listing is reviewed by our team. Apply once — we verify you and handle the rest.</p>
      </div>

      <div className="mt-8 flex gap-8">
        <aside className="hidden w-72 shrink-0 lg:block">
          <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto rounded-2xl border border-ink-200/80 bg-white p-5 shadow-card no-scrollbar">
            {panel}
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink-500" aria-live="polite">
              <span className="font-semibold text-ink-900">{results.length}</span> {results.length === 1 ? 'home' : 'homes'} available
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="lg:hidden" onClick={() => setSheet(true)}>
                <SlidersHorizontal className="h-4 w-4" /> Filters
                {chips.length > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-brand-700 px-1 text-[11px] text-white">{chips.length}</span>}
              </Button>
              <label className="relative flex items-center">
                <span className="sr-only">Sort by</span>
                <ArrowUpDown className="pointer-events-none absolute left-3 h-4 w-4 text-ink-400" />
                <select value={sort} onChange={(e) => setParam('sort', e.target.value)} className="h-9 appearance-none rounded-xl border border-ink-200 bg-white pl-9 pr-4 text-sm font-medium text-ink-700 hover:bg-ink-50 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25">
                  {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </label>
            </div>
          </div>

          {chips.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {chips.map((c) => (
                <button key={c.key} onClick={() => setParam(c.key, '')} className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-800 ring-1 ring-inset ring-brand-200 transition-colors hover:bg-brand-100" aria-label={`Remove filter ${c.label}`}>
                  {c.label} <X className="h-3 w-3" />
                </button>
              ))}
              <button onClick={clearAll} className="text-xs font-semibold text-ink-500 underline-offset-2 hover:text-ink-900 hover:underline">Clear all</button>
            </div>
          )}

          {results.length === 0 ? (
            <EmptyState
              className="mt-6"
              icon={<Home className="h-6 w-6" />}
              title="No homes match these filters"
              description="Try widening your price range or removing a filter. New homes are reviewed and added every day."
              action={<Button variant="outline" onClick={clearAll}>Clear filters</Button>}
            />
          ) : (
            <div className="mt-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {results.map((l, i) => (
                <div key={l.id} className="animate-fade-up" style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}>
                  <ListingCard listing={l} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Modal
        open={sheet}
        onClose={() => setSheet(false)}
        title="Filters"
        footer={
          <>
            <Button variant="ghost" onClick={clearAll}>Clear all</Button>
            <Button onClick={() => setSheet(false)}>Show {results.length} {results.length === 1 ? 'home' : 'homes'}</Button>
          </>
        }
      >
        {panel}
      </Modal>
    </div>
  )
}

interface FilterValues {
  q: string; city: string; type: string; min: string; max: string; beds: string; furnished: boolean; bills: boolean; stay: string
}

function FilterPanel({ f, cities, setParam, onClear, hasFilters }: {
  f: FilterValues
  cities: string[]
  setParam: (key: FilterKey, value: string | boolean) => void
  onClear: () => void
  hasFilters: boolean
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm font-semibold text-ink-900"><SlidersHorizontal className="h-4 w-4 text-brand-700" /> Filters</p>
        {hasFilters && <button onClick={onClear} className="text-xs font-semibold text-brand-700 hover:underline">Reset</button>}
      </div>

      <Input id="f-q" label="Keyword" placeholder="Balcony, metro, garden…" value={f.q} onChange={(e) => setParam('q', e.target.value)} left={<Search className="h-4 w-4" />} />

      <Select id="f-city" label="City" value={cities.find((c) => c.toLowerCase() === f.city.toLowerCase()) ?? f.city} onChange={(e) => setParam('city', e.target.value)} placeholder="All cities"
        options={[...cities, ...(f.city && !cities.some((c) => c.toLowerCase() === f.city.toLowerCase()) ? [f.city] : [])].map((c) => ({ value: c, label: c }))} />

      <div>
        <Label>Property type</Label>
        <div className="flex flex-wrap gap-2">
          {[{ value: '', label: 'Any' }, ...PROPERTY_TYPES].map((t) => (
            <button key={t.value || 'any'} type="button" onClick={() => setParam('type', t.value)} aria-pressed={f.type === t.value}
              className={cn('rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-inset transition-colors',
                f.type === t.value ? 'bg-brand-700 text-white ring-brand-700' : 'bg-white text-ink-600 ring-ink-200 hover:bg-ink-50')}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label>Monthly rent</Label>
        <div className="grid grid-cols-2 gap-2">
          <Input id="f-min" aria-label="Minimum price" type="number" min={0} step={50} inputMode="numeric" placeholder="Min" value={f.min} onChange={(e) => setParam('min', e.target.value)} />
          <Input id="f-max" aria-label="Maximum price" type="number" min={0} step={50} inputMode="numeric" placeholder="Max" value={f.max} onChange={(e) => setParam('max', e.target.value)} />
        </div>
      </div>

      <div>
        <Label>Bedrooms</Label>
        <div className="grid grid-cols-5 gap-1.5">
          {['', '1', '2', '3', '4'].map((b) => (
            <button key={b || 'any'} type="button" onClick={() => setParam('beds', b)} aria-pressed={f.beds === b}
              className={cn('h-9 rounded-lg text-sm font-semibold ring-1 ring-inset transition-colors',
                f.beds === b ? 'bg-brand-700 text-white ring-brand-700' : 'bg-white text-ink-600 ring-ink-200 hover:bg-ink-50')}>
              {b ? `${b}+` : 'Any'}
            </button>
          ))}
        </div>
      </div>

      <Select id="f-stay" label="Minimum stay" value={f.stay} onChange={(e) => setParam('stay', e.target.value)} placeholder="Any length"
        options={[3, 6, 12, 24].map((m) => ({ value: String(m), label: `${m} months or less` }))} />

      <div className="space-y-3 border-t border-ink-100 pt-4">
        <Toggle checked={f.furnished} onChange={(v) => setParam('furnished', v)} label="Furnished only" />
        <Toggle checked={f.bills} onChange={(v) => setParam('bills', v)} label="Bills included" />
      </div>
    </div>
  )
}
