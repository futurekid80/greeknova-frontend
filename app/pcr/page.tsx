'use client'
import Navbar from '@/components/Navbar'
import { useAutoRefresh } from "@/lib/useAutoRefresh"
import { useEffect, useState, useCallback } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'
import { RefreshCw, Clock } from 'lucide-react'

interface PCRPoint { time: string; pcr: number; vol_pcr?: number; ce_oi: number; pe_oi: number; ce_vol?: number; pe_vol?: number }
interface PCRData { symbol: string; points: PCRPoint[]; total_snapshots: number; expiry: string | null }

const INDICES = ['NIFTY', 'BANKNIFTY', 'FINNIFTY']
const API = 'https://greeknova-backend-production.up.railway.app'

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-3 shadow-xl">
      <p className="text-white font-bold mb-2">{label}</p>
      <p className={`text-sm font-black mb-1 ${d.pcr > 1 ? 'text-emerald-400' : d.pcr < 0.8 ? 'text-red-400' : 'text-amber-400'}`}>
        OI PCR: {d.pcr}
      </p>
      {d.vol_pcr !== undefined && (
        <p className={`text-sm font-black mb-1 ${d.vol_pcr > 1 ? 'text-cyan-400' : d.vol_pcr < 0.8 ? 'text-pink-400' : 'text-blue-400'}`}>
          Vol PCR: {d.vol_pcr}
        </p>
      )}
      <div className="border-t border-gray-800 mt-2 pt-2">
        <p className="text-xs text-red-400">CE OI: {(d.ce_oi/100000).toFixed(1)}L</p>
        <p className="text-xs text-emerald-400">PE OI: {(d.pe_oi/100000).toFixed(1)}L</p>
        {d.ce_vol !== undefined && <p className="text-xs text-red-300">CE Vol: {(d.ce_vol/100000).toFixed(1)}L</p>}
        {d.pe_vol !== undefined && <p className="text-xs text-emerald-300">PE Vol: {(d.pe_vol/100000).toFixed(1)}L</p>}
      </div>
    </div>
  )
}

function formatExpiry(expiry: string) {
  try {
    const d = new Date(expiry)
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
  } catch { return expiry }
}

