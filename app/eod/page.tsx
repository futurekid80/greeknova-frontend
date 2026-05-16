'use client'
import { useEffect, useState, useCallback } from 'react'
import { RefreshCw } from 'lucide-react'
import Navbar from '@/components/Navbar'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip,
  ReferenceLine, ResponsiveContainer, CartesianGrid, Legend
} from 'recharts'

const API = 'https://greeknova-backend-production.up.railway.app'
const INDICES = ['NIFTY', 'BANKNIFTY', 'FINNIFTY']
const STOCKS = [
  'RELIANCE','TCS','HDFCBANK','INFY','ICICIBANK','HINDUNILVR','ITC','SBIN','BHARTIARTL',
  'KOTAKBANK','LT','AXISBANK','ASIANPAINT','MARUTI','TITAN','SUNPHARMA','ULTRACEMCO',
  'BAJFINANCE','WIPRO','HCLTECH','TATACONSUM','TATASTEEL','ADANIENT','POWERGRID','NTPC',
  'ONGC','JSWSTEEL','COALINDIA','BAJAJFINSV','TECHM','APOLLOHOSP','BAJAJ-AUTO','BPCL',
  'BRITANNIA','CIPLA','DRREDDY','EICHERMOT','GRASIM','HEROMOTOCO','HINDALCO','HDFCLIFE',
  'INDUSINDBK','JIOFIN','M&M','NESTLEIND','SBILIFE','SHRIRAMFIN','TRENT','ADANIPORTS',
  'BANKBARODA','BEL','CANBK','CHOLAFIN','DLF','GAIL','HAVELLS','HAL','INDIGO','PFC',
  'RECLTD','SAIL','TATAPOWER','VEDL',
]

function fmtOI(n: number) {
  const abs = Math.abs(n)
  if (abs >= 10000000) return `${(n/10000000).toFixed(2)}Cr`
  if (abs >= 100000)   return `${(n/100000).toFixed(1)}L`
  return n.toLocaleString()
}
function fmtDate(d: string) {
  try { return new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'2-digit' }) }
  catch { return d }
}

interface JourneyPoint { time: string; ce_oi: number; pe_oi: number; pcr: number }
interface Row {
  strike: number
  ce_open: number; ce_close: number; ce_chg: number
  pe_open: number; pe_close: number; pe_chg: number
  net_chg: number
  has_whale: boolean; has_spike: boolean; high_conv: boolean
  uoa_detail?: { vol_oi_ratio: number; oi_chg_pct: number; option_type: string; volume: number }
  jungle_detail?: { oi_pct: number; direction: string; option_type: string }
}
interface Summary {
  bias: string; bias_strength: string; bullish: boolean
  pcr_open: number; pcr_close: number; pcr_trend: string
  pcr_high: number; pcr_low: number; pcr_high_time: string; pcr_low_time: string
  total_ce_chg: number; total_pe_chg: number
  ce_built: number; pe_built: number; ce_unwound: number; pe_unwound: number
  max_ce_strike: number; max_pe_strike: number
  total_ce_oi: number; total_pe_oi: number
  max_pain: number; days_to_expiry: number | null
  cmp: number; dist_to_resistance: number | null
  dist_to_support: number | null; dist_to_max_pain: number | null
  cmp_position: string
  support_level: number; resistance_level: number
  top_ce_builds: Row[]; top_pe_builds: Row[]
  top_ce_unwinds: Row[]; top_pe_unwinds: Row[]
  top_ce_oi: { strike: number; oi: number }[]
  top_pe_oi: { strike: number; oi: number }[]
  watchlist_notes: string[]
  whale_strikes: number[]; spike_strikes: number[]; high_conv_strikes: number[]
}
interface Data {
  symbol: string; date: string; dates: string[]
  expiry: string; expiries: string[]
  open_time: string; close_time: string; snapshots: number
  cmp: number; journey: JourneyPoint[]; rows: Row[]; summary: Summary
}

