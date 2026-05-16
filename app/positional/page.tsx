'use client'
import Navbar from '@/components/Navbar'
import { useEffect, useState, useCallback, useRef } from 'react'
import { RefreshCw } from 'lucide-react'

const API = 'https://greeknova-backend-production.up.railway.app'

interface RadarResult {
  symbol: string; is_index: boolean
  signal: string; bias: string
  conviction: string; consec_days: number; actual_days: number
  triple_confirm: boolean
  oi_chg_pct: number; vol_chg_pct: number; cmp_chg_pct: number
  oi_consec_up: number; oi_consec_down: number
  vol_consec_up: number
  cmp_consec_up: number; cmp_consec_down: number
  oi_series: number[]; vol_series: number[]; cmp_series: number[]
  date_labels: string[]; cmp: number
}

interface RadarData {
  days: number; from_date: string; to_date: string; total: number
  summary: {
    long_buildup: number; short_buildup: number
    short_covering: number; long_unwinding: number
    high_conviction: number; triple_confirm: number
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
  const w = 72; const h = 26
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(' ')
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/>
      <circle cx={(data.length-1)/(data.length-1)*w} cy={h-((data[data.length-1]-min)/range)*h} r="2.5" fill={color}/>
    </svg>
  )
}

function TrendCell({ chgPct, consecUp, consecDown, signal }: {
  chgPct: number; consecUp: number; consecDown: number; signal: string
}) {
  const rising = chgPct > 0
  return (
    <div className="text-right">
      <p className={`text-sm font-black ${rising ? 'text-emerald-400' : 'text-red-400'}`}>
        {chgPct > 0 ? '+' : ''}{chgPct}%
      </p>
      <p className="text-xs text-gray-600">
        {rising ? `↑ ${consecUp}d consec` : `↓ ${consecDown}d consec`}
      </p>
    </div>
  )
}

