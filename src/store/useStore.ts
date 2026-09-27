/**
 * Client cache over the StayBridge HTTP API (server/API.md).
 *
 * - The server is the single source of truth; nothing business-related is persisted in the browser.
 * - Data is fetched per area on demand (fetchX actions) and normalised into *ById maps.
 * - Mutations are async, update the cache from the server response, toast the API's error message on
 *   failure and re-throw (callers only need to catch to skip their success path).
 */
import { useEffect, useLayoutEffect, useRef, useState, type DependencyList } from 'react'
import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import type {
  Application, ApplicationStatus, FeeSettings, Listing, ListingStatus, ListingSummary, Message, Notification, Rating,
  RenterProfile, Review, Role, TimelineEvent, User, VerificationStatus, IdType,
  Agent, AgentPolicyAction, AgentPolicyPatch, AgentRun, AgentsOverview, Proposal,
} from '@/types'
import { DEFAULT_FEES } from '@/lib/fees'
import { ApiError, errorMessage, get as httpGet, isApiError, onUnauthorized, patch, post, put, del, type CardInput } from '@/lib/api'
import { uid } from '@/lib/utils'

/* ---------- API shapes ---------- */

export interface Toast { id: string; title: string; body?: string; tone?: 'success' | 'error' | 'info' }

export interface NewApplicationInput {
  listingId: string
  proposedPrice: number
  moveInDate: string
  stayMonths: number
  message: string
  verification: {
    idType: IdType
    /** Sent once over TLS; the server keeps only the last 4 characters. */
    idNumber: string
    idDocumentFileId: string
    selfieFileId: string
    proofOfIncomeFileId?: string
  }
  profile: RenterProfile
}

/** Body of POST /listings (and, partially, PATCH /listings/:id). */
export interface NewListingInput {
  title: string
  description: string
  type: Listing['type']
  city: string
  area: string
  address: string
  price: number
  deposit: number
  billsIncluded: boolean
  availableFrom: string
  minStayMonths: number
  bedrooms: number
  bathrooms: number
  sizeSqm: number
  furnished: boolean
  amenities: string[]
  houseRules: string[]
  images: string[]
  status?: 'draft' | 'pending_review'
}

export type ListingPatch = Partial<Omit<NewListingInput, 'status'>> & { status?: ListingStatus }

export interface ListingQuery {
  city?: string; type?: string; min?: string | number; max?: string | number; beds?: string | number
  furnished?: boolean; bills?: boolean; stay?: string | number; q?: string
  sort?: 'featured' | 'price_asc' | 'price_desc' | 'newest'; page?: number; limit?: number
}

interface ListingsResponse { items: Listing[]; total: number; page: number; limit: number; cities: string[] }
interface ListingDetailResponse { listing: Listing; owner?: User; ownerRating?: Rating; similar?: Listing[]; saved?: boolean }

/** Application row from GET /me/applications (application + listing summary + the other party). */
type ApplicationRow = Application & { listing?: ListingSummary; counterpart?: User; renter?: User; owner?: User }
interface MyApplicationsResponse { items: ApplicationRow[]; verifyingCounts?: Record<string, number> }

export interface ApplicationDetail {
  application: Application
  listing?: Listing | null
  renter?: User | null
  owner?: User | null
  events: TimelineEvent[]
  messagesCount: number
  myReview?: Review | null
  /** Statuses the caller may move this application to right now (server-side state machine). */
  allowedTransitions?: ApplicationStatus[]
}

export interface ApplicationMeta { messagesCount: number; myReview: Review | null; allowedTransitions: ApplicationStatus[] }

export interface Conversation {
  application: { id: string; status: ApplicationStatus; listing?: { id: string; title: string }; renterId?: string; ownerId?: string }
  counterpart?: User
  /** Optional extras an admin view may include. */
  renter?: User
  owner?: User
  lastMessage?: Message | null
  unread?: number
}

export interface AdminOverview {
  revenueCollected: number
  revenuePending: number
  /** Tenant Pass + featured listing sales. */
  purchasesCollected?: number
  counts: {
    toVerify: number; waitingOnOwner: number; awaitingFees: number; listingsPending: number; listingsLive: number
    readyToSend?: number; completed?: number; listingsFeatured?: number
    usersByRole: Partial<Record<Role, number>>
  }
  pipeline: Partial<Record<ApplicationStatus, number>>
  recentEvents: Array<{ application: { id: string; renterName?: string; listingTitle?: string }; status: ApplicationStatus; by: TimelineEvent['by']; note?: string | null; at: string }>
  /** Proposals from the AI team waiting for a decision. */
  pendingApprovals?: number
}

export interface ProposalQuery { status?: 'pending' | 'all'; agent?: string; limit?: number }
export interface BulkProposalResult { id: string; ok: boolean; proposal?: Proposal; error?: string }

export type AdminUserRow = User & { applicationsCount?: number; listingsCount?: number; rating?: Rating | number | null; failedLogins?: number; lockedUntil?: string | null }
type AdminListingRow = Listing & { owner?: User | { id?: string; name: string; email?: string; phone?: string } }

/* ---------- State ---------- */

interface ListingQueryResult { ids: string[]; total: number; page: number; limit: number; cities: string[] }

interface State {
  /** True once GET /auth/me has answered (or failed): route guards wait for this. */
  authResolved: boolean
  me: User | null
  /** Mirrors me?.id (kept for convenience). */
  currentUserId: string | null
  /** Bumped when a request comes back 401 while signed in; the app redirects to /login. */
  sessionExpiredAt: number
  fees: FeeSettings
  toasts: Toast[]

