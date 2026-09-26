import { useState } from 'react'
import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

const LABELS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent']

/** Clickable 1–5 star rating input. */
export function RatingInput({ value, onChange, label = 'Rating' }: { value: number; onChange: (v: number) => void; label?: string }) {
  const [hover, setHover] = useState(0)
  const shown = hover || value
  return (
    <div className="flex items-center gap-3">
      <div role="radiogroup" aria-label={label} className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((i) => (
          <button key={i} type="button" role="radio" aria-checked={value === i} aria-label={`${i} star${i > 1 ? 's' : ''}`}
            onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(0)} onClick={() => onChange(i)}
            className="rounded-md p-0.5 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
            <Star className={cn('h-7 w-7 transition-colors', i <= shown ? 'fill-amber-400 text-amber-400' : 'text-ink-200')} />
          </button>
        ))}
      </div>
      <span className="text-sm font-medium text-ink-500">{LABELS[shown]}</span>
    </div>
  )
}
