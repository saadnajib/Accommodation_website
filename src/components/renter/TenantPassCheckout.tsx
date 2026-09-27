import { useState } from 'react'
import { PaymentModal } from '@/components/shared/PaymentModal'
import { useStore } from '@/store/useStore'

/** Mock checkout for the Verified Tenant Pass (POST /me/tenant-pass). Returns an opener and the dialog element. */
export function useTenantPassCheckout() {
  const [open, setOpen] = useState(false)
  const fees = useStore((s) => s.fees)
  const buy = useStore((s) => s.buyTenantPass)
  const modal = (
    <PaymentModal open={open} onClose={() => setOpen(false)} onPay={buy} amount={fees.tenantPassPrice} currency={fees.currency}
      title="Buy the Verified Tenant Pass" description="One-off · 20% off every renter service fee · priority review" />
  )
  return { openCheckout: () => setOpen(true), modal }
}
