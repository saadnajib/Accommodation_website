import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useShallow } from 'zustand/react/shallow'
import type {
  Application, ApplicationStatus, FeeSettings, Listing, Message, Notification, RenterProfile,
  RenterVerification, Review, Role, User, VerificationStatus,
} from '@/types'
import { SEED_APPLICATIONS, SEED_LISTINGS, SEED_MESSAGES, SEED_NOTIFICATIONS, SEED_REVIEWS, SEED_USERS } from '@/data/seed'
import { DEFAULT_FEES, computeFees } from '@/lib/fees'
import { uid } from '@/lib/utils'

export interface Toast { id: string; title: string; body?: string; tone?: 'success' | 'error' | 'info' }

export interface NewApplicationInput {
  listingId: string
  proposedPrice: number
  moveInDate: string
  stayMonths: number
  message: string
  verification: RenterVerification
  profile: RenterProfile
}

export type NewListingInput = Omit<Listing, 'id' | 'ownerId' | 'views' | 'createdAt' | 'status' | 'featured'> & { status?: Listing['status'] }

interface State {
  users: User[]
  listings: Listing[]
  applications: Application[]
  messages: Message[]
  reviews: Review[]
  notifications: Notification[]
  savedListings: Record<string, string[]>
  fees: FeeSettings
  currentUserId: string | null
  toasts: Toast[]

  // auth
  login: (email: string) => boolean
  signup: (input: { name: string; email: string; role: Role; phone?: string }) => User
  logout: () => void
  updateProfile: (patch: Partial<User>) => void

  // listings
  createListing: (input: NewListingInput) => Listing
  updateListing: (id: string, patch: Partial<Listing>) => void
  setListingStatus: (id: string, status: Listing['status'], reason?: string) => void
  featureListing: (id: string) => void
  incrementViews: (id: string) => void
  toggleSaved: (listingId: string) => void

  // applications
  submitApplication: (input: NewApplicationInput) => Application
  advanceApplication: (id: string, status: ApplicationStatus, by: Role | 'system', note?: string) => void
  setAgreedPrice: (id: string, price: number) => void
  payFee: (id: string, side: 'renter' | 'owner') => void
  setAdminNotes: (id: string, notes: string) => void

  // users
  setUserVerification: (userId: string, status: VerificationStatus) => void
  buyTenantPass: () => void

  // messaging / reviews / notifications
  sendMessage: (applicationId: string, text: string) => void
  addReview: (input: Omit<Review, 'id' | 'at'>) => void
  notify: (userId: string, title: string, body: string, link?: string) => void
  markNotificationRead: (id: string) => void
  markAllNotificationsRead: () => void

  // settings / misc
  updateFees: (patch: Partial<FeeSettings>) => void
  toast: (t: Omit<Toast, 'id'>) => void
  dismissToast: (id: string) => void
  resetDemo: () => void
}

