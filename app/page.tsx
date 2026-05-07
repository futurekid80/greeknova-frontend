'use client'
import Navbar from '@/components/Navbar'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { TrendingUp, TrendingDown, Minus, RefreshCw, Clock, Database, Search, X } from 'lucide-react'
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

interface OIRecord { symbol:string; strike:number; option_type:string; oi:number; volume:number; last_price:number; timestamp:string }
interface IndexAnalysis { symbol:string; pcr:number; totalCEOI:number; totalPEOI:number; maxPain:number; posture:'BULLISH'|'BEARISH'|'NEUTRAL'; postureStrength:number; topCEStrike:number; topPEStrike:number }

interface StockSummary {
  symbol: string
  cmp: number | null
  oi_signal: string
  oi_label: string
  oi_chg_pct: number
  price_chg_pct: number
  pcr: number | null
  max_pain: number | null
  dist_from_mp: number | null
  direction: string
  top_ce_strike: number | null
  top_pe_strike: number | null
  atm_strike: number | null
}

function fmtOI(n: number) {
  const abs = Math.abs(n)
  if (abs >= 10000000) return `${(n/10000000).toFixed(2)}Cr`
  if (abs >= 100000) return `${(n/100000).toFixed(1)}L`
  return n.toLocaleString()
}

function analyzeIndex(data: OIRecord[], symbol: string): IndexAnalysis | null {
  const rows = data.filter(d => d.symbol === symbol)
  if (!rows.length) return null
  const ce = rows.filter(d => d.option_type === 'CE')
  const pe = rows.filter(d => d.option_type === 'PE')
  const totalCEOI = ce.reduce((s,d) => s+d.oi, 0)
  const totalPEOI = pe.reduce((s,d) => s+d.oi, 0)
  const pcr = totalCEOI > 0 ? totalPEOI/totalCEOI : 0
  const strikes = [...new Set(rows.map(d=>d.strike))].sort((a,b)=>a-b)
  let maxPain = strikes[0]||0, minLoss = Infinity
  for (const s of strikes) {
    let loss = 0
    ce.forEach(r => { if(s>r.strike) loss+=(s-r.strike)*r.oi })
    pe.forEach(r => { if(s<r.strike) loss+=(r.strike-s)*r.oi })
    if (loss<minLoss) { minLoss=loss; maxPain=s }
  }
  const topCE = [...ce].sort((a,b)=>b.oi-a.oi)[0]
  const topPE = [...pe].sort((a,b)=>b.oi-a.oi)[0]
  let posture:'BULLISH'|'BEARISH'|'NEUTRAL' = 'NEUTRAL', postureStrength = 50
  if (pcr>1.2) { posture='BULLISH'; postureStrength=Math.min(95,55+(pcr-1.2)*25) }
  else if (pcr<0.8) { posture='BEARISH'; postureStrength=Math.min(95,55+(0.8-pcr)*40) }
  return { symbol, pcr:Math.round(pcr*100)/100, totalCEOI, totalPEOI, maxPain, posture, postureStrength:Math.round(postureStrength), topCEStrike:topCE?.strike||0, topPEStrike:topPE?.strike||0 }
}

