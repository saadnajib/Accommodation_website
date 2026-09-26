import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, BadgeCheck, Eye, FileCheck2, RotateCcw, ShieldCheck, UserCheck } from 'lucide-react'
import { Avatar, Button, Card, CardBody, CardHeader, Input, PageHeader, Textarea, VerificationBadge } from '@/components/ui'
import { useCurrentUser, useStore } from '@/store/useStore'
import { formatDate } from '@/lib/utils'
import { ID_TYPE_LABELS } from '@/components/shared/applicationUtils'
import { ConfirmModal } from '@/components/shared/ConfirmModal'
import { TenantPassCard } from '@/components/renter/TenantPassCard'

const VERIFY_EXPLAIN = {
  unverified: 'You haven’t been verified yet. You’ll upload an ID and a selfie during your first application, and our team checks them — usually within 24 hours.',
  pending: 'Your documents are with our team. We’ll notify you as soon as the review is complete.',
  verified: 'Your identity has been checked by StayBridge. Owners see a verified badge next to your profile, and you can reuse this verification on future applications.',
  rejected: 'We couldn’t verify your last documents. Please upload a clear, valid ID with your next application.',
}

export default function RenterProfilePage() {
  const user = useCurrentUser()
  const applications = useStore((s) => s.applications)
  const updateProfile = useStore((s) => s.updateProfile)
  const resetDemo = useStore((s) => s.resetDemo)
  const toast = useStore((s) => s.toast)
  const nav = useNavigate()

  const [name, setName] = useState(user?.name ?? '')
  const [phone, setPhone] = useState(user?.phone ?? '')
  const [bio, setBio] = useState(user?.bio ?? '')
  const [resetOpen, setResetOpen] = useState(false)

  const lastVerification = useMemo(
    () => applications.filter((a) => a.renterId === user?.id && a.verification).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]?.verification,
    [applications, user?.id],
  )

  if (!user) return null

  const dirty = name.trim() !== user.name || phone.trim() !== (user.phone ?? '') || bio.trim() !== (user.bio ?? '')
  const nameError = name.trim().length < 2 ? 'Enter your full name.' : undefined
  const phoneError = phone.trim() && !/^\+?[\d\s()-]{6,20}$/.test(phone.trim()) ? 'Enter a valid phone number.' : undefined

  const save = (e: FormEvent) => {
    e.preventDefault()
    if (nameError || phoneError) return
    updateProfile({ name: name.trim(), phone: phone.trim() || undefined, bio: bio.trim() || undefined })
    toast({ title: 'Profile saved', tone: 'success' })
  }

  const reset = () => {
    try {
      Object.keys(sessionStorage).filter((k) => k.startsWith('staybridge:apply:')).forEach((k) => sessionStorage.removeItem(k))
    } catch { /* ignore */ }
    resetDemo()
    nav('/')
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Profile & verification" description="Manage how you appear to owners and your StayBridge verification." />

      <Card>
        <CardHeader title="Personal details" description="Owners see your first name and last initial until contact is unlocked." />
        <form onSubmit={save}>
          <CardBody className="space-y-5">
            <div className="flex items-center gap-4">
              <Avatar name={name || user.name} src={user.avatarUrl} size="xl" />
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold text-ink-900">{name || user.name}</p>
                <p className="truncate text-sm text-ink-500">{user.email}</p>
                <p className="text-xs text-ink-400">Member since {formatDate(user.createdAt, { month: 'long', year: 'numeric' })}</p>
              </div>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Input label="Full name" name="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} error={nameError} />
              <Input label="Phone" name="phone" type="tel" autoComplete="tel" placeholder="+44 7700 900000" value={phone} onChange={(e) => setPhone(e.target.value)}
                error={phoneError} help="Only shared with an owner after contact is unlocked." />
              <Input label="Email" name="email" value={user.email} disabled help="Used to sign in. Contact support to change it." className="sm:col-span-2" />
              <Textarea label="Bio" name="bio" rows={4} className="sm:col-span-2" value={bio} onChange={(e) => setBio(e.target.value)}
                placeholder="A short intro: what you do, your routines, and what you’re looking for." help={`${bio.length}/400`} maxLength={400} />
            </div>
          </CardBody>
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-ink-100 px-5 py-4">
            {dirty && <Button type="button" variant="ghost" onClick={() => { setName(user.name); setPhone(user.phone ?? ''); setBio(user.bio ?? '') }}>Discard</Button>}
            <Button type="submit" disabled={!dirty || !!nameError || !!phoneError}>Save changes</Button>
          </div>
        </form>
      </Card>

      <Card>
        <CardHeader title="Identity verification" action={<VerificationBadge status={user.verification} />} />
        <CardBody className="space-y-5">
          <p className="text-sm text-ink-600">{VERIFY_EXPLAIN[user.verification]}</p>
          {user.verification === 'verified' && lastVerification && (
            <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
              <FileCheck2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
              <div className="min-w-0 text-sm">
                <p className="font-semibold text-ink-900">Verified with your {ID_TYPE_LABELS[lastVerification.idType].toLowerCase()}</p>
                <p className="text-ink-500">Document ending <span className="font-mono">{lastVerification.idNumberMasked.slice(-4)}</span> · submitted {formatDate(lastVerification.submittedAt)}{lastVerification.proofOfIncomeName ? ' · proof of income on file' : ''}</p>
              </div>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { icon: UserCheck, title: 'Real identity', text: 'We match your ID document to a selfie.' },
              { icon: ShieldCheck, title: 'Safer for everyone', text: 'Owners only ever see verified renters.' },
              { icon: Eye, title: 'Private by default', text: 'Documents are seen by our team only, never by owners.' },
            ].map((f) => (
              <div key={f.title} className="rounded-xl bg-ink-50 p-3">
                <f.icon className="h-5 w-5 text-brand-700" />
                <p className="mt-2 text-sm font-semibold text-ink-900">{f.title}</p>
                <p className="text-xs text-ink-500">{f.text}</p>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      <TenantPassCard />

      <Card className="border-red-200">
        <CardHeader title={<span className="flex items-center gap-2 text-red-700"><AlertTriangle className="h-4 w-4" /> Danger zone</span>} />
        <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-ink-900">Reset demo data</p>
            <p className="text-sm text-ink-500">Restores all accounts, listings and applications to their original state and signs you out.</p>
          </div>
          <Button variant="danger" onClick={() => setResetOpen(true)} className="shrink-0"><RotateCcw className="h-4 w-4" /> Reset demo</Button>
        </CardBody>
      </Card>

      <ConfirmModal open={resetOpen} onClose={() => setResetOpen(false)} onConfirm={reset} title="Reset all demo data?" confirmLabel="Reset & sign out">
        Everything you’ve changed in this demo — applications, messages, reviews, listings — will be restored to the original seed data. This can’t be undone.
      </ConfirmModal>
      <p className="flex items-center justify-center gap-1.5 pb-2 text-xs text-ink-400"><BadgeCheck className="h-3.5 w-3.5" /> StayBridge never shares your documents with owners.</p>
    </div>
  )
}
