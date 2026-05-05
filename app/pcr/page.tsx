'use client'
import { useAutoRefresh } from "@/lib/useAutoRefresh"
import { useEffect, useState, useCallback } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer, CartesianGrid } from 'recharts'
import { RefreshCw, Clock } from 'lucide-react'

interface PCRPoint { time: string; pcr: number; ce_oi: number; pe_oi: number }
interface PCRData { symbol: string; points: PCRPoint[]; total_snapshots: number; expiry: string | null }

const INDICES = ['NIFTY', 'BANKNIFTY', 'FINNIFTY']
const API = 'https://greeknova-backend-production.up.railway.app'

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-3 shadow-xl">
      <p className="text-white font-bold mb-2">{label}</p>
      <p className={`text-sm font-black mb-1 ${d.pcr > 1 ? 'text-emerald-400' : d.pcr < 0.8 ? 'text-red-400' : 'text-amber-400'}`}>PCR: {d.pcr}</p>
      <p className="text-xs text-red-400">CE OI: {(d.ce_oi/100000).toFixed(1)}L</p>
      <p className="text-xs text-emerald-400">PE OI: {(d.pe_oi/100000).toFixed(1)}L</p>
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
  const [selectedExpiry, setSelectedExpiry] = useState<string>('all')

  const fetchExpiries = useCallback(async (sym: string) => {
    try {
      const res = await fetch(`${API}/pcr-expiries/${sym}`)
      const json = await res.json()
      setExpiries(json.expiries || [])
      setSelectedExpiry('all')
    } catch (e) { console.error(e) }
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const url = selectedExpiry === 'all'
        ? `${API}/pcr-trend/${symbol}`
        : `${API}/pcr-trend/${symbol}?expiry=${selectedExpiry}`
      const res = await fetch(url)
      const json = await res.json()
      setData(json)
      if (json.points?.length) setLastUpdate(json.points[json.points.length - 1].time)
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [symbol, selectedExpiry])

  useEffect(() => { fetchExpiries(symbol) }, [symbol, fetchExpiries])
  useEffect(() => { fetchData() }, [fetchData])
  const { enabled: autoEnabled, toggle: toggleAuto, countdownStr } = useAutoRefresh(fetchData)

  const latest = data?.points[data.points.length - 1]
  const first = data?.points[0]
  const pcrChange = latest && first ? (latest.pcr - first.pcr).toFixed(3) : '0'
  const pcrTrend = Number(pcrChange) > 0 ? 'RISING' : Number(pcrChange) < 0 ? 'FALLING' : 'FLAT'
  const bull = latest && latest.pcr > 1

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
            <a href="/pcr" className="text-sm font-semibold text-white border-b border-emerald-500 pb-0.5">PCR Trend</a>
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
            <h1 className="text-3xl font-black tracking-tight mb-1">PCR Trend</h1>
            <p className="text-gray-500 text-sm">Put-Call Ratio through the trading day · Rising = bullish sentiment building</p>
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
            <button
              onClick={() => setSelectedExpiry('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${selectedExpiry === 'all' ? 'bg-cyan-950/60 text-cyan-400 border-cyan-800/60' : 'bg-gray-900/40 text-gray-500 border-gray-800 hover:text-white'}`}>
              All
            </button>
            {expiries.map((exp, i) => (
              <button key={exp}
                onClick={() => setSelectedExpiry(exp)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${selectedExpiry === exp ? 'bg-cyan-950/60 text-cyan-400 border-cyan-800/60' : 'bg-gray-900/40 text-gray-500 border-gray-800 hover:text-white'}`}>
                {formatExpiry(exp)}
                {i === 0 && <span className="ml-1 text-[9px] text-cyan-600">Weekly</span>}
                {i === expiries.length - 1 && expiries.length > 1 && <span className="ml-1 text-[9px] text-purple-500">Monthly</span>}
              </button>
            ))}
          </div>
        )}

        {latest && (
          <div className="grid grid-cols-4 gap-3 mb-6">
            <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">Current PCR</p>
              <p className={`text-2xl font-black ${bull ? 'text-emerald-400' : 'text-red-400'}`}>{latest.pcr}</p>
              <p className="text-xs text-gray-600">{bull ? 'Bullish bias' : 'Bearish bias'}</p>
            </div>
            <div className={`rounded-xl p-4 border ${pcrTrend === 'RISING' ? 'bg-emerald-950/20 border-emerald-800/40' : pcrTrend === 'FALLING' ? 'bg-red-950/20 border-red-800/40' : 'bg-gray-900/30 border-gray-800'}`}>
              <p className="text-xs text-gray-500 mb-1">PCR Trend Today</p>
              <p className={`text-2xl font-black ${pcrTrend === 'RISING' ? 'text-emerald-400' : pcrTrend === 'FALLING' ? 'text-red-400' : 'text-amber-400'}`}>{pcrTrend}</p>
              <p className="text-xs text-gray-600">Change: {Number(pcrChange) > 0 ? '+' : ''}{pcrChange}</p>
            </div>
            <div className="bg-red-950/20 border border-red-800/40 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">Total CE OI</p>
              <p className="text-2xl font-black text-red-400">{(latest.ce_oi/10000000).toFixed(2)}Cr</p>
              <p className="text-xs text-gray-600">Call writers</p>
            </div>
            <div className="bg-emerald-950/20 border border-emerald-800/40 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">Total PE OI</p>
              <p className="text-2xl font-black text-emerald-400">{(latest.pe_oi/10000000).toFixed(2)}Cr</p>
              <p className="text-xs text-gray-600">Put writers</p>
            </div>
          </div>
        )}

        <div className="bg-gray-900/30 border border-gray-800 rounded-2xl p-6 mb-6">
          <h2 className="text-base font-bold text-white mb-1">PCR Through the Day — {symbol}</h2>
          <p className="text-xs text-gray-500 mb-5">Above 1.0 = bullish · Below 0.8 = bearish · Each point = 5 min snapshot</p>
          {loading ? (
            <div className="h-72 flex items-center justify-center"><RefreshCw size={24} className="text-gray-600 animate-spin"/></div>
          ) : data?.points.length ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.points} margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false}/>
                <XAxis dataKey="time" tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} axisLine={false}/>
                <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} axisLine={false} domain={['auto', 'auto']}/>
                <Tooltip content={<CustomTooltip/>} cursor={{ stroke: 'rgba(255,255,255,0.1)' }}/>
                <ReferenceLine y={1.0} stroke="#10b981" strokeDasharray="4 4" strokeOpacity={0.5} label={{ value: '1.0 Bullish', fill: '#10b981', fontSize: 10, position: 'insideRight' }}/>
                <ReferenceLine y={0.8} stroke="#ef4444" strokeDasharray="4 4" strokeOpacity={0.5} label={{ value: '0.8 Bearish', fill: '#ef4444', fontSize: 10, position: 'insideRight' }}/>
                <Line type="monotone" dataKey="pcr" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 3, fill: '#f59e0b' }} activeDot={{ r: 5 }}/>
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-72 flex items-center justify-center flex-col gap-3">
              <div className="text-4xl">📈</div>
              <p className="text-gray-500 text-sm">No data yet — snapshots build up during market hours</p>
            </div>
          )}
        </div>

        <div className="bg-gray-900/30 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-base font-bold text-white mb-1">CE vs PE OI — {symbol}</h2>
          <p className="text-xs text-gray-500 mb-5">When PE OI rises faster than CE OI — bullish momentum building</p>
          {!loading && data?.points.length ? (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={data.points} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false}/>
                <XAxis dataKey="time" tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} axisLine={false}/>
                <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={v => `${(v/10000000).toFixed(1)}Cr`}/>
                <Tooltip content={<CustomTooltip/>} cursor={{ stroke: 'rgba(255,255,255,0.1)' }}/>
                <Line type="monotone" dataKey="ce_oi" name="CE OI" stroke="#ef4444" strokeWidth={2} dot={false}/>
                <Line type="monotone" dataKey="pe_oi" name="PE OI" stroke="#10b981" strokeWidth={2} dot={false}/>
              </LineChart>
            </ResponsiveContainer>
          ) : null}
        </div>
      </div>
    </div>
  )
}
