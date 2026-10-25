'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { RefreshCw } from 'lucide-react'
import Navbar from '@/components/Navbar'
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceArea, ResponsiveContainer,
} from 'recharts'
import { chartColors } from '@/lib/chartColors'
import { STOCKS as _CANON_SYMBOLS } from '@/lib/symbols'

const API = 'https://api.greeknova.com'
const INDICES = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY', 'SENSEX']
const STOCKS = _CANON_SYMBOLS

function fmtOI(n: number | null | undefined) {
  if (n === null || n === undefined || isNaN(n)) return '—'
  const abs = Math.abs(n)
  if (abs >= 10000000) return `${(n / 10000000).toFixed(2)}Cr`
  if (abs >= 100000) return `${(n / 100000).toFixed(2)}L`
  if (abs >= 1000) return `${(n / 1000).toFixed(1)}K`
  return n.toLocaleString('en-IN')
}
function fmtTime(ts: string) {
  const d = new Date(ts)
  const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000)
  return ist.toISOString().slice(11, 16)
}
function fmtDate(d: string) {
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) }
  catch { return d }
}
function todayISO() {
  const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
  return ist.toISOString().slice(0, 10)
}

type ChainStrike = { strike: number; is_atm: boolean }
type MetaData = {
  symbol: string; date: string; spot?: number; expiry?: string
  expiries?: string[]; chain?: ChainStrike[]; error?: string
}
type Point = { timestamp: string; oi: number; last_price: number; volume: number }
type Summary = {
  open_ltp: number | null; last_ltp: number | null; last_oi: number | null
  ltp_from_open_pct: number | null; oi_window_start: number | null; oi_window_pct: number | null
}
type HistoryData = {
  symbol: string; date: string; strike: number; option_type: string; expiry: string
  points: Point[]; summary: Summary | null; error?: string
}

