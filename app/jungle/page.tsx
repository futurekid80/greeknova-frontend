'use client'
import Navbar from '@/components/Navbar'
import { useEffect, useState, useCallback, useRef } from 'react'
import { RefreshCw, Clock, Zap, Search, X } from 'lucide-react'

const API = 'https://greeknova-backend-production.up.railway.app'

interface OISpike {
  symbol: string; tradingsymbol: string; strike: number; option_type: string
  cmp: number; last_price: number; ltp_chg_pct: number
  is_index: boolean; is_otm: boolean; otm_pct: number
  volume: number; oi: number; old_oi: number; new_oi: number
  oi_change: number; oi_pct: number; vol_change: number
  direction: 'BUILD' | 'UNWIND'; interpretation: string
}

interface VolSpike {
  symbol: string; tradingsymbol: string; strike: number; option_type: string
  cmp: number; last_price: number; ltp_chg_pct: number
  is_index: boolean; is_otm: boolean; otm_pct: number
  volume: number; oi: number; old_volume: number; new_volume: number
  vol_pct: number; oi_pct: number; vol_signal: 'FRESH_BUILD' | 'UNWINDING' | 'CHURN'
}

interface JungleData {
  date: string; ts_new: string; ts_old: string
  open_time: string; close_time: string; snapshots: number
  oi_threshold: number; vol_threshold: number
  oi_spikes: OISpike[]; vol_spikes: VolSpike[]
  oi_total: number; vol_total: number
}

const INTERP_META: Record<string, { color: string; bg: string; border: string; icon: string; label: string }> = {
  LONG_BUILDUP:   { color: 'text-emerald-400', bg: 'bg-emerald-950/30', border: 'border-emerald-800/40', icon: '🐂', label: 'Long Buildup' },
  SHORT_BUILDUP:  { color: 'text-red-400',     bg: 'bg-red-950/30',     border: 'border-red-800/40',     icon: '🐻', label: 'Short Buildup' },
  CALL_WRITING:   { color: 'text-red-400',     bg: 'bg-red-950/30',     border: 'border-red-800/40',     icon: '✍️', label: 'Call Writing' },
  PUT_WRITING:    { color: 'text-emerald-400', bg: 'bg-emerald-950/30', border: 'border-emerald-800/40', icon: '✍️', label: 'Put Writing' },
  SHORT_COVERING: { color: 'text-cyan-400',    bg: 'bg-cyan-950/30',    border: 'border-cyan-800/40',    icon: '🔄', label: 'Short Covering' },
  LONG_UNWINDING: { color: 'text-orange-400',  bg: 'bg-orange-950/30',  border: 'border-orange-800/40',  icon: '⚠️', label: 'Long Unwinding' },
  BUILD:          { color: 'text-emerald-400', bg: 'bg-emerald-950/30', border: 'border-emerald-800/40', icon: '↑',  label: 'Build' },
  UNWIND:         { color: 'text-red-400',     bg: 'bg-red-950/30',     border: 'border-red-800/40',     icon: '↓',  label: 'Unwind' },
}

const VOL_META: Record<string, { color: string; bg: string; border: string; icon: string; label: string }> = {
  FRESH_BUILD: { color: 'text-emerald-400', bg: 'bg-emerald-950/30', border: 'border-emerald-800/40', icon: '🌱', label: 'Fresh Build' },
  UNWINDING:   { color: 'text-red-400',     bg: 'bg-red-950/30',     border: 'border-red-800/40',     icon: '🔻', label: 'Unwinding' },
  CHURN:       { color: 'text-amber-400',   bg: 'bg-amber-950/30',   border: 'border-amber-800/40',   icon: '🔄', label: 'Churn' },
}

const OI_PRESETS:  (number | null)[] = [5, 10, 15, null]
const VOL_PRESETS: (number | null)[] = [20, 50, 100, null]

function fmtOI(n: number) {
  const abs = Math.abs(n)
  if (abs >= 10000000) return `${(n/10000000).toFixed(2)}Cr`
  if (abs >= 100000) return `${(n/100000).toFixed(1)}L`
  return n.toLocaleString()
}

