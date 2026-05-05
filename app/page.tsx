'use client'
import Navbar from '@/components/Navbar'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { TrendingUp, TrendingDown, Minus, RefreshCw, Clock, Database } from 'lucide-react'
import { useAutoRefresh } from "@/lib/useAutoRefresh"

interface OIRecord { symbol:string; strike:number; option_type:string; oi:number; volume:number; last_price:number; timestamp:string }
interface IndexAnalysis { symbol:string; pcr:number; totalCEOI:number; totalPEOI:number; maxPain:number; posture:'BULLISH'|'BEARISH'|'NEUTRAL'; postureStrength:number; topCEStrike:number; topPEStrike:number }

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


function MarketBreadth({ data }: { data: any[] }) {
  if (!data.length) return null
  
  const symbols = [...new Set(data.map((d: any) => d.symbol))]
  let bullish = 0, bearish = 0, neutral = 0

  for (const sym of symbols) {
    const r = data.filter((d: any) => d.symbol === sym)
    const ce = r.filter((d: any) => d.option_type === 'CE').reduce((s: number, d: any) => s + d.oi, 0)
    const pe = r.filter((d: any) => d.option_type === 'PE').reduce((s: number, d: any) => s + d.oi, 0)
    const pcr = ce > 0 ? pe / ce : 0
    if (pcr > 1.2) bullish++
    else if (pcr < 0.8) bearish++
    else neutral++
  }

  const total = bullish + bearish + neutral
  const bullP = Math.round((bullish / total) * 100)
  const bearP = Math.round((bearish / total) * 100)
  const neutP = 100 - bullP - bearP

  return (
    <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-bold text-white">Market Breadth</h3>
          <p className="text-xs text-gray-500">Across {total} F&O symbols · Based on PCR</p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500"/><span className="text-emerald-400 font-bold">{bullish} Bullish</span></span>
          <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-amber-500"/><span className="text-amber-400 font-bold">{neutral} Neutral</span></span>
          <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-red-500"/><span className="text-red-400 font-bold">{bearish} Bearish</span></span>
        </div>
      </div>
      <div className="h-3 rounded-full overflow-hidden flex gap-0.5">
        <div className="bg-emerald-500 h-full rounded-l-full transition-all duration-700" style={{ width: bullP + "%" }}/>
        <div className="bg-amber-500/70 h-full transition-all duration-700" style={{ width: neutP + "%" }}/>
        <div className="bg-red-500 h-full rounded-r-full transition-all duration-700" style={{ width: bearP + "%" }}/>
      </div>
      <div className="flex justify-between text-xs text-gray-600 mt-1.5">
        <span>{bullP}% bullish</span>
        <span>{bearP}% bearish</span>
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
      const day = ist.getDay() // 0=Sun,1=Mon,2=Tue,3=Wed,4=Thu,5=Fri,6=Sat

      // NIFTY weekly expiry = every Tuesday (NSE changed from Thursday in 2024)
      // Find next Tuesday
      let daysToExpiry = (2 - day + 7) % 7
      if (daysToExpiry === 0) {
        // Today is Tuesday — check if market still open (before 15:30)
        const expiryToday = new Date(ist)
        expiryToday.setHours(15, 30, 0, 0)
        if (ist >= expiryToday) {
          daysToExpiry = 7 // Next Tuesday
        }
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
      if (days === 0) {
        setLabel('EXPIRY TODAY')
        setTimeLeft(`${hours.toString().padStart(2,'0')}:${mins.toString().padStart(2,'0')}:${secs.toString().padStart(2,'0')}`)
      } else if (days === 1) {
        setLabel('EXPIRY TOMORROW')
        setTimeLeft(`${hours}h ${mins}m`)
      } else {
        setLabel(`EXPIRY IN ${days}D`)
        setTimeLeft(`${days}d ${hours}h`)
      }
    }
    calc()
    const t = setInterval(calc, 1000)
    return () => clearInterval(t)
  }, [])

  const isToday = daysLeft === 0
  const isTomorrow = daysLeft === 1

  return (
    <div className={`flex-shrink-0 flex items-center gap-2 px-4 h-full border-l ml-auto ${
      isToday ? 'border-red-800/50 bg-red-950/30' : 
      isTomorrow ? 'border-orange-800/50 bg-orange-950/20' : 
      'border-gray-800/50'
    }`}>
      <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${isToday ? 'bg-red-400' : isTomorrow ? 'bg-orange-400' : 'bg-gray-600'}`}/>
      <div>
        <p className={`text-xs font-black ${isToday ? 'text-red-400' : isTomorrow ? 'text-orange-400' : 'text-gray-500'}`}>{label}</p>
        <p className={`text-sm font-black font-mono ${isToday ? 'text-red-300' : isTomorrow ? 'text-orange-300' : 'text-gray-400'}`}>{timeLeft}</p>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [analyses, setAnalyses] = useState<IndexAnalysis[]>([])
  const [cmps, setCmps] = useState<Record<string,number>>({})
  const [breadth, setBreadth] = useState({ bullish: 0, bearish: 0, neutral: 0, total: 0 })
  const [loading, setLoading] = useState(true)
  const { enabled: autoEnabled, toggle: toggleAuto, countdownStr } = useAutoRefresh(fetchData)
  const [recordCount, setRecordCount] = useState(0)
  const [lastUpdate, setLastUpdate] = useState('')

  const isMarketOpen = () => {
    const n=new Date(), d=n.getDay(), h=n.getHours(), m=n.getMinutes()
    if(d===0||d===6) return false
    if(h<9||(h===9&&m<15)) return false
    if(h>15||(h===15&&m>30)) return false
    return true
  }

  async function fetchData() {
    setLoading(true)
    try {
      // Get latest timestamp that has INDEX data specifically
      const { data:latest } = await supabase
        .from('oi_snapshots')
        .select('timestamp')
        
        .order('timestamp',{ascending:false})
        .limit(1)

      if(!latest?.length) { setLoading(false); return }
      const ts = latest[0].timestamp
      setLastUpdate(new Date(ts).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }))

      const { data, count } = await supabase
        .from('oi_snapshots')
        .select('*',{count:'exact'})
        .eq('timestamp',ts)

      if(data) {
        setRecordCount(count||0)
        const results = ['NIFTY','BANKNIFTY','FINNIFTY']
          .map(s=>analyzeIndex(data as OIRecord[],s))
          .filter(Boolean) as IndexAnalysis[]
        setAnalyses(results)
        // Build CMP map for ticker
        const { data: cmpData } = await supabase.from('cmp_prices').select('*').order('timestamp', { ascending: false }).limit(200)
        const cmpMap: Record<string,number> = {}
        const seen = new Set()
        cmpData?.forEach((c:any) => { if (!seen.has(c.symbol)) { cmpMap[c.symbol] = c.cmp; seen.add(c.symbol) } })
        setCmps(cmpMap)
        // Compute market breadth across all symbols
        const allSyms = [...new Set((data as any[]).map((d: any) => d.symbol))]
        let bull = 0, bear = 0, neut = 0
        for (const sym of allSyms) {
          const r = (data as any[]).filter((d: any) => d.symbol === sym)
          const ce = r.filter((d: any) => d.option_type === 'CE').reduce((s: number, d: any) => s + d.oi, 0)
          const pe = r.filter((d: any) => d.option_type === 'PE').reduce((s: number, d: any) => s + d.oi, 0)
          const pcr = ce > 0 ? pe / ce : 0
          if (pcr > 1.2) bull++
          else if (pcr < 0.8) bear++
          else neut++
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
                <a key={a.symbol} href={`/stock/${a.symbol}`}
                  className="flex items-center gap-2 flex-shrink-0 hover:opacity-80 transition-opacity">
                  <span className="text-xs font-black text-white">{a.symbol}</span>
                  <span className="text-xs font-bold text-amber-400">₹{cmps[a.symbol]?.toLocaleString() || '—'}</span>
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${isUp ? 'text-emerald-400 bg-emerald-950' : 'text-red-400 bg-red-950'}`}>
                    PCR {a.pcr.toFixed(2)}
                  </span>
                </a>
              )
            })}
          </div>
          {/* Expiry countdown */}
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
            <div className="flex items-center gap-1.5 text-xs text-gray-600 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2"><Clock size={11}/>{new Date().toLocaleString("en-IN", {dateStyle:"medium", timeStyle:"short", timeZone:"Asia/Kolkata"})}</div>{lastUpdate && <div className="flex items-center gap-1.5 text-xs text-gray-600 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 ml-1">📸 Snapshot: {lastUpdate}</div>}
            <button onClick={toggleAuto} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${autoEnabled ? "bg-emerald-950/60 text-emerald-400 border-emerald-800/60" : "bg-gray-900/40 text-gray-500 border-gray-800"}`}><div className={`w-1.5 h-1.5 rounded-full ${autoEnabled ? "bg-emerald-400 animate-pulse" : "bg-gray-600"}`}/>{autoEnabled ? countdownStr : "Auto"}</button>
            <button onClick={fetchData} disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-sm font-medium text-white rounded-lg border border-gray-700 transition-all">
              <RefreshCw size={13} className={loading?'animate-spin':''}/>Refresh
            </button>
          </div>
        </div>

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

        <MarketBreadth data={loading ? [] : (analyses.length > 0 ? [] : [])} />

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
