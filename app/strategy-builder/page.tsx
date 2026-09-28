'use client'
import Navbar from '@/components/Navbar'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ALL_SYMBOLS, getLotSize } from '@/lib/symbols'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts'

const API = 'https://api.greeknova.com'

interface Greeks { ltp: number; iv: number | null; oi: number; volume: number }
interface ChainRow { strike: number; is_atm: boolean; ce: Greeks; pe: Greeks }
interface ChainData { symbol: string; spot: number; expiry: string; days_left: number; expiries: string[]; chain: ChainRow[] }

type Action = 'BUY' | 'SELL'
type OptType = 'CE' | 'PE'
interface Leg { id: string; action: Action; optType: OptType; strike: number; premium: number; lots: number }

let legIdCounter = 0
const newLegId = () => `leg-${++legIdCounter}-${Date.now()}`

const fmtINR = (n: number) => (n < 0 ? '-₹' : '₹') + Math.abs(Math.round(n)).toLocaleString('en-IN')
const fmtNum = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 2 })

// Templates each describe: name, one-line market view, and how to pick legs
// relative to the ATM strike index (n = how many strikes away; +n = above spot / OTM call side,
// -n = below spot / OTM put side).
type TemplateLeg = { action: Action; optType: OptType; offset: number }
interface Template { key: string; name: string; view: string; risk: 'Defined' | 'Undefined'; legs: TemplateLeg[] }

const TEMPLATES: Template[] = [
  { key: 'long_straddle', name: 'Long Straddle', view: 'Expect a big move, either direction', risk: 'Defined',
    legs: [{ action: 'BUY', optType: 'CE', offset: 0 }, { action: 'BUY', optType: 'PE', offset: 0 }] },
  { key: 'short_straddle', name: 'Short Straddle', view: 'Expect calm, price to stay near current level', risk: 'Undefined',
    legs: [{ action: 'SELL', optType: 'CE', offset: 0 }, { action: 'SELL', optType: 'PE', offset: 0 }] },
  { key: 'long_strangle', name: 'Long Strangle', view: 'Expect a big move, cheaper than a straddle', risk: 'Defined',
    legs: [{ action: 'BUY', optType: 'CE', offset: 2 }, { action: 'BUY', optType: 'PE', offset: -2 }] },
  { key: 'short_strangle', name: 'Short Strangle', view: 'Expect calm, wider comfort range than short straddle', risk: 'Undefined',
    legs: [{ action: 'SELL', optType: 'CE', offset: 2 }, { action: 'SELL', optType: 'PE', offset: -2 }] },
  { key: 'bull_call_spread', name: 'Bull Call Spread', view: 'Moderately bullish, defined risk', risk: 'Defined',
    legs: [{ action: 'BUY', optType: 'CE', offset: 0 }, { action: 'SELL', optType: 'CE', offset: 3 }] },
  { key: 'bear_put_spread', name: 'Bear Put Spread', view: 'Moderately bearish, defined risk', risk: 'Defined',
    legs: [{ action: 'BUY', optType: 'PE', offset: 0 }, { action: 'SELL', optType: 'PE', offset: -3 }] },
  { key: 'bull_put_spread', name: 'Bull Put Spread (credit)', view: 'Moderately bullish, collects premium upfront', risk: 'Defined',
    legs: [{ action: 'SELL', optType: 'PE', offset: 0 }, { action: 'BUY', optType: 'PE', offset: -3 }] },
  { key: 'bear_call_spread', name: 'Bear Call Spread (credit)', view: 'Moderately bearish, collects premium upfront', risk: 'Defined',
    legs: [{ action: 'SELL', optType: 'CE', offset: 0 }, { action: 'BUY', optType: 'CE', offset: 3 }] },
  { key: 'iron_condor', name: 'Iron Condor', view: 'Expect calm, wide range, defined risk on both sides', risk: 'Defined',
    legs: [{ action: 'SELL', optType: 'CE', offset: 2 }, { action: 'BUY', optType: 'CE', offset: 4 },
           { action: 'SELL', optType: 'PE', offset: -2 }, { action: 'BUY', optType: 'PE', offset: -4 }] },
  { key: 'iron_butterfly', name: 'Iron Butterfly', view: 'Expect price to pin near current level, defined risk', risk: 'Defined',
    legs: [{ action: 'SELL', optType: 'CE', offset: 0 }, { action: 'SELL', optType: 'PE', offset: 0 },
           { action: 'BUY', optType: 'CE', offset: 3 }, { action: 'BUY', optType: 'PE', offset: -3 }] },
]

