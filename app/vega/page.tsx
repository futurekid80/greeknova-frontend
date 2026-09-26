'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Navbar from '@/components/Navbar'
import ResultBadge from '@/components/ResultBadge'

const API = 'https://api.greeknova.com'

type Row = {
  symbol: string
  cmp: number
  days_to_expiry: number
  atm_iv?: number | null
  realized_vol?: number | null
  iv_rv_ratio?: number | null
  iv_regime?: 'RICH' | 'FAIR' | 'CHEAP' | null
  atm_vega?: number | null
  atm_vega_per_lot?: number | null
  vega_total_cr?: number | null
  vega_ce_cr?: number | null
  vega_pe_cr?: number | null
  vega_peak_strike?: number | null
  result_date?: string | null
  days_to_result?: number | null
  result_before_expiry?: boolean | null
  vega_pe_ce_ratio?: number | null
  iv_crush_watch?: boolean
}

type SortKey = 'symbol' | 'cmp' | 'days_to_expiry' | 'atm_iv' | 'realized_vol' | 'iv_rv_ratio' | 'atm_vega_per_lot' | 'vega_total_cr' | 'vega_ce_cr' | 'vega_pe_cr' | 'vega_peak_strike'
type Filter = 'ALL' | 'RICH' | 'CHEAP' | 'CRUSH'

const fmt = (n: number | null | undefined, d = 2) =>
  n === null || n === undefined ? '—' : n.toLocaleString('en-IN', { maximumFractionDigits: d, minimumFractionDigits: d })

