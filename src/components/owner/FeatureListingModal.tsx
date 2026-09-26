import { Sparkles } from 'lucide-react'
import type { Listing } from '@/types'
import { useStore } from '@/store/useStore'
import { MockPaymentModal } from './OwnerUi'

/** Mock checkout for the "Featured listing" boost. Calls featureListing() on success (which toasts). */
export function FeatureListingModal({ listing, onClose }: { listing: Listing | null; onClose: () => void }) {
  const fees = useStore((s) => s.fees)
  const featureListing = useStore((s) => s.featureListing)
  return (
    <MockPaymentModal
      open={!!listing}
      onClose={onClose}
      title="Feature your listing"
      lineItem="Featured listing · 30 days"
      amount={fees.featuredListingPrice}
      currency={fees.currency}
      description={
        <div className="flex items-start gap-3">
          <span className="rounded-xl bg-amber-50 p-2 text-amber-700"><Sparkles className="h-5 w-5" /></span>
          <p>
            <span className="font-semibold text-ink-900">{listing?.title}</span> will appear first in search results and on the home page
            with a Featured badge for 30 days. Featured homes typically get 3× more views.
          </p>
        </div>
      }
      onPaid={() => listing && featureListing(listing.id)}
    />
  )
}