export default function PositionalRadar() {
  const [data, setData]       = useState<RadarData | null>(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays]       = useState(5)
  const [filter, setFilter]   = useState<'all'|'index'|'stocks'>('all')
  const [signalFilter, setSignalFilter] = useState<string>('all')
  const [biasFilter, setBiasFilter]     = useState<'all'|'BULLISH'|'BEARISH'>('all')
  const [convFilter, setConvFilter]     = useState<string>('all')
  const [tripleOnly, setTripleOnly]     = useState(false)
  const daysRef = useRef(5)

  const fetchData = useCallback(async (d?: number) => {
    setLoading(true)
    const useDays = d ?? daysRef.current
    try {
      const res  = await fetch(`${API}/positional-radar?days=${useDays}`)
      const json = await res.json()
      setData(json)
    } catch(e) { console.error(e) }
    setLoading(false)
  }, [])

  function handleDays(d: number) {
    setDays(d); daysRef.current = d; fetchData(d)
  }

  useEffect(() => { fetchData() }, [])

  const results = (data?.results || [])
    .filter(r => filter === 'all' || (filter === 'index' ? r.is_index : !r.is_index))
    .filter(r => signalFilter === 'all' || r.signal === signalFilter)
    .filter(r => biasFilter === 'all' || r.bias === biasFilter)
    .filter(r => convFilter === 'all' || r.conviction === convFilter)
    .filter(r => !tripleOnly || r.triple_confirm)

  const s = data?.summary

  return (
    <div className="min-h-screen bg-[#07070e] text-white">
      <Navbar active="/positional" />
      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="text-3xl font-black tracking-tight mb-1">📈 Positional Radar</h1>
            <p className="text-gray-500 text-sm">Multi-day OI + Price + Volume trends · Symbol-level · For positional traders</p>
          </div>
          <button onClick={() => fetchData()} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-sm font-medium rounded-lg border border-gray-700 disabled:opacity-50 transition-all">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''}/>Refresh
          </button>
        </div>

        {/* Methodology */}
        <div className="bg-gray-900/20 border border-gray-800/50 rounded-xl px-4 py-3 mb-5">
          <p className="text-xs text-gray-500 leading-relaxed">
            <span className="text-gray-300 font-semibold">How to read: </span>
            <span className="text-emerald-400">% change</span> = total change over the selected period (first day → last day) ·
            <span className="text-amber-400"> Consec</span> = how many consecutive days at the <em>end</em> of the period the condition held ·
            <span className="text-orange-400"> Conviction</span> = HIGH if consec ≥ period−1, MEDIUM if ≥ 2 days, LOW otherwise ·
            <span className="text-purple-400"> 🎯 Triple</span> = OI rising + Price rising + Volume rising simultaneously
          </p>
        </div>

        {/* Days selector */}
        <div className="flex items-center gap-3 mb-5">
          <span className="text-xs text-gray-500 font-semibold">Lookback:</span>
          {[3, 4, 5, 7].map(d => (
            <button key={d} onClick={() => handleDays(d)}
              className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${days===d ? 'bg-white text-gray-900 border-white' : 'bg-gray-900/40 text-gray-400 border-gray-800 hover:text-white'}`}>
              {d} days
            </button>
          ))}
          {data?.from_date && (
            <span className="text-xs text-gray-600 ml-2">{data.from_date} → {data.to_date}</span>
          )}
        </div>

        {/* Summary */}
        <div className="grid grid-cols-6 gap-3 mb-5">
          {[
            { label: 'Total', val: data?.total || 0, color: 'text-white', sub: `${days}-day signals` },
            { label: '🐂 Long Buildup',   val: s?.long_buildup   || 0, color: 'text-emerald-400', sub: 'OI + price rising' },
            { label: '🐻 Short Buildup',  val: s?.short_buildup  || 0, color: 'text-red-400',     sub: 'OI rising, price ↓' },
            { label: '🔄 Short Covering', val: s?.short_covering || 0, color: 'text-cyan-400',    sub: 'OI falling, price ↑' },
            { label: '🎯 High Conv',      val: s?.high_conviction|| 0, color: 'text-orange-400',  sub: 'consecutive days held' },
            { label: '⚡ Triple Confirm', val: s?.triple_confirm || 0, color: 'text-purple-400',  sub: 'OI + Price + Volume ↑' },
          ].map(({ label, val, color, sub }) => (
            <div key={label} className="bg-gray-900/30 border border-gray-800 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">{label}</p>
              <p className={`text-2xl font-black ${color}`}>{val}</p>
              <p className="text-xs text-gray-600">{sub}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {(['all','index','stocks'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all capitalize ${filter===f ? 'bg-white text-gray-900 border-white' : 'bg-gray-900/40 text-gray-400 border-gray-800 hover:text-white'}`}>
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
            <button key={c} onClick={() => setConvFilter(c)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${convFilter===c
                ? c==='HIGH' ? 'bg-orange-950 text-orange-400 border-orange-800'
                : c==='MEDIUM' ? 'bg-amber-950 text-amber-400 border-amber-800'
                : 'bg-white text-gray-900 border-white'
                : 'bg-gray-900/40 text-gray-400 border-gray-800 hover:text-white'}`}>
              {c==='all'?'All':c}
            </button>
          ))}
          <button onClick={() => setTripleOnly(t => !t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${tripleOnly ? 'bg-purple-950 text-purple-400 border-purple-800' : 'bg-gray-900/40 text-gray-400 border-gray-800 hover:text-white'}`}>
            ⚡ Triple Only
          </button>
        </div>

        <p className="text-xs text-gray-600 mb-4">
          {results.length} signals · {days}-day lookback · Informational only · Not investment advice
        </p>

        {loading ? (
          <div className="space-y-2">{[1,2,3,4,5].map(i=>(
            <div key={i} className="h-20 bg-gray-900/30 border border-gray-800 rounded-xl animate-pulse"/>
          ))}</div>
        ) : results.length > 0 ? (
          <div className="rounded-2xl border border-gray-800 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-900/60 border-b border-gray-800">
                  {['Symbol','Signal','Conviction','OI Change','Volume Change','Price Change','OI Trend','Price Trend','CMP','Deep Dive'].map((h,i)=>(
                    <th key={h} className={`text-xs font-semibold text-gray-500 px-3 py-3.5 ${i<=2?'text-left':'text-right'} ${i===0?'pl-5':''} ${i===9?'pr-5 text-left':''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => {
                  const m = SIGNAL_META[r.signal]
                  const oiColor  = r.oi_chg_pct  > 0 ? '#10b981' : '#ef4444'
                  const cmpColor = r.cmp_chg_pct > 0 ? '#10b981' : '#ef4444'
                  return (
                    <tr key={r.symbol}
                      className={`border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors ${r.triple_confirm ? 'bg-purple-950/10' : i%2===0?'':'bg-gray-900/20'}`}>

                      {/* Symbol */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-white">{r.symbol}</span>
                          {r.triple_confirm && <span className="text-xs px-1.5 py-0.5 bg-purple-950 text-purple-400 border border-purple-800/50 rounded-md">⚡ Triple</span>}
                          {r.is_index && <span className="text-xs px-1.5 py-0.5 bg-cyan-950 text-cyan-400 border border-cyan-800/50 rounded-md">IDX</span>}
                        </div>
                        <p className="text-xs text-gray-600 mt-0.5">₹{r.cmp.toLocaleString('en-IN')}</p>
                      </td>

                      {/* Signal */}
                      <td className="px-3 py-3.5">
                        <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg border ${m.color} ${m.bg} ${m.border}`}>
                          {m.icon} {m.label}
                        </span>
                      </td>

                      {/* Conviction */}
                      <td className="px-3 py-3.5">
                        <span className={`text-xs font-bold px-2 py-1 rounded-md border ${
                          r.conviction === 'HIGH'   ? 'bg-orange-950/60 text-orange-400 border-orange-800/50' :
                          r.conviction === 'MEDIUM' ? 'bg-amber-950/60 text-amber-400 border-amber-800/50' :
                                                      'bg-gray-800 text-gray-400 border-gray-700'
                        }`}>
                          {r.conviction}
                        </span>
                        <p className="text-xs text-gray-600 mt-1">
                          {r.consec_days}d consec · {r.actual_days}d data
                        </p>
                      </td>

                      {/* OI Change */}
                      <td className="px-3 py-3.5">
                        <TrendCell chgPct={r.oi_chg_pct} consecUp={r.oi_consec_up} consecDown={r.oi_consec_down} signal={r.signal}/>
                      </td>

                      {/* Volume Change */}
                      <td className="px-3 py-3.5 text-right">
                        <p className={`text-sm font-black ${r.vol_chg_pct > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {r.vol_chg_pct > 0 ? '+' : ''}{r.vol_chg_pct}%
                        </p>
                        <p className="text-xs text-gray-600">↑ {r.vol_consec_up}d consec</p>
                      </td>

                      {/* Price Change */}
                      <td className="px-3 py-3.5">
                        <TrendCell chgPct={r.cmp_chg_pct} consecUp={r.cmp_consec_up} consecDown={r.cmp_consec_down} signal={r.signal}/>
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
                        <p className="text-xs text-gray-600">₹{r.cmp_series[0]?.toFixed(0)} → ₹{r.cmp.toFixed(0)}</p>
                      </td>

                      {/* CMP */}
                      <td className="px-3 py-3.5 text-right">
                        <p className="text-sm font-bold text-amber-400">₹{r.cmp.toLocaleString('en-IN')}</p>
                      </td>

                      {/* Deep Dive */}
                      <td className="px-5 py-3.5">
                        <div className="flex flex-col gap-1">
                          <a href="/uoa"    className="text-xs text-blue-400 hover:text-blue-300 transition-colors">🐋 UOA →</a>
                          <a href="/jungle" className="text-xs text-amber-400 hover:text-amber-300 transition-colors">🌿 Jungle →</a>
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
            <div className="text-5xl mb-4">📈</div>
            <p className="text-gray-500">No signals match current filters</p>
            <button onClick={() => { setFilter('all'); setSignalFilter('all'); setBiasFilter('all'); setConvFilter('all'); setTripleOnly(false) }}
              className="mt-3 text-xs text-emerald-400 hover:text-emerald-300">Clear all filters</button>
          </div>
        )}

        <div className="mt-8 bg-gray-900/20 border border-gray-800/40 rounded-xl p-4">
          <p className="text-xs text-gray-600 leading-relaxed">
            <span className="text-gray-400 font-semibold">Disclaimer:</span> Positional Radar shows observed OI, volume and price trends from NSE data.
            Always confirm signals with UOA and Options Jungle. Not investment advice. GreekNova is not SEBI-registered.
          </p>
        </div>
      </div>
    </div>
  )
}
