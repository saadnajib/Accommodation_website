import { useEffect, useState } from 'react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft, ArrowRight, CalendarDays, CheckCircle2, Clock, CreditCard, ExternalLink, FileText, Lock, Mail, MapPin, MessageSquare,
  Phone, Sparkles, Star, Undo2,
} from 'lucide-react'
import {
  ApplicationStatusBadge, Avatar, Badge, Button, Card, CardBody, CardHeader, EmptyState, Rating, Textarea,
} from '@/components/ui'
import { coverImage, useApplication, useApplicationEvents, useApplicationMeta, useCurrentUser, useListing, useLoad, useStore, useUser, useUserRating } from '@/store/useStore'
import type { CardInput } from '@/lib/api'
import { APPLICATION_STATUS, pipelineIndex } from '@/lib/status'
import { cn, formatDate, formatMoney, timeAgo } from '@/lib/utils'
import { publicName } from '@/components/listings/helpers'
import { ApplicationProgress } from '@/components/shared/ApplicationProgress'
import { ApplicationTimeline } from '@/components/shared/ApplicationTimeline'
import { PaymentModal } from '@/components/shared/PaymentModal'
import { ConfirmModal } from '@/components/shared/ConfirmModal'
import { RatingInput } from '@/components/shared/RatingInput'
import { ID_TYPE_LABELS, isFailed, isTerminal } from '@/components/shared/applicationUtils'

const MIN_REVIEW = 20

function nextStepHint(status: string, renterFeePaid: boolean, ownerFeePaid: boolean) {
  switch (status) {
    case 'submitted':
    case 'under_review': return 'Nothing to do right now — we’ll notify you as soon as verification is complete.'
    case 'verified':
    case 'sent_to_owner': return 'The owner usually responds within 2–3 days. You won’t be charged unless they accept.'
    case 'owner_accepted':
    case 'awaiting_fees':
      if (!renterFeePaid) return 'Pay your service fee to unlock the owner’s contact details and messaging.'
      return ownerFeePaid ? 'Both fees received — unlocking contact now.' : 'Thanks, your fee is paid. Waiting for the owner to pay theirs, then contact unlocks automatically.'
    case 'contact_unlocked': return 'Message the owner to arrange a viewing and sign the rental contract. We’ll mark the deal completed once keys are handed over.'
    case 'completed': return 'Leave a review to help future renters and build your StayBridge reputation.'
    case 'owner_declined':
    case 'rejected': return 'No fee was charged. Keep browsing — there are plenty of great homes.'
    case 'cancelled': return 'You withdrew this application. No fee was charged.'
    default: return ''
  }
}

