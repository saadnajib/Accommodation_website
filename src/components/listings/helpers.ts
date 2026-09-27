import type { PropertyType, User } from '@/types'
import { PROPERTY_TYPES } from '@/lib/status'

export function typeLabel(type: PropertyType) {
  return PROPERTY_TYPES.find((t) => t.value === type)?.label ?? type
}

/** "Jonas Weber" -> "Jonas W." (privacy-safe public display name). */
export function publicName(user?: Pick<User, 'name'> | null) {
  if (!user) return 'StayBridge member'
  const [first, ...rest] = user.name.trim().split(/\s+/)
  const last = rest.at(-1)
  return last ? `${first} ${last[0].toUpperCase()}.` : first
}

export function bedsLabel(n: number) {
  return n === 0 ? 'Studio' : `${n} bed${n === 1 ? '' : 's'}`
}
