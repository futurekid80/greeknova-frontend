'use client'
import Navbar from '@/components/Navbar'
import { useEffect, useState, useCallback, useRef } from 'react'
import { RefreshCw, Zap, AlertTriangle } from 'lucide-react'

const API = 'https://greeknova-backend-production.up.railway.app'

interface Vacuum {
  strike: number
  ce_oi: number; pe_oi: number; total_oi: number
  dist_pct: number; direction: 'ABOVE' | 'BELOW'
}

interface ApproachingZone {
  symbol: string; cmp: number; is_index: boolean
  nearest_zone: Vacuum
  all_zones: Vacuum[]
  expiry: string; data_date: string
}

interface ScanResult {
  symbol: string; cmp: number; is_index: boolean
  vacuums: Vacuum[]
  nearest_above: Vacuum | null
  nearest_below: Vacuum | null
  vacuum_count: number
  expiry: string; data_date: string
}

interface ScanData {
  scan_time: string; data_date: string
  total: number; approaching_total: number
  results: ScanResult[]
  approaching: ApproachingZone[]
}

function fmtOI(n: number) {
  if (n === 0) return '0'
  if (Math.abs(n) >= 10000000) return `${(n/10000000).toFixed(1)}Cr`
  if (Math.abs(n) >= 100000)   return `${(n/100000).toFixed(1)}L`
  if (Math.abs(n) >= 1000)     return `${(n/1000).toFixed(0)}K`
  return n.toLocaleString()
}

function VacuumOIBadge({ ceOI, peOI }: { ceOI: number; peOI: number }) {
  const total = ceOI + peOI
  return (
    <div className="flex items-center gap-1 justify-center mt-1">
      <span className="text-[10px] text-red-400/70">CE:{fmtOI(ceOI)}</span>
      <span className="text-[10px] text-gray-700">·</span>
      <span className="text-[10px] text-emerald-400/70">PE:{fmtOI(peOI)}</span>
      {total < 50000 && <span className="text-[9px] text-amber-500/60 ml-0.5">⚡low</span>}
    </div>
  )
}

function DistanceBadge({ pct, direction }: { pct: number; direction: 'ABOVE' | 'BELOW' }) {
  const color = direction === 'ABOVE'
    ? 'text-emerald-400 bg-emerald-950/40 border-emerald-800/50'
    : 'text-red-400 bg-red-950/40 border-red-800/50'
  return (
    <span className={`text-xs font-black px-2 py-0.5 rounded-lg border ${color}`}>
      {direction === 'ABOVE' ? '↑' : '↓'} {Math.abs(pct)}%
    </span>
  )
}

function toIST(isoStr: string) {
  try {
    const dt = new Date(isoStr)
    const ist = dt.getTime() + (5.5 * 60 * 60 * 1000)
    const d = new Date(ist)
    return `${d.getUTCHours().toString().padStart(2,'0')}:${d.getUTCMinutes().toString().padStart(2,'0')} IST`
  } catch { return '' }
}

function isPostMarket(): boolean {
  const now = new Date()
  const utcMins = now.getUTCHours() * 60 + now.getUTCMinutes()
  const day = now.getUTCDay()
  if (day === 0 || day === 6) return true
  return utcMins > 10 * 60
}

