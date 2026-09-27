/** Admin API for the AI team: status, runs, policy, and the CEO's approvals inbox. See API.md "AI employees". */
import { Router } from 'express'
import { z } from 'zod'
import { and, desc, eq, sql, type SQL } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { validate, v } from '../middleware/validate.js'
import { requireRole } from '../middleware/auth.js'
import { badRequest, notFound } from '../lib/errors.js'
import { audit } from '../lib/audit.js'
import { env } from '../lib/env.js'
import { currentModel, isConfigured } from '../agents/client.js'
import { getPolicy, isAgentEnabled, setAgentEnabled, setPolicy, type PolicyPatch } from '../agents/policy.js'
import { approveProposal, expireOldProposals, isAdviceOnly, rejectProposal, type Proposal } from '../agents/proposals.js'
import { EMPLOYEES, isRunning, runAgent, spentThisMonthCents, type Run } from '../agents/runtime.js'
import { runAll } from '../agents/scheduler.js'
import { agentName, isAgentKey } from '../agents/roster.js'
import { ACTIONS } from '../agents/actions.js'
import { idParams } from './common.js'

export const agentsRouter = Router()
agentsRouter.use('/admin', requireRole('admin'))

const opt = <T extends z.ZodType>(s: T) => z.preprocess((x) => (x === '' ? undefined : x), s.optional())
const keyParams = z.object({ key: z.string().max(40) })

/* ---------- Serializers ---------- */

function serializeRun(r: Run) {
  return {
    id: r.id, agentKey: r.agentKey, agentName: agentName(r.agentKey), trigger: r.trigger, status: r.status, summary: r.summary,
    itemsReviewed: r.itemsReviewed, proposalsCreated: r.proposalsCreated, autoExecuted: r.autoExecuted,
    inputTokens: r.inputTokens, outputTokens: r.outputTokens, costCents: r.costCents, error: r.error ?? null,
    startedAt: r.startedAt, finishedAt: r.finishedAt ?? null,
  }
}

function agentSummary(key: string) {
  const R = schema.agentRuns, P = schema.agentProposals
  const e = EMPLOYEES.find((x) => x.key === key)!
  const last = db.select().from(R).where(eq(R.agentKey, key)).orderBy(desc(R.startedAt), desc(sql`${R}.rowid`)).limit(1).get()
  const pending = db.select({ n: sql<number>`count(*)` }).from(P).where(and(eq(P.agentKey, key), eq(P.status, 'pending'))).get()?.n ?? 0
  return {
    key: e.key, name: e.name, title: e.title, description: e.description, schedule: e.schedule, enabled: isAgentEnabled(key), running: isRunning(key),
    lastRun: last ? {
      id: last.id, agentKey: last.agentKey, agentName: agentName(last.agentKey), trigger: last.trigger, status: last.status, summary: last.summary, startedAt: last.startedAt, finishedAt: last.finishedAt ?? null,
      itemsReviewed: last.itemsReviewed, proposalsCreated: last.proposalsCreated, autoExecuted: last.autoExecuted, costCents: last.costCents,
    } : null,
    pendingProposals: pending,
  }
}

function targetSummary(p: Proposal): { title: string; link: string | null; status?: string } | null {
  if (!p.targetId) return null
  switch (p.targetType) {
    case 'listing': {
      const l = db.select({ title: schema.listings.title, status: schema.listings.status }).from(schema.listings).where(eq(schema.listings.id, p.targetId)).get()
      return l ? { title: l.title, status: l.status, link: `/admin/listings?tab=${l.status}` } : { title: '(deleted listing)', link: null }
    }
    case 'application': {
      const r = db.select({ status: schema.applications.status, renter: schema.users.name, listing: schema.listings.title }).from(schema.applications)
        .innerJoin(schema.users, eq(schema.users.id, schema.applications.renterId))
        .innerJoin(schema.listings, eq(schema.listings.id, schema.applications.listingId))
        .where(eq(schema.applications.id, p.targetId)).get()
      return r ? { title: `${r.renter} → ${r.listing}`, status: r.status, link: `/admin/applications/${p.targetId}` } : { title: '(deleted application)', link: null }
    }
    case 'user': {
      const u = db.select({ name: schema.users.name, email: schema.users.email, role: schema.users.role }).from(schema.users).where(eq(schema.users.id, p.targetId)).get()
      return u ? { title: `${u.name} (${u.role})`, link: '/admin/users' } : { title: '(deleted user)', link: null }
    }
    case 'settings':
      return { title: 'Fee settings', link: '/admin/settings' }
    default:
      return null
  }
}

