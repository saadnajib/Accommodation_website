import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CheckCircle2, Clock, EyeOff, FileText, Home, Send, ShieldCheck } from 'lucide-react'
import type { Listing, User } from '@/types'
import { ApplicationStatusBadge, Button, Card, EmptyState, Stepper } from '@/components/ui'
import { useCurrentUser, useListing, useStore } from '@/store/useStore'
import { formatDate, formatMoney, timeAgo } from '@/lib/utils'
import { isTerminal } from '@/components/shared/applicationUtils'
import {
  STEPS, buildProfile, buildVerification, clearDraft, emptyDraft, loadDraft, saveDraft, validateStep,
  type ApplyDraft, type Errors,
} from '@/components/renter/applyDraft'
import { AboutStep, AgreementStep, FeeEstimate, ListingSummary, OfferStep, ReviewStep, VerifyStep } from '@/components/renter/ApplySteps'

export default function ApplyPage() {
  const { listingId } = useParams()
  const listing = useListing(listingId)
  const user = useCurrentUser()
  const applications = useStore((s) => s.applications)
  const [submitted, setSubmitted] = useState(false)

  if (!user) return null

  if (!listing || listing.status !== 'active') {
    return (
      <div className="container-x py-12 sm:py-16">
        <EmptyState icon={<Home className="h-6 w-6" />}
          title={listing ? 'This home is not accepting applications' : 'We couldn’t find this home'}
          description={listing ? 'The owner has paused or closed this listing. Have a look at similar homes that are available right now.' : 'The listing may have been removed or the link is incorrect.'}
          action={<Link to="/listings"><Button>Browse available homes</Button></Link>} />
      </div>
    )
  }

  const existing = applications.find((a) => a.listingId === listing.id && a.renterId === user.id && !isTerminal(a.status))
  if (existing && !submitted) {
    return (
      <div className="container-x py-12 sm:py-16">
        <Card className="mx-auto max-w-lg p-6 text-center sm:p-8">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-700"><CheckCircle2 className="h-6 w-6" /></span>
          <h1 className="mt-4 text-2xl font-bold text-ink-900">You already applied</h1>
          <p className="mt-2 text-sm text-ink-500">You sent an application for <span className="font-semibold text-ink-800">{listing.title}</span> {timeAgo(existing.createdAt)}. You can follow its progress from your dashboard.</p>
          <div className="mt-4 flex justify-center"><ApplicationStatusBadge status={existing.status} /></div>
          <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
            <Link to={`/dashboard/applications/${existing.id}`}><Button full>View application</Button></Link>
            <Link to="/listings"><Button variant="outline" full>Browse more homes</Button></Link>
          </div>
        </Card>
      </div>
    )
  }

  return <ApplyWizard key={listing.id} listing={listing} user={user} onSubmitted={() => setSubmitted(true)} />
}

