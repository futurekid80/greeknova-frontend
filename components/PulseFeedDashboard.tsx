'use client'
// Oct 31 2026: Market Pulse Feed in the Strike-Stealth dashboard format --
// strategy presets, sliders, KPI tiles, a Price-vs-OI quadrant scatter, leader
// lists and a sortable table with CSV. Pure client-side over the stocks the Pulse
// page already loads (OI change, price change, CPR, volume surge, 52W high);
// nothing new on the server. Replaces the old five-tab list (kept behind
// ?v=old on the page until Manish signs off).
import { useEffect, useMemo, useState } from 'react'
import { Download, RotateCcw, Search } from 'lucide-react'

export interface PulseRow {
  symbol: string
  cmp: number
  oi_chg_pct: number
  price_chg_pct: number
  signal: string
  label: string
  confluence?: boolean
  width_pct?: number
  width_pts?: number
  width_emoji?: string
  cpr_position?: string
  has_oi_signal?: boolean
  oi_now?: number
  oi_prev?: number
  vol_surge?: boolean
  vol_ratio?: number
  week52_high?: number
  pct_from_52w_high?: number | null
  at_52w_high?: boolean
}

type Sig = 'ALL' | 'LONG_BUILDUP' | 'SHORT_BUILDUP' | 'SHORT_COVERING' | 'LONG_UNWINDING'
type CprPos = 'ALL' | 'ABOVE_CPR' | 'INSIDE_CPR' | 'BELOW_CPR'
type OiDir = 'ALL' | 'UP' | 'DOWN'

interface F {
  minOi: number          // min |OI change %|
  minPx: number          // min |price change %|
  maxWidth: number | null // CPR width ceiling (%); null = off
  near52: number | null  // within N % of 52W high; null = off
  signal: Sig
  cpr: CprPos
  oiDir: OiDir
  volSurge: boolean
  warZone: boolean
  confluence: boolean
  sector: string
  search: string
}

const BASE: F = {
  minOi: 0, minPx: 0, maxWidth: null, near52: null, signal: 'ALL', cpr: 'ALL', oiDir: 'ALL',
  volSurge: false, warZone: false, confluence: false, sector: 'all', search: '',
}

const PRESETS: { id: string; label: string; f: Partial<F> }[] = [
  { id: 'all',     label: '📊 All F&O stocks', f: {} },
  { id: 'war',     label: '⚡ War Zone (narrow CPR + OI signal)', f: { warZone: true } },
  { id: 'lb',      label: '🟢 Long Buildup (OI ↑ price ↑)', f: { signal: 'LONG_BUILDUP', minOi: 2 } },
  { id: 'sb',      label: '🔴 Short Buildup (OI ↑ price ↓)', f: { signal: 'SHORT_BUILDUP', minOi: 2 } },
  { id: 'sc',      label: '🔵 Short Covering (OI ↓ price ↑)', f: { signal: 'SHORT_COVERING', minOi: 2 } },
  { id: 'lu',      label: '🟠 Long Unwinding (OI ↓ price ↓)', f: { signal: 'LONG_UNWINDING', minOi: 2 } },
  { id: 'build',   label: '📈 OI Builders (OI ↑ ≥5%)', f: { oiDir: 'UP', minOi: 5 } },
  { id: 'unwind',  label: '📉 OI Unwinders (OI ↓ ≥5%)', f: { oiDir: 'DOWN', minOi: 5 } },
  { id: 'brk',     label: '🚀 Breakout Setup (above CPR, OI ↑, volume surge)', f: { cpr: 'ABOVE_CPR', oiDir: 'UP', volSurge: true } },
  { id: 'h52',     label: '🔥 Near 52W High (within 2%)', f: { near52: 2 } },
  { id: 'vol',     label: '🔊 Volume Surge + OI move', f: { volSurge: true, minOi: 3 } },
  { id: 'tight',   label: '🎯 Tight CPR (<0.3%) with Confluence', f: { maxWidth: 0.3, confluence: true } },
]

const OI_STEPS = [0, 2, 5, 10, 20]
const PX_STEPS = [0, 1, 2, 3, 5]
const WIDTH_STEPS = [0.3, 0.5, 1, 2]
const NEAR_STEPS = [0.5, 1, 2, 5]
const SORTS = [
  ['act', 'Activity'], ['oi', 'OI Change'], ['px', 'Price Change'], ['cpr', 'Narrowest CPR'], ['h52', 'Closest 52W High'], ['vol', 'Volume'],
] as const
type SortKey = typeof SORTS[number][0]

