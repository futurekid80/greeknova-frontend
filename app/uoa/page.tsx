'use client'
import Navbar from '@/components/Navbar'
import { useEffect, useState, useCallback, useRef } from 'react'
import { RefreshCw, Clock, Zap } from 'lucide-react'

const API = 'https://greeknova-backend-production.up.railway.app'

interface UOASignal {
  symbol: string; tradingsymbol: string; strike: number
  option_type: string; cmp: number; ltp: number
  volume: number; oi: number; vol_oi_ratio: number
  vol_ratio: number; oi_change_pct: number; otm_pct: number
  is_otm: boolean; signal_type: string; signal_desc: string
  score: number; is_index: boolean
}

const SIGNAL_META: Record<string, { color: string; bg: string; border: string; icon: string }> = {
  BUYER_DOMINATED:  { color: 'text-blue-400',    bg: 'bg-blue-950/40',    border: 'border-blue-800/50',    icon: '🐋' },
  FRESH_CONVICTION: { color: 'text-orange-400',  bg: 'bg-orange-950/40',  border: 'border-orange-800/50',  icon: '🎯' },
  FAR_OTM_ACTIVITY: { color: 'text-violet-400',  bg: 'bg-violet-950/40',  border: 'border-violet-800/50',  icon: '🚀' },
  VOLUME_SURGE:     { color: 'text-emerald-400', bg: 'bg-emerald-950/40', border: 'border-emerald-800/50', icon: '⚡' },
  UNUSUAL_ACTIVITY: { color: 'text-amber-400',   bg: 'bg-amber-950/40',   border: 'border-amber-800/50',   icon: '👁️' },
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
  const [minScore, setMinScore] = useState(2)
  const [date, setDate] = useState<string>('')
  const [availDates, setAvailDates] = useState<string[]>([])
  const [lastUpdate, setLastUpdate] = useState('')
  const [captureTime, setCaptureTime] = useState('')
  const [autoEnabled, setAutoEnabled] = useState(false)
  const [countdown, setCountdown] = useState(300)
  const intervalRef = useRef<NodeJS.Timeout|null>(null)
  const countdownRef = useRef<NodeJS.Timeout|null>(null)
  const dateRef = useRef('')

  // ── Fetch available dates ───────────────────────────────────────────────────
  useEffect(() => {
    async function loadDates() {
      try {
        const res = await fetch(`${API}/oi-dates/NIFTY`)
        const json = await res.json()
        const dates: string[] = (json.dates || []).slice(-7).reverse()
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

  const filtered = (data?.signals || [])
    .filter(s => filter === 'all' || (filter === 'index' ? s.is_index : !s.is_index))
    .filter(s => typeFilter === 'all' || s.option_type === typeFilter)
    .filter(s => signalFilter === 'all' || s.signal_type === signalFilter)
    .filter(s => s.score >= minScore)

  const twoWaySymbols = new Set<string>()
  const allSignals = data?.signals || []
  const symbolSides: Record<string, Set<string>> = {}
  allSignals.filter(s => s.signal_type === 'BUYER_DOMINATED').forEach(s => {
    if (!symbolSides[s.symbol]) symbolSides[s.symbol] = new Set()
    symbolSides[s.symbol].add(s.option_type)
  })
  Object.entries(symbolSides).forEach(([sym, sides]) => {
    if (sides.has('CE') && sides.has('PE')) twoWaySymbols.add(sym)
  })

  const mins = Math.floor(countdown/60)
  const secs = countdown % 60
  const buyerDom = data?.signals.filter(s => s.signal_type === 'BUYER_DOMINATED').length || 0
  const freshConv = data?.signals.filter(s => s.signal_type === 'FRESH_CONVICTION').length || 0
  const farOtm = data?.signals.filter(s => s.signal_type === 'FAR_OTM_ACTIVITY').length || 0
  const highConv = data?.signals.filter(s => s.score >= 4).length || 0

  return (
    <div className="min-h-screen bg-[#07070e] text-white">
      <Navbar active="/uoa" />

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black tracking-tight mb-1 flex items-center gap-3">
              <span>🐋</span> Unusual Options Activity
            </h1>
            <p className="text-gray-500 text-sm">Smart money detection · High vol/OI ratio = buyers · Far OTM activity = directional bets · Score 1-5 conviction</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Date picker */}
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

        {twoWaySymbols.size > 0 && (
          <div className="bg-amber-950/20 border border-amber-800/40 rounded-xl p-4 mb-6 flex items-start gap-3">
            <span className="text-2xl mt-0.5">⚡</span>
            <div>
              <p className="text-sm font-bold text-amber-400 mb-1">Two-Way Activity Detected — {[...twoWaySymbols].join(', ')}</p>
              <p className="text-xs text-gray-400">Both CE and PE showing Buyer Dominated. Big players buying both sides — expect a large move. Good for straddles/strangles. Avoid naked selling.</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Total UOA Signals</p>
            <p className="text-2xl font-black text-white">{data?.total || 0}</p>
            <p className="text-xs text-gray-600">unusual activity detected</p>
          </div>
          <div className="bg-orange-950/20 border border-orange-800/40 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">🎯 High Conviction (4-5)</p>
            <p className="text-2xl font-black text-orange-400">{highConv}</p>
            <p className="text-xs text-gray-600">strongest signals</p>
          </div>
          <div className="bg-violet-950/20 border border-violet-800/40 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">🚀 Far OTM Activity</p>
            <p className="text-2xl font-black text-violet-400">{farOtm}</p>
            <p className="text-xs text-gray-600">speculative/hedging bets</p>
          </div>
          <div className="bg-blue-950/20 border border-blue-800/40 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">🐋 Buyer Dominated</p>
            <p className="text-2xl font-black text-blue-400">{buyerDom}</p>
            <p className="text-xs text-gray-600">vol {'>'} OI — buyers active</p>
          </div>
        </div>

        <div className="bg-gray-900/20 border border-gray-800/50 rounded-xl p-4 mb-6">
          <div className="grid grid-cols-4 gap-4 text-xs">
            <div><span className="text-blue-400 font-bold">🐋 Buyer Dominated</span><p className="text-gray-500 mt-1">Volume {'>'} OI — more contracts changing hands than open. Someone buying against existing writers.</p></div>
            <div><span className="text-orange-400 font-bold">🎯 Fresh Conviction</span><p className="text-gray-500 mt-1">Both volume AND OI rising together. Strong directional bet — new positions being built.</p></div>
            <div><span className="text-violet-400 font-bold">🚀 Far OTM Activity</span><p className="text-gray-500 mt-1">Heavy volume on strikes 3%+ away. Either hedging a large position or speculative directional bet.</p></div>
            <div><span className="text-emerald-400 font-bold">⚡ Volume Surge</span><p className="text-gray-500 mt-1">4x+ normal volume. Unusual interest — something may be happening. Watch closely.</p></div>
          </div>
        </div>

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
              {t==='all'?'All':t}
            </button>
          ))}
          <div className="w-px h-5 bg-gray-800 mx-1"/>
          {Object.entries(SIGNAL_META).map(([key, m]) => (
            <button key={key} onClick={() => setSignalFilter(signalFilter===key?'all':key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${signalFilter===key ? `${m.bg} ${m.color} ${m.border}` : 'bg-gray-900/40 text-gray-400 border-gray-800 hover:text-white'}`}>
              {m.icon} {key.replace(/_/g,' ')}
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
                  {['Symbol','Strike','Type','Signal','Direction Read','Conviction','Vol/OI','Volume','OI Δ%','OTM%','LTP'].map((h,i)=>(
                    <th key={h} className={`text-xs font-semibold text-gray-500 px-4 py-3.5 ${i<=4?'text-left':'text-right'} ${i===0?'pl-5':''} ${i===10?'pr-5':''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((sig, i) => {
                  const m = SIGNAL_META[sig.signal_type] || SIGNAL_META.UNUSUAL_ACTIVITY
                  const isCE = sig.option_type === 'CE'
                  const isTwoWay = twoWaySymbols.has(sig.symbol) && sig.signal_type === 'BUYER_DOMINATED'
                  let dirRead = ''
                  let dirColor = 'text-gray-500'
                  if (isTwoWay) { dirRead = '⚡ Two-way — volatility play'; dirColor = 'text-amber-400' }
                  else if (sig.signal_type === 'BUYER_DOMINATED') { dirRead = isCE ? '↑ Bullish bet' : '↓ Bearish bet'; dirColor = isCE ? 'text-emerald-400' : 'text-red-400' }
                  else if (sig.signal_type === 'FRESH_CONVICTION') { dirRead = isCE ? '↑ Strong bullish' : '↓ Strong bearish'; dirColor = isCE ? 'text-emerald-400' : 'text-red-400' }
                  else if (sig.signal_type === 'FAR_OTM_ACTIVITY') { dirRead = isCE ? '↑ Speculative rally bet' : '↓ Hedge / crash bet'; dirColor = 'text-violet-400' }
                  else { dirRead = '— Watch closely'; dirColor = 'text-gray-500' }

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
                          <span>{m.icon}</span><span>{sig.signal_type.replace(/_/g,' ')}</span>
                        </div>
                        <p className="text-xs text-gray-600 mt-0.5 max-w-[180px]">{sig.signal_desc}</p>
                      </td>
                      <td className="px-4 py-3.5"><span className={`text-xs font-bold ${dirColor}`}>{dirRead}</span></td>
                      <td className="px-4 py-3.5 text-right"><ScoreMeter score={sig.score}/></td>
                      <td className={`px-4 py-3.5 text-right text-sm font-black ${sig.vol_oi_ratio > 5 ? 'text-orange-400' : sig.vol_oi_ratio > 2 ? 'text-amber-400' : 'text-gray-400'}`}>{sig.vol_oi_ratio}x</td>
                      <td className="px-4 py-3.5 text-right text-sm text-gray-300">{(sig.volume/100000).toFixed(1)}L</td>
                      <td className={`px-4 py-3.5 text-right text-sm font-semibold ${sig.oi_change_pct > 0 ? 'text-red-400' : sig.oi_change_pct < 0 ? 'text-emerald-400' : 'text-gray-500'}`}>
                        {sig.oi_change_pct > 0 ? '+' : ''}{sig.oi_change_pct}%
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
