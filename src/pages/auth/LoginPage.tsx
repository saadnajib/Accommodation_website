import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, Building2, KeyRound, Lock, Mail, ShieldCheck, UserCheck } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { Button, Input } from '@/components/ui'
import { dashboardPath } from '@/lib/paths'
import { AuthBrandPanel } from '@/components/listings/AuthBrandPanel'
import type { Role } from '@/types'

const DEMOS: Array<{ role: Role; email: string; name: string; desc: string; icon: typeof KeyRound; tone: string }> = [
  { role: 'renter', email: 'jonas@staybridge.demo', name: 'Jonas · Renter', desc: 'Verified, has a Tenant Pass, one deal awaiting fees.', icon: KeyRound, tone: 'bg-brand-50 text-brand-700' },
  { role: 'owner', email: 'marco@staybridge.demo', name: 'Marco · Owner', desc: 'Lists homes in Milan & Berlin, reviews applicants.', icon: Building2, tone: 'bg-amber-50 text-amber-700' },
  { role: 'admin', email: 'admin@staybridge.demo', name: 'Sara · Admin', desc: 'Verifies renters, moderates listings, runs the pipeline.', icon: ShieldCheck, tone: 'bg-ink-100 text-ink-700' },
]

export default function LoginPage() {
  const login = useStore((s) => s.login)
  const toast = useStore((s) => s.toast)
  const nav = useNavigate()
  const loc = useLocation()
  const from = (loc.state as { from?: string } | null)?.from

  const [email, setEmail] = useState('')
  const [error, setError] = useState('')

  const finish = (addr: string) => {
    if (!login(addr)) { setError('No account with that email'); return }
    const u = useStore.getState().users.find((x) => x.email.toLowerCase() === addr.trim().toLowerCase())
    toast({ title: `Welcome back${u ? `, ${u.name.split(' ')[0]}` : ''}!`, tone: 'success' })
    nav(from ?? dashboardPath(u?.role), { replace: true })
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!email.trim()) { setError('Enter your email address'); return }
    finish(email)
  }

  return (
    <div className="container-x py-8 sm:py-12">
      <div className="grid overflow-hidden rounded-3xl border border-ink-200/80 bg-white shadow-card lg:grid-cols-2">
        <div className="p-6 sm:p-10 lg:p-12 animate-fade-up">
          <h1 className="text-3xl font-bold tracking-tight text-ink-900">Welcome back</h1>
          <p className="mt-2 text-ink-500">Sign in with your email. No password needed in this demo.</p>
          {from && <p className="mt-4 flex items-center gap-2 rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-800"><Lock className="h-4 w-4" /> Sign in to continue.</p>}

          <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
            <Input id="email" name="email" type="email" autoComplete="email" label="Email address" placeholder="you@example.com"
              value={email} onChange={(e) => { setEmail(e.target.value); setError('') }} error={error} left={<Mail className="h-4 w-4" />} autoFocus />
            <Button type="submit" full size="lg">Sign in <ArrowRight className="h-4 w-4" /></Button>
          </form>
          <p className="mt-4 text-sm text-ink-500">New to StayBridge? <Link to="/signup" className="font-semibold text-brand-700 hover:underline">Create an account</Link></p>

          <div className="mt-10">
            <div className="flex items-center gap-3">
              <span className="h-px flex-1 bg-ink-200" />
              <span className="text-xs font-semibold uppercase tracking-wider text-ink-400">Try a demo account</span>
              <span className="h-px flex-1 bg-ink-200" />
            </div>
            <div className="mt-4 space-y-2.5">
              {DEMOS.map((d) => (
                <button key={d.email} type="button" onClick={() => finish(d.email)}
                  className="group flex w-full items-center gap-3 rounded-2xl border border-ink-200 bg-white p-3.5 text-left transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
                  <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${d.tone}`}><d.icon className="h-5 w-5" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink-900">{d.name}</span>
                    <span className="block truncate text-xs text-ink-500">{d.desc}</span>
                    <span className="block truncate text-[11px] text-ink-400">{d.email}</span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-ink-300 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-700" />
                </button>
              ))}
            </div>
          </div>
        </div>
        <AuthBrandPanel
          title="The calm way to rent."
          points={[
            { icon: UserCheck, text: 'Every renter verified by a real person' },
            { icon: ShieldCheck, text: 'Every listing reviewed before it goes live' },
            { icon: Lock, text: 'Contact details stay private until both sides commit' },
          ]}
        />
      </div>
    </div>
  )
}
