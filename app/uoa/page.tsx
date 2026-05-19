'use client'
import Navbar from '@/components/Navbar'
import { useEffect, useState, useCallback, useRef } from 'react'
import { RefreshCw, Clock, AlertTriangle, Search, X, MoonStar } from 'lucide-react'

const API = 'https://greeknova-backend-production.up.railway.app'

interface UOASignal {
  symbol: string; tradingsymbol: string; strike: number
  option_type: string; cmp: number; ltp: number; open_ltp: number
  ltp_chg_from_open: number; volume: number; oi: number
  oi_chg_30min: number; vol_oi_ratio: number; vol_ratio: number
  vol_chg_30min: number; otm_pct: number; is_otm: boolean
  signal_type: string; signal_desc: string; bias: string
  score: number; time_tag: string; is_index: boolean
  day_high: number | null; day_high_pct: number | null; at_day_high: boolean
}

interface UOAData {
  signals: UOASignal[]
  total: number
  timestamp: string
  open_timestamp: string
  snapshot_count: number
  mins_to_close: number
  is_post_market: boolean
  market_close_time: string
}

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

function getObservation(sig: UOASignal): { text: string; color: string } {
  const isCE = sig.option_type === 'CE'
  switch (sig.signal_type) {
    case 'LONG_BUILDUP':     return { text: isCE ? 'CE OI + price both rising from open' : 'PE OI + price both rising from open', color: 'text-emerald-400' }
    case 'SHORT_BUILDUP':    return { text: isCE ? 'CE OI rising · price falling from open' : 'PE OI + price rising from open', color: 'text-red-400' }
    case 'CALL_WRITING':     return { text: 'CE writers active · OI up · price down from open', color: 'text-red-400' }
    case 'PUT_WRITING':      return { text: 'PE writers active · OI up · price down from open', color: 'text-emerald-400' }
    case 'SHORT_COVERING':   return { text: isCE ? 'CE short positions reducing · price above open' : 'PE short positions reducing · price below open', color: 'text-cyan-400' }
    case 'LONG_UNWINDING':   return { text: isCE ? 'CE long positions exiting · price below open' : 'PE long positions exiting · price above open', color: 'text-orange-400' }
    case 'BUYER_DOMINATED':  return { text: 'High volume · flat OI · price above open · buying observed', color: 'text-blue-400' }
    case 'SELLER_DOMINATED': return { text: 'High volume · flat OI · price below open · selling observed', color: 'text-pink-400' }
    case 'FAR_OTM_ACTIVITY': return { text: `${sig.otm_pct}% OTM · heavy volume · hedging or speculative interest`, color: 'text-violet-400' }
    case 'VOLUME_SURGE':     return { text: `${sig.vol_ratio.toFixed(1)}x avg volume · significant activity vs baseline`, color: 'text-amber-400' }
    default:                 return { text: 'Unusual activity pattern observed', color: 'text-gray-400' }
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
          i <= score ? score >= 4 ? 'bg-orange-400' : score >= 3 ? 'bg-amber-400' : 'bg-blue-400' : 'bg-gray-800'
        }`}/>
      ))}
      <span className="text-xs text-gray-500 ml-1">{score}/5</span>
    </div>
  )
}

function StockAtHighBadge({ atDayHigh, pct }: { atDayHigh: boolean; pct: number | null }) {
  if (atDayHigh) return (
    <span className="text-xs px-1.5 py-0.5 rounded-md bg-orange-950/60 text-orange-400 border border-orange-800/50 font-bold"
      title="The underlying stock price is near its day high — not the option price">
      🏔️ Stock at High
    </span>
  )
  if (pct !== null && pct < 2) return (
    <span className="text-xs px-1.5 py-0.5 rounded-md bg-gray-800 text-gray-500 border border-gray-700"
      title="Stock price is within 2% of its day high">
      {pct.toFixed(1)}% to stock high
    </span>
  )
  return null
}

export default function UOA() {
  const [data, setData] = useState<UOAData | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all'|'index'|'stocks'>('all')
  const [typeFilter, setTypeFilter] = useState<'all'|'CE'|'PE'>('all')
  const [signalFilter, setSignalFilter] = useState<string>('all')
  const [biasFilter, setBiasFilter] = useState<'all'|'BULLISH'|'BEARISH'>('all')
  const [minScore, setMinScore] = useState(3)
  const [stockSearch, setStockSearch] = useState('')
  const [date, setDate] = useState<string>('')
  const [availDates, setAvailDates] = useState<string[]>([])
  const [captureTime, setCaptureTime] = useState('')
  const [openTime, setOpenTime] = useState('')
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
          setDate(dates[0]); dateRef.current = dates[0]
        }
      } catch (e) { console.error(e) }
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
      if (json.timestamp) setCaptureTime(toIST(json.timestamp))
      if (json.open_timestamp) setOpenTime(toIST(json.open_timestamp))
      // Auto-disable refresh if post-market
      if (json.is_post_market) stopAuto()
    } catch(e) { console.error(e) }
    setLoading(false)
  }, [])

  function handleDateChange(d: string) { setDate(d); dateRef.current = d; fetchData() }

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
  const minsToClose = data?.mins_to_close || 0
  const isPostMarket = data?.is_post_market || false

  // Two-way detection
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
  const twoWayList = [...twoWaySymbols]

  const searchTerm = stockSearch.trim().toUpperCase()
  const filtered = allSignals
    .filter(s => !searchTerm || s.symbol.includes(searchTerm))
    .filter(s => filter === 'all' || (filter === 'index' ? s.is_index : !s.is_index))
    .filter(s => typeFilter === 'all' || s.option_type === typeFilter)
    .filter(s => signalFilter === 'all' || s.signal_type === signalFilter)
    .filter(s => biasFilter === 'all' || s.bias === biasFilter)
    .filter(s => s.score >= minScore)

  const isAerialView = searchTerm.length >= 2 && filtered.length > 0
  const aerialSymbol = isAerialView ? filtered[0]?.symbol : null
  const aerialSignals = isAerialView ? filtered.filter(s => s.symbol === aerialSymbol) : []
  const aerialCE = aerialSignals.filter(s => s.option_type === 'CE')
  const aerialPE = aerialSignals.filter(s => s.option_type === 'PE')
  const isAerialTwoWay = aerialCE.length > 0 && aerialPE.length > 0

  const bullishCount  = allSignals.filter(s => s.bias === 'BULLISH').length
  const bearishCount  = allSignals.filter(s => s.bias === 'BEARISH').length
  const highConvCount = allSignals.filter(s => s.score >= 4).length

  const mins = Math.floor(countdown/60)
  const secs = countdown % 60

  return (
    <div className="min-h-screen bg-[#07070e] text-white">
      <Navbar active="/uoa" />

      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="text-3xl font-black tracking-tight mb-1 flex items-center gap-3">
              <span>🐋</span> Unusual Options Activity
            </h1>
            <p className="text-gray-500 text-sm">Observational tool · OI momentum (30-min) + price from open · Informational only</p>
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
            {openTime && captureTime && (
              <div className="flex items-center gap-1.5 text-xs bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-gray-400">
                <Clock size={11}/>Open: {openTime} → {isPostMarket ? 'Close' : 'Now'}: {captureTime} IST
              </div>
            )}
            {/* Hide auto-refresh toggle post-market */}
            {!isPostMarket && (
              <button onClick={() => autoEnabled ? stopAuto() : startAuto()}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${autoEnabled ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60' : 'bg-gray-900/40 text-gray-500 border-gray-800'}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${autoEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`}/>
                {autoEnabled ? `${mins}:${secs.toString().padStart(2,'0')}` : 'Auto OFF'}
              </button>
            )}
            <button onClick={fetchData} disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-sm font-medium text-white rounded-lg border border-gray-700 transition-all disabled:opacity-50">
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''}/>Refresh
            </button>
          </div>
        </div>

        {/* POST-MARKET BANNER */}
        {isPostMarket && (
          <div className="bg-gray-900/60 border border-gray-700 rounded-xl px-4 py-3 mb-6 flex items-center gap-3">
            <MoonStar size={16} className="text-gray-400 flex-shrink-0"/>
            <div>
              <p className="text-sm font-bold text-gray-300">
                📊 EOD Snapshot · Market Closed
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                Showing final state as of {captureTime} IST · Signals reflect patterns observed at market close · Auto-refresh disabled · Not for intraday use
              </p>
            </div>
          </div>
        )}

        {/* SEBI disclaimer */}
        <div className="bg-amber-950/10 border border-amber-800/30 rounded-xl px-4 py-3 mb-6 flex items-center gap-3">
          <AlertTriangle size={14} className="text-amber-500 flex-shrink-0"/>
          <p className="text-xs text-gray-500">
            <span className="text-amber-400 font-semibold">Informational only.</span> UOA shows observed options activity patterns. Not investment advice. Not SEBI-registered research. Always consult a registered advisor before trading.
          </p>
        </div>

        {/* Methodology */}
        <div className="bg-gray-900/20 border border-gray-800/50 rounded-xl px-4 py-3 mb-6">
          <p className="text-xs text-gray-500">
            <span className="text-gray-300 font-semibold">How signals are derived: </span>
            <span className="text-cyan-400">OI momentum</span> = change in open interest over last 30 mins ·
            <span className="text-amber-400"> Price direction</span> = option LTP vs today's open ({openTime || '—'} IST) ·
            <span className="text-orange-400"> 🏔️ Stock at High</span> = underlying stock price near today's high (not the option price)
            {isPostMarket && <span className="text-gray-600"> · 📊 EOD = signals from market close snapshot</span>}
          </p>
        </div>

        {/* Two-way alert */}
        {twoWayList.length > 0 && (
          <div className="bg-amber-950/20 border border-amber-800/40 rounded-xl p-4 mb-6 flex items-start gap-3">
            <span className="text-2xl">⚡</span>
            <div className="flex-1">
              <p className="text-sm font-bold text-amber-400 mb-2">
                Two-Way Activity Observed ({twoWayList.length} {twoWayList.length === 1 ? 'stock' : 'stocks'})
                {isPostMarket && <span className="text-xs font-normal text-amber-600 ml-2">· as of market close</span>}
              </p>
              <p className="text-xs text-gray-400 mb-3">
                Both CE and PE showing significant activity for the same underlying — elevated activity on both sides. Informational only.
              </p>
              <div className="flex flex-wrap gap-2">
                {twoWayList.map(sym => {
                  const ceSignals = allSignals.filter(s => s.symbol === sym && s.option_type === 'CE')
                  const peSignals = allSignals.filter(s => s.symbol === sym && s.option_type === 'PE')
                  const ceSig = ceSignals[0]
                  const peSig = peSignals[0]
                  return (
                    <button key={sym} onClick={() => setStockSearch(sym)}
                      className="flex items-center gap-2 px-3 py-2 bg-amber-950/40 border border-amber-800/60 rounded-xl hover:bg-amber-950/60 transition-all group">
                      <span className="text-sm font-black text-white group-hover:text-amber-400 transition-colors">{sym}</span>
                      {ceSig && (
                        <span className="text-xs px-1.5 py-0.5 bg-red-950/60 text-red-400 border border-red-800/50 rounded-md">
                          {SIGNAL_META[ceSig.signal_type]?.icon} CE
                        </span>
                      )}
                      {peSig && (
                        <span className="text-xs px-1.5 py-0.5 bg-emerald-950/60 text-emerald-400 border border-emerald-800/50 rounded-md">
                          {SIGNAL_META[peSig.signal_type]?.icon} PE
                        </span>
                      )}
                      <span className="text-xs text-amber-600 group-hover:text-amber-400">View →</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Summary boxes */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Total UOA Signals</p>
            <p className="text-2xl font-black text-white">{data?.total || 0}</p>
            <p className="text-xs text-gray-600">{data?.snapshot_count || 0} snapshots today</p>
          </div>
          <div className="bg-orange-950/20 border border-orange-800/40 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">🎯 High Conviction (4-5)</p>
            <p className="text-2xl font-black text-orange-400">{highConvCount}</p>
            <p className="text-xs text-gray-600">strongest observed patterns</p>
          </div>
          <div className="bg-emerald-950/20 border border-emerald-800/40 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">↑ Bullish Bias</p>
            <p className="text-2xl font-black text-emerald-400">{bullishCount}</p>
            <p className="text-xs text-gray-600">put writing, long buildup etc</p>
          </div>
          <div className="bg-red-950/20 border border-red-800/40 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">↓ Bearish Bias</p>
            <p className="text-2xl font-black text-red-400">{bearishCount}</p>
            <p className="text-xs text-gray-600">call writing, short buildup etc</p>
          </div>
        </div>

        {/* Stock Search */}
        <div className="relative mb-5">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"/>
          <input
            value={stockSearch}
            onChange={e => setStockSearch(e.target.value.toUpperCase())}
            placeholder="Search stock for aerial view — e.g. TECHM, COALINDIA, NIFTY"
            className="w-full bg-gray-900 border border-gray-700 text-white text-sm rounded-xl pl-9 pr-10 py-3 focus:outline-none focus:border-emerald-500 transition-colors placeholder:text-gray-600"
          />
          {stockSearch && (
            <button onClick={() => setStockSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors">
              <X size={14}/>
            </button>
          )}
        </div>

        {/* Aerial view panel */}
        {isAerialView && aerialSymbol && (
          <div className={`rounded-2xl border p-5 mb-6 ${isAerialTwoWay ? 'border-amber-800/50 bg-amber-950/10' : 'border-gray-700 bg-gray-900/40'}`}>
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-xl font-black text-white">{aerialSymbol}</h2>
              <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded-lg">Aerial View</span>
              {isAerialTwoWay && <span className="text-xs px-2 py-1 bg-amber-950 text-amber-400 border border-amber-800/50 rounded-lg">⚡ Two-Way Activity</span>}
              {isPostMarket && <span className="text-xs px-2 py-1 bg-gray-800 text-gray-400 border border-gray-700 rounded-lg">📊 EOD Snapshot</span>}
              <a href={`/stock/${aerialSymbol}`} className="ml-auto text-xs text-emerald-400 hover:text-emerald-300 border border-emerald-800/50 px-2 py-1 rounded-lg transition-colors">
                Full Stock Page →
              </a>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {aerialCE.length > 0 && (
                <div>
                  <p className="text-xs text-red-400 font-bold mb-2">🔴 CE Activity ({aerialCE.length} strikes)</p>
                  <div className="space-y-2">
                    {aerialCE.map((s, i) => {
                      const m = SIGNAL_META[s.signal_type] || SIGNAL_META.VOLUME_SURGE
                      return (
                        <div key={i} className={`rounded-xl p-3 border ${m.bg} ${m.border}`}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-black text-white">{s.strike.toLocaleString()} CE</span>
                              <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${m.color} ${m.bg} border ${m.border}`}>{m.icon} {m.label}</span>
                              {s.at_day_high && <StockAtHighBadge atDayHigh={s.at_day_high} pct={s.day_high_pct}/>}
                              {isPostMarket && <span className="text-xs px-1 py-0.5 bg-gray-800 text-gray-500 rounded">📊 EOD</span>}
                            </div>
                            <span className={`text-sm font-black ${s.ltp_chg_from_open > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {s.ltp_chg_from_open > 0 ? '+' : ''}{s.ltp_chg_from_open}% from open
                            </span>
                          </div>
                          <div className="flex gap-4 text-xs text-gray-500">
                            <span>OI 30m: <span className={s.oi_chg_30min > 0 ? 'text-emerald-400' : 'text-red-400'}>{s.oi_chg_30min > 0 ? '+' : ''}{s.oi_chg_30min}%</span></span>
                            <span>Vol/OI: <span className="text-amber-400">{s.vol_oi_ratio}x</span></span>
                            <span>LTP: <span className="text-white">₹{s.ltp}</span> (Open: ₹{s.open_ltp})</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              {aerialPE.length > 0 && (
                <div>
                  <p className="text-xs text-emerald-400 font-bold mb-2">🟢 PE Activity ({aerialPE.length} strikes)</p>
                  <div className="space-y-2">
                    {aerialPE.map((s, i) => {
                      const m = SIGNAL_META[s.signal_type] || SIGNAL_META.VOLUME_SURGE
                      return (
                        <div key={i} className={`rounded-xl p-3 border ${m.bg} ${m.border}`}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-black text-white">{s.strike.toLocaleString()} PE</span>
                              <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${m.color} ${m.bg} border ${m.border}`}>{m.icon} {m.label}</span>
                              {s.at_day_high && <StockAtHighBadge atDayHigh={s.at_day_high} pct={s.day_high_pct}/>}
                              {isPostMarket && <span className="text-xs px-1 py-0.5 bg-gray-800 text-gray-500 rounded">📊 EOD</span>}
                            </div>
                            <span className={`text-sm font-black ${s.ltp_chg_from_open > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {s.ltp_chg_from_open > 0 ? '+' : ''}{s.ltp_chg_from_open}% from open
                            </span>
                          </div>
                          <div className="flex gap-4 text-xs text-gray-500">
                            <span>OI 30m: <span className={s.oi_chg_30min > 0 ? 'text-emerald-400' : 'text-red-400'}>{s.oi_chg_30min > 0 ? '+' : ''}{s.oi_chg_30min}%</span></span>
                            <span>Vol/OI: <span className="text-amber-400">{s.vol_oi_ratio}x</span></span>
                            <span>LTP: <span className="text-white">₹{s.ltp}</span> (Open: ₹{s.open_ltp})</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

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
              {b==='all'?'All Bias':b==='BULLISH'?'↑ Bullish Bias':'↓ Bearish Bias'}
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
          <div className="flex items-center gap-2 bg-gray-900/30 border border-gray-800 rounded-lg px-3 py-1.5">
            <span className="text-xs text-gray-500">Min score:</span>
            <input type="range" min="1" max="5" value={minScore} onChange={e => setMinScore(Number(e.target.value))} className="w-20 accent-amber-400"/>
            <span className="text-xs font-black text-amber-400">{minScore}+</span>
          </div>
        </div>

        <p className="text-xs text-gray-600 mb-4">
          {filtered.length} signals · {openTime} open → {captureTime} {isPostMarket ? 'close' : 'now'} · {isPostMarket ? '📊 EOD snapshot · ' : ''}Informational only
        </p>

        {loading ? (
          <div className="space-y-2">{[1,2,3,4,5].map(i=><div key={i} className="h-14 bg-gray-900/30 border border-gray-800 rounded-xl animate-pulse"/>)}</div>
        ) : filtered.length > 0 ? (
          <div className="rounded-2xl border border-gray-800 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-900/60 border-b border-gray-800">
                  {['Symbol','Strike','Type','Signal Observed','Activity Pattern','Conviction','Vol/OI','Volume','OI Δ 30m','LTP Δ Open','OTM%','LTP'].map((h,i)=>(
                    <th key={h} className={`text-xs font-semibold text-gray-500 px-4 py-3.5 ${i<=4?'text-left':'text-right'} ${i===0?'pl-5':''} ${i===11?'pr-5':''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((sig, i) => {
                  const m = SIGNAL_META[sig.signal_type] || { color:'text-gray-400', bg:'bg-gray-900/30', border:'border-gray-800', icon:'👁️', label: sig.signal_type }
                  const isCE = sig.option_type === 'CE'
                  const isTwoWay = twoWaySymbols.has(sig.symbol)
                  const obs = getObservation(sig)
                  const isEOD = sig.time_tag === 'post_market'

                  return (
                    <tr key={`${sig.tradingsymbol}-${i}`}
                      className={`border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors ${isTwoWay ? 'bg-amber-950/10' : i%2===0?'':'bg-gray-900/20'}`}>

                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <button onClick={() => setStockSearch(sig.symbol)}
                            className="text-sm font-black text-white hover:text-emerald-400 transition-colors">
                            {sig.symbol}
                          </button>
                          {sig.is_index && <span className="text-xs px-1.5 py-0.5 bg-cyan-950 text-cyan-400 border border-cyan-800/50 rounded-md">IDX</span>}
                          {isTwoWay && <span className="text-xs px-1.5 py-0.5 bg-amber-950 text-amber-400 border border-amber-800/50 rounded-md">⚡ 2-WAY</span>}
                          {sig.at_day_high && <StockAtHighBadge atDayHigh={sig.at_day_high} pct={sig.day_high_pct}/>}
                        </div>
                        <p className="text-xs text-gray-600 mt-0.5">CMP: ₹{sig.cmp.toLocaleString()}</p>
                        {sig.day_high && !sig.at_day_high && sig.day_high_pct !== null && sig.day_high_pct < 2 && (
                          <p className="text-xs text-gray-600">{sig.day_high_pct.toFixed(1)}% to stock high</p>
                        )}
                        {/* Time tags */}
                        {isEOD && (
                          <span className="text-xs text-gray-500 flex items-center gap-1">📊 EOD snapshot</span>
                        )}
                        {sig.time_tag === 'market_closing' && (
                          <span className="text-xs text-red-400 flex items-center gap-1"><AlertTriangle size={9}/> Market closing</span>
                        )}
                        {sig.time_tag === 'positional_only' && (
                          <span className="text-xs text-orange-400">Positional · {minsToClose}m left</span>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-sm font-bold text-gray-300">{sig.strike.toLocaleString()}</td>

                      <td className="px-4 py-3.5">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${isCE?'bg-red-950/50 text-red-400 border border-red-800/50':'bg-emerald-950/50 text-emerald-400 border border-emerald-800/50'}`}>{sig.option_type}</span>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className={`inline-flex items-center gap-1.5 text-xs font-bold px-2 py-1 rounded-lg border ${m.color} ${m.bg} ${m.border}`}>
                          <span>{m.icon}</span><span>{m.label}</span>
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <span className={`text-xs font-medium ${obs.color}`}>{obs.text}</span>
                        <p className="text-xs text-gray-600 mt-0.5 max-w-[200px]">{sig.signal_desc}</p>
                      </td>

                      <td className="px-4 py-3.5 text-right"><ScoreMeter score={sig.score}/></td>
                      <td className={`px-4 py-3.5 text-right text-sm font-black ${sig.vol_oi_ratio > 5 ? 'text-orange-400' : sig.vol_oi_ratio > 2 ? 'text-amber-400' : 'text-gray-400'}`}>{sig.vol_oi_ratio}x</td>
                      <td className="px-4 py-3.5 text-right text-sm text-gray-300">{(sig.volume/100000).toFixed(1)}L</td>
                      <td className={`px-4 py-3.5 text-right text-sm font-semibold ${sig.oi_chg_30min > 0 ? 'text-emerald-400' : sig.oi_chg_30min < 0 ? 'text-red-400' : 'text-gray-500'}`}>
                        {sig.oi_chg_30min > 0 ? '+' : ''}{sig.oi_chg_30min}%
                      </td>
                      <td className={`px-4 py-3.5 text-right text-sm font-semibold ${sig.ltp_chg_from_open > 0 ? 'text-emerald-400' : sig.ltp_chg_from_open < 0 ? 'text-red-400' : 'text-gray-500'}`}>
                        {sig.ltp_chg_from_open > 0 ? '+' : ''}{sig.ltp_chg_from_open}%
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        {sig.is_otm ? <span className="text-xs font-bold text-violet-400">{sig.otm_pct}% OTM</span> : <span className="text-xs text-gray-600">ITM/ATM</span>}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <p className="text-sm font-bold text-amber-400">₹{sig.ltp}</p>
                        <p className="text-xs text-gray-600">Open: ₹{sig.open_ltp}</p>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center border border-gray-800/50 rounded-2xl">
            <div className="text-5xl mb-4">🐋</div>
            <h3 className="text-lg font-bold text-gray-400 mb-2">No patterns detected for current filters</h3>
            <p className="text-sm text-gray-600">Try lowering the minimum score or changing the date</p>
          </div>
        )}

        <div className="mt-8 bg-gray-900/20 border border-gray-800/40 rounded-xl p-4">
          <p className="text-xs text-gray-600 leading-relaxed">
            <span className="text-gray-400 font-semibold">Disclaimer:</span> GreekNova UOA is an observational tool that identifies patterns in publicly available NSE options data.
            Signals represent observed activity patterns only and do not constitute investment advice, research recommendations, or trading signals.
            GreekNova is not a SEBI-registered research analyst or investment advisor.
            Past patterns do not guarantee future price movements. Trade at your own risk.
          </p>
        </div>
      </div>
    </div>
  )
}
