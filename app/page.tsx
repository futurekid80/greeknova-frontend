'use client'
import Navbar from '@/components/Navbar'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { TrendingUp, TrendingDown, Minus, RefreshCw, Clock, Database, Search, X, ChevronDown, ChevronUp } from 'lucide-react'
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

function fmtOI(n: number) {
  const abs = Math.abs(n)
  if (abs >= 10000000) return `${(n/10000000).toFixed(2)}Cr`
  if (abs >= 100000) return `${(n/100000).toFixed(1)}L`
  return n.toLocaleString()
}
function fmtDate(d: string) {
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) } catch { return d }
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
    <div className="relative rounded-2xl border border-gray-800 bg-gray-900/40 p-5 overflow-hidden hover:border-emerald-700/50 hover:bg-gray-900/60 transition-all duration-300 cursor-pointer">
      <div className={`absolute -top-8 -right-8 w-32 h-32 rounded-full blur-2xl opacity-15 ${bull?'bg-emerald-500':bear?'bg-red-500':'bg-amber-500'}`}/>
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="text-base font-bold text-white tracking-wide">{a.symbol}</h3>
            <p className="text-xs text-gray-600 mt-0.5">Index Options · Click for details</p>
          </div>
          <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${bull?'bg-emerald-950/80 text-emerald-400 border-emerald-800/60':bear?'bg-red-950/80 text-red-400 border-red-800/60':'bg-amber-950/80 text-amber-400 border-amber-800/60'}`}>
            {bull?<TrendingUp size={11}/>:bear?<TrendingDown size={11}/>:<Minus size={11}/>}{a.posture}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[{label:'PCR',value:a.pcr.toFixed(2),colored:true},{label:'Max Pain',value:a.maxPain.toLocaleString(),colored:false},{label:'Conviction',value:`${a.postureStrength}%`,colored:false}].map(m => (
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
    <div className={`flex-shrink-0 flex items-center gap-2 px-4 h-full border-l ml-auto ${isToday?'border-red-800/50 bg-red-950/30':isTomorrow?'border-orange-800/50 bg-orange-950/20':'border-gray-800/50'}`}>
      <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${isToday?'bg-red-400':isTomorrow?'bg-orange-400':'bg-gray-600'}`}/>
      <div>
        <p className={`text-xs font-black ${isToday?'text-red-400':isTomorrow?'text-orange-400':'text-gray-500'}`}>{label}</p>
        <p className={`text-sm font-black font-mono ${isToday?'text-red-300':isTomorrow?'text-orange-300':'text-gray-400'}`}>{timeLeft}</p>
      </div>
    </div>
  )
}

function Section({ title, icon, color, children, defaultOpen = true }: { title: string; icon: string; color: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border border-gray-800 rounded-2xl overflow-hidden mb-4">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-5 py-4 bg-gray-900/50 hover:bg-gray-900/80 transition-colors">
        <div className="flex items-center gap-2">
          <span className="text-lg">{icon}</span>
          <span className={`text-sm font-bold ${color}`}>{title}</span>
        </div>
        {open ? <ChevronUp size={14} className="text-gray-500"/> : <ChevronDown size={14} className="text-gray-500"/>}
      </button>
      {open && <div className="p-5 bg-gray-900/20">{children}</div>}
    </div>
  )
}

