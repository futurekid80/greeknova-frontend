'use client'
import Navbar from '@/components/Navbar'
import { useEffect, useState, useCallback, useRef } from 'react'
import { RefreshCw, Zap } from 'lucide-react'

const API = 'https://api.greeknova.com'

interface WolfRow {
  id: number
  event_key: string
  scan_date: string
  scan_time: string | null
  symbol: string
  direction: string
  wolf_tier: string
  trigger_timeframe: string
  close: number | null
  adx: number | null
  hourly_rsi: number | null
  di_gap: number | null
  bb_width_pct: number | null
  meaning: string | null
}

interface WolvesData {
  date: string
  is_fallback?: boolean
  wolves: WolfRow[]
}

interface FreshEventRow {
  id: number
  event_key: string
  scan_date: string
  scan_time: string | null
  symbol: string
  direction: string
  event_type: string
  timeframe: string
  close: number | null
  rsi: number | null
  adx: number | null
  meaning: string | null
  first_seen: string | null
  last_seen: string | null
  times_seen: number | null
  decision_score: number | null
  signal_freshness: string | null
  bb_quality: string | null
  sector: string | null
  mode: string | null
  priority: number | null
}

interface FreshEventsData {
  date: string
  is_fallback?: boolean
  events: FreshEventRow[]
}

interface WatchlistRow {
  event_key: string
  scan_date: string
  scan_time: string | null
  symbol: string
  sector: string | null
  direction: string
  rank: string
  confidence: string
  signal_type: string | null
  primary_trigger: string | null
  timeframes: string | null
  adx_status: string | null
  rsi_status: string | null
  bb_status: string | null
  adx_active: boolean
  fresh_adx_trigger: boolean
  fresh_signal: string | null
  sector_tailwind: string | null
  confluence_score: number | null
  decision_score: number | null
  close: number | null
  adx: number | null
  rsi: number | null
  why: string | null
}

interface WatchlistData {
  date: string
  is_fallback?: boolean
  watchlist: WatchlistRow[]
}

const TIER_STYLES: Record<string, string> = {
  'Apex Wolf':  'bg-violet-950/50 text-violet-300 border-violet-700/60',
  'Alpha Wolf': 'bg-amber-950/50 text-amber-300 border-amber-700/60',
  'Scout Wolf': 'bg-cyan-950/50 text-cyan-300 border-cyan-700/60',
}

const TIER_ORDER: Record<string, number> = { 'Apex Wolf': 0, 'Alpha Wolf': 1, 'Scout Wolf': 2 }

const EVENT_STYLES: Record<string, string> = {
  'ADX Full Alignment':               'bg-rose-950/50 text-rose-300 border-rose-700/60',
  'ADX Cross 25':                     'bg-orange-950/50 text-orange-300 border-orange-700/60',
  'RSI 60 Breakout':                  'bg-emerald-950/50 text-emerald-300 border-emerald-700/60',
  'RSI 40 Breakdown':                 'bg-emerald-950/50 text-emerald-300 border-emerald-700/60',
  'BB Compression Breakout':          'bg-sky-950/50 text-sky-300 border-sky-700/60',
  'BB Compression Breakdown':         'bg-sky-950/30 text-sky-400 border-sky-800/40',
  'BB Upper Breakout':                'bg-sky-950/40 text-sky-300 border-sky-700/40',
  'BB Lower Breakdown':               'bg-sky-950/20 text-sky-500 border-sky-800/30',
  'Grandfather-Father-Son Setup':     'bg-indigo-950/50 text-indigo-300 border-indigo-700/60',
  'Grandfather-Father-Son Exit':      'bg-indigo-950/30 text-indigo-400 border-indigo-800/40',
}

// Names match Manish's local tool's Event Type column exactly (confirmed
// against his Oct 16 Fresh Events CSV export), so the two scanners' outputs
// line up side by side for comparison.
const EVENT_TYPES = [
  'all', 'ADX Full Alignment', 'ADX Cross 25', 'RSI 60 Breakout', 'RSI 40 Breakdown',
  'BB Compression Breakout', 'BB Compression Breakdown', 'BB Upper Breakout', 'BB Lower Breakdown',
  'Grandfather-Father-Son Setup', 'Grandfather-Father-Son Exit',
] as const

