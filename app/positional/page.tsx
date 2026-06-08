'use client'
import Navbar from '@/components/Navbar'
import { useEffect, useState, useCallback } from 'react'
import { RefreshCw } from 'lucide-react'
import React from 'react'

const API = 'https://greeknova-backend-production.up.railway.app'

interface RadarResult {
  symbol: string; is_index: boolean
  signal: string; bias: string
  consistency_pct: number; consistency_label: string
  match_days: number; total_days: number
  consec_days: number
  accelerating: boolean; oi_first_half_chg: number; oi_second_half_chg: number
  triple_confirm: boolean; vol_consec: number
  oi_chg_pct: number; vol_chg_pct: number; vol_series_chg: number; vol_avg_7d: number; cmp_chg_pct: number
  oi_series: number[]; vol_series: number[]; cmp_series: number[]
  date_labels: string[]; cmp: number; series_days: number
  conviction_level: string; conviction_label: string; conviction_emoji: string; conviction_color: string; conviction_rank: number
  ignition: boolean; fut_signal_today: string | null
  ce_oi_chg_pct?: number; pe_oi_chg_pct?: number
  ce_pct_of_total?: number; pe_pct_of_total?: number
  pcr_series?: number; composition?: string; composition_interp?: string; composition_short?: string
  bias_confirmed?: boolean; dominant?: string
  ce_wall?: number; pe_wall?: number
  ce_wall_oi_L?: number; pe_wall_oi_L?: number
  trade_range?: number; trade_range_pct?: number; range_label?: string
  has_uoa?: boolean
  ignition_score?: number
  ignition_score_breakdown?: {
    consec_3plus: boolean
    high_consistency: boolean
    bias_confirmed: boolean
    cpr_confirms: boolean
    vol_building: boolean
  }
}

interface RadarData {
  expiry: string; series_start: string
  total_trading_days: number; min_consec: number
  total: number
  summary: {
    long_buildup: number; short_buildup: number
    short_covering: number; long_unwinding: number
    high_consistency: number; triple_confirm: number; accelerating: number
    conviction: number; ignition: number; building: number; radar: number
  }
  results: RadarResult[]
}

const SIGNAL_META: Record<string, { color: string; bg: string; border: string; icon: string; label: string }> = {
  LONG_BUILDUP:   { color: 'text-emerald-400', bg: 'bg-emerald-950/30', border: 'border-emerald-800/40', icon: '🐂', label: 'Long Buildup' },
  SHORT_BUILDUP:  { color: 'text-red-400',     bg: 'bg-red-950/30',     border: 'border-red-800/40',     icon: '🐻', label: 'Short Buildup' },
  SHORT_COVERING: { color: 'text-cyan-400',    bg: 'bg-cyan-950/30',    border: 'border-cyan-800/40',    icon: '🔄', label: 'Short Covering' },
  LONG_UNWINDING: { color: 'text-orange-400',  bg: 'bg-orange-950/30',  border: 'border-orange-800/40',  icon: '⚠️', label: 'Long Unwinding' },
}

const CONVICTION_META: Record<string, { bg: string; text: string; border: string }> = {
  RADAR:      { bg: 'bg-blue-950',    text: 'text-blue-400',    border: 'border-blue-800/50' },
  BUILDING:   { bg: 'bg-yellow-950',  text: 'text-yellow-400',  border: 'border-yellow-800/50' },
  CONVICTION: { bg: 'bg-orange-950',  text: 'text-orange-400',  border: 'border-orange-800/50' },
  IGNITION:   { bg: 'bg-emerald-950', text: 'text-emerald-400', border: 'border-emerald-800/50' },
}

function getRefStrike(cmp: number, side: 'CE' | 'PE'): number {
  const pct = cmp > 5000 ? 0.03 : cmp > 1000 ? 0.04 : 0.05
  const raw = side === 'CE' ? cmp * (1 + pct) : cmp * (1 - pct)
  const interval = cmp > 20000 ? 100 : cmp > 5000 ? 50 : cmp > 1000 ? 20 : cmp > 500 ? 10 : 5
  return Math.round(raw / interval) * interval
}