function ApplyWizard({ listing, user, onSubmitted }: { listing: Listing; user: User; onSubmitted: () => void }) {
  const fees = useStore((s) => s.fees)
  const applications = useStore((s) => s.applications)
  const submitApplication = useStore((s) => s.submitApplication)
  const toast = useStore((s) => s.toast)
  const nav = useNavigate()
  const topRef = useRef<HTMLDivElement>(null)

  const mine = useMemo(
    () => applications.filter((a) => a.renterId === user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [applications, user.id],
  )
  const lastVerified = mine.find((a) => a.verification)
  const lastProfile = mine.find((a) => a.profile)?.profile
  const canReuse = user.verification === 'verified' && !!lastVerified
  const previous = canReuse ? lastVerified : undefined

  const [draft, setDraft] = useState<ApplyDraft>(() => loadDraft(listing.id, emptyDraft(listing, canReuse, lastProfile)))
  const [touched, setTouched] = useState<Set<string>>(() => new Set())

  useEffect(() => { saveDraft(listing.id, draft) }, [draft, listing.id])

  const set = (patch: Partial<ApplyDraft>) => setDraft((d) => ({ ...d, ...patch }))
  const touch = (k: keyof Errors) => setTouched((t) => (t.has(k) ? t : new Set(t).add(k)))
  const errors = validateStep(draft.step, draft, listing)
  const valid = Object.keys(errors).length === 0
  const err = (k: keyof Errors) => (touched.has(k) ? errors[k] : undefined)

  const goTo = (step: number) => {
    set({ step })
    requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  const submit = () => {
    for (let s = 0; s < 4; s++) {
      if (Object.keys(validateStep(s, draft, listing)).length) {
        toast({ title: 'Something is missing', body: `Please review “${STEPS[s]}”.`, tone: 'error' })
        setTouched(new Set(Object.keys(validateStep(s, draft, listing))))
        goTo(s)
        return
      }
    }
    const app = submitApplication({
      listingId: listing.id,
      proposedPrice: Number(draft.proposedPrice),
      moveInDate: new Date(`${draft.moveInDate}T12:00:00`).toISOString(),
      stayMonths: Number(draft.stayMonths),
      message: draft.message.trim(),
      verification: buildVerification(draft, previous),
      profile: buildProfile(draft),
    })
    clearDraft(listing.id)
    onSubmitted()
    toast({ title: 'Application submitted', body: 'Our team will verify your details and present you to the owner.', tone: 'success' })
    nav(`/dashboard/applications/${app.id}`)
  }

  const stepProps = { draft, set, err, touch, listing }
  const isLast = draft.step === STEPS.length - 1

  return (
    <div className="container-x py-6 sm:py-10">
      <Link to={`/listings/${listing.id}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-900">
        <ArrowLeft className="h-4 w-4" /> Back to listing
      </Link>
      <div ref={topRef} className="scroll-mt-24">
        <div className="mb-6 mt-3">
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-700">Apply · Step {draft.step + 1} of {STEPS.length}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">{listing.title}</h1>
        </div>
        <Stepper steps={STEPS} current={draft.step} className="mb-6 pb-1" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="animate-fade-in">
          <div key={draft.step} className="animate-fade-up p-5 sm:p-8">
            {draft.step === 0 && <OfferStep {...stepProps} />}
            {draft.step === 1 && <AgreementStep {...stepProps} fees={fees} user={user} />}
            {draft.step === 2 && <VerifyStep {...stepProps} previous={previous} />}
            {draft.step === 3 && <AboutStep {...stepProps} />}
            {draft.step === 4 && <ReviewStep draft={draft} listing={listing} onEdit={goTo} previous={previous} fees={fees} user={user} />}
          </div>
          <div className="sticky bottom-0 z-10 flex items-center justify-between gap-3 rounded-b-2xl border-t border-ink-100 bg-white/95 px-5 py-4 backdrop-blur sm:px-8">
            <Button variant="ghost" onClick={() => goTo(draft.step - 1)} disabled={draft.step === 0}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <div className="flex items-center gap-3">
              {!valid && !isLast && <span className="hidden text-xs text-ink-400 sm:block">Complete this step to continue</span>}
              {isLast ? (
                <Button size="lg" onClick={submit} disabled={!valid}><Send className="h-4 w-4" /> Submit application</Button>
              ) : (
                <Button onClick={() => goTo(draft.step + 1)} disabled={!valid}>Next <ArrowRight className="h-4 w-4" /></Button>
              )}
            </div>
          </div>
        </Card>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="hidden lg:block"><ListingSummary listing={listing} /></div>
          <Card className="p-5">
            <p className="text-sm font-semibold text-ink-900">Your offer</p>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-ink-500">Monthly rent</dt><dd className="font-semibold text-ink-900">{Number(draft.proposedPrice) > 0 ? formatMoney(Number(draft.proposedPrice), listing.currency) : '—'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink-500">Move-in</dt><dd className="font-medium text-ink-800">{draft.moveInDate ? formatDate(`${draft.moveInDate}T12:00:00`) : '—'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink-500">Stay</dt><dd className="font-medium text-ink-800">{draft.stayMonths || '—'} months</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink-500">Deposit (to owner)</dt><dd className="font-medium text-ink-800">{formatMoney(listing.deposit, listing.currency)}</dd></div>
            </dl>
          </Card>
          {draft.step !== 1 && <div className="hidden lg:block"><FeeEstimate price={Number(draft.proposedPrice)} fees={fees} user={user} currency={listing.currency} /></div>}
          <Card className="hidden p-5 lg:block">
            <ul className="space-y-3 text-sm text-ink-600">
              <li className="flex gap-2.5"><ShieldCheck className="h-4 w-4 shrink-0 text-brand-700" /> Every renter is verified by our team before owners see them.</li>
              <li className="flex gap-2.5"><EyeOff className="h-4 w-4 shrink-0 text-brand-700" /> Your contact details stay private until both sides pay.</li>
              <li className="flex gap-2.5"><Clock className="h-4 w-4 shrink-0 text-brand-700" /> Most applications are reviewed within 24 hours.</li>
              <li className="flex gap-2.5"><FileText className="h-4 w-4 shrink-0 text-brand-700" /> Your progress is saved in this tab if you refresh.</li>
            </ul>
          </Card>
        </aside>
      </div>
    </div>
  )
}
