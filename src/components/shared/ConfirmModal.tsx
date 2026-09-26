import type { ReactNode } from 'react'
import { Button, Modal } from '@/components/ui'

export function ConfirmModal({ open, onClose, onConfirm, title, children, confirmLabel = 'Confirm', tone = 'danger' }: {
  open: boolean; onClose: () => void; onConfirm: () => void; title: string; children: ReactNode; confirmLabel?: string; tone?: 'danger' | 'primary'
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm"
      footer={<>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button variant={tone} onClick={() => { onConfirm(); onClose() }}>{confirmLabel}</Button>
      </>}>
      <div className="text-sm text-ink-600">{children}</div>
    </Modal>
  )
}