function serializeProposal(p: Proposal) {
  const decider = p.decidedBy && p.decidedBy !== 'policy'
    ? db.select({ name: schema.users.name }).from(schema.users).where(eq(schema.users.id, p.decidedBy)).get()
    : undefined
  return {
    id: p.id, agentKey: p.agentKey, agentName: agentName(p.agentKey), action: p.action, actionLabel: ACTIONS[p.action]?.label ?? p.action,
    targetType: p.targetType, targetId: p.targetId, target: targetSummary(p), payload: p.payload, adviceOnly: isAdviceOnly(p),
    rationale: p.rationale, confidence: p.confidence, risk: p.risk, status: p.status,
    decidedBy: p.decidedBy ?? null, decidedByName: p.decidedBy === 'policy' ? 'Policy (automatic)' : decider?.name ?? null,
    decidedAt: p.decidedAt ?? null, decisionNote: p.decisionNote ?? null, executedAt: p.executedAt ?? null,
    result: p.result ?? null, runId: p.runId ?? null, createdAt: p.createdAt,
  }
}

function policyList() {
  return Object.values(getPolicy()).map((a) => ({
    key: a.key, label: a.label, description: a.description, targetType: a.targetType, defaultAutonomy: a.defaultAutonomy,
    autonomy: a.autonomy, autoMinConfidence: a.autoMinConfidence, defaultAutoMinConfidence: ACTIONS[a.key].autoMinConfidence, locked: a.key === 'application.mark_fee_paid' || a.key === 'settings.fees',
  }))
}

/* ---------- Team ---------- */

agentsRouter.get('/admin/agents', (_req, res) => {
  res.json({
    configured: isConfigured(),
    model: currentModel(),
    intervalMinutes: env.AGENT_INTERVAL_MINUTES,
    budgetCents: env.AGENT_MONTHLY_BUDGET_CENTS,
    spentThisMonthCents: spentThisMonthCents(),
    agents: EMPLOYEES.map((e) => agentSummary(e.key)),
  })
})

agentsRouter.get('/admin/agents/policy', (_req, res) => { res.json({ actions: policyList() }) })

const policySchema = z.record(z.string().max(60), z.object({
  autonomy: z.enum(['auto', 'approve', 'never']).optional(),
  autoMinConfidence: z.number().int().min(0).max(100).optional(),
}))
agentsRouter.put('/admin/agents/policy', validate(policySchema), (req, res) => {
  const patch = v<PolicyPatch>(req)
  try { setPolicy(patch) } catch (e) { throw badRequest(e instanceof Error ? e.message : 'Invalid policy') }
  audit(req, 'agent.policy', 'agentPolicy', patch)
  res.json({ actions: policyList() })
})

const runsQuery = z.object({
  agent: opt(z.string().max(40)),
  limit: z.preprocess((x) => (x === '' ? undefined : x), z.coerce.number().int().min(1).max(200).default(50)),
})
agentsRouter.get('/admin/agents/runs', validate(runsQuery, 'query'), (req, res) => {
  const f = v<z.infer<typeof runsQuery>>(req, 'query')
  const R = schema.agentRuns
  const rows = db.select().from(R).where(f.agent ? eq(R.agentKey, f.agent) : undefined)
    .orderBy(desc(R.startedAt), desc(sql`${R}.rowid`)).limit(f.limit).all()
  res.json({ items: rows.map(serializeRun) })
})

agentsRouter.post('/admin/agents/run-all', async (req, res) => {
  audit(req, 'agent.run_all')
  const runs = await runAll('manual')
  res.json({ runs: runs.map(serializeRun) })
})