export default function RenterApplicationDetailPage() {
  const { id } = useParams()
  const loc = useLocation()
  const [search, setSearch] = useSearchParams()
  const user = useCurrentUser()
  const app = useApplication(id)
  const listing = useListing(app?.listingId)
  const owner = useUser(app?.ownerId)
  const ownerRating = useUserRating(app?.ownerId)
  const events = useApplicationEvents(id)
  const meta = useApplicationMeta(id)
  const fetchApplication = useStore((s) => s.fetchApplication)
  const { loading } = useLoad(() => (id ? fetchApplication(id) : Promise.resolve(null)), [id, fetchApplication])
  const payFee = useStore((s) => s.payFee)
  const advance = useStore((s) => s.advanceApplication)
  const addReview = useStore((s) => s.addReview)
  const toast = useStore((s) => s.toast)

  const [payOpen, setPayOpen] = useState(() => search.get('pay') === '1')
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [rating, setRating] = useState(0)
  const [reviewText, setReviewText] = useState('')
  const [posting, setPosting] = useState(false)

  useEffect(() => {
    if (loc.hash === '#review') {
      const t = window.setTimeout(() => document.getElementById('review')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
      return () => window.clearTimeout(t)
    }
  }, [loc.hash])

  if (!user) return null
  if ((!app || !meta) && loading) {
    return <div className="flex min-h-[40vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-200 border-t-brand-700" aria-label="Loading" /></div>
  }
  if (!app || app.renterId !== user.id) {
    return (
      <EmptyState icon={<FileText className="h-6 w-6" />} title="Application not found"
        description="It may have been removed, or it belongs to another account."
        action={<Link to="/dashboard/applications"><Button>Back to applications</Button></Link>} />
    )
  }

  const currency = listing?.currency ?? 'USD'
  const status = app.status
  const canPay = status === 'awaiting_fees' && !app.renterFeePaid
  // The server's state machine decides; fall back to the documented rule until the detail has loaded.
  const canWithdraw = meta ? meta.allowedTransitions.includes('cancelled') : !isTerminal(status) && status !== 'contact_unlocked'
  const myReview = meta?.myReview ?? null
  const renterFee = app.renterFee ?? 0
  const acceptedStage = pipelineIndex(status) >= pipelineIndex('owner_accepted')

  const closePay = () => {
    setPayOpen(false)
    if (search.has('pay')) { search.delete('pay'); setSearch(search, { replace: true }) }
  }
  const onPaid = async (card: CardInput) => {
    const after = await payFee(app.id, card)
    toast(after.contactUnlocked
      ? { title: 'Payment received — contact unlocked!', body: 'You can now message the owner and see their details.', tone: 'success' }
      : { title: 'Payment received', body: 'We’ll unlock contact as soon as the owner pays their fee.', tone: 'success' })
  }
  const withdraw = async () => {
    await advance(app.id, 'cancelled', 'Withdrawn by renter.')
    toast({ title: 'Application withdrawn', body: 'No fee has been charged.', tone: 'info' })
  }
  const submitReview = async () => {
    if (!rating || reviewText.trim().length < MIN_REVIEW || posting) return
    setPosting(true)
    try {
      await addReview({ applicationId: app.id, rating, text: reviewText.trim() })
      toast({ title: 'Thanks for your review!', body: 'It will appear on the owner’s profile.', tone: 'success' })
    } catch { /* toast shown by the store */ } finally { setPosting(false) }
  }

  const renterFeeBadge = app.renterFeePaid
    ? <Badge tone="success" dot>Paid</Badge>
    : status === 'awaiting_fees' ? <Badge tone="warning" dot>Due now</Badge>
      : isFailed(status) ? <Badge>Not charged</Badge> : <Badge>Due if accepted</Badge>

  return (
    <div className="space-y-6">
      <Link to="/dashboard/applications" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-900">
        <ArrowLeft className="h-4 w-4" /> All applications
      </Link>

      {/* Header */}
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
          <div className="aspect-[16/9] w-full shrink-0 overflow-hidden rounded-xl bg-ink-100 sm:aspect-auto sm:h-24 sm:w-32">
            {listing && coverImage(listing) && <img src={coverImage(listing)} alt={listing.title} loading="lazy" className="h-full w-full object-cover" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <ApplicationStatusBadge status={status} />
              <span className="text-xs text-ink-400">Submitted {formatDate(app.createdAt)}</span>
            </div>
            <h1 className="mt-1.5 text-xl font-bold tracking-tight text-ink-900 sm:text-2xl">{listing?.title ?? 'Listing removed'}</h1>
            {listing && <p className="mt-0.5 flex items-center gap-1 text-sm text-ink-500"><MapPin className="h-3.5 w-3.5" /> {listing.area}, {listing.city}</p>}
          </div>
          {listing && (
            <Link to={`/listings/${listing.id}`} className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline">
              View listing <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
        <div className="border-t border-ink-100 px-4 py-5 sm:px-5">
          <ApplicationProgress application={app} events={events} />
        </div>
      </Card>

      {/* What happens next */}
      <div className={cn('flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:p-5',
        isFailed(status) ? 'border-red-200 bg-red-50/60' : canPay ? 'border-amber-200 bg-amber-50' : 'border-brand-200 bg-brand-50/60')}>
        <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl', isFailed(status) ? 'bg-red-100 text-red-700' : canPay ? 'bg-accent-400 text-ink-900' : 'bg-brand-100 text-brand-800')}>
          {canPay ? <CreditCard className="h-5 w-5" /> : status === 'completed' ? <CheckCircle2 className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">What happens next</p>
          <p className="mt-0.5 font-semibold text-ink-900">{APPLICATION_STATUS[status].description}</p>
          <p className="mt-0.5 text-sm text-ink-600">{nextStepHint(status, app.renterFeePaid, app.ownerFeePaid)}</p>
        </div>
        {canPay && <Button variant="accent" onClick={() => setPayOpen(true)} className="shrink-0"><CreditCard className="h-4 w-4" /> Pay {formatMoney(renterFee, currency)}</Button>}
        {status === 'contact_unlocked' && <Link to={`/messages/${app.id}`} className="shrink-0"><Button><MessageSquare className="h-4 w-4" /> Open messages</Button></Link>}
        {isFailed(status) && <Link to="/listings" className="shrink-0"><Button variant="outline">Browse homes <ArrowRight className="h-4 w-4" /></Button></Link>}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          {/* Owner */}
          <Card>
            <CardHeader title="Owner" action={app.contactUnlocked ? <Badge tone="success">Contact unlocked</Badge> : <Badge><Lock className="h-3 w-3" /> Private</Badge>} />
            <CardBody>
              <div className="flex items-center gap-3">
                <Avatar name={app.contactUnlocked ? owner?.name ?? 'Owner' : publicName(owner)} src={owner?.avatarUrl} size="lg" />
                <div className="min-w-0">
                  <p className="font-semibold text-ink-900">{app.contactUnlocked ? owner?.name : publicName(owner)}</p>
                  {ownerRating.count > 0 ? <Rating value={ownerRating.avg} count={ownerRating.count} /> : <p className="text-xs text-ink-400">No reviews yet</p>}
                </div>
              </div>
              {app.contactUnlocked ? (
                <div className="mt-4 space-y-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    {owner?.phone && (
                      <a href={`tel:${owner.phone.replace(/\s/g, '')}`} className="flex items-center gap-3 rounded-xl border border-ink-200 p-3 text-sm hover:bg-ink-50">
                        <Phone className="h-4 w-4 shrink-0 text-brand-700" /> <span className="truncate font-medium text-ink-800">{owner.phone}</span>
                      </a>
                    )}
                    {owner?.email && (
                      <a href={`mailto:${owner.email}`} className="flex min-w-0 items-center gap-3 rounded-xl border border-ink-200 p-3 text-sm hover:bg-ink-50">
                        <Mail className="h-4 w-4 shrink-0 text-brand-700" /> <span className="truncate font-medium text-ink-800">{owner.email}</span>
                      </a>
                    )}
                  </div>
                  {listing?.address && (
                    <div className="flex items-start gap-3 rounded-xl border border-ink-200 p-3 text-sm">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" />
                      <div><p className="font-medium text-ink-800">{listing.address}</p><p className="text-xs text-ink-400">{listing.area}, {listing.city}</p></div>
                    </div>
                  )}
                  <Link to={`/messages/${app.id}`} className="block"><Button full><MessageSquare className="h-4 w-4" /> Open messages</Button></Link>
                </div>
              ) : (
                <p className="mt-4 flex items-start gap-2 rounded-xl bg-ink-50 p-3 text-sm text-ink-500">
                  <Lock className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
                  The owner’s full name, phone, email and exact address are revealed once the owner accepts and both service fees are paid. Until then, StayBridge handles all communication.
                </p>
              )}
            </CardBody>
          </Card>

          {/* Review */}
          {status === 'completed' && (
            <Card id="review" className="scroll-mt-24">
              <CardHeader title={myReview ? 'Your review' : 'Review your stay'} description={myReview ? `Posted ${timeAgo(myReview.at)}` : 'Tell future renters what it’s like to rent from this owner.'} action={<Star className="h-5 w-5 text-accent-500" />} />
              <CardBody>
                {myReview ? (
                  <div>
                    <Rating value={myReview.rating} size="md" />
                    <p className="mt-2 text-sm text-ink-700">“{myReview.text}”</p>
                  </div>
                ) : (
                  <form onSubmit={(e) => { e.preventDefault(); void submitReview() }} className="space-y-4">
                    <RatingInput value={rating} onChange={setRating} label="Rate the owner" />
                    <Textarea label="Your review" name="review" rows={4} value={reviewText} onChange={(e) => setReviewText(e.target.value)}
                      placeholder="Was the home as described? Was the owner responsive and fair?"
                      help={`${reviewText.trim().length}/${MIN_REVIEW} characters minimum`} />
                    <Button type="submit" disabled={!rating || reviewText.trim().length < MIN_REVIEW} loading={posting}>Post review</Button>
                  </form>
                )}
              </CardBody>
            </Card>
          )}

          {/* Timeline */}
          <Card>
            <CardHeader title="Activity" description="Every step of your application." />
            <CardBody>{events.length ? <ApplicationTimeline events={events} viewer="renter" /> : <p className="text-sm text-ink-400">No activity yet.</p>}</CardBody>
          </Card>

          {/* What you sent */}
          <Card>
            <CardHeader title="What you sent" />
            <CardBody className="space-y-4 text-sm">
              <div>
                <p className="text-xs font-medium text-ink-400">Message to owner</p>
                <p className="mt-1 whitespace-pre-line text-ink-700">{app.message}</p>
              </div>
              <dl className="grid gap-3 sm:grid-cols-2">
                {app.verification && (
                  <div><dt className="text-xs text-ink-400">Identity document</dt><dd className="font-medium text-ink-800">{ID_TYPE_LABELS[app.verification.idType]}{app.verification.idNumberMasked && <> · <span className="font-mono">{app.verification.idNumberMasked}</span></>}</dd></div>
                )}
                {app.profile && (
                  <>
                    <div><dt className="text-xs text-ink-400">Occupation</dt><dd className="font-medium text-ink-800">{app.profile.occupation}{app.profile.employer && ` at ${app.profile.employer}`}</dd></div>
                    <div><dt className="text-xs text-ink-400">Monthly income</dt><dd className="font-medium text-ink-800">{formatMoney(app.profile.monthlyIncome, currency)}</dd></div>
                    <div><dt className="text-xs text-ink-400">Household</dt><dd className="font-medium text-ink-800">{app.profile.occupants} occupant{app.profile.occupants > 1 ? 's' : ''} · {app.profile.hasPets ? 'pets' : 'no pets'} · {app.profile.smoker ? 'smoker' : 'non-smoker'}</dd></div>
                  </>
                )}
              </dl>
            </CardBody>
          </Card>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <Card>
            <CardHeader title="Your offer" />
            <CardBody>
              <dl className="space-y-2.5 text-sm">
                <div className="flex justify-between gap-3"><dt className="text-ink-500">Asking price</dt><dd className="text-ink-700">{listing ? formatMoney(listing.price, currency) : '—'}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-ink-500">You proposed</dt><dd className="font-medium text-ink-800">{formatMoney(app.proposedPrice, currency)}</dd></div>
                <div className="flex justify-between gap-3 rounded-lg bg-brand-50 px-2.5 py-2 -mx-2.5">
                  <dt className="font-semibold text-brand-900">Agreed rent</dt>
                  <dd className="font-bold text-brand-900">{formatMoney(app.agreedPrice, currency)}<span className="text-xs font-medium">/mo</span></dd>
                </div>
                {app.agreedPrice !== app.proposedPrice && <p className="text-xs text-ink-400">The agreed rent was adjusted during negotiation.</p>}
                <div className="flex justify-between gap-3"><dt className="flex items-center gap-1.5 text-ink-500"><CalendarDays className="h-3.5 w-3.5" /> Move-in</dt><dd className="font-medium text-ink-800">{formatDate(app.moveInDate)}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-ink-500">Stay</dt><dd className="font-medium text-ink-800">{app.stayMonths} months</dd></div>
                {listing && <div className="flex justify-between gap-3"><dt className="text-ink-500">Deposit (to owner)</dt><dd className="font-medium text-ink-800">{formatMoney(listing.deposit, currency)}</dd></div>}
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Service fees" description={acceptedStage ? undefined : 'Charged only if the owner accepts you.'} />
            <CardBody className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-ink-800">Your service fee</p>
                  <p className="text-lg font-bold text-ink-900">{formatMoney(renterFee, currency)}</p>
                  {user.hasTenantPass && <p className="flex items-center gap-1 text-xs text-emerald-700"><Sparkles className="h-3 w-3" /> Tenant Pass discount applied</p>}
                </div>
                {renterFeeBadge}
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-ink-100 pt-3 text-sm">
                <span className="text-ink-500">Owner</span>
                {app.ownerFeePaid ? <span className="font-semibold text-emerald-700">Owner: paid</span> : <span className="font-medium text-ink-500">Owner: pending</span>}
              </div>
              {canPay && <Button full variant="accent" onClick={() => setPayOpen(true)}><CreditCard className="h-4 w-4" /> Pay service fee</Button>}
              <p className="text-xs text-ink-400">Contact unlocks automatically once both sides have paid.</p>
            </CardBody>
          </Card>

          {canWithdraw && (
            <Button variant="outline" full onClick={() => setWithdrawOpen(true)} className="text-red-600 hover:bg-red-50">
              <Undo2 className="h-4 w-4" /> Withdraw application
            </Button>
          )}
        </aside>
      </div>

      <PaymentModal open={payOpen && canPay} onClose={closePay} onPay={onPaid} amount={renterFee} currency={currency}
        description={listing ? `Renter service fee · ${listing.title}` : 'Renter service fee'} />
      <ConfirmModal open={withdrawOpen} onClose={() => setWithdrawOpen(false)} onConfirm={withdraw} title="Withdraw application?" confirmLabel="Withdraw">
        This cancels your application{listing ? <> for <span className="font-semibold text-ink-800">{listing.title}</span></> : null}. The owner won’t see your profile, and no fee will be charged. You can apply again later if the home is still available.
      </ConfirmModal>
    </div>
  )
}
