'use client'
import Navbar from '@/components/Navbar'
import { useEffect, useState, useCallback, useRef } from 'react'
import { RefreshCw, TrendingUp, TrendingDown } from 'lucide-react'

const API = 'https://greeknova-backend-production.up.railway.app'

interface IVResult {
  symbol: string; cmp: number; expiry: string; dte: number
  atm_strike: number; atm_ce_ltp: number; atm_pe_ltp: number; atm_straddle: number
  iv_ce: number | null; iv_pe: number | null; current_iv: number
  iv_52w_high: number; iv_52w_low: number
  ivr: number | null; ivp: number | null
  iv_history_days: number; iv_signal: string; iv_label: string
  strategies: string[]
  expected_move_pts: number; expected_move_pct: number
  upper_range: number; lower_range: number
  upper_range_2sd: number; lower_range_2sd: number
  is_index: boolean
}

interface IVData {
  date: string; timestamp: string; total: number; results: IVResult[]
}

const IV_SIGNAL_META: Record<string, { color: string; bg: string; border: string; label: string; bar: string }> = {
  HIGH_IV:           { color: 'text-red-400',     bg: 'bg-red-950/30',     border: 'border-red-800/40',     label: 'High IV',     bar: 'bg-red-500' },
  ELEVATED_IV:       { color: 'text-orange-400',  bg: 'bg-orange-950/30',  border: 'border-orange-800/40',  label: 'Elevated',    bar: 'bg-orange-400' },
  NORMAL_IV:         { color: 'text-blue-400',    bg: 'bg-blue-950/30',    border: 'border-blue-800/40',    label: 'Normal IV',   bar: 'bg-blue-400' },
  LOW_IV:            { color: 'text-emerald-400', bg: 'bg-emerald-950/30', border: 'border-emerald-800/40', label: 'Low IV',      bar: 'bg-emerald-400' },
  INSUFFICIENT_DATA: { color: 'text-gray-500',    bg: 'bg-gray-900/30',    border: 'border-gray-800',       label: 'Loading...',  bar: 'bg-gray-700' },
}

function IVRBar({ ivr }: { ivr: number | null }) {
  if (ivr === null) return <div className="h-2 bg-gray-800 rounded-full w-full"/>
  const pct = Math.min(100, Math.max(0, ivr))
  const color = ivr >= 75 ? 'bg-red-500' : ivr >= 50 ? 'bg-orange-400' : ivr >= 25 ? 'bg-blue-400' : 'bg-emerald-400'
  return (
    <div className="relative h-2 bg-gray-800 rounded-full w-full overflow-hidden">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }}/>
      {/* Zone markers */}
      <div className="absolute top-0 h-full w-px bg-gray-600" style={{ left: '25%' }}/>
      <div className="absolute top-0 h-full w-px bg-gray-600" style={{ left: '50%' }}/>
      <div className="absolute top-0 h-full w-px bg-gray-600" style={{ left: '75%' }}/>
    </div>
  )
}

function ExpectedMoveBar({ cmp, lower, upper, lower2sd, upper2sd }: {
  cmp: number; lower: number; upper: number; lower2sd: number; upper2sd: number
}) {
  const range2sd = upper2sd - lower2sd
  if (range2sd <= 0) return null
  const cmpPct    = ((cmp - lower2sd) / range2sd) * 100
  const lowerPct  = ((lower - lower2sd) / range2sd) * 100
  const upperPct  = ((upper - lower2sd) / range2sd) * 100

  return (
    <div className="relative h-3 bg-gray-800 rounded-full w-full mt-1">
      {/* 2SD range (full bar) */}
      <div className="absolute inset-0 rounded-full bg-gray-700/40"/>
      {/* 1SD range */}
      <div className="absolute h-full bg-emerald-900/60 rounded-full"
        style={{ left: `${lowerPct}%`, width: `${upperPct - lowerPct}%` }}/>
      {/* CMP marker */}
      <div className="absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-white rounded-full"
        style={{ left: `${Math.min(95, Math.max(2, cmpPct))}%` }}/>
    </div>
  )
}

