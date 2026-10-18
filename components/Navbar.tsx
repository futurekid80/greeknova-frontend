'use client'
import Link from 'next/link'
import { useState, useRef, useEffect } from 'react'
import { ChevronDown, MessageSquare, X, Bell, LogOut, User } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { supabase, getSessionCached, withTimeout } from '@/lib/supabase'
import { clearCachedMarketData } from '@/lib/authFetch'
import VixGauge from '@/components/VixGauge'

// Oct 2 2026: regrouped by trader persona (Positional / Intraday / Option
// Sellers) instead of by data-type (Market / OI Analysis / Greeks / Signals)
// ahead of launch -- same screens, same URLs, nothing merged or removed, just
// organized around "which kind of trader are you" so the nav reads as a
// decision tool instead of a feature list. Each group's first link is that
// persona's hero/landing screen. The Greeks suite (Gamma/Theta/Vega/Premium
// Screen) stays fully separate under Option Sellers per Manish's call --
// that's GreekNova's differentiated depth, not something to blend together.
//
// Oct 12 2026: added a cross-cutting "Open Interest" group on top of the
// persona grouping, per live user feedback (vinu1smile) -- OI data is
// something every persona reaches for (an intraday scalper, a positional
// swing trader and a seller all read OI build/unwind), so it kept getting
// hunted for across three different menus. Same precedent as the Oct 2
// regroup: nothing moved or removed, these links are the exact same pages
// (same hrefs) as they already appear under Positional/Intraday/Option
// Sellers above -- this is a second, OI-specific front door to them, not a
// replacement for the persona grouping.
//
// Oct 16 2026: same precedent again for a cross-cutting "Scanners" group --
// per Manish, scanners (the ATM Option Scanner, and now Wolves alongside
// it) were landing wherever their persona happened to put them, with no
// single place to see "every scanner GreekNova has" at a glance. This
// groups every scanner-type page (ATM Option Scanner, Wolves, Custom
// Scanner, CPR, Intraday Futures, Options Jungle, Wall Migration, First
// Hour Breakout, Spike/Volume/Spot Volume/Vacuum/Trend Ignition) into one
// dropdown. Same rule as Open Interest above: nothing moved or removed,
// these are the same pages at the same hrefs as wherever they already
// live -- this is a second front door, not a replacement.
const NAV_GROUPS = [
  {
    label: '🔎 Scanners',
    links: [
      // Oct 18 2026: ATM Option Scanner (/scanners), Spike Scanner (/spikes) and
      // Vacuum Scanner (/vacuum) hidden from nav discovery per Manish -- not retired,
      // pages/backend untouched, just not surfaced here anymore (not actively used).
      { href: '/wolves',      label: '🐺 Wolves Scanner' },
      { href: '/custom-scanner', label: '🎯 Custom Scanner' },
      { href: '/signals/cpr', label: '📐 CPR Scanner' },
      { href: '/signals/intraday', label: '📋 Intraday Futures Scanner' },
      { href: '/jungle',      label: '🌿 Options Jungle' },
      { href: '/signals/wall-migration', label: '🧱 Wall Migration' },
      { href: '/first-hour-breakout', label: '🌅 First Hour Breakout' },
      { href: '/volume',      label: '📊 Volume Scanner' },
      { href: '/spotvolume',  label: '⚡ Spot Volume Breakout' },
    ]
  },
  {
    label: 'Market',
    links: [
      { href: '/',           label: '📡 Market Pulse' },
      { href: '/watchlist',  label: 'Watchlist' },
      { href: '/journal',    label: '📓 Journal' },
      // Defaults to NIFTY since this is a fixed nav link (no symbol
      // context) -- the page itself lets you switch symbol via the URL,
      // and the homepage's Stock Command Centre search links to a
      // specific symbol's chart directly.
      { href: '/stock-chart/NIFTY', label: '📈 Price Chart' },
    ]
  },
  {
    label: '📊 Open Interest',
    links: [
      { href: '/oiprofile',  label: '📊 OI Profile' },
      { href: '/oihistory',  label: '🕑 OI History' },
      { href: '/oi-buildup-period', label: '📅 Weekly/Monthly OI Buildup' },
      { href: '/oiheatmap',  label: '🌡️ OI Heatmap' },
      { href: '/jungle',      label: '🌿 Options Jungle' },
      { href: '/uoa',         label: '🔎 UOA' },
      { href: '/custom-scanner', label: '🎯 Custom Scanner' },
      { href: '/signals/wall-migration', label: '🧱 Wall Migration' },
      { href: '/maxpain',     label: '🎯 Max Pain' },
    ]
  },
  {
    label: '🎯 Positional',
    links: [
      { href: '/positional',  label: '🧠 Positional Intelligence' },
      { href: '/oi-buildup-period', label: '📊 Weekly/Monthly OI Buildup' },
      { href: '/rollover', label: '🔄 Rollover Tracker' },
      { href: '/delivery-confluence', label: '📦 Delivery Confluence' },
      { href: '/participant-flow', label: '🏦 Participant Flow' },
      { href: '/sector-strength', label: '🔥 Sector Strength' },
      { href: '/rs',          label: 'Rel. Strength' },
      { href: '/signals/wall-migration', label: '🧱 Wall Migration' },
      { href: '/oihistory',  label: 'OI History' },
      { href: '/eod',        label: 'EOD Analysis' },
      { href: '/eod-report', label: '📋 EOD Report' },
    ]
  },
  {
    label: '⚡ Intraday',
    links: [
      { href: '/jungle',      label: '🌿 Options Jungle' },
      { href: '/custom-scanner', label: '🎯 Custom Scanner' },
      { href: '/premarket',  label: '☀️ Pre-Market Brief' },
      { href: '/uoa',         label: 'UOA' },
      { href: '/spotvolume', label: '⚡ Spot Volume Breakout' },
      { href: '/first-hour-breakout', label: '🌅 First Hour Breakout' },
      { href: '/signals/cpr', label: '📐 CPR Scanner' },
      { href: '/signals/intraday', label: '📋 Intraday Log' },
    ]
  },
  {
    label: '🧭 Option Sellers',
    links: [
      { href: '/seller-screen', label: '🧭 Premium Screen' },
      { href: '/straddle-chart', label: '🍲 Straddle Chart' },
      { href: '/gamma-squeeze', label: '⚡ Gamma Squeeze' },
      { href: '/session-replay', label: '⏮️ Session Replay' },
      { href: '/theta', label: 'Θ Theta Decay' },
      { href: '/vega', label: 'ν Vega Exposure' },
      { href: '/iv',          label: 'IV Analysis' },
      { href: '/maxpain',     label: 'Max Pain' },
      { href: '/pcr',        label: 'PCR Trend' },
      { href: '/oiprofile',  label: '📊 OI Profile' },
      { href: '/oiheatmap',  label: '🌡️ OI Heatmap' },
      { href: '/optionchain', label: 'Option Chain' },
      { href: '/historicalchain', label: '🕰️ Historical Chain' },
      { href: '/strategy-builder', label: '🛠️ Strategy Builder' },
    ]
  },
]

