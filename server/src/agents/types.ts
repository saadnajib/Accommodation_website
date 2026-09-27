import type { z } from 'zod'
import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages'
import type { DB } from '../db/index.js'
import type { AgentKey } from './roster.js'
import type { ProposalInput } from './proposals.js'

export type { ContentBlockParam }
export type RunTrigger = 'schedule' | 'manual' | 'event'

export interface AskRequest<T> {
  /** Stable instructions (cached). */
  system: string
  /** Per-run data: JSON text blocks plus images/documents. */
  content: ContentBlockParam[]
  schema: z.ZodType<T>
}

export interface AgentContext {
  runId: string
  trigger: RunTrigger
  /** One structured Claude call. Returns null when the model refused or its output could not be parsed: escalate. */
  ask<T>(req: AskRequest<T>): Promise<T | null>
  /** Adds a sentence to the run summary. */
  note(text: string): void
}

export interface Employee<I = unknown> {
  key: AgentKey
  name: string
  title: string
  description: string
  schedule: 'cycle' | 'daily'
  /** Max items per run (default 15). */
  batchSize?: number
  /** Optional reason to skip before gathering (e.g. daily employee already ran). Not consulted for manual runs. */
  skipReason?(d: DB): string | null
  gather(d: DB): Promise<I[]> | I[]
  decide(items: I[], ctx: AgentContext): Promise<ProposalInput[]>
}
