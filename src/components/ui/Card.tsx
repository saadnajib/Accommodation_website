import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Card({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('rounded-2xl border border-ink-200/80 bg-white shadow-card', className)} {...rest}>
      {children}
    </div>
  )
}

export function CardHeader({ title, description, action, className }: { title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-3 border-b border-ink-100 px-5 py-4', className)}>
      <div>
        <h3 className="text-base font-semibold text-ink-900">{title}</h3>
        {description && <p className="mt-0.5 text-sm text-ink-500">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('px-5 py-4', className)}>{children}</div>
}

export function Stat({ label, value, sub, icon, tone = 'brand' }: { label: string; value: ReactNode; sub?: ReactNode; icon?: ReactNode; tone?: 'brand' | 'accent' | 'ink' | 'green' | 'red' }) {
  const tones = {
    brand: 'bg-brand-50 text-brand-700',
    accent: 'bg-amber-50 text-amber-700',
    ink: 'bg-ink-100 text-ink-700',
    green: 'bg-emerald-50 text-emerald-700',
    red: 'bg-red-50 text-red-700',
  }
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-ink-500">{label}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-ink-900">{value}</p>
          {sub && <p className="mt-1 text-xs text-ink-400">{sub}</p>}
        </div>
        {icon && <div className={cn('rounded-xl p-2.5', tones[tone])}>{icon}</div>}
      </div>
    </Card>
  )
}
