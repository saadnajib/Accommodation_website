import { ChevronDown } from 'lucide-react'

/** Styled native <details> accordion item. */
export function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="group rounded-2xl border border-ink-200 bg-white px-5 py-4 shadow-card open:ring-1 open:ring-brand-200 [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-ink-900">
        {q}
        <ChevronDown className="h-5 w-5 shrink-0 text-ink-400 transition-transform group-open:rotate-180" />
      </summary>
      <p className="mt-3 text-sm leading-relaxed text-ink-500">{a}</p>
    </details>
  )
}
