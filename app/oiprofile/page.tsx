'use client'
import Navbar from '@/components/Navbar'
import { useEffect, useState, useCallback, useRef } from 'react'
import { RefreshCw } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

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

const MARKET_OPEN_IST  = 9 * 60 + 15
const MARKET_CLOSE_IST = 15 * 60 + 30

function isMarketHours(): boolean {
  const now = new Date()
  const ist = new Date(now.getTime() + (5.5 * 60 * 60 * 1000))
  const day = ist.getUTCDay()
  if (day === 0 || day === 6) return false
  const mins = ist.getUTCHours() * 60 + ist.getUTCMinutes()
  return mins >= MARKET_OPEN_IST && mins <= MARKET_CLOSE_IST
}

function fmtOI(n: number) {
  if (Math.abs(n) >= 10000000) return `${(n/10000000).toFixed(1)}Cr`
  if (Math.abs(n) >= 100000)   return `${(n/100000).toFixed(1)}L`
  return n.toLocaleString()
}

function fmtDate(d: string) {
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) }
  catch { return d }
}

interface ProfileRow {
  strike: number
  ce_oi: number; pe_oi: number; total_oi: number
  ce_pct: number; pe_pct: number; total_pct: number
  imbalance: number
  is_vacuum: boolean; is_poc: boolean
  is_ce_wall: boolean; is_pe_wall: boolean
  is_atm: boolean; in_value_area: boolean
  prev_ce_oi: number; prev_pe_oi: number
  ce_oi_delta: number; pe_oi_delta: number
}

interface WallPoint {
  date: string; ce_wall: number; pe_wall: number
  ce_wall_oi: number; pe_wall_oi: number
  cmp?: number
}

interface ProfileData {
  symbol: string; date: string; expiry: string; expiries: string[]
  cmp: number; atm_strike: number; poc_strike: number
  ce_wall: number; pe_wall: number; vah: number; val: number
  total_ce_oi: number; total_pe_oi: number; pcr: number
  profile: ProfileRow[]; wall_migration: WallPoint[]
  vacuum_count: number
  has_prev_oi?: boolean
  error?: string
}

const MigrationTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-3 text-xs shadow-xl">
      <p className="text-gray-400 mb-2">{fmtDate(label)}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }} className="font-bold">
          {p.name}: {p.value?.toLocaleString()}
        </p>
      ))}
    </div>
  )
}