function getWriterTake(r: RadarResult): {
  oiType: string; oiColor: string; oiBg: string; oiBorder: string
  refStrike: number; refSide: 'CE' | 'PE'
  safetyLabel: string; safetyColor: string
  structureNote: string; cautionNote: string | null
  opportunityLabel: string; opportunityColor: string; opportunityBg: string
  conflictNote: string | null
} {
  const isCEWriter = r.signal === 'SHORT_BUILDUP' || r.signal === 'LONG_UNWINDING'
  const isPEWriter = r.signal === 'LONG_BUILDUP' || r.signal === 'SHORT_COVERING'
  const refSide: 'CE' | 'PE' = isCEWriter ? 'CE' : 'PE'
  const refStrike = getRefStrike(r.cmp, refSide)
  const oiType    = isCEWriter ? '✍️ CE OI Structure' : '✍️ PE OI Structure'
  const oiColor   = isCEWriter ? 'text-red-400' : 'text-emerald-400'
  const oiBg      = isCEWriter ? 'bg-red-950/20' : 'bg-emerald-950/20'
  const oiBorder  = isCEWriter ? 'border-red-800/30' : 'border-emerald-800/30'
  const safetyLabel = r.consistency_pct >= 70 ? 'HIGH' : r.consistency_pct >= 50 ? 'MEDIUM' : 'LOW'
  const safetyColor = safetyLabel === 'HIGH' ? 'text-emerald-400' : safetyLabel === 'MEDIUM' ? 'text-amber-400' : 'text-red-400'

  let opportunityLabel = '', opportunityColor = '', opportunityBg = ''
  if (isCEWriter && r.composition === 'CALL_DOMINATED') {
    opportunityLabel = '✅ CE writing context — call writers observably active'
    opportunityColor = 'text-emerald-400'; opportunityBg = 'bg-emerald-950/20'
  } else if (isCEWriter && r.composition === 'PUT_DOMINATED') {
    opportunityLabel = '⚠️ Mixed — PE writers dominant despite bearish price'
    opportunityColor = 'text-amber-400'; opportunityBg = 'bg-amber-950/20'
  } else if (isPEWriter && r.composition === 'PUT_DOMINATED') {
    opportunityLabel = '✅ PE writing context — put writers observably active'
    opportunityColor = 'text-emerald-400'; opportunityBg = 'bg-emerald-950/20'
  } else if (isPEWriter && r.composition === 'CALL_DOMINATED') {
    opportunityLabel = '⚠️ Mixed — CE writers dominant despite bullish price'
    opportunityColor = 'text-amber-400'; opportunityBg = 'bg-amber-950/20'
  } else {
    opportunityLabel = '⚪ Balanced OI — both sides active, monitor closely'
    opportunityColor = 'text-gray-400'; opportunityBg = 'bg-gray-900/30'
  }

  const conflictNote = (isCEWriter && r.composition === 'PUT_DOMINATED') ||
                       (isPEWriter && r.composition === 'CALL_DOMINATED')
    ? '⚠️ Composition contradicts price direction — avoid' : null

  const compNote = r.composition === 'PUT_DOMINATED'
    ? 'PE writers active · bullish institutional positioning'
    : r.composition === 'CALL_DOMINATED'
    ? 'CE writers active · bearish institutional positioning'
    : 'Mixed OI · both sides positioning'

  const cautionNote = r.signal === 'LONG_UNWINDING'
    ? '⚠️ Long positions exiting — monitor OI direction'
    : r.signal === 'SHORT_COVERING' ? '⚠️ Short covering — OI reducing' : null

  return { oiType, oiColor, oiBg, oiBorder, refStrike, refSide, safetyLabel, safetyColor, structureNote: compNote, cautionNote, opportunityLabel, opportunityColor, opportunityBg, conflictNote }
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null
  const min = Math.min(...data); const max = Math.max(...data)
  const range = max - min || 1
  const w = 80; const h = 28
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(' ')
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/>
      <circle cx={(data.length-1)/(data.length-1)*w} cy={h-((data[data.length-1]-min)/range)*h} r="2.5" fill={color}/>
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

function IgnitionScoreBar({ score, breakdown }: {
  score: number
  breakdown: {
    consec_3plus: boolean
    high_consistency: boolean
    bias_confirmed: boolean
    cpr_confirms: boolean
    vol_building: boolean
  }
}) {
  const labels = [
    { key: 'consec_3plus',     icon: '📅', tip: '3+ consecutive days'        },
    { key: 'high_consistency', icon: '📊', tip: 'HIGH consistency (70%+)'    },
    { key: 'bias_confirmed',   icon: '⚖',  tip: 'CE/PE composition confirms' },
    { key: 'cpr_confirms',     icon: '📌', tip: 'CPR position confirms'       },
    { key: 'vol_building',     icon: '📈', tip: 'Volume building 2+ days'     },
  ]
  const scoreColor = score === 5 ? 'text-emerald-400' : score === 4 ? 'text-amber-400' : 'text-orange-400'
  const barColor   = score === 5 ? 'bg-emerald-500'   : score === 4 ? 'bg-amber-400'   : 'bg-orange-400'
  return (
    <div className="mt-1.5">
      <div className="flex items-center gap-1.5 mb-1">
        <span className={`text-[10px] font-black ${scoreColor}`}>Quality {score}/5</span>
        <div className="flex gap-0.5">
          {[1,2,3,4,5].map(i => (
            <div key={i} className={`w-3 h-1.5 rounded-sm ${i <= score ? barColor : 'bg-gray-800'}`}/>
          ))}
        </div>
      </div>
      <div className="flex gap-1 flex-wrap">
        {labels.map(({ key, icon, tip }) => {
          const passed = breakdown[key as keyof typeof breakdown]
          return (
            <span key={key} title={tip}
              className={`text-[9px] px-1 py-0.5 rounded border font-bold ${
                passed
                  ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/40'
                  : 'bg-gray-900/40 text-gray-600 border-gray-800/40 opacity-50'
              }`}>
              {icon}
            </span>
          )
        })}
      </div>
      <p className="text-[9px] text-gray-700 mt-0.5">
        {score === 5 ? 'All factors aligned — highest conviction' : score === 4 ? 'Strong signal — one factor pending' : 'Signal active — wait for confirmation'}
      </p>
      <p className="text-[9px] text-gray-600 mt-1 leading-relaxed">
        📅 3d+ consec · 📊 70%+ consistency · ⚖ CE/PE confirms · 📌 CPR confirms · 📈 Vol building
      </p>
    </div>
  )
}

function ConvictionBadge({ level, label, emoji }: { level: string; label: string; emoji: string }) {
  const meta = CONVICTION_META[level] || CONVICTION_META['RADAR']
  return (
    <span className={`text-[10px] px-1.5 py-0.5 ${meta.bg} ${meta.text} border ${meta.border} rounded font-bold`}>
      {emoji} {label}
    </span>
  )
}

// ── OI Map Panel — identical to Intraday/CPR ──────────────────────────────────
function OIMapPanel({ symbol, wallsData }: { symbol: string; wallsData: any }) {
  const strikes = wallsData.strikes || []
  const cmp = wallsData.cmp || 0
  const interval = strikes.length > 1 ? Math.abs(strikes[0].strike - strikes[1].strike) : 50
  const maxCeStrike = strikes.reduce((best: any, s: any) => s.ce_oi > (best?.ce_oi || 0) ? s : best, null)
  const maxPeStrike = strikes.reduce((best: any, s: any) => s.pe_oi > (best?.pe_oi || 0) ? s : best, null)

  return (
    <tr>
      <td colSpan={10} className="px-5 py-4 bg-gray-900/50 border-b border-gray-800">
        <div>
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <p className="text-sm font-bold text-white">📊 {symbol} OI Structure</p>
            <span className="text-xs text-gray-500">CMP ₹{cmp?.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <div className="flex items-center gap-1.5 bg-gray-900/60 border border-gray-700 rounded-lg px-2 py-1">
              <span className="text-[10px] text-gray-500 font-semibold">Intraday:</span>
              <span className="text-[10px] font-bold text-red-400">📈 CE ₹{wallsData.intraday_ce_wall?.toLocaleString()}</span>
              <span className="text-[10px] text-gray-600">·</span>
              <span className="text-[10px] font-bold text-emerald-400">📉 PE ₹{wallsData.intraday_pe_wall?.toLocaleString()}</span>
              <span className="text-[10px] text-gray-600">· {wallsData.intraday_range_pct}%</span>
            </div>
            {maxCeStrike && maxPeStrike && (
              <div className="flex items-center gap-1.5 bg-gray-900/60 border border-gray-700 rounded-lg px-2 py-1">
                <span className="text-[10px] text-gray-500 font-semibold">Max OI:</span>
                <span className="text-[10px] font-bold text-red-400">📈 CE ₹{maxCeStrike.strike?.toLocaleString()} · {(maxCeStrike.ce_oi/100000).toFixed(2)}L</span>
                <span className="text-[10px] text-gray-600">·</span>
                <span className="text-[10px] font-bold text-emerald-400">📉 PE ₹{maxPeStrike.strike?.toLocaleString()} · {(maxPeStrike.pe_oi/100000).toFixed(2)}L</span>
              </div>
            )}
          </div>
          <div className="grid grid-cols-5 gap-2 text-[10px] text-gray-500 font-semibold mb-1 px-1">
            <span>Strike</span>
            <span className="text-red-400">CE OI</span>
            <span className="text-emerald-400">PE OI</span>
            <span>Dominant</span>
            <span>Note</span>
          </div>
          <div className="space-y-0.5 max-h-64 overflow-y-auto">
            {strikes.map((s: any) => {
              const isAtm = Math.abs(s.strike - cmp) <= interval / 2
              const isCeWall = s.strike === wallsData.ce_wall
              const isPeWall = s.strike === wallsData.pe_wall
              const dominant = s.ce_oi > s.pe_oi ? 'CE' : s.pe_oi > s.ce_oi ? 'PE' : '='
              return (
                <div key={s.strike}
                  className={`grid grid-cols-5 gap-2 text-[10px] py-1 px-1 rounded ${
                    isCeWall ? 'bg-red-950/30 border border-red-800/20'
                    : isPeWall ? 'bg-emerald-950/30 border border-emerald-800/20'
                    : isAtm ? 'bg-amber-950/20 border border-amber-800/20' : ''
                  }`}>
                  <span className={`font-bold ${isAtm ? 'text-amber-400' : 'text-white'}`}>
                    {s.strike.toLocaleString()} {isAtm ? '★' : ''}
                  </span>
                  <span className="text-red-400">{s.ce_oi > 0 ? `${(s.ce_oi/100000).toFixed(2)}L` : '—'}</span>
                  <span className="text-emerald-400">{s.pe_oi > 0 ? `${(s.pe_oi/100000).toFixed(2)}L` : '—'}</span>
                  <span className={dominant === 'CE' ? 'text-red-400' : dominant === 'PE' ? 'text-emerald-400' : 'text-gray-500'}>{dominant}</span>
                  <span className="text-gray-500 font-bold">
                    {isCeWall ? '🔴 CE Wall' : isPeWall ? '🟢 PE Wall' : isAtm ? '⭐ ATM' : ''}
                  </span>
                </div>
              )
            })}
          </div>
          <p className="text-[10px] text-gray-700 mt-2">Strikes within 15% of CMP · CE Wall = resistance · PE Wall = support · Informational only</p>
        </div>
      </td>
    </tr>
  )
}

export default function PositionalRadar() {
  const [data, setData]           = useState<RadarData | null>(null)
  const [staleData, setStaleData] = useState<RadarData | null>(null)
  const [loading, setLoading]     = useState(true)
  const [minConsec, setMinConsec] = useState(0)
  const [signalFilter, setSignalFilter]         = useState('all')
  const [biasFilter, setBiasFilter]             = useState<'all'|'BULLISH'|'BEARISH'>('all')
  const [consisFilter, setConsisFilter]         = useState('all')
  const [convictionFilter, setConvictionFilter] = useState('all')
  const [accelOnly, setAccelOnly]               = useState(false)
  const [highVolOnly, setHighVolOnly]           = useState(false)
  const [typeFilter, setTypeFilter]             = useState<'all'|'index'|'stocks'>('all')
  const [writerView, setWriterView]             = useState(false)
  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  function handleSort(col: string) {
    if (sortCol === col) {
      if (sortDir === 'desc') setSortDir('asc')
      else { setSortCol(null); setSortDir('desc') }
    } else {
      setSortCol(col)
      setSortDir('desc')
    }
  }

  // OI Map state
  const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null)
  const [wallsData, setWallsData] = useState<Record<string, any>>({})
  const [wallsLoading, setWallsLoading] = useState<string | null>(null)

  const fetchWalls = async (symbol: string) => {
    if (expandedSymbol === symbol) { setExpandedSymbol(null); return }
    if (wallsData[symbol]) { setExpandedSymbol(symbol); return }
    setWallsLoading(symbol)
    try {
      const res = await fetch(`${API}/oi-walls/${symbol}`)
      const json = await res.json()
      setWallsData(prev => ({ ...prev, [symbol]: json }))
      setExpandedSymbol(symbol)
    } catch(e) { console.error(e) }
    setWallsLoading(null)
  }

  const fetchData = useCallback(async (consec?: number) => {
    setLoading(true)
    const c = consec ?? minConsec
    try {
      const res  = await fetch(`${API}/positional-radar?min_consec=${c}`)
      const json = await res.json()
      setData(json)
      if (json?.results?.length > 0) setStaleData(json)
    } catch(e) { console.error(e) }
    setLoading(false)
  }, [minConsec])

  function handleConsec(c: number) { setMinConsec(c); fetchData(c) }
  useEffect(() => { fetchData(0) }, [])

  const SORT_MAP: Record<string, (r: RadarResult) => number> = {
    vol:      r => r.vol_chg_pct,
    oi:       r => r.oi_chg_pct,
    consec:   r => r.consec_days,
    consisPC: r => r.consistency_pct,
    price:    r => r.cmp_chg_pct,
  }

  const displayData = (data?.results?.length === 0 && staleData) ? staleData : data
  const results = (displayData?.results || [])
    .filter(r => typeFilter === 'all' || (typeFilter === 'index' ? r.is_index : !r.is_index))
    .filter(r => signalFilter === 'all' || r.signal === signalFilter)
    .filter(r => biasFilter === 'all' || r.bias === biasFilter)
    .filter(r => consisFilter === 'all' || r.consistency_label === consisFilter)
    .filter(r => convictionFilter === 'all' || r.conviction_level === convictionFilter)
    .filter(r => !accelOnly || r.accelerating)
    .filter(r => !highVolOnly || r.vol_chg_pct > 20)
    .filter(r => !writerView || r.consistency_pct >= 50)
    .sort((a, b) => {
      if (!sortCol || !SORT_MAP[sortCol]) return 0
      const fn = SORT_MAP[sortCol]
      return sortDir === 'desc' ? fn(b) - fn(a) : fn(a) - fn(b)
    })

  const s = displayData?.summary

  const tableHeaders = writerView
    ? ['Symbol', 'OI Structure', 'Direction Held', 'Consec', 'OI (Series)', 'CE / PE Split', 'Price (Series)', '✍️ Writer\'s Take']
    : ['Symbol', 'Signal', 'Consistency', 'Consec', 'OI (Series)', 'Volume (vs 7d avg)', 'Price (Series)', 'OI Trend', 'Price Trend', 'Deep Dive']

  return (
    <div className="min-h-screen bg-[#07070e] text-white">
      <Navbar active="/positional" />
      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-end justify-between mb-5">
          <div>
            <h1 className="text-3xl font-black tracking-tight mb-1">
              {writerView ? '✍️ Positional Radar — Writer\'s View' : '📈 Positional Radar'}
            </h1>
            <p className="text-gray-500 text-sm">
              {writerView
                ? 'Monthly expiry series · OI structure for option writers · Informational only'
                : 'Monthly expiry series · Options OI buildup · FUT confirmation · Informational only'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setWriterView(v => !v)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg border transition-all ${
                writerView ? 'bg-purple-950/60 text-purple-300 border-purple-700/60' : 'bg-gray-900/40 text-gray-400 border-gray-700 hover:text-white'
              }`}>
              {writerView ? '📊 Trader View' : '✍️ Writer\'s View'}
            </button>
            <button onClick={() => fetchData()} disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-sm font-medium rounded-lg border border-gray-700 disabled:opacity-50 transition-all">
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''}/>Refresh
            </button>
          </div>
        </div>

        {/* Writer's View Info Banner */}
        {writerView && (
          <div className="bg-purple-950/20 border border-purple-800/40 rounded-xl px-5 py-4 mb-5">
            <p className="text-xs text-purple-300 font-semibold mb-2">✍️ Writer's View — How to read this</p>
            <div className="grid grid-cols-3 gap-4 text-xs text-gray-400">
              <div><p className="text-purple-300 font-bold mb-1">OI Structure</p><p>CE OI Structure = call writers observably active. PE OI Structure = put writers observably active. Based on multi-day OI direction.</p></div>
              <div><p className="text-purple-300 font-bold mb-1">Reference Strike</p><p>Computed at ~3-5% OTM from current price. For informational reference only — always verify against live OI walls and max pain before any decision.</p></div>
              <div><p className="text-purple-300 font-bold mb-1">Direction Safety</p><p>HIGH = OI direction held 70%+ of series days. MEDIUM = 50-70%. Higher safety = more consistent OI positioning observed.</p></div>
            </div>
            <p className="text-[10px] text-gray-600 mt-3">All data is informational only. Not investment advice. GreekNova is not SEBI-registered. Always consult a SEBI-registered advisor before trading.</p>
          </div>
        )}

        {/* Series info */}
        {displayData && (
          <div className="bg-gray-900/30 border border-gray-800 rounded-xl px-5 py-3 mb-5 flex items-center justify-between">
            <div className="flex items-center gap-6 text-sm">
              <div><span className="text-gray-500 text-xs">Series</span><p className="text-white font-bold">{displayData.series_start} → {displayData.expiry}</p></div>
              <div><span className="text-gray-500 text-xs">Trading days captured</span><p className="text-amber-400 font-black">{displayData.total_trading_days} days</p></div>
              <div><span className="text-gray-500 text-xs">Monthly expiry</span><p className="text-cyan-400 font-bold">{displayData.expiry}</p></div>
            </div>
        )}

        {/* Expiry week warning */}
        {displayData && Math.ceil((new Date(displayData.expiry).getTime() - Date.now()) / 86400000) <= 2 && (
          <div className="bg-amber-950/30 border border-amber-800/40 rounded-xl px-4 py-3 mb-5">
            <p className="text-xs text-amber-400"><span className="font-bold">⚠️ Expiry week:</span> OI data may show distortion due to position rollover ahead of {data.expiry} expiry. Signals will rebuild from next Wednesday when a new series begins.</p>
          </div>
        )}

        {/* Conviction legend */}
        {!writerView && (
          <div className="bg-gray-900/20 border border-gray-800/40 rounded-xl px-4 py-3 mb-5">
            <p className="text-xs text-gray-400 font-semibold mb-2">Signal conviction levels:</p>
            <div className="flex items-center gap-6 flex-wrap">
              {[
                { level: 'RADAR',      emoji: '🔵', label: 'Radar',      desc: 'OI >3% + Price >0.5% over series. 0-1 consecutive days. Watch only.' },
                { level: 'BUILDING',   emoji: '🟡', label: 'Building',   desc: '2+ consecutive days signal direction held. Add to watchlist.' },
                { level: 'CONVICTION', emoji: '🟠', label: 'Conviction', desc: '3+ consecutive days + vol >7d avg by 20% OR OI accelerating. High confidence.' },
                { level: 'IGNITION',   emoji: '🟢', label: 'Ignition',   desc: 'Conviction + FUT confirms bias today (OI >2%, price >0.2%). Quality score shown.' },
              ].map(({ level, emoji, label, desc }) => {
                const meta = CONVICTION_META[level]
                return (
                  <div key={level} className="flex items-center gap-2">
                    <span className={`text-[10px] px-1.5 py-0.5 ${meta.bg} ${meta.text} border ${meta.border} rounded font-bold`}>{emoji} {label}</span>
                    <span className="text-[10px] text-gray-600">{desc}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* PRIMARY FILTER */}
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
                className={`px-4 py-2.5 rounded-xl text-sm font-bold border transition-all text-left ${minConsec===val ? 'bg-white text-gray-900 border-white' : 'bg-gray-900/40 text-gray-400 border-gray-800 hover:text-white'}`}>
                <div>{label}</div>
                <div className="text-xs font-normal mt-0.5 text-gray-600">{sub}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Summary boxes */}
        <div className="grid grid-cols-8 gap-2 mb-5">
          {[
            { label: 'Total',        val: data?.total || 0,         color: 'text-white',        sub: 'signals' },
            { label: '🟢 Ignition',  val: s?.ignition || 0,         color: 'text-emerald-400',  sub: 'FUT confirmed' },
            { label: '🟠 Conviction',val: s?.conviction || 0,        color: 'text-orange-400',   sub: '3d+ triple' },
            { label: '🟡 Building',  val: s?.building || 0,          color: 'text-yellow-400',   sub: '2-3d consec' },
            { label: '🔵 Radar',     val: s?.radar || 0,             color: 'text-blue-400',     sub: 'early signal' },
            { label: '✅ High',      val: s?.high_consistency || 0,  color: 'text-emerald-400',  sub: '70%+ days' },
            { label: '🐂 Long',      val: s?.long_buildup || 0,      color: 'text-emerald-400',  sub: 'buildup' },
            { label: '🐻 Short',     val: s?.short_buildup || 0,     color: 'text-red-400',      sub: 'buildup' },
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
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all capitalize ${typeFilter===f ? 'bg-white text-gray-900 border-white' : 'bg-gray-900/40 text-gray-400 border-gray-800 hover:text-white'}`}>{f}</button>
          ))}
          <div className="w-px h-5 bg-gray-800 mx-1"/>
          {(['all','BULLISH','BEARISH'] as const).map(b => (
            <button key={b} onClick={() => setBiasFilter(b)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${biasFilter===b ? b==='BULLISH' ? 'bg-emerald-950 text-emerald-400 border-emerald-800' : b==='BEARISH' ? 'bg-red-950 text-red-400 border-red-800' : 'bg-white text-gray-900 border-white' : 'bg-gray-900/40 text-gray-400 border-gray-800 hover:text-white'}`}>
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
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${consisFilter===c ? c==='HIGH' ? 'bg-emerald-950 text-emerald-400 border-emerald-800' : c==='MEDIUM' ? 'bg-amber-950 text-amber-400 border-amber-800' : c==='LOW' ? 'bg-red-950 text-red-400 border-red-800' : 'bg-white text-gray-900 border-white' : 'bg-gray-900/40 text-gray-400 border-gray-800 hover:text-white'}`}>
              {c==='all'?'All Consistency':c}
            </button>
          ))}
          {!writerView && <>
            <div className="w-px h-5 bg-gray-800 mx-1"/>
            {[
              { val: 'all', label: 'All Levels' },
              { val: 'IGNITION', label: '🟢 Ignition' },
              { val: 'CONVICTION', label: '🟠 Conviction' },
              { val: 'BUILDING', label: '🟡 Building' },
              { val: 'RADAR', label: '🔵 Radar' },
            ].map(({ val, label }) => (
              <button key={val} onClick={() => setConvictionFilter(val)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${convictionFilter===val ? val==='IGNITION' ? 'bg-emerald-950 text-emerald-400 border-emerald-800' : val==='CONVICTION' ? 'bg-orange-950 text-orange-400 border-orange-800' : val==='BUILDING' ? 'bg-yellow-950 text-yellow-400 border-yellow-800' : val==='RADAR' ? 'bg-blue-950 text-blue-400 border-blue-800' : 'bg-white text-gray-900 border-white' : 'bg-gray-900/40 text-gray-400 border-gray-800 hover:text-white'}`}>
                {label}
              </button>
            ))}
            <div className="w-px h-5 bg-gray-800 mx-1"/>
            <button onClick={() => setAccelOnly(a => !a)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${accelOnly ? 'bg-blue-950 text-blue-400 border-blue-800' : 'bg-gray-900/40 text-gray-400 border-gray-800 hover:text-white'}`}>
              🚀 Accelerating Only
            </button>
            <button onClick={() => setHighVolOnly(v => !v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${highVolOnly ? 'bg-purple-950 text-purple-400 border-purple-800' : 'bg-gray-900/40 text-gray-400 border-gray-800 hover:text-white'}`}>
              📊 High FUT Vol
            </button>
          </>}
          <button onClick={() => { setSignalFilter('all'); setBiasFilter('all'); setConsisFilter('all'); setConvictionFilter('all'); setAccelOnly(false); setHighVolOnly(false); setTypeFilter('all') }}
            className="text-xs text-gray-600 hover:text-gray-400 transition-colors ml-1">Clear filters</button>
        </div>

        <p className="text-xs text-gray-600 mb-4">
          {results.length} signals · {minConsec > 0 ? `Active ${minConsec}d+ streak filter` : 'showing all signals'} · {writerView ? 'Writer\'s View (50%+ consistency)' : 'Trader View'} · Informational only
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
                  {tableHeaders.map((h, i) => {
                    const colKey = h === 'Volume (vs 7d avg)' ? 'vol'
                      : h === 'OI (Series)' ? 'oi'
                      : h === 'Consec' ? 'consec'
                      : h === 'Consistency' ? 'consisPC'
                      : h === 'Price (Series)' ? 'price'
                      : null
                    const isActive = sortCol === colKey
                    return (
                      <th key={h}
                        onClick={colKey ? () => handleSort(colKey) : undefined}
                        className={`text-xs font-semibold px-3 py-3.5 ${i <= 3 ? 'text-left' : 'text-right'} ${i===0?'pl-5':''} ${i===tableHeaders.length-1?'pr-5 text-left':''} ${colKey ? 'cursor-pointer hover:text-white select-none' : ''} ${isActive ? 'text-amber-400' : 'text-gray-500'}`}>
                        {h}
                        {colKey && (
                          <span className="ml-1 text-[10px]">
                            {isActive ? (sortDir === 'desc' ? '↓' : '↑') : '↕'}
                          </span>
                        )}
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => {
                  const m        = SIGNAL_META[r.signal]
                  const oiColor  = r.oi_chg_pct  > 0 ? '#10b981' : '#ef4444'
                  const cmpColor = r.cmp_chg_pct > 0 ? '#10b981' : '#ef4444'
                  const wt       = getWriterTake(r)
                  const rowBg    = r.ignition
                    ? 'bg-emerald-950/15 border-l-2 border-l-emerald-700'
                    : r.conviction_level === 'CONVICTION' && r.accelerating
                    ? 'bg-orange-950/15 border-l-2 border-l-orange-700'
                    : r.conviction_level === 'CONVICTION' ? 'bg-orange-950/10'
                    : r.accelerating ? 'bg-blue-950/8 border-l-2 border-l-blue-800'
                    : i % 2 === 0 ? '' : 'bg-gray-900/20'

                  return (
                    <React.Fragment key={r.symbol}>
                    <tr className={`border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors ${rowBg}`}>

                      {/* Symbol */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-black text-white">{r.symbol}</span>
                          <ConvictionBadge level={r.conviction_level} label={r.conviction_label} emoji={r.conviction_emoji}/>
                          {!writerView && r.accelerating && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-blue-950 text-blue-400 border border-blue-800/50 rounded">🚀 Accel</span>
                          )}
                          {r.is_index && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-cyan-950 text-cyan-400 border border-cyan-800/50 rounded">IDX</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-600 mt-0.5">₹{r.cmp.toLocaleString('en-IN')}</p>
                        {r.ignition && r.fut_signal_today && (
                          <div className="mt-0.5">
                            <p className="text-[10px] text-emerald-500">⚡ FUT: {r.fut_signal_today.replace(/_/g, ' ')}</p>
                            <p className="text-[10px] text-gray-700">positional threshold only</p>
                          </div>
                        )}
                        {r.ignition && r.ignition_score !== undefined && r.ignition_score_breakdown && (
                          <IgnitionScoreBar score={r.ignition_score} breakdown={r.ignition_score_breakdown}/>
                        )}
                      </td>

                      {writerView ? <>
                        {/* OI Structure */}
                        <td className="px-3 py-3.5">
                          <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg border ${wt.oiColor} ${wt.oiBg} ${wt.oiBorder}`}>{wt.oiType}</span>
                          <p className="text-[10px] text-gray-500 mt-1">{r.composition_short || '—'}</p>
                        </td>
                        {/* Direction Held */}
                        <td className="px-3 py-3.5 min-w-[110px]">
                          <ConsistencyBar pct={r.consistency_pct} label={r.consistency_label}/>
                          <p className="text-[10px] text-gray-600 mt-1">{r.match_days}/{r.total_days} days consistent</p>
                        </td>
                        {/* Consec */}
                        <td className="px-3 py-3.5">
                          <p className={`text-lg font-black ${r.consec_days >= 5 ? 'text-emerald-400' : r.consec_days >= 3 ? 'text-amber-400' : r.consec_days >= 1 ? 'text-white' : 'text-orange-400'}`}>
                            {r.consec_days > 0 ? `${r.consec_days}d` : '—'}
                          </p>
                          <p className="text-[10px] text-gray-600">{r.consec_days > 0 ? 'in a row' : 'broke last day'}</p>
                        </td>
                        {/* OI Series */}
                        <td className="px-3 py-3.5 text-right">
                          <p className={`text-sm font-black ${r.oi_chg_pct > 0 ? 'text-emerald-400' : 'text-red-400'}`}>{r.oi_chg_pct > 0 ? '+' : ''}{r.oi_chg_pct}%</p>
                          <p className="text-[10px] text-gray-600">total OI series</p>
                        </td>
                        {/* CE/PE Split */}
                        <td className="px-3 py-3.5 text-right">
                          {r.ce_pct_of_total !== undefined && r.pe_pct_of_total !== undefined ? (<>
                            <div className="flex items-center gap-1 justify-end mb-1">
                              <span className="text-[10px] text-red-400 font-bold">CE {r.ce_pct_of_total}%</span>
                              <span className="text-[10px] text-gray-600">/</span>
                              <span className="text-[10px] text-emerald-400 font-bold">PE {r.pe_pct_of_total}%</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-gray-800 overflow-hidden flex w-20 ml-auto">
                              <div className="bg-red-500/70 h-full" style={{width:`${r.ce_pct_of_total}%`}}/>
                              <div className="bg-emerald-500/70 h-full" style={{width:`${r.pe_pct_of_total}%`}}/>
                            </div>
                            {r.pcr_series !== undefined && <p className="text-[10px] text-gray-600 mt-1">PCR {r.pcr_series.toFixed(2)}</p>}
                          </>) : <span className="text-gray-700 text-xs">—</span>}
                        </td>
                        {/* Price Series */}
                        <td className="px-3 py-3.5 text-right">
                          <p className={`text-sm font-black ${r.cmp_chg_pct > 0 ? 'text-emerald-400' : 'text-red-400'}`}>{r.cmp_chg_pct > 0 ? '+' : ''}{r.cmp_chg_pct}%</p>
                          <p className="text-[10px] text-gray-600">₹{r.cmp_series[0]?.toFixed(0)} → ₹{r.cmp.toFixed(0)}</p>
                        </td>
                        {/* Writer's Take */}
                        <td className="px-5 py-3.5">
                          <div className={`rounded-lg border px-3 py-2 ${wt.oiBg} ${wt.oiBorder}`}>
                            <p className={`text-[10px] font-bold ${wt.safetyColor} mb-1`}>Direction Safety: {wt.safetyLabel}</p>
                            <div className={`text-[10px] font-bold px-1.5 py-0.5 rounded mb-1.5 ${wt.opportunityColor} ${wt.opportunityBg}`}>{wt.opportunityLabel}</div>
                            <p className="text-[10px] text-gray-400 mb-1">{wt.structureNote}</p>
                            <p className="text-[10px] text-gray-500">
                              Ref strike: <span className="text-white font-bold">{wt.refStrike.toLocaleString()} {wt.refSide}</span>
                              <span className="text-gray-600"> · ~3-5% OTM</span>
                            </p>
                            {wt.cautionNote && <p className="text-[10px] text-amber-400 mt-1">{wt.cautionNote}</p>}
                            {r.ce_wall && r.pe_wall && (
                              <div className="mt-1.5 pt-1.5 border-t border-gray-700/50">
                                <p className="text-[10px] text-gray-500 mb-0.5">OI walls observed:</p>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-[10px] font-bold text-red-400">📈 CE ₹{r.ce_wall.toLocaleString()} · {r.ce_wall_oi_L}L</span>
                                  <span className="text-[10px] font-bold text-emerald-400">📉 PE ₹{r.pe_wall.toLocaleString()} · {r.pe_wall_oi_L}L</span>
                                </div>
                                <p className="text-[10px] text-gray-600 mt-0.5">Range: ₹{r.trade_range} · {r.trade_range_pct}% · {r.range_label}</p>
                              </div>
                            )}
                            {/* OI Map button in Writer's View */}
                            <button
                              onClick={() => fetchWalls(r.symbol)}
                              className={`mt-2 text-[10px] font-bold px-2 py-0.5 rounded border transition-all ${
                                expandedSymbol === r.symbol ? 'bg-cyan-950 text-cyan-300 border-cyan-700' : 'bg-gray-900/40 text-cyan-400 border-cyan-800/40 hover:border-cyan-600'
                              }`}>
                              {wallsLoading === r.symbol ? '⏳' : expandedSymbol === r.symbol ? '▲ Close' : '📊 OI Map'}
                            </button>
                            <p className="text-[10px] text-gray-700 mt-1">Verify OI wall before use</p>
                          </div>
                        </td>

                      </> : <>
                        {/* Trader View — Signal column with OI Map button */}
                        <td className="px-3 py-3.5">
                          <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg border ${m.color} ${m.bg} ${m.border}`}>
                            {m.icon} {m.label}
                          </span>
                          {r.ce_wall && r.pe_wall && (
                            <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                              <span className="text-[10px] font-bold text-red-400 bg-red-950/30 border border-red-800/30 px-1.5 py-0.5 rounded">📈 ₹{r.ce_wall.toLocaleString()}</span>
                              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/30 border border-emerald-800/30 px-1.5 py-0.5 rounded">📉 ₹{r.pe_wall.toLocaleString()}</span>
                              {r.range_label && <span className="text-[10px] text-gray-600">{r.trade_range_pct}%</span>}
                            </div>
                          )}
                          {/* OI Map button in Trader View */}
                          <button
                            onClick={() => fetchWalls(r.symbol)}
                            className={`mt-1.5 text-[10px] font-bold px-2 py-0.5 rounded border transition-all ${
                              expandedSymbol === r.symbol ? 'bg-cyan-950 text-cyan-300 border-cyan-700' : 'bg-gray-900/40 text-cyan-400 border-cyan-800/40 hover:border-cyan-600'
                            }`}>
                            {wallsLoading === r.symbol ? '⏳' : expandedSymbol === r.symbol ? '▲ Close' : '📊 OI Map'}
                          </button>
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
                          <p className="text-[10px] text-gray-600">{r.consec_days > 0 ? 'in a row' : 'broke last day'}</p>
                        </td>
                        {/* OI */}
                        <td className="px-3 py-3.5 text-right">
                          <p className={`text-sm font-black ${r.oi_chg_pct > 0 ? 'text-emerald-400' : 'text-red-400'}`}>{r.oi_chg_pct > 0 ? '+' : ''}{r.oi_chg_pct}%</p>
                          {r.accelerating && <p className="text-[10px] text-blue-400">🚀 {r.oi_first_half_chg}% → {r.oi_second_half_chg}%</p>}
                        </td>
                        {/* Volume */}
                        <td className="px-3 py-3.5 text-right">
                          <p className={`text-sm font-black ${r.vol_chg_pct > 0 ? 'text-emerald-400' : 'text-red-400'}`}>{r.vol_chg_pct > 0 ? '+' : ''}{r.vol_chg_pct}%</p>
                          <p className="text-[10px] text-gray-600">vs 7d avg ({r.vol_avg_7d}L)</p>
                          {r.conviction_level === 'CONVICTION' && <p className="text-[10px] text-orange-400">⚡ {r.vol_consec}d consec</p>}
                        </td>
                        {/* Price */}
                        <td className="px-3 py-3.5 text-right">
                          <p className={`text-sm font-black ${r.cmp_chg_pct > 0 ? 'text-emerald-400' : 'text-red-400'}`}>{r.cmp_chg_pct > 0 ? '+' : ''}{r.cmp_chg_pct}%</p>
                          <p className="text-[10px] text-gray-600">₹{r.cmp_series[0]?.toFixed(0)} → ₹{r.cmp.toFixed(0)}</p>
                        </td>
                        {/* OI Sparkline */}
                        <td className="px-3 py-3.5 text-right"><div className="flex justify-end"><Sparkline data={r.oi_series} color={oiColor}/></div></td>
                        {/* Price Sparkline */}
                        <td className="px-3 py-3.5 text-right"><div className="flex justify-end"><Sparkline data={r.cmp_series} color={cmpColor}/></div></td>
                        {/* Deep Dive */}
                        <td className="px-5 py-3.5">
                          <div className="flex flex-col gap-1">
                            {r.has_uoa ? (
                              <a href={`/uoa?symbol=${r.symbol}`} className="text-xs text-blue-400 hover:text-blue-300 font-bold">🐋 UOA ✅ →</a>
                            ) : (
                              <span className="text-xs text-gray-700">🐋 UOA —</span>
                            )}
                            <a href={`/jungle?symbol=${r.symbol}`} className="text-xs text-amber-400 hover:text-amber-300">🌿 Jungle →</a>
                          </div>
                        </td>
                      </>}
                    </tr>

                    {/* OI Map expandable panel */}
                    {expandedSymbol === r.symbol && wallsData[r.symbol] && (
                      <OIMapPanel symbol={r.symbol} wallsData={wallsData[r.symbol]} />
                    )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 border border-gray-800/50 rounded-2xl">
            <div className="w-16 h-16 rounded-2xl bg-gray-800 border border-gray-700 flex items-center justify-center mb-4 text-3xl">📈</div>
            <h3 className="text-lg font-bold text-gray-400 mb-2">No signals match</h3>
            <p className="text-sm text-gray-600 mb-3">{minConsec > 0 ? `No stocks had ${minConsec}+ consecutive days of this signal.` : 'Try changing the filters above.'}</p>
            <button onClick={() => { handleConsec(0); setSignalFilter('all'); setBiasFilter('all'); setConsisFilter('all'); setConvictionFilter('all'); setAccelOnly(false); setHighVolOnly(false) }}
              className="text-xs text-emerald-400 hover:text-emerald-300">Reset all filters</button>
          </div>
        )}

        <div className="mt-8 bg-gray-900/20 border border-gray-800/40 rounded-xl p-4">
          <p className="text-xs text-gray-600 leading-relaxed">
            <span className="text-gray-400 font-semibold">Disclaimer:</span> Positional Radar shows observed OI, volume and price trends from NSE publicly available data.
            All signals and reference strikes are informational only — not investment advice. Always confirm with UOA and live OI walls before making any decisions.
            GreekNova is not SEBI-registered. Trade at your own risk.
          </p>
        </div>
      </div>
    </div>
  )
}
