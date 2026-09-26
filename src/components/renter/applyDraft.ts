import type { Application, Listing, RenterProfile, RenterVerification } from '@/types'
import { AGREEMENT_CLAUSES } from '@/lib/fees'
import { maskId } from '@/lib/utils'
import type { StoredFile } from './FileField'

export type IdType = RenterVerification['idType']

export interface ApplyDraft {
  step: number
  // a. offer
  proposedPrice: string
  moveInDate: string
  stayMonths: string
  message: string
  // b. agreement
  clauses: boolean[]
  acceptAll: boolean
  // c. verification
  verifyMode: 'reuse' | 'new'
  idType: IdType | ''
  /** Raw ID number is kept in memory only; it is never written to sessionStorage. */
  idNumber: string
  idDocument: StoredFile | null
  selfie: StoredFile | null
  income: StoredFile | null
  // d. about
  occupation: string
  employer: string
  monthlyIncome: string
  occupants: string
  hasPets: boolean
  smoker: boolean
  aboutMe: string
  references: string
}

export type Errors = Partial<Record<keyof ApplyDraft | 'clauses', string>>

export const STEPS = ['Your offer', 'Agreement', 'Verify identity', 'About you', 'Review & submit']

export const MIN_MESSAGE = 40
export const MIN_ABOUT = 60
const MAX_FILE = 10 * 1024 * 1024

export const draftKey = (listingId: string) => `staybridge:apply:${listingId}`

