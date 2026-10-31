'use client'
// Oct 31 2026: "Screens" block for the Pulse preview (?v=new): a Scans grid (top-5 lists)
// and a buildup Heatmap. Pure client-side over the stocks the Pulse page already loads.
// Educational only -- describes positioning, not a prediction.
import { useMemo, useState } from 'react'

const INDICES = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY', 'SENSEX']

interface Props {
  stocks: any[]
  onSymbolClick?: (sym: string) => void
}

type Row = { symbol: string; v: number; txt: string; tone: 'up' | 'down' | 'amber' | 'blue' | 'cyan' | 'violet' }

const TONE: Record<Row['tone'], { bar: string; text: string }> = {
  up: { bar: 'bg-emerald-600/60', text: 'text-emerald-300' },
  down: { bar: 'bg-rose-600/60', text: 'text-rose-300' },
  amber: { bar: 'bg-amber-600/60', text: 'text-amber-300' },
  blue: { bar: 'bg-sky-600/60', text: 'text-sky-300' },
  cyan: { bar: 'bg-cyan-600/60', text: 'text-cyan-300' },
  violet: { bar: 'bg-violet-600/60', text: 'text-violet-300' },
}

const pct = (n: number, d = 1) => `${n > 0 ? '+' : ''}${n.toFixed(d)}%`

function ScanList({ title, hint, rows, onClick }: { title: string; hint?: string; rows: Row[]; onClick?: (s: string) => void }) {
  const max = Math.max(...rows.map(r => Math.abs(r.v)), 0.0001)
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/30 p-3 min-w-0">
      <p className="text-xs font-bold text-gray-200">{title}</p>
      {hint && <p className="text-[10px] text-gray-500 mb-2">{hint}</p>}
      {!hint && <div className="mb-2" />}
      {rows.length ? (
        <div className="space-y-1">
          {rows.map(r => (
            <button key={r.symbol} onClick={() => onClick?.(r.symbol)}
              className="relative w-full flex items-center justify-between gap-2 rounded-md overflow-hidden px-2 py-1 text-[11px] text-left hover:ring-1 hover:ring-gray-600">
              <span className={`absolute inset-y-0 left-0 ${TONE[r.tone].bar}`} style={{ width: `${Math.max(8, (Math.abs(r.v) / max) * 100)}%` }} />
              <span className="relative font-bold text-white truncate">{r.symbol}</span>
              <span className={`relative font-semibold whitespace-nowrap ${TONE[r.tone].text}`}>{r.txt}</span>
            </button>
          ))}
        </div>
      ) : <p className="text-[11px] text-gray-600 py-3 text-center">None right now</p>}
    </div>
  )
}

// ── tiny squarified treemap ────────────────────────────────────────────────
type Item = { symbol: string; area: number; col: string; label: string }
type Rect = { x: number; y: number; w: number; h: number; it: Item }

function squarify(items: Item[], x: number, y: number, w: number, h: number): Rect[] {
  const out: Rect[] = []
  const total = items.reduce((a, b) => a + b.area, 0)
  if (!total || w <= 0 || h <= 0) return out
  const sc = (w * h) / total
  const q = items.map(i => ({ ...i, a: i.area * sc })).sort((a, b) => b.a - a.a)
  let rx = x, ry = y, rw = w, rh = h
  const worst = (row: typeof q, side: number) => {
    const s = row.reduce((a, b) => a + b.a, 0)
    const mx = Math.max(...row.map(r => r.a)), mn = Math.min(...row.map(r => r.a))
    return Math.max((side * side * mx) / (s * s), (s * s) / (side * side * mn))
  }
  let i = 0
  while (i < q.length) {
    const side = Math.min(rw, rh)
    let row = [q[i]]
    let j = i + 1
    while (j < q.length && worst([...row, q[j]], side) <= worst(row, side)) { row.push(q[j]); j++ }
    const s = row.reduce((a, b) => a + b.a, 0)
    if (rw >= rh) {
      const cw = s / rh; let cy = ry
      row.forEach(r => { const hh = r.a / cw; out.push({ x: rx, y: cy, w: cw, h: hh, it: r }); cy += hh })
      rx += cw; rw -= cw
    } else {
      const ch = s / rw; let cx = rx
      row.forEach(r => { const ww = r.a / ch; out.push({ x: cx, y: ry, w: ww, h: ch, it: r }); cx += ww })
      ry += ch; rh -= ch
    }
    i = j
  }
  return out
}

