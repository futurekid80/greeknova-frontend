'use client'
import Link from 'next/link'
import { useState, useRef, useEffect } from 'react'
import { ChevronDown, MessageSquare, X, Bell, LogOut, User } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const NAV_GROUPS = [
  {
    label: 'Market',
    links: [
      { href: '/',           label: '📡 Market Pulse' },
      { href: '/watchlist',  label: 'Watchlist' },
      { href: '/journal',    label: '📓 Journal' },
      { href: '/participant-flow', label: '🏦 Participant Flow' }
    ]
  },
  {
    label: 'OI Analysis',
    links: [
      { href: '/charts',     label: 'OI Charts' },
      { href: '/oihistory',  label: 'OI History' },
      { href: '/eod',        label: 'EOD Analysis' },
      { href: '/pcr',        label: 'PCR Trend' },
      { href: '/oiprofile',  label: '📊 OI Profile' },
      { href: '/oiheatmap',  label: '🌡️ OI Heatmap' },
    ]
  },
  {
    label: 'Greeks',
    links: [
      { href: '/optionchain', label: 'Option Chain' },
      { href: '/maxpain',     label: 'Max Pain' },
      { href: '/iv',          label: 'IV Analysis' },
    ]
  },
  {
    
    label: 'Signals',
    links: [
      { href: '/rs',          label: 'Rel. Strength' },
      { href: '/uoa',         label: 'UOA' },
      { href: '/jungle',      label: '🌿 Options Jungle' },
      { href: '/positional',  label: '🧠 Positional Intelligence' },
      { href: '/signals/intraday', label: '📋 Intraday Log' },
      { href: '/signals/cpr', label: '📐 CPR Scanner' },
      { href: '/signals/wall-migration', label: '🧱 Wall Migration' }
    ]
  },
]

const STANDALONE = [
  { href: '/alerts', label: 'Alerts' },
]