  usersById: Record<string, User>
  listingsById: Record<string, Listing>
  listingSummaries: Record<string, ListingSummary>
  applicationsById: Record<string, Application>
  eventsByApp: Record<string, TimelineEvent[]>
  appMeta: Record<string, ApplicationMeta>
  ratingsByUser: Record<string, Rating>
  listingQueries: Record<string, ListingQueryResult>
  similarByListing: Record<string, string[]>

  savedIds: string[]
  myListingIds: string[] | null
  myApplicationIds: string[] | null
  verifyingCounts: Record<string, number>
  conversations: Conversation[] | null
  messagesByApp: Record<string, Message[]>
  notifications: Notification[]
  unread: number

  adminOverview: AdminOverview | null
  adminUsers: AdminUserRow[] | null
  adminListingIds: string[] | null
  agentsOverview: AgentsOverview | null
  agentPolicy: AgentPolicyAction[] | null
  agentRuns: AgentRun[] | null
  /** Last GET /admin/proposals result and the query that produced it. */
  proposals: Proposal[] | null
  proposalsQuery: string | null

  // auth
  loadMe: () => Promise<void>
  login: (email: string, password: string) => Promise<User>
  signup: (input: { name: string; email: string; password: string; role: 'renter' | 'owner'; phone?: string }) => Promise<User>
  logout: () => Promise<void>
  updateProfile: (patch: { name?: string; phone?: string | null; bio?: string | null }) => Promise<User>
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>

  // listings
  fetchListings: (q: ListingQuery) => Promise<ListingQueryResult>
  fetchListing: (id: string) => Promise<Listing | null>
  fetchMyListings: () => Promise<void>
  createListing: (input: NewListingInput) => Promise<Listing>
  updateListing: (id: string, patch: ListingPatch) => Promise<Listing>
  setListingStatus: (id: string, status: ListingStatus, reason?: string) => Promise<Listing>
  setListingFeatured: (id: string, featured: boolean) => Promise<Listing>
  featureListing: (id: string, card: CardInput) => Promise<Listing>
  fetchSaved: () => Promise<void>
  toggleSaved: (listingId: string) => Promise<void>

  // applications
  fetchMyApplications: (q?: { status?: string; q?: string }) => Promise<void>
  fetchApplication: (id: string) => Promise<ApplicationDetail | null>
  submitApplication: (input: NewApplicationInput) => Promise<Application>
  advanceApplication: (id: string, status: ApplicationStatus, note?: string) => Promise<Application>
  setAgreedPrice: (id: string, price: number) => Promise<Application>
  payFee: (id: string, card: CardInput) => Promise<Application>
  markFeePaid: (id: string, side: 'renter' | 'owner') => Promise<Application>
  setAdminNotes: (id: string, notes: string) => Promise<Application>

  // users / purchases
  setUserVerification: (userId: string, status: VerificationStatus) => Promise<User>
  buyTenantPass: (card: CardInput) => Promise<User>
  fetchUserReviews: (userId: string) => Promise<void>

  // messaging / reviews / notifications
  fetchConversations: () => Promise<void>
  fetchMessages: (applicationId: string) => Promise<void>
  sendMessage: (applicationId: string, text: string) => Promise<Message>
  addReview: (input: { applicationId: string; rating: number; text: string }) => Promise<Review>
  fetchNotifications: () => Promise<void>
  markNotificationRead: (id: string) => Promise<void>
  markAllNotificationsRead: () => Promise<void>

  // admin
  /** `quiet` skips the error toast (background polls). */
  fetchAdminOverview: (opts?: { quiet?: boolean }) => Promise<void>
  fetchAdminUsers: (q?: { q?: string; role?: string }) => Promise<void>
  fetchAdminListings: (q?: { status?: string; q?: string; owner?: string }) => Promise<void>
  fetchAdminSettings: () => Promise<void>
  updateFees: (fees: FeeSettings) => Promise<FeeSettings>
  resetDemo: () => Promise<void>

  // AI team
  fetchAgents: (opts?: { quiet?: boolean }) => Promise<AgentsOverview | null>
  runAgent: (key: string) => Promise<AgentRun>
  runAllAgents: () => Promise<AgentRun[]>
  setAgentEnabled: (key: string, enabled: boolean) => Promise<Agent>
  fetchAgentPolicy: () => Promise<AgentPolicyAction[]>
  saveAgentPolicy: (patch: AgentPolicyPatch) => Promise<AgentPolicyAction[]>
  fetchAgentRuns: (q?: { agent?: string; limit?: number }) => Promise<AgentRun[]>
  fetchProposals: (q?: ProposalQuery) => Promise<Proposal[]>
  approveProposal: (id: string, note?: string) => Promise<Proposal>
  rejectProposal: (id: string, note?: string) => Promise<Proposal>
  bulkProposals: (ids: string[], decision: 'approve' | 'reject') => Promise<BulkProposalResult[]>

  // ui
  toast: (t: Omit<Toast, 'id'>) => void
  dismissToast: (id: string) => void
}

/** Everything that belongs to a signed-in session; wiped on login/logout/401. */
const sessionData = () => ({
  usersById: {} as Record<string, User>,
  listingsById: {} as Record<string, Listing>,
  listingSummaries: {} as Record<string, ListingSummary>,
  applicationsById: {} as Record<string, Application>,
  eventsByApp: {} as Record<string, TimelineEvent[]>,
  appMeta: {} as Record<string, ApplicationMeta>,
  ratingsByUser: {} as Record<string, Rating>,
  listingQueries: {} as Record<string, ListingQueryResult>,
  similarByListing: {} as Record<string, string[]>,
  savedIds: [] as string[],
  myListingIds: null,
  myApplicationIds: null,
  verifyingCounts: {} as Record<string, number>,
  conversations: null,
  messagesByApp: {} as Record<string, Message[]>,
  notifications: [] as Notification[],
  unread: 0,
  adminOverview: null,
  adminUsers: null,
  adminListingIds: null,
  agentsOverview: null as AgentsOverview | null,
  agentPolicy: null as AgentPolicyAction[] | null,
  agentRuns: null as AgentRun[] | null,
  proposals: null as Proposal[] | null,
  proposalsQuery: null as string | null,
})

