'use client'
import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, Clock } from 'lucide-react'
import { useAutoRefresh } from '@/lib/useAutoRefresh'

interface MPSymbol {
  symbol: string; cmp: number; max_pain: number; dist_from_mp: number
  days_to_expiry: number; expiry: string; pcr: number
  is_index: boolean; direction: string
}

export default function MaxPain() {
  const [data, setData] = useState<{ symbols: MPSymbol[]; timestamp: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'index' | 'stocks'>('all')
  const [sortBy, setSortBy] = useState<'dist' | 'expiry' | 'pcr'>('dist')
  const [lastUpdate, setLastUpdate] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('http://localhost:8000/max-pain')
      const json = await res.json()
      setData(json)
      if (json.timestamp) setLastUpdate(new Date(json.timestamp).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }))
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [])

  const { enabled: autoEnabled, toggle: toggleAuto, countdownStr } = useAutoRefresh(fetchData, 5 * 60 * 1000, true)
  useEffect(() => { fetchData() }, [fetchData])

  const filtered = (data?.symbols || [])
    .filter(s => filter === 'all' || (filter === 'index' ? s.is_index : !s.is_index))
    .sort((a, b) => {
      if (sortBy === 'dist') return Math.abs(b.dist_from_mp) - Math.abs(a.dist_from_mp)
      if (sortBy === 'expiry') return (a.days_to_expiry || 99) - (b.days_to_expiry || 99)
      return Math.abs(b.pcr - 1) - Math.abs(a.pcr - 1)
    })

  const expiryTomorrow = data?.symbols.filter(s => s.days_to_expiry === 1) || []
  const farFromMP = data?.symbols.filter(s => Math.abs(s.dist_from_mp) > 2) || []
  const closeToMP = data?.symbols.filter(s => Math.abs(s.dist_from_mp) <= 0.5) || []

  function ExpiryBadge({ days }: { days: number }) {
    const color = days <= 1 ? 'bg-red-950 text-red-400 border-red-800' :
      days <= 7 ? 'bg-orange-950 text-orange-400 border-orange-800' :
      'bg-gray-900 text-gray-400 border-gray-700'
    return <span className={`text-xs font-bold px-2 py-0.5 rounded-md border ${color}`}>
      {days <= 1 ? '🔥 EXPIRY TOMORROW' : days <= 7 ? `⚡ ${days}D to expiry` : `${days}D`}
    </span>
  }

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
            <a href="/watchlist" className="text-sm text-gray-400 hover:text-white transition-colors">Watchlist</a>
            <a href="/scanners" className="text-sm text-gray-400 hover:text-white transition-colors">Scanners</a>
            <a href="/charts" className="text-sm text-gray-400 hover:text-white transition-colors">OI Charts</a>
            <a href="/pcr" className="text-sm text-gray-400 hover:text-white transition-colors">PCR Trend</a>
            <a href="/spikes" className="text-sm text-gray-400 hover:text-white transition-colors">OI Spikes</a>
            <a href="/volume" className="text-sm text-gray-400 hover:text-white transition-colors">Vol Spikes</a>
            <a href="/uoa" className="text-sm text-gray-400 hover:text-white transition-colors">UOA</a>
            <a href="/confluence" className="text-sm text-gray-400 hover:text-white transition-colors">Confluence</a>
            <a href="/maxpain" className="text-sm font-semibold text-white border-b border-emerald-500 pb-0.5">Max Pain</a>
            <a href="/alerts" className="text-sm text-gray-400 hover:text-white transition-colors">Alerts</a>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black tracking-tight mb-1">Max Pain Tracker</h1>
            <p className="text-gray-500 text-sm">Price gravitates toward max pain at expiry · Distance shows how far CMP is from pin</p>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdate && <div className="flex items-center gap-1.5 text-xs text-gray-600 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2"><Clock size={11}/>{lastUpdate}</div>}
            <button onClick={toggleAuto} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${autoEnabled ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60' : 'bg-gray-900/40 text-gray-500 border-gray-800'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${autoEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`}/>
              {autoEnabled ? countdownStr : 'Auto'}
            </button>
            <button onClick={fetchData} disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-sm font-medium text-white rounded-lg border border-gray-700 transition-all disabled:opacity-50">
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''}/>Refresh
            </button>
          </div>
        </div>

        {/* Alert cards */}
        {expiryTomorrow.length > 0 && (
          <div className="bg-red-950/20 border border-red-800/40 rounded-xl p-4 mb-6 flex items-center gap-4">
            <div className="text-2xl">🔥</div>
            <div>
              <p className="text-sm font-bold text-red-400">Expiry Tomorrow — {expiryTomorrow.map(s => s.symbol).join(', ')}</p>
              <p className="text-xs text-gray-500 mt-0.5">Max pain effect strongest in last session. Watch for pinning action near max pain levels.</p>
            </div>
          </div>
        )}

        {/* Summary stats */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Total Tracked</p>
            <p className="text-2xl font-black text-white">{data?.symbols.length || 0}</p>
            <p className="text-xs text-gray-600">F&O symbols</p>
          </div>
          <div className="bg-red-950/20 border border-red-800/40 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Expiry Tomorrow</p>
            <p className="text-2xl font-black text-red-400">{expiryTomorrow.length}</p>
            <p className="text-xs text-gray-600">Max pain effect strongest</p>
          </div>
          <div className="bg-amber-950/20 border border-amber-800/40 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Far from Max Pain</p>
            <p className="text-2xl font-black text-amber-400">{farFromMP.length}</p>
            <p className="text-xs text-gray-600">&gt;2% away — gravitational pull</p>
          </div>
          <div className="bg-emerald-950/20 border border-emerald-800/40 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Near Max Pain</p>
            <p className="text-2xl font-black text-emerald-400">{closeToMP.length}</p>
            <p className="text-xs text-gray-600">&lt;0.5% — pinned at expiry level</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-2">
            {(['all','index','stocks'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all capitalize ${filter === f ? 'bg-white text-gray-900 border-white' : 'bg-gray-900/40 text-gray-400 border-gray-800 hover:text-white'}`}>
                {f}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Sort by:</span>
            {[
              { key: 'dist', label: 'Distance from MP' },
              { key: 'expiry', label: 'Nearest Expiry' },
              { key: 'pcr', label: 'PCR Extremity' },
            ].map(s => (
              <button key={s.key} onClick={() => setSortBy(s.key as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${sortBy === s.key ? 'bg-gray-700 text-white border-gray-600' : 'bg-gray-900/40 text-gray-400 border-gray-800 hover:text-white'}`}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-14 bg-gray-900/30 border border-gray-800 rounded-xl animate-pulse"/>)}</div>
        ) : (
          <div className="rounded-2xl border border-gray-800 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-900/60 border-b border-gray-800">
                  {['Symbol','CMP','Max Pain','Distance','Direction','PCR','Expiry','Days'].map((h, i) => (
                    <th key={h} className={`text-xs font-semibold text-gray-500 px-4 py-3.5 ${i <= 0 ? 'text-left pl-5' : 'text-right'} ${i === 7 ? 'pr-5' : ''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, i) => {
                  const isFar = Math.abs(row.dist_from_mp) > 2
                  const isExpiringSoon = row.days_to_expiry <= 1
                  return (
                    <tr key={row.symbol}
                      className={`border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors ${isExpiringSoon ? 'bg-red-950/10' : i%2===0 ? '' : 'bg-gray-900/20'}`}>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <a href={`/stock/${row.symbol}`} className="text-sm font-black text-white hover:text-emerald-400 transition-colors">{row.symbol}</a>
                          {row.is_index && <span className="text-xs px-1.5 py-0.5 bg-cyan-950 text-cyan-400 border border-cyan-800/50 rounded-md">IDX</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right text-sm font-bold text-amber-400">₹{row.cmp.toLocaleString()}</td>
                      <td className="px-4 py-3.5 text-right text-sm font-bold text-white">₹{row.max_pain.toLocaleString()}</td>
                      <td className={`px-4 py-3.5 text-right text-sm font-black ${isFar ? (row.dist_from_mp > 0 ? 'text-orange-400' : 'text-blue-400') : 'text-gray-400'}`}>
                        {row.dist_from_mp > 0 ? '+' : ''}{row.dist_from_mp}%
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${row.direction === 'ABOVE' ? 'bg-orange-950/50 text-orange-400 border border-orange-800/50' : 'bg-blue-950/50 text-blue-400 border border-blue-800/50'}`}>
                          {row.direction === 'ABOVE' ? '↑ Above MP' : '↓ Below MP'}
                        </span>
                      </td>
                      <td className={`px-4 py-3.5 text-right text-sm font-bold ${row.pcr > 1 ? 'text-emerald-400' : 'text-red-400'}`}>{row.pcr}</td>
                      <td className="px-4 py-3.5 text-right text-xs text-gray-500">{row.expiry}</td>
                      <td className="px-5 py-3.5 text-right">
                        <ExpiryBadge days={row.days_to_expiry} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Max Pain explanation */}
        <div className="mt-6 bg-gray-900/20 border border-gray-800/50 rounded-xl p-5">
          <h3 className="text-sm font-bold text-white mb-3">How to read Max Pain</h3>
          <div className="grid grid-cols-3 gap-4 text-xs text-gray-500">
            <div>
              <p className="text-amber-400 font-bold mb-1">↑ CMP Above Max Pain</p>
              <p>Price needs to fall toward max pain level. Option sellers profit when price moves to max pain.</p>
            </div>
            <div>
              <p className="text-blue-400 font-bold mb-1">↓ CMP Below Max Pain</p>
              <p>Price needs to rise toward max pain. Watch for support at current level and recovery.</p>
            </div>
            <div>
              <p className="text-emerald-400 font-bold mb-1">≈ Near Max Pain</p>
              <p>Already pinned. Expect rangebound action. Option sellers in full control of price.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
