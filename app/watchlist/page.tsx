'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, Plus, X, Star } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAutoRefresh } from '@/lib/useAutoRefresh'

const ALL_SYMBOLS = [
  'NIFTY','BANKNIFTY','FINNIFTY',
  'RELIANCE','TCS','HDFCBANK','INFY','ICICIBANK','HINDUNILVR','ITC','SBIN',
  'BHARTIARTL','KOTAKBANK','LT','AXISBANK','ASIANPAINT','MARUTI','TITAN',
  'SUNPHARMA','ULTRACEMCO','BAJFINANCE','WIPRO','HCLTECH','TATACONSUM',
  'TATASTEEL','ADANIENT','POWERGRID','NTPC','ONGC','JSWSTEEL','COALINDIA',
  'BAJAJFINSV','TECHM'
]

const INDICES = ['NIFTY','BANKNIFTY','FINNIFTY']

interface WatchItem {
  symbol: string; cmp: number; pcr: number
  ceWall: number; peWall: number; signal: string
  distCE: number; distPE: number
}

function getSignal(pcr: number, totalCE: number, totalPE: number): string {
  const ratio = totalPE / (totalCE + totalPE)
  if (pcr > 1.4) return 'PUT_WRITING'
  if (pcr < 0.6) return 'CALL_WRITING'
  if (ratio > 0.44 && ratio < 0.56) return 'BATTLEGROUND'
  return 'SQUEEZE'
}

function getStructure(cmp: number, ce: number, pe: number): string {
  if (!cmp || !ce || !pe) return '—'
  const dCE = ce > cmp ? (ce - cmp) / cmp * 100 : 0
  const dPE = pe < cmp ? (cmp - pe) / cmp * 100 : 0
  if (dCE <= 0.5) return 'Breakout Watch'
  if (dPE <= 0.5) return 'Breakdown Watch'
  if (dCE <= 2) return 'Resistance Test'
  if (dPE <= 2) return 'Support Test'
  if (dCE < dPE) return 'Upper Range'
  if (dPE < dCE) return 'Lower Range'
  return 'Mid Range'
}

const STRUCTURE_COLOR: Record<string, string> = {
  'Breakout Watch': 'text-emerald-300', 'Breakdown Watch': 'text-red-300',
  'Resistance Test': 'text-red-400', 'Support Test': 'text-emerald-400',
  'Upper Range': 'text-orange-400', 'Lower Range': 'text-cyan-400',
  'Mid Range': 'text-amber-400', '—': 'text-gray-600'
}

const SIGNAL_COLOR: Record<string, string> = {
  PUT_WRITING: 'text-emerald-400', CALL_WRITING: 'text-red-400',
  BATTLEGROUND: 'text-violet-400', SQUEEZE: 'text-amber-400'
}

