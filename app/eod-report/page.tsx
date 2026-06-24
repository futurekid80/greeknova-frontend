'use client'
import { useEffect, useState, useCallback } from 'react'
import Navbar from '@/components/Navbar'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie, Legend
} from 'recharts'

const API = 'https://greeknova-backend-production.up.railway.app'

// ── Types ─────────────────────────────────────────────────────────────────────
interface Mover {
  symbol: string; fut_oi_chg_pct: number; price_chg_pct: number
  close_price: number; fut_signal: string; fut_vol: number
}
interface StealthStock {
  symbol: string; fut_oi_chg_pct: number; price_chg_pct: number
  close_price: number; tier: string
}
interface IVData {
  symbol: string; atm_iv: number; atm_ce_iv: number; atm_pe_iv: number; dte: number
}
interface ParticipantFlow {
  participant: string; fut_idx_net: number; fut_stk_net: number
  opt_idx_call_net: number; opt_idx_put_net: number; total_net: number
}
interface EODData {
  date: string; available_dates: string[]
  market_breadth: {
    total: number; bullish: number; bearish: number; neutral: number
    long_buildup: number; short_buildup: number; short_covering: number; long_unwinding: number
  }
  fut_movers: {
    long_buildup: Mover[]; short_buildup: Mover[]
    short_covering: Mover[]; long_unwinding: Mover[]
  }
  stealth_buildup: StealthStock[]
  iv_data: Record<string, IVData>
  participant_flow: Record<string, ParticipantFlow>
  top_signals: Mover[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n: number, dec = 2) {
  return n >= 0 ? `+${n.toFixed(dec)}%` : `${n.toFixed(dec)}%`
}
function fmtPrice(n: number) {
  return n >= 1000 ? `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : `₹${n.toFixed(2)}`
}
function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric'
  })
}
function fmtL(n: number) {
  const abs = Math.abs(n)
  if (abs >= 10000000) return `${(n / 10000000).toFixed(2)}Cr`
  if (abs >= 100000) return `${(n / 100000).toFixed(1)}L`
  return n.toLocaleString()
}

// ── Signal colors ─────────────────────────────────────────────────────────────
const SIG_COLOR: Record<string, string> = {
  LONG_BUILDUP:   '#10b981',
  SHORT_BUILDUP:  '#ef4444',
  SHORT_COVERING: '#06b6d4',
  LONG_UNWINDING: '#f59e0b',
}
const SIG_LABEL: Record<string, string> = {
  LONG_BUILDUP:   'Long Buildup',
  SHORT_BUILDUP:  'Short Buildup',
  SHORT_COVERING: 'Short Covering',
  LONG_UNWINDING: 'Long Unwinding',
}

// ── Custom Tooltip for Bar Charts ─────────────────────────────────────────────
function CustomBarTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs">
      <p className="text-white font-bold mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>{p.name}: {fmtL(p.value)}</p>
      ))}
    </div>
  )
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <div className="flex items-baseline gap-3 mb-4">
        <h2 className="text-lg font-black text-white tracking-tight">{title}</h2>
        {subtitle && <span className="text-xs text-gray-500">{subtitle}</span>}
      </div>
      {children}
    </div>
  )
}

// ── Mover Row ─────────────────────────────────────────────────────────────────
function MoverRow({ m, rank }: { m: Mover; rank: number }) {
  const isLong = m.fut_signal === 'LONG_BUILDUP' || m.fut_signal === 'SHORT_COVERING'
  const barColor = SIG_COLOR[m.fut_signal] || '#6b7280'
  const maxOI = 20
  const barW = Math.min(Math.abs(m.fut_oi_chg_pct) / maxOI * 100, 100)

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-gray-800/60 last:border-0 group hover:bg-gray-900/30 px-3 -mx-3 rounded-lg transition-colors">
      <span className="text-xs text-gray-600 font-mono w-4">{rank}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-black text-white">{m.symbol}</span>
          <span className="text-xs text-gray-500">{fmtPrice(m.close_price)}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-24 h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${barW}%`, backgroundColor: barColor }} />
          </div>
          <span className="text-xs font-bold" style={{ color: barColor }}>
            {fmt(m.fut_oi_chg_pct)} OI
          </span>
        </div>
      </div>
      <span className={`text-sm font-semibold ${m.price_chg_pct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
        {fmt(m.price_chg_pct)}
      </span>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function EODReport() {
  const [data, setData] = useState<EODData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState('')

  const fetchData = useCallback(async (date?: string) => {
    setLoading(true)
    setError(null)
    try {
      const url = date
        ? `${API}/eod-report?date=${date}`
        : `${API}/eod-report`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setData(json)
      setSelectedDate(json.date)
    } catch (e: any) {
      setError(e.message)
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading) return (
    <div className="min-h-screen bg-[#07070e] text-white">
      <Navbar active="/eod" />
      <div className="max-w-7xl mx-auto px-6 py-10 space-y-6">
        {[1,2,3,4].map(i => <div key={i} className="h-40 bg-gray-900/40 rounded-2xl animate-pulse" />)}
      </div>
    </div>
  )

  if (error || !data) return (
    <div className="min-h-screen bg-[#07070e] text-white flex items-center justify-center">
      <div className="text-center">
        <p className="text-red-400 text-lg font-bold mb-2">Failed to load report</p>
        <button onClick={() => fetchData()} className="text-sm px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg">Retry</button>
      </div>
    </div>
  )

  const { market_breadth: mb, fut_movers: fm, stealth_buildup, iv_data, participant_flow: pf } = data

  // ── Breadth donut data ────────────────────────────────────────────────────
  const breadthPie = [
    { name: 'Long Buildup',   value: mb.long_buildup,   color: '#10b981' },
    { name: 'Short Buildup',  value: mb.short_buildup,  color: '#ef4444' },
    { name: 'Short Covering', value: mb.short_covering, color: '#06b6d4' },
    { name: 'Long Unwinding', value: mb.long_unwinding, color: '#f59e0b' },
    { name: 'Neutral',        value: mb.neutral,        color: '#374151' },
  ].filter(d => d.value > 0)

  // ── Participant flow bar data ──────────────────────────────────────────────
  const pfBar = ['FII', 'DII', 'CLIENT', 'PRO'].map(p => ({
    name: p,
    'Idx Fut': pf[p]?.fut_idx_net || 0,
    'Stk Fut': pf[p]?.fut_stk_net || 0,
    'Call Net': pf[p]?.opt_idx_call_net || 0,
    'Put Net':  pf[p]?.opt_idx_put_net || 0,
  }))

  // ── Overall market bias ───────────────────────────────────────────────────
  const biasScore = mb.bullish - mb.bearish
  const biasLabel = biasScore > 5 ? '🟢 Bullish' : biasScore < -5 ? '🔴 Bearish' : '🟡 Neutral'
  const biasColor = biasScore > 5 ? 'text-emerald-400' : biasScore < -5 ? 'text-red-400' : 'text-amber-400'

  // ── FII index net position ────────────────────────────────────────────────
  const fiiIdxNet = pf['FII']?.fut_idx_net || 0
  const fiiStkNet = pf['FII']?.fut_stk_net || 0

  return (
    <div className="min-h-screen bg-[#07070e] text-white">
      <Navbar active="/eod" />

      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-950/60 border border-amber-800/50 text-amber-400 uppercase tracking-wider">
                Intelligence Report
              </span>
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white mb-1">
              EOD Market Report
            </h1>
            <p className="text-gray-500 text-sm">
              F&O Positioning · Participant Flow · Stealth Signals · {fmtDate(data.date)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={selectedDate}
              onChange={e => { setSelectedDate(e.target.value); fetchData(e.target.value) }}
              className="bg-gray-900 border border-gray-700 text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-amber-500 cursor-pointer"
            >
              {data.available_dates.map(d => (
                <option key={d} value={d} className="bg-gray-900">
                  {fmtDate(d)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ── Market Bias Banner ──────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="col-span-2 md:col-span-1 bg-gray-900/50 border border-gray-800 rounded-2xl p-5">
            <p className="text-xs text-gray-500 mb-1 uppercase tracking-wider">Market Bias</p>
            <p className={`text-2xl font-black ${biasColor}`}>{biasLabel}</p>
            <p className="text-xs text-gray-600 mt-1">{mb.bullish} bullish · {mb.bearish} bearish · {mb.neutral} neutral</p>
          </div>
          {['NIFTY', 'BANKNIFTY', 'FINNIFTY'].map(sym => {
            const iv = iv_data[sym]
            return (
              <div key={sym} className="bg-gray-900/50 border border-gray-800 rounded-2xl p-5">
                <p className="text-xs text-gray-500 mb-1 uppercase tracking-wider">{sym}</p>
                <p className="text-2xl font-black text-white">{iv?.atm_iv?.toFixed(1) ?? '—'}</p>
                <p className="text-xs text-gray-500 mt-1">ATM IV · {iv?.dte ?? '—'} DTE</p>
                {iv && (
                  <div className="flex gap-3 mt-1.5 text-[10px]">
                    <span className="text-red-400">CE {iv.atm_ce_iv?.toFixed(1)}</span>
                    <span className="text-emerald-400">PE {iv.atm_pe_iv?.toFixed(1) ?? '—'}</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">

          {/* ── Market Breadth ────────────────────────────────────────────── */}
          <Section title="Market Breadth" subtitle={`${mb.total} F&O symbols`}>
            <div className="bg-gray-900/40 border border-gray-800 rounded-2xl p-5">
              <div className="flex items-center gap-6 mb-4">
                <div className="text-center">
                  <p className="text-3xl font-black text-emerald-400">{mb.bullish}</p>
                  <p className="text-xs text-gray-500">Bullish</p>
                </div>
                <div className="flex-1 h-3 bg-gray-800 rounded-full overflow-hidden flex">
                  <div className="h-full bg-emerald-500 transition-all" style={{ width: `${(mb.bullish/mb.total)*100}%` }} />
                  <div className="h-full bg-red-500 transition-all" style={{ width: `${(mb.bearish/mb.total)*100}%` }} />
                  <div className="h-full bg-gray-700 transition-all" style={{ width: `${(mb.neutral/mb.total)*100}%` }} />
                </div>
                <div className="text-center">
                  <p className="text-3xl font-black text-red-400">{mb.bearish}</p>
                  <p className="text-xs text-gray-500">Bearish</p>
                </div>
              </div>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={breadthPie} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                      dataKey="value" paddingAngle={2}>
                      {breadthPie.map((entry, i) => (
                        <Cell key={i} fill={entry.color} stroke="transparent" />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
                      labelStyle={{ color: '#fff' }}
                      itemStyle={{ color: '#9ca3af' }}
                    />
                    <Legend
                      formatter={(value) => <span style={{ color: '#9ca3af', fontSize: 11 }}>{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {[
                  { label: 'Long Buildup', val: mb.long_buildup, color: 'text-emerald-400' },
                  { label: 'Short Buildup', val: mb.short_buildup, color: 'text-red-400' },
                  { label: 'Short Covering', val: mb.short_covering, color: 'text-cyan-400' },
                  { label: 'Long Unwinding', val: mb.long_unwinding, color: 'text-amber-400' },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between bg-gray-900/50 rounded-lg px-3 py-2">
                    <span className="text-xs text-gray-500">{item.label}</span>
                    <span className={`text-sm font-black ${item.color}`}>{item.val}</span>
                  </div>
                ))}
              </div>
            </div>
          </Section>

          {/* ── Participant Flow ──────────────────────────────────────────── */}
          <Section title="Participant Flow" subtitle="Index futures net positions">
            <div className="bg-gray-900/40 border border-gray-800 rounded-2xl p-5">
              {/* FII Summary */}
              <div className="flex items-center gap-4 mb-4 p-3 rounded-xl bg-gray-900/60 border border-gray-700/50">
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">FII Index Fut</p>
                  <p className={`text-lg font-black ${fiiIdxNet >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {fiiIdxNet >= 0 ? '+' : ''}{fmtL(fiiIdxNet)}
                  </p>
                </div>
                <div className="w-px h-10 bg-gray-700" />
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">FII Stock Fut</p>
                  <p className={`text-lg font-black ${fiiStkNet >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {fiiStkNet >= 0 ? '+' : ''}{fmtL(fiiStkNet)}
                  </p>
                </div>
                <div className="w-px h-10 bg-gray-700" />
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">FII Stance</p>
                  <p className={`text-sm font-bold ${fiiIdxNet < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {fiiIdxNet < 0 ? '🐻 Net Short' : '🐂 Net Long'}
                  </p>
                </div>
              </div>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={pfBar} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                    <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={v => fmtL(v)} tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} width={50} />
                    <Tooltip content={<CustomBarTooltip />} />
                    <Bar dataKey="Idx Fut" fill="#10b981" radius={[3,3,0,0]} maxBarSize={20} />
                    <Bar dataKey="Stk Fut" fill="#6366f1" radius={[3,3,0,0]} maxBarSize={20} />
                    <Bar dataKey="Call Net" fill="#ef4444" radius={[3,3,0,0]} maxBarSize={20} />
                    <Bar dataKey="Put Net"  fill="#10b981" radius={[3,3,0,0]} maxBarSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center gap-4 mt-2 text-[10px] text-gray-600">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"/>Idx Fut</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-500 inline-block"/>Stk Fut</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block"/>Call Net</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"/>Put Net</span>
              </div>
            </div>
          </Section>
        </div>

        {/* ── FUT OI Movers ────────────────────────────────────────────────── */}
        <Section title="FUT OI Movers" subtitle="Significant open interest changes today">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Long Buildup */}
            <div className="bg-emerald-950/20 border border-emerald-800/30 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-800/50 text-emerald-400">🐂 Long Buildup</span>
                <span className="text-xs text-gray-600">OI ↑ + Price ↑</span>
              </div>
              {fm.long_buildup.length === 0 ? (
                <p className="text-gray-600 text-sm">No long buildup signals today</p>
              ) : (
                fm.long_buildup.map((m, i) => <MoverRow key={m.symbol} m={m} rank={i+1} />)
              )}
            </div>
            {/* Short Buildup */}
            <div className="bg-red-950/20 border border-red-800/30 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-950/60 border border-red-800/50 text-red-400">🐻 Short Buildup</span>
                <span className="text-xs text-gray-600">OI ↑ + Price ↓</span>
              </div>
              {fm.short_buildup.map((m, i) => <MoverRow key={m.symbol} m={m} rank={i+1} />)}
            </div>
            {/* Short Covering */}
            {fm.short_covering.length > 0 && (
              <div className="bg-cyan-950/20 border border-cyan-800/30 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-cyan-950/60 border border-cyan-800/50 text-cyan-400">🔄 Short Covering</span>
                  <span className="text-xs text-gray-600">OI ↓ + Price ↑</span>
                </div>
                {fm.short_covering.map((m, i) => <MoverRow key={m.symbol} m={m} rank={i+1} />)}
              </div>
            )}
            {/* Long Unwinding */}
            {fm.long_unwinding.length > 0 && (
              <div className="bg-amber-950/20 border border-amber-800/30 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-950/60 border border-amber-800/50 text-amber-400">⚠️ Long Unwinding</span>
                  <span className="text-xs text-gray-600">OI ↓ + Price ↓</span>
                </div>
                {fm.long_unwinding.map((m, i) => <MoverRow key={m.symbol} m={m} rank={i+1} />)}
              </div>
            )}
          </div>
        </Section>

        {/* ── Stealth Buildup ──────────────────────────────────────────────── */}
        {stealth_buildup.length > 0 && (
          <Section title="Stealth Buildup" subtitle="High OI accumulation with minimal price move — quiet institutional activity">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {stealth_buildup.map(s => {
                const isElite = s.tier === 'ELITE'
                return (
                  <div key={s.symbol} className={`rounded-xl border p-4 ${isElite
                    ? 'bg-amber-950/20 border-amber-800/40'
                    : 'bg-emerald-950/20 border-emerald-800/40'}`}>
                    <div className="flex items-start justify-between mb-2">
                      <p className="text-sm font-black text-white">{s.symbol}</p>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${isElite
                        ? 'text-amber-400 border-amber-700/50 bg-amber-950/40'
                        : 'text-emerald-400 border-emerald-700/50 bg-emerald-950/40'}`}>
                        {s.tier}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mb-2">{fmtPrice(s.close_price)}</p>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">OI Chg</span>
                        <span className="text-emerald-400 font-bold">+{s.fut_oi_chg_pct.toFixed(2)}%</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Price</span>
                        <span className={`font-bold ${s.price_chg_pct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {fmt(s.price_chg_pct)}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </Section>
        )}

        {/* ── Participant Flow Detail Table ─────────────────────────────────── */}
        <Section title="Participant Flow Detail" subtitle="Net positions across all segments">
          <div className="bg-gray-900/40 border border-gray-800 rounded-2xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-900/80 border-b border-gray-700">
                  {['Participant','Idx Fut Net','Stk Fut Net','Call Net','Put Net','Total Net'].map(h => (
                    <th key={h} className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right first:text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {['FII','DII','CLIENT','PRO'].map((p, i) => {
                  const row = pf[p]
                  if (!row) return null
                  const totalColor = row.total_net >= 0 ? 'text-emerald-400' : 'text-red-400'
                  return (
                    <tr key={p} className={`border-b border-gray-800/50 ${i % 2 === 0 ? '' : 'bg-gray-900/20'}`}>
                      <td className="px-4 py-3 text-sm font-black text-white">{p}</td>
                      {[row.fut_idx_net, row.fut_stk_net, row.opt_idx_call_net, row.opt_idx_put_net].map((v, j) => (
                        <td key={j} className={`px-4 py-3 text-sm text-right font-semibold ${v >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {v >= 0 ? '+' : ''}{fmtL(v)}
                        </td>
                      ))}
                      <td className={`px-4 py-3 text-sm text-right font-black ${totalColor}`}>
                        {row.total_net >= 0 ? '+' : ''}{fmtL(row.total_net)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Section>

        {/* ── Footer ───────────────────────────────────────────────────────── */}
        <div className="border-t border-gray-800 pt-6 text-center">
          <p className="text-xs text-gray-600">
            GreekNova · EOD Intelligence Report · {fmtDate(data.date)} ·
            Data from NSE F&O archives and live OI captures ·
            For educational purposes only · Not SEBI registered · Not investment advice
          </p>
        </div>

      </div>
    </div>
  )
}
