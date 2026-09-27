/**
 * Every action an AI employee can take, with its default autonomy level.
 *  - 'auto'    : executed immediately by policy (low risk, reversible, no money moves)
 *  - 'approve' : waits for the CEO in the Approvals inbox
 *  - 'never'   : the employee may only recommend; nothing executes even if approved (advice only)
 * The CEO can override every level in Admin → AI team → Policy (stored in settings key 'agentPolicy').
 */
export type Autonomy = 'auto' | 'approve' | 'never'

export interface ActionSpec {
  key: string
  label: string
  targetType: 'listing' | 'application' | 'user' | 'settings' | 'none'
  defaultAutonomy: Autonomy
  /** Above this confidence (0-100) an 'auto' action executes; below it, it is escalated to approval. */
  autoMinConfidence: number
  description: string
}

export const ACTIONS: Record<string, ActionSpec> = {
  // Listing moderation (Maya)
  'listing.approve': { key: 'listing.approve', label: 'Approve listing', targetType: 'listing', defaultAutonomy: 'auto', autoMinConfidence: 80, description: 'Set a pending listing live.' },
  'listing.reject': { key: 'listing.reject', label: 'Reject listing', targetType: 'listing', defaultAutonomy: 'approve', autoMinConfidence: 95, description: 'Reject a pending listing with a reason sent to the owner.' },
  'listing.pause': { key: 'listing.pause', label: 'Pause listing', targetType: 'listing', defaultAutonomy: 'approve', autoMinConfidence: 90, description: 'Pause a live listing whose owner is unresponsive.' },
  'listing.feature': { key: 'listing.feature', label: 'Feature listing (free)', targetType: 'listing', defaultAutonomy: 'approve', autoMinConfidence: 100, description: 'Comp a featured slot to a strong listing.' },

  // Verification (Victor)
  'application.start_review': { key: 'application.start_review', label: 'Start review', targetType: 'application', defaultAutonomy: 'auto', autoMinConfidence: 0, description: 'Move a submitted application to under review so the renter sees progress.' },
  'application.verify': { key: 'application.verify', label: 'Approve verification', targetType: 'application', defaultAutonomy: 'auto', autoMinConfidence: 85, description: 'Mark the renter verified. Escalated when documents are unclear or affordability is weak.' },
  'application.reject': { key: 'application.reject', label: 'Reject application', targetType: 'application', defaultAutonomy: 'approve', autoMinConfidence: 100, description: 'Decline a renter with a reason.' },

  // Deals (Dana)
  'application.send_to_owner': { key: 'application.send_to_owner', label: 'Present to owner', targetType: 'application', defaultAutonomy: 'auto', autoMinConfidence: 70, description: 'Show a verified renter to the owner.' },
  'application.set_price': { key: 'application.set_price', label: 'Set agreed price', targetType: 'application', defaultAutonomy: 'approve', autoMinConfidence: 100, description: 'Change the agreed rent after negotiation. Fees recalculate.' },
  'application.record_owner_decision': { key: 'application.record_owner_decision', label: 'Record owner decision', targetType: 'application', defaultAutonomy: 'approve', autoMinConfidence: 100, description: 'Record accept/decline on the owner\'s behalf.' },
  'application.mark_fee_paid': { key: 'application.mark_fee_paid', label: 'Mark fee received', targetType: 'application', defaultAutonomy: 'never', autoMinConfidence: 100, description: 'Money. Only the CEO records offline payments.' },
  'application.complete': { key: 'application.complete', label: 'Mark deal completed', targetType: 'application', defaultAutonomy: 'approve', autoMinConfidence: 100, description: 'Close the deal and mark the listing rented.' },
  'application.cancel': { key: 'application.cancel', label: 'Cancel application', targetType: 'application', defaultAutonomy: 'approve', autoMinConfidence: 100, description: 'Withdraw a dead application.' },
  'application.nudge': { key: 'application.nudge', label: 'Send reminder', targetType: 'application', defaultAutonomy: 'auto', autoMinConfidence: 60, description: 'In-app notification to the renter or owner (pay fee, respond to applicant).' },

  // Growth (Gabe)
  'user.notify': { key: 'user.notify', label: 'Send message to user', targetType: 'user', defaultAutonomy: 'auto', autoMinConfidence: 70, description: 'In-app notification, e.g. featured-listing offer to an owner.' },
  'settings.fees': { key: 'settings.fees', label: 'Change fee settings', targetType: 'settings', defaultAutonomy: 'never', autoMinConfidence: 100, description: 'Pricing is the CEO\'s call. Recommendation only.' },
  'ceo.brief': { key: 'ceo.brief', label: 'Daily brief', targetType: 'none', defaultAutonomy: 'auto', autoMinConfidence: 0, description: 'A short written brief for the CEO (creates an admin notification).' },
}

export const NUDGE_COOLDOWN_HOURS = 48