export default function IVAnalysis() {
  const [data, setData] = useState<IVData | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all'|'index'|'stocks'>('all')
  const [signalFilter, setSignalFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'ivr'|'iv'|'em'|'dte'>('ivr')
  const [autoEnabled, setAutoEnabled] = useState(false)
  const [countdown, setCountdown] = useState(300)
  const intervalRef = useRef<NodeJS.Timeout|null>(null)
  const countdownRef = useRef<NodeJS.Timeout|null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/iv-analysis`)
      const json = await res.json()
      setData(json)
    } catch(e) { console.error(e) }
    setLoading(false)
  }, [])

  function startAuto() {
    setAutoEnabled(true); setCountdown(300)
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (countdownRef.current) clearInterval(countdownRef.current)
    intervalRef.current = setInterval(() => { fetchData(); setCountdown(300) }, 5*60*1000)
    countdownRef.current = setInterval(() => setCountdown(p => Math.max(0, p-1)), 1000)
  }
  function stopAuto() {
    setAutoEnabled(false)
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null }
  }

  useEffect(() => { fetchData(); startAuto()
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [])

  const results = data?.results || []

  const filtered = results
    .filter(r => filter === 'all' || (filter === 'index' ? r.is_index : !r.is_index))
    .filter(r => signalFilter === 'all' || r.iv_signal === signalFilter)
    .sort((a, b) => {
      if (sortBy === 'ivr') return (b.ivr || 0) - (a.ivr || 0)
      if (sortBy === 'iv')  return b.current_iv - a.current_iv
      if (sortBy === 'em')  return b.expected_move_pct - a.expected_move_pct
      if (sortBy === 'dte') return a.dte - b.dte
      return 0
    })

  const highIV  = results.filter(r => r.iv_signal === 'HIGH_IV').length
  const lowIV   = results.filter(r => r.iv_signal === 'LOW_IV').length
  const avgIVR  = results.filter(r => r.ivr !== null).length > 0
    ? Math.round(results.filter(r => r.ivr !== null).reduce((s, r) => s + (r.ivr || 0), 0) / results.filter(r => r.ivr !== null).length)
    : 0

  const mins = Math.floor(countdown/60)
  const secs = countdown % 60

  return (
    <div className="min-h-screen bg-[#07070e] text-white">
      <Navbar active="/iv" />

      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="text-3xl font-black tracking-tight mb-1 flex items-center gap-3">
              📊 IV Analysis
            </h1>
            <p className="text-gray-500 text-sm">
              Implied Volatility Rank · Expected Move · Strategy signals · Black-Scholes from live ATM prices
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => autoEnabled ? stopAuto() : startAuto()}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${autoEnabled ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60' : 'bg-gray-900/40 text-gray-500 border-gray-800'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${autoEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`}/>
              {autoEnabled ? `${mins}:${secs.toString().padStart(2,'0')}` : 'Auto OFF'}
            </button>
            <button onClick={fetchData} disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-sm font-medium text-white rounded-lg border border-gray-700 transition-all disabled:opacity-50">
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''}/>Refresh
            </button>
          </div>
        </div>

        {/* Methodology note */}
        <div className="bg-gray-900/20 border border-gray-800/50 rounded-xl px-4 py-3 mb-6">
          <p className="text-xs text-gray-500">
            <span className="text-gray-300 font-semibold">How this works: </span>
            IV calculated using <span className="text-cyan-400">Black-Scholes + Newton-Raphson</span> from live ATM option prices ·
            <span className="text-amber-400"> IVR</span> = where current IV sits in historical range (higher = more expensive) ·
            <span className="text-emerald-400"> Expected Move</span> = ATM straddle × 0.68 = 68% probability price range by expiry ·
            Risk-free rate: 6.5% (India 10yr Gsec)
          </p>
        </div>

        {/* Summary boxes */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Total Symbols</p>
            <p className="text-2xl font-black text-white">{data?.total || 0}</p>
            <p className="text-xs text-gray-600">IV calculated</p>
          </div>
          <div className="bg-red-950/20 border border-red-800/40 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">🔴 High IV (IVR 75+)</p>
            <p className="text-2xl font-black text-red-400">{highIV}</p>
            <p className="text-xs text-gray-600">premium selling candidates</p>
          </div>
          <div className="bg-emerald-950/20 border border-emerald-800/40 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">🟢 Low IV (IVR 0-25)</p>
            <p className="text-2xl font-black text-emerald-400">{lowIV}</p>
            <p className="text-xs text-gray-600">premium buying candidates</p>
          </div>
          <div className="bg-amber-950/20 border border-amber-800/40 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Avg Market IVR</p>
            <p className="text-2xl font-black text-amber-400">{avgIVR}</p>
            <p className="text-xs text-gray-600">{avgIVR >= 60 ? 'Market IV elevated' : avgIVR <= 30 ? 'Market IV cheap' : 'Market IV normal'}</p>
          </div>
        </div>

        {/* IVR Zone guide */}
        <div className="bg-gray-900/20 border border-gray-800/40 rounded-xl p-4 mb-6">
          <p className="text-xs font-bold text-gray-400 mb-2">IVR Guide</p>
          <div className="flex items-center gap-6 text-xs">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-400 inline-block"/>0–25: <span className="text-emerald-400">Low IV — buy premium</span></span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-blue-400 inline-block"/>25–50: <span className="text-blue-400">Normal — neutral</span></span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-orange-400 inline-block"/>50–75: <span className="text-orange-400">Elevated — consider selling</span></span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-500 inline-block"/>75–100: <span className="text-red-400">High IV — sell premium</span></span>
          </div>
          <div className="mt-2 relative h-2 bg-gray-800 rounded-full">
            <div className="absolute h-full w-1/4 bg-emerald-400/30 rounded-l-full"/>
            <div className="absolute h-full w-1/4 bg-blue-400/30 left-1/4"/>
            <div className="absolute h-full w-1/4 bg-orange-400/30 left-2/4"/>
            <div className="absolute h-full w-1/4 bg-red-500/30 left-3/4 rounded-r-full"/>
            {[25,50,75].map(v => (
              <div key={v} className="absolute top-0 h-full w-px bg-gray-600" style={{ left: `${v}%` }}/>
            ))}
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
          {[
            { key: 'all',           label: 'All' },
            { key: 'HIGH_IV',       label: '🔴 High IV' },
            { key: 'ELEVATED_IV',   label: '🟠 Elevated' },
            { key: 'NORMAL_IV',     label: '🔵 Normal' },
            { key: 'LOW_IV',        label: '🟢 Low IV' },
          ].map(f => (
            <button key={f.key} onClick={() => setSignalFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${signalFilter===f.key ? 'bg-white text-gray-900 border-white' : 'bg-gray-900/40 text-gray-400 border-gray-800 hover:text-white'}`}>
              {f.label}
            </button>
          ))}
          <div className="w-px h-5 bg-gray-800 mx-1"/>
          <span className="text-xs text-gray-500">Sort:</span>
          {[
            { key: 'ivr', label: 'IVR' },
            { key: 'iv',  label: 'IV%' },
            { key: 'em',  label: 'Exp Move' },
            { key: 'dte', label: 'DTE' },
          ].map(s => (
            <button key={s.key} onClick={() => setSortBy(s.key as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${sortBy===s.key ? 'bg-amber-950 text-amber-400 border-amber-800' : 'bg-gray-900/40 text-gray-400 border-gray-800 hover:text-white'}`}>
              {s.label}
            </button>
          ))}
        </div>

        <p className="text-xs text-gray-600 mb-4">{filtered.length} symbols · Informational only · Not investment advice</p>

        {loading ? (
          <div className="space-y-2">{[1,2,3,4,5,6].map(i=>(
            <div key={i} className="h-20 bg-gray-900/30 border border-gray-800 rounded-xl animate-pulse"/>
          ))}</div>
        ) : filtered.length > 0 ? (
          <div className="rounded-2xl border border-gray-800 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-900/60 border-b border-gray-800">
                  {['Symbol','ATM Strike','IV%','IVR','IVP','Expected Move (1SD)','2SD Range','Straddle','DTE','Strategy Signal'].map((h,i)=>(
                    <th key={h} className={`text-xs font-semibold text-gray-500 px-4 py-3.5 ${i<=1?'text-left':'text-right'} ${i===0?'pl-5':''} ${i===9?'pr-5 text-left':''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => {
                  const m = IV_SIGNAL_META[r.iv_signal] || IV_SIGNAL_META.NORMAL_IV
                  return (
                    <tr key={r.symbol} className={`border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors ${i%2===0?'':'bg-gray-900/20'}`}>

                      {/* Symbol */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-white">{r.symbol}</span>
                          {r.is_index && <span className="text-xs px-1.5 py-0.5 bg-cyan-950 text-cyan-400 border border-cyan-800/50 rounded-md">IDX</span>}
                        </div>
                        <p className="text-xs text-gray-600 mt-0.5">₹{r.cmp.toLocaleString('en-IN')}</p>
                      </td>

                      {/* ATM Strike */}
                      <td className="px-4 py-4">
                        <p className="text-sm font-bold text-amber-400">{r.atm_strike.toLocaleString()}</p>
                        <p className="text-xs text-gray-600">CE: ₹{r.atm_ce_ltp} · PE: ₹{r.atm_pe_ltp}</p>
                      </td>

                      {/* IV% */}
                      <td className="px-4 py-4 text-right">
                        <p className={`text-sm font-black ${m.color}`}>{r.current_iv}%</p>
                        <p className="text-xs text-gray-600">{r.iv_52w_low}–{r.iv_52w_high}</p>
                      </td>

                      {/* IVR */}
                      <td className="px-4 py-4 text-right">
                        <p className={`text-sm font-black ${m.color}`}>
                          {r.ivr !== null ? `${r.ivr}` : '—'}
                        </p>
                        <div className="w-20 ml-auto mt-1">
                          <IVRBar ivr={r.ivr}/>
                        </div>
                      </td>

                      {/* IVP */}
                      <td className="px-4 py-4 text-right">
                        <p className="text-sm font-semibold text-gray-300">
                          {r.ivp !== null ? `${r.ivp}%ile` : '—'}
                        </p>
                        <p className="text-xs text-gray-600">{r.iv_history_days}d history</p>
                      </td>

                      {/* Expected Move 1SD */}
                      <td className="px-4 py-4 text-right">
                        <p className="text-sm font-black text-white">±{r.expected_move_pts}</p>
                        <p className="text-xs text-gray-500">±{r.expected_move_pct}%</p>
                        <p className="text-xs text-emerald-400">{r.lower_range.toLocaleString()} – {r.upper_range.toLocaleString()}</p>
                        <ExpectedMoveBar
                          cmp={r.cmp} lower={r.lower_range} upper={r.upper_range}
                          lower2sd={r.lower_range_2sd} upper2sd={r.upper_range_2sd}/>
                      </td>

                      {/* 2SD Range */}
                      <td className="px-4 py-4 text-right">
                        <p className="text-xs text-gray-500">±{r.expected_move_pct * 2}%</p>
                        <p className="text-xs text-gray-600">{r.lower_range_2sd.toLocaleString()} – {r.upper_range_2sd.toLocaleString()}</p>
                      </td>

                      {/* Straddle price */}
                      <td className="px-4 py-4 text-right">
                        <p className="text-sm font-bold text-amber-400">₹{r.atm_straddle}</p>
                      </td>

                      {/* DTE */}
                      <td className="px-4 py-4 text-right">
                        <p className={`text-sm font-bold ${r.dte <= 3 ? 'text-red-400' : r.dte <= 7 ? 'text-orange-400' : 'text-gray-300'}`}>
                          {r.dte}d
                        </p>
                        <p className="text-xs text-gray-600">{r.expiry.slice(5)}</p>
                      </td>

                      {/* Strategy */}
                      <td className="px-5 py-4">
                        <div className={`inline-flex flex-col gap-1 px-2 py-1.5 rounded-lg border text-xs ${m.bg} ${m.border}`}>
                          <span className={`font-bold ${m.color}`}>{m.label}</span>
                          {r.strategies.slice(0,2).map((s,j) => (
                            <span key={j} className="text-gray-400">{s}</span>
                          ))}
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
            <div className="text-5xl mb-4">📊</div>
            <p className="text-gray-500">No data available — market may be closed</p>
          </div>
        )}

        {/* Disclaimer */}
        <div className="mt-8 bg-gray-900/20 border border-gray-800/40 rounded-xl p-4">
          <p className="text-xs text-gray-600 leading-relaxed">
            <span className="text-gray-400 font-semibold">Disclaimer:</span> IV calculations use Black-Scholes model with ATM option prices.
            IVR is based on available historical data ({data?.results[0]?.iv_history_days || 0} days max).
            Expected Move represents a statistical range, not a price target or guarantee.
            Strategy suggestions are informational only — not SEBI-registered advice. Trade at your own risk.
          </p>
        </div>
      </div>
    </div>
  )
}
