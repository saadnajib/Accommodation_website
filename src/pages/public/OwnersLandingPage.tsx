import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight, BadgeCheck, CalendarCheck, Camera, ClipboardCheck, HandCoins, Handshake, MessageSquareOff, Rocket,
  ShieldCheck, Sparkles, UserCheck,
} from 'lucide-react'
import { useCurrentUser, useStore } from '@/store/useStore'
import { computeFees } from '@/lib/fees'
import { Button, Card, SectionHeading } from '@/components/ui'
import { FaqItem } from '@/components/listings/FaqItem'
import { formatMoney } from '@/lib/utils'

const OWNER_IMG = 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=70'

const BENEFITS = [
  { icon: UserCheck, title: 'Pre-verified tenants', text: 'Every applicant has passed ID, income and profile checks before you ever see them.' },
  { icon: ClipboardCheck, title: 'We handle screening & negotiation', text: 'Our team fields questions, checks references and agrees the price — you just decide.' },
  { icon: HandCoins, title: 'Pay only on placement', text: 'Listing is free. The success fee applies only when a tenant is placed.' },
  { icon: Rocket, title: 'Featured boosts', text: 'Need to fill a room fast? Feature your listing at the top of search and on our home page.' },
  { icon: MessageSquareOff, title: 'No inbox flood', text: 'No cold messages or time-wasters. Introductions only happen through StayBridge.' },
  { icon: ShieldCheck, title: 'Your privacy protected', text: 'Your phone, email and exact address stay hidden until a tenant commits.' },
]

const STEPS = [
  { icon: Camera, title: 'List for free', text: 'Add photos, price and house rules. Our team reviews and publishes it, usually the same day.' },
  { icon: BadgeCheck, title: 'We verify applicants', text: 'Renters apply with a proposed rent and full profile. We verify them before they reach you.' },
  { icon: Handshake, title: 'You decide', text: 'Review a clear applicant card and accept or decline with one click. We confirm the price.' },
  { icon: CalendarCheck, title: 'Meet your tenant', text: 'Once both sides pay the service fee, contact unlocks and you sign the contract directly.' },
]

