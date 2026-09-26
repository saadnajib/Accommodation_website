import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft, BadgeCheck, Briefcase, CalendarDays, Check, CheckCircle2, CreditCard, Dog, FileSignature, Hourglass, Lock, Mail, MapPin,
  MessageSquare, Phone, Quote, ShieldCheck, Sparkles, Star, TrendingDown, TrendingUp, Users, Wallet, X,
} from 'lucide-react'
import { useApplication, useCurrentUser, useListing, useStore, useUser, useUserRating } from '@/store/useStore'
import {
  ApplicationStatusBadge, Avatar, Badge, Button, Card, CardBody, CardHeader, EmptyState, Modal, Rating, Textarea,
} from '@/components/ui'
import { ButtonLink, MockPaymentModal, StarInput, Thumb } from '@/components/owner/OwnerUi'
import { affordabilityRatio, isVerifying, priceDeltaPct, ratioTone, renterDisplayName } from '@/components/owner/utils'
import { APPLICATION_STATUS } from '@/lib/status'
import { cn, formatDate, formatMoney, timeAgo } from '@/lib/utils'

export default function OwnerApplicationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const me = useCurrentUser()
  const app = useApplication(id)
  const listing = useListing(app?.listingId)
  const renter = useUser(app?.renterId)
  const rating = useUserRating(app?.renterId)
  const myReview = useStore((s) => (app && me ? s.reviews.find((r) => r.applicationId === app.id && r.fromId === me.id) ?? null : null))
  const advance = useStore((s) => s.advanceApplication)
  const payFee = useStore((s) => s.payFee)
  const addReview = useStore((s) => s.addReview)
  const toast = useStore((s) => s.toast)

  const [modal, setModal] = useState<null | 'accept' | 'decline' | 'pay' | 'complete'>(null)
  const [note, setNote] = useState('')
  const [reason, setReason] = useState('')
  const [stars, setStars] = useState(0)
  const [reviewText, setReviewText] = useState('')

  const back = (
    <Link to="/owner/applicants" className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-ink-500 hover:text-ink-900">
      <ArrowLeft className="h-4 w-4" /> All applicants
    </Link>
  )

  if (!app || !me || app.ownerId !== me.id) {
    return (
      <div>
        {back}
        <EmptyState icon={<Users className="h-6 w-6" />} title="Application not found" description="This application doesn't exist or belongs to another owner."
          action={<ButtonLink to="/owner/applicants" variant="outline">Back to applicants</ButtonLink>} />
      </div>
    )
  }
  if (isVerifying(app.status)) {
    return (
      <div>
        {back}
        <EmptyState icon={<Hourglass className="h-6 w-6" />} title="This applicant is still being verified by StayBridge"
          description="We check identity, income and references before presenting anyone to you. You'll get a notification as soon as their profile is ready for your decision."
          action={<ButtonLink to="/owner/applicants" variant="outline">Back to applicants</ButtonLink>} />
      </div>
    )
  }

  const p = app.profile
  const name = renterDisplayName(app, renter)
  const asking = listing?.price ?? app.proposedPrice
  const currency = listing?.currency ?? 'USD'
  const delta = priceDeltaPct(app.proposedPrice, asking)
  const ratio = affordabilityRatio(app)
  const ratioCls = { success: 'text-emerald-700 bg-emerald-50', warning: 'text-amber-800 bg-amber-50', danger: 'text-red-700 bg-red-50', neutral: 'text-ink-600 bg-ink-100' }[ratioTone(ratio)]
  const closeModal = () => setModal(null)

  const accept = () => {
    advance(app.id, 'owner_accepted', 'owner', note.trim() || undefined)
    toast({ title: 'Applicant accepted', body: 'Pay the success fee to unlock contact details and messaging.', tone: 'success' })
    setNote('')
    closeModal()
  }
  const decline = () => {
    if (reason.trim().length < 5) return
    advance(app.id, 'owner_declined', 'owner', reason.trim())
    toast({ title: 'Applicant declined', body: "We'll let them know kindly. No fee is charged.", tone: 'info' })
    setReason('')
    closeModal()
  }
  const complete = () => {
    advance(app.id, 'completed', 'owner', 'Contract signed')
    toast({ title: 'Tenancy confirmed', body: `“${listing?.title ?? 'Your listing'}” is now marked as rented.`, tone: 'success' })
    closeModal()
  }
  const submitReview = () => {
    if (!stars || reviewText.trim().length < 10) return
    addReview({ applicationId: app.id, fromId: me.id, toId: app.renterId, rating: stars, text: reviewText.trim() })
    toast({ title: 'Review published', body: 'Thanks for helping the StayBridge community.', tone: 'success' })
  }

  return (
    <div>
      {back}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">{name}</h1>
          <p className="mt-1 text-ink-500">Applicant for <span className="font-medium text-ink-700">{listing?.title ?? 'your listing'}</span> · applied {timeAgo(app.createdAt)}</p>
        </div>
        <ApplicationStatusBadge status={app.status} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          {/* ---------- Primary action panel ---------- */}
          {app.status === 'sent_to_owner' && (
            <Card className="border-brand-200 bg-gradient-to-br from-brand-50 to-white">
              <CardBody className="py-5">
                <div className="flex items-start gap-3">
                  <span className="rounded-xl bg-brand-700 p-2.5 text-white"><BadgeCheck className="h-5 w-5" /></span>
                  <div>
                    <h2 className="text-lg font-semibold text-ink-900">Your decision</h2>
                    <p className="mt-0.5 text-sm text-ink-600">
                      StayBridge has verified this renter's identity and income. Accepting is free — you only pay the success fee
                      of {formatMoney(app.ownerFee, currency)} after accepting, to unlock contact.
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <Button onClick={() => setModal('accept')}><Check className="h-4 w-4" /> Accept applicant</Button>
                  <Button variant="outline" onClick={() => setModal('decline')}><X className="h-4 w-4" /> Decline</Button>
                </div>
              </CardBody>
            </Card>
          )}

          {app.status === 'awaiting_fees' && (
            <Card className={cn(!app.ownerFeePaid && 'border-amber-200')}>
              <CardHeader
                title="Success fee"
                description={app.ownerFeePaid ? 'Thanks — your fee is paid. Contact unlocks as soon as the renter pays theirs.' : 'Both sides pay a one-off fee to unlock contact and the exact address.'}
                action={<Wallet className="h-5 w-5 text-ink-300" />}
              />
              <CardBody>
                <div className="grid gap-3 sm:grid-cols-2">
                  <FeeLine label="You (owner)" amount={formatMoney(app.ownerFee, currency)} paid={app.ownerFeePaid} />
                  <FeeLine label="Renter" amount="Service fee" paid={app.renterFeePaid} />
                </div>
                {!app.ownerFeePaid && (
                  <Button variant="accent" className="mt-4 w-full sm:w-auto" onClick={() => setModal('pay')}>
                    <CreditCard className="h-4 w-4" /> Pay success fee · {formatMoney(app.ownerFee, currency)}
                  </Button>
                )}
              </CardBody>
            </Card>
          )}

          {app.contactUnlocked && renter && (
            <Card className="border-emerald-200">
              <CardHeader title={<span className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-600" /> Contact unlocked</span>}
                description="You can now talk directly with your tenant." />
              <CardBody>
                <div className="grid gap-3 sm:grid-cols-3">
                  <ContactItem icon={<Users className="h-4 w-4" />} label="Full name" value={renter.name} />
                  <ContactItem icon={<Phone className="h-4 w-4" />} label="Phone" value={renter.phone ?? 'Not provided'} href={renter.phone ? `tel:${renter.phone.replace(/\s/g, '')}` : undefined} />
                  <ContactItem icon={<Mail className="h-4 w-4" />} label="Email" value={renter.email} href={`mailto:${renter.email}`} />
                </div>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <ButtonLink to={`/messages/${app.id}`}><MessageSquare className="h-4 w-4" /> Message tenant</ButtonLink>
                  {app.status === 'contact_unlocked' && (
                    <Button variant="outline" onClick={() => setModal('complete')}><FileSignature className="h-4 w-4" /> Confirm tenancy signed</Button>
                  )}
                </div>
              </CardBody>
            </Card>
          )}

          {app.status === 'completed' && (
            <Card>
              <CardHeader title={myReview ? 'Your review' : `Review ${name.split(' ')[0]}`}
                description={myReview ? `Published ${timeAgo(myReview.at)}` : 'Help other owners by sharing how the tenancy is going.'} />
              <CardBody>
                {myReview ? (
                  <div>
                    <Rating value={myReview.rating} size="md" />
                    <p className="mt-2 text-sm text-ink-700">“{myReview.text}”</p>
                  </div>
                ) : (
                  <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); submitReview() }}>
                    <StarInput value={stars} onChange={setStars} />
                    <Textarea label="Your review" name="review" rows={3} value={reviewText} onChange={(e) => setReviewText(e.target.value)}
                      placeholder="Pays on time, communicative, looks after the home…" help="At least 10 characters. Reviews are public on the renter's profile." />
                    <div><Button type="submit" disabled={!stars || reviewText.trim().length < 10}><Star className="h-4 w-4" /> Publish review</Button></div>
                  </form>
                )}
              </CardBody>
            </Card>
          )}

          {(app.status === 'owner_declined' || app.status === 'rejected' || app.status === 'cancelled') && (
            <Card><CardBody className="text-sm text-ink-600">{APPLICATION_STATUS[app.status].label}. This application is closed — no fee is charged.</CardBody></Card>
          )}

          {/* ---------- Applicant profile ---------- */}
          <Card>
            <CardHeader title="Applicant profile" description={app.contactUnlocked ? undefined : 'Full name and contact details are revealed once both fees are paid.'} />
            <CardBody className="space-y-5">
              <div className="flex flex-wrap items-center gap-4">
                <Avatar name={name} src={app.contactUnlocked ? renter?.avatarUrl : undefined} size="lg" />
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-semibold text-ink-900">{name}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {renter?.verification === 'verified' && <Badge tone="success"><ShieldCheck className="h-3 w-3" /> Verified by StayBridge</Badge>}
                    {renter?.hasTenantPass && <Badge tone="brand"><Sparkles className="h-3 w-3" /> Tenant Pass</Badge>}
                    {rating.count > 0 ? <Rating value={rating.avg} count={rating.count} /> : <span className="text-xs text-ink-400">No reviews yet</span>}
                  </div>
                </div>
              </div>

              {p ? (
                <>
                  <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                    <ProfileFact icon={<Briefcase className="h-4 w-4" />} label="Occupation" value={p.occupation} sub={p.employer} />
                    <ProfileFact icon={<Wallet className="h-4 w-4" />} label="Monthly income" value={formatMoney(p.monthlyIncome, currency)} />
                    <div>
                      <dt className="text-xs text-ink-400">Affordability</dt>
                      <dd className="mt-1"><span className={cn('rounded-lg px-2 py-0.5 text-sm font-bold', ratioCls)}>{ratio ? `${ratio.toFixed(1)}× rent` : '—'}</span></dd>
                      <dd className="mt-1 text-[11px] text-ink-400">3× or more is considered strong</dd>
                    </div>
                    <ProfileFact icon={<Users className="h-4 w-4" />} label="Occupants" value={`${p.occupants} ${p.occupants === 1 ? 'person' : 'people'}`} />
                    <ProfileFact icon={<Dog className="h-4 w-4" />} label="Pets" value={p.hasPets ? 'Has pets' : 'No pets'} />
                    <ProfileFact icon={<X className="h-4 w-4" />} label="Smoker" value={p.smoker ? 'Smoker' : 'Non-smoker'} />
                  </dl>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">About me</p>
                    <p className="mt-1 text-sm leading-relaxed text-ink-700">{p.aboutMe}</p>
                  </div>
                  {p.references && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">References</p>
                      <p className="mt-1 text-sm text-ink-700">{p.references}</p>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-ink-400">The renter hasn't shared profile details.</p>
              )}

              {app.verification && (
                <div className="flex items-start gap-2 rounded-xl bg-ink-50 px-3.5 py-2.5 text-xs text-ink-600">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                  Identity document ({app.verification.idType.replace('_', ' ')}), selfie{app.verification.proofOfIncomeName ? ' and proof of income' : ''} checked by the StayBridge team.
                </div>
              )}

              {app.message && (
                <div className="relative rounded-xl border border-ink-100 bg-white p-4">
                  <Quote className="absolute right-3 top-3 h-5 w-5 text-ink-200" />
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Message to you</p>
                  <p className="mt-1 pr-6 text-sm leading-relaxed text-ink-700">{app.message}</p>
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        {/* ---------- Sidebar ---------- */}
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader title="Offer" />
            <CardBody className="space-y-3 text-sm">
              <div className="flex items-end justify-between gap-2">
                <div>
                  <p className="text-xs text-ink-400">Proposed rent</p>
                  <p className="text-2xl font-bold text-ink-900">{formatMoney(app.proposedPrice, currency)}<span className="text-sm font-medium text-ink-400">/mo</span></p>
                </div>
                {delta !== 0 ? (
                  <span className={cn('inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold', delta < 0 ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-700')}>
                    {delta < 0 ? <TrendingDown className="h-3.5 w-3.5" /> : <TrendingUp className="h-3.5 w-3.5" />} {delta > 0 ? '+' : ''}{delta}%
                  </span>
                ) : <Badge tone="success">Full asking price</Badge>}
              </div>
              <Row label="Your asking price" value={`${formatMoney(asking, currency)}/mo`} />
              {app.agreedPrice !== app.proposedPrice && <Row label="Agreed price" value={`${formatMoney(app.agreedPrice, currency)}/mo`} />}
              <Row label="Move-in" value={formatDate(app.moveInDate)} />
              <Row label="Stay length" value={`${app.stayMonths} months`} />
              <Row label="Your success fee" value={formatMoney(app.ownerFee, currency)} />
            </CardBody>
          </Card>

          {listing && (
            <Card className="overflow-hidden">
              <Thumb src={listing.images[0]} alt={listing.title} className="aspect-[16/9] h-auto w-full rounded-none" />
              <CardBody>
                <p className="font-semibold text-ink-900">{listing.title}</p>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-400"><MapPin className="h-3.5 w-3.5" /> {listing.area} · {listing.city}</p>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="font-semibold text-ink-900">{formatMoney(listing.price, listing.currency)}/mo</span>
                  <Link to={`/owner/listings/${listing.id}/edit`} className="text-xs font-semibold text-brand-700 hover:text-brand-800">Edit listing</Link>
                </div>
                {!app.contactUnlocked && (
                  <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-400"><Lock className="h-3.5 w-3.5" /> Your address stays private until contact is unlocked.</p>
                )}
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader title="Timeline" />
            <CardBody>
              <ol className="relative space-y-4 border-l border-ink-200 pl-5">
                {[...app.timeline].reverse().map((ev, i) => (
                  <li key={`${ev.status}-${ev.at}-${i}`} className="relative">
                    <span className={cn('absolute -left-[26px] top-1 h-3 w-3 rounded-full ring-4 ring-white', i === 0 ? 'bg-brand-600' : 'bg-ink-300')} />
                    <p className="text-sm font-semibold text-ink-900">{APPLICATION_STATUS[ev.status].label}</p>
                    <p className="text-xs text-ink-400">
                      <CalendarDays className="mr-1 inline h-3 w-3" />{formatDate(ev.at)} · {ev.by === 'system' ? 'StayBridge' : ev.by === 'admin' ? 'StayBridge team' : ev.by === 'owner' ? 'You' : 'Renter'}
                    </p>
                    {ev.note && <p className="mt-1 text-xs text-ink-600">{ev.note}</p>}
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>
        </div>
      </div>

      {/* ---------- Modals ---------- */}
      <Modal open={modal === 'accept'} onClose={closeModal} title="Accept this applicant?" size="sm"
        footer={<><Button variant="ghost" onClick={closeModal}>Cancel</Button><Button onClick={accept}><Check className="h-4 w-4" /> Accept applicant</Button></>}>
        <p className="text-sm text-ink-600">
          We'll tell {name.split(' ')[0]} the good news. Next, you pay a success fee of <span className="font-semibold text-ink-900">{formatMoney(app.ownerFee, currency)}</span>{' '}
          and they pay their service fee — then contact details and messaging unlock.
        </p>
        <Textarea className="mt-4" label="Note for the renter" hint="(optional)" name="accept-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Happy to proceed at the proposed price." />
      </Modal>

      <Modal open={modal === 'decline'} onClose={closeModal} title="Decline this applicant" size="sm"
        footer={<><Button variant="ghost" onClick={closeModal}>Cancel</Button><Button variant="danger" onClick={decline} disabled={reason.trim().length < 5}>Decline applicant</Button></>}>
        <p className="text-sm text-ink-600">A short, respectful reason helps renters and helps us send you better matches. No fee is charged.</p>
        <Textarea className="mt-4" label="Reason" name="decline-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. We need someone who can move in earlier." help="Required · at least 5 characters" />
      </Modal>

      <Modal open={modal === 'complete'} onClose={closeModal} title="Confirm tenancy signed?" size="sm"
        footer={<><Button variant="ghost" onClick={closeModal}>Not yet</Button><Button onClick={complete}><FileSignature className="h-4 w-4" /> Confirm</Button></>}>
        <p className="text-sm text-ink-600">
          Confirm that you and {renter?.name ?? 'the renter'} have signed the rental contract. “{listing?.title}” will be marked as rented and removed from search.
        </p>
      </Modal>

      <MockPaymentModal
        open={modal === 'pay'} onClose={closeModal} title="Pay success fee" lineItem={`Success fee · ${listing?.title ?? 'placement'}`}
        amount={app.ownerFee} currency={currency}
        description="One-off fee for a verified tenant placement. It unlocks the renter's full name, phone and email, plus in-app messaging, once the renter has paid too."
        onPaid={() => {
          payFee(app.id, 'owner')
          toast({ title: 'Success fee paid', body: app.renterFeePaid ? 'Contact is now unlocked — say hello!' : "We'll unlock contact as soon as the renter pays.", tone: 'success' })
        }}
      />
    </div>
  )
}

function FeeLine({ label, amount, paid }: { label: string; amount: string; paid: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-ink-200 px-4 py-3">
      <div>
        <p className="text-xs text-ink-400">{label}</p>
        <p className="text-sm font-semibold text-ink-900">{amount}</p>
      </div>
      <Badge tone={paid ? 'success' : 'warning'} dot>{paid ? 'Paid' : 'Pending'}</Badge>
    </div>
  )
}

function ContactItem({ icon, label, value, href }: { icon: ReactNode; label: string; value: string; href?: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-ink-50 px-3.5 py-3">
      <p className="flex items-center gap-1.5 text-xs text-ink-400">{icon} {label}</p>
      {href ? (
        <a href={href} className="mt-0.5 block truncate text-sm font-semibold text-brand-800 hover:underline">{value}</a>
      ) : (
        <p className="mt-0.5 truncate text-sm font-semibold text-ink-900">{value}</p>
      )}
    </div>
  )
}

function ProfileFact({ icon, label, value, sub }: { icon: ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1 text-xs text-ink-400">{icon} {label}</dt>
      <dd className="mt-1 truncate text-sm font-semibold text-ink-900">{value}</dd>
      {sub && <dd className="truncate text-xs text-ink-500">{sub}</dd>}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-ink-100 pt-3">
      <span className="text-ink-500">{label}</span>
      <span className="font-semibold text-ink-900">{value}</span>
    </div>
  )
}
