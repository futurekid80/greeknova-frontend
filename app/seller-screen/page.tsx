'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Navbar from '@/components/Navbar'

const API = 'https://api.greeknova.com'

type Row = {
  symbol: string
  cmp: number
  days_to_expiry: number
  regime?: 'LONG_GAMMA' | 'SHORT_GAMMA' | null
  pct_to_flip?: number | null
  atm_iv?: number | null
  realized_vol?: number | null
  iv_rv_ratio?: number | null
  iv_regime?: 'RICH' | 'FAIR' | 'CHEAP' | null
  atm_theta_pct?: number | null
  atm_theta_per_lot?: number | null
  atm_vega_per_lot?: number | null
  iv_crush_watch?: boolean | null
  theta_peak_strike?: number | null
}

type Scored = Row & { score: number; vScore: number; tScore: number; gScore: number }
type SortKey = 'symbol' | 'score' | 'days_to_expiry' | 'iv_rv_ratio' | 'atm_theta_pct' | 'atm_theta_per_lot' | 'atm_vega_per_lot' | 'pct_to_flip'

const fmt = (n: number | null | undefined, d = 2) =>
  n === null || n === undefined ? '—' : n.toLocaleString('en-IN', { maximumFractionDigits: d, minimumFractionDigits: d })
const clamp = (x: number) => Math.max(0, Math.min(1, x))

function scoreRow(r: Row): Scored {
  // Vega: IV richer than realized vol scores higher (ratio 0.9 -> 0, 1.8 -> 1)
  const vScore = r.iv_rv_ratio ? clamp((r.iv_rv_ratio - 0.9) / 0.9) : 0
  // Theta: faster ATM decay scores higher (0.5%/day -> 0, 6%/day -> 1)
  const tScore = r.atm_theta_pct ? clamp((r.atm_theta_pct - 0.5) / 5.5) : 0
  // Gamma: long gamma is calmer; short gamma scores low; a flip level close to spot reduces it
  let gScore = r.regime === 'LONG_GAMMA' ? 1 : 0
  if (gScore && r.pct_to_flip !== null && r.pct_to_flip !== undefined && Math.abs(r.pct_to_flip) < 1.5) gScore = 0.5
  const score = Math.round(vScore * 35 + tScore * 35 + gScore * 30)
  return { ...r, score, vScore, tScore, gScore }
}

