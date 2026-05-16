'use client'
import Navbar from '@/components/Navbar'
import { useEffect, useState, useCallback, useRef } from 'react'
import { RefreshCw, TrendingUp, TrendingDown } from 'lucide-react'

const API = 'https://greeknova-backend-production.up.railway.app'

interface RadarResult {
  symbol: string; is_index: boolean
  signal: string; signal_desc: string; bias: string
  conviction: string; strength_days: number
  oi_chg_pct: number; price_chg_pct: number
  oi_rising_days: number; price_rising_days: number
  oi_series: number[]; cmp_series: number[]
  date_labels: string[]; cmp: number
  oi_now: number; oi_start: number; days_analyzed: number
}

interface RadarData {
  days: number
  dates_analyzed: string[]
  total: number
  summary: {
    long_buildup: number; short_buildup: number
    short_covering: number; long_unwinding: number
    high_conviction: number
  }
  results: RadarResult[]
}

const SIGNAL_META: Record<string, { color: string; bg: string; border: string; icon: string; label: string }> = {
  LONG_BUILDUP:   { color: 'text-emerald-400', bg: 'bg-emerald-950/30', border: 'border-emerald-800/40', icon: '🐂', label: 'Long Buildup' },
  SHORT_BUILDUP:  { color: 'text-red-400',     bg: 'bg-red-950/30',     border: 'border-red-800/40',     icon: '🐻', label: 'Short Buildup' },
  SHORT_COVERING: { color: 'text-cyan-400',    bg: 'bg-cyan-950/30',    border: 'border-cyan-800/40',    icon: '🔄', label: 'Short Covering' },
  LONG_UNWINDING: { color: 'text-orange-400',  bg: 'bg-orange-950/30',  border: 'border-orange-800/40',  icon: '⚠️', label: 'Long Unwinding' },
}

// Mini sparkline component
function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const w = 80; const h = 28
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w
    const y = h - ((v - min) / range) * h
    return `${x},${y}`
  }).join(' ')

  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/>
      {/* Last point dot */}
      {data.length > 0 && (
        <circle
          cx={(data.length - 1) / (data.length - 1) * w}
          cy={h - ((data[data.length-1] - min) / range) * h}
          r="2.5" fill={color}
        />
      )}
    </svg>
  )
}

