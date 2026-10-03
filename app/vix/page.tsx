'use client'
import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import Navbar from '@/components/Navbar'

const API = 'https://api.greeknova.com'

const ZONE_COLORS: Record<string, string> = {
  green: '#16a34a',
  yellow: '#ca8a04',
  orange: '#ea580c',
  red: '#dc2626',
}

type VixData = {
  vix_value: number
  prev_close: number | null
  change_pct: number | null
  day_high: number
  day_low: number
  zone: string
  color: string
  alert: { type: string; move_pct: number; baseline_minutes_ago: number } | null
  history: { timestamp: string; vix_value: number }[]
  timestamp: string
}

type RangeKey = '3h' | '1m' | '3m' | '6m' | '1y'

type DailyHistory = {
  range: string
  history: { date: string; open: number; high: number; low: number; close: number }[]
  range_low: number | null
  range_high: number | null
}

export default function VixPage() {
  const [data, setData] = useState<VixData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [range, setRange] = useState<RangeKey>('3h')
  const [daily, setDaily] = useState<DailyHistory | null>(null)
  const [dailyLoading, setDailyLoading] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${API}/vix-pulse?t=${Date.now()}`, { cache: 'no-store' })
        if (!res.ok) throw new Error(`Server returned ${res.status}`)
        const json = await res.json()
        setData(json)
        setError(null)
      } catch (e: any) {
        setError(e?.message || 'Failed to load VIX data')
      }
    }
    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (range === '3h') return
    setDailyLoading(true)
    fetch(`${API}/vix-history?range=${range}&t=${Date.now()}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then(setDaily)
      .catch(() => setDaily(null))
      .finally(() => setDailyLoading(false))
  }, [range])

  const color = data ? ZONE_COLORS[data.color] || '#6b7280' : '#6b7280'

  const intradayChartData = (data?.history || []).map((h) => ({
    time: new Date(h.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    vix: h.vix_value,
  }))

  const dailyChartData = (daily?.history || []).map((h) => ({
    time: new Date(h.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
    vix: h.close,
  }))

  const chartData = range === '3h' ? intradayChartData : dailyChartData

  return (
    <>
      <Navbar active="/vix" />
      <div className="max-w-5xl mx-auto px-6 py-8">
        <h1 className="text-xl font-bold text-white mb-1">India VIX — Fear Gauge</h1>
        <p className="text-sm text-gray-500 mb-6">
          NSE's volatility index. Rising VIX reflects rising uncertainty/fear priced into options; falling VIX
          reflects cooling. Informational only — not a buy/sell signal on its own.
        </p>

        {error && (
          <div className="rounded-lg border border-red-800/50 bg-red-950/30 text-red-400 text-sm px-4 py-3 mb-4">
            {error}
          </div>
        )}

        {!data && !error && <div className="text-gray-500 text-sm">Loading...</div>}

        {data && (
          <>
            <div
              className="rounded-xl border p-6 mb-6 flex flex-wrap items-center gap-6"
              style={{ borderColor: color }}
            >
              <div>
                <div className="text-xs text-gray-500 mb-1">Current</div>
                <div className="text-4xl font-black" style={{ color }}>
                  {data.vix_value.toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">Change</div>
                <div className="text-lg font-semibold" style={{ color }}>
                  {data.change_pct !== null
                    ? `${data.change_pct > 0 ? '+' : ''}${data.change_pct}%`
                    : '—'}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">Day Range</div>
                <div className="text-lg font-semibold text-gray-300">
                  {data.day_low?.toFixed(2)} – {data.day_high?.toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">Zone</div>
                <span
                  className="text-sm font-bold px-3 py-1 rounded-lg"
                  style={{ backgroundColor: color + '22', color }}
                >
                  {data.zone}
                </span>
              </div>
              {data.alert && (
                <div className="ml-auto">
                  <span className="text-sm font-bold animate-pulse px-3 py-1.5 rounded-lg" style={{ backgroundColor: color + '22', color }}>
                    ⚡ {data.alert.type === 'VIX_SPIKE' ? 'Spiking' : 'Cooling'} {Math.abs(data.alert.move_pct)}%
                    {' '}vs {data.alert.baseline_minutes_ago}min ago
                  </span>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-gray-800 p-4 mb-6">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs text-gray-500">
                  {range === '3h' ? "Today's intraday" : `Daily close — ${range.toUpperCase()}`}
                </div>
                <div className="flex gap-1">
                  {(['3h', '1m', '3m', '6m', '1y'] as RangeKey[]).map((r) => (
                    <button
                      key={r}
                      onClick={() => setRange(r)}
                      className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${
                        range === r
                          ? 'bg-gray-700 text-white'
                          : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
                      }`}
                    >
                      {r.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              {daily && range !== '3h' && daily.range_low !== null && (
                <div className="text-xs text-gray-500 mb-2">
                  {range.toUpperCase()} range: {daily.range_low?.toFixed(2)} – {daily.range_high?.toFixed(2)}
                </div>
              )}
              {dailyLoading ? (
                <div className="text-sm text-gray-500 py-10 text-center">Loading history...</div>
              ) : chartData.length > 1 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis dataKey="time" stroke="#6b7280" fontSize={11} />
                    <YAxis stroke="#6b7280" fontSize={11} domain={['auto', 'auto']} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0a0a12', border: '1px solid #1f2937', fontSize: 12 }}
                    />
                    <Line type="monotone" dataKey="vix" stroke={color} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-sm text-gray-500 py-10 text-center">
                  {range === '3h'
                    ? "Collecting data — chart fills in as snapshots build up through the session."
                    : "No history yet for this range."}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-gray-800 p-4">
              <div className="text-xs text-gray-500 mb-2 font-semibold">Fear zones (reference)</div>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-xs">
                {[
                  { label: '< 12', zone: 'Complacent', color: ZONE_COLORS.green },
                  { label: '12–15', zone: 'Low', color: ZONE_COLORS.green },
                  { label: '15–20', zone: 'Normal', color: ZONE_COLORS.yellow },
                  { label: '20–25', zone: 'Elevated', color: ZONE_COLORS.orange },
                  { label: '25–30', zone: 'High Fear', color: ZONE_COLORS.red },
                  { label: '> 30', zone: 'Panic', color: ZONE_COLORS.red },
                ].map((z) => (
                  <div key={z.zone} className="rounded-lg px-2 py-2" style={{ backgroundColor: z.color + '15' }}>
                    <div className="font-semibold" style={{ color: z.color }}>{z.zone}</div>
                    <div className="text-gray-500">{z.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}
