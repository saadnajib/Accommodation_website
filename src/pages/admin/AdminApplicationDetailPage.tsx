import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, FileSearch } from 'lucide-react'
import { Button, Card, CardBody, CardHeader, EmptyState } from '@/components/ui'
import { useApplication, useApplicationEvents, useApplicationMeta, useListing, useLoad, useStore, useUser } from '@/store/useStore'
import { formatDate, formatMoney } from '@/lib/utils'
import { ActionModal } from '@/components/admin/ActionModal'
import { ActionPanel } from '@/components/admin/ActionPanel'
import { Timeline } from '@/components/admin/AdminBits'
import { ListingSummaryCard, MessageCard, NotesCard, PersonCard, ProfileCard, VerificationCard } from '@/components/admin/DetailSections'
import { PricingCard } from '@/components/admin/PricingCard'
import { useMarkFee, useRunAction, type ActionSpec } from '@/components/admin/actions'

export default function AdminApplicationDetailPage() {
  const { id } = useParams()
  const app = useApplication(id)
  const listing = useListing(app?.listingId)
  const renter = useUser(app?.renterId)
  const owner = useUser(app?.ownerId)
  const feeCurrency = useStore((s) => s.fees.currency)
  const events = useApplicationEvents(id)
  const meta = useApplicationMeta(id)
  const fetchApplication = useStore((s) => s.fetchApplication)
  const fetchAdminUsers = useStore((s) => s.fetchAdminUsers)
  const usersLoaded = useStore((s) => s.adminUsers !== null)
  const { loading } = useLoad(() => (id ? fetchApplication(id) : Promise.resolve(null)), [id, fetchApplication])
  // Per-user application/listing counts for the person cards.
  useLoad(() => (usersLoaded ? Promise.resolve() : fetchAdminUsers()), [fetchAdminUsers])
  const run = useRunAction()
  const markFee = useMarkFee()
  const [action, setAction] = useState<ActionSpec | null>(null)
  const [feeSide, setFeeSide] = useState<'renter' | 'owner' | null>(null)

  if ((!app || !meta) && loading) {
    return <div className="flex min-h-[40vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-200 border-t-brand-700" aria-label="Loading" /></div>
  }
  if (!app) {
    return (
      <EmptyState
        icon={<FileSearch className="h-6 w-6" />}
        title="Application not found"
        description="It may have been removed or the demo data was reset."
        action={<Link to="/admin/applications"><Button variant="outline">Back to pipeline</Button></Link>}
      />
    )
  }

  const currency = listing?.currency ?? feeCurrency

  return (
    <div>
      <Link to="/admin/applications" className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-900">
        <ArrowLeft className="h-4 w-4" /> Deal pipeline
      </Link>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">{renter?.name ?? 'Unknown renter'} <span className="text-ink-300">→</span> {owner?.name ?? 'Owner'}</h1>
        <p className="mt-1 text-sm text-ink-500">
          Application <span className="font-mono">{app.id}</span> · created {formatDate(app.createdAt)} · offer {formatMoney(app.proposedPrice, currency)}/mo
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_330px]">
        <aside className="order-first lg:order-last lg:sticky lg:top-24 lg:self-start">
          <ActionPanel app={app} events={events} allowed={meta?.allowedTransitions} currency={currency} onAction={setAction} onMarkFee={setFeeSide} />
        </aside>

        <div className="min-w-0 space-y-6">
          <ListingSummaryCard listing={listing} />
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <PersonCard user={renter} role="Renter" />
            <PersonCard user={owner} role="Owner" />
          </div>
          <VerificationCard app={app} />
          <ProfileCard app={app} currency={currency} />
          <MessageCard app={app} />
          <PricingCard app={app} listing={listing} renter={renter} onMarkFee={setFeeSide} />
          <Card>
            <CardHeader title="Timeline" description={`${events.length} event${events.length === 1 ? '' : 's'}`} />
            <CardBody><Timeline events={events} /></CardBody>
          </Card>
          <NotesCard key={`${app.id}:${app.adminNotes ?? ''}`} app={app} />
        </div>
      </div>

      {action && (
        <ActionModal
          open
          onClose={() => setAction(null)}
          title={action.title}
          body={action.body}
          confirmLabel={action.confirmLabel}
          variant={action.variant}
          noteLabel={action.noteLabel}
          noteRequired={action.noteRequired}
          onConfirm={(note) => run(app, action, note)}
        />
      )}

      {feeSide && (
        <ActionModal
          open
          noNote
          onClose={() => setFeeSide(null)}
          title={`Mark ${feeSide} fee as received?`}
          body={`Use this for offline payments (bank transfer, cash). ${formatMoney((feeSide === 'renter' ? app.renterFee : app.ownerFee) ?? 0, currency)} will be recorded as paid by the ${feeSide}.${(feeSide === 'renter' ? app.ownerFeePaid : app.renterFeePaid) ? ' Both fees will then be paid and contact unlocks automatically.' : ''}`}
          confirmLabel="Mark received"
          onConfirm={() => markFee(app, feeSide)}
        />
      )}
    </div>
  )
}
