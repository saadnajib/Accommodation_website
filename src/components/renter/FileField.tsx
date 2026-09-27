import { useId, useRef, useState } from 'react'
import { FileCheck2, Loader2, Upload, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatBytes } from '@/components/shared/applicationUtils'
import { errorMessage, uploadFiles, type FileKind } from '@/lib/api'

/** A document uploaded to the API; only the id + display info are kept in the draft. */
export interface StoredFile { id: string; name: string; size: number }

export const MAX_DOC_BYTES = 8 * 1024 * 1024

/**
 * File picker that uploads immediately to POST /api/files?kind=… (private kinds are only readable by
 * the uploader and admins) and reports the stored file id.
 */
export function FileField({ label, hint, kind, value, onChange, accept = 'image/*,.pdf', error, optional }: {
  label: string; hint?: string; kind: FileKind; value: StoredFile | null; onChange: (f: StoredFile | null) => void
  accept?: string; error?: string; optional?: boolean
}) {
  const id = useId()
  const ref = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState<{ name: string; progress: number } | null>(null)
  const [uploadError, setUploadError] = useState('')

  const pick = async (f: File) => {
    setUploadError('')
    if (f.size > MAX_DOC_BYTES) { setUploadError('File is larger than 8 MB.'); return }
    setUploading({ name: f.name, progress: 0 })
    try {
      const [stored] = await uploadFiles(kind, [f], { onProgress: (p) => setUploading({ name: f.name, progress: p }) })
      onChange({ id: stored.id, name: stored.name || f.name, size: stored.size ?? f.size })
    } catch (e) {
      setUploadError(errorMessage(e, 'Upload failed. Please try again.'))
    } finally {
      setUploading(null)
      if (ref.current) ref.current.value = ''
    }
  }

  const shownError = uploadError || error
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-ink-700">
        {label} {optional && <span className="font-normal text-ink-400">(optional)</span>}
      </p>
      {uploading ? (
        <div className="flex items-center gap-3 rounded-xl border border-brand-200 bg-brand-50/50 p-3" aria-live="polite">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white text-brand-700"><Loader2 className="h-5 w-5 animate-spin" /></span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink-900">{uploading.name}</p>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(uploading.progress * 100)}>
              <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${Math.max(5, uploading.progress * 100)}%` }} />
            </div>
          </div>
          <span className="text-xs font-semibold text-brand-800">{Math.round(uploading.progress * 100)}%</span>
        </div>
      ) : value ? (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-emerald-100 text-emerald-700"><FileCheck2 className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink-900">{value.name}</p>
            <p className="text-xs text-ink-500">{formatBytes(value.size)} · uploaded securely</p>
          </div>
          <button type="button" onClick={() => ref.current?.click()} className="rounded-lg px-2 py-1 text-xs font-semibold text-brand-700 hover:bg-white">Replace</button>
          <button type="button" onClick={() => { onChange(null); if (ref.current) ref.current.value = '' }} aria-label={`Remove ${label}`} className="rounded-lg p-1.5 text-ink-400 hover:bg-white hover:text-red-600">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <label htmlFor={id} className={cn('flex cursor-pointer items-center gap-3 rounded-xl border border-dashed bg-white p-3 transition-colors hover:border-brand-400 hover:bg-brand-50/40 focus-within:ring-2 focus-within:ring-brand-500/30',
          shownError ? 'border-red-300' : 'border-ink-300')}>
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-ink-100 text-ink-500"><Upload className="h-5 w-5" /></span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-brand-700">Choose file</span>
            <span className="block text-xs text-ink-400">{hint ?? 'JPG, PNG or PDF, up to 8 MB'}</span>
          </span>
        </label>
      )}
      <input ref={ref} id={id} type="file" accept={accept} className="sr-only" disabled={!!uploading}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void pick(f) }} />
      {shownError && <p className="mt-1.5 text-xs text-red-600">{shownError}</p>}
    </div>
  )
}