export default function Watchlist() {
  const [watchlist, setWatchlist] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('gn_watchlist')
      return saved ? JSON.parse(saved) : ['NIFTY', 'BANKNIFTY', 'RELIANCE', 'TCS', 'HDFCBANK']
    }
    return ['NIFTY', 'BANKNIFTY', 'RELIANCE', 'TCS', 'HDFCBANK']
  })
  const [items, setItems] = useState<WatchItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [lastUpdate, setLastUpdate] = useState('')

  useEffect(() => {
    localStorage.setItem('gn_watchlist', JSON.stringify(watchlist))
  }, [watchlist])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const { data: latest } = await supabase.from('oi_snapshots').select('timestamp').order('timestamp', { ascending: false }).limit(1)
      if (!latest?.length) { setLoading(false); return }
      const ts = latest[0].timestamp
      setLastUpdate(new Date(ts).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }))

      const { data } = await supabase.from('oi_snapshots').select('*').eq('timestamp', ts).in('symbol', watchlist)
      const { data: cmpData } = await supabase.from('cmp_prices').select('*').order('timestamp', { ascending: false }).limit(200)

      if (!data) { setLoading(false); return }

      const cmpMap: Record<string, number> = {}
      const seen = new Set()
      cmpData?.forEach((c: any) => { if (!seen.has(c.symbol)) { cmpMap[c.symbol] = c.cmp; seen.add(c.symbol) } })

      const result: WatchItem[] = []
      for (const sym of watchlist) {
        const r = data.filter((d: any) => d.symbol === sym)
        const ce = r.filter((d: any) => d.option_type === 'CE')
        const pe = r.filter((d: any) => d.option_type === 'PE')
        const totalCE = ce.reduce((s: number, d: any) => s + d.oi, 0)
        const totalPE = pe.reduce((s: number, d: any) => s + d.oi, 0)
        if (!totalCE && !totalPE) continue
        const pcr = totalCE > 0 ? totalPE / totalCE : 0
        const ceWall = [...ce].sort((a: any, b: any) => b.oi - a.oi)[0]?.strike || 0
        const peWall = [...pe].sort((a: any, b: any) => b.oi - a.oi)[0]?.strike || 0
        const cmp = cmpMap[sym] || 0
        result.push({
          symbol: sym, cmp, pcr: Math.round(pcr * 100) / 100,
          ceWall, peWall, signal: getSignal(pcr, totalCE, totalPE),
          distCE: ceWall > cmp && cmp > 0 ? Math.round((ceWall - cmp) / cmp * 1000) / 10 : 0,
          distPE: peWall < cmp && cmp > 0 ? Math.round((cmp - peWall) / cmp * 1000) / 10 : 0,
        })
      }
      setItems(result)
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [watchlist])

  const { enabled: autoEnabled, toggle: toggleAuto, countdownStr } = useAutoRefresh(fetchData, 5 * 60 * 1000, true)
  useEffect(() => { fetchData() }, [fetchData])

  const addSymbol = (sym: string) => {
    if (!watchlist.includes(sym) && watchlist.length < 15) {
      setWatchlist(prev => [...prev, sym])
    }
    setShowAdd(false)
  }

  const removeSymbol = (sym: string) => setWatchlist(prev => prev.filter(s => s !== sym))

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
            <a href="/premarket" className="text-sm text-gray-400 hover:text-white transition-colors">Pre-Market</a>
            <a href="/watchlist" className="text-sm font-semibold text-white border-b border-emerald-500 pb-0.5">Watchlist</a>
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
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black tracking-tight mb-1 flex items-center gap-3">
              <Star size={28} className="text-amber-400"/> My Watchlist
            </h1>
            <p className="text-gray-500 text-sm">Your personal tracking list · Up to 15 symbols · Persists across sessions</p>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdate && <div className="flex items-center gap-1.5 text-xs text-gray-600 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2"><RefreshCw size={11}/>{lastUpdate}</div>}
            <button onClick={toggleAuto} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${autoEnabled ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60' : 'bg-gray-900/40 text-gray-500 border-gray-800'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${autoEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`}/>
              {autoEnabled ? countdownStr : 'Auto'}
            </button>
            <button onClick={() => setShowAdd(!showAdd)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-950/60 hover:bg-emerald-950 text-emerald-400 text-sm font-medium rounded-lg border border-emerald-800/60 transition-all">
              <Plus size={14}/>Add Symbol
            </button>
            <button onClick={fetchData} disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-sm font-medium text-white rounded-lg border border-gray-700 transition-all disabled:opacity-50">
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''}/>Refresh
            </button>
          </div>
        </div>

        {/* Add symbol panel */}
        {showAdd && (
          <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-4 mb-6">
            <p className="text-sm font-bold text-white mb-3">Add to watchlist ({watchlist.length}/15)</p>
            <div className="flex flex-wrap gap-2">
              {ALL_SYMBOLS.filter(s => !watchlist.includes(s)).map(sym => (
                <button key={sym} onClick={() => addSymbol(sym)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${INDICES.includes(sym) ? 'bg-cyan-950/40 text-cyan-400 border-cyan-800/50 hover:bg-cyan-950' : 'bg-gray-800 text-gray-300 border-gray-700 hover:border-emerald-600 hover:text-emerald-400'}`}>
                  + {sym}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Watchlist table */}
        {loading ? (
          <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-14 bg-gray-900/30 border border-gray-800 rounded-xl animate-pulse"/>)}</div>
        ) : items.length > 0 ? (
          <div className="rounded-2xl border border-gray-800 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-900/60 border-b border-gray-800">
                  {['Symbol','CMP','PCR','Signal','OI Structure','CE Wall','→CE','PE Wall','→PE',''].map((h, i) => (
                    <th key={`${h}-${i}`} className={`text-xs font-semibold text-gray-500 px-4 py-3.5 ${i === 0 ? 'text-left pl-5' : i === 9 ? 'text-right pr-5' : 'text-right'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => {
                  const structure = getStructure(item.cmp, item.ceWall, item.peWall)
                  return (
                    <tr key={item.symbol} className={`border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors ${i%2===0 ? '' : 'bg-gray-900/20'}`}>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <a href={`/stock/${item.symbol}`} className="text-sm font-black text-white hover:text-emerald-400 transition-colors">{item.symbol}</a>
                          {INDICES.includes(item.symbol) && <span className="text-xs px-1.5 py-0.5 bg-cyan-950 text-cyan-400 border border-cyan-800/50 rounded-md">IDX</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right text-sm font-bold text-amber-400">₹{item.cmp.toLocaleString()}</td>
                      <td className={`px-4 py-3.5 text-right text-sm font-black ${item.pcr > 1 ? 'text-emerald-400' : 'text-red-400'}`}>{item.pcr.toFixed(2)}</td>
                      <td className="px-4 py-3.5 text-right">
                        <span className={`text-xs font-bold ${SIGNAL_COLOR[item.signal]}`}>{item.signal.replace('_', ' ')}</span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span className={`text-xs font-bold ${STRUCTURE_COLOR[structure]}`}>{structure}</span>
                      </td>
                      <td className="px-4 py-3.5 text-right text-sm font-bold text-red-400">{item.ceWall.toLocaleString()}</td>
                      <td className="px-4 py-3.5 text-right text-xs text-red-300">{item.distCE}%</td>
                      <td className="px-4 py-3.5 text-right text-sm font-bold text-emerald-400">{item.peWall.toLocaleString()}</td>
                      <td className="px-4 py-3.5 text-right text-xs text-emerald-300">{item.distPE}%</td>
                      <td className="px-5 py-3.5 text-right">
                        <button onClick={() => removeSymbol(item.symbol)} className="text-gray-600 hover:text-red-400 transition-colors">
                          <X size={14}/>
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center border border-gray-800/50 rounded-2xl">
            <Star size={32} className="text-gray-700 mb-4"/>
            <h3 className="text-lg font-bold text-gray-400 mb-2">Your watchlist is empty</h3>
            <p className="text-sm text-gray-600">Click Add Symbol to start tracking your favourite F&O stocks</p>
          </div>
        )}
      </div>
    </div>
  )
}
