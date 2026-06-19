'use client'
import Navbar from '@/components/Navbar'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { TrendingUp, TrendingDown, Minus, RefreshCw, Clock, Database, Search, X, Zap, Eye, Moon, ChevronDown, ChevronUp, Flame, BarChart2, Volume2 } from 'lucide-react'
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
  'DIXON','NYKAA','PAYTM','PERSISTENT',
]

interface OIRecord { symbol:string; strike:number; option_type:string; oi:number; volume:number; last_price:number; timestamp:string; expiry?:string }
interface IndexAnalysis { symbol:string; pcr:number; totalCEOI:number; totalPEOI:number; maxPain:number; posture:'BULLISH'|'BEARISH'|'NEUTRAL'; postureStrength:number; topCEStrike:number; topPEStrike:number }
interface CPRRow { symbol:string; tc:number; bc:number; pivot:number; width_pct:number; width_label:string; width_color:string; width_emoji:string; cpr_trend:string; is_virgin:boolean; cpr_position:string; position_label:string; cmp:number; last_cmp?:number; has_oi_signal?:boolean; confluence?:boolean; width_pts?:number }
interface PulseStock { symbol:string; cmp:number; oi_chg_pct:number; price_chg_pct:number; signal:string; label:string; confluence?:boolean; width_pct?:number; width_pts?:number; width_emoji?:string; cpr_position?:string; has_oi_signal?:boolean; oi_now?:number; oi_prev?:number; vol_surge?:boolean }

// ── Sector Performance ────────────────────────────────────────────────────────
const SECTOR_MAP: Record<string, string[]> = {
  "Banking":      ["HDFCBANK","ICICIBANK","SBIN","AXISBANK","KOTAKBANK","INDUSINDBK","BANKBARODA","CANBK"],
  "IT":           ["TCS","INFY","WIPRO","HCLTECH","TECHM"],
  "Auto":         ["MARUTI","BAJAJ-AUTO","EICHERMOT","HEROMOTOCO","M&M"],
  "Metals":       ["TATASTEEL","JSWSTEEL","HINDALCO","SAIL","VEDL"],
  "Energy":       ["RELIANCE","ONGC","BPCL","GAIL","COALINDIA","TATAPOWER","POWERGRID","NTPC"],
  "Finance/NBFC": ["BAJFINANCE","BAJAJFINSV","SHRIRAMFIN","CHOLAFIN","HDFCLIFE","SBILIFE","JIOFIN","PFC","RECLTD"],
  "Pharma":       ["SUNPHARMA","CIPLA","DRREDDY","APOLLOHOSP"],
  "Infra/Capital":["LT","HAL","BEL","ADANIPORTS","ADANIENT","DLF","INDIGO"],
  "Consumer":     ["ITC","HINDUNILVR","NESTLEIND","BRITANNIA","TATACONSUM","TITAN","ASIANPAINT","HAVELLS"],
  "Cement":       ["ULTRACEMCO","GRASIM"],
  "Telecom":      ["BHARTIARTL"],
  "Textile":      ["TRENT"],
}

function getSectorPerf(stocks: PulseStock[]) {
  return Object.entries(SECTOR_MAP).map(([sector, symbols]) => {
    const members = stocks.filter(s => symbols.includes(s.symbol) && s.price_chg_pct != null)
    if (!members.length) return { sector, avg: 0, count: 0 }
    const avg = members.reduce((sum, s) => sum + (s.price_chg_pct || 0), 0) / members.length
    return { sector, avg: parseFloat(avg.toFixed(2)), count: members.length }
  }).sort((a, b) => b.avg - a.avg)
}

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

function getWarZoneTag(stock: PulseStock) {
  const isIndex = ['NIFTY','BANKNIFTY','FINNIFTY'].includes(stock.symbol)
  if (isIndex) return { label: 'Quiet', icon: '😴', color: 'text-gray-600', bg: 'bg-gray-900/10', border: 'border-gray-800/20' }
  const isNarrow = (stock.width_pct || 1) < 0.3
  const hasSignal = stock.has_oi_signal
  if (isNarrow && hasSignal) return { label: 'War Zone', icon: '⚡', color: 'text-orange-300', bg: 'bg-orange-950/50', border: 'border-orange-700/60' }
  if (isNarrow) return { label: 'Watch', icon: '👀', color: 'text-amber-400', bg: 'bg-amber-950/30', border: 'border-amber-800/40' }
  return { label: 'Quiet', icon: '😴', color: 'text-gray-600', bg: 'bg-gray-900/10', border: 'border-gray-800/20' }
}

// ── Expiry Countdown ──────────────────────────────────────────────────────────
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