export default function PCRTrend() {
  const [symbol, setSymbol] = useState('NIFTY')
  const [data, setData] = useState<PCRData | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState('')
  const [expiries, setExpiries] = useState<string[]>([])
  const [selectedExpiry, setSelectedExpiry] = useState<string>('')
  const [showVolPCR, setShowVolPCR] = useState(true)

  const fetchExpiries = useCallback(async (sym: string) => {
    try {
      const res = await fetch(`${API}/pcr-expiries/${sym}`)
      const json = await res.json()
      const list: string[] = json.expiries || []
      setExpiries(list)
      if (list.length > 0) {
        setSelectedExpiry(list[0])
      } else {
        setSelectedExpiry('all')
      }
    } catch (e) { console.error(e) }
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const url = !selectedExpiry || selectedExpiry === 'all'
        ? `${API}/pcr-trend/${symbol}`
        : `${API}/pcr-trend/${symbol}?expiry=${selectedExpiry}`
      const res = await fetch(url)
      const json = await res.json()
      setData(json)
      if (json.points?.length) setLastUpdate(json.points[json.points.length - 1].time)
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [symbol, selectedExpiry])

  useEffect(() => {
    setSelectedExpiry('')
    fetchExpiries(symbol)
  }, [symbol, fetchExpiries])

  useEffect(() => {
    if (selectedExpiry !== '') fetchData()
  }, [fetchData, selectedExpiry])

  const { enabled: autoEnabled, toggle: toggleAuto, countdownStr } = useAutoRefresh(fetchData, 5 * 60 * 1000, true)

  const latest = data?.points[data.points.length - 1]
  const first = data?.points[0]
  const pcrChange = latest && first ? (latest.pcr - first.pcr).toFixed(3) : '0'
  const pcrTrend = Number(pcrChange) > 0 ? 'RISING' : Number(pcrChange) < 0 ? 'FALLING' : 'FLAT'
  const bull = latest && latest.pcr > 1

  // Vol PCR trend
  const latestVolPcr = latest?.vol_pcr
  const firstVolPcr = first?.vol_pcr
  const volPcrChange = latestVolPcr !== undefined && firstVolPcr !== undefined
    ? (latestVolPcr - firstVolPcr).toFixed(3) : '0'
  const volPcrTrend = Number(volPcrChange) > 0 ? 'RISING' : Number(volPcrChange) < 0 ? 'FALLING' : 'FLAT'

  // ── 5-point rolling average to smooth PCR zigzag ──────────────────────────
  const smoothedPoints = (data?.points || []).map((p, i, arr) => {
    const window = arr.slice(Math.max(0, i - 4), i + 1)
    const avgPcr = window.reduce((sum, w) => sum + w.pcr, 0) / window.length
    const avgVolPcr = p.vol_pcr !== undefined
      ? window.reduce((sum, w) => sum + (w.vol_pcr || 0), 0) / window.length
      : undefined
    return {
      ...p,
      pcr_smooth:     Math.round(avgPcr * 1000) / 1000,
      vol_pcr_smooth: avgVolPcr !== undefined ? Math.round(avgVolPcr * 1000) / 1000 : undefined,
    }
  })

  return (
    <div className="min-h-screen bg-[#07070e] text-white">
      <Navbar active="/pcr" />

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black tracking-tight mb-1">PCR Trend</h1>
            <p className="text-gray-500 text-sm">OI PCR + Volume PCR through the trading day · Rising = bullish sentiment building</p>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdate && <div className="flex items-center gap-1.5 text-xs text-gray-600 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2"><Clock size={11}/>Last: {lastUpdate}</div>}
            <button onClick={toggleAuto} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${autoEnabled ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60' : 'bg-gray-900/40 text-gray-500 border-gray-800'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${autoEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`}/>
              {autoEnabled ? countdownStr : 'Auto'}
            </button>
            <button onClick={fetchData} disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-sm font-medium text-white rounded-lg border border-gray-700 transition-all disabled:opacity-50">
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''}/>Refresh
            </button>
          </div>
        </div>

        {/* Index selector */}
        <div className="flex gap-2 mb-4">
          {INDICES.map(idx => (
            <button key={idx} onClick={() => setSymbol(idx)}
              className={`px-5 py-2.5 rounded-xl text-sm font-bold border transition-all ${symbol === idx ? 'bg-white text-gray-900 border-white' : 'bg-gray-900/40 text-gray-400 border-gray-800 hover:text-white'}`}>
              {idx}
            </button>
          ))}
        </div>

        {/* Expiry filter */}
        {expiries.length > 0 && (
          <div className="flex items-center gap-2 mb-6">
            <span className="text-xs text-gray-500 mr-1">Expiry:</span>
            <button onClick={() => setSelectedExpiry('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${selectedExpiry === 'all' ? 'bg-cyan-950/60 text-cyan-400 border-cyan-800/60' : 'bg-gray-900/40 text-gray-500 border-gray-800 hover:text-white'}`}>
              All
            </button>
            {expiries.map((exp, i) => (
              <button key={exp} onClick={() => setSelectedExpiry(exp)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${selectedExpiry === exp ? 'bg-cyan-950/60 text-cyan-400 border-cyan-800/60' : 'bg-gray-900/40 text-gray-500 border-gray-800 hover:text-white'}`}>
                {formatExpiry(exp)}
                {i === 0 && <span className="ml-1 text-[9px] text-cyan-600">Weekly</span>}
                {i === expiries.length - 1 && expiries.length > 1 && <span className="ml-1 text-[9px] text-purple-500">Monthly</span>}
              </button>
            ))}
          </div>
        )}

        {/* Summary cards */}
        {latest && (
          <div className="grid grid-cols-4 gap-3 mb-6">
            <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">OI PCR</p>
              <p className={`text-2xl font-black ${bull ? 'text-emerald-400' : 'text-red-400'}`}>{latest.pcr}</p>
              <p className="text-xs text-gray-600">{bull ? 'Bullish bias' : 'Bearish bias'}</p>
            </div>
            <div className="bg-gray-900/30 border border-blue-900/40 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">Vol PCR</p>
              <p className={`text-2xl font-black ${(latestVolPcr || 0) > 1 ? 'text-cyan-400' : 'text-pink-400'}`}>
                {latestVolPcr?.toFixed(3) || '—'}
              </p>
              <p className="text-xs text-gray-600">{volPcrTrend} today</p>
            </div>
            <div className={`rounded-xl p-4 border ${pcrTrend === 'RISING' ? 'bg-emerald-950/20 border-emerald-800/40' : pcrTrend === 'FALLING' ? 'bg-red-950/20 border-red-800/40' : 'bg-gray-900/30 border-gray-800'}`}>
              <p className="text-xs text-gray-500 mb-1">OI PCR Trend</p>
              <p className={`text-2xl font-black ${pcrTrend === 'RISING' ? 'text-emerald-400' : pcrTrend === 'FALLING' ? 'text-red-400' : 'text-amber-400'}`}>{pcrTrend}</p>
              <p className="text-xs text-gray-600">Change: {Number(pcrChange) > 0 ? '+' : ''}{pcrChange}</p>
            </div>
            <div className={`rounded-xl p-4 border ${volPcrTrend === 'RISING' ? 'bg-cyan-950/20 border-cyan-800/40' : volPcrTrend === 'FALLING' ? 'bg-pink-950/20 border-pink-800/40' : 'bg-gray-900/30 border-gray-800'}`}>
              <p className="text-xs text-gray-500 mb-1">Vol PCR Trend</p>
              <p className={`text-2xl font-black ${volPcrTrend === 'RISING' ? 'text-cyan-400' : volPcrTrend === 'FALLING' ? 'text-pink-400' : 'text-amber-400'}`}>{volPcrTrend}</p>
              <p className="text-xs text-gray-600">Change: {Number(volPcrChange) > 0 ? '+' : ''}{volPcrChange}</p>
            </div>
          </div>
        )}

        {/* Chart */}
        <div className="bg-gray-900/30 border border-gray-800 rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-base font-bold text-white">PCR Through the Day — {symbol}</h2>
            <button onClick={() => setShowVolPCR(v => !v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${showVolPCR ? 'bg-cyan-950/40 text-cyan-400 border-cyan-800/50' : 'bg-gray-900/40 text-gray-500 border-gray-800'}`}>
              {showVolPCR ? '👁 Vol PCR ON' : '👁 Vol PCR OFF'}
            </button>
          </div>
          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <div className="w-4 h-0.5 bg-amber-400"/>OI PCR (position commitment)
            </div>
            {showVolPCR && (
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <div className="w-4 h-0.5 bg-cyan-400 border-dashed"/>Vol PCR (intraday activity)
              </div>
            )}
          </div>
          {loading ? (
            <div className="h-72 flex items-center justify-center"><RefreshCw size={24} className="text-gray-600 animate-spin"/></div>
          ) : smoothedPoints.length ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={smoothedPoints} margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false}/>
                <XAxis dataKey="time" tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} axisLine={false}/>
                <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} axisLine={false} domain={['auto', 'auto']}/>
                <Tooltip content={<CustomTooltip/>} cursor={{ stroke: 'rgba(255,255,255,0.1)' }}/>
                <ReferenceLine y={1.0} stroke="#10b981" strokeDasharray="4 4" strokeOpacity={0.5} label={{ value: '1.0 Bullish', fill: '#10b981', fontSize: 10, position: 'insideRight' }}/>
                <ReferenceLine y={0.8} stroke="#ef4444" strokeDasharray="4 4" strokeOpacity={0.5} label={{ value: '0.8 Bearish', fill: '#ef4444', fontSize: 10, position: 'insideRight' }}/>
                <Line type="stepAfter" dataKey="pcr_smooth" name="OI PCR" stroke="#f59e0b" strokeWidth={2} dot={false} activeDot={{ r: 4 }}/>
                {showVolPCR && (
                  <Line type="stepAfter" dataKey="vol_pcr_smooth" name="Vol PCR" stroke="#22d3ee" strokeWidth={1.5} strokeDasharray="5 3" dot={false} activeDot={{ r: 4 }}/>
                )}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-72 flex items-center justify-center flex-col gap-3">
              <div className="text-4xl">📈</div>
              <p className="text-gray-500 text-sm">No data yet — snapshots build up during market hours</p>
            </div>
          )}
          <p className="text-xs text-gray-600 mt-3">
            <span className="text-amber-400 font-semibold">OI PCR</span> = open positions (slower, institutional) ·
            <span className="text-cyan-400 font-semibold"> Vol PCR</span> = contracts traded today (faster, intraday activity) ·
            When both rise together = strong bullish conviction · When they diverge = mixed signals
          </p>
        </div>
      </div>
    </div>
  )
}