export default function OptionsJungle() {
  const [data, setData]             = useState<JungleData | null>(null)
  const [loading, setLoading]       = useState(true)
  const [tab, setTab]               = useState<'oi' | 'vol'>('oi')
  const [oiThreshold, setOiThreshold]   = useState<number|null>(5)
  const [volThreshold, setVolThreshold] = useState<number|null>(20)
  const [dirFilter, setDirFilter]       = useState<'all'|'BUILD'|'UNWIND'>('all')
  const [interpFilter, setInterpFilter] = useState<string>('all')
  const [sortBy, setSortBy]             = useState<string>('oi_pct')
  const [sortDir, setSortDir]           = useState<1|-1>(-1)
  const [volSigFilter, setVolSigFilter] = useState<'all'|'FRESH_BUILD'|'UNWINDING'|'CHURN'>('all')
  const [typeFilter, setTypeFilter]     = useState<'all'|'CE'|'PE'>('all')
  const [stockSearch, setStockSearch]   = useState('')
  const [date, setDate]                 = useState('')
  const [availDates, setAvailDates]     = useState<string[]>([])
  const [autoEnabled, setAutoEnabled]   = useState(false)
  const [countdown, setCountdown]       = useState(300)
  const intervalRef  = useRef<NodeJS.Timeout|null>(null)
  const countdownRef = useRef<NodeJS.Timeout|null>(null)
  const dateRef = useRef('')
  const oiRef   = useRef<number|null>(5)
  const volRef  = useRef<number|null>(20)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        oi_threshold:  String(oiRef.current ?? 2),
        vol_threshold: String(volRef.current ?? 10),
      })
      if (dateRef.current) params.set('date', dateRef.current)
      const res  = await fetch(`${API}/options-jungle?${params}`)
      const json = await res.json()
      setData(json)
    } catch(e) { console.error(e) }
    setLoading(false)
  }, [])

  useEffect(() => {
    async function loadDates() {
      try {
        const res  = await fetch(`${API}/oi-dates/NIFTY`)
        const json = await res.json()
        const dates: string[] = [...(json.dates || [])].reverse()
        setAvailDates(dates)
        if (dates.length > 0 && !dateRef.current) {
          setDate(dates[0])
          dateRef.current = dates[0]
          fetchData()
        }
      } catch(e) { console.error(e) }
    }
    loadDates()
  }, [fetchData])

  function handleDateChange(d: string) { setDate(d); dateRef.current = d; fetchData() }
  function handleOIPreset(v: number | null) { setOiThreshold(v); oiRef.current = v; fetchData() }
  function handleVolPreset(v: number | null) { setVolThreshold(v); volRef.current = v; fetchData() }
  const [volSortBy, setVolSortBy] = useState<string>('vol_pct')
  const [volSortDir, setVolSortDir] = useState<1|-1>(-1)
  function sortToggle(col: string) { if (sortBy === col) setSortDir(d => d === -1 ? 1 : -1); else { setSortBy(col); setSortDir(-1) } }
  function volSortToggle(col: string) { if (volSortBy === col) setVolSortDir(d => d === -1 ? 1 : -1); else { setVolSortBy(col); setVolSortDir(-1) } }
  function SortIcon({ col, isVol = false }: { col: string; isVol?: boolean }) {
    const active = isVol ? volSortBy === col : sortBy === col
    const dir = isVol ? volSortDir : sortDir
    return active ? <span className="ml-1">{dir === -1 ? '↓' : '↑'}</span> : <span className="ml-1 opacity-20">↕</span>
  }

  function startAuto() {
    setAutoEnabled(true); setCountdown(300)
    if (intervalRef.current)  clearInterval(intervalRef.current)
    if (countdownRef.current) clearInterval(countdownRef.current)
    intervalRef.current  = setInterval(() => { fetchData(); setCountdown(300) }, 5*60*1000)
    countdownRef.current = setInterval(() => setCountdown(p => Math.max(0, p-1)), 1000)
  }
  function stopAuto() {
    setAutoEnabled(false)
    if (intervalRef.current)  { clearInterval(intervalRef.current);  intervalRef.current  = null }
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null }
  }

  useEffect(() => {
    fetchData(); startAuto()
    return () => {
      if (intervalRef.current)  clearInterval(intervalRef.current)
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [])

  const searchTerm = stockSearch.trim().toUpperCase()

  const oiFiltered = (data?.oi_spikes || [])
    .filter(s => oiThreshold === null || Math.abs(s.oi_pct) >= oiThreshold)
    .filter(s => !searchTerm || s.symbol.includes(searchTerm))
    .filter(s => dirFilter === 'all' || s.direction === dirFilter)
    .filter(s => interpFilter === 'all' || s.interpretation === interpFilter)
    .filter(s => typeFilter === 'all' || s.option_type === typeFilter)
    .sort((a, b) => {
      const av = sortBy === 'oi_pct' ? Math.abs(a.oi_pct) : sortBy === 'ltp_chg_pct' ? Math.abs(a.ltp_chg_pct) : sortBy === 'volume' ? a.volume : a.last_price
      const bv = sortBy === 'oi_pct' ? Math.abs(b.oi_pct) : sortBy === 'ltp_chg_pct' ? Math.abs(b.ltp_chg_pct) : sortBy === 'volume' ? b.volume : b.last_price
      return (bv - av) * sortDir
    })

  const volFiltered = (data?.vol_spikes || [])
    .filter(s => volThreshold === null || s.vol_pct >= volThreshold)
    .filter(s => !searchTerm || s.symbol.includes(searchTerm))
    .filter(s => volSigFilter === 'all' || s.vol_signal === volSigFilter)
    .filter(s => typeFilter === 'all' || s.option_type === typeFilter)
    .sort((a, b) => {
      const av = volSortBy === 'vol_pct' ? a.vol_pct : volSortBy === 'oi_pct' ? Math.abs(a.oi_pct) : volSortBy === 'ltp_chg_pct' ? Math.abs(a.ltp_chg_pct) : volSortBy === 'new_volume' ? a.new_volume : volSortBy === 'otm_pct' ? a.otm_pct : a.last_price
      const bv = volSortBy === 'vol_pct' ? b.vol_pct : volSortBy === 'oi_pct' ? Math.abs(b.oi_pct) : volSortBy === 'ltp_chg_pct' ? Math.abs(b.ltp_chg_pct) : volSortBy === 'new_volume' ? b.new_volume : volSortBy === 'otm_pct' ? b.otm_pct : b.last_price
      return (bv - av) * volSortDir
    })

  // ── Two-way detection for OI spikes ──────────────────────────────────────
  const oiSymbolSides: Record<string, Set<string>> = {}
  oiFiltered.forEach(s => {
    if (!oiSymbolSides[s.symbol]) oiSymbolSides[s.symbol] = new Set()
    oiSymbolSides[s.symbol].add(s.option_type)
  })
  const oiTwoWaySymbols = new Set(
    Object.entries(oiSymbolSides)
      .filter(([_, sides]) => sides.has('CE') && sides.has('PE'))
      .map(([sym]) => sym)
  )
  const oiTwoWayList = [...oiTwoWaySymbols]

  // ── Two-way detection for Vol spikes ─────────────────────────────────────
  const volSymbolSides: Record<string, Set<string>> = {}
  volFiltered.forEach(s => {
    if (!volSymbolSides[s.symbol]) volSymbolSides[s.symbol] = new Set()
    volSymbolSides[s.symbol].add(s.option_type)
  })
  const volTwoWaySymbols = new Set(
    Object.entries(volSymbolSides)
      .filter(([_, sides]) => sides.has('CE') && sides.has('PE'))
      .map(([sym]) => sym)
  )
  const volTwoWayList = [...volTwoWaySymbols]

  const isAerial  = searchTerm.length >= 2
  const aerialOI  = oiFiltered.filter(s => s.symbol === searchTerm)
  const aerialVol = volFiltered.filter(s => s.symbol === searchTerm)
  const aerialSym = isAerial ? searchTerm : null

  const oiBuilds  = oiFiltered.filter(s => s.direction === 'BUILD').length
  const oiUnwinds = oiFiltered.filter(s => s.direction === 'UNWIND').length
  const volFresh  = volFiltered.filter(s => s.vol_signal === 'FRESH_BUILD').length
  const volUnwind = volFiltered.filter(s => s.vol_signal === 'UNWINDING').length
  const volChurn  = volFiltered.filter(s => s.vol_signal === 'CHURN').length

  const mins = Math.floor(countdown/60)
  const secs = countdown % 60

  // Active two-way list based on current tab
  const activeTwoWayList = tab === 'oi' ? oiTwoWayList : volTwoWayList
  const activeTwoWaySymbols = tab === 'oi' ? oiTwoWaySymbols : volTwoWaySymbols

  return (
    <div className="min-h-screen bg-[#07070e] text-white">
      <Navbar active="/jungle" />
      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="text-3xl font-black tracking-tight mb-1">🌿 Options Jungle</h1>
            <p className="text-gray-500 text-sm">Where the wild money flows · OI Spikes + Volume Surges · 5-min snapshot comparison</p>
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
            {data?.open_time && (
              <div className="flex items-center gap-1.5 text-xs bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-gray-400">
                <Clock size={11}/>{data.open_time} → {data.close_time} IST · {data.snapshots} snapshots
              </div>
            )}
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

        {/* Summary boxes */}
        <div className="grid grid-cols-5 gap-3 mb-5">
          <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">🌊 OI Spikes</p>
            <p className="text-2xl font-black text-white">{oiFiltered.length}</p>
            <p className="text-xs text-gray-600">{oiThreshold === null ? 'all signals' : `above ${oiThreshold}% change`}</p>
          </div>
          <div className="bg-emerald-950/20 border border-emerald-800/40 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">↑ OI Builds</p>
            <p className="text-2xl font-black text-emerald-400">{oiBuilds}</p>
            <p className="text-xs text-gray-600">fresh positions</p>
          </div>
          <div className="bg-red-950/20 border border-red-800/40 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">↓ OI Unwinds</p>
            <p className="text-2xl font-black text-red-400">{oiUnwinds}</p>
            <p className="text-xs text-gray-600">positions exited</p>
          </div>
          <div className="bg-amber-950/20 border border-amber-800/40 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">⚡ Vol Spikes</p>
            <p className="text-2xl font-black text-amber-400">{volFiltered.length}</p>
            <p className="text-xs text-gray-600">{volThreshold === null ? 'all signals' : `above ${volThreshold}% surge`}</p>
          </div>
          <div className="bg-violet-950/20 border border-violet-800/40 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">🌱 Fresh Builds</p>
            <p className="text-2xl font-black text-violet-400">{volFresh}</p>
            <p className="text-xs text-gray-600">vol + OI rising</p>
          </div>
        </div>

        {/* Threshold presets */}
        <div className="bg-gray-900/30 border border-gray-800 rounded-2xl px-5 py-4 mb-5">
          <div className="flex items-center gap-8 flex-wrap">
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500 whitespace-nowrap">🌊 OI threshold:</span>
              <div className="flex gap-1.5">
                {OI_PRESETS.map(v => {
                  const count = v === null
                    ? (data?.oi_spikes || []).length
                    : (data?.oi_spikes || []).filter(s => Math.abs(s.oi_pct) >= v).length
                  const isActive = oiThreshold === v
                  return (
                    <button key={String(v)} onClick={() => handleOIPreset(v)}
                      className={`flex flex-col items-center px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${isActive
                        ? 'bg-emerald-950/60 text-emerald-400 border-emerald-700'
                        : 'bg-gray-800/40 text-gray-500 border-gray-700 hover:text-white'}`}>
                      <span>{v === null ? 'All →' : `${v}%`}</span>
                      {data && <span className={`text-[10px] font-normal mt-0.5 ${isActive ? 'text-emerald-600' : 'text-gray-600'}`}>{count}</span>}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="w-px h-8 bg-gray-800"/>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500 whitespace-nowrap">⚡ Vol threshold:</span>
              <div className="flex gap-1.5">
                {VOL_PRESETS.map(v => {
                  const count = v === null
                    ? (data?.vol_spikes || []).length
                    : (data?.vol_spikes || []).filter(s => s.vol_pct >= v).length
                  const isActive = volThreshold === v
                  return (
                    <button key={String(v)} onClick={() => handleVolPreset(v)}
                      className={`flex flex-col items-center px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${isActive
                        ? 'bg-amber-950/60 text-amber-400 border-amber-700'
                        : 'bg-gray-800/40 text-gray-500 border-gray-700 hover:text-white'}`}>
                      <span>{v === null ? 'All →' : `${v}%`}</span>
                      {data && <span className={`text-[10px] font-normal mt-0.5 ${isActive ? 'text-amber-600' : 'text-gray-600'}`}>{count}</span>}
                    </button>
                  )
                })}
              </div>
            </div>
            <p className="text-[10px] text-gray-600 ml-auto">Lower % = more signals · All → = show everything fetched</p>
          </div>
        </div>

        {/* Stock Search */}
        <div className="relative mb-5">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"/>
          <input
            value={stockSearch}
            onChange={e => setStockSearch(e.target.value.toUpperCase())}
            placeholder="Search stock for aerial view — e.g. TECHM, NIFTY, RELIANCE"
            className="w-full bg-gray-900 border border-gray-700 text-white text-sm rounded-xl pl-9 pr-10 py-3 focus:outline-none focus:border-emerald-500 transition-colors placeholder:text-gray-600"
          />
          {stockSearch && (
            <button onClick={() => setStockSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors">
              <X size={14}/>
            </button>
          )}
        </div>

        {/* Aerial View */}
        {isAerial && aerialSym && (
          <div className="rounded-2xl border border-gray-700 bg-gray-900/40 p-5 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-xl font-black text-white">{aerialSym}</h2>
              <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded-lg">Aerial View</span>
              <a href={`/stock/${aerialSym}`} className="ml-auto text-xs text-emerald-400 hover:text-emerald-300 border border-emerald-800/50 px-2 py-1 rounded-lg transition-colors">
                Full Stock Page →
              </a>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-xs text-emerald-400 font-bold mb-2">🌊 OI Activity ({aerialOI.length} strikes)</p>
                {aerialOI.length === 0 ? (
                  <p className="text-xs text-gray-600">No OI spikes above {oiThreshold}%</p>
                ) : (
                  <div className="space-y-2">
                    {aerialOI.map((s, i) => {
                      const m = INTERP_META[s.interpretation] || INTERP_META[s.direction]
                      return (
                        <div key={i} className={`rounded-xl p-3 border ${m.bg} ${m.border}`}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-black text-white">{s.strike.toLocaleString()} {s.option_type}</span>
                              <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${m.color}`}>{m.icon} {m.label}</span>
                            </div>
                            <span className={`text-sm font-black ${s.oi_pct > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {s.oi_pct > 0 ? '+' : ''}{s.oi_pct}% OI
                            </span>
                          </div>
                          <div className="flex gap-4 text-xs text-gray-500">
                            <span>LTP: <span className="text-white">₹{s.last_price}</span></span>
                            <span>LTP Δ: <span className={s.ltp_chg_pct > 0 ? 'text-emerald-400' : 'text-red-400'}>{s.ltp_chg_pct > 0 ? '+' : ''}{s.ltp_chg_pct}%</span></span>
                            <span>Vol: <span className="text-gray-300">{fmtOI(s.volume)}</span></span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs text-amber-400 font-bold mb-2">⚡ Volume Activity ({aerialVol.length} strikes)</p>
                {aerialVol.length === 0 ? (
                  <p className="text-xs text-gray-600">No volume spikes above {volThreshold}%</p>
                ) : (
                  <div className="space-y-2">
                    {aerialVol.map((s, i) => {
                      const m = VOL_META[s.vol_signal]
                      return (
                        <div key={i} className={`rounded-xl p-3 border ${m.bg} ${m.border}`}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-black text-white">{s.strike.toLocaleString()} {s.option_type}</span>
                              <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${m.color}`}>{m.icon} {m.label}</span>
                            </div>
                            <span className="text-sm font-black text-amber-400">+{s.vol_pct}% vol</span>
                          </div>
                          <div className="flex gap-4 text-xs text-gray-500">
                            <span>LTP: <span className="text-white">₹{s.last_price}</span></span>
                            <span>OI Δ: <span className={s.oi_pct > 0 ? 'text-emerald-400' : 'text-red-400'}>{s.oi_pct > 0 ? '+' : ''}{s.oi_pct}%</span></span>
                            <span>Vol: <span className="text-gray-300">{fmtOI(s.new_volume)}</span></span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-5 bg-gray-900/40 border border-gray-800 rounded-xl p-1 w-fit">
          <button onClick={() => setTab('oi')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${tab === 'oi' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60' : 'text-gray-500 hover:text-white'}`}>
            🌊 OI Spikes <span className="text-xs opacity-70">{oiFiltered.length}</span>
          </button>
          <button onClick={() => setTab('vol')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${tab === 'vol' ? 'bg-amber-950 text-amber-400 border border-amber-800/60' : 'text-gray-500 hover:text-white'}`}>
            ⚡ Volume Spikes <span className="text-xs opacity-70">{volFiltered.length}</span>
          </button>
        </div>

        {/* FIX: Two-way alert panel — per tab, all symbols clickable */}
        {activeTwoWayList.length > 0 && (
          <div className="bg-amber-950/20 border border-amber-800/40 rounded-xl p-4 mb-4 flex items-start gap-3">
            <span className="text-xl">⚡</span>
            <div className="flex-1">
              <p className="text-sm font-bold text-amber-400 mb-2">
                Two-Way Activity — {activeTwoWayList.length} {activeTwoWayList.length === 1 ? 'stock' : 'stocks'} showing both CE + PE signals
              </p>
              <div className="flex flex-wrap gap-2">
                {activeTwoWayList.map(sym => {
                  const ceRows = tab === 'oi'
                    ? oiFiltered.filter(s => s.symbol === sym && s.option_type === 'CE')
                    : volFiltered.filter(s => s.symbol === sym && s.option_type === 'CE')
                  const peRows = tab === 'oi'
                    ? oiFiltered.filter(s => s.symbol === sym && s.option_type === 'PE')
                    : volFiltered.filter(s => s.symbol === sym && s.option_type === 'PE')
                  const ceSig = ceRows[0]
                  const peSig = peRows[0]
                  const ceMeta = tab === 'oi'
                    ? (INTERP_META[(ceSig as OISpike)?.interpretation] || INTERP_META['BUILD'])
                    : (VOL_META[(ceSig as VolSpike)?.vol_signal] || VOL_META['CHURN'])
                  const peMeta = tab === 'oi'
                    ? (INTERP_META[(peSig as OISpike)?.interpretation] || INTERP_META['BUILD'])
                    : (VOL_META[(peSig as VolSpike)?.vol_signal] || VOL_META['CHURN'])
                  return (
                    <button
                      key={sym}
                      onClick={() => setStockSearch(sym)}
                      className="flex items-center gap-2 px-3 py-2 bg-amber-950/40 border border-amber-800/60 rounded-xl hover:bg-amber-950/60 transition-all group">
                      <span className="text-sm font-black text-white group-hover:text-amber-400 transition-colors">{sym}</span>
                      {ceSig && (
                        <span className={`text-xs px-1.5 py-0.5 rounded-md border ${ceMeta.color} ${ceMeta.bg} ${ceMeta.border}`}>
                          {ceMeta.icon} CE
                        </span>
                      )}
                      {peSig && (
                        <span className={`text-xs px-1.5 py-0.5 rounded-md border ${peMeta.color} ${peMeta.bg} ${peMeta.border}`}>
                          {peMeta.icon} PE
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

        {/* Tab filters */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {tab === 'oi' ? (
            <>
              {(['all','BUILD','UNWIND'] as const).map(f => (
                <button key={f} onClick={() => setDirFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${dirFilter===f ? 'bg-white text-gray-900 border-white' : 'bg-gray-900/40 text-gray-400 border-gray-800 hover:text-white'}`}>
                  {f==='all'?'◈ All':f==='BUILD'?'↑ Builds':'↓ Unwinds'}
                  <span className="ml-1 opacity-60">{f==='all'?oiFiltered.length:f==='BUILD'?oiBuilds:oiUnwinds}</span>
                </button>
              ))}
              <div className="w-px h-5 bg-gray-800 mx-1"/>
              {([
                ['all','◈ All'],
                ['CALL_WRITING','✍️ Call Writing'],
                ['PUT_WRITING','✍️ Put Writing'],
                ['LONG_BUILDUP','🐂 Long Buildup'],
                ['SHORT_BUILDUP','🐻 Short Buildup'],
                ['SHORT_COVERING','🔄 Short Covering'],
                ['LONG_UNWINDING','⚠️ Long Unwinding'],
              ] as const).map(([f, label]) => (
                <button key={f} onClick={() => setInterpFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${interpFilter===f ? 'bg-white text-gray-900 border-white' : 'bg-gray-900/40 text-gray-400 border-gray-800 hover:text-white'}`}>
                  {label}
                </button>
              ))}
            </>
          ) : (
            <>
              {(['all','FRESH_BUILD','UNWINDING','CHURN'] as const).map(f => (
                <button key={f} onClick={() => setVolSigFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${volSigFilter===f ? 'bg-white text-gray-900 border-white' : 'bg-gray-900/40 text-gray-400 border-gray-800 hover:text-white'}`}>
                  {f==='all'?'◈ All':f==='FRESH_BUILD'?'🌱 Fresh Build':f==='UNWINDING'?'🔻 Unwinding':'🔄 Churn'}
                  <span className="ml-1 opacity-60">{f==='all'?volFiltered.length:f==='FRESH_BUILD'?volFresh:f==='UNWINDING'?volUnwind:volChurn}</span>
                </button>
              ))}
            </>
          )}
          <div className="w-px h-5 bg-gray-800 mx-1"/>
          {(['all','CE','PE'] as const).map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${typeFilter===t ? 'bg-white text-gray-900 border-white' : 'bg-gray-900/40 text-gray-400 border-gray-800 hover:text-white'}`}>
              {t==='all'?'All':t}
            </button>
          ))}
        </div>

        <p className="text-xs text-gray-600 mb-4">
          {tab === 'oi' ? oiFiltered.length : volFiltered.length} signals · {data?.open_time} → {data?.close_time} IST
        </p>

        {loading ? (
          <div className="space-y-2">{[1,2,3,4,5].map(i=><div key={i} className="h-14 bg-gray-900/30 border border-gray-800 rounded-xl animate-pulse"/>)}</div>
        ) : tab === 'oi' ? (
          oiFiltered.length > 0 ? (
            <div className="rounded-2xl border border-gray-800 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-900/60 border-b border-gray-800">
                    {['Symbol','Strike','Type','Signal','OI Δ%','LTP Δ%','Old OI','New OI','Vol Δ%','% Away','LTP'].map((h,i)=>{
                      const colMap: Record<string,string> = {'OI Δ%':'oi_pct','LTP Δ%':'ltp_chg_pct','Vol Δ%':'volume','% Away':'otm_pct','LTP':'last_price'}
                      const col = colMap[h]
                      return col ? (
                        <th key={h} onClick={() => sortToggle(col)} className={`text-xs font-semibold text-gray-500 px-4 py-3.5 text-right cursor-pointer hover:text-white transition-colors select-none ${i===10?'pr-5':''}`}>
                          {h}<SortIcon col={col}/>
                        </th>
                      ) : (
                        <th key={h} className={`text-xs font-semibold text-gray-500 px-4 py-3.5 ${i<=3?'text-left':'text-right'} ${i===0?'pl-5':''}`}>{h}</th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {oiFiltered.map((s, i) => {
                    const m = INTERP_META[s.interpretation] || INTERP_META[s.direction]
                    const isCE = s.option_type === 'CE'
                    const isTwoWay = oiTwoWaySymbols.has(s.symbol)
                    return (
                      <tr key={`${s.tradingsymbol}-${i}`} className={`border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors ${isTwoWay ? 'bg-amber-950/10' : i%2===0?'':`bg-gray-900/20`}`}>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <button onClick={() => setStockSearch(s.symbol)} className="text-sm font-black text-white hover:text-emerald-400 transition-colors">{s.symbol}</button>
                            {s.is_index && <span className="text-xs px-1.5 py-0.5 bg-cyan-950 text-cyan-400 border border-cyan-800/50 rounded-md">IDX</span>}
                            {isTwoWay && <span className="text-xs px-1.5 py-0.5 bg-amber-950 text-amber-400 border border-amber-800/50 rounded-md">⚡ 2-WAY</span>}
                          </div>
                          <p className="text-xs text-gray-600 mt-0.5">CMP: ₹{s.cmp.toLocaleString()}</p>
                        </td>
                        <td className="px-4 py-3.5 text-sm font-bold text-gray-300">{s.strike.toLocaleString()}</td>
                        <td className="px-4 py-3.5">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${isCE?'bg-red-950/50 text-red-400 border border-red-800/50':'bg-emerald-950/50 text-emerald-400 border border-emerald-800/50'}`}>{s.option_type}</span>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg border ${m.color} ${m.bg} ${m.border}`}>
                            {m.icon} {m.label}
                          </div>
                        </td>
                        <td className={`px-4 py-3.5 text-right text-sm font-black ${s.oi_pct > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          <span className="flex items-center justify-end gap-1"><Zap size={11}/>{s.oi_pct > 0 ? '+' : ''}{s.oi_pct}%</span>
                        </td>
                        <td className={`px-4 py-3.5 text-right text-sm font-semibold ${s.ltp_chg_pct > 0 ? 'text-emerald-400' : s.ltp_chg_pct < 0 ? 'text-red-400' : 'text-gray-500'}`}>
                          {s.ltp_chg_pct > 0 ? '+' : ''}{s.ltp_chg_pct}%
                        </td>
                        <td className="px-4 py-3.5 text-right text-sm text-gray-500">{fmtOI(s.old_oi)}</td>
                        <td className="px-4 py-3.5 text-right text-sm text-gray-300">{fmtOI(s.new_oi)}</td>
                        <td className="px-4 py-3.5 text-right text-sm text-amber-400">
                          {s.old_oi > 0 ? `${s.vol_change > 0 ? '+' : ''}${Math.round(s.vol_change / s.old_oi * 100)}%` : '—'}
                        </td>
                        <td className="px-4 py-3.5 text-right text-sm">
                          {s.otm_pct > 0 ? (
                            <span className={s.otm_pct <= 2 ? 'text-emerald-400 font-bold' : s.otm_pct <= 5 ? 'text-amber-400' : 'text-gray-500'}>
                              {s.otm_pct}%
                            </span>
                          ) : <span className="text-blue-400 font-bold">ITM</span>}
                        </td>
                        <td className="px-5 py-3.5 text-right text-sm font-bold text-amber-400">₹{s.last_price}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center border border-gray-800/50 rounded-2xl">
              <div className="text-4xl mb-4">🌿</div>
              <h3 className="text-lg font-bold text-gray-400 mb-2">No OI spikes above {oiThreshold}%</h3>
              <p className="text-sm text-gray-600">Try the 5% preset to see more signals</p>
            </div>
          )
        ) : (
          volFiltered.length > 0 ? (
            <div className="rounded-2xl border border-gray-800 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-900/60 border-b border-gray-800">
                    {['Symbol','Strike','Type','Vol Signal','Vol Δ%','OI Δ%','LTP Δ%','New Vol','% Away','LTP'].map((h,i)=>{
                      const colMap: Record<string,string> = {'Vol Δ%':'vol_pct','OI Δ%':'oi_pct','LTP Δ%':'ltp_chg_pct','New Vol':'new_volume','% Away':'otm_pct','LTP':'last_price'}
                      const col = colMap[h]
                      return col ? (
                        <th key={h} onClick={() => volSortToggle(col)} className={`text-xs font-semibold text-gray-500 px-4 py-3.5 text-right cursor-pointer hover:text-white transition-colors select-none ${i===9?'pr-5':''}`}>
                          {h}<SortIcon col={col} isVol={true}/>
                        </th>
                      ) : (
                        <th key={h} className={`text-xs font-semibold text-gray-500 px-4 py-3.5 ${i<=3?'text-left':'text-right'} ${i===0?'pl-5':''}`}>{h}</th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {volFiltered.map((s, i) => {
                    const m = VOL_META[s.vol_signal]
                    const isCE = s.option_type === 'CE'
                    const isTwoWay = volTwoWaySymbols.has(s.symbol)
                    return (
                      <tr key={`${s.tradingsymbol}-${i}`} className={`border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors ${isTwoWay ? 'bg-amber-950/10' : i%2===0?'':`bg-gray-900/20`}`}>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <button onClick={() => setStockSearch(s.symbol)} className="text-sm font-black text-white hover:text-emerald-400 transition-colors">{s.symbol}</button>
                            {s.is_index && <span className="text-xs px-1.5 py-0.5 bg-cyan-950 text-cyan-400 border border-cyan-800/50 rounded-md">IDX</span>}
                            {isTwoWay && <span className="text-xs px-1.5 py-0.5 bg-amber-950 text-amber-400 border border-amber-800/50 rounded-md">⚡ 2-WAY</span>}
                          </div>
                          <p className="text-xs text-gray-600 mt-0.5">CMP: ₹{s.cmp.toLocaleString()}</p>
                        </td>
                        <td className="px-4 py-3.5 text-sm font-bold text-gray-300">{s.strike.toLocaleString()}</td>
                        <td className="px-4 py-3.5">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${isCE?'bg-red-950/50 text-red-400 border border-red-800/50':'bg-emerald-950/50 text-emerald-400 border border-emerald-800/50'}`}>{s.option_type}</span>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg border ${m.color} ${m.bg} ${m.border}`}>
                            {m.icon} {m.label}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-right text-sm font-black text-amber-400">+{s.vol_pct}%</td>
                        <td className={`px-4 py-3.5 text-right text-sm font-semibold ${s.oi_pct > 0 ? 'text-emerald-400' : s.oi_pct < 0 ? 'text-red-400' : 'text-gray-500'}`}>
                          {s.oi_pct > 0 ? '+' : ''}{s.oi_pct}%
                        </td>
                        <td className={`px-4 py-3.5 text-right text-sm font-semibold ${s.ltp_chg_pct > 0 ? 'text-emerald-400' : s.ltp_chg_pct < 0 ? 'text-red-400' : 'text-gray-500'}`}>
                          {s.ltp_chg_pct > 0 ? '+' : ''}{s.ltp_chg_pct}%
                        </td>
                        <td className="px-4 py-3.5 text-right text-sm text-gray-300">{fmtOI(s.new_volume)}</td>
                        <td className="px-4 py-3.5 text-right text-sm">
                          {s.otm_pct > 0 ? (
                            <span className={s.otm_pct <= 2 ? 'text-emerald-400 font-bold' : s.otm_pct <= 5 ? 'text-amber-400' : 'text-gray-500'}>
                              {s.otm_pct}%
                            </span>
                          ) : <span className="text-blue-400 font-bold">ITM</span>}
                        </td>
                        <td className="px-5 py-3.5 text-right text-sm font-bold text-amber-400">₹{s.last_price}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center border border-gray-800/50 rounded-2xl">
              <div className="text-4xl mb-4">⚡</div>
              <h3 className="text-lg font-bold text-gray-400 mb-2">No volume spikes above {volThreshold}%</h3>
              <p className="text-sm text-gray-600">Try the 20% preset to see more signals</p>
            </div>
          )
        )}
      </div>
    </div>
  )
}
