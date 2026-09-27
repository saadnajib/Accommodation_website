import { useState, type FormEvent } from 'react'
import { CreditCard, Lock } from 'lucide-react'
import { Button, Input, Modal } from '@/components/ui'
import { formatMoney } from '@/lib/utils'
import type { CardInput } from '@/lib/api'

/**
 * Mock card payment dialog. The card fields are sent to the API's mock payment endpoint; nothing is
 * charged. `onPay` should reject on failure (the store already toasts the error) to keep the dialog open.
 */
export function PaymentModal({ open, onClose, onPay, amount, currency, title = 'Pay service fee', description }: {
  open: boolean; onClose: () => void; onPay: (card: CardInput) => Promise<unknown>; amount: number; currency: string; title?: string; description?: string
}) {
  const [card, setCard] = useState('')
  const [expiry, setExpiry] = useState('')
  const [cvc, setCvc] = useState('')
  const [name, setName] = useState('')
  const [processing, setProcessing] = useState(false)

  const formatCard = (v: string) => v.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim()
  const formatExpiry = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 4)
    return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d
  }

  const valid = card.replace(/\s/g, '').length >= 12 && /^\d{2}\/\d{2}$/.test(expiry) && /^\d{3,4}$/.test(cvc)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!valid || processing) return
    setProcessing(true)
    try {
      await onPay({ number: card.replace(/\s/g, ''), exp: expiry, cvc })
      setCard(''); setExpiry(''); setCvc(''); setName('')
      onClose()
    } catch {
      /* error already shown as a toast; keep the dialog open so the user can retry */
    } finally {
      setProcessing(false)
    }
  }

  return (
    <Modal open={open} onClose={processing ? () => {} : onClose} title={title} size="sm">
      <form onSubmit={submit} className="space-y-4">
        <div className="rounded-xl bg-gradient-to-br from-brand-700 to-brand-900 p-4 text-white">
          <p className="text-xs uppercase tracking-wider text-brand-100">Amount due</p>
          <p className="mt-1 text-3xl font-bold">{formatMoney(amount, currency)}</p>
          {description && <p className="mt-1 text-sm text-brand-100">{description}</p>}
        </div>
        <Input label="Name on card" name="cc-name" autoComplete="cc-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
        <Input label="Card number" name="cc-number" inputMode="numeric" autoComplete="cc-number" left={<CreditCard className="h-4 w-4" />}
          value={card} onChange={(e) => setCard(formatCard(e.target.value))} placeholder="4242 4242 4242 4242" />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Expiry" name="cc-exp" inputMode="numeric" autoComplete="cc-exp" value={expiry} onChange={(e) => setExpiry(formatExpiry(e.target.value))} placeholder="MM/YY" />
          <Input label="CVC" name="cc-csc" inputMode="numeric" autoComplete="cc-csc" value={cvc} onChange={(e) => setCvc(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="123" />
        </div>
        <p className="flex items-center gap-1.5 text-xs text-ink-400"><Lock className="h-3.5 w-3.5" /> Demo checkout — no real payment is taken. Try 4242 4242 4242 4242, any future expiry and CVC.</p>
        <Button type="submit" full size="lg" loading={processing} disabled={!valid}>Pay {formatMoney(amount, currency)}</Button>
      </form>
    </Modal>
  )
}
