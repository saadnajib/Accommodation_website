import type { ReactNode } from 'react'
import { Check, Star } from 'lucide-react'
import { cn, initials } from '@/lib/utils'

export function Avatar({ name, src, size = 'md', className }: { name: string; src?: string; size?: 'sm' | 'md' | 'lg' | 'xl'; className?: string }) {
  const sizes = { sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-14 w-14 text-base', xl: 'h-20 w-20 text-xl' }
  if (src) return <img src={src} alt={name} className={cn('rounded-full object-cover', sizes[size], className)} />
  return (
    <span className={cn('inline-flex shrink-0 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-800', sizes[size], className)}>
      {initials(name)}
    </span>
  )
}

export function EmptyState({ icon, title, description, action, className }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center rounded-2xl border border-dashed border-ink-200 bg-white px-6 py-14 text-center', className)}>
      {icon && <div className="mb-3 rounded-2xl bg-ink-100 p-3 text-ink-500">{icon}</div>}
      <h3 className="text-base font-semibold text-ink-900">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-ink-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Stepper({ steps, current, className }: { steps: string[]; current: number; className?: string }) {
  return (
    <ol className={cn('flex items-center gap-2 overflow-x-auto no-scrollbar', className)}>
      {steps.map((label, i) => {
        const done = i < current
        const active = i === current
        return (
          <li key={label} className="flex items-center gap-2 shrink-0">
            <span className={cn('flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ring-2 transition-colors',
              done ? 'bg-brand-700 text-white ring-brand-700' : active ? 'bg-white text-brand-700 ring-brand-700' : 'bg-white text-ink-400 ring-ink-200')}>
              {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <span className={cn('text-sm font-medium', active ? 'text-ink-900' : 'text-ink-400')}>{label}</span>
            {i < steps.length - 1 && <span className={cn('mx-1 h-px w-6 sm:w-10', done ? 'bg-brand-700' : 'bg-ink-200')} />}
          </li>
        )
      })}
    </ol>
  )
}

export function Rating({ value, count, size = 'sm' }: { value: number; count?: number; size?: 'sm' | 'md' }) {
  const cls = size === 'sm' ? 'h-3.5 w-3.5' : 'h-5 w-5'
  return (
    <span className="inline-flex items-center gap-1 text-sm text-ink-600">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={cn(cls, i <= Math.round(value) ? 'fill-amber-400 text-amber-400' : 'text-ink-200')} />
      ))}
      {count !== undefined && <span className="ml-1 text-xs text-ink-400">({count})</span>}
    </span>
  )
}

export function Tabs<T extends string>({ tabs, value, onChange, className }: { tabs: Array<{ value: T; label: string; count?: number }>; value: T; onChange: (v: T) => void; className?: string }) {
  return (
    <div className={cn('flex gap-1 overflow-x-auto no-scrollbar rounded-xl bg-ink-100 p-1', className)}>
      {tabs.map((t) => (
        <button key={t.value} onClick={() => onChange(t.value)}
          className={cn('flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
            value === t.value ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-900')}>
          {t.label}
          {t.count !== undefined && <span className={cn('rounded-full px-1.5 text-[11px]', value === t.value ? 'bg-brand-100 text-brand-800' : 'bg-ink-200 text-ink-600')}>{t.count}</span>}
        </button>
      ))}
    </div>
  )
}

export function SectionHeading({ eyebrow, title, description, align = 'left' }: { eyebrow?: string; title: string; description?: string; align?: 'left' | 'center' }) {
  return (
    <div className={cn('max-w-2xl', align === 'center' && 'mx-auto text-center')}>
      {eyebrow && <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-brand-700">{eyebrow}</p>}
      <h2 className="text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">{title}</h2>
      {description && <p className="mt-3 text-lg text-ink-500">{description}</p>}
    </div>
  )
}

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-ink-500">{description}</p>}
      </div>
      {action}
    </div>
  )
}