const GROUPS: { sig: string; label: string; hue: 'g' | 'r' | 'b' | 'a' }[] = [
  { sig: 'LONG_BUILDUP', label: 'Long Buildup', hue: 'g' },
  { sig: 'SHORT_BUILDUP', label: 'Short Buildup', hue: 'r' },
  { sig: 'SHORT_COVERING', label: 'Short Covering', hue: 'b' },
  { sig: 'LONG_UNWINDING', label: 'Long Unwinding', hue: 'a' },
]
const HUE: Record<string, [number, number, number]> = { g: [16, 150, 100], r: [200, 60, 70], b: [40, 120, 200], a: [190, 140, 30] }

function tileColor(hue: string, move: number) {
  const [r, g, b] = HUE[hue]
  const k = 0.35 + Math.min(1, Math.abs(move) / 5) * 0.65
  return `rgba(${r},${g},${b},${k})`
}

function Heatmap({ stocks, onClick }: { stocks: any[]; onClick?: (s: string) => void }) {
  const W = 1000, H = 520
  const groups = useMemo(() => GROUPS.map(g => {
    const items: Item[] = stocks.filter(s => s.signal === g.sig).map(s => ({
      symbol: s.symbol,
      area: Math.max(1, Math.abs(s.price_chg_pct || 0) * 2 + Math.abs(s.oi_chg_pct || 0)),
      col: tileColor(g.hue, s.price_chg_pct || 0),
      label: pct(s.price_chg_pct || 0, 2),
    }))
    return { ...g, items, total: items.reduce((a, b) => a + b.area, 0) }
  }).filter(g => g.items.length), [stocks])

  const layout = useMemo(() => {
    const tot = groups.reduce((a, b) => a + b.total, 0)
    if (!tot) return []
    const big = squarify(groups.map(g => ({ symbol: g.sig, area: g.total, col: '', label: g.label })), 0, 0, W, H)
    return big.map(b => {
      const g = groups.find(x => x.sig === b.it.symbol)!
      const pad = 3, head = 16
      const inner = squarify(g.items, b.x + pad, b.y + head + pad, b.w - 2 * pad, b.h - head - 2 * pad)
      return { g, b, inner }
    })
  }, [groups])

  if (!layout.length) return <p className="text-xs text-gray-500 py-10 text-center">No signals to draw yet.</p>
  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[640px]" style={{ height: 'auto' }}>
        {layout.map(({ g, b, inner }) => (
          <g key={g.sig}>
            <rect x={b.x} y={b.y} width={b.w} height={b.h} fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.12)" />
            <text x={b.x + 6} y={b.y + 12} fontSize="10" fontWeight="700" fill="#9ca3af">{g.label.toUpperCase()} · {g.items.length}</text>
            {inner.map(r => (
              <g key={r.it.symbol} style={{ cursor: 'pointer' }} onClick={() => onClick?.(r.it.symbol)}>
                <rect x={r.x} y={r.y} width={Math.max(0, r.w - 1.5)} height={Math.max(0, r.h - 1.5)} fill={r.it.col} rx="2" />
                {r.w > 30 && r.h > 24 && (
                  <>
                    <text x={r.x + 4} y={r.y + 12} fontSize="10" fontWeight="700" fill="#fff">{r.it.symbol.length > Math.floor((r.w - 6) / 7.4) ? r.it.symbol.slice(0, Math.max(2, Math.floor((r.w - 6) / 7.4))) : r.it.symbol}</text>
                    <text x={r.x + 4} y={r.y + 23} fontSize="9" fill="rgba(255,255,255,0.8)">{r.it.label}</text>
                  </>
                )}
                <title>{`${r.it.symbol} ${r.it.label}`}</title>
              </g>
            ))}
          </g>
        ))}
      </svg>
    </div>
  )
}

