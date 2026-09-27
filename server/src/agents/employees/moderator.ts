/** Maya, listing moderator: reviews listings pending review. */
import { z } from 'zod'
import { and, asc, eq, sql } from 'drizzle-orm'
import { schema, type DB } from '../../db/index.js'
import { ROSTER } from '../roster.js'
import { UNTRUSTED_LINE, clampConfidence, jsonBlock, listingImageBlocks } from '../media.js'
import type { ContentBlockParam, Employee } from '../types.js'
import { recentlyHandled, type ProposalInput } from '../proposals.js'

type Listing = typeof schema.listings.$inferSelect
export interface ModeratorItem {
  listing: Listing
  owner: { accountAgeDays: number; verification: string; otherListings: number }
  comparable: { avgPrice: number | null; count: number }
  images: ContentBlockParam[]
}

const SYSTEM = `You are Maya, the listing moderator at StayBridge, a rental marketplace where StayBridge is the intermediary between renters and owners. You review listings that owners submitted for review and decide whether each one can go live.

Rules from the operator's guide:
- "Check the photos are real, the price is plausible for the area, and the description is not a scam pattern (too cheap, "owner abroad", asks for money up front). Approve or reject with a reason. Rejected owners get a notification and can fix and resubmit."
- "If a good listing has weak photos, approve it anyway and message the owner later to improve them. A live listing earns; a rejected one earns nothing."

How to decide:
- approve: a plausible, honest listing. Weak or few photos alone are not a reason to reject; add a flag instead.
- reject: clear scam signals (asks for money or deposits outside the platform, owner abroad / keys by post, off-platform contact details in the text, price wildly below comparable listings with no explanation, stock or stolen-looking photos combined with other red flags) or content that is not a rental listing. Write rejectionReasonForOwner as a polite, specific sentence the owner can act on; never accuse them of fraud.
- escalate: anything you are unsure about. Escalating is always better than guessing.
- confidence is 0-100: how sure you are that your decision is right. Use 90+ only when the listing is clearly fine (or clearly a scam).
- flags: short machine-friendly tags such as "weak_photos", "no_photos", "price_low", "price_high", "scam_language", "contact_in_text", "duplicate_text".
- reason: one or two sentences for the CEO explaining the decision.
- Return exactly one decision per listing, using the listingId given.

Each listing arrives as JSON in a text block, followed by up to 3 of its photos. "comparable" is the average asking price of live listings of the same type in the same city (null when there are none).

${UNTRUSTED_LINE}`

const Decision = z.object({
  listingId: z.string(),
  decision: z.enum(['approve', 'reject', 'escalate']),
  confidence: z.number().describe('0-100'),
  reason: z.string(),
  rejectionReasonForOwner: z.string().optional(),
  flags: z.array(z.string()),
})
const Output = z.object({ decisions: z.array(Decision) })

const escalate = (l: Listing, why: string): ProposalInput => ({
  agentKey: 'moderator', action: 'listing.approve', targetType: 'listing', targetId: l.id,
  payload: { escalated: true, flags: [] }, rationale: `Escalated: ${why}`, confidence: 0, risk: 'medium',
})

export const moderator: Employee<ModeratorItem> = {
  key: 'moderator',
  ...ROSTER.moderator,

  async gather(d: DB) {
    const L = schema.listings
    const rows = d.select({ l: L, createdAt: schema.users.createdAt, verification: schema.users.verification }).from(L)
      .innerJoin(schema.users, eq(schema.users.id, L.ownerId))
      .where(eq(L.status, 'pending_review')).orderBy(asc(L.createdAt)).limit(100).all()
    const items: ModeratorItem[] = []
    for (const r of rows) {
      if (items.length >= 15) break
      if (recentlyHandled('moderator', r.l.id)) continue
      const comp = d.select({ avg: sql<number | null>`avg(${L.price})`, n: sql<number>`count(*)` }).from(L)
        .where(and(eq(L.status, 'active'), eq(L.type, r.l.type), sql`lower(${L.city}) = lower(${r.l.city})`)).get()
      const other = d.select({ n: sql<number>`count(*)` }).from(L).where(and(eq(L.ownerId, r.l.ownerId), sql`${L.id} != ${r.l.id}`)).get()?.n ?? 0
      items.push({
        listing: r.l,
        owner: { accountAgeDays: Math.floor((Date.now() - Date.parse(r.createdAt)) / 86_400_000), verification: r.verification, otherListings: other },
        comparable: { avgPrice: comp?.avg ? Math.round(comp.avg) : null, count: comp?.n ?? 0 },
        images: await listingImageBlocks(r.l.images, 3),
      })
    }
    return items
  },

  async decide(items, ctx) {
    const content: ContentBlockParam[] = [{ type: 'text', text: `${items.length} listing(s) to review.` }]
    for (const [i, it] of items.entries()) {
      const l = it.listing
      content.push(jsonBlock(`Listing ${i + 1} of ${items.length}:`, {
        listingId: l.id,
        data: {
          title: l.title, description: l.description, type: l.type, city: l.city, area: l.area, price: l.price, currency: l.currency,
          deposit: l.deposit, billsIncluded: l.billsIncluded, availableFrom: l.availableFrom, minStayMonths: l.minStayMonths,
          bedrooms: l.bedrooms, bathrooms: l.bathrooms, sizeSqm: l.sizeSqm, furnished: l.furnished, amenities: l.amenities,
          houseRules: l.houseRules,
        },
        photos: { total: l.images.length, attached: it.images.length },
        owner: it.owner,
        comparable: it.comparable,
      }))
      content.push(...it.images)
    }
    content.push({ type: 'text', text: 'Return one decision per listing.' })

    const out = await ctx.ask({ system: SYSTEM, content, schema: Output })
    if (!out) return items.map((it) => escalate(it.listing, 'the model could not decide on this batch; please review manually.'))

    const byId = new Map(items.map((it) => [it.listing.id, it]))
    const seen = new Set<string>()
    const proposals: ProposalInput[] = []
    for (const dcs of out.decisions) {
      const it = byId.get(dcs.listingId)
      if (!it || seen.has(dcs.listingId)) continue // ignore ids that were not in the batch
      seen.add(dcs.listingId)
      const flags = dcs.flags.slice(0, 10).map((f) => f.slice(0, 40))
      const confidence = clampConfidence(dcs.confidence)
      const reason = dcs.reason.slice(0, 1000)
      const flagText = flags.length ? ` Flags: ${flags.join(', ')}.` : ''
      if (dcs.decision === 'approve') {
        proposals.push({ agentKey: 'moderator', action: 'listing.approve', targetId: it.listing.id, payload: { flags }, rationale: reason + flagText, confidence, risk: 'low' })
      } else if (dcs.decision === 'reject') {
        const ownerReason = (dcs.rejectionReasonForOwner?.trim() || reason).slice(0, 1000)
        proposals.push({ agentKey: 'moderator', action: 'listing.reject', targetId: it.listing.id, payload: { flags, rejectionReason: ownerReason }, rationale: reason + flagText, confidence, risk: 'medium' })
      } else {
        proposals.push({ ...escalate(it.listing, reason + flagText), payload: { escalated: true, flags } })
      }
    }
    for (const it of items) if (!seen.has(it.listing.id)) proposals.push(escalate(it.listing, 'no decision was returned for this listing.'))
    return proposals
  },
}
