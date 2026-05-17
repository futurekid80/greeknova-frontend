'use client'
import { useEffect, useState, useCallback } from 'react'
import { RefreshCw } from 'lucide-react'
import Navbar from '@/components/Navbar'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer, CartesianGrid, Legend, Cell } from 'recharts'

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

function fmtOI(n: number) {
  const abs = Math.abs(n)
  if (abs >= 10000000) return `${(n / 10000000).toFixed(2)}Cr`
  if (abs >= 100000)   return `${(n / 100000).toFixed(1)}L`
  return n.toLocaleString()
}
function fmtDate(d: string) {
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) }
  catch { return d }
}

interface Row {
  strike: number
  ce_a: number; ce_b: number; ce_chg: number
  pe_a: number; pe_b: number; pe_chg: number
  net_chg: number
}
interface Data {
  symbol: string; date_a: string; date_b: string
  expiry: string; expiries: string[]; dates: string[]; rows: Row[]
  cmp?: number; atm_strike?: number
}

const CustomTooltip = ({ active, payload, label, atm }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-3 shadow-xl text-xs">
      <p className="text-white font-bold mb-1">Strike: {Number(label).toLocaleString()}{label === atm ? ' ⭐ ATM' : ''}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>{p.name}: {fmtOI(p.value)}</p>
      ))}
    </div>
  )
}