export default function SellerScreenPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [asOf, setAsOf] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [minIvRv, setMinIvRv] = useState(1.0)
  const [minDecay, setMinDecay] = useState(0)
  const [maxDte, setMaxDte] = useState(30)
  const [gammaPref, setGammaPref] = useState<'ANY' | 'LONG' | 'SHORT'>('ANY')
  const [sortKey, setSortKey] = useState<SortKey>('score')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API}/gamma-squeeze?t=${Date.now()}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`Server returned ${res.status}`)
      const j = await res.json()
      setRows(j.watchlist || [])
      setAsOf(j.as_of ? `${j.date ? j.date + ' ' : ''}${j.as_of}` : '')
    } catch (e: any) {
      setError(e?.message || 'Failed to load data')
    }
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const scored = useMemo(() => rows.map(scoreRow), [rows])

  const shown = useMemo(() => {
    const q = search.trim().toUpperCase()
    const list = scored.filter((r) => {
      if (q && !r.symbol.includes(q)) return false
      if ((r.iv_rv_ratio ?? 0) < minIvRv) return false
      if ((r.atm_theta_pct ?? 0) < minDecay) return false
      if (r.days_to_expiry > maxDte) return false
      if (gammaPref === 'LONG' && r.regime !== 'LONG_GAMMA') return false
      if (gammaPref === 'SHORT' && r.regime !== 'SHORT_GAMMA') return false
      return true
    })
    const dir = sortDir === 'asc' ? 1 : -1
    return [...list].sort((a, b) => {
      if (sortKey === 'symbol') return a.symbol.localeCompare(b.symbol) * dir
      const av = (a as any)[sortKey]
      const bv = (b as any)[sortKey]
      if (av === null || av === undefined) return 1
      if (bv === null || bv === undefined) return -1
      return (av - bv) * dir
    })
  }, [scored, search, minIvRv, minDecay, maxDte, gammaPref, sortKey, sortDir])

  function sortBy(k: SortKey) {
    if (k === sortKey) setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    else { setSortKey(k); setSortDir(k === 'symbol' ? 'asc' : 'desc') }
  }
  const arrow = (k: SortKey) => (k === sortKey ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '')
  const th = 'px-3 py-3 text-right text-[11px] uppercase tracking-wide text-gray-500 font-semibold cursor-pointer select-none whitespace-nowrap hover:text-gray-300'
  const chip = (on: boolean) =>
    `px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${on ? 'bg-white text-gray-900 border-white' : 'bg-gray-900 text-gray-300 border-gray-800 hover:border-gray-600'}`
  const inp = 'bg-gray-900 border border-gray-800 rounded-lg px-2 py-1.5 text-xs text-gray-200 w-20'
  const dot = (v: number) => (v >= 0.66 ? 'text-emerald-400' : v >= 0.33 ? 'text-amber-400' : 'text-gray-600')

  return (
    <div className="min-h-screen bg-[#07070e] text-gray-200">
    <Navbar active="/seller-screen" />
    <div className="px-4 sm:px-8 py-8 max-w-[1500px] mx-auto">
      <div className="flex items-start justify-between flex-wrap gap-3 mb-2">
        <div>
          <h1 className="text-2xl font-black text-white">Premium Conditions Screen</h1>
          <p className="text-sm text-gray-500 mt-1">
            Gamma, Theta and Vega combined into one ranked view of where option premium looks rich, decaying and calm. Nearest active expiry.
          </p>
        </div>
        <button onClick={load} className="px-4 py-2 rounded-lg border border-gray-700 text-sm text-gray-300 hover:border-gray-500">Refresh</button>
      </div>
      {asOf && <p className="text-xs text-gray-600 mb-5">As of {asOf} IST · scores are a data ranking, not a recommendation</p>}

      {error && <div className="mb-4 bg-red-950/30 border border-red-800/40 rounded-xl px-4 py-3 text-sm text-red-400">{error}</div>}
      {loading && <p className="text-gray-500 text-sm">Loading…</p>}

      {!loading && !error && rows.length > 0 && (
        <>
          <div className="flex items-end gap-4 flex-wrap mb-4">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search stock"
              className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-1.5 text-sm text-gray-200 w-40" />
            <label className="text-[11px] text-gray-500">Min IV/RV
              <input type="number" step="0.1" value={minIvRv} onChange={(e) => setMinIvRv(Number(e.target.value) || 0)} className={inp + ' block mt-1'} /></label>
            <label className="text-[11px] text-gray-500">Min decay %/day
              <input type="number" step="0.5" value={minDecay} onChange={(e) => setMinDecay(Number(e.target.value) || 0)} className={inp + ' block mt-1'} /></label>
            <label className="text-[11px] text-gray-500">Max days to expiry
              <input type="number" step="1" value={maxDte} onChange={(e) => setMaxDte(Number(e.target.value) || 0)} className={inp + ' block mt-1'} /></label>
            <div className="flex gap-2">
              <button className={chip(gammaPref === 'ANY')} onClick={() => setGammaPref('ANY')}>Any gamma</button>
              <button className={chip(gammaPref === 'LONG')} onClick={() => setGammaPref('LONG')}>Long gamma only</button>
              <button className={chip(gammaPref === 'SHORT')} onClick={() => setGammaPref('SHORT')}>Short gamma only</button>
            </div>
            <span className="text-xs text-gray-500 pb-2">{shown.length} of {rows.length} stocks</span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-gray-800">
            <table className="w-full text-sm">
              <thead className="bg-gray-900/60">
                <tr>
                  <th className={th + ' !text-left'} onClick={() => sortBy('symbol')}>Stock{arrow('symbol')}</th>
                  <th className={th} onClick={() => sortBy('score')}>Score{arrow('score')}</th>
                  <th className={th} onClick={() => sortBy('days_to_expiry')}>DTE{arrow('days_to_expiry')}</th>
                  <th className={th} onClick={() => sortBy('iv_rv_ratio')}>IV/RV (Vega){arrow('iv_rv_ratio')}</th>
                  <th className={th} onClick={() => sortBy('atm_theta_pct')}>Decay %/day (Theta){arrow('atm_theta_pct')}</th>
                  <th className={th} onClick={() => sortBy('atm_theta_per_lot')}>₹/lot/day{arrow('atm_theta_per_lot')}</th>
                  <th className={th} onClick={() => sortBy('atm_vega_per_lot')}>₹/lot per IV pt{arrow('atm_vega_per_lot')}</th>
                  <th className={th}>Gamma</th>
                  <th className={th} onClick={() => sortBy('pct_to_flip')}>To flip %{arrow('pct_to_flip')}</th>
                  <th className={th + ' !text-left'}>Flags</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.symbol} className="border-t border-gray-800/70 hover:bg-gray-900/40">
                    <td className="px-3 py-2.5 font-bold text-white">{r.symbol}<span className="text-gray-600 text-[10px] ml-2">{fmt(r.cmp)}</span></td>
                    <td className="px-3 py-2.5 text-right font-black text-white">{r.score}</td>
                    <td className="px-3 py-2.5 text-right text-gray-400">{r.days_to_expiry}</td>
                    <td className="px-3 py-2.5 text-right"><span className={dot(r.vScore)}>● </span>{fmt(r.iv_rv_ratio)}</td>
                    <td className="px-3 py-2.5 text-right"><span className={dot(r.tScore)}>● </span>{fmt(r.atm_theta_pct)}</td>
                    <td className="px-3 py-2.5 text-right text-gray-300">{fmt(r.atm_theta_per_lot, 0)}</td>
                    <td className="px-3 py-2.5 text-right text-gray-300">{fmt(r.atm_vega_per_lot, 0)}</td>
                    <td className="px-3 py-2.5 text-right"><span className={dot(r.gScore)}>● </span>{r.regime === 'LONG_GAMMA' ? 'Long' : r.regime === 'SHORT_GAMMA' ? 'Short' : '—'}</td>
                    <td className="px-3 py-2.5 text-right text-gray-400">{fmt(r.pct_to_flip)}</td>
                    <td className="px-3 py-2.5 text-left text-[11px] text-amber-400">
                      {r.iv_crush_watch ? 'IV crush watch ' : ''}{r.regime === 'SHORT_GAMMA' ? 'Short gamma: moves can amplify ' : ''}{r.pct_to_flip !== null && r.pct_to_flip !== undefined && Math.abs(r.pct_to_flip) < 1.5 ? 'Near gamma flip' : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <details className="mt-6 rounded-lg border border-gray-800 bg-[#0c0c16] p-4 text-xs text-gray-400 leading-relaxed">
            <summary className="cursor-pointer text-gray-300 font-semibold">How the score works</summary>
            <ul className="mt-3 space-y-2 list-disc pl-5">
              <li><b>Vega (35 points):</b> how expensive options are versus what the stock actually moved. IV/RV of 0.9 scores zero and 1.8 or more scores full.</li>
              <li><b>Theta (35 points):</b> how fast the ATM straddle decays each day. 0.5%/day scores zero and 6%/day or more scores full.</li>
              <li><b>Gamma (30 points):</b> long gamma (dealer hedging tends to dampen moves) scores full, halved when the gamma flip level is within 1.5% of price. Short gamma scores zero.</li>
              <li>Green dot means strong, amber means middling, grey means weak for that Greek.</li>
              <li>A high score means conditions that premium sellers typically look for are present. It says nothing about direction, event risk, margin or your position size. Always check results, news and open interest levels separately.</li>
              <li>Selling options carries unlimited-loss risk on the naked side. Use the sliders to build your own filter.</li>
            </ul>
          </details>

          <details className="mt-4 rounded-lg border border-gray-800 bg-[#0c0c16] p-4 text-xs text-gray-400 leading-relaxed">
            <summary className="cursor-pointer text-gray-300 font-semibold">Worked example: how to read one row</summary>
            <div className="mt-3 space-y-2">
              <p>Say a row shows <b>score 85, DTE 4, IV/RV 1.80, decay 12%/day, Gamma Long (amber), To flip -1.2%</b>, flags: IV crush watch, Near gamma flip.</p>
              <p><b>IV/RV 1.80:</b> options price in about 1.8 times the movement the stock actually delivered, so premium is rich.</p>
              <p><b>Decay 12%/day:</b> the ATM straddle loses about 12% of its value each day. High because expiry is near.</p>
              <p><b>Long gamma, amber dot:</b> dealer hedging tends to calm moves, but the flip level is only about 1.2% away. Crossing it can turn calm into amplified moves.</p>
              <p><b>Flags:</b> IV is rich with expiry close, so IV may fall after events. The flip is near, so a sharp move is possible.</p>
              <p><b>Takeaway:</b> conditions are present, but check the option chain, OI walls, news and results dates, and your own risk before any decision. Short gamma rows are the opposite case: moves can amplify, so read them with more caution.</p>
              <p>Near expiry every stock shows high decay, so IV/RV and gamma do most of the ranking that week.</p>
            </div>
          </details>

          <p className="mt-4 text-[11px] text-gray-600">Informational and educational only. Not SEBI registered. Not investment advice.</p>
        </>
      )}
      {!loading && !error && rows.length === 0 && <p className="text-gray-500 text-sm">No data available yet.</p>}
    </div>
    </div>
  )
}
