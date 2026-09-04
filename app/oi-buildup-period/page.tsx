'use client'
import Navbar from '@/components/Navbar'
import SignalHistoryPopup from '@/components/SignalHistoryPopup'
import { useState, useEffect, useCallback } from 'react'

const API = 'https://api.greeknova.com'

interface BuildupRow {
  symbol: string
  start_date: string
  end_date: string
  cumulative_oi_pct: number
  cumulative_price_pct: number
  close_price: number
  avg_daily_fut_vol: number
  vol_ratio: number | null
  net_delta: number | null
  signal_type: string
  signal_label: string
}

interface BuildupData {
  period: string
  trading_days: number
  total: number
  results: BuildupRow[]
  long_bias: number
  short_bias: number
}

const SIGNAL_META: Record<string, { color: string; bg: string; border: string; icon: string; badgeBg: string }> = {
  LONG_BUILDUP:   { color: 'text-emerald-400', bg: 'bg-emerald-950/20', border: 'border-emerald-700/50', icon: '🐂', badgeBg: 'bg-emerald-950/60 border-emerald-700/50' },
  SHORT_BUILDUP:  { color: 'text-red-400',     bg: 'bg-red-950/20',     border: 'border-red-700/50',     icon: '🐻', badgeBg: 'bg-red-950/60 border-red-700/50' },
  SHORT_COVERING: { color: 'text-cyan-400',    bg: 'bg-cyan-950/20',    border: 'border-cyan-700/50',     icon: '🔄', badgeBg: 'bg-cyan-950/60 border-cyan-700/50' },
  LONG_UNWINDING: { color: 'text-amber-400',   bg: 'bg-amber-950/20',   border: 'border-amber-700/50',    icon: '⚠️', badgeBg: 'bg-amber-950/60 border-amber-700/50' },
}

function fmt(n: number) {
  return n >= 0 ? `+${n.toFixed(2)}%` : `${n.toFixed(2)}%`
}

function fmtVol(n: number) {
  if (n >= 10000000) return `${(n / 10000000).toFixed(1)}Cr`
  if (n >= 100000) return `${(n / 100000).toFixed(1)}L`
  return n.toLocaleString('en-IN')
}

function fmtCmp(n: number) {
  return n >= 1000 ? n.toLocaleString('en-IN', { maximumFractionDigits: 1 }) : n.toFixed(2)
}

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

function getStealthTier(oiPct: number, pricePct: number): { label: string; color: string; bg: string; border: string } | null {
  const absOi = Math.abs(oiPct)
  const absPrice = Math.abs(pricePct)
  if (absOi >= 10 && absPrice <= 1.0) {
    return { label: 'Elite Stealth', color: 'text-amber-300', bg: 'bg-amber-950/50', border: 'border-amber-700/60' }
  }
  if (absOi >= 6 && absPrice <= 2.0) {
    return { label: 'Strong Stealth', color: 'text-purple-300', bg: 'bg-purple-950/50', border: 'border-purple-700/60' }
  }
  if (absOi >= 4 && absPrice <= 3.0) {
    return { label: 'Watch Stealth', color: 'text-sky-300', bg: 'bg-sky-950/50', border: 'border-sky-700/60' }
  }
  return null
}

