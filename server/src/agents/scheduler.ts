/**
 * Runs the AI team on an interval (sequentially, never overlapping) and on events from the routes (debounced).
 */
import { env } from '../lib/env.js'
import { HttpError } from '../lib/errors.js'
import { isConfigured } from './client.js'
import { agentEvents } from './events.js'
import { isAgentEnabled } from './policy.js'
import { expireOldProposals } from './proposals.js'
import { EMPLOYEES, isRunning, runAgent, type Run } from './runtime.js'
import type { RunTrigger } from './types.js'

export const EVENT_DEBOUNCE_MS = 30_000

let cycle: Promise<Run[]> | null = null
export const cycleInProgress = () => cycle !== null

/** Run every employee once, in order. Rejects with 409 if a cycle is already running. */
export function runAll(trigger: RunTrigger): Promise<Run[]> {
  if (cycle) return Promise.reject(new HttpError(409, 'The AI team is already working', 'conflict'))
  cycle = (async () => {
    expireOldProposals()
    const runs: Run[] = []
    for (const e of EMPLOYEES) {
      if (trigger !== 'manual' && !isAgentEnabled(e.key)) continue
      if (isRunning(e.key)) continue
      try { runs.push(await runAgent(e.key, trigger)) } catch (err) { console.error(`[agents] ${e.key} crashed:`, err) }
    }
    return runs
  })().finally(() => { cycle = null })
  return cycle
}

/* ---------- Event hooks (debounced) ---------- */

const timers = new Map<string, NodeJS.Timeout>()

function scheduleEventRun(key: string) {
  if (!isConfigured() || !isAgentEnabled(key)) return
  clearTimeout(timers.get(key))
  const t = setTimeout(() => {
    timers.delete(key)
    // If a scheduled cycle is running or this employee is busy, the next cycle will pick the work up.
    if (cycle || isRunning(key)) return
    runAgent(key, 'event').catch((err) => console.error(`[agents] event run ${key} failed:`, err))
  }, EVENT_DEBOUNCE_MS)
  t.unref()
  timers.set(key, t)
}

let started = false
let interval: NodeJS.Timeout | null = null

/** Start the interval (when AGENT_INTERVAL_MINUTES > 0) and the event hooks. No-op when not configured. */
export function startScheduler() {
  if (started || !isConfigured()) return false
  started = true
  agentEvents.on('listing.submitted', () => scheduleEventRun('moderator'))
  agentEvents.on('application.submitted', () => scheduleEventRun('verifier'))
  if (env.AGENT_INTERVAL_MINUTES > 0) {
    const tick = () => { if (!cycle) runAll('schedule').catch((err) => console.error('[agents] cycle failed:', err)) }
    interval = setInterval(tick, env.AGENT_INTERVAL_MINUTES * 60_000)
    interval.unref()
    setTimeout(tick, 15_000).unref() // first pass shortly after boot
  }
  console.log(`AI team started (model ${env.AGENT_MODEL}, every ${env.AGENT_INTERVAL_MINUTES} min)`)
  return true
}

export function stopScheduler() {
  if (interval) clearInterval(interval)
  interval = null
  for (const t of timers.values()) clearTimeout(t)
  timers.clear()
  agentEvents.removeAllListeners()
  started = false
}
