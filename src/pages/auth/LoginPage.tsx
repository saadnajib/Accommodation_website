import { useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, Building2, KeyRound, Lock, Mail, ShieldCheck, UserCheck } from 'lucide-react'
import { isApiError } from '@/lib/api'
import { useStore } from '@/store/useStore'
import { Button, Input } from '@/components/ui'
import { dashboardPath } from '@/lib/paths'
import { AuthBrandPanel } from '@/components/listings/AuthBrandPanel'
import type { Role } from '@/types'

/** Demo accounts seeded by the API (SEED_DEMO=true). Clicking a card prefills its credentials. */
const DEMO_PASSWORD = 'Demo!Pass2026'
const DEMOS: Array<{ role: Role; email: string; password: string; name: string; desc: string; icon: typeof KeyRound; tone: string }> = [
  { role: 'renter', email: 'jonas@staybridge.demo', password: DEMO_PASSWORD, name: 'Jonas · Renter', desc: 'Verified, has a Tenant Pass, one deal awaiting fees.', icon: KeyRound, tone: 'bg-brand-50 text-brand-700' },
  { role: 'owner', email: 'marco@staybridge.demo', password: DEMO_PASSWORD, name: 'Marco · Owner', desc: 'Lists homes in Milan & Berlin, reviews applicants.', icon: Building2, tone: 'bg-amber-50 text-amber-700' },
  { role: 'admin', email: 'admin@staybridge.demo', password: 'ChangeMe!Admin2026', name: 'Admin', desc: 'Verifies renters, moderates listings, runs the pipeline.', icon: ShieldCheck, tone: 'bg-ink-100 text-ink-700' },
]

export default function LoginPage() {
  const login = useStore((s) => s.login)
  const toast = useStore((s) => s.toast)
  const nav = useNavigate()
  const loc = useLocation()
  const from = (loc.state as { from?: string } | null)?.from

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({})
  const [busy, setBusy] = useState(false)
  const submitRef = useRef<HTMLButtonElement>(null)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const next: typeof errors = {}
    if (!email.trim()) next.email = 'Enter your email address'
    if (!password) next.password = 'Enter your password'
    setErrors(next)
    if (Object.keys(next).length || busy) return
    setBusy(true)
    try {
      const u = await login(email, password)
      toast({ title: `Welcome back, ${u.name.split(' ')[0]}!`, tone: 'success' })
      nav(from ?? dashboardPath(u.role), { replace: true })
    } catch (err) {
      if (isApiError(err)) {
        const f = err.fieldErrors
        setErrors({ email: f.email, password: f.password, form: f.email || f.password ? undefined : err.message })
      }
    } finally {
      setBusy(false)
    }
  }

  const pickDemo = (d: (typeof DEMOS)[number]) => {
    setEmail(d.email)
    setPassword(d.password)
    setErrors({})
    requestAnimationFrame(() => submitRef.current?.focus())
  }

  return (
    <div className="container-x py-8 sm:py-12">
      <div className="grid overflow-hidden rounded-3xl border border-ink-200/80 bg-white shadow-card lg:grid-cols-2">
        <div className="p-6 sm:p-10 lg:p-12 animate-fade-up">
          <h1 className="text-3xl font-bold tracking-tight text-ink-900">Welcome back</h1>
          <p className="mt-2 text-ink-500">Sign in with your email and password.</p>
          {from && <p className="mt-4 flex items-center gap-2 rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-800"><Lock className="h-4 w-4" /> Sign in to continue.</p>}

          <form onSubmit={(e) => void onSubmit(e)} className="mt-6 space-y-4" noValidate>
            <Input id="email" name="email" type="email" autoComplete="username" label="Email address" placeholder="you@example.com"
              value={email} onChange={(e) => { setEmail(e.target.value); setErrors({}) }} error={errors.email} left={<Mail className="h-4 w-4" />} autoFocus />
            <Input id="password" name="password" type="password" autoComplete="current-password" label="Password" placeholder="Your password"
              value={password} onChange={(e) => { setPassword(e.target.value); setErrors({}) }} error={errors.password} left={<Lock className="h-4 w-4" />} />
            {errors.form && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{errors.form}</p>}
            <Button ref={submitRef} type="submit" full size="lg" loading={busy}>Sign in <ArrowRight className="h-4 w-4" /></Button>
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
                <button key={d.email} type="button" onClick={() => pickDemo(d)} aria-label={`Use the ${d.name} demo account`}
                  className="group flex w-full items-center gap-3 rounded-2xl border border-ink-200 bg-white p-3.5 text-left transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
                  <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${d.tone}`}><d.icon className="h-5 w-5" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink-900">{d.name}</span>
                    <span className="block truncate text-xs text-ink-500">{d.desc}</span>
                    <span className="block truncate text-[11px] text-ink-400">{d.email} · {d.password}</span>
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