export default function StrikeHistoryPage() {
  const [symbol, setSymbol] = useState('NIFTY')
  const [dates, setDates] = useState<string[]>([])
  const [date, setDate] = useState('')
  const [meta, setMeta] = useState<MetaData | null>(null)
  const [expiry, setExpiry] = useState('')
  const [strike, setStrike] = useState<number | null>(null)
  const [optionType, setOptionType] = useState<'PE' | 'CE'>('PE')
  const [data, setData] = useState<HistoryData | null>(null)
  const [loadingMeta, setLoadingMeta] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const isStock = STOCKS.includes(symbol)

  // Resets when symbol changes -- same pattern as /oihistory.
  useEffect(() => {
    setDates([]); setDate(''); setMeta(null); setExpiry(''); setStrike(null); setData(null)
  }, [symbol])

  // 1) Which dates have data for this symbol.
  const datesReq = useRef(0)
  useEffect(() => {
    const thisReq = ++datesReq.current
    fetch(`${API}/oi-dates/${symbol}`)
      .then(r => r.json())
      .then(json => {
        if (thisReq !== datesReq.current) return
        const ds: string[] = json.dates || []
        setDates(ds)
        if (ds.length) setDate(ds[0])
      })
      .catch(() => {})
  }, [symbol])

  // 2) Chain metadata for the picked date -- gives us expiries + strikes
  //    (incl. which one is ATM) to populate the pickers, reusing the
  //    existing Historical Chain endpoint (EOD snapshot, no timestamp=).
  const metaReq = useRef(0)
  const loadMeta = useCallback(async (sym: string, d: string) => {
    if (!d) return
    const thisReq = ++metaReq.current
    setLoadingMeta(true)
    try {
      const res = await fetch(`${API}/historical-chain/${sym}?date=${d}`)
      const json = await res.json()
      if (thisReq !== metaReq.current) return
      setMeta(json)
      if (json.expiries?.length && !json.expiries.includes(expiry)) setExpiry(json.expiries[0])
      const atm = (json.chain || []).find((c: ChainStrike) => c.is_atm)
      if (atm && strike === null) setStrike(atm.strike)
    } catch (e) {
      setMeta(null)
    } finally {
      setLoadingMeta(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => { loadMeta(symbol, date) }, [symbol, date, loadMeta])

  // 3) The actual strike's intraday OI+Premium series. Manual refresh only
  //    (v1 scope, Oct 25 2026 discussion w/ Manish) -- this is a post-mortem
  //    verification tool, not a live monitor; Alerts/UOA/Options Jungle
  //    already cover "live".
  const histReq = useRef(0)
  const loadHistory = useCallback(async () => {
    if (!date || strike === null) return
    const thisReq = ++histReq.current
    setLoadingHistory(true)
    try {
      const params = new URLSearchParams({
        date, strike: String(strike), option_type: optionType,
      })
      if (expiry) params.set('expiry', expiry)
      const res = await fetch(`${API}/strike-history/${symbol}?${params}&t=${Date.now()}`, { cache: 'no-store' })
      const json = await res.json()
      if (thisReq !== histReq.current) return
      setData(json)
    } catch (e) {
      setData(null)
    } finally {
      setLoadingHistory(false)
    }
  }, [symbol, date, strike, optionType, expiry])
  useEffect(() => { loadHistory() }, [loadHistory])

  const points = data?.points ?? []
  const chartPoints = points.map(p => ({ ...p, time: fmtTime(p.timestamp) }))
  const summary = data?.summary
  const strikes = meta?.chain?.map(c => c.strike) ?? []

  // Shade the last ~30 min of the session on both charts -- the same
  // window an OI-spike alert measures, so it's obvious which part of the
  // day the alert was actually reacting to.
  const windowStartTime = points.length
    ? (() => {
        const lastT = new Date(points[points.length - 1].timestamp).getTime()
        const target = lastT - 30 * 60 * 1000
        let w = points[0]
        for (const p of points) {
          if (new Date(p.timestamp).getTime() <= target) w = p
          else break
        }
        return fmtTime(w.timestamp)
      })()
    : null
  const lastTime = points.length ? fmtTime(points[points.length - 1].timestamp) : null

  return (
    <div className="min-h-screen bg-[#07070e] text-white">
      <Navbar active="/strike-history" />
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-black tracking-tight mb-1">🔬 Strike OI + Premium History</h1>
            <p className="text-gray-500 text-sm">
              See the real intraday OI and premium move behind one strike — verify an Alert or UOA signal instead of taking the badge's word for it.
            </p>
          </div>
          <button onClick={loadHistory} disabled={loadingHistory}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-sm font-medium text-white rounded-lg border border-gray-700 transition-all disabled:opacity-50">
            <RefreshCw size={13} className={loadingHistory ? 'animate-spin' : ''} />Refresh
          </button>
        </div>

        {/* Symbol selector */}
        <div className="flex flex-wrap gap-2 mb-4 items-center">
          {INDICES.map(idx => (
            <button key={idx} onClick={() => setSymbol(idx)}
              className={`px-5 py-2.5 rounded-xl text-sm font-bold border transition-all ${symbol === idx ? 'bg-white text-gray-900 border-white' : 'bg-gray-900/40 text-gray-400 border-gray-800 hover:text-white'}`}>
              {idx}
            </button>
          ))}
          <select
            value={isStock ? symbol : ''}
            onChange={e => e.target.value && setSymbol(e.target.value)}
            className={`rounded-xl text-sm font-bold border transition-all px-4 py-2.5 focus:outline-none focus:border-white
              ${isStock ? 'bg-white text-gray-900 border-white' : 'bg-gray-900/40 text-gray-400 border-gray-800 hover:text-white'}`}>
            <option value="">Stocks ▾</option>
            {STOCKS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-end gap-4 mb-6">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-gray-500 font-bold tracking-wide">DATE</span>
            <select value={date} onChange={e => setDate(e.target.value)} disabled={!dates.length}
              className="bg-gray-900 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500 disabled:opacity-50">
              {dates.length === 0 && <option>—</option>}
              {dates.map(d => <option key={d} value={d}>{fmtDate(d)}{d === todayISO() ? ' (today)' : ''}</option>)}
            </select>
          </div>

          {!!meta?.expiries?.length && (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-gray-500 font-bold tracking-wide">EXPIRY</span>
              <select value={expiry} onChange={e => setExpiry(e.target.value)}
                className="bg-gray-900 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500">
                {meta.expiries.map(e => <option key={e} value={e}>{fmtDate(e)}</option>)}
              </select>
            </div>
          )}

          {!!strikes.length && (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-gray-500 font-bold tracking-wide">STRIKE</span>
              <select value={strike ?? ''} onChange={e => setStrike(Number(e.target.value))}
                className="bg-gray-900 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500">
                {strikes.map(s => (
                  <option key={s} value={s}>
                    {s.toLocaleString()}{meta?.chain?.find(c => c.strike === s)?.is_atm ? ' ⭐ ATM' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-gray-500 font-bold tracking-wide">TYPE</span>
            <div className="flex items-center gap-1 bg-gray-900 border border-gray-800 rounded-lg p-1">
              {(['PE', 'CE'] as const).map(t => (
                <button key={t} onClick={() => setOptionType(t)}
                  className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${
                    optionType === t
                      ? (t === 'PE' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white')
                      : 'text-gray-500 hover:text-white'
                  }`}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {loadingMeta && <span className="text-xs text-gray-600">loading strikes…</span>}
        </div>

        {data?.error && (
          <div className="h-48 flex items-center justify-center flex-col gap-2">
            <div className="text-3xl">📊</div>
            <p className="text-gray-500 text-sm">{data.error}</p>
          </div>
        )}

        {!data?.error && summary && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
              <StatCard label="SYMBOL / STRIKE" value={`${data!.symbol} ${data!.strike} ${data!.option_type}`} sub={`exp ${fmtDate(data!.expiry)}`} />
              <StatCard label="OPEN → LAST" value={`₹${summary.open_ltp?.toFixed(2) ?? '—'} → ₹${summary.last_ltp?.toFixed(2) ?? '—'}`} />
              <StatCard
                label="PREMIUM (FROM OPEN)"
                value={summary.ltp_from_open_pct !== null ? `${summary.ltp_from_open_pct >= 0 ? '+' : ''}${summary.ltp_from_open_pct}%` : '—'}
                accent={summary.ltp_from_open_pct !== null ? (summary.ltp_from_open_pct >= 0 ? 'text-red-400' : 'text-emerald-400') : undefined}
              />
              <StatCard label="LAST OI" value={fmtOI(summary.last_oi)} />
              <StatCard
                label="OI (LAST ~30 MIN)"
                value={summary.oi_window_pct !== null ? `${summary.oi_window_pct >= 0 ? '+' : ''}${summary.oi_window_pct}%` : '—'}
                accent={summary.oi_window_pct !== null && summary.oi_window_pct >= 0 ? 'text-emerald-400' : 'text-gray-300'}
              />
            </div>

            <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-4 mb-5">
              <h2 className="text-sm font-bold text-gray-300 mb-2">Open Interest</h2>
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={chartPoints} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                  <XAxis dataKey="time" tick={{ fill: chartColors.axisTick, fontSize: 11 }} minTickGap={30} />
                  <YAxis tick={{ fill: chartColors.axisTick, fontSize: 11 }} tickFormatter={fmtOI} domain={['auto', 'auto']} />
                  <Tooltip
                    contentStyle={{ background: '#111', border: '1px solid #333', borderRadius: 8, fontSize: 12 }}
                    formatter={(v) => [typeof v === 'number' ? fmtOI(v) : v, 'OI']}
                  />
                  {windowStartTime && lastTime && (
                    <ReferenceArea x1={windowStartTime} x2={lastTime} fill={chartColors.spot} fillOpacity={0.08} />
                  )}
                  <Area type="monotone" dataKey="oi" stroke={chartColors.spot} fill={chartColors.spot} fillOpacity={0.12} strokeWidth={2} isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-4 mb-3">
              <h2 className="text-sm font-bold text-gray-300 mb-2">Premium (LTP)</h2>
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={chartPoints} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                  <XAxis dataKey="time" tick={{ fill: chartColors.axisTick, fontSize: 11 }} minTickGap={30} />
                  <YAxis tick={{ fill: chartColors.axisTick, fontSize: 11 }} domain={[0, 'auto']} tickFormatter={v => `₹${v}`} />
                  <Tooltip
                    contentStyle={{ background: '#111', border: '1px solid #333', borderRadius: 8, fontSize: 12 }}
                    formatter={(v) => [typeof v === 'number' ? `₹${v.toFixed(2)}` : v, 'LTP']}
                  />
                  {windowStartTime && lastTime && (
                    <ReferenceArea x1={windowStartTime} x2={lastTime} fill={optionType === 'PE' ? chartColors.call : chartColors.put} fillOpacity={0.08} />
                  )}
                  <Area type="monotone" dataKey="last_price" stroke={optionType === 'PE' ? chartColors.call : chartColors.put}
                    fill={optionType === 'PE' ? chartColors.call : chartColors.put} fillOpacity={0.12} strokeWidth={2} isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <p className="text-xs text-gray-500">
              Shaded band = the last ~30 min of the session, the same window an OI-spike Alert measures. Snapshots are captured every ~5 min during market hours, so this is a close read of the real move, not tick-by-tick. This page shows the raw numbers only — it doesn't render its own bullish/bearish verdict.
            </p>
          </>
        )}

        {!data?.error && !summary && !loadingHistory && (
          <div className="h-48 flex items-center justify-center flex-col gap-2">
            <div className="text-3xl">📊</div>
            <p className="text-gray-500 text-sm">Pick a date, expiry and strike above</p>
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, accent, sub }: { label: string; value: React.ReactNode; accent?: string; sub?: string }) {
  return (
    <div className="bg-white/[0.02] border border-white/10 rounded-xl px-3 py-2.5">
      <div className="text-[10px] font-bold text-gray-500 tracking-wide">{label}</div>
      <div className={`text-base font-black mt-0.5 truncate ${accent ?? 'text-white'}`}>{value}</div>
      {sub && <div className="text-[10px] text-gray-500 mt-0.5">{sub}</div>}
    </div>
  )
}
