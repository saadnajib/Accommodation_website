import { BadgeCheck, Check, Sparkles } from 'lucide-react'
import { Badge, Button } from '@/components/ui'
import { useCurrentUser, useStore } from '@/store/useStore'
import { cn, formatMoney } from '@/lib/utils'
import { useTenantPassCheckout } from './TenantPassCheckout'

const TENANT_PASS_BENEFITS = [
  '20% off every renter service fee',
  'Priority review by the StayBridge team',
  'Verify once, reuse your ID on every application',
  '"Verified Tenant" badge shown to owners',
]

/** Upsell / status card for the paid Verified Tenant Pass. */
export function TenantPassCard({ variant = 'full', className }: { variant?: 'full' | 'compact'; className?: string }) {
  const user = useCurrentUser()
  const fees = useStore((s) => s.fees)
  const { openCheckout: buy, modal } = useTenantPassCheckout()
  if (!user) return null
  const active = user.hasTenantPass

  if (variant === 'compact') {
    return (
      <div className={cn('flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4',
        active ? 'border-emerald-200 bg-emerald-50/60' : 'border-accent-400/60 bg-amber-50', className)}>
        <div className="flex min-w-0 items-start gap-3">
          <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-lg', active ? 'bg-emerald-100 text-emerald-700' : 'bg-accent-400 text-ink-900')}>
            {active ? <BadgeCheck className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink-900">{active ? 'Tenant Pass active' : 'Save 20% with the Verified Tenant Pass'}</p>
            <p className="text-xs text-ink-500">{active ? 'Your 20% fee discount is applied automatically.' : `One-off ${formatMoney(fees.tenantPassPrice, fees.currency)} · priority review · reuse your verification.`}</p>
          </div>
        </div>
        {!active && <Button size="sm" variant="accent" onClick={buy}>Get the pass</Button>}
        {modal}
      </div>
    )
  }

  return (
    <div className={cn('relative overflow-hidden rounded-2xl border p-5',
      active ? 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-white' : 'border-amber-200 bg-gradient-to-br from-amber-50 via-white to-brand-50', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 font-display text-lg font-semibold text-ink-900">
            <Sparkles className="h-5 w-5 text-accent-500" /> Verified Tenant Pass
          </p>
          <p className="mt-0.5 text-sm text-ink-500">{active ? 'Thanks for being a Tenant Pass member.' : 'A one-off upgrade that pays for itself on your first deal.'}</p>
        </div>
        {active ? <Badge tone="success" dot>Active</Badge> : <p className="text-2xl font-bold text-ink-900">{formatMoney(fees.tenantPassPrice, fees.currency)}<span className="text-xs font-medium text-ink-400"> once</span></p>}
      </div>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {TENANT_PASS_BENEFITS.map((b) => (
          <li key={b} className="flex items-start gap-2 text-sm text-ink-700">
            <Check className={cn('mt-0.5 h-4 w-4 shrink-0', active ? 'text-emerald-600' : 'text-brand-600')} /> {b}
          </li>
        ))}
      </ul>
      {!active && <Button className="mt-5" variant="accent" onClick={buy}>Buy Tenant Pass</Button>}
      {modal}
    </div>
  )
}
