import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

const base =
  'w-full rounded-xl border border-ink-200 bg-white px-3.5 text-ink-900 placeholder:text-ink-300 transition-colors ' +
  'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25 disabled:bg-ink-50 disabled:text-ink-400'

export function Label({ children, htmlFor, hint }: { children: ReactNode; htmlFor?: string; hint?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-ink-700">
      {children}
      {hint && <span className="ml-1 font-normal text-ink-400">{hint}</span>}
    </label>
  )
}

export function FieldError({ children }: { children?: ReactNode }) {
  if (!children) return null
  return <p className="mt-1.5 text-xs text-red-600">{children}</p>
}

export function Help({ children }: { children?: ReactNode }) {
  if (!children) return null
  return <p className="mt-1.5 text-xs text-ink-400">{children}</p>
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  help?: string
  hint?: string
  left?: ReactNode
  right?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, help, hint, left, right, className, id, ...rest }, ref,
) {
  const inputId = id ?? rest.name
  return (
    <div className={className}>
      {label && <Label htmlFor={inputId} hint={hint}>{label}</Label>}
      <div className="relative">
        {left && <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-ink-400">{left}</span>}
        <input
          ref={ref}
          id={inputId}
          className={cn(base, 'h-11', left && 'pl-10', right && 'pr-10', error && 'border-red-400 focus:border-red-500 focus:ring-red-500/25')}
          {...rest}
        />
        {right && <span className="absolute inset-y-0 right-3 flex items-center text-ink-400">{right}</span>}
      </div>
      <FieldError>{error}</FieldError>
      <Help>{help}</Help>
    </div>
  )
})

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  help?: string
  options: Array<{ value: string | number; label: string }>
  placeholder?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, help, options, placeholder, className, id, ...rest }, ref,
) {
  const inputId = id ?? rest.name
  return (
    <div className={className}>
      {label && <Label htmlFor={inputId}>{label}</Label>}
      <select ref={ref} id={inputId} className={cn(base, 'h-11 appearance-none bg-[url("data:image/svg+xml;utf8,<svg xmlns=%27http://www.w3.org/2000/svg%27 fill=%27none%27 viewBox=%270 0 24 24%27 stroke=%27%236b7280%27 stroke-width=%272%27><path stroke-linecap=%27round%27 stroke-linejoin=%27round%27 d=%27M19 9l-7 7-7-7%27/></svg>")] bg-[length:1.1rem] bg-[right_.75rem_center] bg-no-repeat pr-10', error && 'border-red-400')} {...rest}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <FieldError>{error}</FieldError>
      <Help>{help}</Help>
    </div>
  )
})

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  help?: string
  hint?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, help, hint, className, id, rows = 4, ...rest }, ref,
) {
  const inputId = id ?? rest.name
  return (
    <div className={className}>
      {label && <Label htmlFor={inputId} hint={hint}>{label}</Label>}
      <textarea ref={ref} id={inputId} rows={rows} className={cn(base, 'py-2.5', error && 'border-red-400')} {...rest} />
      <FieldError>{error}</FieldError>
      <Help>{help}</Help>
    </div>
  )
})

export function Checkbox({ label, className, description, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; description?: string }) {
  return (
    <label className={cn('flex cursor-pointer items-start gap-3 rounded-xl border border-ink-200 bg-white p-3 transition-colors has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50', className)}>
      <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 rounded border-ink-300 accent-brand-700" {...rest} />
      <span className="text-sm">
        <span className="font-medium text-ink-900">{label}</span>
        {description && <span className="mt-0.5 block text-ink-500">{description}</span>}
      </span>
    </label>
  )
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="inline-flex items-center gap-3">
      <span className={cn('relative block h-6 w-11 shrink-0 overflow-hidden rounded-full transition-colors', checked ? 'bg-brand-600' : 'bg-ink-200')}>
        <span className={cn('absolute left-0.5 top-0.5 block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200', checked ? 'translate-x-5' : 'translate-x-0')} />
      </span>
      {label && <span className="text-sm font-medium text-ink-700">{label}</span>}
    </button>
  )
}
