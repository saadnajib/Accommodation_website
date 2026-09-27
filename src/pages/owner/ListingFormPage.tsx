import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import {
  AlertTriangle, ArrowLeft, ArrowRight, Check, Clock, ImagePlus, Info, Lock, RotateCcw, Send,
} from 'lucide-react'
import { useCurrentUser, useListing, useLoad, useStore } from '@/store/useStore'
import { isApiError } from '@/lib/api'
import type { Listing } from '@/types'
import {
  Badge, Button, Card, CardBody, Input, Label, ListingStatusBadge, PageHeader, Select, Stepper, Textarea, Toggle,
} from '@/components/ui'
import { Chip, Thumb } from '@/components/owner/OwnerUi'
import { PhotoUploader } from '@/components/owner/PhotoUploader'
import { ListingPreviewCard } from '@/components/owner/ListingPreview'
import {
  MAX_PHOTOS, MIN_STAY_OPTIONS, STEPS, clearDraft, emptyForm, firstInvalidStep, formFromListing, loadDraft, saveDraft,
  stepValid, toListingInput, todayInput, validate, type ListingFormState,
} from '@/components/owner/listingForm'
import { SAMPLE_PHOTOS, propertyTypeLabel } from '@/components/owner/utils'
import { AMENITIES, HOUSE_RULES, PROPERTY_TYPES } from '@/lib/status'
import { computeFees } from '@/lib/fees'
import { cn, formatDate, formatMoney } from '@/lib/utils'

export default function ListingFormPage() {
  const { id } = useParams<{ id: string }>()
  const me = useCurrentUser()
  const listing = useListing(id)
  const fetchListing = useStore((s) => s.fetchListing)
  // Always load the owner's full copy (with the private address) before editing.
  const { loading } = useLoad(() => (id ? fetchListing(id) : Promise.resolve(undefined)), [id, fetchListing])
  if (id && loading) {
    return <div className="flex min-h-[40vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-200 border-t-brand-700" aria-label="Loading" /></div>
  }
  if (id && (!listing || listing.ownerId !== me?.id)) return <Navigate to="/owner/listings" replace />
  return <ListingForm key={id ?? 'new'} listing={id ? listing ?? undefined : undefined} />
}

