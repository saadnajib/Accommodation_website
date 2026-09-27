import { Link } from 'react-router-dom'
import { Heart } from 'lucide-react'
import { Button, EmptyState, PageHeader } from '@/components/ui'
import { ListingCard } from '@/components/listings/ListingCard'
import { useLoad, useSavedListings, useStore } from '@/store/useStore'

export default function SavedListingsPage() {
  const fetchSaved = useStore((s) => s.fetchSaved)
  const { loading } = useLoad(() => fetchSaved(), [fetchSaved])
  const items = useSavedListings()
  const available = items.filter((l) => l.status === 'active').length

  return (
    <div>
      <PageHeader title="Saved homes"
        description={items.length ? `${items.length} saved · ${available} currently accepting applications` : 'Keep track of homes you like.'}
        action={items.length ? <Link to="/listings"><Button variant="outline">Browse more</Button></Link> : undefined} />
      {items.length === 0 && loading ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="aspect-[4/5] animate-pulse rounded-2xl bg-ink-100" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState icon={<Heart className="h-6 w-6" />} title="No saved homes yet"
          description="Tap the heart on any listing to save it here and compare later."
          action={<Link to="/listings"><Button>Browse listings</Button></Link>} />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((l) => (
            <div key={l.id} className={l.status === 'active' ? undefined : 'opacity-75 transition-opacity hover:opacity-100'}>
              <ListingCard listing={l} />
              {l.status !== 'active' && (
                <p className="mt-2 flex items-center gap-1.5 px-1 text-xs font-medium text-ink-500">
                  <span className="h-1.5 w-1.5 rounded-full bg-ink-300" />
                  {l.status === 'rented' ? 'Already rented' : 'Not accepting applications right now'}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