agentsRouter.post('/admin/agents/:key/run', validate(keyParams, 'params'), async (req, res) => {
  const { key } = v<{ key: string }>(req, 'params')
  if (!isAgentKey(key)) throw notFound('Unknown employee')
  audit(req, 'agent.run', key)
  const run = await runAgent(key, 'manual')
  res.json({ run: serializeRun(run) })
})

const enableSchema = z.object({ enabled: z.boolean() })
agentsRouter.patch('/admin/agents/:key', validate(keyParams, 'params'), validate(enableSchema), (req, res) => {
  const { key } = v<{ key: string }>(req, 'params')
  const { enabled } = v<z.infer<typeof enableSchema>>(req)
  if (!isAgentKey(key)) throw notFound('Unknown employee')
  setAgentEnabled(key, enabled)
  audit(req, 'agent.enable', key, { enabled })
  res.json({ agent: agentSummary(key) })
})

/* ---------- Approvals inbox ---------- */

const PROPOSAL_STATUSES = ['pending', 'approved', 'rejected', 'executed', 'failed', 'expired'] as const
const proposalsQuery = z.object({
  status: opt(z.enum(['all', ...PROPOSAL_STATUSES])),
  agent: opt(z.string().max(40)),
  limit: z.preprocess((x) => (x === '' ? undefined : x), z.coerce.number().int().min(1).max(200).default(100)),
})
agentsRouter.get('/admin/proposals', validate(proposalsQuery, 'query'), (req, res) => {
  const f = v<z.infer<typeof proposalsQuery>>(req, 'query')
  expireOldProposals()
  const P = schema.agentProposals
  const status = f.status ?? 'pending'
  const where: SQL[] = []
  if (status !== 'all') where.push(eq(P.status, status))
  if (f.agent) where.push(eq(P.agentKey, f.agent))
  const rows = db.select().from(P).where(where.length ? and(...where) : undefined)
    .orderBy(desc(P.createdAt), desc(sql`${P}.rowid`)).limit(f.limit).all()
  res.json({ items: rows.map(serializeProposal) })
})

agentsRouter.get('/admin/proposals/:id', validate(idParams, 'params'), (req, res) => {
  const P = schema.agentProposals
  const p = db.select().from(P).where(eq(P.id, v<{ id: string }>(req, 'params').id)).get()
  if (!p) throw notFound()
  const run = p.runId ? db.select().from(schema.agentRuns).where(eq(schema.agentRuns.id, p.runId)).get() : undefined
  res.json({ proposal: serializeProposal(p), run: run ? serializeRun(run) : null })
})

const decisionSchema = z.preprocess((x) => x ?? {}, z.object({ note: z.string().trim().max(1000).optional() }))
agentsRouter.post('/admin/proposals/:id/approve', validate(idParams, 'params'), validate(decisionSchema), (req, res) => {
  const { note } = v<z.infer<typeof decisionSchema>>(req)
  const p = approveProposal(v<{ id: string }>(req, 'params').id, req.user!, note, req.ip)
  res.json({ proposal: serializeProposal(p) })
})

agentsRouter.post('/admin/proposals/:id/reject', validate(idParams, 'params'), validate(decisionSchema), (req, res) => {
  const { note } = v<z.infer<typeof decisionSchema>>(req)
  const p = rejectProposal(v<{ id: string }>(req, 'params').id, req.user!, note, req.ip)
  res.json({ proposal: serializeProposal(p) })
})

const bulkSchema = z.object({
  ids: z.array(z.string().regex(/^[\w-]{3,40}$/)).min(1).max(100),
  decision: z.enum(['approve', 'reject']),
  note: z.string().trim().max(1000).optional(),
})
agentsRouter.post('/admin/proposals/bulk', validate(bulkSchema), (req, res) => {
  const { ids, decision, note } = v<z.infer<typeof bulkSchema>>(req)
  const results = [...new Set(ids)].map((id) => {
    try {
      const p = decision === 'approve' ? approveProposal(id, req.user!, note, req.ip) : rejectProposal(id, req.user!, note, req.ip)
      return { id, ok: p.status !== 'failed', status: p.status, result: p.result ?? undefined, proposal: serializeProposal(p) }
    } catch (e) {
      return { id, ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  })
  res.json({ results })
})