export default function VacuumScanner() {
  const [data, setData]             = useState<ScanData | null>(null)
  const [loading, setLoading]       = useState(true)
  const [maxDist, setMaxDist]       = useState(5)
  const [dirFilter, setDirFilter]   = useState<'all'|'ABOVE'|'BELOW'>('all')
  const [typeFilter, setTypeFilter] = useState<'all'|'index'|'stocks'>('all')
  const [showApproaching, setShowApproaching] = useState(true)
  const [countdown, setCountdown]   = useState(300)
  const countdownRef = useRef<NodeJS.Timeout|null>(null)
  const intervalRef  = useRef<NodeJS.Timeout|null>(null)
  const postMarket   = isPostMarket()

  const fetchData = useCallback(async (dist?: number) => {
    setLoading(true)
    try {
      const d = dist ?? maxDist
      const res  = await fetch(`${API}/vacuum-scanner?max_distance_pct=${d}`)
      const json = await res.json()
      setData(json)
    } catch(e) { console.error(e) }
    setLoading(false)
  }, [maxDist])

  function startAuto() {
    if (postMarket) return
    setCountdown(300)
    if (intervalRef.current)  clearInterval(intervalRef.current)
    if (countdownRef.current) clearInterval(countdownRef.current)
    intervalRef.current  = setInterval(() => { fetchData(); setCountdown(300) }, 5*60*1000)
    countdownRef.current = setInterval(() => setCountdown(p => Math.max(0, p-1)), 1000)
  }

  useEffect(() => {
    fetchData(); startAuto()
    return () => {
      if (intervalRef.current)  clearInterval(intervalRef.current)
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [])

  function handleDist(d: number) { setMaxDist(d); fetchData(d) }

  const mins = Math.floor(countdown/60)
  const secs = countdown % 60

  const filtered = (data?.results || [])
    .filter(r => typeFilter === 'all' || (typeFilter === 'index' ? r.is_index : !r.is_index))
    .filter(r => {
      if (dirFilter === 'all') return true
      if (dirFilter === 'ABOVE') return r.nearest_above !== null
      return r.nearest_below !== null
    })

  const filteredApproaching = (data?.approaching || [])
    .filter(r => typeFilter === 'all' || (typeFilter === 'index' ? r.is_index : !r.is_index))

  return (
    <div className="min-h-screen bg-[#07070e] text-white">
      <Navbar active="/vacuum"/>
      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="text-3xl font-black tracking-tight mb-1 flex items-center gap-3">
              <Zap className="text-amber-400" size={28}/> Vacuum Zone Scanner
            </h1>
            <p className="text-gray-500 text-sm">
              Strikes with very low OI on both sides — price moves FAST through these zones
            </p>
          </div>
          <div className="flex items-center gap-3">
            {data?.scan_time && (
              <div className="text-xs text-gray-600 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2">
                Scanned: {toIST(data.scan_time)}
              </div>
            )}
            {!postMarket && (
              <div className="flex items-center gap-1.5 text-xs bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-gray-400">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/>
                Auto {mins}:{secs.toString().padStart(2,'0')}
              </div>
            )}
            <button onClick={() => fetchData()} disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-sm font-medium text-white rounded-lg border border-gray-700 disabled:opacity-50 transition-all">
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''}/>Refresh
            </button>
          </div>
        </div>

        {/* Post-market banner */}
        {postMarket && (
          <div className="bg-gray-900/60 border border-gray-700 rounded-xl px-4 py-3 mb-5 flex items-center gap-3">
            <span className="text-gray-400">🌙</span>
            <div>
              <p className="text-sm font-bold text-gray-300">📊 EOD Snapshot · Market Closed</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Showing vacuum zones from last capture · Data date: {data?.data_date || '—'} · Auto-refresh disabled
              </p>
            </div>
          </div>
        )}

        {/* How to use */}
        <div className="bg-amber-950/20 border border-amber-800/30 rounded-xl px-5 py-3 mb-5">
          <p className="text-xs text-amber-400/80 leading-relaxed">
            <span className="font-bold text-amber-400">⚡ What is a Vacuum Zone?</span> A strike where both CE and PE OI is very low (under 1L each).
            Price moves fast through these with minimal resistance.
            <span className="text-amber-300 font-semibold"> ↑ Above CMP = upside vacuum · ↓ Below CMP = downside vacuum</span>
            <span className="text-gray-500"> · 🎯 Approaching = stock within 15% of a vacuum zone — watch these</span>
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 mb-5 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Within:</span>
            {[5, 10, 15].map(d => (
              <button key={d} onClick={() => handleDist(d)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${maxDist===d
                  ? 'bg-amber-950/60 text-amber-400 border-amber-700'
                  : 'bg-gray-800/40 text-gray-500 border-gray-700 hover:text-white'}`}>
                {d}% of CMP
              </button>
            ))}
          </div>
          <div className="w-px h-5 bg-gray-800"/>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Direction:</span>
            {([
              { val: 'all',   label: 'All' },
              { val: 'ABOVE', label: '↑ Above CMP' },
              { val: 'BELOW', label: '↓ Below CMP' },
            ] as const).map(({ val, label }) => (
              <button key={val} onClick={() => setDirFilter(val)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${dirFilter===val
                  ? val === 'ABOVE' ? 'bg-emerald-950/60 text-emerald-400 border-emerald-700'
                  : val === 'BELOW' ? 'bg-red-950/60 text-red-400 border-red-700'
                  : 'bg-white text-gray-900 border-white'
                  : 'bg-gray-800/40 text-gray-500 border-gray-700 hover:text-white'}`}>
                {label}
              </button>
            ))}
          </div>
          <div className="w-px h-5 bg-gray-800"/>
          {(['all','index','stocks'] as const).map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all capitalize ${typeFilter===t
                ? 'bg-white text-gray-900 border-white'
                : 'bg-gray-800/40 text-gray-500 border-gray-700 hover:text-white'}`}>
              {t}
            </button>
          ))}
          <span className="text-xs text-gray-600 ml-auto">
            {filtered.length} in vacuum · {filteredApproaching.length} approaching · sorted by proximity
          </span>
        </div>

        {loading ? (
          <div className="space-y-3">
            <div className="bg-blue-950/20 border border-blue-800/30 rounded-xl px-4 py-3 flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"/>
              <p className="text-xs text-blue-400">Scanning all 66 F&O stocks for vacuum zones... this takes 20-30 seconds</p>
            </div>
            {[1,2,3,4,5].map(i => (
              <div key={i} className="h-20 bg-gray-900/30 border border-gray-800 rounded-xl animate-pulse"/>
            ))}
          </div>
        ) : (
          <>
            {/* ── VACUUM ZONES IN RANGE ─────────────────────────────────── */}
            {filtered.length > 0 ? (
              <div className="rounded-2xl border border-gray-800 overflow-hidden mb-6">
                <div className="bg-gray-900/60 border-b border-gray-800 px-5 py-3 flex items-center gap-2">
                  <Zap size={14} className="text-amber-400"/>
                  <span className="text-sm font-bold text-white">Active Vacuum Zones</span>
                  <span className="text-xs text-gray-500">· within {maxDist}% of CMP · {filtered.length} stocks</span>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-900/40 border-b border-gray-800">
                      {['Symbol','CMP','↑ Nearest Above','↓ Nearest Below','All Vacuums','Action'].map((h,i) => (
                        <th key={h} className={`text-xs font-semibold text-gray-500 px-4 py-3 ${i===0?'pl-5 text-left':i<2?'text-left':'text-center'} ${i===5?'pr-5':''}`}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r, i) => (
                      <tr key={r.symbol} className={`border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors ${i%2===0?'':'bg-gray-900/20'}`}>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-black text-white">{r.symbol}</span>
                            {r.is_index && <span className="text-[10px] px-1.5 py-0.5 bg-cyan-950 text-cyan-400 border border-cyan-800/50 rounded">IDX</span>}
                          </div>
                          <p className="text-xs text-gray-600 mt-0.5">{r.vacuum_count} vacuum{r.vacuum_count>1?'s':''} found</p>
                          {r.expiry && <p className="text-[10px] text-gray-700 mt-0.5">Expiry: {r.expiry}</p>}
                        </td>
                        <td className="px-4 py-4">
                          <p className="text-sm font-black text-amber-400">₹{r.cmp.toLocaleString('en-IN')}</p>
                        </td>
                        <td className="px-4 py-4 text-center">
                          {r.nearest_above ? (
                            <div>
                              <p className="text-sm font-black text-emerald-400">{r.nearest_above.strike.toLocaleString()}</p>
                              <DistanceBadge pct={r.nearest_above.dist_pct} direction="ABOVE"/>
                              <VacuumOIBadge ceOI={r.nearest_above.ce_oi} peOI={r.nearest_above.pe_oi}/>
                            </div>
                          ) : <span className="text-xs text-gray-600">—</span>}
                        </td>
                        <td className="px-4 py-4 text-center">
                          {r.nearest_below ? (
                            <div>
                              <p className="text-sm font-black text-red-400">{r.nearest_below.strike.toLocaleString()}</p>
                              <DistanceBadge pct={r.nearest_below.dist_pct} direction="BELOW"/>
                              <VacuumOIBadge ceOI={r.nearest_below.ce_oi} peOI={r.nearest_below.pe_oi}/>
                            </div>
                          ) : <span className="text-xs text-gray-600">—</span>}
                        </td>
                        <td className="px-4 py-4 text-center">
                          <div className="flex flex-wrap gap-1 justify-center">
                            {r.vacuums.slice(0, 5).map((v, j) => (
                              <span key={j} className={`text-[10px] px-1.5 py-0.5 rounded font-bold border ${
                                v.direction === 'ABOVE'
                                  ? 'bg-emerald-950/30 text-emerald-400 border-emerald-800/40'
                                  : 'bg-red-950/30 text-red-400 border-red-800/40'
                              }`}>
                                {v.direction === 'ABOVE' ? '↑' : '↓'}{v.strike.toLocaleString()}
                              </span>
                            ))}
                            {r.vacuums.length > 5 && <span className="text-[10px] text-gray-600">+{r.vacuums.length - 5}</span>}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-center">
                          <a href={`/oiprofile?symbol=${r.symbol}`}
                            className="text-xs text-purple-400 hover:text-purple-300 border border-purple-800/50 px-2 py-1 rounded-lg transition-colors">
                            📊 Profile →
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 border border-gray-800/50 rounded-2xl mb-6">
                <div className="text-4xl mb-3">⚡</div>
                <h3 className="text-base font-bold text-gray-400 mb-1">No vacuum zones within {maxDist}% of CMP</h3>
                <p className="text-xs text-gray-600">Try increasing to 10% or check approaching zones below</p>
              </div>
            )}

            {/* ── APPROACHING VACUUM ZONES ─────────────────────────────── */}
            {filteredApproaching.length > 0 && (
              <div className="rounded-2xl border border-orange-900/40 overflow-hidden">
                <div className="bg-orange-950/20 border-b border-orange-900/40 px-5 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={14} className="text-orange-400"/>
                    <span className="text-sm font-bold text-orange-400">🎯 Approaching Vacuum Zones</span>
                    <span className="text-xs text-gray-500">· within 15% of CMP · {filteredApproaching.length} stocks · watch these</span>
                  </div>
                  <button onClick={() => setShowApproaching(p => !p)}
                    className="text-xs text-gray-500 hover:text-white transition-colors">
                    {showApproaching ? 'Hide ▲' : 'Show ▼'}
                  </button>
                </div>
                {showApproaching && (
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-900/40 border-b border-gray-800">
                        {['Symbol','CMP','Nearest Vacuum Zone','Distance','OI at Zone','Action'].map((h,i) => (
                          <th key={h} className={`text-xs font-semibold text-gray-500 px-4 py-3 ${i===0?'pl-5 text-left':i<2?'text-left':'text-center'} ${i===5?'pr-5':''}`}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredApproaching.map((r, i) => {
                        const z = r.nearest_zone
                        const isAbove = z.direction === 'ABOVE'
                        return (
                          <tr key={r.symbol} className={`border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors ${i%2===0?'':'bg-gray-900/20'}`}>
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-black text-white">{r.symbol}</span>
                                {r.is_index && <span className="text-[10px] px-1.5 py-0.5 bg-cyan-950 text-cyan-400 border border-cyan-800/50 rounded">IDX</span>}
                                <span className="text-[10px] px-1.5 py-0.5 bg-orange-950/60 text-orange-400 border border-orange-800/40 rounded">🎯 Approaching</span>
                              </div>
                              {r.expiry && <p className="text-[10px] text-gray-700 mt-0.5">Expiry: {r.expiry}</p>}
                            </td>
                            <td className="px-4 py-3.5">
                              <p className="text-sm font-black text-amber-400">₹{r.cmp.toLocaleString('en-IN')}</p>
                            </td>
                            <td className="px-4 py-3.5 text-center">
                              <p className={`text-sm font-black ${isAbove ? 'text-emerald-400' : 'text-red-400'}`}>
                                {z.strike.toLocaleString()}
                              </p>
                              <p className="text-[10px] text-gray-600">{isAbove ? '↑ Above CMP' : '↓ Below CMP'}</p>
                            </td>
                            <td className="px-4 py-3.5 text-center">
                              <DistanceBadge pct={z.dist_pct} direction={z.direction}/>
                            </td>
                            <td className="px-4 py-3.5 text-center">
                              <VacuumOIBadge ceOI={z.ce_oi} peOI={z.pe_oi}/>
                            </td>
                            <td className="px-5 py-3.5 text-center">
                              <a href={`/oiprofile?symbol=${r.symbol}`}
                                className="text-xs text-purple-400 hover:text-purple-300 border border-purple-800/50 px-2 py-1 rounded-lg transition-colors">
                                📊 Profile →
                              </a>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </>
        )}

        <div className="mt-6 bg-gray-900/20 border border-gray-800/40 rounded-xl p-4">
          <p className="text-xs text-gray-600 leading-relaxed">
            <span className="text-gray-400 font-semibold">Disclaimer:</span> Vacuum zones show strikes with low OI (under 1L each side) based on NSE data.
            Low OI does not guarantee price movement — it indicates reduced friction if price reaches that level.
            Approaching zones are informational only. Not investment advice.
          </p>
        </div>
      </div>
    </div>
  )
}