function ConvBadges({ row }: { row: Row }) {
  if (!row.has_whale && !row.has_spike) return null
  return (
    <div className="flex gap-1 flex-wrap mt-1">
      {row.high_conv && <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-950 text-orange-400 border border-orange-800/50 font-bold">🔥 High Conv</span>}
      {!row.high_conv && row.has_whale && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-950 text-blue-400 border border-blue-800/50 font-bold">🐋 Whale</span>}
      {!row.high_conv && row.has_spike && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800/50 font-bold">⚡ Spike</span>}
    </div>
  )
}

const LineTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-3 shadow-xl text-xs">
      <p className="text-white font-bold mb-1">{label}</p>
      <p className="text-red-400">CE OI: {fmtOI(d?.ce_oi)}</p>
      <p className="text-emerald-400">PE OI: {fmtOI(d?.pe_oi)}</p>
      <p className="text-amber-400">PCR: {d?.pcr}</p>
    </div>
  )
}

const BarTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-3 shadow-xl text-xs">
      <p className="text-white font-bold mb-1">Strike: {Number(label).toLocaleString()}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>{p.name}: {fmtOI(p.value)}</p>
      ))}
    </div>
  )
}

export default function EODAnalysis() {
  const [symbol, setSymbol] = useState('NIFTY')
  const [data, setData]     = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [date, setDate]     = useState('')
  const [expiry, setExpiry] = useState('')
  const [view, setView]     = useState<'chart'|'table'>('chart')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (date)   params.set('date', date)
      if (expiry) params.set('expiry', expiry)
      const res  = await fetch(`${API}/eod-analysis/${symbol}?${params}`)
      const json = await res.json()
      setData(json)
      if (!date   && json.date)   setDate(json.date)
      if (!expiry && json.expiry) setExpiry(json.expiry)
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [symbol, date, expiry])

  useEffect(() => { setDate(''); setExpiry('') }, [symbol])
  useEffect(() => { fetchData() }, [symbol, date, expiry])

  const isStock = STOCKS.includes(symbol)
  const s = data?.summary

  const chartData = data?.rows
    .map(r => ({ strike: r.strike, 'CE Δ': r.ce_chg, 'PE Δ': r.pe_chg }))
    .sort((a,b) => Math.abs(b['CE Δ']+b['PE Δ']) - Math.abs(a['CE Δ']+a['PE Δ']))
    .slice(0, 15)
    .sort((a,b) => a.strike - b.strike) || []

  const pcrChart = (data?.journey || []).filter((_, i) => i % 2 === 0)

  return (
    <div className="min-h-screen bg-[#07070e] text-white">
      <Navbar active="/eod" />
      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="text-3xl font-black tracking-tight mb-1">EOD Analysis</h1>
            <p className="text-gray-500 text-sm">Daily digest · What happened · What to watch tomorrow · All signals in one place</p>
          </div>
          <button onClick={fetchData} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-sm font-medium text-white rounded-lg border border-gray-700 transition-all disabled:opacity-50">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />Refresh
          </button>
        </div>

        {/* Symbol selector */}
        <div className="flex flex-wrap gap-2 mb-4 items-center">
          {INDICES.map(idx => (
            <button key={idx} onClick={() => setSymbol(idx)}
              className={`px-5 py-2.5 rounded-xl text-sm font-bold border transition-all ${symbol===idx ? 'bg-white text-gray-900 border-white' : 'bg-gray-900/40 text-gray-400 border-gray-800 hover:text-white'}`}>
              {idx}
            </button>
          ))}
          <select value={isStock ? symbol : ''} onChange={e => e.target.value && setSymbol(e.target.value)}
            className={`rounded-xl text-sm font-bold border transition-all px-4 py-2.5 focus:outline-none ${isStock ? 'bg-white text-gray-900 border-white' : 'bg-gray-900/40 text-gray-400 border-gray-800'}`}>
            <option value="">Stocks ▾</option>
            {STOCKS.map(st => <option key={st} value={st}>{st}</option>)}
          </select>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Date:</span>
            <select value={date} onChange={e => setDate(e.target.value)}
              className="bg-gray-900 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500">
              {data?.dates.map(d => <option key={d} value={d}>{fmtDate(d)}</option>)}
            </select>
          </div>
          {data?.expiries && data.expiries.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Expiry:</span>
              <select value={expiry} onChange={e => setExpiry(e.target.value)}
                className="bg-gray-900 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500">
                {data.expiries.map(e => <option key={e} value={e}>{fmtDate(e)}</option>)}
              </select>
            </div>
          )}
          {data && (
            <div className="text-xs text-gray-600 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2">
              📸 {data.snapshots} snapshots · {data.open_time} → {data.close_time} IST
            </div>
          )}
          <div className="flex items-center gap-1 ml-auto bg-gray-900 border border-gray-800 rounded-lg p-1">
            {(['chart','table'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${view===v ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-white'}`}>
                {v === 'chart' ? '📊 Chart' : '📋 Table'}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="h-64 flex items-center justify-center flex-col gap-3">
            <RefreshCw size={24} className="text-gray-600 animate-spin"/>
            <p className="text-xs text-gray-600">Loading full day data…</p>
          </div>
        ) : !data?.rows.length ? (
          <div className="h-64 flex items-center justify-center flex-col gap-3">
            <div className="text-4xl">📈</div>
            <p className="text-gray-500 text-sm">No data for {symbol} on this date</p>
          </div>
        ) : s ? (
          <>
            {/* ══ SECTION 1: DAY VERDICT ══════════════════════════════════════ */}
            <div className={`rounded-2xl border p-6 mb-4 ${
              s.bias === 'BULLISH' ? 'bg-emerald-950/20 border-emerald-800/40' :
              s.bias === 'BEARISH' ? 'bg-red-950/20 border-red-800/40' :
              'bg-amber-950/20 border-amber-800/40'}`}>

              {/* Verdict row */}
              <div className="flex items-start justify-between mb-5">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Day Verdict</p>
                  <div className="flex items-center gap-3 flex-wrap">
                    <h2 className={`text-2xl font-black ${
                      s.bias === 'BULLISH' ? 'text-emerald-400' :
                      s.bias === 'BEARISH' ? 'text-red-400' : 'text-amber-400'}`}>
                      {s.bias === 'BULLISH' ? '🐂' : s.bias === 'BEARISH' ? '🐻' : '➖'} {s.bias_strength} {s.bias}
                    </h2>
                    <span className={`text-xs px-2.5 py-1 rounded-lg font-bold border ${
                      s.pcr_trend === 'RISING'  ? 'text-emerald-400 bg-emerald-950/60 border-emerald-800' :
                      s.pcr_trend === 'FALLING' ? 'text-red-400 bg-red-950/60 border-red-800' :
                      'text-gray-400 bg-gray-800 border-gray-700'}`}>
                      PCR {s.pcr_trend} · {s.pcr_open} → {s.pcr_close}
                    </span>
                    {s.high_conv_strikes.length > 0 && (
                      <span className="text-xs px-2.5 py-1 rounded-lg font-bold border text-orange-400 bg-orange-950/60 border-orange-800">
                        🔥 {s.high_conv_strikes.length} High Conv Strike{s.high_conv_strikes.length > 1 ? 's' : ''}
                      </span>
                    )}
                    {s.days_to_expiry !== null && (
                      <span className={`text-xs px-2.5 py-1 rounded-lg font-bold border ${
                        (s.days_to_expiry ?? 99) <= 2 ? 'text-red-400 bg-red-950/60 border-red-800' :
                        (s.days_to_expiry ?? 99) <= 7 ? 'text-orange-400 bg-orange-950/60 border-orange-800' :
                        'text-gray-400 bg-gray-800 border-gray-700'}`}>
                        ⏰ {s.days_to_expiry}d to expiry
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {data.symbol} · {fmtDate(data.date)} · {data.open_time} – {data.close_time} IST · {data.snapshots} captures
                  </p>
                </div>

                {/* CMP badge — top right */}
                {s.cmp > 0 && (
                  <div className={`rounded-xl border px-4 py-3 text-right min-w-[140px] ${
                    s.cmp_position === 'ABOVE_RESISTANCE' ? 'bg-emerald-950/40 border-emerald-700' :
                    s.cmp_position === 'BELOW_SUPPORT'    ? 'bg-red-950/40 border-red-700' :
                    'bg-gray-900 border-gray-700'}`}>
                    <p className="text-xs text-gray-500 mb-0.5">Last Price</p>
                    <p className="text-2xl font-black text-white">₹{s.cmp.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</p>
                    <p className={`text-xs font-semibold mt-0.5 ${
                      s.cmp_position === 'ABOVE_RESISTANCE' ? 'text-emerald-400' :
                      s.cmp_position === 'BELOW_SUPPORT'    ? 'text-red-400' :
                      'text-gray-400'}`}>
                      {s.cmp_position === 'ABOVE_RESISTANCE' ? '🚀 Above resistance' :
                       s.cmp_position === 'BELOW_SUPPORT'    ? '⚠️ Below support' :
                       '↔ Inside range'}
                    </p>
                  </div>
                )}
              </div>

              {/* Key levels — 5 boxes */}
              <div className="grid grid-cols-5 gap-3 mb-3">
                <div className="bg-red-950/30 border border-red-900/40 rounded-xl p-3">
                  <p className="text-xs text-gray-500 mb-1">CE Wall (Resistance)</p>
                  <p className="text-xl font-black text-red-400">{s.max_ce_strike.toLocaleString()}</p>
                  <p className="text-xs text-gray-600">{fmtOI(s.total_ce_oi)} total CE</p>
                  {s.dist_to_resistance !== null && (
                    <p className="text-xs text-gray-500 mt-0.5">{s.dist_to_resistance.toFixed(1)}% away</p>
                  )}
                  {s.whale_strikes.includes(s.max_ce_strike) && <p className="text-[10px] text-blue-400 mt-1">🐋 Whale here</p>}
                </div>

                <div className="bg-emerald-950/30 border border-emerald-900/40 rounded-xl p-3">
                  <p className="text-xs text-gray-500 mb-1">PE Wall (Support)</p>
                  <p className="text-xl font-black text-emerald-400">{s.max_pe_strike.toLocaleString()}</p>
                  <p className="text-xs text-gray-600">{fmtOI(s.total_pe_oi)} total PE</p>
                  {s.dist_to_support !== null && (
                    <p className="text-xs text-gray-500 mt-0.5">{s.dist_to_support.toFixed(1)}% away</p>
                  )}
                  {s.whale_strikes.includes(s.max_pe_strike) && <p className="text-[10px] text-blue-400 mt-1">🐋 Whale here</p>}
                </div>

                <div className="bg-amber-950/30 border border-amber-900/40 rounded-xl p-3">
                  <p className="text-xs text-gray-500 mb-1">🎯 Max Pain</p>
                  <p className="text-xl font-black text-amber-400">{s.max_pain.toLocaleString()}</p>
                  <p className="text-xs text-gray-600">Writers' target</p>
                  {s.dist_to_max_pain !== null && (
                    <p className={`text-xs mt-0.5 ${Math.abs(s.dist_to_max_pain) < 0.5 ? 'text-orange-400' : 'text-gray-500'}`}>
                      CMP {s.dist_to_max_pain > 0 ? '+' : ''}{s.dist_to_max_pain.toFixed(1)}% vs MP
                    </p>
                  )}
                </div>

                <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-3">
                  <p className="text-xs text-gray-500 mb-1">CE OI Change</p>
                  <p className={`text-xl font-black ${s.total_ce_chg > 0 ? 'text-red-400' : 'text-orange-400'}`}>
                    {s.total_ce_chg > 0 ? '+' : ''}{fmtOI(s.total_ce_chg)}
                  </p>
                  <p className="text-xs text-gray-600">{s.total_ce_chg > 0 ? 'Resistance building' : 'Resistance easing'}</p>
                </div>

                <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-3">
                  <p className="text-xs text-gray-500 mb-1">PE OI Change</p>
                  <p className={`text-xl font-black ${s.total_pe_chg > 0 ? 'text-emerald-400' : 'text-yellow-400'}`}>
                    {s.total_pe_chg > 0 ? '+' : ''}{fmtOI(s.total_pe_chg)}
                  </p>
                  <p className="text-xs text-gray-600">{s.total_pe_chg > 0 ? 'Support building' : 'Support weakening'}</p>
                </div>
              </div>

              {/* PCR range strip */}
              {s.pcr_high > 0 && (
                <div className="pt-3 border-t border-gray-800/50 flex items-center gap-6 text-xs text-gray-500 flex-wrap">
                  <span className="text-gray-400 font-semibold">PCR today:</span>
                  <span>Open <span className="text-white font-bold">{s.pcr_open}</span></span>
                  <span>Close <span className="text-white font-bold">{s.pcr_close}</span></span>
                  <span>Low <span className="text-red-400 font-bold">{s.pcr_low}</span> at {s.pcr_low_time}</span>
                  <span>High <span className="text-emerald-400 font-bold">{s.pcr_high}</span> at {s.pcr_high_time}</span>
                  <span>Swing <span className="text-amber-400 font-bold">{(s.pcr_high - s.pcr_low).toFixed(3)}</span></span>
                </div>
              )}
            </div>

            {/* ══ SECTION 2: TOMORROW'S WATCHLIST ════════════════════════════ */}
            <div className="bg-gray-900/30 border border-gray-700 rounded-2xl p-5 mb-6">
              <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                📌 Tomorrow's Watchlist
                <span className="text-xs text-gray-500 font-normal">— derived from today's data, not predictions</span>
              </h2>
              <div className="space-y-2">
                {s.watchlist_notes.map((note, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-sm text-gray-300 leading-relaxed">
                    <span className="text-gray-600 mt-0.5 flex-shrink-0">→</span>
                    <span>{note}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ══ SECTION 3: SMART MONEY ══════════════════════════════════════ */}
            <div className="grid grid-cols-2 gap-4 mb-6">

              {/* CE side */}
              <div className="bg-gray-900/30 border border-gray-800 rounded-2xl p-5">
                <h3 className="text-sm font-bold text-red-400 mb-4">🔴 Call Side (Resistance Activity)</h3>

                <div className="mb-4">
                  <p className="text-xs text-gray-500 font-semibold mb-2">Highest CE OI at Close — actual walls</p>
                  <div className="space-y-1.5">
                    {s.top_ce_oi.map((r, i) => (
                      <div key={i} className={`flex items-center gap-2 rounded-lg px-3 py-1.5 ${i === 0 ? 'bg-red-950/20 border border-red-900/30' : 'bg-gray-900/30'}`}>
                        <span className={`text-sm font-bold flex-1 ${i === 0 ? 'text-red-300' : 'text-gray-300'}`}>{r.strike.toLocaleString()}</span>
                        <span className="text-xs text-red-400">{fmtOI(r.oi)}</span>
                        {i === 0 && <span className="text-[9px] text-red-400 bg-red-950/60 px-1.5 py-0.5 rounded font-bold">MAX</span>}
                        {s.whale_strikes.includes(r.strike) && <span className="text-[9px]">🐋</span>}
                        {s.spike_strikes.includes(r.strike) && <span className="text-[9px]">⚡</span>}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mb-4">
                  <p className="text-xs text-gray-500 font-semibold mb-2">New Resistance Built today</p>
                  <div className="space-y-2">
                    {s.top_ce_builds.length === 0
                      ? <p className="text-xs text-gray-600">No significant CE builds</p>
                      : s.top_ce_builds.map((r, i) => (
                      <div key={i} className={`rounded-lg px-3 py-2 border ${
                        r.high_conv ? 'bg-orange-950/20 border-orange-800/40' :
                        r.has_whale ? 'bg-blue-950/10 border-blue-900/20' :
                        'bg-red-950/10 border-red-900/20'}`}>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-white">{r.strike.toLocaleString()}</span>
                          <span className="text-xs text-red-400 font-bold">+{fmtOI(r.ce_chg)} CE</span>
                        </div>
                        <ConvBadges row={r} />
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs text-gray-500 font-semibold mb-2">Resistance Easing (CE Unwinds)</p>
                  <div className="space-y-2">
                    {s.top_ce_unwinds.length === 0
                      ? <p className="text-xs text-gray-600">No significant CE unwinds</p>
                      : s.top_ce_unwinds.map((r, i) => (
                      <div key={i} className="bg-orange-950/10 border border-orange-900/20 rounded-lg px-3 py-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-white">{r.strike.toLocaleString()}</span>
                          <span className="text-xs text-orange-400 font-bold">{fmtOI(r.ce_chg)} CE</span>
                        </div>
                        <ConvBadges row={r} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* PE side */}
              <div className="bg-gray-900/30 border border-gray-800 rounded-2xl p-5">
                <h3 className="text-sm font-bold text-emerald-400 mb-4">🟢 Put Side (Support Activity)</h3>

                <div className="mb-4">
                  <p className="text-xs text-gray-500 font-semibold mb-2">Highest PE OI at Close — actual floors</p>
                  <div className="space-y-1.5">
                    {s.top_pe_oi.map((r, i) => (
                      <div key={i} className={`flex items-center gap-2 rounded-lg px-3 py-1.5 ${i === 0 ? 'bg-emerald-950/20 border border-emerald-900/30' : 'bg-gray-900/30'}`}>
                        <span className={`text-sm font-bold flex-1 ${i === 0 ? 'text-emerald-300' : 'text-gray-300'}`}>{r.strike.toLocaleString()}</span>
                        <span className="text-xs text-emerald-400">{fmtOI(r.oi)}</span>
                        {i === 0 && <span className="text-[9px] text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded font-bold">MAX</span>}
                        {s.whale_strikes.includes(r.strike) && <span className="text-[9px]">🐋</span>}
                        {s.spike_strikes.includes(r.strike) && <span className="text-[9px]">⚡</span>}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mb-4">
                  <p className="text-xs text-gray-500 font-semibold mb-2">New Support Built today</p>
                  <div className="space-y-2">
                    {s.top_pe_builds.length === 0
                      ? <p className="text-xs text-gray-600">No significant PE builds</p>
                      : s.top_pe_builds.map((r, i) => (
                      <div key={i} className={`rounded-lg px-3 py-2 border ${
                        r.high_conv ? 'bg-orange-950/20 border-orange-800/40' :
                        r.has_whale ? 'bg-blue-950/10 border-blue-900/20' :
                        'bg-emerald-950/10 border-emerald-900/20'}`}>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-white">{r.strike.toLocaleString()}</span>
                          <span className="text-xs text-emerald-400 font-bold">+{fmtOI(r.pe_chg)} PE</span>
                        </div>
                        <ConvBadges row={r} />
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs text-gray-500 font-semibold mb-2">Support Weakening (PE Unwinds)</p>
                  <div className="space-y-2">
                    {s.top_pe_unwinds.length === 0
                      ? <p className="text-xs text-gray-600">No significant PE unwinds</p>
                      : s.top_pe_unwinds.map((r, i) => (
                      <div key={i} className="bg-yellow-950/10 border border-yellow-900/20 rounded-lg px-3 py-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-white">{r.strike.toLocaleString()}</span>
                          <span className="text-xs text-yellow-400 font-bold">{fmtOI(r.pe_chg)} PE</span>
                        </div>
                        <ConvBadges row={r} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Convergence legend */}
            {(s.whale_strikes.length > 0 || s.spike_strikes.length > 0) && (
              <div className="bg-gray-900/20 border border-gray-800/50 rounded-xl px-4 py-3 mb-6 flex items-center gap-6 text-xs text-gray-500 flex-wrap">
                <span className="text-gray-300 font-semibold">Signal convergence:</span>
                <span>🔥 <span className="text-orange-400">High Conv</span> = Whale + OI Spike same strike</span>
                <span>🐋 <span className="text-blue-400">Whale</span> = Large player UOA activity</span>
                <span>⚡ <span className="text-amber-400">Spike</span> = Sudden OI surge (Options Jungle)</span>
              </div>
            )}

            {/* ══ SECTION 4: INTRADAY JOURNEY ════════════════════════════════ */}
            {data.journey.length > 1 && (
              <div className="bg-gray-900/30 border border-gray-800 rounded-2xl p-6 mb-6">
                <h2 className="text-base font-bold text-white mb-1">Intraday OI Journey</h2>
                <p className="text-xs text-gray-500 mb-5">CE vs PE total OI · full session {data.open_time} → {data.close_time} IST</p>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={pcrChart} margin={{ top:5, right:20, left:10, bottom:5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false}/>
                    <XAxis dataKey="time" tick={{ fill:'#6b7280', fontSize:10 }} tickLine={false} axisLine={false}
                      interval={Math.floor(pcrChart.length / 8)}/>
                    <YAxis tick={{ fill:'#6b7280', fontSize:10 }} tickLine={false} axisLine={false}
                      tickFormatter={v => fmtOI(v)}/>
                    <Tooltip content={<LineTooltip/>} cursor={{ stroke:'rgba(255,255,255,0.1)' }}/>
                    <Legend wrapperStyle={{ paddingTop:'12px', fontSize:'12px' }}/>
                    <Line type="monotone" dataKey="ce_oi" name="CE OI" stroke="#ef4444" strokeWidth={2} dot={false}/>
                    <Line type="monotone" dataKey="pe_oi" name="PE OI" stroke="#10b981" strokeWidth={2} dot={false}/>
                  </LineChart>
                </ResponsiveContainer>

                {/* PCR chart */}
                <div className="mt-4 pt-4 border-t border-gray-800">
                  <p className="text-xs text-gray-500 mb-3">
                    PCR through the day · <span className="text-emerald-400">above 1.0 = bullish</span> · <span className="text-red-400">below 0.8 = bearish</span>
                  </p>
                  <ResponsiveContainer width="100%" height={120}>
                    <LineChart data={pcrChart} margin={{ top:5, right:20, left:10, bottom:5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false}/>
                      <XAxis dataKey="time" tick={{ fill:'#6b7280', fontSize:9 }} tickLine={false} axisLine={false}
                        interval={Math.floor(pcrChart.length / 8)}/>
                      <YAxis tick={{ fill:'#6b7280', fontSize:9 }} tickLine={false} axisLine={false} domain={['auto','auto']}/>
                      <Tooltip
                        formatter={(v: any) => [v, 'PCR']}
                        contentStyle={{ background:'#111827', border:'1px solid #374151', borderRadius:'8px', fontSize:'11px' }}
                        labelStyle={{ color:'white' }}/>
                      <ReferenceLine y={1.0} stroke="#10b981" strokeDasharray="3 3" strokeOpacity={0.4} label={{ value:'1.0', fill:'#10b981', fontSize:9 }}/>
                      <ReferenceLine y={0.8} stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.4} label={{ value:'0.8', fill:'#ef4444', fontSize:9 }}/>
                      <Line type="monotone" dataKey="pcr" stroke="#f59e0b" strokeWidth={2} dot={false}/>
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* ══ SECTION 5: STRIKE DETAIL ════════════════════════════════════ */}
            {view === 'chart' ? (
              <div className="bg-gray-900/30 border border-gray-800 rounded-2xl p-6 mb-6">
                <h2 className="text-base font-bold text-white mb-1">OI Change by Strike</h2>
                <p className="text-xs text-gray-500 mb-5">Open → Close · Top 15 most active strikes · Positive = buildup</p>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData} margin={{ top:5, right:10, left:10, bottom:5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false}/>
                    <XAxis dataKey="strike" tick={{ fill:'#6b7280', fontSize:10 }} tickLine={false} axisLine={false}
                      tickFormatter={v => v>=1000 ? `${(v/1000).toFixed(0)}k` : v}/>
                    <YAxis tick={{ fill:'#6b7280', fontSize:10 }} tickLine={false} axisLine={false}
                      tickFormatter={v => fmtOI(v)}/>
                    <Tooltip content={<BarTooltip/>} cursor={{ fill:'rgba(255,255,255,0.03)' }}/>
                    <Legend wrapperStyle={{ paddingTop:'16px', fontSize:'12px' }}/>
                    <ReferenceLine y={0} stroke="#374151"/>
                    <Bar dataKey="CE Δ" name="CE Change" fill="#ef4444" opacity={0.85} radius={[3,3,0,0]}/>
                    <Bar dataKey="PE Δ" name="PE Change" fill="#10b981" opacity={0.85} radius={[3,3,0,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="bg-gray-900/20 border border-gray-800 rounded-2xl overflow-hidden mb-6">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-800 bg-gray-900/60">
                      <th className="py-3 px-4 text-center text-amber-400 font-bold">Strike</th>
                      <th className="py-3 px-3 text-center text-gray-500">Signals</th>
                      <th className="py-3 px-3 text-right text-red-400">CE Open</th>
                      <th className="py-3 px-3 text-right text-red-400">CE Close</th>
                      <th className="py-3 px-3 text-right text-red-400">CE Δ</th>
                      <th className="py-3 px-3 text-right text-emerald-400">PE Open</th>
                      <th className="py-3 px-3 text-right text-emerald-400">PE Close</th>
                      <th className="py-3 px-3 text-right text-emerald-400">PE Δ</th>
                      <th className="py-3 px-3 text-right text-cyan-400">Bias</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map(row => (
                      <tr key={row.strike}
                        className={`border-b border-gray-800/50 hover:bg-gray-800/20 ${
                          row.high_conv ? 'bg-orange-950/10' :
                          row.has_whale ? 'bg-blue-950/5' : ''}`}>
                        <td className="py-2 px-4 text-center font-bold text-amber-400">
                          {row.strike.toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <div className="flex gap-1 justify-center">
                            {row.high_conv  && <span title="High Conviction">🔥</span>}
                            {!row.high_conv && row.has_whale && <span title="Whale">🐋</span>}
                            {!row.high_conv && row.has_spike && <span title="OI Spike">⚡</span>}
                          </div>
                        </td>
                        <td className="py-2 px-3 text-right text-gray-500">{fmtOI(row.ce_open)}</td>
                        <td className="py-2 px-3 text-right text-gray-300">{fmtOI(row.ce_close)}</td>
                        <td className={`py-2 px-3 text-right font-semibold ${row.ce_chg>0?'text-red-400':row.ce_chg<0?'text-orange-400':'text-gray-600'}`}>
                          {row.ce_chg>0?'+':''}{fmtOI(row.ce_chg)}
                        </td>
                        <td className="py-2 px-3 text-right text-gray-500">{fmtOI(row.pe_open)}</td>
                        <td className="py-2 px-3 text-right text-gray-300">{fmtOI(row.pe_close)}</td>
                        <td className={`py-2 px-3 text-right font-semibold ${row.pe_chg>0?'text-emerald-400':row.pe_chg<0?'text-yellow-400':'text-gray-600'}`}>
                          {row.pe_chg>0?'+':''}{fmtOI(row.pe_chg)}
                        </td>
                        <td className={`py-2 px-3 text-right font-bold text-base ${row.net_chg>0?'text-emerald-400':row.net_chg<0?'text-red-400':'text-gray-600'}`}>
                          {row.net_chg>0?'🐂':row.net_chg<0?'🐻':'—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* SEBI disclaimer */}
            <div className="bg-gray-900/20 border border-gray-800/40 rounded-xl p-4">
              <p className="text-xs text-gray-600 leading-relaxed">
                <span className="text-gray-400 font-semibold">Disclaimer:</span> EOD Analysis shows observed OI patterns from NSE data.
                Watchlist notes are derived algorithmically from data — not investment advice. All prices shown are as of last available data.
                GreekNova is not SEBI-registered. Trade at your own risk.
              </p>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