function ConvictionBadge({ conviction, days }: { conviction: string; days: number }) {
  const styles = {
    HIGH:   'bg-orange-950/60 text-orange-400 border-orange-800/50',
    MEDIUM: 'bg-amber-950/60 text-amber-400 border-amber-800/50',
    LOW:    'bg-gray-800 text-gray-400 border-gray-700',
  }
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${styles[conviction as keyof typeof styles]}`}>
      {conviction} · {days}d
    </span>
  )
}

export default function PositionalRadar() {
  const [data, setData]         = useState<RadarData | null>(null)
  const [loading, setLoading]   = useState(true)
  const [days, setDays]         = useState(5)
  const [filter, setFilter]     = useState<'all'|'index'|'stocks'>('all')
  const [signalFilter, setSignalFilter] = useState<string>('all')
  const [biasFilter, setBiasFilter]     = useState<'all'|'BULLISH'|'BEARISH'>('all')
  const [convFilter, setConvFilter]     = useState<'all'|'HIGH'|'MEDIUM'>('all')
  const daysRef = useRef(5)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch(`${API}/positional-radar?days=${daysRef.current}`)
      const json = await res.json()
      setData(json)
    } catch(e) { console.error(e) }
    setLoading(false)
  }, [])

  function handleDays(d: number) {
    setDays(d); daysRef.current = d; fetchData()
  }

  useEffect(() => { fetchData() }, [])

  const results = data?.results || []
  const filtered = results
    .filter(r => filter === 'all' || (filter === 'index' ? r.is_index : !r.is_index))
    .filter(r => signalFilter === 'all' || r.signal === signalFilter)
    .filter(r => biasFilter === 'all' || r.bias === biasFilter)
    .filter(r => convFilter === 'all' || r.conviction === convFilter)

  const s = data?.summary

  return (
    <div className="min-h-screen bg-[#07070e] text-white">
      <Navbar active="/positional" />

      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="text-3xl font-black tracking-tight mb-1 flex items-center gap-3">
              📈 Positional Radar
            </h1>
            <p className="text-gray-500 text-sm">
              Multi-day OI + price trends · For positional traders · Symbol-level analysis
            </p>
          </div>
          <button onClick={fetchData} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-sm font-medium text-white rounded-lg border border-gray-700 transition-all disabled:opacity-50">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''}/>Refresh
          </button>
        </div>

        {/* Methodology note */}
        <div className="bg-gray-900/20 border border-gray-800/50 rounded-xl px-4 py-3 mb-6">
          <p className="text-xs text-gray-500">
            <span className="text-gray-300 font-semibold">How it works: </span>
            Compares total OI (all strikes combined) and closing price over selected days ·
            <span className="text-emerald-400"> Long Buildup</span> = OI rising + price rising ·
            <span className="text-red-400"> Short Buildup</span> = OI rising + price falling ·
            <span className="text-cyan-400"> Short Covering</span> = OI falling + price rising ·
            <span className="text-orange-400"> Long Unwinding</span> = OI falling + price falling ·
            Conviction based on consecutive days signal held
          </p>
        </div>

        {/* Days selector */}
        <div className="flex items-center gap-3 mb-6">
          <span className="text-xs text-gray-500 font-semibold">Lookback period:</span>
          {[3, 4, 5, 7].map(d => (
            <button key={d} onClick={() => handleDays(d)}
              className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${days===d ? 'bg-white text-gray-900 border-white' : 'bg-gray-900/40 text-gray-400 border-gray-800 hover:text-white'}`}>
              {d} days
            </button>
          ))}
          {data?.dates_analyzed && (
            <span className="text-xs text-gray-600 ml-2">
              {data.dates_analyzed[0]} → {data.dates_analyzed[data.dates_analyzed.length-1]}
            </span>
          )}
        </div>

        {/* Summary boxes */}
        <div className="grid grid-cols-5 gap-3 mb-6">
          <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Total Signals</p>
            <p className="text-2xl font-black text-white">{data?.total || 0}</p>
            <p className="text-xs text-gray-600">across {days} days</p>
          </div>
          <div className="bg-emerald-950/20 border border-emerald-800/40 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">🐂 Long Buildup</p>
            <p className="text-2xl font-black text-emerald-400">{s?.long_buildup || 0}</p>
            <p className="text-xs text-gray-600">OI + price rising</p>
          </div>
          <div className="bg-red-950/20 border border-red-800/40 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">🐻 Short Buildup</p>
            <p className="text-2xl font-black text-red-400">{s?.short_buildup || 0}</p>
            <p className="text-xs text-gray-600">OI rising, price falling</p>
          </div>
          <div className="bg-cyan-950/20 border border-cyan-800/40 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">🔄 Short Covering</p>
            <p className="text-2xl font-black text-cyan-400">{s?.short_covering || 0}</p>
            <p className="text-xs text-gray-600">OI falling, price rising</p>
          </div>
          <div className="bg-orange-950/20 border border-orange-800/40 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">🎯 High Conviction</p>
            <p className="text-2xl font-black text-orange-400">{s?.high_conviction || 0}</p>
            <p className="text-xs text-gray-600">consecutive days held</p>
          </div>
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
          {(['all','HIGH','MEDIUM'] as const).map(c => (
            <button key={c} onClick={() => setConvFilter(c)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${convFilter===c
                ? c==='HIGH' ? 'bg-orange-950 text-orange-400 border-orange-800'
                : c==='MEDIUM' ? 'bg-amber-950 text-amber-400 border-amber-800'
                : 'bg-white text-gray-900 border-white'
                : 'bg-gray-900/40 text-gray-400 border-gray-800 hover:text-white'}`}>
              {c==='all'?'All Conviction':c==='HIGH'?'🎯 High':' Medium'}
            </button>
          ))}
        </div>

        <p className="text-xs text-gray-600 mb-4">
          {filtered.length} signals · {days}-day lookback · Informational only
        </p>

        {loading ? (
          <div className="space-y-2">{[1,2,3,4,5].map(i=>(
            <div key={i} className="h-20 bg-gray-900/30 border border-gray-800 rounded-xl animate-pulse"/>
          ))}</div>
        ) : filtered.length > 0 ? (
          <div className="rounded-2xl border border-gray-800 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-900/60 border-b border-gray-800">
                  {['Symbol','Signal','Conviction','OI Trend','Price Trend','OI Sparkline','Price Sparkline','CMP','Action'].map((h,i)=>(
                    <th key={h} className={`text-xs font-semibold text-gray-500 px-4 py-3.5 ${i<=2?'text-left':'text-right'} ${i===0?'pl-5':''} ${i===8?'pr-5 text-left':''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => {
                  const m = SIGNAL_META[r.signal]
                  const oiColor  = r.oi_chg_pct > 0 ? '#10b981' : '#ef4444'
                  const cmpColor = r.price_chg_pct > 0 ? '#10b981' : '#ef4444'

                  return (
                    <tr key={r.symbol}
                      className={`border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors ${i%2===0?'':'bg-gray-900/20'}`}>

                      {/* Symbol */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <a href={`/stock/${r.symbol}`} className="text-sm font-black text-white hover:text-emerald-400 transition-colors">
                            {r.symbol}
                          </a>
                          {r.is_index && <span className="text-xs px-1.5 py-0.5 bg-cyan-950 text-cyan-400 border border-cyan-800/50 rounded-md">IDX</span>}
                        </div>
                        <p className="text-xs text-gray-600 mt-0.5">₹{r.cmp.toLocaleString('en-IN')}</p>
                      </td>

                      {/* Signal */}
                      <td className="px-4 py-4">
                        <div className={`inline-flex items-center gap-1.5 text-xs font-bold px-2 py-1 rounded-lg border ${m.color} ${m.bg} ${m.border}`}>
                          {m.icon} {m.label}
                        </div>
                        <p className="text-xs text-gray-600 mt-1 max-w-[160px]">{r.signal_desc}</p>
                      </td>

                      {/* Conviction */}
                      <td className="px-4 py-4">
                        <ConvictionBadge conviction={r.conviction} days={r.strength_days}/>
                        <p className="text-xs text-gray-600 mt-1">{r.days_analyzed}d data</p>
                      </td>

                      {/* OI Trend */}
                      <td className="px-4 py-4 text-right">
                        <p className={`text-sm font-black ${r.oi_chg_pct > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {r.oi_chg_pct > 0 ? '+' : ''}{r.oi_chg_pct}%
                        </p>
                        <p className="text-xs text-gray-600">{r.oi_rising_days}d rising</p>
                      </td>

                      {/* Price Trend */}
                      <td className="px-4 py-4 text-right">
                        <p className={`text-sm font-black ${r.price_chg_pct > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {r.price_chg_pct > 0 ? '+' : ''}{r.price_chg_pct}%
                        </p>
                        <p className="text-xs text-gray-600">{r.price_rising_days}d rising</p>
                      </td>

                      {/* OI Sparkline */}
                      <td className="px-4 py-4 text-right">
                        <div className="flex justify-end">
                          <Sparkline data={r.oi_series} color={oiColor}/>
                        </div>
                        <p className="text-xs text-gray-600 mt-1">{(r.oi_now/100000).toFixed(1)}L now</p>
                      </td>

                      {/* Price Sparkline */}
                      <td className="px-4 py-4 text-right">
                        <div className="flex justify-end">
                          <Sparkline data={r.cmp_series} color={cmpColor}/>
                        </div>
                        <p className="text-xs text-gray-600 mt-1">₹{r.cmp_series[0]?.toFixed(0)} → ₹{r.cmp.toFixed(0)}</p>
                      </td>

                      {/* CMP */}
                      <td className="px-4 py-4 text-right">
                        <p className="text-sm font-bold text-amber-400">₹{r.cmp.toLocaleString('en-IN')}</p>
                      </td>

                      {/* Deep dive links */}
                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-1">
                          <a href={`/uoa`} className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                            🐋 Check UOA →
                          </a>
                          <a href={`/jungle`} className="text-xs text-amber-400 hover:text-amber-300 transition-colors">
                            🌿 Check Jungle →
                          </a>
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
            <h3 className="text-lg font-bold text-gray-400 mb-2">No positional signals found</h3>
            <p className="text-sm text-gray-600">Try reducing the lookback period or changing filters</p>
          </div>
        )}

        {/* Disclaimer */}
        <div className="mt-8 bg-gray-900/20 border border-gray-800/40 rounded-xl p-4">
          <p className="text-xs text-gray-600 leading-relaxed">
            <span className="text-gray-400 font-semibold">Disclaimer:</span> Positional Radar shows observed OI and price trends from NSE data.
            Signals are informational only — not investment advice. Always confirm with UOA and Options Jungle before making any decision.
            GreekNova is not SEBI-registered. Trade at your own risk.
          </p>
        </div>
      </div>
    </div>
  )
}