function BuildupCard({ r, onSymbolClick }: { r: BuildupRow; onSymbolClick: (sym: string) => void }) {
  const m = SIGNAL_META[r.signal_type] || SIGNAL_META.LONG_BUILDUP
  const stealth = getStealthTier(r.cumulative_oi_pct, r.cumulative_price_pct)

  return (
    <div className={`rounded-xl border ${stealth ? stealth.border : m.border} ${m.bg} p-4 relative`}>
      {stealth && (
        <div className={`absolute -top-2.5 left-4 text-[10px] font-bold px-2 py-0.5 rounded-full border ${stealth.color} ${stealth.bg} ${stealth.border}`}>
          🕵️ {stealth.label}
        </div>
      )}
      <div className="flex items-start justify-between mb-3">
        <div>
          <button
            onClick={() => onSymbolClick(r.symbol)}
            className="text-lg font-bold text-white hover:text-emerald-400 transition-colors underline-offset-2 hover:underline text-left"
          >
            {r.symbol}
          </button>
          <p className="text-sm text-gray-300 mt-0.5">₹{fmtCmp(r.close_price)}</p>
        </div>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${m.color} ${m.badgeBg}`}>
          {m.icon} {r.signal_label}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="bg-black/30 rounded-lg p-2 text-center">
          <p className="text-[10px] text-gray-400 uppercase tracking-wide">FUT OI Chg</p>
          <p className={`text-sm font-bold ${r.cumulative_oi_pct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {fmt(r.cumulative_oi_pct)}
          </p>
        </div>
        <div className="bg-black/30 rounded-lg p-2 text-center">
          <p className="text-[10px] text-gray-400 uppercase tracking-wide">Price Chg</p>
          <p className={`text-sm font-bold ${r.cumulative_price_pct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {fmt(r.cumulative_price_pct)}
          </p>
        </div>
        <div className="bg-black/30 rounded-lg p-2 text-center">
          <p className="text-[10px] text-gray-400 uppercase tracking-wide">Vol vs Prev</p>
          {r.vol_ratio !== null ? (
            <>
              <p className={`text-sm font-bold ${r.vol_ratio >= 1.5 ? 'text-emerald-400' : r.vol_ratio <= 0.7 ? 'text-red-400' : 'text-amber-400'}`}>
                {r.vol_ratio}x
              </p>
              <p className="text-[9px] text-gray-500">{fmtVol(r.avg_daily_fut_vol)}</p>
            </>
          ) : (
            <p className="text-sm font-bold text-amber-400">{fmtVol(r.avg_daily_fut_vol)}</p>
          )}
        </div>
        <div className="bg-black/30 rounded-lg p-2 text-center">
          <p className="text-[10px] text-gray-400 uppercase tracking-wide flex items-center justify-center gap-1">
            Net Delta
            <span title="PE OI minus CE OI at ATM±5 strikes. Positive = more put writing (bullish bias). Negative = more call writing (bearish bias). Latest snapshot, not averaged across the period."
              className="cursor-help text-gray-600 hover:text-gray-400 transition-colors">ⓘ</span>
          </p>
          {r.net_delta !== null && r.net_delta !== undefined ? (
            <p className={`text-sm font-bold ${r.net_delta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {r.net_delta >= 0 ? '+' : ''}{(r.net_delta / 100000).toFixed(1)}L
            </p>
          ) : (
            <p className="text-sm font-bold text-gray-600">—</p>
          )}
        </div>
      </div>
    </div>
  )
}

export default function OIBuildupPeriod() {
  const [period, setPeriod] = useState<'weekly' | 'monthly'>('weekly')
  const [data, setData]     = useState<BuildupData | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'STEALTH' | 'LONG_BUILDUP' | 'SHORT_BUILDUP' | 'SHORT_COVERING' | 'LONG_UNWINDING'>('all')
  const [historySymbol, setHistorySymbol] = useState<string | null>(null)

  const fetchData = useCallback(async (p: string) => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/oi-buildup-period?period=${p}`)
      const json = await res.json()
      setData(json)
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchData(period) }, [period, fetchData])

  const filtered = (data?.results || []).filter(r => {
    if (filter === 'all') return true
    if (filter === 'STEALTH') return getStealthTier(r.cumulative_oi_pct, r.cumulative_price_pct) !== null
    return r.signal_type === filter
  })

  return (
    <div className="min-h-screen bg-[#07070e] text-white">
      <Navbar active="/oi-buildup-period" />

      {historySymbol && (
        <SignalHistoryPopup symbol={historySymbol} onClose={() => setHistorySymbol(null)} />
      )}

      <div className="max-w-6xl mx-auto px-6 py-8">

        <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight mb-1">
              📊 {period === 'weekly' ? 'Weekly' : 'Monthly'} OI Buildup
            </h1>
            <p className="text-gray-500 text-sm">
              Cumulative FUT OI change over the last {data?.trading_days || (period === 'weekly' ? 5 : 20)} trading days
              {data && data.results[0] ? ` · ${fmtDate(data.results[0].start_date)} → ${fmtDate(data.results[0].end_date)}` : ''}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPeriod('weekly')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-all ${
                period === 'weekly' ? 'bg-white text-gray-900 border-white' : 'bg-gray-900 border-gray-700 text-gray-400 hover:text-white'
              }`}
            >
              Weekly (5d)
            </button>
            <button
              onClick={() => setPeriod('monthly')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-all ${
                period === 'monthly' ? 'bg-white text-gray-900 border-white' : 'bg-gray-900 border-gray-700 text-gray-400 hover:text-white'
              }`}
            >
              Monthly (20d)
            </button>
          </div>
        </div>

        {data && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
              <p className="text-xs text-gray-400 mb-1">Total Signals</p>
              <p className="text-2xl font-black text-white">{data.total}</p>
            </div>
            <div className="bg-emerald-950/20 border border-emerald-800/30 rounded-xl p-4">
              <p className="text-xs text-gray-400 mb-1">Long Bias</p>
              <p className="text-2xl font-black text-emerald-400">{data.long_bias}</p>
            </div>
            <div className="bg-red-950/20 border border-red-800/30 rounded-xl p-4">
              <p className="text-xs text-gray-400 mb-1">Short Bias</p>
              <p className="text-2xl font-black text-red-400">{data.short_bias}</p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 mb-5 flex-wrap">
          {(['all', 'STEALTH', 'LONG_BUILDUP', 'SHORT_BUILDUP', 'SHORT_COVERING', 'LONG_UNWINDING'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-all font-medium ${
                filter === f ? 'bg-white text-gray-900 border-white' : 'bg-gray-900/40 text-gray-400 border-gray-800 hover:text-white'
              }`}
            >
              {f === 'all' ? 'All' : f === 'STEALTH' ? '🕵️ Stealth' : (SIGNAL_META[f]?.icon + ' ' + f.replace('_', ' '))}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1,2,3,4,5,6].map(i => <div key={i} className="h-32 bg-gray-900/40 rounded-xl animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 border border-gray-800/50 rounded-2xl">
            <p className="text-gray-500 text-sm">No {period} buildup signals match this filter right now.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {filtered.map(r => <BuildupCard key={r.symbol} r={r} onSymbolClick={setHistorySymbol} />)}
          </div>
        )}

        <div className="mt-8 bg-gray-900/20 border border-gray-800/40 rounded-xl p-4">
          <p className="text-xs text-gray-600">
            <span className="text-gray-400 font-semibold">How this works:</span> Daily FUT OI % changes are compounded (not simply summed) across the {period === 'weekly' ? '5' : '20'} trading day window to get a true cumulative change. Only symbols with at least ±2% cumulative OI movement are shown. For educational purposes only — not investment advice.
          </p>
        </div>
      </div>
    </div>
  )
}
