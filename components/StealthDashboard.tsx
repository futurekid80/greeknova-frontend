'use client'
// Oct 31 2026 (Manish's Google-Sheets template, "Options OI & Low-Movement
// Screener"): dashboard view for Option Strike Stealth Buildup -- strategy
// presets, sliders, KPI tiles, OI-vs-premium scatter with the absorption
// corridor, top-stock list and a sortable table. Pure client-side over the hits
// the page already fetched (live scan or saved-today), nothing new on the server.
import { useEffect, useMemo, useState } from 'react'
import { Download, RotateCcw, Search } from 'lucide-react'

export interface DashHit {
  symbol: string
  is_confluence: boolean
  strike: number
  expiry: string | null
  option_type: 'CE' | 'PE'
  strikes_away: number | null
  cmp: number | null
  atm_strike: number | null
  tier: 'ELITE' | 'STRONG' | 'WATCH'
  oi_pct: number
  old_oi: number
  new_oi: number
  premium_pct: number
  old_premium: number
  new_premium: number
  activity?: 'WRITING' | 'BUYING' | 'NEUTRAL'
  activity_label?: string
  freshness?: string
}

interface F {
  minOI: number          // contracts
  minPct: number         // OI % increase
  maxPrem: number | null // |premium %| ceiling; null = off
  money: 'ALL' | 'ATM' | 'OTM' | 'ITM'
  dist: number           // 0 = any, else max strikes away
  type: 'ALL' | 'CE' | 'PE'
  activity: 'ALL' | 'WRITING' | 'BUYING' | 'NEUTRAL'
  tier: 'ALL' | 'ELITE' | 'STRONG' | 'WATCH'
  confluence: boolean
  expiry: string
  search: string
}

const BASE: F = { minOI: 0, minPct: 0, maxPrem: null, money: 'ALL', dist: 0, type: 'ALL', activity: 'ALL', tier: 'ALL', confluence: false, expiry: 'all', search: '' }

const PRESETS: { id: string; label: string; f: Partial<F> }[] = [
  { id: 'quiet',  label: '😶 Quiet Absorption (Quiet activity, |Prem%|≤5%)', f: { activity: 'NEUTRAL', maxPrem: 5 } },
  { id: 'all',    label: '🎯 All Absorption (OI>50K, OI%>100%, |Prem%|≤5%)', f: { minOI: 50000, minPct: 100, maxPrem: 5 } },
  { id: 'write',  label: '✍️ Institutional Writing (Calls & Puts)', f: { activity: 'WRITING' } },
  { id: 'atm',    label: '🎯 ATM Absorption (|Prem%|≤5%)', f: { money: 'ATM', maxPrem: 5 } },
  { id: 'otm',    label: '⚡ OTM Absorption (|Prem%|≤5%)', f: { money: 'OTM', maxPrem: 5 } },
  { id: 'tight',  label: '⚡ Ultra-Tight (|Prem%|≤2%, OI%>100%)', f: { maxPrem: 2, minPct: 100 } },
  { id: 'calls',  label: '📈 Stealth Calls (CE, |Prem%|≤5%)', f: { type: 'CE', maxPrem: 5 } },
  { id: 'puts',   label: '📉 Stealth Puts (PE, |Prem%|≤5%)', f: { type: 'PE', maxPrem: 5 } },
  { id: 'big',    label: '📊 OI>50K & OI%>100% (Any Premium)', f: { minOI: 50000, minPct: 100 } },
  { id: 'mega',   label: '🔥 Mega OI (>200K, >200%)', f: { minOI: 200000, minPct: 200 } },
]

const OI_STEPS = [0, 50000, 100000, 250000, 500000]
const PCT_STEPS = [0, 50, 100, 200, 500]
const PREM_STEPS = [2, 5, 10, 15]
const SORTS = [['move', 'Lowest Move'], ['pct', 'OI% Buildup'], ['oi', 'New OI']] as const

