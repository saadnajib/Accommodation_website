import { CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { cn } from '@/lib/utils'

export function Toaster() {
  const toasts = useStore((s) => s.toasts)
  const dismiss = useStore((s) => s.dismissToast)
  if (!toasts.length) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 sm:items-end sm:right-4">
      {toasts.map((t) => (
        <div key={t.id} className={cn('pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border bg-white p-4 shadow-lift animate-fade-up',
          t.tone === 'error' ? 'border-red-200' : t.tone === 'success' ? 'border-emerald-200' : 'border-ink-200')}>
          {t.tone === 'success' ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" /> : t.tone === 'error' ? <XCircle className="h-5 w-5 shrink-0 text-red-600" /> : <Info className="h-5 w-5 shrink-0 text-brand-600" />}
          <div className="flex-1 text-sm">
            <p className="font-semibold text-ink-900">{t.title}</p>
            {t.body && <p className="mt-0.5 text-ink-500">{t.body}</p>}
          </div>
          <button onClick={() => dismiss(t.id)} className="text-ink-400 hover:text-ink-700" aria-label="Dismiss"><X className="h-4 w-4" /></button>
        </div>
      ))}
    </div>
  )
}
