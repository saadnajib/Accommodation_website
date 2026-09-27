import type { Employee } from '../types.js'
import { moderator } from './moderator.js'
import { verifier } from './verifier.js'
import { deals } from './deals.js'
import { growth } from './growth.js'

/** In run order: moderation first (supply), then verification, deals, growth. */
export const EMPLOYEES: Employee<any>[] = [moderator, verifier, deals, growth]

export function getEmployee(key: string): Employee<any> | undefined {
  return EMPLOYEES.find((e) => e.key === key)
}
