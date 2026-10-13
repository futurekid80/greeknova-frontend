'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  ComposedChart, BarChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Legend, Cell,
} from 'recharts'
import { chartColors } from '@/lib/chartColors'

const API = 'https://api.greeknova.com'
const SYMBOLS = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY', 'SENSEX']

function fmtNum(n: number | null | undefined) {
  if (n === null || n === undefined || isNaN(n)) return '—'
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 10000000) return sign + (abs / 10000000).toFixed(2) + 'Cr'
  if (abs >= 100000) return sign + (abs / 100000).toFixed(2) + 'L'
  if (abs >= 1000) return sign + (abs / 1000).toFixed(1) + 'K'
  return n.toLocaleString('en-IN')
}

function fmtTime(t: string | undefined) {
  if (!t) return ''
  // as_of_data_ts is UTC; render in IST (+5:30) hh:mm
  const d = new Date(t)
  const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000)
  return ist.toISOString().slice(11, 16)
}

type Point = {
  t: string
  cmp: number | null
  regime: string | null
  net_gex: number | null
  net_gex_near_spot: number | null
  net_dex: number | null
  net_dex_near_spot: number | null
  call_wall_strike: number | null
  put_wall_strike: number | null
  flip_point: number | null
}

type AlertHourly = { hour: number; bull: number; bear: number }

type Summary = {
  open: number
  close: number
  day_move: number
  day_move_pct: number | null
  regime_close: string | null
  peak_net_gex: number | null
  peak_net_gex_time: string | null
  peak_net_dex: number | null
  peak_net_dex_time: string | null
}

type ReplayData = {
  symbol: string
  date: string
  points: Point[]
  alert_hourly: AlertHourly[]
  summary: Summary | null
  error?: string
}

function todayISO() {
  const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
  return ist.toISOString().slice(0, 10)
}