/** yyyy-mm-dd for a date in local time. */
export function toDateInput(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function minMoveIn(listing: Listing) {
  const today = toDateInput(new Date())
  const avail = listing.availableFrom.slice(0, 10)
  return avail > today ? avail : today
}

export function emptyDraft(listing: Listing, canReuse: boolean, prev?: RenterProfile): ApplyDraft {
  return {
    step: 0,
    proposedPrice: String(listing.price),
    moveInDate: minMoveIn(listing),
    stayMonths: String(listing.minStayMonths),
    message: '',
    clauses: AGREEMENT_CLAUSES.map(() => false),
    acceptAll: false,
    verifyMode: canReuse ? 'reuse' : 'new',
    idType: '',
    idNumber: '',
    idDocument: null,
    selfie: null,
    income: null,
    occupation: prev?.occupation ?? '',
    employer: prev?.employer ?? '',
    monthlyIncome: prev?.monthlyIncome ? String(prev.monthlyIncome) : '',
    occupants: String(prev?.occupants ?? 1),
    hasPets: prev?.hasPets ?? false,
    smoker: prev?.smoker ?? false,
    aboutMe: prev?.aboutMe ?? '',
    references: prev?.references ?? '',
  }
}

export function loadDraft(listingId: string, fallback: ApplyDraft): ApplyDraft {
  try {
    const raw = sessionStorage.getItem(draftKey(listingId))
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<ApplyDraft>
    const merged = { ...fallback, ...parsed, idNumber: '' }
    if (!Array.isArray(merged.clauses) || merged.clauses.length !== AGREEMENT_CLAUSES.length) merged.clauses = fallback.clauses
    // Without the raw ID number, a "new upload" draft can't pass step 3 — send the user back there at most.
    if (merged.verifyMode === 'new' && merged.step > 2) merged.step = 2
    if (fallback.verifyMode === 'new') merged.verifyMode = 'new'
    return merged
  } catch {
    return fallback
  }
}

export function saveDraft(listingId: string, d: ApplyDraft) {
  try {
    const { idNumber: _omit, ...rest } = d
    void _omit
    sessionStorage.setItem(draftKey(listingId), JSON.stringify(rest))
  } catch { /* storage unavailable */ }
}

export function clearDraft(listingId: string) {
  try { sessionStorage.removeItem(draftKey(listingId)) } catch { /* ignore */ }
}

const num = (s: string) => (s.trim() === '' ? NaN : Number(s))

export function validateOffer(d: ApplyDraft, listing: Listing): Errors {
  const e: Errors = {}
  const price = num(d.proposedPrice)
  if (!Number.isFinite(price) || price <= 0) e.proposedPrice = 'Enter a monthly price.'
  else if (price > listing.price * 2) e.proposedPrice = `That's more than double the asking price. Maximum ${Math.round(listing.price * 2)}.`
  else if (price < listing.price * 0.4) e.proposedPrice = `Offers below 40% of the asking price aren't accepted. Minimum ${Math.ceil(listing.price * 0.4)}.`
  const min = minMoveIn(listing)
  if (!d.moveInDate) e.moveInDate = 'Choose a move-in date.'
  else if (d.moveInDate < min) e.moveInDate = `Earliest possible move-in is ${new Date(`${min}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}.`
  const months = num(d.stayMonths)
  if (!Number.isInteger(months) || months < 1) e.stayMonths = 'Enter the number of months.'
  else if (months < listing.minStayMonths) e.stayMonths = `This home needs a minimum stay of ${listing.minStayMonths} months.`
  else if (months > 60) e.stayMonths = 'Maximum 60 months.'
  const len = d.message.trim().length
  if (len < MIN_MESSAGE) e.message = `Tell the owner a bit more — at least ${MIN_MESSAGE} characters (${len}/${MIN_MESSAGE}).`
  return e
}

export function validateAgreement(d: ApplyDraft): Errors {
  const e: Errors = {}
  if (!d.clauses.every(Boolean)) e.clauses = 'Please confirm every clause.'
  if (!d.acceptAll) e.acceptAll = 'You need to accept the agreement to continue.'
  return e
}

export function validateVerify(d: ApplyDraft): Errors {
  if (d.verifyMode === 'reuse') return {}
  const e: Errors = {}
  if (!d.idType) e.idType = 'Select a document type.'
  const id = d.idNumber.replace(/\s/g, '')
  if (!id) e.idNumber = 'Enter your document number.'
  else if (!/^[A-Za-z0-9-]{5,20}$/.test(id)) e.idNumber = 'Use 5–20 letters or digits.'
  if (!d.idDocument) e.idDocument = 'Upload a photo or scan of your ID.'
  else if (d.idDocument.size > MAX_FILE) e.idDocument = 'File is larger than 10 MB.'
  if (!d.selfie) e.selfie = 'Upload a selfie so we can match you to your ID.'
  else if (d.selfie.size > MAX_FILE) e.selfie = 'File is larger than 10 MB.'
  if (d.income && d.income.size > MAX_FILE) e.income = 'File is larger than 10 MB.'
  return e
}

export function validateAbout(d: ApplyDraft): Errors {
  const e: Errors = {}
  if (d.occupation.trim().length < 2) e.occupation = 'Tell us what you do.'
  const inc = num(d.monthlyIncome)
  if (!Number.isFinite(inc) || inc <= 0) e.monthlyIncome = 'Enter your monthly net income.'
  const occ = num(d.occupants)
  if (!Number.isInteger(occ) || occ < 1) e.occupants = 'At least 1 occupant.'
  else if (occ > 12) e.occupants = 'Maximum 12 occupants.'
  const len = d.aboutMe.trim().length
  if (len < MIN_ABOUT) e.aboutMe = `Owners love detail — at least ${MIN_ABOUT} characters (${len}/${MIN_ABOUT}).`
  return e
}

export function validateStep(step: number, d: ApplyDraft, listing: Listing): Errors {
  switch (step) {
    case 0: return validateOffer(d, listing)
    case 1: return validateAgreement(d)
    case 2: return validateVerify(d)
    case 3: return validateAbout(d)
    default: return {
      ...validateOffer(d, listing), ...validateAgreement(d), ...validateVerify(d), ...validateAbout(d),
    }
  }
}

export function buildVerification(d: ApplyDraft, previous?: Application): RenterVerification {
  const at = new Date().toISOString()
  if (d.verifyMode === 'reuse' && previous?.verification) return { ...previous.verification, submittedAt: at }
  return {
    idType: (d.idType || 'passport') as IdType,
    idNumberMasked: maskId(d.idNumber.replace(/\s/g, '')),
    idDocumentName: d.idDocument?.name ?? '',
    selfieName: d.selfie?.name ?? '',
    proofOfIncomeName: d.income?.name,
    submittedAt: at,
  }
}

export function buildProfile(d: ApplyDraft): RenterProfile {
  return {
    occupation: d.occupation.trim(),
    employer: d.employer.trim() || undefined,
    monthlyIncome: Number(d.monthlyIncome),
    occupants: Number(d.occupants),
    hasPets: d.hasPets,
    smoker: d.smoker,
    aboutMe: d.aboutMe.trim(),
    references: d.references.trim() || undefined,
  }
}
