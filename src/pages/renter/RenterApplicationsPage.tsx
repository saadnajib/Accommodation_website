import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FileText, Search } from 'lucide-react'
import { Button, EmptyState, PageHeader, Tabs } from '@/components/ui'
import { useCurrentUser, useLoad, useMyApplications, useStore } from '@/store/useStore'
import { isTerminal, renterAttention } from '@/components/shared/applicationUtils'
import { ApplicationRow } from '@/components/renter/ApplicationRow'
import { AttentionAction } from '@/components/renter/AttentionAction'

type Tab = 'all' | 'active' | 'action' | 'closed'

const EMPTY: Record<Tab, { title: string; description: string }> = {
  all: { title: 'No applications yet', description: 'Find a home you love and apply in minutes. You only pay if the owner accepts you.' },
  active: { title: 'No active applications', description: 'Applications in progress will appear here.' },
  action: { title: 'Nothing needs your action', description: 'You’re all caught up. We’ll notify you when an owner responds.' },
  closed: { title: 'No closed applications', description: 'Completed, declined, and withdrawn applications will appear here.' },
}

export default function RenterApplicationsPage() {
  const user = useCurrentUser()
  const mine = useMyApplications()
  const appMeta = useStore((s) => s.appMeta)
  const fetchMyApplications = useStore((s) => s.fetchMyApplications)
  const { loading } = useLoad(() => fetchMyApplications(), [fetchMyApplications])
  const [tab, setTab] = useState<Tab>('all')
  const reviewed = (id: string) => (appMeta[id] ? !!appMeta[id].myReview : undefined)

  const groups = {
    all: mine,
    active: mine.filter((a) => !isTerminal(a.status)),
    action: mine.filter((a) => renterAttention(a, reviewed(a.id))),
    closed: mine.filter((a) => isTerminal(a.status)),
  }

  if (!user) return null
  const list = groups[tab]

  return (
    <div>
      <PageHeader title="My applications" description="Track every home you’ve applied for, from verification to move-in."
        action={<Link to="/listings"><Button variant="outline"><Search className="h-4 w-4" /> Find more homes</Button></Link>} />
      <Tabs className="mb-5" value={tab} onChange={setTab} tabs={[
        { value: 'all', label: 'All', count: groups.all.length },
        { value: 'active', label: 'Active', count: groups.active.length },
        { value: 'action', label: 'Needs action', count: groups.action.length },
        { value: 'closed', label: 'Closed', count: groups.closed.length },
      ]} />
      {list.length === 0 && loading ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-ink-100" />)}</div>
      ) : list.length === 0 ? (
        <EmptyState icon={<FileText className="h-6 w-6" />} title={EMPTY[tab].title} description={EMPTY[tab].description}
          action={<Link to="/listings"><Button>Browse listings</Button></Link>} />
      ) : (
        <div className="space-y-3">
          {list.map((a) => {
            const kind = renterAttention(a, reviewed(a.id))
            return <ApplicationRow key={a.id} application={a} extra={kind ? <AttentionAction application={a} kind={kind} /> : undefined} />
          })}
        </div>
      )}
    </div>
  )
}
