import type { Listing, PropertyType } from '@/types'
import type { NewListingInput } from '@/store/useStore'

export interface ListingFormState {
  title: string
  type: PropertyType | ''
  description: string
  city: string
  area: string
  address: string
  bedrooms: string
  bathrooms: string
  sizeSqm: string
  furnished: boolean
  amenities: string[]
  houseRules: string[]
  price: string
  deposit: string
  depositTouched: boolean
  billsIncluded: boolean
  availableFrom: string
  minStayMonths: number
  images: string[]
}

export const STEPS = ['Basics', 'Details', 'Pricing', 'Photos', 'Review']
export const MAX_PHOTOS = 8
export const MIN_STAY_OPTIONS = [1, 3, 6, 12, 24]
export const DRAFT_KEY = 'staybridge:owner:new-listing-draft'

const STEP_FIELDS: string[][] = [
  ['title', 'type', 'description', 'city', 'area', 'address'],
  ['bedrooms', 'bathrooms', 'sizeSqm'],
  ['price', 'deposit', 'availableFrom'],
  ['images'],
  [],
]

export function todayInput() {
  return new Date().toISOString().slice(0, 10)
}

export function emptyForm(): ListingFormState {
  return {
    title: '', type: '', description: '', city: '', area: '', address: '',
    bedrooms: '1', bathrooms: '1', sizeSqm: '', furnished: true, amenities: [], houseRules: [],
    price: '', deposit: '', depositTouched: false, billsIncluded: false, availableFrom: todayInput(), minStayMonths: 6,
    images: [],
  }
}

export function formFromListing(l: Listing): ListingFormState {
  return {
    title: l.title, type: l.type, description: l.description, city: l.city, area: l.area, address: l.address ?? '',
    bedrooms: String(l.bedrooms), bathrooms: String(l.bathrooms), sizeSqm: String(l.sizeSqm), furnished: l.furnished,
    amenities: [...l.amenities], houseRules: [...l.houseRules],
    price: String(l.price), deposit: String(l.deposit), depositTouched: true, billsIncluded: l.billsIncluded,
    availableFrom: l.availableFrom.slice(0, 10), minStayMonths: l.minStayMonths,
    images: [...l.images],
  }
}

const isInt = (v: string) => /^\d+$/.test(v.trim())
export const isUrl = (v: string) => /^https:\/\/\S+\.\S+/i.test(v.trim())
/** A photo uploaded to the API (POST /api/files?kind=listing_photo). */
export const isUploadedFile = (v: string) => /^\/api\/files\/[\w-]+$/.test(v.trim())
export const isPhoto = (v: string) => isUrl(v) || isUploadedFile(v)

export function validate(f: ListingFormState): Record<string, string> {
  const e: Record<string, string> = {}
  const title = f.title.trim()
  if (title.length < 10) e.title = `Add at least 10 characters (${title.length}/10).`
  else if (title.length > 90) e.title = 'Keep the title under 90 characters.'
  if (!f.type) e.type = 'Choose a property type.'
  const desc = f.description.trim().length
  if (desc < 80) e.description = `Describe the home in at least 80 characters (${desc}/80).`
  if (f.city.trim().length < 2) e.city = 'Enter the city.'
  if (f.area.trim().length < 2) e.area = 'Enter the area or neighbourhood.'
  if (f.address.trim().length < 5) e.address = 'Enter the full street address.'

  if (!isInt(f.bedrooms) || Number(f.bedrooms) > 20) e.bedrooms = 'Enter 0–20 (0 for a studio).'
  if (!isInt(f.bathrooms) || Number(f.bathrooms) < 1 || Number(f.bathrooms) > 10) e.bathrooms = 'Enter 1–10.'
  if (!isInt(f.sizeSqm) || Number(f.sizeSqm) < 5 || Number(f.sizeSqm) > 2000) e.sizeSqm = 'Enter a size between 5 and 2000 m².'

  const price = Number(f.price)
  if (!isInt(f.price) || price < 50) e.price = 'Enter a monthly rent of at least $50.'
  else if (price > 100000) e.price = 'That looks too high — check the amount.'
  if (!isInt(f.deposit)) e.deposit = 'Enter a deposit amount (0 if none).'
  else if (price && Number(f.deposit) > price * 6) e.deposit = 'Deposits are capped at 6 months of rent.'
  if (!f.availableFrom || Number.isNaN(new Date(f.availableFrom).getTime())) e.availableFrom = 'Pick the date the home is available.'

  const filled = f.images.map((x) => x.trim()).filter(Boolean)
  if (filled.length === 0) e.images = 'Add at least one photo.'
  else if (filled.length > MAX_PHOTOS) e.images = `Use at most ${MAX_PHOTOS} photos.`
  else if (filled.some((x) => !isPhoto(x))) e.images = 'Remove the photos that could not be loaded.'
  return e
}

export function stepValid(step: number, errors: Record<string, string>) {
  return STEP_FIELDS[step].every((k) => !errors[k])
}

export function firstInvalidStep(errors: Record<string, string>) {
  const i = STEP_FIELDS.findIndex((fields) => fields.some((k) => errors[k]))
  return i === -1 ? STEPS.length - 1 : i
}

export function toListingInput(f: ListingFormState): NewListingInput {
  return {
    title: f.title.trim(),
    description: f.description.trim(),
    type: (f.type || 'apartment') as PropertyType,
    city: f.city.trim(),
    area: f.area.trim(),
    address: f.address.trim(),
    price: Number(f.price),
    deposit: Number(f.deposit),
    billsIncluded: f.billsIncluded,
    availableFrom: new Date(`${f.availableFrom}T12:00:00`).toISOString(),
    minStayMonths: f.minStayMonths,
    bedrooms: Number(f.bedrooms),
    bathrooms: Number(f.bathrooms),
    sizeSqm: Number(f.sizeSqm),
    furnished: f.furnished,
    amenities: f.amenities,
    houseRules: f.houseRules,
    images: f.images.map((x) => x.trim()).filter(Boolean),
  }
}

export function loadDraft(): { form: ListingFormState; step: number } | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { form?: Partial<ListingFormState>; step?: number }
    if (!parsed.form) return null
    const form = { ...emptyForm(), ...parsed.form }
    form.images = Array.isArray(form.images) ? form.images.filter((x): x is string => typeof x === 'string' && x.trim() !== '') : []
    return { form, step: Math.min(Math.max(0, parsed.step ?? 0), STEPS.length - 1) }
  } catch {
    return null
  }
}

export function saveDraft(form: ListingFormState, step: number) {
  // Photos are already uploaded; the draft only holds their /api/files/<id> URLs.
  try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ form, step })) } catch { /* storage unavailable */ }
}

export function clearDraft() {
  try { sessionStorage.removeItem(DRAFT_KEY) } catch { /* storage unavailable */ }
}
