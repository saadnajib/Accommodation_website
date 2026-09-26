import { useEffect, useRef, useState, type FormEvent } from 'react'
import { CreditCard, Lock } from 'lucide-react'
import { Button, Input, Modal } from '@/components/ui'
import { formatMoney } from '@/lib/utils'

/** Mock card payment dialog. Any input is accepted; nothing is charged. */
export function PaymentModal({ open, onClose, onPay, amount, currency, title = 'Pay service fee', description }: {
  open: boolean; onClose: () => void; onPay: () => void; amount: number; currency: string; title?: string; description?: string
}) {
  const [card, setCard] = useState('')
  const [expiry, setExpiry] = useState('')
  const [cvc, setCvc] = useState('')
  const [name, setName] = useState('')
  const [processing, setProcessing] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const formatCard = (v: string) => v.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim()
  const formatExpiry = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 4)
    return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setProcessing(true)
    timer.current = window.setTimeout(() => {
      setProcessing(false)
      setCard(''); setExpiry(''); setCvc(''); setName('')
      onPay()
      onClose()
    }, 700)
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
        <p className="flex items-center gap-1.5 text-xs text-ink-400"><Lock className="h-3.5 w-3.5" /> Demo checkout — no real payment is taken. Any details work.</p>
        <Button type="submit" full size="lg" loading={processing}>Pay {formatMoney(amount, currency)}</Button>
      </form>
    </Modal>
  )
}