function IndexCard({ a }: { a: IndexAnalysis }) {
  const bull = a.posture==='BULLISH', bear = a.posture==='BEARISH'
  const ceP = Math.round((a.totalCEOI/(a.totalCEOI+a.totalPEOI))*100)
  return (
    <div className="relative rounded-2xl border border-gray-800 bg-gray-900/40 p-5 overflow-hidden hover:border-gray-700 transition-all duration-300">
      <div className={`absolute -top-8 -right-8 w-32 h-32 rounded-full blur-2xl opacity-15 ${bull?'bg-emerald-500':bear?'bg-red-500':'bg-amber-500'}`}/>
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="text-base font-bold text-white tracking-wide">{a.symbol}</h3>
            <p className="text-xs text-gray-600 mt-0.5">Index Options</p>
          </div>
          <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${bull?'bg-emerald-950/80 text-emerald-400 border-emerald-800/60':bear?'bg-red-950/80 text-red-400 border-red-800/60':'bg-amber-950/80 text-amber-400 border-amber-800/60'}`}>
            {bull?<TrendingUp size={11}/>:bear?<TrendingDown size={11}/>:<Minus size={11}/>}
            {a.posture}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { label:'PCR', value:a.pcr.toFixed(2), colored:true },
            { label:'Max Pain', value:a.maxPain.toLocaleString(), colored:false },
            { label:'Conviction', value:`${a.postureStrength}%`, colored:false },
          ].map(m => (
            <div key={m.label} className="bg-gray-800/50 rounded-xl p-3 border border-gray-700/40">
              <p className="text-xs text-gray-500 mb-1.5">{m.label}</p>
              <p className={`text-lg font-bold ${m.colored?(bull?'text-emerald-400':bear?'text-red-400':'text-amber-400'):'text-white'}`}>{m.value}</p>
            </div>
          ))}
        </div>
        <div className="mb-3.5">
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-red-400 font-medium">CE {ceP}%</span>
            <span className="text-gray-500 text-xs">OI Split</span>
            <span className="text-emerald-400 font-medium">PE {100-ceP}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-gray-800 overflow-hidden flex">
            <div className="bg-red-500/80 h-full rounded-l-full transition-all duration-700" style={{width:`${ceP}%`}}/>
            <div className="bg-emerald-500/80 h-full rounded-r-full transition-all duration-700" style={{width:`${100-ceP}%`}}/>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="flex-1 flex items-center justify-between bg-red-950/20 border border-red-900/30 rounded-lg px-3 py-2">
            <span className="text-xs text-gray-500">CE Wall</span>
            <span className="text-xs font-bold text-red-400">{a.topCEStrike.toLocaleString()}</span>
          </div>
          <div className="flex-1 flex items-center justify-between bg-emerald-950/20 border border-emerald-900/30 rounded-lg px-3 py-2">
            <span className="text-xs text-gray-500">PE Wall</span>
            <span className="text-xs font-bold text-emerald-400">{a.topPEStrike.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  )
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
      if (daysToExpiry === 0) {
        const expiryToday = new Date(ist)
        expiryToday.setHours(15, 30, 0, 0)
        if (ist >= expiryToday) daysToExpiry = 7
      }
      const expiry = new Date(ist)
      expiry.setDate(ist.getDate() + daysToExpiry)
      expiry.setHours(15, 30, 0, 0)
      const diff = expiry.getTime() - ist.getTime()
      if (diff <= 0) { setTimeLeft('EXPIRED'); return }
      const days = Math.floor(diff / (1000*60*60*24))
      const hours = Math.floor((diff % (1000*60*60*24)) / (1000*60*60))
      const mins = Math.floor((diff % (1000*60*60)) / (1000*60))
      const secs = Math.floor((diff % (1000*60)) / 1000)
      setDaysLeft(days)
      if (days === 0) { setLabel('EXPIRY TODAY'); setTimeLeft(`${hours.toString().padStart(2,'0')}:${mins.toString().padStart(2,'0')}:${secs.toString().padStart(2,'0')}`) }
      else if (days === 1) { setLabel('EXPIRY TOMORROW'); setTimeLeft(`${hours}h ${mins}m`) }
      else { setLabel(`EXPIRY IN ${days}D`); setTimeLeft(`${days}d ${hours}h`) }
    }
    calc()
    const t = setInterval(calc, 1000)
    return () => clearInterval(t)
  }, [])

  const isToday = daysLeft === 0, isTomorrow = daysLeft === 1
  return (
    <div className={`flex-shrink-0 flex items-center gap-2 px-4 h-full border-l ml-auto ${isToday?'border-red-800/50 bg-red-950/30':isTomorrow?'border-orange-800/50 bg-orange-950/20':'border-gray-800/50'}`}>
      <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${isToday?'bg-red-400':isTomorrow?'bg-orange-400':'bg-gray-600'}`}/>
      <div>
        <p className={`text-xs font-black ${isToday?'text-red-400':isTomorrow?'text-orange-400':'text-gray-500'}`}>{label}</p>
        <p className={`text-sm font-black font-mono ${isToday?'text-red-300':isTomorrow?'text-orange-300':'text-gray-400'}`}>{timeLeft}</p>
      </div>
    </div>
  )
}