export default function OIHistory() {
  const [symbol, setSymbol]   = useState('NIFTY')
  const [data, setData]       = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [dateA, setDateA]     = useState('')
  const [dateB, setDateB]     = useState('')
  const [expiry, setExpiry]   = useState('')
  const [view, setView]       = useState<'table' | 'chart'>('chart')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (dateA)  params.set('date_a', dateA)
      if (dateB)  params.set('date_b', dateB)
      if (expiry) params.set('expiry', expiry)
      const res  = await fetch(`${API}/oi-history/${symbol}?${params}`)
      const json = await res.json()
      setData(json)
      if (!dateA && json.date_a) setDateA(json.date_a)
      if (!dateB && json.date_b) setDateB(json.date_b)
      if (!expiry && json.expiry) setExpiry(json.expiry)
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [symbol, dateA, dateB, expiry])

  useEffect(() => { setDateA(''); setDateB(''); setExpiry('') }, [symbol])
  useEffect(() => { fetchData() }, [symbol, dateA, dateB, expiry])

  const isStock = STOCKS.includes(symbol)
  const atm = data?.atm_strike

  const chartData = data?.rows
    .map(r => ({
      strike: r.strike,
      'CE Change': r.ce_chg,
      'PE Change': r.pe_chg,
      isATM: r.strike === atm,
    }))
    .sort((a, b) => Math.abs(b['CE Change'] + b['PE Change']) - Math.abs(a['CE Change'] + a['PE Change']))
    .slice(0, 20)
    .sort((a, b) => a.strike - b.strike) || []

  const totalCEBuilt   = data?.rows.filter(r => r.ce_chg > 0).reduce((s, r) => s + r.ce_chg, 0) || 0
  const totalCEUnwound = data?.rows.filter(r => r.ce_chg < 0).reduce((s, r) => s + r.ce_chg, 0) || 0
  const totalPEBuilt   = data?.rows.filter(r => r.pe_chg > 0).reduce((s, r) => s + r.pe_chg, 0) || 0
  const totalPEUnwound = data?.rows.filter(r => r.pe_chg < 0).reduce((s, r) => s + r.pe_chg, 0) || 0
  const bullish = totalPEBuilt + totalCEUnwound > totalCEBuilt + totalPEUnwound

  return (
    <div className="min-h-screen bg-[#07070e] text-white">
      <Navbar active="/oihistory" />

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="text-3xl font-black tracking-tight mb-1">Historical OI Comparison</h1>
            <p className="text-gray-500 text-sm">Compare OI buildup vs unwinding between any two trading days</p>
          </div>
          <div className="flex items-center gap-3">
            {data?.cmp && (
              <div className="flex items-center gap-2 bg-amber-950/30 border border-amber-800/50 rounded-xl px-4 py-2">
                <span className="text-xs text-gray-500">CMP</span>
                <span className="text-lg font-black text-amber-400">₹{data.cmp.toLocaleString()}</span>
                {atm && <span className="text-xs text-gray-500">ATM <span className="text-amber-300 font-bold">{atm.toLocaleString()}</span></span>}
              </div>
            )}
            <button onClick={fetchData} disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-sm font-medium text-white rounded-lg border border-gray-700 transition-all disabled:opacity-50">
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />Refresh
            </button>
          </div>
        </div>

        {/* Symbol selector */}
        <div className="flex flex-wrap gap-2 mb-4 items-center">
          {INDICES.map(idx => (
            <button key={idx} onClick={() => setSymbol(idx)}
              className={`px-5 py-2.5 rounded-xl text-sm font-bold border transition-all ${symbol === idx ? 'bg-white text-gray-900 border-white' : 'bg-gray-900/40 text-gray-400 border-gray-800 hover:text-white'}`}>
              {idx}
            </button>
          ))}
          <select
            value={isStock ? symbol : ''}
            onChange={e => e.target.value && setSymbol(e.target.value)}
            className={`rounded-xl text-sm font-bold border transition-all px-4 py-2.5 focus:outline-none focus:border-white
              ${isStock ? 'bg-white text-gray-900 border-white' : 'bg-gray-900/40 text-gray-400 border-gray-800 hover:text-white'}`}>
            <option value="">Stocks ▾</option>
            {STOCKS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* Controls — FIXED layout */}
        <div className="flex flex-wrap items-end gap-4 mb-6">

          {/* Recent date */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-emerald-400 font-bold tracking-wide">RECENT DATE</span>
            <select value={dateA} onChange={e => setDateA(e.target.value)}
              className="bg-gray-900 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500">
              {data?.dates.map(d => <option key={d} value={d}>{fmtDate(d)}</option>)}
            </select>
          </div>

          {/* Arrow */}
          <div className="flex flex-col items-center pb-1">
            <span className="text-[10px] text-gray-600">change from</span>
            <span className="text-gray-400 text-base font-bold">→</span>
          </div>

          {/* Base date */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-gray-500 font-bold tracking-wide">BASE DATE</span>
            <select value={dateB} onChange={e => setDateB(e.target.value)}
              className="bg-gray-900 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500">
              {data?.dates.map(d => <option key={d} value={d}>{fmtDate(d)}</option>)}
            </select>
          </div>

          {/* Expiry */}
          {data?.expiries && data.expiries.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-gray-500 font-bold tracking-wide">EXPIRY</span>
              <select value={expiry} onChange={e => setExpiry(e.target.value)}
                className="bg-gray-900 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500">
                {data.expiries.map(e => <option key={e} value={e}>{fmtDate(e)}</option>)}
              </select>
            </div>
          )}

          {/* Chart/Table toggle */}
          <div className="flex items-center gap-1 ml-auto bg-gray-900 border border-gray-800 rounded-lg p-1">
            {(['chart', 'table'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${view === v ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-white'}`}>
                {v === 'chart' ? '📊 Chart' : '📋 Table'}
              </button>
            ))}
          </div>

        </div>

        {/* Summary cards */}
        {data?.rows.length ? (
          <>
            <div className="grid grid-cols-4 gap-3 mb-6">
              <div className="bg-red-950/20 border border-red-800/30 rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">CE Built Up</p>
                <p className="text-xl font-black text-red-400">+{fmtOI(totalCEBuilt)}</p>
                <p className="text-xs text-gray-600">Resistance building</p>
              </div>
              <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">CE Unwound</p>
                <p className="text-xl font-black text-orange-400">{fmtOI(totalCEUnwound)}</p>
                <p className="text-xs text-gray-600">Resistance easing</p>
              </div>
              <div className="bg-emerald-950/20 border border-emerald-800/30 rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">PE Built Up</p>
                <p className="text-xl font-black text-emerald-400">+{fmtOI(totalPEBuilt)}</p>
                <p className="text-xs text-gray-600">Support building</p>
              </div>
              <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">PE Unwound</p>
                <p className="text-xl font-black text-yellow-400">{fmtOI(totalPEUnwound)}</p>
                <p className="text-xs text-gray-600">Support easing</p>
              </div>
            </div>

            {/* Bias banner */}
            <div className={`rounded-xl p-4 mb-6 border flex items-center gap-3 ${bullish ? 'bg-emerald-950/20 border-emerald-800/40' : 'bg-red-950/20 border-red-800/40'}`}>
              <span className="text-2xl">{bullish ? '🐂' : '🐻'}</span>
              <div>
                <p className={`font-bold text-sm ${bullish ? 'text-emerald-400' : 'text-red-400'}`}>
                  {bullish ? 'BULLISH OI STRUCTURE' : 'BEARISH OI STRUCTURE'} — {fmtDate(dateB)} → {fmtDate(dateA)}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {bullish
                    ? 'More PE buildup + CE unwinding → support growing, resistance easing'
                    : 'More CE buildup + PE unwinding → resistance growing, support easing'}
                </p>
              </div>
            </div>

            {view === 'chart' ? (
              <div className="bg-gray-900/30 border border-gray-800 rounded-2xl p-6 mb-6">
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-base font-bold text-white">OI Change by Strike</h2>
                  {atm && <span className="text-xs text-amber-400 bg-amber-950/30 border border-amber-800/40 px-2 py-1 rounded-lg">⭐ ATM = {atm.toLocaleString()}</span>}
                </div>
                <p className="text-xs text-gray-500 mb-5">
                  Showing change from {fmtDate(dateB)} → {fmtDate(dateA)} · Top 20 strikes · Positive = buildup · Negative = unwinding
                </p>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                    <XAxis dataKey="strike" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false}
                      tickFormatter={v => {
                        const label = v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)
                        return v === atm ? `⭐${label}` : label
                      }} />
                    <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false}
                      tickFormatter={v => fmtOI(v)} />
                    <Tooltip content={<CustomTooltip atm={atm} />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                    <Legend wrapperStyle={{ paddingTop: '16px', fontSize: '12px' }} />
                    <ReferenceLine y={0} stroke="#374151" />
                    <Bar dataKey="CE Change" name="CE Change" radius={[3, 3, 0, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell key={index} fill={entry.isATM ? '#f59e0b' : '#ef4444'} opacity={entry.isATM ? 1 : 0.85} />
                      ))}
                    </Bar>
                    <Bar dataKey="PE Change" name="PE Change" radius={[3, 3, 0, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell key={index} fill={entry.isATM ? '#f59e0b' : '#10b981'} opacity={entry.isATM ? 1 : 0.85} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="bg-gray-900/20 border border-gray-800 rounded-2xl overflow-hidden mb-6">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-800 text-gray-500">
                      <th className="py-3 px-4 text-center text-amber-400 font-bold">Strike</th>
                      <th className="py-3 px-3 text-right text-red-400">CE ({fmtDate(dateA)})</th>
                      <th className="py-3 px-3 text-right text-red-400">CE ({fmtDate(dateB)})</th>
                      <th className="py-3 px-3 text-right text-red-400">CE Δ</th>
                      <th className="py-3 px-3 text-right text-emerald-400">PE ({fmtDate(dateA)})</th>
                      <th className="py-3 px-3 text-right text-emerald-400">PE ({fmtDate(dateB)})</th>
                      <th className="py-3 px-3 text-right text-emerald-400">PE Δ</th>
                      <th className="py-3 px-3 text-right text-cyan-400">Net Bias</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map(row => {
                      const isATM = row.strike === atm
                      return (
                        <tr key={row.strike} className={`border-b border-gray-800/50 transition-colors ${isATM ? 'bg-amber-950/20 border-amber-800/30' : 'hover:bg-gray-800/20'}`}>
                          <td className="py-2 px-4 text-center font-bold">
                            <span className={isATM ? 'text-amber-400' : 'text-amber-400/70'}>
                              {isATM && '⭐ '}{row.strike.toLocaleString()}
                              {isATM && <span className="ml-1 text-xs text-amber-500/70 font-normal">ATM</span>}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right text-gray-300">{fmtOI(row.ce_a)}</td>
                          <td className="py-2 px-3 text-right text-gray-500">{fmtOI(row.ce_b)}</td>
                          <td className={`py-2 px-3 text-right font-semibold ${row.ce_chg > 0 ? 'text-red-400' : row.ce_chg < 0 ? 'text-orange-400' : 'text-gray-600'}`}>
                            {row.ce_chg > 0 ? '+' : ''}{fmtOI(row.ce_chg)}
                          </td>
                          <td className="py-2 px-3 text-right text-gray-300">{fmtOI(row.pe_a)}</td>
                          <td className="py-2 px-3 text-right text-gray-500">{fmtOI(row.pe_b)}</td>
                          <td className={`py-2 px-3 text-right font-semibold ${row.pe_chg > 0 ? 'text-emerald-400' : row.pe_chg < 0 ? 'text-yellow-400' : 'text-gray-600'}`}>
                            {row.pe_chg > 0 ? '+' : ''}{fmtOI(row.pe_chg)}
                          </td>
                          <td className={`py-2 px-3 text-right font-bold ${row.net_chg > 0 ? 'text-emerald-400' : row.net_chg < 0 ? 'text-red-400' : 'text-gray-600'}`}>
                            {row.net_chg > 0 ? '🐂' : row.net_chg < 0 ? '🐻' : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : !loading ? (
          <div className="h-64 flex items-center justify-center flex-col gap-3">
            <div className="text-4xl">📊</div>
            <p className="text-gray-500 text-sm">Need at least 2 days of data to compare</p>
            <p className="text-gray-600 text-xs">Data accumulates automatically during market hours</p>
          </div>
        ) : (
          <div className="h-64 flex items-center justify-center">
            <RefreshCw size={24} className="text-gray-600 animate-spin" />
          </div>
        )}
      </div>
    </div>
  )
}
