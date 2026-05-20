'use client'
import Navbar from '@/components/Navbar'
import { useEffect, useState, useCallback, useRef } from 'react'
import { RefreshCw } from 'lucide-react'

const API = 'https://greeknova-backend-production.up.railway.app'

const INDICES = ['NIFTY', 'BANKNIFTY', 'FINNIFTY']
const STOCKS = [
  'RELIANCE','TCS','HDFCBANK','INFY','ICICIBANK','HINDUNILVR','ITC','SBIN','BHARTIARTL',
  'KOTAKBANK','LT','AXISBANK','ASIANPAINT','MARUTI','TITAN','SUNPHARMA','ULTRACEMCO',
  'BAJFINANCE','WIPRO','HCLTECH','TATACONSUM','TATASTEEL','ADANIENT','POWERGRID','NTPC',
  'ONGC','JSWSTEEL','COALINDIA','BAJAJFINSV','TECHM','APOLLOHOSP','BAJAJ-AUTO','BPCL',
  'BRITANNIA','CIPLA','DRREDDY','EICHERMOT','GRASIM','HEROMOTOCO','HINDALCO','HDFCLIFE',
  'INDUSINDBK','JIOFIN','M&M','NESTLEIND','SBILIFE','SHRIRAMFIN','TRENT','ADANIPORTS',
  'BANKBARODA','BEL','CANBK','CHOLAFIN','DLF','GAIL','HAVELLS','HAL','INDIGO','PFC',
  'RECLTD','SAIL','TATAPOWER','VEDL',
]

interface HeatCell {
  ts: string; oi: number; intensity: number
}

interface HeatRow {
  strike: number; values: HeatCell[]
}

interface CmpPoint {
  timestamp: string; cmp: number | null
}

interface HeatmapData {
  symbol: string; date: string; expiry: string; expiries: string[]
  timestamps: string[]; time_labels: string[]
  strikes: number[]
  ce_data: HeatRow[]; pe_data: HeatRow[]
  cmp_series: CmpPoint[]
  mid_cmp: number; latest_cmp: number; snapshot_count: number
}

function fmtOI(n: number) {
  if (n >= 10000000) return `${(n/10000000).toFixed(1)}Cr`
  if (n >= 100000)   return `${(n/100000).toFixed(1)}L`
  if (n >= 1000)     return `${(n/1000).toFixed(0)}K`
  return String(n)
}

function fmtDate(d: string) {
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) }
  catch { return d }
}

// Color intensity for CE (red shades) and PE (green shades)
function getCEColor(intensity: number): string {
  if (intensity === 0) return 'bg-gray-900/20'
  if (intensity < 10)  return 'bg-red-950/30'
  if (intensity < 25)  return 'bg-red-900/50'
  if (intensity < 50)  return 'bg-red-800/70'
  if (intensity < 75)  return 'bg-red-700/85'
  return 'bg-red-500'
}

function getPEColor(intensity: number): string {
  if (intensity === 0) return 'bg-gray-900/20'
  if (intensity < 10)  return 'bg-emerald-950/30'
  if (intensity < 25)  return 'bg-emerald-900/50'
  if (intensity < 50)  return 'bg-emerald-800/70'
  if (intensity < 75)  return 'bg-emerald-700/85'
  return 'bg-emerald-500'
}

function HeatCell({ intensity, oi, isCE, isWall, isAtm, isVacuum }:
  { intensity: number; oi: number; isCE: boolean; isWall: boolean; isAtm: boolean; isVacuum: boolean }) {
  const baseColor = isCE ? getCEColor(intensity) : getPEColor(intensity)
  const border = isWall  ? (isCE ? 'ring-1 ring-red-400' : 'ring-1 ring-emerald-400')
               : isVacuum ? 'ring-1 ring-amber-500/50'
               : isAtm    ? 'ring-1 ring-amber-400/50'
               : ''

  return (
    <div className={`relative w-full h-7 ${baseColor} ${border} transition-colors group cursor-default`}>
      {/* Tooltip on hover */}
      {oi > 0 && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-50 whitespace-nowrap">
          <div className="bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-[10px] text-white shadow-xl">
            {fmtOI(oi)}
          </div>
        </div>
      )}
      {/* Wall indicator */}
      {isWall && (
        <div className={`absolute inset-0 flex items-center justify-center text-[8px] font-black ${isCE ? 'text-red-300' : 'text-emerald-300'}`}>
          W
        </div>
      )}
      {/* Vacuum indicator — only show ⚡ on first cell of vacuum row, not every cell */}
      {isVacuum && intensity === 0 && (
        <div className="absolute inset-0 bg-amber-950/20"/>
      )}
    </div>
  )
}

