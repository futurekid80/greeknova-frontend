'use client'
import { useEffect, useState, useCallback } from 'react'
import Navbar from '@/components/Navbar'
import { RefreshCw } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine
} from 'recharts'

const API = 'https://greeknova-backend-production.up.railway.app'

interface RolloverSymbol {
  symbol: string
  curr_oi: number; next_oi: number
  rollover_pct: number; prev_rollover_pct: number | null
  vs_prev: number | null
  roll_signal: string; roll_label: string; roll_color: string
  speed_label: string | null
  price: number; price_chg_pct: number; fut_signal: string
}

interface RolloverData {
  curr_expiry: string; next_expiry: string; prev_bench_date: string
  dte: number
  market_rollover_pct: number; prev_market_rollover: number | null
  vs_prev_market: number | null
  total_curr_oi: number; total_next_oi: number
  signal_counts: Record<string, number>
  top_rollers: RolloverSymbol[]
  symbols: RolloverSymbol[]
  total_symbols: number
}

function fmtOI(n: number) {
  const abs = Math.abs(n)
  if (abs >= 10000000) return `${(n/10000000).toFixed(2)}Cr`
  if (abs >= 100000) return `${(n/100000).toFixed(1)}L`
  return n.toLocaleString()
}
function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

const SIGNAL_META: Record<string, { color: string; bg: string; border: string; icon: string }> = {
  BULLISH_ROLL: { color: 'text-emerald-400', bg: 'bg-emerald-950/30', border: 'border-emerald-800/40', icon: '🐂' },
  BEARISH_ROLL: { color: 'text-red-400',     bg: 'bg-red-950/30',     border: 'border-red-800/40',     icon: '🐻' },
  ROLLING:      { color: 'text-amber-400',   bg: 'bg-amber-950/30',   border: 'border-amber-800/40',   icon: '🔄' },
  SQUARING:     { color: 'text-gray-400',    bg: 'bg-gray-900/30',    border: 'border-gray-700/40',    icon: '❌' },
  EARLY:        { color: 'text-blue-400',    bg: 'bg-blue-950/30',    border: 'border-blue-800/40',    icon: '⏳' },
}

function RolloverRow({ s, rank }: { s: RolloverSymbol; rank: number }) {
  const meta = SIGNAL_META[s.roll_signal] || SIGNAL_META['ROLLING']
  const barW = Math.min(s.rollover_pct / 60 * 100, 100)
  const prevBarW = s.prev_rollover_pct ? Math.min(s.prev_rollover_pct / 60 * 100, 100) : 0

  return (
    <tr className="border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-600 w-5">{rank}</span>
          <span className="text-sm font-black text-white">{s.symbol}</span>
        </div>
        <p className="text-xs text-gray-600 ml-7">₹{s.price.toLocaleString()}</p>
      </td>
      <td className="px-4 py-3">
        <div className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg border ${meta.color} ${meta.bg} ${meta.border}`}>
          {meta.icon} {s.roll_label}
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <div className="w-20 h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full" style={{ width: `${barW}%` }} />
            </div>
            <span className="text-sm font-black text-white">{s.rollover_pct}%</span>
          </div>
          {s.prev_rollover_pct !== null && (
            <div className="flex items-center gap-2">
              <div className="w-20 h-1 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-gray-600 rounded-full" style={{ width: `${prevBarW}%` }} />
              </div>
              <span className="text-xs text-gray-600">{s.prev_rollover_pct}% last</span>
            </div>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-right">
        {s.vs_prev !== null ? (
          <span className={`text-sm font-bold ${s.vs_prev >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {s.vs_prev >= 0 ? '+' : ''}{s.vs_prev}%
          </span>
        ) : <span className="text-gray-600 text-xs">—</span>}
      </td>
      <td className="px-4 py-3 text-right">
        <span className="text-xs text-gray-500">{fmtOI(s.curr_oi)}</span>
      </td>
      <td className="px-4 py-3 text-right">
        <span className="text-xs text-blue-400">{fmtOI(s.next_oi)}</span>
      </td>
      <td className="px-4 py-3 text-right">
        <span className={`text-sm font-semibold ${s.price_chg_pct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {s.price_chg_pct >= 0 ? '+' : ''}{s.price_chg_pct}%
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        {s.speed_label && (
          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
            s.speed_label.includes('Faster') ? 'text-emerald-400 border-emerald-800/50 bg-emerald-950/30' :
            s.speed_label.includes('Slower') ? 'text-red-400 border-red-800/50 bg-red-950/30' :
            'text-gray-400 border-gray-700 bg-gray-900/30'
          }`}>
            {s.speed_label.includes('Faster') ? '⚡ Faster' : s.speed_label.includes('Slower') ? '🐢 Slower' : '≈ Similar'}
          </span>
        )}
      </td>
    </tr>
  )
}

