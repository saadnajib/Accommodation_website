import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight, BadgeCheck, Building2, FileSearch, HandCoins, KeyRound, Lock, MapPin, Quote, Search, ShieldCheck,
  Sparkles, Star, UserCheck, Users,
} from 'lucide-react'
import { useStore } from '@/store/useStore'
import { PROPERTY_TYPES } from '@/lib/status'
import { Button, Card, SectionHeading } from '@/components/ui'
import { ListingCard } from '@/components/listings/ListingCard'
import { sortFeaturedFirst } from '@/components/listings/helpers'
import { cn } from '@/lib/utils'

const HERO_IMG = 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1400&q=70'

const TRUST = [
  { icon: UserCheck, title: 'Verified renters', text: 'ID, income and references checked by a real person.' },
  { icon: BadgeCheck, title: 'Vetted owners', text: 'Every listing is reviewed before it goes live.' },
  { icon: Lock, title: 'No contact until both commit', text: 'Details stay private until both sides say yes.' },
  { icon: HandCoins, title: 'Fees only on success', text: 'Nothing to pay unless the owner accepts you.' },
]

const STEPS = [
  { icon: FileSearch, title: 'Apply', text: 'Pick a home, propose your rent and tell us about yourself. One application, no back-and-forth.' },
  { icon: ShieldCheck, title: 'We verify you', text: 'Our team checks your ID and profile, then presents you to the owner as a trusted candidate.' },
  { icon: Users, title: 'Owner decides', text: 'The owner reviews a verified profile, not a flood of messages, and accepts or declines.' },
  { icon: KeyRound, title: 'Fees unlock contact', text: 'Once both sides pay the service fee, we reveal contact details and the exact address.' },
]

const TESTIMONIALS = [
  { quote: 'I moved from Munich to Milan without a single scammy message. StayBridge verified me once and the owner said yes in three days.', name: 'Lena K.', role: 'Renter, Milan' },
  { quote: 'I used to get 80 emails per listing. Now I get two or three verified people with real income and references. It is a different world.', name: 'Marco B.', role: 'Owner, Milan & Berlin' },
  { quote: 'Knowing I only pay if the owner accepts me made it easy to apply. The team even negotiated $100 off my rent.', name: 'Daniel O.', role: 'Renter, London' },
]

