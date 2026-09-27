/** Victor, verification officer: reviews submitted applications (ID document + selfie via vision, affordability). */
import { z } from 'zod'
import { asc, desc, eq, inArray } from 'drizzle-orm'
import { schema, type DB } from '../../db/index.js'
import { ROSTER } from '../roster.js'
import { UNTRUSTED_LINE, clampConfidence, fileBlock, jsonBlock } from '../media.js'
import type { ContentBlockParam, Employee } from '../types.js'
import { recentlyHandled, type ProposalInput } from '../proposals.js'

type Application = typeof schema.applications.$inferSelect
export interface VerifierItem {
  app: Application
  renter: { name: string; accountAgeDays: number; verification: string; hasTenantPass: boolean }
  listing: { title: string; city: string; price: number; currency: string }
  ratio: number | null
  band: 'green' | 'amber' | 'red' | 'unknown'
  idDoc: ContentBlockParam | null
  selfie: ContentBlockParam | null
}

/** Without both documents the employee decides from the profile only and can never auto-verify. */
export const NO_DOCS_CONFIDENCE_CAP = 70
/** A red affordability ratio is always escalated to the CEO (below the 85 auto threshold). */
export const RED_AFFORDABILITY_CAP = 80

export function affordability(income: number | undefined, rent: number) {
  if (!income || rent <= 0) return { ratio: null, band: 'unknown' as const }
  const ratio = Math.round((income / rent) * 100) / 100
  return { ratio, band: ratio >= 3 ? 'green' as const : ratio >= 2 ? 'amber' as const : 'red' as const }
}

const SYSTEM = `You are Victor, the verification officer at StayBridge, a rental marketplace where StayBridge is the intermediary between renters and owners. You review renters' applications before they are shown to owners.

Rules from the operator's guide:
- "Open the ID document and selfie. Do the faces match, is the document unexpired, does the name match the account?"
- "Check the profile: affordability ratio (income ÷ rent). Green is 3x or more, amber 2 to 3x, red under 2x. Owners rarely accept red."
- "Read the message to the owner. Does it sound like a real person?"
- "Approve verification or Reject with a clear reason. Rejections are rare; be generous with borderline cases and let the owner decide."
- "Never accept a renter you have not verified. One scammer costs you every owner in that city."

How to decide:
- verify: the documents are legible, the name on the ID matches the account name, the selfie matches the ID photo, and nothing looks fraudulent. Amber affordability is fine; red affordability should normally be escalated so the CEO can decide.
- reject: only for clear problems: a document that is obviously fake, expired or belongs to someone else, a selfie that is clearly a different person, or an application that is plainly spam. Write renterFacingReason as one polite sentence the renter can act on.
- escalate: anything unclear, missing or borderline. Escalating is always better than guessing.
- When documents are not attached ("documents": false), you cannot check identity: set docLegible, nameMatches and faceMatches to false and decide from the profile only.
- confidence is 0-100: how sure you are that your decision is right.
- reason: one or two sentences for the CEO. Never repeat full document numbers.
- Return exactly one decision per application, using the applicationId given.

Each application arrives as JSON in a text block, followed by its ID document and selfie when available. "affordability" is precomputed from the stated monthly income and the agreed rent.

${UNTRUSTED_LINE}`

const Decision = z.object({
  applicationId: z.string(),
  decision: z.enum(['verify', 'reject', 'escalate']),
  confidence: z.number().describe('0-100'),
  reason: z.string(),
  renterFacingReason: z.string().optional(),
  checks: z.object({
    docLegible: z.boolean(),
    nameMatches: z.boolean(),
    faceMatches: z.boolean(),
    affordability: z.enum(['green', 'amber', 'red']),
    messageGenuine: z.boolean(),
  }),
})
const Output = z.object({ decisions: z.array(Decision) })

const escalate = (a: Application, why: string): ProposalInput => ({
  agentKey: 'verifier', action: 'application.verify', targetType: 'application', targetId: a.id,
  payload: { escalated: true }, rationale: `Escalated: ${why}`, confidence: 0, risk: 'medium',
})
const yn = (b: boolean) => (b ? 'yes' : 'no')

