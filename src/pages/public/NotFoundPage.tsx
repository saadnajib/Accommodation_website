import { Link } from 'react-router-dom'
import { ArrowLeft, Compass, Home, HelpCircle, Search } from 'lucide-react'

export default function NotFoundPage() {
  return (
    <div className="container-x flex min-h-[70vh] flex-col items-center justify-center py-16 text-center animate-fade-up">
      <span className="grid h-16 w-16 place-items-center rounded-2xl bg-brand-50 text-brand-700"><Compass className="h-8 w-8" /></span>
      <p className="mt-6 font-display text-7xl font-bold text-brand-700 sm:text-8xl">404</p>
      <h1 className="mt-2 text-2xl font-bold text-ink-900 sm:text-3xl">This page has moved out</h1>
      <p className="mt-3 max-w-md text-ink-500">We couldn’t find what you were looking for. It may have been removed, or the link might be mistyped.</p>
      <div className="mt-8 grid w-full max-w-xl gap-3 sm:grid-cols-3">
        {[
          { to: '/', label: 'Home', icon: Home },
          { to: '/listings', label: 'Find a home', icon: Search },
          { to: '/how-it-works', label: 'How it works', icon: HelpCircle },
        ].map((l) => (
          <Link key={l.to} to={l.to} className="flex items-center justify-center gap-2 rounded-xl border border-ink-200 bg-white px-4 py-3 text-sm font-semibold text-ink-700 shadow-card transition-all hover:-translate-y-0.5 hover:text-brand-800 hover:shadow-lift">
            <l.icon className="h-4 w-4" /> {l.label}
          </Link>
        ))}
      </div>
      <button onClick={() => window.history.back()} className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-ink-500 hover:text-ink-900"><ArrowLeft className="h-4 w-4" /> Go back</button>
    </div>
  )
}
