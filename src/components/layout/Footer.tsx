import { Link } from 'react-router-dom'
import { Logo } from './Navbar'

export function Footer() {
  return (
    <footer className="border-t border-ink-200 bg-white">
      <div className="container-x grid gap-8 py-12 md:grid-cols-4">
        <div className="md:col-span-1">
          <Logo />
          <p className="mt-3 max-w-xs text-sm text-ink-500">Verified renters, vetted homes, and a human in the middle of every deal.</p>
        </div>
        <FooterCol title="Renters" links={[['Find a home', '/listings'], ['How it works', '/how-it-works'], ['Tenant Pass', '/pricing'], ['My dashboard', '/dashboard']]} />
        <FooterCol title="Owners" links={[['List your place', '/owner/listings/new'], ['For owners', '/owners'], ['Pricing', '/pricing'], ['Owner dashboard', '/owner']]} />
        <FooterCol title="Company" links={[['About', '/how-it-works'], ['Trust & safety', '/how-it-works#trust'], ['Terms', '/how-it-works#terms'], ['Contact', 'mailto:hello@staybridge.demo']]} />
      </div>
      <div className="border-t border-ink-100">
        <div className="container-x flex flex-col items-center justify-between gap-2 py-5 text-xs text-ink-400 sm:flex-row">
          <p>© {new Date().getFullYear()} StayBridge. All rights reserved.</p>
          <p>Made with care for renters and owners.</p>
        </div>
      </div>
    </footer>
  )
}

function FooterCol({ title, links }: { title: string; links: Array<[string, string]> }) {
  return (
    <div>
      <p className="text-sm font-semibold text-ink-900">{title}</p>
      <ul className="mt-3 space-y-2">
        {links.map(([label, to]) => (
          <li key={label}>
            {to.startsWith('mailto:') ? <a href={to} className="text-sm text-ink-500 hover:text-brand-700">{label}</a> : <Link to={to} className="text-sm text-ink-500 hover:text-brand-700">{label}</Link>}
          </li>
        ))}
      </ul>
    </div>
  )
}
