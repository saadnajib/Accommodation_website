import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Briefcase, CalendarDays, Cigarette, ExternalLink, Mail, MapPin, MessageSquareQuote, PawPrint, Phone, TriangleAlert, Users } from 'lucide-react'
import { Avatar, Badge, Card, CardBody, CardHeader, ListingStatusBadge, Rating, Textarea, VerificationBadge } from '@/components/ui'
import { PROPERTY_TYPES } from '@/lib/status'
import { formatDate, formatMoney } from '@/lib/utils'
import { useStore, useUserRating } from '@/store/useStore'
import type { Application, Listing, User } from '@/types'
import { AffordabilityBadge, FilePill, InfoRow, TenantPassBadge } from './AdminBits'
import { ID_TYPE_LABEL } from './helpers'

export function ListingSummaryCard({ listing }: { listing: Listing | null }) {
  if (!listing) return <Card className="p-5 text-sm text-ink-500">This listing no longer exists.</Card>
  const type = PROPERTY_TYPES.find((t) => t.value === listing.type)?.label ?? listing.type
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col sm:flex-row">
        <img src={listing.images[0]} alt={listing.title} loading="lazy" className="h-40 w-full bg-ink-100 object-cover sm:h-auto sm:w-48" />
        <div className="min-w-0 flex-1 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <ListingStatusBadge status={listing.status} />
            {listing.featured && <Badge tone="warning">Featured</Badge>}
            <span className="text-xs text-ink-400">{type}</span>
          </div>
          <h2 className="mt-2 text-lg font-semibold text-ink-900">{listing.title}</h2>
          <p className="mt-1 flex items-start gap-1.5 text-sm text-ink-500"><MapPin className="mt-0.5 h-4 w-4 shrink-0" /> {listing.address} · {listing.area}, {listing.city}</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <span className="font-semibold text-ink-900">{formatMoney(listing.price, listing.currency)}<span className="font-normal text-ink-400">/mo</span></span>
            <span className="text-ink-500">Deposit {formatMoney(listing.deposit, listing.currency)}</span>
            <span className="text-ink-500">Min. {listing.minStayMonths} mo</span>
            <Link to={`/listings/${listing.id}`} className="ml-auto inline-flex items-center gap-1 font-semibold text-brand-700 hover:text-brand-800">
              Public page <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </Card>
  )
}

function ContactLines({ user }: { user: User }) {
  return (
    <div className="space-y-1.5 text-sm">
      <a href={`mailto:${user.email}`} className="flex items-center gap-2 text-ink-700 hover:text-brand-700"><Mail className="h-4 w-4 text-ink-400" /> <span className="truncate">{user.email}</span></a>
      {user.phone
        ? <a href={`tel:${user.phone.replace(/\s/g, '')}`} className="flex items-center gap-2 text-ink-700 hover:text-brand-700"><Phone className="h-4 w-4 text-ink-400" /> {user.phone}</a>
        : <p className="flex items-center gap-2 text-ink-400"><Phone className="h-4 w-4" /> No phone on file</p>}
    </div>
  )
}

export function PersonCard({ user, role }: { user: User | null; role: 'Renter' | 'Owner' }) {
  const rating = useUserRating(user?.id)
  const count = useStore((s) => (user ? (role === 'Renter' ? s.applications.filter((a) => a.renterId === user.id).length : s.listings.filter((l) => l.ownerId === user.id).length) : 0))
  if (!user) return <Card className="p-5 text-sm text-ink-500">{role} account not found.</Card>
  return (
    <Card>
      <CardHeader title={role === 'Renter' ? 'Renter identity' : 'Owner'} />
      <CardBody className="space-y-4">
        <div className="flex items-center gap-3">
          <Avatar name={user.name} src={user.avatarUrl} size="lg" />
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink-900">{user.name}</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <VerificationBadge status={user.verification} />
              {user.hasTenantPass && <TenantPassBadge />}
            </div>
          </div>
        </div>
        <ContactLines user={user} />
        <dl className="grid grid-cols-2 gap-3 border-t border-ink-100 pt-3">
          <InfoRow label="Rating">{rating.count ? <Rating value={rating.avg} count={rating.count} /> : <span className="text-ink-400">No reviews</span>}</InfoRow>
          <InfoRow label="Member since">{formatDate(user.createdAt, { month: 'short', year: 'numeric' })}</InfoRow>
          <InfoRow label={role === 'Renter' ? 'Applications' : 'Listings'}>{count}</InfoRow>
        </dl>
        {user.bio && <p className="text-sm text-ink-500">“{user.bio}”</p>}
      </CardBody>
    </Card>
  )
}

