'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Legend,
} from 'recharts'

const API = 'https://api.greeknova.com'
const SYMBOLS = ['NIFTY', 'BANKNIFTY', 'FINNIFTY']

type StrikeRow = { strike: number; ce_gex: number; pe_gex: number; net_gex: number }
type GexData = {
  symbol: string
  expiry: string
  days_to_expiry: number
  spot: number
  regime: 'SHORT_GAMMA' | 'LONG_GAMMA'
  call_wall_strike: number | null
  put_wall_strike: number | null
  flip_point: number | null
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
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            <StatCard label="SPOT" value={data.spot?.toLocaleString()} />
            <StatCard
              label="REGIME"
              value={isShort ? 'SHORT GAMMA' : 'LONG GAMMA'}
              accent={isShort ? 'text-red-400' : 'text-emerald-400'}
            />
            <StatCard label="CALL WALL" value={data.call_wall_strike?.toLocaleString() ?? '—'} accent="text-emerald-400" />
            <StatCard label="PUT WALL" value={data.put_wall_strike?.toLocaleString() ?? '—'} accent="text-red-400" />
            <StatCard label="FLIP" value={data.flip_point?.toLocaleString() ?? '—'} accent="text-amber-400" />
          </div>

          <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-bold text-gray-300">
                GEX by strike — {data.symbol} · {data.expiry} ({data.days_to_expiry} DTE)
              </h2>
              <span className="text-xs text-gray-500">as of {data.as_of?.slice(11, 16)} UTC</span>
            </div>
            <ResponsiveContainer width="100%" height={420}>
              <ComposedChart data={data.strikes} margin={{ top: 30, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff14" />
                <XAxis
                  dataKey="strike"
                  type="number"
                  domain={['dataMin', 'dataMax']}
                  tick={{ fill: '#888', fontSize: 11 }}
                  tickFormatter={(v) => v.toLocaleString()}
                />
                <YAxis tick={{ fill: '#888', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: '#111', border: '1px solid #333', borderRadius: 8, fontSize: 12 }}
                  labelFormatter={(v) => `Strike ${Number(v).toLocaleString()}`}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="ce_gex" name="Call GEX" fill="#34d399" radius={[2, 2, 0, 0]} />
                <Bar dataKey="pe_gex" name="Put GEX" fill="#f87171" radius={[0, 0, 2, 2]} />

                {data.spot && (
                  <ReferenceLine x={data.spot} stroke="#fbbf24" strokeDasharray="4 3"
                    label={{ value: `SPOT ${data.spot.toLocaleString()}`, position: 'top', fill: '#fbbf24', fontSize: 11 }} />
                )}
                {data.call_wall_strike && (
                  <ReferenceLine x={data.call_wall_strike} stroke="#34d399" strokeDasharray="4 3"
                    label={{ value: `CALL WALL ${data.call_wall_strike.toLocaleString()}`, position: 'insideTopRight', fill: '#34d399', fontSize: 11 }} />
                )}
                {data.put_wall_strike && (
                  <ReferenceLine x={data.put_wall_strike} stroke="#f87171" strokeDasharray="4 3"
                    label={{ value: `PUT WALL ${data.put_wall_strike.toLocaleString()}`, position: 'insideTopLeft', fill: '#f87171', fontSize: 11 }} />
                )}
                {data.flip_point && (
                  <ReferenceLine x={data.flip_point} stroke="#a78bfa" strokeDasharray="2 2"
                    label={{ value: `FLIP ${data.flip_point.toLocaleString()}`, position: 'bottom', fill: '#a78bfa', fontSize: 11 }} />
                )}
              </ComposedChart>
            </ResponsiveContainer>
            <p className="text-xs text-gray-500 mt-2">
              Green = call-side gamma×OI, red = put-side gamma×OI (shown below axis). Amber = spot, purple = gamma flip.
              GreekNova computes gamma from IV solved off live traded premiums (Black-Scholes), weighted by open interest — unscaled by lot size, so bar height is relative, not ₹ notional.
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