export default function OIProfile() {
  const [data, setData]         = useState<ProfileData | null>(null)
  const [loading, setLoading]   = useState(true)
  const [symbol, setSymbol]     = useState('NIFTY')
  const [expiry, setExpiry]     = useState('')
  const [view, setView]         = useState<'profile'|'migration'>('profile')
  const [showVacuum, setShowVacuum] = useState(true)
  const [showValueArea, setShowValueArea] = useState(true)
  const [autoEnabled, setAutoEnabled] = useState(false)
  const [countdown, setCountdown] = useState(300)
  const intervalRef  = useRef<NodeJS.Timeout|null>(null)
  const countdownRef = useRef<NodeJS.Timeout|null>(null)
  const fetchIdRef   = useRef(0)
  const isStock = STOCKS.includes(symbol)

  const fetchData = useCallback(async () => {
    const fetchId = ++fetchIdRef.current
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (expiry) params.set('expiry', expiry)
      const res  = await fetch(`${API}/oi-profile/${symbol}?${params}`)
      const json = await res.json()
      // Only update state if this is still the latest fetch
      if (fetchId === fetchIdRef.current) {
        setData(json)
        if (!expiry && json.expiry) setExpiry(json.expiry)
      }
    } catch(e) { console.error(e) }
    if (fetchId === fetchIdRef.current) setLoading(false)
  }, [symbol, expiry])

  function startAuto() {
    setAutoEnabled(true); setCountdown(300)
    if (intervalRef.current)  clearInterval(intervalRef.current)
    if (countdownRef.current) clearInterval(countdownRef.current)
    intervalRef.current  = setInterval(() => { fetchData(); setCountdown(300) }, 5*60*1000)
    countdownRef.current = setInterval(() => setCountdown(p => Math.max(0, p-1)), 1000)
  }
  function stopAuto() {
    setAutoEnabled(false)
    if (intervalRef.current)  { clearInterval(intervalRef.current);  intervalRef.current  = null }
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null }
  }

  useEffect(() => { setExpiry('') }, [symbol])
  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    if (isMarketHours()) startAuto()
    return () => {
      if (intervalRef.current)  clearInterval(intervalRef.current)
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [])

  const profile = data?.profile || []
  const maxCombined = Math.max(...profile.map(p => Math.max(p.ce_oi, p.pe_oi))) || 1
  const displayProfile = [...profile].map(p => ({
    ...p,
    ce_bar_pct: Math.round(p.ce_oi / maxCombined * 100),
    pe_bar_pct: Math.round(p.pe_oi / maxCombined * 100),
  })).reverse()

  const mins = Math.floor(countdown/60)
  const secs = countdown % 60

  return (
    <div className="min-h-screen bg-[#07070e] text-white">
      <Navbar active="/oiprofile" />
      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="text-3xl font-black tracking-tight mb-1">📊 OI Profile</h1>
            <p className="text-gray-500 text-sm">Visual OI distribution · Vacuum zones · Wall migration · Value area</p>
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
            {data?.cmp && (
              <div className="flex items-center gap-2 bg-amber-950/30 border border-amber-800/50 rounded-xl px-4 py-2">
                <span className="text-xs text-gray-500">CMP</span>
                <span className="text-lg font-black text-amber-400">₹{data.cmp.toLocaleString()}</span>
                {data.atm_strike && <span className="text-xs text-gray-500">ATM <span className="text-amber-300 font-bold">{data.atm_strike.toLocaleString()}</span></span>}
              </div>
            )}
            {isMarketHours() && (
              <button onClick={() => autoEnabled ? stopAuto() : startAuto()}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${autoEnabled ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60' : 'bg-gray-900/40 text-gray-500 border-gray-800'}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${autoEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`}/>
                {autoEnabled ? `${mins}:${secs.toString().padStart(2,'0')}` : 'Auto OFF'}
              </button>
            )}
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
        </div>

        {/* Key levels */}
        {data && !data.error && (
          <div className="grid grid-cols-6 gap-3 mb-5">
            {[
              { label: '📍 POC',     val: data.poc_strike?.toLocaleString(), sub: 'Max OI concentration', color: 'text-purple-400', bg: 'bg-purple-950/20 border-purple-800/40' },
              { label: '🔴 CE Wall', val: data.ce_wall?.toLocaleString(),    sub: 'Strongest resistance', color: 'text-red-400',    bg: 'bg-red-950/20 border-red-800/40' },
              { label: '🟢 PE Wall', val: data.pe_wall?.toLocaleString(),    sub: 'Strongest support',   color: 'text-emerald-400',bg: 'bg-emerald-950/20 border-emerald-800/40' },
              { label: '↑ VAH',      val: data.vah?.toLocaleString(),        sub: 'Value area high',     color: 'text-cyan-400',   bg: 'bg-gray-900/30 border-gray-800' },
              { label: '↓ VAL',      val: data.val?.toLocaleString(),        sub: 'Value area low',      color: 'text-cyan-400',   bg: 'bg-gray-900/30 border-gray-800' },
              { label: '⚡ Vacuums', val: String(data.vacuum_count),         sub: 'Fast-move zones',     color: 'text-amber-400',  bg: 'bg-amber-950/20 border-amber-800/40' },
            ].map(({ label, val, sub, color, bg }) => (
              <div key={label} className={`border rounded-xl p-3 ${bg}`}>
                <p className="text-[10px] text-gray-500 mb-1">{label}</p>
                <p className={`text-lg font-black ${color}`}>{val || '—'}</p>
                <p className="text-[10px] text-gray-600">{sub}</p>
              </div>
            ))}
          </div>
        )}

        {/* PCR + OI row */}
        {data && !data.error && (
          <div className="flex items-center gap-4 mb-5">
            <div className="bg-gray-900/30 border border-gray-800 rounded-xl px-4 py-2 flex items-center gap-3">
              <span className="text-xs text-gray-500">PCR</span>
              <span className={`text-base font-black ${data.pcr > 1 ? 'text-emerald-400' : 'text-red-400'}`}>{data.pcr}</span>
              <span className="text-xs text-gray-600">{data.pcr > 1.2 ? 'Bullish' : data.pcr < 0.8 ? 'Bearish' : 'Neutral'}</span>
            </div>
            <div className="bg-gray-900/30 border border-gray-800 rounded-xl px-4 py-2 flex items-center gap-3">
              <span className="text-xs text-red-400">Total CE OI</span>
              <span className="text-base font-black text-white">{fmtOI(data.total_ce_oi)}</span>
            </div>
            <div className="bg-gray-900/30 border border-gray-800 rounded-xl px-4 py-2 flex items-center gap-3">
              <span className="text-xs text-emerald-400">Total PE OI</span>
              <span className="text-base font-black text-white">{fmtOI(data.total_pe_oi)}</span>
            </div>
            <div className="ml-auto flex items-center gap-1 bg-gray-900 border border-gray-800 rounded-lg p-1">
              {(['profile','migration'] as const).map(v => (
                <button key={v} onClick={() => setView(v)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${view===v ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-white'}`}>
                  {v==='profile' ? '📊 OI Profile' : '🏔️ Wall Migration'}
                </button>
              ))}
            </div>
            {view === 'profile' && (
              <div className="flex items-center gap-2">
                <button onClick={() => setShowVacuum(v => !v)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${showVacuum ? 'bg-amber-950/40 text-amber-400 border-amber-800/50' : 'bg-gray-900/40 text-gray-500 border-gray-800'}`}>
                  ⚡ Vacuums
                </button>
                <button onClick={() => setShowValueArea(v => !v)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${showValueArea ? 'bg-cyan-950/40 text-cyan-400 border-cyan-800/50' : 'bg-gray-900/40 text-gray-500 border-gray-800'}`}>
                  📐 Value Area
                </button>
              </div>
            )}
          </div>
        )}

        {/* Legend */}
        {view === 'profile' && (
          <div className="flex items-center gap-4 mb-3 px-1">
            {[
              { color: 'bg-red-500/70', label: 'CE OI (resistance)' },
              { color: 'bg-emerald-500/70', label: 'PE OI (support)' },
              { color: 'bg-purple-500/70', label: 'POC' },
              { color: 'bg-amber-500/30 border border-amber-500/50', label: '⚡ Vacuum' },
              { color: 'bg-cyan-500/10 border border-cyan-500/30', label: '📐 Value Area' },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-1.5 text-xs text-gray-500">
                <div className={`w-3 h-3 rounded-sm ${color}`}/>{label}
              </div>
            ))}
          </div>
        )}

        {/* Main content */}
        {loading ? (
          <div className="space-y-2">{[1,2,3,4,5,6,7,8].map(i=>(
            <div key={i} className="h-10 bg-gray-900/30 border border-gray-800 rounded-lg animate-pulse"/>
          ))}</div>
        ) : data?.error ? (
          <div className="flex flex-col items-center justify-center py-20 border border-gray-800/50 rounded-2xl">
            <div className="text-4xl mb-4">📊</div>
            <p className="text-gray-500">{data.error}</p>
          </div>
        ) : view === 'profile' ? (
          <div className="bg-gray-900/20 border border-gray-800 rounded-2xl overflow-hidden">
            <div className="grid grid-cols-[80px_1fr_80px_1fr_80px] gap-0 px-4 py-2 border-b border-gray-800 bg-gray-900/40">
              <div className="text-[10px] text-red-400 font-bold text-right pr-2">CE OI</div>
              <div className="text-[10px] text-gray-600 text-right">←</div>
              <div className="text-[10px] text-gray-500 font-bold text-center">STRIKE</div>
              <div className="text-[10px] text-gray-600">→</div>
              <div className="text-[10px] text-emerald-400 font-bold pl-2">PE OI</div>
            </div>
            <div className="divide-y divide-gray-800/40">
              {displayProfile.map((row) => {
                const rowBg = row.is_poc ? 'bg-purple-950/20'
                  : row.is_vacuum && showVacuum ? 'bg-amber-950/10'
                  : row.in_value_area && showValueArea ? 'bg-cyan-950/5'
                  : row.is_atm ? 'bg-amber-950/10' : ''
                const rowBorder = row.is_poc ? 'border-l-2 border-l-purple-600'
                  : row.is_ce_wall ? 'border-l-2 border-l-red-700'
                  : row.is_pe_wall ? 'border-l-2 border-l-emerald-700'
                  : row.is_vacuum && showVacuum ? 'border-l-2 border-l-amber-600/50' : ''
                return (
                  <div key={row.strike}
                    className={`grid grid-cols-[80px_1fr_80px_1fr_80px] gap-0 items-center px-4 py-1.5 hover:bg-gray-800/20 transition-colors ${rowBg} ${rowBorder}`}>
                    <div className="text-right pr-3">
                      <span className="text-xs font-mono text-red-400/80">{fmtOI(row.ce_oi)}</span>
                      {data?.has_prev_oi && row.ce_oi_delta !== 0 && (
                        <span className={`block text-[9px] font-bold ${row.ce_oi_delta > 0 ? 'text-red-300' : 'text-gray-600'}`}>
                          {row.ce_oi_delta > 0 ? `+${fmtOI(row.ce_oi_delta)}` : fmtOI(row.ce_oi_delta)}
                        </span>
                      )}
                    </div>
                    <div className="flex justify-end items-center h-5">
                      <div className="flex justify-end w-full relative h-4">
                        {/* Yesterday watermark */}
                        {data?.has_prev_oi && row.prev_ce_oi > 0 && (
                          <div className="absolute right-0 top-0 bottom-0 bg-red-900/30 rounded-l-sm"
                            style={{ width: `${Math.round(row.prev_ce_oi / maxCombined * 100)}%` }}/>
                        )}
                        {/* Today's bar */}
                        <div className={`h-4 rounded-l-sm relative z-10 ${
                          row.is_ce_wall ? 'bg-red-400' : row.is_poc ? 'bg-purple-500' :
                          row.ce_oi_delta > 0 ? 'bg-red-500' : 'bg-red-700/40'
                        }`} style={{ width: `${(row as any).ce_bar_pct}%`, minWidth: row.ce_oi > 0 ? '2px' : '0' }}/>
                      </div>
                    </div>
                    <div className="text-center px-1">
                      <div className="flex flex-col items-center">
                        <span className={`text-xs font-black ${row.is_atm ? 'text-amber-400' : row.is_poc ? 'text-purple-400' : row.is_ce_wall ? 'text-red-400' : row.is_pe_wall ? 'text-emerald-400' : 'text-gray-300'}`}>
                          {row.strike.toLocaleString()}
                        </span>
                        <div className="flex gap-0.5 mt-0.5">
                          {row.is_atm     && <span className="text-[8px] text-amber-500 font-bold">ATM</span>}
                          {row.is_poc     && <span className="text-[8px] text-purple-400 font-bold">POC</span>}
                          {row.is_ce_wall && <span className="text-[8px] text-red-400 font-bold">WALL</span>}
                          {row.is_pe_wall && <span className="text-[8px] text-emerald-400 font-bold">WALL</span>}
                          {row.is_vacuum && showVacuum && <span className="text-[8px] text-amber-400 font-bold">⚡VAC</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center h-5">
                      <div className="relative w-full flex h-4">
                        {/* Today's bar */}
                        <div className={`h-4 rounded-r-sm relative z-10 ${
                          row.is_pe_wall ? 'bg-emerald-400' : row.is_poc ? 'bg-purple-500' :
                          row.pe_oi_delta > 0 ? 'bg-emerald-500' : 'bg-emerald-700/40'
                        }`} style={{ width: `${(row as any).pe_bar_pct}%`, minWidth: row.pe_oi > 0 ? '2px' : '0' }}/>
                        {/* Yesterday watermark */}
                        {data?.has_prev_oi && row.prev_pe_oi > 0 && (
                          <div className="absolute left-0 top-0 bottom-0 bg-emerald-900/30 rounded-r-sm"
                            style={{ width: `${Math.round(row.prev_pe_oi / maxCombined * 100)}%` }}/>
                        )}
                      </div>
                    </div>
                    <div className="text-left pl-3">
                      <span className="text-xs font-mono text-emerald-400/80">{fmtOI(row.pe_oi)}</span>
                      {data?.has_prev_oi && row.pe_oi_delta !== 0 && (
                        <span className={`block text-[9px] font-bold ${row.pe_oi_delta > 0 ? 'text-emerald-300' : 'text-gray-600'}`}>
                          {row.pe_oi_delta > 0 ? `+${fmtOI(row.pe_oi_delta)}` : fmtOI(row.pe_oi_delta)}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="px-5 py-3 border-t border-gray-800 bg-gray-900/40 flex items-center gap-6">
              <p className="text-xs text-gray-500">{data?.symbol} · {data?.date} · {fmtDate(data?.expiry || '')} expiry</p>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-purple-400"/>
                <span className="text-xs text-gray-500">POC at {data?.poc_strike?.toLocaleString()}</span>
              </div>
              {data && data.ce_wall > data.pe_wall && <span className="text-xs text-red-400 font-semibold">🐻 Bearish structure — CE wall above PE wall</span>}
              {data && data.pe_wall > data.ce_wall && <span className="text-xs text-emerald-400 font-semibold">🐂 Bullish structure — PE wall below CE wall</span>}
            </div>
          </div>
        ) : (
          <div className="bg-gray-900/20 border border-gray-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-base font-bold text-white">🏔️ OI Wall Migration</h2>
              <p className="text-xs text-gray-500">How support/resistance levels shifted over this expiry series</p>
            </div>
            <p className="text-xs text-gray-600 mb-2">
              Red line = CE Wall (strongest resistance) · Green line = PE Wall (strongest support) ·
              Amber dashed = Price (closing CMP each day) · Convergence = range bound · Divergence = directional move
            </p>
            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center gap-1.5 text-xs text-gray-500"><div className="w-4 h-0.5 bg-red-500"/>CE Wall</div>
              <div className="flex items-center gap-1.5 text-xs text-gray-500"><div className="w-4 h-0.5 bg-emerald-500"/>PE Wall</div>
              <div className="flex items-center gap-1.5 text-xs text-gray-500"><div className="w-4 h-0.5 bg-amber-400"/>Price</div>
            </div>
            {data?.wall_migration && data.wall_migration.length > 1 ? (
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={data.wall_migration} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false}/>
                  <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={fmtDate}/>
                  <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} domain={['auto', 'auto']} tickFormatter={v => v.toLocaleString()}/>
                  <Tooltip content={<MigrationTooltip/>}/>
                  <Line type="monotone" dataKey="ce_wall" name="CE Wall" stroke="#ef4444" strokeWidth={2} dot={{ fill: '#ef4444', r: 3 }} activeDot={{ r: 5 }} connectNulls/>
                  <Line type="monotone" dataKey="pe_wall" name="PE Wall" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981', r: 3 }} activeDot={{ r: 5 }} connectNulls/>
                  <Line type="monotone" dataKey="cmp" name="Price" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="5 3" dot={{ fill: '#f59e0b', r: 2 }} activeDot={{ r: 4 }} connectNulls/>
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-600 text-sm">
                Need more trading days in current series for migration data
              </div>
            )}
            {data?.wall_migration && data.wall_migration.length > 1 && (() => {
              const first = data.wall_migration[0]
              const last  = data.wall_migration[data.wall_migration.length - 1]
              const ce_moved = last.ce_wall - first.ce_wall
              const pe_moved = last.pe_wall - first.pe_wall
              const ce_series_low = Math.min(...data.wall_migration.map(w => w.ce_wall))
              const pe_series_low = Math.min(...data.wall_migration.map(w => w.pe_wall))
              const ce_recovery = last.ce_wall - ce_series_low
              const pe_recovery = last.pe_wall - pe_series_low
              const ce_low_date = data.wall_migration.find(w => w.ce_wall === ce_series_low)?.date
              const pe_low_date = data.wall_migration.find(w => w.pe_wall === pe_series_low)?.date
              return (
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className={`rounded-xl p-3 border ${ce_moved < 0 ? 'bg-red-950/20 border-red-800/30' : 'bg-emerald-950/20 border-emerald-800/30'}`}>
                    <p className="text-xs text-gray-500 mb-1">CE Wall — Series Journey</p>
                    <p className={`text-base font-black ${ce_moved < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                      {ce_moved < 0 ? '↓' : '↑'} {Math.abs(ce_moved).toLocaleString()} pts
                    </p>
                    <p className="text-xs text-gray-600 mb-2">{first.ce_wall.toLocaleString()} → {last.ce_wall.toLocaleString()}</p>
                    <div className="flex gap-3 text-xs">
                      <div>
                        <p className="text-gray-600">Series low</p>
                        <p className="text-red-400 font-bold">{ce_series_low.toLocaleString()}</p>
                        <p className="text-gray-700">{ce_low_date ? fmtDate(ce_low_date) : '—'}</p>
                      </div>
                      {ce_recovery > 0 && (
                        <div>
                          <p className="text-gray-600">Recovery</p>
                          <p className="text-emerald-400 font-bold">+{ce_recovery.toLocaleString()} pts</p>
                          <p className="text-gray-700">from low</p>
                        </div>
                      )}
                    </div>
                    <p className="text-xs mt-2 text-gray-500">
                      {ce_moved < 0 ? 'Resistance moving down — bears retreating' : 'Resistance moving up — bears pushing higher'}
                    </p>
                  </div>
                  <div className={`rounded-xl p-3 border ${pe_moved > 0 ? 'bg-emerald-950/20 border-emerald-800/30' : 'bg-red-950/20 border-red-800/30'}`}>
                    <p className="text-xs text-gray-500 mb-1">PE Wall — Series Journey</p>
                    <p className={`text-base font-black ${pe_moved > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {pe_moved > 0 ? '↑' : '↓'} {Math.abs(pe_moved).toLocaleString()} pts
                    </p>
                    <p className="text-xs text-gray-600 mb-2">{first.pe_wall.toLocaleString()} → {last.pe_wall.toLocaleString()}</p>
                    <div className="flex gap-3 text-xs">
                      <div>
                        <p className="text-gray-600">Series low</p>
                        <p className="text-red-400 font-bold">{pe_series_low.toLocaleString()}</p>
                        <p className="text-gray-700">{pe_low_date ? fmtDate(pe_low_date) : '—'}</p>
                      </div>
                      {pe_recovery > 0 && (
                        <div>
                          <p className="text-gray-600">Recovery</p>
                          <p className="text-emerald-400 font-bold">+{pe_recovery.toLocaleString()} pts</p>
                          <p className="text-gray-700">from low</p>
                        </div>
                      )}
                    </div>
                    <p className="text-xs mt-2 text-gray-500">
                      {pe_moved > 0 ? 'Support rising — bulls building higher' : 'Support falling — bulls losing ground'}
                    </p>
                  </div>
                </div>
              )
            })()}
          </div>
        )}

        <div className="mt-6 bg-gray-900/20 border border-gray-800/40 rounded-xl p-4">
          <p className="text-xs text-gray-600 leading-relaxed">
            <span className="text-gray-400 font-semibold">How to read: </span>
            <span className="text-purple-400">POC</span> = strike with highest total OI — strongest magnet for price ·
            <span className="text-red-400"> CE Wall</span> = strike with most call writing — key resistance ·
            <span className="text-emerald-400"> PE Wall</span> = strike with most put writing — key support ·
            <span className="text-amber-400"> ⚡ Vacuum</span> = very low OI on both sides — price moves fast here ·
            <span className="text-cyan-400"> Value Area</span> = strikes covering 70% of total OI · Not investment advice
          </p>
        </div>
      </div>
    </div>
  )
}