// ── Index Card ────────────────────────────────────────────────────────────────
function IndexCard({ a, cpr, cmp }: { a: IndexAnalysis; cpr?: CPRRow; cmp?: number }) {
  const bull = a.posture === 'BULLISH', bear = a.posture === 'BEARISH'
  const ceP = Math.round((a.totalCEOI / (a.totalCEOI + a.totalPEOI)) * 100)
  const cprTrendColor: Record<string,string> = { ASCENDING:'text-emerald-400', DESCENDING:'text-red-400', SIDEWAYS:'text-gray-400', UNKNOWN:'text-gray-600' }
  const cprTrendLabel: Record<string,string> = { ASCENDING:'↑ Ascending', DESCENDING:'↓ Descending', SIDEWAYS:'→ Sideways', UNKNOWN:'— Unknown' }
  const cprPosColor: Record<string,string> = { ABOVE_CPR:'text-emerald-400', BELOW_CPR:'text-red-400', INSIDE_CPR:'text-amber-400' }
  const cprPosLabel: Record<string,string> = { ABOVE_CPR:'↑ Above CPR', BELOW_CPR:'↓ Below CPR', INSIDE_CPR:'⟷ Inside CPR' }
  return (
    <div className={`relative rounded-2xl border bg-gray-900/40 p-5 overflow-hidden hover:bg-gray-900/60 transition-all duration-300 cursor-pointer ${bull ? 'border-emerald-800/40' : bear ? 'border-red-800/40' : 'border-gray-800'}`}>
      <div className={`absolute -top-8 -right-8 w-32 h-32 rounded-full blur-2xl opacity-10 ${bull ? 'bg-emerald-500' : bear ? 'bg-red-500' : 'bg-amber-500'}`} />
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-white">{a.symbol}</h3>
            {cmp && <p className="text-lg font-black text-amber-400">₹{cmp.toLocaleString()}</p>}
          </div>
          <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${bull ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800/60' : bear ? 'bg-red-950/80 text-red-400 border-red-800/60' : 'bg-amber-950/80 text-amber-400 border-amber-800/60'}`}>
            {bull ? <TrendingUp size={11}/> : bear ? <TrendingDown size={11}/> : <Minus size={11}/>}{a.posture}
          </span>
        </div>
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
        <div className="mb-3">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-red-400 font-medium">CE {ceP}%</span>
            <span className="text-emerald-400 font-medium">PE {100-ceP}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-gray-800 overflow-hidden flex">
            <div className="bg-red-500/80 h-full rounded-l-full transition-all duration-700" style={{width:`${ceP}%`}}/>
            <div className="bg-emerald-500/80 h-full rounded-r-full transition-all duration-700" style={{width:`${100-ceP}%`}}/>
          </div>
        </div>
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
        {cpr && (
          <div className="flex items-center justify-between bg-gray-800/30 border border-gray-700/30 rounded-lg px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">CPR</span>
              {cpr.is_virgin && <span className="text-xs text-blue-400 font-bold">🔵 Virgin</span>}
              {cpr.cpr_position && <span className={`text-xs font-bold ${cprPosColor[cpr.cpr_position] || 'text-gray-500'}`}>{cprPosLabel[cpr.cpr_position]}</span>}
            </div>
            <span className={`text-xs font-semibold ${cprTrendColor[cpr.cpr_trend] || 'text-gray-600'}`}>{cprTrendLabel[cpr.cpr_trend] || '—'}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Today's Spotlight ─────────────────────────────────────────────────────────
function Spotlight({ stocks, cprData }: { stocks: PulseStock[]; cprData: CPRRow[] }) {
  const stocksOnly = stocks.filter(s => !['NIFTY','BANKNIFTY','FINNIFTY'].includes(s.symbol))
  const isMarketData = stocksOnly.some(s => (s.oi_chg_pct||0) !== 0)
  const topOIBuilder  = isMarketData
    ? [...stocksOnly].sort((a,b) => (b.oi_chg_pct||0) - (a.oi_chg_pct||0))[0]
    : [...stocksOnly].filter(s => s.cpr_position === 'ABOVE_CPR').sort((a,b) => (a.width_pct||1) - (b.width_pct||1))[0]
  const topOIUnwinder = isMarketData
    ? [...stocksOnly].sort((a,b) => (a.oi_chg_pct||0) - (b.oi_chg_pct||0))[0]
    : [...stocksOnly].filter(s => s.cpr_position === 'BELOW_CPR').sort((a,b) => (a.width_pct||1) - (b.width_pct||1))[0]
  const usedSymbols = new Set([topOIBuilder?.symbol, topOIUnwinder?.symbol])
  const narrowestCPR = [...cprData.filter(c => !['NIFTY','BANKNIFTY','FINNIFTY'].includes(c.symbol) && !usedSymbols.has(c.symbol))].sort((a,b) => (a.width_pct||1) - (b.width_pct||1))[0]
  const cards = [
    {
      label: isMarketData ? '🔥 Highest OI Buildup' : '🟢 Narrowest Above CPR',
      symbol: topOIBuilder?.symbol,
      value: topOIBuilder?.oi_chg_pct !== undefined ? `+${topOIBuilder.oi_chg_pct.toFixed(1)}% OI` : '—',
      sub: topOIBuilder?.cmp ? `₹${topOIBuilder.cmp.toLocaleString()}` : '',
      color: 'text-emerald-400', bg: 'bg-emerald-950/20', border: 'border-emerald-800/30',
    },
    {
      label: isMarketData ? '📉 Highest OI Unwind' : '🔴 Narrowest Below CPR',
      symbol: topOIUnwinder?.symbol,
      value: topOIUnwinder?.oi_chg_pct !== undefined ? `${topOIUnwinder.oi_chg_pct.toFixed(1)}% OI` : '—',
      sub: topOIUnwinder?.cmp ? `₹${topOIUnwinder.cmp.toLocaleString()}` : '',
      color: 'text-red-400', bg: 'bg-red-950/20', border: 'border-red-800/30',
    },
    {
      label: '⚡ Narrowest CPR',
      symbol: narrowestCPR?.symbol,
      value: narrowestCPR?.width_pct !== undefined ? `${narrowestCPR.width_pct.toFixed(3)}% wide` : '—',
      sub: narrowestCPR?.width_pts !== undefined ? `${narrowestCPR.width_pts.toFixed(1)} pts` : '',
      color: 'text-orange-400', bg: 'bg-orange-950/20', border: 'border-orange-800/30',
    },
  ]
  if (!topOIBuilder && !narrowestCPR) return null
  return (
    <div className="grid grid-cols-3 gap-4 mb-6">
      {cards.map(c => (
        <div key={c.label} className={`rounded-xl border p-4 ${c.bg} ${c.border}`}>
          <p className="text-xs text-gray-500 mb-2">{c.label}</p>
          <p className="text-xl font-black text-white">{c.symbol || '—'}</p>
          <p className={`text-sm font-bold ${c.color} mt-1`}>{c.value}</p>
          {c.sub && <p className="text-xs text-gray-600 mt-0.5">{c.sub}</p>}
        </div>
      ))}
    </div>
  )
}

// ── Activity Leaders ──────────────────────────────────────────────────────────
function ActivityLeaders({ stocks, uoaSignals, onSymbolClick }: {
  stocks: PulseStock[]
  uoaSignals: any[]
  onSymbolClick: (sym: string) => void
}) {
  const stocksOnly = stocks.filter(s => !['NIFTY','BANKNIFTY','FINNIFTY'].includes(s.symbol))
  const isMarketData = stocksOnly.some(s => (s.oi_chg_pct||0) !== 0)
  const cmpMap = Object.fromEntries(stocks.map(s => [s.symbol, s.cmp]))
  const dayHighBreakouts = isMarketData
    ? [...stocksOnly].filter(s => (s.price_chg_pct||0) > 0.5).sort((a,b) => (b.price_chg_pct||0) - (a.price_chg_pct||0)).slice(0,3)
    : []
  const putWriters = uoaSignals
    .filter(s => s.signal_type === 'PUT_WRITING' && s.score >= 3)
    .map(s => ({ ...s, otm_distance_pct: (() => { const c = cmpMap[s.symbol] || 0; return c > 0 ? Math.round(Math.abs(s.strike - c) / c * 1000) / 10 : null })() }))
    .sort((a,b) => { const dA = a.otm_distance_pct ?? 99; const dB = b.otm_distance_pct ?? 99; return dA !== dB ? dA - dB : b.score - a.score })
    .slice(0,3)
  const callWriters = uoaSignals
    .filter(s => s.signal_type === 'CALL_WRITING' && s.score >= 3)
    .map(s => ({ ...s, otm_distance_pct: (() => { const c = cmpMap[s.symbol] || 0; return c > 0 ? Math.round(Math.abs(s.strike - c) / c * 1000) / 10 : null })() }))
    .sort((a,b) => { const dA = a.otm_distance_pct ?? 99; const dB = b.otm_distance_pct ?? 99; return dA !== dB ? dA - dB : b.score - a.score })
    .slice(0,3)
  const volSurge = isMarketData
    ? [...stocksOnly].filter(s => s.vol_surge || Math.abs(s.oi_chg_pct||0) > 5).sort((a,b) => (b.oi_chg_pct||0) - (a.oi_chg_pct||0)).slice(0,3)
    : []
  if (!isMarketData && putWriters.length === 0 && callWriters.length === 0) return null
  return (
    <div className="grid grid-cols-4 gap-3 mb-6">
      <div className="bg-emerald-950/20 border border-emerald-800/30 rounded-xl p-4">
        <p className="text-xs text-gray-500 mb-3">🔝 Day High Breakouts</p>
        {dayHighBreakouts.length > 0 ? (
          <div className="space-y-2">
            {dayHighBreakouts.map(s => (
              <button key={s.symbol} onClick={() => onSymbolClick(s.symbol)} className="w-full flex items-center justify-between hover:opacity-80 transition-opacity">
                <span className="text-xs font-bold text-white">{s.symbol}</span>
                <span className="text-xs font-bold text-emerald-400">+{s.price_chg_pct?.toFixed(2)}%</span>
              </button>
            ))}
          </div>
        ) : <p className="text-xs text-gray-600">{isMarketData ? 'No breakouts yet' : 'Available during market hours'}</p>}
      </div>
      <div className="bg-emerald-950/10 border border-emerald-800/20 rounded-xl p-4">
        <p className="text-xs text-gray-500 mb-3">✍️ Top Put Writers</p>
        {putWriters.length > 0 ? (
          <div className="space-y-2">
            {putWriters.map((s,i) => (
              <button key={i} onClick={() => onSymbolClick(s.symbol)} className="w-full flex items-center justify-between hover:opacity-80 transition-opacity">
                <div className="text-left">
                  <p className="text-xs font-bold text-white">{s.symbol}</p>
                  <p className="text-[10px] text-gray-500">{s.strike} PE · {s.score}/5</p>
                  <p className="text-[10px] text-amber-500">Vol +{s.vol_chg_30min?.toFixed(0)}%</p>
                </div>
                <span className={`text-[10px] font-bold ${s.otm_distance_pct != null ? s.otm_distance_pct <= 2 ? 'text-emerald-400' : s.otm_distance_pct <= 5 ? 'text-amber-400' : 'text-red-400' : 'text-gray-500'}`}>
                  {s.otm_distance_pct != null ? `${s.otm_distance_pct <= 2 ? '✅' : s.otm_distance_pct <= 5 ? '⚠️' : '🔴'} ${s.otm_distance_pct}% away` : '—'}
                </span>
              </button>
            ))}
          </div>
        ) : <p className="text-xs text-gray-600">No put writing signals</p>}
      </div>
      <div className="bg-red-950/10 border border-red-800/20 rounded-xl p-4">
        <p className="text-xs text-gray-500 mb-3">✍️ Top Call Writers</p>
        {callWriters.length > 0 ? (
          <div className="space-y-2">
            {callWriters.map((s,i) => (
              <button key={i} onClick={() => onSymbolClick(s.symbol)} className="w-full flex items-center justify-between hover:opacity-80 transition-opacity">
                <div className="text-left">
                  <p className="text-xs font-bold text-white">{s.symbol}</p>
                  <p className="text-[10px] text-gray-500">{s.strike} CE · {s.score}/5</p>
                  <p className="text-[10px] text-amber-500">Vol +{s.vol_chg_30min?.toFixed(0)}%</p>
                </div>
                <span className={`text-[10px] font-bold ${s.otm_distance_pct != null ? s.otm_distance_pct <= 2 ? 'text-emerald-400' : s.otm_distance_pct <= 5 ? 'text-amber-400' : 'text-red-400' : 'text-gray-500'}`}>
                  {s.otm_distance_pct != null ? `${s.otm_distance_pct <= 2 ? '✅' : s.otm_distance_pct <= 5 ? '⚠️' : '🔴'} ${s.otm_distance_pct}% away` : '—'}
                </span>
              </button>
            ))}
          </div>
        ) : <p className="text-xs text-gray-600">No call writing signals</p>}
      </div>
      <div className="bg-amber-950/20 border border-amber-800/30 rounded-xl p-4">
        <p className="text-xs text-gray-500 mb-3">⚡ Vol Surge Leaders</p>
        {volSurge.length > 0 ? (
          <div className="space-y-2">
            {volSurge.map(s => (
              <button key={s.symbol} onClick={() => onSymbolClick(s.symbol)} className="w-full flex items-center justify-between hover:opacity-80 transition-opacity">
                <span className="text-xs font-bold text-white">{s.symbol}</span>
                <span className="text-xs font-bold text-amber-400">{(s.oi_chg_pct||0) > 0 ? '+' : ''}{s.oi_chg_pct?.toFixed(1)}% OI</span>
              </button>
            ))}
          </div>
        ) : <p className="text-xs text-gray-600">{isMarketData ? 'No volume surges yet' : 'Available during market hours'}</p>}
      </div>
    </div>
  )
}

// ── Vol + OI Breakout Widget ──────────────────────────────────────────────────
const VOL_SIGNAL_COLORS: Record<string, string> = {
  LONG_BUILDUP: 'text-emerald-400', SHORT_BUILDUP: 'text-red-400',
  SHORT_COVERING: 'text-cyan-400',  LONG_UNWINDING: 'text-orange-400',
}
const VOL_SIGNAL_ICONS: Record<string, string> = {
  LONG_BUILDUP: '🐂', SHORT_BUILDUP: '🐻',
  SHORT_COVERING: '🔄', LONG_UNWINDING: '⚠️',
}
const VOL_CTX_COLORS: Record<string, string> = {
  EMERALD: 'text-emerald-400', RED: 'text-red-400',
  AMBER: 'text-amber-400', CYAN: 'text-cyan-400', GRAY: 'text-gray-500',
}
const VOL_CPR_COLORS: Record<string, string> = {
  'Above CPR': 'text-emerald-400', 'Below CPR': 'text-red-400', 'Inside CPR': 'text-amber-400',
}

function VolOIBreakout({ onSymbolClick }: { onSymbolClick: (sym: string) => void }) {
  const [data, setData]       = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [stale, setStale]     = useState<any>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const res  = await fetch(`${API}/vol-oi-breakout`)
        const json = await res.json()
        setData(json)
        if (json?.signals?.length > 0) setStale(json)
      } catch(e) { console.error(e) }
      setLoading(false)
    }
    load()
    const t = setInterval(load, 5 * 60 * 1000)
    return () => clearInterval(t)
  }, [])

  const isMarketOpen = (() => {
    const now = new Date()
    const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
    const day = ist.getDay()
    if (day === 0 || day === 6) return false
    const mins = ist.getHours() * 60 + ist.getMinutes()
    return mins >= 555 && mins <= 930
  })()

  const display = (data?.signals?.length === 0 && stale && !isMarketOpen) ? stale : data
  const signals = display?.signals || []
  const isEOD   = display?.is_eod_snapshot
  const noSignalsYet = isMarketOpen && signals.length === 0 && !loading

  if (loading && !stale) return (
    <div className="bg-gray-900/20 border border-gray-800 rounded-2xl p-5 mb-6 animate-pulse">
      <div className="h-5 w-56 bg-gray-800 rounded mb-4"/>
      <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 bg-gray-800 rounded-xl"/>)}</div>
    </div>
  )

  if (!signals.length && !noSignalsYet) return null

  return (
    <div className="bg-gray-900/20 border border-gray-800 rounded-2xl p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-black text-white">📊 Volume + OI Breakout</h2>
            {isEOD && (
              <span className="text-[10px] px-2 py-0.5 bg-gray-800 text-gray-400 border border-gray-700 rounded-full">
                🌙 EOD Snapshot
              </span>
            )}
            {isMarketOpen && !isEOD && !noSignalsYet && (
              <span className="text-[10px] px-2 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded-full">
                🟢 Live
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Volume {'>'} 1.5× 5-day avg + OI building · {noSignalsYet ? 'scanning...' : `${display?.total || 0} qualifying today`}
          </p>
        </div>
      </div>

      {noSignalsYet && (
        <div className="flex items-center justify-center py-8 text-center">
          <div>
            <p className="text-gray-500 text-sm font-medium">🔍 No qualifying stocks yet today</p>
            <p className="text-gray-700 text-xs mt-1">Watching for volume {'>'} 1.5× avg + OI change {'>'} 2%</p>
          </div>
        </div>
      )}

      {/* Column headers */}
      <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs text-gray-600 font-medium border-b border-gray-800/50 mb-1">
        <div className="col-span-2">Symbol</div>
        <div className="col-span-2 text-center">Vol Ratio</div>
        <div className="col-span-2 text-center">OI Chg</div>
        <div className="col-span-2">Signal</div>
        <div className="col-span-3">Price Context</div>
        <div className="col-span-1">CPR</div>
      </div>

      {/* Rows — top 5 */}
      <div className="space-y-0.5">
        {signals.slice(0, 5).map((s: any) => (
          <div key={s.symbol}
            className="grid grid-cols-12 gap-2 px-3 py-2.5 rounded-lg items-center hover:bg-gray-800/30 transition-colors cursor-pointer"
            onClick={() => onSymbolClick(s.symbol)}>
            <div className="col-span-2">
              <p className="text-xs font-black text-white hover:underline">{s.symbol}</p>
              <p className="text-[10px] text-gray-500">₹{s.cmp?.toLocaleString()}</p>
            </div>
            <div className="col-span-2 text-center">
              <p className={`text-xs font-bold ${s.vol_ratio >= 3 ? 'text-purple-400' : s.vol_ratio >= 2 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {s.vol_ratio}× avg
              </p>
              <p className="text-[10px] text-gray-600">{(s.vol_latest/100000).toFixed(1)}L today</p>
            </div>
            <div className="col-span-2 text-center">
              <p className={`text-xs font-bold ${s.oi_chg_pct > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {s.oi_chg_pct > 0 ? '+' : ''}{s.oi_chg_pct}%
              </p>
              <p className={`text-[10px] ${s.price_chg_pct >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                Price {s.price_chg_pct >= 0 ? '+' : ''}{s.price_chg_pct}%
              </p>
            </div>
            <div className="col-span-2">
              <span className={`text-xs font-bold ${VOL_SIGNAL_COLORS[s.signal_type] || 'text-gray-400'}`}>
                {VOL_SIGNAL_ICONS[s.signal_type]} {s.signal_label}
              </span>
            </div>
            <div className="col-span-3">
              <p className={`text-[10px] font-bold ${VOL_CTX_COLORS[s.price_ctx_color] || 'text-gray-400'}`}>
                {s.price_context}
              </p>
              <p className="text-[10px] text-gray-600">
                H:{s.day_high?.toLocaleString()} L:{s.day_low?.toLocaleString()}
              </p>
            </div>
            <div className="col-span-1">
              {s.cpr_position ? (
                <p className={`text-[10px] font-bold ${VOL_CPR_COLORS[s.cpr_position] || 'text-gray-400'}`}>
                  {s.cpr_position === 'Above CPR' ? '↑ Above' : s.cpr_position === 'Below CPR' ? '↓ Below' : '⟷ Inside'}
                </p>
              ) : <span className="text-gray-600 text-[10px]">—</span>}
              {s.cpr_width_label && (
                <p className="text-[10px] text-gray-600">{s.cpr_width_emoji}</p>
              )}
            </div>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-gray-700 mt-3 px-1">
        Vol ratio = today's volume ÷ 5-day avg · Price context shows where CMP sits in today's range · Informational only
      </p>
    </div>
  )
}

// ── Market Pulse Feed ─────────────────────────────────────────────────────────
function MarketPulseFeed({ stocks, cprData }: { stocks: PulseStock[]; cprData: CPRRow[] }) {
  const [tab, setTab] = useState<'warzone'|'oi_build'|'oi_unwind'|'all'>('warzone')
  const [search, setSearch] = useState('')
  const cprMap = Object.fromEntries(cprData.map(c => [c.symbol, c]))
  const enriched = stocks.map(s => ({
    ...s,
    width_pct:    s.width_pct    ?? cprMap[s.symbol]?.width_pct,
    width_pts:    s.width_pts    ?? cprMap[s.symbol]?.width_pts,
    width_emoji:  s.width_emoji  ?? cprMap[s.symbol]?.width_emoji,
    cpr_position: s.cpr_position ?? cprMap[s.symbol]?.cpr_position,
    has_oi_signal: s.has_oi_signal ?? cprMap[s.symbol]?.has_oi_signal ?? false,
    confluence:   s.confluence   ?? cprMap[s.symbol]?.confluence ?? false,
  }))
  const isMarketData = enriched.some(s => (s.oi_chg_pct||0) !== 0)
  const warZone  = enriched.filter(s => (s.width_pct||1) < 0.3 && s.has_oi_signal)
  const oiBuild  = isMarketData
    ? [...enriched].filter(s => (s.oi_chg_pct||0) > 0).sort((a,b) => (b.oi_chg_pct||0) - (a.oi_chg_pct||0))
    : [...enriched].sort((a,b) => (a.width_pct||1) - (b.width_pct||1))
  const oiUnwind = isMarketData
    ? [...enriched].filter(s => (s.oi_chg_pct||0) < 0).sort((a,b) => (a.oi_chg_pct||0) - (b.oi_chg_pct||0))
    : [...enriched].filter(s => s.cpr_position === 'BELOW_CPR').sort((a,b) => (a.width_pct||1) - (b.width_pct||1))
  const all = [...enriched].sort((a,b) => {
    const aW = (a.width_pct||1)<0.3 && a.has_oi_signal ? 0 : (a.width_pct||1)<0.3 ? 1 : 2
    const bW = (b.width_pct||1)<0.3 && b.has_oi_signal ? 0 : (b.width_pct||1)<0.3 ? 1 : 2
    if (aW !== bW) return aW - bW
    return Math.abs(b.oi_chg_pct||0) - Math.abs(a.oi_chg_pct||0)
  })
  const tabData: Record<string, PulseStock[]> = { warzone: warZone, oi_build: oiBuild, oi_unwind: oiUnwind, all }
  const filtered = (tabData[tab] || all).filter(s => search ? s.symbol.includes(search.toUpperCase()) : true)
  const signalColors: Record<string, string> = {
    LONG_BUILDUP:'text-emerald-400', SHORT_BUILDUP:'text-red-400',
    SHORT_COVERING:'text-cyan-400', LONG_UNWINDING:'text-amber-400',
    PUT_WRITING:'text-emerald-400', CALL_WRITING:'text-red-400', NEUTRAL:'text-gray-500',
  }
  const tabs = [
    { key: 'warzone',   label: `⚡ War Zone`,                                      count: warZone.length },
    { key: 'oi_build',  label: isMarketData ? `📈 OI Builders` : `📈 Narrow CPR`, count: oiBuild.length },
    { key: 'oi_unwind', label: isMarketData ? `📉 OI Unwinders` : `📉 Below CPR`, count: oiUnwind.length },
    { key: 'all',       label: `📊 All`,                                            count: all.length },
  ]
  return (
    <div>
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-all font-medium ${tab === t.key ? 'bg-white text-gray-900 border-white' : 'bg-gray-900/40 text-gray-400 border-gray-800 hover:text-white'}`}>
            {t.label} <span className="opacity-60">({t.count})</span>
          </button>
        ))}
        <div className="relative ml-auto">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500"/>
          <input value={search} onChange={e => setSearch(e.target.value.toUpperCase())} placeholder="Search..."
            className="bg-gray-900 border border-gray-700 text-white text-xs rounded-lg pl-7 pr-3 py-1.5 w-28 focus:outline-none focus:border-emerald-500"/>
          {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500"><X size={10}/></button>}
        </div>
      </div>
      <p className="text-xs text-gray-600 mb-3">
        {tab === 'warzone'   && 'Narrow CPR (<0.30%) + active OI signal — highest conviction setups'}
        {tab === 'oi_build'  && (isMarketData ? 'Stocks with increasing Open Interest today — fresh positioning' : 'OI change: previous close vs latest close')}
        {tab === 'oi_unwind' && (isMarketData ? 'Stocks with decreasing Open Interest today — positions being squared off' : 'Stocks below CPR with narrow range')}
        {tab === 'all'       && 'All 66 F&O symbols ranked by War Zone status then OI activity'}
      </p>
      <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs text-gray-600 font-medium border-b border-gray-800/50 mb-1">
        <div className="col-span-2">Symbol</div>
        <div className="col-span-2 text-right">CMP</div>
        <div className="col-span-2 text-right">OI Chg</div>
        <div className="col-span-2">Signal</div>
        <div className="col-span-2">CPR</div>
        <div className="col-span-2 text-right">Zone</div>
      </div>
      <div className="space-y-0.5">
        {filtered.length === 0 ? (
          <div className="text-center py-10 text-gray-600 text-sm">
            {tab === 'warzone' ? 'No War Zone stocks right now' : 'No data available'}
          </div>
        ) : filtered.map(s => {
          const tag = getWarZoneTag(s)
          const isIndex = ['NIFTY','BANKNIFTY','FINNIFTY'].includes(s.symbol)
          const cprPosColor: Record<string,string> = { ABOVE_CPR:'text-emerald-400', BELOW_CPR:'text-red-400', INSIDE_CPR:'text-amber-400' }
          const cprPosShort: Record<string,string> = { ABOVE_CPR:'↑ Above', BELOW_CPR:'↓ Below', INSIDE_CPR:'⟷ Inside' }
          return (
            <div key={s.symbol} className={`grid grid-cols-12 gap-2 px-3 py-2.5 rounded-lg items-center hover:bg-gray-800/30 transition-colors ${isIndex ? 'bg-gray-900/20' : ''}`}>
              <div className="col-span-2 flex items-center gap-1.5">
                <span className="font-bold text-white text-xs">{s.symbol}</span>
                {isIndex && <span className="text-[10px] text-gray-600 bg-gray-800 px-1 rounded">IDX</span>}
              </div>
              <div className="col-span-2 text-right">
                <span className="text-xs font-bold text-amber-400">{s.cmp ? `₹${s.cmp.toLocaleString()}` : '—'}</span>
                {s.price_chg_pct !== undefined && s.price_chg_pct !== 0 && (
                  <div className={`text-[10px] ${s.price_chg_pct >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    {s.price_chg_pct >= 0 ? '+' : ''}{s.price_chg_pct?.toFixed(1)}%
                  </div>
                )}
              </div>
              <div className="col-span-2 text-right">
                {s.oi_chg_pct !== undefined && s.oi_chg_pct !== 0 ? (
                  <span className={`text-xs font-bold ${s.oi_chg_pct > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {s.oi_chg_pct > 0 ? '+' : ''}{s.oi_chg_pct?.toFixed(1)}%
                  </span>
                ) : <span className="text-gray-700 text-xs">—</span>}
              </div>
              <div className="col-span-2">
                <span className={`text-xs font-medium ${signalColors[s.signal] || 'text-gray-500'}`}>{s.label || '—'}</span>
              </div>
              <div className="col-span-2">
                <div className="flex items-center gap-1">
                  {s.width_emoji && <span className="text-xs">{s.width_emoji}</span>}
                  <span className={`text-xs font-medium ${cprPosColor[s.cpr_position||''] || 'text-gray-600'}`}>
                    {cprPosShort[s.cpr_position||''] || '—'}
                  </span>
                </div>
                {s.width_pts !== undefined && s.width_pts > 0 && (
                  <div className="text-[10px] text-gray-600">{s.width_pts.toFixed(1)} pts</div>
                )}
              </div>
              <div className="col-span-2 flex justify-end">
                {tag.label !== 'Quiet' ? (
                  <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${tag.color} ${tag.bg} ${tag.border}`}>
                    {tag.icon} {tag.label}
                  </span>
                ) : <span className="text-[10px] text-gray-700">—</span>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Extended Market View ──────────────────────────────────────────────────────
function ExtendedView({ stocks }: { stocks: PulseStock[] }) {
  const [open, setOpen] = useState(true)
  const [activeTab, setActiveTab] = useState<'gainers'|'losers'|'active'>('gainers')
  const stocksOnly = stocks.filter(s => !['NIFTY','BANKNIFTY','FINNIFTY'].includes(s.symbol))
  const gainers = [...stocksOnly].filter(s => (s.price_chg_pct||0) > 0).sort((a,b) => (b.price_chg_pct||0) - (a.price_chg_pct||0)).slice(0,10)
  const losers  = [...stocksOnly].filter(s => (s.price_chg_pct||0) < 0).sort((a,b) => (a.price_chg_pct||0) - (b.price_chg_pct||0)).slice(0,10)
  const active  = [...stocksOnly].sort((a,b) => Math.abs(b.oi_chg_pct||0) - Math.abs(a.oi_chg_pct||0)).slice(0,10)
  const tabData = { gainers, losers, active }
  const rows = tabData[activeTab] || []
  return (
    <div className="border border-gray-800/50 rounded-2xl overflow-hidden mt-4">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-5 py-3.5 bg-gray-900/30 hover:bg-gray-900/60 transition-colors">
        <div className="flex items-center gap-2">
          <BarChart2 size={14} className="text-gray-500"/>
          <span className="text-sm font-bold text-gray-400">Extended Market View</span>
          <span className="text-xs text-gray-600">Gainers · Losers · Most Active</span>
        </div>
        {open ? <ChevronUp size={14} className="text-gray-500"/> : <ChevronDown size={14} className="text-gray-500"/>}
      </button>
      {open && (
        <div className="p-5 bg-gray-900/10">
          <div className="flex gap-2 mb-4">
            {[{ key: 'gainers', label: '📈 Top Gainers' }, { key: 'losers', label: '📉 Top Losers' }, { key: 'active', label: '🔄 Most Active OI' }].map(t => (
              <button key={t.key} onClick={() => setActiveTab(t.key as any)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${activeTab === t.key ? 'bg-white text-gray-900 border-white' : 'bg-gray-900/40 text-gray-400 border-gray-800 hover:text-white'}`}>
                {t.label}
              </button>
            ))}
          </div>
          {rows.length === 0 ? (
            <p className="text-center text-gray-600 text-sm py-6">No intraday data — market may be closed</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {rows.map((s, i) => (
                <div key={s.symbol} className="flex items-center justify-between bg-gray-900/30 border border-gray-800/50 rounded-lg px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-600 w-4">{i+1}</span>
                    <span className="text-sm font-bold text-white">{s.symbol}</span>
                    {s.cmp > 0 && <span className="text-xs text-gray-500">₹{s.cmp.toLocaleString()}</span>}
                  </div>
                  <div className="text-right">
                    {activeTab !== 'active' ? (
                      <span className={`text-sm font-black ${(s.price_chg_pct||0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {(s.price_chg_pct||0) >= 0 ? '+' : ''}{s.price_chg_pct?.toFixed(2)}%
                      </span>
                    ) : (
                      <span className={`text-sm font-black ${(s.oi_chg_pct||0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {(s.oi_chg_pct||0) >= 0 ? '+' : ''}{s.oi_chg_pct?.toFixed(1)}% OI
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Stock Command Centre ──────────────────────────────────────────────────────
function StockCommandCentre({ symbol, onClose }: { symbol: string; onClose: () => void }) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [mpRes, oiRes, uoaRes] = await Promise.all([fetch(`${API}/max-pain`), fetch(`${API}/oi-history/${symbol}`), fetch(`${API}/uoa`)])
        const [mp, oi, uoa] = await Promise.all([mpRes.json(), oiRes.json(), uoaRes.json()])
        const mpItem = mp.symbols?.find((i: any) => i.symbol === symbol)
        const uoaItems = uoa.signals?.filter((i: any) => i.symbol === symbol) || []
        const rows = oi.rows || []
        const totalCE = rows.reduce((s: number, r: any) => s + (r.ce_a || 0), 0)
        const totalPE = rows.reduce((s: number, r: any) => s + (r.pe_a || 0), 0)
        const pcr = totalCE > 0 ? Math.round((totalPE/totalCE)*100)/100 : null
        const topCEStrikes = [...rows].sort((a: any, b: any) => b.ce_a - a.ce_a).slice(0,5)
        const topPEStrikes = [...rows].sort((a: any, b: any) => b.pe_a - a.pe_a).slice(0,5)
        setData({ mpItem, oi, pcr, topCEStrikes, topPEStrikes, uoaItems })
      } catch(e) { console.error(e) }
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
        <div className="flex items-center justify-center py-12"><RefreshCw size={20} className="text-gray-600 animate-spin"/><span className="ml-3 text-gray-500 text-sm">Loading…</span></div>
      ) : (
        <div className="p-5 grid grid-cols-2 gap-4">
          <div className="bg-gray-900/40 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-2">🎯 Max Pain</p>
            {data?.mpItem ? (<>
              <p className="text-2xl font-black text-white">₹{data.mpItem.max_pain?.toLocaleString()}</p>
              <p className={`text-xs mt-1 font-bold ${data.mpItem.direction === 'BELOW' ? 'text-emerald-400' : 'text-orange-400'}`}>
                CMP {data.mpItem.direction === 'ABOVE' ? `↑ ${data.mpItem.dist_from_mp?.toFixed(1)}% above` : `↓ ${Math.abs(data.mpItem.dist_from_mp??0).toFixed(1)}% below`} Max Pain
              </p>
            </>) : <p className="text-gray-600 text-sm">No data</p>}
          </div>
          <div className="bg-gray-900/40 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-2">📊 PCR</p>
            <p className={`text-2xl font-black ${data?.pcr && data.pcr > 1 ? 'text-emerald-400' : 'text-red-400'}`}>{data?.pcr?.toFixed(2)??'—'}</p>
            <p className="text-xs text-gray-600 mt-1">{data?.pcr && data.pcr > 1 ? 'PE OI > CE OI' : 'CE OI > PE OI'}</p>
          </div>
          <div className="bg-gray-900/40 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-red-400 font-bold mb-2">🔴 CE Strikes</p>
            <div className="space-y-1">{data?.topCEStrikes?.slice(0,3).map((r: any) => (
              <div key={r.strike} className="flex justify-between text-xs"><span className="text-white font-bold">{r.strike.toLocaleString()}</span><span className="text-red-400">{fmtOI(r.ce_a)}</span></div>
            ))}</div>
          </div>
          <div className="bg-gray-900/40 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-emerald-400 font-bold mb-2">🟢 PE Strikes</p>
            <div className="space-y-1">{data?.topPEStrikes?.slice(0,3).map((r: any) => (
              <div key={r.strike} className="flex justify-between text-xs"><span className="text-white font-bold">{r.strike.toLocaleString()}</span><span className="text-emerald-400">{fmtOI(r.pe_a)}</span></div>
            ))}</div>
          </div>
          {data?.uoaItems?.length > 0 && (
            <div className="col-span-2 bg-yellow-950/20 border border-yellow-800/30 rounded-xl p-4">
              <p className="text-xs text-yellow-400 font-bold mb-2">🐋 Unusual Options Activity</p>
              <div className="space-y-1">{data.uoaItems.slice(0,3).map((u: any, i: number) => (
                <div key={i} className="flex justify-between text-xs"><span className="text-white">{u.tradingsymbol} · {u.signal_desc}</span><span className="text-yellow-400">Score {u.score}/5</span></div>
              ))}</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function MarketPulse() {
  const [analyses, setAnalyses]       = useState<IndexAnalysis[]>([])
  const [cmps, setCmps]               = useState<Record<string,number>>({})
  const [cprData, setCprData]         = useState<CPRRow[]>([])
  const [pulseStocks, setPulseStocks] = useState<PulseStock[]>(() => {
    try {
      const cached = sessionStorage.getItem('gn_breadth_stocks')
      const dateCached = sessionStorage.getItem('gn_breadth_cache')
      if (cached && dateCached) {
        const today = new Date().toISOString().slice(0, 10)
        const meta = JSON.parse(dateCached)
        if (meta.date === today) return JSON.parse(cached)
      }
    } catch {}
    return []
  })
  const [breadth, setBreadth] = useState(() => {
    try {
      const cached = sessionStorage.getItem('gn_breadth_cache')
      if (cached) {
        const parsed = JSON.parse(cached)
        const today = new Date().toISOString().slice(0, 10)
        if (parsed.date === today) return { bullish: parsed.bullish, bearish: parsed.bearish, neutral: parsed.neutral, total: parsed.total }
      }
    } catch {}
    return { bullish:0, bearish:0, neutral:0, total:0 }
  })
  const [loading, setLoading]         = useState(true)
  const [lastUpdate, setLastUpdate]   = useState('')
  const [searchedSymbol, setSearchedSymbol] = useState<string|null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [uoaSignals, setUoaSignals]   = useState<any[]>([])
  const [activeSector, setActiveSector] = useState<string|null>(null)
  const [activeBreadth, setActiveBreadth] = useState<'bullish'|'bearish'|'neutral'|null>(null)

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
      const cached = sessionStorage.getItem('gn_cpr_cache')
      const cacheTime = sessionStorage.getItem('gn_cpr_time')
      const cacheAge = cacheTime ? Date.now() - Number(cacheTime) : Infinity
      if (cached && cacheAge < 5 * 60 * 1000) { setCprData(JSON.parse(cached)); setLoading(false) }
    } catch {}
    try {
      const [cprRes, pulseRes, uoaRes] = await Promise.all([
        fetch(`${API}/cpr-scanner`),
        fetch(`${API}/oi-pulse`),
        fetch(`${API}/uoa`)
      ])
      const [cprJson, pulseJson, uoaJson] = await Promise.all([cprRes.json(), pulseRes.json(), uoaRes.json()])
      setUoaSignals(uoaJson?.signals || [])
      const cprRows: CPRRow[] = cprJson?.data || []
      setCprData(cprRows)
      try {
        sessionStorage.setItem('gn_cpr_cache', JSON.stringify(cprRows))
        sessionStorage.setItem('gn_cpr_time', String(Date.now()))
      } catch {}
      const cprMap = Object.fromEntries(cprRows.map((c: CPRRow) => [c.symbol, c]))
      const pulseItems = pulseJson?.items || []
      const enrichedPulse: PulseStock[] = pulseItems.map((p: any) => ({
        symbol: p.symbol, cmp: p.ltp || p.cmp || 0,
        oi_chg_pct: p.oi_chg_pct || 0, price_chg_pct: p.price_chg_pct || 0,
        signal: p.signal || 'NEUTRAL', label: p.label || '—',
        oi_now: p.oi_now, oi_prev: p.oi_prev, vol_surge: p.vol_surge || false,
        has_oi_signal: (cprMap[p.symbol] as CPRRow)?.has_oi_signal || false,
        width_pct: (cprMap[p.symbol] as CPRRow)?.width_pct,
        width_pts: (cprMap[p.symbol] as CPRRow)?.width_pts,
        width_emoji: (cprMap[p.symbol] as CPRRow)?.width_emoji,
        cpr_position: (cprMap[p.symbol] as CPRRow)?.cpr_position,
        confluence: (cprMap[p.symbol] as CPRRow)?.confluence || false,
      }))
      setPulseStocks(enrichedPulse)
      setLoading(false)
      let bull=0, bear=0, neut=0
      pulseItems.forEach((s: any) => {
        if (s.price_chg_pct > 0) bull++
        else if (s.price_chg_pct < 0) bear++
        else neut++
      })
      const newBreadth = { bullish:bull, bearish:bear, neutral:neut, total:pulseItems.length }
      setBreadth(newBreadth)
      // Persist EOD breadth so it survives post-market page refreshes
      if (pulseItems.length > 0) {
        try {
          const today = new Date().toISOString().slice(0, 10)
          sessionStorage.setItem('gn_breadth_cache', JSON.stringify({ ...newBreadth, date: today }))
          sessionStorage.setItem('gn_breadth_stocks', JSON.stringify(pulseItems))
        } catch {}
      }
      const { data: latest } = await supabase.from('oi_snapshots').select('timestamp').eq('symbol','NIFTY').eq('option_type','FUT')
        .gte('timestamp', new Date(Date.now()-2*24*60*60*1000).toISOString().slice(0,10)+'T00:00:00+00:00')
        .order('timestamp',{ascending:false}).limit(1)
      if (latest?.length) {
        const ts = latest[0].timestamp
        setLastUpdate(new Date(ts).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short',timeZone:'UTC'}))
        const [cmpResult, ...indexBatches] = await Promise.all([
          supabase.from('cmp_prices').select('symbol,cmp').order('timestamp',{ascending:false}).limit(200),
          supabase.from('oi_snapshots').select('symbol,strike,option_type,oi,volume,last_price,expiry').eq('timestamp',ts).in('symbol',['NIFTY','BANKNIFTY','FINNIFTY']).range(0,999),
          supabase.from('oi_snapshots').select('symbol,strike,option_type,oi,volume,last_price,expiry').eq('timestamp',ts).in('symbol',['NIFTY','BANKNIFTY','FINNIFTY']).range(1000,1999),
        ])
        const cmpMap2: Record<string,number> = {}
        const seen = new Set<string>()
        cmpResult.data?.forEach((c:any) => { if(!seen.has(c.symbol)){cmpMap2[c.symbol]=c.cmp;seen.add(c.symbol)} })
        setCmps(cmpMap2)
        const indexData = indexBatches.flatMap(b => b.data || [])
        const results = ['NIFTY','BANKNIFTY','FINNIFTY']
          .map(s => analyzeIndex(indexData as OIRecord[], s, cmpMap2[s]||0))
          .filter(Boolean) as IndexAnalysis[]
        setAnalyses(results)
      }
    } catch(e) { console.error(e) }
    setLoading(false)
  }

  const { enabled: autoEnabled, toggle: toggleAuto, countdownStr } = useAutoRefresh(fetchData)
  useEffect(() => { fetchData() }, [])

  const cprMap = Object.fromEntries(cprData.map(c => [c.symbol, c]))
  const warZoneCount = pulseStocks.filter(s => (s.width_pct||1)<0.3 && s.has_oi_signal).length
  const feedStocks: PulseStock[] = pulseStocks.length > 0 ? pulseStocks : cprData.map(c => ({
    symbol: c.symbol, cmp: c.last_cmp||c.cmp||0, oi_chg_pct:0, price_chg_pct:0,
    signal:'NEUTRAL', label:'—', has_oi_signal:c.has_oi_signal||false,
    width_pct:c.width_pct, width_pts:c.width_pts, width_emoji:c.width_emoji,
    cpr_position:c.cpr_position, confluence:c.confluence||false,
  }))
  const suggestions = searchQuery.length >= 1 ? ALL_SYMBOLS.filter(s => s.startsWith(searchQuery.toUpperCase())).slice(0,8) : []

  return (
    <div className="min-h-screen bg-[#07070e] text-white">
      <Navbar active="/"/>
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
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${a.pcr>1?'text-emerald-400 bg-emerald-950':'text-red-400 bg-red-950'}`}>PCR {a.pcr.toFixed(2)}</span>
              </button>
            ))}
            {warZoneCount > 0 && (
              <span className="flex items-center gap-1 text-xs text-orange-400 font-bold flex-shrink-0">
                <Zap size={10}/>{warZoneCount} War Zone
              </span>
            )}
          </div>
          <ExpiryCountdown/>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
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
            <button onClick={toggleAuto} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${autoEnabled?'bg-emerald-950/60 text-emerald-400 border-emerald-800/60':'bg-gray-900/40 text-gray-500 border-gray-800'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${autoEnabled?'bg-emerald-400 animate-pulse':'bg-gray-600'}`}/>
              {autoEnabled ? countdownStr : 'Auto'}
            </button>
            <button onClick={fetchData} disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-sm font-medium text-white rounded-lg border border-gray-700 transition-all">
              <RefreshCw size={13} className={loading?'animate-spin':''}/>Refresh
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"/>
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value.toUpperCase())}
                onKeyDown={e => e.key==='Enter' && searchQuery && setSearchedSymbol(searchQuery)}
                placeholder="Deep dive any F&O stock… RELIANCE, TCS, NIFTY"
                className="w-full bg-gray-900 border border-gray-700 text-white text-sm rounded-xl pl-9 pr-4 py-3 focus:outline-none focus:border-emerald-500 placeholder:text-gray-600"/>
              {suggestions.length > 0 && !searchedSymbol && (
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
        {loading && analyses.length === 0 ? (
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[1,2,3].map(i => (
              <div key={i} className="rounded-2xl border border-gray-800 bg-gray-900/30 p-5 animate-pulse space-y-4">
                <div className="flex justify-between"><div className="h-5 w-24 bg-gray-800 rounded"/><div className="h-6 w-20 bg-gray-800 rounded-full"/></div>
                <div className="grid grid-cols-3 gap-2">{[1,2,3].map(j=><div key={j} className="h-16 bg-gray-800 rounded-xl"/>)}</div>
              </div>
            ))}
          </div>
        ) : analyses.length > 0 ? (
          <div className="grid grid-cols-3 gap-4 mb-6">
            {analyses.map(a => (
              <div key={a.symbol} onClick={() => setSearchedSymbol(a.symbol)} className="cursor-pointer">
                <IndexCard a={a} cpr={cprMap[a.symbol]} cmp={cmps[a.symbol]}/>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center mb-6">
            <div className="flex items-center gap-2 text-gray-600 text-sm">
              <RefreshCw size={14} className="animate-spin"/>Loading index data...
            </div>
          </div>
        )}
        
        {/* Sector Performance */}
{feedStocks.length > 0 && (() => {
  const sectorPerf = getSectorPerf(feedStocks.filter(s => !['NIFTY','BANKNIFTY','FINNIFTY'].includes(s.symbol)))
  const hasData = sectorPerf.some(s => s.avg !== 0)
  
  const sectorStocks = activeSector
    ? feedStocks.filter(s => (SECTOR_MAP[activeSector] || []).includes(s.symbol))
        .sort((a, b) => (b.price_chg_pct || 0) - (a.price_chg_pct || 0))
    : []

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Sector Performance</h2>
        <span className="text-xs text-gray-600">{hasData ? 'Avg % change · click sector to drill down' : 'CPR-based ranking'}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {sectorPerf.map(({ sector, avg, count }) => (
          <button key={sector}
            onClick={() => setActiveSector(activeSector === sector ? null : sector)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all
              ${activeSector === sector
                ? 'ring-1 ring-white/30 scale-105'
                : 'hover:scale-105'
              }
              ${avg > 0 ? 'bg-emerald-950/40 border-emerald-800/50' : avg < 0 ? 'bg-red-950/40 border-red-800/50' : 'bg-gray-900/40 border-gray-800/50'}`}>
            <span className="text-gray-300 font-normal">{sector}</span>
            <span className={avg > 0 ? 'text-emerald-400 font-bold' : avg < 0 ? 'text-red-400 font-bold' : 'text-gray-500'}>
              {avg > 0 ? '+' : ''}{avg}%
            </span>
            <span className="text-gray-600">({count})</span>
            <span className="text-gray-600 text-[10px]">{activeSector === sector ? '▲' : '▼'}</span>
          </button>
        ))}
      </div>

      {/* Drill-down panel */}
      {activeSector && sectorStocks.length > 0 && (
        <div className="mt-3 bg-gray-900/30 border border-gray-700/50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-white">{activeSector} — {sectorStocks.length} stocks</p>
            <button onClick={() => setActiveSector(null)} className="text-gray-600 hover:text-white text-xs">✕ close</button>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {sectorStocks.map(s => (
              <button key={s.symbol}
                onClick={() => { setSearchedSymbol(s.symbol); setSearchQuery(s.symbol) }}
                className="flex items-center justify-between bg-gray-800/50 border border-gray-700/40 rounded-lg px-3 py-2 hover:bg-gray-800 transition-colors text-left">
                <div>
                  <p className="text-xs font-bold text-white">{s.symbol}</p>
                  <p className="text-[10px] text-gray-500">{s.cmp ? `₹${s.cmp.toLocaleString()}` : '—'}</p>
                </div>
                <span className={`text-xs font-bold ${(s.price_chg_pct||0) > 0 ? 'text-emerald-400' : (s.price_chg_pct||0) < 0 ? 'text-red-400' : 'text-gray-500'}`}>
                  {(s.price_chg_pct||0) > 0 ? '+' : ''}{s.price_chg_pct?.toFixed(2) ?? '0.00'}%
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
})()}

        {/* Spotlight */}
        {feedStocks.length > 0 && <Spotlight stocks={feedStocks} cprData={cprData}/>}

        {/* Activity Leaders */}
        {feedStocks.length > 0 && (
          <ActivityLeaders
            stocks={feedStocks}
            uoaSignals={uoaSignals}
            onSymbolClick={(sym) => { setSearchedSymbol(sym); setSearchQuery(sym) }}
          />
        )}

        {/* Vol + OI Breakout */}
        <VolOIBreakout onSymbolClick={(sym) => { setSearchedSymbol(sym); setSearchQuery(sym) }}/>

        {/* Market Breadth */}
        {breadth.total > 0 && (
          <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-sm font-bold text-white">Market Breadth</h3>
                <p className="text-xs text-gray-500">{breadth.total} F&O symbols</p>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <button onClick={() => setActiveBreadth(activeBreadth === 'bullish' ? null : 'bullish')}
                  className={`font-bold transition-all px-2 py-1 rounded-lg ${activeBreadth === 'bullish' ? 'bg-emerald-950 text-emerald-300 ring-1 ring-emerald-700' : 'text-emerald-400 hover:bg-emerald-950/40'}`}>
                  {breadth.bullish} Bullish
                </button>
                <button onClick={() => setActiveBreadth(activeBreadth === 'neutral' ? null : 'neutral')}
                  className={`font-bold transition-all px-2 py-1 rounded-lg ${activeBreadth === 'neutral' ? 'bg-amber-950 text-amber-300 ring-1 ring-amber-700' : 'text-amber-400 hover:bg-amber-950/40'}`}>
                  {breadth.neutral} Neutral
                </button>
                <button onClick={() => setActiveBreadth(activeBreadth === 'bearish' ? null : 'bearish')}
                  className={`font-bold transition-all px-2 py-1 rounded-lg ${activeBreadth === 'bearish' ? 'bg-red-950 text-red-300 ring-1 ring-red-700' : 'text-red-400 hover:bg-red-950/40'}`}>
                  {breadth.bearish} Bearish
                </button>
              </div>
            </div>
            <div className="h-2 rounded-full overflow-hidden flex">
              <div className="bg-emerald-500 h-full transition-all" style={{width:`${Math.round(breadth.bullish/breadth.total*100)}%`}}/>
              <div className="bg-amber-500/70 h-full transition-all" style={{width:`${Math.round(breadth.neutral/breadth.total*100)}%`}}/>
              <div className="bg-red-500 h-full transition-all" style={{width:`${Math.round(breadth.bearish/breadth.total*100)}%`}}/>
            </div>

            {/* Drill-down panel */}
            {activeBreadth && (() => {
              const filtered = pulseStocks.filter(s => {
                if (activeBreadth === 'bullish') return s.price_chg_pct > 0
                if (activeBreadth === 'bearish') return s.price_chg_pct < 0
                return s.price_chg_pct === 0
              }).sort((a, b) => Math.abs(b.price_chg_pct || 0) - Math.abs(a.price_chg_pct || 0))

              const titleColor = activeBreadth === 'bullish' ? 'text-emerald-400' : activeBreadth === 'bearish' ? 'text-red-400' : 'text-amber-400'
              const title = activeBreadth === 'bullish' ? '🐂 Advancing — Price up vs prev close'
                : activeBreadth === 'bearish' ? '🐻 Declining — Price down vs prev close'
                : '⚖️ Unchanged — flat vs prev close'

              return (
                <div className="mt-3 border-t border-gray-800/50 pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className={`text-xs font-bold ${titleColor}`}>{title} · {filtered.length} stocks</p>
                    <button onClick={() => setActiveBreadth(null)} className="text-gray-600 hover:text-white text-xs">✕</button>
                  </div>
                  <div className="grid grid-cols-4 gap-2 max-h-64 overflow-y-auto pr-1">
                    {filtered.map(s => (
                      <button key={s.symbol}
                        onClick={() => { setSearchedSymbol(s.symbol); setSearchQuery(s.symbol) }}
                        className="flex items-center justify-between bg-gray-800/50 border border-gray-700/40 rounded-lg px-3 py-2 hover:bg-gray-800 transition-colors text-left">
                        <div>
                          <p className="text-xs font-bold text-white">{s.symbol}</p>
                          <p className="text-[10px] text-gray-500">
                            {s.signal === 'LONG_BUILDUP' ? '🐂' : s.signal === 'SHORT_COVERING' ? '🔄' : s.signal === 'SHORT_BUILDUP' ? '🐻' : s.signal === 'LONG_UNWINDING' ? '⚠️' : '—'} OI {s.oi_chg_pct > 0 ? '+' : ''}{s.oi_chg_pct?.toFixed(1)}%
                          </p>
                        </div>
                        <span className={`text-xs font-bold ${(s.price_chg_pct||0) > 0 ? 'text-emerald-400' : (s.price_chg_pct||0) < 0 ? 'text-red-400' : 'text-gray-500'}`}>
                          {(s.price_chg_pct||0) > 0 ? '+' : ''}{s.price_chg_pct?.toFixed(2)}%
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )
            })()}
          </div>
        )}

        {/* Market Pulse Feed */}
        <div className="bg-gray-900/20 border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-black text-white">Market Pulse Feed</h2>
              <p className="text-xs text-gray-500 mt-0.5">All 66 F&O symbols · CPR + OI combined · War Zone ranked first · OI = prev close vs latest close</p>
            </div>
            {warZoneCount > 0 && (
              <div className="flex items-center gap-1.5 bg-orange-950/40 border border-orange-800/50 rounded-lg px-3 py-1.5">
                <Zap size={12} className="text-orange-400"/>
                <span className="text-xs font-bold text-orange-400">{warZoneCount} War Zone active</span>
              </div>
            )}
          </div>
          {feedStocks.length > 0
            ? <MarketPulseFeed stocks={feedStocks} cprData={cprData}/>
            : <div className="text-center py-12 text-gray-600 text-sm">{loading ? 'Loading…' : 'No data available'}</div>
          }
          {feedStocks.length > 0 && <ExtendedView stocks={feedStocks}/>}
        </div>

        {/* Disclaimer */}
        <div className="mt-6 bg-gray-900/20 border border-gray-800/40 rounded-xl p-3">
          <p className="text-xs text-gray-600">
            <span className="text-gray-400 font-semibold">Disclaimer:</span> All data is informational only. Not investment advice. GreekNova is not SEBI-registered. Always consult a SEBI-registered advisor before trading.
          </p>
        </div>
      </div>
    </div>
  )
}
