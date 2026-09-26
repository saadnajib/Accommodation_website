import { Link } from 'react-router-dom'
import { Heart } from 'lucide-react'
import { Button, EmptyState, PageHeader } from '@/components/ui'
import { ListingCard } from '@/components/listings/ListingCard'
import { useStore } from '@/store/useStore'

export default function SavedListingsPage() {
  const currentUserId = useStore((s) => s.currentUserId)
  const saved = useStore((s) => s.savedListings)
  const listings = useStore((s) => s.listings)
  const ids = currentUserId ? saved[currentUserId] ?? [] : []
  const items = ids.map((id) => listings.find((l) => l.id === id)).filter((l) => l !== undefined)
  const available = items.filter((l) => l.status === 'active').length

  return (
    <div>
      <PageHeader title="Saved homes"
        description={items.length ? `${items.length} saved · ${available} currently accepting applications` : 'Keep track of homes you like.'}
        action={items.length ? <Link to="/listings"><Button variant="outline">Browse more</Button></Link> : undefined} />
      {items.length === 0 ? (
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