function ListingForm({ listing }: { listing?: Listing }) {
  const isEdit = !!listing

  const [init] = useState(() => {
    if (isEdit) return { form: listing ? formFromListing(listing) : emptyForm(), step: 0, restored: false }
    const d = loadDraft()
    if (d) return { form: d.form, step: Math.min(d.step, firstInvalidStep(validate(d.form))), restored: true }
    return { form: emptyForm(), step: 0, restored: false }
  })
  const [form, setForm] = useState<ListingFormState>(init.form)
  const [step, setStep] = useState(init.step)
  const [restored, setRestored] = useState(init.restored)
  const [touched, setTouched] = useState<Set<string>>(() => new Set())
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<'draft' | 'submit' | null>(null)

  const createListing = useStore((s) => s.createListing)
  const updateListing = useStore((s) => s.updateListing)
  const toast = useStore((s) => s.toast)
  const fees = useStore((s) => s.fees)
  const nav = useNavigate()

  const errors = useMemo(() => ({ ...validate(form), ...serverErrors }), [form, serverErrors])
  const canNext = stepValid(step, errors)

  // Persist new-listing drafts for this browser session.
  useEffect(() => {
    if (!isEdit) saveDraft(form, step)
  }, [form, step, isEdit])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [step])

  const clearServer = (key: string) => setServerErrors((e) => {
    if (!(key in e)) return e
    const next = { ...e }
    delete next[key]
    return next
  })
  const set = <K extends keyof ListingFormState>(key: K, value: ListingFormState[K]) => { setForm((f) => ({ ...f, [key]: value })); clearServer(key) }
  const touch = (key: string) => setTouched((t) => (t.has(key) ? t : new Set(t).add(key)))
  const err = (key: string) => (touched.has(key) ? errors[key] : undefined)

  const setPrice = (v: string) => {
    const clean = v.replace(/\D/g, '')
    setForm((f) => ({ ...f, price: clean, deposit: f.depositTouched ? f.deposit : clean ? String(Number(clean) * 2) : '' }))
  }
  const toggleIn = (key: 'amenities' | 'houseRules', value: string) =>
    setForm((f) => ({ ...f, [key]: f[key].includes(value) ? f[key].filter((x) => x !== value) : [...f[key], value] }))

  const setImages = (fn: (prev: string[]) => string[]) => { setForm((f) => ({ ...f, images: fn(f.images) })); clearServer('images') }
  const addSamples = () => {
    setForm((f) => {
      const fresh = SAMPLE_PHOTOS.filter((p) => !f.images.includes(p)).slice(0, 3)
      return { ...f, images: [...f.images, ...fresh].slice(0, MAX_PHOTOS) }
    })
    toast({ title: 'Sample photos added', body: 'Replace them with photos of your home before publishing for real.', tone: 'info' })
  }

  const next = () => {
    if (step === 3) touch('images')
    if (!canNext) return
    setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }
  const back = () => setStep((s) => Math.max(0, s - 1))

  const startOver = () => {
    clearDraft()
    setForm(emptyForm())
    setStep(0)
    setTouched(new Set())
    setRestored(false)
  }

  const liveStatuses = ['active', 'paused', 'rented']
  const keepsStatus = isEdit && !!listing && liveStatuses.includes(listing.status)

  const save = async (mode: 'draft' | 'submit') => {
    if (saving) return
    const localErrors = validate(form)
    if (mode === 'submit' && Object.keys(localErrors).length) {
      setStep(firstInvalidStep(localErrors))
      toast({ title: 'Some details are missing', body: 'Please complete the highlighted fields.', tone: 'error' })
      return
    }
    const data = toListingInput(form)
    setSaving(mode)
    try {
      if (!listing) {
        const created = await createListing({ ...data, status: mode === 'draft' ? 'draft' : 'pending_review' })
        clearDraft()
        toast(mode === 'draft'
          ? { title: 'Draft saved', body: `“${created.title}” is saved. Submit it for review whenever you're ready.`, tone: 'success' }
          : { title: 'Submitted for review', body: 'Our team usually reviews new listings within 24 hours.', tone: 'success' })
      } else if (keepsStatus || mode === 'draft' || listing.status === 'pending_review') {
        // Owners can't move a listing back to draft; saving keeps its current status.
        await updateListing(listing.id, data)
        toast({ title: 'Changes saved', body: keepsStatus ? 'Your listing has been updated.' : undefined, tone: 'success' })
      } else {
        // draft / rejected → pending_review
        await updateListing(listing.id, { ...data, status: 'pending_review' })
        toast({ title: 'Submitted for review', body: 'Our team usually reviews listings within 24 hours.', tone: 'success' })
      }
      nav('/owner/listings')
    } catch (e) {
      if (isApiError(e)) {
        const fe = e.fieldErrors
        if (Object.keys(fe).length) {
          // "images" issues carry the offending URL as message; show a friendly line instead.
          const mapped = Object.fromEntries(Object.entries(fe).map(([k, v]) => {
            const key = k.split('.')[0]
            return [key, key === 'images' ? `${e.message}.` : v]
          }))
          setServerErrors(mapped)
          setTouched((t) => new Set([...t, ...Object.keys(mapped)]))
          setStep(firstInvalidStep(mapped))
        }
      }
    } finally {
      setSaving(null)
    }
  }

  const price = Number(form.price) || 0
  const ownerFee = computeFees(price, fees).ownerFee
  const photos = form.images.map((x) => x.trim()).filter(Boolean)

  return (
    <div className="mx-auto max-w-4xl">
      <Link to="/owner/listings" className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-ink-500 hover:text-ink-900">
        <ArrowLeft className="h-4 w-4" /> My listings
      </Link>
      <PageHeader
        title={isEdit ? 'Edit listing' : 'Post a new listing'}
        description={isEdit ? listing?.title : 'Tell renters about your home. We review every listing before it goes live.'}
        action={isEdit && listing ? <ListingStatusBadge status={listing.status} /> : undefined}
      />

      {isEdit && listing?.status === 'rejected' && (
        <Banner tone="danger" icon={<AlertTriangle className="h-5 w-5" />}>
          <span className="font-semibold">Changes requested by StayBridge:</span> {listing.rejectionReason ?? 'Please review your listing details.'}
        </Banner>
      )}
      {isEdit && listing?.status === 'pending_review' && (
        <Banner tone="info" icon={<Clock className="h-5 w-5" />}>This listing is waiting for review. You can still make changes.</Banner>
      )}
      {isEdit && keepsStatus && (
        <Banner tone="info" icon={<Info className="h-5 w-5" />}>Edits to a published listing apply immediately — it won't go back into review.</Banner>
      )}
      {restored && (
        <Banner tone="info" icon={<RotateCcw className="h-5 w-5" />}>
          <span className="flex flex-wrap items-center justify-between gap-2">
            We restored your unsaved draft from this session.
            <button type="button" onClick={startOver} className="font-semibold text-brand-800 underline-offset-2 hover:underline">Start over</button>
          </span>
        </Banner>
      )}

      <Card className="mb-5 px-4 py-3 sm:px-5">
        <Stepper steps={STEPS} current={step} />
      </Card>

      <Card>
        <CardBody className="p-5 sm:p-7">
          {step === 0 && (
            <div className="grid gap-5">
              <StepTitle title="The basics" subtitle="A clear title and honest description get the best applicants." />
              <Input
                label="Listing title" name="title" placeholder="e.g. Bright 2-bed apartment near the park"
                value={form.title} maxLength={90} onChange={(e) => set('title', e.target.value)} onBlur={() => touch('title')}
                error={err('title')} help={!err('title') ? `${form.title.trim().length}/90 · at least 10 characters` : undefined}
              />
              <div>
                <Label>Property type</Label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5" role="radiogroup" aria-label="Property type">
                  {PROPERTY_TYPES.map((t) => (
                    <button
                      key={t.value} type="button" role="radio" aria-checked={form.type === t.value}
                      onClick={() => { set('type', t.value); touch('type') }}
                      className={cn('rounded-xl border px-3 py-3 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                        form.type === t.value ? 'border-brand-600 bg-brand-50 text-brand-800 shadow-sm' : 'border-ink-200 bg-white text-ink-600 hover:border-ink-300')}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Textarea
                  label="Description" name="description" rows={6}
                  placeholder="What makes your home special? Describe the rooms, light, transport, the neighbourhood and who it suits."
                  value={form.description} onChange={(e) => set('description', e.target.value)} onBlur={() => touch('description')}
                  error={err('description')}
                />
                <p className={cn('mt-1 text-right text-xs', form.description.trim().length >= 80 ? 'text-emerald-600' : 'text-ink-400')}>
                  {form.description.trim().length} characters{form.description.trim().length < 80 ? ` · ${80 - form.description.trim().length} more needed` : ' ✓'}
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="City" name="city" placeholder="e.g. Berlin" value={form.city} onChange={(e) => set('city', e.target.value)} onBlur={() => touch('city')} error={err('city')} />
                <Input label="Area / neighbourhood" name="area" placeholder="e.g. Kreuzberg" value={form.area} onChange={(e) => set('area', e.target.value)} onBlur={() => touch('area')} error={err('area')} />
              </div>
              <div>
                <Input
                  label="Exact address" name="address" placeholder="Street, number, postcode"
                  value={form.address} onChange={(e) => set('address', e.target.value)} onBlur={() => touch('address')} error={err('address')}
                  left={<Lock className="h-4 w-4" />}
                />
                <p className="mt-1.5 flex items-center gap-1.5 text-xs text-ink-500">
                  <Lock className="h-3.5 w-3.5 text-brand-600" /> Only shared after a match is confirmed. Renters see just the area until contact is unlocked.
                </p>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="grid gap-6">
              <StepTitle title="Details" subtitle="Size, layout and what's included." />
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Input label="Bedrooms" name="bedrooms" type="number" inputMode="numeric" min={0} max={20} value={form.bedrooms}
                  onChange={(e) => set('bedrooms', e.target.value)} onBlur={() => touch('bedrooms')} error={err('bedrooms')} help="0 for a studio" />
                <Input label="Bathrooms" name="bathrooms" type="number" inputMode="numeric" min={1} max={10} value={form.bathrooms}
                  onChange={(e) => set('bathrooms', e.target.value)} onBlur={() => touch('bathrooms')} error={err('bathrooms')} />
                <Input label="Size" name="sizeSqm" type="number" inputMode="numeric" min={5} placeholder="e.g. 45" value={form.sizeSqm}
                  onChange={(e) => set('sizeSqm', e.target.value)} onBlur={() => touch('sizeSqm')} error={err('sizeSqm')} right={<span className="text-xs">m²</span>}
                  className="col-span-2 sm:col-span-1" />
              </div>
              <div className="flex items-center justify-between gap-4 rounded-xl border border-ink-200 p-4">
                <div>
                  <p className="text-sm font-semibold text-ink-900">Furnished</p>
                  <p className="text-xs text-ink-500">Beds, storage and a kitchen ready to use.</p>
                </div>
                <Toggle checked={form.furnished} onChange={(v) => set('furnished', v)} label={form.furnished ? 'Yes' : 'No'} />
              </div>
              <div>
                <Label hint={`(${form.amenities.length} selected)`}>Amenities</Label>
                <div className="flex flex-wrap gap-2">
                  {AMENITIES.map((a) => <Chip key={a} selected={form.amenities.includes(a)} onClick={() => toggleIn('amenities', a)}>{a}</Chip>)}
                </div>
              </div>
              <div>
                <Label hint="(optional)">House rules</Label>
                <div className="flex flex-wrap gap-2">
                  {HOUSE_RULES.map((r) => <Chip key={r} selected={form.houseRules.includes(r)} onClick={() => toggleIn('houseRules', r)}>{r}</Chip>)}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="grid gap-5">
              <StepTitle title="Pricing & availability" subtitle="Renters can propose a price — you always make the final call." />
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Monthly rent" name="price" inputMode="numeric" placeholder="e.g. 1200" value={form.price}
                  onChange={(e) => setPrice(e.target.value)} onBlur={() => touch('price')} error={err('price')}
                  left={<span className="text-sm font-semibold">$</span>} right={<span className="text-xs">USD</span>} />
                <div>
                  <Input label="Deposit" name="deposit" inputMode="numeric" value={form.deposit}
                    onChange={(e) => setForm((f) => ({ ...f, deposit: e.target.value.replace(/\D/g, ''), depositTouched: true }))}
                    onBlur={() => touch('deposit')} error={err('deposit')} left={<span className="text-sm font-semibold">$</span>} />
                  <div className="mt-2 flex gap-2">
                    {[1, 2].map((n) => (
                      <button key={n} type="button" disabled={!price}
                        onClick={() => setForm((f) => ({ ...f, deposit: String(price * n), depositTouched: true }))}
                        className={cn('rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors disabled:opacity-40',
                          price && Number(form.deposit) === price * n ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-ink-200 text-ink-600 hover:bg-ink-50')}>
                        {n}× rent
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between gap-4 rounded-xl border border-ink-200 p-4">
                <div>
                  <p className="text-sm font-semibold text-ink-900">Bills included</p>
                  <p className="text-xs text-ink-500">Utilities such as water, heating and internet are part of the rent.</p>
                </div>
                <Toggle checked={form.billsIncluded} onChange={(v) => set('billsIncluded', v)} label={form.billsIncluded ? 'Yes' : 'No'} />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <Input label="Available from" name="availableFrom" type="date" min={isEdit ? undefined : todayInput()} value={form.availableFrom}
                  onChange={(e) => set('availableFrom', e.target.value)} onBlur={() => touch('availableFrom')} error={err('availableFrom')} />
                <Select label="Minimum stay" name="minStayMonths" value={form.minStayMonths}
                  onChange={(e) => set('minStayMonths', Number(e.target.value))}
                  options={MIN_STAY_OPTIONS.map((m) => ({ value: m, label: `${m} month${m > 1 ? 's' : ''}` }))} />
                <Input label="Currency" name="currency" value="USD — US dollar" disabled help="All prices on StayBridge are in USD." />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="grid gap-5">
              <StepTitle title="Photos" subtitle={`Add up to ${MAX_PHOTOS} photos. The first one is your cover.`} />
              <PhotoUploader
                images={form.images} max={MAX_PHOTOS} setImages={setImages} onUseSamples={addSamples}
                error={photos.length > 0 || touched.has('images') ? errors.images : undefined}
              />
            </div>
          )}

          {step === 4 && (
            <div className="grid gap-6">
              <StepTitle title="Review & publish" subtitle="This is how renters will see your listing in search." />
              <div className="grid gap-6 md:grid-cols-[minmax(0,18rem)_1fr]">
                <div>
                  <ListingPreviewCard data={{
                    title: form.title, type: form.type, city: form.city, area: form.area, price, currency: 'USD',
                    bedrooms: Number(form.bedrooms) || 0, bathrooms: Number(form.bathrooms) || 0, sizeSqm: Number(form.sizeSqm) || 0,
                    availableFrom: form.availableFrom, billsIncluded: form.billsIncluded, featured: listing?.featured, image: photos[0],
                  }} />
                  {photos.length > 1 && (
                    <div className="mt-3 grid grid-cols-4 gap-2">
                      {photos.slice(1, 5).map((p, i) => <Thumb key={i} src={p} alt={`Photo ${i + 2}`} className="aspect-square w-full rounded-lg" />)}
                    </div>
                  )}
                </div>
                <div className="min-w-0 space-y-4">
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                    <Fact label="Type" value={form.type ? propertyTypeLabel(form.type) : '—'} />
                    <Fact label="Rent" value={`${formatMoney(price)} / month`} />
                    <Fact label="Deposit" value={formatMoney(Number(form.deposit) || 0)} />
                    <Fact label="Bills" value={form.billsIncluded ? 'Included' : 'Not included'} />
                    <Fact label="Available from" value={form.availableFrom ? formatDate(form.availableFrom) : '—'} />
                    <Fact label="Minimum stay" value={`${form.minStayMonths} month${form.minStayMonths > 1 ? 's' : ''}`} />
                    <Fact label="Furnished" value={form.furnished ? 'Yes' : 'No'} />
                    <Fact label="Photos" value={String(photos.length)} />
                  </dl>
                  <div className="rounded-xl bg-ink-50 p-3 text-sm">
                    <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400"><Lock className="h-3.5 w-3.5" /> Private address</p>
                    <p className="mt-1 text-ink-700">{form.address || '—'}</p>
                  </div>
                  {(form.amenities.length > 0 || form.houseRules.length > 0) && (
                    <div className="flex flex-wrap gap-1.5">
                      {form.amenities.map((a) => <Badge key={a} tone="brand">{a}</Badge>)}
                      {form.houseRules.map((r) => <Badge key={r}>{r}</Badge>)}
                    </div>
                  )}
                  <p className="line-clamp-2 text-sm text-ink-500">{form.description}</p>
                </div>
              </div>

              <div className="flex flex-col gap-3 rounded-2xl border border-brand-200 bg-brand-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-brand-900">Estimated success fee: {formatMoney(ownerFee, fees.currency)}</p>
                  <p className="text-xs text-brand-800/80">
                    Only charged when we place a tenant you've accepted. Listing is free — no placement, no fee.
                  </p>
                </div>
                <Check className="hidden h-6 w-6 text-brand-700 sm:block" />
              </div>

              {Object.keys(errors).length > 0 && (
                <p className="flex items-center gap-2 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
                  <AlertTriangle className="h-4 w-4 shrink-0" /> Some required details are missing. Go back to complete them before submitting.
                </p>
              )}
            </div>
          )}
        </CardBody>

        <div className="flex flex-col-reverse gap-2 border-t border-ink-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <Button variant="ghost" onClick={back} disabled={step === 0}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          {step < STEPS.length - 1 ? (
            <div className="flex flex-col items-stretch gap-1 sm:items-end">
              <Button onClick={next} disabled={!canNext}>
                Next: {STEPS[step + 1]} <ArrowRight className="h-4 w-4" />
              </Button>
              {!canNext && <span className="text-center text-xs text-ink-400 sm:text-right">Complete the required fields to continue</span>}
            </div>
          ) : keepsStatus ? (
            <Button onClick={() => void save('submit')} disabled={Object.keys(errors).length > 0} loading={saving === 'submit'}>
              <Check className="h-4 w-4" /> Save changes
            </Button>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="outline" onClick={() => void save('draft')} loading={saving === 'draft'} disabled={!!saving}>{listing && listing.status !== 'draft' ? 'Save changes' : 'Save as draft'}</Button>
              <Button onClick={() => void save('submit')} disabled={Object.keys(errors).length > 0 || !!saving} loading={saving === 'submit'}>
                <Send className="h-4 w-4" /> {listing?.status === 'pending_review' ? 'Save changes' : 'Submit for review'}
              </Button>
            </div>
          )}
        </div>
      </Card>
      {step === 3 && photos.length === 0 && (
        <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-ink-400"><ImagePlus className="h-3.5 w-3.5" /> Tip: listings with 5+ photos get twice as many applicants.</p>
      )}
    </div>
  )
}

function StepTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h2 className="text-xl font-bold text-ink-900">{title}</h2>
      <p className="mt-0.5 text-sm text-ink-500">{subtitle}</p>
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-ink-400">{label}</dt>
      <dd className="font-semibold text-ink-900">{value}</dd>
    </div>
  )
}

function Banner({ tone, icon, children }: { tone: 'info' | 'danger'; icon: ReactNode; children: ReactNode }) {
  return (
    <div className={cn('mb-4 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm',
      tone === 'danger' ? 'border-red-200 bg-red-50 text-red-800' : 'border-sky-200 bg-sky-50 text-sky-900')}>
      <span className="shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