// ─── Stock Summary Card ───────────────────────────────────────────────────────
function StockSummaryCard({ summary, onClose }: { summary: StockSummary; onClose: () => void }) {
  const signalColors: Record<string, string> = {
    LONG_BUILDUP:   'text-emerald-400 bg-emerald-950/30 border-emerald-800/40',
    SHORT_BUILDUP:  'text-red-400 bg-red-950/30 border-red-800/40',
    SHORT_COVERING: 'text-cyan-400 bg-cyan-950/30 border-cyan-800/40',
    LONG_UNWINDING: 'text-orange-400 bg-orange-950/30 border-orange-800/40',
    NEUTRAL:        'text-gray-400 bg-gray-900/30 border-gray-800',
  }
  const sc = signalColors[summary.oi_signal] || signalColors.NEUTRAL
  const isBullishMP = summary.direction === 'BELOW'

  return (
    <div className="bg-gray-900/60 border border-gray-700 rounded-2xl p-5 mb-8 relative">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-black text-white">{summary.symbol}</h2>
              <a href={`/stock/${summary.symbol}`} className="text-xs text-emerald-400 hover:text-emerald-300 border border-emerald-800/50 px-2 py-0.5 rounded-lg transition-colors">Full Details →</a>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">F&O Summary · Live Snapshot</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {summary.cmp && (
            <div className="text-right">
              <p className="text-2xl font-black text-amber-400">₹{summary.cmp.toLocaleString()}</p>
              <p className={`text-xs font-bold ${summary.price_chg_pct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {summary.price_chg_pct >= 0 ? '+' : ''}{summary.price_chg_pct.toFixed(2)}% today
              </p>
            </div>
          )}
          <button onClick={onClose} className="text-gray-600 hover:text-white transition-colors p-1">
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {/* OI Signal */}
        <div className={`rounded-xl p-3 border ${sc}`}>
          <p className="text-xs text-gray-500 mb-1">OI Signal</p>
          <p className="text-sm font-black">{summary.oi_label}</p>
          <p className="text-xs mt-0.5 opacity-70">OI {summary.oi_chg_pct >= 0 ? '+' : ''}{summary.oi_chg_pct.toFixed(2)}%</p>
        </div>

        {/* PCR */}
        <div className="rounded-xl p-3 border border-gray-800 bg-gray-900/30">
          <p className="text-xs text-gray-500 mb-1">PCR</p>
          <p className={`text-xl font-black ${summary.pcr && summary.pcr > 1 ? 'text-emerald-400' : 'text-red-400'}`}>
            {summary.pcr?.toFixed(2) ?? '—'}
          </p>
          <p className="text-xs text-gray-600 mt-0.5">{summary.pcr && summary.pcr > 1 ? 'Bullish tilt' : 'Bearish tilt'}</p>
        </div>

        {/* Max Pain */}
        <div className={`rounded-xl p-3 border ${isBullishMP ? 'border-emerald-800/40 bg-emerald-950/20' : 'border-orange-800/40 bg-orange-950/20'}`}>
          <p className="text-xs text-gray-500 mb-1">Max Pain</p>
          <p className="text-xl font-black text-white">₹{summary.max_pain?.toLocaleString() ?? '—'}</p>
          <p className={`text-xs mt-0.5 font-semibold ${isBullishMP ? 'text-emerald-400' : 'text-orange-400'}`}>
            {summary.direction === 'ABOVE' ? `↑ ${summary.dist_from_mp?.toFixed(1)}% above` : `↓ ${Math.abs(summary.dist_from_mp ?? 0).toFixed(1)}% below`}
          </p>
        </div>

        {/* ATM Strike */}
        <div className="rounded-xl p-3 border border-amber-800/40 bg-amber-950/20">
          <p className="text-xs text-gray-500 mb-1">ATM Strike</p>
          <p className="text-xl font-black text-amber-400">{summary.atm_strike?.toLocaleString() ?? '—'}</p>
          <p className="text-xs text-gray-600 mt-0.5">Nearest to CMP</p>
        </div>
      </div>

      {/* CE/PE Walls */}
      <div className="flex gap-3">
        <div className="flex-1 flex items-center justify-between bg-red-950/20 border border-red-900/30 rounded-xl px-4 py-3">
          <div>
            <p className="text-xs text-gray-500">Top CE Strike (Resistance)</p>
            <p className="text-lg font-black text-red-400">{summary.top_ce_strike?.toLocaleString() ?? '—'}</p>
          </div>
          <span className="text-2xl">🧱</span>
        </div>
        <div className="flex-1 flex items-center justify-between bg-emerald-950/20 border border-emerald-900/30 rounded-xl px-4 py-3">
          <div>
            <p className="text-xs text-gray-500">Top PE Strike (Support)</p>
            <p className="text-lg font-black text-emerald-400">{summary.top_pe_strike?.toLocaleString() ?? '—'}</p>
          </div>
          <span className="text-2xl">🛡️</span>
        </div>
      </div>
    </div>
  )
}

// ─── Search Bar ───────────────────────────────────────────────────────────────
function StockSearch({ onResult }: { onResult: (s: StockSummary) => void }) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  const filtered = query.length >= 1
    ? ALL_SYMBOLS.filter(s => s.startsWith(query.toUpperCase())).slice(0, 8)
    : []

  async function search(sym: string) {
    setLoading(true)
    setQuery(sym)
    setSuggestions([])
    try {
      // Fetch OI pulse data for signal
      const [pulseRes, mpRes, oiRes] = await Promise.all([
        fetch(`${API}/oi-pulse`),
        fetch(`${API}/max-pain`),
        fetch(`${API}/oi-history/${sym}`),
      ])
      const pulse = await pulseRes.json()
      const mp = await mpRes.json()
      const oi = await oiRes.json()

      const pulseItem = pulse.items?.find((i: any) => i.symbol === sym)
      const mpItem = mp.symbols?.find((i: any) => i.symbol === sym)

      // Get top CE/PE strikes from OI history
      const rows = oi.rows || []
      const topCE = rows.reduce((best: any, r: any) => !best || r.ce_a > best.ce_a ? r : best, null)
      const topPE = rows.reduce((best: any, r: any) => !best || r.pe_a > best.pe_a ? r : best, null)

      // Calculate PCR from OI history rows
      const totalCE = rows.reduce((s: number, r: any) => s + (r.ce_a || 0), 0)
      const totalPE = rows.reduce((s: number, r: any) => s + (r.pe_a || 0), 0)
      const pcr = totalCE > 0 ? Math.round((totalPE / totalCE) * 100) / 100 : null

      onResult({
        symbol: sym,
        cmp: pulseItem?.ltp ?? mpItem?.cmp ?? null,
        oi_signal: pulseItem?.signal ?? 'NEUTRAL',
        oi_label: pulseItem?.label ?? 'Neutral',
        oi_chg_pct: pulseItem?.oi_chg_pct ?? 0,
        price_chg_pct: pulseItem?.price_chg_pct ?? 0,
        pcr,
        max_pain: mpItem?.max_pain ?? null,
        dist_from_mp: mpItem?.dist_from_mp ?? null,
        direction: mpItem?.direction ?? 'ABOVE',
        top_ce_strike: topCE?.strike ?? null,
        top_pe_strike: topPE?.strike ?? null,
        atm_strike: oi.atm_strike ?? null,
      })
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  return (
    <div className="relative mb-8">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={query}
            onChange={e => { setQuery(e.target.value.toUpperCase()); setSuggestions(filtered) }}
            onFocus={() => setSuggestions(filtered)}
            placeholder="Search any F&O stock or index… e.g. TCS, NIFTY, RELIANCE"
            className="w-full bg-gray-900 border border-gray-700 text-white text-sm rounded-xl pl-9 pr-4 py-3 focus:outline-none focus:border-emerald-500 transition-colors placeholder:text-gray-600"
          />
          {/* Suggestions dropdown */}
          {suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-gray-900 border border-gray-700 rounded-xl overflow-hidden z-50 shadow-xl">
              {suggestions.map(s => (
                <button key={s} onClick={() => search(s)}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors font-medium">
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
        <button onClick={() => query && search(query)} disabled={loading || !query}
          className="flex items-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-sm rounded-xl transition-all">
          {loading ? <RefreshCw size={14} className="animate-spin" /> : <Search size={14} />}
          {loading ? 'Loading…' : 'Search'}
        </button>
      </div>
    </div>
  )
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const [analyses, setAnalyses] = useState<IndexAnalysis[]>([])
  const [cmps, setCmps] = useState<Record<string,number>>({})
  const [breadth, setBreadth] = useState({ bullish: 0, bearish: 0, neutral: 0, total: 0 })
  const [loading, setLoading] = useState(true)
  const { enabled: autoEnabled, toggle: toggleAuto, countdownStr } = useAutoRefresh(fetchData)
  const [recordCount, setRecordCount] = useState(0)
  const [lastUpdate, setLastUpdate] = useState('')
  const [stockSummary, setStockSummary] = useState<StockSummary | null>(null)

  async function fetchData() {
    setLoading(true)
    try {
      const { data:latest } = await supabase.from('oi_snapshots').select('timestamp').order('timestamp',{ascending:false}).limit(1)
      if(!latest?.length) { setLoading(false); return }
      const ts = latest[0].timestamp
      setLastUpdate(new Date(ts).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }))
      const { data, count } = await supabase.from('oi_snapshots').select('*',{count:'exact'}).eq('timestamp',ts)
      if(data) {
        setRecordCount(count||0)
        const results = ['NIFTY','BANKNIFTY','FINNIFTY'].map(s=>analyzeIndex(data as OIRecord[],s)).filter(Boolean) as IndexAnalysis[]
        setAnalyses(results)
        const { data: cmpData } = await supabase.from('cmp_prices').select('*').order('timestamp', { ascending: false }).limit(200)
        const cmpMap: Record<string,number> = {}
        const seen = new Set()
        cmpData?.forEach((c:any) => { if (!seen.has(c.symbol)) { cmpMap[c.symbol] = c.cmp; seen.add(c.symbol) } })
        setCmps(cmpMap)
        const allSyms = [...new Set((data as any[]).map((d: any) => d.symbol))]
        let bull = 0, bear = 0, neut = 0
        for (const sym of allSyms) {
          const r = (data as any[]).filter((d: any) => d.symbol === sym)
          const ce = r.filter((d: any) => d.option_type === 'CE').reduce((s: number, d: any) => s + d.oi, 0)
          const pe = r.filter((d: any) => d.option_type === 'PE').reduce((s: number, d: any) => s + d.oi, 0)
          const pcr = ce > 0 ? pe / ce : 0
          if (pcr > 1.2) bull++; else if (pcr < 0.8) bear++; else neut++
        }
        setBreadth({ bullish: bull, bearish: bear, neutral: neut, total: allSyms.length })
      }
    } catch(e) { console.error(e) }
    setLoading(false)
  }

  useEffect(() => { fetchData() },[])

  const signals = [
    { name:'Put Writing', icon:'↑', iconBg:'bg-emerald-950/60 border-emerald-900/40', text:'text-emerald-400', desc:'Sellers building support. Bullish bias forming.' },
    { name:'Call Writing', icon:'↓', iconBg:'bg-red-950/60 border-red-900/40', text:'text-red-400', desc:'Ceiling erected. Distribution likely.' },
    { name:'IV Squeeze', icon:'⚡', iconBg:'bg-amber-950/60 border-amber-900/40', text:'text-amber-400', desc:'Coiling energy. Big move incoming.' },
    { name:'Battleground', icon:'⚔', iconBg:'bg-violet-950/60 border-violet-900/40', text:'text-violet-400', desc:'Aggressive two-way writing. Pin risk high.' },
  ]

  return (
    <div className="min-h-screen bg-[#07070e] text-white">
      <Navbar active="/" />

      {/* Live Ticker Bar */}
      <div className="bg-gray-950 border-b border-gray-800/50 overflow-hidden">
        <div className="flex items-center h-9">
          <div className="flex-shrink-0 bg-emerald-950 border-r border-emerald-800/50 px-3 h-full flex items-center">
            <span className="text-xs font-black text-emerald-400 tracking-wider">LIVE</span>
          </div>
          <div className="flex items-center gap-6 px-4 overflow-x-auto scrollbar-hide">
            {analyses.map(a => {
              const isUp = a.pcr > 1
              return (
                <a key={a.symbol} href={`/stock/${a.symbol}`} className="flex items-center gap-2 flex-shrink-0 hover:opacity-80 transition-opacity">
                  <span className="text-xs font-black text-white">{a.symbol}</span>
                  <span className="text-xs font-bold text-amber-400">₹{cmps[a.symbol]?.toLocaleString() || '—'}</span>
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${isUp?'text-emerald-400 bg-emerald-950':'text-red-400 bg-red-950'}`}>PCR {a.pcr.toFixed(2)}</span>
                </a>
              )
            })}
          </div>
          <ExpiryCountdown />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight mb-1">Index Intelligence</h1>
            <p className="text-gray-500 text-sm">Options flow · Greeks decoded · Posture mapped</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-gray-600 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2"><Clock size={11}/>{new Date().toLocaleString("en-IN", {dateStyle:"medium", timeStyle:"short", timeZone:"Asia/Kolkata"})}</div>
            {lastUpdate && <div className="flex items-center gap-1.5 text-xs text-gray-600 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 ml-1">📸 {lastUpdate}</div>}
            <button onClick={toggleAuto} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${autoEnabled?"bg-emerald-950/60 text-emerald-400 border-emerald-800/60":"bg-gray-900/40 text-gray-500 border-gray-800"}`}><div className={`w-1.5 h-1.5 rounded-full ${autoEnabled?"bg-emerald-400 animate-pulse":"bg-gray-600"}`}/>{autoEnabled?countdownStr:"Auto"}</button>
            <button onClick={fetchData} disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-sm font-medium text-white rounded-lg border border-gray-700 transition-all">
              <RefreshCw size={13} className={loading?'animate-spin':''}/>Refresh
            </button>
          </div>
        </div>

        {/* ── STOCK SEARCH ── */}
        <StockSearch onResult={setStockSummary} />

        {/* ── STOCK SUMMARY RESULT ── */}
        {stockSummary && <StockSummaryCard summary={stockSummary} onClose={() => setStockSummary(null)} />}

        <div className="grid grid-cols-4 gap-3 mb-8">
          {[
            { label:'Indices Tracked', value:'3', sub:'NSE F&O' },
            { label:'OI Records', value:recordCount?recordCount.toLocaleString():'—', sub:'Latest snapshot' },
            { label:'Capture Interval', value:'5 min', sub:'Auto-scheduled' },
            { label:'Data Retention', value:'∞', sub:'All history saved' },
          ].map(s => (
            <div key={s.label} className="bg-gray-900/30 border border-gray-800/60 rounded-xl p-4 hover:border-gray-700/60 transition-colors">
              <p className="text-xs text-gray-600 mb-1">{s.label}</p>
              <p className="text-2xl font-black text-white mb-0.5">{s.value}</p>
              <p className="text-xs text-gray-600">{s.sub}</p>
            </div>
          ))}
        </div>

        {breadth.total > 0 && (
          <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-white">Market Breadth</h3>
                <p className="text-xs text-gray-500">{breadth.total} F&O symbols · PCR-based sentiment</p>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500"/><span className="text-emerald-400 font-bold">{breadth.bullish} Bullish</span></span>
                <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-amber-500"/><span className="text-amber-400 font-bold">{breadth.neutral} Neutral</span></span>
                <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-red-500"/><span className="text-red-400 font-bold">{breadth.bearish} Bearish</span></span>
              </div>
            </div>
            <div className="h-3 rounded-full overflow-hidden flex">
              <div className="bg-emerald-500 h-full rounded-l-full transition-all duration-700" style={{ width: `${Math.round(breadth.bullish/breadth.total*100)}%` }}/>
              <div className="bg-amber-500/70 h-full transition-all duration-700" style={{ width: `${Math.round(breadth.neutral/breadth.total*100)}%` }}/>
              <div className="bg-red-500 h-full rounded-r-full transition-all duration-700" style={{ width: `${Math.round(breadth.bearish/breadth.total*100)}%` }}/>
            </div>
            <div className="flex justify-between text-xs text-gray-600 mt-1.5">
              <span>{Math.round(breadth.bullish/breadth.total*100)}% bullish</span>
              <span>{Math.round(breadth.bearish/breadth.total*100)}% bearish</span>
            </div>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-3 gap-4">
            {[1,2,3].map(i=>(
              <div key={i} className="rounded-2xl border border-gray-800 bg-gray-900/30 p-5 animate-pulse space-y-4">
                <div className="flex justify-between"><div className="h-5 w-24 bg-gray-800 rounded"/><div className="h-6 w-20 bg-gray-800 rounded-full"/></div>
                <div className="grid grid-cols-3 gap-2">{[1,2,3].map(j=><div key={j} className="h-16 bg-gray-800 rounded-xl"/>)}</div>
                <div className="h-1.5 bg-gray-800 rounded-full"/>
                <div className="flex gap-2"><div className="flex-1 h-8 bg-gray-800 rounded-lg"/><div className="flex-1 h-8 bg-gray-800 rounded-lg"/></div>
              </div>
            ))}
          </div>
        ) : analyses.length > 0 ? (
          <div className="grid grid-cols-3 gap-4">
            {analyses.map(a=><IndexCard key={a.symbol} a={a}/>)}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gray-900 border border-gray-800 flex items-center justify-center mb-4">
              <Database size={28} className="text-gray-700"/>
            </div>
            <h3 className="text-lg font-bold text-gray-400 mb-2">Waiting for market data</h3>
            <p className="text-sm text-gray-600 max-w-xs">OI capture runs automatically on weekdays 9:15 AM – 3:30 PM IST</p>
          </div>
        )}

        <div className="mt-10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-black text-white">Scanner Signals</h2>
              <p className="text-xs text-gray-600 mt-0.5">Powered by options flow intelligence</p>
            </div>
            <a href="/scanners" className="text-sm font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors">Open Scanners →</a>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {signals.map(s=>(
              <a href="/scanners" key={s.name} className="group bg-gray-900/30 border border-gray-800 rounded-xl p-4 hover:border-gray-600 hover:bg-gray-900/60 transition-all">
                <div className={`w-9 h-9 rounded-lg ${s.iconBg} border flex items-center justify-center text-lg mb-3 group-hover:scale-110 transition-transform`}>{s.icon}</div>
                <h4 className={`text-sm font-bold ${s.text} mb-1`}>{s.name}</h4>
                <p className="text-xs text-gray-600 leading-relaxed">{s.desc}</p>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}