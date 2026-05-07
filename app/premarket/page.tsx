'use client'
import Navbar from '@/components/Navbar'
import { useEffect, useState } from 'react'
import { RefreshCw, Clock, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react'

const API = 'https://greeknova-backend-production.up.railway.app'

function toIST(ts: string) {
  try {
    const clean = ts.split('+')[0].split('Z')[0]
    const dt = new Date(clean + 'Z')
    return dt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })
  } catch { return ts }
}

function isMarketOpen() {
  const now = new Date()
  const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
  const day = ist.getDay()
  if (day === 0 || day === 6) return false
  const h = ist.getHours(), m = ist.getMinutes()
  if (h < 9 || (h === 9 && m < 15)) return false
  if (h > 15 || (h === 15 && m > 30)) return false
  return true
}

function isPreMarket() {
  const now = new Date()
  const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
  const h = ist.getHours(), m = ist.getMinutes()
  return h < 9 || (h === 9 && m < 15)
}

interface PremarketData {
  indices: any[]
  topConfluence: any[]
  expiryToday: any[]
  marketBreadth: { bullish: number; bearish: number; neutral: number; total: number }
  maxPainFar: any[]
  topOIBuildup: any[]
  topOIUnwinding: any[]
  topShortBuildup: any[]
  timestamp: string
}

