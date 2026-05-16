'use client'
import Navbar from '@/components/Navbar'
import { useEffect, useState, useCallback } from 'react'
import { RefreshCw } from 'lucide-react'

const API = 'https://greeknova-backend-production.up.railway.app'

interface RadarResult {
  symbol: string; is_index: boolean
  signal: string; bias: string
  consistency_pct: number; consistency_label: string
  match_days: number; total_days: number
  consec_days: number
  accelerating: boolean; oi_first_half_chg: number; oi_second_half_chg: number
  triple_confirm: boolean; vol_consec: number
  oi_chg_pct: number; vol_chg_pct: number; cmp_chg_pct: number
  oi_series: number[]; vol_series: number[]; cmp_series: number[]
  date_labels: string[]; cmp: number; series_days: number
}

interface RadarData {
  expiry: string; series_start: string
  total_trading_days: number; min_consec: number
  total: number
  summary: {
    long_buildup: number; short_buildup: number
    short_covering: number; long_unwinding: number
    high_consistency: number; triple_confirm: number; accelerating: number
  }
  results: RadarResult[]
}

const SIGNAL_META: Record<string, { color: string; bg: string; border: string; icon: string; label: string }> = {
  LONG_BUILDUP:   { color: 'text-emerald-400', bg: 'bg-emerald-950/30', border: 'border-emerald-800/40', icon: '🐂', label: 'Long Buildup' },
  SHORT_BUILDUP:  { color: 'text-red-400',     bg: 'bg-red-950/30',     border: 'border-red-800/40',     icon: '🐻', label: 'Short Buildup' },
  SHORT_COVERING: { color: 'text-cyan-400',    bg: 'bg-cyan-950/30',    border: 'border-cyan-800/40',    icon: '🔄', label: 'Short Covering' },
  LONG_UNWINDING: { color: 'text-orange-400',  bg: 'bg-orange-950/30',  border: 'border-orange-800/40',  icon: '⚠️', label: 'Long Unwinding' },
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null
  const min = Math.min(...data); const max = Math.max(...data)
  const range = max - min || 1
  const w = 80; const h = 28
  const pts = data.map((v, i) =>
    `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`
  ).join(' ')
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/>
      <circle
        cx={(data.length-1)/(data.length-1)*w}
        cy={h-((data[data.length-1]-min)/range)*h}
        r="2.5" fill={color}/>
    </svg>
  )
}

function ConsistencyBar({ pct, label }: { pct: number; label: string }) {
  const color = label === 'HIGH' ? 'bg-emerald-500' : label === 'MEDIUM' ? 'bg-amber-400' : 'bg-red-500'
  const textColor = label === 'HIGH' ? 'text-emerald-400' : label === 'MEDIUM' ? 'text-amber-400' : 'text-red-400'
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1">
        <span className={`text-xs font-black ${textColor}`}>{pct}%</span>
        <span className={`text-[10px] font-bold ${textColor}`}>{label}</span>
      </div>
      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden w-full">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }}/>
      </div>
    </div>
  )
}

