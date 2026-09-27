/** Gabe, growth analyst: featured-listing offers, fee advice, and the CEO's daily brief. Runs once a day. */
import { z } from 'zod'
import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm'
import { schema, type DB } from '../../db/index.js'
import { getFees } from '../../lib/fees.js'
import { ROSTER } from '../roster.js'
import { UNTRUSTED_LINE, clampConfidence, jsonBlock } from '../media.js'
import type { ProposalInput } from '../proposals.js'
import type { Employee } from '../types.js'

export const OFFER_TITLE = 'Boost your listing'
export const BRIEF_MAX_CHARS = 1200
const DAY = 86_400_000
const iso = (msAgo: number) => new Date(Date.now() - msAgo).toISOString()

export interface GrowthSnapshot {
  candidates: Array<{ listingId: string; ownerId: string; title: string; city: string; area: string; type: string; price: number; currency: string; views: number; applicants: number; ageDays: number }>
  data: Record<string, unknown>
}

/** Did the growth employee already finish a run in the last 20 hours? */
function ranRecently(d: DB) {
  const R = schema.agentRuns
  return !!d.select({ id: R.id }).from(R).where(and(eq(R.agentKey, 'growth'), eq(R.status, 'succeeded'), gte(R.startedAt, iso(20 * 3600_000)))).get()
}

const SYSTEM = `You are Gabe, the growth analyst at StayBridge, a rental marketplace where StayBridge is the intermediary between renters and owners. You work once a day for the CEO.

Rules from the operator's guide:
- "Sell Featured. Overview shows live listings that are not featured. Message owners of good listings in busy cities and offer the 30-day boost. Owners who paid once tend to renew."
- "Check fees vs. conversion. If renters accept but do not pay, the renter fee is too high. If owners decline good renters, the owner fee is too high. Change one number at a time and give it two weeks."
- "The defaults (50% renter, 35% owner) add up to 85% of a month's rent. That is high. In a normal market, start lower and raise it once you have reviews: Renter 25 to 35%, owner 25%, minimum $79."
- "Featured listings are almost pure margin. Price them at roughly one day of rent."

Your output:
1. offers: up to 3 featured-listing offers to owners of strong live listings (many views or applicants, busy city). Only use listingIds from "candidates". message is the in-app notification the owner receives: at most 2 sentences, friendly, mention the listing title and the featured price from "fees", no links. Skip offers when no listing is a good fit.
2. feeRecommendation: only when the numbers clearly justify changing ONE fee setting; otherwise null. Rates are fractions of one month's rent (0.3 = 30%). The CEO decides; this is advice only.
3. brief: the CEO's daily brief, plain text, at most ${BRIEF_MAX_CHARS} characters, in four short parts: yesterday's numbers; what the AI team did; what needs the CEO today (pending approvals, payments to record, stuck deals); one suggestion.

confidence is 0-100. reason is one sentence for the CEO. Use only the numbers you are given; never invent figures.

${UNTRUSTED_LINE}`

const Output = z.object({
  offers: z.array(z.object({ listingId: z.string(), message: z.string(), confidence: z.number().describe('0-100'), reason: z.string() })),
  feeRecommendation: z.object({
    renterFeeRate: z.number().optional(),
    ownerFeeRate: z.number().optional(),
    minFee: z.number().optional(),
    reason: z.string(),
  }).nullable(),
  brief: z.string(),
})