const now = () => new Date().toISOString()

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      users: SEED_USERS,
      listings: SEED_LISTINGS,
      applications: SEED_APPLICATIONS,
      messages: SEED_MESSAGES,
      reviews: SEED_REVIEWS,
      notifications: SEED_NOTIFICATIONS,
      savedListings: { u_renter1: ['l_2', 'l_9'] },
      fees: DEFAULT_FEES,
      currentUserId: null,
      toasts: [],

      login: (email) => {
        const u = get().users.find((x) => x.email.toLowerCase() === email.trim().toLowerCase())
        if (!u) return false
        set({ currentUserId: u.id })
        return true
      },
      signup: (input) => {
        const user: User = {
          id: uid('u'), name: input.name, email: input.email.trim().toLowerCase(), role: input.role, phone: input.phone,
          verification: 'unverified', hasTenantPass: false, createdAt: now(),
        }
        set((s) => ({ users: [...s.users, user], currentUserId: user.id }))
        return user
      },
      logout: () => set({ currentUserId: null }),
      updateProfile: (patch) => set((s) => ({ users: s.users.map((u) => (u.id === s.currentUserId ? { ...u, ...patch } : u)) })),

      createListing: (input) => {
        const ownerId = get().currentUserId
        if (!ownerId) throw new Error('Not signed in')
        const listing: Listing = {
          ...input, id: uid('l'), ownerId, views: 0, createdAt: now(), featured: false,
          status: input.status ?? 'pending_review',
        }
        set((s) => ({ listings: [listing, ...s.listings] }))
        if (listing.status === 'pending_review') {
          get().notify('u_admin', 'Listing pending review', `"${listing.title}" was submitted for review.`, '/admin/listings')
        }
        return listing
      },
      updateListing: (id, patch) => set((s) => ({ listings: s.listings.map((l) => (l.id === id ? { ...l, ...patch } : l)) })),
      setListingStatus: (id, status, reason) => {
        set((s) => ({ listings: s.listings.map((l) => (l.id === id ? { ...l, status, rejectionReason: reason ?? l.rejectionReason } : l)) }))
        const l = get().listings.find((x) => x.id === id)
        if (l && status === 'active') get().notify(l.ownerId, 'Listing approved', `"${l.title}" is now live.`, `/owner/listings/${l.id}/edit`)
        if (l && status === 'rejected') get().notify(l.ownerId, 'Listing needs changes', reason ?? `"${l.title}" was not approved.`, `/owner/listings/${l.id}/edit`)
      },
      featureListing: (id) => {
        set((s) => ({ listings: s.listings.map((l) => (l.id === id ? { ...l, featured: true } : l)) }))
        get().toast({ title: 'Listing featured', body: 'Your listing now appears first in search for 30 days.', tone: 'success' })
      },
      incrementViews: (id) => set((s) => ({ listings: s.listings.map((l) => (l.id === id ? { ...l, views: l.views + 1 } : l)) })),
      toggleSaved: (listingId) => {
        const uidCur = get().currentUserId
        if (!uidCur) return
        set((s) => {
          const cur = s.savedListings[uidCur] ?? []
          const next = cur.includes(listingId) ? cur.filter((x) => x !== listingId) : [...cur, listingId]
          return { savedListings: { ...s.savedListings, [uidCur]: next } }
        })
      },

      submitApplication: (input) => {
        const s = get()
        const renter = s.users.find((u) => u.id === s.currentUserId)
        const listing = s.listings.find((l) => l.id === input.listingId)
        if (!renter || !listing) throw new Error('Invalid application')
        const { renterFee, ownerFee } = computeFees(input.proposedPrice, s.fees, { hasTenantPass: renter.hasTenantPass })
        const app: Application = {
          id: uid('a'), listingId: listing.id, renterId: renter.id, ownerId: listing.ownerId,
          proposedPrice: input.proposedPrice, agreedPrice: input.proposedPrice, moveInDate: input.moveInDate,
          stayMonths: input.stayMonths, message: input.message, agreementAccepted: true, agreementAcceptedAt: now(),
          verification: input.verification, profile: input.profile,
          status: 'submitted', timeline: [{ status: 'submitted', at: now(), by: 'renter' }],
          renterFee, ownerFee, renterFeePaid: false, ownerFeePaid: false, contactUnlocked: false, adminNotes: '', createdAt: now(),
        }
        set((st) => ({
          applications: [app, ...st.applications],
          users: st.users.map((u) => (u.id === renter.id && u.verification === 'unverified' ? { ...u, verification: 'pending' } : u)),
        }))
        get().notify('u_admin', 'New application to verify', `${renter.name} applied for "${listing.title}".`, '/admin/verification')
        return app
      },
      advanceApplication: (id, status, by, note) => {
        set((s) => ({
          applications: s.applications.map((a) =>
            a.id === id ? { ...a, status, timeline: [...a.timeline, { status, at: now(), by, note }] } : a,
          ),
        }))
        const s = get()
        const a = s.applications.find((x) => x.id === id)
        if (!a) return
        const listing = s.listings.find((l) => l.id === a.listingId)
        const title = listing?.title ?? 'your listing'
        const renterLink = `/dashboard/applications/${a.id}`
        const ownerLink = `/owner/applications/${a.id}`
        switch (status) {
          case 'verified':
            s.setUserVerification(a.renterId, 'verified')
            s.notify(a.renterId, 'You are verified', `Your application for "${title}" passed verification.`, renterLink)
            break
          case 'rejected':
            s.notify(a.renterId, 'Application not approved', note ?? `We could not approve your application for "${title}".`, renterLink)
            break
          case 'sent_to_owner':
            s.notify(a.ownerId, 'New verified applicant', `A verified renter is waiting for your decision on "${title}".`, ownerLink)
            s.notify(a.renterId, 'Presented to owner', `We sent your profile to the owner of "${title}".`, renterLink)
            break
          case 'owner_accepted':
            s.advanceApplication(id, 'awaiting_fees', 'system')
            s.notify(a.renterId, 'Owner accepted your application', `Pay the service fee to unlock contact for "${title}".`, renterLink)
            s.notify('u_admin', 'Owner accepted', `Owner accepted ${s.users.find((u) => u.id === a.renterId)?.name ?? 'the renter'} for "${title}". Fees pending.`, `/admin/applications/${a.id}`)
            break
          case 'owner_declined':
            s.notify(a.renterId, 'Owner declined', `The owner of "${title}" chose another tenant this time.`, renterLink)
            break
          case 'contact_unlocked':
            s.notify(a.renterId, 'Contact unlocked', `You can now message the owner of "${title}".`, `/messages/${a.id}`)
            s.notify(a.ownerId, 'Contact unlocked', `You can now message your new tenant for "${title}".`, `/messages/${a.id}`)
            break
          case 'completed':
            s.updateListing(a.listingId, { status: 'rented' })
            s.notify(a.renterId, 'Deal completed', `Congratulations on your new home! Please leave a review.`, renterLink)
            s.notify(a.ownerId, 'Deal completed', `"${title}" is now marked as rented.`, ownerLink)
            break
        }
      },
      setAgreedPrice: (id, price) => {
        set((s) => ({
          applications: s.applications.map((a) => {
            if (a.id !== id) return a
            const renter = s.users.find((u) => u.id === a.renterId)
            const f = computeFees(price, s.fees, { hasTenantPass: renter?.hasTenantPass })
            return { ...a, agreedPrice: price, renterFee: f.renterFee, ownerFee: f.ownerFee }
          }),
        }))
      },
      payFee: (id, side) => {
        set((s) => ({
          applications: s.applications.map((a) =>
            a.id === id ? { ...a, renterFeePaid: side === 'renter' ? true : a.renterFeePaid, ownerFeePaid: side === 'owner' ? true : a.ownerFeePaid } : a,
          ),
        }))
        const a = get().applications.find((x) => x.id === id)
        if (a && a.renterFeePaid && a.ownerFeePaid && !a.contactUnlocked) {
          set((s) => ({ applications: s.applications.map((x) => (x.id === id ? { ...x, contactUnlocked: true } : x)) }))
          get().advanceApplication(id, 'contact_unlocked', 'system', 'Both service fees received.')
        }
      },
      setAdminNotes: (id, notes) => set((s) => ({ applications: s.applications.map((a) => (a.id === id ? { ...a, adminNotes: notes } : a)) })),

      setUserVerification: (userId, status) => set((s) => ({ users: s.users.map((u) => (u.id === userId ? { ...u, verification: status } : u)) })),
      buyTenantPass: () => {
        set((s) => ({ users: s.users.map((u) => (u.id === s.currentUserId ? { ...u, hasTenantPass: true } : u)) }))
        get().toast({ title: 'Tenant Pass activated', body: 'You now get 20% off every service fee and priority review.', tone: 'success' })
      },

      sendMessage: (applicationId, text) => {
        const fromId = get().currentUserId
        if (!fromId || !text.trim()) return
        const msg: Message = { id: uid('m'), applicationId, fromId, text: text.trim(), at: now() }
        set((s) => ({ messages: [...s.messages, msg] }))
        const a = get().applications.find((x) => x.id === applicationId)
        if (a) {
          const to = fromId === a.renterId ? a.ownerId : a.renterId
          get().notify(to, 'New message', text.trim().slice(0, 80), `/messages/${applicationId}`)
        }
      },
      addReview: (input) => set((s) => ({ reviews: [...s.reviews, { ...input, id: uid('r'), at: now() }] })),
      notify: (userId, title, body, link) =>
        set((s) => ({ notifications: [{ id: uid('n'), userId, title, body, link, read: false, at: now() }, ...s.notifications] })),
      markNotificationRead: (id) => set((s) => ({ notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) })),
      markAllNotificationsRead: () =>
        set((s) => ({ notifications: s.notifications.map((n) => (n.userId === s.currentUserId ? { ...n, read: true } : n)) })),

      updateFees: (patch) => set((s) => ({ fees: { ...s.fees, ...patch } })),
      toast: (t) => {
        const id = uid('t')
        set((s) => ({ toasts: [...s.toasts, { ...t, id }] }))
        setTimeout(() => get().dismissToast(id), 4500)
      },
      dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
      resetDemo: () =>
        set({
          users: SEED_USERS, listings: SEED_LISTINGS, applications: SEED_APPLICATIONS, messages: SEED_MESSAGES,
          reviews: SEED_REVIEWS, notifications: SEED_NOTIFICATIONS, savedListings: { u_renter1: ['l_2', 'l_9'] },
          fees: DEFAULT_FEES, currentUserId: null,
        }),
    }),
    {
      name: 'staybridge:v1',
      partialize: (s) => ({
        users: s.users, listings: s.listings, applications: s.applications, messages: s.messages, reviews: s.reviews,
        notifications: s.notifications, savedListings: s.savedListings, fees: s.fees, currentUserId: s.currentUserId,
      }),
    },
  ),
)

/* ---------- Selectors / hooks ---------- */

export const useCurrentUser = () => useStore((s) => s.users.find((u) => u.id === s.currentUserId) ?? null)

export const useUser = (id?: string) => useStore((s) => (id ? s.users.find((u) => u.id === id) ?? null : null))

export const useListing = (id?: string) => useStore((s) => (id ? s.listings.find((l) => l.id === id) ?? null : null))

export const useApplication = (id?: string) => useStore((s) => (id ? s.applications.find((a) => a.id === id) ?? null : null))

export const useIsSaved = (listingId: string) =>
  useStore((s) => (s.currentUserId ? (s.savedListings[s.currentUserId] ?? []).includes(listingId) : false))

export const useUnreadCount = () =>
  useStore((s) => s.notifications.filter((n) => n.userId === s.currentUserId && !n.read).length)

/** Average rating and count for a user (as the recipient of reviews). */
export function useUserRating(userId?: string) {
  return useStore(
    useShallow((s) => {
      const rs = s.reviews.filter((r) => r.toId === userId)
      if (!rs.length) return { avg: 0, count: 0 }
      return { avg: rs.reduce((a, r) => a + r.rating, 0) / rs.length, count: rs.length }
    }),
  )
}
