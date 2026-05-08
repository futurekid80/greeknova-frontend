'use client'
import Navbar from '@/components/Navbar'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid, ReferenceLine, Cell } from 'recharts'
import { RefreshCw, TrendingUp, TrendingDown } from 'lucide-react'

interface ChartPoint { strike: number; CE: number; PE: number; total: number; isATM: boolean }

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

const CustomTooltip = ({ active, payload, label, atm, cmp }: any) => {
  if (!active || !payload?.length) return null
  const isATM = label === atm
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-3 shadow-xl">
      <p className="text-white font-bold mb-1">
        Strike: {Number(label).toLocaleString()}
        {isATM && <span className="ml-2 text-amber-400 text-xs">⭐ ATM</span>}
      </p>
      {cmp && <p className="text-xs text-gray-500 mb-2">CMP: ₹{Number(cmp).toLocaleString()}</p>}
      {payload.map((p: any) => (
        <p key={p.name} className="text-sm" style={{ color: p.color }}>
          {p.name}: {(p.value / 100000).toFixed(1)}L
        </p>
      ))}
    </div>
  )
}

export default function Charts() {
  const [symbol, setSymbol] = useState('NIFTY')
  const [chartData, setChartData] = useState<ChartPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [totalCE, setTotalCE] = useState(0)
  const [totalPE, setTotalPE] = useState(0)
  const [maxPain, setMaxPain] = useState(0)
  const [lastUpdate, setLastUpdate] = useState('')
  const [cmp, setCmp] = useState<number | null>(null)
  const [atmStrike, setAtmStrike] = useState<number | null>(null)

  async function fetchChart(sym: string) {
    setLoading(true)
    setCmp(null)
    setAtmStrike(null)
    try {
      // Get latest timestamp for this symbol
      const { data: latest } = await supabase
        .from('oi_snapshots')
        .select('timestamp')
        .eq('symbol', sym)
        .order('timestamp', { ascending: false })
        .limit(1)

      if (!latest?.length) { setLoading(false); return }

      const ts = latest[0].timestamp
      setLastUpdate(new Date(ts).toLocaleString("en-IN", {
        dateStyle: "medium", timeStyle: "short", timeZone: "UTC"
      }))

      // Get OI data for latest timestamp
      const { data } = await supabase
        .from('oi_snapshots')
        .select('*')
        .eq('timestamp', ts)
        .eq('symbol', sym)
        .order('strike', { ascending: true })

      if (!data?.length) { setLoading(false); return }

      // Get CMP
      const { data: cmpData } = await supabase
        .from('cmp_prices')
        .select('cmp')
        .eq('symbol', sym)
        .order('timestamp', { ascending: false })
        .limit(1)

      const currentCmp = cmpData?.[0]?.cmp || null
      setCmp(currentCmp)

      const strikes = [...new Set(data.map((d: any) => d.strike))].sort((a, b) => a - b)
      const ce = data.filter((d: any) => d.option_type === 'CE')
      const pe = data.filter((d: any) => d.option_type === 'PE')

      const tCE = ce.reduce((s: number, d: any) => s + d.oi, 0)
      const tPE = pe.reduce((s: number, d: any) => s + d.oi, 0)
      setTotalCE(tCE)
      setTotalPE(tPE)

      // ATM strike — nearest to CMP
      let atm = strikes[0]
      if (currentCmp) {
        atm = strikes.reduce((prev, curr) =>
          Math.abs(curr - currentCmp) < Math.abs(prev - currentCmp) ? curr : prev
        )
      }
      setAtmStrike(atm)

      // Max pain calculation
      let mp = strikes[0], minLoss = Infinity
      for (const s of strikes) {
        let loss = 0
        ce.forEach((r: any) => { if (s > r.strike) loss += (s - r.strike) * r.oi })
        pe.forEach((r: any) => { if (s < r.strike) loss += (r.strike - s) * r.oi })
        if (loss < minLoss) { minLoss = loss; mp = s }
      }
      setMaxPain(mp)

      // Build chart data — top 20 strikes by total OI
      const points: ChartPoint[] = strikes.map(strike => ({
        strike,
        CE: ce.find((d: any) => d.strike === strike)?.oi || 0,
        PE: pe.find((d: any) => d.strike === strike)?.oi || 0,
        total: (ce.find((d: any) => d.strike === strike)?.oi || 0) + (pe.find((d: any) => d.strike === strike)?.oi || 0),
        isATM: strike === atm
      }))

      const top20 = points
        .sort((a, b) => b.total - a.total)
        .slice(0, 20)
        .sort((a, b) => a.strike - b.strike)

      setChartData(top20)
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  useEffect(() => { fetchChart(symbol) }, [symbol])

  const pcr = totalCE > 0 ? totalPE / totalCE : 0
  const bull = pcr > 1
  const ceP = totalCE + totalPE > 0 ? Math.round((totalCE / (totalCE + totalPE)) * 100) : 50
  const isStock = STOCKS.includes(symbol)

  return (
    <div className="min-h-screen bg-[#07070e] text-white">
      <Navbar active="/charts" />

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black tracking-tight mb-1">OI Analysis</h1>
            <p className="text-gray-500 text-sm">Strike-wise open interest · CE vs PE distribution</p>
          </div>
          <div className="flex items-center gap-3">
            {/* CMP Badge */}
            {cmp && (
              <div className="flex items-center gap-3 bg-amber-950/30 border border-amber-800/50 rounded-xl px-4 py-2">
                <div>
                  <p className="text-xs text-gray-500">CMP</p>
                  <p className="text-xl font-black text-amber-400">₹{cmp.toLocaleString()}</p>
                </div>
                {atmStrike && (
                  <div className="border-l border-amber-800/50 pl-3">
                    <p className="text-xs text-gray-500">ATM Strike</p>
                    <p className="text-xl font-black text-amber-300">{atmStrike.toLocaleString()}</p>
                  </div>
                )}
              </div>
            )}
            <button onClick={() => fetchChart(symbol)} disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-sm font-medium text-white rounded-lg border border-gray-700 transition-all disabled:opacity-50">
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />Refresh
            </button>
          </div>
        </div>

        {/* Symbol selector */}
        <div className="flex flex-wrap gap-2 mb-6 items-center">
          {INDICES.map(idx => (
            <button key={idx} onClick={() => setSymbol(idx)}
              className={`px-5 py-2.5 rounded-xl text-sm font-bold border transition-all ${symbol === idx ? 'bg-white text-gray-900 border-white' : 'bg-gray-900/40 text-gray-400 border-gray-800 hover:border-gray-600 hover:text-white'}`}>
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

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { label: 'PCR', value: pcr.toFixed(2), color: bull ? 'text-emerald-400' : 'text-red-400' },
            { label: 'Max Pain', value: maxPain.toLocaleString(), color: 'text-amber-400' },
            { label: 'CE OI', value: `${(totalCE / 100000).toFixed(0)}L`, color: 'text-red-400' },
            { label: 'PE OI', value: `${(totalPE / 100000).toFixed(0)}L`, color: 'text-emerald-400' },
          ].map(s => (
            <div key={s.label} className="bg-gray-900/30 border border-gray-800 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">{s.label}</p>
              <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Posture bar */}
        <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {bull ? <TrendingUp size={16} className="text-emerald-400" /> : <TrendingDown size={16} className="text-red-400" />}
              <span className={`text-sm font-bold ${bull ? 'text-emerald-400' : 'text-red-400'}`}>
                {bull ? 'BULLISH BIAS' : 'BEARISH BIAS'} — {symbol}
              </span>
            </div>
            <span className="text-xs text-gray-500">{lastUpdate}</span>
          </div>
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-red-400 font-medium">CE {ceP}%</span>
            <span className="text-emerald-400 font-medium">PE {100 - ceP}%</span>
          </div>
          <div className="h-2 rounded-full bg-gray-800 overflow-hidden flex">
            <div className="bg-red-500/80 h-full rounded-l-full transition-all duration-700" style={{ width: `${ceP}%` }} />
            <div className="bg-emerald-500/80 h-full rounded-r-full transition-all duration-700" style={{ width: `${100 - ceP}%` }} />
          </div>
        </div>

        {/* Main chart */}
        <div className="bg-gray-900/30 border border-gray-800 rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-base font-bold text-white">Strike-wise OI Distribution</h2>
            {atmStrike && (
              <span className="text-xs text-amber-400 bg-amber-950/30 border border-amber-800/40 px-2 py-1 rounded-lg">
                ⭐ ATM = {atmStrike.toLocaleString()}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mb-5">
            Top 20 strikes by total OI · Values in Lakhs · ⭐ = ATM Strike
          </p>
          {loading ? (
            <div className="h-72 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <RefreshCw size={24} className="text-gray-600 animate-spin" />
                <p className="text-sm text-gray-600">Loading chart data...</p>
              </div>
            </div>
          ) : chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                <XAxis dataKey="strike" tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} axisLine={false}
                  tickFormatter={(v) => {
                    const label = v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
                    return v === atmStrike ? `⭐${label}` : label
                  }} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} axisLine={false}
                  tickFormatter={(v) => `${(v / 100000).toFixed(0)}L`} />
                <Tooltip content={<CustomTooltip atm={atmStrike} cmp={cmp} />}
                  cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                <Legend wrapperStyle={{ paddingTop: '16px', fontSize: '12px' }} />
                {atmStrike && (
                  <ReferenceLine x={atmStrike} stroke="#f59e0b" strokeDasharray="4 4" strokeWidth={2} />
                )}
                <Bar dataKey="CE" name="CE OI" radius={[3, 3, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={index}
                      fill={entry.isATM ? '#f59e0b' : '#ef4444'}
                      opacity={entry.isATM ? 1 : 0.85}
                    />
                  ))}
                </Bar>
                <Bar dataKey="PE" name="PE OI" radius={[3, 3, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={index}
                      fill={entry.isATM ? '#fbbf24' : '#10b981'}
                      opacity={entry.isATM ? 1 : 0.85}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-72 flex items-center justify-center flex-col gap-3">
              <div className="text-4xl">📊</div>
              <p className="text-gray-500 text-sm">No data available for {symbol}</p>
            </div>
          )}
        </div>

        {/* Max pain callout */}
        {maxPain > 0 && (
          <div className="bg-amber-950/20 border border-amber-800/40 rounded-xl p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-amber-950/60 border border-amber-800/50 flex items-center justify-center text-lg">📍</div>
            <div>
              <p className="text-sm font-bold text-amber-400">Max Pain: {maxPain.toLocaleString()}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Price gravitates toward this strike at expiry. Option writers benefit most here.
                {cmp && maxPain && (
                  <span className={`ml-2 font-semibold ${cmp > maxPain ? 'text-orange-400' : 'text-emerald-400'}`}>
                    CMP is {Math.abs(((cmp - maxPain) / maxPain) * 100).toFixed(1)}%
                    {cmp > maxPain ? ' above' : ' below'} Max Pain.
                  </span>
                )}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
