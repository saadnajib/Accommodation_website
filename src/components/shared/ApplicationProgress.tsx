import { Check, X } from 'lucide-react'
import type { Application, TimelineEvent } from '@/types'
import { APPLICATION_STATUS, PIPELINE, pipelineIndex } from '@/lib/status'
import { cn } from '@/lib/utils'
import { isFailed } from './applicationUtils'

/**
 * Horizontal progress tracker built from PIPELINE. Failed outcomes are shown as a red terminal node.
 * `events` (from the application detail) tell how far a failed application got; without them the
 * failed node is placed after the first step.
 */
export function ApplicationProgress({ application, events, className }: { application: Application; events?: TimelineEvent[]; className?: string }) {
  const failed = isFailed(application.status)
  // Furthest happy-path step ever reached (events cover terminal statuses too).
  const reached = Math.max(failed ? 0 : -1, ...(events ?? []).map((e) => pipelineIndex(e.status)), pipelineIndex(application.status))
  const current = failed ? reached + 1 : pipelineIndex(application.status)

  const steps = PIPELINE.map((s, i) => ({
    key: s,
    label: failed && i === current ? APPLICATION_STATUS[application.status].label : APPLICATION_STATUS[s].label,
    state: failed
      ? i <= reached ? 'done' : i === current ? 'failed' : 'todo'
      : i < current || (application.status === 'completed' && i === current) ? 'done' : i === current ? 'active' : 'todo',
  }))

  return (
    <div className={cn('overflow-x-auto no-scrollbar', className)}>
      <ol className="flex min-w-[640px] items-start">
        {steps.map((s, i) => (
          <li key={s.key} className="relative flex flex-1 flex-col items-center text-center">
            {i > 0 && (
              <span aria-hidden className={cn('absolute right-1/2 top-3.5 h-0.5 w-full -translate-y-1/2',
                s.state === 'done' || s.state === 'active' ? 'bg-brand-600' : s.state === 'failed' ? 'bg-red-300' : 'bg-ink-200')} />
            )}
            <span className={cn('relative z-10 grid h-7 w-7 place-items-center rounded-full text-xs font-bold ring-2 transition-colors',
              s.state === 'done' && 'bg-brand-700 text-white ring-brand-700',
              s.state === 'active' && 'bg-white text-brand-700 ring-brand-700 shadow-[0_0_0_5px_rgb(20_184_166_/_0.15)]',
              s.state === 'failed' && 'bg-red-600 text-white ring-red-600',
              s.state === 'todo' && 'bg-white text-ink-400 ring-ink-200')}>
              {s.state === 'done' ? <Check className="h-3.5 w-3.5" /> : s.state === 'failed' ? <X className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <span className={cn('mt-2 px-1 text-[11px] font-medium leading-tight sm:text-xs',
              s.state === 'active' ? 'text-ink-900' : s.state === 'failed' ? 'text-red-700' : s.state === 'done' ? 'text-ink-700' : 'text-ink-400')}>
              {s.label}
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}
