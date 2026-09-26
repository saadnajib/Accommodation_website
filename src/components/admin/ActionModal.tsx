import { useState, type ReactNode } from 'react'
import { Button, Modal, Textarea } from '@/components/ui'

export interface ActionModalProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  body?: ReactNode
  confirmLabel: string
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'accent' | 'ghost'
  noteLabel?: string
  noteRequired?: boolean
  /** Hide the note field entirely. */
  noNote?: boolean
  placeholder?: string
  children?: ReactNode
  onConfirm: (note: string) => void
}

/** Confirmation dialog with an optional (or required) note / reason. */
export function ActionModal({
  open, onClose, title, body, confirmLabel, variant = 'primary', noteLabel = 'Note (optional)', noteRequired, noNote, placeholder, children, onConfirm,
}: ActionModalProps) {
  const [note, setNote] = useState('')
  const [touched, setTouched] = useState(false)
  const missing = !!noteRequired && !note.trim()

  const close = () => { setNote(''); setTouched(false); onClose() }
  const confirm = () => {
    if (missing) { setTouched(true); return }
    onConfirm(note.trim())
    setNote(''); setTouched(false)
    onClose()
  }

  // Confirm variant "ghost" looks weak in a footer; promote it.
  const confirmVariant = variant === 'ghost' || variant === 'outline' ? 'secondary' : variant

  return (
    <Modal open={open} onClose={close} title={title} size="sm"
      footer={<>
        <Button variant="outline" onClick={close}>Back</Button>
        <Button variant={confirmVariant} onClick={confirm}>{confirmLabel}</Button>
      </>}>
      {body && <p className="text-sm text-ink-500">{body}</p>}
      {children && <div className="mt-3">{children}</div>}
      {!noNote && (
        <Textarea
          className="mt-4"
          id="admin-action-note"
          label={noteLabel}
          rows={3}
          value={note}
          placeholder={placeholder ?? (noteRequired ? 'Required' : 'Visible in the application timeline')}
          onChange={(e) => setNote(e.target.value)}
          error={touched && missing ? 'Please add a reason.' : undefined}
          autoFocus
        />
      )}
    </Modal>
  )
}