export default function VegaPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [asOf, setAsOf] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('ALL')
  const [sortKey, setSortKey] = useState<SortKey>('vega_total_cr')
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
      if (filter === 'RICH' && r.iv_regime !== 'RICH') return false
      if (filter === 'CHEAP' && r.iv_regime !== 'CHEAP') return false
      if (filter === 'CRUSH' && !r.iv_crush_watch) return false
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

  const rich = rows.filter((r) => r.iv_regime === 'RICH').length
  const cheap = rows.filter((r) => r.iv_regime === 'CHEAP').length
  const crush = rows.filter((r) => r.iv_crush_watch).length
  const totalCr = rows.reduce((s, r) => s + (r.vega_total_cr || 0), 0)

  function sortBy(k: SortKey) {
    if (k === sortKey) setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    else { setSortKey(k); setSortDir(k === 'symbol' ? 'asc' : 'desc') }
  }
  const arrow = (k: SortKey) => (k === sortKey ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '')
  const th = 'px-3 py-3 text-right text-[11px] uppercase tracking-wide text-gray-500 font-semibold cursor-pointer select-none whitespace-nowrap hover:text-gray-300'
  const chip = (on: boolean) =>
    `px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${on ? 'bg-white text-gray-900 border-white' : 'bg-gray-900 text-gray-300 border-gray-800 hover:border-gray-600'}`

  const badge = (r: Row) => {
    if (r.iv_regime === 'RICH') return <span className="px-2 py-0.5 rounded bg-red-950/60 text-red-400 border border-red-900/50">IV rich</span>
    if (r.iv_regime === 'CHEAP') return <span className="px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-900/50">IV cheap</span>
    if (r.iv_regime === 'FAIR') return <span className="px-2 py-0.5 rounded bg-gray-800 text-gray-300 border border-gray-700">Fair</span>
    return <span className="text-gray-600">—</span>
  }

  return (
    <div className="min-h-screen bg-[#07070e] text-gray-200">
    <Navbar active="/vega" />
    <div className="px-4 sm:px-8 py-8 max-w-[1500px] mx-auto">
      <div className="flex items-start justify-between flex-wrap gap-3 mb-2">
        <div>
          <h1 className="text-2xl font-black text-white">ν Vega Exposure</h1>
          <p className="text-sm text-gray-500 mt-1">
            How much option premium moves when implied volatility moves, per stock. Nearest active expiry.
          </p>
        </div>
        <button onClick={load} className="px-4 py-2 rounded-lg border border-gray-700 text-sm text-gray-300 hover:border-gray-500">
          Refresh
        </button>
      </div>
      {asOf && <p className="text-xs text-gray-600 mb-5">As of {asOf} IST · vega from IV-implied Black-Scholes on live premiums · chain figures weighted by open interest</p>}

      {error && <div className="mb-4 bg-red-950/30 border border-red-800/40 rounded-xl px-4 py-3 text-sm text-red-400">{error}</div>}
      {loading && <p className="text-gray-500 text-sm">Loading…</p>}

      {!loading && !error && rows.length > 0 && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <button onClick={() => setFilter(filter === 'CRUSH' ? 'ALL' : 'CRUSH')} className={`text-left bg-orange-950/20 border rounded-xl px-4 py-3 ${filter === 'CRUSH' ? 'border-orange-400' : 'border-orange-900/40'}`}>
              <p className="text-[10px] text-orange-500 uppercase tracking-wide mb-1">IV crush watch</p>
              <p className="text-lg font-black text-orange-400">{crush}</p>
            </button>
            <button onClick={() => setFilter(filter === 'RICH' ? 'ALL' : 'RICH')} className={`text-left bg-red-950/20 border rounded-xl px-4 py-3 ${filter === 'RICH' ? 'border-red-400' : 'border-red-900/40'}`}>
              <p className="text-[10px] text-red-500 uppercase tracking-wide mb-1">IV rich vs realized</p>
              <p className="text-lg font-black text-red-400">{rich}</p>
            </button>
            <button onClick={() => setFilter(filter === 'CHEAP' ? 'ALL' : 'CHEAP')} className={`text-left bg-emerald-950/20 border rounded-xl px-4 py-3 ${filter === 'CHEAP' ? 'border-emerald-400' : 'border-emerald-900/40'}`}>
              <p className="text-[10px] text-emerald-500 uppercase tracking-wide mb-1">IV cheap vs realized</p>
              <p className="text-lg font-black text-emerald-400">{cheap}</p>
            </button>
            <div className="bg-gray-900/40 border border-gray-800 rounded-xl px-4 py-3">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Total vega (₹ cr per IV pt)</p>
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
            <button className={chip(filter === 'CRUSH')} onClick={() => setFilter(filter === 'CRUSH' ? 'ALL' : 'CRUSH')}>IV crush watch</button>
            <button className={chip(filter === 'RICH')} onClick={() => setFilter(filter === 'RICH' ? 'ALL' : 'RICH')}>IV rich</button>
            <button className={chip(filter === 'CHEAP')} onClick={() => setFilter(filter === 'CHEAP' ? 'ALL' : 'CHEAP')}>IV cheap</button>
            <span className="ml-auto text-[11px] text-gray-600">{shown.length} of {rows.length} stocks</span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-gray-800">
            <table className="w-full text-xs">
              <thead className="bg-gray-900/60">
                <tr>
                  <th className={th + ' !text-left'} onClick={() => sortBy('symbol')}>Stock{arrow('symbol')}</th>
                  <th className={th} onClick={() => sortBy('cmp')}>CMP{arrow('cmp')}</th>
                  <th className={th} onClick={() => sortBy('days_to_expiry')}>DTE{arrow('days_to_expiry')}</th>
                  <th className={th} onClick={() => sortBy('atm_iv')}>ATM IV{arrow('atm_iv')}</th>
                  <th className={th} onClick={() => sortBy('realized_vol')}>Realized vol{arrow('realized_vol')}</th>
                  <th className={th} onClick={() => sortBy('iv_rv_ratio')}>IV / RV{arrow('iv_rv_ratio')}</th>
                  <th className={th + ' !text-center'} onClick={() => sortBy('iv_rv_ratio')}>IV state</th>
                  <th className={th} onClick={() => sortBy('atm_vega_per_lot')}>₹/lot per IV pt{arrow('atm_vega_per_lot')}</th>
                  <th className={th} onClick={() => sortBy('vega_total_cr')}>Chain vega ₹cr/pt{arrow('vega_total_cr')}</th>
                  <th className={th} onClick={() => sortBy('vega_ce_cr')}>Calls ₹cr{arrow('vega_ce_cr')}</th>
                  <th className={th} onClick={() => sortBy('vega_pe_cr')}>Puts ₹cr{arrow('vega_pe_cr')}</th>
                  <th className={th} onClick={() => sortBy('vega_peak_strike')}>Peak strike{arrow('vega_peak_strike')}</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.symbol} className="border-t border-gray-800/70 hover:bg-gray-900/40">
                    <td className="px-3 py-2.5 font-bold text-white text-left">
                      {r.symbol} {r.iv_crush_watch && <span title="Rich IV and expiry within 10 days" className="ml-1">⚠️</span>}<ResultBadge days={r.days_to_result} beforeExpiry={r.result_before_expiry} />
                    </td>
                    <td className="px-3 py-2.5 text-right text-gray-300">{fmt(r.cmp)}</td>
                    <td className="px-3 py-2.5 text-right text-gray-300">{r.days_to_expiry}d</td>
                    <td className="px-3 py-2.5 text-right text-amber-400 font-bold">{fmt(r.atm_iv, 1)}%</td>
                    <td className="px-3 py-2.5 text-right text-gray-300">{fmt(r.realized_vol, 1)}%</td>
                    <td className="px-3 py-2.5 text-right text-gray-300">{fmt(r.iv_rv_ratio)}×</td>
                    <td className="px-3 py-2.5 text-center">{badge(r)}</td>
                    <td className="px-3 py-2.5 text-right text-gray-200">{fmt(r.atm_vega_per_lot, 0)}</td>
                    <td className="px-3 py-2.5 text-right text-gray-200">{fmt(r.vega_total_cr)}</td>
                    <td className="px-3 py-2.5 text-right text-gray-400">{fmt(r.vega_ce_cr)}</td>
                    <td className="px-3 py-2.5 text-right text-gray-400">{fmt(r.vega_pe_cr)}</td>
                    <td className="px-3 py-2.5 text-right text-gray-300">{fmt(r.vega_peak_strike, 0)}{r.vega_peak_strike && r.cmp ? <span className="text-gray-500 text-[10px] ml-1">({(((r.vega_peak_strike - r.cmp) / r.cmp) * 100).toFixed(1)}%)</span> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <details className="mt-6 rounded-lg border border-gray-800 bg-[#0c0c16] p-4 text-xs text-gray-400 leading-relaxed">
            <summary className="cursor-pointer text-gray-300 font-semibold">How to read this page</summary>
            <ul className="mt-3 space-y-2 list-disc pl-5">
              <li><b>ATM IV and Realized vol:</b> what options price in versus what the stock actually moved. IV/RV above about 1.6 is labelled Rich, below 0.9 Cheap.</li>
              <li><b>₹/lot per IV pt:</b> how much one lot's ATM straddle changes if IV moves by one point. Larger means more sensitive to IV.</li>
              <li><b>Chain vega:</b> total IV sensitivity of all open contracts, weighted by open interest. Calls and Puts show which side carries more of it.</li>
              <li><b>IV crush watch (warning sign):</b> IV is rich and expiry is within 10 days. Rich IV tends to fall as events pass, which hurts premium buyers and helps sellers, but it is not a guarantee.</li>
              <li><b>Peak strike:</b> the strike where open interest times vega is largest. It marks where positions are concentrated, often a round-number strike, so it can sit away from the current price. The % beside it is the distance from CMP.</li>
              <li>Estimates only. Educational reading, not investment advice.</li>
            </ul>
          </details>

          <div className="mt-6 text-[11px] text-gray-600 leading-relaxed space-y-1">
            <p><b className="text-gray-500">₹/lot per IV pt</b> is how much the ATM straddle&apos;s value changes for one lot if implied volatility moves by one point. <b className="text-gray-500">IV rich / cheap</b> compares ATM IV with the stock&apos;s recent realized volatility. <b className="text-gray-500">⚠️ IV crush watch</b> marks rich IV with expiry inside 10 days, where premium can drop quickly once the event passes.</p>
            <p><b className="text-gray-500">Chain vega</b> adds up vega across every open contract within 35% of spot (weighted by open interest). It shows where volatility sensitivity is concentrated, not who holds the positions.</p>
            <p>Informational and educational only. Not SEBI registered. Not investment advice.</p>
          </div>
        </>
      )}
      {!loading && !error && rows.length === 0 && <p className="text-gray-500 text-sm">No data available yet.</p>}
    </div>
    </div>
  )
}
