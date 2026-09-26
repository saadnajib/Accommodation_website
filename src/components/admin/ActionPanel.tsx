import { Link } from 'react-router-dom'
import { CircleCheck, Clock, LockOpen, MessageSquare } from 'lucide-react'
import { ApplicationStatusBadge, Button, Card, CardBody } from '@/components/ui'
import { APPLICATION_STATUS, PIPELINE, pipelineIndex } from '@/lib/status'
import { cn, formatMoney, timeAgo } from '@/lib/utils'
import type { Application } from '@/types'
import { actionsFor, CANCEL_ACTION, canCancel, type ActionSpec } from './actions'
import { ADMIN_NEXT_STEP, isClosed, statusEnteredAt } from './helpers'

export function ActionPanel({ app, currency, onAction, onMarkFee }: {
  app: Application; currency: string; onAction: (spec: ActionSpec) => void; onMarkFee: (side: 'renter' | 'owner') => void
}) {
  const actions = actionsFor(app.status)
  const idx = pipelineIndex(app.status)
  const progress = idx >= 0 ? ((idx + 1) / PIPELINE.length) * 100 : 100

  return (
    <Card className="overflow-hidden">
      <div className={cn('h-1.5', isClosed(app.status) ? 'bg-ink-200' : 'bg-ink-100')}>
        <div className={cn('h-full transition-all duration-500', isClosed(app.status) ? 'bg-ink-300' : 'bg-brand-600')} style={{ width: `${progress}%` }} />
      </div>
      <CardBody className="space-y-4">
        <div>
          <div className="flex items-center justify-between gap-2">
            <ApplicationStatusBadge status={app.status} />
            <span className="inline-flex items-center gap-1 text-xs text-ink-400"><Clock className="h-3.5 w-3.5" /> {timeAgo(statusEnteredAt(app))}</span>
          </div>
          <p className="mt-2 text-sm text-ink-500">{APPLICATION_STATUS[app.status].description}</p>
          <p className="mt-2 rounded-lg bg-brand-50 px-3 py-2 text-sm font-medium text-brand-900">{ADMIN_NEXT_STEP[app.status]}</p>
        </div>

        {app.status === 'awaiting_fees' && (
          <div className="space-y-2">
            <FeeStatus label="Renter fee" amount={formatMoney(app.renterFee, currency)} paid={app.renterFeePaid} onMark={() => onMarkFee('renter')} />
            <FeeStatus label="Owner fee" amount={formatMoney(app.ownerFee, currency)} paid={app.ownerFeePaid} onMark={() => onMarkFee('owner')} />
          </div>
        )}

        {actions.length > 0 && (
          <div className="flex flex-col gap-2">
            {actions.map((a) => (
              <Button key={a.key} full variant={a.variant} onClick={() => onAction(a)}>{a.label}</Button>
            ))}
          </div>
        )}

        {app.contactUnlocked && (
          <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
            <p className="flex items-center gap-2 text-sm font-medium text-emerald-800"><LockOpen className="h-4 w-4" /> Contact unlocked</p>
            <Link to={`/messages/${app.id}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:text-brand-800">
              <MessageSquare className="h-4 w-4" /> View conversation
            </Link>
          </div>
        )}

        {canCancel(app.status) && (
          <Button full variant="ghost" className="text-red-700 hover:bg-red-50" onClick={() => onAction(CANCEL_ACTION)}>{CANCEL_ACTION.label}</Button>
        )}
      </CardBody>
    </Card>
  )
}

function FeeStatus({ label, amount, paid, onMark }: { label: string; amount: string; paid: boolean; onMark: () => void }) {
  return (
    <div className={cn('flex items-center gap-3 rounded-xl border p-3', paid ? 'border-emerald-200 bg-emerald-50/60' : 'border-amber-200 bg-amber-50/60')}>
      {paid ? <CircleCheck className="h-5 w-5 shrink-0 text-emerald-600" /> : <Clock className="h-5 w-5 shrink-0 text-amber-600" />}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink-900">{label}</p>
        <p className={cn('text-xs', paid ? 'text-emerald-700' : 'text-amber-800')}><span className="font-semibold tabular-nums">{amount}</span> · {paid ? 'Received' : 'Not yet paid'}</p>
      </div>
      {!paid && <Button size="sm" variant="outline" onClick={onMark}>Mark received</Button>}
    </div>
  )
}
