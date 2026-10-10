'use client'
import Navbar from '@/components/Navbar'
import SymbolResult from '@/components/SymbolResult'
import { useEffect, useState, useCallback, useRef } from 'react'
import { RefreshCw, Clock } from 'lucide-react'
import { useAutoRefresh } from '@/lib/useAutoRefresh'
import { ALL_SYMBOLS } from '@/lib/symbols'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts'

const API = 'https://api.greeknova.com'
const INDICES = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY', 'SENSEX']

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
  const [symbolInput, setSymbolInput] = useState('NIFTY')
  const [showDropdown, setShowDropdown] = useState(false)
  const searchBoxRef = useRef<HTMLDivElement>(null)
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

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) setShowDropdown(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const filteredSymbols = symbolInput
    ? ALL_SYMBOLS.filter(s => s.includes(symbolInput)).slice(0, 50)
    : ALL_SYMBOLS.slice(0, 50)

  function pickSymbol(s: string) {
    setSymbolInput(s)
    setSymbol(s)
    setShowDropdown(false)
  }

  const { enabled: autoOn, toggle: toggleAuto, countdownStr } = useAutoRefresh(fetchData, 5 * 60 * 1000, true)

  const atm = data?.chain.find(r => r.is_atm)

  // IV skew: plot each strike's CE/PE IV so the "smile/skew" shape is visible
  // directly -- OTM puts normally pricing richer than OTM calls (equity skew)
  // is the textbook case this is meant to make visible at a glance.
  //
  // Liquidity filter: a strike with near-zero OI/volume often has a stale last
  // traded price that no longer matches the current spot. Feeding that into
  // the Black-Scholes IV solver produces a nonsensical spike or crash in IV --
  // not real market skew, just a data artifact. Dropping each side's IV when
  // that side hasn't actually traded keeps the curve to strikes the market is
  // genuinely pricing right now.
  const MIN_OI = 500
  const MIN_VOL = 1
  const isLiquid = (g: Greeks) => (g.oi ?? 0) >= MIN_OI || (g.volume ?? 0) >= MIN_VOL
  const skewData = (data?.chain ?? [])
    .map(r => ({
      strike: r.strike,
      callIV: isLiquid(r.ce) ? r.ce.iv ?? null : null,
      putIV:  isLiquid(r.pe) ? r.pe.iv ?? null : null,
      isAtm:  r.is_atm,
    }))
    .filter(r => r.callIV != null || r.putIV != null)

  return (
    <div className="min-h-screen bg-[#07070e] text-white">
      {/* Nav */}
      <Navbar active="/optionchain" />

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

        {/* Index selector + stock search */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {INDICES.map(idx => (
            <button key={idx} onClick={() => { setSymbol(idx); setSymbolInput(idx) }}
              className={`px-5 py-2.5 rounded-xl text-sm font-bold border transition-all ${symbol === idx ? 'bg-white text-gray-900 border-white' : 'bg-gray-900/40 text-gray-400 border-gray-800 hover:text-white'}`}>
              {idx}
            </button>
          ))}
          <span className="text-gray-700 text-sm px-1">or</span>
          <div ref={searchBoxRef} className="relative">
            <input
              value={symbolInput}
              onFocus={() => { setSymbolInput(''); setShowDropdown(true) }}
              onChange={(e) => { setSymbolInput(e.target.value.toUpperCase()); setShowDropdown(true) }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && filteredSymbols.length > 0) pickSymbol(filteredSymbols[0])
                if (e.key === 'Escape') { setSymbolInput(symbol); setShowDropdown(false) }
              }}
              onBlur={() => { if (!ALL_SYMBOLS.includes(symbolInput)) setSymbolInput(symbol) }}
              placeholder="Click to see all stocks…"
              className={`px-4 py-2.5 rounded-xl text-sm font-bold border transition-all bg-gray-900/40 text-white border-gray-800 placeholder:text-gray-600 placeholder:font-normal focus:outline-none focus:border-cyan-700 w-64 ${!INDICES.includes(symbol) ? 'border-cyan-700' : ''}`}
            />
            {showDropdown && (
              <div className="absolute z-20 mt-1 w-64 max-h-72 overflow-y-auto bg-gray-900 border border-gray-700 rounded-xl shadow-xl">
                {filteredSymbols.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-gray-500">No match</div>
                ) : filteredSymbols.map(s => (
                  <button
                    key={s}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pickSymbol(s)}
                    className={`block w-full text-left px-3 py-2 text-xs font-semibold hover:bg-gray-800 ${s === symbol ? 'text-cyan-400' : 'text-gray-300'}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Expiry selector */}
        {data?.expiries && data.expiries.length > 0 && (
          <div className="flex items-center gap-2 mb-6">
            <span className="text-xs text-gray-500 mr-1">Expiry:</span>
            <SymbolResult symbol={symbol} expiry={expiry || data.expiries[0]} />
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

        {/* IV Skew curve */}
        {skewData.length > 2 && (
          <div className="bg-gray-900/20 border border-gray-800 rounded-2xl p-4 mb-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-bold text-white">IV Skew — Calls vs Puts by Strike</p>
              <p className="text-[11px] text-gray-500">Puts pricier than calls on the downside = normal equity skew</p>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={skewData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="strike" tick={{ fill: '#6b7280', fontSize: 11 }} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} unit="%" />
                <Tooltip
                  contentStyle={{ background: '#0c0c16', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }}
                  labelFormatter={(v) => `Strike ${v}`}
                  formatter={(v: any, name: any) => [v != null ? `${v}%` : '—', name]}
                />
                {atm?.strike && <ReferenceLine x={atm.strike} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: 'ATM', fill: '#f59e0b', fontSize: 10 }} />}
                <Line type="monotone" dataKey="callIV" name="Call IV" stroke="#f87171" strokeWidth={2} dot={false} connectNulls />
                <Line type="monotone" dataKey="putIV" name="Put IV" stroke="#34d399" strokeWidth={2} dot={false} connectNulls />
              </LineChart>
            </ResponsiveContainer>
            <details className="mt-3 text-xs text-gray-400 leading-relaxed">
              <summary className="cursor-pointer text-gray-300 font-semibold">How to read this</summary>
              <ul className="mt-2 space-y-1.5 list-disc list-inside">
                <li><span className="text-gray-200 font-medium">Put IV above Call IV</span> on the same side = normal equity skew — the market pays up for downside protection (crash hedging demand) more than for upside speculation. This is the default shape for almost every Indian stock/index.</li>
                <li><span className="text-gray-200 font-medium">The gap near ATM</span> is the one that matters most for pricing — it's what you're actually selling/buying against. Wings far from spot carry less weight even when liquid.</li>
                <li><span className="text-gray-200 font-medium">A steep/widening curve into expiry or before an event</span> (earnings, results) means the market is pricing fatter tail risk — selling premium here carries more event risk, not just more time value.</li>
                <li><span className="text-gray-200 font-medium">Thin strikes are hidden</span>, not shown flat — a strike with no real OI/volume is dropped rather than plotted, since its last traded price is often stale and produces a fake spike/crash in implied IV rather than a real market read.</li>
                <li>This is descriptive, not a signal — it shows how the market is currently pricing risk, not which way price will move.</li>
              </ul>
            </details>
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
            <div className="max-h-[70vh] overflow-y-auto overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10 bg-[#0c0c16]">
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
