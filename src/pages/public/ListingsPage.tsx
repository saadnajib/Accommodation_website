import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowUpDown, ChevronLeft, ChevronRight, Home, Loader2, Search, SlidersHorizontal, X } from 'lucide-react'
import { useListingQuery, type ListingQuery } from '@/store/useStore'
import { PROPERTY_TYPES } from '@/lib/status'
import { Button, EmptyState, Input, Label, Modal, Select, Toggle } from '@/components/ui'
import { ListingCard } from '@/components/listings/ListingCard'
import { typeLabel } from '@/components/listings/helpers'
import { cn, formatMoney } from '@/lib/utils'
import type { PropertyType } from '@/types'

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
const PAGE_SIZE = 24

/** Value that only updates after `ms` without changes (for free-text filters). */
function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), ms)
    return () => window.clearTimeout(t)
  }, [value, ms])
  return v
}

export default function ListingsPage() {
  const [params, setParams] = useSearchParams()
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
  const page = Math.max(1, num(params.get('page')) ?? 1)

  const setParam = (key: FilterKey | 'sort' | 'page', value: string | boolean) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      if (key !== 'page') next.delete('page')
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

  // Filtering, sorting and paging happen server-side; typed fields are debounced.
  const q = useDebounced(f.q.trim())
  const min = useDebounced(f.min)
  const max = useDebounced(f.max)
  const query = useMemo<ListingQuery>(() => ({
    q: q || undefined, city: f.city || undefined, type: f.type || undefined,
    min: num(min), max: num(max), beds: num(f.beds), stay: num(f.stay),
    furnished: f.furnished || undefined, bills: f.bills || undefined,
    sort, page, limit: PAGE_SIZE,
  }), [q, f.city, f.type, min, max, f.beds, f.stay, f.furnished, f.bills, sort, page])
  const { items: results, total, cities, loading, loaded, error } = useListingQuery(query)
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const currency = results[0]?.currency ?? 'USD'
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
              <span className="font-semibold text-ink-900">{total}</span> {total === 1 ? 'home' : 'homes'} available
              {loading && <Loader2 className="ml-2 inline h-4 w-4 animate-spin text-ink-400" aria-label="Loading" />}
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

          {!loaded && loading ? (
            <div className="mt-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-3" aria-busy>
              {Array.from({ length: 6 }, (_, i) => <div key={i} className="aspect-[4/5] animate-pulse rounded-2xl bg-ink-100" />)}
            </div>
          ) : !loaded && error ? (
            <EmptyState className="mt-6" icon={<Home className="h-6 w-6" />} title="We couldn’t load homes" description={error}
              action={<Button variant="outline" onClick={() => window.location.reload()}>Try again</Button>} />
          ) : results.length === 0 ? (
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

          {pages > 1 && (
            <nav className="mt-8 flex items-center justify-center gap-3" aria-label="Pagination">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => { setParam('page', String(page - 1)); window.scrollTo({ top: 0 }) }}>
                <ChevronLeft className="h-4 w-4" /> Previous
              </Button>
              <span className="text-sm text-ink-500">Page {page} of {pages}</span>
              <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => { setParam('page', String(page + 1)); window.scrollTo({ top: 0 }) }}>
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </nav>
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
            <Button onClick={() => setSheet(false)}>Show {total} {total === 1 ? 'home' : 'homes'}</Button>
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
