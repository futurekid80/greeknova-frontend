'use client'
import Navbar from '@/components/Navbar'
import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, Zap, Search, Download } from 'lucide-react'
import StrikeZoneFilter from '@/components/StrikeZoneFilter'

const API = 'https://api.greeknova.com'

// Same canonical index list used across Jungle/OI Profile/PCR/Strike History etc.
const INDICES = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY', 'SENSEX']
const PAGE_SIZE = 20

interface StealthHit {
  symbol: string
  is_confluence: boolean
  strike: number
  expiry: string | null
  option_type: 'CE' | 'PE'
  strikes_away: number | null
  cmp: number | null
  atm_strike: number | null
  tier: 'ELITE' | 'STRONG' | 'WATCH'
  tier_label: string
  oi_pct: number
  old_oi: number
  new_oi: number
  premium_pct: number
  old_premium: number
  new_premium: number
  // Oct 31 2026: Writing vs Buying label + fields from the saved-hits log
  activity?: 'WRITING' | 'BUYING' | 'NEUTRAL'
  activity_label?: string
  freshness?: 'Fresh Now' | 'Still Active' | 'Seen Earlier Today'
  first_seen?: string
  last_seen?: string
  times_seen?: number
  peak_oi_pct?: number
}

interface ScanResult {
  date?: string
  ts_new?: string
  ts_old?: string
  total?: number
  confluence_count?: number
  hits?: StealthHit[]
  error?: string
  window?: string
  window_label?: string
  tiers?: [string, number, number][]  // [tier, min_oi_pct, max_premium_pct] -- drives the legend text per window
}

const WINDOW_OPTIONS: { value: string; label: string }[] = [
  { value: '5min', label: '5-min' },
  { value: 'hourly', label: 'Hourly' },
  { value: 'eod', label: 'EOD / vs prev close' },
]

const ACTIVITY_STYLE: Record<string, string> = {
  WRITING: 'text-rose-300 border-rose-700/50 bg-rose-950/30',
  BUYING:  'text-teal-300 border-teal-700/50 bg-teal-950/30',
  NEUTRAL: 'text-gray-300 border-gray-600 bg-gray-800/40',
}

const FRESH_STYLE: Record<string, string> = {
  'Fresh Now':          'text-lime-300 border-lime-700/60 bg-lime-950/30',
  'Still Active':       'text-cyan-300 border-cyan-700/60 bg-cyan-950/30',
  'Seen Earlier Today': 'text-gray-400 border-gray-700 bg-gray-800/40',
}

const TIER_STYLE: Record<string, string> = {
  ELITE:  'text-amber-400 border-amber-700/50 bg-amber-950/20',
  STRONG: 'text-emerald-400 border-emerald-700/50 bg-emerald-950/20',
  WATCH:  'text-sky-400 border-sky-700/50 bg-sky-950/20',
}

