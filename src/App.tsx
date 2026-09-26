import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { LayoutDashboard, FileText, Heart, UserCircle, Building2, Users, ShieldCheck, ListChecks, Settings, Inbox, MessageSquare } from 'lucide-react'
import { DashboardLayout, PublicLayout, RequireRole } from '@/components/layout/Layouts'
import { Toaster } from '@/components/ui'
import { useStore } from '@/store/useStore'

// Public
import HomePage from '@/pages/public/HomePage'
import ListingsPage from '@/pages/public/ListingsPage'
import ListingDetailPage from '@/pages/public/ListingDetailPage'
import HowItWorksPage from '@/pages/public/HowItWorksPage'
import PricingPage from '@/pages/public/PricingPage'
import OwnersLandingPage from '@/pages/public/OwnersLandingPage'
import NotFoundPage from '@/pages/public/NotFoundPage'
// Auth
import LoginPage from '@/pages/auth/LoginPage'
import SignupPage from '@/pages/auth/SignupPage'
// Renter
import ApplyPage from '@/pages/renter/ApplyPage'
import RenterOverviewPage from '@/pages/renter/RenterOverviewPage'
import RenterApplicationsPage from '@/pages/renter/RenterApplicationsPage'
import RenterApplicationDetailPage from '@/pages/renter/RenterApplicationDetailPage'
import SavedListingsPage from '@/pages/renter/SavedListingsPage'
import RenterProfilePage from '@/pages/renter/RenterProfilePage'
import MessagesPage from '@/pages/renter/MessagesPage'
// Owner
import OwnerOverviewPage from '@/pages/owner/OwnerOverviewPage'
import OwnerListingsPage from '@/pages/owner/OwnerListingsPage'
import ListingFormPage from '@/pages/owner/ListingFormPage'
import OwnerApplicantsPage from '@/pages/owner/OwnerApplicantsPage'
import OwnerApplicationDetailPage from '@/pages/owner/OwnerApplicationDetailPage'
// Admin
import AdminOverviewPage from '@/pages/admin/AdminOverviewPage'
import AdminVerificationPage from '@/pages/admin/AdminVerificationPage'
import AdminApplicationsPage from '@/pages/admin/AdminApplicationsPage'
import AdminApplicationDetailPage from '@/pages/admin/AdminApplicationDetailPage'
import AdminListingsPage from '@/pages/admin/AdminListingsPage'
import AdminUsersPage from '@/pages/admin/AdminUsersPage'
import AdminSettingsPage from '@/pages/admin/AdminSettingsPage'

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
        { to: '/admin/settings', label: 'Fees & settings', icon: Settings },
      ]} />
    </RequireRole>
  )
}

export default function App() {
  return (
    <>
      <ScrollToTop />
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
          <Route path="settings" element={<AdminSettingsPage />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Route>
      </Routes>
      <Toaster />
    </>
  )
}
