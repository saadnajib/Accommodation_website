import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { BadgeCheck, Building2, Calculator, Check, Crown, KeyRound, Sparkles, Zap } from 'lucide-react'
import { useCurrentUser, useStore } from '@/store/useStore'
import { computeFees } from '@/lib/fees'
import { Badge, Button, Card, SectionHeading } from '@/components/ui'
import { FaqItem } from '@/components/listings/FaqItem'
import { cn, formatMoney } from '@/lib/utils'
import { useTenantPassCheckout } from '@/components/renter/TenantPassCheckout'

const pct = (r: number) => `${Math.round(r * 100)}%`

export default function PricingPage() {
  const fees = useStore((s) => s.fees)
  const { openCheckout, modal: passCheckout } = useTenantPassCheckout()
  const user = useCurrentUser()
  const nav = useNavigate()
  const [rent, setRent] = useState(1200)

  const money = (n: number) => formatMoney(n, fees.currency)
  const standard = computeFees(rent, fees)
  const withPass = computeFees(rent, fees, { hasTenantPass: true })
  const passSaving = standard.renterFee - withPass.renterFee

  const onBuyPass = () => {
    if (!user) { nav('/signup?role=renter'); return }
    if (user.role !== 'renter') return
    openCheckout()
  }
  const passState = !user ? 'guest' : user.role !== 'renter' ? 'not-renter' : user.hasTenantPass ? 'owned' : 'can-buy'

  return (
    <div>
      <section className="bg-gradient-to-b from-brand-50 to-ink-50">
        <div className="container-x py-14 text-center sm:py-20 animate-fade-up">
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-700">Pricing</p>
          <h1 className="mx-auto mt-3 max-w-3xl text-4xl font-bold tracking-tight text-ink-900 sm:text-5xl">Pay only when it works out</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-ink-500">No subscriptions, no listing fees, no application fees. Both sides pay a one-off service fee only after the owner says yes.</p>
        </div>
      </section>

      <section className="container-x -mt-4 pb-14 sm:pb-20">
        <div className="grid gap-6 lg:grid-cols-3">
          <PlanCard
            icon={KeyRound}
            title="Renters"
            price={pct(fees.renterFeeRate)}
            unit="of one month’s rent"
            note={`Minimum ${money(fees.minFee)} · charged only if the owner accepts you`}
            features={['Free to browse and apply', 'Identity & profile verification included', 'We negotiate the rent with the owner', 'Contact + exact address unlocked after payment', 'Nothing to pay if you are declined']}
            cta={<Button full onClick={() => nav('/listings')}>Find a home</Button>}
          />
          <PlanCard
            highlight
            icon={Building2}
            title="Owners"
            price={pct(fees.ownerFeeRate)}
            unit="of one month’s rent"
            note={`Minimum ${money(fees.minFee)} · only when a tenant is placed`}
            features={['Free to list — every listing reviewed', 'Only verified, pre-screened applicants', 'We handle screening and price negotiation', 'Accept or decline with one click', 'Two-sided reviews after move-in']}
            cta={<Button full onClick={() => nav(user?.role === 'owner' ? '/owner/listings/new' : '/signup?role=owner')}>List your place</Button>}
          />
          <Card className="flex flex-col p-6 sm:p-7">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-amber-50 text-amber-700"><Sparkles className="h-5 w-5" /></span>
              <h2 className="text-xl font-semibold">Add-ons</h2>
            </div>

            <div className="mt-5 rounded-2xl border border-ink-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="flex items-center gap-1.5 font-semibold text-ink-900"><Crown className="h-4 w-4 text-accent-500" /> Verified Tenant Pass</p>
                  <p className="text-xs text-ink-400">For renters · one-off</p>
                </div>
                <p className="text-xl font-bold">{money(fees.tenantPassPrice)}</p>
              </div>
              <ul className="mt-3 space-y-1.5 text-sm text-ink-600">
                {['20% off every renter service fee', 'Priority review by our team', 'Verify once, reuse on every application'].map((f) => (
                  <li key={f} className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" /> {f}</li>
                ))}
              </ul>
              <div className="mt-4">
                {passState === 'owned' ? (
                  <Badge tone="success" className="w-full justify-center py-2"><BadgeCheck className="h-4 w-4" /> You have the Tenant Pass</Badge>
                ) : (
                  <Button full variant="accent" onClick={onBuyPass} disabled={passState === 'not-renter'}>Buy Tenant Pass</Button>
                )}
                {passState === 'not-renter' && <p className="mt-1.5 text-center text-xs text-ink-400">Available for renter accounts.</p>}
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-ink-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="flex items-center gap-1.5 font-semibold text-ink-900"><Zap className="h-4 w-4 text-accent-500" /> Featured Listing</p>
                  <p className="text-xs text-ink-400">For owners · 30 days</p>
                </div>
                <p className="text-xl font-bold">{money(fees.featuredListingPrice)}</p>
              </div>
              <ul className="mt-3 space-y-1.5 text-sm text-ink-600">
                {['Top of search results', 'Shown on the home page', 'Amber “Featured” badge'].map((f) => (
                  <li key={f} className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" /> {f}</li>
                ))}
              </ul>
              <Button full variant="outline" className="mt-4" onClick={() => nav('/owner/listings')}>Feature a listing</Button>
            </div>
          </Card>
        </div>
      </section>

      {/* Calculator */}
      <section className="bg-white py-14 sm:py-20">
        <div className="container-x">
          <SectionHeading align="center" eyebrow="Fee calculator" title="See exactly what you’d pay" description="Fees are based on one month of the final agreed rent." />
          <Card className="mx-auto mt-10 max-w-4xl overflow-hidden">
            <div className="grid lg:grid-cols-[1fr_1.1fr]">
              <div className="border-b border-ink-100 p-6 sm:p-8 lg:border-b-0 lg:border-r">
                <label htmlFor="calc-rent" className="flex items-center gap-2 text-sm font-semibold text-ink-700"><Calculator className="h-4 w-4 text-brand-700" /> Monthly rent</label>
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-2xl font-bold text-ink-400">{money(0).replace(/[\d.,\s]/g, '')}</span>
                  <input id="calc-rent" type="number" min={0} max={20000} step={50} inputMode="numeric" value={rent}
                    onChange={(e) => setRent(Math.max(0, Math.min(20000, Number(e.target.value) || 0)))}
                    className="w-full rounded-xl border border-ink-200 px-3 py-2 text-3xl font-bold text-ink-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25" />
                </div>
                <input type="range" aria-label="Monthly rent slider" min={200} max={5000} step={50} value={Math.min(5000, Math.max(200, rent))} onChange={(e) => setRent(Number(e.target.value))}
                  className="mt-5 w-full accent-brand-700" />
                <div className="mt-1 flex justify-between text-xs text-ink-400"><span>{money(200)}</span><span>{money(5000)}</span></div>
                <p className="mt-6 text-xs text-ink-400">Minimum fee of {money(fees.minFee)} applies to each side. Deposits go to the owner, never to StayBridge.</p>
              </div>
              <div className="space-y-3 bg-ink-50/60 p-6 sm:p-8">
                <CalcRow label="Renter service fee" sub={`${pct(fees.renterFeeRate)} of one month`} value={money(standard.renterFee)} />
                <CalcRow label="Renter fee with Tenant Pass" sub={passSaving > 0 ? `You save ${money(passSaving)}` : '20% off'} value={money(withPass.renterFee)} accent />
                <CalcRow label="Owner success fee" sub={`${pct(fees.ownerFeeRate)} of one month`} value={money(standard.ownerFee)} />
                <div className="rounded-xl border border-dashed border-brand-300 bg-white p-4 text-sm text-ink-600">
                  <p className="font-semibold text-ink-900">Tenant Pass pays for itself</p>
                  <p className="mt-1">
                    {passSaving >= fees.tenantPassPrice
                      ? <>At this rent the pass ({money(fees.tenantPassPrice)}) saves you {money(passSaving - fees.tenantPassPrice)} on your first deal alone.</>
                      : <>The pass costs {money(fees.tenantPassPrice)} and saves {money(passSaving)} per deal — plus priority review on every application.</>}
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </section>

      <section className="container-x max-w-3xl py-14 sm:py-20">
        <SectionHeading align="center" eyebrow="Good to know" title="Pricing FAQ" />
        <div className="mt-10 space-y-3">
          <FaqItem q="Is there anything to pay up front?" a="No. Browsing, applying, listing and verification are free. The only optional up-front purchases are the Tenant Pass and Featured Listing boosts." />
          <FaqItem q="What if the owner declines me?" a="You pay nothing. Service fees are only charged once the owner accepts you and the price is agreed." />
          <FaqItem q="Is the fee based on the listed price or the negotiated price?" a="The final agreed price. If we negotiate the rent down for you, your fee goes down too." />
          <FaqItem q="Do owners pay to list?" a="No. Listing is free; the owner success fee applies only when a tenant is placed through StayBridge." />
        </div>
      </section>
      {passCheckout}
    </div>
  )
}