/* ---------- helpers ---------- */

const byId = <T extends { id: string }>(map: Record<string, T>, items: Array<T | null | undefined>) => {
  const next = { ...map }
  for (const it of items) if (it?.id) next[it.id] = { ...next[it.id], ...it }
  return next
}

/** Split an application row into the bare application + its embedded relations. */
function splitRow(row: ApplicationRow) {
  const { listing, counterpart, renter, owner, ...app } = row
  return { app: app as Application, listing, users: [counterpart, renter, owner].filter((u): u is User => !!u?.id) }
}

function queryKey(q: ListingQuery) {
  return JSON.stringify(Object.entries(q).filter(([, v]) => v !== undefined && v !== '' && v !== false).sort(([a], [b]) => a.localeCompare(b)))
}

/** Share one in-flight promise per key (dedupes StrictMode double effects and parallel mounts). */
const inflight = new Map<string, Promise<unknown>>()
function once<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const cur = inflight.get(key)
  if (cur) return cur as Promise<T>
  const p = fn().finally(() => inflight.delete(key))
  inflight.set(key, p)
  return p
}

/** Recently shown error toasts, to avoid repeating the same failure from several parallel loads. */
const recentErrors = new Map<string, number>()

const ratingOf = (r: AdminUserRow['rating']): Rating | undefined =>
  r == null ? undefined : typeof r === 'number' ? { avg: r, count: r ? 1 : 0 } : r

