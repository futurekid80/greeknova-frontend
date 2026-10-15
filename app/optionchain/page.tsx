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

interface SpikeEpisode {
  strike: number
  side: 'CE' | 'PE'
  metric: 'IV' | 'VOL'
  start_time: string
  end_time: string
  peak_time: string
  peak_value: number
  baseline: number
  magnitude_pct: number | null
  ongoing: boolean
  ltp?: number
  oi?: number
  delta?: number
  gamma?: number
  theta?: number
  vega?: number
}
interface SpikeData { symbol: string; expiry: string; spikes: SpikeEpisode[]; snapshots_scanned: number; latest_timestamp?: string }

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
  const [spikeData, setSpikeData] = useState<SpikeData | null>(null)
  const [spikeLoading, setSpikeLoading] = useState(false)
  const [showSpikeLog, setShowSpikeLog] = useState(true)

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

  // Oct 15 2026: the live chain below highlights a strike spiking right NOW
  // (vs its own neighboring strikes). This is the complement Manish asked
  // for -- a strike that ran hot at 11:15 AM and has since gone quiet is
  // still worth knowing about for planning BTST option-writing into the
  // close, so this replays today's 5-min snapshots on the backend and
  // returns a log of those episodes even after they've faded.
  const fetchSpikes = useCallback(async () => {
    setSpikeLoading(true)
    try {
      const url = expiry
        ? `${API}/option-chain-spikes/${symbol}?expiry=${expiry}`
        : `${API}/option-chain-spikes/${symbol}`
      const res = await fetch(url)
      const json = await res.json()
      setSpikeData(json)
    } catch (e) { console.error(e) }
    setSpikeLoading(false)
  }, [symbol, expiry])

  useEffect(() => { fetchSpikes() }, [fetchSpikes])

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

  // Oct 15 2026: "can we see vol spikes in some color to know these strikes
  // have a spike in IV and chances for writers to pounce" -- a strike whose
  // IV or volume is well above its own NEIGHBORING strikes right now is the
  // signal (not vs its own earlier value -- the smile naturally slopes by
  // strike, so what matters is a strike decoupling from the strikes around
  // it). Same window/threshold as the backend's /option-chain-spikes log so
  // "spiking now" here and "spiked earlier today" below agree with each
  // other.
  const SPIKE_WINDOW = 3
  const IV_SPIKE_THRESHOLD = 1.15
  const VOL_SPIKE_THRESHOLD = 2.0
  // A ratio-only check breaks down near zero -- a far-OTM strike with
  // neighbors averaging 10 contracts reads as a "250% spike" at 25
  // contracts, which is noise. Matches the backend's /option-chain-spikes
  // floors so "spiking now" and "spiked earlier today" agree.
  const MIN_VOL_FOR_SPIKE = 5000
  const MIN_VOL_BASELINE_FOR_SPIKE = 500

  function localAvg(chain: ChainRow[], idx: number, side: 'ce' | 'pe', pick: (g: Greeks) => number | null) {
    const vals: number[] = []
    for (let off = -SPIKE_WINDOW; off <= SPIKE_WINDOW; off++) {
      if (off === 0) continue
      const r = chain[idx + off]
      if (!r) continue
      const v = pick(r[side])
      if (v != null) vals.push(v)
    }
    if (vals.length < 2) return null
    return vals.reduce((a, b) => a + b, 0) / vals.length
  }

  function ivSpike(chain: ChainRow[], idx: number, side: 'ce' | 'pe'): boolean {
    const g = chain[idx][side]
    if (!isLiquid(g) || g.iv == null) return false
    const avg = localAvg(chain, idx, side, (x) => (isLiquid(x) ? x.iv ?? null : null))
    return avg != null && avg > 0 && g.iv >= avg * IV_SPIKE_THRESHOLD
  }

  function volSpike(chain: ChainRow[], idx: number, side: 'ce' | 'pe'): boolean {
    const g = chain[idx][side]
    if (g.volume < MIN_VOL_FOR_SPIKE) return false
    const avg = localAvg(chain, idx, side, (x) => x.volume ?? null)
    return avg != null && avg >= MIN_VOL_BASELINE_FOR_SPIKE && g.volume >= avg * VOL_SPIKE_THRESHOLD
  }

  // Magnitude-based color grading for the Greeks columns, instead of one
  // flat color for the whole column regardless of whether a strike is deep
  // OTM or near-ATM.
  function deltaColor(d?: number): string {
    if (d == null) return '#60a5fa'
    const abs = Math.min(Math.abs(d), 1)
    const lightness = 78 - abs * 38 // dim (far OTM, |delta| near 0) -> vivid (near 1)
    return `hsl(217, 91%, ${lightness}%)`
  }
  function thetaColor(theta: number | undefined, maxAbsTheta: number): string {
    if (theta == null || !maxAbsTheta) return '#fb7185'
    const abs = Math.min(Math.abs(theta) / maxAbsTheta, 1)
    const lightness = 78 - abs * 33
    return `hsl(350, 85%, ${lightness}%)`
  }
  const maxAbsTheta = Math.max(
    1,
    ...((data?.chain ?? []).flatMap(r => [Math.abs(r.ce.theta ?? 0), Math.abs(r.pe.theta ?? 0)]))
  )

  function fmtIST(ts: string) {
    try { return new Date(ts).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }) }
    catch { return ts }
  }

  // Oct 15 2026: "highlight walls so we know whether writing opportunities
  // resides below or outside walls" -- the Call Wall (strike with the
  // single biggest CE OI) is where call writers have piled up the most
  // defended short premium, so it behaves like a resistance ceiling; the
  // Put Wall (biggest PE OI) behaves like a support floor the same way.
  // Spot sitting BETWEEN the two walls is the textbook "range-bound,
  // premium decays safely" zone every option writer wants; spot pushing
  // OUTSIDE either wall means that wall is being tested/broken and
  // writing against it is the riskier trade, not the safer one.
  const callWallRow = (data?.chain ?? []).reduce<ChainRow | null>(
    (best, r) => (!best || r.ce.oi > best.ce.oi ? r : best), null
  )
  const putWallRow = (data?.chain ?? []).reduce<ChainRow | null>(
    (best, r) => (!best || r.pe.oi > best.pe.oi ? r : best), null
  )
  const callWallStrike = callWallRow?.strike
  const putWallStrike = putWallRow?.strike
  const spot = data?.spot
  let wallZone: 'inside' | 'above_call_wall' | 'below_put_wall' | null = null
  if (spot != null && callWallStrike != null && putWallStrike != null) {
    if (spot > callWallStrike) wallZone = 'above_call_wall'
    else if (spot < putWallStrike) wallZone = 'below_put_wall'
    else wallZone = 'inside'
  }

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

        {/* Today's spike log -- for BTST writing planning: a strike that
            spiked at 11:15 AM and has since gone quiet still shows up here
            even though the live chain above won't highlight it anymore. */}
        <div className="bg-gray-900/20 border border-gray-800 rounded-2xl p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <button onClick={() => setShowSpikeLog(s => !s)} className="flex items-center gap-2 text-sm font-bold text-white">
              <span className={`transition-transform ${showSpikeLog ? 'rotate-90' : ''}`}>▶</span>
              🔥 Today's IV/Volume Spikes
              {spikeData && spikeData.spikes.length > 0 && (
                <span className="text-[10px] font-semibold text-orange-400 bg-orange-950/50 border border-orange-800/50 rounded-full px-2 py-0.5">{spikeData.spikes.length}</span>
              )}
            </button>
            <div className="flex items-center gap-2">
              <p className="text-[11px] text-gray-500">Strikes that spiked vs neighbors at any point today, even if they've since gone quiet — for BTST writing planning</p>
              <button onClick={fetchSpikes} disabled={spikeLoading} className="text-gray-500 hover:text-white disabled:opacity-50">
                <RefreshCw size={12} className={spikeLoading ? 'animate-spin' : ''}/>
              </button>
            </div>
          </div>
          {showSpikeLog && (
            spikeLoading && !spikeData ? (
              <div className="h-16 flex items-center justify-center text-gray-600 text-xs">Scanning today's snapshots…</div>
            ) : !spikeData || spikeData.spikes.length === 0 ? (
              <div className="h-16 flex items-center justify-center text-gray-600 text-xs">No IV or volume spikes detected yet today</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-500 border-b border-gray-800">
                      <th className="py-1.5 px-2 text-left">Strike</th>
                      <th className="py-1.5 px-2 text-left">Side</th>
                      <th className="py-1.5 px-2 text-left">Metric</th>
                      <th className="py-1.5 px-2 text-left">Window</th>
                      <th className="py-1.5 px-2 text-right">Peak</th>
                      <th className="py-1.5 px-2 text-right">vs neighbors</th>
                      <th className="py-1.5 px-2 text-right">Magnitude</th>
                      <th className="py-1.5 px-2 text-right">LTP at peak</th>
                      <th className="py-1.5 px-2 text-right">Δ</th>
                      <th className="py-1.5 px-2 text-right">Θ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {spikeData.spikes.map((s, i) => (
                      <tr key={i} className="border-b border-gray-800/40">
                        <td className="py-1.5 px-2 font-bold text-gray-200">{s.strike.toLocaleString()}</td>
                        <td className={`py-1.5 px-2 font-semibold ${s.side === 'CE' ? 'text-red-400' : 'text-emerald-400'}`}>{s.side}</td>
                        <td className="py-1.5 px-2">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${s.metric === 'IV' ? 'bg-fuchsia-500/15 text-fuchsia-300' : 'bg-cyan-500/15 text-cyan-300'}`}>
                            {s.metric === 'IV' ? '⚡ IV' : '📈 VOL'}
                          </span>
                        </td>
                        <td className="py-1.5 px-2 text-gray-400">
                          {fmtIST(s.start_time)}–{fmtIST(s.end_time)}
                          {s.ongoing && <span className="ml-1.5 text-[9px] text-emerald-400 font-bold">● LIVE</span>}
                        </td>
                        <td className="py-1.5 px-2 text-right text-gray-200">{s.metric === 'IV' ? `${s.peak_value}%` : fmtOI(s.peak_value)}</td>
                        <td className="py-1.5 px-2 text-right text-gray-500">{s.metric === 'IV' ? `${s.baseline}%` : fmtOI(s.baseline)}</td>
                        <td className="py-1.5 px-2 text-right font-bold text-orange-400">{s.magnitude_pct != null ? `+${s.magnitude_pct}%` : '—'}</td>
                        <td className="py-1.5 px-2 text-right font-semibold text-gray-100">{s.ltp != null ? `₹${s.ltp.toFixed(2)}` : '—'}</td>
                        <td className="py-1.5 px-2 text-right" style={{ color: deltaColor(s.delta) }}>{fmt(s.delta, 3)}</td>
                        <td className="py-1.5 px-2 text-right" style={{ color: thetaColor(s.theta, maxAbsTheta) }}>{fmt(s.theta)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>

        {/* OI walls: where price is relative to the biggest-OI strike on each
            side, and what that means for where writing is safe right now. */}
        {callWallStrike != null && putWallStrike != null && spot != null && (
          <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3 mb-6 text-xs ${
            wallZone === 'inside'
              ? 'bg-emerald-950/20 border-emerald-800/50'
              : 'bg-red-950/20 border-red-800/50'
          }`}>
            <span className="text-lg">🧱</span>
            <div className="flex-1">
              <span className="font-bold text-gray-100">
                Put Wall {putWallStrike.toLocaleString()} (support) · Call Wall {callWallStrike.toLocaleString()} (resistance)
              </span>
              {' — '}
              {wallZone === 'inside' && (
                <span className="text-emerald-400 font-semibold">Spot {spot.toLocaleString()} is between the walls — range-bound, the safer zone to write premium on either side.</span>
              )}
              {wallZone === 'above_call_wall' && (
                <span className="text-red-400 font-semibold">Spot {spot.toLocaleString()} is above the Call Wall — resistance is being broken. Writing calls there is the riskier side now; put writing below is comparatively safer.</span>
              )}
              {wallZone === 'below_put_wall' && (
                <span className="text-red-400 font-semibold">Spot {spot.toLocaleString()} is below the Put Wall — support is being broken. Writing puts there is the riskier side now; call writing above is comparatively safer.</span>
              )}
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
                {data.chain.map((row, idx) => {
                  const ceIvSpike = ivSpike(data.chain, idx, 'ce')
                  const peIvSpike = ivSpike(data.chain, idx, 'pe')
                  const ceVolSpike = volSpike(data.chain, idx, 'ce')
                  const peVolSpike = volSpike(data.chain, idx, 'pe')
                  const writerWatch = (ceIvSpike && ceVolSpike) || (peIvSpike && peVolSpike)
                  const isCallWall = row.strike === callWallStrike
                  const isPutWall = row.strike === putWallStrike
                  return (
                  <tr key={row.strike}
                    className={`border-b border-gray-800/50 transition-colors hover:bg-gray-800/20 ${row.is_atm ? 'bg-amber-950/20' : ''}`}>
                    {/* CE side */}
                    <td className={`py-2 px-2 text-right ${isCallWall ? 'bg-stone-500/20 text-stone-200 font-bold rounded-l' : 'text-gray-300'}`} title={isCallWall ? 'Call Wall — biggest CE OI, acts as resistance' : undefined}>
                      {fmtOI(row.ce.oi)}{isCallWall && ' 🧱'}
                    </td>
                    <td className={`py-2 px-2 text-right ${ceVolSpike ? 'bg-cyan-500/15 text-cyan-300 font-bold rounded-l' : 'text-gray-500'}`} title={ceVolSpike ? 'Volume spike vs neighboring strikes' : undefined}>
                      {fmtOI(row.ce.volume)}{ceVolSpike && ' 📈'}
                    </td>
                    <td className={`py-2 px-2 text-right ${ceIvSpike ? 'bg-fuchsia-500/15 text-fuchsia-300 font-bold rounded-r' : 'text-orange-400'}`} title={ceIvSpike ? 'IV spike vs neighboring strikes — possible premium opportunity for writers' : undefined}>
                      {row.ce.iv != null ? `${row.ce.iv}` : '—'}{ceIvSpike && ' ⚡'}
                    </td>
                    <td className="py-2 px-2 text-right font-medium" style={{ color: deltaColor(row.ce.delta) }}>{fmt(row.ce.delta, 3)}</td>
                    <td className="py-2 px-2 text-right font-medium" style={{ color: thetaColor(row.ce.theta, maxAbsTheta) }}>{fmt(row.ce.theta)}</td>
                    <td className={`py-2 px-3 text-right font-bold border-r border-gray-800 ${row.is_atm ? 'text-amber-300' : 'text-red-400'}`}>
                      {row.ce.ltp.toFixed(2)}
                    </td>
                    {/* Strike */}
                    <td className={`py-2 px-4 text-center font-black ${row.is_atm ? 'text-amber-400 text-sm' : 'text-gray-300'} ${(isCallWall || isPutWall) ? 'bg-stone-500/10' : ''}`}>
                      {row.strike.toLocaleString()}
                      {row.is_atm && <span className="ml-1 text-[9px] text-amber-600">ATM</span>}
                      {writerWatch && (
                        <span className="block text-[9px] text-orange-400 font-bold" title="IV and volume both spiking on this strike — the clearest writer signal">🔥 Writer Watch</span>
                      )}
                      {isCallWall && <span className="block text-[9px] text-stone-300 font-bold" title="Biggest CE OI on the chain — acts as resistance">🧱 Call Wall</span>}
                      {isPutWall && <span className="block text-[9px] text-stone-300 font-bold" title="Biggest PE OI on the chain — acts as support">🧱 Put Wall</span>}
                    </td>
                    {/* PE side */}
                    <td className={`py-2 px-3 text-left font-bold border-l border-gray-800 ${row.is_atm ? 'text-amber-300' : 'text-emerald-400'}`}>
                      {row.pe.ltp.toFixed(2)}
                    </td>
                    <td className="py-2 px-2 text-left font-medium" style={{ color: thetaColor(row.pe.theta, maxAbsTheta) }}>{fmt(row.pe.theta)}</td>
                    <td className="py-2 px-2 text-left font-medium" style={{ color: deltaColor(row.pe.delta) }}>{fmt(row.pe.delta, 3)}</td>
                    <td className={`py-2 px-2 text-left ${peIvSpike ? 'bg-fuchsia-500/15 text-fuchsia-300 font-bold rounded-l' : 'text-orange-400'}`} title={peIvSpike ? 'IV spike vs neighboring strikes — possible premium opportunity for writers' : undefined}>
                      {peIvSpike && '⚡ '}{row.pe.iv != null ? `${row.pe.iv}` : '—'}
                    </td>
                    <td className={`py-2 px-2 text-left ${peVolSpike ? 'bg-cyan-500/15 text-cyan-300 font-bold rounded-r' : 'text-gray-500'}`} title={peVolSpike ? 'Volume spike vs neighboring strikes' : undefined}>
                      {peVolSpike && '📈 '}{fmtOI(row.pe.volume)}
                    </td>
                    <td className={`py-2 px-2 text-left ${isPutWall ? 'bg-stone-500/20 text-stone-200 font-bold rounded-r' : 'text-gray-300'}`} title={isPutWall ? 'Put Wall — biggest PE OI, acts as support' : undefined}>
                      {isPutWall && '🧱 '}{fmtOI(row.pe.oi)}
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center gap-6 mt-4 text-xs text-gray-600 flex-wrap">
          <span><span className="text-blue-400">Δ Delta</span> — directional exposure (brighter = closer to 1, deeper ITM)</span>
          <span><span className="text-rose-400">Θ Theta</span> — daily time decay, ₹ (brighter = faster decay)</span>
          <span><span className="text-orange-400">IV%</span> — implied volatility</span>
          <span><span className="text-fuchsia-400">⚡ IV spike</span> — well above neighboring strikes right now</span>
          <span><span className="text-cyan-400">📈 Vol spike</span> — well above neighboring strikes right now</span>
          <span><span className="text-orange-400">🔥 Writer Watch</span> — IV + volume both spiking, same strike</span>
          <span><span className="text-stone-300">🧱 Call/Put Wall</span> — biggest OI on that side; spot between the walls is the safer zone to write</span>
          <span><span className="text-amber-400">ATM</span> — at-the-money strike</span>
        </div>
      </div>
    </div>
  )
}
