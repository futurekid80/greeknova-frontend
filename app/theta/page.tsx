'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Navbar from '@/components/Navbar'
import ResultBadge from '@/components/ResultBadge'

const API = 'https://api.greeknova.com'

type Row = {
  symbol: string
  cmp: number
  days_to_expiry: number
  expiry: string
  atm_strike?: number | null
  atm_straddle_premium?: number | null
  atm_theta?: number | null
  atm_theta_pct?: number | null
  atm_theta_per_lot?: number | null
  theta_total_cr?: number | null
  theta_ce_cr?: number | null
  theta_pe_cr?: number | null
  theta_peak_strike?: number | null
  lot_size?: number | null
  result_date?: string | null
  days_to_result?: number | null
  result_before_expiry?: boolean | null
}

type SortKey = 'symbol' | 'cmp' | 'days_to_expiry' | 'atm_strike' | 'atm_straddle_premium' | 'atm_theta_pct' | 'atm_theta' | 'atm_theta_per_lot' | 'theta_total_cr' | 'theta_ce_cr' | 'theta_pe_cr' | 'theta_peak_strike'
type Filter = 'ALL' | 'DTE3' | 'DTE7'

const fmt = (n: number | null | undefined, d = 2) =>
  n === null || n === undefined ? '—' : n.toLocaleString('en-IN', { maximumFractionDigits: d, minimumFractionDigits: d })
const fmt0 = (n: number | null | undefined) => fmt(n, 0)

