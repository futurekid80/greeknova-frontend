'use client'
import { useEffect, useState, useCallback } from 'react'
import Navbar from '@/components/Navbar'

const API = 'https://greeknova-backend-production.up.railway.app'

interface ConfluenceResult {
  symbol: string
  close_price: number
  score: number
  grade: string
  grade_color: string
  confluence_type: string
  confluence_label: string
  fut_signal: string
  fut_oi_chg_pct: number
  price_chg_pct: number
  delivery_pct: number
  delivery_trend: string
  delivery_5d: number[]
  breakdown: {
    delivery_today: number
    delivery_trend: number
    fut_alignment: number
    oi_strength: number
  }
}

interface ConfluenceData {
  date: string
  total: number
  bullish: number
  bearish: number
  results: ConfluenceResult[]
  top_bullish: ConfluenceResult[]
  top_bearish: ConfluenceResult[]
}

function fmt(n: number, dec = 2) {
  return n >= 0 ? `+${n.toFixed(dec)}%` : `${n.toFixed(dec)}%`
}
function fmtPrice(n: number) {
  return n >= 1000
    ? `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
    : `₹${n.toFixed(2)}`
}

function gradeColors(grade: string) {
  if (grade === 'A+') return { bg: 'bg-amber-950/40 border-amber-700/50', text: 'text-amber-400', badge: 'bg-amber-900/60 border-amber-700/50 text-amber-300' }
  if (grade === 'A')  return { bg: 'bg-emerald-950/30 border-emerald-700/50', text: 'text-emerald-400', badge: 'bg-emerald-900/60 border-emerald-700/50 text-emerald-300' }
  if (grade === 'B')  return { bg: 'bg-sky-950/20 border-sky-800/40', text: 'text-sky-400', badge: 'bg-sky-900/60 border-sky-700/50 text-sky-300' }
  return { bg: 'bg-gray-900/40 border-gray-700/50', text: 'text-gray-400', badge: 'bg-gray-800 border-gray-700 text-gray-400' }
}

function signalColor(signal: string) {
  if (signal === 'LONG_BUILDUP')   return 'text-emerald-400'
  if (signal === 'SHORT_COVERING') return 'text-sky-400'
  if (signal === 'SHORT_BUILDUP')  return 'text-red-400'
  if (signal === 'LONG_UNWINDING') return 'text-amber-400'
  return 'text-gray-400'
}

function signalLabel(signal: string) {
  if (signal === 'LONG_BUILDUP')   return 'Long Buildup'
  if (signal === 'SHORT_COVERING') return 'Short Covering'
  if (signal === 'SHORT_BUILDUP')  return 'Short Buildup'
  if (signal === 'LONG_UNWINDING') return 'Long Unwinding'
  return signal
}

function TrendSparkline({ values }: { values: number[] }) {
  if (!values || values.length < 2) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const w = 60
  const h = 20
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w
    const y = h - ((v - min) / range) * h
    return `${x},${y}`
  }).join(' ')
  const last = values[values.length - 1]
  const first = values[0]
  const color = last >= first ? '#10b981' : '#ef4444'
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={(values.length-1)/(values.length-1)*w} cy={h-((last-min)/range)*h} r="2" fill={color} />
    </svg>
  )
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 85 ? 'bg-amber-500' : score >= 70 ? 'bg-emerald-500' : score >= 55 ? 'bg-sky-500' : 'bg-gray-600'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-bold text-white w-6 text-right">{score}</span>
    </div>
  )
}

function ConfluenceCard({ s }: { s: ConfluenceResult }) {
  const [expanded, setExpanded] = useState(false)
  const gc = gradeColors(s.grade)
  const isBullish = s.confluence_type.includes('BULLISH')

  return (
    <div className={`rounded-xl border p-4 ${gc.bg} transition-all`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-base font-black text-white">{s.symbol}</p>
            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full border ${gc.badge}`}>
              {s.grade}
            </span>
          </div>
          <p className="text-xs text-gray-400">{fmtPrice(s.close_price)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold text-gray-300">{s.confluence_label}</p>
          <p className={`text-xs font-semibold mt-0.5 ${signalColor(s.fut_signal)}`}>
            {signalLabel(s.fut_signal)}
          </p>
        </div>
      </div>

      {/* Score bar */}
      <div className="mb-3">
        <ScoreBar score={s.score} />
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-3 gap-2 text-center mb-3">
        <div className="bg-black/20 rounded-lg py-1.5">
          <p className="text-[10px] text-gray-500">Delivery</p>
          <p className={`text-sm font-bold ${s.delivery_pct >= 60 ? 'text-emerald-400' : 'text-amber-400'}`}>
            {s.delivery_pct}%
          </p>
        </div>
        <div className="bg-black/20 rounded-lg py-1.5">
          <p className="text-[10px] text-gray-500">FUT OI</p>
          <p className={`text-sm font-bold ${s.fut_oi_chg_pct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {fmt(s.fut_oi_chg_pct)}
          </p>
        </div>
        <div className="bg-black/20 rounded-lg py-1.5">
          <p className="text-[10px] text-gray-500">Price</p>
          <p className={`text-sm font-bold ${s.price_chg_pct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {fmt(s.price_chg_pct)}
          </p>
        </div>
      </div>

      {/* Delivery trend sparkline */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-[10px] text-gray-500 mb-1">5-day delivery trend</p>
          <TrendSparkline values={s.delivery_5d} />
        </div>
        <div className="text-right">
          <p className="text-[10px] text-gray-500">Trend</p>
          <p className={`text-xs font-semibold ${
            s.delivery_trend.includes('↑') ? 'text-emerald-400' :
            s.delivery_trend.includes('↗') ? 'text-emerald-300' :
            s.delivery_trend.includes('↓') ? 'text-red-400' :
            s.delivery_trend.includes('↘') ? 'text-red-300' : 'text-gray-400'
          }`}>{s.delivery_trend}</p>
        </div>
      </div>

      {/* Expandable breakdown */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full text-[10px] text-gray-600 hover:text-gray-400 transition-colors text-center mt-1"
      >
        {expanded ? '▲ Hide breakdown' : '▼ Score breakdown'}
      </button>

      {expanded && (
        <div className="mt-2 space-y-1 border-t border-gray-800/50 pt-2">
          {[
            { label: 'Delivery % today', val: s.breakdown.delivery_today, max: 30 },
            { label: '5d delivery trend', val: s.breakdown.delivery_trend, max: 25 },
            { label: 'FUT alignment',     val: s.breakdown.fut_alignment,  max: 30 },
            { label: 'OI strength',       val: s.breakdown.oi_strength,    max: 15 },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-2">
              <p className="text-[10px] text-gray-500 w-28 flex-shrink-0">{item.label}</p>
              <div className="flex-1 h-1 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${(item.val/item.max)*100}%` }} />
              </div>
              <p className="text-[10px] text-gray-300 w-8 text-right">{item.val}/{item.max}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function DeliveryConfluence() {
  const [data, setData] = useState<ConfluenceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'bullish' | 'bearish'>('all')
  const [minGrade, setMinGrade] = useState<'all' | 'A+' | 'A' | 'B'>('all')

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API}/delivery-confluence`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
    } catch (e: any) {
      setError(e.message)
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading) return (
    <div className="min-h-screen bg-black">
      <Navbar active="/delivery-confluence" />
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-4">
        {[1,2,3].map(i => <div key={i} className="h-40 bg-gray-900 rounded-xl animate-pulse" />)}
      </div>
    </div>
  )

  if (error || !data) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center">
        <p className="text-red-400 font-bold mb-2">Failed to load</p>
        <button onClick={fetchData} className="text-sm px-4 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg">Retry</button>
      </div>
    </div>
  )

  const filtered = data.results.filter(r => {
    if (filter === 'bullish' && !r.confluence_type.includes('BULLISH')) return false
    if (filter === 'bearish' && !r.confluence_type.includes('BEARISH') && r.confluence_type !== 'STEALTH') return false
    if (minGrade === 'A+' && r.grade !== 'A+') return false
    if (minGrade === 'A' && !['A+', 'A'].includes(r.grade)) return false
    if (minGrade === 'B' && !['A+', 'A', 'B'].includes(r.grade)) return false
    return true
  })

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar active="/delivery-confluence" />
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-black text-white">Delivery Confluence</h1>
            <p className="text-gray-400 text-sm mt-1">
              FUT OI × Cash delivery alignment · {data.date} · Stocks where institutions are active in both markets
            </p>
          </div>
          <button onClick={fetchData} className="text-xs px-3 py-1.5 bg-gray-900 border border-gray-700 text-gray-300 rounded-lg hover:border-gray-500">
            ↻ Refresh
          </button>
        </div>

        {/* Summary strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total Signals', val: data.total, color: 'text-white' },
            { label: 'Bullish', val: data.bullish, color: 'text-emerald-400' },
            { label: 'Bearish', val: data.bearish, color: 'text-red-400' },
            { label: 'A+ Grade', val: data.results.filter(r => r.grade === 'A+').length, color: 'text-amber-400' },
          ].map(item => (
            <div key={item.label} className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">{item.label}</p>
              <p className={`text-3xl font-black ${item.color}`}>{item.val}</p>
            </div>
          ))}
        </div>

        {/* Top picks */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Top Bullish */}
          <div>
            <h2 className="text-sm font-bold text-emerald-400 mb-3 flex items-center gap-2">
              🐂 Top Bullish Confluence
              <span className="text-xs text-gray-500 font-normal">FUT longs + high delivery</span>
            </h2>
            <div className="space-y-2">
              {data.top_bullish.map(s => (
                <div key={s.symbol} className="flex items-center gap-3 bg-emerald-950/20 border border-emerald-800/30 rounded-lg px-3 py-2">
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded border ${gradeColors(s.grade).badge}`}>{s.grade}</span>
                  <span className="text-white font-bold text-sm flex-1">{s.symbol}</span>
                  <span className="text-emerald-400 text-xs font-semibold">{s.delivery_pct}% del</span>
                  <span className="text-gray-400 text-xs">{s.delivery_trend}</span>
                  <span className="text-white font-bold text-sm">{s.score}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top Bearish */}
          <div>
            <h2 className="text-sm font-bold text-red-400 mb-3 flex items-center gap-2">
              🐻 Top Bearish Conviction
              <span className="text-xs text-gray-500 font-normal">FUT shorts/unwind + high delivery</span>
            </h2>
            <div className="space-y-2">
              {data.top_bearish.map(s => (
                <div key={s.symbol} className="flex items-center gap-3 bg-red-950/20 border border-red-800/30 rounded-lg px-3 py-2">
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded border ${gradeColors(s.grade).badge}`}>{s.grade}</span>
                  <span className="text-white font-bold text-sm flex-1">{s.symbol}</span>
                  <span className="text-red-400 text-xs font-semibold">{s.delivery_pct}% del</span>
                  <span className="text-gray-400 text-xs">{s.delivery_trend}</span>
                  <span className="text-white font-bold text-sm">{s.score}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-500">Direction:</span>
          {(['all', 'bullish', 'bearish'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-all font-semibold ${
                filter === f
                  ? f === 'bullish' ? 'bg-emerald-900/50 border-emerald-700 text-emerald-300'
                  : f === 'bearish' ? 'bg-red-900/50 border-red-700 text-red-300'
                  : 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                  : 'bg-gray-900/50 border-gray-700 text-gray-400 hover:border-gray-500'
              }`}>
              {f === 'all' ? 'All' : f === 'bullish' ? '🐂 Bullish' : '🐻 Bearish'}
            </button>
          ))}
          <span className="ml-3 text-xs text-gray-500">Min Grade:</span>
          {(['all', 'A+', 'A', 'B'] as const).map(g => (
            <button key={g} onClick={() => setMinGrade(g)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-all font-semibold ${
                minGrade === g
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                  : 'bg-gray-900/50 border-gray-700 text-gray-400 hover:border-gray-500'
              }`}>
              {g === 'all' ? 'All' : `${g}+`}
            </button>
          ))}
          <span className="ml-auto text-xs text-gray-500">{filtered.length} signals</span>
        </div>

        {/* Cards grid */}
        {filtered.length === 0 ? (
          <div className="border border-gray-800 rounded-xl py-10 text-center">
            <p className="text-gray-500">No signals match the current filter.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(s => <ConfluenceCard key={s.symbol} s={s} />)}
          </div>
        )}

        {/* How to read */}
        <div className="border border-gray-800 rounded-xl p-4 bg-gray-950/40">
          <p className="text-sm font-semibold text-gray-300 mb-3">📖 How to read Delivery Confluence</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-gray-400">
            <div>
              <p className="text-white font-semibold mb-1">What it measures</p>
              <p>When FUT OI builds/unwinds AND cash market delivery is high, it means the same institutional view is playing out in both F&O and cash markets — much stronger signal than FUT alone.</p>
            </div>
            <div>
              <p className="text-white font-semibold mb-1">Scoring (0-100)</p>
              <p>Delivery % today (30) + 5-day trend (25) + FUT alignment (30) + OI strength (15). A+ ≥85 is the strongest setup.</p>
            </div>
            <div>
              <p className="text-white font-semibold mb-1">🐂 Bullish Confluence</p>
              <p>Long Buildup/Short Covering + delivery ≥55% = institutions buying in cash AND building longs in futures. Most reliable upside signal.</p>
            </div>
            <div>
              <p className="text-white font-semibold mb-1">🐻 Bearish Conviction</p>
              <p>Short Buildup/Long Unwinding + high delivery = investors selling their holdings AND shorts building in FUT. Sustained downside likely.</p>
            </div>
          </div>
        </div>

        <div className="text-center pt-2">
          <p className="text-[11px] text-gray-600">
            GreekNova · Delivery Confluence · {data.date} · For educational purposes only · Not SEBI registered
          </p>
        </div>
      </div>
    </div>
  )
}
