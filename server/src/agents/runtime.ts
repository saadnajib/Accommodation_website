/**
 * Shared runner for every AI employee: run bookkeeping, budget cap, one structured Claude call per batch,
 * decisions → proposals.
 */
import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { and, eq, gte, sql } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { env } from '../lib/env.js'
import { newId, now } from '../lib/crypto.js'
import { HttpError } from '../lib/errors.js'
import { REQUEST_TIMEOUT_MS, currentModel, estimateCostCents, getClient, isConfigured } from './client.js'
import { isAgentEnabled } from './policy.js'
import { createProposal } from './proposals.js'
import { EMPLOYEES, getEmployee } from './employees/index.js'
import type { AgentContext, AskRequest, ContentBlockParam, RunTrigger } from './types.js'

export type Run = typeof schema.agentRuns.$inferSelect

const running = new Set<string>()
export const isRunning = (key: string) => running.has(key)
export const anyRunning = () => running.size > 0

export function monthStartIso(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString()
}

export function spentThisMonthCents() {
  const R = schema.agentRuns
  return db.select({ s: sql<number>`coalesce(sum(${R.costCents}), 0)` }).from(R).where(gte(R.startedAt, monthStartIso())).get()?.s ?? 0
}

/** The most recent succeeded run of an agent after `sinceIso`, if any. */
export function succeededSince(agentKey: string, sinceIso: string) {
  const R = schema.agentRuns
  return !!db.select({ id: R.id }).from(R).where(and(eq(R.agentKey, agentKey), eq(R.status, 'succeeded'), gte(R.startedAt, sinceIso))).get()
}

function finish(runId: string, patch: Partial<Run>) {
  const R = schema.agentRuns
  db.update(R).set({ ...patch, finishedAt: now() }).where(eq(R.id, runId)).run()
  return db.select().from(R).where(eq(R.id, runId)).get()!
}

/** Swap URL-sourced images for a short text note (used when the API could not fetch one). */
function withoutUrlImages(content: ContentBlockParam[]): ContentBlockParam[] {
  return content.map((b) => (b.type === 'image' && b.source.type === 'url' ? { type: 'text', text: '(image unavailable)' } : b))
}

export async function runAgent(key: string, trigger: RunTrigger): Promise<Run> {
  const employee = getEmployee(key)
  if (!employee) throw new HttpError(404, 'Unknown employee', 'not_found')
  if (running.has(key)) throw new HttpError(409, `${employee.name} is already working`, 'conflict')
  running.add(key)
  const R = schema.agentRuns
  const runId = newId('run')
  db.insert(R).values({ id: runId, agentKey: key, trigger, status: 'running', summary: '', startedAt: now() }).run()
  const usage = { input: 0, output: 0, cents: 0 }
  const skip = (summary: string) => finish(runId, { status: 'skipped', summary })
  try {
    if (trigger !== 'manual' && !isAgentEnabled(key)) return skip(`${employee.name} is turned off.`)
    if (!isConfigured()) return skip('AI team is not configured (ANTHROPIC_API_KEY is not set).')
    const spent = spentThisMonthCents()
    if (spent >= env.AGENT_MONTHLY_BUDGET_CENTS) {
      return skip(`Monthly budget reached (${spent} of ${env.AGENT_MONTHLY_BUDGET_CENTS} cents).`)
    }
    if (trigger !== 'manual') {
      const why = employee.skipReason?.(db)
      if (why) return skip(why)
    }
    const items = (await employee.gather(db)).slice(0, employee.batchSize ?? 15)
    if (!items.length) return skip('Nothing to do.')

    const notes: string[] = []
    const ctx: AgentContext = {
      runId, trigger,
      note: (t) => { notes.push(t) },
      ask: async <T,>(req: AskRequest<T>) => {
        const client = getClient()
        const model = currentModel()
        const call = (content: ContentBlockParam[]) => client.messages.parse({
          model,
          max_tokens: 8000,
          thinking: { type: 'adaptive' },
          output_config: { effort: 'medium', format: zodOutputFormat(req.schema) },
          system: [{ type: 'text', text: req.system, cache_control: { type: 'ephemeral' } }],
          messages: [{ role: 'user', content }],
        }, { timeout: REQUEST_TIMEOUT_MS })
        let res: Awaited<ReturnType<typeof call>>
        try {
          try {
            res = await call(req.content)
          } catch (e) {
            // An https photo the API could not fetch fails the whole request: retry once without URL images.
            if (e instanceof Anthropic.BadRequestError && req.content.some((b) => b.type === 'image' && b.source.type === 'url')) {
              res = await call(withoutUrlImages(req.content))
            } else throw e
          }
        } catch (e) {
          // Output that does not match the schema (including a refusal cut mid-way): escalate instead of guessing.
          if (e instanceof Anthropic.AnthropicError && !(e instanceof Anthropic.APIError)) {
            notes.push('Model output could not be parsed; everything in the batch was escalated.')
            return null
          }
          throw e
        }
        usage.input += (res.usage?.input_tokens ?? 0) + (res.usage?.cache_creation_input_tokens ?? 0) + (res.usage?.cache_read_input_tokens ?? 0)
        usage.output += res.usage?.output_tokens ?? 0
        usage.cents += estimateCostCents(res.usage ?? {}, model)
        if (res.stop_reason === 'refusal') {
          notes.push('Model declined this batch; everything was escalated.')
          return null
        }
        if (res.parsed_output == null) {
          notes.push('Model returned no structured output; everything in the batch was escalated.')
          return null
        }
        return res.parsed_output as T
      },
    }

    const decisions = await employee.decide(items, ctx)
    let created = 0, auto = 0, pending = 0, failed = 0
    for (const d of decisions) {
      const r = createProposal({ id: runId }, d)
      if (!r.created) continue
      created++
      if (r.autoExecuted) auto++
      else if (r.proposal?.status === 'pending') pending++
      else if (r.proposal?.status === 'failed') failed++
    }
    const parts = [
      `${employee.name} reviewed ${items.length} item${items.length === 1 ? '' : 's'}: ${created} proposal${created === 1 ? '' : 's'}, ${auto} done automatically, ${pending} waiting for approval${failed ? `, ${failed} failed` : ''}.`,
      ...notes,
    ]
    return finish(runId, {
      status: 'succeeded', summary: parts.join(' ').slice(0, 2000), itemsReviewed: items.length, proposalsCreated: created,
      autoExecuted: auto, inputTokens: usage.input, outputTokens: usage.output, costCents: Math.ceil(usage.cents),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return finish(runId, {
      status: 'failed', summary: `Failed: ${msg}`.slice(0, 2000), error: msg.slice(0, 4000),
      inputTokens: usage.input, outputTokens: usage.output, costCents: Math.ceil(usage.cents),
    })
  } finally {
    running.delete(key)
  }
}

export { EMPLOYEES }
