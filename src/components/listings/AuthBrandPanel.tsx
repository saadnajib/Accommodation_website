import type { LucideIcon } from 'lucide-react'
import { Logo } from '@/components/layout/Navbar'

const IMG = 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=70'

/** Decorative right-hand panel for login / signup (hidden below lg). */
export function AuthBrandPanel({ title, points }: { title: string; points: Array<{ icon: LucideIcon; text: string }> }) {
  return (
    <div className="relative hidden overflow-hidden bg-brand-800 lg:block">
      <img src={IMG} alt="" aria-hidden loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-25 mix-blend-luminosity" />
      <div className="absolute inset-0 bg-gradient-to-br from-brand-900/90 via-brand-800/80 to-brand-700/70" />
      <div className="relative flex h-full flex-col justify-between p-12 text-white">
        <Logo light />
        <div>
          <h2 className="text-4xl font-bold leading-tight">{title}</h2>
          <ul className="mt-8 space-y-4">
            {points.map((p) => (
              <li key={p.text} className="flex items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/10"><p.icon className="h-4 w-4 text-accent-400" /></span>
                <span className="text-white/85">{p.text}</span>
              </li>
            ))}
          </ul>
        </div>
        <blockquote className="rounded-2xl bg-white/10 p-5 text-sm text-white/85 backdrop-blur">
          “The only rental platform where I never had to chase anyone. They verified me once and handled the rest.”
          <footer className="mt-2 text-xs font-semibold text-white/60">— Lena K., renter in Milan</footer>
        </blockquote>
      </div>
    </div>
  )
}