export const verifier: Employee<VerifierItem> = {
  key: 'verifier',
  ...ROSTER.verifier,

  gather(d: DB) {
    const A = schema.applications
    const U = schema.users
    const rows = d.select({ a: A, u: U, l: schema.listings }).from(A)
      .innerJoin(U, eq(U.id, A.renterId))
      .innerJoin(schema.listings, eq(schema.listings.id, A.listingId))
      .where(inArray(A.status, ['submitted', 'under_review']))
      .orderBy(desc(U.hasTenantPass), asc(A.createdAt)).limit(100).all()
      .filter((r) => !recentlyHandled('verifier', r.a.id)).slice(0, 15)
    return rows.map(({ a, u, l }) => {
      const { ratio, band } = affordability(a.profile?.monthlyIncome, a.agreedPrice)
      return {
        app: a,
        renter: { name: u.name, accountAgeDays: Math.floor((Date.now() - Date.parse(u.createdAt)) / 86_400_000), verification: u.verification, hasTenantPass: u.hasTenantPass },
        listing: { title: l.title, city: l.city, price: l.price, currency: l.currency },
        ratio, band,
        idDoc: fileBlock(a.idDocumentFileId),
        selfie: fileBlock(a.selfieFileId),
      }
    })
  },

  async decide(items, ctx) {
    const proposals: ProposalInput[] = []
    // Let renters see movement first.
    for (const it of items) {
      if (it.app.status === 'submitted') {
        proposals.push({ agentKey: 'verifier', action: 'application.start_review', targetId: it.app.id, payload: {}, rationale: 'Starting review so the renter sees progress.', confidence: 100, risk: 'low' })
      }
    }

    const content: ContentBlockParam[] = [{ type: 'text', text: `${items.length} application(s) to review.` }]
    for (const [i, it] of items.entries()) {
      const a = it.app
      const hasDocs = !!(it.idDoc && it.selfie)
      content.push(jsonBlock(`Application ${i + 1} of ${items.length}:`, {
        applicationId: a.id,
        data: {
          accountName: it.renter.name, occupation: a.profile?.occupation, employer: a.profile?.employer,
          monthlyIncome: a.profile?.monthlyIncome, occupants: a.profile?.occupants, hasPets: a.profile?.hasPets, smoker: a.profile?.smoker,
          aboutMe: a.profile?.aboutMe, references: a.profile?.references, messageToOwner: a.message,
          listingTitle: it.listing.title,
        },
        renter: { accountAgeDays: it.renter.accountAgeDays, hasTenantPass: it.renter.hasTenantPass },
        listing: { city: it.listing.city, askingPrice: it.listing.price, currency: it.listing.currency },
        proposedPrice: a.proposedPrice, agreedPrice: a.agreedPrice, moveInDate: a.moveInDate, stayMonths: a.stayMonths,
        affordability: { ratio: it.ratio, band: it.band },
        idType: a.idType, idNumberLast4: a.idNumberMasked?.slice(-4) ?? null,
        documents: hasDocs, proofOfIncomeProvided: !!a.proofOfIncomeFileId,
      }))
      if (it.idDoc) content.push({ type: 'text', text: `ID document for ${a.id}:` }, it.idDoc)
      if (it.selfie) content.push({ type: 'text', text: `Selfie for ${a.id}:` }, it.selfie)
    }
    content.push({ type: 'text', text: 'Return one decision per application.' })

    const out = await ctx.ask({ system: SYSTEM, content, schema: Output })
    if (!out) return [...proposals, ...items.map((it) => escalate(it.app, 'the model could not decide on this batch; please review manually.'))]

    const byId = new Map(items.map((it) => [it.app.id, it]))
    const seen = new Set<string>()
    for (const dcs of out.decisions) {
      const it = byId.get(dcs.applicationId)
      if (!it || seen.has(dcs.applicationId)) continue
      seen.add(dcs.applicationId)
      const hasDocs = !!(it.idDoc && it.selfie)
      let cap = hasDocs ? 100 : NO_DOCS_CONFIDENCE_CAP
      if (it.band === 'red' || dcs.checks.affordability === 'red') cap = Math.min(cap, RED_AFFORDABILITY_CAP)
      const confidence = clampConfidence(dcs.confidence, cap)
      const c = dcs.checks
      const checks = `Checks: document legible ${yn(c.docLegible)}, name matches ${yn(c.nameMatches)}, face matches ${yn(c.faceMatches)}, affordability ${c.affordability}${it.ratio !== null ? ` (${it.ratio}x)` : ''}, message genuine ${yn(c.messageGenuine)}.${hasDocs ? '' : ' No documents on file: decided from profile only.'}`
      const reason = dcs.reason.slice(0, 1000)
      if (dcs.decision === 'verify') {
        proposals.push({ agentKey: 'verifier', action: 'application.verify', targetId: it.app.id, payload: { checks: c }, rationale: `${reason} ${checks}`, confidence, risk: 'low' })
      } else if (dcs.decision === 'reject') {
        const renterFacingReason = (dcs.renterFacingReason?.trim() || 'We could not verify your identity from the documents provided.').slice(0, 500)
        proposals.push({ agentKey: 'verifier', action: 'application.reject', targetId: it.app.id, payload: { checks: c, renterFacingReason }, rationale: `${reason} ${checks}`, confidence, risk: 'high' })
      } else {
        proposals.push({ ...escalate(it.app, `${reason} ${checks}`), payload: { escalated: true, checks: c } })
      }
    }
    for (const it of items) if (!seen.has(it.app.id)) proposals.push(escalate(it.app, 'no decision was returned for this application.'))
    return proposals
  },
}
