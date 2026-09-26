import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { Bell, ChevronDown, LogOut, Menu, X, LayoutDashboard, Home } from 'lucide-react'
import { useCurrentUser, useStore, useUnreadCount } from '@/store/useStore'
import { Avatar, Button } from '@/components/ui'
import { cn, timeAgo } from '@/lib/utils'

export function dashboardPath(role?: string) {
  if (role === 'admin') return '/admin'
  if (role === 'owner') return '/owner'
  return '/dashboard'
}

export function Logo({ light }: { light?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-700 text-white">
        <Home className="h-4 w-4" />
      </span>
      <span className={cn('font-display text-xl font-bold tracking-tight', light ? 'text-white' : 'text-ink-900')}>StayBridge</span>
    </Link>
  )
}

const publicLinks = [
  { to: '/listings', label: 'Find a home' },
  { to: '/how-it-works', label: 'How it works' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/owners', label: 'For owners' },
]

export function Navbar() {
  const user = useCurrentUser()
  const logout = useStore((s) => s.logout)
  const unread = useUnreadCount()
  const [open, setOpen] = useState(false)
  const [menu, setMenu] = useState(false)
  const [notif, setNotif] = useState(false)
  const nav = useNavigate()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) { setMenu(false); setNotif(false) } }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  return (
    <header className="sticky top-0 z-40 border-b border-ink-200/70 bg-white/85 backdrop-blur">
      <div className="container-x flex h-16 items-center justify-between gap-4">
        <Logo />
        <nav className="hidden items-center gap-1 md:flex">
          {publicLinks.map((l) => (
            <NavLink key={l.to} to={l.to} className={({ isActive }) => cn('rounded-lg px-3 py-2 text-sm font-medium transition-colors', isActive ? 'bg-brand-50 text-brand-800' : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900')}>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-2" ref={ref}>
          {user ? (
            <>
              <div className="relative">
                <button onClick={() => { setNotif((v) => !v); setMenu(false) }} className="relative rounded-lg p-2 text-ink-600 hover:bg-ink-100" aria-label="Notifications">
                  <Bell className="h-5 w-5" />
                  {unread > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{unread}</span>}
                </button>
                {notif && <NotificationsPanel onClose={() => setNotif(false)} />}
              </div>
              <div className="relative">
                <button onClick={() => { setMenu((v) => !v); setNotif(false) }} className="flex items-center gap-2 rounded-xl p-1 pr-2 hover:bg-ink-100">
                  <Avatar name={user.name} src={user.avatarUrl} size="sm" />
                  <span className="hidden text-sm font-medium sm:block">{user.name.split(' ')[0]}</span>
                  <ChevronDown className="hidden h-4 w-4 text-ink-400 sm:block" />
                </button>
                {menu && (
                  <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border border-ink-200 bg-white shadow-lift animate-fade-up">
                    <div className="border-b border-ink-100 px-4 py-3">
                      <p className="truncate text-sm font-semibold">{user.name}</p>
                      <p className="truncate text-xs capitalize text-ink-400">{user.role} account</p>
                    </div>
                    <Link to={dashboardPath(user.role)} onClick={() => setMenu(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-ink-50"><LayoutDashboard className="h-4 w-4 text-ink-400" /> Dashboard</Link>
                    <button onClick={() => { logout(); setMenu(false); nav('/') }} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50"><LogOut className="h-4 w-4" /> Sign out</button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <Button variant="ghost" size="sm" onClick={() => nav('/login')}>Sign in</Button>
              <Button size="sm" onClick={() => nav('/signup')}>Get started</Button>
            </div>
          )}
          <button className="rounded-lg p-2 text-ink-600 hover:bg-ink-100 md:hidden" onClick={() => setOpen((v) => !v)} aria-label="Menu">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>
      {open && (
        <div className="border-t border-ink-100 bg-white px-4 py-3 md:hidden animate-fade-in">
          {publicLinks.map((l) => (
            <NavLink key={l.to} to={l.to} onClick={() => setOpen(false)} className={({ isActive }) => cn('block rounded-lg px-3 py-2.5 text-sm font-medium', isActive ? 'bg-brand-50 text-brand-800' : 'text-ink-700')}>{l.label}</NavLink>
          ))}
          {!user && (
            <div className="mt-3 flex gap-2">
              <Button variant="outline" full onClick={() => { setOpen(false); nav('/login') }}>Sign in</Button>
              <Button full onClick={() => { setOpen(false); nav('/signup') }}>Get started</Button>
            </div>
          )}
        </div>
      )}
    </header>
  )
}

function NotificationsPanel({ onClose }: { onClose: () => void }) {
  const user = useCurrentUser()
  const all = useStore((s) => s.notifications)
  const markRead = useStore((s) => s.markNotificationRead)
  const markAll = useStore((s) => s.markAllNotificationsRead)
  const nav = useNavigate()
  const items = all.filter((n) => n.userId === user?.id).slice(0, 8)
  return (
    <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-ink-200 bg-white shadow-lift animate-fade-up">
      <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
        <p className="text-sm font-semibold">Notifications</p>
        <button onClick={markAll} className="text-xs font-medium text-brand-700 hover:underline">Mark all read</button>
      </div>
      <div className="max-h-80 overflow-y-auto">
        {items.length === 0 && <p className="px-4 py-8 text-center text-sm text-ink-400">No notifications yet.</p>}
        {items.map((n) => (
          <button key={n.id} onClick={() => { markRead(n.id); onClose(); if (n.link) nav(n.link) }} className={cn('flex w-full gap-3 border-b border-ink-50 px-4 py-3 text-left hover:bg-ink-50', !n.read && 'bg-brand-50/50')}>
            <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.read ? 'bg-transparent' : 'bg-brand-600')} />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-ink-900">{n.title}</span>
              <span className="line-clamp-2 block text-xs text-ink-500">{n.body}</span>
              <span className="block text-[11px] text-ink-400">{timeAgo(n.at)}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
