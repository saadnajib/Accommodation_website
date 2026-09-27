import { useState, type FormEvent } from 'react'
import { KeyRound, Lock } from 'lucide-react'
import { Button, Card, CardBody, CardHeader, Input } from '@/components/ui'
import { useStore } from '@/store/useStore'
import { isApiError } from '@/lib/api'
import { passwordProblem } from '@/lib/password'

type Field = 'current' | 'next' | 'confirm'

/** POST /auth/change-password. Other devices are signed out by the server; this session stays signed in. */
export function ChangePasswordCard() {
  const changePassword = useStore((s) => s.changePassword)
  const toast = useStore((s) => s.toast)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({})

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const errs: typeof errors = {}
    if (!current) errs.current = 'Enter your current password'
    const p = passwordProblem(next)
    if (p) errs.next = p
    else if (next === current) errs.next = 'Choose a different password'
    if (confirm !== next) errs.confirm = 'Passwords don’t match'
    setErrors(errs)
    if (Object.keys(errs).length || busy) return
    setBusy(true)
    try {
      await changePassword(current, next)
      setCurrent(''); setNext(''); setConfirm('')
      toast({ title: 'Password changed', body: 'Other devices have been signed out.', tone: 'success' })
    } catch (err) {
      if (isApiError(err)) {
        const f = err.fieldErrors
        setErrors({
          current: f.currentPassword ?? (err.status === 400 && !f.newPassword ? err.message : undefined),
          next: f.newPassword,
        })
      }
    } finally {
      setBusy(false)
    }
  }

  const clear = (k: Field) => setErrors((e) => (e[k] ? { ...e, [k]: undefined } : e))

  return (
    <Card>
      <CardHeader title={<span className="flex items-center gap-2"><KeyRound className="h-4 w-4 text-ink-400" /> Change password</span>}
        description="Use at least 10 characters with letters and numbers. Changing it signs out your other devices." />
      <form onSubmit={(e) => void submit(e)} noValidate>
        <CardBody className="grid gap-4 sm:grid-cols-3">
          <Input id="current-password" name="current-password" type="password" autoComplete="current-password" label="Current password"
            value={current} onChange={(e) => { setCurrent(e.target.value); clear('current') }} error={errors.current} left={<Lock className="h-4 w-4" />} />
          <Input id="new-password" name="new-password" type="password" autoComplete="new-password" label="New password"
            value={next} onChange={(e) => { setNext(e.target.value); clear('next') }} error={errors.next} left={<Lock className="h-4 w-4" />} />
          <Input id="confirm-password" name="confirm-password" type="password" autoComplete="new-password" label="Confirm new password"
            value={confirm} onChange={(e) => { setConfirm(e.target.value); clear('confirm') }} error={errors.confirm} left={<Lock className="h-4 w-4" />} />
        </CardBody>
        <div className="flex justify-end border-t border-ink-100 px-5 py-4">
          <Button type="submit" loading={busy} disabled={!current || !next || !confirm}>Update password</Button>
        </div>
      </form>
    </Card>
  )
}
