'use client'
import Navbar from '@/components/Navbar'
import { useEffect, useState, useCallback, useRef } from 'react'
import { RefreshCw, Clock } from 'lucide-react'

const API = 'https://greeknova-backend-production.up.railway.app'

interface UOASignal {
  symbol: string; tradingsymbol: string; strike: number
  option_type: string; cmp: number; ltp: number; ltp_change_pct: number
  volume: number; oi: number; vol_oi_ratio: number
  vol_ratio: number; oi_change_pct: number; otm_pct: number
  is_otm: boolean; signal_type: string; signal_desc: string
  bias: string; score: number; is_index: boolean
}

// ── All signal types including new ones from fixed backend ────────────────────
const SIGNAL_META: Record<string, { color: string; bg: string; border: string; icon: string; label: string }> = {
  LONG_BUILDUP:     { color: 'text-emerald-400', bg: 'bg-emerald-950/40', border: 'border-emerald-800/50', icon: '🐂', label: 'Long Buildup' },
  SHORT_BUILDUP:    { color: 'text-red-400',     bg: 'bg-red-950/40',     border: 'border-red-800/50',     icon: '🐻', label: 'Short Buildup' },
  CALL_WRITING:     { color: 'text-red-400',     bg: 'bg-red-950/40',     border: 'border-red-800/50',     icon: '✍️', label: 'Call Writing' },
  PUT_WRITING:      { color: 'text-emerald-400', bg: 'bg-emerald-950/40', border: 'border-emerald-800/50', icon: '✍️', label: 'Put Writing' },
  SHORT_COVERING:   { color: 'text-cyan-400',    bg: 'bg-cyan-950/40',    border: 'border-cyan-800/50',    icon: '🔄', label: 'Short Covering' },
  LONG_UNWINDING:   { color: 'text-orange-400',  bg: 'bg-orange-950/40',  border: 'border-orange-800/50',  icon: '⚠️', label: 'Long Unwinding' },
  BUYER_DOMINATED:  { color: 'text-blue-400',    bg: 'bg-blue-950/40',    border: 'border-blue-800/50',    icon: '🐋', label: 'Buyer Dominated' },
  SELLER_DOMINATED: { color: 'text-pink-400',    bg: 'bg-pink-950/40',    border: 'border-pink-800/50',    icon: '🔻', label: 'Seller Dominated' },
  FAR_OTM_ACTIVITY: { color: 'text-violet-400',  bg: 'bg-violet-950/40',  border: 'border-violet-800/50',  icon: '🚀', label: 'Far OTM Activity' },
  VOLUME_SURGE:     { color: 'text-amber-400',   bg: 'bg-amber-950/40',   border: 'border-amber-800/50',   icon: '⚡', label: 'Volume Surge' },
}

// ── Direction read per signal type ────────────────────────────────────────────
function getDirectionRead(sig: UOASignal, isTwoWay: boolean): { text: string; color: string } {
  if (isTwoWay) return { text: '⚡ Two-way — volatility play', color: 'text-amber-400' }
  const isCE = sig.option_type === 'CE'
  switch (sig.signal_type) {
    case 'LONG_BUILDUP':     return { text: isCE ? '↑ Bullish — fresh call buyers' : '↓ Bearish — fresh put buyers', color: isCE ? 'text-emerald-400' : 'text-red-400' }
    case 'SHORT_BUILDUP':    return { text: isCE ? '↓ Bearish — shorts building' : '↑ Bullish — put shorts building', color: isCE ? 'text-red-400' : 'text-emerald-400' }
    case 'CALL_WRITING':     return { text: '↓ Bearish — call writers shorting', color: 'text-red-400' }
    case 'PUT_WRITING':      return { text: '↑ Bullish — put writers shorting', color: 'text-emerald-400' }
    case 'SHORT_COVERING':   return { text: isCE ? '↑ Bullish — CE shorts covering' : '↓ Bearish — PE shorts covering', color: isCE ? 'text-emerald-400' : 'text-red-400' }
    case 'LONG_UNWINDING':   return { text: isCE ? '↓ Bearish — CE longs exiting' : '↑ Bullish — PE longs exiting', color: isCE ? 'text-red-400' : 'text-emerald-400' }
    case 'BUYER_DOMINATED':  return { text: isCE ? '↑ Bullish bet' : '↓ Bearish bet', color: isCE ? 'text-emerald-400' : 'text-red-400' }
    case 'SELLER_DOMINATED': return { text: isCE ? '↓ Selling pressure on CE' : '↑ Selling pressure on PE', color: isCE ? 'text-red-400' : 'text-emerald-400' }
    case 'FAR_OTM_ACTIVITY': return { text: isCE ? '↑ Speculative rally bet' : '↓ Hedge / crash bet', color: 'text-violet-400' }
    case 'VOLUME_SURGE':     return { text: sig.bias === 'BULLISH' ? '↑ Bullish volume surge' : '↓ Bearish volume surge', color: sig.bias === 'BULLISH' ? 'text-emerald-400' : 'text-red-400' }
    default:                 return { text: '— Watch closely', color: 'text-gray-500' }
  }
}

