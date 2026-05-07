'use client'
import { useEffect, useState, useCallback } from 'react'
import { RefreshCw } from 'lucide-react'
import Navbar from '@/components/Navbar'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip,
  ReferenceLine, ResponsiveContainer, CartesianGrid, Legend
} from 'recharts'

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
  if (abs >= 10000000) return `${(n/10000000).toFixed(2)}Cr`
  if (abs >= 100000)   return `${(n/100000).toFixed(1)}L`
  return n.toLocaleString()
}
function fmtDate(d: string) {
  try { return new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'2-digit' }) }
  catch { return d }
}

interface JourneyPoint { time: string; ce_oi: number; pe_oi: number; pcr: number }
interface Row {
  strike: number
  ce_open: number; ce_close: number; ce_chg: number
  pe_open: number; pe_close: number; pe_chg: number
  net_chg: number
}
interface Data {
  symbol: string; date: string; dates: string[]
  expiry: string; expiries: string[]
  open_time: string; close_time: string; snapshots: number
  journey: JourneyPoint[]; rows: Row[]
}

const BarTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-3 shadow-xl text-xs">
      <p className="text-white font-bold mb-1">Strike: {Number(label).toLocaleString()}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>{p.name}: {fmtOI(p.value)}</p>
      ))}
    </div>
  )
}

const LineTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-3 shadow-xl text-xs">
      <p className="text-white font-bold mb-1">{label}</p>
      <p className="text-red-400">CE OI: {fmtOI(d?.ce_oi)}</p>
      <p className="text-emerald-400">PE OI: {fmtOI(d?.pe_oi)}</p>
      <p className="text-amber-400">PCR: {d?.pcr}</p>
    </div>
  )
}

