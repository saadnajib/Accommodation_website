import { Suspense, lazy, useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { LayoutDashboard, FileText, Heart, UserCircle, Building2, Users, ShieldCheck, ListChecks, Settings, Inbox, MessageSquare } from 'lucide-react'
import { DashboardLayout, PublicLayout, RequireRole } from '@/components/layout/Layouts'
import { Toaster } from '@/components/ui'
import { useStore } from '@/store/useStore'

// Public
const HomePage = lazy(() => import('@/pages/public/HomePage'))
const ListingsPage = lazy(() => import('@/pages/public/ListingsPage'))
const ListingDetailPage = lazy(() => import('@/pages/public/ListingDetailPage'))
const HowItWorksPage = lazy(() => import('@/pages/public/HowItWorksPage'))
const PricingPage = lazy(() => import('@/pages/public/PricingPage'))
const OwnersLandingPage = lazy(() => import('@/pages/public/OwnersLandingPage'))
const NotFoundPage = lazy(() => import('@/pages/public/NotFoundPage'))
// Auth
const LoginPage = lazy(() => import('@/pages/auth/LoginPage'))
const SignupPage = lazy(() => import('@/pages/auth/SignupPage'))
// Renter
const ApplyPage = lazy(() => import('@/pages/renter/ApplyPage'))
const RenterOverviewPage = lazy(() => import('@/pages/renter/RenterOverviewPage'))
const RenterApplicationsPage = lazy(() => import('@/pages/renter/RenterApplicationsPage'))
const RenterApplicationDetailPage = lazy(() => import('@/pages/renter/RenterApplicationDetailPage'))
const SavedListingsPage = lazy(() => import('@/pages/renter/SavedListingsPage'))
const RenterProfilePage = lazy(() => import('@/pages/renter/RenterProfilePage'))
const MessagesPage = lazy(() => import('@/pages/renter/MessagesPage'))
// Owner
const OwnerOverviewPage = lazy(() => import('@/pages/owner/OwnerOverviewPage'))
const OwnerListingsPage = lazy(() => import('@/pages/owner/OwnerListingsPage'))
const ListingFormPage = lazy(() => import('@/pages/owner/ListingFormPage'))
const OwnerApplicantsPage = lazy(() => import('@/pages/owner/OwnerApplicantsPage'))
const OwnerApplicationDetailPage = lazy(() => import('@/pages/owner/OwnerApplicationDetailPage'))
// Admin
const AdminOverviewPage = lazy(() => import('@/pages/admin/AdminOverviewPage'))
const AdminVerificationPage = lazy(() => import('@/pages/admin/AdminVerificationPage'))
const AdminApplicationsPage = lazy(() => import('@/pages/admin/AdminApplicationsPage'))
const AdminApplicationDetailPage = lazy(() => import('@/pages/admin/AdminApplicationDetailPage'))
const AdminListingsPage = lazy(() => import('@/pages/admin/AdminListingsPage'))
const AdminUsersPage = lazy(() => import('@/pages/admin/AdminUsersPage'))
const AdminSettingsPage = lazy(() => import('@/pages/admin/AdminSettingsPage'))

function PageFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-200 border-t-brand-700" aria-label="Loading" />
    </div>
  )
}

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo({ top: 0 }) }, [pathname])
  return null
}

function RenterShell() {
  const pendingFees = useStore((s) => s.applications.filter((a) => a.renterId === s.currentUserId && a.status === 'awaiting_fees' && !a.renterFeePaid).length)
  return (
    <RequireRole roles={['renter']}>
      <DashboardLayout title="Renter" items={[
        { to: '/dashboard', label: 'Overview', icon: LayoutDashboard, end: true },
        { to: '/dashboard/applications', label: 'Applications', icon: FileText, badge: pendingFees },
        { to: '/dashboard/messages', label: 'Messages', icon: MessageSquare },
        { to: '/dashboard/saved', label: 'Saved homes', icon: Heart },
        { to: '/dashboard/profile', label: 'Profile & verification', icon: UserCircle },
      ]} />
    </RequireRole>
  )
}

function OwnerShell() {
  const waiting = useStore((s) => s.applications.filter((a) => a.ownerId === s.currentUserId && a.status === 'sent_to_owner').length)
  return (
    <RequireRole roles={['owner']}>
      <DashboardLayout title="Owner" items={[
        { to: '/owner', label: 'Overview', icon: LayoutDashboard, end: true },
        { to: '/owner/listings', label: 'My listings', icon: Building2 },
        { to: '/owner/applicants', label: 'Applicants', icon: Users, badge: waiting },
        { to: '/owner/messages', label: 'Messages', icon: MessageSquare },
      ]} />
    </RequireRole>
  )
}

function AdminShell() {
  const toVerify = useStore((s) => s.applications.filter((a) => a.status === 'submitted' || a.status === 'under_review').length)
  const toModerate = useStore((s) => s.listings.filter((l) => l.status === 'pending_review').length)
  return (
    <RequireRole roles={['admin']}>
      <DashboardLayout title="Admin" items={[
        { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
        { to: '/admin/verification', label: 'Verification queue', icon: ShieldCheck, badge: toVerify },
        { to: '/admin/applications', label: 'Deal pipeline', icon: ListChecks },
        { to: '/admin/listings', label: 'Listings', icon: Inbox, badge: toModerate },
        { to: '/admin/users', label: 'Users', icon: Users },
        { to: '/admin/messages', label: 'Messages', icon: MessageSquare },
        { to: '/admin/settings', label: 'Fees & settings', icon: Settings },
      ]} />
    </RequireRole>
  )
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/listings" element={<ListingsPage />} />
          <Route path="/listings/:id" element={<ListingDetailPage />} />
          <Route path="/how-it-works" element={<HowItWorksPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/owners" element={<OwnersLandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/apply/:listingId" element={<RequireRole roles={['renter']}><ApplyPage /></RequireRole>} />
          <Route path="/messages/:applicationId" element={<RequireRole roles={['renter', 'owner', 'admin']}><MessagesPage /></RequireRole>} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>

        <Route path="/dashboard" element={<RenterShell />}>
          <Route index element={<RenterOverviewPage />} />
          <Route path="applications" element={<RenterApplicationsPage />} />
          <Route path="applications/:id" element={<RenterApplicationDetailPage />} />
          <Route path="messages" element={<MessagesPage />} />
          <Route path="saved" element={<SavedListingsPage />} />
          <Route path="profile" element={<RenterProfilePage />} />
        </Route>

        <Route path="/owner" element={<OwnerShell />}>
          <Route index element={<OwnerOverviewPage />} />
          <Route path="listings" element={<OwnerListingsPage />} />
          <Route path="listings/new" element={<ListingFormPage />} />
          <Route path="listings/:id/edit" element={<ListingFormPage />} />
          <Route path="applicants" element={<OwnerApplicantsPage />} />
          <Route path="applications/:id" element={<OwnerApplicationDetailPage />} />
          <Route path="messages" element={<MessagesPage />} />
        </Route>

        <Route path="/admin" element={<AdminShell />}>
          <Route index element={<AdminOverviewPage />} />
          <Route path="verification" element={<AdminVerificationPage />} />
          <Route path="applications" element={<AdminApplicationsPage />} />
          <Route path="applications/:id" element={<AdminApplicationDetailPage />} />
          <Route path="listings" element={<AdminListingsPage />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="messages" element={<MessagesPage />} />
          <Route path="settings" element={<AdminSettingsPage />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Route>
      </Routes>
      </Suspense>
      <Toaster />
    </>
  )
}