function StockCommandCentre({ symbol, onClose }: { symbol: string; onClose: () => void }) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [pulseRes, mpRes, oiRes, uoaRes, volRes] = await Promise.all([
          fetch(`${API}/oi-pulse`),
          fetch(`${API}/max-pain`),
          fetch(`${API}/oi-history/${symbol}`),
          fetch(`${API}/uoa`),
          fetch(`${API}/volume-spikes?threshold=20`),
        ])
        const [pulse, mp, oi, uoa, vol] = await Promise.all([pulseRes.json(), mpRes.json(), oiRes.json(), uoaRes.json(), volRes.json()])
        const pulseItem = pulse.items?.find((i: any) => i.symbol === symbol)
        const mpItem = mp.symbols?.find((i: any) => i.symbol === symbol)
        const uoaItems = uoa.signals?.filter((i: any) => i.symbol === symbol) || []
        const volItems = vol.spikes?.filter((i: any) => i.symbol === symbol) || []
        const rows = oi.rows || []
        const totalCE = rows.reduce((s: number, r: any) => s + (r.ce_a || 0), 0)
        const totalPE = rows.reduce((s: number, r: any) => s + (r.pe_a || 0), 0)
        const pcr = totalCE > 0 ? Math.round((totalPE / totalCE) * 100) / 100 : null
        const topCEStrikes = [...rows].sort((a: any, b: any) => b.ce_a - a.ce_a).slice(0, 5)
        const topPEStrikes = [...rows].sort((a: any, b: any) => b.pe_a - a.pe_a).slice(0, 5)
        const totalCEBuilt = rows.filter((r: any) => r.ce_chg > 0).reduce((s: number, r: any) => s + r.ce_chg, 0)
        const totalPEBuilt = rows.filter((r: any) => r.pe_chg > 0).reduce((s: number, r: any) => s + r.pe_chg, 0)
        const totalCEUnwound = rows.filter((r: any) => r.ce_chg < 0).reduce((s: number, r: any) => s + r.ce_chg, 0)
        const totalPEUnwound = rows.filter((r: any) => r.pe_chg < 0).reduce((s: number, r: any) => s + r.pe_chg, 0)
        const bullish = totalPEBuilt + totalCEUnwound > totalCEBuilt + totalPEUnwound
        setData({ pulseItem, mpItem, oi, pcr, topCEStrikes, topPEStrikes, uoaItems, volItems, totalCEBuilt, totalPEBuilt, totalCEUnwound, totalPEUnwound, bullish, rows })
      } catch (e) { console.error(e) }
      setLoading(false)
    }
    load()
  }, [symbol])

  const signalColors: Record<string, string> = {
    LONG_BUILDUP:   'text-emerald-400 bg-emerald-950/30 border-emerald-800/40',
    SHORT_BUILDUP:  'text-red-400 bg-red-950/30 border-red-800/40',
    SHORT_COVERING: 'text-cyan-400 bg-cyan-950/30 border-cyan-800/40',
    LONG_UNWINDING: 'text-orange-400 bg-orange-950/30 border-orange-800/40',
    NEUTRAL:        'text-gray-400 bg-gray-900/30 border-gray-800',
  }

  return (
    <div className="bg-gray-900/60 border border-gray-700 rounded-2xl mb-8 overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gray-900/80">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-black text-white">{symbol}</h2>
          <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded-lg">Stock Command Centre</span>
          <a href={`/stock/${symbol}`} className="text-xs text-emerald-400 hover:text-emerald-300 border border-emerald-800/50 px-2 py-1 rounded-lg transition-colors">Full Page →</a>
        </div>
        <div className="flex items-center gap-3">
          {data?.pulseItem?.ltp && (
            <div className="text-right">
              <p className="text-xl font-black text-amber-400">₹{data.pulseItem.ltp.toLocaleString()}</p>
              <p className={`text-xs font-bold ${data.pulseItem.price_chg_pct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {data.pulseItem.price_chg_pct >= 0 ? '+' : ''}{data.pulseItem.price_chg_pct?.toFixed(2)}% today
              </p>
            </div>
          )}
          <button onClick={onClose} className="text-gray-600 hover:text-white transition-colors p-1"><X size={18}/></button>
        </div>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw size={24} className="text-gray-600 animate-spin"/>
          <span className="ml-3 text-gray-500 text-sm">Loading all data…</span>
        </div>
      ) : (
        <div className="p-5">
          <Section title="OI Signal — What's happening NOW" icon="⚡" color="text-white" defaultOpen={true}>
            {data?.pulseItem ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className={`rounded-xl p-4 border col-span-2 ${signalColors[data.pulseItem.signal] || signalColors.NEUTRAL}`}>
                  <p className="text-xs text-gray-500 mb-1">OI Signal</p>
                  <p className="text-2xl font-black">{data.pulseItem.label}</p>
                  <p className="text-sm mt-1 opacity-80">OI {data.pulseItem.oi_chg_pct >= 0 ? '+' : ''}{data.pulseItem.oi_chg_pct?.toFixed(2)}% · Price {data.pulseItem.price_chg_pct >= 0 ? '+' : ''}{data.pulseItem.price_chg_pct?.toFixed(2)}%</p>
                </div>
                <div className="rounded-xl p-4 border border-gray-800 bg-gray-900/30">
                  <p className="text-xs text-gray-500 mb-1">OI Now</p>
                  <p className="text-xl font-black text-white">{fmtOI(data.pulseItem.oi_now)}</p>
                  <p className="text-xs text-gray-600 mt-1">Prev: {fmtOI(data.pulseItem.oi_prev)}</p>
                </div>
                <div className="rounded-xl p-4 border border-gray-800 bg-gray-900/30">
                  <p className="text-xs text-gray-500 mb-1">ATM Strike</p>
                  <p className="text-xl font-black text-amber-400">{data.oi?.atm_strike?.toLocaleString() ?? '—'}</p>
                  <p className="text-xs text-gray-600 mt-1">Nearest to CMP</p>
                </div>
              </div>
            ) : <p className="text-gray-500 text-sm">No OI signal data available for {symbol}</p>}
          </Section>

          <Section title="Max Pain — Where price is gravitating" icon="🎯" color="text-amber-400" defaultOpen={true}>
            {data?.mpItem ? (
              <div className="grid grid-cols-3 gap-3">
                <div className={`rounded-xl p-4 border ${data.mpItem.direction === 'BELOW' ? 'border-emerald-800/40 bg-emerald-950/20' : 'border-orange-800/40 bg-orange-950/20'}`}>
                  <p className="text-xs text-gray-500 mb-1">Max Pain Level</p>
                  <p className="text-2xl font-black text-white">₹{data.mpItem.max_pain?.toLocaleString()}</p>
                  <p className={`text-sm font-bold mt-1 ${data.mpItem.direction === 'BELOW' ? 'text-emerald-400' : 'text-orange-400'}`}>
                    {data.mpItem.direction === 'ABOVE' ? `↑ CMP is ${data.mpItem.dist_from_mp?.toFixed(1)}% ABOVE — may fall` : `↓ CMP is ${Math.abs(data.mpItem.dist_from_mp ?? 0).toFixed(1)}% BELOW — may rise`}
                  </p>
                </div>
                <div className="rounded-xl p-4 border border-gray-800 bg-gray-900/30">
                  <p className="text-xs text-gray-500 mb-1">PCR</p>
                  <p className={`text-2xl font-black ${data.pcr && data.pcr > 1 ? 'text-emerald-400' : 'text-red-400'}`}>{data.pcr?.toFixed(2) ?? '—'}</p>
                  <p className="text-xs text-gray-600 mt-1">{data.pcr && data.pcr > 1 ? '🐂 Bullish tilt' : '🐻 Bearish tilt'}</p>
                </div>
                <div className="rounded-xl p-4 border border-gray-800 bg-gray-900/30">
                  <p className="text-xs text-gray-500 mb-1">Days to Expiry</p>
                  <p className="text-2xl font-black text-white">{data.mpItem.days_to_expiry}</p>
                  <p className="text-xs text-gray-600 mt-1">{data.mpItem.expiry}</p>
                </div>
              </div>
            ) : <p className="text-gray-500 text-sm">No max pain data available</p>}
          </Section>

          <Section title="Key Levels — Top CE & PE Strikes" icon="🧱" color="text-cyan-400" defaultOpen={true}>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-red-400 font-bold mb-2">🔴 Top CE Strikes (Resistance)</p>
                <div className="space-y-1.5">
                  {data?.topCEStrikes?.map((r: any, i: number) => (
                    <div key={r.strike} className="flex items-center justify-between bg-red-950/10 border border-red-900/20 rounded-lg px-3 py-2">
                      <span className="text-sm font-bold text-white">{r.strike.toLocaleString()}</span>
                      <span className="text-xs text-red-400">{fmtOI(r.ce_a)}</span>
                      {i === 0 && <span className="text-xs text-red-400 bg-red-950/50 px-1.5 py-0.5 rounded">MAX</span>}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-emerald-400 font-bold mb-2">🟢 Top PE Strikes (Support)</p>
                <div className="space-y-1.5">
                  {data?.topPEStrikes?.map((r: any, i: number) => (
                    <div key={r.strike} className="flex items-center justify-between bg-emerald-950/10 border border-emerald-900/20 rounded-lg px-3 py-2">
                      <span className="text-sm font-bold text-white">{r.strike.toLocaleString()}</span>
                      <span className="text-xs text-emerald-400">{fmtOI(r.pe_a)}</span>
                      {i === 0 && <span className="text-xs text-emerald-400 bg-emerald-950/50 px-1.5 py-0.5 rounded">MAX</span>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Section>

          <Section title="OI Structure — Buildup vs Unwinding" icon="📊" color="text-violet-400" defaultOpen={true}>
            {data?.rows?.length ? (
              <>
                <div className={`rounded-xl p-4 border mb-3 flex items-center gap-3 ${data.bullish ? 'bg-emerald-950/20 border-emerald-800/40' : 'bg-red-950/20 border-red-800/40'}`}>
                  <span className="text-2xl">{data.bullish ? '🐂' : '🐻'}</span>
                  <div>
                    <p className={`font-bold text-sm ${data.bullish ? 'text-emerald-400' : 'text-red-400'}`}>{data.bullish ? 'BULLISH OI STRUCTURE' : 'BEARISH OI STRUCTURE'}</p>
                    <p className="text-xs text-gray-500">{data.bullish ? 'More PE buildup + CE unwinding → support growing' : 'More CE buildup + PE unwinding → resistance growing'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <div className="bg-red-950/20 border border-red-800/30 rounded-xl p-3 text-center">
                    <p className="text-xs text-gray-500 mb-1">CE Built</p>
                    <p className="text-sm font-black text-red-400">+{fmtOI(data.totalCEBuilt)}</p>
                  </div>
                  <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-3 text-center">
                    <p className="text-xs text-gray-500 mb-1">CE Unwound</p>
                    <p className="text-sm font-black text-orange-400">{fmtOI(data.totalCEUnwound)}</p>
                  </div>
                  <div className="bg-emerald-950/20 border border-emerald-800/30 rounded-xl p-3 text-center">
                    <p className="text-xs text-gray-500 mb-1">PE Built</p>
                    <p className="text-sm font-black text-emerald-400">+{fmtOI(data.totalPEBuilt)}</p>
                  </div>
                  <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-3 text-center">
                    <p className="text-xs text-gray-500 mb-1">PE Unwound</p>
                    <p className="text-sm font-black text-yellow-400">{fmtOI(data.totalPEUnwound)}</p>
                  </div>
                </div>
                <p className="text-xs text-gray-600 mt-2">Comparing {fmtDate(data.oi?.date_b)} vs {fmtDate(data.oi?.date_a)} · <a href="/oihistory" className="text-emerald-400 hover:underline">Full OI History →</a></p>
              </>
            ) : <p className="text-gray-500 text-sm">No OI history data available</p>}
          </Section>

          <Section title="Volume Spikes" icon="🌊" color="text-blue-400" defaultOpen={false}>
            {data?.volItems?.length ? (
              <div className="space-y-2">
                {data.volItems.slice(0, 5).map((v: any, i: number) => (
                  <div key={i} className="flex items-center justify-between bg-blue-950/10 border border-blue-900/20 rounded-xl px-4 py-3">
                    <div>
                      <p className="text-sm font-bold text-white">{v.tradingsymbol}</p>
                      <p className="text-xs text-gray-500">{v.option_type} · Strike {v.strike?.toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-blue-400">+{v.vol_pct?.toFixed(1)}% vol</p>
                      <span className={`text-xs px-2 py-0.5 rounded font-bold ${v.oi_signal === 'FRESH_BUILD' ? 'text-emerald-400 bg-emerald-950/50' : v.oi_signal === 'UNWINDING' ? 'text-orange-400 bg-orange-950/50' : 'text-gray-400 bg-gray-800'}`}>{v.oi_signal}</span>
                    </div>
                  </div>
                ))}
                <a href="/spikes" className="text-xs text-blue-400 hover:underline block mt-2">View all volume spikes →</a>
              </div>
            ) : <p className="text-gray-500 text-sm">No significant volume spikes for {symbol} right now</p>}
          </Section>

          <Section title="Unusual Options Activity (UOA)" icon="🔍" color="text-yellow-400" defaultOpen={false}>
            {data?.uoaItems?.length ? (
              <div className="space-y-2">
                {data.uoaItems.slice(0, 5).map((u: any, i: number) => (
                  <div key={i} className="flex items-center justify-between bg-yellow-950/10 border border-yellow-900/20 rounded-xl px-4 py-3">
                    <div>
                      <p className="text-sm font-bold text-white">{u.tradingsymbol}</p>
                      <p className="text-xs text-gray-500">{u.signal_desc}</p>
                    </div>
                    <div className="text-right">
                      <div className="flex gap-1 justify-end mb-1">
                        {Array.from({length: u.score}).map((_,j) => <div key={j} className="w-2 h-2 rounded-full bg-yellow-400"/>)}
                        {Array.from({length: 5-u.score}).map((_,j) => <div key={j} className="w-2 h-2 rounded-full bg-gray-700"/>)}
                      </div>
                      <p className="text-xs text-yellow-400">Vol/OI: {u.vol_oi_ratio}x</p>
                    </div>
                  </div>
                ))}
                <a href="/uoa" className="text-xs text-yellow-400 hover:underline block mt-2">View all UOA signals →</a>
              </div>
            ) : <p className="text-gray-500 text-sm">No unusual activity detected for {symbol} right now</p>}
          </Section>
        </div>
      )}
    </div>
  )
}

function StockSearch({ onSearch }: { onSearch: (s: string) => void }) {
  const [query, setQuery] = useState('')
  const suggestions = query.length >= 1 ? ALL_SYMBOLS.filter(s => s.startsWith(query.toUpperCase())).slice(0, 8) : []

  function submit(sym: string) {
    setQuery(sym)
    onSearch(sym)
  }

  return (
    <div className="relative mb-6">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"/>
          <input value={query} onChange={e => setQuery(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && query && submit(query)}
            placeholder="Search any F&O stock or index… e.g. TCS, NIFTY, RELIANCE"
            className="w-full bg-gray-900 border border-gray-700 text-white text-sm rounded-xl pl-9 pr-4 py-3 focus:outline-none focus:border-emerald-500 transition-colors placeholder:text-gray-600"/>
          {suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-gray-900 border border-gray-700 rounded-xl overflow-hidden z-50 shadow-xl">
              {suggestions.map(s => (
                <button key={s} onClick={() => submit(s)} className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors font-medium">{s}</button>
              ))}
            </div>
          )}
        </div>
        <button onClick={() => query && submit(query)} disabled={!query}
          className="flex items-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-sm rounded-xl transition-all">
          <Search size={14}/>Search
        </button>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [analyses, setAnalyses] = useState<IndexAnalysis[]>([])
  const [cmps, setCmps] = useState<Record<string,number>>({})
  const [breadth, setBreadth] = useState({ bullish: 0, bearish: 0, neutral: 0, total: 0 })
  const [loading, setLoading] = useState(true)
  const [recordCount, setRecordCount] = useState(0)
  const [lastUpdate, setLastUpdate] = useState('')
  const [searchedSymbol, setSearchedSymbol] = useState<string | null>(null)

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
        try {
          const pulseRes = await fetch('https://greeknova-backend-production.up.railway.app/oi-pulse')
          const pulseJson = await pulseRes.json()
          const pulseItems = pulseJson.items || []
          let bull = 0, bear = 0, neut = 0
          pulseItems.forEach((s: any) => {
            if (s.price_chg_pct > 0 && s.oi_chg_pct > 0) bull++
            else if (s.price_chg_pct < 0 && s.oi_chg_pct > 0) bear++
            else neut++
          })
          setBreadth({ bullish: bull, bearish: bear, neutral: neut, total: pulseItems.length })
        } catch(e) { console.error('Breadth fetch failed:', e) }
      }
    } catch(e) { console.error(e) }
    setLoading(false)
  }

  const { enabled: autoEnabled, toggle: toggleAuto, countdownStr } = useAutoRefresh(fetchData)

  useEffect(() => { fetchData() }, [])

  const signals = [
    { name:'Put Writing', icon:'↑', iconBg:'bg-emerald-950/60 border-emerald-900/40', text:'text-emerald-400', desc:'Sellers building support. Bullish bias forming.' },
    { name:'Call Writing', icon:'↓', iconBg:'bg-red-950/60 border-red-900/40', text:'text-red-400', desc:'Ceiling erected. Distribution likely.' },
    { name:'IV Squeeze', icon:'⚡', iconBg:'bg-amber-950/60 border-amber-900/40', text:'text-amber-400', desc:'Coiling energy. Big move incoming.' },
    { name:'Battleground', icon:'⚔', iconBg:'bg-violet-950/60 border-violet-900/40', text:'text-violet-400', desc:'Aggressive two-way writing. Pin risk high.' },
  ]

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
              <button key={a.symbol} onClick={() => setSearchedSymbol(a.symbol)} className="flex items-center gap-2 flex-shrink-0 hover:opacity-80 transition-opacity">
                <span className="text-xs font-black text-white">{a.symbol}</span>
                <span className="text-xs font-bold text-amber-400">₹{cmps[a.symbol]?.toLocaleString() || '—'}</span>
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${a.pcr>1?'text-emerald-400 bg-emerald-950':'text-red-400 bg-red-950'}`}>PCR {a.pcr.toFixed(2)}</span>
              </button>
            ))}
          </div>
          <ExpiryCountdown/>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight mb-1">Index Intelligence</h1>
            <p className="text-gray-500 text-sm">Options flow · Greeks decoded · Posture mapped</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-gray-600 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2">
              <Clock size={11}/>{new Date().toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Kolkata"})}
            </div>
            {lastUpdate && (
              <div className="flex items-center gap-1.5 text-xs text-gray-600 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2">
                📸 {lastUpdate}
              </div>
            )}
            <button onClick={toggleAuto} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${autoEnabled?"bg-emerald-950/60 text-emerald-400 border-emerald-800/60":"bg-gray-900/40 text-gray-500 border-gray-800"}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${autoEnabled?"bg-emerald-400 animate-pulse":"bg-gray-600"}`}/>
              {autoEnabled?countdownStr:"Auto"}
            </button>
            <button onClick={fetchData} disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-sm font-medium text-white rounded-lg border border-gray-700 transition-all">
              <RefreshCw size={13} className={loading?'animate-spin':''}/>Refresh
            </button>
          </div>
        </div>

        <StockSearch onSearch={setSearchedSymbol}/>

        {searchedSymbol && <StockCommandCentre symbol={searchedSymbol} onClose={() => setSearchedSymbol(null)}/>}

        <div className="grid grid-cols-4 gap-3 mb-8">
          {[{label:'Indices Tracked',value:'3',sub:'NSE F&O'},{label:'OI Records',value:recordCount?recordCount.toLocaleString():'—',sub:'Latest snapshot'},{label:'Capture Interval',value:'5 min',sub:'Auto-scheduled'},{label:'Data Retention',value:'∞',sub:'All history saved'}].map(s => (
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
              <div className="bg-emerald-500 h-full rounded-l-full transition-all duration-700" style={{width:`${Math.round(breadth.bullish/breadth.total*100)}%`}}/>
              <div className="bg-amber-500/70 h-full transition-all duration-700" style={{width:`${Math.round(breadth.neutral/breadth.total*100)}%`}}/>
              <div className="bg-red-500 h-full rounded-r-full transition-all duration-700" style={{width:`${Math.round(breadth.bearish/breadth.total*100)}%`}}/>
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
            {analyses.map(a => (
              <div key={a.symbol} onClick={() => setSearchedSymbol(a.symbol)}>
                <IndexCard a={a}/>
              </div>
            ))}
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