export default function EODAnalysis() {
  const [symbol, setSymbol] = useState('NIFTY')
  const [data, setData]     = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [date, setDate]     = useState('')
  const [expiry, setExpiry] = useState('')
  const [view, setView]     = useState<'chart'|'table'>('chart')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (date)   params.set('date', date)
      if (expiry) params.set('expiry', expiry)
      const res  = await fetch(`${API}/eod-analysis/${symbol}?${params}`)
      const json = await res.json()
      setData(json)
      if (!date   && json.date)   setDate(json.date)
      if (!expiry && json.expiry) setExpiry(json.expiry)
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [symbol, date, expiry])

  useEffect(() => { setDate(''); setExpiry('') }, [symbol])
  useEffect(() => { fetchData() }, [symbol, date, expiry])

  const isStock = STOCKS.includes(symbol)
  const totalCEChg = data?.rows.reduce((s, r) => s + r.ce_chg, 0) || 0
  const totalPEChg = data?.rows.reduce((s, r) => s + r.pe_chg, 0) || 0
  const ceBuilt    = data?.rows.filter(r => r.ce_chg > 0).reduce((s,r) => s+r.ce_chg, 0) || 0
  const peBuilt    = data?.rows.filter(r => r.pe_chg > 0).reduce((s,r) => s+r.pe_chg, 0) || 0
  const bullish    = peBuilt > ceBuilt

  const chartData = data?.rows
    .map(r => ({ strike: r.strike, 'CE Δ': r.ce_chg, 'PE Δ': r.pe_chg }))
    .sort((a,b) => Math.abs(b['CE Δ']+b['PE Δ']) - Math.abs(a['CE Δ']+a['PE Δ']))
    .slice(0, 20)
    .sort((a,b) => a.strike - b.strike) || []

  return (
    <div className="min-h-screen bg-[#07070e] text-white">
      <Navbar active="/eod" />
      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="text-3xl font-black tracking-tight mb-1">EOD Analysis</h1>
            <p className="text-gray-500 text-sm">Intraday OI journey · Open vs Close snapshot comparison</p>
          </div>
          <button onClick={fetchData} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-sm font-medium text-white rounded-lg border border-gray-700 transition-all disabled:opacity-50">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />Refresh
          </button>
        </div>

        {/* Symbol selector */}
        <div className="flex flex-wrap gap-2 mb-4 items-center">
          {INDICES.map(idx => (
            <button key={idx} onClick={() => setSymbol(idx)}
              className={`px-5 py-2.5 rounded-xl text-sm font-bold border transition-all ${symbol===idx ? 'bg-white text-gray-900 border-white' : 'bg-gray-900/40 text-gray-400 border-gray-800 hover:text-white'}`}>
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

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Date:</span>
            <select value={date} onChange={e => setDate(e.target.value)}
              className="bg-gray-900 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500">
              {data?.dates.map(d => <option key={d} value={d}>{fmtDate(d)}</option>)}
            </select>
          </div>
          {data?.expiries && data.expiries.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Expiry:</span>
              <select value={expiry} onChange={e => setExpiry(e.target.value)}
                className="bg-gray-900 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500">
                {data.expiries.map(e => <option key={e} value={e}>{fmtDate(e)}</option>)}
              </select>
            </div>
          )}
          {data && (
            <div className="text-xs text-gray-600 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2">
              {data.snapshots} snapshots · {data.open_time} → {data.close_time} IST
            </div>
          )}
          <div className="flex items-center gap-1 ml-auto bg-gray-900 border border-gray-800 rounded-lg p-1">
            {(['chart','table'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${view===v ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-white'}`}>
                {v === 'chart' ? '📊 Chart' : '📋 Table'}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <RefreshCw size={24} className="text-gray-600 animate-spin"/>
          </div>
        ) : !data?.rows.length ? (
          <div className="h-64 flex items-center justify-center flex-col gap-3">
            <div className="text-4xl">📈</div>
            <p className="text-gray-500 text-sm">No intraday data for {symbol} on this date</p>
            <p className="text-gray-600 text-xs">Data is captured every 5 mins during market hours 9:15–3:30 IST</p>
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-4 gap-3 mb-6">
              <div className={`rounded-xl p-4 border ${totalCEChg > 0 ? 'bg-red-950/20 border-red-800/30' : 'bg-gray-900/30 border-gray-800'}`}>
                <p className="text-xs text-gray-500 mb-1">CE OI Change</p>
                <p className={`text-xl font-black ${totalCEChg > 0 ? 'text-red-400' : 'text-orange-400'}`}>
                  {totalCEChg > 0 ? '+' : ''}{fmtOI(totalCEChg)}
                </p>
                <p className="text-xs text-gray-600">{totalCEChg > 0 ? 'Resistance building' : 'Resistance easing'}</p>
              </div>
              <div className={`rounded-xl p-4 border ${totalPEChg > 0 ? 'bg-emerald-950/20 border-emerald-800/30' : 'bg-gray-900/30 border-gray-800'}`}>
                <p className="text-xs text-gray-500 mb-1">PE OI Change</p>
                <p className={`text-xl font-black ${totalPEChg > 0 ? 'text-emerald-400' : 'text-yellow-400'}`}>
                  {totalPEChg > 0 ? '+' : ''}{fmtOI(totalPEChg)}
                </p>
                <p className="text-xs text-gray-600">{totalPEChg > 0 ? 'Support building' : 'Support easing'}</p>
              </div>
              <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">Session</p>
                <p className="text-xl font-black text-cyan-400">{data.open_time} – {data.close_time}</p>
                <p className="text-xs text-gray-600">{data.snapshots} captures · IST</p>
              </div>
              <div className={`rounded-xl p-4 border ${bullish ? 'bg-emerald-950/20 border-emerald-800/30' : 'bg-red-950/20 border-red-800/30'}`}>
                <p className="text-xs text-gray-500 mb-1">Day Bias</p>
                <p className={`text-xl font-black ${bullish ? 'text-emerald-400' : 'text-red-400'}`}>
                  {bullish ? '🐂 Bullish' : '🐻 Bearish'}
                </p>
                <p className="text-xs text-gray-600">Based on OI structure</p>
              </div>
            </div>

            {/* OI Journey chart */}
            {data.journey.length > 1 && (
              <div className="bg-gray-900/30 border border-gray-800 rounded-2xl p-6 mb-6">
                <h2 className="text-base font-bold text-white mb-1">Intraday OI Journey</h2>
                <p className="text-xs text-gray-500 mb-5">CE vs PE total OI through the session</p>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={data.journey} margin={{ top:5, right:20, left:10, bottom:5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false}/>
                    <XAxis dataKey="time" tick={{ fill:'#6b7280', fontSize:11 }} tickLine={false} axisLine={false}/>
                    <YAxis tick={{ fill:'#6b7280', fontSize:10 }} tickLine={false} axisLine={false} tickFormatter={v => fmtOI(v)}/>
                    <Tooltip content={<LineTooltip/>} cursor={{ stroke:'rgba(255,255,255,0.1)' }}/>
                    <Legend wrapperStyle={{ paddingTop:'12px', fontSize:'12px' }}/>
                    <Line type="monotone" dataKey="ce_oi" name="CE OI" stroke="#ef4444" strokeWidth={2} dot={false}/>
                    <Line type="monotone" dataKey="pe_oi" name="PE OI" stroke="#10b981" strokeWidth={2} dot={false}/>
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {view === 'chart' ? (
              <div className="bg-gray-900/30 border border-gray-800 rounded-2xl p-6 mb-6">
                <h2 className="text-base font-bold text-white mb-1">OI Change by Strike</h2>
                <p className="text-xs text-gray-500 mb-5">Open → Close · Top 20 strikes · Positive = buildup</p>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={chartData} margin={{ top:5, right:10, left:10, bottom:5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false}/>
                    <XAxis dataKey="strike" tick={{ fill:'#6b7280', fontSize:10 }} tickLine={false} axisLine={false}
                      tickFormatter={v => v>=1000 ? `${(v/1000).toFixed(0)}k` : v}/>
                    <YAxis tick={{ fill:'#6b7280', fontSize:10 }} tickLine={false} axisLine={false}
                      tickFormatter={v => fmtOI(v)}/>
                    <Tooltip content={<BarTooltip/>} cursor={{ fill:'rgba(255,255,255,0.03)' }}/>
                    <Legend wrapperStyle={{ paddingTop:'16px', fontSize:'12px' }}/>
                    <ReferenceLine y={0} stroke="#374151"/>
                    <Bar dataKey="CE Δ" name="CE Change" fill="#ef4444" opacity={0.85} radius={[3,3,0,0]}/>
                    <Bar dataKey="PE Δ" name="PE Change" fill="#10b981" opacity={0.85} radius={[3,3,0,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="bg-gray-900/20 border border-gray-800 rounded-2xl overflow-hidden mb-6">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-800 text-gray-500">
                      <th className="py-3 px-4 text-center text-amber-400 font-bold">Strike</th>
                      <th className="py-3 px-3 text-right text-red-400">CE Open</th>
                      <th className="py-3 px-3 text-right text-red-400">CE Close</th>
                      <th className="py-3 px-3 text-right text-red-400">CE Δ</th>
                      <th className="py-3 px-3 text-right text-emerald-400">PE Open</th>
                      <th className="py-3 px-3 text-right text-emerald-400">PE Close</th>
                      <th className="py-3 px-3 text-right text-emerald-400">PE Δ</th>
                      <th className="py-3 px-3 text-right text-cyan-400">Bias</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map(row => (
                      <tr key={row.strike} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                        <td className="py-2 px-4 text-center font-bold text-amber-400">{row.strike.toLocaleString()}</td>
                        <td className="py-2 px-3 text-right text-gray-500">{fmtOI(row.ce_open)}</td>
                        <td className="py-2 px-3 text-right text-gray-300">{fmtOI(row.ce_close)}</td>
                        <td className={`py-2 px-3 text-right font-semibold ${row.ce_chg>0?'text-red-400':row.ce_chg<0?'text-orange-400':'text-gray-600'}`}>
                          {row.ce_chg>0?'+':''}{fmtOI(row.ce_chg)}
                        </td>
                        <td className="py-2 px-3 text-right text-gray-500">{fmtOI(row.pe_open)}</td>
                        <td className="py-2 px-3 text-right text-gray-300">{fmtOI(row.pe_close)}</td>
                        <td className={`py-2 px-3 text-right font-semibold ${row.pe_chg>0?'text-emerald-400':row.pe_chg<0?'text-yellow-400':'text-gray-600'}`}>
                          {row.pe_chg>0?'+':''}{fmtOI(row.pe_chg)}
                        </td>
                        <td className={`py-2 px-3 text-right font-bold ${row.net_chg>0?'text-emerald-400':row.net_chg<0?'text-red-400':'text-gray-600'}`}>
                          {row.net_chg>0?'🐂':row.net_chg<0?'🐻':'—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}