export const useStore = create<State>()((set, get) => {
  /** Toast an API failure (deduped for 4s) and re-throw it. */
  const fail = (e: unknown, title = 'Something went wrong'): never => {
    if (!(e instanceof DOMException && e.name === 'AbortError') && !isApiError(e, 401)) {
      const body = errorMessage(e)
      const key = `${title}|${body}`
      const last = recentErrors.get(key) ?? 0
      if (Date.now() - last > 4000) {
        recentErrors.set(key, Date.now())
        get().toast({ title, body, tone: 'error' })
      }
    }
    throw e
  }

  /** Run a mutation; on failure toast + rethrow. */
  const mutate = async <T>(title: string, fn: () => Promise<T>): Promise<T> => {
    try { return await fn() } catch (e) { return fail(e, title) }
  }

  const putApplication = (app: Application) => set((s) => ({ applicationsById: { ...s.applicationsById, [app.id]: { ...s.applicationsById[app.id], ...app } } }))
  const putListing = (l: Listing) => set((s) => ({ listingsById: { ...s.listingsById, [l.id]: { ...s.listingsById[l.id], ...l } } }))

  const setPendingApprovals = (n: number) => set((s) => (s.adminOverview ? { adminOverview: { ...s.adminOverview, pendingApprovals: n } } : {}))

  /** Merge decided/updated proposals into the cached list and keep the pending badge in step. */
  const putProposals = (updated: Proposal[]) => {
    if (!updated.length) return
    const byKey = new Map(updated.map((p) => [p.id, p]))
    set((s) => {
      const before = s.proposals ?? []
      const wasPending = before.filter((p) => byKey.has(p.id) && p.status === 'pending').length
      const nowPending = updated.filter((p) => p.status === 'pending').length
      const delta = nowPending - wasPending
      return {
        proposals: s.proposals?.map((p) => byKey.get(p.id) ?? p) ?? null,
        ...(s.adminOverview && delta ? { adminOverview: { ...s.adminOverview, pendingApprovals: Math.max(0, (s.adminOverview.pendingApprovals ?? 0) + delta) } } : {}),
      }
    })
  }

  const putAgentRun = (key: string, run: AgentRun) => set((s) => (s.agentsOverview ? {
    agentsOverview: { ...s.agentsOverview, agents: s.agentsOverview.agents.map((a) => (a.key === key ? { ...a, lastRun: run } : a)) },
  } : {}))

  /** Refresh the counters a decision or run can change. */
  const afterDecision = () => {
    void get().fetchAdminOverview({ quiet: true }).catch(() => {})
    if (get().agentsOverview) void get().fetchAgents({ quiet: true }).catch(() => {})
  }
  const afterAgentActivity = () => {
    void get().fetchAgents({ quiet: true }).catch(() => {})
    void get().fetchAdminOverview({ quiet: true }).catch(() => {})
  }

  const setMe = (user: User | null) => set((s) => ({
    me: user, currentUserId: user?.id ?? null,
    usersById: user ? { ...s.usersById, [user.id]: { ...s.usersById[user.id], ...user } } : s.usersById,
  }))

  /** After sign-in: load the small per-user datasets every page relies on. */
  const afterSignIn = (user: User) => {
    void get().fetchNotifications().catch(() => {})
    if (user.role === 'renter') void get().fetchSaved().catch(() => {})
  }

  return {
    authResolved: false,
    me: null,
    currentUserId: null,
    sessionExpiredAt: 0,
    fees: DEFAULT_FEES,
    toasts: [],
    ...sessionData(),

    /* ---------- auth ---------- */

    loadMe: () => once('me', async () => {
      // (Also used after reset-demo to pick up the reseeded fee settings.)
      try {
        const r = await httpGet<{ user: User | null; fees?: FeeSettings }>('/auth/me')
        set({ ...(r.fees ? { fees: { ...DEFAULT_FEES, ...r.fees } } : {}) })
        setMe(r.user)
        if (r.user) afterSignIn(r.user)
      } catch (e) {
        // Server unreachable: continue as a guest so public pages still render.
        get().toast({ title: 'Can’t reach StayBridge', body: errorMessage(e), tone: 'error' })
      } finally {
        set({ authResolved: true })
      }
    }),

    login: (email, password) => mutate('Sign-in failed', async () => {
      const { user } = await post<{ user: User }>('/auth/login', { email: email.trim(), password })
      set(sessionData())
      setMe(user)
      afterSignIn(user)
      return user
    }),

    signup: (input) => mutate('Could not create your account', async () => {
      const { user } = await post<{ user: User }>('/auth/signup', { ...input, email: input.email.trim(), name: input.name.trim() })
      set(sessionData())
      setMe(user)
      afterSignIn(user)
      return user
    }),

    logout: async () => {
      try { await post('/auth/logout') } catch { /* clear locally regardless */ }
      set({ ...sessionData(), me: null, currentUserId: null })
    },

    updateProfile: (p) => mutate('Could not save your profile', async () => {
      const { user } = await patch<{ user: User }>('/auth/me', p)
      setMe(user)
      return user
    }),

    changePassword: (currentPassword, newPassword) => mutate('Could not change your password', async () => {
      await post('/auth/change-password', { currentPassword, newPassword })
    }),

    /* ---------- listings ---------- */

    fetchListings: (q) => {
      const key = queryKey(q)
      return once(`listings:${key}`, async () => {
        try {
          const r = await httpGet<ListingsResponse>('/listings', {
            ...q, furnished: q.furnished || undefined, bills: q.bills || undefined,
          } as Record<string, string | number | boolean | undefined>)
          const result: ListingQueryResult = { ids: r.items.map((l) => l.id), total: r.total, page: r.page, limit: r.limit, cities: r.cities ?? [] }
          set((s) => ({ listingsById: byId(s.listingsById, r.items), listingQueries: { ...s.listingQueries, [key]: result } }))
          return result
        } catch (e) { return fail(e, 'Could not load homes') }
      })
    },

    fetchListing: (id) => once(`listing:${id}`, async () => {
      try {
        const r = await httpGet<ListingDetailResponse>(`/listings/${encodeURIComponent(id)}`)
        set((s) => ({
          listingsById: byId(s.listingsById, [r.listing, ...(r.similar ?? [])]),
          usersById: r.owner ? byId(s.usersById, [r.owner]) : s.usersById,
          ratingsByUser: r.owner && r.ownerRating ? { ...s.ratingsByUser, [r.owner.id]: r.ownerRating } : s.ratingsByUser,
          similarByListing: { ...s.similarByListing, [id]: (r.similar ?? []).map((l) => l.id) },
          savedIds: r.saved === undefined ? s.savedIds
            : r.saved ? (s.savedIds.includes(id) ? s.savedIds : [...s.savedIds, id]) : s.savedIds.filter((x) => x !== id),
        }))
        return r.listing
      } catch (e) {
        if (isApiError(e, 404) || isApiError(e, 403)) {
          set((s) => { const next = { ...s.listingsById }; delete next[id]; return { listingsById: next } })
          return null
        }
        return fail(e, 'Could not load this home')
      }
    }),

    fetchMyListings: () => once('myListings', async () => {
      try {
        const r = await httpGet<{ items: Listing[] }>('/me/listings')
        set((s) => ({ listingsById: byId(s.listingsById, r.items), myListingIds: r.items.map((l) => l.id) }))
      } catch (e) { fail(e, 'Could not load your listings') }
    }),

    createListing: (input) => mutate('Could not save the listing', async () => {
      const { listing } = await post<{ listing: Listing }>('/listings', input)
      putListing(listing)
      set((s) => ({ myListingIds: s.myListingIds ? [listing.id, ...s.myListingIds] : s.myListingIds }))
      return listing
    }),

    updateListing: (id, p) => mutate('Could not update the listing', async () => {
      const { listing } = await patch<{ listing: Listing }>(`/listings/${encodeURIComponent(id)}`, p)
      putListing(listing)
      return listing
    }),

    setListingStatus: (id, status, reason) => mutate('Could not change the listing status', async () => {
      const isAdmin = get().me?.role === 'admin'
      const { listing } = isAdmin
        ? await patch<{ listing: Listing }>(`/admin/listings/${encodeURIComponent(id)}`, { status, ...(reason ? { rejectionReason: reason } : {}) })
        : await patch<{ listing: Listing }>(`/listings/${encodeURIComponent(id)}`, { status })
      putListing(listing)
      if (isAdmin) void get().fetchAdminOverview().catch(() => {})
      return listing
    }),

    setListingFeatured: (id, featured) => mutate('Could not update the listing', async () => {
      const { listing } = await patch<{ listing: Listing }>(`/admin/listings/${encodeURIComponent(id)}`, { featured })
      putListing(listing)
      return listing
    }),

    featureListing: (id, card) => mutate('Payment failed', async () => {
      const { listing } = await post<{ listing: Listing }>(`/listings/${encodeURIComponent(id)}/feature`, { card })
      putListing(listing)
      get().toast({ title: 'Listing featured', body: 'Your listing now appears first in search for 30 days.', tone: 'success' })
      return listing
    }),

    fetchSaved: () => once('saved', async () => {
      try {
        const r = await httpGet<{ items: Listing[] }>('/me/saved')
        set((s) => ({ listingsById: byId(s.listingsById, r.items), savedIds: r.items.map((l) => l.id) }))
      } catch (e) { fail(e, 'Could not load saved homes') }
    }),

    toggleSaved: async (listingId) => {
      if (!get().me) return
      const was = get().savedIds.includes(listingId)
      // Optimistic
      set((s) => ({ savedIds: was ? s.savedIds.filter((x) => x !== listingId) : [...s.savedIds, listingId] }))
      try {
        const r = await (was ? del<{ saved: boolean }>(`/listings/${encodeURIComponent(listingId)}/save`) : post<{ saved: boolean }>(`/listings/${encodeURIComponent(listingId)}/save`))
        const saved = r?.saved ?? !was
        set((s) => ({ savedIds: saved ? (s.savedIds.includes(listingId) ? s.savedIds : [...s.savedIds, listingId]) : s.savedIds.filter((x) => x !== listingId) }))
      } catch (e) {
        set((s) => ({ savedIds: was ? [...s.savedIds.filter((x) => x !== listingId), listingId] : s.savedIds.filter((x) => x !== listingId) }))
        fail(e, 'Could not update saved homes')
      }
    },

    /* ---------- applications ---------- */

    fetchMyApplications: (q) => once(`myApps:${JSON.stringify(q ?? {})}`, async () => {
      try {
        const r = await httpGet<MyApplicationsResponse>('/me/applications', q)
        const apps: Application[] = []
        const summaries: ListingSummary[] = []
        const users: User[] = []
        for (const row of r.items) {
          const x = splitRow(row)
          apps.push(x.app)
          if (x.listing) summaries.push(x.listing)
          users.push(...x.users)
        }
        set((s) => ({
          applicationsById: byId(s.applicationsById, apps),
          listingSummaries: byId(s.listingSummaries, summaries),
          usersById: byId(s.usersById, users),
          myApplicationIds: apps.map((a) => a.id),
          verifyingCounts: r.verifyingCounts ?? s.verifyingCounts,
        }))
      } catch (e) { fail(e, 'Could not load applications') }
    }),

    fetchApplication: (id) => once(`app:${id}`, async () => {
      try {
        const r = await httpGet<ApplicationDetail>(`/applications/${encodeURIComponent(id)}`)
        set((s) => ({
          applicationsById: { ...s.applicationsById, [id]: { ...s.applicationsById[id], ...r.application } },
          listingsById: r.listing ? byId(s.listingsById, [r.listing]) : s.listingsById,
          usersById: byId(s.usersById, [r.renter, r.owner]),
          eventsByApp: { ...s.eventsByApp, [id]: r.events ?? [] },
          appMeta: { ...s.appMeta, [id]: { messagesCount: r.messagesCount ?? 0, myReview: r.myReview ?? null, allowedTransitions: r.allowedTransitions ?? [] } },
        }))
        return r
      } catch (e) {
        if (isApiError(e, 404) || isApiError(e, 403)) return null
        return fail(e, 'Could not load the application')
      }
    }),

    submitApplication: (input) => mutate('Could not submit your application', async () => {
      const { application } = await post<{ application: Application }>('/applications', { ...input, agreementAccepted: true })
      putApplication(application)
      set((s) => ({
        myApplicationIds: s.myApplicationIds ? [application.id, ...s.myApplicationIds] : s.myApplicationIds,
        me: s.me && s.me.verification === 'unverified' ? { ...s.me, verification: 'pending' } : s.me,
      }))
      return application
    }),

    advanceApplication: (id, status, note) => mutate('Could not update the application', async () => {
      const r = await post<{ application: Application; events?: TimelineEvent[] }>(`/applications/${encodeURIComponent(id)}/transition`, { status, ...(note ? { note } : {}) })
      putApplication(r.application)
      if (r.events) set((s) => ({ eventsByApp: { ...s.eventsByApp, [id]: r.events! } }))
      // Side effects (renter verification, listing rented, notifications) happen server-side: refresh what may have changed.
      void get().fetchApplication(id).catch(() => {})
      if (get().me?.role === 'admin') void get().fetchAdminOverview().catch(() => {})
      return r.application
    }),

    setAgreedPrice: (id, price) => mutate('Could not update the price', async () => {
      const { application } = await patch<{ application: Application }>(`/applications/${encodeURIComponent(id)}/price`, { agreedPrice: price })
      putApplication(application)
      return application
    }),

    payFee: (id, card) => mutate('Payment failed', async () => {
      const { application } = await post<{ application: Application }>(`/applications/${encodeURIComponent(id)}/pay`, { card })
      putApplication(application)
      void get().fetchApplication(id).catch(() => {})
      return application
    }),

    markFeePaid: (id, side) => mutate('Could not record the payment', async () => {
      const { application } = await post<{ application: Application }>(`/applications/${encodeURIComponent(id)}/mark-paid`, { side })
      putApplication(application)
      void get().fetchApplication(id).catch(() => {})
      return application
    }),

    setAdminNotes: (id, notes) => mutate('Could not save notes', async () => {
      const { application } = await patch<{ application: Application }>(`/applications/${encodeURIComponent(id)}/notes`, { adminNotes: notes })
      putApplication(application)
      return application
    }),

    /* ---------- users / purchases ---------- */

    setUserVerification: (userId, status) => mutate('Could not update verification', async () => {
      const { user } = await patch<{ user: User }>(`/admin/users/${encodeURIComponent(userId)}/verification`, { verification: status })
      set((s) => ({
        usersById: byId(s.usersById, [user]),
        adminUsers: s.adminUsers?.map((u) => (u.id === user.id ? { ...u, ...user } : u)) ?? null,
      }))
      return user
    }),

    buyTenantPass: (card) => mutate('Payment failed', async () => {
      const { user } = await post<{ user: User }>('/me/tenant-pass', { card })
      setMe(user)
      get().toast({ title: 'Tenant Pass activated', body: 'You now get 20% off every service fee and priority review.', tone: 'success' })
      return user
    }),

    fetchUserReviews: (userId) => once(`reviews:${userId}`, async () => {
      try {
        const r = await httpGet<{ items: Review[]; avg: number; count: number }>(`/users/${encodeURIComponent(userId)}/reviews`)
        set((s) => ({ ratingsByUser: { ...s.ratingsByUser, [userId]: { avg: r.avg ?? 0, count: r.count ?? 0 } } }))
      } catch {
        // Ratings are decorative; record "no rating" so we don't retry in a loop.
        set((s) => ({ ratingsByUser: { ...s.ratingsByUser, [userId]: s.ratingsByUser[userId] ?? { avg: 0, count: 0 } } }))
      }
    }),

    /* ---------- messaging / reviews / notifications ---------- */

    fetchConversations: () => once('conversations', async () => {
      try {
        const r = await httpGet<{ items: Conversation[] }>('/me/conversations')
        const users = r.items.flatMap((c) => [c.counterpart, c.renter, c.owner]).filter((u): u is User => !!u?.id)
        set((s) => ({ conversations: r.items, usersById: byId(s.usersById, users) }))
      } catch (e) { fail(e, 'Could not load conversations') }
    }),

    fetchMessages: (applicationId) => once(`messages:${applicationId}`, async () => {
      try {
        const r = await httpGet<{ items: Message[] }>(`/applications/${encodeURIComponent(applicationId)}/messages`)
        set((s) => ({ messagesByApp: { ...s.messagesByApp, [applicationId]: r.items } }))
      } catch (e) { fail(e, 'Could not load messages') }
    }),

    sendMessage: (applicationId, text) => mutate('Message not sent', async () => {
      const { message } = await post<{ message: Message }>(`/applications/${encodeURIComponent(applicationId)}/messages`, { text: text.trim() })
      set((s) => ({
        messagesByApp: { ...s.messagesByApp, [applicationId]: [...(s.messagesByApp[applicationId] ?? []), message] },
        conversations: s.conversations?.map((c) => (c.application.id === applicationId ? { ...c, lastMessage: message } : c)) ?? null,
      }))
      return message
    }),

    addReview: ({ applicationId, rating, text }) => mutate('Could not post your review', async () => {
      const { review } = await post<{ review: Review }>(`/applications/${encodeURIComponent(applicationId)}/reviews`, { rating, text })
      set((s) => ({
        appMeta: { ...s.appMeta, [applicationId]: { ...(s.appMeta[applicationId] ?? { messagesCount: 0, allowedTransitions: [] }), myReview: review } },
        ratingsByUser: (() => { const next = { ...s.ratingsByUser }; delete next[review.toId]; return next })(),
      }))
      return review
    }),

    fetchNotifications: () => once('notifications', async () => {
      try {
        const r = await httpGet<{ items: Notification[]; unread: number }>('/me/notifications', { limit: 20 })
        set({ notifications: r.items, unread: r.unread ?? r.items.filter((n) => !n.read).length })
      } catch (e) { fail(e, 'Could not load notifications') }
    }),

    markNotificationRead: async (id) => {
      const n = get().notifications.find((x) => x.id === id)
      if (!n || n.read) return
      set((s) => ({ notifications: s.notifications.map((x) => (x.id === id ? { ...x, read: true } : x)), unread: Math.max(0, s.unread - 1) }))
      try { await post('/me/notifications/read', { id }) } catch { /* harmless: re-synced on next load */ }
    },

    markAllNotificationsRead: async () => {
      set((s) => ({ notifications: s.notifications.map((x) => ({ ...x, read: true })), unread: 0 }))
      try { await post('/me/notifications/read', {}) } catch (e) {
        void get().fetchNotifications().catch(() => {})
        fail(e, 'Could not update notifications')
      }
    },

    /* ---------- admin ---------- */

    fetchAdminOverview: (opts) => once('adminOverview', async () => {
      try {
        const r = await httpGet<AdminOverview>('/admin/overview')
        set({ adminOverview: r })
      } catch (e) {
        if (opts?.quiet) return
        fail(e, 'Could not load the overview')
      }
    }),

    fetchAdminUsers: (q) => once(`adminUsers:${JSON.stringify(q ?? {})}`, async () => {
      try {
        const r = await httpGet<{ items: AdminUserRow[] }>('/admin/users', q)
        set((s) => ({
          adminUsers: r.items,
          usersById: byId(s.usersById, r.items),
          ratingsByUser: {
            ...s.ratingsByUser,
            ...Object.fromEntries(r.items.flatMap((u) => { const rt = ratingOf(u.rating); return rt ? [[u.id, rt]] : [] })),
          },
        }))
      } catch (e) { fail(e, 'Could not load users') }
    }),

    fetchAdminListings: (q) => once(`adminListings:${JSON.stringify(q ?? {})}`, async () => {
      try {
        const r = await httpGet<{ items: AdminListingRow[] }>('/admin/listings', q)
        const owners: User[] = []
        const listings = r.items.map(({ owner, ...l }) => {
          if (owner && 'id' in owner && owner.id) owners.push(owner as User)
          return { ...l, ownerName: l.ownerName ?? owner?.name } as Listing
        })
        set((s) => ({ listingsById: byId(s.listingsById, listings), usersById: byId(s.usersById, owners), adminListingIds: listings.map((l) => l.id) }))
      } catch (e) { fail(e, 'Could not load listings') }
    }),

    fetchAdminSettings: () => once('adminSettings', async () => {
      try {
        const r = await httpGet<{ fees: FeeSettings }>('/admin/settings')
        set({ fees: { ...DEFAULT_FEES, ...r.fees } })
      } catch (e) { fail(e, 'Could not load settings') }
    }),

    updateFees: (fees) => mutate('Could not save fee settings', async () => {
      const r = await put<{ fees: FeeSettings }>('/admin/settings', { fees })
      const next = { ...DEFAULT_FEES, ...r.fees }
      set({ fees: next })
      return next
    }),

    resetDemo: () => mutate('Could not reset demo data', async () => {
      // The server wipes every session and clears the cookie; just forget the user locally.
      await post('/admin/reset-demo')
      set({ ...sessionData(), me: null, currentUserId: null })
      void get().loadMe()
    }),

    /* ---------- AI team ---------- */

    fetchAgents: (opts) => once('agents', async () => {
      try {
        const r = await httpGet<AgentsOverview>('/admin/agents')
        set({ agentsOverview: r })
        return r
      } catch (e) {
        if (opts?.quiet) return null
        return fail(e, 'Could not load the AI team')
      }
    }),

    runAgent: async (key) => {
      try {
        const { run } = await post<{ run: AgentRun }>(`/admin/agents/${encodeURIComponent(key)}/run`)
        putAgentRun(key, run)
        afterAgentActivity()
        return run
      } catch (e) {
        // 409 = a run is already in progress; the caller shows its own message.
        if (isApiError(e, 409)) throw e
        return fail(e, 'Could not run this employee')
      }
    },

    runAllAgents: () => mutate('Could not run the AI team', async () => {
      const { runs } = await post<{ runs: AgentRun[] }>('/admin/agents/run-all')
      for (const run of runs ?? []) if (run.agentKey) putAgentRun(run.agentKey, run)
      afterAgentActivity()
      return runs ?? []
    }),

    setAgentEnabled: (key, enabled) => {
      const prev = get().agentsOverview
      // Optimistic: flip the toggle immediately, roll back on failure.
      set((s) => (s.agentsOverview ? { agentsOverview: { ...s.agentsOverview, agents: s.agentsOverview.agents.map((a) => (a.key === key ? { ...a, enabled } : a)) } } : {}))
      return mutate('Could not update this employee', async () => {
        try {
          const { agent } = await patch<{ agent: Agent }>(`/admin/agents/${encodeURIComponent(key)}`, { enabled })
          set((s) => (s.agentsOverview ? { agentsOverview: { ...s.agentsOverview, agents: s.agentsOverview.agents.map((a) => (a.key === key ? { ...a, ...agent } : a)) } } : {}))
          return agent
        } catch (e) {
          set({ agentsOverview: prev })
          throw e
        }
      })
    },

    fetchAgentPolicy: () => once('agentPolicy', async () => {
      try {
        const r = await httpGet<{ actions: AgentPolicyAction[] }>('/admin/agents/policy')
        set({ agentPolicy: r.actions })
        return r.actions
      } catch (e) { return fail(e, 'Could not load the autonomy policy') }
    }),

    saveAgentPolicy: (policy) => mutate('Could not save the policy', async () => {
      const r = await put<{ actions: AgentPolicyAction[] }>('/admin/agents/policy', policy)
      set({ agentPolicy: r.actions })
      return r.actions
    }),

    fetchAgentRuns: (q) => once(`agentRuns:${JSON.stringify(q ?? {})}`, async () => {
      try {
        const r = await httpGet<{ items: AgentRun[] }>('/admin/agents/runs', q)
        set({ agentRuns: r.items })
        return r.items
      } catch (e) { return fail(e, 'Could not load recent runs') }
    }),

    fetchProposals: (q) => {
      const key = JSON.stringify(q ?? {})
      return once(`proposals:${key}`, async () => {
        try {
          const r = await httpGet<{ items: Proposal[] }>('/admin/proposals', q ? { ...q } : undefined)
          set({ proposals: r.items, proposalsQuery: key })
          if (q?.status === 'pending' && !q.agent) setPendingApprovals(r.items.length)
          return r.items
        } catch (e) { return fail(e, 'Could not load approvals') }
      })
    },

    approveProposal: (id, note) => mutate('Could not approve', async () => {
      const { proposal } = await post<{ proposal: Proposal }>(`/admin/proposals/${encodeURIComponent(id)}/approve`, note ? { note } : {})
      putProposals([proposal])
      afterDecision()
      return proposal
    }),

    rejectProposal: (id, note) => mutate('Could not reject', async () => {
      const { proposal } = await post<{ proposal: Proposal }>(`/admin/proposals/${encodeURIComponent(id)}/reject`, note ? { note } : {})
      putProposals([proposal])
      afterDecision()
      return proposal
    }),

    bulkProposals: (ids, decision) => mutate(decision === 'approve' ? 'Could not approve the selection' : 'Could not reject the selection', async () => {
      const { results } = await post<{ results: BulkProposalResult[] }>('/admin/proposals/bulk', { ids, decision })
      putProposals((results ?? []).map((r) => r.proposal).filter((p): p is Proposal => !!p))
      afterDecision()
      return results ?? []
    }),

    /* ---------- ui ---------- */

    toast: (t) => {
      const id = uid('t')
      set((s) => ({ toasts: [...s.toasts, { ...t, id }] }))
      setTimeout(() => get().dismissToast(id), t.tone === 'error' ? 6500 : 4500)
    },
    dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  }
})