export default function PreMarket() {
  const [data, setData] = useState<PremarketData | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState('')
  const [marketOpen, setMarketOpen] = useState(false)
  const [preMarket, setPreMarket] = useState(false)

  useEffect(() => {
    setMarketOpen(isMarketOpen())
    setPreMarket(isPreMarket())
    const t = setInterval(() => { setMarketOpen(isMarketOpen()); setPreMarket(isPreMarket()) }, 60000)
    return () => clearInterval(t)
  }, [])

  async function fetchAll() {
    setLoading(true)
    try {
      const [mpRes, confRes, pulseRes] = await Promise.all([
        fetch(`${API}/max-pain`),
        fetch(`${API}/confluence`),
        fetch(`${API}/oi-pulse`),
      ])
      const [mpData, confData, pulseData] = await Promise.all([mpRes.json(), confRes.json(), pulseRes.json()])

      const indices = mpData.symbols?.filter((s: any) => s.is_index) || []
      const expiryToday = mpData.symbols?.filter((s: any) => s.days_to_expiry <= 1) || []
      const topConfluence = confData.signals?.slice(0, 8) || []
      const allSymbols = mpData.symbols || []
const pulseItems2 = pulseData.items || []
let bullish = 0, bearish = 0, neutral = 0
pulseItems2.forEach((s: any) => {
  if (s.price_chg_pct > 0 && s.oi_chg_pct > 0) bullish++
  else if (s.price_chg_pct < 0 && s.oi_chg_pct > 0) bearish++
  else neutral++
})
      const maxPainFar = mpData.symbols
        ?.filter((s: any) => !s.is_index && Math.abs(s.dist_from_mp) > 2)
        ?.sort((a: any, b: any) => Math.abs(b.dist_from_mp) - Math.abs(a.dist_from_mp))
        ?.slice(0, 6) || []

      // OI Pulse movers
      const pulseItems = pulseData.items || []
      const topOIBuildup = pulseItems
        .filter((i: any) => i.signal === 'LONG_BUILDUP' || i.signal === 'SHORT_BUILDUP')
        .sort((a: any, b: any) => Math.abs(b.oi_chg_pct) - Math.abs(a.oi_chg_pct))
        .slice(0, 6)
      const topOIUnwinding = pulseItems
        .filter((i: any) => i.signal === 'LONG_UNWINDING' || i.signal === 'SHORT_COVERING')
        .sort((a: any, b: any) => Math.abs(b.oi_chg_pct) - Math.abs(a.oi_chg_pct))
        .slice(0, 6)
      const topShortBuildup = pulseItems
        .filter((i: any) => i.signal === 'SHORT_BUILDUP')
        .sort((a: any, b: any) => Math.abs(b.oi_chg_pct) - Math.abs(a.oi_chg_pct))
        .slice(0, 6)

      setData({ indices, topConfluence, expiryToday, marketBreadth: { bullish, bearish, neutral, total: allSymbols.length }, maxPainFar, topOIBuildup, topOIUnwinding, topShortBuildup, timestamp: mpData.timestamp })
      if (mpData.timestamp) setLastUpdate(toIST(mpData.timestamp))
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  const signalColors: Record<string, string> = {
    LONG_BUILDUP:   'text-emerald-400',
    SHORT_BUILDUP:  'text-red-400',
    SHORT_COVERING: 'text-cyan-400',
    LONG_UNWINDING: 'text-orange-400',
  }
  const signalBg: Record<string, string> = {
    LONG_BUILDUP:   'bg-emerald-950/20 border-emerald-900/30',
    SHORT_BUILDUP:  'bg-red-950/20 border-red-900/30',
    SHORT_COVERING: 'bg-cyan-950/20 border-cyan-900/30',
    LONG_UNWINDING: 'bg-orange-950/20 border-orange-900/30',
  }

  return (
    <div className="min-h-screen bg-[#07070e] text-white">
      <Navbar active="/premarket" />

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="text-3xl font-black tracking-tight mb-1">Pre-Market Setup</h1>
            <p className="text-gray-500 text-sm">
              {preMarket ? '⏰ Pre-market — based on yesterday\'s EOD data' :
               marketOpen ? '📊 Market is open — live intraday data' :
               '🌙 After hours — based on today\'s close data'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border ${marketOpen ? 'bg-emerald-950/30 border-emerald-800/50 text-emerald-400' : 'bg-gray-900 border-gray-800 text-gray-500'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${marketOpen ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`}/>
              {marketOpen ? 'Market Open' : 'Market Closed'}
            </div>
            {lastUpdate && (
              <div className="flex items-center gap-1.5 text-xs text-gray-600 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2">
                <Clock size={11}/>Updated: {lastUpdate}
              </div>
            )}
            <button onClick={fetchAll} disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-sm font-medium text-white rounded-lg border border-gray-700 transition-all disabled:opacity-50">
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''}/>Refresh
            </button>
          </div>
        </div>

        {/* Expiry Alert */}
        {data?.expiryToday && data.expiryToday.length > 0 && (
          <div className="bg-red-950/30 border border-red-800/50 rounded-xl p-4 mb-6 flex items-start gap-3">
            <AlertTriangle size={18} className="text-red-400 mt-0.5 shrink-0"/>
            <div>
              <p className="text-sm font-bold text-red-400 mb-1">🔥 Expiry Today/Tomorrow — High Impact Session</p>
              <p className="text-xs text-gray-400">{data.expiryToday.map((s: any) => `${s.symbol} (Max Pain: ₹${s.max_pain.toLocaleString()})`).join(' · ')}</p>
              <p className="text-xs text-gray-500 mt-1">Max pain effect strongest in last session. Expect pinning action near these levels.</p>
            </div>
          </div>
        )}

        {/* Market Breadth — full width */}
        {data?.marketBreadth && (
          <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-white">Market Breadth</h3>
                <p className="text-xs text-gray-500">{data.marketBreadth.total} F&O symbols · PCR-based sentiment</p>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500"/><span className="text-emerald-400 font-bold">{data.marketBreadth.bullish} Bullish</span></span>
                <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-amber-500"/><span className="text-amber-400 font-bold">{data.marketBreadth.neutral} Neutral</span></span>
                <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-red-500"/><span className="text-red-400 font-bold">{data.marketBreadth.bearish} Bearish</span></span>
                <span className={`text-xs font-bold px-2 py-1 rounded-lg ${
                  data.marketBreadth.bearish > data.marketBreadth.bullish * 1.5 ? 'bg-red-950/50 text-red-400' :
                  data.marketBreadth.bullish > data.marketBreadth.bearish * 1.5 ? 'bg-emerald-950/50 text-emerald-400' :
                  'bg-amber-950/50 text-amber-400'
                }`}>
                  {data.marketBreadth.bearish > data.marketBreadth.bullish * 1.5 ? '🐻 Broadly Bearish' :
                   data.marketBreadth.bullish > data.marketBreadth.bearish * 1.5 ? '🐂 Broadly Bullish' :
                   '↔ Mixed Market'}
                </span>
              </div>
            </div>
            <div className="h-3 rounded-full overflow-hidden flex">
              <div className="bg-emerald-500 h-full rounded-l-full transition-all" style={{ width: `${Math.round(data.marketBreadth.bullish/data.marketBreadth.total*100)}%` }}/>
              <div className="bg-amber-500/70 h-full transition-all" style={{ width: `${Math.round(data.marketBreadth.neutral/data.marketBreadth.total*100)}%` }}/>
              <div className="bg-red-500 h-full rounded-r-full transition-all" style={{ width: `${Math.round(data.marketBreadth.bearish/data.marketBreadth.total*100)}%` }}/>
            </div>
          </div>
        )}

        {/* Row 1 — Index levels + Top Confluence */}
        <div className="grid grid-cols-3 gap-6 mb-6">
          {/* Index levels */}
          <div>
            <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-cyan-400"/>Index Key Levels</h2>
            <div className="space-y-3">
              {loading ? [1,2,3].map(i => <div key={i} className="h-28 bg-gray-900/30 border border-gray-800 rounded-xl animate-pulse"/>) :
                data?.indices.map((idx: any) => (
                  <a href={`/stock/${idx.symbol}`} key={idx.symbol}
                    className="block bg-gray-900/30 border border-gray-800 rounded-xl p-4 hover:border-gray-600 transition-all">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-black text-white">{idx.symbol}</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${idx.days_to_expiry <= 1 ? 'bg-red-950 text-red-400 border border-red-800' : idx.days_to_expiry <= 7 ? 'bg-orange-950 text-orange-400 border border-orange-800' : 'bg-gray-800 text-gray-400 border border-gray-700'}`}>
                        {idx.days_to_expiry <= 1 ? '🔥 Expiry' : `${idx.days_to_expiry}D to expiry`}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div><p className="text-xs text-gray-600">CMP</p><p className="text-sm font-bold text-amber-400">₹{idx.cmp.toLocaleString()}</p></div>
                      <div><p className="text-xs text-gray-600">Max Pain</p><p className="text-sm font-bold text-white">₹{idx.max_pain.toLocaleString()}</p></div>
                      <div><p className="text-xs text-gray-600">Distance</p><p className={`text-sm font-bold ${Math.abs(idx.dist_from_mp) > 1 ? 'text-orange-400' : 'text-gray-400'}`}>{idx.dist_from_mp > 0 ? '+' : ''}{idx.dist_from_mp}%</p></div>
                      <div><p className="text-xs text-gray-600">PCR</p><p className={`text-sm font-bold ${idx.pcr > 1 ? 'text-emerald-400' : 'text-red-400'}`}>{idx.pcr}</p></div>
                    </div>
                  </a>
                ))
              }
            </div>
          </div>

          {/* Top Confluence */}
          <div>
            <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-orange-400"/>Top Confluence Signals</h2>
            <div className="space-y-2">
              {loading ? [1,2,3,4,5,6].map(i => <div key={i} className="h-14 bg-gray-900/30 border border-gray-800 rounded-xl animate-pulse"/>) :
                data?.topConfluence.map((sig: any) => (
                  <a href={`/stock/${sig.symbol}`} key={sig.symbol}
                    className={`block rounded-xl border p-3 hover:border-gray-600 transition-all ${sig.bias === 'BEARISH' ? 'bg-red-950/10 border-red-900/30' : sig.bias === 'BULLISH' ? 'bg-emerald-950/10 border-emerald-900/30' : 'bg-gray-900/30 border-gray-800'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-white">{sig.symbol}</span>
                        <span className={`text-xs font-bold ${sig.bias === 'BEARISH' ? 'text-red-400' : sig.bias === 'BULLISH' ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {sig.bias === 'BEARISH' ? '↓' : sig.bias === 'BULLISH' ? '↑' : '↔'} {sig.bias}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">₹{sig.cmp?.toLocaleString()}</span>
                    </div>
                    <div className="flex gap-1.5 mt-1.5 flex-wrap">
                      {sig.active_signals.map((s: string, i: number) => (
                        <span key={i} className="text-xs text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">{s.replace(/_/g, ' ')}</span>
                      ))}
                    </div>
                    <div className="flex gap-2 mt-1.5 text-xs text-gray-600">
                      <span>CE Wall: <span className="text-red-400 font-bold">₹{sig.ce_wall?.toLocaleString()}</span></span>
                      <span>PE Wall: <span className="text-emerald-400 font-bold">₹{sig.pe_wall?.toLocaleString()}</span></span>
                    </div>
                  </a>
                ))
              }
            </div>
          </div>

          {/* Far from Max Pain */}
          <div>
            <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-violet-400"/>Far from Max Pain (&gt;2%)</h2>
            <div className="space-y-2">
              {loading ? [1,2,3,4,5].map(i => <div key={i} className="h-12 bg-gray-900/30 border border-gray-800 rounded-lg animate-pulse"/>) :
                data?.maxPainFar.map((s: any) => (
                  <a href={`/stock/${s.symbol}`} key={s.symbol}
                    className={`flex items-center justify-between rounded-xl border px-3 py-2.5 hover:border-gray-600 transition-all ${s.direction === 'ABOVE' ? 'bg-orange-950/10 border-orange-900/30' : 'bg-blue-950/10 border-blue-900/30'}`}>
                    <div>
                      <span className="text-sm font-bold text-white">{s.symbol}</span>
                      <p className="text-xs text-gray-500">MP: ₹{s.max_pain.toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-black ${s.dist_from_mp > 0 ? 'text-orange-400' : 'text-blue-400'}`}>
                        {s.dist_from_mp > 0 ? '+' : ''}{s.dist_from_mp}%
                      </p>
                      <p className={`text-xs ${s.dist_from_mp > 0 ? 'text-orange-500/70' : 'text-blue-500/70'}`}>
                        {s.dist_from_mp > 0 ? '↑ above MP' : '↓ below MP'}
                      </p>
                    </div>
                  </a>
                ))
              }
            </div>
          </div>
        </div>

        {/* Row 2 — OI Movers */}
        <div className="grid grid-cols-2 gap-6">
          {/* Top OI Buildup */}
          <div>
            <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <TrendingUp size={14} className="text-emerald-400"/>
              Top OI Buildup — Long & Short
            </h2>
            <div className="bg-gray-900/20 border border-gray-800 rounded-2xl overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-800 bg-gray-900/50">
                    <th className="text-left px-4 py-2.5 text-gray-500 font-semibold">Symbol</th>
                    <th className="text-right px-4 py-2.5 text-gray-500 font-semibold">Signal</th>
                    <th className="text-right px-4 py-2.5 text-gray-500 font-semibold">OI Δ%</th>
                    <th className="text-right px-4 py-2.5 text-gray-500 font-semibold">Price Δ%</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? [1,2,3,4,5,6].map(i => <tr key={i}><td colSpan={4} className="px-4 py-3"><div className="h-4 bg-gray-800 rounded animate-pulse"/></td></tr>) :
                    data?.topOIBuildup.map((item: any) => (
                      <tr key={item.symbol} className={`border-b border-gray-800/50 hover:bg-gray-800/20 ${signalBg[item.signal] || ''}`}>
                        <td className="px-4 py-2.5">
                          <a href={`/stock/${item.symbol}`} className="font-bold text-white hover:text-emerald-400 transition-colors">{item.symbol}</a>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <span className={`font-bold text-xs ${signalColors[item.signal] || 'text-gray-400'}`}>
                            {item.label}
                          </span>
                        </td>
                        <td className={`px-4 py-2.5 text-right font-bold ${item.oi_chg_pct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {item.oi_chg_pct >= 0 ? '+' : ''}{item.oi_chg_pct?.toFixed(2)}%
                        </td>
                        <td className={`px-4 py-2.5 text-right font-bold ${item.price_chg_pct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {item.price_chg_pct >= 0 ? '+' : ''}{item.price_chg_pct?.toFixed(2)}%
                        </td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          </div>

          {/* Top OI Unwinding / Covering */}
          <div>
            <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <TrendingDown size={14} className="text-orange-400"/>
              Top OI Unwinding & Covering
            </h2>
            <div className="bg-gray-900/20 border border-gray-800 rounded-2xl overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-800 bg-gray-900/50">
                    <th className="text-left px-4 py-2.5 text-gray-500 font-semibold">Symbol</th>
                    <th className="text-right px-4 py-2.5 text-gray-500 font-semibold">Signal</th>
                    <th className="text-right px-4 py-2.5 text-gray-500 font-semibold">OI Δ%</th>
                    <th className="text-right px-4 py-2.5 text-gray-500 font-semibold">Price Δ%</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? [1,2,3,4,5,6].map(i => <tr key={i}><td colSpan={4} className="px-4 py-3"><div className="h-4 bg-gray-800 rounded animate-pulse"/></td></tr>) :
                    data?.topOIUnwinding.length ? data.topOIUnwinding.map((item: any) => (
                      <tr key={item.symbol} className={`border-b border-gray-800/50 hover:bg-gray-800/20 ${signalBg[item.signal] || ''}`}>
                        <td className="px-4 py-2.5">
                          <a href={`/stock/${item.symbol}`} className="font-bold text-white hover:text-emerald-400 transition-colors">{item.symbol}</a>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <span className={`font-bold text-xs ${signalColors[item.signal] || 'text-gray-400'}`}>
                            {item.label}
                          </span>
                        </td>
                        <td className={`px-4 py-2.5 text-right font-bold ${item.oi_chg_pct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {item.oi_chg_pct >= 0 ? '+' : ''}{item.oi_chg_pct?.toFixed(2)}%
                        </td>
                        <td className={`px-4 py-2.5 text-right font-bold ${item.price_chg_pct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {item.price_chg_pct >= 0 ? '+' : ''}{item.price_chg_pct?.toFixed(2)}%
                        </td>
                      </tr>
                    )) : (
                      <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-600">No unwinding signals right now</td></tr>
                    )
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="mt-6 grid grid-cols-5 gap-3">
          {[
            { href: '/oipulse', label: 'OI Pulse', icon: '📡', desc: 'All signals live' },
            { href: '/maxpain', label: 'Max Pain', icon: '🎯', desc: 'Pin levels' },
            { href: '/pcr', label: 'PCR Trend', icon: '📈', desc: 'Intraday PCR' },
            { href: '/uoa', label: 'UOA', icon: '🐋', desc: 'Smart money' },
            { href: '/spikes', label: 'OI Spikes', icon: '🔥', desc: 'Fresh activity' },
          ].map(link => (
            <a key={link.href} href={link.href}
              className="bg-gray-900/30 border border-gray-800 rounded-xl p-3 hover:border-gray-600 hover:bg-gray-900/60 transition-all text-center">
              <div className="text-xl mb-1">{link.icon}</div>
              <p className="text-xs font-bold text-white">{link.label}</p>
              <p className="text-xs text-gray-600">{link.desc}</p>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}