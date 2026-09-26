import { useState, type ReactNode } from 'react'
import { BadgeCheck, CircleCheck, Lock, Pencil } from 'lucide-react'
import { Badge, Button, Card, CardBody, CardHeader, Input } from '@/components/ui'
import { computeFees } from '@/lib/fees'
import { cn, formatDate, formatMoney } from '@/lib/utils'
import { useStore } from '@/store/useStore'
import type { Application, Listing, User } from '@/types'
import { isTerminal } from './helpers'
import { InfoRow } from './AdminBits'

export function PricingCard({ app, listing, renter, onMarkFee }: {
  app: Application; listing: Listing | null; renter: User | null; onMarkFee: (side: 'renter' | 'owner') => void
}) {
  const fees = useStore((s) => s.fees)
  const setAgreedPrice = useStore((s) => s.setAgreedPrice)
  const toast = useStore((s) => s.toast)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(app.agreedPrice))

  const currency = listing?.currency ?? fees.currency
  const asking = listing?.price ?? app.proposedPrice
  const locked = app.renterFeePaid || app.ownerFeePaid || app.contactUnlocked || isTerminal(app.status)
  const isEditing = editing && !locked
  const draftNum = Number(draft)
  const draftValid = draft.trim() !== '' && Number.isFinite(draftNum) && draftNum > 0
  const shownPrice = isEditing && draftValid ? draftNum : app.agreedPrice
  const preview = isEditing && draftValid ? computeFees(draftNum, fees, { hasTenantPass: renter?.hasTenantPass }) : { renterFee: app.renterFee, ownerFee: app.ownerFee }
  const total = preview.renterFee + preview.ownerFee
  const diff = asking ? ((shownPrice - asking) / asking) * 100 : 0
  const feesDue = app.status === 'awaiting_fees'

  const save = () => {
    if (!draftValid) return
    const price = Math.round(draftNum)
    setAgreedPrice(app.id, price)
    setEditing(false)
    toast({ title: 'Agreed price updated', body: `${formatMoney(price, currency)}/month. Fees recalculated.`, tone: 'success' })
  }

  return (
    <Card>
      <CardHeader title="Offer & pricing" description="You negotiate the final rent between both sides."
        action={locked ? <Badge tone="neutral"><Lock className="h-3 w-3" /> Price locked</Badge> : null} />
      <CardBody className="space-y-5">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <InfoRow label="Asking">{formatMoney(asking, currency)}</InfoRow>
          <InfoRow label="Proposed">
            {formatMoney(app.proposedPrice, currency)}
            {app.proposedPrice < asking && <span className="ml-1 text-xs text-amber-700">−{Math.round(((asking - app.proposedPrice) / asking) * 100)}%</span>}
          </InfoRow>
          <InfoRow label="Move-in">{formatDate(app.moveInDate)}</InfoRow>
          <InfoRow label="Stay">{app.stayMonths} month{app.stayMonths === 1 ? '' : 's'}</InfoRow>
        </dl>

        <div className="rounded-xl border border-brand-200 bg-brand-50/50 p-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-brand-800">Agreed rent</p>
              {isEditing ? (
                <form noValidate className="mt-1 flex flex-wrap items-start gap-2" onSubmit={(e) => { e.preventDefault(); save() }}>
                  <Input id="agreed-price" aria-label="Agreed monthly rent" type="number" min={1} step={1} inputMode="numeric" className="w-36"
                    value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus
                    error={draftValid ? undefined : 'Enter a positive amount'} />
                  <Button type="submit" size="md" disabled={!draftValid}>Save</Button>
                  <Button type="button" variant="ghost" onClick={() => { setEditing(false); setDraft(String(app.agreedPrice)) }}>Cancel</Button>
                </form>
              ) : (
                <p className="mt-0.5 text-2xl font-bold tabular-nums text-ink-900">{formatMoney(app.agreedPrice, currency)}<span className="text-sm font-normal text-ink-400">/month</span></p>
              )}
              <p className={cn('mt-1 text-xs', diff < 0 ? 'text-amber-700' : 'text-ink-500')}>
                {diff === 0 ? 'Matches asking price' : `${diff > 0 ? '+' : ''}${diff.toFixed(1)}% vs asking`}
              </p>
            </div>
            {!isEditing && !locked && (
              <Button variant="outline" size="sm" onClick={() => { setDraft(String(app.agreedPrice)); setEditing(true) }}>
                <Pencil className="h-4 w-4" /> Negotiate
              </Button>
            )}
          </div>
          {locked && <p className="mt-2 text-xs text-ink-500">The price can no longer change once a fee is paid or the application is closed.</p>}
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-ink-900">Fee breakdown {isEditing && draftValid && <span className="ml-1 text-xs font-normal text-brand-700">(live preview)</span>}</p>
          <div className="divide-y divide-ink-100 rounded-xl border border-ink-200">
            <FeeLine label="Renter service fee" hint={`${Math.round(fees.renterFeeRate * 100)}% of rent${renter?.hasTenantPass ? ' · Tenant Pass −20%' : ''}`}
              amount={formatMoney(preview.renterFee, currency)} paid={app.renterFeePaid}
              action={feesDue && !app.renterFeePaid ? <Button size="sm" variant="outline" onClick={() => onMarkFee('renter')}>Mark renter fee received</Button> : null}
              passIcon={renter?.hasTenantPass} />
            <FeeLine label="Owner success fee" hint={`${Math.round(fees.ownerFeeRate * 100)}% of rent`}
              amount={formatMoney(preview.ownerFee, currency)} paid={app.ownerFeePaid}
              action={feesDue && !app.ownerFeePaid ? <Button size="sm" variant="outline" onClick={() => onMarkFee('owner')}>Mark owner fee received</Button> : null} />
            <div className="flex items-center justify-between gap-3 bg-ink-50/70 px-4 py-3">
              <span className="text-sm font-semibold text-ink-900">Platform revenue</span>
              <span className="text-lg font-bold tabular-nums text-ink-900">{formatMoney(total, currency)}</span>
            </div>
          </div>
          <p className="mt-2 text-xs text-ink-400">Minimum fee per side: {formatMoney(fees.minFee, fees.currency)}. Fees are only charged after the owner accepts.</p>
        </div>
      </CardBody>
    </Card>
  )
}

function FeeLine({ label, hint, amount, paid, action, passIcon }: { label: string; hint: string; amount: string; paid: boolean; action: ReactNode; passIcon?: boolean }) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-sm font-medium text-ink-900">{label} {passIcon && <BadgeCheck className="h-3.5 w-3.5 text-brand-700" aria-label="Tenant Pass discount" />}</p>
          <p className="text-xs text-ink-400">{hint}</p>
        </div>
        {paid
          ? <Badge tone="success"><CircleCheck className="h-3 w-3" /> Paid</Badge>
          : <Badge tone="neutral">Unpaid</Badge>}
        <span className="w-20 shrink-0 text-right font-semibold tabular-nums text-ink-900">{amount}</span>
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