// Session expired or revoked elsewhere: drop the user and let the app send them to /login.
onUnauthorized(() => {
  const s = useStore.getState()
  if (!s.me) return
  useStore.setState({ ...sessionData(), me: null, currentUserId: null, sessionExpiredAt: Date.now() })
  s.toast({ title: 'Your session has ended', body: 'Please sign in again.', tone: 'info' })
})

/* ---------- Selectors / hooks ---------- */

const EMPTY_EVENTS: TimelineEvent[] = []
const EMPTY_MESSAGES: Message[] = []
const NO_RATING: Rating = { avg: 0, count: 0 }

/** True once GET /auth/me has resolved — guards must not redirect before this. */
export const useAuthResolved = () => useStore((s) => s.authResolved)

export const useCurrentUser = () => useStore((s) => s.me)

export const useUser = (id?: string | null) => useStore((s) => (id ? s.usersById[id] ?? (s.me?.id === id ? s.me : null) : null))

export const useListing = (id?: string | null) => useStore((s) => (id ? s.listingsById[id] ?? null : null))

/** Full listing if cached, otherwise the compact summary embedded in application rows. */
export const useListingSummary = (id?: string | null): ListingSummary | Listing | null =>
  useStore((s) => (id ? s.listingsById[id] ?? s.listingSummaries[id] ?? null : null))

