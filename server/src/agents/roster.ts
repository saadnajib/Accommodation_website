/** Static roster (names/titles) so modules can label things without importing the employee implementations. */
export const ROSTER = {
  moderator: { name: 'Maya', title: 'Listing moderator', description: 'Reviews pending listings: real photos, plausible price, scam patterns.', schedule: 'cycle' },
  verifier: { name: 'Victor', title: 'Verification officer', description: 'Reviews submitted applications: ID document and selfie, name match, affordability, message quality.', schedule: 'cycle' },
  deals: { name: 'Dana', title: 'Deal manager', description: 'Presents verified renters to owners, chases owners and unpaid fees, flags stuck deals, recommends agreed prices.', schedule: 'cycle' },
  growth: { name: 'Gabe', title: 'Growth analyst', description: 'Featured-listing offers, pricing recommendations, and a daily CEO brief.', schedule: 'daily' },
} as const satisfies Record<string, { name: string; title: string; description: string; schedule: 'cycle' | 'daily' }>

export type AgentKey = keyof typeof ROSTER
export const AGENT_KEYS = Object.keys(ROSTER) as AgentKey[]
export const isAgentKey = (k: string): k is AgentKey => k in ROSTER
export const agentName = (k: string) => (isAgentKey(k) ? ROSTER[k].name : k)