export default function OIHeatmap() {
  const [data, setData]       = useState<HeatmapData | null>(null)
  const [loading, setLoading] = useState(true)
  const [symbol, setSymbol]   = useState('NIFTY')
  const [expiry, setExpiry]   = useState('')
  const [view, setView]       = useState<'CE'|'PE'|'BOTH'>('BOTH')
  const [hoveredCell, setHoveredCell] = useState<{strike: number; timeIdx: number; oi: number; type: string} | null>(null)
  const [countdown, setCountdown] = useState(300)
  const intervalRef  = useRef<NodeJS.Timeout|null>(null)
  const countdownRef = useRef<NodeJS.Timeout|null>(null)
  const isStock = STOCKS.includes(symbol)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (expiry) params.set('expiry', expiry)
      // Cache-busting: add timestamp so browser never serves stale response
      params.set('_t', Date.now().toString())
      const res  = await fetch(`${API}/oi-heatmap/${symbol}?${params}`, { cache: 'no-store' })
      const json = await res.json()
      setData(json)
      if (!expiry && json.expiry) setExpiry(json.expiry)
    } catch(e) { console.error(e) }
    setLoading(false)
  }, [symbol, expiry])

  // ── FIX: keep a ref always pointing to latest fetchData ──────────────
  // This prevents the stale closure bug where the interval calls an old
  // version of fetchData that has outdated symbol/expiry in its closure.
  const fetchDataRef = useRef(fetchData)
  useEffect(() => { fetchDataRef.current = fetchData }, [fetchData])
  // ─────────────────────────────────────────────────────────────────────

  useEffect(() => { setExpiry('') }, [symbol])
  useEffect(() => { fetchData() }, [symbol, expiry])

  // Auto refresh every 5 mins — uses ref so interval never goes stale
  useEffect(() => {
    setCountdown(300)
    if (intervalRef.current)  clearInterval(intervalRef.current)
    if (countdownRef.current) clearInterval(countdownRef.current)

    // Use fetchDataRef.current() so each tick always calls the LATEST fetchData
    intervalRef.current  = setInterval(() => { fetchDataRef.current(); setCountdown(300) }, 5*60*1000)
    countdownRef.current = setInterval(() => setCountdown(p => Math.max(0, p-1)), 1000)

    return () => {
      if (intervalRef.current)  clearInterval(intervalRef.current)
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, []) // Empty deps — interval set once; fetchDataRef handles staying current

  const mins = Math.floor(countdown/60)
  const secs = countdown % 60

  // Find walls and ATM for each timestamp
  const ceWalls = data?.timestamps.map((ts, tIdx) => {
    let maxOI = 0, wallStrike = 0
    data.ce_data.forEach(row => {
      const oi = row.values[tIdx]?.oi || 0
      if (oi > maxOI) { maxOI = oi; wallStrike = row.strike }
    })
    return wallStrike
  }) || []

  const peWalls = data?.timestamps.map((ts, tIdx) => {
    let maxOI = 0, wallStrike = 0
    data.pe_data.forEach(row => {
      const oi = row.values[tIdx]?.oi || 0
      if (oi > maxOI) { maxOI = oi; wallStrike = row.strike }
    })
    return wallStrike
  }) || []

  // Get ATM strike per timestamp from cmp_series
  const atmPerTime = data?.timestamps.map((ts, tIdx) => {
    const cmp = data.cmp_series[tIdx]?.cmp
    if (!cmp || !data.strikes.length) return null
    return data.strikes.reduce((prev, curr) =>
      Math.abs(curr - cmp) < Math.abs(prev - cmp) ? curr : prev
    )
  }) || []

  // Reverse strikes for display (highest on top)
  const displayStrikes = data ? [...data.strikes].reverse().filter(strike => {
  const ceRow = data.ce_data.find(r => r.strike === strike)
  const peRow = data.pe_data.find(r => r.strike === strike)
  const maxCeOI = Math.max(...(ceRow?.values.map(v => v.oi) ?? [0]))
  const maxPeOI = Math.max(...(peRow?.values.map(v => v.oi) ?? [0]))
  return maxCeOI > 10000 || maxPeOI > 10000  // only show strikes with meaningful OI
}) : []

  return (
    <div className="min-h-screen bg-[#07070e] text-white">
      <Navbar active="/oiheatmap"/>

      <div className="max-w-full mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="text-3xl font-black tracking-tight mb-1">🌡️ OI Heatmap Timeline</h1>
            <p className="text-gray-500 text-sm">
              How OI built or crumbled at each strike throughout the day · Every 5-min snapshot
            </p>
          </div>
          <div className="flex items-center gap-3">
            {data?.expiries && data.expiries.length > 0 && (
              <div className="flex items-center gap-2 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2">
                <span className="text-xs text-gray-500">Expiry:</span>
                <select value={expiry} onChange={e => setExpiry(e.target.value)}
                  className="bg-transparent text-white text-xs focus:outline-none cursor-pointer">
                  {data.expiries.map(e => (
                    <option key={e} value={e} className="bg-gray-900">{fmtDate(e)}</option>
                  ))}
                </select>
              </div>
            )}
            {data?.latest_cmp && (
              <div className="flex items-center gap-2 bg-amber-950/30 border border-amber-800/50 rounded-xl px-4 py-2">
                <span className="text-xs text-gray-500">CMP</span>
                <span className="text-base font-black text-amber-400">₹{data.latest_cmp.toLocaleString('en-IN', {maximumFractionDigits: 2})}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 text-xs bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-gray-400">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/>
              {mins}:{secs.toString().padStart(2,'0')}
            </div>
            <button onClick={fetchData} disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-sm font-medium text-white rounded-lg border border-gray-700 disabled:opacity-50 transition-all">
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''}/>Refresh
            </button>
          </div>
        </div>

        {/* Symbol selector */}
        <div className="flex flex-wrap gap-2 mb-5 items-center">
          {INDICES.map(idx => (
            <button key={idx} onClick={() => setSymbol(idx)}
              className={`px-5 py-2.5 rounded-xl text-sm font-bold border transition-all ${symbol===idx ? 'bg-white text-gray-900 border-white' : 'bg-gray-900/40 text-gray-400 border-gray-800 hover:text-white'}`}>
              {idx}
            </button>
          ))}
          <select value={isStock ? symbol : ''} onChange={e => e.target.value && setSymbol(e.target.value)}
            className={`rounded-xl text-sm font-bold border transition-all px-4 py-2.5 focus:outline-none ${isStock ? 'bg-white text-gray-900 border-white' : 'bg-gray-900/40 text-gray-400 border-gray-800'}`}>
            <option value="">Stocks ▾</option>
            {STOCKS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          <div className="ml-auto flex items-center gap-1 bg-gray-900 border border-gray-800 rounded-lg p-1">
            {(['CE','PE','BOTH'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${view===v
                  ? v==='CE' ? 'bg-red-950 text-red-400'
                  : v==='PE' ? 'bg-emerald-950 text-emerald-400'
                  : 'bg-gray-700 text-white'
                  : 'text-gray-500 hover:text-white'}`}>
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-6 mb-4 px-1">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">CE OI:</span>
            <div className="flex gap-0.5">
              {['bg-gray-900/20','bg-red-950/30','bg-red-900/50','bg-red-800/70','bg-red-700/85','bg-red-500'].map((c,i) => (
                <div key={i} className={`w-5 h-4 rounded-sm ${c}`}/>
              ))}
            </div>
            <span className="text-xs text-gray-600">Low → High</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">PE OI:</span>
            <div className="flex gap-0.5">
              {['bg-gray-900/20','bg-emerald-950/30','bg-emerald-900/50','bg-emerald-800/70','bg-emerald-700/85','bg-emerald-500'].map((c,i) => (
                <div key={i} className={`w-5 h-4 rounded-sm ${c}`}/>
              ))}
            </div>
            <span className="text-xs text-gray-600">Low → High</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span><span className="font-bold text-red-400">W</span> = CE Wall</span>
            <span><span className="font-bold text-emerald-400">W</span> = PE Wall</span>
            <span><span className="text-amber-400">⚡</span> = Vacuum</span>
            <span className="text-amber-400">Ring = ATM</span>
          </div>
          {data && (
            <span className="text-xs text-gray-600 ml-auto">{data.snapshot_count} snapshots · {data.date}</span>
          )}
        </div>

        {/* Heatmap */}
        {loading ? (
          <div className="space-y-2">
            <div className="bg-blue-950/20 border border-blue-800/30 rounded-xl px-4 py-3 flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"/>
              <p className="text-xs text-blue-400">Building OI timeline... fetching all snapshots for today</p>
            </div>
            {[1,2,3,4,5,6,7,8].map(i => (
              <div key={i} className="h-7 bg-gray-900/30 rounded animate-pulse"/>
            ))}
          </div>
        ) : !data || data.strikes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 border border-gray-800/50 rounded-2xl">
            <div className="text-4xl mb-4">🌡️</div>
            <p className="text-gray-500">No heatmap data available</p>
          </div>
        ) : (
          <div className="bg-gray-900/20 border border-gray-800 rounded-2xl overflow-hidden">

            {/* Time header row */}
            <div className="flex border-b border-gray-800 bg-gray-900/60 sticky top-0 z-10">
              <div className="w-24 shrink-0 px-3 py-2 text-[10px] text-gray-500 font-bold border-r border-gray-800">
                STRIKE
              </div>
              {view !== 'PE' && (
                <div className="flex-1 border-r border-gray-800">
                  <div className="text-center py-1 text-[10px] text-red-400 font-bold border-b border-gray-800">CE OI →</div>
                  <div className="flex">
                    {data.time_labels.map((t, i) => (
                      <div key={i} className="flex-1 text-center text-[9px] text-gray-600 py-1 border-r border-gray-800/30 last:border-0">
                        {i % 2 === 0 ? t : ''}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {view !== 'CE' && (
                <div className="flex-1">
                  <div className="text-center py-1 text-[10px] text-emerald-400 font-bold border-b border-gray-800">PE OI →</div>
                  <div className="flex">
                    {data.time_labels.map((t, i) => (
                      <div key={i} className="flex-1 text-center text-[9px] text-gray-600 py-1 border-r border-gray-800/30 last:border-0">
                        {i % 2 === 0 ? t : ''}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Strike rows */}
            <div className="overflow-y-auto max-h-[70vh]">
              {displayStrikes.map(strike => {
                const ceRow = data.ce_data.find(r => r.strike === strike)
                const peRow = data.pe_data.find(r => r.strike === strike)

                return (
                  <div key={strike} className="flex border-b border-gray-800/40 hover:bg-gray-800/10 transition-colors">

                    {/* Strike label */}
                    <div className="w-24 shrink-0 flex items-center px-3 border-r border-gray-800">
                      <div>
                        <p className={`text-xs font-black ${
                          ceWalls.includes(strike) && peWalls.includes(strike) ? 'text-purple-400' :
                          ceWalls.includes(strike) ? 'text-red-400' :
                          peWalls.includes(strike) ? 'text-emerald-400' :
                          atmPerTime[atmPerTime.length - 1] === strike ? 'text-amber-400' :
                          'text-gray-400'
                        }`}>
                          {strike.toLocaleString()}
                        </p>
                        {ceWalls.includes(strike) && <p className="text-[8px] text-red-500">CE WALL</p>}
                        {peWalls.includes(strike) && <p className="text-[8px] text-emerald-500">PE WALL</p>}
                        {atmPerTime[atmPerTime.length - 1] === strike && !ceWalls.includes(strike) && !peWalls.includes(strike) && (
                          <p className="text-[8px] text-amber-500">ATM</p>
                        )}
                      </div>
                    </div>

                    {/* CE heatmap cells */}
                    {view !== 'PE' && (
                      <div className="flex-1 flex border-r border-gray-800">
                        {(ceRow?.values || []).map((cell, tIdx) => {
                          const isWall  = ceWalls[tIdx] === strike && cell.intensity > 30
                          const isAtm   = atmPerTime[atmPerTime.length - 1] === strike
                          const isVac   = cell.intensity < 5 && (peRow?.values[tIdx]?.intensity || 0) < 5
                          return (
                            <div key={tIdx} className="flex-1 border-r border-gray-800/20 last:border-0"
                              onMouseEnter={() => setHoveredCell({ strike, timeIdx: tIdx, oi: cell.oi, type: 'CE' })}
                              onMouseLeave={() => setHoveredCell(null)}>
                              <HeatCell intensity={cell.intensity} oi={cell.oi} isCE={true}
                                isWall={isWall} isAtm={isAtm} isVacuum={isVac}/>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* PE heatmap cells */}
                    {view !== 'CE' && (
                      <div className="flex-1 flex">
                        {(peRow?.values || []).map((cell, tIdx) => {
                          const isWall  = peWalls[tIdx] === strike && cell.intensity > 30
                          const isAtm   = atmPerTime[atmPerTime.length - 1] === strike
                          const isVac   = cell.intensity < 5 && (ceRow?.values[tIdx]?.intensity || 0) < 5
                          return (
                            <div key={tIdx} className="flex-1 border-r border-gray-800/20 last:border-0"
                              onMouseEnter={() => setHoveredCell({ strike, timeIdx: tIdx, oi: cell.oi, type: 'PE' })}
                              onMouseLeave={() => setHoveredCell(null)}>
                              <HeatCell intensity={cell.intensity} oi={cell.oi} isCE={false}
                                isWall={isWall} isAtm={isAtm} isVacuum={isVac}/>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Hover info bar */}
            <div className="px-4 py-2 border-t border-gray-800 bg-gray-900/40 h-8 flex items-center">
              {hoveredCell ? (
                <p className="text-xs text-gray-400">
                  Strike <span className="text-white font-bold">{hoveredCell.strike.toLocaleString()}</span> ·
                  {hoveredCell.type === 'CE' ? <span className="text-red-400"> CE</span> : <span className="text-emerald-400"> PE</span>} ·
                  Time <span className="text-white font-bold">{data?.time_labels[hoveredCell.timeIdx]}</span> ·
                  OI <span className="text-amber-400 font-bold">{fmtOI(hoveredCell.oi)}</span>
                </p>
              ) : (
                <p className="text-xs text-gray-600">Hover over any cell to see exact OI value</p>
              )}
            </div>
          </div>
        )}

        {/* ── Auto Interpretation Panel ─────────────────────────────── */}
        {data && data.strikes.length > 0 && (() => {
          const insights: { icon: string; text: string; color: string }[] = []
          const lastIdx = data.timestamps.length - 1
          const firstIdx = 0

          // 1. Find conviction CE wall (held longest)
          const cePeakStrike = (() => {
            let maxDuration = 0, bestStrike = 0
            data.ce_data.forEach(row => {
              const duration = row.values.filter(v => v.intensity > 60).length
              if (duration > maxDuration) { maxDuration = duration; bestStrike = row.strike }
            })
            return { strike: bestStrike, duration: maxDuration }
          })()

          if (cePeakStrike.duration > data.timestamps.length * 0.6) {
            insights.push({
              icon: '🔴',
              text: `${cePeakStrike.strike.toLocaleString()} CE wall holding for ${cePeakStrike.duration} of ${data.timestamps.length} snapshots — strong institutional resistance`,
              color: 'text-red-400'
            })
          }

          // 2. Find conviction PE wall
          const pePeakStrike = (() => {
            let maxDuration = 0, bestStrike = 0
            data.pe_data.forEach(row => {
              const duration = row.values.filter(v => v.intensity > 60).length
              if (duration > maxDuration) { maxDuration = duration; bestStrike = row.strike }
            })
            return { strike: bestStrike, duration: maxDuration }
          })()

          if (pePeakStrike.duration > data.timestamps.length * 0.6) {
            insights.push({
              icon: '🟢',
              text: `${pePeakStrike.strike.toLocaleString()} PE wall holding for ${pePeakStrike.duration} of ${data.timestamps.length} snapshots — strong institutional support`,
              color: 'text-emerald-400'
            })
          }

          // 3. Check if CE wall is fading (peak OI vs latest OI)
          if (cePeakStrike.strike > 0) {
            const wallRow = data.ce_data.find(r => r.strike === cePeakStrike.strike)
            if (wallRow) {
              const peakOI  = Math.max(...wallRow.values.map(v => v.oi))
              const latestOI = wallRow.values[lastIdx]?.oi || 0
              const fadePct  = peakOI > 0 ? Math.round((peakOI - latestOI) / peakOI * 100) : 0
              if (fadePct > 30) {
                insights.push({
                  icon: '⚠️',
                  text: `${cePeakStrike.strike.toLocaleString()} CE wall fading — OI down ${fadePct}% from peak. Bears losing grip, watch for breakout`,
                  color: 'text-amber-400'
                })
              }
            }
          }

          // 4. Check if PE wall is fading
          if (pePeakStrike.strike > 0) {
            const wallRow = data.pe_data.find(r => r.strike === pePeakStrike.strike)
            if (wallRow) {
              const peakOI   = Math.max(...wallRow.values.map(v => v.oi))
              const latestOI = wallRow.values[lastIdx]?.oi || 0
              const fadePct  = peakOI > 0 ? Math.round((peakOI - latestOI) / peakOI * 100) : 0
              if (fadePct > 30) {
                insights.push({
                  icon: '⚠️',
                  text: `${pePeakStrike.strike.toLocaleString()} PE wall fading — OI down ${fadePct}% from peak. Bulls losing ground, watch for breakdown`,
                  color: 'text-orange-400'
                })
              }
            }
          }

          // 5. Nearest vacuum above current ATM
          const lastAtm = atmPerTime[lastIdx]
          if (lastAtm) {
            const vacuumAbove = data.strikes
              .filter(s => s > lastAtm)
              .find(s => {
                const ce = data.ce_data.find(r => r.strike === s)?.values[lastIdx]?.intensity || 0
                const pe = data.pe_data.find(r => r.strike === s)?.values[lastIdx]?.intensity || 0
                return ce < 5 && pe < 5
              })
            if (vacuumAbove) {
              const distPct = Math.round((vacuumAbove - lastAtm) / lastAtm * 100 * 10) / 10
              insights.push({
                icon: '⚡',
                text: `Vacuum at ${vacuumAbove.toLocaleString()} (+${distPct}% from ATM) — if ${cePeakStrike.strike.toLocaleString()} CE wall breaks, expect swift ${Math.round(vacuumAbove - lastAtm)}+ pt move`,
                color: 'text-amber-400'
              })
            }

            // Vacuum below
            const vacuumBelow = [...data.strikes]
              .filter(s => s < lastAtm)
              .reverse()
              .find(s => {
                const ce = data.ce_data.find(r => r.strike === s)?.values[lastIdx]?.intensity || 0
                const pe = data.pe_data.find(r => r.strike === s)?.values[lastIdx]?.intensity || 0
                return ce < 5 && pe < 5
              })
            if (vacuumBelow) {
              const distPct = Math.round((lastAtm - vacuumBelow) / lastAtm * 100 * 10) / 10
              insights.push({
                icon: '⚡',
                text: `Vacuum at ${vacuumBelow.toLocaleString()} (-${distPct}% from ATM) — if ${pePeakStrike.strike.toLocaleString()} PE wall breaks, expect swift ${Math.round(lastAtm - vacuumBelow)}+ pt move`,
                color: 'text-red-400'
              })
            }
          }

          // 6. ATM movement since open
          const openAtm  = atmPerTime[firstIdx]
          const closeAtm = atmPerTime[lastIdx]
          if (openAtm && closeAtm && openAtm !== closeAtm) {
            const moved = closeAtm - openAtm
            insights.push({
              icon: moved > 0 ? '📈' : '📉',
              text: `ATM moved ${moved > 0 ? '+' : ''}${moved} pts since open (${openAtm.toLocaleString()} → ${closeAtm.toLocaleString()}) — ${moved > 0 ? 'bulls gaining ground' : 'bears in control'}`,
              color: moved > 0 ? 'text-emerald-400' : 'text-red-400'
            })
          }

          if (insights.length === 0) return null

          return (
            <div className="mt-4 bg-gray-900/30 border border-gray-700 rounded-xl overflow-hidden">
              <div className="px-4 py-2 border-b border-gray-800 bg-gray-900/50 flex items-center gap-2">
                <span className="text-xs font-bold text-white">🧠 Market Structure Read</span>
                <span className="text-[10px] text-gray-500">· auto-generated from OI data · not investment advice</span>
              </div>
              <div className="divide-y divide-gray-800/50">
                {insights.map((ins, i) => (
                  <div key={i} className="flex items-start gap-3 px-4 py-2.5">
                    <span className="text-base flex-shrink-0">{ins.icon}</span>
                    <p className={`text-xs leading-relaxed ${ins.color}`}>{ins.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )
        })()}

        <div className="mt-4 bg-gray-900/20 border border-gray-800/40 rounded-xl p-4">
          <p className="text-xs text-gray-600 leading-relaxed">
            <span className="text-gray-400 font-semibold">How to read: </span>
            Dark = low OI · Bright = high OI · Watch how walls appear and disappear across time.
            A wall that builds steadily = institutional conviction.
            A wall that appears suddenly = aggressive positioning.
            A wall that crumbles = positions being closed.
            · Not investment advice
          </p>
        </div>
      </div>
    </div>
  )
}
