/**
 * Tiny event bus so routes can wake the AI team without importing the scheduler (avoids circular imports).
 * The scheduler subscribes in startScheduler(); with no subscriber, emitting is a no-op.
 */
import { EventEmitter } from 'node:events'

export interface AgentEventMap {
  'listing.submitted': [listingId: string]
  'application.submitted': [applicationId: string]
}

export const agentEvents = new EventEmitter<AgentEventMap>()