export default function SessionReplayPage() {
  const [symbol, setSymbol] = useState('NIFTY')
  const [date, setDate] = useState(todayISO())
  const [data, setData] = useState<ReplayData | null>(null)
  const [loading, setLoading] = useState(true)
  const isToday = date === todayISO()

  // Oct 13 2026 (Manish): "can it work in live market?" -- yes, the
  // underlying gex_regime_log is already written every ~1-3min during
  // market hours (same source Gamma Squeeze reads), this page just wasn't
  // polling it. When viewing today, refresh every 60s so the replay fills
  // in live as the session happens, same as gex-chart/gamma-squeeze do.
  // Viewing a past date never polls -- that data is final, no point
  // re-fetching it every minute.
  const load = useCallback(async (sym: string, d: string, isPoll = false) => {
    if (!isPoll) setLoading(true)
    try {
      const res = await fetch(`${API}/session-replay/${sym}?date=${d}&t=${Date.now()}`, { cache: 'no-store' })
      const json = await res.json()
      setData(json)
    } catch (e) {
      if (!isPoll) setData(null)
    } finally {
      if (!isPoll) setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(symbol, date)
    if (date !== todayISO()) return
    const id = setInterval(() => load(symbol, date, true), 60000)
    return () => clearInterval(id)
  }, [symbol, date, load])

  const points = data?.points ?? []
  const alertHourly = (data?.alert_hourly ?? []).map(h => ({
    hourLabel: `${String(h.hour).padStart(2, '0')}-${String(h.hour + 1).padStart(2, '0')}`,
    bull: h.bull,
    bear: -h.bear,
  }))
  const summary = data?.summary

  const chartPoints = points.map(p => ({
    ...p,
    time: fmtTime(p.t),
  }))

  return (
    <div className="min-h-screen bg-black text-white px-4 py-6 md:px-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2">
            ⏮️ Session Replay
            {isToday && (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-2.5 py-1 ml-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> LIVE — updates every 60s
              </span>
            )}
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            How the session is unfolding — spot price against Net GEX/DEX over the day, with hourly alert conviction. Today fills in live as the market moves; pick a past date for a post-mortem.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={date}
            max={todayISO()}
            onChange={e => setDate(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white"
          />
          {SYMBOLS.map(s => (
            <button
              key={s}
              onClick={() => setSymbol(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-bold border ${
                s === symbol
                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                  : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {loading && <div className="text-gray-500 text-sm">Loading…</div>}

      {!loading && (data?.error || !summary) && (
        <div className="text-amber-400 text-sm">
          {data?.error ?? 'No regime-log data for this symbol/date yet.'}
        </div>
      )}

      {!loading && data && summary && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
            <StatCard label={isToday ? 'OPEN → LAST' : 'OPEN → CLOSE'} value={`${summary.open.toLocaleString()} → ${summary.close.toLocaleString()}`} />
            <StatCard
              label={isToday ? 'MOVE SO FAR' : 'DAY MOVE'}
              value={`${summary.day_move >= 0 ? '+' : ''}${summary.day_move.toLocaleString()} (${summary.day_move_pct! >= 0 ? '+' : ''}${summary.day_move_pct}%)`}
              accent={summary.day_move >= 0 ? 'text-emerald-400' : 'text-red-400'}
            />
            <StatCard
              label={isToday ? 'REGIME (NOW)' : 'REGIME (CLOSE)'}
              value={summary.regime_close === 'SHORT_GAMMA' ? 'SHORT GAMMA' : summary.regime_close === 'LONG_GAMMA' ? 'LONG GAMMA' : '—'}
              accent={summary.regime_close === 'SHORT_GAMMA' ? 'text-red-400' : 'text-emerald-400'}
            />
            <StatCard label="PEAK NET GEX" value={fmtNum(summary.peak_net_gex)} accent="text-red-400" sub={fmtTime(summary.peak_net_gex_time || undefined)} />
            <StatCard label="PEAK NET DEX" value={fmtNum(summary.peak_net_dex)} accent="text-emerald-400" sub={fmtTime(summary.peak_net_dex_time || undefined)} />
            <StatCard label="SYMBOL / DATE" value={`${data.symbol}`} sub={data.date} />
          </div>

          <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-4 mb-5">
            <h2 className="text-sm font-bold text-gray-300 mb-2">Spot price vs Net GEX (near spot)</h2>
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={chartPoints} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                <XAxis dataKey="time" tick={{ fill: chartColors.axisTick, fontSize: 11 }} minTickGap={30} />
                <YAxis yAxisId="price" tick={{ fill: chartColors.axisTick, fontSize: 11 }} domain={['auto', 'auto']} />
                <YAxis yAxisId="gex" orientation="right" tick={{ fill: chartColors.axisTick, fontSize: 11 }} tickFormatter={fmtNum} />
                <Tooltip
                  contentStyle={{ background: '#111', border: '1px solid #333', borderRadius: 8, fontSize: 12 }}
                  formatter={(value, name) => [typeof value === 'number' ? (name === 'Spot' ? value.toLocaleString() : fmtNum(value)) : value, name]}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line yAxisId="price" type="monotone" dataKey="cmp" name="Spot" stroke="#67e8f9" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line yAxisId="gex" type="monotone" dataKey="net_gex_near_spot" name="Net GEX" stroke={chartColors.put} strokeWidth={2} dot={false} isAnimationActive={false} />
                <ReferenceLine yAxisId="gex" y={0} stroke="#ffffff33" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-4 mb-5">
            <h2 className="text-sm font-bold text-gray-300 mb-2">Net DEX (near spot)</h2>
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={chartPoints} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                <XAxis dataKey="time" tick={{ fill: chartColors.axisTick, fontSize: 11 }} minTickGap={30} />
                <YAxis tick={{ fill: chartColors.axisTick, fontSize: 11 }} tickFormatter={fmtNum} />
                <Tooltip
                  contentStyle={{ background: '#111', border: '1px solid #333', borderRadius: 8, fontSize: 12 }}
                  formatter={(value, name) => [typeof value === 'number' ? fmtNum(value) : value, name]}
                />
                <Line type="monotone" dataKey="net_dex_near_spot" name="Net DEX" stroke={chartColors.call} strokeWidth={2} dot={false} isAnimationActive={false} />
                <ReferenceLine y={0} stroke="#ffffff33" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-4">
            <h2 className="text-sm font-bold text-gray-300 mb-2">Alert conviction by hour (bullish vs bearish bias)</h2>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={alertHourly} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                <XAxis dataKey="hourLabel" tick={{ fill: chartColors.axisTick, fontSize: 11 }} />
                <YAxis tick={{ fill: chartColors.axisTick, fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: '#111', border: '1px solid #333', borderRadius: 8, fontSize: 12 }}
                  formatter={(value, name) => [Math.abs(Number(value)), name]}
                />
                <Bar dataKey="bull" name="Bullish alerts" fill={chartColors.call} isAnimationActive={false} />
                <Bar dataKey="bear" name="Bearish alerts" fill={chartColors.put} isAnimationActive={false} />
                <ReferenceLine y={0} stroke="#ffffff33" />
              </BarChart>
            </ResponsiveContainer>
            <p className="text-xs text-gray-500 mt-2">
              Counts alerts with a clear bias (PUT_WRITING/LONG_BUILDUP/SHORT_COVERING = bullish, CALL_WRITING/SHORT_BUILDUP/LONG_UNWINDING = bearish); signal types with no directional read (OI_SPIKE etc.) are excluded.
            </p>
          </div>

          <p className="text-xs text-gray-500 mt-4">
            Net GEX/DEX readings come from GreekNova's always-on regime log, captured every ~1-3 minutes during market hours — not every tick, so sharp intraminute moves may look smoother here than they felt live.
          </p>
        </>
      )}
    </div>
  )
}

function StatCard({ label, value, accent, sub }: { label: string; value: React.ReactNode; accent?: string; sub?: string }) {
  return (
    <div className="bg-white/[0.02] border border-white/10 rounded-xl px-3 py-2.5">
      <div className="text-[10px] font-bold text-gray-500 tracking-wide">{label}</div>
      <div className={`text-lg font-black mt-0.5 ${accent ?? 'text-white'}`}>{value}</div>
      {sub && <div className="text-[10px] text-gray-500 mt-0.5">{sub}</div>}
    </div>
  )
}