function payoffAt(spot: number, legs: Leg[], lotSize: number): number {
  let total = 0
  for (const leg of legs) {
    const intrinsic = leg.optType === 'CE' ? Math.max(spot - leg.strike, 0) : Math.max(leg.strike - spot, 0)
    const perShare = leg.action === 'BUY' ? intrinsic - leg.premium : leg.premium - intrinsic
    total += perShare * leg.lots * lotSize
  }
  return total
}

export default function StrategyBuilder() {
  const [symbol, setSymbol] = useState('NIFTY')
  const [symbolInput, setSymbolInput] = useState('NIFTY')
  const [expiry, setExpiry] = useState('')
  const [data, setData] = useState<ChainData | null>(null)
  const [loading, setLoading] = useState(true)
  const [legs, setLegs] = useState<Leg[]>([])
  const [activeTemplate, setActiveTemplate] = useState<string | null>(null)

  const lotSize = getLotSize(symbol)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const url = expiry ? `${API}/option-chain/${symbol}?expiry=${expiry}` : `${API}/option-chain/${symbol}`
      const res = await fetch(url)
      const json = await res.json()
      setData(json)
      if (!expiry && json.expiry) setExpiry(json.expiry)
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [symbol, expiry])

  useEffect(() => { setExpiry(''); setLegs([]); setActiveTemplate(null) }, [symbol])
  useEffect(() => { fetchData() }, [symbol, expiry])

  const strikes = useMemo(() => data?.chain.map((r) => r.strike) ?? [], [data])
  const atmIndex = useMemo(() => {
    if (!data?.chain.length) return -1
    let best = 0, bestDiff = Infinity
    data.chain.forEach((r, i) => {
      const diff = Math.abs(r.strike - data.spot)
      if (diff < bestDiff) { bestDiff = diff; best = i }
    })
    return best
  }, [data])

  function strikeAt(offset: number): ChainRow | null {
    if (!data?.chain.length || atmIndex < 0) return null
    const idx = Math.max(0, Math.min(data.chain.length - 1, atmIndex + offset))
    return data.chain[idx]
  }

  function applyTemplate(t: Template) {
    if (!data?.chain.length) return
    const built: Leg[] = []
    for (const tl of t.legs) {
      const row = strikeAt(tl.offset)
      if (!row) continue
      const premium = tl.optType === 'CE' ? row.ce.ltp : row.pe.ltp
      built.push({ id: newLegId(), action: tl.action, optType: tl.optType, strike: row.strike, premium: premium || 0, lots: 1 })
    }
    setLegs(built)
    setActiveTemplate(t.key)
  }

  function addLeg() {
    const atmRow = strikeAt(0)
    setLegs((prev) => [...prev, {
      id: newLegId(), action: 'BUY', optType: 'CE',
      strike: atmRow?.strike ?? (data?.spot ?? 0),
      premium: atmRow?.ce.ltp ?? 0, lots: 1,
    }])
    setActiveTemplate(null)
  }
  function updateLeg(id: string, patch: Partial<Leg>) {
    setLegs((prev) => prev.map((l) => {
      if (l.id !== id) return l
      const merged = { ...l, ...patch }
      // if strike or optType changed, re-pull the live premium for that strike
      if ((patch.strike !== undefined || patch.optType !== undefined) && data) {
        const row = data.chain.find((r) => r.strike === merged.strike)
        if (row) merged.premium = merged.optType === 'CE' ? row.ce.ltp : row.pe.ltp
      }
      return merged
    }))
    setActiveTemplate(null)
  }
  function removeLeg(id: string) {
    setLegs((prev) => prev.filter((l) => l.id !== id))
    setActiveTemplate(null)
  }

  // ── Payoff curve, breakevens, max profit/loss, unlimited-risk detection ──
  const analysis = useMemo(() => {
    if (!legs.length || !data?.spot) return null
    const spot = data.spot
    const lo = spot * 0.85, hi = spot * 1.15
    const steps = 80
    const points: { spot: number; pnl: number }[] = []
    for (let i = 0; i <= steps; i++) {
      const s = lo + ((hi - lo) * i) / steps
      points.push({ spot: Math.round(s * 100) / 100, pnl: Math.round(payoffAt(s, legs, lotSize)) })
    }
    const pnls = points.map((p) => p.pnl)
    let maxProfit = Math.max(...pnls)
    let maxLoss = Math.min(...pnls)

    // unlimited-risk detection: compare payoff at two points further out on each side
    const farLo1 = payoffAt(spot * 0.4, legs, lotSize)
    const farLo2 = payoffAt(spot * 0.15, legs, lotSize)
    const farHi1 = payoffAt(spot * 1.6, legs, lotSize)
    const farHi2 = payoffAt(spot * 2.5, legs, lotSize)
    const stillFallingLeft = Math.abs(farLo2 - farLo1) > lotSize * 0.5
    const stillMovingRight = Math.abs(farHi2 - farHi1) > lotSize * 0.5
    const unlimitedLossLeft = stillFallingLeft && farLo2 < farLo1
    const unlimitedProfitLeft = stillFallingLeft && farLo2 > farLo1
    const unlimitedLossRight = stillMovingRight && farHi2 < farHi1
    const unlimitedProfitRight = stillMovingRight && farHi2 > farHi1
    const unlimitedProfit = unlimitedProfitLeft || unlimitedProfitRight
    const unlimitedLoss = unlimitedLossLeft || unlimitedLossRight

    // breakevens: sign changes in the sampled curve, linearly interpolated
    const breakevens: number[] = []
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i]
      if ((a.pnl <= 0 && b.pnl > 0) || (a.pnl >= 0 && b.pnl < 0)) {
        const frac = a.pnl === b.pnl ? 0 : -a.pnl / (b.pnl - a.pnl)
        breakevens.push(Math.round((a.spot + frac * (b.spot - a.spot)) * 100) / 100
        )
      }
    }
    const netPremium = legs.reduce((acc, l) => acc + (l.action === 'SELL' ? 1 : -1) * l.premium * l.lots * lotSize, 0)

    return { points, maxProfit, maxLoss, unlimitedProfit, unlimitedLoss, breakevens, netPremium }
  }, [legs, data, lotSize])

  const inputCls = 'bg-gray-900 border border-gray-800 rounded-lg px-2 py-1.5 text-xs text-gray-200'

  return (
    <div className="min-h-screen bg-[#07070e] text-gray-200">
      <Navbar active="/strategy-builder" />
      <div className="px-4 sm:px-8 py-8 max-w-[1400px] mx-auto">
        <h1 className="text-2xl font-black text-white">Strategy Builder</h1>
        <p className="text-sm text-gray-500 mt-1 mb-5">
          Pick a premade strategy or build your own from the live option chain — see the payoff before you place anything.
        </p>

        {/* Symbol + expiry */}
        <div className="flex items-end gap-3 flex-wrap mb-5">
          <label className="text-[11px] text-gray-500">Stock / Index
            <input
              list="sb-symbols" value={symbolInput}
              onChange={(e) => setSymbolInput(e.target.value.toUpperCase())}
              onBlur={() => { if (ALL_SYMBOLS.includes(symbolInput)) setSymbol(symbolInput) }}
              onKeyDown={(e) => { if (e.key === 'Enter' && ALL_SYMBOLS.includes(symbolInput)) setSymbol(symbolInput) }}
              className={inputCls + ' block mt-1 w-40'} />
            <datalist id="sb-symbols">{ALL_SYMBOLS.map((s) => <option key={s} value={s} />)}</datalist>
          </label>
          {data?.expiries && data.expiries.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-gray-500">Expiry:</span>
              {data.expiries.map((e) => (
                <button key={e} onClick={() => setExpiry(e)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${expiry === e ? 'bg-cyan-950/60 text-cyan-400 border-cyan-800/60' : 'bg-gray-900/40 text-gray-500 border-gray-800 hover:text-white'}`}>
                  {e}
                </button>
              ))}
            </div>
          )}
          {data?.spot != null && (
            <span className="text-xs text-gray-500 pb-2">Spot {fmtNum(data.spot)} · {data.days_left}d to expiry · lot size {lotSize}</span>
          )}
        </div>

        {loading ? (
          <p className="text-gray-500 text-sm">Loading…</p>
        ) : !data?.chain.length ? (
          <p className="text-gray-500 text-sm">No option chain data yet for this symbol/expiry.</p>
        ) : (
          <>
            {/* Templates */}
            <div className="mb-6">
              <p className="text-[11px] text-gray-500 mb-2 uppercase tracking-wide">Premade strategies</p>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {TEMPLATES.map((t) => (
                  <button key={t.key} onClick={() => applyTemplate(t)}
                    className={`text-left px-3 py-2.5 rounded-lg border transition ${activeTemplate === t.key ? 'bg-white text-gray-900 border-white' : 'bg-gray-900/40 text-gray-300 border-gray-800 hover:border-gray-600'}`}>
                    <div className="text-xs font-bold">{t.name}</div>
                    <div className={`text-[10px] mt-0.5 ${activeTemplate === t.key ? 'text-gray-600' : 'text-gray-500'}`}>{t.view}</div>
                    <div className={`text-[9px] mt-1 font-semibold ${t.risk === 'Defined' ? (activeTemplate === t.key ? 'text-emerald-700' : 'text-emerald-400') : (activeTemplate === t.key ? 'text-amber-700' : 'text-amber-400')}`}>{t.risk} risk</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Legs editor */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] text-gray-500 uppercase tracking-wide">Legs</p>
                <button onClick={addLeg} className="text-xs px-3 py-1.5 rounded-lg border border-gray-700 text-gray-300 hover:border-gray-500">+ Add leg</button>
              </div>
              {legs.length === 0 ? (
                <p className="text-xs text-gray-600">Pick a premade strategy above, or add a leg to build your own.</p>
              ) : (
                <div className="rounded-xl border border-gray-800 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-900/60 text-gray-500">
                      <tr>
                        <th className="px-3 py-2 text-left">Action</th>
                        <th className="px-3 py-2 text-left">Type</th>
                        <th className="px-3 py-2 text-left">Strike</th>
                        <th className="px-3 py-2 text-right">Premium</th>
                        <th className="px-3 py-2 text-right">Lots</th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {legs.map((leg) => (
                        <tr key={leg.id} className="border-t border-gray-800/70">
                          <td className="px-3 py-2">
                            <select value={leg.action} onChange={(e) => updateLeg(leg.id, { action: e.target.value as Action })}
                              className={inputCls}>
                              <option value="BUY">BUY</option>
                              <option value="SELL">SELL</option>
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <select value={leg.optType} onChange={(e) => updateLeg(leg.id, { optType: e.target.value as OptType })}
                              className={inputCls}>
                              <option value="CE">CE</option>
                              <option value="PE">PE</option>
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <select value={leg.strike} onChange={(e) => updateLeg(leg.id, { strike: Number(e.target.value) })}
                              className={inputCls}>
                              {strikes.map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <input type="number" step="0.05" value={leg.premium}
                              onChange={(e) => updateLeg(leg.id, { premium: Number(e.target.value) || 0 })}
                              className={inputCls + ' w-20 text-right'} />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <input type="number" min={1} step="1" value={leg.lots}
                              onChange={(e) => updateLeg(leg.id, { lots: Math.max(1, Number(e.target.value) || 1) })}
                              className={inputCls + ' w-16 text-right'} />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button onClick={() => removeLeg(leg.id)} className="text-gray-500 hover:text-red-400 text-xs">✕</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Payoff + summary */}
            {analysis && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
                <div className="lg:col-span-2 rounded-xl border border-gray-800 bg-gray-900/20 p-4 h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={analysis.points} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                      <XAxis dataKey="spot" tick={{ fontSize: 10, fill: '#6b7280' }} tickFormatter={(v) => fmtNum(v)} />
                      <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} tickFormatter={(v) => fmtNum(v)} />
                      <Tooltip
                        contentStyle={{ background: '#0c0c16', border: '1px solid #1f2937', fontSize: 11 }}
                        formatter={(v: any) => [fmtINR(Number(v)), 'P&L at expiry']}
                        labelFormatter={(l) => `Spot ${fmtNum(Number(l))}`} />
                      <ReferenceLine y={0} stroke="#4b5563" />
                      <ReferenceLine x={data.spot} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: 'Spot', position: 'insideTopRight', fill: '#f59e0b', fontSize: 10 }} />
                      <Line type="monotone" dataKey="pnl" stroke="#22d3ee" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-3">
                  <div className="rounded-xl border border-gray-800 bg-gray-900/20 p-4">
                    <p className="text-[11px] text-gray-500 mb-1">Net premium</p>
                    <p className={`text-lg font-black ${analysis.netPremium >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {analysis.netPremium >= 0 ? 'Credit ' : 'Debit '}{fmtINR(Math.abs(analysis.netPremium))}
                    </p>
                  </div>
                  <div className="rounded-xl border border-gray-800 bg-gray-900/20 p-4">
                    <p className="text-[11px] text-gray-500 mb-1">Max profit</p>
                    <p className="text-lg font-black text-emerald-400">{analysis.unlimitedProfit ? 'Unlimited' : fmtINR(analysis.maxProfit)}</p>
                  </div>
                  <div className="rounded-xl border border-gray-800 bg-gray-900/20 p-4">
                    <p className="text-[11px] text-gray-500 mb-1">Max loss</p>
                    <p className="text-lg font-black text-red-400">{analysis.unlimitedLoss ? 'Unlimited' : fmtINR(analysis.maxLoss)}</p>
                  </div>
                  <div className="rounded-xl border border-gray-800 bg-gray-900/20 p-4">
                    <p className="text-[11px] text-gray-500 mb-1">Breakeven{analysis.breakevens.length > 1 ? 's' : ''}</p>
                    <p className="text-sm font-bold text-white">
                      {analysis.breakevens.length ? analysis.breakevens.map((b) => fmtNum(b)).join(' · ') : '—'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <details className="rounded-lg border border-gray-800 bg-[#0c0c16] p-4 text-xs text-gray-400 leading-relaxed">
              <summary className="cursor-pointer text-gray-300 font-semibold">How to read this</summary>
              <ul className="mt-3 space-y-2 list-disc pl-5">
                <li>The chart shows profit/loss <b>at expiry</b> across a range of possible closing prices — it does not show what the position is worth today, before expiry.</li>
                <li><b>Net premium</b>: Credit means you receive money upfront (you're a net seller); Debit means you pay upfront (you're a net buyer).</li>
                <li><b>Undefined risk</b> strategies (short straddle/strangle) have no built-in cap on loss if price moves far enough — position sizing and a stop plan matter more here than on defined-risk trades.</li>
                <li>Premiums shown are pulled live from the option chain when you pick a strike; editing them lets you test "what if I get a better/worse fill."</li>
                <li>This is a calculator, not a recommendation — it shows the mechanics of a structure you choose. Always account for margin requirements, liquidity at each strike, and your own risk tolerance separately.</li>
              </ul>
            </details>

            <p className="mt-4 text-[11px] text-gray-600">Informational and educational only. Not SEBI registered. Not investment advice.</p>
          </>
        )}
      </div>
    </div>
  )
}