export function VerificationCard({ app }: { app: Application }) {
  const v = app.verification
  return (
    <Card>
      <CardHeader title="Verification submission" description={v ? `Submitted ${formatDate(v.submittedAt)}` : undefined} />
      <CardBody>
        {!v ? (
          <p className="flex items-center gap-2 text-sm text-amber-700"><TriangleAlert className="h-4 w-4" /> No verification documents were submitted.</p>
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <InfoRow label="ID type">{ID_TYPE_LABEL[v.idType]}</InfoRow>
              <InfoRow label="ID number"><span className="font-mono tracking-wider">{v.idNumberMasked}</span></InfoRow>
              <InfoRow label="Agreement">{app.agreementAccepted ? `Accepted ${app.agreementAcceptedAt ? formatDate(app.agreementAcceptedAt) : ''}` : 'Not accepted'}</InfoRow>
            </dl>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <FilePill name={v.idDocumentName} label="ID document" />
              <FilePill name={v.selfieName} label="Selfie" />
              {v.proofOfIncomeName
                ? <FilePill name={v.proofOfIncomeName} label="Proof of income" />
                : <div className="flex items-center gap-2 rounded-xl border border-dashed border-amber-300 bg-amber-50/60 p-3 text-sm text-amber-800"><TriangleAlert className="h-4 w-4 shrink-0" /> No proof of income</div>}
            </div>
            <p className="mt-3 text-xs text-ink-400">Documents are demo placeholders — file names only.</p>
          </>
        )}
      </CardBody>
    </Card>
  )
}

export function ProfileCard({ app, currency }: { app: Application; currency: string }) {
  const p = app.profile
  return (
    <Card>
      <CardHeader title="Renter self-profile" action={p ? <AffordabilityBadge income={p.monthlyIncome} rent={app.agreedPrice} showVerdict /> : null} />
      <CardBody>
        {!p ? <p className="text-sm text-ink-500">No profile provided.</p> : (
          <div className="space-y-4">
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <InfoRow label="Occupation"><span className="inline-flex items-center gap-1.5"><Briefcase className="h-3.5 w-3.5 text-ink-400" /> {p.occupation}</span></InfoRow>
              <InfoRow label="Employer / school">{p.employer || '—'}</InfoRow>
              <InfoRow label="Monthly income">{formatMoney(p.monthlyIncome, currency)}</InfoRow>
              <InfoRow label="Income ÷ agreed rent"><AffordabilityBadge income={p.monthlyIncome} rent={app.agreedPrice} /></InfoRow>
              <InfoRow label="Occupants"><span className="inline-flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-ink-400" /> {p.occupants}</span></InfoRow>
              <InfoRow label="Pets / smoker">
                <span className="flex flex-wrap gap-1.5">
                  <Badge tone={p.hasPets ? 'warning' : 'neutral'}><PawPrint className="h-3 w-3" /> {p.hasPets ? 'Has pets' : 'No pets'}</Badge>
                  <Badge tone={p.smoker ? 'warning' : 'neutral'}><Cigarette className="h-3 w-3" /> {p.smoker ? 'Smoker' : 'Non-smoker'}</Badge>
                </span>
              </InfoRow>
            </dl>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-ink-400">About</p>
              <p className="mt-1 whitespace-pre-line text-sm text-ink-700">{p.aboutMe}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-ink-400">References</p>
              <p className="mt-1 text-sm text-ink-700">{p.references || <span className="text-ink-400">None provided</span>}</p>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  )
}

export function MessageCard({ app }: { app: Application }) {
  return (
    <Card>
      <CardHeader title="Renter’s message to the owner" />
      <CardBody>
        <blockquote className="flex gap-3 text-sm text-ink-700">
          <MessageSquareQuote className="h-5 w-5 shrink-0 text-brand-600" />
          <span className="whitespace-pre-line">{app.message || <span className="text-ink-400">No message.</span>}</span>
        </blockquote>
        <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-400"><CalendarDays className="h-3.5 w-3.5" /> Applied {formatDate(app.createdAt)}</p>
      </CardBody>
    </Card>
  )
}

export function NotesCard({ app }: { app: Application }) {
  const setAdminNotes = useStore((s) => s.setAdminNotes)
  const toast = useStore((s) => s.toast)
  const [value, setValue] = useState(app.adminNotes)
  const dirty = value !== app.adminNotes
  return (
    <Card>
      <CardHeader title="Internal notes" description="Only visible to the StayBridge team. Saved when you leave the field." />
      <CardBody>
        <Textarea id="admin-notes" aria-label="Internal notes" rows={4} value={value} placeholder="Calls, owner preferences, negotiation notes…"
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => {
            if (!dirty) return
            setAdminNotes(app.id, value)
            toast({ title: 'Notes saved', tone: 'success' })
          }} />
        <p className="mt-1.5 text-xs text-ink-400">{dirty ? 'Unsaved changes' : 'All changes saved'}</p>
      </CardBody>
    </Card>
  )
}
