'use client'
import Link from 'next/link'
import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'

const NAV_GROUPS = [
  {
    label: 'Market',
    links: [
      { href: '/',           label: 'Dashboard' },
      { href: '/premarket',  label: 'Pre-Market' },
      { href: '/watchlist',  label: 'Watchlist' },
    ]
  },
  {
    label: 'OI Analysis',
    links: [
      { href: '/charts',     label: 'OI Charts' },
      { href: '/oihistory',  label: 'OI History' },
      { href: '/oipulse',    label: 'OI Pulse' },
      { href: '/eod',        label: 'EOD Analysis' },
      { href: '/spikes',     label: 'OI Spikes' },
      { href: '/pcr',        label: 'PCR Trend' },
    ]
  },
  {
    label: 'Greeks',
    links: [
      { href: '/optionchain',label: 'Option Chain' },
      { href: '/maxpain',    label: 'Max Pain' },
    ]
  },
  {
    label: 'Signals',
    links: [
      { href: '/scanners',   label: 'Scanners' },
      { href: '/confluence', label: 'Confluence' },
      { href: '/uoa',        label: 'UOA' },
      { href: '/volume',     label: 'Vol Spikes' },
    ]
  },
]

const STANDALONE = [
  { href: '/alerts', label: 'Alerts' },
]

function DropdownMenu({ group, active }: { group: typeof NAV_GROUPS[0], active: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const isActive = group.links.some(l => l.href === active)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1 text-sm font-medium transition-colors px-1 py-0.5 rounded ${
          isActive ? 'text-white' : 'text-gray-400 hover:text-white'
        }`}>
        {group.label}
        <ChevronDown size={13} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        {isActive && <span className="absolute -bottom-[17px] left-0 right-0 h-0.5 bg-emerald-500 rounded-full" />}
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-3 w-44 bg-gray-950 border border-gray-800 rounded-xl shadow-2xl overflow-hidden z-50">
          <div className="py-1">
            {group.links.map(({ href, label }) => (
              <Link key={href} href={href} onClick={() => setOpen(false)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm transition-colors ${
                  active === href
                    ? 'text-white bg-gray-800/60 font-semibold'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/40'
                }`}>
                {active === href && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />}
                {active !== href && <span className="w-1.5 h-1.5 shrink-0" />}
                {label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function Navbar({ active }: { active: string }) {
  return (
    <nav className="sticky top-0 z-50 border-b border-gray-800/50 bg-[#07070e]/90 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center gap-8">
        <Link href="/" className="flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-600 flex items-center justify-center">
            <span className="text-xs font-black text-white">GN</span>
          </div>
          <span className="font-black text-white text-base">GreekNova</span>
          <span className="text-xs font-medium px-1.5 py-0.5 bg-emerald-950 text-emerald-500 border border-emerald-800/50 rounded-md">BETA</span>
        </Link>

        <div className="flex items-center gap-6">
          {NAV_GROUPS.map(group => (
            <DropdownMenu key={group.label} group={group} active={active} />
          ))}
          {STANDALONE.map(({ href, label }) => (
            <Link key={href} href={href}
              className={`text-sm font-medium transition-colors ${
                active === href ? 'text-white border-b border-emerald-500 pb-0.5' : 'text-gray-400 hover:text-white'
              }`}>
              {label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  )
}
