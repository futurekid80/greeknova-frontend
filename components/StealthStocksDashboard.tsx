'use client'
// Nov 3 2026: the "new layout" for the futures-level Stealth Buildup section on /positional (?v=new).
// Same look as the Strike Stealth dashboard: KPI tiles, a scatter of OI rise vs price move with the rule zone
// shaded, and a ranked table. Pure presentation -- all numbers come from the /positional-intelligence feed.
import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'

export interface StealthRow {
  symbol: string
  cmp: number
  tier: string
  today_oi_chg: number
  next_month_oi_chg?: number | null
  combined_oi_chg?: number | null
  today_oi_abs?: number | null
  price_chg: number
  net_delta?: number | null
  delivery_pct?: number | null
  vol_ratio?: number | null
  near_miss?: boolean
}

const TIERS: Record<string, { label: string; col: string; chip: string }> = {
  ELITE:  { label: 'Elite',  col: '#f59e0b', chip: 'text-amber-300 border-amber-700/60 bg-amber-950/40' },
  STRONG: { label: 'Strong', col: '#34d399', chip: 'text-emerald-300 border-emerald-700/60 bg-emerald-950/40' },
  WATCH:  { label: 'Watch',  col: '#38bdf8', chip: 'text-sky-300 border-sky-700/60 bg-sky-950/40' },
}
const sgn = (v: number, d = 2) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(d)}%`
const fmtOI = (n?: number | null) => n == null ? '' : n >= 1e7 ? `${(n / 1e7).toFixed(2)}Cr` : n >= 1e5 ? `${(n / 1e5).toFixed(1)}L` : `${Math.round(n / 1e3)}K`

// scatter geometry
const W = 640, H = 300, ML = 46, MR = 14, MT = 14, MB = 36
const XMAX = 1.6
const ylog = (v: number) => Math.log1p(Math.max(v, 0))

export default function StealthStocksDashboard({
  rows, watchCount, widerNet, onToggleWider, onSymbolClick, renderWall,
}: {
  rows: StealthRow[]
  watchCount: number
  widerNet: boolean
  onToggleWider: () => void
  onSymbolClick: (sym: string) => void
  renderWall?: (sym: string) => ReactNode
}) {
  const [focus, setFocus] = useState<string | null>(null)
  const [hover, setHover] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)

  const n = rows.length
  const count = (t: string) => rows.filter(r => r.tier === t).length
  const avgOI = n ? rows.reduce((a, r) => a + (r.today_oi_chg || 0), 0) / n : 0
  const avgMove = n ? rows.reduce((a, r) => a + Math.abs(r.price_chg || 0), 0) / n : 0
  const quiet = rows.filter(r => Math.abs(r.price_chg) <= 0.5).length
  const bull = rows.filter(r => (r.net_delta ?? 0) > 0).length
  const bear = rows.filter(r => (r.net_delta ?? 0) < 0).length
  const top = rows.length ? [...rows].sort((a, b) => b.today_oi_chg - a.today_oi_chg)[0] : null

  const yMaxRaw = Math.max(10, ...rows.map(r => r.today_oi_chg || 0))
  const yTop = ylog(yMaxRaw * 1.08)
  const px = (x: number) => ML + ((Math.max(-XMAX, Math.min(XMAX, x)) + XMAX) / (2 * XMAX)) * (W - ML - MR)
  const py = (v: number) => H - MB - (ylog(v) / yTop) * (H - MT - MB)
  const yTicks = [1, 2, 5, 10, 25, 50, 100].filter(t => t <= yMaxRaw * 1.08)

  const shown = useMemo(() => (focus ? rows.filter(r => r.symbol === focus) : rows), [rows, focus])
  const list = showAll || focus ? shown : shown.slice(0, 15)
  const hovered = rows.find(r => r.symbol === hover) || null

  const tile = 'rounded-xl border border-gray-800 bg-gray-900/40 p-3'
  const lab = 'text-[10px] text-gray-500 tracking-wide'

  return (
    <div className="space-y-4">
      {/* controls */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="px-3 py-1.5 rounded-lg border text-xs font-bold bg-cyan-950/60 text-cyan-400 border-cyan-700">Elite + Strong</span>
        <button onClick={onToggleWider}
          className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${widerNet ? 'bg-sky-950/60 text-sky-300 border-sky-700' : 'bg-gray-800/40 text-gray-400 border-gray-700 hover:text-white'}`}>
          {widerNet ? `Wider net on · +${watchCount} Watch` : `Wider net · +${watchCount} Watch`}
        </button>
        {focus && (
          <button onClick={() => setFocus(null)} className="px-3 py-1.5 rounded-lg border text-xs font-bold bg-amber-950/40 text-amber-300 border-amber-700/60">
            {focus} only · ✕ clear
          </button>
        )}
        <span className="text-[11px] text-gray-500">
          {widerNet
            ? 'Watch = close to the rule: OI rise a bit smaller, or the stock price moved 1–1.5% instead of 1% or less.'
            : 'Futures OI up 1.5%+ while the stock price moved 1% or less. Every qualifying stock is shown.'}
        </span>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className={tile}>
          <p className={lab}>QUALIFYING</p>
          <p className="text-2xl font-black text-white mt-1">{n} <span className="text-xs font-normal text-gray-500">stocks</span></p>
          <p className="text-[10px] text-gray-500">
            <span style={{ color: TIERS.ELITE.col }}>{count('ELITE')} elite</span> · <span style={{ color: TIERS.STRONG.col }}>{count('STRONG')} strong</span>{widerNet ? <> · <span style={{ color: TIERS.WATCH.col }}>{count('WATCH')} watch</span></> : null}
          </p>
        </div>
        <div className={tile}>
          <p className={lab}>AVG FUT OI RISE</p>
          <p className="text-2xl font-black text-emerald-400 mt-1">+{avgOI.toFixed(1)}%</p>
          <p className="text-[10px] text-gray-500">near-month futures</p>
        </div>
        <div className={tile}>
          <p className={lab}>AVG PRICE MOVE</p>
          <p className="text-2xl font-black text-white mt-1">±{avgMove.toFixed(2)}%</p>
          <p className="text-[10px] text-gray-500">close to close</p>
        </div>
        <div className={tile}>
          <p className={lab}>VERY QUIET (≤0.5%)</p>
          <p className="text-2xl font-black text-white mt-1">{quiet} <span className="text-xs font-normal text-gray-500">{n ? Math.round((quiet / n) * 100) : 0}%</span></p>
          <p className="text-[10px] text-gray-500">price barely moved</p>
        </div>
        <div className={tile}>
          <p className={lab}>NET DELTA (ATM ±5)</p>
          <p className="text-sm font-bold mt-2 flex justify-between gap-2"><span className="text-emerald-400">{bull} positive</span><span className="text-rose-400">{bear} negative</span></p>
          <div className="h-1.5 rounded bg-gray-800 mt-2 overflow-hidden flex">
            <div style={{ width: `${bull + bear ? (bull / (bull + bear)) * 100 : 50}%`, background: '#34d399' }} />
            <div style={{ width: `${bull + bear ? (bear / (bull + bear)) * 100 : 50}%`, background: '#fb7185' }} />
          </div>
        </div>
        <div className={tile}>
          <p className={lab}>BIGGEST OI RISE</p>
          <p className="text-base font-black text-white mt-1 truncate">{top ? top.symbol : '—'}</p>
          <p className="text-xs font-bold text-emerald-400">{top ? sgn(top.today_oi_chg, 1) : ''}</p>
          <p className="text-[10px] text-gray-500">price {top ? sgn(top.price_chg) : '—'}</p>
        </div>
      </div>

      {/* scatter + top list */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-xl border border-gray-800 bg-gray-900/30 p-4 min-w-0">
          <p className="text-sm font-bold text-gray-200">Futures OI rise vs. stock price move</p>
          <p className="text-[11px] text-gray-500 mb-2">Shaded area = the Stealth rule: OI building up while the price stays quiet. Click a dot to isolate that stock.</p>
          <div className="overflow-x-auto">
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[420px]" role="img" aria-label="Scatter of futures OI rise against stock price move">
              {/* rule zones */}
              <rect x={px(-1)} y={py(yMaxRaw * 1.08)} width={px(1) - px(-1)} height={py(1.5) - py(yMaxRaw * 1.08)} fill="#34d399" opacity="0.07" stroke="#34d399" strokeOpacity="0.35" strokeDasharray="4 4" />
              <rect x={px(-0.5)} y={py(yMaxRaw * 1.08)} width={px(0.5) - px(-0.5)} height={py(2) - py(yMaxRaw * 1.08)} fill="#f59e0b" opacity="0.08" stroke="#f59e0b" strokeOpacity="0.4" strokeDasharray="4 4" />
              {/* grid */}
              {yTicks.map(t => (
                <g key={t}>
                  <line x1={ML} x2={W - MR} y1={py(t)} y2={py(t)} stroke="#1f2937" />
                  <text x={ML - 6} y={py(t) + 3} textAnchor="end" fontSize="10" fill="#6b7280">+{t}%</text>
                </g>
              ))}
              {[-1.5, -1, -0.5, 0, 0.5, 1, 1.5].map(t => (
                <g key={t}>
                  <line x1={px(t)} x2={px(t)} y1={MT} y2={H - MB} stroke={t === 0 ? '#374151' : '#1f2937'} />
                  <text x={px(t)} y={H - MB + 14} textAnchor="middle" fontSize="10" fill="#6b7280">{t > 0 ? '+' : ''}{t}%</text>
                </g>
              ))}
              <text x={(ML + W - MR) / 2} y={H - 4} textAnchor="middle" fontSize="10" fill="#6b7280" letterSpacing="0.5">STOCK PRICE MOVE (CLOSE TO CLOSE)</text>
              <text x={px(1) - 6} y={py(yMaxRaw * 1.08) + 12} textAnchor="end" fontSize="9" fill="#34d399" opacity="0.8">STRONG ZONE</text>
              <text x={px(0.5) - 6} y={py(yMaxRaw * 1.08) + 24} textAnchor="end" fontSize="9" fill="#f59e0b" opacity="0.9">ELITE ZONE</text>
              {/* dots (watch first so elite/strong sit on top) */}
              {[...rows].sort((a, b) => ({ WATCH: 0, STRONG: 1, ELITE: 2 } as any)[a.tier] - ({ WATCH: 0, STRONG: 1, ELITE: 2 } as any)[b.tier]).map(r => {
                const t = TIERS[r.tier] || TIERS.WATCH
                const active = focus === r.symbol || hover === r.symbol
                return (
                  <circle key={r.symbol} cx={px(r.price_chg)} cy={py(r.today_oi_chg)} r={active ? 8 : 5.5}
                    fill={t.col} fillOpacity={focus && focus !== r.symbol ? 0.25 : 0.85} stroke="#07070e" strokeWidth="2"
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setHover(r.symbol)} onMouseLeave={() => setHover(null)}
                    onClick={() => setFocus(f => (f === r.symbol ? null : r.symbol))}>
                    <title>{`${r.symbol}: OI ${sgn(r.today_oi_chg)}, price ${sgn(r.price_chg)}`}</title>
                  </circle>
                )
              })}
            </svg>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-gray-400 mt-1">
            {['ELITE', 'STRONG', ...(widerNet ? ['WATCH'] : [])].map(k => (
              <span key={k} className="inline-flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: TIERS[k].col }} />{TIERS[k].label}</span>
            ))}
            <span className="ml-auto text-gray-300 min-h-[1rem]">
              {hovered ? `${hovered.symbol} · OI ${sgn(hovered.today_oi_chg)} · price ${sgn(hovered.price_chg)}` : ''}
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-gray-800 bg-gray-900/30 p-4 min-w-0">
          <p className="text-sm font-bold text-gray-200">Biggest futures OI rise</p>
          <p className="text-[11px] text-gray-500 mb-2">Click a stock to isolate it</p>
          <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
            {[...rows].sort((a, b) => b.today_oi_chg - a.today_oi_chg).slice(0, 10).map(r => {
              const t = TIERS[r.tier] || TIERS.WATCH
              const w = Math.min(100, (r.today_oi_chg / Math.max(yMaxRaw, 1)) * 100)
              return (
                <button key={r.symbol} onClick={() => setFocus(f => (f === r.symbol ? null : r.symbol))}
                  className="w-full text-left rounded-lg border border-gray-800 bg-gray-900/40 hover:border-gray-600 px-3 py-2 transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-white truncate">{r.symbol}</span>
                    <span className="text-xs font-bold text-emerald-400">{sgn(r.today_oi_chg, 1)}</span>
                  </div>
                  <div className="h-1 rounded bg-gray-800 mt-1.5 overflow-hidden"><div className="h-full rounded" style={{ width: `${w}%`, background: t.col }} /></div>
                  <div className="flex justify-between text-[10px] text-gray-500 mt-1"><span>{t.label}</span><span>price {sgn(r.price_chg)}</span></div>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ranked table */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/30 p-4">
        <div className="flex items-baseline justify-between mb-2">
          <p className="text-sm font-bold text-gray-200">All qualifying stocks <span className="text-xs font-normal text-gray-500">· click a row for its signal history</span></p>
          <span className="text-[11px] text-gray-500">{list.length} of {shown.length}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[760px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-wide text-gray-500 text-left border-b border-gray-800">
                <th className="py-1.5 pr-2">Stock</th><th className="px-2">Tier</th>
                <th className="px-2 text-right">Fut OI rise</th><th className="px-2 text-right">Next month</th>
                <th className="px-2 text-right">Price</th><th className="px-2 text-right">Delivery</th>
                <th className="px-2 text-right">Volume</th><th className="px-2 text-right">Net delta</th><th className="px-2">Wall</th>
              </tr>
            </thead>
            <tbody>
              {list.map(r => {
                const t = TIERS[r.tier] || TIERS.WATCH
                return (
                  <tr key={r.symbol} onClick={() => onSymbolClick(r.symbol)} className="border-b border-gray-800/50 hover:bg-gray-800/30 cursor-pointer">
                    <td className="py-2 pr-2"><span className="font-bold text-white">{r.symbol}</span> <span className="text-gray-500">₹{r.cmp?.toLocaleString('en-IN', { maximumFractionDigits: 1 })}</span></td>
                    <td className="px-2"><span className={`text-[10px] font-bold border rounded px-1.5 py-0.5 ${t.chip}`}>{t.label}</span>{r.near_miss && <span className="ml-1 text-[10px] text-gray-500" title="Price moved just outside the 1% rule">near</span>}</td>
                    <td className="px-2 text-right"><span className="font-semibold text-emerald-400">{sgn(r.today_oi_chg)}</span>{r.today_oi_abs != null && <span className="text-gray-500"> ({fmtOI(r.today_oi_abs)})</span>}</td>
                    <td className="px-2 text-right text-gray-400">{r.next_month_oi_chg != null ? <span className={r.next_month_oi_chg >= 0 ? 'text-emerald-500/80' : 'text-rose-400/80'}>{sgn(r.next_month_oi_chg, 1)}</span> : '—'}{r.combined_oi_chg != null && <span className="text-gray-600"> · Σ{sgn(r.combined_oi_chg, 1)}</span>}</td>
                    <td className={`px-2 text-right font-semibold ${r.price_chg >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{sgn(r.price_chg)}</td>
                    <td className="px-2 text-right">{r.delivery_pct != null ? <span className={r.delivery_pct >= 60 ? 'text-emerald-400' : r.delivery_pct >= 45 ? 'text-amber-400' : 'text-gray-400'}>{r.delivery_pct.toFixed(1)}%</span> : <span className="text-gray-600">—</span>}</td>
                    <td className="px-2 text-right">{r.vol_ratio != null ? <span className={r.vol_ratio >= 1.5 ? 'text-emerald-400' : r.vol_ratio <= 0.5 ? 'text-rose-400' : 'text-gray-300'}>{r.vol_ratio}×</span> : <span className="text-gray-600">—</span>}</td>
                    <td className={`px-2 text-right ${r.net_delta == null ? 'text-gray-600' : r.net_delta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{r.net_delta == null ? '—' : `${r.net_delta >= 0 ? '+' : ''}${(r.net_delta / 100000).toFixed(1)}L`}</td>
                    <td className="px-2">{renderWall ? renderWall(r.symbol) : null}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {!focus && shown.length > 15 && (
          <button onClick={() => setShowAll(v => !v)} className="mt-3 text-[11px] text-cyan-400 hover:text-cyan-300">
            {showAll ? '▴ Show top 15 only' : `▾ Show all ${shown.length}`}
          </button>
        )}
      </div>
    </div>
  )
}