const SIG_COL: Record<string, string> = {
  LONG_BUILDUP: '#10b981', SHORT_BUILDUP: '#f43f5e', SHORT_COVERING: '#22d3ee', LONG_UNWINDING: '#f59e0b',
}
const SIG_CHIP: Record<string, string> = {
  LONG_BUILDUP: 'text-emerald-300 border-emerald-700/60 bg-emerald-950/30',
  SHORT_BUILDUP: 'text-rose-300 border-rose-700/60 bg-rose-950/30',
  SHORT_COVERING: 'text-cyan-300 border-cyan-700/60 bg-cyan-950/30',
  LONG_UNWINDING: 'text-amber-300 border-amber-700/60 bg-amber-950/30',
  PUT_WRITING: 'text-emerald-300 border-emerald-700/60 bg-emerald-950/30',
  CALL_WRITING: 'text-rose-300 border-rose-700/60 bg-rose-950/30',
}
const INDEXES = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY', 'SENSEX']

const inr = (n: number | null | undefined) => (n == null || !n ? '—' : `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`)
const sgn = (n: number, d = 1) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(d)}%`

function Chip({ cls, children }: { cls: string; children: React.ReactNode }) {
  return <span className={`inline-block text-[10px] font-bold border rounded px-1.5 py-0.5 whitespace-nowrap ${cls}`}>{children}</span>
}

function Slider({ label, value, steps, fmt, onIdx, active = true, icon }: {
  label: string; value: number; steps: number[]; fmt: (v: number) => string; onIdx: (i: number) => void; active?: boolean; icon?: React.ReactNode
}) {
  const idx = Math.max(0, steps.findIndex(s => s >= value))
  return (
    <div className={`rounded-xl border p-3 flex-1 min-w-[200px] ${active ? 'border-gray-700 bg-gray-900/40' : 'border-gray-800 bg-gray-900/20 opacity-60'}`}>
      <div className="flex items-center justify-between text-xs mb-2">
        <span className="text-gray-300 font-semibold flex items-center gap-1.5">{icon}{label}</span>
        <span className="font-mono font-bold text-indigo-300">{fmt(value)}</span>
      </div>
      <input type="range" min={0} max={steps.length - 1} step={1} value={idx}
        onChange={e => onIdx(Number(e.target.value))} className="w-full accent-indigo-500" />
      <div className="flex justify-between text-[10px] text-gray-500 mt-1">
        {steps.map(s => <span key={s}>{fmt(s)}</span>)}
      </div>
    </div>
  )
}

export default function PulseFeedDashboard({
  stocks, cprData, sectors, onSymbolClick, loading,
}: {
  stocks: any[]
  cprData: any[]
  sectors: Record<string, string[]>
  onSymbolClick?: (sym: string) => void
  loading?: boolean
}) {
  const [f, setF] = useState<F>({ ...BASE })
  const [preset, setPreset] = useState<string>('all')
  const [moreOpen, setMoreOpen] = useState(false)
  const [howOpen, setHowOpen] = useState(true)
  useEffect(() => {
    try { if (localStorage.getItem('gn_pulse_howto') === '0') setHowOpen(false) } catch {}
  }, [])
  const toggleHow = () => setHowOpen(v => {
    try { localStorage.setItem('gn_pulse_howto', v ? '0' : '1') } catch {}
    return !v
  })
  const [sort, setSort] = useState<SortKey>('act')
  const [pageSize, setPageSize] = useState(25)
  const [page, setPage] = useState(1)

  const upd = (p: Partial<F>) => { setF(prev => ({ ...prev, ...p })); setPreset(''); setPage(1) }
  const applyPreset = (id: string) => {
    const p = PRESETS.find(x => x.id === id)
    if (!p) return
    setF({ ...BASE, ...p.f }); setPreset(id); setPage(1)
  }
  const reset = () => { setF({ ...BASE }); setPreset('all'); setPage(1) }

  const sectorOf = useMemo(() => {
    const m: Record<string, string> = {}
    for (const [sec, syms] of Object.entries(sectors || {})) for (const s of syms) m[s] = sec
    return m
  }, [sectors])

  // Merge CPR fields in (same fallbacks the old feed used).
  const all: PulseRow[] = useMemo(() => {
    const cprMap: Record<string, any> = Object.fromEntries((cprData || []).map((c: any) => [c.symbol, c]))
    return (stocks || []).map((s: any) => ({
      ...s,
      width_pct: s.width_pct ?? cprMap[s.symbol]?.width_pct,
      width_pts: s.width_pts ?? cprMap[s.symbol]?.width_pts,
      width_emoji: s.width_emoji ?? cprMap[s.symbol]?.width_emoji,
      cpr_position: s.cpr_position ?? cprMap[s.symbol]?.cpr_position,
      has_oi_signal: s.has_oi_signal ?? cprMap[s.symbol]?.has_oi_signal ?? false,
      confluence: s.confluence ?? cprMap[s.symbol]?.confluence ?? false,
    }))
  }, [stocks, cprData])

  const hasMarketData = all.some(s => (s.oi_chg_pct || 0) !== 0)
  const isWar = (s: PulseRow) => !INDEXES.includes(s.symbol) && (s.width_pct ?? 1) < 0.3 && !!s.has_oi_signal
  const sectorNames = useMemo(() => Object.keys(sectors || {}).sort(), [sectors])

  const rows = useMemo(() => {
    const q = f.search.trim().toLowerCase()
    return all.filter(s => {
      const oi = s.oi_chg_pct || 0
      const px = s.price_chg_pct || 0
      if (Math.abs(oi) < f.minOi) return false
      if (Math.abs(px) < f.minPx) return false
      if (f.oiDir === 'UP' && !(oi > 0)) return false
      if (f.oiDir === 'DOWN' && !(oi < 0)) return false
      if (f.maxWidth != null && !((s.width_pct ?? 99) <= f.maxWidth)) return false
      if (f.near52 != null && !(s.pct_from_52w_high != null && s.pct_from_52w_high >= -f.near52)) return false
      if (f.signal !== 'ALL' && s.signal !== f.signal) return false
      if (f.cpr !== 'ALL' && s.cpr_position !== f.cpr) return false
      if (f.volSurge && !s.vol_surge) return false
      if (f.warZone && !isWar(s)) return false
      if (f.confluence && !s.confluence) return false
      if (f.sector !== 'all' && sectorOf[s.symbol] !== f.sector) return false
      if (q && !s.symbol.toLowerCase().includes(q)) return false
      return true
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, f, sectorOf])

  const sorted = useMemo(() => {
    const a = [...rows]
    const act = (s: PulseRow) => (isWar(s) ? 0 : (s.width_pct ?? 1) < 0.3 ? 1 : 2)
    if (sort === 'act') a.sort((x, y) => act(x) - act(y) || Math.abs(y.oi_chg_pct || 0) - Math.abs(x.oi_chg_pct || 0))
    else if (sort === 'oi') a.sort((x, y) => Math.abs(y.oi_chg_pct || 0) - Math.abs(x.oi_chg_pct || 0))
    else if (sort === 'px') a.sort((x, y) => Math.abs(y.price_chg_pct || 0) - Math.abs(x.price_chg_pct || 0))
    else if (sort === 'cpr') a.sort((x, y) => (x.width_pct ?? 99) - (y.width_pct ?? 99))
    else if (sort === 'h52') a.sort((x, y) => (y.pct_from_52w_high ?? -999) - (x.pct_from_52w_high ?? -999))
    else a.sort((x, y) => (y.vol_ratio || 0) - (x.vol_ratio || 0))
    return a
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, sort])

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const cur = Math.min(page, pages)
  const pageRows = sorted.slice((cur - 1) * pageSize, cur * pageSize)

  // KPIs
  const n = rows.length
  const cnt = (sig: string) => rows.filter(s => s.signal === sig).length
  const lb = cnt('LONG_BUILDUP'), sb = cnt('SHORT_BUILDUP'), sc = cnt('SHORT_COVERING'), lu = cnt('LONG_UNWINDING')
  const war = rows.filter(isWar).length
  const up = rows.filter(s => (s.price_chg_pct || 0) > 0).length
  const down = rows.filter(s => (s.price_chg_pct || 0) < 0).length
  const topLong = [...rows].filter(s => s.signal === 'LONG_BUILDUP' && !INDEXES.includes(s.symbol)).sort((a, b) => (b.oi_chg_pct || 0) - (a.oi_chg_pct || 0)).slice(0, 5)
  const topShort = [...rows].filter(s => s.signal === 'SHORT_BUILDUP' && !INDEXES.includes(s.symbol)).sort((a, b) => (b.oi_chg_pct || 0) - (a.oi_chg_pct || 0)).slice(0, 5)

  // Scatter: x = price %, y = OI % (four signal quadrants)
  const W = 640, H = 320, L = 46, R = 14, T = 16, B = 40
  const XM = 6
  // Scale to the typical range (95th percentile) so a few extreme outliers don't flatten
  // everyone else; outliers are drawn at the chart edge.
  const absOi = rows.map(s => Math.abs(s.oi_chg_pct || 0)).sort((a, b) => a - b)
  const yRaw = absOi.length ? absOi[Math.min(absOi.length - 1, Math.floor(absOi.length * 0.95))] : 0
  const YM = Math.max(10, Math.min(60, Math.ceil(yRaw / 5) * 5))
  const px = (v: number) => L + ((Math.max(-XM, Math.min(XM, v)) + XM) / (2 * XM)) * (W - L - R)
  const py = (v: number) => T + ((YM - Math.max(-YM, Math.min(YM, v))) / (2 * YM)) * (H - T - B)
  const midX = px(0), midY = py(0)
  const xTicks = [-6, -4, -2, 0, 2, 4, 6]
  const yTicks = [-YM, -YM / 2, 0, YM / 2, YM].map(t => Math.round(t))

  const pill = (on: boolean, extra = '') =>
    `px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${on ? 'bg-indigo-950/60 text-indigo-300 border-indigo-600' : 'bg-gray-800/40 text-gray-500 border-gray-700 hover:text-white'} ${extra}`

  const open = (sym: string) => { if (onSymbolClick) onSymbolClick(sym); else upd({ search: sym }) }

  const downloadCsv = () => {
    const head = ['Symbol', 'Sector', 'CMP', 'PriceChg%', 'OIChg%', 'Signal', 'CPRPosition', 'CPRWidth%', 'VolRatio', 'VolSurge', '52WHigh', 'From52WHigh%', 'WarZone', 'Confluence']
    const esc = (v: any) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
    const lines = [head.join(',')].concat(sorted.map(s => [
      s.symbol, sectorOf[s.symbol] || '', s.cmp, s.price_chg_pct, s.oi_chg_pct, s.label || s.signal, s.cpr_position || '',
      s.width_pct ?? '', s.vol_ratio ?? '', s.vol_surge ? 'Y' : '', s.week52_high ?? '', s.pct_from_52w_high ?? '',
      isWar(s) ? 'Y' : '', s.confluence ? 'Y' : '',
    ].map(esc).join(',')))
    try {
      const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `greeknova-pulse-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
    } catch {}
  }

  const cprShort: Record<string, string> = { ABOVE_CPR: '↑ Above', BELOW_CPR: '↓ Below', INSIDE_CPR: '⟷ Inside' }
  const cprCol: Record<string, string> = { ABOVE_CPR: 'text-emerald-400', BELOW_CPR: 'text-rose-400', INSIDE_CPR: 'text-amber-400' }

  return (
    <div className="space-y-4">
      {/* How to use */}
      <div className="rounded-xl border border-indigo-800/50 bg-indigo-950/20">
        <button onClick={toggleHow} className="w-full flex items-center justify-between px-4 py-3 text-left">
          <span className="text-sm font-bold text-indigo-200">📖 How to use this screen</span>
          <span className="text-xs text-indigo-300">{howOpen ? 'Hide ▴' : 'Show ▾'}</span>
        </button>
        {howOpen && (
          <div className="px-4 pb-4 text-xs text-gray-300 leading-relaxed">
            <ol className="list-decimal pl-5 space-y-2">
              <li>
                <b className="text-white">Start with a preset</b> (the buttons at the top). Each one is a ready-made question, like
                “who has a Long Buildup?” or “what is a War Zone setup?”. Then fine-tune with the sliders, or press Reset.
              </li>
              <li>
                <b className="text-white">Read the four signals.</b> They come from two things together: price and open interest (OI).
                <b> Long Buildup</b> = OI up + price up (fresh buyers). <b>Short Buildup</b> = OI up + price down (fresh sellers).
                <b> Short Covering</b> = OI down + price up (sellers exiting). <b>Long Unwinding</b> = OI down + price down (buyers exiting).
              </li>
              <li>
                <b className="text-white">The chart</b> puts every stock by price change (left to right) and OI change (bottom to top).
                Top-right is Long Buildup, top-left is Short Buildup, bottom-right is Short Covering, bottom-left is Long Unwinding.
                Stocks far from the centre are moving the most. Click a dot to open that stock.
              </li>
              <li>
                <b className="text-white">War Zone</b> = a very narrow CPR (under 0.30% wide) together with an active OI signal. A narrow CPR means
                the day is expected to trend; the OI signal says positions are being built. 🔗 marks a stock that also has a futures-level stealth buildup.
              </li>
              <li>
                <b className="text-white">Volume</b> shows today’s volume against its normal level. 🔊 means a surge. A signal backed by a volume surge is stronger than the same signal on thin volume.
              </li>
              <li>
                OI change compares the previous close with the latest data, so before the market opens it shows yesterday’s move. Click any symbol to open its full Stock Command Centre.
              </li>
            </ol>
          </div>
        )}
      </div>

      {/* Presets */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/30 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-400 mr-1">✨ Strategy Presets:</span>
          {PRESETS.map(p => (
            <button key={p.id} onClick={() => applyPreset(p.id)} className={pill(preset === p.id)}>{p.label}</button>
          ))}
          <button onClick={reset} className="ml-auto flex items-center gap-1.5 text-xs text-gray-400 hover:text-white border border-gray-700 rounded-lg px-3 py-1.5">
            <RotateCcw size={12} /> Reset Filters
          </button>
        </div>
      </div>

      {/* Sliders + toggles */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/30 p-3 space-y-3">
        <div className="flex flex-wrap gap-3">
          <Slider label="Min OI Change (±)" value={f.minOi} steps={OI_STEPS} fmt={v => `${v}%`} onIdx={i => upd({ minOi: OI_STEPS[i] })} />
          <Slider label="Min Price Move (±)" value={f.minPx} steps={PX_STEPS} fmt={v => `${v}%`} onIdx={i => upd({ minPx: PX_STEPS[i] })} />
          <Slider label="Narrow CPR (width)" value={f.maxWidth ?? 0.3} steps={WIDTH_STEPS} fmt={v => `≤ ${v}%`}
            active={f.maxWidth != null} onIdx={i => upd({ maxWidth: WIDTH_STEPS[i] })}
            icon={<input type="checkbox" checked={f.maxWidth != null} onChange={e => upd({ maxWidth: e.target.checked ? 0.3 : null })} className="accent-emerald-500" />} />
          <Slider label="Near 52W High" value={f.near52 ?? 2} steps={NEAR_STEPS} fmt={v => `≤ ${v}%`}
            active={f.near52 != null} onIdx={i => upd({ near52: NEAR_STEPS[i] })}
            icon={<input type="checkbox" checked={f.near52 != null} onChange={e => upd({ near52: e.target.checked ? 2 : null })} className="accent-emerald-500" />} />
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="rounded-xl border border-gray-700 bg-gray-900/40 p-3 flex-1 min-w-[260px]">
            <div className="text-xs text-gray-300 font-semibold mb-2">🧭 Signal</div>
            <div className="flex flex-wrap gap-1.5">
              {([['ALL', 'All'], ['LONG_BUILDUP', 'Long Build'], ['SHORT_BUILDUP', 'Short Build'], ['SHORT_COVERING', 'Short Cover'], ['LONG_UNWINDING', 'Long Unwind']] as const).map(([k, l]) => (
                <button key={k} onClick={() => upd({ signal: k })} className={pill(f.signal === k, '!px-2.5 !py-1')}>{l}</button>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-gray-700 bg-gray-900/40 p-3 flex-1 min-w-[240px]">
            <div className="text-xs text-gray-300 font-semibold mb-2">📐 CPR position</div>
            <div className="flex flex-wrap gap-1.5">
              {([['ALL', 'All'], ['ABOVE_CPR', '↑ Above'], ['INSIDE_CPR', '⟷ Inside'], ['BELOW_CPR', '↓ Below']] as const).map(([k, l]) => (
                <button key={k} onClick={() => upd({ cpr: k })} className={pill(f.cpr === k, '!px-2.5 !py-1')}>{l}</button>
              ))}
            </div>
          </div>
          <div className="flex-1 min-w-[220px] space-y-2">
            <select value={f.sector} onChange={e => upd({ sector: e.target.value })}
              className="w-full bg-gray-800/40 border border-gray-700 text-gray-200 text-xs rounded-lg px-2 py-2 focus:outline-none">
              <option value="all">All sectors</option>
              {sectorNames.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
              <input value={f.search} onChange={e => upd({ search: e.target.value })} placeholder="Filter stock (e.g. NIFTY, BEL)…"
                className="w-full bg-gray-800/40 border border-gray-700 text-gray-200 text-xs rounded-lg pl-7 pr-3 py-2 focus:outline-none focus:border-indigo-600 placeholder-gray-600" />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between flex-wrap gap-2">
          <button onClick={() => setMoreOpen(v => !v)} className="text-xs text-indigo-300 hover:text-indigo-200">
            {moreOpen ? '▾' : '▸'} More Filters (OI direction, volume, War Zone, Confluence)
          </button>
          <span className="text-xs text-gray-400">Showing <b className="text-white">{n}</b> of {all.length} stocks</span>
        </div>
        {moreOpen && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {([['ALL', 'OI: any'], ['UP', 'OI ↑ only'], ['DOWN', 'OI ↓ only']] as const).map(([k, l]) => (
              <button key={k} onClick={() => upd({ oiDir: k })} className={pill(f.oiDir === k, '!py-1')}>{l}</button>
            ))}
            <button onClick={() => upd({ volSurge: !f.volSurge })} className={pill(f.volSurge, '!py-1')}>🔊 Volume surge</button>
            <button onClick={() => upd({ warZone: !f.warZone })} className={pill(f.warZone, '!py-1')}>⚡ War Zone only</button>
            <button onClick={() => upd({ confluence: !f.confluence })} className={pill(f.confluence, '!py-1')}>🔗 Confluence only</button>
          </div>
        )}
      </div>

      {loading && all.length === 0 && (
        <div className="rounded-lg border border-indigo-800/50 bg-indigo-950/20 px-3 py-2 text-xs text-indigo-200">Loading the F&amp;O universe…</div>
      )}

      {/* KPI tiles */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-3">
          <p className="text-[10px] text-gray-500 tracking-wide">MATCHING</p>
          <p className="text-2xl font-black text-white mt-1">{n} <span className="text-xs font-normal text-gray-500">stocks</span></p>
          <p className="text-[10px] text-gray-500 mt-0.5">{up} up · {down} down</p>
        </div>
        <div className="rounded-xl border border-emerald-900/50 bg-emerald-950/10 p-3">
          <p className="text-[10px] text-gray-500 tracking-wide">LONG BUILDUP</p>
          <p className="text-2xl font-black text-emerald-400 mt-1">{lb}</p>
        </div>
        <div className="rounded-xl border border-rose-900/50 bg-rose-950/10 p-3">
          <p className="text-[10px] text-gray-500 tracking-wide">SHORT BUILDUP</p>
          <p className="text-2xl font-black text-rose-400 mt-1">{sb}</p>
        </div>
        <div className="rounded-xl border border-cyan-900/50 bg-cyan-950/10 p-3">
          <p className="text-[10px] text-gray-500 tracking-wide">SHORT COVERING</p>
          <p className="text-2xl font-black text-cyan-400 mt-1">{sc}</p>
        </div>
        <div className="rounded-xl border border-amber-900/50 bg-amber-950/10 p-3">
          <p className="text-[10px] text-gray-500 tracking-wide">LONG UNWINDING</p>
          <p className="text-2xl font-black text-amber-400 mt-1">{lu}</p>
        </div>
        <div className="rounded-xl border border-orange-900/50 bg-orange-950/10 p-3">
          <p className="text-[10px] text-gray-500 tracking-wide">⚡ WAR ZONE</p>
          <p className="text-2xl font-black text-orange-300 mt-1">{war}</p>
        </div>
      </div>

      {/* Scatter + leaders */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-xl border border-gray-800 bg-gray-900/30 p-4">
          <p className="text-sm font-bold text-gray-200">Price Move vs. OI Change</p>
          <p className="text-[11px] text-gray-500 mb-2">Each dot is a stock. The corner it sits in is its signal; the farther from the centre, the stronger the move. Click a dot to open that stock.</p>
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-gray-400 mb-1">
            <span><span style={{ color: SIG_COL.LONG_BUILDUP }}>●</span> Long Buildup</span>
            <span><span style={{ color: SIG_COL.SHORT_BUILDUP }}>●</span> Short Buildup</span>
            <span><span style={{ color: SIG_COL.SHORT_COVERING }}>●</span> Short Covering</span>
            <span><span style={{ color: SIG_COL.LONG_UNWINDING }}>●</span> Long Unwinding</span>
            <span>◌ War Zone</span>
          </div>
          {!hasMarketData && all.length > 0 && (
            <div className="rounded-lg border border-amber-800/50 bg-amber-950/20 px-3 py-2 text-xs text-amber-200 mb-2">
              OI data hasn’t come in yet, so every stock sits at zero. It fills in once the first snapshots arrive.
            </div>
          )}
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Price change versus OI change">
            <rect x={midX} y={T} width={W - R - midX} height={midY - T} fill="rgba(16,185,129,0.07)" />
            <rect x={L} y={T} width={midX - L} height={midY - T} fill="rgba(244,63,94,0.07)" />
            <rect x={midX} y={midY} width={W - R - midX} height={H - B - midY} fill="rgba(34,211,238,0.06)" />
            <rect x={L} y={midY} width={midX - L} height={H - B - midY} fill="rgba(245,158,11,0.06)" />
            <text x={W - R - 6} y={T + 13} textAnchor="end" fontSize="10" fill="#34d399" fontWeight="700">LONG BUILDUP</text>
            <text x={L + 6} y={T + 13} fontSize="10" fill="#fb7185" fontWeight="700">SHORT BUILDUP</text>
            <text x={W - R - 6} y={H - B - 6} textAnchor="end" fontSize="10" fill="#22d3ee" fontWeight="700">SHORT COVERING</text>
            <text x={L + 6} y={H - B - 6} fontSize="10" fill="#fbbf24" fontWeight="700">LONG UNWINDING</text>
            {yTicks.map(t => (
              <g key={t}>
                <line x1={L} x2={W - R} y1={py(t)} y2={py(t)} stroke="rgba(255,255,255,0.07)" />
                <text x={L - 6} y={py(t) + 3} textAnchor="end" fontSize="9" fill="#6b7280">{t > 0 ? '+' : ''}{t}%</text>
              </g>
            ))}
            {xTicks.map(t => (
              <g key={t}>
                <line x1={px(t)} x2={px(t)} y1={T} y2={H - B} stroke="rgba(255,255,255,0.05)" />
                <text x={px(t)} y={H - B + 13} textAnchor="middle" fontSize="9" fill="#6b7280">{t > 0 ? '+' : ''}{t}%</text>
              </g>
            ))}
            <line x1={midX} x2={midX} y1={T} y2={H - B} stroke="rgba(99,102,241,0.6)" />
            <line x1={L} x2={W - R} y1={midY} y2={midY} stroke="rgba(99,102,241,0.6)" />
            <text x={(L + W - R) / 2} y={H - 6} textAnchor="middle" fontSize="9" fill="#9ca3af" fontWeight="700">PRICE CHANGE %</text>
            <text transform={`translate(11 ${(T + H - B) / 2}) rotate(-90)`} textAnchor="middle" fontSize="9" fill="#9ca3af" fontWeight="700">OI CHANGE %</text>
            {rows.map(s => {
              const col = SIG_COL[s.signal] || '#9ca3af'
              const r = s.vol_surge ? 6.5 : 4.5
              const cx = px(s.price_chg_pct || 0), cy = py(s.oi_chg_pct || 0)
              return (
                <g key={s.symbol} style={{ cursor: 'pointer' }} onClick={() => open(s.symbol)}>
                  <circle cx={cx} cy={cy} r={r} fill={col} fillOpacity={0.55} stroke={col} strokeWidth={1.5} />
                  {isWar(s) && <circle cx={cx} cy={cy} r={r + 3} fill="none" stroke={col} strokeDasharray="2 2" />}
                  <title>{`${s.symbol} · Price ${sgn(s.price_chg_pct || 0, 2)} · OI ${sgn(s.oi_chg_pct || 0, 1)}${s.label ? ' · ' + s.label : ''}`}</title>
                </g>
              )
            })}
          </svg>
          <p className="text-[10px] text-gray-600">Bigger dot = volume surge. Dots beyond the edge are drawn at the edge.</p>
        </div>

        <div className="rounded-xl border border-gray-800 bg-gray-900/30 p-4 space-y-4">
          <div>
            <p className="text-sm font-bold text-emerald-300">Strongest Long Buildup</p>
            <p className="text-[11px] text-gray-500 mb-2">Highest OI growth with price up</p>
            {topLong.length === 0 ? <p className="text-xs text-gray-600">None in the current view.</p> : (
              <div className="space-y-1.5">
                {topLong.map(s => (
                  <button key={s.symbol} onClick={() => open(s.symbol)} className="w-full flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900/40 px-3 py-1.5 hover:border-emerald-700/60">
                    <span className="text-xs font-bold text-white">{s.symbol}</span>
                    <span className="text-[11px] text-gray-400">OI <b className="text-emerald-400">{sgn(s.oi_chg_pct || 0)}</b> · Px {sgn(s.price_chg_pct || 0)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <p className="text-sm font-bold text-rose-300">Strongest Short Buildup</p>
            <p className="text-[11px] text-gray-500 mb-2">Highest OI growth with price down</p>
            {topShort.length === 0 ? <p className="text-xs text-gray-600">None in the current view.</p> : (
              <div className="space-y-1.5">
                {topShort.map(s => (
                  <button key={s.symbol} onClick={() => open(s.symbol)} className="w-full flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900/40 px-3 py-1.5 hover:border-rose-700/60">
                    <span className="text-xs font-bold text-white">{s.symbol}</span>
                    <span className="text-[11px] text-gray-400">OI <b className="text-rose-400">{sgn(s.oi_chg_pct || 0)}</b> · Px {sgn(s.price_chg_pct || 0)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/30">
        <div className="flex flex-wrap items-center justify-between gap-2 p-3">
          <p className="text-sm font-bold text-gray-200">Screened Stocks <span className="ml-2 text-[11px] font-normal text-gray-400 border border-gray-700 rounded-full px-2 py-0.5">{n} records</span></p>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-gray-500">Sort By:</span>
            {SORTS.map(([k, label]) => (
              <button key={k} onClick={() => { setSort(k); setPage(1) }} className={pill(sort === k, '!py-1')}>{label}</button>
            ))}
            <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }}
              className="bg-gray-800/40 border border-gray-700 text-gray-300 text-xs rounded-lg px-2 py-1.5">
              {[25, 50, 100].map(s => <option key={s} value={s}>{s} / page</option>)}
            </select>
            <button onClick={downloadCsv} disabled={sorted.length === 0}
              className="flex items-center gap-1.5 text-gray-400 hover:text-white border border-gray-700 rounded-lg px-2.5 py-1.5 disabled:opacity-40">
              <Download size={12} /> CSV
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[920px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-wide text-gray-500 text-left border-b border-gray-800">
                <th className="px-3 py-2">Symbol</th>
                <th className="px-2 py-2 text-right">CMP</th>
                <th className="px-2 py-2">Signal</th>
                <th className="px-2 py-2 text-right">OI Change</th>
                <th className="px-2 py-2 text-right">Volume</th>
                <th className="px-2 py-2 text-right">52W High</th>
                <th className="px-2 py-2">CPR</th>
                <th className="px-2 py-2">Zone</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map(s => {
                const isIdx = INDEXES.includes(s.symbol)
                const war = isWar(s)
                const narrow = !isIdx && (s.width_pct ?? 1) < 0.3
                return (
                  <tr key={s.symbol} className={`border-b border-gray-800/60 hover:bg-gray-800/20 ${isIdx ? 'bg-gray-900/20' : ''}`}>
                    <td className="px-3 py-2">
                      <button onClick={() => open(s.symbol)} className="text-left">
                        <span className="font-bold text-white hover:text-indigo-300">{s.symbol}</span>
                        {isIdx && <span className="ml-1.5 text-[10px] text-gray-500 bg-gray-800 px-1 rounded">IDX</span>}
                        {s.confluence && <span className="ml-1" title="Also has a futures-level stealth buildup">🔗</span>}
                        {sectorOf[s.symbol] && <div className="text-[10px] text-gray-500">{sectorOf[s.symbol]}</div>}
                      </button>
                    </td>
                    <td className="px-2 py-2 text-right">
                      <span className="font-bold text-amber-400">{inr(s.cmp)}</span>
                      {!!s.price_chg_pct && (
                        <div className={`text-[10px] ${s.price_chg_pct >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{sgn(s.price_chg_pct, 2)}</div>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      {s.label ? <Chip cls={SIG_CHIP[s.signal] || 'text-gray-400 border-gray-700 bg-gray-900/30'}>{s.label}</Chip> : <span className="text-gray-600">—</span>}
                    </td>
                    <td className="px-2 py-2 text-right">
                      {s.oi_chg_pct ? <span className={`font-bold ${s.oi_chg_pct > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{s.oi_chg_pct > 0 ? '↗ ' : '↘ '}{sgn(s.oi_chg_pct)}</span> : <span className="text-gray-600">—</span>}
                    </td>
                    <td className="px-2 py-2 text-right">
                      {s.vol_ratio ? (
                        <span className={s.vol_surge ? 'font-bold text-fuchsia-300' : 'text-gray-400'}>{s.vol_surge ? '🔊 ' : ''}{s.vol_ratio.toFixed(1)}×</span>
                      ) : <span className="text-gray-600">—</span>}
                    </td>
                    <td className="px-2 py-2 text-right">
                      {s.week52_high ? (
                        <>
                          <span className={`font-bold ${s.at_52w_high ? 'text-fuchsia-400' : 'text-gray-400'}`}>{s.at_52w_high ? '🔥 ' : ''}{inr(s.week52_high)}</span>
                          {s.pct_from_52w_high != null && (
                            <div className={`text-[10px] ${s.at_52w_high ? 'text-fuchsia-500 font-semibold' : 'text-gray-600'}`}>
                              {s.at_52w_high ? 'At 52W High' : `${Math.abs(s.pct_from_52w_high).toFixed(1)}% away`}
                            </div>
                          )}
                        </>
                      ) : <span className="text-gray-600">—</span>}
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-1">
                        {s.width_emoji && <span>{s.width_emoji}</span>}
                        <span className={`font-medium ${cprCol[s.cpr_position || ''] || 'text-gray-600'}`}>{cprShort[s.cpr_position || ''] || '—'}</span>
                      </div>
                      {!!s.width_pts && s.width_pts > 0 && <div className="text-[10px] text-gray-500">{s.width_pts.toFixed(1)} pts{s.width_pct != null ? ` · ${s.width_pct.toFixed(2)}%` : ''}</div>}
                    </td>
                    <td className="px-2 py-2">
                      {war ? <Chip cls="text-orange-300 border-orange-700/60 bg-orange-950/50">⚡ War Zone</Chip>
                        : narrow ? <Chip cls="text-amber-400 border-amber-800/40 bg-amber-950/30">👀 Watch</Chip>
                        : <span className="text-gray-700">—</span>}
                    </td>
                  </tr>
                )
              })}
              {pageRows.length === 0 && (
                <tr><td colSpan={8} className="px-3 py-8 text-center text-gray-500">
                  {loading && all.length === 0 ? 'Loading…'
                    : all.length === 0 ? 'No data available'
                    : `None of the ${all.length} stocks match these filters — try a different preset or Reset Filters.`}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between p-3 text-xs text-gray-500">
          <span>Showing {n === 0 ? 0 : (cur - 1) * pageSize + 1} to {Math.min(cur * pageSize, n)} of {n} matching stocks</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(Math.max(1, cur - 1))} disabled={cur <= 1} className="px-2 py-1 border border-gray-700 rounded disabled:opacity-30">‹</button>
            <span>Page {cur} of {pages}</span>
            <button onClick={() => setPage(Math.min(pages, cur + 1))} disabled={cur >= pages} className="px-2 py-1 border border-gray-700 rounded disabled:opacity-30">›</button>
          </div>
        </div>
      </div>
      <p className="text-[11px] text-gray-600">
        Educational analytics only — buildup and unwinding labels describe what open interest and price did, not what will happen next. Not a trade call.
      </p>
    </div>
  )
}
