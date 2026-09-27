import type { Application, ApplicationStatus, Listing } from '@/types'
import { PROPERTY_TYPES } from '@/lib/status'

/** Statuses during which StayBridge is still verifying the renter — owners see counts only. */
export const VERIFYING_STATUSES: ApplicationStatus[] = ['submitted', 'under_review', 'verified']
export const IN_PROGRESS_STATUSES: ApplicationStatus[] = ['owner_accepted', 'awaiting_fees', 'contact_unlocked']
export const CLOSED_STATUSES: ApplicationStatus[] = ['owner_declined', 'rejected', 'cancelled']

export function isVerifying(status: ApplicationStatus) {
  return VERIFYING_STATUSES.includes(status)
}

export function propertyTypeLabel(type: Listing['type']) {
  return PROPERTY_TYPES.find((t) => t.value === type)?.label ?? type
}

/** Monthly income divided by offered rent, e.g. 3.2 (×). */
export function affordabilityRatio(app: Application) {
  const income = app.profile?.monthlyIncome ?? 0
  const rent = app.agreedPrice || app.proposedPrice
  if (!income || !rent) return null
  return income / rent
}

export function ratioTone(ratio: number | null): 'success' | 'warning' | 'danger' | 'neutral' {
  if (ratio === null) return 'neutral'
  if (ratio >= 3) return 'success'
  if (ratio >= 2.2) return 'warning'
  return 'danger'
}

/** Percentage difference of offer vs asking price, rounded to 1 decimal. */
export function priceDeltaPct(offer: number, asking: number) {
  if (!asking) return 0
  return Math.round(((offer - asking) / asking) * 1000) / 10
}

export const unsplash = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1200&q=70`

export const SAMPLE_PHOTOS = [
  unsplash('photo-1502672260266-1c1ef2d93688'),
  unsplash('photo-1522708323590-d24dbb6b0267'),
  unsplash('photo-1484154218962-a197022b5858'),
  unsplash('photo-1560448204-e02f11c3d0e2'),
  unsplash('photo-1493809842364-78817add7ffb'),
  unsplash('photo-1505693416388-ac5ce068fe85'),
]

export function greeting(date = new Date()) {
  const h = date.getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}
