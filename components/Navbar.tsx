'use client'
import Link from 'next/link'

const NAV_LINKS = [
  { href: '/',            label: 'Dashboard' },
  { href: '/premarket',   label: 'Pre-Market' },
  { href: '/watchlist',   label: 'Watchlist' },
  { href: '/scanners',    label: 'Scanners' },
  { href: '/charts',      label: 'OI Charts' },
  { href: '/oihistory',   label: 'OI History' },
  { href: '/optionchain', label: 'Option Chain' },
  { href: '/pcr',         label: 'PCR Trend' },
  { href: '/spikes',      label: 'OI Spikes' },
  { href: '/volume',      label: 'Vol Spikes' },
  { href: '/uoa',         label: 'UOA' },
  { href: '/confluence',  label: 'Confluence' },
  { href: '/maxpain',     label: 'Max Pain' },
  { href: '/alerts',      label: 'Alerts' },
]

export default function Navbar({ active }: { active: string }) {
  return (
    <nav className="sticky top-0 z-50 border-b border-gray-800/50 bg-[#07070e]/90 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-600 flex items-center justify-center">
            <span className="text-xs font-black text-white">GN</span>
          </div>
          <span className="font-black text-white text-base">GreekNova</span>
          <span className="ml-1 text-xs font-medium px-1.5 py-0.5 bg-emerald-950 text-emerald-500 border border-emerald-800/50 rounded-md">BETA</span>
        </Link>
        <div className="flex items-center gap-4 overflow-x-auto ml-6" style={{ scrollbarWidth: 'none' }}>
          {NAV_LINKS.map(({ href, label }) => (
            <Link key={href} href={href}
              className={`text-sm whitespace-nowrap transition-colors ${
                active === href
                  ? 'font-semibold text-white border-b border-emerald-500 pb-0.5'
                  : 'text-gray-400 hover:text-white'
              }`}>
              {label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  )
}