export default function PositionalRadar() {
  const [data, setData]         = useState<RadarData | null>(null)
  const [loading, setLoading]   = useState(true)
  const [minConsec, setMinConsec] = useState(0)
  const [signalFilter, setSignalFilter] = useState('all')
  const [biasFilter, setBiasFilter]     = useState<'all'|'BULLISH'|'BEARISH'>('all')
  const [consisFilter, setConsisFilter] = useState('all')
  const [tripleOnly, setTripleOnly]     = useState(false)
  const [accelOnly, setAccelOnly]       = useState(false)
  const [typeFilter, setTypeFilter]     = useState<'all'|'index'|'stocks'>('all')

  const fetchData = useCallback(async (consec?: number) => {
    setLoading(true)
    const c = consec ?? minConsec
    try {
      const res  = await fetch(`${API}/positional-radar?min_consec=${c}`)
      const json = await res.json()
      setData(json)
    } catch(e) { console.error(e) }
    setLoading(false)
  }, [minConsec])

  function handleConsec(c: number) {
    setMinConsec(c)
    fetchData(c)
  }

  useEffect(() => { fetchData(0) }, [])

  const results = (data?.results || [])
    .filter(r => typeFilter === 'all' || (typeFilter === 'index' ? r.is_index : !r.is_index))
    .filter(r => signalFilter === 'all' || r.signal === signalFilter)
    .filter(r => biasFilter === 'all' || r.bias === biasFilter)
    .filter(r => consisFilter === 'all' || r.consistency_label === consisFilter)
    .filter(r => !tripleOnly || r.triple_confirm)
    .filter(r => !accelOnly  || r.accelerating)

  const s = data?.summary

  return (
    <div className="min-h-screen bg-[#07070e] text-white">
      <Navbar active="/positional" />
      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-end justify-between mb-5">
          <div>
            <h1 className="text-3xl font-black tracking-tight mb-1">📈 Positional Radar</h1>
            <p className="text-gray-500 text-sm">
              Monthly expiry series analysis · Consistency scoring · OI acceleration detection
            </p>
          </div>
          <button onClick={() => fetchData()} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-sm font-medium rounded-lg border border-gray-700 disabled:opacity-50 transition-all">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''}/>Refresh
          </button>
        </div>

        {/* Series info */}
        {data && (
          <div className="bg-gray-900/30 border border-gray-800 rounded-xl px-5 py-3 mb-5 flex items-center justify-between">
            <div className="flex items-center gap-6 text-sm">
              <div>
                <span className="text-gray-500 text-xs">Series</span>
                <p className="text-white font-bold">{data.series_start} → {data.expiry}</p>
              </div>
              <div>
                <span className="text-gray-500 text-xs">Trading days captured</span>
                <p className="text-amber-400 font-black">{data.total_trading_days} days</p>
              </div>
              <div>
                <span className="text-gray-500 text-xs">Monthly expiry</span>
                <p className="text-cyan-400 font-bold">{data.expiry}</p>
              </div>
            </div>
            <div className="text-xs text-gray-600">Full May series · NSE monthly F&O</div>
          </div>
        )}

        {/* How it works */}
        <div className="bg-gray-900/20 border border-gray-800/40 rounded-xl px-4 py-3 mb-5">
          <p className="text-xs text-gray-500 leading-relaxed">
            <span className="text-gray-300 font-semibold">Two ways to use this: </span>
            <span className="text-amber-400">Active streak</span> = use "Active 3d/5d/7d" buttons → stocks where signal is LIVE right now going into tomorrow ·
            <span className="text-emerald-400"> Series consistency</span> = use "HIGH" filter → stocks where signal held 70%+ of all days this series (best overall trend) ·
            <span className="text-purple-400"> ⚡ Triple</span> = OI + Price + Volume all rising ·
            <span className="text-blue-400"> 🚀 Accelerating</span> = OI building faster recently than earlier in series
          </p>
        </div>

        {/* PRIMARY FILTER — Consecutive days */}
        <div className="bg-gray-900/30 border border-gray-800 rounded-2xl p-5 mb-5">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-sm font-bold text-white">Minimum consecutive days trending:</span>
            <span className="text-xs text-gray-500">(filters stocks where signal held for at least N days in a row right up to today)</span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {[
              { val: 0, label: 'All signals',       sub: 'Full series view' },
              { val: 3, label: 'Active 3d+ streak', sub: 'Signal live last 3 days' },
              { val: 5, label: 'Active 5d+ streak', sub: 'Signal live last 5 days' },
              { val: 7, label: 'Active 7d+ streak', sub: 'Signal live last 7 days' },
            ].map(({ val, label, sub }) => (
              <button key={val} onClick={() => handleConsec(val)}
                className={`px-4 py-2.5 rounded-xl text-sm font-bold border transition-all text-left ${minConsec===val
                  ? 'bg-white text-gray-900 border-white'
                  : 'bg-gray-900/40 text-gray-400 border-gray-800 hover:text-white'}`}>
                <div>{label}</div>
                <div className={`text-xs font-normal mt-0.5 ${minConsec===val ? 'text-gray-600' : 'text-gray-600'}`}>{sub}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Summary boxes */}
        <div className="grid grid-cols-7 gap-2 mb-5">
          {[
            { label: 'Total',          val: data?.total || 0,          color: 'text-white',        sub: 'signals' },
            { label: '🐂 Long Buildup', val: s?.long_buildup   || 0,   color: 'text-emerald-400',  sub: 'OI+price ↑' },
            { label: '🐻 Short Buildup',val: s?.short_buildup  || 0,   color: 'text-red-400',      sub: 'OI↑ price↓' },
            { label: '🔄 Short Cover',  val: s?.short_covering || 0,   color: 'text-cyan-400',     sub: 'OI↓ price↑' },
            { label: '✅ High Consist', val: s?.high_consistency|| 0,  color: 'text-emerald-400',  sub: '70%+ days' },
            { label: '⚡ Triple',       val: s?.triple_confirm || 0,   color: 'text-purple-400',   sub: 'OI+Price+Vol' },
            { label: '🚀 Accelerating', val: s?.accelerating   || 0,   color: 'text-blue-400',     sub: 'OI speeding up' },
          ].map(({ label, val, color, sub }) => (
            <div key={label} className="bg-gray-900/30 border border-gray-800 rounded-xl p-3">
              <p className="text-[10px] text-gray-500 mb-1">{label}</p>
              <p className={`text-xl font-black ${color}`}>{val}</p>
              <p className="text-[10px] text-gray-600">{sub}</p>
            </div>
          ))}
        </div>

        {/* Secondary filters */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {(['all','index','stocks'] as const).map(f => (
            <button key={f} onClick={() => setTypeFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all capitalize ${typeFilter===f ? 'bg-white text-gray-900 border-white' : 'bg-gray-900/40 text-gray-400 border-gray-800 hover:text-white'}`}>
              {f}
            </button>
          ))}
          <div className="w-px h-5 bg-gray-800 mx-1"/>
          {(['all','BULLISH','BEARISH'] as const).map(b => (
            <button key={b} onClick={() => setBiasFilter(b)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${biasFilter===b
                ? b==='BULLISH' ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                : b==='BEARISH' ? 'bg-red-950 text-red-400 border-red-800'
                : 'bg-white text-gray-900 border-white'
                : 'bg-gray-900/40 text-gray-400 border-gray-800 hover:text-white'}`}>
              {b==='all'?'All Bias':b==='BULLISH'?'↑ Bullish':'↓ Bearish'}
            </button>
          ))}
          <div className="w-px h-5 bg-gray-800 mx-1"/>
          {Object.entries(SIGNAL_META).map(([key, m]) => (
            <button key={key} onClick={() => setSignalFilter(signalFilter===key?'all':key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${signalFilter===key ? `${m.bg} ${m.color} ${m.border}` : 'bg-gray-900/40 text-gray-400 border-gray-800 hover:text-white'}`}>
              {m.icon} {m.label}
            </button>
          ))}
          <div className="w-px h-5 bg-gray-800 mx-1"/>
          {(['all','HIGH','MEDIUM','LOW'] as const).map(c => (
            <button key={c} onClick={() => setConsisFilter(c)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${consisFilter===c
                ? c==='HIGH' ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                : c==='MEDIUM' ? 'bg-amber-950 text-amber-400 border-amber-800'
                : c==='LOW' ? 'bg-red-950 text-red-400 border-red-800'
                : 'bg-white text-gray-900 border-white'
                : 'bg-gray-900/40 text-gray-400 border-gray-800 hover:text-white'}`}>
              {c==='all'?'All Consistency':c}
            </button>
          ))}
          <div className="w-px h-5 bg-gray-800 mx-1"/>
          <button onClick={() => setTripleOnly(t => !t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${tripleOnly ? 'bg-purple-950 text-purple-400 border-purple-800' : 'bg-gray-900/40 text-gray-400 border-gray-800 hover:text-white'}`}>
            ⚡ Triple Only
          </button>
          <button onClick={() => setAccelOnly(a => !a)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${accelOnly ? 'bg-blue-950 text-blue-400 border-blue-800' : 'bg-gray-900/40 text-gray-400 border-gray-800 hover:text-white'}`}>
            🚀 Accelerating Only
          </button>
          <button onClick={() => { setSignalFilter('all'); setBiasFilter('all'); setConsisFilter('all'); setTripleOnly(false); setAccelOnly(false); setTypeFilter('all') }}
            className="text-xs text-gray-600 hover:text-gray-400 transition-colors ml-1">
            Clear filters
          </button>
        </div>

        <p className="text-xs text-gray-600 mb-4">
          {results.length} signals · {minConsec > 0 ? `Active ${minConsec}d+ streak filter` : 'showing all signals — use HIGH consistency or Active streak filters to narrow down'} · May series · Informational only
        </p>

        {/* Table */}
        {loading ? (
          <div className="space-y-2">{[1,2,3,4,5,6].map(i=>(
            <div key={i} className="h-20 bg-gray-900/30 border border-gray-800 rounded-xl animate-pulse"/>
          ))}</div>
        ) : results.length > 0 ? (
          <div className="rounded-2xl border border-gray-800 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-900/60 border-b border-gray-800">
                  {[
                    'Symbol', 'Signal', 'Consistency', 'Consec', 
                    'OI (Series)', 'Volume (Series)', 'Price (Series)',
                    'OI Trend', 'Price Trend', 'Deep Dive'
                  ].map((h, i) => (
                    <th key={h} className={`text-xs font-semibold text-gray-500 px-3 py-3.5 ${i <= 3 ? 'text-left' : 'text-right'} ${i===0?'pl-5':''} ${i===9?'pr-5 text-left':''}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => {
                  const m        = SIGNAL_META[r.signal]
                  const oiColor  = r.oi_chg_pct  > 0 ? '#10b981' : '#ef4444'
                  const cmpColor = r.cmp_chg_pct > 0 ? '#10b981' : '#ef4444'
                  const rowBg    = r.triple_confirm && r.accelerating
                    ? 'bg-purple-950/15 border-l-2 border-l-purple-700'
                    : r.triple_confirm ? 'bg-purple-950/8'
                    : r.accelerating   ? 'bg-blue-950/8 border-l-2 border-l-blue-800'
                    : i % 2 === 0 ? '' : 'bg-gray-900/20'

                  return (
                    <tr key={r.symbol} className={`border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors ${rowBg}`}>

                      {/* Symbol */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-black text-white">{r.symbol}</span>
                          {r.triple_confirm && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-purple-950 text-purple-400 border border-purple-800/50 rounded">⚡ Triple</span>
                          )}
                          {r.accelerating && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-blue-950 text-blue-400 border border-blue-800/50 rounded">🚀 Accel</span>
                          )}
                          {r.is_index && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-cyan-950 text-cyan-400 border border-cyan-800/50 rounded">IDX</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-600 mt-0.5">₹{r.cmp.toLocaleString('en-IN')}</p>
                      </td>

                      {/* Signal */}
                      <td className="px-3 py-3.5">
                        <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg border ${m.color} ${m.bg} ${m.border}`}>
                          {m.icon} {m.label}
                        </span>
                      </td>

                      {/* Consistency */}
                      <td className="px-3 py-3.5 min-w-[110px]">
                        <ConsistencyBar pct={r.consistency_pct} label={r.consistency_label}/>
                        <p className="text-[10px] text-gray-600 mt-1">{r.match_days}/{r.total_days} days</p>
                      </td>

                      {/* Consecutive */}
                      <td className="px-3 py-3.5">
                        <p className={`text-lg font-black ${r.consec_days >= 5 ? 'text-emerald-400' : r.consec_days >= 3 ? 'text-amber-400' : r.consec_days >= 1 ? 'text-white' : 'text-orange-400'}`}>
                          {r.consec_days > 0 ? `${r.consec_days}d` : '—'}
                        </p>
                        <p className="text-[10px] text-gray-600">
                          {r.consec_days > 0 ? 'in a row' : 'broke last day'}
                        </p>
                      </td>

                      {/* OI */}
                      <td className="px-3 py-3.5 text-right">
                        <p className={`text-sm font-black ${r.oi_chg_pct > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {r.oi_chg_pct > 0 ? '+' : ''}{r.oi_chg_pct}%
                        </p>
                        {r.accelerating && (
                          <p className="text-[10px] text-blue-400">🚀 {r.oi_first_half_chg}% → {r.oi_second_half_chg}%</p>
                        )}
                      </td>

                      {/* Volume */}
                      <td className="px-3 py-3.5 text-right">
                        <p className={`text-sm font-black ${r.vol_chg_pct > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {r.vol_chg_pct > 0 ? '+' : ''}{r.vol_chg_pct}%
                        </p>
                        {r.triple_confirm && <p className="text-[10px] text-purple-400">⚡ {r.vol_consec}d consec</p>}
                      </td>

                      {/* Price */}
                      <td className="px-3 py-3.5 text-right">
                        <p className={`text-sm font-black ${r.cmp_chg_pct > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {r.cmp_chg_pct > 0 ? '+' : ''}{r.cmp_chg_pct}%
                        </p>
                        <p className="text-[10px] text-gray-600">₹{r.cmp_series[0]?.toFixed(0)} → ₹{r.cmp.toFixed(0)}</p>
                      </td>

                      {/* OI Sparkline */}
                      <td className="px-3 py-3.5 text-right">
                        <div className="flex justify-end">
                          <Sparkline data={r.oi_series} color={oiColor}/>
                        </div>
                      </td>

                      {/* Price Sparkline */}
                      <td className="px-3 py-3.5 text-right">
                        <div className="flex justify-end">
                          <Sparkline data={r.cmp_series} color={cmpColor}/>
                        </div>
                      </td>

                      {/* Deep Dive */}
                      <td className="px-5 py-3.5">
                        <div className="flex flex-col gap-1">
                          <a href="/uoa"    className="text-xs text-blue-400 hover:text-blue-300">🐋 UOA →</a>
                          <a href="/jungle" className="text-xs text-amber-400 hover:text-amber-300">🌿 Jungle →</a>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 border border-gray-800/50 rounded-2xl">
            <div className="w-16 h-16 rounded-2xl bg-gray-800 border border-gray-700 flex items-center justify-center mb-4 text-3xl">
              📈
            </div>
            <h3 className="text-lg font-bold text-gray-400 mb-2">No signals match</h3>
            <p className="text-sm text-gray-600 mb-3">
              {minConsec > 0
                ? `No stocks had ${minConsec}+ consecutive days of this signal. Try reducing the consecutive days filter.`
                : 'Try changing the filters above.'}
            </p>
            <button onClick={() => { handleConsec(0); setSignalFilter('all'); setBiasFilter('all'); setConsisFilter('all'); setTripleOnly(false); setAccelOnly(false) }}
              className="text-xs text-emerald-400 hover:text-emerald-300">
              Reset all filters
            </button>
          </div>
        )}

        <div className="mt-8 bg-gray-900/20 border border-gray-800/40 rounded-xl p-4">
          <p className="text-xs text-gray-600 leading-relaxed">
            <span className="text-gray-400 font-semibold">Disclaimer:</span> Positional Radar shows observed OI, volume and price trends from NSE publicly available data.
            Signals are informational only — not investment advice. Always confirm with UOA and Options Jungle before making decisions.
            GreekNova is not SEBI-registered. Trade at your own risk.
          </p>
        </div>
      </div>
    </div>
  )
}
