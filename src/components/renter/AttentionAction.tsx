import { Link } from 'react-router-dom'
import { CreditCard, MessageSquare, Star } from 'lucide-react'
import type { Application } from '@/types'
import type { AttentionKind } from '@/components/shared/applicationUtils'
import { formatMoney } from '@/lib/utils'
import { useListingSummary } from '@/store/useStore'

const btn = 'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold transition-colors'

/** Inline CTA describing the next thing the renter must do for an application. */
export function AttentionAction({ application, kind }: { application: Application; kind: AttentionKind }) {
  const listing = useListingSummary(application.listingId)
  const cfg = {
    pay: {
      text: `Owner accepted — pay your ${formatMoney(application.renterFee ?? 0, listing?.currency)} service fee to unlock contact.`,
      cta: 'Pay fee', to: `/dashboard/applications/${application.id}?pay=1`, icon: CreditCard, cls: 'bg-accent-500 text-ink-900 hover:bg-accent-400',
    },
    message: {
      text: 'Contact is unlocked. Say hello and arrange a viewing.',
      cta: 'Message owner', to: `/messages/${application.id}`, icon: MessageSquare, cls: 'bg-brand-700 text-white hover:bg-brand-800',
    },
    review: {
      text: 'How was your stay? Your review helps future renters.',
      cta: 'Leave review', to: `/dashboard/applications/${application.id}#review`, icon: Star, cls: 'bg-ink-900 text-white hover:bg-ink-700',
    },
  }[kind]
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm text-ink-600">{cfg.text}</p>
      <Link to={cfg.to} className={`${btn} ${cfg.cls}`}><cfg.icon className="h-4 w-4" /> {cfg.cta}</Link>
    </div>
  )
}
