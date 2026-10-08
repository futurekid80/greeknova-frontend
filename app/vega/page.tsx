'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Navbar from '@/components/Navbar'
import ResultBadge from '@/components/ResultBadge'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
  ResponsiveContainer, Legend,
} from 'recharts'

const API = 'https://api.greeknova.com'

type Row = {
  symbol: string
  cmp: number
  days_to_expiry: number
  atm_iv?: number | null
  realized_vol?: number | null
  iv_rv_ratio?: number | null
  iv_month?: number | null
  term_ratio?: number | null
  term_state?: 'FRONT_SPIKE' | 'FRONT_CHEAP' | 'NORMAL' | null
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

type SortKey = 'symbol' | 'cmp' | 'days_to_expiry' | 'atm_iv' | 'realized_vol' | 'iv_rv_ratio' | 'iv_month' | 'term_ratio' | 'atm_vega_per_lot' | 'vega_total_cr' | 'vega_ce_cr' | 'vega_pe_cr' | 'vega_peak_strike'
type Filter = 'ALL' | 'RICH' | 'CHEAP' | 'CRUSH'

type VrpCandidate = {
  strike: number
  option_type: 'CE' | 'PE'
  premium: number
  pct_from_spot: number
  oi: number
  iv: number
  vrp: number | null
  iv_change_60m: number | null
  pop: number | null
  roi_pct: number | null
  annualized_roi_pct: number | null
  score: number
  is_best_pick: boolean
  iv_percentile: number | null
  iv_percentile_sessions: number
}
type VrpScan = {
  symbol: string
  expiry: string
  available_expiries: string[]
  days_to_expiry: number
  spot: number
  futures: number
  realized_vol: number | null
  lookback_minutes: number
  zone_pct: number
  weekend_theta_note: string | null
  call_wall: number | null
  call_wall_status: 'HOLDING' | 'ERODING' | null
  put_wall: number | null
  put_wall_status: 'HOLDING' | 'ERODING' | null
  margin_estimate_note: string | null
  as_of: string
  ce_candidates: VrpCandidate[]
  pe_candidates: VrpCandidate[]
  error?: string
}

type SmilePoint = {
  strike: number
  option_type: 'CE' | 'PE'
  pct_from_spot: number
  iv: number
}
type TermPoint = {
  expiry: string
  days_to_expiry: number
  atm_iv: number | null
}
type VolSurface = {
  symbol: string
  expiry: string
  spot: number
  zone_pct: number
  smile: SmilePoint[]
  term_structure: TermPoint[]
  error?: string
}

type GapScan = {
  symbol: string
  as_of: string
  expiry: string
  spot: number
  prev_close: number | null
  today_open: number | null
  gap_pct: number | null
  gap_direction: 'UP' | 'DOWN' | 'FLAT'
  gap_threshold_pct: number
  iv_pctile_threshold: number
  spike_detected: boolean
  candidates: VrpCandidate[]
  note: string
  error?: string
}

const fmt = (n: number | null | undefined, d = 2) =>
  n === null || n === undefined ? '—' : n.toLocaleString('en-IN', { maximumFractionDigits: d, minimumFractionDigits: d })

function VrpScanner() {
  const [symbol, setSymbol] = useState<'NIFTY' | 'BANKNIFTY' | 'FINNIFTY'>('NIFTY')
  const [data, setData] = useState<VrpScan | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Oct 8 2026: selected expiry so a quiet nearest weekly doesn't hide
  // opportunities sitting in a later expiry -- null means "nearest"
  // (the API's own default), reset back to it on a symbol switch.
  const [selectedExpiry, setSelectedExpiry] = useState<string | null>(null)
  // Oct 8 2026: vol smile + term structure -- context for WHY a strike is
  // rich (a kink in the smile, a jump between expiries), not another
  // auto-generated verdict. Fetched alongside the scan, same expiry.
  const [surface, setSurface] = useState<VolSurface | null>(null)
  // Oct 8 2026: passive gap-down/gap-up + IV-spike panel, per Manish's
  // request to explore selling into IV spikes off a gap open. Context
  // only -- fetched non-blockingly alongside the main scan, not expiry-
  // dependent (gap is a once-a-day, whole-symbol fact).
  const [gapScan, setGapScan] = useState<GapScan | null>(null)

  const load = useCallback(async (sym: string, exp: string | null) => {
    setLoading(true)
    setError(null)
    try {
      const url = exp
        ? `${API}/vrp-scan/${sym}?expiry=${exp}&t=${Date.now()}`
        : `${API}/vrp-scan/${sym}?t=${Date.now()}`
      const res = await fetch(url, { cache: 'no-store' })
      if (!res.ok) throw new Error(`Server returned ${res.status}`)
      const j = await res.json()
      if (j.error) throw new Error(j.error)
      setData(j)

      const surfaceUrl = exp
        ? `${API}/vol-surface/${sym}?expiry=${exp}&t=${Date.now()}`
        : `${API}/vol-surface/${sym}?t=${Date.now()}`
      fetch(surfaceUrl, { cache: 'no-store' })
        .then((r) => r.ok ? r.json() : null)
        .then((sj) => setSurface(sj && !sj.error ? sj : null))
        .catch(() => setSurface(null))

      fetch(`${API}/gap-iv-scan/${sym}?t=${Date.now()}`, { cache: 'no-store' })
        .then((r) => r.ok ? r.json() : null)
        .then((gj) => setGapScan(gj && !gj.error ? gj : null))
        .catch(() => setGapScan(null))
    } catch (e: any) {
      setError(e?.message || 'Failed to load data')
      setData(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => { load(symbol, selectedExpiry) }, [symbol, selectedExpiry, load])

  const onSymbolChange = (s: 'NIFTY' | 'BANKNIFTY' | 'FINNIFTY') => {
    setSelectedExpiry(null) // reset to nearest on symbol switch
    setSymbol(s)
  }

  const rowCls = (c: VrpCandidate) =>
    `border-t border-gray-800/70 hover:bg-gray-900/40 ${c.is_best_pick ? 'bg-emerald-950/20' : ''}`

  const wallBadge = (status: 'HOLDING' | 'ERODING' | null, wallStrike: number | null) => {
    if (!status || !wallStrike) return null
    const cls = status === 'HOLDING' ? 'bg-emerald-950/60 text-emerald-400 border-emerald-900/50' : 'bg-red-950/60 text-red-400 border-red-900/50'
    return (
      <span className={`text-[10px] px-2 py-0.5 rounded border ${cls}`}>
        Wall {wallStrike} {status === 'HOLDING' ? 'holding' : 'eroding'}
      </span>
    )
  }

  const renderGapScan = () => {
    if (!gapScan || gapScan.gap_pct === null) return null
    const dirColor = gapScan.gap_direction === 'DOWN' ? 'text-red-400' : gapScan.gap_direction === 'UP' ? 'text-emerald-400' : 'text-gray-400'
    return (
      <div className={`mb-5 rounded-xl border px-4 py-3 ${gapScan.spike_detected ? 'bg-amber-950/20 border-amber-800/50' : 'bg-gray-900/40 border-gray-800'}`}>
        <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
          <p className="text-sm font-bold">
            Gap at open: <span className={dirColor}>{gapScan.gap_pct > 0 ? '+' : ''}{fmt(gapScan.gap_pct, 2)}%</span>
            <span className="text-gray-500 font-normal"> ({fmt(gapScan.prev_close, 0)} → {fmt(gapScan.today_open, 0)})</span>
          </p>
          {gapScan.spike_detected ? (
            <span className="text-[11px] px-2 py-1 rounded border bg-amber-900/40 border-amber-700/60 text-amber-300 font-bold">
              GAP + IV SPIKE — strike(s) below are rich for themselves right now
            </span>
          ) : (
            <span className="text-[11px] text-gray-500">
              No gap+spike condition met (needs ±{fmt(gapScan.gap_threshold_pct, 1)}% gap and IV %ile ≥{fmt(gapScan.iv_pctile_threshold, 0)} on a strike)
            </span>
          )}
        </div>
        {gapScan.candidates.length > 0 && (
          <div className="overflow-x-auto">
            <table className="text-xs w-full">
              <thead>
                <tr className="text-gray-500 text-left">
                  <th className="pr-4 pb-1">Strike</th>
                  <th className="pr-4 pb-1">Side</th>
                  <th className="pr-4 pb-1">Premium</th>
                  <th className="pr-4 pb-1">IV</th>
                  <th className="pr-4 pb-1">IV %ile</th>
                  <th className="pr-4 pb-1">PoP</th>
                </tr>
              </thead>
              <tbody>
                {gapScan.candidates.map((c) => (
                  <tr key={`${c.strike}-${c.option_type}`} className="border-t border-gray-800/70">
                    <td className="pr-4 py-0.5 font-semibold">{c.strike}</td>
                    <td className="pr-4 py-0.5">{c.option_type}</td>
                    <td className="pr-4 py-0.5">₹{fmt(c.premium, 1)}</td>
                    <td className="pr-4 py-0.5">{fmt(c.iv, 1)}%</td>
                    <td className={`pr-4 py-0.5 ${c.iv_percentile !== null && c.iv_percentile >= gapScan.iv_pctile_threshold ? 'text-amber-400 font-bold' : ''}`}>
                      {c.iv_percentile !== null ? `P${c.iv_percentile}` : `collecting (${c.iv_percentile_sessions}/10)`}
                    </td>
                    <td className="pr-4 py-0.5">{c.pop !== null ? `${fmt(c.pop, 0)}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-[11px] text-gray-600 mt-2">{gapScan.note}</p>
      </div>
    )
  }

  const renderSurface = () => {
    if (!surface || surface.smile.length === 0) return null
    // Stitch puts (left of spot) and calls (right of spot) into one
    // continuous smile line, ordered by strike.
    const smileData = [...surface.smile]
      .sort((a, b) => a.strike - b.strike)
      .map((p) => ({ strike: p.strike, iv: p.iv, side: p.option_type }))
    const termData = surface.term_structure
      .filter((t) => t.atm_iv !== null)
      .map((t) => ({ label: `${t.expiry} (${t.days_to_expiry}d)`, atm_iv: t.atm_iv }))

    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
        <div className="bg-gray-900/40 border border-gray-800 rounded-xl p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1">Vol smile — {surface.expiry}</p>
          <p className="text-[11px] text-gray-600 mb-3">OTM IV by strike (±{fmt(surface.zone_pct, 0)}% of spot) — shows why a strike is rich, not just that it is.</p>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={smileData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff14" />
              <XAxis dataKey="strike" type="number" domain={['dataMin', 'dataMax']} tick={{ fill: '#888', fontSize: 10 }} tickFormatter={(v) => v.toLocaleString()} />
              <YAxis tick={{ fill: '#888', fontSize: 10 }} tickFormatter={(v) => `${v}%`} domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{ background: '#111', border: '1px solid #333', borderRadius: 8, fontSize: 12 }}
                labelFormatter={(v) => `Strike ${Number(v).toLocaleString()}`}
                formatter={(v: any) => [`${v}%`, 'IV']}
              />
              <ReferenceLine x={surface.spot} stroke="#fbbf24" strokeDasharray="4 3" label={{ value: 'SPOT', position: 'top', fill: '#fbbf24', fontSize: 10 }} />
              <Line type="monotone" dataKey="iv" stroke="#38bdf8" strokeWidth={2} dot={{ r: 2 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-gray-900/40 border border-gray-800 rounded-xl p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1">Term structure</p>
          <p className="text-[11px] text-gray-600 mb-3">ATM IV across every available expiry — a jump between two points usually means an event sits between them.</p>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={termData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff14" />
              <XAxis dataKey="label" tick={{ fill: '#888', fontSize: 9 }} interval={0} angle={-15} textAnchor="end" height={50} />
              <YAxis tick={{ fill: '#888', fontSize: 10 }} tickFormatter={(v) => `${v}%`} domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{ background: '#111', border: '1px solid #333', borderRadius: 8, fontSize: 12 }}
                formatter={(v: any) => [`${v}%`, 'ATM IV']}
              />
              <Line type="monotone" dataKey="atm_iv" stroke="#a78bfa" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    )
  }

  const renderTable = (title: string, rows: VrpCandidate[], accent: string, wallStrike: number | null, wallStatus: 'HOLDING' | 'ERODING' | null) => {
    const pick = rows.find((c) => c.is_best_pick)
    return (
    <div className="flex-1 min-w-[360px]">
      <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <p className={`text-xs font-bold uppercase tracking-wide ${accent}`}>{title}</p>
          {wallBadge(wallStatus, wallStrike)}
        </div>
        {pick && (
          <p className="text-[11px] text-emerald-400">
            Best pick: <b>{pick.strike}</b> · ₹{fmt(pick.premium, 1)} · VRP {pick.vrp !== null ? `+${fmt(pick.vrp, 1)}` : '—'} · PoP {pick.pop !== null ? `${fmt(pick.pop, 0)}%` : '—'}
          </p>
        )}
      </div>
      <div className="overflow-x-auto rounded-xl border border-gray-800">
        <table className="w-full text-xs">
          <thead className="bg-gray-900/60">
            <tr>
              <th className="px-3 py-2.5 text-left text-[11px] uppercase tracking-wide text-gray-500 font-semibold">Strike</th>
              <th className="px-3 py-2.5 text-right text-[11px] uppercase tracking-wide text-gray-500 font-semibold">% from spot</th>
              <th className="px-3 py-2.5 text-right text-[11px] uppercase tracking-wide text-gray-500 font-semibold">Premium</th>
              <th className="px-3 py-2.5 text-right text-[11px] uppercase tracking-wide text-gray-500 font-semibold">OI</th>
              <th className="px-3 py-2.5 text-right text-[11px] uppercase tracking-wide text-gray-500 font-semibold">IV</th>
              <th className="px-3 py-2.5 text-right text-[11px] uppercase tracking-wide text-gray-500 font-semibold">IV %ile</th>
              <th className="px-3 py-2.5 text-right text-[11px] uppercase tracking-wide text-gray-500 font-semibold">VRP (pts)</th>
              <th className="px-3 py-2.5 text-right text-[11px] uppercase tracking-wide text-gray-500 font-semibold">IV Δ 60m</th>
              <th className="px-3 py-2.5 text-right text-[11px] uppercase tracking-wide text-gray-500 font-semibold">PoP</th>
              <th className="px-3 py-2.5 text-right text-[11px] uppercase tracking-wide text-gray-500 font-semibold">ROI / ann.</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={10} className="px-3 py-4 text-center text-gray-600">No liquid candidates right now.</td></tr>
            )}
            {rows.map((c) => (
              <tr key={`${c.option_type}-${c.strike}`} className={rowCls(c)}>
                <td className="px-3 py-2.5 font-bold text-white">
                  {c.strike}{c.is_best_pick && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-emerald-900/60 text-emerald-400 border border-emerald-700/50 align-middle">BEST</span>}
                </td>
                <td className="px-3 py-2.5 text-right text-gray-400">{c.pct_from_spot > 0 ? '+' : ''}{fmt(c.pct_from_spot, 1)}%</td>
                <td className="px-3 py-2.5 text-right text-white font-semibold">₹{fmt(c.premium, 1)}</td>
                <td className="px-3 py-2.5 text-right text-gray-400">{c.oi.toLocaleString('en-IN')}</td>
                <td className="px-3 py-2.5 text-right text-amber-400 font-bold">{fmt(c.iv, 1)}%</td>
                <td className="px-3 py-2.5 text-right text-gray-400">
                  {c.iv_percentile !== null
                    ? <span className={c.iv_percentile >= 70 ? 'text-emerald-400 font-semibold' : c.iv_percentile <= 30 ? 'text-gray-500' : 'text-gray-300'}>P{fmt(c.iv_percentile, 0)}</span>
                    : <span className="text-gray-600" title={`${c.iv_percentile_sessions}/10 sessions collected`}>collecting ({c.iv_percentile_sessions}/10)</span>}
                </td>
                <td className={`px-3 py-2.5 text-right font-bold ${c.vrp !== null && c.vrp > 0 ? 'text-red-400' : 'text-gray-400'}`}>
                  {c.vrp !== null ? `${c.vrp > 0 ? '+' : ''}${fmt(c.vrp, 1)}` : '—'}
                </td>
                <td className={`px-3 py-2.5 text-right ${c.iv_change_60m !== null && c.iv_change_60m > 0 ? 'text-orange-400' : 'text-gray-400'}`}>
                  {c.iv_change_60m !== null ? `${c.iv_change_60m > 0 ? '+' : ''}${fmt(c.iv_change_60m, 1)}` : '—'}
                </td>
                <td className="px-3 py-2.5 text-right text-sky-300 font-semibold">{c.pop !== null ? `${fmt(c.pop, 0)}%` : '—'}</td>
                <td className="px-3 py-2.5 text-right text-gray-300">
                  {c.roi_pct !== null ? `${fmt(c.roi_pct, 2)}%` : '—'}
                  {c.annualized_roi_pct !== null && <span className="text-gray-500"> / {fmt(c.annualized_roi_pct, 0)}%</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
    )
  }

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap mb-5">
        {(['NIFTY', 'BANKNIFTY', 'FINNIFTY'] as const).map((s) => (
          <button
            key={s}
            onClick={() => onSymbolChange(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${symbol === s ? 'bg-white text-gray-900 border-white' : 'bg-gray-900 text-gray-300 border-gray-800 hover:border-gray-600'}`}
          >
            {s}
          </button>
        ))}
        <button onClick={() => load(symbol, selectedExpiry)} className="ml-auto px-4 py-1.5 rounded-lg border border-gray-700 text-xs text-gray-300 hover:border-gray-500">
          Refresh
        </button>
      </div>

      {error && <div className="mb-4 bg-red-950/30 border border-red-800/40 rounded-xl px-4 py-3 text-sm text-red-400">{error}</div>}
      {loading && <p className="text-gray-500 text-sm">Loading…</p>}

      {!loading && !error && data && (
        <>
          {renderGapScan()}

          {data.available_expiries && data.available_expiries.length > 1 && (
            <div className="flex items-center gap-2 flex-wrap mb-4">
              <p className="text-[11px] text-gray-500 uppercase tracking-wide mr-1">Expiry:</p>
              {data.available_expiries.map((exp) => (
                <button
                  key={exp}
                  onClick={() => setSelectedExpiry(exp)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold border transition ${data.expiry === exp ? 'bg-emerald-500/90 text-gray-950 border-emerald-400' : 'bg-gray-900 text-gray-300 border-gray-800 hover:border-gray-600'}`}
                >
                  {exp}
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <div className="bg-gray-900/40 border border-gray-800 rounded-xl px-4 py-3">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Spot / Futures</p>
              <p className="text-lg font-black text-white">{fmt(data.spot, 0)} / {fmt(data.futures, 0)}</p>
            </div>
            <div className="bg-gray-900/40 border border-gray-800 rounded-xl px-4 py-3">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Scanned expiry</p>
              <p className="text-lg font-black text-white">{data.expiry} · {data.days_to_expiry}d</p>
            </div>
            <div className="bg-gray-900/40 border border-gray-800 rounded-xl px-4 py-3">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Realized vol</p>
              <p className="text-lg font-black text-white">{data.realized_vol ? `${fmt(data.realized_vol, 1)}%` : '—'}</p>
            </div>
            <div className="bg-gray-900/40 border border-gray-800 rounded-xl px-4 py-3">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Scan zone / spike window</p>
              <p className="text-lg font-black text-white">±{fmt(data.zone_pct, 1)}% · {data.lookback_minutes}m</p>
            </div>
          </div>

          {data.weekend_theta_note && (
            <div className="mb-4 bg-indigo-950/20 border border-indigo-900/40 rounded-xl px-4 py-3 text-xs text-indigo-300">
              <b>Weekend theta:</b> {data.weekend_theta_note}
            </div>
          )}

          <div className="flex flex-wrap gap-5 mb-3">
            {renderTable('Call side (resistance)', data.ce_candidates, 'text-sky-400', data.call_wall, data.call_wall_status)}
            {renderTable('Put side (support)', data.pe_candidates, 'text-rose-400', data.put_wall, data.put_wall_status)}
          </div>

          {renderSurface()}

          {data.margin_estimate_note && (
            <p className="text-[11px] text-gray-600 mb-6">{data.margin_estimate_note}</p>
          )}

          <details className="rounded-lg border border-gray-800 bg-[#0c0c16] p-4 text-xs text-gray-400 leading-relaxed">
            <summary className="cursor-pointer text-gray-300 font-semibold">How to read this</summary>
            <ul className="mt-3 space-y-2 list-disc pl-5">
              <li>Shows every OTM strike within the scan zone (near-ATM to the zone edge, both sides), not just a shortlist — IV naturally rises further from spot (normal skew), so a pure "highest VRP" ranking would always drift to the edge and miss the strikes actually worth comparing.</li>
              <li><b>VRP (pts):</b> this strike&apos;s IV minus the index&apos;s own realized volatility. Positive means IV is pricing in more movement than the index has actually been making — historically where premium sellers get paid for risk that doesn&apos;t usually show up.</li>
              <li><b>IV Δ 60m:</b> how many vol points this exact strike&apos;s IV has moved in the last hour. A positive jump with no matching realized-vol move is a fresh spike — often the richest, freshest premium, and the kind that tends to fade.</li>
              <li><b>IV %ile:</b> where today&apos;s IV for this exact strike sits versus its own recent history — P80 means this strike&apos;s IV is richer than 80% of its own last ~30 sessions. Context, not a verdict: a strike can have a modest VRP but still be unusually rich FOR ITSELF, which a flat VRP number alone won&apos;t show. Needs 10+ sessions of history to show a number — shows "collecting" until then, since this is a brand-new data series starting today.</li>
              <li><b className="text-emerald-400">Best pick:</b> the highest-scoring strike (VRP plus spike) among those with real collectable premium (₹5+) <i>and</i> a PoP of at least 70% — ATM strikes carry more gamma/vega, so ordinary IV noise can out-score a safer OTM strike on raw VRP alone; the PoP floor keeps "best" from ever landing on a near-coin-flip strike.</li>
              <li><b className="text-sky-300">PoP:</b> probability this strike expires worthless (the risk-neutral chance spot doesn&apos;t cross it by expiry) — the other half of the decision VRP alone doesn&apos;t answer: rich premium on a strike with low PoP is a different trade than rich premium on a safe one.</li>
              <li><b>Wall holding / eroding:</b> whether the nearby gamma wall this side leans on has been stable or drifting toward spot recently. A strike behind an eroding wall is riskier than the same VRP behind a wall that&apos;s holding — needs a little trading history to accumulate before it shows a verdict. Only shown for the nearest expiry — gamma walls are tracked for the front week, so a wall reading wouldn&apos;t mean much for a far-dated expiry.</li>
              <li><b>Expiry tabs:</b> when the nearest weekly looks quiet, flip to a later expiry above — a further-dated series can still be showing real VRP worth a look.</li>
              <li><b className="text-amber-400">Gap at open:</b> today&apos;s open vs yesterday&apos;s close. Flags "GAP + IV SPIKE" only when there&apos;s a real gap (not normal daily drift) <i>and</i> at least one strike&apos;s IV is unusually rich versus its own recent history — the setup some sellers watch for to short into panic premium before it mean-reverts. This is context, not a signal to act on — still passive by design; no alert/auto-trade, and it won&apos;t yet say how IV has historically behaved after a gap like this since that history only started being recorded today.</li>
              <li><b>Vol smile:</b> plots IV across the whole OTM ladder so you can see the actual shape — a flat line means skew alone explains the VRP spread; a kink at one strike means something specific is happening there, worth a second look before trusting that strike's number on its own.</li>
              <li><b>Term structure:</b> ATM IV across every expiry — a jump between two points usually means an event (RBI policy, Budget, earnings) sits between them, which is useful context before committing to an expiry for weeks.</li>
              <li><b>ROI / ann.:</b> premium collected against a rough ~12%-of-notional margin estimate (not your broker&apos;s real SPAN+exposure figure — check that before sizing), shown as this-trade ROI% and an annualized rate so strikes are comparable on capital efficiency, not just raw premium.</li>
              <li><b>Weekend theta:</b> flagged when a weekend or holiday sits between now and expiry — decay accrues every calendar day while risk is only taken on trading days, so that stretch captures more decay per day of actual market exposure.</li>
              <li>Strikes below {VRP_MIN_OI_LABEL} open interest are filtered out — a "spike" on a near-empty strike isn&apos;t a real opportunity.</li>
              <li>Estimates only, from live option data. Not investment advice — always check liquidity, spreads and real margin before acting.</li>
            </ul>
          </details>
        </>
      )}
      {!loading && !error && !data && <p className="text-gray-500 text-sm">No data available yet.</p>}
    </>
  )
}
const VRP_MIN_OI_LABEL = '500'

export default function VegaPage() {
  const [tab, setTab] = useState<'VEGA' | 'VRP'>('VEGA')
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
            {tab === 'VEGA'
              ? 'How much option premium moves when implied volatility moves, per stock. Nearest active expiry.'
              : 'Weekly index strikes ranked by richness of premium — VRP and recent IV spikes.'}
          </p>
        </div>
        {tab === 'VEGA' && (
          <button onClick={load} className="px-4 py-2 rounded-lg border border-gray-700 text-sm text-gray-300 hover:border-gray-500">
            Refresh
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 mb-5">
        <button
          onClick={() => setTab('VEGA')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold border transition ${tab === 'VEGA' ? 'bg-white text-gray-900 border-white' : 'bg-gray-900 text-gray-300 border-gray-800 hover:border-gray-600'}`}
        >
          Stock Vega
        </button>
        <button
          onClick={() => setTab('VRP')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold border transition ${tab === 'VRP' ? 'bg-white text-gray-900 border-white' : 'bg-gray-900 text-gray-300 border-gray-800 hover:border-gray-600'}`}
        >
          VRP Scanner (Weekly)
        </button>
      </div>

      {tab === 'VRP' ? (
        <VrpScanner />
      ) : (
      <>
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
                  <th className={th} onClick={() => sortBy('iv_month')}>Month IV{arrow('iv_month')}</th>
                  <th className={th} onClick={() => sortBy('term_ratio')}>Term (near / month){arrow('term_ratio')}</th>
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
                    <td className="px-3 py-2.5 text-right text-gray-300">{r.iv_month ? `${fmt(r.iv_month, 1)}%` : '—'}</td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      {r.term_ratio ? <span className={r.term_state === 'FRONT_SPIKE' ? 'text-red-400 font-bold' : r.term_state === 'FRONT_CHEAP' ? 'text-sky-300' : 'text-gray-300'}>{fmt(r.term_ratio)}x{r.term_state === 'FRONT_SPIKE' ? ' spike' : r.term_state === 'FRONT_CHEAP' ? ' cheap' : ''}</span> : '—'}
                    </td>
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
              <li><b>Month IV and Term:</b> Month IV is the ATM IV of the next expiry. Term is near-expiry IV divided by month IV. Above 1.15 the front month is expensive relative to next month (often an event or stress). Below 0.85 the front is cheap. Near-expiry IV normally drifts down as expiry approaches, so compare it with month IV, not with its own reading from a week ago.</li>
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
      </>
      )}
    </div>
    </div>
  )
}