export default function ThetaPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [asOf, setAsOf] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('ALL')
  const [sortKey, setSortKey] = useState<SortKey>('atm_theta_pct')
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

  const shown = useMemo(() => {
    const q = search.trim().toUpperCase()
    const list = rows.filter((r) => {
      if (q && !r.symbol.includes(q)) return false
      if (filter === 'DTE3' && r.days_to_expiry > 3) return false
      if (filter === 'DTE7' && r.days_to_expiry > 7) return false
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
  }, [rows, search, filter, sortKey, sortDir])

  const totalCr = rows.reduce((s, r) => s + (r.theta_total_cr || 0), 0)
  const expiryWeek = rows.filter((r) => r.days_to_expiry <= 5).length
  const topDecay = [...rows].filter((r) => r.atm_theta_pct).sort((a, b) => (b.atm_theta_pct || 0) - (a.atm_theta_pct || 0))[0]

  function sortBy(k: SortKey) {
    if (k === sortKey) setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    else { setSortKey(k); setSortDir(k === 'symbol' ? 'asc' : 'desc') }
  }
  const arrow = (k: SortKey) => (k === sortKey ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '')
  const th = 'px-3 py-3 text-right text-[11px] uppercase tracking-wide text-gray-500 font-semibold cursor-pointer select-none whitespace-nowrap hover:text-gray-300'
  const chip = (on: boolean) =>
    `px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${on ? 'bg-white text-gray-900 border-white' : 'bg-gray-900 text-gray-300 border-gray-800 hover:border-gray-600'}`

  return (
    <div className="min-h-screen bg-[#07070e] text-gray-200">
    <Navbar active="/theta" />
    <div className="px-4 sm:px-8 py-8 max-w-[1500px] mx-auto">
      <div className="flex items-start justify-between flex-wrap gap-3 mb-2">
        <div>
          <h1 className="text-2xl font-black text-white">Θ Theta Decay</h1>
          <p className="text-sm text-gray-500 mt-1">
            How fast option premium is bleeding away, per stock, per day. Nearest active expiry.
          </p>
        </div>
        <button onClick={load} className="px-4 py-2 rounded-lg border border-gray-700 text-sm text-gray-300 hover:border-gray-500">
          Refresh
        </button>
      </div>
      {asOf && <p className="text-xs text-gray-600 mb-5">As of {asOf} IST · theta from IV-implied Black-Scholes on live premiums · chain figures weighted by open interest</p>}

      {error && <div className="mb-4 bg-red-950/30 border border-red-800/40 rounded-xl px-4 py-3 text-sm text-red-400">{error}</div>}
      {loading && <p className="text-gray-500 text-sm">Loading…</p>}

      {!loading && !error && rows.length > 0 && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <div className="bg-gray-900/40 border border-gray-800 rounded-xl px-4 py-3">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Stocks covered</p>
              <p className="text-lg font-black text-white">{rows.length}</p>
            </div>
            <div className="bg-amber-950/20 border border-amber-900/40 rounded-xl px-4 py-3">
              <p className="text-[10px] text-amber-600 uppercase tracking-wide mb-1">Fastest ATM decay</p>
              <p className="text-lg font-black text-amber-400">{topDecay ? `${topDecay.symbol} · ${fmt(topDecay.atm_theta_pct)}%/day` : '—'}</p>
            </div>
            <div className="bg-gray-900/40 border border-gray-800 rounded-xl px-4 py-3">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Expiry within 5 days</p>
              <p className="text-lg font-black text-white">{expiryWeek}</p>
            </div>
            <div className="bg-gray-900/40 border border-gray-800 rounded-xl px-4 py-3">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Total decay / day (all chains)</p>
              <p className="text-lg font-black text-white">₹{fmt(totalCr, 0)} cr</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap mb-4">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search stock…"
              className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white w-44 focus:outline-none focus:border-blue-500"
            />
            <button className={chip(filter === 'ALL')} onClick={() => setFilter('ALL')}>All</button>
            <button className={chip(filter === 'DTE3')} onClick={() => setFilter(filter === 'DTE3' ? 'ALL' : 'DTE3')}>Expiry ≤ 3 days</button>
            <button className={chip(filter === 'DTE7')} onClick={() => setFilter(filter === 'DTE7' ? 'ALL' : 'DTE7')}>Expiry ≤ 7 days</button>
            <span className="ml-auto text-[11px] text-gray-600">{shown.length} of {rows.length} stocks</span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-gray-800">
            <table className="w-full text-xs">
              <thead className="bg-gray-900/60">
                <tr>
                  <th className={th + ' !text-left'} onClick={() => sortBy('symbol')}>Stock{arrow('symbol')}</th>
                  <th className={th} onClick={() => sortBy('cmp')}>CMP{arrow('cmp')}</th>
                  <th className={th} onClick={() => sortBy('days_to_expiry')}>DTE{arrow('days_to_expiry')}</th>
                  <th className={th} onClick={() => sortBy('atm_strike')}>ATM strike{arrow('atm_strike')}</th>
                  <th className={th} onClick={() => sortBy('atm_straddle_premium')}>Straddle ₹{arrow('atm_straddle_premium')}</th>
                  <th className={th} onClick={() => sortBy('atm_theta')}>Theta ₹/day{arrow('atm_theta')}</th>
                  <th className={th} onClick={() => sortBy('atm_theta_pct')}>Decay %/day{arrow('atm_theta_pct')}</th>
                  <th className={th} onClick={() => sortBy('atm_theta_per_lot')}>₹/lot/day{arrow('atm_theta_per_lot')}</th>
                  <th className={th} onClick={() => sortBy('theta_total_cr')}>Chain decay ₹cr/day{arrow('theta_total_cr')}</th>
                  <th className={th} onClick={() => sortBy('theta_ce_cr')}>Calls ₹cr{arrow('theta_ce_cr')}</th>
                  <th className={th} onClick={() => sortBy('theta_pe_cr')}>Puts ₹cr{arrow('theta_pe_cr')}</th>
                  <th className={th} onClick={() => sortBy('theta_peak_strike')}>Peak strike{arrow('theta_peak_strike')}</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.symbol} className="border-t border-gray-800/70 hover:bg-gray-900/40">
                    <td className="px-3 py-2.5 font-bold text-white text-left">{r.symbol}<ResultBadge days={r.days_to_result} beforeExpiry={r.result_before_expiry} /></td>
                    <td className="px-3 py-2.5 text-right text-gray-300">{fmt(r.cmp)}</td>
                    <td className="px-3 py-2.5 text-right text-gray-300">{r.days_to_expiry}d</td>
                    <td className="px-3 py-2.5 text-right text-gray-300">{fmt(r.atm_strike, 0)}</td>
                    <td className="px-3 py-2.5 text-right text-gray-300">{fmt(r.atm_straddle_premium)}</td>
                    <td className="px-3 py-2.5 text-right text-rose-400">{fmt(r.atm_theta)}</td>
                    <td className="px-3 py-2.5 text-right font-bold text-amber-400">{fmt(r.atm_theta_pct)}%</td>
                    <td className="px-3 py-2.5 text-right text-gray-300">{fmt0(r.atm_theta_per_lot)}</td>
                    <td className="px-3 py-2.5 text-right text-gray-200">{fmt(r.theta_total_cr)}</td>
                    <td className="px-3 py-2.5 text-right text-gray-400">{fmt(r.theta_ce_cr)}</td>
                    <td className="px-3 py-2.5 text-right text-gray-400">{fmt(r.theta_pe_cr)}</td>
                    <td className="px-3 py-2.5 text-right text-gray-300">{fmt(r.theta_peak_strike, 0)}{r.theta_peak_strike && r.cmp ? <span className="text-gray-500 text-[10px] ml-1">({(((r.theta_peak_strike - r.cmp) / r.cmp) * 100).toFixed(1)}%)</span> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <details className="mt-6 rounded-lg border border-gray-800 bg-[#0c0c16] p-4 text-xs text-gray-400 leading-relaxed">
            <summary className="cursor-pointer text-gray-300 font-semibold">How to read this page</summary>
            <ul className="mt-3 space-y-2 list-disc pl-5">
              <li><b>Straddle ₹ and Theta ₹/day:</b> the ATM call plus put price, and how much of it melts away per calendar day if nothing else moves.</li>
              <li><b>Decay %/day:</b> daily loss as a share of the straddle price. Higher means faster decay, and it climbs steeply in the last few days to expiry.</li>
              <li><b>₹/lot/day:</b> the same decay per lot, so you can compare stocks with different lot sizes.</li>
              <li><b>Chain decay, Calls and Puts:</b> total time-decay of all open contracts, weighted by open interest. It shows where the premium is, not who holds it.</li>
              <li><b>Peak strike:</b> the strike where open interest times decay is largest. It is a concentration point and is often a round-number strike, so it can sit away from the current price. The % beside it is the distance from CMP. A large distance means the decay is concentrated in a far strike, not near the money.</li>
              <li>Decay is an estimate from Black-Scholes and traded premiums. Big gap moves and IV changes can outweigh it. Educational reading only.</li>
            </ul>
          </details>

          <div className="mt-6 text-[11px] text-gray-600 leading-relaxed space-y-1">
            <p><b className="text-gray-500">Theta ₹/day</b> is the ATM straddle&apos;s value lost per share in one calendar day, all else equal. <b className="text-gray-500">Decay %/day</b> is that loss as a share of the straddle price, and it accelerates sharply as expiry nears. <b className="text-gray-500">₹/lot/day</b> multiplies by lot size.</p>
            <p><b className="text-gray-500">Chain decay</b> adds up the daily time-decay of every open contract within 35% of spot (weighted by open interest). It measures how much premium is at stake, not who holds the positions.</p>
            <p>Informational and educational only. Not SEBI registered. Not investment advice.</p>
          </div>
        </>
      )}
      {!loading && !error && rows.length === 0 && <p className="text-gray-500 text-sm">No data available yet.</p>}
    </div>
    </div>
  )
}
