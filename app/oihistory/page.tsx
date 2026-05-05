'use client'
import { useEffect, useState, useCallback } from 'react'
import { RefreshCw } from 'lucide-react'
import Navbar from '@/components/Navbar'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'

const API = 'https://greeknova-backend-production.up.railway.app'
const INDICES = ['NIFTY', 'BANKNIFTY', 'FINNIFTY']

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
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-3 shadow-xl text-xs">
      <p className="text-white font-bold mb-2">Strike: {Number(label).toLocaleString()}</p>
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

  // Chart data — top 20 strikes by total absolute change
  const chartData = data?.rows
    .map(r => ({
      strike: r.strike,
      'CE Change': r.ce_chg,
      'PE Change': r.pe_chg,
    }))
    .sort((a, b) => Math.abs(b['CE Change'] + b['PE Change']) - Math.abs(a['CE Change'] + a['PE Change']))
    .slice(0, 20)
    .sort((a, b) => a.strike - b.strike) || []

  // Summary stats
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
          <button onClick={fetchData} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-sm font-medium text-white rounded-lg border border-gray-700 transition-all disabled:opacity-50">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />Refresh
          </button>
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

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          {/* Date A */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Compare</span>
            <select value={dateA} onChange={e => setDateA(e.target.value)}
              className="bg-gray-900 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500">
              {data?.dates.map(d => <option key={d} value={d}>{fmtDate(d)}</option>)}
            </select>
          </div>
          <span className="text-gray-600 text-sm">vs</span>
          {/* Date B */}
          <div className="flex items-center gap-2">
            <select value={dateB} onChange={e => setDateB(e.target.value)}
              className="bg-gray-900 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500">
              {data?.dates.map(d => <option key={d} value={d}>{fmtDate(d)}</option>)}
            </select>
          </div>
          {/* Expiry */}
          {data?.expiries && data.expiries.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Expiry:</span>
              <select value={expiry} onChange={e => setExpiry(e.target.value)}
                className="bg-gray-900 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500">
                {data.expiries.map(e => <option key={e} value={e}>{fmtDate(e)}</option>)}
              </select>
            </div>
          )}
          {/* View toggle */}
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
                <h2 className="text-base font-bold text-white mb-1">OI Change by Strike</h2>
                <p className="text-xs text-gray-500 mb-5">
                  {fmtDate(dateA)} vs {fmtDate(dateB)} · Top 20 strikes · Positive = buildup · Negative = unwinding
                </p>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                    <XAxis dataKey="strike" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false}
                      tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                    <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false}
                      tickFormatter={v => fmtOI(v)} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                    <Legend wrapperStyle={{ paddingTop: '16px', fontSize: '12px' }} />
                    <ReferenceLine y={0} stroke="#374151" />
                    <Bar dataKey="CE Change" name="CE Change" fill="#ef4444" opacity={0.85} radius={[3, 3, 0, 0]} />
                    <Bar dataKey="PE Change" name="PE Change" fill="#10b981" opacity={0.85} radius={[3, 3, 0, 0]} />
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
                    {data.rows.map(row => (
                      <tr key={row.strike} className="border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors">
                        <td className="py-2 px-4 text-center font-bold text-amber-400">{row.strike.toLocaleString()}</td>
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
                    ))}
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