export default function HomePage() {
  const nav = useNavigate()
  const listings = useStore((s) => s.listings)
  const users = useStore((s) => s.users)
  const applications = useStore((s) => s.applications)

  const [city, setCity] = useState('')
  const [type, setType] = useState('')
  const [max, setMax] = useState('')

  const active = useMemo(() => listings.filter((l) => l.status === 'active'), [listings])
  const featured = useMemo(() => [...active].sort(sortFeaturedFirst).slice(0, 6), [active])
  const cities = useMemo(() => Array.from(new Set(active.map((l) => l.city))).sort(), [active])
  const stats = {
    live: active.length,
    verified: users.filter((u) => u.role === 'renter' && u.verification === 'verified').length,
    deals: applications.filter((a) => a.status === 'completed').length,
  }

  const onSearch = (e: FormEvent) => {
    e.preventDefault()
    const p = new URLSearchParams()
    if (city.trim()) p.set('city', city.trim())
    if (type) p.set('type', type)
    if (max) p.set('max', max)
    const qs = p.toString()
    nav(`/listings${qs ? `?${qs}` : ''}`)
  }

  return (
    <div className="overflow-x-hidden">
      {/* Hero */}
      <section className="relative bg-gradient-to-b from-brand-50 via-white to-ink-50">
        <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-brand-200/40 blur-3xl" />
        <div className="pointer-events-none absolute -left-24 top-40 h-72 w-72 rounded-full bg-accent-400/20 blur-3xl" />
        <div className="container-x relative grid items-center gap-10 py-12 sm:py-16 lg:grid-cols-[1.1fr_.9fr] lg:py-24">
          <div className="animate-fade-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white px-3 py-1 text-xs font-semibold text-brand-800 shadow-sm">
              <Sparkles className="h-3.5 w-3.5 text-accent-500" /> Managed renting, the way it should be
            </span>
            <h1 className="mt-5 text-4xl font-bold leading-[1.08] tracking-tight text-ink-900 sm:text-5xl lg:text-6xl">
              Renting, with a <span className="relative whitespace-nowrap text-brand-700">human in the loop<svg className="absolute -bottom-1 left-0 h-2 w-full text-accent-400" viewBox="0 0 200 8" preserveAspectRatio="none" aria-hidden><path d="M0 6 Q100 0 200 6" stroke="currentColor" strokeWidth="3" fill="none" /></svg></span>.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-ink-500">
              StayBridge sits between renters and owners. We verify every renter, vet every home, negotiate the price and only connect you when both sides are ready to commit.
            </p>

            <form onSubmit={onSearch} className="mt-8 grid gap-2 rounded-2xl border border-ink-200 bg-white p-2 shadow-lift sm:grid-cols-[1.4fr_1fr_1fr_auto]" aria-label="Search homes">
              <label className="flex items-center gap-2 rounded-xl px-3 py-2 hover:bg-ink-50 focus-within:bg-ink-50">
                <MapPin className="h-4 w-4 shrink-0 text-brand-700" />
                <span className="sr-only">City</span>
                <input list="home-cities" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Which city?" className="w-full bg-transparent text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none" />
                <datalist id="home-cities">{cities.map((c) => <option key={c} value={c} />)}</datalist>
              </label>
              <label className="flex items-center gap-2 rounded-xl px-3 py-2 hover:bg-ink-50 focus-within:bg-ink-50 sm:border-l sm:border-ink-100">
                <Building2 className="h-4 w-4 shrink-0 text-brand-700" />
                <span className="sr-only">Property type</span>
                <select value={type} onChange={(e) => setType(e.target.value)} className="w-full bg-transparent text-sm text-ink-900 focus:outline-none">
                  <option value="">Any type</option>
                  {PROPERTY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-2 rounded-xl px-3 py-2 hover:bg-ink-50 focus-within:bg-ink-50 sm:border-l sm:border-ink-100">
                <HandCoins className="h-4 w-4 shrink-0 text-brand-700" />
                <span className="sr-only">Maximum monthly rent</span>
                <input type="number" min={0} step={50} inputMode="numeric" value={max} onChange={(e) => setMax(e.target.value)} placeholder="Max / month" className="w-full bg-transparent text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none" />
              </label>
              <Button type="submit" size="lg" className="w-full sm:w-auto"><Search className="h-4 w-4" /> Search</Button>
            </form>
            <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-400">
              Popular:
              {cities.slice(0, 4).map((c) => (
                <Link key={c} to={`/listings?city=${encodeURIComponent(c)}`} className="font-medium text-ink-600 underline-offset-2 hover:text-brand-700 hover:underline">{c}</Link>
              ))}
            </p>
          </div>

          <div className="relative hidden animate-fade-up [animation-delay:150ms] lg:block">
            <div className="overflow-hidden rounded-3xl shadow-lift">
              <img src={HERO_IMG} alt="Bright, furnished living room" loading="lazy" className="aspect-[4/5] w-full object-cover" />
            </div>
            <Card className="absolute -left-10 bottom-10 w-64 p-4 animate-fade-up [animation-delay:350ms]">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-emerald-50 text-emerald-600"><ShieldCheck className="h-5 w-5" /></span>
                <div>
                  <p className="text-sm font-semibold">Renter verified</p>
                  <p className="text-xs text-ink-400">ID · income · references</p>
                </div>
              </div>
            </Card>
            <Card className="absolute -right-4 top-10 w-56 p-4 animate-fade-up [animation-delay:500ms]">
              <p className="text-xs font-medium text-ink-400">Owner decision</p>
              <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-brand-800"><BadgeCheck className="h-4 w-4" /> Accepted at $1,600</p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink-100"><div className="h-full w-4/5 rounded-full bg-brand-600" /></div>
            </Card>
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-y border-ink-200/70 bg-white">
        <div className="container-x grid gap-6 py-8 sm:grid-cols-2 lg:grid-cols-4">
          {TRUST.map((t, i) => (
            <div key={t.title} className="flex items-start gap-3 animate-fade-up" style={{ animationDelay: `${i * 80}ms` }}>
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700"><t.icon className="h-5 w-5" /></span>
              <div>
                <p className="text-sm font-semibold text-ink-900">{t.title}</p>
                <p className="text-sm text-ink-500">{t.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Featured homes */}
      <section className="container-x py-16 sm:py-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionHeading eyebrow="Handpicked" title="Featured homes" description="Reviewed by our team and ready for verified renters." />
          <Link to="/listings" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:text-brand-800">
            Browse all homes <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((l, i) => (
            <div key={l.id} className="animate-fade-up" style={{ animationDelay: `${i * 70}ms` }}>
              <ListingCard listing={l} />
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-white py-16 sm:py-20">
        <div className="container-x">
          <SectionHeading align="center" eyebrow="How it works" title="Four steps. One human team." description="We do the checking, chasing and negotiating so both sides only meet when it is a real match." />
          <ol className="relative mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <div className="absolute left-0 right-0 top-7 hidden h-px bg-gradient-to-r from-transparent via-brand-200 to-transparent lg:block" aria-hidden />
            {STEPS.map((s, i) => (
              <li key={s.title} className="relative animate-fade-up" style={{ animationDelay: `${i * 90}ms` }}>
                <div className="relative z-10 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-700 text-white shadow-lift">
                  <s.icon className="h-6 w-6" />
                  <span className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-accent-400 text-xs font-bold text-ink-900">{i + 1}</span>
                </div>
                <h3 className="mt-5 text-lg font-semibold text-ink-900">{s.title}</h3>
                <p className="mt-1.5 text-sm text-ink-500">{s.text}</p>
              </li>
            ))}
          </ol>
          <div className="mt-10 text-center">
            <Link to="/how-it-works" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:text-brand-800">See the full process <ArrowRight className="h-4 w-4" /></Link>
          </div>
        </div>
      </section>

      {/* Split CTA */}
      <section className="container-x grid gap-6 py-16 sm:py-20 lg:grid-cols-2">
        <SplitCta
          tone="brand"
          eyebrow="For renters"
          title="Find a home without the chaos"
          points={['Apply once, get verified, reuse it everywhere', 'We negotiate the rent for you', 'Pay only if the owner accepts you']}
          cta="Find a home"
          to="/listings"
        />
        <SplitCta
          tone="ink"
          eyebrow="For owners"
          title="Meet only serious, verified tenants"
          points={['No inbox flood — just pre-screened candidates', 'We handle checks, viewings questions and pricing', 'Pay a success fee only when a tenant is placed']}
          cta="List your place"
          to="/owners"
        />
      </section>

      {/* Social proof */}
      <section className="bg-gradient-to-b from-white to-brand-50/60 py-16 sm:py-20">
        <div className="container-x">
          <div className="grid gap-4 rounded-2xl bg-ink-900 p-6 text-white shadow-lift sm:grid-cols-3 sm:p-8">
            <StatBlock value={stats.live} label="Live, vetted listings" />
            <StatBlock value={stats.verified} label="Verified renters" />
            <StatBlock value={stats.deals} label="Completed deals" />
          </div>

          <div className="mt-14">
            <SectionHeading align="center" eyebrow="Loved on both sides" title="People who stopped dreading the rental hunt" />
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {TESTIMONIALS.map((t, i) => (
              <Card key={t.name} className="flex flex-col p-6 animate-fade-up transition-shadow hover:shadow-lift" style={{ animationDelay: `${i * 90}ms` }}>
                <Quote className="h-7 w-7 text-brand-200" />
                <div className="mt-3 flex gap-0.5">{[1, 2, 3, 4, 5].map((n) => <Star key={n} className="h-4 w-4 fill-amber-400 text-amber-400" />)}</div>
                <p className="mt-3 flex-1 text-ink-700">“{t.quote}”</p>
                <div className="mt-5 border-t border-ink-100 pt-4">
                  <p className="text-sm font-semibold">{t.name}</p>
                  <p className="text-xs text-ink-400">{t.role}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

function StatBlock({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-center sm:border-r sm:border-white/10 sm:last:border-0">
      <p className="font-display text-4xl font-bold text-accent-400">{value.toLocaleString()}</p>
      <p className="mt-1 text-sm text-white/70">{label}</p>
    </div>
  )
}

function SplitCta({ tone, eyebrow, title, points, cta, to }: { tone: 'brand' | 'ink'; eyebrow: string; title: string; points: string[]; cta: string; to: string }) {
  return (
    <div className={cn('relative overflow-hidden rounded-3xl p-8 sm:p-10', tone === 'brand' ? 'bg-brand-700 text-white' : 'bg-white text-ink-900 ring-1 ring-ink-200')}>
      <div className={cn('pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full blur-2xl', tone === 'brand' ? 'bg-brand-500/50' : 'bg-accent-400/20')} />
      <p className={cn('relative text-sm font-semibold uppercase tracking-wider', tone === 'brand' ? 'text-brand-100' : 'text-brand-700')}>{eyebrow}</p>
      <h3 className="relative mt-2 text-2xl font-bold sm:text-3xl">{title}</h3>
      <ul className="relative mt-5 space-y-2.5">
        {points.map((p) => (
          <li key={p} className="flex items-start gap-2 text-sm">
            <BadgeCheck className={cn('mt-0.5 h-4 w-4 shrink-0', tone === 'brand' ? 'text-accent-400' : 'text-brand-600')} />
            <span className={tone === 'brand' ? 'text-white/90' : 'text-ink-600'}>{p}</span>
          </li>
        ))}
      </ul>
      <Link to={to} className={cn('relative mt-7 inline-flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-semibold transition-colors', tone === 'brand' ? 'bg-white text-brand-800 hover:bg-brand-50' : 'bg-brand-700 text-white hover:bg-brand-800')}>
        {cta} <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  )
}
