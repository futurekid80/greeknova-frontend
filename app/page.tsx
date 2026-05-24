'use client'
import Navbar from '@/components/Navbar'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { TrendingUp, TrendingDown, Minus, RefreshCw, Clock, Database, Search, X, Zap, Eye, Moon } from 'lucide-react'
import { useAutoRefresh } from "@/lib/useAutoRefresh"

const API = 'https://greeknova-backend-production.up.railway.app'

const ALL_SYMBOLS = [
  'NIFTY','BANKNIFTY','FINNIFTY',
  'RELIANCE','TCS','HDFCBANK','INFY','ICICIBANK','HINDUNILVR','ITC','SBIN','BHARTIARTL',
  'KOTAKBANK','LT','AXISBANK','ASIANPAINT','MARUTI','TITAN','SUNPHARMA','ULTRACEMCO',
  'BAJFINANCE','WIPRO','HCLTECH','TATACONSUM','TATASTEEL','ADANIENT','POWERGRID','NTPC',
  'ONGC','JSWSTEEL','COALINDIA','BAJAJFINSV','TECHM','APOLLOHOSP','BAJAJ-AUTO','BPCL',
  'BRITANNIA','CIPLA','DRREDDY','EICHERMOT','GRASIM','HEROMOTOCO','HINDALCO','HDFCLIFE',
  'INDUSINDBK','JIOFIN','M&M','NESTLEIND','SBILIFE','SHRIRAMFIN','TRENT','ADANIPORTS',
  'BANKBARODA','BEL','CANBK','CHOLAFIN','DLF','GAIL','HAVELLS','HAL','INDIGO','PFC',
  'RECLTD','SAIL','TATAPOWER','VEDL',
]

interface OIRecord { symbol:string; strike:number; option_type:string; oi:number; volume:number; last_price:number; timestamp:string; expiry?:string }
interface IndexAnalysis { symbol:string; pcr:number; totalCEOI:number; totalPEOI:number; maxPain:number; posture:'BULLISH'|'BEARISH'|'NEUTRAL'; postureStrength:number; topCEStrike:number; topPEStrike:number }
interface CPRRow { symbol:string; tc:number; bc:number; pivot:number; width_pct:number; width_label:string; width_color:string; width_emoji:string; cpr_trend:string; is_virgin:boolean; cpr_position:string; position_label:string; cmp:number; last_cmp?:number }
interface PulseStock { symbol:string; cmp:number; oi_chg_pct:number; price_chg_pct:number; signal:string; label:string; confluence?:boolean; width_pct?:number; width_emoji?:string; cpr_position?:string; has_oi_signal?:boolean }

function fmtOI(n: number) {
  const abs = Math.abs(n)
  if (abs >= 10000000) return `${(n/10000000).toFixed(2)}Cr`
  if (abs >= 100000) return `${(n/100000).toFixed(1)}L`
  return n.toLocaleString()
}

function analyzeIndex(data: OIRecord[], symbol: string, cmp: number = 0): IndexAnalysis | null {
  const allRows = data.filter(d => d.symbol === symbol)
  if (!allRows.length) return null
  const expiries = [...new Set(allRows.map(d => d.expiry).filter(Boolean))].sort() as string[]
  const nearestExpiry = expiries[0]
  const rows = nearestExpiry ? allRows.filter(d => d.expiry === nearestExpiry) : allRows
  const ce = rows.filter(d => d.option_type === 'CE')
  const pe = rows.filter(d => d.option_type === 'PE')
  const strikes_sorted = [...new Set(rows.map(d => d.strike))].sort((a, b) => a - b)
  let totalCEOI: number, totalPEOI: number
  if (cmp > 0 && strikes_sorted.length > 0) {
    const atmStrike = strikes_sorted.reduce((a, b) => Math.abs(b - cmp) < Math.abs(a - cmp) ? b : a)
    const atmIdx = strikes_sorted.indexOf(atmStrike)
    const pcrStrikeSet = new Set(strikes_sorted.slice(Math.max(0, atmIdx - 10), atmIdx + 11))
    totalCEOI = ce.filter(d => pcrStrikeSet.has(d.strike)).reduce((s, d) => s + d.oi, 0)
    totalPEOI = pe.filter(d => pcrStrikeSet.has(d.strike)).reduce((s, d) => s + d.oi, 0)
  } else {
    totalCEOI = ce.reduce((s, d) => s + d.oi, 0)
    totalPEOI = pe.reduce((s, d) => s + d.oi, 0)
  }
  const pcr = totalCEOI > 0 ? totalPEOI / totalCEOI : 0
  const allStrikes = strikes_sorted
  let maxPain = allStrikes[0] || 0, minLoss = Infinity
  for (const s of allStrikes) {
    let loss = 0
    ce.forEach(r => { if (s > r.strike) loss += (s - r.strike) * r.oi })
    pe.forEach(r => { if (s < r.strike) loss += (r.strike - s) * r.oi })
    if (loss < minLoss) { minLoss = loss; maxPain = s }
  }
  const topCE = [...ce].sort((a, b) => b.oi - a.oi)[0]
  const topPE = [...pe].sort((a, b) => b.oi - a.oi)[0]
  let posture: 'BULLISH'|'BEARISH'|'NEUTRAL' = 'NEUTRAL', postureStrength = 50
  if (pcr > 1.2) { posture = 'BULLISH'; postureStrength = Math.min(95, 55 + (pcr - 1.2) * 25) }
  else if (pcr < 0.8) { posture = 'BEARISH'; postureStrength = Math.min(95, 55 + (0.8 - pcr) * 40) }
  return { symbol, pcr: Math.round(pcr * 100) / 100, totalCEOI, totalPEOI, maxPain, posture, postureStrength: Math.round(postureStrength), topCEStrike: topCE?.strike || 0, topPEStrike: topPE?.strike || 0 }
}