function DropdownMenu({ group, active }: { group: typeof NAV_GROUPS[0], active: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const isActive = group.links.some(l =>
    l.href === '/' ? active === '/' : active.startsWith(l.href)
  )

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
        <div className="absolute top-full left-0 mt-3 w-48 bg-gray-950 border border-gray-800 rounded-xl shadow-2xl overflow-hidden z-50">
          <div className="py-1">
            {group.links.map(({ href, label }) => {
              const isLinkActive = href === '/' ? active === '/' : active.startsWith(href)
              return (
                <Link key={href} href={href} onClick={() => setOpen(false)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm transition-colors ${
                    isLinkActive
                      ? 'text-white bg-gray-800/60 font-semibold'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800/40'
                  }`}>
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isLinkActive ? 'bg-emerald-400' : ''}`} />
                  {label}
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Feedback Modal ───────────────────────────────────────────────────────────
function FeedbackModal({ onClose }: { onClose: () => void }) {
  const pathname = usePathname()
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [email, setEmail] = useState('')

  useEffect(() => {
    async function getEmail() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user?.email) setEmail(session.user.email)
    }
    getEmail()
  }, [])

  async function handleSubmit() {
    if (!message.trim()) return
    setLoading(true)
    await supabase.from('feedback').insert({
      email: email || 'anonymous',
      page: pathname,
      message: message.trim(),
    })
    setLoading(false)
    setDone(true)
    setTimeout(() => onClose(), 2000)
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-white font-bold text-base">Share Feedback</h3>
            <p className="text-gray-500 text-xs mt-0.5">Page: {pathname}</p>
          </div>
          <button onClick={onClose} className="text-gray-600 hover:text-white transition-colors"><X size={18} /></button>
        </div>
        {!done ? (
          <>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="What's broken, confusing, or missing? Be as specific as you like..."
              rows={5}
              className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 resize-none mb-4 placeholder:text-gray-600"
            />
            <button
              onClick={handleSubmit}
              disabled={loading || !message.trim()}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl text-sm transition">
              {loading ? 'Sending...' : 'Send Feedback →'}
            </button>
          </>
        ) : (
          <div className="text-center py-6">
            <div className="text-3xl mb-3">🙏</div>
            <p className="text-white font-semibold">Thank you!</p>
            <p className="text-gray-400 text-sm mt-1">Your feedback has been received.</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Bell notification badge ──────────────────────────────────────────────────
function BellBadge() {
  const [unread, setUnread] = useState(0)
  const pathname = usePathname()

  useEffect(() => {
    function countUnread() {
      try {
        const saved = localStorage.getItem('gn_alerts')
        if (!saved) { setUnread(0); return }
        const alerts = JSON.parse(saved)
        const lastRead = Number(localStorage.getItem('gn_alerts_last_read') || 0)
        const count = alerts.filter((a: any) => a.id > lastRead).length
        setUnread(count)
      } catch { setUnread(0) }
    }

    countUnread()

    if (pathname === '/alerts') {
      try {
        const saved = localStorage.getItem('gn_alerts')
        if (saved) {
          const alerts = JSON.parse(saved)
          if (alerts.length > 0) {
            localStorage.setItem('gn_alerts_last_read', String(alerts[0].id))
          }
        }
      } catch {}
      setUnread(0)
    }

    const bc = new BroadcastChannel('gn_alerts')
    bc.onmessage = () => {
      if (pathname !== '/alerts') setUnread(p => p + 1)
    }

    const t = setInterval(countUnread, 30000)
    return () => { bc.close(); clearInterval(t) }
  }, [pathname])

  return (
    <Link href="/alerts" className="relative flex items-center justify-center w-8 h-8 rounded-lg hover:bg-gray-800 transition-colors">
      <Bell size={16} className={unread > 0 ? 'text-emerald-400' : 'text-gray-500'} />
      {unread > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </Link>
  )
}

// ─── User Menu (shows email + logout) ────────────────────────────────────────
function UserMenu() {
  const [email, setEmail]   = useState('')
  const [open, setOpen]     = useState(false)
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email) setEmail(session.user.email)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setEmail(session?.user?.email || '')
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function handleLogout() {
    setLoading(true)
    await supabase.auth.signOut()
    setEmail('')
    setOpen(false)
    setLoading(false)
    router.push('/')
  }

  if (!email) return null

  const displayName = email.split('@')[0]

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 hover:text-white text-xs font-medium rounded-lg transition-all">
        <User size={12} className="text-emerald-400"/>
        <span className="max-w-[100px] truncate">{displayName}</span>
        <ChevronDown size={11} className={`transition-transform ${open ? 'rotate-180' : ''}`}/>
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 w-56 bg-gray-950 border border-gray-800 rounded-xl shadow-2xl overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-gray-800">
            <p className="text-xs text-gray-500 mb-0.5">Logged in as</p>
            <p className="text-xs text-white font-semibold truncate">{email}</p>
          </div>
          <Link href="/journal" onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-400 hover:text-white hover:bg-gray-800/40 transition-colors">
            <span>📓</span> My Journal
          </Link>
          <button
            onClick={handleLogout}
            disabled={loading}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-950/20 transition-colors border-t border-gray-800">
            <LogOut size={14}/>
            {loading ? 'Signing out...' : 'Sign Out'}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Navbar ───────────────────────────────────────────────────────────────────
export default function Navbar({ active: activeProp }: { active?: string }) {
  const pathname = usePathname()
  const active = pathname || activeProp || '/'
  const [feedbackOpen, setFeedbackOpen] = useState(false)

  return (
    <>
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
                className={`text-sm font-medium transition-colors relative ${
                  active === href ? 'text-white' : 'text-gray-400 hover:text-white'
                }`}>
                {label}
                {active === href && <span className="absolute -bottom-[17px] left-0 right-0 h-0.5 bg-emerald-500 rounded-full" />}
              </Link>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <BellBadge />
            <button
              onClick={() => setFeedbackOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 hover:text-white text-xs font-medium rounded-lg transition-all">
              <MessageSquare size={13} />
              Feedback
            </button>
            <UserMenu />
          </div>
        </div>
      </nav>

      <div className="w-full bg-amber-950/40 border-b border-amber-800/30 px-6 py-1.5 text-center">
        <p className="text-[11px] text-amber-600/80">
          ⚠️ GreekNova is for <strong>informational and educational purposes only</strong>.
          Not SEBI registered. Not investment advice. Always consult a SEBI-registered advisor before trading.{' '}
          <a href="/disclaimer" className="underline hover:text-amber-400 transition-colors">Full Disclaimer & Terms</a>
        </p>
      </div>

      {feedbackOpen && <FeedbackModal onClose={() => setFeedbackOpen(false)} />}
    </>
  )
}
