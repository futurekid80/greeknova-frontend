'use client'
import Navbar from '@/components/Navbar'
import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, Zap, Search } from 'lucide-react'
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
  { value: 'eod', label: 'EOD / since open' },
]

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

function fmtTime(ts?: string) {
  if (!ts) return '—'
  try {
    return new Date(ts).toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', hour12: true,
    })
  } catch { return ts }
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

  const load = useCallback((z: string, w: string) => {
    setLoading(true)
    fetch(`${API}/option-stealth-buildup?zone=${encodeURIComponent(z)}&window=${encodeURIComponent(w)}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => setData({ error: 'Failed to load' }))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load(zone, timeWindow) }, [load, zone, timeWindow])
  useEffect(() => {
    setShowAll(false)
  }, [tierFilter, confluenceOnly, instrumentFilter, optionTypeFilter, expiryFilter, search, zone, timeWindow])

  const allHits = data?.hits || []
  const expiryOptions = Array.from(new Set(allHits.map(h => h.expiry).filter((e): e is string => !!e))).sort()

  const filteredHits = allHits
    .filter(h => tierFilter === 'all' || h.tier === tierFilter)
    .filter(h => !confluenceOnly || h.is_confluence)
    .filter(h => instrumentFilter === 'all' || (instrumentFilter === 'index' ? INDICES.includes(h.symbol) : !INDICES.includes(h.symbol)))
    .filter(h => optionTypeFilter === 'all' || h.option_type === optionTypeFilter)
    .filter(h => expiryFilter === 'all' || h.expiry === expiryFilter)
    .filter(h => !search.trim() || h.symbol.toLowerCase().includes(search.trim().toLowerCase()))

  const hits = showAll ? filteredHits : filteredHits.slice(0, PAGE_SIZE)

  return (
    <div className="min-h-screen bg-[#07070e] text-white">
      <Navbar active="/strike-stealth" />

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Zap size={20} className="text-amber-400" /> Option Strike Stealth Buildup
          </h1>
          <button onClick={() => load(zone, timeWindow)}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white border border-gray-700 rounded-lg px-3 py-1.5">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          OI piling up hard at a single strike (within the zone picked below) while that strike&apos;s own premium
          barely moves — size going on without moving the tape, measured over whichever window you pick: 5-min for
          an instant pulse, Hourly for intraday monitoring, or EOD/since-open for a next-day trade read, the same
          way you&apos;d use Positional Intelligence&apos;s Elite Setups. 🔗 Confluence marks a symbol that also has
          a live FUT-level Stealth Buildup right now (always within ATM±5, regardless of the zone picked below) —
          the strongest version of this signal.
        </p>

        {data?.ts_new && (
          <p className="text-[11px] text-gray-500 mb-4">
            {data.window_label ?? 'Window'}: {fmtTime(data.ts_old)} → {fmtTime(data.ts_new)} IST ·{' '}
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

        {loading && !data && <p className="text-gray-500 text-sm">Loading…</p>}
        {data?.error && <p className="text-red-400 text-sm">{data.error}</p>}

        {!loading && filteredHits.length === 0 && !data?.error && (
          <p className="text-gray-500 text-sm">
            {allHits.length === 0
              ? 'No stealth buildup hits in this snapshot window.'
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
