'use client'
import { useState, useEffect, useCallback } from 'react'
import Navbar from '@/components/Navbar'

const API = process.env.NEXT_PUBLIC_API_URL || 'https://greeknova-backend-production.up.railway.app'

// ── Types ────────────────────────────────────────────────────────────────────

interface SignalHistoryRow {
  date: string
  signal: string
  fut_oi_chg: number
  price_chg: number
  close_price: number
}

interface SignalHistoryData {
  symbol: string
  history: SignalHistoryRow[]
  total: number
}
interface PIStock {
  symbol: string
  cmp: number
  latest_signal: string
  latest_fut_oi_chg: number
  latest_price_chg: number
  cpr_position: string | null
  cpr_width_label: string | null
  cpr_width_emoji: string | null
  cpr_trend: string | null
  total_days: number
  signal: string
  consec_days?: number
  consistency_pct: number
  series_oi_pct: number
  lb_days: number
  sb_days: number
}

interface StealthStock {
  symbol: string
  cmp: number
  tier: string
  today_oi_chg: number
  price_chg: number
  net_delta: number
  rank: number
}

interface VolStock {
  symbol: string
  cmp: number
  signal_type: string
  volume_ratio: number
  oi_chg_pct: number
  price_context: string
}

interface PIData {
  date: string
  expiry: string
  series_start: string
  total_trading_days: number
  active_conviction: PIStock[]
  stealth_buildup: StealthStock[]
  vol_breakout: VolStock[]
  series_buildup: PIStock[]
  summary: {
    active_conviction: number
    stealth_buildup: number
    vol_breakout: number
    series_buildup: number
    long_bias: number
    short_bias: number
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function signalLabel(sig: string) {
  switch (sig) {
    case 'LONG_BUILDUP':   return { label: 'Long Buildup',   color: 'text-emerald-400', bg: 'bg-emerald-950/50 border border-emerald-800/50' }
    case 'SHORT_BUILDUP':  return { label: 'Short Buildup',  color: 'text-red-400',     bg: 'bg-red-950/50 border border-red-800/50' }
    case 'SHORT_COVERING': return { label: 'Short Covering', color: 'text-sky-400',     bg: 'bg-sky-950/50 border border-sky-800/50' }
    case 'LONG_UNWINDING': return { label: 'Long Unwinding', color: 'text-orange-400',  bg: 'bg-orange-950/50 border border-orange-800/50' }
    default:               return { label: 'Neutral',         color: 'text-gray-400',    bg: 'bg-gray-800/50 border border-gray-700/50' }
  }
}

function cprPositionColor(pos: string | null) {
  if (!pos) return 'text-gray-400'
  if (pos === 'Above CPR') return 'text-emerald-400'
  if (pos === 'Below CPR') return 'text-red-400'
  return 'text-amber-400'
}

function cprTrendIcon(trend: string | null) {
  if (trend === 'ASCENDING')  return '↑'
  if (trend === 'DESCENDING') return '↓'
  return '→'
}

function cprTrendColor(trend: string | null) {
  if (trend === 'ASCENDING')  return 'text-emerald-400'
  if (trend === 'DESCENDING') return 'text-red-400'
  return 'text-gray-400'
}

function fmt(n: number, dec = 2) {
  return n >= 0 ? `+${n.toFixed(dec)}%` : `${n.toFixed(dec)}%`
}

function fmtCmp(n: number) {
  return n >= 1000 ? n.toLocaleString('en-IN', { maximumFractionDigits: 1 }) : n.toFixed(2)
}

// ── Section Header ────────────────────────────────────────────────────────────
function SectionHeader({ emoji, title, count, subtitle, color }: {
  emoji: string; title: string; count: number; subtitle: string; color: string
}) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="text-2xl">{emoji}</span>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-white">{title}</h2>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${color}`}>{count}</span>
        </div>
        <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
      </div>
    </div>
  )
}

// ── Empty State ───────────────────────────────────────────────────────────────
function EmptyState({ message }: { message: string }) {
  return (
    <div className="border border-gray-800 rounded-xl py-8 text-center">
      <p className="text-gray-400 text-sm">{message}</p>
    </div>
  )
}

