import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronRight, FileCheck, FileX, IdCard, Send, ShieldCheck } from 'lucide-react'
import { ApplicationStatusBadge, Avatar, Button, Card, EmptyState, PageHeader, Tabs } from '@/components/ui'
import { useStore } from '@/store/useStore'
import { formatMoney, timeAgo } from '@/lib/utils'
import type { Application } from '@/types'
import { ActionModal } from '@/components/admin/ActionModal'
import { AffordabilityBadge, PriorityBadge, TenantPassBadge } from '@/components/admin/AdminBits'
import { APPROVE_VERIFICATION, REJECT_VERIFICATION, SEND_TO_OWNER, START_REVIEW, useRunAction, type ActionSpec } from '@/components/admin/actions'
import { ID_TYPE_LABEL, statusEnteredAt } from '@/components/admin/helpers'

type Tab = 'queue' | 'verified'

export default function AdminVerificationPage() {
  const applications = useStore((s) => s.applications)
  const users = useStore((s) => s.users)
  const listings = useStore((s) => s.listings)
  const run = useRunAction()
  const nav = useNavigate()
  const [tab, setTab] = useState<Tab>('queue')
  const [pending, setPending] = useState<{ app: Application; spec: ActionSpec } | null>(null)

  const userById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users])
  const listingById = useMemo(() => new Map(listings.map((l) => [l.id, l])), [listings])

  // Tenant Pass holders get priority review; within each group oldest first.
  const sortQueue = (a: Application, b: Application) => {
    const pa = userById.get(a.renterId)?.hasTenantPass ? 0 : 1
    const pb = userById.get(b.renterId)?.hasTenantPass ? 0 : 1
    return pa - pb || a.createdAt.localeCompare(b.createdAt)
  }
  const queue = applications.filter((a) => a.status === 'submitted' || a.status === 'under_review').sort(sortQueue)
  const verified = applications.filter((a) => a.status === 'verified').sort(sortQueue)
  const rows = tab === 'queue' ? queue : verified

  return (
    <div>
      <PageHeader title="Verification queue" description="Check identity, income and profile before anyone is presented to an owner. Tenant Pass holders are reviewed first." />

      <Tabs<Tab>
        className="mb-5 w-full sm:w-fit"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'queue', label: 'To verify', count: queue.length },
          { value: 'verified', label: 'Verified, not yet sent', count: verified.length },
        ]}
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={<ShieldCheck className="h-6 w-6" />}
          title={tab === 'queue' ? 'Queue is clear' : 'Nothing waiting to be sent'}
          description={tab === 'queue' ? 'New applications appear here as soon as renters submit them.' : 'Verified renters you have not yet presented to owners appear here.'}
        />
      ) : (
        <ul className="space-y-3">
          {rows.map((a) => {
            const renter = userById.get(a.renterId)
            const listing = listingById.get(a.listingId)
            const detail = `/admin/applications/${a.id}`
            return (
              <li key={a.id}>
                <Card
                  className="group cursor-pointer p-4 transition-all hover:border-brand-200 hover:shadow-lift sm:p-5"
                  onClick={() => nav(detail)}
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <Avatar name={renter?.name ?? '?'} src={renter?.avatarUrl} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link to={detail} onClick={(e) => e.stopPropagation()} className="font-semibold text-ink-900 hover:text-brand-700 hover:underline">
                            {renter?.name ?? 'Unknown renter'}
                          </Link>
                          {renter?.hasTenantPass && <><PriorityBadge /><TenantPassBadge /></>}
                          <ApplicationStatusBadge status={a.status} />
                        </div>
                        <p className="truncate text-sm text-ink-500">{renter?.email}</p>
                        <p className="mt-1 truncate text-sm text-ink-700">
                          {listing?.title ?? 'Unknown listing'}
                          <span className="text-ink-400"> · offer {formatMoney(a.proposedPrice, listing?.currency)}{listing && a.proposedPrice < listing.price ? ` (asks ${formatMoney(listing.price, listing.currency)})` : ''}</span>
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-500">
                          <span>{tab === 'queue' ? 'Submitted' : 'Verified'} {timeAgo(tab === 'queue' ? a.createdAt : statusEnteredAt(a))}</span>
                          <span className="inline-flex items-center gap-1"><IdCard className="h-3.5 w-3.5" /> {a.verification ? ID_TYPE_LABEL[a.verification.idType] : 'No ID'}</span>
                          {a.verification?.proofOfIncomeName
                            ? <span className="inline-flex items-center gap-1 text-emerald-700"><FileCheck className="h-3.5 w-3.5" /> Income proof</span>
                            : <span className="inline-flex items-center gap-1 text-amber-700"><FileX className="h-3.5 w-3.5" /> No income proof</span>}
                          <span className="inline-flex items-center gap-1">Affordability <AffordabilityBadge income={a.profile?.monthlyIncome} rent={a.agreedPrice} /></span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 lg:justify-end" onClick={(e) => e.stopPropagation()}>
                      {tab === 'queue' ? (
                        <>
                          {a.status === 'submitted' && (
                            <Button size="sm" variant="outline" onClick={() => run(a, START_REVIEW)}>Start review</Button>
                          )}
                          <Button size="sm" onClick={() => setPending({ app: a, spec: { ...APPROVE_VERIFICATION, label: 'Verify' } })}>
                            <ShieldCheck className="h-4 w-4" /> Verify
                          </Button>
                          <Button size="sm" variant="ghost" className="text-red-700 hover:bg-red-50" onClick={() => setPending({ app: a, spec: REJECT_VERIFICATION })}>Reject</Button>
                        </>
                      ) : (
                        <Button size="sm" onClick={() => setPending({ app: a, spec: SEND_TO_OWNER })}>
                          <Send className="h-4 w-4" /> Send to owner
                        </Button>
                      )}
                      <ChevronRight className="hidden h-5 w-5 text-ink-300 transition-transform group-hover:translate-x-0.5 lg:block" aria-hidden />
                    </div>
                  </div>
                </Card>
              </li>
            )
          })}
        </ul>
      )}

      {pending && (
        <ActionModal
          open
          onClose={() => setPending(null)}
          title={pending.spec.title}
          body={pending.spec.body}
          confirmLabel={pending.spec.confirmLabel}
          variant={pending.spec.variant}
          noteLabel={pending.spec.noteLabel}
          noteRequired={pending.spec.noteRequired}
          onConfirm={(note) => run(pending.app, pending.spec, note)}
        >
          <p className="rounded-lg bg-ink-50 px-3 py-2 text-sm text-ink-700">
            <b>{userById.get(pending.app.renterId)?.name}</b> · {listingById.get(pending.app.listingId)?.title}
          </p>
        </ActionModal>
      )}
    </div>
  )
}
