import type { FeeSettings } from '@/types'

export const DEFAULT_FEES: FeeSettings = {
  renterFeeRate: 0.5,
  ownerFeeRate: 0.35,
  minFee: 99,
  tenantPassPrice: 29,
  featuredListingPrice: 39,
  currency: 'USD',
}

export function computeFees(agreedPrice: number, s: FeeSettings, opts: { hasTenantPass?: boolean } = {}) {
  let renterFee = Math.max(s.minFee, Math.round(agreedPrice * s.renterFeeRate))
  const ownerFee = Math.max(s.minFee, Math.round(agreedPrice * s.ownerFeeRate))
  // Tenant Pass holders get 20% off the renter fee — an incentive to buy the pass up front.
  if (opts.hasTenantPass) renterFee = Math.round(renterFee * 0.8)
  return { renterFee, ownerFee }
}

/** Standard accommodation agreement text shown to renters before they apply. */
export const AGREEMENT_CLAUSES = [
  'I confirm that all information I provide about myself is accurate and can be verified.',
  'I understand that StayBridge acts as the intermediary and that I will not contact the owner directly until the service fee is paid and contact is unlocked.',
  'I agree that the proposed rent is an offer and the final price is confirmed by the owner through StayBridge.',
  'I will pay the StayBridge service fee only after the owner accepts my application. If the owner declines, no fee is charged.',
  'I understand the deposit is paid to the owner, not to StayBridge, and is governed by the final rental contract.',
  'I agree to leave an honest review of the accommodation and the owner after moving in.',
]
