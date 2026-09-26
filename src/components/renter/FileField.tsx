import { useId, useRef } from 'react'
import { FileCheck2, Upload, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatBytes } from '@/components/shared/applicationUtils'

export interface StoredFile { name: string; size: number }

/** Real file input that only keeps the file name + size (mock upload). */
export function FileField({ label, hint, value, onChange, accept = 'image/*,.pdf', error, optional }: {
  label: string; hint?: string; value: StoredFile | null; onChange: (f: StoredFile | null) => void; accept?: string; error?: string; optional?: boolean
}) {
  const id = useId()
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-ink-700">
        {label} {optional && <span className="font-normal text-ink-400">(optional)</span>}
      </p>
      {value ? (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-emerald-100 text-emerald-700"><FileCheck2 className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink-900">{value.name}</p>
            <p className="text-xs text-ink-500">{formatBytes(value.size)} · ready to submit</p>
          </div>
          <button type="button" onClick={() => ref.current?.click()} className="rounded-lg px-2 py-1 text-xs font-semibold text-brand-700 hover:bg-white">Replace</button>
          <button type="button" onClick={() => { onChange(null); if (ref.current) ref.current.value = '' }} aria-label={`Remove ${label}`} className="rounded-lg p-1.5 text-ink-400 hover:bg-white hover:text-red-600">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <label htmlFor={id} className={cn('flex cursor-pointer items-center gap-3 rounded-xl border border-dashed bg-white p-3 transition-colors hover:border-brand-400 hover:bg-brand-50/40 focus-within:ring-2 focus-within:ring-brand-500/30',
          error ? 'border-red-300' : 'border-ink-300')}>
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-ink-100 text-ink-500"><Upload className="h-5 w-5" /></span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-brand-700">Choose file</span>
            <span className="block text-xs text-ink-400">{hint ?? 'JPG, PNG or PDF, up to 10 MB'}</span>
          </span>
        </label>
      )}
      <input ref={ref} id={id} type="file" accept={accept} className="sr-only"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onChange({ name: f.name, size: f.size }) }} />
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
    </div>
  )
}