// ── War Zone tag ──────────────────────────────────────────────────────────────
function getWarZoneTag(stock: PulseStock): { label: string; icon: React.ReactNode; color: string; bg: string; border: string } {
  const isNarrowCPR = (stock.width_pct || 1) < 0.3
  const hasSignal = stock.has_oi_signal
  const isAbove = stock.cpr_position === 'ABOVE_CPR'
  const isBelow = stock.cpr_position === 'BELOW_CPR'

  if (isNarrowCPR && hasSignal) return { label: 'War Zone', icon: <Zap size={10} />, color: 'text-orange-300', bg: 'bg-orange-950/50', border: 'border-orange-700/60' }
  if (isNarrowCPR) return { label: 'Watch', icon: <Eye size={10} />, color: 'text-amber-400', bg: 'bg-amber-950/30', border: 'border-amber-800/40' }
  return { label: 'Quiet', icon: <Moon size={10} />, color: 'text-gray-500', bg: 'bg-gray-900/20', border: 'border-gray-800/30' }
}

function ExpiryCountdown() {
  const [timeLeft, setTimeLeft] = useState('')
  const [daysLeft, setDaysLeft] = useState(0)
  const [label, setLabel] = useState('')
  useEffect(() => {
    function calc() {
      const now = new Date()
      const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
      const day = ist.getDay()
      let daysToExpiry = (2 - day + 7) % 7
      if (daysToExpiry === 0) { const e = new Date(ist); e.setHours(15,30,0,0); if (ist >= e) daysToExpiry = 7 }
      const expiry = new Date(ist); expiry.setDate(ist.getDate() + daysToExpiry); expiry.setHours(15,30,0,0)
      const diff = expiry.getTime() - ist.getTime()
      if (diff <= 0) { setTimeLeft('EXPIRED'); return }
      const days = Math.floor(diff/(1000*60*60*24)), hours = Math.floor((diff%(1000*60*60*24))/(1000*60*60)), mins = Math.floor((diff%(1000*60*60))/(1000*60)), secs = Math.floor((diff%(1000*60))/1000)
      setDaysLeft(days)
      if (days === 0) { setLabel('EXPIRY TODAY'); setTimeLeft(`${hours.toString().padStart(2,'0')}:${mins.toString().padStart(2,'0')}:${secs.toString().padStart(2,'0')}`) }
      else if (days === 1) { setLabel('EXPIRY TOMORROW'); setTimeLeft(`${hours}h ${mins}m`) }
      else { setLabel(`EXPIRY IN ${days}D`); setTimeLeft(`${days}d ${hours}h`) }
    }
    calc(); const t = setInterval(calc, 1000); return () => clearInterval(t)
  }, [])
  const isToday = daysLeft === 0, isTomorrow = daysLeft === 1
  return (
    <div className={`flex-shrink-0 flex items-center gap-2 px-4 h-full border-l ml-auto ${isToday ? 'border-red-800/50 bg-red-950/30' : isTomorrow ? 'border-orange-800/50 bg-orange-950/20' : 'border-gray-800/50'}`}>
      <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${isToday ? 'bg-red-400' : isTomorrow ? 'bg-orange-400' : 'bg-gray-600'}`} />
      <div>
        <p className={`text-xs font-black ${isToday ? 'text-red-400' : isTomorrow ? 'text-orange-400' : 'text-gray-500'}`}>{label}</p>
        <p className={`text-sm font-black font-mono ${isToday ? 'text-red-300' : isTomorrow ? 'text-orange-300' : 'text-gray-400'}`}>{timeLeft}</p>
      </div>
    </div>
  )
}

// ── Index Card with CPR context ───────────────────────────────────────────────
function IndexCard({ a, cpr, cmp }: { a: IndexAnalysis; cpr?: CPRRow; cmp?: number }) {
  const bull = a.posture === 'BULLISH', bear = a.posture === 'BEARISH'
  const ceP = Math.round((a.totalCEOI / (a.totalCEOI + a.totalPEOI)) * 100)

  const cprTrendLabel: Record<string, { label: string; color: string }> = {
    ASCENDING:  { label: '↑ Ascending', color: 'text-emerald-400' },
    DESCENDING: { label: '↓ Descending', color: 'text-red-400' },
    SIDEWAYS:   { label: '→ Sideways', color: 'text-gray-400' },
    UNKNOWN:    { label: '— Unknown', color: 'text-gray-600' },
  }
  const cprPosLabel: Record<string, { label: string; color: string }> = {
    ABOVE_CPR:  { label: '↑ Above CPR', color: 'text-emerald-400' },
    BELOW_CPR:  { label: '↓ Below CPR', color: 'text-red-400' },
    INSIDE_CPR: { label: '⟷ Inside CPR', color: 'text-amber-400' },
  }
  const trendInfo = cprTrendLabel[cpr?.cpr_trend || 'UNKNOWN']
  const posInfo = cprPosLabel[cpr?.cpr_position || '']

  return (
    <div className={`relative rounded-2xl border bg-gray-900/40 p-5 overflow-hidden hover:bg-gray-900/60 transition-all duration-300 ${bull ? 'border-emerald-800/40' : bear ? 'border-red-800/40' : 'border-gray-800'}`}>
      <div className={`absolute -top-8 -right-8 w-32 h-32 rounded-full blur-2xl opacity-10 ${bull ? 'bg-emerald-500' : bear ? 'bg-red-500' : 'bg-amber-500'}`} />
      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-white tracking-wide">{a.symbol}</h3>
            {cmp && <p className="text-lg font-black text-amber-400">₹{cmp.toLocaleString()}</p>}
          </div>
          <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${bull ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800/60' : bear ? 'bg-red-950/80 text-red-400 border-red-800/60' : 'bg-amber-950/80 text-amber-400 border-amber-800/60'}`}>
            {bull ? <TrendingUp size={11}/> : bear ? <TrendingDown size={11}/> : <Minus size={11}/>}{a.posture}
          </span>
        </div>

        {/* OI Metrics */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[
            { label: 'PCR', value: a.pcr.toFixed(2), colored: true },
            { label: 'Max Pain', value: a.maxPain.toLocaleString(), colored: false },
            { label: 'Conviction', value: `${a.postureStrength}%`, colored: false },
          ].map(m => (
            <div key={m.label} className="bg-gray-800/50 rounded-xl p-2.5 border border-gray-700/40">
              <p className="text-xs text-gray-500 mb-1">{m.label}</p>
              <p className={`text-base font-bold ${m.colored ? (bull ? 'text-emerald-400' : bear ? 'text-red-400' : 'text-amber-400') : 'text-white'}`}>{m.value}</p>
            </div>
          ))}
        </div>

        {/* OI split bar */}
        <div className="mb-3">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-red-400 font-medium">CE {ceP}%</span>
            <span className="text-emerald-400 font-medium">PE {100-ceP}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-gray-800 overflow-hidden flex">
            <div className="bg-red-500/80 h-full rounded-l-full transition-all duration-700" style={{ width: `${ceP}%` }}/>
            <div className="bg-emerald-500/80 h-full rounded-r-full transition-all duration-700" style={{ width: `${100-ceP}%` }}/>
          </div>
        </div>

        {/* CE/PE walls */}
        <div className="flex gap-2 mb-3">
          <div className="flex-1 flex items-center justify-between bg-red-950/20 border border-red-900/30 rounded-lg px-3 py-1.5">
            <span className="text-xs text-gray-500">CE Wall</span>
            <span className="text-xs font-bold text-red-400">{a.topCEStrike.toLocaleString()}</span>
          </div>
          <div className="flex-1 flex items-center justify-between bg-emerald-950/20 border border-emerald-900/30 rounded-lg px-3 py-1.5">
            <span className="text-xs text-gray-500">PE Wall</span>
            <span className="text-xs font-bold text-emerald-400">{a.topPEStrike.toLocaleString()}</span>
          </div>
        </div>

        {/* CPR context — one line only */}
        {cpr && (
          <div className="flex items-center justify-between bg-gray-800/30 border border-gray-700/30 rounded-lg px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">CPR</span>
              {cpr.is_virgin && <span className="text-xs text-blue-400 font-bold">🔵 Virgin</span>}
              {posInfo && <span className={`text-xs font-bold ${posInfo.color}`}>{posInfo.label}</span>}
            </div>
            {trendInfo && <span className={`text-xs font-semibold ${trendInfo.color}`}>{trendInfo.label}</span>}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Market Pulse Stock Feed ───────────────────────────────────────────────────
function MarketPulseFeed({ stocks, cprData }: { stocks: PulseStock[]; cprData: CPRRow[] }) {
  const [filter, setFilter] = useState<'all'|'warzone'|'watch'|'indices'|'stocks'>('all')
  const [search, setSearch] = useState('')

  const cprMap = Object.fromEntries(cprData.map(c => [c.symbol, c]))

  const enriched = stocks.map(s => {
    const cpr = cprMap[s.symbol]
    return {
      ...s,
      width_pct: cpr?.width_pct,
      width_emoji: cpr?.width_emoji,
      cpr_position: cpr?.cpr_position,
      has_oi_signal: cpr?.has_oi_signal || false,
      confluence: cpr?.confluence || false,
    }
  })

  const filtered = enriched
    .filter(s => {
      if (search) return s.symbol.includes(search.toUpperCase())
      if (filter === 'warzone') return (s.width_pct || 1) < 0.3 && s.has_oi_signal
      if (filter === 'watch') return (s.width_pct || 1) < 0.3
      if (filter === 'indices') return ['NIFTY','BANKNIFTY','FINNIFTY'].includes(s.symbol)
      if (filter === 'stocks') return !['NIFTY','BANKNIFTY','FINNIFTY'].includes(s.symbol)
      return true
    })
    .sort((a, b) => {
      // War zone first, then by OI change magnitude
      const aWar = (a.width_pct || 1) < 0.3 && a.has_oi_signal ? 0 : (a.width_pct || 1) < 0.3 ? 1 : 2
      const bWar = (b.width_pct || 1) < 0.3 && b.has_oi_signal ? 0 : (b.width_pct || 1) < 0.3 ? 1 : 2
      if (aWar !== bWar) return aWar - bWar
      return Math.abs(b.oi_chg_pct || 0) - Math.abs(a.oi_chg_pct || 0)
    })

  const warZoneCount = enriched.filter(s => (s.width_pct || 1) < 0.3 && s.has_oi_signal).length
  const watchCount = enriched.filter(s => (s.width_pct || 1) < 0.3).length

  const signalColors: Record<string, string> = {
    LONG_BUILDUP:   'text-emerald-400',
    SHORT_BUILDUP:  'text-red-400',
    SHORT_COVERING: 'text-cyan-400',
    LONG_UNWINDING: 'text-amber-400',
    PUT_WRITING:    'text-emerald-400',
    CALL_WRITING:   'text-red-400',
    NEUTRAL:        'text-gray-500',
  }

  return (
    <div>
      {/* Filter bar */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {[
          { key: 'all', label: `All (${enriched.length})` },
          { key: 'warzone', label: `🔥 War Zone (${warZoneCount})` },
          { key: 'watch', label: `👀 Watch (${watchCount})` },
          { key: 'indices', label: 'Indices' },
          { key: 'stocks', label: 'Stocks' },
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key as any)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-all font-medium ${filter === f.key ? 'bg-white text-gray-900 border-white' : 'bg-gray-900/40 text-gray-400 border-gray-800 hover:text-white'}`}>
            {f.label}
          </button>
        ))}
        <div className="relative ml-auto">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500"/>
          <input value={search} onChange={e => setSearch(e.target.value.toUpperCase())}
            placeholder="Search..."
            className="bg-gray-900 border border-gray-700 text-white text-xs rounded-lg pl-7 pr-3 py-1.5 w-28 focus:outline-none focus:border-emerald-500"/>
          {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500"><X size={10}/></button>}
        </div>
      </div>

      {/* Table header */}
      <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs text-gray-600 font-medium border-b border-gray-800/50 mb-1">
        <div className="col-span-2">Symbol</div>
        <div className="col-span-2 text-right">CMP</div>
        <div className="col-span-2 text-right">OI Chg</div>
        <div className="col-span-2">Signal</div>
        <div className="col-span-2">CPR</div>
        <div className="col-span-2 text-right">Zone</div>
      </div>

      {/* Stock rows */}
      <div className="space-y-0.5">
        {filtered.length === 0 ? (
          <div className="text-center py-10 text-gray-600 text-sm">No stocks match current filter</div>
        ) : filtered.map(s => {
          const tag = getWarZoneTag(s)
          const isIndex = ['NIFTY','BANKNIFTY','FINNIFTY'].includes(s.symbol)
          const cprPos = s.cpr_position
          const cprPosColor = cprPos === 'ABOVE_CPR' ? 'text-emerald-400' : cprPos === 'BELOW_CPR' ? 'text-red-400' : cprPos === 'INSIDE_CPR' ? 'text-amber-400' : 'text-gray-600'
          const cprPosShort = cprPos === 'ABOVE_CPR' ? '↑ Above' : cprPos === 'BELOW_CPR' ? '↓ Below' : cprPos === 'INSIDE_CPR' ? '⟷ Inside' : '—'

          return (
            <div key={s.symbol}
              className={`grid grid-cols-12 gap-2 px-3 py-2.5 rounded-lg items-center hover:bg-gray-800/30 transition-colors text-sm ${isIndex ? 'bg-gray-900/20' : ''}`}>
              {/* Symbol */}
              <div className="col-span-2 flex items-center gap-1.5">
                <span className="font-bold text-white text-xs">{s.symbol}</span>
                {isIndex && <span className="text-xs text-gray-600 bg-gray-800 px-1 rounded text-[10px]">IDX</span>}
              </div>

              {/* CMP */}
              <div className="col-span-2 text-right">
                <span className="text-xs font-bold text-amber-400">
                  {s.cmp ? `₹${s.cmp.toLocaleString()}` : '—'}
                </span>
                {s.price_chg_pct !== undefined && (
                  <div className={`text-[10px] ${s.price_chg_pct >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    {s.price_chg_pct >= 0 ? '+' : ''}{s.price_chg_pct?.toFixed(1)}%
                  </div>
                )}
              </div>

              {/* OI Change */}
              <div className="col-span-2 text-right">
                {s.oi_chg_pct !== undefined ? (
                  <span className={`text-xs font-bold ${s.oi_chg_pct > 0 ? 'text-emerald-400' : s.oi_chg_pct < 0 ? 'text-red-400' : 'text-gray-500'}`}>
                    {s.oi_chg_pct > 0 ? '+' : ''}{s.oi_chg_pct?.toFixed(1)}%
                  </span>
                ) : <span className="text-gray-700 text-xs">—</span>}
              </div>

              {/* Signal */}
              <div className="col-span-2">
                <span className={`text-xs font-medium ${signalColors[s.signal] || 'text-gray-500'}`}>
                  {s.label || '—'}
                </span>
              </div>

              {/* CPR position */}
              <div className="col-span-2">
                <div className="flex items-center gap-1">
                  {s.width_emoji && <span className="text-xs">{s.width_emoji}</span>}
                  <span className={`text-xs font-medium ${cprPosColor}`}>{cprPosShort}</span>
                </div>
              </div>

              {/* War Zone tag */}
              <div className="col-span-2 flex justify-end">
                <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${tag.color} ${tag.bg} ${tag.border}`}>
                  {tag.icon}{tag.label}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Stock Command Centre (unchanged, kept for search) ─────────────────────────
function StockCommandCentre({ symbol, onClose }: { symbol: string; onClose: () => void }) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [mpRes, oiRes, uoaRes] = await Promise.all([
          fetch(`${API}/max-pain`),
          fetch(`${API}/oi-history/${symbol}`),
          fetch(`${API}/uoa`),
        ])
        const [mp, oi, uoa] = await Promise.all([mpRes.json(), oiRes.json(), uoaRes.json()])
        const mpItem = mp.symbols?.find((i: any) => i.symbol === symbol)
        const uoaItems = uoa.signals?.filter((i: any) => i.symbol === symbol) || []
        const rows = oi.rows || []
        const totalCE = rows.reduce((s: number, r: any) => s + (r.ce_a || 0), 0)
        const totalPE = rows.reduce((s: number, r: any) => s + (r.pe_a || 0), 0)
        const pcr = totalCE > 0 ? Math.round((totalPE/totalCE)*100)/100 : null
        const topCEStrikes = [...rows].sort((a: any, b: any) => b.ce_a - a.ce_a).slice(0, 5)
        const topPEStrikes = [...rows].sort((a: any, b: any) => b.pe_a - a.pe_a).slice(0, 5)
        setData({ mpItem, oi, pcr, topCEStrikes, topPEStrikes, uoaItems, rows })
      } catch (e) { console.error(e) }
      setLoading(false)
    }
    load()
  }, [symbol])

  return (
    <div className="bg-gray-900/60 border border-gray-700 rounded-2xl mb-6 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800 bg-gray-900/80">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-black text-white">{symbol}</h2>
          <a href={`/stock/${symbol}`} className="text-xs text-emerald-400 hover:text-emerald-300 border border-emerald-800/50 px-2 py-1 rounded-lg">Full Page →</a>
        </div>
        <button onClick={onClose} className="text-gray-600 hover:text-white p-1"><X size={16}/></button>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw size={20} className="text-gray-600 animate-spin"/>
          <span className="ml-3 text-gray-500 text-sm">Loading…</span>
        </div>
      ) : (
        <div className="p-5 grid grid-cols-2 gap-4">
          {/* Max Pain */}
          <div className="bg-gray-900/40 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-2">🎯 Max Pain</p>
            {data?.mpItem ? (
              <>
                <p className="text-2xl font-black text-white">₹{data.mpItem.max_pain?.toLocaleString()}</p>
                <p className={`text-xs mt-1 font-bold ${data.mpItem.direction === 'BELOW' ? 'text-emerald-400' : 'text-orange-400'}`}>
                  CMP {data.mpItem.direction === 'ABOVE' ? `↑ ${data.mpItem.dist_from_mp?.toFixed(1)}% above` : `↓ ${Math.abs(data.mpItem.dist_from_mp ?? 0).toFixed(1)}% below`} Max Pain
                </p>
              </>
            ) : <p className="text-gray-600 text-sm">No data</p>}
          </div>

          {/* PCR */}
          <div className="bg-gray-900/40 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-2">📊 PCR</p>
            <p className={`text-2xl font-black ${data?.pcr && data.pcr > 1 ? 'text-emerald-400' : 'text-red-400'}`}>{data?.pcr?.toFixed(2) ?? '—'}</p>
            <p className="text-xs text-gray-600 mt-1">{data?.pcr && data.pcr > 1 ? 'PE OI > CE OI' : 'CE OI > PE OI'}</p>
          </div>

          {/* Top CE strikes */}
          <div className="bg-gray-900/40 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-red-400 font-bold mb-2">🔴 CE Strikes</p>
            <div className="space-y-1">
              {data?.topCEStrikes?.slice(0,3).map((r: any, i: number) => (
                <div key={r.strike} className="flex justify-between text-xs">
                  <span className="text-white font-bold">{r.strike.toLocaleString()}</span>
                  <span className="text-red-400">{fmtOI(r.ce_a)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top PE strikes */}
          <div className="bg-gray-900/40 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-emerald-400 font-bold mb-2">🟢 PE Strikes</p>
            <div className="space-y-1">
              {data?.topPEStrikes?.slice(0,3).map((r: any, i: number) => (
                <div key={r.strike} className="flex justify-between text-xs">
                  <span className="text-white font-bold">{r.strike.toLocaleString()}</span>
                  <span className="text-emerald-400">{fmtOI(r.pe_a)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* UOA */}
          {data?.uoaItems?.length > 0 && (
            <div className="col-span-2 bg-yellow-950/20 border border-yellow-800/30 rounded-xl p-4">
              <p className="text-xs text-yellow-400 font-bold mb-2">🐋 Unusual Options Activity</p>
              <div className="space-y-1">
                {data.uoaItems.slice(0,3).map((u: any, i: number) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="text-white">{u.tradingsymbol} · {u.signal_desc}</span>
                    <span className="text-yellow-400">Score {u.score}/5</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function MarketPulse() {
  const [analyses, setAnalyses]       = useState<IndexAnalysis[]>([])
  const [cmps, setCmps]               = useState<Record<string, number>>({})
  const [cprData, setCprData]         = useState<CPRRow[]>([])
  const [pulseStocks, setPulseStocks] = useState<PulseStock[]>([])
  const [breadth, setBreadth]         = useState({ bullish: 0, bearish: 0, neutral: 0, total: 0 })
  const [loading, setLoading]         = useState(true)
  const [lastUpdate, setLastUpdate]   = useState('')
  const [searchedSymbol, setSearchedSymbol] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) window.location.href = '/login'
    }
    checkAuth()
  }, [])

  async function fetchData() {
    setLoading(true)
    try {
      // ── Parallel fetch: OI snapshot + CPR + OI Pulse ─────────────────────
      const [cprRes, pulseRes] = await Promise.all([
        fetch(`${API}/cpr-scanner`),
        fetch(`${API}/oi-pulse`),
      ])
      const [cprJson, pulseJson] = await Promise.all([cprRes.json(), pulseRes.json()])

      // CPR data
      const cprRows: CPRRow[] = cprJson?.data || []
      setCprData(cprRows)

      // OI Pulse stocks
      const pulseItems = pulseJson?.items || []
      const cprMap = Object.fromEntries(cprRows.map((c: CPRRow) => [c.symbol, c]))

      const enrichedPulse: PulseStock[] = pulseItems.map((p: any) => ({
        symbol:       p.symbol,
        cmp:          p.ltp || p.cmp || 0,
        oi_chg_pct:   p.oi_chg_pct || 0,
        price_chg_pct: p.price_chg_pct || 0,
        signal:       p.signal || 'NEUTRAL',
        label:        p.label || '—',
        has_oi_signal: (cprMap[p.symbol] as CPRRow)?.has_oi_signal || false,
        width_pct:    (cprMap[p.symbol] as CPRRow)?.width_pct,
        width_emoji:  (cprMap[p.symbol] as CPRRow)?.width_emoji,
        cpr_position: (cprMap[p.symbol] as CPRRow)?.cpr_position,
        confluence:   (cprMap[p.symbol] as CPRRow)?.confluence || false,
      }))
      setPulseStocks(enrichedPulse)

      // Breadth
      let bull = 0, bear = 0, neut = 0
      pulseItems.forEach((s: any) => {
        if (s.price_chg_pct > 0 && s.oi_chg_pct > 0) bull++
        else if (s.price_chg_pct < 0 && s.oi_chg_pct > 0) bear++
        else neut++
      })
      setBreadth({ bullish: bull, bearish: bear, neutral: neut, total: pulseItems.length })

      // ── OI Snapshots for index cards ─────────────────────────────────────
      const { data: latest } = await supabase
        .from('oi_snapshots').select('timestamp').eq('symbol','NIFTY')
        .gte('timestamp', new Date(Date.now()-2*24*60*60*1000).toISOString().slice(0,10)+'T00:00:00+00:00')
        .order('timestamp',{ascending:false}).limit(1)

      if (latest?.length) {
        const ts = latest[0].timestamp
        setLastUpdate(new Date(ts).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short',timeZone:'UTC'}))

        const { data: cmpData } = await supabase.from('cmp_prices').select('*').order('timestamp',{ascending:false}).limit(200)
        const cmpMap: Record<string,number> = {}
        const seen = new Set<string>()
        cmpData?.forEach((c:any) => { if(!seen.has(c.symbol)){cmpMap[c.symbol]=c.cmp;seen.add(c.symbol)} })
        setCmps(cmpMap)

        let data: any[] = []
        for (let offset = 0; offset < 200000; offset += 1000) {
          const { data: batch } = await supabase.from('oi_snapshots').select('*').eq('timestamp',ts).range(offset,offset+999)
          if (!batch?.length) break
          data = [...data, ...batch]
          if (batch.length < 1000) break
        }
        const results = ['NIFTY','BANKNIFTY','FINNIFTY']
          .map(s => analyzeIndex(data as OIRecord[], s, cmpMap[s]||0))
          .filter(Boolean) as IndexAnalysis[]
        setAnalyses(results)
      }
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const { enabled: autoEnabled, toggle: toggleAuto, countdownStr } = useAutoRefresh(fetchData)
  useEffect(() => { fetchData() }, [])

  const cprMap = Object.fromEntries(cprData.map(c => [c.symbol, c]))
  const warZoneCount = pulseStocks.filter(s => (s.width_pct||1) < 0.3 && s.has_oi_signal).length
  const suggestions = searchQuery.length >= 1 ? ALL_SYMBOLS.filter(s => s.startsWith(searchQuery.toUpperCase())).slice(0,8) : []

  return (
    <div className="min-h-screen bg-[#07070e] text-white">
      <Navbar active="/" />

      {/* Live ticker */}
      <div className="bg-gray-950 border-b border-gray-800/50 overflow-hidden">
        <div className="flex items-center h-9">
          <div className="flex-shrink-0 bg-emerald-950 border-r border-emerald-800/50 px-3 h-full flex items-center">
            <span className="text-xs font-black text-emerald-400 tracking-wider">LIVE</span>
          </div>
          <div className="flex items-center gap-6 px-4 overflow-x-auto scrollbar-hide">
            {analyses.map(a => (
              <button key={a.symbol} onClick={() => setSearchedSymbol(a.symbol)} className="flex items-center gap-2 flex-shrink-0 hover:opacity-80">
                <span className="text-xs font-black text-white">{a.symbol}</span>
                <span className="text-xs font-bold text-amber-400">₹{cmps[a.symbol]?.toLocaleString()||'—'}</span>
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${a.pcr > 1 ? 'text-emerald-400 bg-emerald-950' : 'text-red-400 bg-red-950'}`}>PCR {a.pcr.toFixed(2)}</span>
              </button>
            ))}
            {warZoneCount > 0 && (
              <span className="flex items-center gap-1 text-xs text-orange-400 font-bold flex-shrink-0">
                <Zap size={10}/>{warZoneCount} War Zone
              </span>
            )}
          </div>
          <ExpiryCountdown />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight mb-1">Market Pulse</h1>
            <p className="text-gray-500 text-sm">Live OI flow · CPR context · War zone detection</p>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdate && (
              <div className="flex items-center gap-1.5 text-xs text-gray-600 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2">
                <Clock size={11}/>📸 {lastUpdate}
              </div>
            )}
            <button onClick={toggleAuto} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${autoEnabled ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60' : 'bg-gray-900/40 text-gray-500 border-gray-800'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${autoEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`}/>
              {autoEnabled ? countdownStr : 'Auto'}
            </button>
            <button onClick={fetchData} disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-sm font-medium text-white rounded-lg border border-gray-700 transition-all">
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''}/>Refresh
            </button>
          </div>
        </div>

        {/* Stock search */}
        <div className="relative mb-6">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"/>
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && searchQuery && setSearchedSymbol(searchQuery)}
                placeholder="Deep dive any F&O stock… RELIANCE, TCS, NIFTY"
                className="w-full bg-gray-900 border border-gray-700 text-white text-sm rounded-xl pl-9 pr-4 py-3 focus:outline-none focus:border-emerald-500 placeholder:text-gray-600"/>
              {suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-gray-900 border border-gray-700 rounded-xl overflow-hidden z-50 shadow-xl">
                  {suggestions.map(s => (
                    <button key={s} onClick={() => { setSearchedSymbol(s); setSearchQuery(s) }}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-800 hover:text-white font-medium">{s}</button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={() => searchQuery && setSearchedSymbol(searchQuery)} disabled={!searchQuery}
              className="flex items-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-sm rounded-xl">
              <Search size={14}/>Search
            </button>
          </div>
        </div>

        {/* Stock command centre */}
        {searchedSymbol && <StockCommandCentre symbol={searchedSymbol} onClose={() => { setSearchedSymbol(null); setSearchQuery('') }}/>}

        {/* Index cards */}
        {loading ? (
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[1,2,3].map(i => (
              <div key={i} className="rounded-2xl border border-gray-800 bg-gray-900/30 p-5 animate-pulse space-y-4">
                <div className="flex justify-between"><div className="h-5 w-24 bg-gray-800 rounded"/><div className="h-6 w-20 bg-gray-800 rounded-full"/></div>
                <div className="grid grid-cols-3 gap-2">{[1,2,3].map(j=><div key={j} className="h-16 bg-gray-800 rounded-xl"/>)}</div>
              </div>
            ))}
          </div>
        ) : analyses.length > 0 ? (
          <div className="grid grid-cols-3 gap-4 mb-8">
            {analyses.map(a => (
              <div key={a.symbol} onClick={() => setSearchedSymbol(a.symbol)} className="cursor-pointer">
                <IndexCard a={a} cpr={cprMap[a.symbol]} cmp={cmps[a.symbol]}/>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center mb-8 border border-gray-800/50 rounded-2xl">
            <Database size={28} className="text-gray-700 mb-4"/>
            <h3 className="text-lg font-bold text-gray-400 mb-2">Waiting for market data</h3>
            <p className="text-sm text-gray-600">OI capture runs weekdays 9:15 AM – 3:30 PM IST</p>
          </div>
        )}

        {/* Market breadth */}
        {breadth.total > 0 && (
          <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-white">Market Breadth</h3>
                <p className="text-xs text-gray-500">{breadth.total} F&O symbols</p>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="text-emerald-400 font-bold">{breadth.bullish} Bullish</span>
                <span className="text-amber-400 font-bold">{breadth.neutral} Neutral</span>
                <span className="text-red-400 font-bold">{breadth.bearish} Bearish</span>
              </div>
            </div>
            <div className="h-2 rounded-full overflow-hidden flex">
              <div className="bg-emerald-500 h-full transition-all" style={{ width: `${Math.round(breadth.bullish/breadth.total*100)}%` }}/>
              <div className="bg-amber-500/70 h-full transition-all" style={{ width: `${Math.round(breadth.neutral/breadth.total*100)}%` }}/>
              <div className="bg-red-500 h-full transition-all" style={{ width: `${Math.round(breadth.bearish/breadth.total*100)}%` }}/>
            </div>
          </div>
        )}

        {/* Market Pulse Feed */}
        <div className="bg-gray-900/20 border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-black text-white">Market Pulse Feed</h2>
              <p className="text-xs text-gray-500 mt-0.5">All 66 F&O symbols · Ranked by activity · CPR + OI combined</p>
            </div>
            {warZoneCount > 0 && (
              <div className="flex items-center gap-1.5 bg-orange-950/40 border border-orange-800/50 rounded-lg px-3 py-1.5">
                <Zap size={12} className="text-orange-400"/>
                <span className="text-xs font-bold text-orange-400">{warZoneCount} War Zone active</span>
              </div>
            )}
          </div>
          {pulseStocks.length > 0 ? (
            <MarketPulseFeed stocks={pulseStocks} cprData={cprData}/>
          ) : (
            <div className="text-center py-12 text-gray-600 text-sm">
              {loading ? 'Loading market data…' : 'No pulse data available — market may be closed'}
            </div>
          )}
        </div>

        {/* SEBI disclaimer */}
        <div className="mt-6 bg-gray-900/20 border border-gray-800/40 rounded-xl p-3">
          <p className="text-xs text-gray-600">
            <span className="text-gray-400 font-semibold">Disclaimer:</span> All data is informational only. Not investment advice. GreekNova is not SEBI-registered. Always consult a SEBI-registered advisor before trading.
          </p>
        </div>
      </div>
    </div>
  )
}
