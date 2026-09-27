import { useState, type ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router-dom'
import { CreditCard, ImageOff, Lock, ShieldCheck, Star } from 'lucide-react'
import { Button, Input, Modal } from '@/components/ui'
import { cn, formatMoney } from '@/lib/utils'
import type { CardInput } from '@/lib/api'

type Variant = 'primary' | 'secondary' | 'accent' | 'outline' | 'ghost'
const variants: Record<Variant, string> = {
  primary: 'bg-brand-700 text-white hover:bg-brand-800 shadow-sm focus-visible:ring-brand-500',
  secondary: 'bg-ink-900 text-white hover:bg-ink-700 shadow-sm focus-visible:ring-ink-500',
  accent: 'bg-accent-500 text-ink-900 hover:bg-accent-400 shadow-sm focus-visible:ring-accent-500',
  outline: 'border border-ink-200 bg-white text-ink-900 hover:bg-ink-50 focus-visible:ring-brand-500',
  ghost: 'text-ink-700 hover:bg-ink-100 focus-visible:ring-brand-500',
}

/** A react-router Link styled like <Button> (avoids nesting a button inside a link). */
export function ButtonLink({ variant = 'primary', size = 'md', className, children, ...rest }: LinkProps & { variant?: Variant; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'h-9 px-3 text-sm gap-1.5', md: 'h-11 px-4 text-sm gap-2', lg: 'h-12 px-6 text-base gap-2' }
  return (
    <Link
      className={cn(
        'inline-flex items-center justify-center rounded-xl font-semibold transition-all duration-150 select-none whitespace-nowrap',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[.98]',
        variants[variant], sizes[size], className,
      )}
      {...rest}
    >
      {children}
    </Link>
  )
}

/** Listing photo thumbnail with graceful fallback. */
export function Thumb({ src, alt, className }: { src?: string; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) {
    return (
      <div className={cn('grid shrink-0 place-items-center rounded-xl bg-ink-100 text-ink-300', className)} aria-label={alt} role="img">
        <ImageOff className="h-5 w-5" />
      </div>
    )
  }
  return <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} className={cn('shrink-0 rounded-xl object-cover bg-ink-100', className)} />
}

/** Toggleable pill used for amenities / house rules. */
export function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        'rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
        selected ? 'border-brand-600 bg-brand-50 text-brand-800 shadow-sm' : 'border-ink-200 bg-white text-ink-600 hover:border-ink-300 hover:text-ink-900',
      )}
    >
      {children}
    </button>
  )
}

export function StarInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0)
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          role="radio"
          aria-checked={value === i}
          aria-label={`${i} star${i > 1 ? 's' : ''}`}
          onMouseEnter={() => setHover(i)}
          onClick={() => onChange(i)}
          className="rounded p-0.5 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <Star className={cn('h-7 w-7', i <= (hover || value) ? 'fill-amber-400 text-amber-400' : 'text-ink-200')} />
        </button>
      ))}
    </div>
  )
}

function formatCard(v: string) {
  return v.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim()
}
function formatExpiry(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 4)
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d
}

/** Demo checkout: card fields are posted to the API's mock payment endpoint via onPaid(card). No real payment is taken. */
export function MockPaymentModal({ open, onClose, title, description, amount, currency = 'USD', lineItem, onPaid }: {
  open: boolean
  onClose: () => void
  title: string
  description?: ReactNode
  amount: number
  currency?: string
  lineItem: string
  /** Should reject on failure (the store toasts the error) so the dialog stays open. */
  onPaid: (card: CardInput) => Promise<unknown>
}) {
  const [name, setName] = useState('')
  const [card, setCard] = useState('4242 4242 4242 4242')
  const [exp, setExp] = useState('12/29')
  const [cvc, setCvc] = useState('123')
  const [busy, setBusy] = useState(false)

  const valid = name.trim().length >= 2 && card.replace(/\s/g, '').length === 16 && /^\d{2}\/\d{2}$/.test(exp) && /^\d{3,4}$/.test(cvc)

  const pay = async () => {
    if (!valid || busy) return
    setBusy(true)
    try {
      await onPaid({ number: card.replace(/\s/g, ''), exp, cvc })
      onClose()
    } catch {
      /* toast already shown; keep the dialog open for a retry */
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={() => void pay()} disabled={!valid} loading={busy}>
            <Lock className="h-4 w-4" /> Pay {formatMoney(amount, currency)}
          </Button>
        </>
      }
    >
      {description && <div className="mb-4 text-sm text-ink-500">{description}</div>}
      <div className="mb-4 flex items-center justify-between rounded-xl bg-ink-50 px-4 py-3 text-sm">
        <span className="font-medium text-ink-700">{lineItem}</span>
        <span className="font-bold text-ink-900">{formatMoney(amount, currency)}</span>
      </div>
      <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); void pay() }}>
        <Input label="Name on card" name="cc-name" autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} placeholder="Marco Benedetti" />
        <Input
          label="Card number"
          name="cc-number"
          inputMode="numeric"
          autoComplete="off"
          value={card}
          onChange={(e) => setCard(formatCard(e.target.value))}
          left={<CreditCard className="h-4 w-4" />}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Expiry" name="cc-exp" placeholder="MM/YY" inputMode="numeric" autoComplete="off" value={exp} onChange={(e) => setExp(formatExpiry(e.target.value))} />
          <Input label="CVC" name="cc-cvc" inputMode="numeric" autoComplete="off" value={cvc} onChange={(e) => setCvc(e.target.value.replace(/\D/g, '').slice(0, 4))} />
        </div>
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
      <p className="mt-4 flex items-start gap-2 text-xs text-ink-400">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
        Demo checkout — no real card is charged. The card details are only used by the demo payment endpoint.
      </p>
    </Modal>
  )
}
