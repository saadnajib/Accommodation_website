/**
 * Proposals: every decision an employee makes. Policy decides whether it executes now or waits for the CEO.
 */
import { and, eq, inArray, isNull, lt } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { newId, now } from '../lib/crypto.js'
import { auditAs } from '../lib/audit.js'
import { HttpError } from '../lib/errors.js'
import { ACTIONS } from './actions.js'
import { decide } from './policy.js'
import { execute, type Proposal } from './executor.js'

export type { Proposal }
export type Risk = 'low' | 'medium' | 'high'

export interface ProposalInput {
  agentKey: string
  action: string
  targetType?: string
  targetId: string | null
  payload?: Record<string, unknown>
  rationale: string
  confidence: number
  risk: Risk
}

export interface CreateResult {
  proposal: Proposal | null
  /** false when an identical pending proposal already existed */
  created: boolean
  autoExecuted: boolean
}

export const PROPOSAL_TTL_DAYS = 7

export function isAdviceOnly(p: Proposal) {
  return p.payload?.adviceOnly === true
}

export function createProposal(run: { id: string } | null, input: ProposalInput): CreateResult {
  const spec = ACTIONS[input.action]
  if (!spec) throw new Error(`Unknown action ${input.action}`)
  const P = schema.agentProposals
  const confidence = Math.max(0, Math.min(100, Math.round(Number.isFinite(input.confidence) ? input.confidence : 0)))

  const dup = db.select({ id: P.id }).from(P).where(and(
    eq(P.status, 'pending'), eq(P.agentKey, input.agentKey), eq(P.action, input.action),
    input.targetId === null ? isNull(P.targetId) : eq(P.targetId, input.targetId),
  )).get()
  if (dup) return { proposal: null, created: false, autoExecuted: false }

  const verdict = decide(input.action, confidence)
  const payload = { ...(input.payload ?? {}), ...(verdict === 'never' ? { adviceOnly: true } : {}) }
  const at = now()
  const row: Proposal = {
    id: newId('prop'), agentKey: input.agentKey, action: input.action, targetType: input.targetType ?? spec.targetType,
    targetId: input.targetId, payload, rationale: input.rationale.slice(0, 4000), confidence, risk: input.risk,
    status: verdict === 'auto' ? 'approved' : 'pending', decidedBy: verdict === 'auto' ? 'policy' : null,
    decidedAt: verdict === 'auto' ? at : null, decisionNote: null, executedAt: null, result: null, runId: run?.id ?? null, createdAt: at,
  }
  db.insert(P).values(row).run()
  if (verdict !== 'auto') return { proposal: row, created: true, autoExecuted: false }
  const done = execute(row, { kind: 'agent', key: input.agentKey })
  return { proposal: done, created: true, autoExecuted: done.status === 'executed' }
}

function loadPending(id: string) {
  const P = schema.agentProposals
  const p = db.select().from(P).where(eq(P.id, id)).get()
  if (!p) throw new HttpError(404, 'Not found', 'not_found')
  if (p.status !== 'pending') throw new HttpError(409, `This proposal is already ${p.status}`, 'conflict')
  return p
}

/**
 * CEO approval. Advice-only proposals (policy 'never' when created, or now) are acknowledged, not executed.
 */
export function approveProposal(id: string, admin: { id: string }, note?: string | null, ip?: string | null): Proposal {
  const P = schema.agentProposals
  const p = loadPending(id)
  const adviceOnly = isAdviceOnly(p) || decide(p.action, 100) === 'never'
  const cleanNote = note?.trim() || null
  db.update(P).set({ status: 'approved', decidedBy: admin.id, decidedAt: now(), decisionNote: cleanNote }).where(eq(P.id, p.id)).run()
  auditAs(admin.id, 'proposal.approve', p.id, { agentKey: p.agentKey, action: p.action, targetId: p.targetId, adviceOnly, note: cleanNote }, ip)
  const approved = db.select().from(P).where(eq(P.id, p.id)).get()!
  if (adviceOnly) {
    db.update(P).set({ result: 'Acknowledged (advice only, nothing executed)' }).where(eq(P.id, p.id)).run()
    return db.select().from(P).where(eq(P.id, p.id)).get()!
  }
  return execute(approved, { kind: 'admin', id: admin.id })
}

export function rejectProposal(id: string, admin: { id: string }, note?: string | null, ip?: string | null): Proposal {
  const P = schema.agentProposals
  const p = loadPending(id)
  const cleanNote = note?.trim() || null
  db.update(P).set({ status: 'rejected', decidedBy: admin.id, decidedAt: now(), decisionNote: cleanNote }).where(eq(P.id, p.id)).run()
  auditAs(admin.id, 'proposal.reject', p.id, { agentKey: p.agentKey, action: p.action, targetId: p.targetId, note: cleanNote }, ip)
  return db.select().from(P).where(eq(P.id, p.id)).get()!
}

/** Pending proposals older than PROPOSAL_TTL_DAYS become 'expired'. Returns how many. */
export function expireOldProposals() {
  const P = schema.agentProposals
  const cutoff = new Date(Date.now() - PROPOSAL_TTL_DAYS * 86_400_000).toISOString()
  return db.update(P).set({ status: 'expired', decidedBy: 'policy', decidedAt: now() })
    .where(and(eq(P.status, 'pending'), lt(P.createdAt, cutoff))).run().changes
}

/**
 * True when this employee already has an open proposal on the target, or the CEO rejected one in the last
 * `rejectedWithinHours` hours. Employees skip such targets so they don't re-review (and re-bill) the same item.
 */
export function recentlyHandled(agentKey: string, targetId: string, rejectedWithinHours = 24) {
  const P = schema.agentProposals
  const since = new Date(Date.now() - rejectedWithinHours * 3600_000).toISOString()
  const rows = db.select({ status: P.status, decidedAt: P.decidedAt }).from(P)
    .where(and(eq(P.agentKey, agentKey), eq(P.targetId, targetId), inArray(P.status, ['pending', 'rejected']))).all()
  return rows.some((r) => r.status === 'pending' || (r.decidedAt ?? '') >= since)
}