export const coverImage = (l?: Pick<ListingSummary, 'images' | 'image'> | null) => l?.images?.[0] ?? l?.image

export const useApplication = (id?: string | null) => useStore((s) => (id ? s.applicationsById[id] ?? null : null))

export const useApplicationEvents = (id?: string | null) => useStore((s) => (id ? s.eventsByApp[id] ?? EMPTY_EVENTS : EMPTY_EVENTS))

export const useApplicationMeta = (id?: string | null) => useStore((s) => (id ? s.appMeta[id] ?? null : null))

export const useMessages = (applicationId?: string | null) => useStore((s) => (applicationId ? s.messagesByApp[applicationId] ?? EMPTY_MESSAGES : EMPTY_MESSAGES))

export const useIsSaved = (listingId: string) => useStore((s) => s.savedIds.includes(listingId))

export const useUnreadCount = () => useStore((s) => s.unread)

/** Applications from the last GET /me/applications, newest first. */
export const useMyApplications = () => useStore(useShallow((s) =>
  (s.myApplicationIds ?? []).map((id) => s.applicationsById[id]).filter((a): a is Application => !!a)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))))

/** The owner's listings from the last GET /me/listings, newest first. */
export const useMyListings = () => useStore(useShallow((s) =>
  (s.myListingIds ?? []).map((id) => s.listingsById[id]).filter((l): l is Listing => !!l)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))))

