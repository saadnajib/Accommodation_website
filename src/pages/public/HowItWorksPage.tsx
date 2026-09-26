import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  ArrowRight, BadgeCheck, Ban, FileCheck2, Handshake, KeyRound, Lock, MessageSquareOff, Scale, ShieldCheck,
  Timer, UserCheck,
} from 'lucide-react'
import { APPLICATION_STATUS, PIPELINE } from '@/lib/status'
import { AGREEMENT_CLAUSES } from '@/lib/fees'
import { Card, SectionHeading, Tabs } from '@/components/ui'
import { cn } from '@/lib/utils'
import { FaqItem } from '@/components/listings/FaqItem'
import type { ApplicationStatus } from '@/types'

type Side = 'renter' | 'owner'

const OWNER_COPY: Partial<Record<ApplicationStatus, string>> = {
  submitted: 'A renter applies to your listing with a proposed rent and a full self-profile. You are not disturbed yet.',
  under_review: 'Our team checks their ID, income and references. Time-wasters never reach you.',
  verified: 'The renter passes verification. We prepare a clear, privacy-safe summary of who they are.',
  sent_to_owner: 'You receive a verified applicant card: occupation, income band, move-in date and proposed price.',
  owner_accepted: 'You accept (or decline) with one click. We confirm the final price with both sides.',
  awaiting_fees: 'Both sides pay the StayBridge service fee. If anyone backs out before this, nobody pays.',
  contact_unlocked: 'Phone, email and messaging unlock. You arrange the viewing and sign the contract directly.',
  completed: 'The tenant moves in, the listing is marked as rented and both sides leave a review.',
}

const WHY = [
  { icon: ShieldCheck, title: 'Safety first', text: 'Every renter is ID-checked and every listing is reviewed by a person before anyone meets.' },
  { icon: Ban, title: 'No scams', text: 'No fake listings, no deposits wired to strangers. Contact details only unlock through us.' },
  { icon: Timer, title: 'No time-wasters', text: 'Owners only see verified, committed renters. Renters only apply to homes that are really available.' },
  { icon: Scale, title: 'We negotiate for you', text: 'Propose a price and our team handles the back-and-forth, so nobody has an awkward conversation.' },
]

const FAQ = [
  { q: 'Why can’t I message the owner directly?', a: 'Keeping contact inside StayBridge until both sides commit protects renters from scams and owners from spam. Once the owner accepts you and both service fees are paid, you get full contact details and in-app messaging.' },
  { q: 'When do I pay the service fee?', a: 'Only after the owner accepts your application. If the owner declines, or we can’t verify you, you pay nothing.' },
  { q: 'What does verification involve?', a: 'You upload an ID document and a selfie, optionally proof of income, and fill in a short profile about yourself. A member of our team reviews it, usually within one working day.' },
  { q: 'Can I propose a lower rent?', a: 'Yes. Every application includes a proposed rent. We present it to the owner and negotiate on your behalf. The final agreed price is what the fee is based on.' },
  { q: 'Who holds the deposit?', a: 'The deposit is paid to the owner under your rental contract, never to StayBridge. We only charge our service fee.' },
  { q: 'What is the Verified Tenant Pass?', a: 'A one-off purchase that pre-verifies you once and reuses it for every application. You also get 20% off every service fee and priority review.' },
]

const SAFETY = [
  { icon: UserCheck, title: 'Identity verification', text: 'Government ID, selfie match and optional income proof — checked by a human, not just a bot.' },
  { icon: FileCheck2, title: 'Listing moderation', text: 'Photos, descriptions and pricing are reviewed before a listing goes live.' },
  { icon: Lock, title: 'Private until committed', text: 'Exact addresses, phone numbers and emails stay hidden until both sides pay and confirm.' },
  { icon: MessageSquareOff, title: 'No cold messages', text: 'Nobody can message you out of the blue. Every introduction goes through our team.' },
]

