/**
 * Autonomy policy: ACTIONS defaults merged with the CEO's overrides (settings key 'agentPolicy'), plus the
 * per-employee on/off switches (settings key 'agentConfig').
 */
import { eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { ACTIONS, type ActionSpec, type Autonomy } from './actions.js'

export interface EffectiveAction extends ActionSpec {
  autonomy: Autonomy
  autoMinConfidence: number
}
export type PolicyPatch = Record<string, { autonomy?: Autonomy; autoMinConfidence?: number }>
export type Decision = 'auto' | 'approve' | 'never'

/** Money and pricing can never run on their own, whatever the stored policy says. */
export const NEVER_AUTO = new Set(['application.mark_fee_paid', 'settings.fees'])

function readSetting<T>(key: string): T | undefined {
  return db.select().from(schema.settings).where(eq(schema.settings.key, key)).get()?.value as T | undefined
}
function writeSetting(key: string, value: unknown) {
  db.insert(schema.settings).values({ key, value }).onConflictDoUpdate({ target: schema.settings.key, set: { value } }).run()
}

export function getPolicy(): Record<string, EffectiveAction> {
  const overrides = readSetting<PolicyPatch>('agentPolicy') ?? {}
  const out: Record<string, EffectiveAction> = {}
  for (const [key, spec] of Object.entries(ACTIONS)) {
    const o = overrides[key] ?? {}
    let autonomy = o.autonomy ?? spec.defaultAutonomy
    if (autonomy === 'auto' && NEVER_AUTO.has(key)) autonomy = 'approve'
    out[key] = { ...spec, autonomy, autoMinConfidence: o.autoMinConfidence ?? spec.autoMinConfidence }
  }
  return out
}

/** Merge a patch into the stored overrides. Unknown action keys and auto for money actions are rejected. */
export function setPolicy(patch: PolicyPatch) {
  for (const [key, p] of Object.entries(patch)) {
    if (!ACTIONS[key]) throw new Error(`Unknown action ${key}`)
    if (p.autonomy === 'auto' && NEVER_AUTO.has(key)) throw new Error(`${key} cannot run automatically`)
  }
  const cur = readSetting<PolicyPatch>('agentPolicy') ?? {}
  const next: PolicyPatch = { ...cur }
  for (const [key, p] of Object.entries(patch)) {
    const merged = { ...next[key] }
    if (p.autonomy !== undefined) merged.autonomy = p.autonomy
    if (p.autoMinConfidence !== undefined) merged.autoMinConfidence = Math.max(0, Math.min(100, Math.round(p.autoMinConfidence)))
    next[key] = merged
  }
  writeSetting('agentPolicy', next)
  return getPolicy()
}

/** What happens to a proposal of this action at this confidence. */
export function decide(actionKey: string, confidence: number): Decision {
  const p = getPolicy()[actionKey]
  if (!p || p.autonomy === 'never') return 'never'
  if (p.autonomy === 'auto' && confidence >= p.autoMinConfidence) return 'auto'
  return 'approve'
}

/* ---------- Employee on/off ---------- */

export type AgentConfig = Record<string, { enabled: boolean }>

export function getAgentConfig(): AgentConfig {
  return readSetting<AgentConfig>('agentConfig') ?? {}
}
export function isAgentEnabled(key: string) {
  return getAgentConfig()[key]?.enabled ?? true
}
export function setAgentEnabled(key: string, enabled: boolean) {
  writeSetting('agentConfig', { ...getAgentConfig(), [key]: { enabled } })
}