export const useSavedListings = () => useStore(useShallow((s) => s.savedIds.map((id) => s.listingsById[id]).filter((l): l is Listing => !!l)))

export const useAdminListings = () => useStore(useShallow((s) =>
  (s.adminListingIds ?? []).map((id) => s.listingsById[id]).filter((l): l is Listing => !!l)))

/** Average rating and count for a user (as the recipient of reviews); fetched lazily. */
export function useUserRating(userId?: string | null) {
  const rating = useStore((s) => (userId ? s.ratingsByUser[userId] : undefined))
  const fetchUserReviews = useStore((s) => s.fetchUserReviews)
  useEffect(() => {
    if (userId && !rating) void fetchUserReviews(userId).catch(() => {})
  }, [userId, rating, fetchUserReviews])
  return rating ?? NO_RATING
}

/** Cached result of GET /listings for these params (fetched on change). Keeps the previous result while loading. */
export function useListingQuery(q: ListingQuery | null) {
  const key = q ? queryKey(q) : null
  const fetchListings = useStore((s) => s.fetchListings)
  const qRef = useRef(q)
  useLayoutEffect(() => { qRef.current = q })
  const [done, setDone] = useState<{ key: string; error: string | null } | null>(null)
  const [lastOk, setLastOk] = useState<string | null>(null)
  useEffect(() => {
    if (!key || !qRef.current) return
    let alive = true
    fetchListings(qRef.current).then(
      () => { if (alive) { setDone({ key, error: null }); setLastOk(key) } },
      (e) => { if (alive) setDone({ key, error: errorMessage(e) }) },
    )
    return () => { alive = false }
  }, [key, fetchListings])
  const result = useStore((s) => (key ? s.listingQueries[key] : undefined) ?? (lastOk ? s.listingQueries[lastOk] : undefined))
  const items = useStore(useShallow((s) => (result?.ids ?? []).map((id) => s.listingsById[id]).filter((l): l is Listing => !!l)))
  const settled = !!key && done?.key === key
  return {
    items, total: result?.total ?? 0, cities: result?.cities ?? [], limit: result?.limit ?? 0,
    loading: !!key && !settled, error: settled ? done.error : null, loaded: !!result,
  }
}

/**
 * Run a loader on mount and whenever `deps` change (compared by value). Errors are already toasted by
 * the store; this just exposes `loading`, `error`, `notFound` (loader resolved null / 404) and `reload`.
 */
export function useLoad(fn: () => Promise<unknown>, deps: DependencyList) {
  const key = JSON.stringify(deps)
  const fnRef = useRef(fn)
  useLayoutEffect(() => { fnRef.current = fn })
  const [tick, setTick] = useState(0)
  const [done, setDone] = useState<{ id: string; error: string | null; notFound: boolean } | null>(null)
  const id = `${key}#${tick}`
  useEffect(() => {
    let alive = true
    fnRef.current().then(
      (v) => { if (alive) setDone({ id, error: null, notFound: v === null }) },
      (e) => { if (alive) setDone({ id, error: errorMessage(e), notFound: isApiError(e, 404) }) },
    )
    return () => { alive = false }
  }, [id])
  const current = done?.id === id ? done : null
  return { loading: !current, error: current?.error ?? null, notFound: current?.notFound ?? false, reload: () => setTick((t) => t + 1) }
}

export { ApiError }