export default function PulseScreens({ stocks, onSymbolClick }: Props) {
  const [tab, setTab] = useState<'scans' | 'heat'>('scans')
  const eq = useMemo(() => (stocks || []).filter(s => !INDICES.includes(s.symbol)), [stocks])

  const top = (arr: any[], key: (s: any) => number, desc: boolean, tone: Row['tone'], fmt: (s: any) => string): Row[] =>
    arr.slice().sort((a, b) => (desc ? key(b) - key(a) : key(a) - key(b))).slice(0, 5).map(s => ({ symbol: s.symbol, v: key(s), txt: fmt(s), tone }))

  const lists = useMemo(() => {
    const px = (s: any) => s.price_chg_pct || 0
    const oi = (s: any) => s.oi_chg_pct || 0
    return [
      { t: 'Price up', h: 'Biggest gainers', rows: top(eq.filter(s => px(s) > 0), px, true, 'up', s => pct(px(s), 1)) },
      { t: 'Price down', h: 'Biggest decliners', rows: top(eq.filter(s => px(s) < 0), px, false, 'down', s => pct(px(s), 1)) },
      { t: 'OI up', h: 'Open interest rising most', rows: top(eq.filter(s => oi(s) > 0), oi, true, 'amber', s => pct(oi(s), 1)) },
      { t: 'OI down', h: 'Open interest falling most', rows: top(eq.filter(s => oi(s) < 0), oi, false, 'amber', s => pct(oi(s), 1)) },
      { t: 'Volume surge', h: 'Volume vs its usual level', rows: top(eq.filter(s => s.vol_surge && (s.vol_ratio || 0) > 0), s => s.vol_ratio || 0, true, 'blue', s => `${(s.vol_ratio || 0).toFixed(1)}×`) },
      { t: 'Long buildup', h: 'OI up, price up', rows: top(eq.filter(s => s.signal === 'LONG_BUILDUP'), oi, true, 'up', s => `OI ${pct(oi(s), 1)}`) },
      { t: 'Short buildup', h: 'OI up, price down', rows: top(eq.filter(s => s.signal === 'SHORT_BUILDUP'), oi, true, 'down', s => `OI ${pct(oi(s), 1)}`) },
      { t: 'Short covering', h: 'OI down, price up', rows: top(eq.filter(s => s.signal === 'SHORT_COVERING'), px, true, 'cyan', s => pct(px(s), 1)) },
      { t: 'Long unwinding', h: 'OI down, price down', rows: top(eq.filter(s => s.signal === 'LONG_UNWINDING'), oi, false, 'amber', s => `OI ${pct(oi(s), 1)}`) },
      { t: 'Near 52W high', h: 'Closest to the 52-week high', rows: top(eq.filter(s => s.pct_from_52w_high != null && s.pct_from_52w_high >= -15), s => Math.abs(s.pct_from_52w_high), false, 'violet', s => (s.at_52w_high || Math.abs(s.pct_from_52w_high) < 0.05 ? 'At high' : `${Math.abs(Number(s.pct_from_52w_high)).toFixed(1)}% below`)) },
      { t: 'Narrowest CPR', h: 'Tightest pivot range', rows: top(eq.filter(s => (s.width_pct || 0) > 0), s => s.width_pct, false, 'violet', s => `${Number(s.width_pct).toFixed(2)}% wide`) },
      { t: 'War Zone', h: 'OI and CPR lining up', rows: top(eq.filter(s => (s.width_pct ?? 1) < 0.3 && !!s.has_oi_signal), oi, true, 'amber', s => `OI ${pct(oi(s), 1)}`) },
    ]
  }, [eq])

  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Screens</h2>
        <div className="flex gap-1.5">
          {([['scans', '🔎 Scans'], ['heat', '🟩 Heatmap']] as const).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`text-xs px-3 py-1.5 rounded-lg border ${tab === k ? 'border-indigo-500 bg-indigo-950/50 text-indigo-200' : 'border-gray-700 text-gray-400 hover:text-white'}`}>{l}</button>
          ))}
        </div>
      </div>
      {tab === 'scans' ? (
        <>
          <p className="text-[11px] text-gray-500 mb-2">Top 5 in each list, across all F&amp;O stocks. Click any stock to open its dashboard. A very large OI % on a flat price, or on a brand-new contract, is Stealth territory rather than a trend.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {lists.map(l => <ScanList key={l.t} title={l.t} hint={l.h} rows={l.rows} onClick={onSymbolClick} />)}
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-gray-800 bg-gray-900/30 p-3">
          <p className="text-[11px] text-gray-500 mb-2">Every F&amp;O stock as a tile, grouped by what OI and price are doing. Bigger tile = bigger move; stronger colour = bigger price change. Click a tile to open that stock.</p>
          <Heatmap stocks={eq} onClick={onSymbolClick} />
        </div>
      )}
    </div>
  )
}
