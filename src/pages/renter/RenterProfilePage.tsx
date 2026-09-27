import { useMemo, useState, type FormEvent } from 'react'
import { BadgeCheck, Eye, FileCheck2, ShieldCheck, UserCheck } from 'lucide-react'
import { Avatar, Button, Card, CardBody, CardHeader, Input, PageHeader, Textarea, VerificationBadge } from '@/components/ui'
import { useCurrentUser, useLoad, useMyApplications, useStore } from '@/store/useStore'
import { isApiError } from '@/lib/api'
import { ChangePasswordCard } from '@/components/shared/ChangePasswordCard'
import { formatDate } from '@/lib/utils'
import { ID_TYPE_LABELS } from '@/components/shared/applicationUtils'
import { TenantPassCard } from '@/components/renter/TenantPassCard'

const VERIFY_EXPLAIN = {
  unverified: 'You haven’t been verified yet. You’ll upload an ID and a selfie during your first application, and our team checks them — usually within 24 hours.',
  pending: 'Your documents are with our team. We’ll notify you as soon as the review is complete.',
  verified: 'Your identity has been checked by StayBridge. Owners see a verified badge next to your profile, and you can reuse this verification on future applications.',
  rejected: 'We couldn’t verify your last documents. Please upload a clear, valid ID with your next application.',
}

export default function RenterProfilePage() {
  const user = useCurrentUser()
  const applications = useMyApplications()
  const fetchMyApplications = useStore((s) => s.fetchMyApplications)
  useLoad(() => fetchMyApplications(), [fetchMyApplications])
  const updateProfile = useStore((s) => s.updateProfile)
  const toast = useStore((s) => s.toast)

  const [name, setName] = useState(user?.name ?? '')
  const [phone, setPhone] = useState(user?.phone ?? '')
  const [bio, setBio] = useState(user?.bio ?? '')
  const [saving, setSaving] = useState(false)
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({})

  const lastVerification = useMemo(() => applications.find((a) => a.verification)?.verification, [applications])

  if (!user) return null

  const dirty = name.trim() !== user.name || phone.trim() !== (user.phone ?? '') || bio.trim() !== (user.bio ?? '')
  const nameError = (name.trim().length < 2 ? 'Enter your full name.' : undefined) ?? serverErrors.name
  const phoneError = (phone.trim() && !/^\+?[\d\s()-]{6,20}$/.test(phone.trim()) ? 'Enter a valid phone number.' : undefined) ?? serverErrors.phone

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (nameError || phoneError || saving) return
    setSaving(true)
    setServerErrors({})
    try {
      await updateProfile({ name: name.trim(), phone: phone.trim() || null, bio: bio.trim() || null })
      toast({ title: 'Profile saved', tone: 'success' })
    } catch (err) {
      if (isApiError(err)) setServerErrors(err.fieldErrors)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Profile & verification" description="Manage how you appear to owners and your StayBridge verification." />

      <Card>
        <CardHeader title="Personal details" description="Owners see your first name and last initial until contact is unlocked." />
        <form onSubmit={(e) => void save(e)}>
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
              <Input label="Email" name="email" value={user.email ?? ''} disabled help="Used to sign in. Contact support to change it." className="sm:col-span-2" />
              <Textarea label="Bio" name="bio" rows={4} className="sm:col-span-2" value={bio} onChange={(e) => setBio(e.target.value)}
                placeholder="A short intro: what you do, your routines, and what you’re looking for." help={serverErrors.bio ?? `${bio.length}/400`} maxLength={400} />
            </div>
          </CardBody>
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-ink-100 px-5 py-4">
            {dirty && <Button type="button" variant="ghost" onClick={() => { setName(user.name); setPhone(user.phone ?? ''); setBio(user.bio ?? '') }}>Discard</Button>}
            <Button type="submit" disabled={!dirty || !!nameError || !!phoneError} loading={saving}>Save changes</Button>
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
                <p className="text-ink-500">{lastVerification.idNumberMasked && <>Document ending <span className="font-mono">{lastVerification.idNumberMasked.slice(-4)}</span> · </>}submitted {formatDate(lastVerification.submittedAt)}{lastVerification.hasProofOfIncome ? ' · proof of income on file' : ''}</p>
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

      <ChangePasswordCard />

      <p className="flex items-center justify-center gap-1.5 pb-2 text-xs text-ink-400"><BadgeCheck className="h-3.5 w-3.5" /> StayBridge never shares your documents with owners.</p>
    </div>
  )
}
