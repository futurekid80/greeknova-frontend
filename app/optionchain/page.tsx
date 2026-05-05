'use client'
import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, Clock } from 'lucide-react'
import { useAutoRefresh } from '@/lib/useAutoRefresh'

const API = 'https://greeknova-backend-production.up.railway.app'
const INDICES = ['NIFTY', 'BANKNIFTY', 'FINNIFTY']

interface Greeks { ltp: number; iv: number | null; oi: number; volume: number; delta?: number; gamma?: number; theta?: number; vega?: number }
interface ChainRow { strike: number; is_atm: boolean; ce: Greeks; pe: Greeks }
interface ChainData { symbol: string; spot: number; expiry: string; days_left: number; expiries: string[]; timestamp: string; chain: ChainRow[] }

function fmt(n: number | undefined | null, dec = 2) {
  if (n == null) return '—'
  return n.toFixed(dec)
}
function fmtOI(n: number) {
  if (n >= 10000000) return `${(n / 10000000).toFixed(1)}Cr`
  if (n >= 100000)   return `${(n / 100000).toFixed(1)}L`
  return n.toLocaleString()
}
function formatExpiry(e: string) {
  try { return new Date(e).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) }
  catch { return e }
}

export default function OptionChain() {
  const [symbol, setSymbol]   = useState('NIFTY')
  const [expiry, setExpiry]   = useState<string>('')
  const [data, setData]       = useState<ChainData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const url = expiry
        ? `${API}/option-chain/${symbol}?expiry=${expiry}`
        : `${API}/option-chain/${symbol}`
      const res  = await fetch(url)
      const json = await res.json()
      setData(json)
      if (!expiry && json.expiry) setExpiry(json.expiry)
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [symbol, expiry])

  useEffect(() => { setExpiry('') }, [symbol])
  useEffect(() => { fetchData() }, [symbol, expiry])

  const { enabled: autoOn, toggle: toggleAuto, countdownStr } = useAutoRefresh(fetchData, 5 * 60 * 1000, true)

  const atm = data?.chain.find(r => r.is_atm)

  return (
    <div className="min-h-screen bg-[#07070e] text-white">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-gray-800/50 bg-[#07070e]/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-600 flex items-center justify-center">
              <span className="text-xs font-black text-white">GN</span>
            </div>
            <span className="font-black text-white text-base">GreekNova</span>
            <span className="ml-1 text-xs font-medium px-1.5 py-0.5 bg-emerald-950 text-emerald-500 border border-emerald-800/50 rounded-md">BETA</span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <a href="/"            className="text-gray-400 hover:text-white transition-colors">Dashboard</a>
            <a href="/charts"      className="text-gray-400 hover:text-white transition-colors">OI Charts</a>
            <a href="/optionchain" className="font-semibold text-white border-b border-emerald-500 pb-0.5">Option Chain</a>
            <a href="/pcr"         className="text-gray-400 hover:text-white transition-colors">PCR Trend</a>
            <a href="/spikes"      className="text-gray-400 hover:text-white transition-colors">OI Spikes</a>
            <a href="/maxpain"     className="text-gray-400 hover:text-white transition-colors">Max Pain</a>
            <a href="/alerts"      className="text-gray-400 hover:text-white transition-colors">Alerts</a>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="text-3xl font-black tracking-tight mb-1">Option Chain</h1>
            <p className="text-gray-500 text-sm">Live Greeks · IV · OI — powered by Black-Scholes</p>
          </div>
          <div className="flex items-center gap-3">
            {data?.timestamp && (
              <div className="flex items-center gap-1.5 text-xs text-gray-600 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2">
                <Clock size={11}/>{new Date(data.timestamp).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })} IST
              </div>
            )}
            <button onClick={toggleAuto} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${autoOn ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60' : 'bg-gray-900/40 text-gray-500 border-gray-800'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${autoOn ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`}/>
              {autoOn ? countdownStr : 'Auto'}
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

        {/* Expiry selector */}
        {data?.expiries && data.expiries.length > 0 && (
          <div className="flex items-center gap-2 mb-6">
            <span className="text-xs text-gray-500 mr-1">Expiry:</span>
            {data.expiries.map((e, i) => (
              <button key={e} onClick={() => setExpiry(e)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${expiry === e ? 'bg-cyan-950/60 text-cyan-400 border-cyan-800/60' : 'bg-gray-900/40 text-gray-500 border-gray-800 hover:text-white'}`}>
                {formatExpiry(e)}
                {i === 0 && <span className="ml-1 text-[9px] text-cyan-600">Weekly</span>}
                {i === data.expiries.length - 1 && data.expiries.length > 1 && <span className="ml-1 text-[9px] text-purple-500">Monthly</span>}
              </button>
            ))}
          </div>
        )}

        {/* Spot + ATM stats */}
        {data?.spot && (
          <div className="grid grid-cols-5 gap-3 mb-6">
            <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">Spot</p>
              <p className="text-xl font-black text-white">{data.spot.toLocaleString()}</p>
            </div>
            <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">ATM Strike</p>
              <p className="text-xl font-black text-amber-400">{atm?.strike.toLocaleString() ?? '—'}</p>
            </div>
            <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">Days to Expiry</p>
              <p className="text-xl font-black text-cyan-400">{data.days_left}d</p>
            </div>
            <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">ATM CE IV</p>
              <p className="text-xl font-black text-red-400">{atm?.ce.iv != null ? `${atm.ce.iv}%` : '—'}</p>
            </div>
            <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">ATM PE IV</p>
              <p className="text-xl font-black text-emerald-400">{atm?.pe.iv != null ? `${atm.pe.iv}%` : '—'}</p>
            </div>
          </div>
        )}

        {/* Chain table */}
        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <RefreshCw size={24} className="text-gray-600 animate-spin"/>
          </div>
        ) : !data?.chain.length ? (
          <div className="h-64 flex items-center justify-center flex-col gap-3">
            <div className="text-4xl">🔗</div>
            <p className="text-gray-500 text-sm">No data yet — snapshots build up during market hours</p>
          </div>
        ) : (
          <div className="bg-gray-900/20 border border-gray-800 rounded-2xl overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-800">
                  <th colSpan={6} className="py-3 text-center text-red-400 font-bold text-[11px] tracking-wider border-r border-gray-800">CALLS</th>
                  <th className="py-3 px-4 text-center text-amber-400 font-black text-[11px] tracking-wider">STRIKE</th>
                  <th colSpan={6} className="py-3 text-center text-emerald-400 font-bold text-[11px] tracking-wider border-l border-gray-800">PUTS</th>
                </tr>
                <tr className="border-b border-gray-800 text-gray-500">
                  <th className="py-2 px-2 text-right">OI</th>
                  <th className="py-2 px-2 text-right">Vol</th>
                  <th className="py-2 px-2 text-right">IV%</th>
                  <th className="py-2 px-2 text-right">Δ Delta</th>
                  <th className="py-2 px-2 text-right">Θ Theta</th>
                  <th className="py-2 px-3 text-right border-r border-gray-800">LTP</th>
                  <th className="py-2 px-4 text-center text-amber-400 font-bold"></th>
                  <th className="py-2 px-3 text-left border-l border-gray-800">LTP</th>
                  <th className="py-2 px-2 text-left">Θ Theta</th>
                  <th className="py-2 px-2 text-left">Δ Delta</th>
                  <th className="py-2 px-2 text-left">IV%</th>
                  <th className="py-2 px-2 text-left">Vol</th>
                  <th className="py-2 px-2 text-left">OI</th>
                </tr>
              </thead>
              <tbody>
                {data.chain.map((row) => (
                  <tr key={row.strike}
                    className={`border-b border-gray-800/50 transition-colors hover:bg-gray-800/20 ${row.is_atm ? 'bg-amber-950/20' : ''}`}>
                    {/* CE side */}
                    <td className="py-2 px-2 text-right text-gray-300">{fmtOI(row.ce.oi)}</td>
                    <td className="py-2 px-2 text-right text-gray-500">{fmtOI(row.ce.volume)}</td>
                    <td className="py-2 px-2 text-right text-orange-400">{row.ce.iv != null ? `${row.ce.iv}` : '—'}</td>
                    <td className="py-2 px-2 text-right text-blue-400">{fmt(row.ce.delta, 3)}</td>
                    <td className="py-2 px-2 text-right text-rose-400">{fmt(row.ce.theta)}</td>
                    <td className={`py-2 px-3 text-right font-bold border-r border-gray-800 ${row.is_atm ? 'text-amber-300' : 'text-red-400'}`}>
                      {row.ce.ltp.toFixed(2)}
                    </td>
                    {/* Strike */}
                    <td className={`py-2 px-4 text-center font-black ${row.is_atm ? 'text-amber-400 text-sm' : 'text-gray-300'}`}>
                      {row.strike.toLocaleString()}
                      {row.is_atm && <span className="ml-1 text-[9px] text-amber-600">ATM</span>}
                    </td>
                    {/* PE side */}
                    <td className={`py-2 px-3 text-left font-bold border-l border-gray-800 ${row.is_atm ? 'text-amber-300' : 'text-emerald-400'}`}>
                      {row.pe.ltp.toFixed(2)}
                    </td>
                    <td className="py-2 px-2 text-left text-rose-400">{fmt(row.pe.theta)}</td>
                    <td className="py-2 px-2 text-left text-blue-400">{fmt(row.pe.delta, 3)}</td>
                    <td className="py-2 px-2 text-left text-orange-400">{row.pe.iv != null ? `${row.pe.iv}` : '—'}</td>
                    <td className="py-2 px-2 text-left text-gray-500">{fmtOI(row.pe.volume)}</td>
                    <td className="py-2 px-2 text-left text-gray-300">{fmtOI(row.pe.oi)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center gap-6 mt-4 text-xs text-gray-600">
          <span><span className="text-blue-400">Δ Delta</span> — directional exposure</span>
          <span><span className="text-rose-400">Θ Theta</span> — daily time decay (₹)</span>
          <span><span className="text-orange-400">IV%</span> — implied volatility</span>
          <span><span className="text-amber-400">ATM</span> — at-the-money strike</span>
        </div>
      </div>
    </div>
  )
}