export default function HowItWorksPage() {
  const [side, setSide] = useState<Side>('renter')
  const { hash } = useLocation()

  // The router does not scroll to #anchors (e.g. footer links to #trust / #terms).
  useEffect(() => {
    if (!hash) return
    const raf = requestAnimationFrame(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth' }))
    return () => cancelAnimationFrame(raf)
  }, [hash])

  return (
    <div>
      <section className="bg-gradient-to-b from-brand-50 to-ink-50">
        <div className="container-x py-14 text-center sm:py-20 animate-fade-up">
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-700">How StayBridge works</p>
          <h1 className="mx-auto mt-3 max-w-3xl text-4xl font-bold tracking-tight text-ink-900 sm:text-5xl">A real team in the middle of every rental</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-ink-500">We verify renters, vet homes, negotiate the price and only connect both sides when they are ready to commit.</p>
        </div>
      </section>

      {/* Pipeline */}
      <section className="container-x py-14 sm:py-20">
        <div className="flex flex-col items-center gap-6">
          <SectionHeading align="center" eyebrow="The pipeline" title="From application to keys" />
          <Tabs<Side> value={side} onChange={setSide} tabs={[{ value: 'renter', label: 'For renters' }, { value: 'owner', label: 'For owners' }]} />
        </div>
        <ol className="relative mx-auto mt-12 max-w-3xl">
          <span className="absolute bottom-4 left-5 top-4 w-px bg-gradient-to-b from-brand-300 via-brand-200 to-transparent sm:left-1/2" aria-hidden />
          {PIPELINE.map((st, i) => {
            const meta = APPLICATION_STATUS[st]
            const text = side === 'renter' ? meta.description : OWNER_COPY[st] ?? meta.description
            const left = i % 2 === 0
            return (
              <li key={st} className="relative mb-6 pl-14 animate-fade-up sm:grid sm:grid-cols-2 sm:gap-10 sm:pl-0" style={{ animationDelay: `${i * 60}ms` }}>
                <span className={cn('absolute left-0 top-3 z-10 grid h-10 w-10 place-items-center rounded-full text-sm font-bold ring-4 ring-ink-50 sm:left-1/2 sm:-translate-x-1/2',
                  i >= 6 ? 'bg-accent-400 text-ink-900' : 'bg-brand-700 text-white')}>
                  {i + 1}
                </span>
                <Card className={cn('p-5 transition-shadow hover:shadow-lift', left ? 'sm:col-start-1 sm:text-right' : 'sm:col-start-2')}>
                  <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">Step {i + 1}</p>
                  <h3 className="mt-1 text-lg font-semibold text-ink-900">{meta.label}</h3>
                  <p className="mt-1.5 text-sm text-ink-500">{text}</p>
                </Card>
              </li>
            )
          })}
        </ol>
        <div className="mt-6 text-center">
          <Link to={side === 'renter' ? '/listings' : '/owners'} className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand-700 px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-800">
            {side === 'renter' ? 'Start browsing homes' : 'Learn more for owners'} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Why middleman */}
      <section className="bg-white py-14 sm:py-20">
        <div className="container-x">
          <SectionHeading align="center" eyebrow="Why the middleman?" title="Because renting shouldn’t feel risky" description="A human team between both sides removes the parts of renting everyone hates." />
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {WHY.map((w, i) => (
              <div key={w.title} className="rounded-2xl border border-ink-200 p-6 transition-all hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-card animate-fade-up" style={{ animationDelay: `${i * 70}ms` }}>
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-700"><w.icon className="h-5 w-5" /></span>
                <h3 className="mt-4 text-lg font-semibold">{w.title}</h3>
                <p className="mt-1.5 text-sm text-ink-500">{w.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust & safety */}
      <section id="trust" className="scroll-mt-20 py-14 sm:py-20">
        <div className="container-x grid gap-10 lg:grid-cols-[.9fr_1.1fr] lg:items-center">
          <div>
            <SectionHeading eyebrow="Trust & safety" title="Built so nobody gets burned" description="We check people and places before they meet, and keep personal details private until there is a real deal." />
            <div className="mt-6 flex items-center gap-3 rounded-2xl bg-ink-900 p-5 text-white">
              <Handshake className="h-8 w-8 shrink-0 text-accent-400" />
              <p className="text-sm text-white/80">If something doesn’t feel right, our team is one message away. We can pause a deal, re-verify a user or remove a listing at any time.</p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {SAFETY.map((s) => (
              <Card key={s.title} className="p-5">
                <s.icon className="h-6 w-6 text-brand-700" />
                <h3 className="mt-3 font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm text-ink-500">{s.text}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-white py-14 sm:py-20">
        <div className="container-x max-w-3xl">
          <SectionHeading align="center" eyebrow="FAQ" title="Questions, answered" />
          <div className="mt-10 space-y-3">
            {FAQ.map((f) => <FaqItem key={f.q} q={f.q} a={f.a} />)}
          </div>
        </div>
      </section>

      {/* Terms */}
      <section id="terms" className="scroll-mt-20 py-14 sm:py-20">
        <div className="container-x max-w-3xl">
          <SectionHeading eyebrow="Terms summary" title="The accommodation agreement" description="Every renter accepts these terms before applying. They keep the process fair for both sides." />
          <Card className="mt-8 divide-y divide-ink-100">
            {AGREEMENT_CLAUSES.map((c, i) => (
              <div key={c} className="flex gap-4 p-5">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-50 text-xs font-bold text-brand-800">{i + 1}</span>
                <p className="text-sm leading-relaxed text-ink-700">{c}</p>
              </div>
            ))}
          </Card>
          <p className="mt-4 flex items-center gap-2 text-xs text-ink-400"><BadgeCheck className="h-4 w-4" /> This is a plain-language summary. The full agreement is shown during application.</p>
        </div>
      </section>

      <section className="container-x pb-16">
        <div className="flex flex-col items-center justify-between gap-6 rounded-3xl bg-brand-700 p-8 text-center text-white sm:p-12 lg:flex-row lg:text-left">
          <div>
            <h2 className="text-2xl font-bold sm:text-3xl">Ready when you are</h2>
            <p className="mt-2 text-white/80">Create a free account in under a minute. You only pay when there is a deal.</p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/listings" className="inline-flex h-11 items-center gap-2 rounded-xl bg-white px-5 text-sm font-semibold text-brand-800 hover:bg-brand-50">Find a home <KeyRound className="h-4 w-4" /></Link>
            <Link to="/owners" className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/30 px-5 text-sm font-semibold text-white hover:bg-white/10">List your place</Link>
          </div>
        </div>
      </section>
    </div>
  )
}
