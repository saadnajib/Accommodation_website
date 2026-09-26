import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent' | 'outline'
type Size = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  full?: boolean
}

const variants: Record<Variant, string> = {
  primary: 'bg-brand-700 text-white hover:bg-brand-800 shadow-sm focus-visible:ring-brand-500',
  secondary: 'bg-ink-900 text-white hover:bg-ink-700 shadow-sm focus-visible:ring-ink-500',
  accent: 'bg-accent-500 text-ink-900 hover:bg-accent-400 shadow-sm focus-visible:ring-accent-500',
  outline: 'border border-ink-200 bg-white text-ink-900 hover:bg-ink-50 focus-visible:ring-brand-500',
  ghost: 'text-ink-700 hover:bg-ink-100 focus-visible:ring-brand-500',
  danger: 'bg-red-600 text-white hover:bg-red-700 shadow-sm focus-visible:ring-red-500',
}
const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm gap-1.5',
  md: 'h-11 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', loading, full, children, disabled, ...rest }, ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center rounded-xl font-semibold transition-all duration-150 select-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[.98]',
        'disabled:opacity-50 disabled:pointer-events-none',
        variants[variant], sizes[size], full && 'w-full', className,
      )}
      {...rest}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  )
})
