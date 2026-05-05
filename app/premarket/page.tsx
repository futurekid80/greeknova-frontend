'use client'
import { useEffect, useState } from 'react'
import { RefreshCw, Clock, AlertTriangle } from 'lucide-react'

interface PremarketData {
  indices: any[]
  topConfluence: any[]
  expiryToday: any[]
  marketBreadth: { bullish: number; bearish: number; neutral: number; total: number }
  maxPainFar: any[]
  timestamp: string
}

export default function PreMarket() {
  const [data, setData] = useState<PremarketData | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState('')
  const now = new Date()
  const isPremarket = now.getHours() < 9 || (now.getHours() === 9 && now.getMinutes() < 15)

  async function fetchAll() {
    setLoading(true)
    try {
      const [mpRes, confRes] = await Promise.all([
        fetch('https://greeknova-backend-production.up.railway.app/max-pain'),
        fetch('https://greeknova-backend-production.up.railway.app/confluence'),
      ])
      const [mpData, confData] = await Promise.all([mpRes.json(), confRes.json()])

      // Get index data from max pain
      const indices = mpData.symbols?.filter((s: any) => s.is_index) || []

      // Get expiring today/tomorrow
      const expiryToday = mpData.symbols?.filter((s: any) => s.days_to_expiry <= 1) || []

      // Top confluence signals
      const topConfluence = confData.signals?.slice(0, 6) || []

      // Market breadth from confluence
      const allSymbols = mpData.symbols || []
      let bullish = 0, bearish = 0, neutral = 0
      allSymbols.forEach((s: any) => {
        if (s.pcr > 1.2) bullish++
        else if (s.pcr < 0.8) bearish++
        else neutral++
      })

      // Stocks far from max pain (>2%)
      const maxPainFar = mpData.symbols
        ?.filter((s: any) => !s.is_index && Math.abs(s.dist_from_mp) > 2)
        ?.slice(0, 6) || []

      setData({ indices, topConfluence, expiryToday, marketBreadth: { bullish, bearish, neutral, total: allSymbols.length }, maxPainFar, timestamp: mpData.timestamp })
      setLastUpdate(new Date(mpData.timestamp).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }))
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  return (
    <div className="min-h-screen bg-[#07070e] text-white">
      <nav className="sticky top-0 z-50 border-b border-gray-800/50 bg-[#07070e]/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-600 flex items-center justify-center">
              <span className="text-xs font-black text-white">GN</span>
            </div>
            <span className="font-black text-white text-base">GreekNova</span>
            <span className="ml-1 text-xs font-medium px-1.5 py-0.5 bg-emerald-950 text-emerald-500 border border-emerald-800/50 rounded-md">BETA</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="/" className="text-sm text-gray-400 hover:text-white transition-colors">Dashboard</a>
            <a href="/premarket" className="text-sm font-semibold text-white border-b border-emerald-500 pb-0.5">Pre-Market</a>
            <a href="/watchlist" className="text-sm text-gray-400 hover:text-white transition-colors">Watchlist</a>
            <a href="/scanners" className="text-sm text-gray-400 hover:text-white transition-colors">Scanners</a>
            <a href="/charts" className="text-sm text-gray-400 hover:text-white transition-colors">OI Charts</a>
            <a href="/pcr" className="text-sm text-gray-400 hover:text-white transition-colors">PCR Trend</a>
            <a href="/spikes" className="text-sm text-gray-400 hover:text-white transition-colors">OI Spikes</a>
            <a href="/volume" className="text-sm text-gray-400 hover:text-white transition-colors">Vol Spikes</a>
            <a href="/uoa" className="text-sm text-gray-400 hover:text-white transition-colors">UOA</a>
            <a href="/confluence" className="text-sm text-gray-400 hover:text-white transition-colors">Confluence</a>
            <a href="/maxpain" className="text-sm text-gray-400 hover:text-white transition-colors">Max Pain</a>
            <a href="/alerts" className="text-sm text-gray-400 hover:text-white transition-colors">Alerts</a>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="text-3xl font-black tracking-tight mb-1">Pre-Market Setup</h1>
            <p className="text-gray-500 text-sm">
              {isPremarket ? '⏰ Pre-market mode — based on yesterday\'s close data' : '📊 Based on latest available snapshot'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdate && <div className="flex items-center gap-1.5 text-xs text-gray-600 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2"><Clock size={11}/>{lastUpdate}</div>}
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
              <p className="text-xs text-gray-400">
                {data.expiryToday.map((s: any) => `${s.symbol} (Max Pain: ${s.max_pain.toLocaleString()})`).join(' · ')}
              </p>
              <p className="text-xs text-gray-500 mt-1">Max pain effect is strongest in the last session. Expect pinning action near these levels.</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-6">
          {/* Column 1 — Index levels */}
          <div>
            <h2 className="text-base font-bold text-white mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400"/>Index Key Levels
            </h2>
            <div className="space-y-3">
              {loading ? [1,2,3].map(i => <div key={i} className="h-28 bg-gray-900/30 border border-gray-800 rounded-xl animate-pulse"/>) :
                data?.indices.map((idx: any) => (
                  <a href={`/stock/${idx.symbol}`} key={idx.symbol}
                    className="block bg-gray-900/30 border border-gray-800 rounded-xl p-4 hover:border-gray-600 transition-all">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-black text-white">{idx.symbol}</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${idx.days_to_expiry <= 1 ? 'bg-red-950 text-red-400 border border-red-800' : 'bg-gray-800 text-gray-400 border border-gray-700'}`}>
                        {idx.days_to_expiry <= 1 ? '🔥 Expiry' : `${idx.days_to_expiry}D`}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-xs text-gray-600">CMP</p>
                        <p className="text-sm font-bold text-amber-400">₹{idx.cmp.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">Max Pain</p>
                        <p className="text-sm font-bold text-white">₹{idx.max_pain.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">Distance</p>
                        <p className={`text-sm font-bold ${Math.abs(idx.dist_from_mp) > 1 ? 'text-orange-400' : 'text-gray-400'}`}>
                          {idx.dist_from_mp > 0 ? '+' : ''}{idx.dist_from_mp}%
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">PCR</p>
                        <p className={`text-sm font-bold ${idx.pcr > 1 ? 'text-emerald-400' : 'text-red-400'}`}>{idx.pcr}</p>
                      </div>
                    </div>
                  </a>
                ))
              }
            </div>
          </div>

          {/* Column 2 — Top confluence */}
          <div>
            <h2 className="text-base font-bold text-white mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-orange-400"/>Top Confluence Signals
            </h2>
            <div className="space-y-2">
              {loading ? [1,2,3,4,5,6].map(i => <div key={i} className="h-16 bg-gray-900/30 border border-gray-800 rounded-xl animate-pulse"/>) :
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
                      <div className="flex items-center gap-1">
                        {[1,2,3,4].map(i => <div key={i} className={`h-1.5 w-3 rounded-sm ${i <= sig.signal_count ? 'bg-amber-400' : 'bg-gray-700'}`}/>)}
                      </div>
                    </div>
                    <div className="flex gap-1.5 mt-1.5 flex-wrap">
                      {sig.active_signals.map((s: string, i: number) => (
                        <span key={i} className="text-xs text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">{s.replace(/_/g, ' ')}</span>
                      ))}
                    </div>
                  </a>
                ))
              }
            </div>
          </div>

          {/* Column 3 — Market breadth + Far from MP */}
          <div>
            <h2 className="text-base font-bold text-white mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400"/>Market Structure
            </h2>

            {/* Breadth */}
            {data?.marketBreadth && (
              <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-4 mb-4">
                <p className="text-xs text-gray-500 mb-3">PCR-based sentiment across {data.marketBreadth.total} symbols</p>
                <div className="flex items-center gap-3 mb-2 text-xs">
                  <span className="text-emerald-400 font-bold">{data.marketBreadth.bullish} Bullish</span>
                  <span className="text-amber-400 font-bold">{data.marketBreadth.neutral} Neutral</span>
                  <span className="text-red-400 font-bold">{data.marketBreadth.bearish} Bearish</span>
                </div>
                <div className="h-3 rounded-full overflow-hidden flex">
                  <div className="bg-emerald-500 h-full" style={{ width: `${Math.round(data.marketBreadth.bullish/data.marketBreadth.total*100)}%` }}/>
                  <div className="bg-amber-500/70 h-full" style={{ width: `${Math.round(data.marketBreadth.neutral/data.marketBreadth.total*100)}%` }}/>
                  <div className="bg-red-500 h-full" style={{ width: `${Math.round(data.marketBreadth.bearish/data.marketBreadth.total*100)}%` }}/>
                </div>
                <p className={`text-xs mt-2 font-bold ${data.marketBreadth.bearish > data.marketBreadth.bullish * 2 ? 'text-red-400' : data.marketBreadth.bullish > data.marketBreadth.bearish * 2 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {data.marketBreadth.bearish > data.marketBreadth.bullish * 2 ? '⚠️ Broadly bearish market structure' :
                    data.marketBreadth.bullish > data.marketBreadth.bearish * 2 ? '✅ Broadly bullish market structure' :
                    '↔ Mixed market — stock specific moves likely'}
                </p>
              </div>
            )}

            {/* Far from max pain */}
            <h3 className="text-sm font-bold text-gray-400 mb-2">Far from Max Pain (&gt;2%)</h3>
            <div className="space-y-2">
              {loading ? [1,2,3].map(i => <div key={i} className="h-12 bg-gray-900/30 border border-gray-800 rounded-lg animate-pulse"/>) :
                data?.maxPainFar.map((s: any) => (
                  <a href={`/stock/${s.symbol}`} key={s.symbol}
                    className="flex items-center justify-between bg-gray-900/30 border border-gray-800 rounded-lg px-3 py-2.5 hover:border-gray-600 transition-all">
                    <span className="text-sm font-bold text-white">{s.symbol}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">MP: {s.max_pain.toLocaleString()}</span>
                      <span className={`text-xs font-black ${s.dist_from_mp > 0 ? 'text-orange-400' : 'text-blue-400'}`}>
                        {s.dist_from_mp > 0 ? '+' : ''}{s.dist_from_mp}%
                      </span>
                    </div>
                  </a>
                ))
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
