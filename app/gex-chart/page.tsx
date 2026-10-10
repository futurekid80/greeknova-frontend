'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Legend,
} from 'recharts'
import { chartColors } from '@/lib/chartColors'

const API = 'https://api.greeknova.com'
const SYMBOLS = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY']

function fmtNum(n: number | null | undefined) {
  if (n === null || n === undefined || isNaN(n)) return '—'
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 10000000) return sign + (abs / 10000000).toFixed(2) + 'Cr'
  if (abs >= 100000) return sign + (abs / 100000).toFixed(2) + 'L'
  if (abs >= 1000) return sign + (abs / 1000).toFixed(1) + 'K'
  return n.toLocaleString('en-IN')
}

type StrikeRow = { strike: number; ce_gex: number; pe_gex: number; net_gex: number }
type StrikeRowWithCum = StrikeRow & { cum_gex: number }
type GexData = {
  symbol: string
  expiry: string
  days_to_expiry: number
  spot: number
  regime: 'SHORT_GAMMA' | 'LONG_GAMMA'
  call_wall_strike: number | null
  put_wall_strike: number | null
  flip_point: number | null
  local_flip_point: number | null
  strikes: StrikeRow[]
  as_of: string
  error?: string
}

export default function GexByStrikePage() {
  const [symbol, setSymbol] = useState('NIFTY')
  const [data, setData] = useState<GexData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (sym: string) => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/gamma-by-strike/${sym}?t=${Date.now()}`, { cache: 'no-store' })
      const json = await res.json()
      setData(json)
    } catch (e) {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(symbol)
    const id = setInterval(() => load(symbol), 60000)
    return () => clearInterval(id)
  }, [symbol, load])

  const isShort = data?.regime === 'SHORT_GAMMA'

  // Running cumulative net GEX across strikes, low -> high -- this is the
  // exact curve the backend walks to find flip_point, drawn as a line so
  // the "does it cross zero near spot" question is visible at a glance
  // instead of needing a one-off diagnostic script.
  const strikesWithCum = useMemo<StrikeRowWithCum[]>(() => {
    if (!data?.strikes) return []
    let cum = 0
    return data.strikes.map(r => {
      cum += r.net_gex
      return { ...r, cum_gex: Math.round(cum * 100) / 100 }
    })
  }, [data?.strikes])

  return (
    <div className="min-h-screen bg-black text-white px-4 py-6 md:px-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2">⚡ GEX by Strike</h1>
          <p className="text-sm text-gray-400 mt-1">
            Dealer gamma exposure per strike — call wall, put wall, and flip point over the live option chain
          </p>
        </div>
        <div className="flex gap-2">
          {SYMBOLS.map(s => (
            <button
              key={s}
              onClick={() => setSymbol(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-bold border ${
                s === symbol
                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                  : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {loading && <div className="text-gray-500 text-sm">Loading…</div>}

      {!loading && data?.error && (
        <div className="text-red-400 text-sm">Error: {data.error}</div>
      )}

      {!loading && data && !data.error && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
            <StatCard label="SPOT" value={data.spot?.toLocaleString()} />
            <StatCard
              label="REGIME"
              value={isShort ? 'SHORT GAMMA' : 'LONG GAMMA'}
              accent={isShort ? 'text-red-400' : 'text-emerald-400'}
            />
            <StatCard label="CALL WALL" value={data.call_wall_strike?.toLocaleString() ?? '—'} accent="text-emerald-400" />
            <StatCard label="PUT WALL" value={data.put_wall_strike?.toLocaleString() ?? '—'} accent="text-red-400" />
            <StatCard label="FLIP" value={data.flip_point?.toLocaleString() ?? '—'} accent="text-amber-400" />
            <StatCard label="FLIP (nearby)" value={data.local_flip_point?.toLocaleString() ?? '—'} accent="text-violet-300" />
          </div>

          <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-bold text-gray-300">
                GEX by strike — {data.symbol} · {data.expiry} ({data.days_to_expiry} DTE)
              </h2>
              <span className="text-xs text-gray-500">as of {data.as_of?.slice(11, 16)} UTC</span>
            </div>
            <ResponsiveContainer width="100%" height={440}>
              <ComposedChart data={strikesWithCum} margin={{ top: 75, right: 20, left: 0, bottom: 0 }} barGap={2} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                <XAxis
                  dataKey="strike"
                  type="number"
                  domain={['dataMin', 'dataMax']}
                  tick={{ fill: chartColors.axisTick, fontSize: 11 }}
                  tickFormatter={(v) => v.toLocaleString()}
                />
                <YAxis tick={{ fill: chartColors.axisTick, fontSize: 11 }} tickFormatter={fmtNum} />
                <Tooltip
                  contentStyle={{ background: '#111', border: '1px solid #333', borderRadius: 8, fontSize: 12 }}
                  labelFormatter={(v) => `Strike ${Number(v).toLocaleString()}`}
                  formatter={(value, name) => [fmtNum(typeof value === 'number' ? value : Number(value)), name]}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="ce_gex" name="Call GEX" fill={chartColors.call} radius={[2, 2, 0, 0]} barSize={7} isAnimationActive={false} />
                <Bar dataKey="pe_gex" name="Put GEX" fill={chartColors.put} radius={[0, 0, 2, 2]} barSize={7} isAnimationActive={false} />
                <Line
                  type="monotone"
                  dataKey="cum_gex"
                  name="Cumulative GEX"
                  stroke={chartColors.flip}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />

                {data.spot && (
                  <ReferenceLine x={data.spot} stroke={chartColors.spot} strokeDasharray="4 3"
                    label={{ value: `SPOT ${data.spot.toLocaleString()}`, position: 'top', offset: 10, fill: chartColors.spot, fontSize: 11 }} />
                )}
                {data.call_wall_strike && (
                  <ReferenceLine x={data.call_wall_strike} stroke={chartColors.callWall} strokeDasharray="4 3"
                    label={{ value: `CALL WALL ${data.call_wall_strike.toLocaleString()}`, position: 'top', offset: 32, fill: chartColors.callWall, fontSize: 11 }} />
                )}
                {data.put_wall_strike && (
                  <ReferenceLine x={data.put_wall_strike} stroke={chartColors.putWall} strokeDasharray="4 3"
                    label={{ value: `PUT WALL ${data.put_wall_strike.toLocaleString()}`, position: 'top', offset: 54, fill: chartColors.putWall, fontSize: 11 }} />
                )}
                {data.flip_point && (
                  <ReferenceLine x={data.flip_point} stroke={chartColors.flip} strokeDasharray="2 2"
                    label={{ value: `FLIP ${data.flip_point.toLocaleString()}`, position: 'bottom', fill: chartColors.flip, fontSize: 11 }} />
                )}
                {data.local_flip_point && data.local_flip_point !== data.flip_point && (
                  <ReferenceLine x={data.local_flip_point} stroke={chartColors.localFlip} strokeDasharray="1 3"
                    label={{ value: `FLIP (nearby) ${data.local_flip_point.toLocaleString()}`, position: 'bottom', offset: 20, fill: chartColors.localFlip, fontSize: 10 }} />
                )}
                <ReferenceLine y={0} stroke="#ffffff33" />
              </ComposedChart>
            </ResponsiveContainer>
            <p className="text-xs text-gray-500 mt-2">
              Green = call-side gamma×OI, red = put-side gamma×OI (shown below axis). Violet line = running cumulative net GEX across strikes — where it crosses zero near spot is the (cumulative) Flip Point.
              Amber = spot. GreekNova computes gamma from IV solved off live traded premiums (Black-Scholes), weighted by open interest — unscaled by lot size, so bar height is relative, not ₹ notional.
            </p>
          </div>
        </>
      )}
    </div>
  )
}

function StatCard({ label, value, accent }: { label: string; value: React.ReactNode; accent?: string }) {
  return (
    <div className="bg-white/[0.02] border border-white/10 rounded-xl px-3 py-2.5">
      <div className="text-[10px] font-bold text-gray-500 tracking-wide">{label}</div>
      <div className={`text-lg font-black mt-0.5 ${accent ?? 'text-white'}`}>{value}</div>
    </div>
  )
}