const EVENT_TIMEFRAMES = ['all', 'Hourly', 'Daily', 'Weekly', 'Monthly'] as const
const FRESHNESS_OPTIONS = ['all', 'Fresh Now', 'Still Active', 'Seen Earlier Today'] as const

const FRESHNESS_STYLES: Record<string, string> = {
  'Fresh Now':          'text-emerald-400',
  'Still Active':       'text-amber-400',
  'Seen Earlier Today': 'text-gray-500',
}

const RANK_STYLES: Record<string, string> = {
  'A+': 'bg-emerald-950/50 text-emerald-300 border-emerald-700/60',
  'A':  'bg-cyan-950/50 text-cyan-300 border-cyan-700/60',
  'B':  'bg-amber-950/50 text-amber-300 border-amber-700/60',
  'C':  'bg-gray-800 text-gray-400 border-gray-700',
}

const RANK_ORDER: Record<string, number> = { 'A+': 0, 'A': 1, 'B': 2, 'C': 3 }

const TAILWIND_STYLES: Record<string, string> = {
  'Sector Tailwind': 'text-emerald-400',
  'Against Sector':  'text-red-400',
  'Solo / Mixed Sector': 'text-gray-500',
}

export default function WolvesScanner() {
  const [tab, setTab] = useState<'wolves' | 'events' | 'watchlist'>('wolves')
  const [data, setData] = useState<WolvesData | null>(null)
  const [eventsData, setEventsData] = useState<FreshEventsData | null>(null)
  const [watchlistData, setWatchlistData] = useState<WatchlistData | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [tierFilter, setTierFilter] = useState<'all' | 'Apex Wolf' | 'Alpha Wolf' | 'Scout Wolf'>('all')
  const [eventTypeFilter, setEventTypeFilter] = useState<typeof EVENT_TYPES[number]>('all')
  const [wolfSortMode, setWolfSortMode] = useState<'tier' | 'adx' | 'latest'>('tier')
  const [eventSortMode, setEventSortMode] = useState<'priority' | 'latest'>('priority')
  const [watchlistSortMode, setWatchlistSortMode] = useState<'score' | 'rank' | 'latest'>('score')
  const [eventTimeframeFilter, setEventTimeframeFilter] = useState<typeof EVENT_TIMEFRAMES[number]>('all')
  const [eventFreshnessFilter, setEventFreshnessFilter] = useState<typeof FRESHNESS_OPTIONS[number]>('all')
  const [rankFilter, setRankFilter] = useState<'all' | 'A+' | 'A' | 'B' | 'C'>('all')
  const [countdown, setCountdown] = useState(300)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const countdownRef = useRef<NodeJS.Timeout | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [wRes, eRes, dRes] = await Promise.all([
        fetch(`${API}/wolves`),
        fetch(`${API}/wolves/fresh-events`),
        fetch(`${API}/wolves/watchlist`),
      ])
      setData(await wRes.json())
      setEventsData(await eRes.json())
      setWatchlistData(await dRes.json())
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [])

  const runNow = async () => {
    // The scan runs in the background on the server and takes 2-4 minutes
    // for the full universe -- this call just kicks it off and returns
    // immediately. We poll fetchData a few times after, since there's no
    // push notification when it's done.
    setRunning(true)
    try {
      await fetch(`${API}/wolves/run-now`, { method: 'POST' })
    } catch (e) { console.error(e) }
    setTimeout(fetchData, 60_000)
    setTimeout(fetchData, 120_000)
    setTimeout(() => { fetchData(); setRunning(false) }, 180_000)
  }

  useEffect(() => {
    fetchData()
    intervalRef.current = setInterval(() => { fetchData(); setCountdown(300) }, 5 * 60 * 1000)
    countdownRef.current = setInterval(() => setCountdown(p => Math.max(0, p - 1)), 1000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [fetchData])

  const wolves = (data?.wolves || []).slice().sort((a, b) =>
    wolfSortMode === 'latest' ? (b.scan_time || '').localeCompare(a.scan_time || '')
    : wolfSortMode === 'adx' ? (b.adx ?? 0) - (a.adx ?? 0)
    : (TIER_ORDER[a.wolf_tier] ?? 9) - (TIER_ORDER[b.wolf_tier] ?? 9) || (b.scan_time || '').localeCompare(a.scan_time || '')
  )
  const filteredWolves = wolves.filter(w => tierFilter === 'all' || w.wolf_tier === tierFilter)
  const counts = {
    apex: wolves.filter(w => w.wolf_tier === 'Apex Wolf').length,
    alpha: wolves.filter(w => w.wolf_tier === 'Alpha Wolf').length,
    scout: wolves.filter(w => w.wolf_tier === 'Scout Wolf').length,
  }

  const events = (eventsData?.events || []).slice().sort((a, b) =>
    eventSortMode === 'latest'
      ? (b.scan_time || '').localeCompare(a.scan_time || '')
      : (a.priority ?? 9) - (b.priority ?? 9) || (b.scan_time || '').localeCompare(a.scan_time || '')
  )
  const filteredEvents = events
    .filter(e => eventTypeFilter === 'all' || e.event_type === eventTypeFilter)
    .filter(e => eventTimeframeFilter === 'all' || e.timeframe === eventTimeframeFilter)
    .filter(e => eventFreshnessFilter === 'all' || e.signal_freshness === eventFreshnessFilter)
  const eventCounts = {
    alignment: events.filter(e => e.event_type === 'ADX Full Alignment').length,
    adx: events.filter(e => e.event_type === 'ADX Cross 25').length,
    rsi: events.filter(e => e.event_type === 'RSI 60 Breakout' || e.event_type === 'RSI 40 Breakdown').length,
    bb: events.filter(e => e.event_type.startsWith('BB')).length,
    gfs: events.filter(e => e.event_type.startsWith('Grandfather-Father-Son')).length,
  }

  const watchlist = (watchlistData?.watchlist || []).slice().sort((a, b) =>
    watchlistSortMode === 'latest' ? (b.scan_time || '').localeCompare(a.scan_time || '')
    : watchlistSortMode === 'rank' ? (RANK_ORDER[a.rank] ?? 9) - (RANK_ORDER[b.rank] ?? 9) || (b.decision_score ?? 0) - (a.decision_score ?? 0)
    : (b.decision_score ?? 0) - (a.decision_score ?? 0)
  )
  const filteredWatchlist = watchlist.filter(w => rankFilter === 'all' || w.rank === rankFilter)
  const rankCounts = {
    aplus: watchlist.filter(w => w.rank === 'A+').length,
    a: watchlist.filter(w => w.rank === 'A').length,
    b: watchlist.filter(w => w.rank === 'B').length,
    c: watchlist.filter(w => w.rank === 'C').length,
  }

  return (
    <div className="min-h-screen bg-[#07070e] text-white">
      <Navbar active="/wolves" />
      <div className="max-w-6xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-black tracking-tight mb-1 flex items-center gap-2">
              <Zap size={26} className="text-amber-400" /> Wolves Scanner
            </h1>
            <p className="text-gray-500 text-sm">
              ADX + RSI + Bollinger Band confluence, standalone ADX/RSI/BB events, and a Rank/Decision
              Score watchlist -- ported from the local scanner.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {(() => {
              const active = tab === 'wolves' ? data : tab === 'events' ? eventsData : watchlistData
              if (!active?.date) return null
              return (
                <div className="text-xs bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-gray-400">
                  Scan date: {active.date}{active.is_fallback ? ' (last trading day)' : ''}
                </div>
              )
            })()}
            <div className="flex items-center gap-1.5 text-xs bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-gray-400">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Next refresh in {Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, '0')}
            </div>
            <button onClick={runNow} disabled={running}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-sm font-bold text-black rounded-lg disabled:opacity-50 transition-all">
              <Zap size={13} className={running ? 'animate-pulse' : ''} />
              {running ? 'Scanning…' : 'Run scan now'}
            </button>
            <button onClick={fetchData} disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-sm font-medium text-white rounded-lg border border-gray-700 disabled:opacity-50 transition-all">
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />Refresh
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-5 bg-gray-900 border border-gray-700 rounded-lg p-1 w-fit">
          <button onClick={() => setTab('wolves')}
            className={`px-4 py-1.5 text-sm font-bold rounded-md transition-all ${tab === 'wolves' ? 'bg-white text-gray-900' : 'text-gray-400 hover:text-white'}`}>
            Wolves (Confluence)
          </button>
          <button onClick={() => setTab('events')}
            className={`px-4 py-1.5 text-sm font-bold rounded-md transition-all ${tab === 'events' ? 'bg-white text-gray-900' : 'text-gray-400 hover:text-white'}`}>
            Fresh Events (Standalone)
          </button>
          <button onClick={() => setTab('watchlist')}
            className={`px-4 py-1.5 text-sm font-bold rounded-md transition-all ${tab === 'watchlist' ? 'bg-white text-gray-900' : 'text-gray-400 hover:text-white'}`}>
            Decision Watchlist
          </button>
        </div>

        {tab === 'wolves' && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-4 gap-3 mb-5">
              <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">Total Wolves Today</p>
                <p className="text-2xl font-black text-white">{wolves.length}</p>
                <p className="text-xs text-gray-600">live every 5 min during market hours, or on demand above</p>
              </div>
              <div className="bg-violet-950/20 border border-violet-800/40 rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">🏔️ Apex Wolf</p>
                <p className="text-2xl font-black text-violet-300">{counts.apex}</p>
                <p className="text-xs text-gray-600">Weekly/Monthly ADX cross</p>
              </div>
              <div className="bg-amber-950/20 border border-amber-800/40 rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">🐺 Alpha Wolf</p>
                <p className="text-2xl font-black text-amber-300">{counts.alpha}</p>
                <p className="text-xs text-gray-600">Daily ADX cross</p>
              </div>
              <div className="bg-cyan-950/20 border border-cyan-800/40 rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">🔍 Scout Wolf</p>
                <p className="text-2xl font-black text-cyan-300">{counts.scout}</p>
                <p className="text-xs text-gray-600">Hourly ADX cross</p>
              </div>
            </div>

            {/* Sort mode toggle */}
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs text-gray-500 font-bold uppercase">Sort:</span>
              {(['tier', 'adx', 'latest'] as const).map(m => (
                <button key={m} onClick={() => setWolfSortMode(m)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                    wolfSortMode === m ? 'bg-emerald-500 text-gray-900 border-emerald-500' : 'bg-gray-900 text-gray-400 border-gray-700 hover:text-white'
                  }`}>
                  {m === 'tier' ? 'Tier' : m === 'adx' ? 'Highest ADX' : 'Latest First'}
                </button>
              ))}
            </div>

            {/* Tier filter */}
            <div className="flex items-center gap-2 mb-4">
              {(['all', 'Apex Wolf', 'Alpha Wolf', 'Scout Wolf'] as const).map(t => (
                <button key={t} onClick={() => setTierFilter(t)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                    tierFilter === t ? 'bg-white text-gray-900 border-white' : 'bg-gray-900 text-gray-400 border-gray-700 hover:text-white'
                  }`}>
                  {t === 'all' ? 'All' : t}
                </button>
              ))}
            </div>

            {/* Wolves table */}
            <div className="bg-gray-900/30 border border-gray-800 rounded-xl overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase">
                    <th className="text-left px-4 py-3">Symbol</th>
                    <th className="text-left px-4 py-3">Tier</th>
                    <th className="text-left px-4 py-3">Timeframe</th>
                    <th className="text-right px-4 py-3">Close</th>
                    <th className="text-right px-4 py-3">ADX</th>
                    <th className="text-right px-4 py-3">Hourly RSI</th>
                    <th className="text-right px-4 py-3">DI Gap</th>
                    <th className="text-right px-4 py-3">BB Width %ile</th>
                    <th className="text-left px-4 py-3">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {!loading && filteredWolves.length === 0 && (
                    <tr><td colSpan={9} className="text-center text-gray-500 py-10">
                      {data?.is_fallback ? `No Wolves yet on ${data.date}.` : 'No Wolves yet today.'} Try "Run scan now" if the market is open.
                    </td></tr>
                  )}
                  {filteredWolves.map(w => (
                    <tr key={w.event_key} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                      <td className="px-4 py-3 font-bold text-white">{w.symbol}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-bold px-2 py-1 rounded-lg border ${TIER_STYLES[w.wolf_tier] || 'bg-gray-900 text-gray-400 border-gray-700'}`}>
                          {w.wolf_tier}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-300">{w.trigger_timeframe}</td>
                      <td className="px-4 py-3 text-right text-gray-200">{w.close ?? '—'}</td>
                      <td className="px-4 py-3 text-right text-gray-200">{w.adx ?? '—'}</td>
                      <td className="px-4 py-3 text-right text-gray-200">{w.hourly_rsi ?? '—'}</td>
                      <td className="px-4 py-3 text-right text-gray-200">{w.di_gap ?? '—'}</td>
                      <td className="px-4 py-3 text-right text-gray-200">{w.bb_width_pct != null ? `${w.bb_width_pct}%` : '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{w.scan_time || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === 'events' && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-5 gap-3 mb-5">
              <div className="bg-rose-950/20 border border-rose-800/40 rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">⚡ ADX Full Alignment</p>
                <p className="text-2xl font-black text-rose-300">{eventCounts.alignment}</p>
                <p className="text-xs text-gray-600">all 4 timeframes crossed together</p>
              </div>
              <div className="bg-orange-950/20 border border-orange-800/40 rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">📈 ADX Cross 25</p>
                <p className="text-2xl font-black text-orange-300">{eventCounts.adx}</p>
                <p className="text-xs text-gray-600">standalone, any single timeframe</p>
              </div>
              <div className="bg-emerald-950/20 border border-emerald-800/40 rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">📊 RSI Cross 60/40</p>
                <p className="text-2xl font-black text-emerald-300">{eventCounts.rsi}</p>
                <p className="text-xs text-gray-600">standalone, any single timeframe</p>
              </div>
              <div className="bg-sky-950/20 border border-sky-800/40 rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">📉 BB Events</p>
                <p className="text-2xl font-black text-sky-300">{eventCounts.bb}</p>
                <p className="text-xs text-gray-600">compression + plain band breaks</p>
              </div>
              <div className="bg-indigo-950/20 border border-indigo-800/40 rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">👴 Grandfather-Father-Son</p>
                <p className="text-2xl font-black text-indigo-300">{eventCounts.gfs}</p>
                <p className="text-xs text-gray-600">Monthly/Weekly/Daily RSI setup</p>
              </div>
            </div>

            {/* Sort mode toggle */}
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs text-gray-500 font-bold uppercase">Sort:</span>
              {(['priority', 'latest'] as const).map(m => (
                <button key={m} onClick={() => setEventSortMode(m)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                    eventSortMode === m ? 'bg-emerald-500 text-gray-900 border-emerald-500' : 'bg-gray-900 text-gray-400 border-gray-700 hover:text-white'
                  }`}>
                  {m === 'priority' ? 'Priority' : 'Latest First'}
                </button>
              ))}
            </div>

            {/* Event type filter */}
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              {EVENT_TYPES.map(t => (
                <button key={t} onClick={() => setEventTypeFilter(t)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                    eventTypeFilter === t ? 'bg-white text-gray-900 border-white' : 'bg-gray-900 text-gray-400 border-gray-700 hover:text-white'
                  }`}>
                  {t === 'all' ? 'All' : t}
                </button>
              ))}
            </div>

            {/* Timeframe + Freshness filters */}
            <div className="flex items-center gap-4 mb-4 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-gray-500 font-bold uppercase">Timeframe:</span>
                {EVENT_TIMEFRAMES.map(tf => (
                  <button key={tf} onClick={() => setEventTimeframeFilter(tf)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                      eventTimeframeFilter === tf ? 'bg-cyan-500 text-gray-900 border-cyan-500' : 'bg-gray-900 text-gray-400 border-gray-700 hover:text-white'
                    }`}>
                    {tf === 'all' ? 'All' : tf}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-gray-500 font-bold uppercase">Freshness:</span>
                {FRESHNESS_OPTIONS.map(f => (
                  <button key={f} onClick={() => setEventFreshnessFilter(f)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                      eventFreshnessFilter === f ? 'bg-emerald-500 text-gray-900 border-emerald-500' : 'bg-gray-900 text-gray-400 border-gray-700 hover:text-white'
                    }`}>
                    {f === 'all' ? 'All' : f}
                  </button>
                ))}
              </div>
            </div>

            {/* Fresh Events table */}
            <div className="bg-gray-900/30 border border-gray-800 rounded-xl overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase">
                    <th className="text-right px-4 py-3">Pri</th>
                    <th className="text-left px-4 py-3">Symbol</th>
                    <th className="text-left px-4 py-3">Direction</th>
                    <th className="text-left px-4 py-3">Event</th>
                    <th className="text-left px-4 py-3">Mode</th>
                    <th className="text-left px-4 py-3">Timeframe</th>
                    <th className="text-right px-4 py-3">Close</th>
                    <th className="text-right px-4 py-3">ADX</th>
                    <th className="text-right px-4 py-3">RSI</th>
                    <th className="text-right px-4 py-3">Decision Score</th>
                    <th className="text-left px-4 py-3">Freshness</th>
                    <th className="text-right px-4 py-3">Times Seen</th>
                    <th className="text-left px-4 py-3">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {!loading && filteredEvents.length === 0 && events.length > 0 && (
                    <tr><td colSpan={13} className="text-center text-gray-500 py-10">
                      No events match these filters. Try widening the Event type, Timeframe or Freshness filter.
                    </td></tr>
                  )}
                  {!loading && filteredEvents.length === 0 && events.length === 0 && (
                    <tr><td colSpan={13} className="text-center text-gray-500 py-10">
                      {eventsData?.is_fallback ? `No Fresh Events yet on ${eventsData.date}.` : 'No Fresh Events yet today.'} Try "Run scan now" if the market is open.
                    </td></tr>
                  )}
                  {filteredEvents.map(e => (
                    <tr key={e.event_key} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                      <td className="px-4 py-3 text-right text-gray-500">{e.priority ?? '—'}</td>
                      <td className="px-4 py-3 font-bold text-white">{e.symbol}</td>
                      <td className={`px-4 py-3 font-medium ${e.direction === 'Bullish' ? 'text-emerald-400' : 'text-red-400'}`}>{e.direction}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-bold px-2 py-1 rounded-lg border ${EVENT_STYLES[e.event_type] || 'bg-gray-900 text-gray-400 border-gray-700'}`}>
                          {e.event_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{e.mode || '—'}</td>
                      <td className="px-4 py-3 text-gray-300">{e.timeframe}</td>
                      <td className="px-4 py-3 text-right text-gray-200">{e.close ?? '—'}</td>
                      <td className="px-4 py-3 text-right text-gray-200">{e.adx ?? '—'}</td>
                      <td className="px-4 py-3 text-right text-gray-200">{e.rsi ?? '—'}</td>
                      <td className="px-4 py-3 text-right font-bold text-white">{e.decision_score ?? '—'}</td>
                      <td className={`px-4 py-3 ${FRESHNESS_STYLES[e.signal_freshness || ''] || 'text-gray-500'}`}>{e.signal_freshness || '—'}</td>
                      <td className="px-4 py-3 text-right text-gray-400">{e.times_seen ?? 1}</td>
                      <td className="px-4 py-3 text-gray-500">{e.scan_time || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === 'watchlist' && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-4 gap-3 mb-5">
              <div className="bg-emerald-950/20 border border-emerald-800/40 rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">⭐ Rank A+</p>
                <p className="text-2xl font-black text-emerald-300">{rankCounts.aplus}</p>
                <p className="text-xs text-gray-600">ADX + RSI + BB confluence, 2+ timeframes</p>
              </div>
              <div className="bg-cyan-950/20 border border-cyan-800/40 rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">Rank A</p>
                <p className="text-2xl font-black text-cyan-300">{rankCounts.a}</p>
                <p className="text-xs text-gray-600">Multi-timeframe ADX + RSI confluence</p>
              </div>
              <div className="bg-amber-950/20 border border-amber-800/40 rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">Rank B</p>
                <p className="text-2xl font-black text-amber-300">{rankCounts.b}</p>
                <p className="text-xs text-gray-600">Fresh single-trigger breakout</p>
              </div>
              <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">Rank C</p>
                <p className="text-2xl font-black text-gray-300">{rankCounts.c}</p>
                <p className="text-xs text-gray-600">Single-timeframe continuation</p>
              </div>
            </div>

            {/* Sort mode toggle */}
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs text-gray-500 font-bold uppercase">Sort:</span>
              {(['score', 'rank', 'latest'] as const).map(m => (
                <button key={m} onClick={() => setWatchlistSortMode(m)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                    watchlistSortMode === m ? 'bg-emerald-500 text-gray-900 border-emerald-500' : 'bg-gray-900 text-gray-400 border-gray-700 hover:text-white'
                  }`}>
                  {m === 'score' ? 'Decision Score' : m === 'rank' ? 'Rank' : 'Latest First'}
                </button>
              ))}
            </div>

            {/* Rank filter */}
            <div className="flex items-center gap-2 mb-4">
              {(['all', 'A+', 'A', 'B', 'C'] as const).map(t => (
                <button key={t} onClick={() => setRankFilter(t)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                    rankFilter === t ? 'bg-white text-gray-900 border-white' : 'bg-gray-900 text-gray-400 border-gray-700 hover:text-white'
                  }`}>
                  {t === 'all' ? 'All' : t}
                </button>
              ))}
            </div>

            {/* Watchlist table */}
            <div className="bg-gray-900/30 border border-gray-800 rounded-xl overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase">
                    <th className="text-left px-4 py-3">Rank</th>
                    <th className="text-left px-4 py-3">Symbol</th>
                    <th className="text-left px-4 py-3">Sector</th>
                    <th className="text-left px-4 py-3">Direction</th>
                    <th className="text-left px-4 py-3">Signal Type</th>
                    <th className="text-left px-4 py-3">Timeframes</th>
                    <th className="text-left px-4 py-3">Sector Tailwind</th>
                    <th className="text-right px-4 py-3">Decision Score</th>
                    <th className="text-left px-4 py-3">Confidence</th>
                    <th className="text-left px-4 py-3">Why</th>
                  </tr>
                </thead>
                <tbody>
                  {!loading && filteredWatchlist.length === 0 && (
                    <tr><td colSpan={10} className="text-center text-gray-500 py-10">
                      {watchlistData?.is_fallback ? `No watchlist rows yet on ${watchlistData.date}.` : 'No watchlist rows yet today.'} Try "Run scan now" if the market is open.
                    </td></tr>
                  )}
                  {filteredWatchlist.map(w => (
                    <tr key={w.event_key} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                      <td className="px-4 py-3">
                        <span className={`text-xs font-bold px-2 py-1 rounded-lg border ${RANK_STYLES[w.rank] || 'bg-gray-900 text-gray-400 border-gray-700'}`}>
                          {w.rank}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-bold text-white">{w.symbol}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{w.sector || 'Unclassified'}</td>
                      <td className={`px-4 py-3 font-medium ${w.direction === 'Bullish' ? 'text-emerald-400' : 'text-red-400'}`}>{w.direction}</td>
                      <td className="px-4 py-3 text-gray-300 text-xs">{w.signal_type || '—'}</td>
                      <td className="px-4 py-3 text-gray-300">{w.timeframes || '—'}</td>
                      <td className={`px-4 py-3 text-xs ${TAILWIND_STYLES[w.sector_tailwind || ''] || 'text-gray-500'}`}>{w.sector_tailwind || '—'}</td>
                      <td className="px-4 py-3 text-right font-bold text-white">{w.decision_score ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-300">{w.confidence}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs max-w-md whitespace-normal leading-snug align-top">{w.why || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