export const growth: Employee<GrowthSnapshot> = {
  key: 'growth',
  ...ROSTER.growth,
  batchSize: 1,

  skipReason(d) {
    return ranRecently(d) ? 'Already ran in the last 20 hours (daily).' : null
  },

  gather(d: DB) {
    const A = schema.applications, L = schema.listings, P = schema.payments, E = schema.applicationEvents
    const R = schema.agentRuns, PR = schema.agentProposals, N = schema.notifications
    const count = (q: { n: number } | undefined) => q?.n ?? 0
    const pipeline: Record<string, number> = {}
    for (const r of d.select({ s: A.status, n: sql<number>`count(*)` }).from(A).groupBy(A.status).all()) pipeline[r.s] = r.n
    const listings: Record<string, number> = {}
    for (const r of d.select({ s: L.status, n: sql<number>`count(*)` }).from(L).groupBy(L.status).all()) listings[r.s] = r.n
    const featuredLive = count(d.select({ n: sql<number>`count(*)` }).from(L).where(and(eq(L.status, 'active'), eq(L.featured, true))).get())
    const revenueCollected = d.select({ s: sql<number>`coalesce(sum(${P.amount}), 0)` }).from(P).where(eq(P.status, 'succeeded')).get()?.s ?? 0
    const revenuePending = d.select({ s: sql<number>`coalesce(sum((CASE WHEN ${A.renterFeePaid} = 1 THEN 0 ELSE ${A.renterFee} END) + (CASE WHEN ${A.ownerFeePaid} = 1 THEN 0 ELSE ${A.ownerFee} END)), 0)` })
      .from(A).where(eq(A.status, 'awaiting_fees')).get()?.s ?? 0

    const window = (ms: number) => {
      const since = iso(ms)
      return {
        newApplications: count(d.select({ n: sql<number>`count(*)` }).from(A).where(gte(A.createdAt, since)).get()),
        newListings: count(d.select({ n: sql<number>`count(*)` }).from(L).where(gte(L.createdAt, since)).get()),
        completedDeals: count(d.select({ n: sql<number>`count(*)` }).from(E).where(and(eq(E.status, 'completed'), gte(E.at, since))).get()),
        ownerAccepted: count(d.select({ n: sql<number>`count(*)` }).from(E).where(and(eq(E.status, 'owner_accepted'), gte(E.at, since))).get()),
        ownerDeclined: count(d.select({ n: sql<number>`count(*)` }).from(E).where(and(eq(E.status, 'owner_declined'), gte(E.at, since))).get()),
        feesCollected: d.select({ s: sql<number>`coalesce(sum(${P.amount}), 0)` }).from(P).where(and(eq(P.status, 'succeeded'), gte(P.createdAt, since))).get()?.s ?? 0,
        feePayments: count(d.select({ n: sql<number>`count(*)` }).from(P).where(and(eq(P.status, 'succeeded'), gte(P.createdAt, since))).get()),
        purchases: d.select({ s: sql<number>`coalesce(sum(${schema.purchases.amount}), 0)` }).from(schema.purchases).where(gte(schema.purchases.createdAt, since)).get()?.s ?? 0,
      }
    }

    const since24 = iso(DAY)
    const aiRuns = d.select({ agent: R.agentKey, status: R.status, n: sql<number>`count(*)` }).from(R).where(gte(R.startedAt, since24)).groupBy(R.agentKey, R.status).all()
    const aiProposals = d.select({ agent: PR.agentKey, action: PR.action, status: PR.status, n: sql<number>`count(*)` }).from(PR).where(gte(PR.createdAt, since24)).groupBy(PR.agentKey, PR.action, PR.status).all()
    const pendingApprovals = count(d.select({ n: sql<number>`count(*)` }).from(PR).where(eq(PR.status, 'pending')).get())
    const awaitingFees = d.select({ a: A }).from(A).where(eq(A.status, 'awaiting_fees')).all()
      .map(({ a }) => ({ applicationId: a.id, renterFeePaid: a.renterFeePaid, ownerFeePaid: a.ownerFeePaid, since: a.updatedAt }))

    // Owners offered a boost in the last 14 days are not offered again.
    const recentlyOffered = new Set(d.select({ u: N.userId }).from(N).where(and(eq(N.title, OFFER_TITLE), gte(N.at, iso(14 * DAY)))).all().map((r) => r.u))
    const live = d.select().from(L).where(and(eq(L.status, 'active'), eq(L.featured, false))).orderBy(desc(L.views)).limit(40).all()
      .filter((l) => !recentlyOffered.has(l.ownerId))
    const applicantCounts = new Map<string, number>()
    if (live.length) {
      for (const r of d.select({ id: A.listingId, n: sql<number>`count(*)` }).from(A).where(inArray(A.listingId, live.map((l) => l.id))).groupBy(A.listingId).all()) applicantCounts.set(r.id, r.n)
    }
    const candidates = live.slice(0, 15).map((l) => ({
      listingId: l.id, ownerId: l.ownerId, title: l.title, city: l.city, area: l.area, type: l.type, price: l.price, currency: l.currency,
      views: l.views, applicants: applicantCounts.get(l.id) ?? 0, ageDays: Math.floor((Date.now() - Date.parse(l.createdAt)) / DAY),
    }))
    return [{
      candidates,
      data: {
        today: new Date().toISOString().slice(0, 10),
        overview: { pipeline, listings, featuredLive, revenueCollected, revenuePending },
        last24h: window(DAY),
        last30d: window(30 * DAY),
        fees: getFees(),
        aiTeamLast24h: { runs: aiRuns, proposals: aiProposals, pendingApprovals },
        awaitingFees,
      },
    }]
  },

  async decide(items, ctx) {
    const snap = items[0]
    const content = [
      jsonBlock('Business snapshot:', snap.data),
      jsonBlock('Featured-offer candidates (live, not featured, owner not offered in the last 14 days):', {
        candidates: snap.candidates.map(({ ownerId: _o, ...c }) => ({ listingId: c.listingId, data: { title: c.title, area: c.area }, city: c.city, type: c.type, price: c.price, currency: c.currency, views: c.views, applicants: c.applicants, ageDays: c.ageDays })),
      }),
      { type: 'text' as const, text: 'Produce offers, feeRecommendation and brief.' },
    ]
    const out = await ctx.ask({ system: SYSTEM, content, schema: Output })
    if (!out) return []

    const byId = new Map(snap.candidates.map((c) => [c.listingId, c]))
    const proposals: ProposalInput[] = []
    const owners = new Set<string>()
    for (const o of out.offers) {
      const c = byId.get(o.listingId)
      if (!c || owners.has(c.ownerId) || owners.size >= 3) continue
      owners.add(c.ownerId)
      proposals.push({
        agentKey: 'growth', action: 'user.notify', targetType: 'user', targetId: c.ownerId,
        payload: { title: OFFER_TITLE, message: o.message.trim().slice(0, 500), link: '/owner/listings', listingId: c.listingId },
        rationale: `Featured offer for "${c.title}" (${c.views} views, ${c.applicants} applicants). ${o.reason}`.slice(0, 1000),
        confidence: clampConfidence(o.confidence), risk: 'low',
      })
    }
    const f = out.feeRecommendation
    if (f) {
      const fees: Record<string, number> = {}
      if (typeof f.renterFeeRate === 'number' && f.renterFeeRate >= 0 && f.renterFeeRate <= 2) fees.renterFeeRate = f.renterFeeRate
      if (typeof f.ownerFeeRate === 'number' && f.ownerFeeRate >= 0 && f.ownerFeeRate <= 2) fees.ownerFeeRate = f.ownerFeeRate
      if (typeof f.minFee === 'number' && f.minFee >= 0) fees.minFee = Math.round(f.minFee)
      if (Object.keys(fees).length) {
        proposals.push({ agentKey: 'growth', action: 'settings.fees', targetType: 'settings', targetId: 'fees', payload: { fees, current: getFees() }, rationale: f.reason.slice(0, 1000), confidence: 50, risk: 'high' })
      }
    }
    const brief = out.brief.trim().slice(0, BRIEF_MAX_CHARS)
    if (brief) proposals.push({ agentKey: 'growth', action: 'ceo.brief', targetType: 'none', targetId: null, payload: { text: brief }, rationale: 'Daily brief for the CEO.', confidence: 100, risk: 'low' })
    return proposals
  },
}
