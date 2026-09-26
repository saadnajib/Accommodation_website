import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, Building2, CheckCircle2, HandCoins, KeyRound, Lock, Mail, Phone, User as UserIcon, UserCheck } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { Button, Input } from '@/components/ui'
import { dashboardPath } from '@/lib/paths'
import { AuthBrandPanel } from '@/components/listings/AuthBrandPanel'
import { cn } from '@/lib/utils'

type SignupRole = 'renter' | 'owner'

const ROLES: Array<{ value: SignupRole; title: string; desc: string; icon: typeof KeyRound }> = [
  { value: 'renter', title: 'I’m looking for a home', desc: 'Browse verified homes and apply once.', icon: KeyRound },
  { value: 'owner', title: 'I have a place to rent', desc: 'List for free, meet verified tenants.', icon: Building2 },
]

export default function SignupPage() {
  const [params] = useSearchParams()
  const signup = useStore((s) => s.signup)
  const users = useStore((s) => s.users)
  const toast = useStore((s) => s.toast)
  const nav = useNavigate()

  const [role, setRole] = useState<SignupRole>(params.get('role') === 'owner' ? 'owner' : 'renter')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [agree, setAgree] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<'name' | 'email' | 'agree', string>>>({})

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const next: typeof errors = {}
    const em = email.trim().toLowerCase()
    if (name.trim().length < 2) next.name = 'Please enter your full name'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) next.email = 'Enter a valid email address'
    else if (users.some((u) => u.email.toLowerCase() === em)) next.email = 'An account with this email already exists. Try signing in.'
    if (!agree) next.agree = 'Please accept the terms to continue'
    setErrors(next)
    if (Object.keys(next).length) return

    const user = signup({ name: name.trim(), email: em, role, phone: phone.trim() || undefined })
    toast({
      title: `Welcome to StayBridge, ${user.name.split(' ')[0]}!`,
      body: role === 'owner' ? 'Create your first listing — it’s free.' : 'Find a home and apply — we’ll verify you along the way.',
      tone: 'success',
    })
    nav(dashboardPath(user.role), { replace: true })
  }

  return (
    <div className="container-x py-8 sm:py-12">
      <div className="grid overflow-hidden rounded-3xl border border-ink-200/80 bg-white shadow-card lg:grid-cols-2">
        <div className="p-6 sm:p-10 lg:p-12 animate-fade-up">
          <h1 className="text-3xl font-bold tracking-tight text-ink-900">Create your account</h1>
          <p className="mt-2 text-ink-500">Free to join. You only pay when a deal goes through.</p>

          <form onSubmit={onSubmit} className="mt-6 space-y-5" noValidate>
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-ink-700">I want to…</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {ROLES.map((r) => {
                  const active = role === r.value
                  return (
                    <label key={r.value} className={cn('relative flex cursor-pointer flex-col rounded-2xl border-2 p-4 transition-all focus-within:ring-2 focus-within:ring-brand-500/40',
                      active ? 'border-brand-600 bg-brand-50 shadow-card' : 'border-ink-200 hover:border-ink-300 hover:bg-ink-50')}>
                      <input type="radio" name="role" value={r.value} checked={active} onChange={() => setRole(r.value)} className="sr-only" />
                      <span className={cn('grid h-10 w-10 place-items-center rounded-xl', active ? 'bg-brand-700 text-white' : 'bg-ink-100 text-ink-600')}><r.icon className="h-5 w-5" /></span>
                      <span className="mt-3 text-sm font-semibold text-ink-900">{r.title}</span>
                      <span className="mt-0.5 text-xs text-ink-500">{r.desc}</span>
                      {active && <CheckCircle2 className="absolute right-3 top-3 h-5 w-5 text-brand-700" />}
                    </label>
                  )
                })}
              </div>
            </fieldset>

            <Input id="name" name="name" label="Full name" autoComplete="name" placeholder="Alex Morgan" value={name}
              onChange={(e) => setName(e.target.value)} error={errors.name} left={<UserIcon className="h-4 w-4" />}
              help={role === 'renter' ? 'Owners only see your first name and last initial until contact unlocks.' : undefined} />
            <Input id="email" name="email" type="email" label="Email address" autoComplete="email" placeholder="you@example.com" value={email}
              onChange={(e) => setEmail(e.target.value)} error={errors.email} left={<Mail className="h-4 w-4" />} />
            <Input id="phone" name="phone" type="tel" label="Phone" hint="(optional)" autoComplete="tel" placeholder="+44 7700 900000" value={phone}
              onChange={(e) => setPhone(e.target.value)} left={<Phone className="h-4 w-4" />} help="Kept private until both sides commit." />

            <div>
              <label className={cn('flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm transition-colors', agree ? 'border-brand-500 bg-brand-50' : errors.agree ? 'border-red-300' : 'border-ink-200')}>
                <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-brand-700" />
                <span className="text-ink-600">
                  I agree to the StayBridge <Link to="/how-it-works#terms" target="_blank" className="font-semibold text-brand-700 hover:underline">terms</Link> and understand that contact happens through StayBridge until both sides commit.
                </span>
              </label>
              {errors.agree && <p className="mt-1.5 text-xs text-red-600">{errors.agree}</p>}
            </div>

            <Button type="submit" full size="lg">Create {role} account <ArrowRight className="h-4 w-4" /></Button>
          </form>
          <p className="mt-4 text-sm text-ink-500">Already have an account? <Link to="/login" className="font-semibold text-brand-700 hover:underline">Sign in</Link></p>
        </div>
        <AuthBrandPanel
          title={role === 'owner' ? 'Meet only verified tenants.' : 'Find a home without the chaos.'}
          points={role === 'owner'
            ? [
              { icon: UserCheck, text: 'Applicants verified before they reach you' },
              { icon: HandCoins, text: 'Free to list — pay only when a tenant is placed' },
              { icon: Lock, text: 'Your contact details stay private' },
            ]
            : [
              { icon: UserCheck, text: 'Get verified once, apply anywhere' },
              { icon: HandCoins, text: 'Pay only if the owner accepts you' },
              { icon: Lock, text: 'No scams — every listing reviewed' },
            ]}
        />
      </div>
    </div>
  )
}