const fmtOI = (n: number) => {
  if (Math.abs(n) >= 10000000) return `${(n / 10000000).toFixed(1)} Cr`
  if (Math.abs(n) >= 100000) return `${(n / 100000).toFixed(1)} L`
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)} K`
  return n.toLocaleString('en-IN')
}
const fmtExp = (e: string | null) => {
  if (!e) return ''
  try { return new Date(e + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) } catch { return e }
}
const inr = (n: number | null | undefined) => (n == null ? '—' : `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`)

function moneyness(h: DashHit): { label: 'ATM' | 'OTM' | 'ITM'; n: number } {
  const n = Math.abs(h.strikes_away ?? 0)
  if (h.strikes_away === 0 || (h.atm_strike != null && h.strike === h.atm_strike)) return { label: 'ATM', n: 0 }
  const ref = h.cmp ?? h.atm_strike
  if (ref == null) return { label: 'OTM', n }
  const otm = h.option_type === 'CE' ? h.strike > ref : h.strike < ref
  return { label: otm ? 'OTM' : 'ITM', n }
}

const MONEY_CHIP: Record<string, string> = {
  ATM: 'text-sky-300 border-sky-700/60 bg-sky-950/40',
  OTM: 'text-amber-300 border-amber-700/60 bg-amber-950/30',
  ITM: 'text-teal-300 border-teal-700/60 bg-teal-950/30',
}
const ACT_CHIP: Record<string, string> = {
  WRITING: 'text-amber-200 border-amber-700/60 bg-amber-950/30',
  BUYING: 'text-sky-200 border-sky-700/60 bg-sky-950/30',
  NEUTRAL: 'text-emerald-200 border-emerald-700/60 bg-emerald-950/30',
}
const ACT_ICON: Record<string, string> = { WRITING: '✍️', BUYING: '🛒', NEUTRAL: '😶' }
const TIER_CHIP: Record<string, string> = {
  ELITE: 'text-purple-300 border-purple-700/60 bg-purple-950/40',
  STRONG: 'text-emerald-300 border-emerald-700/60 bg-emerald-950/30',
  WATCH: 'text-sky-300 border-sky-700/60 bg-sky-950/30',
}
// Sheet convention: CE green, PE red.
const CE_COL = '#10b981'
const PE_COL = '#f43f5e'

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

export default function StealthDashboard({
  hits, loading, error, emptyHint, onDownload,
}: {
  hits: DashHit[]
  loading: boolean
  error?: string
  emptyHint?: string
  onDownload: (rows: DashHit[]) => void
}) {
  const [f, setF] = useState<F>({ ...BASE, ...PRESETS[1].f })
  const [preset, setPreset] = useState<string>('all')
  const [moreOpen, setMoreOpen] = useState(false)
  const [howOpen, setHowOpen] = useState(true)
  useEffect(() => {
    try { if (localStorage.getItem('gn_stealth_howto') === '0') setHowOpen(false) } catch {}
  }, [])
  const toggleHow = () => setHowOpen(v => {
    try { localStorage.setItem('gn_stealth_howto', v ? '0' : '1') } catch {}
    return !v
  })
  const [sort, setSort] = useState<'move' | 'pct' | 'oi'>('move')
  const [pageSize, setPageSize] = useState(25)
  const [page, setPage] = useState(1)

  const upd = (p: Partial<F>) => { setF(prev => ({ ...prev, ...p })); setPreset(''); setPage(1) }
  const applyPreset = (id: string) => {
    const p = PRESETS.find(x => x.id === id)
    if (!p) return
    setF({ ...BASE, ...p.f }); setPreset(id); setPage(1)
  }
  const reset = () => { setF({ ...BASE }); setPreset(''); setPage(1) }

  const expiries = useMemo(() => Array.from(new Set(hits.map(h => h.expiry).filter((e): e is string => !!e))).sort(), [hits])

  const rows = useMemo(() => {
    const q = f.search.trim().toLowerCase()
    return hits.filter(h => {
      if (h.new_oi < f.minOI) return false
      if (h.oi_pct < f.minPct) return false
      if (f.maxPrem != null && Math.abs(h.premium_pct) > f.maxPrem) return false
      if (f.type !== 'ALL' && h.option_type !== f.type) return false
      if (f.activity !== 'ALL' && h.activity !== f.activity) return false
      if (f.tier !== 'ALL' && h.tier !== f.tier) return false
      if (f.confluence && !h.is_confluence) return false
      if (f.expiry !== 'all' && h.expiry !== f.expiry) return false
      if (q && !h.symbol.toLowerCase().includes(q)) return false
      const m = moneyness(h)
      if (f.money !== 'ALL' && m.label !== f.money) return false
      if (f.dist > 0 && m.n > f.dist) return false
      return true
    })
  }, [hits, f])

  const sorted = useMemo(() => {
    const a = [...rows]
    if (sort === 'move') a.sort((x, y) => Math.abs(x.premium_pct) - Math.abs(y.premium_pct))
    else if (sort === 'pct') a.sort((x, y) => y.oi_pct - x.oi_pct)
    else a.sort((x, y) => y.new_oi - x.new_oi)
    return a
  }, [rows, sort])

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const cur = Math.min(page, pages)
  const pageRows = sorted.slice((cur - 1) * pageSize, cur * pageSize)

  // KPIs
  const n = rows.length
  const avgOI = n ? rows.reduce((s, h) => s + h.oi_pct, 0) / n : 0
  const avgMove = n ? rows.reduce((s, h) => s + Math.abs(h.premium_pct), 0) / n : 0
  const quiet = rows.filter(h => h.activity === 'NEUTRAL').length
  const ce = rows.filter(h => h.option_type === 'CE').length
  const pe = n - ce
  const bySym = new Map<string, { sym: string; ce: number; pe: number }>()
  for (const h of rows) {
    const r = bySym.get(h.symbol) ?? { sym: h.symbol, ce: 0, pe: 0 }
    if (h.option_type === 'CE') r.ce++; else r.pe++
    bySym.set(h.symbol, r)
  }
  const top = Array.from(bySym.values()).sort((a, b) => (b.ce + b.pe) - (a.ce + a.pe) || a.sym.localeCompare(b.sym))
  const topOne = top[0]

  // Scatter
  const W = 640, H = 300, L = 46, R = 14, T = 16, B = 40
  const X0 = -15, X1 = 15
  const yMaxRaw = rows.reduce((m, h) => Math.max(m, h.oi_pct), 0)
  const Y1 = Math.max(300, Math.ceil(Math.min(yMaxRaw, 1500) / 100) * 100 + 50)
  const px = (v: number) => L + ((Math.max(X0, Math.min(X1, v)) - X0) / (X1 - X0)) * (W - L - R)
  const py = (v: number) => H - B - (Math.min(Y1, Math.max(0, v)) / Y1) * (H - T - B)
  const corridor = f.maxPrem ?? 5
  const maxOIForR = rows.reduce((m, h) => Math.max(m, h.new_oi), 1)
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(t => Math.round((t * Y1) / 50) * 50)

  const pill = (on: boolean, extra = '') =>
    `px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${on ? 'bg-indigo-950/60 text-indigo-300 border-indigo-600' : 'bg-gray-800/40 text-gray-500 border-gray-700 hover:text-white'} ${extra}`

  return (
    <div className="space-y-4">
      {/* How to use */}
      <div className="rounded-xl border border-indigo-800/50 bg-indigo-950/20">
        <button onClick={toggleHow} className="w-full flex items-center justify-between px-4 py-3 text-left">
          <span className="text-sm font-bold text-indigo-200">📖 How to use this screen</span>
          <span className="text-xs text-indigo-300">{howOpen ? 'Hide ▴' : 'Show ▾'}</span>
        </button>
        {howOpen && (
          <div className="px-4 pb-4 text-xs text-gray-300 space-y-3 leading-relaxed">
            <p>
              <b className="text-white">What this finds:</b> option strikes where <b>Open Interest (OI) is building up fast</b> while the
              option&apos;s own <b>premium barely moves</b> — large positions going on without moving the price. Treat it as a
              watch-list of where size is being placed, not as a trade call.
            </p>
            <ol className="list-decimal pl-5 space-y-1.5">
              <li>
                <b className="text-white">Pick the time window</b> (buttons above): <b>5-min</b> = what just happened, <b>Hourly</b> = the last
                hour, <b>EOD / vs prev close</b> = the whole day compared with yesterday&apos;s close (best for next-day planning, and the only
                one with data on weekends). <b>Saved today</b> keeps every hit the background scan caught, even if you weren&apos;t watching.
              </li>
              <li>
                <b className="text-white">Start with a preset</b> (e.g. <i>All Absorption</i>), or set your own with the sliders: minimum new OI,
                minimum OI% increase, and how small the premium move must be (≤2% / 5% / 10% / 15%). <i>Reset Filters</i> clears everything.
              </li>
              <li>
                <b className="text-white">Read the chart:</b> across = premium % move, up = OI % increase. Dots inside the <b>green corridor</b> are
                the stealth ones (high OI growth, quiet premium). Bigger dot = bigger OI. A dashed ring = &quot;quiet&quot; (premium moved under
                0.5%). Click a dot, or a stock in <i>Top Qualifying Stocks</i>, to isolate that stock.
              </li>
              <li>
                <b className="text-white">Read the table:</b> <b>Moneyness</b> shows ATM / OTM / ITM and how many strikes from ATM (OTM +2 = two
                strikes out of the money). <b>OI% Increase</b> shows the jump and what it was before. <b>Premium % Move</b> is the option&apos;s
                price change. <b>Old → New Prem</b> are the actual premiums, and <b>CMP</b> is the stock/index price.
              </li>
              <li>
                <b className="text-white">Activity</b> is inferred from the premium: <b>OI up + premium down = Writing</b> (sellers adding),
                <b> OI up + premium up = Buying</b>, and <b>Quiet</b> = premium almost unchanged. Typical reading: Call Buying + Put Writing
                leans bullish; Put Buying + Call Writing leans bearish; the <i>Bias by symbol</i> panel above sums this up per stock.
              </li>
              <li>
                <b className="text-white">Tier</b> (Elite / Strong / Watch) ranks how strong the OI growth is for how quiet the premium stayed — Elite is
                the strongest. 🔗 means the same stock also has a futures-level stealth buildup (the strongest version of this signal).
              </li>
            </ol>
            <p className="text-gray-400">
              <b className="text-gray-300">Keep in mind:</b> premium also moves with the stock price, volatility and time decay, so Writing/Buying is a
              best-guess pattern, not proof. Expiry-day numbers are noisier. Use <i>CSV</i> to take the filtered list into Excel.
              Educational analytics only — not investment advice.
            </p>
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
          <Slider label="Min New OI" value={f.minOI} steps={OI_STEPS} fmt={v => (v === 0 ? '0' : fmtOI(v).replace(' ', ''))}
            onIdx={i => upd({ minOI: OI_STEPS[i] })} />
          <Slider label="Min OI% Increase" value={f.minPct} steps={PCT_STEPS} fmt={v => `+${v}%`}
            onIdx={i => upd({ minPct: PCT_STEPS[i] })} />
          <div className="flex-1 min-w-[200px]">
            <Slider label="Low Prem Move (|%|)" value={f.maxPrem ?? 5} steps={PREM_STEPS} fmt={v => `≤ ${v}%`}
              active={f.maxPrem != null} onIdx={i => upd({ maxPrem: PREM_STEPS[i] })}
              icon={<input type="checkbox" checked={f.maxPrem != null} onChange={e => upd({ maxPrem: e.target.checked ? 5 : null })} className="accent-emerald-500" />} />
          </div>
          <div className="rounded-xl border border-gray-700 bg-gray-900/40 p-3 flex-1 min-w-[220px]">
            <div className="text-xs text-gray-300 font-semibold mb-2">🧭 Moneyness</div>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {(['ALL', 'ATM', 'OTM', 'ITM'] as const).map(m => (
                <button key={m} onClick={() => upd({ money: m })} className={pill(f.money === m, '!px-2.5 !py-1')}>{m}</button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-gray-500">
              Distance:
              {([0, 1, 2, 5] as const).map(d => (
                <button key={d} onClick={() => upd({ dist: d })}
                  className={`px-1.5 py-0.5 rounded ${f.dist === d ? 'text-indigo-300 font-bold underline' : 'hover:text-white'}`}>{d === 0 ? 'Any' : `≤${d}`}</button>
              ))}
            </div>
          </div>
          <div className="flex-1 min-w-[220px] space-y-2">
            <div className="flex gap-1.5">
              {(['ALL', 'CE', 'PE'] as const).map(t => (
                <button key={t} onClick={() => upd({ type: t })} className={pill(f.type === t, 'flex-1')}>
                  {t === 'ALL' ? 'All Types' : t === 'CE' ? 'Calls (CE)' : 'Puts (PE)'}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
              <input value={f.search} onChange={e => upd({ search: e.target.value })} placeholder="Filter stock (e.g. NIFTY, BEL)…"
                className="w-full bg-gray-800/40 border border-gray-700 text-gray-200 text-xs rounded-lg pl-7 pr-3 py-2 focus:outline-none focus:border-indigo-600 placeholder-gray-600" />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between flex-wrap gap-2">
          <button onClick={() => setMoreOpen(v => !v)} className="text-xs text-indigo-300 hover:text-indigo-200">
            {moreOpen ? '▾' : '▸'} More Filters (Tier, Expiry, Activity, Confluence)
          </button>
          <span className="text-xs text-gray-400">Showing <b className="text-white">{n}</b> of {hits.length} contracts</span>
        </div>
        {moreOpen && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {(['ALL', 'ELITE', 'STRONG', 'WATCH'] as const).map(t => (
              <button key={t} onClick={() => upd({ tier: t })} className={pill(f.tier === t)}>{t === 'ALL' ? 'All tiers' : t.charAt(0) + t.slice(1).toLowerCase()}</button>
            ))}
            <span className="w-px h-5 bg-gray-700 mx-1" />
            {(['ALL', 'WRITING', 'BUYING', 'NEUTRAL'] as const).map(a => (
              <button key={a} onClick={() => upd({ activity: a })} className={pill(f.activity === a)}>
                {a === 'ALL' ? 'All activity' : a === 'WRITING' ? '✍️ Writing' : a === 'BUYING' ? '🛒 Buying' : '😶 Quiet'}
              </button>
            ))}
            <span className="w-px h-5 bg-gray-700 mx-1" />
            <button onClick={() => upd({ confluence: !f.confluence })} className={pill(f.confluence)}>🔗 Confluence only</button>
            {expiries.length > 1 && (
              <select value={f.expiry} onChange={e => upd({ expiry: e.target.value })}
                className="bg-gray-800/40 border border-gray-700 text-gray-300 text-xs font-bold rounded-lg px-3 py-1.5 focus:outline-none">
                <option value="all">All expiries</option>
                {expiries.map(x => <option key={x} value={x}>{fmtExp(x)}</option>)}
              </select>
            )}
          </div>
        )}
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}
      {loading && (
        <div className="flex items-center gap-2 rounded-lg border border-indigo-800/50 bg-indigo-950/30 px-3 py-2 text-xs text-indigo-200">
          <span className="inline-block w-3 h-3 rounded-full border-2 border-indigo-300 border-t-transparent animate-spin" />
          Scanning the market… the EOD window can take up to ~40 seconds. Results appear here automatically.
        </div>
      )}
      {!loading && hits.length === 0 && !error && (
        <div className="rounded-lg border border-amber-800/50 bg-amber-950/20 px-3 py-2 text-xs text-amber-200">
          {emptyHint || 'No hits to show yet.'}
        </div>
      )}

      {/* KPI tiles */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-3">
          <p className="text-[10px] text-gray-500 tracking-wide">QUALIFYING</p>
          <p className="text-2xl font-black text-white mt-1">{n} <span className="text-xs font-normal text-gray-500">contracts</span></p>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-3">
          <p className="text-[10px] text-gray-500 tracking-wide">AVG OI GROWTH</p>
          <p className="text-2xl font-black text-emerald-400 mt-1">+{avgOI.toFixed(1)}%</p>
          <p className="text-[10px] text-gray-500">across filtered set</p>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-3">
          <p className="text-[10px] text-gray-500 tracking-wide">AVG |PREM%| MOVE</p>
          <p className="text-2xl font-black text-white mt-1">±{avgMove.toFixed(2)}%</p>
          <p className="text-[10px] text-gray-500">stealth absorption</p>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-3">
          <p className="text-[10px] text-gray-500 tracking-wide">STEALTH QUIET BUILDUP</p>
          <p className="text-2xl font-black text-white mt-1">{quiet} <span className="text-xs font-normal text-gray-500">{n ? Math.round((quiet / n) * 100) : 0}%</span></p>
          <p className="text-[10px] text-gray-500">quiet/flat absorptions</p>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-3">
          <p className="text-[10px] text-gray-500 tracking-wide">CE VS PE SPLIT</p>
          <p className="text-sm font-bold mt-2"><span style={{ color: CE_COL }}>{ce} CE</span> <span className="float-right" style={{ color: PE_COL }}>{pe} PE</span></p>
          <div className="h-1.5 rounded bg-gray-800 mt-2 overflow-hidden flex">
            <div style={{ width: `${n ? (ce / n) * 100 : 50}%`, background: CE_COL }} />
            <div style={{ width: `${n ? (pe / n) * 100 : 50}%`, background: PE_COL }} />
          </div>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-3">
          <p className="text-[10px] text-gray-500 tracking-wide">TOP CONCENTRATION</p>
          <p className="text-lg font-black text-white mt-1 truncate">{topOne ? `${topOne.sym} (${topOne.ce + topOne.pe})` : '—'}</p>
          <p className="text-[10px] text-gray-500">most contracts</p>
        </div>
      </div>

      {/* Scatter + top stocks */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-xl border border-gray-800 bg-gray-900/30 p-4">
          <p className="text-sm font-bold text-gray-200">OI Buildup vs. Premium Movement</p>
          <p className="text-[11px] text-gray-500 mb-2">The shaded corridor is the Absorption Zone — OI building up with a minimal premium shift. Click a dot to isolate that stock.</p>
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-gray-400 mb-1">
            <span className="border border-emerald-700/60 text-emerald-300 rounded-full px-2 py-0.5">Corridor: ±{corridor}%</span>
            <span><span style={{ color: CE_COL }}>●</span> Call (CE)</span>
            <span><span style={{ color: PE_COL }}>●</span> Put (PE)</span>
            <span>◌ Quiet Absorption</span>
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="OI% increase versus premium % move">
            <rect x={px(-corridor)} y={T} width={px(corridor) - px(-corridor)} height={H - T - B} fill="rgba(16,185,129,0.10)" stroke="rgba(16,185,129,0.45)" strokeDasharray="4 3" />
            <text x={(px(-corridor) + px(corridor)) / 2} y={T + 12} textAnchor="middle" fontSize="10" fill="#34d399" fontWeight="700">ABSORPTION CORRIDOR (±{corridor}%)</text>
            {yTicks.map(t => (
              <g key={t}>
                <line x1={L} x2={W - R} y1={py(t)} y2={py(t)} stroke="rgba(255,255,255,0.07)" />
                <text x={L - 6} y={py(t) + 3} textAnchor="end" fontSize="9" fill="#6b7280">+{t}%</text>
              </g>
            ))}
            {[-15, -10, -5, 0, 5, 10, 15].map(t => (
              <g key={t}>
                <line x1={px(t)} x2={px(t)} y1={T} y2={H - B} stroke="rgba(255,255,255,0.05)" />
                <text x={px(t)} y={H - B + 13} textAnchor="middle" fontSize="9" fill="#6b7280">{t > 0 ? '+' : ''}{t}%</text>
              </g>
            ))}
            <line x1={px(0)} x2={px(0)} y1={T} y2={H - B} stroke="rgba(99,102,241,0.6)" />
            {f.minPct > 0 && (
              <>
                <line x1={L} x2={W - R} y1={py(f.minPct)} y2={py(f.minPct)} stroke="#f97316" strokeDasharray="5 4" />
                <text x={W - R} y={py(f.minPct) - 3} textAnchor="end" fontSize="9" fill="#fb923c" fontWeight="700">Min OI +{f.minPct}% Threshold</text>
              </>
            )}
            <text x={(L + W - R) / 2} y={H - 6} textAnchor="middle" fontSize="9" fill="#9ca3af" fontWeight="700">PREMIUM % MOVEMENT (NEGATIVE: DECAYED / POSITIVE: EXPANDED)</text>
            {rows.map((h, i) => {
              const r = 4 + 9 * Math.sqrt(h.new_oi / maxOIForR)
              const col = h.option_type === 'CE' ? CE_COL : PE_COL
              return (
                <g key={`${h.symbol}-${h.strike}-${h.option_type}-${h.expiry}-${i}`} style={{ cursor: 'pointer' }} onClick={() => upd({ search: h.symbol })}>
                  <circle cx={px(h.premium_pct)} cy={py(h.oi_pct)} r={r} fill={col} fillOpacity={0.55} stroke={col} strokeWidth={1.5} />
                  {h.activity === 'NEUTRAL' && <circle cx={px(h.premium_pct)} cy={py(h.oi_pct)} r={r + 3} fill="none" stroke={col} strokeDasharray="2 2" />}
                  <title>{`${h.symbol} ${h.strike} ${h.option_type} · OI +${h.oi_pct}% · Prem ${h.premium_pct >= 0 ? '+' : ''}${h.premium_pct}% · New OI ${fmtOI(h.new_oi)}`}</title>
                </g>
              )
            })}
          </svg>
          <p className="text-[10px] text-gray-600">Dot size = New OI. Dots beyond the chart edge are drawn at the edge.</p>
        </div>

        <div className="rounded-xl border border-gray-800 bg-gray-900/30 p-4">
          <p className="text-sm font-bold text-gray-200">Top Qualifying Stocks</p>
          <p className="text-[11px] text-gray-500 mb-3">Highest contract concentration</p>
          <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
            {top.slice(0, 12).map(r => (
              <div key={r.sym} className="flex items-center justify-between gap-2 border border-gray-800 rounded-lg px-3 py-2 bg-gray-900/40">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono font-bold text-xs text-white truncate">{r.sym}</span>
                  {r.ce > 0 && <Chip cls="text-emerald-300 border-emerald-700/50 bg-emerald-950/30">{r.ce} CE</Chip>}
                  {r.pe > 0 && <Chip cls="text-rose-300 border-rose-700/50 bg-rose-950/30">{r.pe} PE</Chip>}
                </div>
                <div className="flex items-center gap-2 shrink-0 text-[11px] text-gray-400">
                  {r.ce + r.pe} strike{r.ce + r.pe > 1 ? 's' : ''}
                  <button onClick={() => upd({ search: r.sym })} className="border border-gray-600 rounded px-1.5 py-0.5 text-[10px] text-gray-300 hover:text-white">Filter</button>
                </div>
              </div>
            ))}
            {top.length === 0 && <p className="text-xs text-gray-600">Nothing qualifies with these filters.</p>}
          </div>
          <p className="text-[11px] text-gray-600 text-center mt-3">Click any stock to isolate its option strikes.</p>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/30">
        <div className="flex flex-wrap items-center justify-between gap-2 p-3 border-b border-gray-800">
          <p className="text-sm font-bold text-gray-200">Screened Options Contracts <span className="ml-2 text-[11px] font-normal text-gray-400 border border-gray-700 rounded-full px-2 py-0.5">{n} records</span></p>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-gray-500">Sort By:</span>
            {SORTS.map(([k, label]) => (
              <button key={k} onClick={() => { setSort(k); setPage(1) }} className={pill(sort === k, '!py-1')}>{label}{k === 'move' ? ' ↑' : ' ↓'}</button>
            ))}
            <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }}
              className="bg-gray-800/40 border border-gray-700 text-gray-300 text-xs rounded-lg px-2 py-1.5">
              {[25, 50, 100].map(s => <option key={s} value={s}>{s} / page</option>)}
            </select>
            <button onClick={() => onDownload(sorted)} disabled={sorted.length === 0}
              className="flex items-center gap-1.5 text-gray-400 hover:text-white border border-gray-700 rounded-lg px-2.5 py-1.5 disabled:opacity-40">
              <Download size={12} /> CSV
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[980px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-wide text-gray-500 text-left border-b border-gray-800">
                <th className="px-3 py-2">Symbol</th><th className="px-2 py-2 text-right">Strike</th><th className="px-2 py-2">Type</th>
                <th className="px-2 py-2">Moneyness</th><th className="px-2 py-2">Activity</th><th className="px-2 py-2 text-right">OI% Increase</th>
                <th className="px-2 py-2 text-right">New OI</th><th className="px-2 py-2 text-right bg-emerald-950/20">Premium % Move</th>
                <th className="px-2 py-2 text-right">Old → New Prem</th><th className="px-2 py-2 text-right">CMP</th><th className="px-2 py-2">Tier</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((h, i) => {
                const m = moneyness(h)
                const mv = h.premium_pct
                const ultra = Math.abs(mv) <= 0.5
                return (
                  <tr key={`${h.symbol}-${h.strike}-${h.option_type}-${h.expiry}-${i}`} className="border-b border-gray-800/60 hover:bg-gray-800/20">
                    <td className="px-3 py-2">
                      <button onClick={() => upd({ search: h.symbol })} className="text-left">
                        <span className="font-bold text-white">{h.symbol}</span>
                        {h.is_confluence && <span title="Confluence with FUT-level Stealth Buildup" className="ml-1">🔗</span>}
                        {h.freshness === 'Fresh Now' && <span title="Fresh now" className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-lime-400 align-middle" />}
                        <div className="text-[10px] text-gray-500">{fmtExp(h.expiry)}</div>
                      </button>
                    </td>
                    <td className="px-2 py-2 text-right font-bold text-white">{h.strike.toLocaleString('en-IN')}</td>
                    <td className="px-2 py-2"><Chip cls={h.option_type === 'CE' ? 'text-emerald-300 border-emerald-700/50 bg-emerald-950/30' : 'text-rose-300 border-rose-700/50 bg-rose-950/30'}>{h.option_type}</Chip></td>
                    <td className="px-2 py-2"><Chip cls={MONEY_CHIP[m.label]}>{m.label}</Chip><div className="text-[10px] text-gray-500">{m.label === 'ATM' ? 'At Strike' : `${m.label === 'ITM' ? '' : ''}+${m.n}`}</div></td>
                    <td className="px-2 py-2">{h.activity ? <Chip cls={ACT_CHIP[h.activity]}>{ACT_ICON[h.activity]} {h.activity_label ?? h.activity}</Chip> : <span className="text-gray-600">—</span>}</td>
                    <td className="px-2 py-2 text-right"><span className="font-bold text-emerald-400">↗ +{h.oi_pct}%</span><div className="text-[10px] text-gray-500">was {fmtOI(h.old_oi)}</div></td>
                    <td className="px-2 py-2 text-right"><span className="font-bold text-white">{fmtOI(h.new_oi)}</span><div className="text-[10px] text-gray-500">{h.new_oi.toLocaleString('en-IN')}</div></td>
                    <td className="px-2 py-2 text-right bg-emerald-950/20">
                      <span className={`inline-block font-bold rounded px-1.5 py-0.5 border ${Math.abs(mv) <= 5 ? 'text-emerald-300 border-emerald-700/50 bg-emerald-950/40' : 'text-amber-300 border-amber-700/50 bg-amber-950/30'}`}>
                        {mv > 0 ? '+' : mv < 0 ? '−' : ''}{Math.abs(mv).toFixed(2)}%
                      </span>
                      {ultra && <div className="text-[9px] font-bold text-emerald-400 mt-0.5">⚡ ULTRA-LOW</div>}
                    </td>
                    <td className="px-2 py-2 text-right text-gray-400">{inr(h.old_premium)} → <b className="text-white">{inr(h.new_premium)}</b></td>
                    <td className="px-2 py-2 text-right text-gray-200">{inr(h.cmp)}</td>
                    <td className="px-2 py-2"><Chip cls={TIER_CHIP[h.tier]}>{h.tier}</Chip></td>
                  </tr>
                )
              })}
              {pageRows.length === 0 && (
                <tr><td colSpan={11} className="px-3 py-8 text-center text-gray-500">
                  {loading ? 'Scanning the market… (EOD can take up to ~40 seconds)'
                    : hits.length === 0 ? (emptyHint || 'No hits to show yet.')
                    : `None of the ${hits.length} scanned contracts match these filters — try a different preset or Reset Filters.`}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between p-3 text-xs text-gray-500">
          <span>Showing {n === 0 ? 0 : (cur - 1) * pageSize + 1} to {Math.min(cur * pageSize, n)} of {n} matching strikes</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(Math.max(1, cur - 1))} disabled={cur <= 1} className="px-2 py-1 border border-gray-700 rounded disabled:opacity-30">‹</button>
            <span>Page {cur} of {pages}</span>
            <button onClick={() => setPage(Math.min(pages, cur + 1))} disabled={cur >= pages} className="px-2 py-1 border border-gray-700 rounded disabled:opacity-30">›</button>
          </div>
        </div>
      </div>
      <p className="text-[11px] text-gray-600">
        Educational analytics only — Writing/Buying is inferred from premium direction (spot, IV and time decay also move premium), so treat it as a pattern, not a trade call.
      </p>
    </div>
  )
}
