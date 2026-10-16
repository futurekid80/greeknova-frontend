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
}

interface FreshEventsData {
  date: string
  events: FreshEventRow[]
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
  'RSI Cross 60':                     'bg-emerald-950/50 text-emerald-300 border-emerald-700/60',
  'RSI Cross 40':                     'bg-emerald-950/50 text-emerald-300 border-emerald-700/60',
  'Grandfather-Father-Son Setup':     'bg-indigo-950/50 text-indigo-300 border-indigo-700/60',
  'Grandfather-Father-Son Exit':      'bg-indigo-950/30 text-indigo-400 border-indigo-800/40',
}

const EVENT_TYPES = ['all', 'ADX Full Alignment', 'ADX Cross 25', 'RSI Cross 60', 'RSI Cross 40', 'Grandfather-Father-Son Setup', 'Grandfather-Father-Son Exit'] as const

export default function WolvesScanner() {
  const [tab, setTab] = useState<'wolves' | 'events'>('wolves')
  const [data, setData] = useState<WolvesData | null>(null)
  const [eventsData, setEventsData] = useState<FreshEventsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [tierFilter, setTierFilter] = useState<'all' | 'Apex Wolf' | 'Alpha Wolf' | 'Scout Wolf'>('all')
  const [eventTypeFilter, setEventTypeFilter] = useState<typeof EVENT_TYPES[number]>('all')
  const [countdown, setCountdown] = useState(300)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const countdownRef = useRef<NodeJS.Timeout | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [wRes, eRes] = await Promise.all([
        fetch(`${API}/wolves`),
        fetch(`${API}/wolves/fresh-events`),
      ])
      setData(await wRes.json())
      setEventsData(await eRes.json())
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

  const wolves = (data?.wolves || []).slice().sort((a, b) => (TIER_ORDER[a.wolf_tier] ?? 9) - (TIER_ORDER[b.wolf_tier] ?? 9))
  const filteredWolves = wolves.filter(w => tierFilter === 'all' || w.wolf_tier === tierFilter)
  const counts = {
    apex: wolves.filter(w => w.wolf_tier === 'Apex Wolf').length,
    alpha: wolves.filter(w => w.wolf_tier === 'Alpha Wolf').length,
    scout: wolves.filter(w => w.wolf_tier === 'Scout Wolf').length,
  }

  const events = eventsData?.events || []
  const filteredEvents = events.filter(e => eventTypeFilter === 'all' || e.event_type === eventTypeFilter)
  const eventCounts = {
    alignment: events.filter(e => e.event_type === 'ADX Full Alignment').length,
    adx: events.filter(e => e.event_type === 'ADX Cross 25').length,
    rsi: events.filter(e => e.event_type === 'RSI Cross 60' || e.event_type === 'RSI Cross 40').length,
    gfs: events.filter(e => e.event_type.startsWith('Grandfather-Father-Son')).length,
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
              ADX + RSI + Bollinger Band confluence, plus standalone ADX/RSI events per timeframe.
              Ported from the local scanner.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {data?.date && (
              <div className="text-xs bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-gray-400">
                Scan date: {data.date}
              </div>
            )}
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
            <div className="bg-gray-900/30 border border-gray-800 rounded-xl overflow-hidden">
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
                      No Wolves yet today. {wolves.length === 0 ? 'Try "Run scan now" if the market is open.' : ''}
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
            <div className="grid grid-cols-4 gap-3 mb-5">
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
              <div className="bg-indigo-950/20 border border-indigo-800/40 rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">👴 Grandfather-Father-Son</p>
                <p className="text-2xl font-black text-indigo-300">{eventCounts.gfs}</p>
                <p className="text-xs text-gray-600">Monthly/Weekly/Daily RSI setup</p>
              </div>
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

            {/* Fresh Events table */}
            <div className="bg-gray-900/30 border border-gray-800 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase">
                    <th className="text-left px-4 py-3">Symbol</th>
                    <th className="text-left px-4 py-3">Direction</th>
                    <th className="text-left px-4 py-3">Event</th>
                    <th className="text-left px-4 py-3">Timeframe</th>
                    <th className="text-right px-4 py-3">Close</th>
                    <th className="text-right px-4 py-3">ADX</th>
                    <th className="text-right px-4 py-3">RSI</th>
                    <th className="text-left px-4 py-3">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {!loading && filteredEvents.length === 0 && (
                    <tr><td colSpan={8} className="text-center text-gray-500 py-10">
                      No Fresh Events yet today. {events.length === 0 ? 'Try "Run scan now" if the market is open.' : ''}
                    </td></tr>
                  )}
                  {filteredEvents.map(e => (
                    <tr key={e.event_key} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                      <td className="px-4 py-3 font-bold text-white">{e.symbol}</td>
                      <td className={`px-4 py-3 font-medium ${e.direction === 'Bullish' ? 'text-emerald-400' : 'text-red-400'}`}>{e.direction}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-bold px-2 py-1 rounded-lg border ${EVENT_STYLES[e.event_type] || 'bg-gray-900 text-gray-400 border-gray-700'}`}>
                          {e.event_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-300">{e.timeframe}</td>
                      <td className="px-4 py-3 text-right text-gray-200">{e.close ?? '—'}</td>
                      <td className="px-4 py-3 text-right text-gray-200">{e.adx ?? '—'}</td>
                      <td className="px-4 py-3 text-right text-gray-200">{e.rsi ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{e.scan_time || '—'}</td>
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
