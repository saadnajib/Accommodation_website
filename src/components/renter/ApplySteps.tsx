import type { ReactNode } from 'react'
import { AlertTriangle, BadgeCheck, CalendarDays, Info, Lock, Pencil, PiggyBank, RefreshCw, ScrollText, ShieldCheck, Upload } from 'lucide-react'
import type { Application, FeeSettings, Listing, User } from '@/types'
import { Badge, Checkbox, Input, Select, Textarea, Toggle } from '@/components/ui'
import { AGREEMENT_CLAUSES, computeFees } from '@/lib/fees'
import { cn, formatDate, formatMoney } from '@/lib/utils'
import { ID_TYPE_LABELS } from '@/components/shared/applicationUtils'
import { FileField } from './FileField'
import { TenantPassCard } from './TenantPassCard'
import { MIN_ABOUT, MIN_MESSAGE, STEPS, minMoveIn, type ApplyDraft, type Errors } from './applyDraft'

export interface StepProps {
  draft: ApplyDraft
  set: (patch: Partial<ApplyDraft>) => void
  /** Returns the error for a field only once the user has interacted with it. */
  err: (k: keyof Errors) => string | undefined
  touch: (k: keyof Errors) => void
  listing: Listing
}

function StepTitle({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return (
    <div className="mb-6 flex items-start gap-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">{icon}</span>
      <div>
        <h2 className="text-xl font-bold text-ink-900">{title}</h2>
        <p className="mt-0.5 text-sm text-ink-500">{description}</p>
      </div>
    </div>
  )
}

export function ListingSummary({ listing, className }: { listing: Listing; className?: string }) {
  return (
    <div className={cn('flex items-center gap-3 rounded-xl border border-ink-200 bg-white p-3', className)}>
      <div className="h-16 w-20 shrink-0 overflow-hidden rounded-lg bg-ink-100">
        {listing.images[0] && <img src={listing.images[0]} alt={listing.title} loading="lazy" className="h-full w-full object-cover" />}
      </div>
      <div className="min-w-0">
        <p className="line-clamp-2 text-sm font-semibold text-ink-900">{listing.title}</p>
        <p className="text-xs text-ink-400">{listing.area}, {listing.city}</p>
        <p className="mt-0.5 text-sm font-bold text-ink-900">{formatMoney(listing.price, listing.currency)}<span className="text-xs font-medium text-ink-400"> /month asking</span></p>
      </div>
    </div>
  )
}

/* ---------------- a. Offer ---------------- */

export function OfferStep({ draft, set, err, touch, listing }: StepProps) {
  const price = Number(draft.proposedPrice)
  const lower = Number.isFinite(price) && price > 0 && price < listing.price
  const pct = lower ? Math.round((1 - price / listing.price) * 100) : 0
  return (
    <div>
      <StepTitle icon={<PiggyBank className="h-5 w-5" />} title="Your offer" description="Propose your rent and tell the owner when you'd like to move in." />
      <ListingSummary listing={listing} className="mb-6" />
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Input label="Proposed monthly rent" name="proposedPrice" type="number" inputMode="numeric" min={0}
            left={<span className="text-xs font-semibold">{listing.currency}</span>} className="[&_input]:pl-12"
            value={draft.proposedPrice} onChange={(e) => { set({ proposedPrice: e.target.value }); touch('proposedPrice') }} onBlur={() => touch('proposedPrice')}
            error={err('proposedPrice')} help={`Asking price: ${formatMoney(listing.price, listing.currency)}/month`} />
          {lower && !err('proposedPrice') && (
            <p className={cn('mt-2 flex items-start gap-2 rounded-lg px-3 py-2 text-xs', pct > 10 ? 'bg-amber-50 text-amber-800' : 'bg-sky-50 text-sky-800')}>
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>You're offering {pct}% below asking. Owners are more likely to accept offers within 10% of the asking price.</span>
            </p>
          )}
        </div>
        <Input label="Move-in date" name="moveInDate" type="date" min={minMoveIn(listing)}
          value={draft.moveInDate} onChange={(e) => { set({ moveInDate: e.target.value }); touch('moveInDate') }} onBlur={() => touch('moveInDate')}
          error={err('moveInDate')} help={`Available from ${formatDate(listing.availableFrom)}`} />
        <Input label="Length of stay" hint="(months)" name="stayMonths" type="number" inputMode="numeric" min={listing.minStayMonths}
          value={draft.stayMonths} onChange={(e) => { set({ stayMonths: e.target.value }); touch('stayMonths') }} onBlur={() => touch('stayMonths')}
          error={err('stayMonths')} help={`Minimum stay ${listing.minStayMonths} months`} />
        <Textarea className="sm:col-span-2" label="Message to the owner" name="message" rows={5}
          placeholder="Introduce yourself: why you're moving, who will live there, and why this home suits you."
          value={draft.message} onChange={(e) => { set({ message: e.target.value }); touch('message') }} onBlur={() => touch('message')}
          error={err('message')} help={err('message') ? undefined : `${draft.message.trim().length} characters (min. ${MIN_MESSAGE}) · shared with the owner after verification`} />
      </div>
    </div>
  )
}

/* ---------------- b. Agreement ---------------- */

export function FeeEstimate({ price, fees, user, currency }: { price: number; fees: FeeSettings; user: User; currency: string }) {
  const valid = Number.isFinite(price) && price > 0
  const { renterFee } = computeFees(valid ? price : 0, fees, { hasTenantPass: user.hasTenantPass })
  const withoutPass = computeFees(valid ? price : 0, fees).renterFee
  return (
    <div className="rounded-2xl border border-brand-200 bg-brand-50/60 p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-brand-800">Your service fee estimate</p>
      <div className="mt-1 flex flex-wrap items-baseline gap-2">
        <p className="text-3xl font-bold text-ink-900">{formatMoney(renterFee, currency)}</p>
        {user.hasTenantPass && withoutPass !== renterFee && <p className="text-sm text-ink-400 line-through">{formatMoney(withoutPass, currency)}</p>}
        {user.hasTenantPass && <Badge tone="success">Tenant Pass −20%</Badge>}
      </div>
      <p className="mt-1 text-xs text-ink-500">
        {Math.round(fees.renterFeeRate * 100)}% of one month's rent (min. {formatMoney(fees.minFee, currency)}), based on your offer of {valid ? formatMoney(price, currency) : '—'}.
      </p>
      <p className="mt-3 flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-brand-800">
        <ShieldCheck className="h-4 w-4 shrink-0" /> Charged only if the owner accepts you
      </p>
    </div>
  )
}

export function AgreementStep({ draft, set, err, touch, listing, fees, user }: StepProps & { fees: FeeSettings; user: User }) {
  const checked = draft.clauses.filter(Boolean).length
  const toggle = (i: number, v: boolean) => {
    const clauses = draft.clauses.map((c, j) => (j === i ? v : c))
    set({ clauses, acceptAll: clauses.every(Boolean) ? draft.acceptAll : false })
    touch('clauses')
  }
  return (
    <div>
      <StepTitle icon={<ScrollText className="h-5 w-5" />} title="Accommodation agreement" description="Read and confirm each clause. StayBridge stays in the middle until both sides are ready." />
      <div className="rounded-2xl border border-ink-200 bg-ink-50/60">
        <div className="flex items-center justify-between gap-2 border-b border-ink-200 px-4 py-3">
          <p className="text-sm font-semibold text-ink-900">StayBridge Accommodation Agreement</p>
          <span className={cn('text-xs font-semibold', checked === AGREEMENT_CLAUSES.length ? 'text-emerald-700' : 'text-ink-400')}>{checked}/{AGREEMENT_CLAUSES.length} confirmed</span>
        </div>
        <div className="max-h-80 space-y-2 overflow-y-auto p-3 sm:p-4" tabIndex={0} aria-label="Agreement clauses">
          {AGREEMENT_CLAUSES.map((c, i) => (
            <Checkbox key={i} checked={draft.clauses[i] ?? false} onChange={(e) => toggle(i, e.target.checked)}
              label={<span className="font-normal text-ink-700"><span className="mr-1 font-semibold text-ink-900">{i + 1}.</span>{c}</span>} />
          ))}
        </div>
      </div>
      {err('clauses') && <p className="mt-2 text-xs text-red-600">{err('clauses')}</p>}
      <Checkbox className="mt-4 border-2 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60" disabled={checked < AGREEMENT_CLAUSES.length}
        checked={draft.acceptAll} onChange={(e) => { set({ acceptAll: e.target.checked }); touch('acceptAll') }}
        label="I accept the accommodation agreement"
        description={checked < AGREEMENT_CLAUSES.length ? 'Confirm every clause above first.' : `Accepted on ${formatDate(new Date().toISOString())} for "${listing.title}".`} />
      {err('acceptAll') && checked === AGREEMENT_CLAUSES.length && <p className="mt-2 text-xs text-red-600">{err('acceptAll')}</p>}

      <div className="mt-6 grid gap-4">
        <FeeEstimate price={Number(draft.proposedPrice)} fees={fees} user={user} currency={listing.currency} />
        {!user.hasTenantPass && <TenantPassCard variant="compact" />}
        <p className="text-xs text-ink-400">The deposit ({formatMoney(listing.deposit, listing.currency)}) is paid directly to the owner under your final rental contract, not to StayBridge.</p>
      </div>
    </div>
  )
}

/* ---------------- c. Verify ---------------- */

export function VerifyStep({ draft, set, err, touch, previous }: StepProps & { previous?: Application }) {
  const v = previous?.verification
  return (
    <div>
      <StepTitle icon={<BadgeCheck className="h-5 w-5" />} title="Verify your identity" description="Owners only ever see verified renters. Your documents are reviewed by the StayBridge team and never shared." />
      {v && (
        <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-700"><BadgeCheck className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-ink-900">You're already verified</p>
              <p className="text-sm text-ink-500">We can reuse the documents from your last application ({formatDate(v.submittedAt)}).</p>
              <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                <div className="flex gap-2"><dt className="text-ink-400">Document</dt><dd className="font-medium text-ink-800">{ID_TYPE_LABELS[v.idType]}</dd></div>
                <div className="flex gap-2"><dt className="text-ink-400">Number</dt><dd className="font-mono font-medium text-ink-800">{v.idNumberMasked}</dd></div>
                <div className="flex min-w-0 gap-2"><dt className="text-ink-400">ID file</dt><dd className="truncate font-medium text-ink-800">{v.idDocumentName}</dd></div>
                <div className="flex min-w-0 gap-2"><dt className="text-ink-400">Selfie</dt><dd className="truncate font-medium text-ink-800">{v.selfieName}</dd></div>
                {v.proofOfIncomeName && <div className="flex min-w-0 gap-2 sm:col-span-2"><dt className="text-ink-400">Income</dt><dd className="truncate font-medium text-ink-800">{v.proofOfIncomeName}</dd></div>}
              </dl>
            </div>
          </div>
          <div role="radiogroup" aria-label="Verification method" className="mt-4 grid gap-2 sm:grid-cols-2">
            {([['reuse', 'Reuse my verification', 'Fastest — no uploads needed', RefreshCw], ['new', 'Upload new documents', 'If your ID or income changed', Upload]] as const).map(([mode, label, desc, Icon]) => (
              <button key={mode} type="button" role="radio" aria-checked={draft.verifyMode === mode} onClick={() => set({ verifyMode: mode })}
                className={cn('flex items-start gap-3 rounded-xl border bg-white p-3 text-left transition-colors',
                  draft.verifyMode === mode ? 'border-brand-600 ring-2 ring-brand-500/25' : 'border-ink-200 hover:border-ink-300')}>
                <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', draft.verifyMode === mode ? 'text-brand-700' : 'text-ink-400')} />
                <span><span className="block text-sm font-semibold text-ink-900">{label}</span><span className="block text-xs text-ink-500">{desc}</span></span>
              </button>
            ))}
          </div>
        </div>
      )}
      {draft.verifyMode === 'new' && (
        <div className="grid gap-5 sm:grid-cols-2">
          <Select label="Document type" name="idType" placeholder="Select…" value={draft.idType}
            options={Object.entries(ID_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
            onChange={(e) => { set({ idType: e.target.value as ApplyDraft['idType'] }); touch('idType') }} onBlur={() => touch('idType')} error={err('idType')} />
          <Input label="Document number" name="idNumber" autoComplete="off" spellCheck={false} value={draft.idNumber}
            onChange={(e) => { set({ idNumber: e.target.value.toUpperCase() }); touch('idNumber') }} onBlur={() => touch('idNumber')}
            error={err('idNumber')} help="Stored masked — only the last 4 characters are kept." right={<Lock className="h-4 w-4" />} />
          <FileField label="ID document" hint="Clear photo or scan of the photo page" value={draft.idDocument}
            onChange={(f) => { set({ idDocument: f }); touch('idDocument') }} error={err('idDocument')} />
          <FileField label="Selfie" hint="A clear photo of your face" accept="image/*" value={draft.selfie}
            onChange={(f) => { set({ selfie: f }); touch('selfie') }} error={err('selfie')} />
          <div className="sm:col-span-2">
            <FileField label="Proof of income" optional hint="Payslip, contract or bank statement — boosts owner confidence" value={draft.income}
              onChange={(f) => { set({ income: f }); touch('income') }} error={err('income')} />
          </div>
          <p className="flex items-start gap-2 rounded-lg bg-ink-100/70 px-3 py-2 text-xs text-ink-500 sm:col-span-2">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Demo mode: only file names are recorded, nothing is uploaded.
          </p>
        </div>
      )}
    </div>
  )
}

/* ---------------- d. About ---------------- */

export function AffordabilityHint({ income, price, currency }: { income: number; price: number; currency: string }) {
  if (!(income > 0) || !(price > 0)) return null
  const r = income / price
  const tone = r >= 3 ? 'green' : r >= 2 ? 'amber' : 'red'
  const styles = {
    green: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    red: 'border-red-200 bg-red-50 text-red-800',
  }[tone]
  const msg = tone === 'green' ? 'Great — comfortably affordable.' : tone === 'amber' ? 'Borderline. Owners typically expect 2.5–3x.' : 'Owners typically expect 2.5–3x. Consider adding a guarantor in references.'
  const pct = Math.min(100, (r / 4) * 100)
  return (
    <div className={cn('rounded-xl border p-3', styles)}>
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="font-semibold">Income is {r.toFixed(1)}x your rent</span>
        <span className="text-xs">{formatMoney(income, currency)} / {formatMoney(price, currency)}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/70">
        <div className={cn('h-full rounded-full transition-all', tone === 'green' ? 'bg-emerald-500' : tone === 'amber' ? 'bg-amber-500' : 'bg-red-500')} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 flex items-start gap-1.5 text-xs">{tone !== 'green' && <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />}{msg}</p>
    </div>
  )
}

export function AboutStep({ draft, set, err, touch, listing }: StepProps) {
  return (
    <div>
      <StepTitle icon={<Info className="h-5 w-5" />} title="About you" description="Help the owner get to know you. Your full name and contact details stay private until contact is unlocked." />
      <div className="grid gap-5 sm:grid-cols-2">
        <Input label="Occupation" name="occupation" placeholder="e.g. Nurse, Software engineer, Student" value={draft.occupation}
          onChange={(e) => { set({ occupation: e.target.value }); touch('occupation') }} onBlur={() => touch('occupation')} error={err('occupation')} />
        <Input label="Employer or school" hint="(optional)" name="employer" value={draft.employer} onChange={(e) => set({ employer: e.target.value })} />
        <Input label="Monthly net income" name="monthlyIncome" type="number" inputMode="numeric" min={0}
          left={<span className="text-xs font-semibold">{listing.currency}</span>} className="[&_input]:pl-12"
          value={draft.monthlyIncome} onChange={(e) => { set({ monthlyIncome: e.target.value }); touch('monthlyIncome') }} onBlur={() => touch('monthlyIncome')} error={err('monthlyIncome')} />
        <Input label="Number of occupants" name="occupants" type="number" inputMode="numeric" min={1} max={12}
          value={draft.occupants} onChange={(e) => { set({ occupants: e.target.value }); touch('occupants') }} onBlur={() => touch('occupants')} error={err('occupants')} />
        <div className="sm:col-span-2">
          <AffordabilityHint income={Number(draft.monthlyIncome)} price={Number(draft.proposedPrice)} currency={listing.currency} />
        </div>
        <div className="flex flex-wrap gap-x-8 gap-y-3 sm:col-span-2">
          <Toggle checked={draft.hasPets} onChange={(v) => set({ hasPets: v })} label="I have pets" />
          <Toggle checked={draft.smoker} onChange={(v) => set({ smoker: v })} label="I smoke" />
        </div>
        {(draft.hasPets && listing.houseRules.includes('No pets')) || (draft.smoker && listing.houseRules.includes('No smoking')) ? (
          <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 sm:col-span-2">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> This home's house rules include {[draft.hasPets && listing.houseRules.includes('No pets') && '"No pets"', draft.smoker && listing.houseRules.includes('No smoking') && '"No smoking"'].filter(Boolean).join(' and ')}. Be upfront in your message.
          </p>
        ) : null}
        <Textarea className="sm:col-span-2" label="About me" name="aboutMe" rows={5}
          placeholder="Your lifestyle, routines, hobbies, and what kind of housemate or tenant you are."
          value={draft.aboutMe} onChange={(e) => { set({ aboutMe: e.target.value }); touch('aboutMe') }} onBlur={() => touch('aboutMe')}
          error={err('aboutMe')} help={err('aboutMe') ? undefined : `${draft.aboutMe.trim().length} characters (min. ${MIN_ABOUT})`} />
        <Textarea className="sm:col-span-2" label="References" hint="(optional)" name="references" rows={2}
          placeholder="Previous landlord, employer, or guarantor — available on request."
          value={draft.references} onChange={(e) => set({ references: e.target.value })} />
      </div>
    </div>
  )
}

/* ---------------- e. Review ---------------- */

function ReviewSection({ title, step, onEdit, children }: { title: string; step: number; onEdit: (s: number) => void; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-ink-200 bg-white">
      <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
        <h3 className="text-sm font-semibold text-ink-900">{title}</h3>
        <button type="button" onClick={() => onEdit(step)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50">
          <Pencil className="h-3.5 w-3.5" /> Edit
        </button>
      </div>
      <dl className="grid gap-x-6 gap-y-3 px-4 py-3 text-sm sm:grid-cols-2">{children}</dl>
    </section>
  )
}

function Row({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={cn('min-w-0', wide && 'sm:col-span-2')}>
      <dt className="text-xs text-ink-400">{label}</dt>
      <dd className="mt-0.5 break-words font-medium text-ink-800">{children}</dd>
    </div>
  )
}

export function ReviewStep({ draft, listing, onEdit, previous, fees, user }: { draft: ApplyDraft; listing: Listing; onEdit: (s: number) => void; previous?: Application; fees: FeeSettings; user: User }) {
  const price = Number(draft.proposedPrice)
  const v = draft.verifyMode === 'reuse' ? previous?.verification : undefined
  return (
    <div>
      <StepTitle icon={<CalendarDays className="h-5 w-5" />} title="Review & submit" description="Check everything before we send it to the StayBridge team for verification." />
      <div className="space-y-4">
        <ReviewSection title={STEPS[0]} step={0} onEdit={onEdit}>
          <Row label="Home">{listing.title}</Row>
          <Row label="Proposed rent">{formatMoney(price, listing.currency)}/month {price !== listing.price && <span className="text-xs font-normal text-ink-400">(asking {formatMoney(listing.price, listing.currency)})</span>}</Row>
          <Row label="Move-in">{formatDate(`${draft.moveInDate}T12:00:00`)}</Row>
          <Row label="Stay">{draft.stayMonths} months</Row>
          <Row label="Message" wide><span className="whitespace-pre-line font-normal text-ink-600">{draft.message}</span></Row>
        </ReviewSection>
        <ReviewSection title={STEPS[1]} step={1} onEdit={onEdit}>
          <Row label="Agreement">{draft.acceptAll ? `All ${AGREEMENT_CLAUSES.length} clauses accepted` : 'Not accepted'}</Row>
          <Row label="Service fee (if accepted)">{formatMoney(computeFees(price, fees, { hasTenantPass: user.hasTenantPass }).renterFee, listing.currency)}{user.hasTenantPass && <span className="text-xs font-normal text-emerald-700"> · Tenant Pass applied</span>}</Row>
        </ReviewSection>
        <ReviewSection title={STEPS[2]} step={2} onEdit={onEdit}>
          {v ? (
            <>
              <Row label="Method">Reusing previous verification</Row>
              <Row label="Document">{ID_TYPE_LABELS[v.idType]} · <span className="font-mono">{v.idNumberMasked}</span></Row>
            </>
          ) : (
            <>
              <Row label="Document">{draft.idType ? ID_TYPE_LABELS[draft.idType] : '—'} · <span className="font-mono">{draft.idNumber ? '•'.repeat(Math.max(0, draft.idNumber.length - 4)) + draft.idNumber.slice(-4) : '—'}</span></Row>
              <Row label="ID file">{draft.idDocument?.name ?? '—'}</Row>
              <Row label="Selfie">{draft.selfie?.name ?? '—'}</Row>
              <Row label="Proof of income">{draft.income?.name ?? 'Not provided'}</Row>
            </>
          )}
        </ReviewSection>
        <ReviewSection title={STEPS[3]} step={3} onEdit={onEdit}>
          <Row label="Occupation">{draft.occupation}{draft.employer && ` at ${draft.employer}`}</Row>
          <Row label="Monthly income">{formatMoney(Number(draft.monthlyIncome), listing.currency)} <span className="text-xs font-normal text-ink-400">({(Number(draft.monthlyIncome) / price).toFixed(1)}x rent)</span></Row>
          <Row label="Occupants">{draft.occupants}</Row>
          <Row label="Pets / smoking">{draft.hasPets ? 'Has pets' : 'No pets'} · {draft.smoker ? 'Smoker' : 'Non-smoker'}</Row>
          <Row label="About me" wide><span className="whitespace-pre-line font-normal text-ink-600">{draft.aboutMe}</span></Row>
          {draft.references && <Row label="References" wide>{draft.references}</Row>}
        </ReviewSection>
        <div className="flex items-start gap-3 rounded-xl bg-brand-50 p-4 text-sm text-brand-900">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-700" />
          <p>After you submit, our team verifies your details (usually within 24 hours{user.hasTenantPass ? ' — you have priority review' : ''}), then presents you to the owner. You'll only pay if the owner accepts.</p>
        </div>
      </div>
    </div>
  )
}