function fmtOI(n: number) {
  if (Math.abs(n) >= 10000000) return `${(n / 10000000).toFixed(1)}Cr`
  if (Math.abs(n) >= 100000) return `${(n / 100000).toFixed(1)}L`
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(0)}K`
  return n.toLocaleString()
}

function fmtExpiry(expiry: string | null) {
  if (!expiry) return null
  try {
    return new Date(expiry + 'T00:00:00').toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short',
    })
  } catch { return expiry }
}

function fmtDateTime(ts?: string) {
  if (!ts) return '—'
  try {
    return new Date(ts).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true,
    })
  } catch { return ts }
}

function fmtTime(ts?: string) {
  if (!ts) return '—'
  try {
    return new Date(ts).toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', hour12: true,
    })
  } catch { return ts }
}

// (Oct 27 2026, Manish's ask): export whatever's currently filtered -- not
// just the visible/capped rows -- so he can mark up / sort in Excel for his
// own EOD analysis. Pure client-side, no backend round-trip: builds a CSV
// Blob from the hits array already in hand and triggers a normal browser
// download via a throwaway anchor tag.
function downloadHitsCSV(hits: StealthHit[], window: string, zone: string, view: string = 'live') {
  if (hits.length === 0) return
  const cols: (keyof StealthHit)[] = [
    'symbol', 'strike', 'option_type', 'expiry', 'strikes_away', 'atm_strike',
    'tier', 'activity_label', 'is_confluence', 'oi_pct', 'old_oi', 'new_oi',
    'premium_pct', 'old_premium', 'new_premium', 'cmp',
    'freshness', 'first_seen', 'last_seen', 'times_seen', 'peak_oi_pct',
  ]
  const header = ['Symbol', 'Strike', 'Type', 'Expiry', 'StrikesAway', 'ATMStrike', 'Tier', 'Activity', 'Confluence', 'OI%', 'OldOI', 'NewOI', 'Premium%', 'OldPremium', 'NewPremium', 'CMP', 'Freshness', 'FirstSeen', 'LastSeen', 'TimesSeen', 'PeakOI%']
  const escapeCsv = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const rows = hits.map(h => cols.map(c => escapeCsv(h[c])).join(','))
  const csv = [header.join(','), ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const today = new Date().toISOString().slice(0, 10)
  a.href = url
  a.download = `strike-stealth_${view}_${window}_zone${zone}_${today}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export default function StrikeStealthBuildup() {
  const [data, setData] = useState<ScanResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [tierFilter, setTierFilter] = useState<'all' | 'ELITE' | 'STRONG' | 'WATCH'>('all')
  const [confluenceOnly, setConfluenceOnly] = useState(false)
  // (Oct 27 2026, Manish's ask): extra client-side filters so the list stays
  // scannable without endless scrolling -- these slice the already-fetched
  // `hits` array, no extra round-trip to the backend.
  const [instrumentFilter, setInstrumentFilter] = useState<'all' | 'index' | 'stocks'>('all')
  const [optionTypeFilter, setOptionTypeFilter] = useState<'all' | 'CE' | 'PE'>('all')
  const [expiryFilter, setExpiryFilter] = useState<'all' | string>('all')
  const [search, setSearch] = useState('')
  const [showAll, setShowAll] = useState(false)
  // (Oct 27 2026, Manish's ask): same selectable ATM/+-1/+-2/+-5/+-10/All
  // zone used on Jungle/UOA/OI Profile/Alerts, SERVER-SIDE here (changes
  // which strikes the scan even considers, not a client-side list filter)
  // -- defaults to "5" to stay quiet out of the box.
  const [zone, setZone] = useState('5')
  // (Oct 27 2026, Manish's ask): which comparison baseline to scan against --
  // 5-min (original instant pulse), hourly (intraday monitoring), or EOD/
  // since-open (live-running cumulative, for next-day trade planning the
  // same way Positional Intelligence's Elite Setups are used). SERVER-SIDE,
  // changes the whole scan, not a client-side filter.
  const [timeWindow, setTimeWindow] = useState('5min')
  // (Oct 31 2026): 'live' = the on-demand scan (as before); 'saved' = every hit
  // the background job caught today (Fresh Now / Still Active / Seen Earlier Today).
  const [view, setView] = useState<'live' | 'saved'>('live')
  const [savedDate, setSavedDate] = useState<string | null>(null)
  const [writingFilter, setWritingFilter] = useState<'all' | 'WRITING' | 'BUYING'>('all')
  const [freshFilter, setFreshFilter] = useState<'all' | 'Fresh Now' | 'Still Active' | 'Seen Earlier Today'>('all')

  const load = useCallback((z: string, w: string, v: 'live' | 'saved') => {
    setLoading(true)
    if (v === 'saved') {
      fetch(`${API}/option-stealth-buildup/saved?zone=${encodeURIComponent(z)}&window=${encodeURIComponent(w)}`)
        .then(r => r.json())
        .then(j => {
          setSavedDate(j.date ?? null)
          const hits: StealthHit[] = (j.events || []).map((e: any) => ({
            ...e,
            tier: e.best_tier || e.tier,
            tier_label: ((e.best_tier || e.tier) as string).charAt(0) + ((e.best_tier || e.tier) as string).slice(1).toLowerCase(),
            oi_pct: Number(e.oi_pct), premium_pct: Number(e.premium_pct),
            old_premium: Number(e.old_premium), new_premium: Number(e.new_premium),
          }))
          setData({ date: j.date, total: hits.length, confluence_count: hits.filter(h => h.is_confluence).length, hits, window: j.window, window_label: j.window_label })
        })
        .catch(() => setData({ error: 'Failed to load' }))
        .finally(() => setLoading(false))
      return
    }
    fetch(`${API}/option-stealth-buildup?zone=${encodeURIComponent(z)}&window=${encodeURIComponent(w)}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => setData({ error: 'Failed to load' }))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load(zone, timeWindow, view) }, [load, zone, timeWindow, view])
  useEffect(() => {
    setShowAll(false)
  }, [tierFilter, confluenceOnly, instrumentFilter, optionTypeFilter, expiryFilter, search, zone, timeWindow, view, writingFilter, freshFilter])

  const allHits = data?.hits || []
  const expiryOptions = Array.from(new Set(allHits.map(h => h.expiry).filter((e): e is string => !!e))).sort()

  const filteredHits = allHits
    .filter(h => tierFilter === 'all' || h.tier === tierFilter)
    .filter(h => !confluenceOnly || h.is_confluence)
    .filter(h => writingFilter === 'all' || h.activity === writingFilter)
    .filter(h => view !== 'saved' || freshFilter === 'all' || h.freshness === freshFilter)
    .filter(h => instrumentFilter === 'all' || (instrumentFilter === 'index' ? INDICES.includes(h.symbol) : !INDICES.includes(h.symbol)))
    .filter(h => optionTypeFilter === 'all' || h.option_type === optionTypeFilter)
    .filter(h => expiryFilter === 'all' || h.expiry === expiryFilter)
    .filter(h => !search.trim() || h.symbol.toLowerCase().includes(search.trim().toLowerCase()))

  const hits = showAll ? filteredHits : filteredHits.slice(0, PAGE_SIZE)

  // (Oct 31 2026): per-symbol Bias. Bullish signs = Call Buying + Put Writing;
  // bearish signs = Put Buying + Call Writing ("Quiet" hits are ignored).
  // CONFIRMED = both bullish kinds (or both bearish kinds) present on the same
  // symbol. A symbol with signs on both sides is a range/mixed read, not a bias.
  type BiasRow = { symbol: string; cb: number; pw: number; pb: number; cw: number; bull: number; bear: number }
  const biasMap = new Map<string, BiasRow>()
  for (const h of allHits) {
    if (h.activity !== 'BUYING' && h.activity !== 'WRITING') continue
    const r = biasMap.get(h.symbol) ?? { symbol: h.symbol, cb: 0, pw: 0, pb: 0, cw: 0, bull: 0, bear: 0 }
    if (h.activity === 'BUYING') { if (h.option_type === 'CE') r.cb++; else r.pb++ }
    else { if (h.option_type === 'PE') r.pw++; else r.cw++ }
    r.bull = r.cb + r.pw
    r.bear = r.pb + r.cw
    biasMap.set(h.symbol, r)
  }
  const biasAll = Array.from(biasMap.values())
  const biasRows = biasAll
    .filter(r => (r.bull > 0) !== (r.bear > 0))
    .map(r => ({ ...r, dir: r.bull > 0 ? 'BULLISH' as const : 'BEARISH' as const,
      confirmed: r.bull > 0 ? (r.cb > 0 && r.pw > 0) : (r.pb > 0 && r.cw > 0) }))
    .sort((a, b) => Number(b.confirmed) - Number(a.confirmed) || Math.max(b.bull, b.bear) - Math.max(a.bull, a.bear))
  const mixedCount = biasAll.filter(r => r.bull > 0 && r.bear > 0).length

  return (
    <div className="min-h-screen bg-[#07070e] text-white">
      <Navbar active="/strike-stealth" />

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Zap size={20} className="text-amber-400" /> Option Strike Stealth Buildup
          </h1>
          <div className="flex items-center gap-2">
            <button onClick={() => downloadHitsCSV(filteredHits, timeWindow, zone, view)}
              disabled={filteredHits.length === 0}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white border border-gray-700 rounded-lg px-3 py-1.5 disabled:opacity-40 disabled:hover:text-gray-400">
              <Download size={12} /> Download CSV
            </button>
            <button onClick={() => load(zone, timeWindow, view)}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white border border-gray-700 rounded-lg px-3 py-1.5">
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          OI piling up hard at a single strike (within the zone picked below) while that strike&apos;s own premium
          barely moves — size going on without moving the tape, measured over whichever window you pick: 5-min for
          an instant pulse, Hourly for intraday monitoring, or EOD (measured against yesterday&apos;s close) for a next-day trade read, the same
          way you&apos;d use Positional Intelligence&apos;s Elite Setups. 🔗 Confluence marks a symbol that also has
          a live FUT-level Stealth Buildup right now (always within ATM±5, regardless of the zone picked below) —
          the strongest version of this signal.
        </p>

        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs text-gray-400 mr-1">📋 View:</span>
          {([['live', 'Live scan'], ['saved', 'Saved today']] as const).map(([v, label]) => (
            <button key={v} onClick={() => setView(v)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                view === v
                  ? 'bg-cyan-950/60 text-cyan-400 border-cyan-700'
                  : 'bg-gray-800/40 text-gray-500 border-gray-700 hover:text-white'
              }`}>
              {label}
            </button>
          ))}
          {view === 'saved' && (
            <span className="text-[11px] text-gray-500 ml-1">
              Every hit caught by the 5-minute background scan{savedDate ? ` on ${savedDate}` : ''} — nothing is lost if you weren&apos;t watching.
            </span>
          )}
        </div>

        {view === 'live' && data?.ts_new && (
          <p className="text-[11px] text-gray-500 mb-4">
            {data.window_label ?? 'Window'}: {data.window === 'eod' ? fmtDateTime(data.ts_old) : fmtTime(data.ts_old)} → {fmtTime(data.ts_new)} IST ·{' '}
            {data.total ?? 0} hits, {data.confluence_count ?? 0} with Confluence
          </p>
        )}

        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs text-gray-400 mr-1">⏱️ Window:</span>
          {WINDOW_OPTIONS.map(w => (
            <button key={w.value} onClick={() => setTimeWindow(w.value)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                timeWindow === w.value
                  ? 'bg-cyan-950/60 text-cyan-400 border-cyan-700'
                  : 'bg-gray-800/40 text-gray-500 border-gray-700 hover:text-white'
              }`}>
              {w.label}
            </button>
          ))}
        </div>

        <div className="mb-4">
          <StrikeZoneFilter value={zone} onChange={setZone} label="🎯 Strike zone:" />
        </div>

        {view === 'saved' && (
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {(['all', 'Fresh Now', 'Still Active', 'Seen Earlier Today'] as const).map(f => (
              <button key={f} onClick={() => setFreshFilter(f)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                  freshFilter === f
                    ? 'bg-cyan-950/60 text-cyan-400 border-cyan-700'
                    : 'bg-gray-800/40 text-gray-500 border-gray-700 hover:text-white'
                }`}>
                {f === 'all' ? 'Any freshness' : f}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 mb-4">
          {(['all', 'WRITING', 'BUYING'] as const).map(a => (
            <button key={a} onClick={() => setWritingFilter(a)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                writingFilter === a
                  ? 'bg-cyan-950/60 text-cyan-400 border-cyan-700'
                  : 'bg-gray-800/40 text-gray-500 border-gray-700 hover:text-white'
              }`}>
              {a === 'all' ? 'Writing + Buying' : a === 'WRITING' ? 'Writing only' : 'Buying only'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 mb-4">
          {(['all', 'ELITE', 'STRONG', 'WATCH'] as const).map(t => (
            <button key={t} onClick={() => setTierFilter(t)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                tierFilter === t
                  ? 'bg-cyan-950/60 text-cyan-400 border-cyan-700'
                  : 'bg-gray-800/40 text-gray-500 border-gray-700 hover:text-white'
              }`}>
              {t === 'all' ? 'All' : t.charAt(0) + t.slice(1).toLowerCase()}
            </button>
          ))}
          <button onClick={() => setConfluenceOnly(v => !v)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ml-2 ${
              confluenceOnly
                ? 'bg-fuchsia-950/60 text-fuchsia-400 border-fuchsia-700'
                : 'bg-gray-800/40 text-gray-500 border-gray-700 hover:text-white'
            }`}>
            🔗 Confluence only
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-4">
          {(['all', 'index', 'stocks'] as const).map(v => (
            <button key={v} onClick={() => setInstrumentFilter(v)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                instrumentFilter === v
                  ? 'bg-cyan-950/60 text-cyan-400 border-cyan-700'
                  : 'bg-gray-800/40 text-gray-500 border-gray-700 hover:text-white'
              }`}>
              {v === 'all' ? 'Index + Stocks' : v === 'index' ? 'Index only' : 'Stocks only'}
            </button>
          ))}
          <div className="flex items-center gap-1 ml-1">
            {(['all', 'CE', 'PE'] as const).map(v => (
              <button key={v} onClick={() => setOptionTypeFilter(v)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                  optionTypeFilter === v
                    ? 'bg-cyan-950/60 text-cyan-400 border-cyan-700'
                    : 'bg-gray-800/40 text-gray-500 border-gray-700 hover:text-white'
                }`}>
                {v === 'all' ? 'CE + PE' : v}
              </button>
            ))}
          </div>
          {expiryOptions.length > 1 && (
            <select value={expiryFilter} onChange={e => setExpiryFilter(e.target.value)}
              className="bg-gray-800/40 border border-gray-700 text-gray-300 text-xs font-bold rounded-lg px-3 py-1.5 ml-1 focus:outline-none focus:border-cyan-700">
              <option value="all">All expiries</option>
              {expiryOptions.map(exp => (
                <option key={exp} value={exp}>{fmtExpiry(exp)}</option>
              ))}
            </select>
          )}
          <div className="relative ml-auto">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search symbol…"
              className="bg-gray-800/40 border border-gray-700 text-gray-200 text-xs rounded-lg pl-7 pr-3 py-1.5 w-40 focus:outline-none focus:border-cyan-700 placeholder:text-gray-600" />
          </div>
        </div>

        {biasRows.length > 0 && (
          <div className="mb-5 p-4 rounded-xl border border-gray-800 bg-gray-900/30">
            <p className="text-xs font-bold text-gray-300 mb-1">🧭 Bias by symbol</p>
            <p className="text-[11px] text-gray-500 mb-3">
              Bullish = Call Buying + Put Writing · Bearish = Put Buying + Call Writing. ✓ Confirmed = both kinds agree on the same symbol.
              Tap a symbol to see its strikes. {mixedCount > 0 ? `${mixedCount} symbol${mixedCount > 1 ? 's' : ''} with signs on both sides (range/mixed) not shown.` : ''}
            </p>
            <div className="flex flex-wrap gap-2">
              {biasRows.slice(0, 24).map(r => (
                <button key={r.symbol} onClick={() => setSearch(r.symbol)}
                  className={`text-left text-[11px] border rounded-lg px-2.5 py-1.5 ${
                    r.dir === 'BULLISH' ? 'text-emerald-300 border-emerald-700/50 bg-emerald-950/20' : 'text-rose-300 border-rose-700/50 bg-rose-950/20'
                  }`}>
                  <span className="font-bold text-white">{r.symbol}</span>{' '}
                  {r.dir === 'BULLISH' ? '▲ Bullish' : '▼ Bearish'}{r.confirmed ? ' ✓' : ''}
                  <span className="text-gray-400">
                    {' · '}{r.dir === 'BULLISH'
                      ? [r.cb ? `${r.cb} Call Buying` : '', r.pw ? `${r.pw} Put Writing` : ''].filter(Boolean).join(' + ')
                      : [r.pb ? `${r.pb} Put Buying` : '', r.cw ? `${r.cw} Call Writing` : ''].filter(Boolean).join(' + ')}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {loading && !data && <p className="text-gray-500 text-sm">Loading…</p>}
        {data?.error && <p className="text-red-400 text-sm">{data.error}</p>}

        {!loading && filteredHits.length === 0 && !data?.error && (
          <p className="text-gray-500 text-sm">
            {allHits.length === 0
              ? (view === 'saved' ? 'Nothing saved yet — the background scan starts saving hits at the next market open (9:15 IST on a trading day). Use Live scan to see current hits.' : 'No stealth buildup hits in this snapshot window.')
              : 'No hits match the current filters — try widening them.'}
          </p>
        )}

        <div className="space-y-2">
          {hits.map((h, i) => (
            <div key={`${h.symbol}-${h.strike}-${h.option_type}-${i}`}
              className={`rounded-xl border p-4 flex items-center justify-between ${TIER_STYLE[h.tier]}`}>
              <div className="flex items-center gap-4 min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wide border rounded px-2 py-0.5 shrink-0">
                  {h.tier_label}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-white">{h.symbol}</span>
                    <span className="text-gray-300">{h.strike} {h.option_type}</span>
                    {h.expiry && (
                      <span className="text-[11px] text-gray-500 border border-gray-700 rounded px-1.5 py-0.5">
                        exp {fmtExpiry(h.expiry)}
                      </span>
                    )}
                    {h.strikes_away !== null && (
                      <span className="text-[11px] text-gray-500">
                        {h.strikes_away === 0 ? 'ATM' : `${h.strikes_away > 0 ? '+' : ''}${h.strikes_away} from ATM`}
                      </span>
                    )}
                    {h.activity_label && (
                      <span className={`text-[10px] font-bold border rounded px-1.5 py-0.5 ${ACTIVITY_STYLE[h.activity ?? 'NEUTRAL']}`}>
                        {h.activity_label}
                      </span>
                    )}
                    {h.freshness && (
                      <span className={`text-[10px] font-bold border rounded px-1.5 py-0.5 ${FRESH_STYLE[h.freshness]}`}>
                        {h.freshness}
                      </span>
                    )}
                    {h.is_confluence && (
                      <span className="text-[10px] font-bold text-fuchsia-400 border border-fuchsia-700/50 bg-fuchsia-950/30 rounded px-1.5 py-0.5">
                        🔗 Confluence
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    OI +{h.oi_pct}% ({fmtOI(h.old_oi)} → {fmtOI(h.new_oi)}) · Premium {h.premium_pct >= 0 ? '+' : ''}{h.premium_pct}%
                    (₹{h.old_premium} → ₹{h.new_premium}) · CMP ₹{h.cmp}
                  </p>
                  {h.first_seen && (
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      First seen {fmtTime(h.first_seen)} · last {fmtTime(h.last_seen)} · caught {h.times_seen ?? 1}× · peak OI +{h.peak_oi_pct}%
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {!showAll && filteredHits.length > PAGE_SIZE && (
          <button onClick={() => setShowAll(true)}
            className="mt-3 w-full text-center text-xs text-gray-400 hover:text-white border border-gray-700 rounded-lg py-2">
            Show {filteredHits.length - PAGE_SIZE} more
          </button>
        )}

        <div className="mt-6 p-4 rounded-xl border border-gray-800 bg-gray-900/30">
          {data?.tiers ? (
            data.tiers.map(([tier, minOi, maxPrem]) => (
              <p key={tier} className="text-xs text-gray-400">
                <span className={`font-semibold ${tier === 'ELITE' ? 'text-amber-400' : tier === 'STRONG' ? 'text-emerald-400' : 'text-sky-400'}`}>
                  {tier.charAt(0) + tier.slice(1).toLowerCase()}
                </span>{' '}= OI growth ≥{minOi}%, premium move ≤{maxPrem}% — both measured over the {(data.window_label ?? 'current').toLowerCase()} window
              </p>
            ))
          ) : (
            <>
              <p className="text-xs text-gray-400"><span className="text-amber-400 font-semibold">Elite</span> = strongest OI growth with the quietest premium</p>
              <p className="text-xs text-gray-400"><span className="text-emerald-400 font-semibold">Strong</span> = strong OI growth, quiet premium</p>
              <p className="text-xs text-gray-400"><span className="text-sky-400 font-semibold">Watch</span> = notable OI growth, fairly quiet premium</p>
            </>
          )}
          <p className="text-xs text-gray-500 mt-2">
            First-pass thresholds — may need tuning after a few live sessions, independently per window (5-min/Hourly/EOD each have their own cutoffs above, since OI/premium naturally move by very different amounts over 5 minutes vs an hour vs a full day).
            Strike zone scanned is whatever you pick above (defaults to ATM±5).
          </p>
        </div>
      </div>
    </div>
  )
}
