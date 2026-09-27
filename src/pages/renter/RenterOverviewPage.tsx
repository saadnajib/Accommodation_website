import { type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, BadgeCheck, Bell, CheckCircle2, FileText, Heart, Search, ShieldAlert, Sparkles, Zap } from 'lucide-react'
import { Button, Card, CardHeader, EmptyState, Stat, VerificationBadge } from '@/components/ui'
import { coverImage, useCurrentUser, useListingSummary, useLoad, useMyApplications, useStore } from '@/store/useStore'
import { useTenantPassCheckout } from '@/components/renter/TenantPassCheckout'
import { cn, formatMoney, timeAgo } from '@/lib/utils'
import { isTerminal, renterAttention } from '@/components/shared/applicationUtils'
import { ApplicationRow } from '@/components/renter/ApplicationRow'
import { AttentionAction } from '@/components/renter/AttentionAction'

const VERIFY_COPY = {
  unverified: 'Verify your identity once when you apply — owners only see verified renters.',
  pending: 'Our team is reviewing your documents. This usually takes less than 24 hours.',
  verified: 'Your identity is verified. Owners see a verified badge on every application.',
  rejected: 'We couldn’t verify your documents. Upload new ones with your next application.',
}

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

export default function RenterOverviewPage() {
  const user = useCurrentUser()
  const mine = useMyApplications()
  const appMeta = useStore((s) => s.appMeta)
  const notifications = useStore((s) => s.notifications)
  const savedCount = useStore((s) => s.savedIds.length)
  const fees = useStore((s) => s.fees)
  const markRead = useStore((s) => s.markNotificationRead)
  const fetchMyApplications = useStore((s) => s.fetchMyApplications)
  const fetchSaved = useStore((s) => s.fetchSaved)
  const fetchNotifications = useStore((s) => s.fetchNotifications)
  const { openCheckout: buyPass, modal: passCheckout } = useTenantPassCheckout()
  const nav = useNavigate()
  const { loading } = useLoad(() => Promise.all([fetchMyApplications(), fetchSaved(), fetchNotifications()]), [fetchMyApplications, fetchSaved, fetchNotifications])

  if (!user) return null

  const active = mine.filter((a) => !isTerminal(a.status))
  const attention = mine.flatMap((a) => {
    const kind = renterAttention(a, appMeta[a.id] ? !!appMeta[a.id].myReview : undefined)
    return kind ? [{ app: a, kind }] : []
  })
  const myNotifs = notifications.slice(0, 5)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-ink-500">{greeting()},</p>
          <h1 className="text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">{user.name.split(' ')[0]}</h1>
        </div>
        <Link to="/listings"><Button variant="outline"><Search className="h-4 w-4" /> Find a home</Button></Link>
      </div>

      <Card className="overflow-hidden">
        <div className="grid md:grid-cols-2">
          <div className="flex items-start gap-4 p-5">
            <span className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-xl',
              user.verification === 'verified' ? 'bg-emerald-50 text-emerald-700' : user.verification === 'rejected' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700')}>
              {user.verification === 'verified' ? <BadgeCheck className="h-6 w-6" /> : <ShieldAlert className="h-6 w-6" />}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-ink-900">Identity verification</p>
                <VerificationBadge status={user.verification} />
              </div>
              <p className="mt-1 text-sm text-ink-500">{VERIFY_COPY[user.verification]}</p>
              <Link to="/dashboard/profile" className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">Profile & verification <ArrowRight className="h-3.5 w-3.5" /></Link>
            </div>
          </div>
          <div className={cn('flex items-start gap-4 border-t border-ink-100 p-5 md:border-l md:border-t-0',
            user.hasTenantPass ? 'bg-emerald-50/40' : 'bg-gradient-to-br from-amber-50 to-white')}>
            <span className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-xl', user.hasTenantPass ? 'bg-emerald-100 text-emerald-700' : 'bg-accent-400 text-ink-900')}>
              <Sparkles className="h-6 w-6" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-ink-900">Verified Tenant Pass {user.hasTenantPass && <span className="ml-1 text-sm font-medium text-emerald-700">· Active</span>}</p>
              <p className="mt-1 text-sm text-ink-500">
                {user.hasTenantPass ? '20% off every service fee and priority review are applied automatically.' : `20% off every service fee plus priority review, for a one-off ${formatMoney(fees.tenantPassPrice, fees.currency)}.`}
              </p>
              {!user.hasTenantPass && <Button size="sm" variant="accent" className="mt-3" onClick={buyPass}>Get the pass</Button>}
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Active applications" value={active.length} icon={<FileText className="h-5 w-5" />} />
        <Stat label="Awaiting your action" value={attention.length} icon={<Zap className="h-5 w-5" />} tone={attention.length ? 'accent' : 'ink'} sub={attention.length ? 'See below' : 'All caught up'} />
        <Stat label="Saved homes" value={savedCount} icon={<Heart className="h-5 w-5" />} tone="red" />
      </div>

      <Card>
        <CardHeader title="Needs your attention" description="Things only you can move forward." />
        <div className="divide-y divide-ink-100">
          {attention.length === 0 && (
            <div className="flex items-center gap-3 px-5 py-6 text-sm text-ink-500">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" /> You're all caught up. We'll notify you when something needs you.
            </div>
          )}
          {attention.map(({ app, kind }) => (
            <AttentionItem key={app.id} id={app.id} listingId={app.listingId}>
              <AttentionAction application={app} kind={kind} />
            </AttentionItem>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="min-w-0">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold text-ink-900">Recent applications</h2>
            {mine.length > 0 && <Link to="/dashboard/applications" className="text-sm font-semibold text-brand-700 hover:underline">View all</Link>}
          </div>
          {mine.length === 0 && loading ? (
            <div className="space-y-3">{[0, 1].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-ink-100" />)}</div>
          ) : mine.length === 0 ? (
            <EmptyState icon={<FileText className="h-6 w-6" />} title="No applications yet" description="Find a home you love and apply in a few minutes. You only pay if the owner accepts you."
              action={<Link to="/listings"><Button>Browse homes</Button></Link>} />
          ) : (
            <div className="space-y-3">{mine.slice(0, 3).map((a) => <ApplicationRow key={a.id} application={a} />)}</div>
          )}
        </section>
        <Card className="self-start">
          <CardHeader title="Recent notifications" action={<Bell className="h-4 w-4 text-ink-400" />} />
          {myNotifs.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-ink-400">No notifications yet.</p>
          ) : (
            <ul className="divide-y divide-ink-100">
              {myNotifs.map((n) => (
                <li key={n.id}>
                  <button onClick={() => { void markRead(n.id); if (n.link) nav(n.link) }} className={cn('flex w-full gap-3 px-5 py-3 text-left transition-colors hover:bg-ink-50', !n.read && 'bg-brand-50/40')}>
                    <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.read ? 'bg-ink-200' : 'bg-brand-600')} />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-ink-900">{n.title}</span>
                      <span className="line-clamp-2 block text-xs text-ink-500">{n.body}</span>
                      <span className="mt-0.5 block text-[11px] text-ink-400">{timeAgo(n.at)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      {passCheckout}
    </div>
  )
}

function AttentionItem({ id, listingId, children }: { id: string; listingId: string; children: ReactNode }) {
  const listing = useListingSummary(listingId)
  const img = coverImage(listing)
  return (
    <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
      <Link to={`/dashboard/applications/${id}`} className="flex min-w-0 items-center gap-3 sm:w-64 sm:shrink-0">
        <div className="h-11 w-14 shrink-0 overflow-hidden rounded-lg bg-ink-100">
          {listing && img && <img src={img} alt={listing.title} loading="lazy" className="h-full w-full object-cover" />}
        </div>
        <p className="line-clamp-2 text-sm font-semibold text-ink-900 hover:text-brand-800">{listing?.title ?? 'Listing'}</p>
      </Link>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
