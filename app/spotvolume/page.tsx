'use client'
import Navbar from '@/components/Navbar'
import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, TrendingUp, Clock, Zap, Flame, Building2 } from 'lucide-react'

const API = 'https://api.greeknova.com'

interface ScanRow {
  symbol: string
  state: 'breakout' | 'bursting' | 'pausing'
  burst_date: string
  burst_high: number
  burst_low: number | null
  burst_ratio: number
  baseline_used: string
  burst_is_green: boolean | null
  avg_pause_vol_ratio: number | null
  pause_days: number
  breakout_date?: string
  breakout_vol_ratio?: number
  confirmed?: boolean
  cmp: number | null
}

interface TowerRow {
  symbol: string
  tower_date: string
  tower_ratio: number
  tower_volume: number
  avg_volume_20d: number
  tower_high: number
  tower_low: number
  tower_close: number
  cmp: number
}

function fmtDate(d: string) {
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) }
  catch { return d }
}

function fmtVol(v: number) {
  if (v >= 10000000) return `${(v / 10000000).toFixed(2)}Cr`
  if (v >= 100000) return `${(v / 100000).toFixed(2)}L`
  return v.toLocaleString()
}

export default function SpotVolumeScanner() {
  const [rows, setRows] = useState<ScanRow[]>([])
  const [towerRows, setTowerRows] = useState<TowerRow[]>([])
  const [futMap, setFutMap] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<'all' | 'breakout' | 'bursting' | 'pausing'>('all')
  const [scanned, setScanned] = useState(0)
  const [generatedAt, setGeneratedAt] = useState<string>('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [scanRes, pulseRes] = await Promise.all([
        fetch(`${API}/spot-volume/scan`).then(r => r.json()).catch(() => null),
        fetch(`${API}/oi-pulse`).then(r => r.json()).catch(() => null),
      ])
      if (scanRes?.results) {
        setRows(scanRes.results)
        setScanned(scanRes.scanned || 0)
        setGeneratedAt(scanRes.generated_at || '')
      }
      if (scanRes?.tower_days) {
        setTowerRows(scanRes.tower_days)
      }
      if (pulseRes?.items) {
        const map: Record<string, number> = {}
        for (const item of pulseRes.items) {
          if (item.symbol && item.vol_ratio != null) map[item.symbol] = item.vol_ratio
        }
        setFutMap(map)
      }
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = rows.filter(r => {
    if (filter === 'all') return true
    return r.state === filter
  })

  const breakoutCount = rows.filter(r => r.state === 'breakout').length
  const burstingCount = rows.filter(r => r.state === 'bursting').length
  const pausingCount = rows.filter(r => r.state === 'pausing').length
  const confirmedCount = rows.filter(r => r.state === 'breakout' && r.confirmed).length

  return (
    <div className="min-h-screen bg-[#07070e] text-white">
      <Navbar active="/spotvolume" />

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-black tracking-tight mb-1">⚡ Spot Volume Breakout Scanner</h1>
          <p className="text-gray-500 text-sm">
            Burst → pause → breakout, on real NSE cash-market volume — sidesteps the false signals
            futures volume gives during rollover weeks.
          </p>
          {generatedAt && (
            <p className="text-xs text-gray-600 mt-1">
              Scanned {scanned} symbols · updated {new Date(generatedAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })} IST
            </p>
          )}
        </div>

        {towerRows.length > 0 && (
          <div className="mb-6 bg-gradient-to-r from-amber-950/30 via-amber-900/10 to-transparent border border-amber-700/50 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Building2 size={18} className="text-amber-400" />
              <h2 className="text-lg font-black text-amber-300">Tower Day</h2>
              <span className="text-xs text-gray-500">— today's volume dwarfs the last 20 days, live, refreshed daily</span>
            </div>
            <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
              {towerRows.map(t => (
                <div key={t.symbol} className="bg-black/30 border border-amber-800/40 rounded-xl p-3">
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="font-bold text-white">{t.symbol}</span>
                    <span className="text-amber-400 font-black text-lg">{t.tower_ratio}x</span>
                  </div>
                  <div className="text-xs text-gray-500">
                    Vol {fmtVol(t.tower_volume)} vs {fmtVol(t.avg_volume_20d)} avg
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    CMP {t.cmp?.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="bg-emerald-950/20 border border-emerald-800/40 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Breakout Confirmed</p>
            <p className="text-2xl font-black text-emerald-400">{confirmedCount}</p>
          </div>
          <div className="bg-amber-950/20 border border-amber-800/40 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Breakout (vol pending)</p>
            <p className="text-2xl font-black text-amber-400">{breakoutCount - confirmedCount}</p>
          </div>
          <div className="bg-orange-950/20 border border-orange-800/40 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Bursting Now</p>
            <p className="text-2xl font-black text-orange-400">{burstingCount}</p>
          </div>
          <div className="bg-cyan-950/20 border border-cyan-800/40 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Pausing (watching)</p>
            <p className="text-2xl font-black text-cyan-400">{pausingCount}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-4">
          {(['all', 'breakout', 'bursting', 'pausing'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${filter === f ? 'bg-white text-gray-900 border-white' : 'bg-gray-900/40 text-gray-400 border-gray-800 hover:text-white'}`}>
              {f === 'all' ? 'All' : f === 'breakout' ? 'Breakout' : f === 'bursting' ? 'Bursting' : 'Pausing'}
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
            <div className="text-4xl">⚡</div>
            <p className="text-gray-500 text-sm">No stocks currently matching this pattern</p>
          </div>
        ) : (
          <div className="bg-gray-900/20 border border-gray-800 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-500 text-xs">
                  <th className="py-3 px-4 text-left">Symbol</th>
                  <th className="py-3 px-3 text-left">State</th>
                  <th className="py-3 px-3 text-right">CMP</th>
                  <th className="py-3 px-3 text-right">Spot Vol</th>
                  <th className="py-3 px-3 text-right">FUT Vol</th>
                  <th className="py-3 px-3 text-left">Burst Day</th>
                  <th className="py-3 px-3 text-right">Burst High</th>
                  <th className="py-3 px-3 text-left">Since / Breakout</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const futRatio = futMap[r.symbol]
                  const divergent = futRatio != null && Math.abs(futRatio - r.burst_ratio) >= 1.0
                  return (
                    <tr key={r.symbol} className="border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors">
                      <td className="py-3 px-4 font-bold text-white">{r.symbol}</td>
                      <td className="py-3 px-3">
                        {r.state === 'breakout' ? (
                          r.confirmed ? (
                            <span className="flex items-center gap-1 text-emerald-400 text-xs font-bold">
                              <TrendingUp size={13}/> Breakout
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-amber-400 text-xs font-bold">
                              <Zap size={13}/> Breakout (vol pending)
                            </span>
                          )
                        ) : r.state === 'bursting' ? (
                          <span className="flex items-center gap-1 text-orange-400 text-xs font-bold">
                            <Flame size={13}/> Bursting Now
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-cyan-400 text-xs font-bold">
                            <Clock size={13}/> Pausing
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right text-gray-300">{r.cmp?.toLocaleString() ?? '—'}</td>
                      <td className="py-3 px-3 text-right font-bold text-orange-400">
                        {r.burst_ratio}x <span className="text-gray-600 text-xs">({r.baseline_used})</span>
                      </td>
                      <td className={`py-3 px-3 text-right font-bold ${divergent ? 'text-red-400' : 'text-gray-400'}`}>
                        {futRatio != null ? `${futRatio}x` : '—'}
                        {divergent && <span className="ml-1 text-[10px]" title="Spot and futures volume diverge — possible rollover distortion">⚠️</span>}
                      </td>
                      <td className="py-3 px-3 text-gray-400">
                        {fmtDate(r.burst_date)}
                        {r.burst_is_green != null && (
                          <span
                            className="ml-1.5"
                            title={r.burst_is_green
                              ? 'Burst day closed green — buyers stepped in (like a clean coil-then-breakout setup)'
                              : 'Burst day closed red — often a capitulation/selling climax rather than accumulation'}>
                            {r.burst_is_green ? '🟢' : '🔴'}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right text-gray-400">{r.burst_high?.toLocaleString()}</td>
                      <td className="py-3 px-3 text-gray-400">
                        {r.state === 'breakout'
                          ? `${fmtDate(r.breakout_date || '')} · ${r.breakout_vol_ratio}x`
                          : r.state === 'bursting'
                          ? 'Live — forming now'
                          : (
                            <>
                              {r.pause_days} day{r.pause_days === 1 ? '' : 's'}
                              {r.avg_pause_vol_ratio != null && (
                                <span
                                  className={`ml-1.5 text-xs ${r.avg_pause_vol_ratio < 0.8 ? 'text-cyan-500' : 'text-gray-600'}`}
                                  title={r.avg_pause_vol_ratio < 0.8
                                    ? 'Volume has genuinely gone quiet during the pause — a real dull consolidation'
                                    : 'Volume during the pause is close to or above average — not a clean, quiet coil'}>
                                  · vol {r.avg_pause_vol_ratio}x avg
                                </span>
                              )}
                            </>
                          )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-6 mt-4 text-xs text-gray-600">
          <span><span className="text-amber-400">Tower Day</span> — today's volume is 6x+ the trailing 20-day average, a live daily signal that resets every day; only shows up on the day it actually happens, never held or carried forward</span>
          <span><span className="text-orange-400">Bursting Now</span> — volume burst happening today, still live — its high is still forming, so there's nothing to break out above yet</span>
          <span><span className="text-cyan-400">Pausing</span> — burst happened on an earlier day, price hasn't broken that day's high yet</span>
          <span><span className="text-amber-400">Breakout (vol pending)</span> — price broke out, volume confirmation still building intraday</span>
          <span><span className="text-emerald-400">Breakout</span> — price broke out with volume confirmation</span>
          <span><span className="text-red-400">⚠️</span> — spot and futures volume ratios diverge notably, often a rollover-week artifact on the futures side</span>
          <span>🟢/🔴 next to Burst Day — burst candle closed green (accumulation) or red (capitulation/selling climax)</span>
          <span><span className="text-cyan-500">vol Xx avg</span> next to Pausing days — average volume during the pause vs its normal baseline; under 0.8x means it's genuinely gone quiet, a real dull consolidation rather than noisy chop</span>
          <span>A pause disappears from this list entirely if price closes below the burst day's low — that's a failed setup, not a healthy hold, so it's dropped rather than shown as if nothing happened</span>
        </div>
      </div>
    </div>
  )
}