function PlanCard({ icon: Icon, title, price, unit, note, features, cta, highlight }: {
  icon: typeof KeyRound; title: string; price: string; unit: string; note: string; features: string[]; cta: ReactNode; highlight?: boolean
}) {
  return (
    <Card className={cn('relative flex flex-col p-6 sm:p-7 animate-fade-up', highlight && 'ring-2 ring-brand-600')}>
      {highlight && <span className="absolute -top-3 left-6 rounded-full bg-brand-700 px-3 py-1 text-xs font-semibold text-white">Free to list</span>}
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-700"><Icon className="h-5 w-5" /></span>
        <h2 className="text-xl font-semibold">{title}</h2>
      </div>
      <p className="mt-6"><span className="font-display text-5xl font-bold text-ink-900">{price}</span> <span className="text-sm text-ink-500">{unit}</span></p>
      <p className="mt-2 text-sm text-ink-500">{note}</p>
      <ul className="mt-6 flex-1 space-y-2.5 text-sm text-ink-700">
        {features.map((f) => <li key={f} className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" /> {f}</li>)}
      </ul>
      <div className="mt-7">{cta}</div>
    </Card>
  )
}

function CalcRow({ label, sub, value, accent }: { label: string; sub: string; value: string; accent?: boolean }) {
  return (
    <div className={cn('flex items-center justify-between gap-3 rounded-xl bg-white p-4 ring-1 ring-ink-200', accent && 'ring-accent-400 bg-amber-50/50')}>
      <div>
        <p className="text-sm font-semibold text-ink-900">{label}</p>
        <p className="text-xs text-ink-400">{sub}</p>
      </div>
      <p className="text-xl font-bold text-ink-900">{value}</p>
    </div>
  )
}