// ── Signal Badge ──────────────────────────────────────────────────────────────
function SignalBadge({ signal }: { signal: string }) {
  const s = signalLabel(signal)
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.bg} ${s.color}`}>
      {s.label}
    </span>
  )
}

// ── Active Conviction Card ────────────────────────────────────────────────────
function ConvictionCard({ s, rank, onSymbolClick }: { s: PIStock; rank: number; onSymbolClick: (sym: string) => void }) {
  const sig = signalLabel(s.signal)
  const isLong = s.signal === 'LONG_BUILDUP'
  const borderColor = isLong ? 'border-emerald-700/60' : 'border-red-700/60'
  const accentBg   = isLong ? 'bg-emerald-950/30' : 'bg-red-950/30'

  return (
    <div className={`rounded-xl border ${borderColor} ${accentBg} p-4`}>
      {/* Top row */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-mono">#{rank}</span>
            <button
              onClick={() => onSymbolClick(s.symbol)}
              className="text-lg font-bold text-white hover:text-emerald-400 transition-colors underline-offset-2 hover:underline"
            >
              {s.symbol}
            </button>
          </div>
          <p className="text-sm text-gray-300 mt-0.5">₹{fmtCmp(s.cmp)}</p>
        </div>
        <div className="text-right">
          <SignalBadge signal={s.signal} />
          <p className="text-xs text-gray-300 mt-1">
            <span className="font-bold text-white">{s.consec_days}d</span> consecutive
          </p>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-black/30 rounded-lg p-2 text-center">
          <p className="text-[10px] text-gray-400 uppercase tracking-wide">FUT OI Chg</p>
          <p className={`text-sm font-bold ${s.latest_fut_oi_chg >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {fmt(s.latest_fut_oi_chg)}
          </p>
        </div>
        <div className="bg-black/30 rounded-lg p-2 text-center">
          <p className="text-[10px] text-gray-400 uppercase tracking-wide">Price Chg</p>
          <p className={`text-sm font-bold ${s.latest_price_chg >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {fmt(s.latest_price_chg)}
          </p>
        </div>
        <div className="bg-black/30 rounded-lg p-2 text-center">
          <p className="text-[10px] text-gray-400 uppercase tracking-wide">Series OI</p>
          <p className="text-sm font-bold text-amber-400">{s.series_oi_pct > 0 ? '+' : ''}{s.series_oi_pct}%</p>
        </div>
      </div>

      {/* CPR + Consistency row */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          {s.cpr_position && (
            <span className={`${cprPositionColor(s.cpr_position)} font-semibold`}>
              {s.cpr_width_emoji} {s.cpr_position}
            </span>
          )}
          {s.cpr_trend && (
            <span className={cprTrendColor(s.cpr_trend)}>
              {cprTrendIcon(s.cpr_trend)} {s.cpr_trend.charAt(0) + s.cpr_trend.slice(1).toLowerCase()}
            </span>
          )}
        </div>
        <span className="text-gray-300">
          <span className="text-white font-semibold">{s.consistency_pct}%</span> consistent
        </span>
      </div>
    </div>
  )
}

// ── Series Buildup Row ────────────────────────────────────────────────────────
function SeriesRow({ s, i, onSymbolClick }: { s: PIStock; i: number; onSymbolClick: (sym: string) => void }) {
  const sig = signalLabel(s.signal)
  const latestSig = signalLabel(s.latest_signal)
  const isLong = s.signal === 'LONG_BUILDUP'
  const signalDays = isLong ? s.lb_days : s.sb_days
  const consistencyWidth = Math.min(s.consistency_pct, 100)

  return (
    <tr className={`border-b border-gray-800/60 hover:bg-gray-900/40 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-900/10'}`}>
      {/* Symbol */}
      <td className="px-4 py-3">
        <button
          onClick={() => onSymbolClick(s.symbol)}
          className="font-bold text-white text-sm hover:text-emerald-400 transition-colors hover:underline underline-offset-2 text-left"
        >
          {s.symbol}
        </button>
        <p className="text-xs text-gray-400">₹{fmtCmp(s.cmp)}</p>
      </td>

      {/* Series Signal */}
      <td className="px-4 py-3">
        <SignalBadge signal={s.signal} />
        <p className="text-[10px] text-gray-400 mt-1">{signalDays}d of {s.total_days}</p>
      </td>

      {/* Consistency bar */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="w-20 bg-gray-800 rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full ${isLong ? 'bg-emerald-500' : 'bg-red-500'}`}
              style={{ width: `${consistencyWidth}%` }}
            />
          </div>
          <span className="text-white font-semibold text-xs">{s.consistency_pct}%</span>
        </div>
      </td>

      {/* Series OI — color by signal direction, not sign */}
      <td className="px-4 py-3 text-right">
        <p className={`text-sm font-bold ${isLong ? 'text-emerald-400' : 'text-red-400'}`}>
          {s.series_oi_pct > 0 ? '+' : ''}{s.series_oi_pct}%
        </p>
        <p className="text-[10px] text-gray-400">series OI</p>
      </td>

      {/* Latest signal */}
      <td className="px-4 py-3 text-right">
        <SignalBadge signal={s.latest_signal} />
        <p className={`text-xs mt-1 ${s.latest_price_chg >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {fmt(s.latest_price_chg, 2)}
        </p>
      </td>

      {/* CPR */}
      <td className="px-4 py-3 text-right">
        {s.cpr_position ? (
          <>
            <p className={`text-xs font-semibold ${cprPositionColor(s.cpr_position)}`}>
              {s.cpr_width_emoji} {s.cpr_position}
            </p>
            <p className={`text-[10px] mt-0.5 ${cprTrendColor(s.cpr_trend)}`}>
              {cprTrendIcon(s.cpr_trend)} {s.cpr_trend ? s.cpr_trend.charAt(0) + s.cpr_trend.slice(1).toLowerCase() : '—'}
            </p>
          </>
        ) : (
          <span className="text-gray-500 text-xs">—</span>
        )}
      </td>
    </tr>
  )
}

// ── Stealth Card ──────────────────────────────────────────────────────────────
function StealthCard({ s }: { s: StealthStock }) {
  const tierColor = s.tier === 'ELITE' ? 'text-amber-400 border-amber-700/50 bg-amber-950/20'
    : s.tier === 'STRONG' ? 'text-emerald-400 border-emerald-700/50 bg-emerald-950/20'
    : 'text-sky-400 border-sky-700/50 bg-sky-950/20'

  return (
    <div className={`rounded-xl border p-4 ${tierColor}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-lg font-bold text-white">{s.symbol}</p>
          <p className="text-sm text-gray-300">₹{fmtCmp(s.cmp)}</p>
        </div>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${tierColor}`}>
          {s.tier}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-[10px] text-gray-400">OI Chg</p>
          <p className="text-sm font-bold text-emerald-400">+{(s.today_oi_chg ?? 0).toFixed(2)}%</p>
        </div>
        <div>
          <p className="text-[10px] text-gray-400">Price Chg</p>
          <p className={`text-sm font-bold ${s.price_chg >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {fmt(s.price_chg)}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-gray-400">Net Delta</p>
          <p className={`text-sm font-bold ${(s.net_delta ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {(s.net_delta ?? 0) >= 0 ? '+' : ''}{((s.net_delta ?? 0) / 100000).toFixed(1)}L
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Vol Breakout Card ─────────────────────────────────────────────────────────
function VolCard({ s }: { s: VolStock }) {
  const isLong = s.signal_type?.includes('LONG') || s.signal_type?.includes('BULLISH')
  return (
    <div className={`rounded-xl border p-4 ${isLong ? 'border-emerald-700/50 bg-emerald-950/20' : 'border-red-700/50 bg-red-950/20'}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-lg font-bold text-white">{s.symbol}</p>
          <p className="text-sm text-gray-300">₹{fmtCmp(s.cmp)}</p>
        </div>
        <span className={`text-xs font-semibold ${isLong ? 'text-emerald-400' : 'text-red-400'}`}>
          {s.signal_type?.replace(/_/g, ' ')}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-center">
        <div>
          <p className="text-[10px] text-gray-400">Vol Ratio</p>
          <p className="text-sm font-bold text-amber-400">{s.volume_ratio?.toFixed(1)}x</p>
        </div>
        <div>
          <p className="text-[10px] text-gray-400">OI Chg</p>
          <p className={`text-sm font-bold ${s.oi_chg_pct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {fmt(s.oi_chg_pct)}
          </p>
        </div>
      </div>
      {s.price_context && (
        <p className="text-[10px] text-amber-300 mt-2 text-center">{s.price_context}</p>
      )}
    </div>
  )
}

// ── Filter Button ─────────────────────────────────────────────────────────────
function FilterBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${
        active
          ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
          : 'bg-gray-900/50 border-gray-700 text-gray-300 hover:border-gray-500 hover:text-white'
      }`}
    >
      {label}
    </button>
  )
}

// ── Signal History Popup ──────────────────────────────────────────────────────
function SignalHistoryPopup({ symbol, onClose }: { symbol: string; onClose: () => void }) {
  const [data, setData] = useState<SignalHistoryData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API}/stock-signal-history/${symbol}?days=20`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [symbol])

  const signalConfig: Record<string, { label: string; color: string; dot: string; bar: string }> = {
    LONG_BUILDUP:   { label: 'Long Buildup',   color: 'text-emerald-400', dot: 'bg-emerald-500', bar: 'bg-emerald-500' },
    SHORT_BUILDUP:  { label: 'Short Buildup',  color: 'text-red-400',     dot: 'bg-red-500',     bar: 'bg-red-500'     },
    SHORT_COVERING: { label: 'Short Covering', color: 'text-sky-400',     dot: 'bg-sky-500',     bar: 'bg-sky-500'     },
    LONG_UNWINDING: { label: 'Long Unwinding', color: 'text-orange-400',  dot: 'bg-orange-500',  bar: 'bg-orange-500'  },
    NEUTRAL:        { label: 'Neutral',         color: 'text-gray-500',    dot: 'bg-gray-700',    bar: 'bg-gray-700'    },
  }

  function fmt(n: number) { return n >= 0 ? `+${n.toFixed(2)}%` : `${n.toFixed(2)}%` }
  function fmtDate(d: string) {
    const dt = new Date(d)
    return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
  }

  // Detect streak — find consecutive run from most recent day
  const history = data?.history || []
  let streakSignal = history[0]?.signal
  let streakCount = 0
  for (const row of history) {
    if (row.signal === streakSignal && row.signal !== 'NEUTRAL') streakCount++
    else break
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-gray-950 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-white font-black text-lg">{symbol}</h3>
              {streakCount >= 2 && (
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  streakSignal === 'LONG_BUILDUP'
                    ? 'bg-emerald-950/60 border border-emerald-800/50 text-emerald-400'
                    : 'bg-red-950/60 border border-red-800/50 text-red-400'
                }`}>
                  🔥 {streakCount}d streak
                </span>
              )}
            </div>
            <p className="text-gray-400 text-xs mt-0.5">FUT Signal History — last {data?.total || '—'} trading days</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors text-xl leading-none">✕</button>
        </div>

        {/* Visual signal strip */}
        {!loading && history.length > 0 && (
          <div className="px-5 pt-4 pb-2">
            <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-2">Signal timeline (oldest → newest)</p>
            <div className="flex gap-1 items-end h-8">
              {[...history].reverse().map((row, i) => {
                const cfg = signalConfig[row.signal] || signalConfig.NEUTRAL
                return (
                  <div key={i} title={`${row.date}: ${cfg.label}`}
                    className={`flex-1 rounded-sm ${cfg.bar} opacity-90`}
                    style={{ height: row.signal === 'NEUTRAL' ? '30%' : '100%' }}
                  />
                )
              })}
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[9px] text-gray-600">{fmtDate(history[history.length - 1]?.date)}</span>
              <span className="text-[9px] text-gray-600">{fmtDate(history[0]?.date)}</span>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="overflow-y-auto max-h-96">
          {loading ? (
            <div className="py-10 text-center">
              <p className="text-gray-500 text-sm animate-pulse">Loading signal history...</p>
            </div>
          ) : history.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-gray-500 text-sm">No history available</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="sticky top-0 bg-gray-950">
                <tr className="border-b border-gray-800">
                  <th className="text-left px-5 py-2 text-[10px] text-gray-500 uppercase tracking-wide">Date</th>
                  <th className="text-left px-3 py-2 text-[10px] text-gray-500 uppercase tracking-wide">Signal</th>
                  <th className="text-right px-3 py-2 text-[10px] text-gray-500 uppercase tracking-wide">FUT OI Chg</th>
                  <th className="text-right px-3 py-2 text-[10px] text-gray-500 uppercase tracking-wide">Price Chg</th>
                  <th className="text-right px-5 py-2 text-[10px] text-gray-500 uppercase tracking-wide">Close</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row, i) => {
                  const cfg = signalConfig[row.signal] || signalConfig.NEUTRAL
                  const isFirst = i === 0
                  return (
                    <tr key={row.date}
                      className={`border-b border-gray-800/40 ${isFirst ? 'bg-gray-900/40' : 'hover:bg-gray-900/20'} transition-colors`}>
                      <td className="px-5 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                          <span className={`text-xs font-mono ${isFirst ? 'text-white font-bold' : 'text-gray-300'}`}>
                            {fmtDate(row.date)}
                          </span>
                          {isFirst && <span className="text-[9px] text-gray-500">latest</span>}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <span className={`text-xs font-mono font-semibold ${row.fut_oi_chg >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {fmt(row.fut_oi_chg)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <span className={`text-xs font-mono font-semibold ${row.price_chg >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {fmt(row.price_chg)}
                        </span>
                      </td>
                      <td className="px-5 py-2.5 text-right">
                        <span className="text-xs text-gray-300 font-mono">
                          ₹{row.close_price >= 1000
                            ? row.close_price.toLocaleString('en-IN', { maximumFractionDigits: 0 })
                            : row.close_price.toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3 text-[10px] text-gray-600">
            {Object.entries(signalConfig).filter(([k]) => k !== 'NEUTRAL').map(([, cfg]) => (
              <span key={cfg.label} className="flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                <span>{cfg.label}</span>
              </span>
            ))}
          </div>
          <p className="text-[10px] text-gray-700">Not investment advice</p>
        </div>
      </div>
    </div>
  )
}

// ── How To Read ───────────────────────────────────────────────────────────────
function HowToRead({ data }: { data: PIData }) {
  const [open, setOpen] = useState(false)

  // Dynamic examples — auto-picked from live data, never stale
  const topConviction = data.active_conviction[0] ?? null
  const topShortConviction = data.active_conviction.find(s => s.signal === 'SHORT_BUILDUP') ?? null
  const topSeries = [...data.series_buildup].sort((a, b) => b.series_oi_pct - a.series_oi_pct)[0] ?? null

  // Build conviction example sentence from real data
  const convictionExample = (() => {
    if (!topConviction) return 'No active conviction signals right now — check back on a trading day.'
    const isLong = topConviction.signal === 'LONG_BUILDUP'
    const parts = [
      `${topConviction.symbol} ${topConviction.consec_days}d ${isLong ? 'Long Buildup' : 'Short Buildup'}`,
      topConviction.cpr_position ? topConviction.cpr_position : null,
      topConviction.cpr_trend ? `${topConviction.cpr_trend.charAt(0) + topConviction.cpr_trend.slice(1).toLowerCase()} CPR trend` : null,
    ].filter(Boolean).join(' + ')
    const reading = isLong
      ? 'strong bullish conviction — FUT longs accumulating for multiple days'
      : 'sustained short pressure — FUT shorts being added day after day'
    return `${parts} = ${reading}.`
      + (topShortConviction && topShortConviction.symbol !== topConviction.symbol
        ? ` ${topShortConviction.symbol} ${topShortConviction.consec_days}d Short Buildup${topShortConviction.cpr_position ? ' + ' + topShortConviction.cpr_position : ''} = shorts building${topShortConviction.cpr_trend === 'DESCENDING' ? ', price trend descending — watch for follow-through' : ''}.`
        : '')
  })()

  // Build series example sentence from real data
  const seriesExample = (() => {
    if (!topSeries) return 'No series buildup data available.'
    const isLong = topSeries.signal === 'LONG_BUILDUP'
    const signalDays = isLong ? topSeries.lb_days : topSeries.sb_days
    const direction = isLong ? 'longs' : 'shorts'
    const cprStr = topSeries.cpr_position && topSeries.cpr_trend
      ? `, ${topSeries.cpr_position}, ${topSeries.cpr_trend.charAt(0) + topSeries.cpr_trend.slice(1).toLowerCase()} CPR`
      : ''
    return `${topSeries.symbol} ${isLong ? 'Long' : 'Short'} Buildup — ${topSeries.consistency_pct}% consistency, ${signalDays} signal days, ${topSeries.series_oi_pct > 0 ? '+' : ''}${topSeries.series_oi_pct}% series OI${cprStr}. FUT ${direction} have been present for most of this series — structural positioning, not day trading.`
  })()

  // Confluence example — stock in both active conviction AND series buildup
  const confluenceStock = data.active_conviction.find(ac =>
    data.series_buildup.some(sb => sb.symbol === ac.symbol && sb.signal === ac.signal)
  ) ?? null

  return (
    <div className="border border-gray-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-900/60 hover:bg-gray-900 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-base">📖</span>
          <span className="text-sm font-semibold text-gray-300">How to read this page as a trader</span>
        </div>
        <span className="text-gray-500 text-sm">{open ? '▲ Close' : '▼ Open'}</span>
      </button>

      {open && (
        <div className="px-4 pb-5 pt-1 bg-gray-950/60 space-y-5">

          {/* Step 1 */}
          <div className="flex gap-3 pt-3">
            <div className="w-7 h-7 rounded-full bg-orange-900/60 border border-orange-700/50 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-orange-400 text-xs font-black">1</span>
            </div>
            <div>
              <p className="text-white font-semibold text-sm mb-1">🔥 Active Conviction — your shortlist for the day</p>
              <p className="text-gray-300 text-xs leading-relaxed">
                These stocks have FUT OI building or shrinking in the <span className="text-white font-semibold">same direction for 2+ consecutive days</span> — meaning smart money is not dipping in and out, they're holding a position. This is your high-priority watchlist.
              </p>
              <div className="mt-2 grid grid-cols-1 gap-1.5">
                <p className="text-xs text-gray-400">
                  <span className="text-emerald-400 font-semibold">Long Buildup</span> = FUT OI ↑ + Price ↑ → fresh longs being added, bullish bias
                </p>
                <p className="text-xs text-gray-400">
                  <span className="text-red-400 font-semibold">Short Buildup</span> = FUT OI ↑ + Price ↓ → fresh shorts being added, bearish bias
                </p>
                <p className="text-xs text-gray-400">
                  <span className="text-amber-400 font-semibold">CPR position</span> = price above/below the pivot zone for next trading day — confirms or contradicts the FUT signal
                </p>
              </div>
              {/* Dynamic example from live data */}
              <div className="mt-2 bg-black/30 rounded-lg px-3 py-2 border border-gray-800">
                <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Live example from today's data</p>
                <p className="text-xs text-gray-300 italic leading-relaxed">{convictionExample}</p>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-800" />

          {/* Step 2 */}
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-amber-900/60 border border-amber-700/50 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-amber-400 text-xs font-black">2</span>
            </div>
            <div>
              <p className="text-white font-semibold text-sm mb-1">🕵️ Stealth + Volume — intraday triggers</p>
              <p className="text-gray-300 text-xs leading-relaxed">
                Available only during market hours. Stealth Buildup = <span className="text-white font-semibold">large FUT OI addition with almost no price movement</span> — someone accumulating quietly without revealing their hand. Vol Breakout = volume surging well above the 7-day average with OI confirmation.
              </p>
              <div className="mt-2 space-y-1">
                <p className="text-xs text-gray-400"><span className="text-amber-400 font-semibold">ELITE tier</span> = top-3 OI day of last 15 + price barely moved + Net Delta bullish → highest quality stealth signal</p>
                <p className="text-xs text-gray-400"><span className="text-emerald-400 font-semibold">STRONG tier</span> = top-3 OI day + small price candle</p>
                <p className="text-xs text-gray-400"><span className="text-sky-400 font-semibold">WATCH tier</span> = top-5 OI day + modest price reaction</p>
              </div>
              <div className="mt-2 bg-black/30 rounded-lg px-3 py-2 border border-gray-800">
                <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Live example from today's data</p>
                <p className="text-xs text-gray-300 italic">
                  {data.stealth_buildup.length > 0
                    ? `${data.stealth_buildup[0].symbol} — ${data.stealth_buildup[0].tier} tier, OI +${data.stealth_buildup[0].today_oi_chg?.toFixed(1)}%, price moved only ${Math.abs(data.stealth_buildup[0].price_chg).toFixed(2)}% — classic quiet accumulation.`
                    : 'No stealth signals right now. These appear during market hours (9:15 AM – 3:30 PM) when FUT OI surges without a matching price move.'
                  }
                </p>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-800" />

          {/* Step 3 */}
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-emerald-900/60 border border-emerald-700/50 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-emerald-400 text-xs font-black">3</span>
            </div>
            <div>
              <p className="text-white font-semibold text-sm mb-1">📈 Series Buildup — longer-term positioning map</p>
              <p className="text-gray-300 text-xs leading-relaxed">
                Zooms out to the <span className="text-white font-semibold">entire series (expiry cycle)</span>. High consistency means institutional positioning held across most of the series — not day trading noise.
              </p>
              <div className="mt-2 space-y-1">
                <p className="text-xs text-gray-400"><span className="text-white font-semibold">Consistency %</span> = what % of series trading days showed the dominant signal. 100% = same direction every single day this series.</p>
                <p className="text-xs text-gray-400"><span className="text-white font-semibold">Series OI %</span> = total OI change for that direction across the series. A large number means significant open interest being built or unwound.</p>
                <p className="text-xs text-gray-400"><span className="text-white font-semibold">Latest</span> = signal on the most recent trading day — tells you if the trend is still intact or broke down last session.</p>
                <p className="text-xs text-gray-400"><span className="text-white font-semibold">CPR trend</span> = pivot trend direction — Long Buildup with Ascending CPR is most bullish; Short Buildup with Descending is most bearish.</p>
              </div>
              <div className="mt-2 bg-black/30 rounded-lg px-3 py-2 border border-gray-800">
                <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Live example from today's data</p>
                <p className="text-xs text-gray-300 italic leading-relaxed">{seriesExample}</p>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-800" />

          {/* Confluence box — dynamic */}
          <div className="bg-gray-900/50 rounded-xl p-3 border border-gray-700/50">
            <p className="text-xs font-semibold text-gray-300 mb-2">🎯 Putting it all together — the ideal setup</p>
            <div className="space-y-1.5 text-xs text-gray-400">
              <p>✅ Stock appears in <span className="text-orange-300">Active Conviction</span> (2+ consecutive days)</p>
              <p>✅ Also shows in <span className="text-emerald-300">Series Buildup</span> with 70%+ consistency</p>
              <p>✅ CPR trend matches direction (Ascending for longs, Descending for shorts)</p>
              <p>✅ Stealth or Vol alert fires intraday → use as entry timing signal</p>
              {confluenceStock ? (
                <p className="text-amber-300 pt-1 font-medium">
                  💡 Today: <span className="text-white font-bold">{confluenceStock.symbol}</span> appears in both Active Conviction ({confluenceStock.consec_days}d streak) and Series Buildup — this is the kind of confluence to watch closely.
                </p>
              ) : (
                <p className="text-gray-500 pt-1">The more boxes checked, the stronger the institutional footprint. No single signal is enough — confluence across sections is what creates high-probability setups.</p>
              )}
            </div>
          </div>

          <p className="text-[10px] text-gray-600 text-center">All signals are informational only · GreekNova is not SEBI registered · Not buy/sell advice</p>
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function PositionalIntelligence() {
  const [data, setData]       = useState<PIData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [signalFilter, setSignalFilter] = useState<'all' | 'LONG_BUILDUP' | 'SHORT_BUILDUP'>('all')
  const [sortBy, setSortBy]   = useState<'consistency' | 'series_oi' | 'lb_days' | 'signal' | 'latest'>('consistency')
  const [historySymbol, setHistorySymbol] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API}/positional-intelligence`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setData(json)
    } catch (e: any) {
      setError(e.message || 'Failed to load')
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Filtered + sorted series buildup
  const seriesFiltered = (data?.series_buildup || [])
    .filter(s => signalFilter === 'all' || s.signal === signalFilter)
    .sort((a, b) => {
      if (sortBy === 'consistency') return b.consistency_pct - a.consistency_pct
      if (sortBy === 'series_oi')   return b.series_oi_pct - a.series_oi_pct
      return (b.signal === 'LONG_BUILDUP' ? b.lb_days : b.sb_days) - (a.signal === 'LONG_BUILDUP' ? a.lb_days : a.sb_days)
    })

  const daysLeft = data
    ? Math.ceil((new Date(data.expiry).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    : null

  // ── Skeleton ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-black p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="h-8 w-56 bg-gray-800 rounded-lg animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <div key={i} className="h-20 bg-gray-900 rounded-xl animate-pulse" />)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-40 bg-gray-900 rounded-xl animate-pulse" />)}
        </div>
        <div className="h-64 bg-gray-900 rounded-xl animate-pulse" />
      </div>
    </div>
  )

  if (error) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center">
        <p className="text-red-400 text-lg font-semibold mb-2">Failed to load</p>
        <p className="text-gray-400 text-sm mb-4">{error}</p>
        <button onClick={fetchData} className="text-sm px-4 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg hover:bg-gray-700">
          Retry
        </button>
      </div>
    </div>
  )

  if (!data) return null

  const s = data.summary

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar active="/positional" />

      {/* Signal History Popup */}
      {historySymbol && (
        <SignalHistoryPopup
          symbol={historySymbol}
          onClose={() => setHistorySymbol(null)}
        />
      )}

      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 space-y-8">

        {/* ── Page Header ─────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">Positional Intelligence</h1>
            <p className="text-gray-400 text-sm mt-1">
              FUT OI momentum across the series · {data.total_trading_days} trading days ·
              Series ends <span className="text-amber-400 font-semibold">{data.expiry}</span>
              {daysLeft !== null && <span className="text-gray-500"> ({daysLeft}d left)</span>}
            </p>
          </div>
          <button
            onClick={fetchData}
            className="text-xs px-3 py-1.5 bg-gray-900 border border-gray-700 text-gray-300 rounded-lg hover:border-gray-500 hover:text-white transition-all"
          >
            ↻ Refresh
          </button>
        </div>

        {/* ── Summary Strip ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Active Conviction', val: s.active_conviction, color: 'text-orange-400', sub: '2+ consecutive days' },
            { label: 'Stealth Buildup',   val: s.stealth_buildup,   color: 'text-amber-400',  sub: "Today's alerts" },
            { label: 'Vol Breakout',      val: s.vol_breakout,      color: 'text-sky-400',    sub: 'Volume surge signals' },
            { label: 'Series Buildup',    val: s.series_buildup,    color: 'text-emerald-400',sub: '60%+ consistent' },
          ].map(item => (
            <div key={item.label} className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
              <p className="text-xs text-gray-400 mb-1">{item.label}</p>
              <p className={`text-3xl font-black ${item.color}`}>{item.val}</p>
              <p className="text-[10px] text-gray-500 mt-1">{item.sub}</p>
            </div>
          ))}
        </div>

        {/* Market bias strip */}
        <div className="flex items-center gap-4 px-4 py-3 bg-gray-900/40 border border-gray-800 rounded-xl text-sm">
          <span className="text-gray-400">Market Bias today:</span>
          <span className="text-emerald-400 font-bold">{s.long_bias} Long</span>
          <span className="text-gray-600">·</span>
          <span className="text-red-400 font-bold">{s.short_bias} Short</span>
          <span className="text-gray-600">·</span>
          <span className="text-gray-300 text-xs">Active conviction signals only</span>
          <span className="ml-auto text-[10px] text-gray-600">Informational only · Not buy/sell advice</span>
        </div>

        {/* ── How To Read ─────────────────────────────────────────────────── */}
        <HowToRead data={data} />

        {/* ── Section 1: Active Conviction ────────────────────────────────── */}
        <section>
          <SectionHeader
            emoji="🔥"
            title="Active Conviction"
            count={data.active_conviction.length}
            subtitle="2+ consecutive FUT signal days — click any symbol for signal history"
            color="bg-orange-900/50 text-orange-300"
          />
          {data.active_conviction.length === 0 ? (
            <EmptyState message="No active conviction signals today. Check back during market hours." />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.active_conviction.map((s, i) => (
                <ConvictionCard key={s.symbol} s={s} rank={i + 1} onSymbolClick={setHistorySymbol} />
              ))}
            </div>
          )}
        </section>

        {/* ── Section 2: Stealth + Vol ─────────────────────────────────────── */}
        <section>
          <SectionHeader
            emoji="🕵️"
            title="Stealth + Volume Alerts"
            count={data.stealth_buildup.length + data.vol_breakout.length}
            subtitle="Today's stealth accumulation and volume-backed breakout signals"
            color="bg-amber-900/50 text-amber-300"
          />
          {data.stealth_buildup.length === 0 && data.vol_breakout.length === 0 ? (
            <EmptyState message="No stealth or volume alerts today. Available during market hours (9:15 AM – 3:30 PM)." />
          ) : (
            <div className="space-y-4">
              {data.stealth_buildup.length > 0 && (
                <>
                  <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Stealth Buildup</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {data.stealth_buildup.map(s => <StealthCard key={s.symbol} s={s} />)}
                  </div>
                </>
              )}
              {data.vol_breakout.length > 0 && (
                <>
                  <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mt-2">Vol + OI Breakout</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {data.vol_breakout.map(s => <VolCard key={s.symbol} s={s} />)}
                  </div>
                </>
              )}
            </div>
          )}
        </section>

        {/* ── Section 3: Series Buildup ────────────────────────────────────── */}
        <section>
          <SectionHeader
            emoji="📈"
            title="Series Buildup"
            count={seriesFiltered.length}
            subtitle={`60%+ signal consistency · minimum 3 signal days · across ${data.total_trading_days} trading days this series`}
            color="bg-emerald-900/50 text-emerald-300"
          />

          {/* Filters + Sort */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="text-xs text-gray-500">Signal:</span>
            <FilterBtn label="All" active={signalFilter === 'all'} onClick={() => setSignalFilter('all')} />
            <FilterBtn label="🟢 Long Buildup" active={signalFilter === 'LONG_BUILDUP'} onClick={() => setSignalFilter('LONG_BUILDUP')} />
            <FilterBtn label="🔴 Short Buildup" active={signalFilter === 'SHORT_BUILDUP'} onClick={() => setSignalFilter('SHORT_BUILDUP')} />
            <span className="ml-4 text-xs text-gray-500">Sort:</span>
            <FilterBtn label="Consistency" active={sortBy === 'consistency'} onClick={() => setSortBy('consistency')} />
            <FilterBtn label="Series OI" active={sortBy === 'series_oi'} onClick={() => setSortBy('series_oi')} />
            <FilterBtn label="Signal Days" active={sortBy === 'lb_days'} onClick={() => setSortBy('lb_days')} />
          </div>

          {seriesFiltered.length === 0 ? (
            <EmptyState message="No series buildup matches the current filter." />
          ) : (
            <div className="rounded-2xl border border-gray-800 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-900/80 border-b border-gray-700">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-300 uppercase tracking-wide">Symbol</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-300 uppercase tracking-wide">Series Signal</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-300 uppercase tracking-wide">Consistency</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-300 uppercase tracking-wide">Series OI</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-300 uppercase tracking-wide">Latest</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-300 uppercase tracking-wide">CPR</th>
                  </tr>
                </thead>
                <tbody>
                  {seriesFiltered.map((s, i) => (
                    <SeriesRow key={s.symbol} s={s} i={i} onSymbolClick={setHistorySymbol} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <div className="border-t border-gray-800 pt-4 text-center">
          <p className="text-[11px] text-gray-600">
            GreekNova · Positional Intelligence · Data as of {data.date} ·
            FUT OI signals from {data.series_start} to expiry {data.expiry} ·
            For educational purposes only · Not SEBI registered · Not buy/sell advice
          </p>
        </div>

      </div>
    </div>
  )
}
