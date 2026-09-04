'use client'
import Navbar from '@/components/Navbar'
import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, TrendingUp, TrendingDown, Pen, Flame } from 'lucide-react'

const API = 'https://api.greeknova.com'

interface ScanRow {
  symbol: string
  state: 'sustaining' | 'failed'
  first_hour_high: number
  first_hour_low: number
  breakout_time: string | null
  cmp: number
  put_writing: boolean
  fut_buildup: boolean
  confirmed: boolean
}

export default function FirstHourBreakoutScanner() {
  const [rows, setRows] = useState<ScanRow[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<'all' | 'sustaining' | 'failed' | 'confirmed'>('all')
  const [scanned, setScanned] = useState(0)
  const [generatedAt, setGeneratedAt] = useState<string>('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/first-hour-breakout/scan`).then(r => r.json())
      if (res?.results) {
        setRows(res.results)
        setScanned(res.scanned || 0)
        setGeneratedAt(res.generated_at || '')
      }
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = rows.filter(r => {
    if (filter === 'all') return true
    if (filter === 'confirmed') return r.confirmed
    return r.state === filter
  })

  const sustainingCount = rows.filter(r => r.state === 'sustaining').length
  const failedCount = rows.filter(r => r.state === 'failed').length
  const confirmedCount = rows.filter(r => r.confirmed).length

  return (
    <div className="min-h-screen bg-[#07070e] text-white">
      <Navbar active="/first-hour-breakout" />

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-black tracking-tight mb-1">First Hour Breakout Scanner</h1>
          <p className="text-gray-500 text-sm">
            Stocks that broke their 9:15-10:15 AM opening range high, tracking whether the
            breakout is sustaining or has failed back below the range low.
          </p>
          {generatedAt && (
            <p className="text-xs text-gray-600 mt-1">
              Scanned {scanned} symbols · updated {new Date(generatedAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })} IST
            </p>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-emerald-950/20 border border-emerald-800/40 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Sustaining</p>
            <p className="text-2xl font-black text-emerald-400">{sustainingCount}</p>
          </div>
          <div className="bg-red-950/20 border border-red-800/40 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Failed</p>
            <p className="text-2xl font-black text-red-400">{failedCount}</p>
          </div>
          <div className="bg-purple-950/20 border border-purple-800/40 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Confirmed (Put Writing / FUT Buildup)</p>
            <p className="text-2xl font-black text-purple-400">{confirmedCount}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-4">
          {(['all', 'sustaining', 'failed', 'confirmed'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${filter === f ? 'bg-white text-gray-900 border-white' : 'bg-gray-900/40 text-gray-400 border-gray-800 hover:text-white'}`}>
              {f === 'all' ? 'All' : f === 'sustaining' ? 'Sustaining' : f === 'failed' ? 'Failed' : 'Confirmed'}
            </button>
          ))}
          <button onClick={load} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-sm font-medium text-white rounded-xl border border-gray-700 transition-all disabled:opacity-50 ml-auto">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''}/>Refresh
          </button>
        </div>

        {loading && rows.length === 0 ? (
          <div className="h-64 flex items-center justify-center">
            <RefreshCw size={24} className="text-gray-600 animate-spin"/>
          </div>
        ) : filtered.length === 0 ? (
          <div className="h-64 flex items-center justify-center flex-col gap-3">
            <div className="text-4xl">📊</div>
            <p className="text-gray-500 text-sm">No stocks have broken their first-hour high yet</p>
          </div>
        ) : (
          <div className="bg-gray-900/20 border border-gray-800 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-500 text-xs">
                  <th className="py-3 px-4 text-left">Symbol</th>
                  <th className="py-3 px-3 text-left">State</th>
                  <th className="py-3 px-3 text-right">CMP</th>
                  <th className="py-3 px-3 text-right">1H High</th>
                  <th className="py-3 px-3 text-right">1H Low</th>
                  <th className="py-3 px-3 text-left">Broke Out</th>
                  <th className="py-3 px-3 text-center">Confirmation</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.symbol} className="border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors">
                    <td className="py-3 px-4 font-bold text-white">{r.symbol}</td>
                    <td className="py-3 px-3">
                      {r.state === 'sustaining' ? (
                        <span className="flex items-center gap-1 text-emerald-400 text-xs font-bold">
                          <TrendingUp size={13}/> Sustaining
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-red-400 text-xs font-bold">
                          <TrendingDown size={13}/> Failed
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right text-gray-300">{r.cmp?.toLocaleString()}</td>
                    <td className="py-3 px-3 text-right text-gray-400">{r.first_hour_high?.toLocaleString()}</td>
                    <td className="py-3 px-3 text-right text-gray-400">{r.first_hour_low?.toLocaleString()}</td>
                    <td className="py-3 px-3 text-gray-400">{r.breakout_time || '-'}</td>
                    <td className="py-3 px-3">
                      <div className="flex items-center justify-center gap-2">
                        {r.put_writing && (
                          <span className="flex items-center gap-1 text-cyan-400 text-xs font-bold" title="Near-ATM Put Writing detected">
                            <Pen size={13}/>PE
                          </span>
                        )}
                        {r.fut_buildup && (
                          <span className="flex items-center gap-1 text-amber-400 text-xs font-bold" title="FUT Long Buildup detected">
                            <Flame size={13}/>FUT
                          </span>
                        )}
                        {!r.put_writing && !r.fut_buildup && (
                          <span className="text-gray-700 text-xs">-</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-6 mt-4 text-xs text-gray-600">
          <span><span className="text-emerald-400">Sustaining</span> - broke the first-hour high, and hasn't closed back below the first-hour low since</span>
          <span><span className="text-red-400">Failed</span> - broke the first-hour high, but has since closed back below the first-hour low, a trapped breakout</span>
          <span><span className="text-cyan-400">PE</span> - near-ATM Put Writing confirms this move (score 4+)</span>
          <span><span className="text-amber-400">FUT</span> - futures OI building up alongside the price move (Long Buildup)</span>
          <span>Only stocks that have actually broken their first-hour high appear here</span>
          <span>Informational only. Not investment advice</span>
        </div>
      </div>
    </div>
  )
}
