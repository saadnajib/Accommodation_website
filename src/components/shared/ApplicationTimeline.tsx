import type { Role, TimelineEvent } from '@/types'
import { APPLICATION_STATUS } from '@/lib/status'
import { cn, formatDate, timeAgo } from '@/lib/utils'
import { actorLabel } from './applicationUtils'

const dotTone: Record<string, string> = {
  success: 'bg-emerald-500', danger: 'bg-red-500', warning: 'bg-amber-500', info: 'bg-sky-500', neutral: 'bg-ink-300', brand: 'bg-brand-600',
}

/** Vertical timeline of application events, newest first. */
export function ApplicationTimeline({ events, viewer }: { events: TimelineEvent[]; viewer?: Role }) {
  const items = [...events].reverse()
  return (
    <ol className="relative">
      {items.map((e, i) => {
        const meta = APPLICATION_STATUS[e.status]
        return (
          <li key={`${e.status}-${e.at}-${i}`} className="relative flex gap-4 pb-6 last:pb-0">
            {i < items.length - 1 && <span aria-hidden className="absolute left-[7px] top-5 h-full w-px bg-ink-200" />}
            <span className={cn('relative mt-1 h-3.5 w-3.5 shrink-0 rounded-full ring-4 ring-white', dotTone[meta.tone], i === 0 && 'scale-110')} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <p className={cn('text-sm font-semibold', i === 0 ? 'text-ink-900' : 'text-ink-700')}>{meta.label}</p>
                <time dateTime={e.at} title={formatDate(e.at)} className="text-xs text-ink-400">{timeAgo(e.at)}</time>
              </div>
              <p className="text-xs text-ink-400">by {actorLabel(e.by, viewer)}</p>
              {e.note && <p className="mt-1.5 rounded-lg bg-ink-50 px-3 py-2 text-sm text-ink-600">{e.note}</p>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
