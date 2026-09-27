import { useRef, useState, type DragEvent, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, ImagePlus, Info, Loader2, Star, Trash2, Upload, Wand2, X } from 'lucide-react'
import { Button } from '@/components/ui'
import { Thumb } from '@/components/owner/OwnerUi'
import { checkImageFile, processImageFile } from '@/components/owner/imageUpload'
import { cn, uid } from '@/lib/utils'

interface Pending { id: string; name: string }
interface Rejected { id: string; name: string; reason: string }

interface Props {
  images: string[]
  max: number
  error?: string
  /** Functional updater so concurrent uploads append safely. */
  setImages: (fn: (prev: string[]) => string[]) => void
  onUseSamples: () => void
}

const move = (arr: string[], from: number, to: number) => {
  if (to < 0 || to >= arr.length) return arr
  const next = [...arr]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

export function PhotoUploader({ images, max, error, setImages, onUseSamples }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<Pending[]>([])
  const [rejected, setRejected] = useState<Rejected[]>([])
  const [dragging, setDragging] = useState(false)

  const remaining = max - images.length - pending.length
  const full = remaining <= 0

  const handleFiles = (list: FileList | File[] | null) => {
    const files = Array.from(list ?? [])
    if (!files.length) return
    const errs: Rejected[] = []
    const accepted: { file: File; id: string }[] = []
    let slots = remaining
    for (const file of files) {
      const reason = checkImageFile(file)
      if (reason) errs.push({ id: uid('rej'), name: file.name, reason })
      else if (slots <= 0) errs.push({ id: uid('rej'), name: file.name, reason: `Limit of ${max} photos reached.` })
      else { accepted.push({ file, id: uid('up') }); slots -= 1 }
    }
    setRejected(errs)
    if (!accepted.length) return
    setPending((p) => [...p, ...accepted.map(({ file, id }) => ({ id, name: file.name }))])
    accepted.forEach(({ file, id }) => {
      processImageFile(file)
        .then((dataUrl) => setImages((prev) => (prev.length >= max ? prev : [...prev, dataUrl])))
        .catch(() => setRejected((r) => [...r, { id: uid('rej'), name: file.name, reason: "Couldn't read this image." }]))
        .finally(() => setPending((p) => p.filter((x) => x.id !== id)))
    })
  }

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragging(false)
    if (!full) handleFiles(e.dataTransfer.files)
  }

  return (
    <div className="grid gap-4">
      <div
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = full ? 'none' : 'copy'; if (!dragging) setDragging(true) }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false) }}
        onDrop={onDrop}
        className={cn(
          'flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition-colors',
          dragging ? 'border-brand-500 bg-brand-50' : 'border-ink-200 bg-ink-50/50',
          full && 'opacity-60',
        )}
      >
        <span className="grid h-12 w-12 place-items-center rounded-full bg-white text-brand-700 shadow-sm">
          <ImagePlus className="h-6 w-6" />
        </span>
        <div>
          <p className="text-sm font-semibold text-ink-900">{full ? `You've added ${max} photos` : 'Drag photos here or upload from your device'}</p>
          <p className="mt-0.5 text-xs text-ink-500">JPG, PNG, HEIC or WebP · up to 15 MB each · max {max} photos</p>
        </div>
        <input
          ref={inputRef} id="listing-photo-input" type="file" accept="image/*" multiple className="sr-only" tabIndex={-1}
          aria-label="Upload photos"
          onChange={(e) => { handleFiles(e.target.files); e.target.value = '' }}
        />
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button type="button" size="sm" onClick={() => inputRef.current?.click()} disabled={full}>
            <Upload className="h-4 w-4" /> Upload photos
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onUseSamples} disabled={full}>
            <Wand2 className="h-4 w-4" /> Use sample photos
          </Button>
        </div>
      </div>

      {rejected.length > 0 && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold">Some files weren't added</p>
            <button type="button" onClick={() => setRejected([])} aria-label="Dismiss" className="rounded p-0.5 hover:bg-red-100"><X className="h-4 w-4" /></button>
          </div>
          <ul className="mt-1 space-y-0.5 text-xs">
            {rejected.map((r) => <li key={r.id} className="break-all"><span className="font-medium">{r.name}</span> — {r.reason}</li>)}
          </ul>
        </div>
      )}

      {(images.length > 0 || pending.length > 0) && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-label="Listing photos">
          {images.map((src, i) => (
            <li key={`${i}:${src.length}:${src.slice(-24)}`} className="min-w-0 overflow-hidden rounded-xl border border-ink-200 bg-white">
              <div className="relative">
                <Thumb src={src} alt={`Photo ${i + 1}${i === 0 ? ' (cover)' : ''}`} className="aspect-[4/3] h-auto w-full rounded-none!" />
                {i === 0 && <span className="absolute left-1.5 top-1.5 rounded-md bg-ink-900/80 px-1.5 py-0.5 text-[10px] font-bold text-white">COVER</span>}
              </div>
              <div className="flex items-center gap-0.5 p-1">
                <IconBtn label={`Move photo ${i + 1} left`} onClick={() => setImages((p) => move(p, i, i - 1))} disabled={i === 0}><ChevronLeft className="h-4 w-4" /></IconBtn>
                <IconBtn label={`Move photo ${i + 1} right`} onClick={() => setImages((p) => move(p, i, i + 1))} disabled={i === images.length - 1}><ChevronRight className="h-4 w-4" /></IconBtn>
                <span className="flex-1" />
                <IconBtn label={`Make photo ${i + 1} the cover`} onClick={() => setImages((p) => move(p, i, 0))} disabled={i === 0} className="w-auto gap-1 whitespace-nowrap px-2 text-xs font-semibold"><Star className="h-4 w-4" /><span className="hidden sm:inline">Cover</span></IconBtn>
                <IconBtn label={`Remove photo ${i + 1}`} onClick={() => setImages((p) => p.filter((_, j) => j !== i))} className="text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></IconBtn>
              </div>
            </li>
          ))}
          {pending.map((p) => (
            <li key={p.id} className="min-w-0 overflow-hidden rounded-xl border border-dashed border-ink-200 bg-ink-50" aria-live="polite">
              <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 px-2 text-center">
                <Loader2 className="h-5 w-5 animate-spin text-brand-700" />
                <span className="text-xs font-medium text-ink-600">Processing…</span>
                <span className="w-full truncate text-[11px] text-ink-400">{p.name}</span>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-start gap-1.5 text-xs text-ink-500">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Photos are stored in your browser for this demo. In production they upload to cloud storage.
        </p>
        <span className={cn('text-xs', error ? 'text-red-600' : 'text-ink-400')}>
          {error ?? `${images.length}/${max} photos`}
        </span>
      </div>
    </div>
  )
}

function IconBtn({ label, onClick, disabled, className, children }: {
  label: string; onClick: () => void; disabled?: boolean; className?: string; children: ReactNode
}) {
  return (
    <button
      type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label}
      className={cn('inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-600 transition-colors hover:bg-ink-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:pointer-events-none disabled:opacity-30', className)}
    >
      {children}
    </button>
  )
}