export default function OwnersLandingPage() {
  const user = useCurrentUser()
  const fees = useStore((s) => s.fees)
  const nav = useNavigate()
  const [rent, setRent] = useState(1500)

  const money = (n: number) => formatMoney(n, fees.currency)
  const { ownerFee } = computeFees(rent, fees)
  const yearly = rent * 12
  const vacancyWeeks = 3
  const vacancyCost = Math.round((rent * 12 / 52) * vacancyWeeks)

  const onList = () => {
    if (!user) nav('/signup?role=owner')
    else if (user.role === 'owner') nav('/owner/listings/new')
    else nav('/signup?role=owner')
  }
  const ctaHint = user && user.role !== 'owner' ? `You are signed in as a ${user.role}. Create an owner account to list.` : null

  return (
    <div className="overflow-x-hidden">
      {/* Hero */}
      <section className="relative bg-ink-900 text-white">
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-brand-600/40 blur-3xl" />
        <div className="container-x relative grid items-center gap-10 py-14 sm:py-20 lg:grid-cols-2 lg:py-24">
          <div className="animate-fade-up">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-brand-100"><Sparkles className="h-3.5 w-3.5 text-accent-400" /> For property owners</span>
            <h1 className="mt-5 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">Only meet tenants who are <span className="text-accent-400">verified and ready</span>.</h1>
            <p className="mt-5 max-w-xl text-lg text-white/70">List for free. We screen every applicant, negotiate the rent and only introduce you when a verified renter is ready to commit.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" variant="accent" onClick={onList}>List your place <ArrowRight className="h-4 w-4" /></Button>
              <a href="#how" className="inline-flex h-12 items-center rounded-xl border border-white/20 px-6 text-base font-semibold text-white transition-colors hover:bg-white/10">How it works</a>
            </div>
            {ctaHint && <p className="mt-3 text-sm text-white/60">{ctaHint}</p>}
            <p className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/60">
              <span className="inline-flex items-center gap-1.5"><BadgeCheck className="h-4 w-4 text-brand-300" /> Free to list</span>
              <span className="inline-flex items-center gap-1.5"><BadgeCheck className="h-4 w-4 text-brand-300" /> Pay only on placement</span>
              <span className="inline-flex items-center gap-1.5"><BadgeCheck className="h-4 w-4 text-brand-300" /> No cold messages</span>
            </p>
          </div>
          <div className="relative hidden lg:block animate-fade-up [animation-delay:150ms]">
            <img src={OWNER_IMG} alt="Well-kept rental bedroom" loading="lazy" className="aspect-[4/3] w-full rounded-3xl object-cover shadow-lift" />
            <Card className="absolute -bottom-6 -left-6 w-72 p-4 text-ink-900">
              <p className="text-xs font-medium text-ink-400">New verified applicant</p>
              <p className="mt-1 font-semibold">Jonas W. · Software engineer</p>
              <p className="mt-0.5 text-sm text-ink-500">Proposes {money(1600)}/mo · 12 months</p>
              <div className="mt-3 flex gap-2">
                <span className="flex-1 rounded-lg bg-brand-700 py-1.5 text-center text-xs font-semibold text-white">Accept</span>
                <span className="flex-1 rounded-lg bg-ink-100 py-1.5 text-center text-xs font-semibold text-ink-600">Decline</span>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="container-x py-14 sm:py-20">
        <SectionHeading align="center" eyebrow="Why owners choose StayBridge" title="Less admin. Better tenants." />
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map((b, i) => (
            <Card key={b.title} className="p-6 transition-all hover:-translate-y-0.5 hover:shadow-lift animate-fade-up" style={{ animationDelay: `${i * 60}ms` }}>
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-700"><b.icon className="h-5 w-5" /></span>
              <h3 className="mt-4 text-lg font-semibold">{b.title}</h3>
              <p className="mt-1.5 text-sm text-ink-500">{b.text}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="scroll-mt-20 bg-white py-14 sm:py-20">
        <div className="container-x">
          <SectionHeading align="center" eyebrow="How it works for owners" title="Four steps to a signed tenant" />
          <ol className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="relative rounded-2xl border border-ink-200 p-6 animate-fade-up" style={{ animationDelay: `${i * 80}ms` }}>
                <span className="absolute right-5 top-5 font-display text-4xl font-bold text-ink-100">{i + 1}</span>
                <span className="relative grid h-11 w-11 place-items-center rounded-xl bg-brand-700 text-white"><s.icon className="h-5 w-5" /></span>
                <h3 className="relative mt-4 text-lg font-semibold">{s.title}</h3>
                <p className="relative mt-1.5 text-sm text-ink-500">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Earnings example */}
      <section className="container-x py-14 sm:py-20">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <SectionHeading eyebrow="Earnings example" title="One small fee. A full year of rent." description="Our success fee is a fraction of what a few weeks of vacancy — or a bad tenant — would cost you." />
            <label htmlFor="owner-rent" className="mt-8 block text-sm font-semibold text-ink-700">Your monthly rent: <span className="text-brand-700">{money(rent)}</span></label>
            <input id="owner-rent" type="range" min={300} max={5000} step={50} value={rent} onChange={(e) => setRent(Number(e.target.value))} className="mt-3 w-full accent-brand-700" />
          </div>
          <Card className="overflow-hidden">
            <div className="grid grid-cols-2 divide-x divide-ink-100 border-b border-ink-100">
              <div className="p-5">
                <p className="text-xs font-medium text-ink-400">12-month tenancy</p>
                <p className="mt-1 text-2xl font-bold text-ink-900">{money(yearly)}</p>
              </div>
              <div className="p-5">
                <p className="text-xs font-medium text-ink-400">StayBridge success fee</p>
                <p className="mt-1 text-2xl font-bold text-brand-700">{money(ownerFee)}</p>
              </div>
            </div>
            <div className="space-y-3 p-5 text-sm">
              <div className="flex justify-between"><span className="text-ink-500">Fee as share of first year</span><span className="font-semibold">{yearly ? ((ownerFee / yearly) * 100).toFixed(1) : 0}%</span></div>
              <div className="flex justify-between"><span className="text-ink-500">Cost of {vacancyWeeks} extra weeks empty</span><span className="font-semibold text-red-600">{money(vacancyCost)}</span></div>
              <div className="flex justify-between border-t border-ink-100 pt-3"><span className="font-semibold text-ink-900">You keep</span><span className="font-bold text-ink-900">{money(yearly - ownerFee)}</span></div>
              <p className="text-xs text-ink-400">Fee = {Math.round(fees.ownerFeeRate * 100)}% of one month’s agreed rent, minimum {money(fees.minFee)}. Charged only when a tenant is placed.</p>
            </div>
          </Card>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-white py-14 sm:py-20">
        <div className="container-x max-w-3xl">
          <SectionHeading align="center" eyebrow="FAQ" title="Owner questions" />
          <div className="mt-10 space-y-3">
            <FaqItem q="Does it cost anything to list?" a="No. Listing is free and every listing is reviewed by our team before it goes live." />
            <FaqItem q="Will renters contact me directly?" a="Never before both sides commit. We handle all questions and only share your contact details once you’ve accepted a verified tenant and both fees are paid." />
            <FaqItem q="What do you check about renters?" a="Government ID with selfie match, optional proof of income, occupation, household size, pets and smoking, plus a personal profile and references." />
            <FaqItem q="Can I negotiate the rent?" a="Renters propose a price, and our team negotiates with both sides. You always make the final call." />
            <FaqItem q="What does featuring a listing do?" a={`For ${money(fees.featuredListingPrice)} your listing sits at the top of search results and on the home page for 30 days.`} />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container-x py-14 sm:py-20">
        <div className="relative overflow-hidden rounded-3xl bg-brand-700 p-8 text-center text-white sm:p-14">
          <div className="pointer-events-none absolute -left-16 -top-16 h-64 w-64 rounded-full bg-brand-500/50 blur-2xl" />
          <h2 className="relative text-3xl font-bold sm:text-4xl">Ready to find your next great tenant?</h2>
          <p className="relative mx-auto mt-3 max-w-xl text-white/80">It takes about five minutes to list. We’ll take it from there.</p>
          <Button size="lg" variant="accent" className="relative mt-8" onClick={onList}>List your place <ArrowRight className="h-4 w-4" /></Button>
        </div>
      </section>
    </div>
  )
}
