/**
 * Lazily constructed Anthropic client. The AI team is "configured" only when ANTHROPIC_API_KEY is set
 * (or a test double was injected with setClientForTests).
 */
import Anthropic from '@anthropic-ai/sdk'
import { env } from '../lib/env.js'

/** The subset of the SDK the runtime uses; lets tests inject a mock `messages.parse`. */
export type AgentClient = Pick<Anthropic, 'messages'>

let client: AgentClient | null = null
/** undefined = use env; null = force "not configured"; object = injected test double. */
let override: AgentClient | null | undefined

export const REQUEST_TIMEOUT_MS = 120_000

export function isConfigured() {
  if (override !== undefined) return override !== null
  return !!env.ANTHROPIC_API_KEY
}

export function getClient(): AgentClient {
  if (override) return override
  if (override === null || !env.ANTHROPIC_API_KEY) throw new Error('AI team is not configured: set ANTHROPIC_API_KEY')
  client ??= new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, timeout: REQUEST_TIMEOUT_MS })
  return client
}

/** Tests only: inject a fake client (object), force unconfigured (null), or restore env behaviour (undefined). */
export function setClientForTests(c: unknown) {
  override = c as AgentClient | null | undefined
}

export function currentModel() {
  return env.AGENT_MODEL
}

/** USD per million tokens [input, output]. Unknown models are priced as Opus (conservative). */
const PRICES: Array<[RegExp, number, number]> = [
  [/haiku/i, 1, 5],
  [/sonnet/i, 2, 10],
  [/opus/i, 5, 25],
]

export interface UsageLike {
  input_tokens?: number | null
  output_tokens?: number | null
  cache_creation_input_tokens?: number | null
  cache_read_input_tokens?: number | null
}

/** Cost of one call in US cents (fractional; the caller rounds up when storing). */
export function estimateCostCents(usage: UsageLike, model: string = env.AGENT_MODEL) {
  const [, inPrice, outPrice] = PRICES.find(([re]) => re.test(model)) ?? PRICES[2]
  const input = usage.input_tokens ?? 0
  const cacheWrite = usage.cache_creation_input_tokens ?? 0
  const cacheRead = usage.cache_read_input_tokens ?? 0
  const output = usage.output_tokens ?? 0
  const dollars = ((input + cacheWrite * 1.25 + cacheRead * 0.1) * inPrice + output * outPrice) / 1_000_000
  return dollars * 100
}
