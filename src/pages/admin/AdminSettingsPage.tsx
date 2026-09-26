import { useMemo, useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { BadgeCheck, Database, Percent, RotateCcw, Save, ScrollText } from 'lucide-react'
import { Button, Card, CardBody, CardHeader, Input, PageHeader } from '@/components/ui'
import { useStore } from '@/store/useStore'
import { AGREEMENT_CLAUSES, DEFAULT_FEES, computeFees } from '@/lib/fees'
import { formatMoney } from '@/lib/utils'
import type { FeeSettings } from '@/types'
import { ActionModal } from '@/components/admin/ActionModal'

interface Draft { renterFeeRate: string; ownerFeeRate: string; minFee: string; tenantPassPrice: string; featuredListingPrice: string }

const toDraft = (f: FeeSettings): Draft => ({
  renterFeeRate: String(+(f.renterFeeRate * 100).toFixed(2)),
  ownerFeeRate: String(+(f.ownerFeeRate * 100).toFixed(2)),
  minFee: String(f.minFee),
  tenantPassPrice: String(f.tenantPassPrice),
  featuredListingPrice: String(f.featuredListingPrice),
})

const PREVIEW_RENTS = [500, 1000, 2000, 3500]

export default function AdminSettingsPage() {
  const fees = useStore((s) => s.fees)
  const updateFees = useStore((s) => s.updateFees)
  const resetDemo = useStore((s) => s.resetDemo)
  const toast = useStore((s) => s.toast)
  const navigate = useNavigate()
  const [draft, setDraft] = useState<Draft>(() => toDraft(fees))
  const [confirmReset, setConfirmReset] = useState(false)

  const errors = useMemo(() => {
    const e: Partial<Record<keyof Draft, string>> = {}
    const num = (k: keyof Draft) => Number(draft[k])
    ;(['renterFeeRate', 'ownerFeeRate'] as const).forEach((k) => {
      if (draft[k].trim() === '' || !Number.isFinite(num(k)) || num(k) < 0 || num(k) > 100) e[k] = 'Enter 0–100%'
    })
    ;(['minFee', 'tenantPassPrice', 'featuredListingPrice'] as const).forEach((k) => {
      if (draft[k].trim() === '' || !Number.isFinite(num(k)) || num(k) < 0) e[k] = 'Enter a positive amount'
    })
    return e
  }, [draft])
  const valid = Object.keys(errors).length === 0

  const parsed: FeeSettings = valid ? {
    ...fees,
    renterFeeRate: Number(draft.renterFeeRate) / 100,
    ownerFeeRate: Number(draft.ownerFeeRate) / 100,
    minFee: Math.round(Number(draft.minFee)),
    tenantPassPrice: Math.round(Number(draft.tenantPassPrice)),
    featuredListingPrice: Math.round(Number(draft.featuredListingPrice)),
  } : fees
  const dirty = JSON.stringify(toDraft(fees)) !== JSON.stringify(draft)
  const cur = fees.currency

  const set = (k: keyof Draft) => (e: ChangeEvent<HTMLInputElement>) => setDraft((d) => ({ ...d, [k]: e.target.value }))

  const save = () => {
    if (!valid) return
    updateFees(parsed)
    setDraft(toDraft(parsed))
    toast({ title: 'Fee settings saved', body: 'New applications use these rates. Existing fees update when the agreed price changes.', tone: 'success' })
  }
  const resetDefaults = () => {
    updateFees(DEFAULT_FEES)
    setDraft(toDraft(DEFAULT_FEES))
    toast({ title: 'Fees reset to defaults', tone: 'info' })
  }

  return (
    <div>
      <PageHeader title="Fees & settings" description="Control StayBridge’s pricing and demo environment." />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Service fees" description="Charged to each side only after the owner accepts. Calculated on one month of agreed rent." />
          <CardBody>
            <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); save() }} noValidate>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input id="renterFeeRate" label="Renter service fee" hint="% of rent" type="number" min={0} max={100} step={0.5} inputMode="decimal"
                  right={<Percent className="h-4 w-4" />} value={draft.renterFeeRate} onChange={set('renterFeeRate')} error={errors.renterFeeRate} />
                <Input id="ownerFeeRate" label="Owner success fee" hint="% of rent" type="number" min={0} max={100} step={0.5} inputMode="decimal"
                  right={<Percent className="h-4 w-4" />} value={draft.ownerFeeRate} onChange={set('ownerFeeRate')} error={errors.ownerFeeRate} />
                <Input id="minFee" label="Minimum fee per side" hint={cur} type="number" min={0} inputMode="numeric"
                  value={draft.minFee} onChange={set('minFee')} error={errors.minFee} />
                <Input id="tenantPassPrice" label="Verified Tenant Pass" hint={`${cur}, one-off`} type="number" min={0} inputMode="numeric"
                  value={draft.tenantPassPrice} onChange={set('tenantPassPrice')} error={errors.tenantPassPrice} />
                <Input id="featuredListingPrice" label="Featured listing (30 days)" hint={cur} type="number" min={0} inputMode="numeric"
                  value={draft.featuredListingPrice} onChange={set('featuredListingPrice')} error={errors.featuredListingPrice} />
              </div>
              <div className="flex flex-wrap items-center gap-2 border-t border-ink-100 pt-4">
                <Button type="submit" disabled={!valid || !dirty}><Save className="h-4 w-4" /> Save changes</Button>
                <Button type="button" variant="outline" disabled={!dirty} onClick={() => setDraft(toDraft(fees))}>Discard</Button>
                <Button type="button" variant="ghost" className="sm:ml-auto" onClick={resetDefaults}><RotateCcw className="h-4 w-4" /> Reset to defaults</Button>
              </div>
            </form>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Live preview" description={dirty ? 'Showing your unsaved changes' : 'Current settings'} />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-ink-100 bg-ink-50/70 text-xs uppercase tracking-wide text-ink-400">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium">Rent</th>
                  <th className="px-2 py-2.5 text-right font-medium">Renter</th>
                  <th className="px-2 py-2.5 text-right font-medium"><span className="inline-flex items-center gap-1"><BadgeCheck className="h-3.5 w-3.5" /> w/ Pass</span></th>
                  <th className="px-2 py-2.5 text-right font-medium">Owner</th>
                  <th className="px-4 py-2.5 text-right font-medium">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 tabular-nums">
                {PREVIEW_RENTS.map((rent) => {
                  const std = computeFees(rent, parsed)
                  const pass = computeFees(rent, parsed, { hasTenantPass: true })
                  return (
                    <tr key={rent}>
                      <td className="px-4 py-2.5 font-medium text-ink-900">{formatMoney(rent, cur)}</td>
                      <td className="px-2 py-2.5 text-right text-ink-700">{formatMoney(std.renterFee, cur)}</td>
                      <td className="px-2 py-2.5 text-right text-brand-700">{formatMoney(pass.renterFee, cur)}</td>
                      <td className="px-2 py-2.5 text-right text-ink-700">{formatMoney(std.ownerFee, cur)}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-ink-900">
                        {formatMoney(std.renterFee + std.ownerFee, cur)}
                        <span className="block text-[11px] font-normal text-ink-400">{formatMoney(pass.renterFee + pass.ownerFee, cur)} w/ Pass</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <CardBody className="text-xs text-ink-400">
            Tenant Pass holders get 20% off the renter fee. Minimum fee applies before the discount.
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={<span className="inline-flex items-center gap-2"><ScrollText className="h-4 w-4 text-ink-400" /> Agreement clauses</span>}
            description="Shown to every renter before they apply. Read-only." />
          <CardBody>
            <ol className="list-decimal space-y-2 pl-5 text-sm text-ink-700 marker:font-semibold marker:text-ink-400">
              {AGREEMENT_CLAUSES.map((c) => <li key={c}>{c}</li>)}
            </ol>
          </CardBody>
        </Card>

        <Card className="self-start border-red-200">
          <CardHeader title={<span className="inline-flex items-center gap-2"><Database className="h-4 w-4 text-ink-400" /> Demo data</span>}
            description="Restore all users, listings, applications and fees to the original demo state." />
          <CardBody>
            <Button variant="danger" onClick={() => setConfirmReset(true)}><RotateCcw className="h-4 w-4" /> Reset demo data</Button>
            <p className="mt-2 text-xs text-ink-400">You will be signed out.</p>
          </CardBody>
        </Card>
      </div>

      <ActionModal
        open={confirmReset}
        noNote
        onClose={() => setConfirmReset(false)}
        title="Reset demo data?"
        body="All changes made in this browser — applications, listings, messages and fee settings — are replaced with the original demo data, and you are signed out."
        confirmLabel="Reset everything"
        variant="danger"
        onConfirm={() => {
          resetDemo()
          navigate('/login')
          toast({ title: 'Demo data reset', body: 'Sign in with any demo account to continue.', tone: 'info' })
        }}
      />
    </div>
  )
}