function toIST(ts: string) {
  try {
    const clean = ts.split('+')[0].split('Z')[0]
    const dt = new Date(clean + 'Z')
    const ist = dt.getTime() + (5.5 * 60 * 60 * 1000)
    const d = new Date(ist)
    return `${d.getUTCHours().toString().padStart(2,'0')}:${d.getUTCMinutes().toString().padStart(2,'0')}`
  } catch { return '—' }
}

function ScoreMeter({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-1">
      {[1,2,3,4,5].map(i => (
        <div key={i} className={`h-2 w-4 rounded-sm transition-all ${
          i <= score
            ? score >= 4 ? 'bg-orange-400' : score >= 3 ? 'bg-amber-400' : 'bg-blue-400'
            : 'bg-gray-800'
        }`}/>
      ))}
      <span className="text-xs text-gray-500 ml-1">{score}/5</span>
    </div>
  )
}

export default function UOA() {
  const [data, setData] = useState<{ signals: UOASignal[]; total: number; timestamp: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all'|'index'|'stocks'>('all')
  const [typeFilter, setTypeFilter] = useState<'all'|'CE'|'PE'>('all')
  const [signalFilter, setSignalFilter] = useState<string>('all')
  const [biasFilter, setBiasFilter] = useState<'all'|'BULLISH'|'BEARISH'>('all')
  const [minScore, setMinScore] = useState(3)
  const [date, setDate] = useState<string>('')
  const [availDates, setAvailDates] = useState<string[]>([])
  const [lastUpdate, setLastUpdate] = useState('')
  const [captureTime, setCaptureTime] = useState('')
  const [autoEnabled, setAutoEnabled] = useState(false)
  const [countdown, setCountdown] = useState(300)
  const intervalRef = useRef<NodeJS.Timeout|null>(null)
  const countdownRef = useRef<NodeJS.Timeout|null>(null)
  const dateRef = useRef('')

  useEffect(() => {
    async function loadDates() {
      try {
        const res = await fetch(`${API}/oi-dates/NIFTY`)
        const json = await res.json()
        const dates: string[] = [...(json.dates || [])].reverse()
        setAvailDates(dates)
        if (dates.length > 0 && !dateRef.current) {
          setDate(dates[0])
          dateRef.current = dates[0]
        }
      } catch (e) { console.error('Failed to load dates', e) }
    }
    loadDates()
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const url = dateRef.current ? `${API}/uoa?date=${dateRef.current}` : `${API}/uoa`
      const res = await fetch(url)
      const json = await res.json()
      setData(json)
      if (json.timestamp) {
        setLastUpdate(new Date(json.timestamp).toLocaleString('en-IN', { dateStyle:'medium', timeStyle:'short', timeZone:'UTC' }))
        setCaptureTime(toIST(json.timestamp))
      }
    } catch(e) { console.error(e) }
    setLoading(false)
  }, [])

  function handleDateChange(d: string) {
    setDate(d)
    dateRef.current = d
    fetchData()
  }

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

  useEffect(() => {
    fetchData(); startAuto()
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [])

  const allSignals = data?.signals || []

  // Two-way detection — same symbol with both CE and PE showing bullish/bearish signals
  const symbolSides: Record<string, Set<string>> = {}
  allSignals.forEach(s => {
    if (!symbolSides[s.symbol]) symbolSides[s.symbol] = new Set()
    symbolSides[s.symbol].add(s.option_type)
  })
  const twoWaySymbols = new Set(
    Object.entries(symbolSides)
      .filter(([_, sides]) => sides.has('CE') && sides.has('PE'))
      .map(([sym]) => sym)
  )

  const filtered = allSignals
    .filter(s => filter === 'all' || (filter === 'index' ? s.is_index : !s.is_index))
    .filter(s => typeFilter === 'all' || s.option_type === typeFilter)
    .filter(s => signalFilter === 'all' || s.signal_type === signalFilter)
    .filter(s => biasFilter === 'all' || s.bias === biasFilter)
    .filter(s => s.score >= minScore)

  // Summary counts
  const bullishCount = allSignals.filter(s => s.bias === 'BULLISH').length
  const bearishCount = allSignals.filter(s => s.bias === 'BEARISH').length
  const highConvCount = allSignals.filter(s => s.score >= 4).length
  const writingCount = allSignals.filter(s => ['CALL_WRITING','PUT_WRITING'].includes(s.signal_type)).length

  const mins = Math.floor(countdown/60)
  const secs = countdown % 60

  return (
    <div className="min-h-screen bg-[#07070e] text-white">
      <Navbar active="/uoa" />

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black tracking-tight mb-1 flex items-center gap-3">
              <span>🐋</span> Unusual Options Activity
            </h1>
            <p className="text-gray-500 text-sm">Smart money detection · OI + price direction = true signal · Score 1-5 conviction</p>
          </div>
          <div className="flex items-center gap-3">
            {availDates.length > 0 && (
              <div className="flex items-center gap-2 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2">
                <span className="text-xs text-gray-500">Date:</span>
                <select value={date} onChange={e => handleDateChange(e.target.value)}
                  className="bg-transparent text-white text-xs focus:outline-none cursor-pointer">
                  {availDates.map(d => (
                    <option key={d} value={d} className="bg-gray-900">
                      {new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', weekday: 'short' })}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {captureTime && (
              <div className="flex items-center gap-1.5 text-xs bg-emerald-950/30 border border-emerald-800/40 text-emerald-400 rounded-lg px-3 py-2">
                <Clock size={11}/>Snapshot: {captureTime} IST
              </div>
            )}
            {lastUpdate && <div className="flex items-center gap-1.5 text-xs text-gray-600 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2"><Clock size={11}/>{lastUpdate}</div>}
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

        {/* Two-way alert */}
        {twoWaySymbols.size > 0 && (
          <div className="bg-amber-950/20 border border-amber-800/40 rounded-xl p-4 mb-6 flex items-start gap-3">
            <span className="text-2xl mt-0.5">⚡</span>
            <div>
              <p className="text-sm font-bold text-amber-400 mb-1">Two-Way Activity — {[...twoWaySymbols].join(', ')}</p>
              <p className="text-xs text-gray-400">Both CE and PE showing significant activity. Big players active on both sides — expect volatility. Good for straddles/strangles.</p>
            </div>
          </div>
        )}

        {/* Summary boxes */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Total UOA Signals</p>
            <p className="text-2xl font-black text-white">{data?.total || 0}</p>
            <p className="text-xs text-gray-600">unusual activity detected</p>
          </div>
          <div className="bg-orange-950/20 border border-orange-800/40 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">🎯 High Conviction (4-5)</p>
            <p className="text-2xl font-black text-orange-400">{highConvCount}</p>
            <p className="text-xs text-gray-600">strongest signals</p>
          </div>
          <div className="bg-emerald-950/20 border border-emerald-800/40 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">↑ Bullish Signals</p>
            <p className="text-2xl font-black text-emerald-400">{bullishCount}</p>
            <p className="text-xs text-gray-600">put writing, long buildup etc</p>
          </div>
          <div className="bg-red-950/20 border border-red-800/40 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">↓ Bearish Signals</p>
            <p className="text-2xl font-black text-red-400">{bearishCount}</p>
            <p className="text-xs text-gray-600">call writing, short buildup etc</p>
          </div>
        </div>

        {/* Signal legend */}
        <div className="bg-gray-900/20 border border-gray-800/50 rounded-xl p-4 mb-6">
          <p className="text-xs font-bold text-gray-400 mb-3">How to read UOA signals</p>
          <div className="grid grid-cols-5 gap-3 text-xs text-gray-500">
            <div><span className="text-emerald-400 font-bold">🐂 Long Buildup</span><p className="mt-1">OI ↑ + option price ↑ — fresh buyers entering. Directional conviction.</p></div>
            <div><span className="text-red-400 font-bold">🐻 Short Buildup</span><p className="mt-1">OI ↑ + option price ↑ (puts) — fresh put buyers. Bearish conviction.</p></div>
            <div><span className="text-red-400 font-bold">✍️ Call Writing</span><p className="mt-1">OI ↑ + CE price ↓ — writers selling calls. Bearish on stock.</p></div>
            <div><span className="text-emerald-400 font-bold">✍️ Put Writing</span><p className="mt-1">OI ↑ + PE price ↓ — writers selling puts. Bullish on stock.</p></div>
            <div><span className="text-blue-400 font-bold">🐋 Buyer Dominated</span><p className="mt-1">High vol + price rising + flat OI — buyers absorbing sellers.</p></div>
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
          {(['all','CE','PE'] as const).map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${typeFilter===t ? 'bg-white text-gray-900 border-white' : 'bg-gray-900/40 text-gray-400 border-gray-800 hover:text-white'}`}>
              {t==='all'?'All Types':t}
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
              {b==='all'?'All Bias': b==='BULLISH'?'↑ Bullish':'↓ Bearish'}
            </button>
          ))}
          <div className="w-px h-5 bg-gray-800 mx-1"/>
          {/* Signal type filter buttons */}
          {Object.entries(SIGNAL_META).map(([key, m]) => (
            <button key={key} onClick={() => setSignalFilter(signalFilter===key?'all':key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${signalFilter===key ? `${m.bg} ${m.color} ${m.border}` : 'bg-gray-900/40 text-gray-400 border-gray-800 hover:text-white'}`}>
              {m.icon} {m.label}
            </button>
          ))}
          <div className="w-px h-5 bg-gray-800 mx-1"/>
          <div className="flex items-center gap-2 bg-gray-900/30 border border-gray-800 rounded-lg px-3 py-1.5">
            <span className="text-xs text-gray-500">Min score:</span>
            <input type="range" min="1" max="5" value={minScore} onChange={e => setMinScore(Number(e.target.value))} className="w-20 accent-amber-400"/>
            <span className="text-xs font-black text-amber-400">{minScore}+</span>
          </div>
        </div>

        <p className="text-xs text-gray-600 mb-4">{filtered.length} signals · Data as of {captureTime || '—'} IST</p>

        {loading ? (
          <div className="space-y-2">{[1,2,3,4,5].map(i=><div key={i} className="h-14 bg-gray-900/30 border border-gray-800 rounded-xl animate-pulse"/>)}</div>
        ) : filtered.length > 0 ? (
          <div className="rounded-2xl border border-gray-800 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-900/60 border-b border-gray-800">
                  {['Symbol','Strike','Type','Signal','Direction Read','Conviction','Vol/OI','Volume','OI Δ%','LTP Δ%','OTM%','LTP'].map((h,i)=>(
                    <th key={h} className={`text-xs font-semibold text-gray-500 px-4 py-3.5 ${i<=4?'text-left':'text-right'} ${i===0?'pl-5':''} ${i===11?'pr-5':''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((sig, i) => {
                  const m = SIGNAL_META[sig.signal_type] || { color:'text-gray-400', bg:'bg-gray-900/30', border:'border-gray-800', icon:'👁️', label: sig.signal_type }
                  const isCE = sig.option_type === 'CE'
                  const isTwoWay = twoWaySymbols.has(sig.symbol)
                  const dir = getDirectionRead(sig, isTwoWay)

                  return (
                    <tr key={`${sig.tradingsymbol}-${i}`}
                      className={`border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors ${isTwoWay ? 'bg-amber-950/10' : i%2===0?'':'bg-gray-900/20'}`}>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <a href={`/stock/${sig.symbol}`} className="text-sm font-black text-white hover:text-emerald-400 transition-colors">{sig.symbol}</a>
                          {sig.is_index && <span className="text-xs px-1.5 py-0.5 bg-cyan-950 text-cyan-400 border border-cyan-800/50 rounded-md">IDX</span>}
                          {isTwoWay && <span className="text-xs px-1.5 py-0.5 bg-amber-950 text-amber-400 border border-amber-800/50 rounded-md">2-WAY</span>}
                        </div>
                        <p className="text-xs text-gray-600 mt-0.5">CMP: ₹{sig.cmp.toLocaleString()}</p>
                      </td>
                      <td className="px-4 py-3.5 text-sm font-bold text-gray-300">{sig.strike.toLocaleString()}</td>
                      <td className="px-4 py-3.5">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${isCE?'bg-red-950/50 text-red-400 border border-red-800/50':'bg-emerald-950/50 text-emerald-400 border border-emerald-800/50'}`}>{sig.option_type}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className={`inline-flex items-center gap-1.5 text-xs font-bold px-2 py-1 rounded-lg border ${m.color} ${m.bg} ${m.border}`}>
                          <span>{m.icon}</span><span>{m.label}</span>
                        </div>
                        <p className="text-xs text-gray-600 mt-0.5 max-w-[200px]">{sig.signal_desc}</p>
                      </td>
                      <td className="px-4 py-3.5"><span className={`text-xs font-bold ${dir.color}`}>{dir.text}</span></td>
                      <td className="px-4 py-3.5 text-right"><ScoreMeter score={sig.score}/></td>
                      <td className={`px-4 py-3.5 text-right text-sm font-black ${sig.vol_oi_ratio > 5 ? 'text-orange-400' : sig.vol_oi_ratio > 2 ? 'text-amber-400' : 'text-gray-400'}`}>{sig.vol_oi_ratio}x</td>
                      <td className="px-4 py-3.5 text-right text-sm text-gray-300">{(sig.volume/100000).toFixed(1)}L</td>
                      <td className={`px-4 py-3.5 text-right text-sm font-semibold ${sig.oi_change_pct > 0 ? 'text-red-400' : sig.oi_change_pct < 0 ? 'text-emerald-400' : 'text-gray-500'}`}>
                        {sig.oi_change_pct > 0 ? '+' : ''}{sig.oi_change_pct}%
                      </td>
                      <td className={`px-4 py-3.5 text-right text-sm font-semibold ${sig.ltp_change_pct > 0 ? 'text-emerald-400' : sig.ltp_change_pct < 0 ? 'text-red-400' : 'text-gray-500'}`}>
                        {sig.ltp_change_pct > 0 ? '+' : ''}{sig.ltp_change_pct}%
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        {sig.is_otm ? <span className="text-xs font-bold text-violet-400">{sig.otm_pct}% OTM</span> : <span className="text-xs text-gray-600">ITM/ATM</span>}
                      </td>
                      <td className="px-5 py-3.5 text-right text-sm font-bold text-amber-400">₹{sig.ltp}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center border border-gray-800/50 rounded-2xl">
            <div className="text-5xl mb-4">🐋</div>
            <h3 className="text-lg font-bold text-gray-400 mb-2">No unusual activity detected</h3>
            <p className="text-sm text-gray-600">Lower the minimum score or select a different date</p>
          </div>
        )}
      </div>
    </div>
  )
}
