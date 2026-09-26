import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Star, Users } from 'lucide-react'
import { Avatar, Badge, Card, EmptyState, Input, PageHeader, Select, VerificationBadge } from '@/components/ui'
import { useStore } from '@/store/useStore'
import { formatDate } from '@/lib/utils'
import type { Role, User, VerificationStatus } from '@/types'
import { TenantPassBadge } from '@/components/admin/AdminBits'

type RoleFilter = 'all' | Role

const ROLE_TONE = { renter: 'brand', owner: 'info', admin: 'neutral' } as const
const ROLE_LABEL: Record<Role, string> = { renter: 'Renter', owner: 'Owner', admin: 'Admin' }

const VERIFY_OPTIONS: Array<{ value: VerificationStatus; label: string }> = [
  { value: 'verified', label: 'Verified' },
  { value: 'pending', label: 'Pending' },
  { value: 'unverified', label: 'Not verified' },
  { value: 'rejected', label: 'Rejected' },
]

export default function AdminUsersPage() {
  const users = useStore((s) => s.users)
  const applications = useStore((s) => s.applications)
  const listings = useStore((s) => s.listings)
  const reviews = useStore((s) => s.reviews)
  const currentUserId = useStore((s) => s.currentUserId)
  const setUserVerification = useStore((s) => s.setUserVerification)
  const toast = useStore((s) => s.toast)
  const [q, setQ] = useState('')
  const [role, setRole] = useState<RoleFilter>('all')

  const stats = useMemo(() => {
    const m = new Map<string, { apps: number; listings: number; latestApp?: string; latestAt?: string; ratingSum: number; ratingCount: number }>()
    const get = (id: string) => {
      let s = m.get(id)
      if (!s) { s = { apps: 0, listings: 0, ratingSum: 0, ratingCount: 0 }; m.set(id, s) }
      return s
    }
    applications.forEach((a) => {
      const s = get(a.renterId)
      s.apps++
      if (!s.latestAt || a.createdAt > s.latestAt) { s.latestAt = a.createdAt; s.latestApp = a.id }
    })
    listings.forEach((l) => { get(l.ownerId).listings++ })
    reviews.forEach((r) => { const s = get(r.toId); s.ratingSum += r.rating; s.ratingCount++ })
    return m
  }, [applications, listings, reviews])

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return users
      .filter((u) => role === 'all' || u.role === role)
      .filter((u) => !needle || u.name.toLowerCase().includes(needle) || u.email.toLowerCase().includes(needle) || (u.phone ?? '').includes(needle))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [users, q, role])

  const counts = useMemo(() => ({
    renter: users.filter((u) => u.role === 'renter').length,
    owner: users.filter((u) => u.role === 'owner').length,
    admin: users.filter((u) => u.role === 'admin').length,
  }), [users])

  const changeVerification = (u: User, status: VerificationStatus) => {
    setUserVerification(u.id, status)
    toast({ title: 'Verification updated', body: `${u.name} is now “${VERIFY_OPTIONS.find((o) => o.value === status)?.label}”.`, tone: 'success' })
  }

  const nameLink = (u: User) => {
    if (u.role === 'renter') { const id = stats.get(u.id)?.latestApp; return id ? `/admin/applications/${id}` : null }
    if (u.role === 'owner') return `/admin/listings?owner=${u.id}`
    return null
  }

  return (
    <div>
      <PageHeader title="Users" description={`${users.length} accounts · ${counts.renter} renters · ${counts.owner} owners · ${counts.admin} admin`} />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <Input className="flex-1" id="user-search" aria-label="Search users" placeholder="Search name, email or phone…"
          left={<Search className="h-4 w-4" />} value={q} onChange={(e) => setQ(e.target.value)} />
        <Select className="sm:w-48" id="user-role" aria-label="Filter by role" value={role}
          onChange={(e) => setRole(e.target.value as RoleFilter)}
          options={[
            { value: 'all', label: 'All roles' },
            { value: 'renter', label: `Renters (${counts.renter})` },
            { value: 'owner', label: `Owners (${counts.owner})` },
            { value: 'admin', label: `Admins (${counts.admin})` },
          ]} />
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={<Users className="h-6 w-6" />} title="No users match" description="Try another search or role." />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="border-b border-ink-100 bg-ink-50/70 text-xs uppercase tracking-wide text-ink-400">
                <tr>
                  <th className="px-4 py-3 font-medium">User</th>
                  <th className="px-4 py-3 font-medium">Phone</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Verification</th>
                  <th className="px-4 py-3 text-right font-medium">Activity</th>
                  <th className="px-4 py-3 font-medium">Rating</th>
                  <th className="px-4 py-3 font-medium">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {rows.map((u) => {
                  const s = stats.get(u.id)
                  const link = nameLink(u)
                  const isSelf = u.id === currentUserId
                  return (
                    <tr key={u.id} className="transition-colors hover:bg-ink-50/70">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={u.name} src={u.avatarUrl} size="sm" />
                          <div className="min-w-0">
                            {link
                              ? <Link to={link} className="font-medium text-ink-900 hover:text-brand-700 hover:underline">{u.name}</Link>
                              : <span className="font-medium text-ink-900">{u.name}{isSelf && <span className="ml-1 text-xs text-ink-400">(you)</span>}</span>}
                            <p className="truncate text-xs text-ink-500">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-ink-600">{u.phone ?? <span className="text-ink-300">—</span>}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          <Badge tone={ROLE_TONE[u.role]}>{ROLE_LABEL[u.role]}</Badge>
                          {u.hasTenantPass && <TenantPassBadge />}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <VerificationBadge status={u.verification} />
                          {!isSelf && (
                            <select
                              aria-label={`Set verification for ${u.name}`}
                              value={u.verification}
                              onChange={(e) => changeVerification(u, e.target.value as VerificationStatus)}
                              className="h-8 rounded-lg border border-ink-200 bg-white px-2 text-xs text-ink-700 hover:border-ink-300 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25"
                            >
                              {VERIFY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                          )}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-ink-600">
                        {u.role === 'renter' && <>{s?.apps ?? 0} application{s?.apps === 1 ? '' : 's'}</>}
                        {u.role === 'owner' && <>{s?.listings ?? 0} listing{s?.listings === 1 ? '' : 's'}</>}
                        {u.role === 'admin' && <span className="text-ink-300">—</span>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {s?.ratingCount
                          ? <span className="inline-flex items-center gap-1 text-ink-700"><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> {(s.ratingSum / s.ratingCount).toFixed(1)} <span className="text-xs text-ink-400">({s.ratingCount})</span></span>
                          : <span className="text-ink-300">—</span>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-ink-500">{formatDate(u.createdAt)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      <p className="mt-3 text-xs text-ink-400">Click a renter to open their latest application, or an owner to see their listings.</p>
    </div>
  )
}
