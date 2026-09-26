import type { ReactNode } from 'react'
import { Navigate, NavLink, Outlet, useLocation } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import { Navbar } from './Navbar'
import { Footer } from './Footer'
import { useCurrentUser } from '@/store/useStore'
import type { Role } from '@/types'
import { cn } from '@/lib/utils'

export function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1"><Outlet /></main>
      <Footer />
    </div>
  )
}

export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const user = useCurrentUser()
  const loc = useLocation()
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />
  if (!roles.includes(user.role)) return <Navigate to="/" replace />
  return <>{children}</>
}

export interface SideNavItem { to: string; label: string; icon: LucideIcon; end?: boolean; badge?: number }

/** Dashboard shell: sticky sidebar on desktop, horizontal scrolling tab bar on mobile. */
export function DashboardLayout({ items, title }: { items: SideNavItem[]; title: string }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <div className="container-x flex flex-1 flex-col gap-6 py-6 lg:flex-row">
        <aside className="lg:w-60 lg:shrink-0">
          <p className="mb-2 hidden px-3 text-xs font-semibold uppercase tracking-wider text-ink-400 lg:block">{title}</p>
          <nav className="flex gap-1 overflow-x-auto no-scrollbar lg:sticky lg:top-24 lg:flex-col">
            {items.map((it) => (
              <NavLink key={it.to} to={it.to} end={it.end} className={({ isActive }) => cn('flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors', isActive ? 'bg-brand-700 text-white shadow-sm' : 'text-ink-600 hover:bg-white hover:text-ink-900')}>
                <it.icon className="h-4 w-4" />
                {it.label}
                {it.badge ? <span className="ml-auto rounded-full bg-white/20 px-1.5 text-[11px] font-bold">{it.badge}</span> : null}
              </NavLink>
            ))}
          </nav>
        </aside>
        <main className="min-w-0 flex-1 animate-fade-in"><Outlet /></main>
      </div>
    </div>
  )
}
