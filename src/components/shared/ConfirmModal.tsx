import { useState, type ReactNode } from 'react'
import { Button, Modal } from '@/components/ui'

/** Confirmation dialog. If `onConfirm` returns a promise it stays open (loading) until it settles, and only closes on success. */
export function ConfirmModal({ open, onClose, onConfirm, title, children, confirmLabel = 'Confirm', tone = 'danger' }: {
  open: boolean; onClose: () => void; onConfirm: () => unknown; title: string; children: ReactNode; confirmLabel?: string; tone?: 'danger' | 'primary'
}) {
  const [busy, setBusy] = useState(false)
  const confirm = async () => {
    setBusy(true)
    try {
      await onConfirm()
      onClose()
    } catch {
      /* error toast already shown */
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal open={open} onClose={busy ? () => {} : onClose} title={title} size="sm"
      footer={<>
        <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button variant={tone} onClick={() => void confirm()} loading={busy}>{confirmLabel}</Button>
      </>}>
      <div className="text-sm text-ink-600">{children}</div>
    </Modal>
  )
}