export default function RolloverPage() {
  const [data, setData] = useState<RolloverData | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [sortCol, setSortCol] = useState<string>('rollover_pct')
  const [sortDir, setSortDir] = useState<1|-1>(-1)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/rollover`)
      const json = await res.json()
      setData(json)
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading) return (
    <div className="min-h-screen bg-[#07070e] text-white">
      <Navbar active="/rollover" />
      <div className="max-w-7xl mx-auto px-6 py-10 space-y-4">
        {[1,2,3].map(i => <div key={i} className="h-32 bg-gray-900/40 rounded-2xl animate-pulse" />)}
      </div>
    </div>
  )

  if (!data) return (
    <div className="min-h-screen bg-[#07070e] text-white flex items-center justify-center">
      <p className="text-red-400">Failed to load rollover data</p>
    </div>
  )

  const sc = data.signal_counts
  const bullish = (sc['BULLISH_ROLL'] || 0)
  const bearish = (sc['BEARISH_ROLL'] || 0)
  const rolling = (sc['ROLLING'] || 0)
  const squaring = (sc['SQUARING'] || 0) + (sc['EARLY'] || 0)

  const biasLabel = bearish > bullish * 2 ? '🔴 Bearish Rollover' : bullish > bearish ? '🟢 Bullish Rollover' : '🟡 Mixed'
  const biasColor = bearish > bullish * 2 ? 'text-red-400' : bullish > bearish ? 'text-emerald-400' : 'text-amber-400'

  // Chart data — top 15 by rollover %
  const chartData = data.top_rollers.slice(0, 15).map(s => ({
    name: s.symbol,
    current: s.rollover_pct,
    last: s.prev_rollover_pct ?? 0,
    signal: s.roll_signal,
  }))

  // Filter + sort symbols
  const filtered = data.symbols
    .filter(s => filter === 'all' || s.roll_signal === filter)
    .sort((a, b) => {
      const av = sortCol === 'rollover_pct' ? a.rollover_pct :
                 sortCol === 'vs_prev' ? (a.vs_prev ?? -999) :
                 sortCol === 'price_chg_pct' ? a.price_chg_pct : a.rollover_pct
      const bv = sortCol === 'rollover_pct' ? b.rollover_pct :
                 sortCol === 'vs_prev' ? (b.vs_prev ?? -999) :
                 sortCol === 'price_chg_pct' ? b.price_chg_pct : b.rollover_pct
      return (bv - av) * sortDir
    })

  function toggleSort(col: string) {
    if (sortCol === col) setSortDir(d => d === -1 ? 1 : -1)
    else { setSortCol(col); setSortDir(-1) }
  }

  function SortIcon({ col }: { col: string }) {
    return sortCol === col
      ? <span className="ml-1">{sortDir === -1 ? '↓' : '↑'}</span>
      : <span className="ml-1 opacity-20">↕</span>
  }

  return (
    <div className="min-h-screen bg-[#07070e] text-white">
      <Navbar active="/rollover" />
      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-950/60 border border-blue-800/50 text-blue-400 uppercase tracking-wider">
                Series Rollover
              </span>
              <span className="text-xs text-gray-600 bg-gray-900 border border-gray-800 px-2 py-0.5 rounded-full">
                {data.dte} days to expiry
              </span>
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white mb-1">Rollover Tracker</h1>
            <p className="text-gray-500 text-sm">
              {fmtDate(data.curr_expiry)} → {fmtDate(data.next_expiry)} · {data.total_symbols} symbols · Benchmark: {fmtDate(data.prev_bench_date)} (same DTE last series)
            </p>
          </div>
          <button onClick={fetchData} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-sm font-medium text-white rounded-lg border border-gray-700 transition-all disabled:opacity-50">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />Refresh
          </button>
        </div>

        {/* Series Overview Banner */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="col-span-2 md:col-span-1 bg-gray-900/50 border border-gray-800 rounded-2xl p-5">
            <p className="text-xs text-gray-500 mb-1 uppercase tracking-wider">Market Rollover</p>
            <p className="text-3xl font-black text-white">{data.market_rollover_pct}%</p>
            {data.vs_prev_market !== null && (
              <p className={`text-xs mt-1 font-semibold ${data.vs_prev_market >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {data.vs_prev_market >= 0 ? '+' : ''}{data.vs_prev_market}% vs last series ({data.prev_market_rollover}%)
              </p>
            )}
          </div>
          <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-5">
            <p className="text-xs text-gray-500 mb-1 uppercase tracking-wider">Overall Bias</p>
            <p className={`text-xl font-black ${biasColor}`}>{biasLabel}</p>
            <p className="text-xs text-gray-600 mt-1">{bullish}🐂 · {bearish}🐻 · {rolling}🔄 · {squaring}⏳</p>
          </div>
          <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-5">
            <p className="text-xs text-gray-500 mb-1 uppercase tracking-wider">Current Series OI</p>
            <p className="text-xl font-black text-white">{fmtOI(data.total_curr_oi)}</p>
            <p className="text-xs text-gray-600 mt-1">{fmtDate(data.curr_expiry)} expiry</p>
          </div>
          <div className="bg-blue-950/30 border border-blue-800/40 rounded-2xl p-5">
            <p className="text-xs text-gray-500 mb-1 uppercase tracking-wider">Next Series OI</p>
            <p className="text-xl font-black text-blue-400">{fmtOI(data.total_next_oi)}</p>
            <p className="text-xs text-gray-600 mt-1">{fmtDate(data.next_expiry)} expiry</p>
          </div>
        </div>

        {/* Top Rollers Chart */}
        <div className="bg-gray-900/40 border border-gray-800 rounded-2xl p-6 mb-8">
          <h2 className="text-base font-black text-white mb-1">Top Rollers</h2>
          <p className="text-xs text-gray-500 mb-5">
            Blue = current series rollover % · Gray = last series same DTE · Taller = more rolled
          </p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 30 }}>
              <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false}
                angle={-45} textAnchor="end" interval={0} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false}
                tickFormatter={v => `${v}%`} domain={[0, 100]} />
              <Tooltip
                contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8, fontSize: 11 }}
                formatter={(v: any, name: any) => [`${v}%`, name === 'current' ? 'This Series' : 'Last Series']}
                cursor={{ fill: 'rgba(255,255,255,0.03)' }}
              />
              <ReferenceLine y={50} stroke="#374151" strokeDasharray="3 3" />
              <Bar dataKey="last" fill="#374151" radius={[2,2,0,0]} maxBarSize={16} />
              <Bar dataKey="current" radius={[3,3,0,0]} maxBarSize={16}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={
                    entry.signal === 'BULLISH_ROLL' ? '#10b981' :
                    entry.signal === 'BEARISH_ROLL' ? '#ef4444' :
                    entry.signal === 'ROLLING'      ? '#f59e0b' : '#6b7280'
                  } />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-2 text-[10px] text-gray-600">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500 inline-block"/>Bullish Roll</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-500 inline-block"/>Bearish Roll</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-500 inline-block"/>Rolling</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-gray-600 inline-block"/>Last Series</span>
          </div>
        </div>

        {/* Signal counts */}
        <div className="grid grid-cols-5 gap-3 mb-6">
          {[
            { key: 'all',          label: '◈ All',           count: data.total_symbols, color: 'text-white' },
            { key: 'BULLISH_ROLL', label: '🐂 Bullish Roll',  count: bullish,           color: 'text-emerald-400' },
            { key: 'BEARISH_ROLL', label: '🐻 Bearish Roll',  count: bearish,           color: 'text-red-400' },
            { key: 'ROLLING',      label: '🔄 Rolling',       count: rolling,           color: 'text-amber-400' },
            { key: 'SQUARING',     label: '❌ Squaring/Early', count: squaring,          color: 'text-gray-400' },
          ].map(item => (
            <button key={item.key}
              onClick={() => setFilter(item.key)}
              className={`rounded-xl border p-3 text-left transition-all ${filter === item.key ? 'bg-gray-800 border-gray-600' : 'bg-gray-900/30 border-gray-800 hover:border-gray-700'}`}>
              <p className="text-xs text-gray-500 mb-1">{item.label}</p>
              <p className={`text-2xl font-black ${item.color}`}>{item.count}</p>
            </button>
          ))}
        </div>

        {/* Full Table */}
        <div className="bg-gray-900/40 border border-gray-800 rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-900/80 border-b border-gray-700">
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 text-left pl-5">Symbol</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 text-left">Signal</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 text-left cursor-pointer hover:text-white select-none"
                  onClick={() => toggleSort('rollover_pct')}>
                  Rollover %<SortIcon col="rollover_pct"/>
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 text-right cursor-pointer hover:text-white select-none"
                  onClick={() => toggleSort('vs_prev')}>
                  vs Last Series<SortIcon col="vs_prev"/>
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 text-right">Curr OI</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 text-right">Next OI</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 text-right cursor-pointer hover:text-white select-none"
                  onClick={() => toggleSort('price_chg_pct')}>
                  Price Δ<SortIcon col="price_chg_pct"/>
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 text-right pr-5">Speed</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => (
                <RolloverRow key={s.symbol} s={s} rank={i+1} />
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-800 pt-6 mt-8 text-center">
          <p className="text-xs text-gray-600">
            Rollover % = Next series OI / (Current + Next) × 100 · Historical benchmark from {fmtDate(data.prev_bench_date)} (same DTE, May series) ·
            For educational purposes only · Not SEBI registered · Not investment advice
          </p>
        </div>

      </div>
    </div>
  )
}