const STANDALONE = [
  { href: '/vix', label: '😨 VIX' },
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
        className={`flex items-center gap-1 text-sm font-medium transition-colors px-1 py-0.5 rounded whitespace-nowrap ${
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
      try {
        const { data: { session } } = await getSessionCached()
        if (session?.user?.email) setEmail(session.user.email)
      } catch {
        // falls back to 'anonymous' on submit below
      }
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
  const loggedActivityRef = useRef(false)

  useEffect(() => {
    // Oct 15 2026: getSessionCached() can reject on a one-off cross-tab
    // lock race (see lib/supabase.ts) -- retry once so the email in this
    // dropdown doesn't silently stay blank for this mount.
    getSessionCached().catch(() => getSessionCached()).then(({ data: { session } }) => {
      if (session?.user?.email) setEmail(session.user.email)
      if (session?.user && !loggedActivityRef.current) {
        loggedActivityRef.current = true
        supabase.rpc('log_activity').then(({ error }) => {
          if (error) console.warn('log_activity failed:', error.message)
        })
      }
    }).catch(() => {})
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setEmail(session?.user?.email || '')
      if (session?.user && !loggedActivityRef.current) {
        loggedActivityRef.current = true
        supabase.rpc('log_activity').then(({ error }) => {
          if (error) console.warn('log_activity failed:', error.message)
        })
      }
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
    // Oct 14 2026: clear cached market data (CPR/breadth) before signing out
    // and send straight to /login with a full reload, not a client-side
    // route change to '/' -- a route change remounts the homepage while the
    // signOut() is still settling, which could flash leftover cached data
    // for a moment before its own auth check catches up. A full navigation
    // to /login never mounts a data page at all.
    clearCachedMarketData()
    await supabase.auth.signOut()
    setEmail('')
    setOpen(false)
    setLoading(false)
    window.location.href = '/login'
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

// Oct 15 2026: a user asked to get the old full menu back rather than
// hunting through /dashboard -- rather than re-litigate Oct 14's call,
// make it a per-user choice. Reuses the dashboard_prefs table (same one
// /dashboard writes widget on/off to) with a reserved widget_key so no
// migration is needed; synced via Supabase like every other dashboard
// preference, so it follows the person across devices rather than being
// stuck to one browser.
const CLASSIC_NAV_PREF_KEY = '__classic_nav__'

function useClassicNavPref() {
  const [classicNav, setClassicNav] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      // Oct 15 2026: Navbar remounts on every page navigation (it's
      // rendered per-page, not in a shared layout), so this effect -- and
      // this getSessionCached() call -- reruns on every single page
      // change. Before the fix in lib/supabase.ts, one rejected
      // getSessionCached() call anywhere (two app.greeknova.com tabs open
      // at once is enough to trigger it) permanently poisoned the shared
      // cache, which meant EVERY later page's load() here also threw and
      // never reached setClassicNav/setLoaded -- classicNav silently fell
      // back to its false default on every navigation, i.e. exactly "even
      // when I click classic menu, it doesn't sustain unless I click it
      // every time." The lib/supabase.ts fix stops the permanent
      // poisoning; this retry handles the one-off rejection itself rather
      // than leaving the preference stuck at its default for this page.
      let session
      try {
        ({ data: { session } } = await getSessionCached())
      } catch {
        try {
          ({ data: { session } } = await getSessionCached())
        } catch {
          if (!cancelled) setLoaded(true)
          return
        }
      }
      if (!session) { if (!cancelled) setLoaded(true); return }
      try {
        // Oct 15 2026: this query makes its own, separate getSession() call
        // inside the Supabase client (for the REST auth header) -- a second
        // lock acquisition the retry above can't protect against. Confirmed
        // live this is what was actually still hanging after the
        // lib/supabase.ts fix: the dashboard_prefs request never even fired.
        const { data, error } = await withTimeout(
          supabase
            .from('dashboard_prefs')
            .select('enabled')
            .eq('user_id', session.user.id)
            .eq('widget_key', CLASSIC_NAV_PREF_KEY)
            .maybeSingle(),
          4000
        )
        if (!cancelled && !error && data) setClassicNav(!!data.enabled)
      } catch {
        // fall through to default
      }
      if (!cancelled) setLoaded(true)
    }
    load()
    const { data: sub } = supabase.auth.onAuthStateChange(() => load())
    return () => { cancelled = true; sub.subscription.unsubscribe() }
  }, [])

  async function toggle() {
    const next = !classicNav
    setClassicNav(next)
    let session
    try {
      ({ data: { session } } = await getSessionCached())
    } catch {
      try {
        ({ data: { session } } = await getSessionCached())
      } catch {
        return
      }
    }
    if (!session) return
    try {
      await withTimeout(
        supabase
          .from('dashboard_prefs')
          .upsert(
            { user_id: session.user.id, widget_key: CLASSIC_NAV_PREF_KEY, enabled: next, updated_at: new Date().toISOString() },
            { onConflict: 'user_id,widget_key' }
          ),
        4000
      )
    } catch {
      // local toggle already applied -- worst case this one save doesn't
      // stick server-side and the next page load falls back to default
    }
  }

  return { classicNav, loaded, toggle }
}

// ─── Navbar ───────────────────────────────────────────────────────────────────
export default function Navbar({ active: activeProp }: { active?: string }) {
  const pathname = usePathname()
  const active = pathname || activeProp || '/'
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const { classicNav, toggle: toggleClassicNav } = useClassicNavPref()

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
            {/* Oct 14 2026: new consolidated entry point (see lib/widgetRegistry.ts
                and app/dashboard/page.tsx) -- deliberately placed first/most
                prominent. Every link below still works exactly as before;
                this doesn't replace or remove any of them, it's a second,
                customizable front door. */}
            <Link href="/dashboard"
              className={`text-sm font-semibold transition-colors relative ${
                active === '/dashboard' ? 'text-white' : 'text-emerald-400 hover:text-emerald-300'
              }`}>
              🏠 Dashboard
              {active === '/dashboard' && <span className="absolute -bottom-[17px] left-0 right-0 h-0.5 bg-emerald-500 rounded-full" />}
            </Link>
            {/* Oct 14 2026: the old 5-dropdown persona/OI nav (Market, Open
                Interest, Positional, Intraday, Option Sellers -- NAV_GROUPS
                below) and the standalone VIX/Alerts text links (STANDALONE
                below) were retired from here by default now that /dashboard
                exists and covers the same ground without the duplication
                Manish flagged (same page showing both the old full menu and
                the new hub at once). Every one of those pages is still
                reachable -- from /dashboard directly if its tile is on, or
                via Customize there to turn it on.
                Oct 15 2026: made this a per-user choice (see
                useClassicNavPref above) instead of an all-or-nothing call --
                someone who prefers hunting through a full menu can switch
                back to it here, everyone else keeps the consolidated hub. */}
            {classicNav && (
              <>
                {NAV_GROUPS.map((group) => (
                  <DropdownMenu key={group.label} group={group} active={active} />
                ))}
                {STANDALONE.map(({ href, label }) => (
                  <Link key={href} href={href}
                    className={`text-sm font-medium transition-colors whitespace-nowrap relative ${
                      active.startsWith(href) ? 'text-white' : 'text-gray-400 hover:text-white'
                    }`}>
                    {label}
                    {active.startsWith(href) && <span className="absolute -bottom-[17px] left-0 right-0 h-0.5 bg-emerald-500 rounded-full" />}
                  </Link>
                ))}
              </>
            )}
            <button
              onClick={toggleClassicNav}
              title={classicNav ? 'Switch to the consolidated Dashboard menu' : 'Switch to the old full dropdown menu'}
              className="text-xs font-medium text-gray-600 hover:text-gray-300 transition-colors whitespace-nowrap">
              {classicNav ? '✕ Classic menu' : '☰ Classic menu'}
            </button>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <VixGauge />
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
