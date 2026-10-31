'use client'
// Oct 31 2026: single-stock dashboard in the Strike-Stealth / Pulse-feed format.
// One page per stock, built only from feeds that already exist (stock-oi,
// stock-intel, oi-history, pcr-trend, alerts, saved Stealth events) -- nothing
// new on the server. Previewable at /stock/<SYMBOL>?v=new while Manish reviews.
import { useEffect, useMemo, useState } from 'react'
import Navbar from '@/components/Navbar'
import { ALL_SYMBOLS } from '@/lib/symbols'
import { SIGNAL_META, DEFAULT_META } from '@/lib/alertMeta'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, Legend } from 'recharts'
import { RefreshCw, Search } from 'lucide-react'

const API = 'https://api.greeknova.com'
const INDEXES = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY', 'SENSEX']

const fmtOI = (n: number) => {
  const a = Math.abs(n)
  if (a >= 10000000) return `${(n / 10000000).toFixed(1)}Cr`
  if (a >= 100000) return `${(n / 100000).toFixed(1)}L`
  if (a >= 1000) return `${(n / 1000).toFixed(1)}K`
  return String(Math.round(n))
}
const inr = (n: any) => (n == null || n === 0 ? '—' : `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`)
const sgn = (n: number, d = 1) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(d)}%`
const SIG_LABEL: Record<string, string> = {
  LONG_BUILDUP: 'Long Buildup', SHORT_BUILDUP: 'Short Buildup', SHORT_COVERING: 'Short Covering', LONG_UNWINDING: 'Long Unwinding', NEUTRAL: 'Neutral',
}
const SIG_CHIP: Record<string, string> = {
  LONG_BUILDUP: 'text-emerald-300 border-emerald-700/60 bg-emerald-950/30',
  SHORT_BUILDUP: 'text-rose-300 border-rose-700/60 bg-rose-950/30',
  SHORT_COVERING: 'text-cyan-300 border-cyan-700/60 bg-cyan-950/30',
  LONG_UNWINDING: 'text-amber-300 border-amber-700/60 bg-amber-950/30',
  NEUTRAL: 'text-gray-300 border-gray-700 bg-gray-900/30',
}

function Chip({ cls, children }: { cls: string; children: React.ReactNode }) {
  return <span className={`inline-block text-[10px] font-bold border rounded px-1.5 py-0.5 whitespace-nowrap ${cls}`}>{children}</span>
}
function Card({ title, sub, right, children }: { title: string; sub?: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/30 p-4 min-w-0">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-200">{title}</p>
          {sub && <p className="text-[11px] text-gray-500">{sub}</p>}
        </div>
        {right}
      </div>
      {children}
    </div>
  )
}
function Tile({ label, value, sub, tone = 'text-white', border = 'border-gray-800 bg-gray-900/40' }: {
  label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: string; border?: string
}) {
  return (
    <div className={`rounded-xl border p-3 ${border}`}>
      <p className="text-[10px] text-gray-500 tracking-wide">{label}</p>
      <p className={`text-xl font-black mt-1 ${tone}`}>{value}</p>
      {sub && <p className="text-[10px] text-gray-500 mt-0.5">{sub}</p>}
    </div>
  )
}
const tip = { background: '#111827', border: '1px solid #374151', borderRadius: 12 }

export default function StockDashboard({ symbol: rawSymbol }: { symbol: string }) {
  let symbol = rawSymbol
  try { symbol = decodeURIComponent(rawSymbol) } catch {}
  symbol = symbol.toUpperCase()
  const enc = encodeURIComponent(symbol)
  const isIdx = INDEXES.includes(symbol)

  const [oi, setOi] = useState<any>(null)
  const [intel, setIntel] = useState<any>(null)
  const [hist, setHist] = useState<any>(null)
  const [pcrPts, setPcrPts] = useState<any[]>([])
  const [alerts, setAlerts] = useState<any[]>([])
  const [stealth, setStealth] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [intelLoading, setIntelLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [howOpen, setHowOpen] = useState(true)
  useEffect(() => { try { if (localStorage.getItem('gn_stock_howto') === '0') setHowOpen(false) } catch {} }, [])
  const toggleHow = () => setHowOpen(v => { try { localStorage.setItem('gn_stock_howto', v ? '0' : '1') } catch {} return !v })

  const getJson = async (path: string) => {
    try { const r = await fetch(API + path); if (!r.ok) return null; return await r.json() } catch { return null }
  }

  // Each feed fills its own panels as soon as it arrives -- the Stock Intel feed
  // (futures, max pain, CPR, delivery, option activity) is the slow one and must
  // not hold the rest of the page back.
  const load = async () => {
    setLoading(true); setIntelLoading(true)
    getJson(`/stock-intel/${enc}`).then(i => { setIntel(i); setIntelLoading(false) })
    const quick = Promise.all([
      getJson(`/stock-oi/${enc}`).then(o => setOi(o)),
      getJson(`/pcr-trend/${enc}`).then(p => setPcrPts(p?.points || [])),
      getJson(`/option-stealth-buildup/saved?window=eod&zone=5`).then(s => setStealth((s?.events || []).filter((e: any) => e.symbol === symbol))),
      getJson(`/oi-history/${enc}`).then(async h => {
        setHist(h)
        const day = h?.date_a
        const a = await getJson(`/alerts?symbol=${enc}&limit=30${day ? `&date=${day}` : ''}`)
        setAlerts(a?.alerts || [])
      }),
    ])
    await quick
    setLoading(false)
  }
  useEffect(() => { load() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [symbol])

  const go = (sym: string) => {
    const s = sym.trim().toUpperCase()
    if (s) window.location.href = `/stock/${encodeURIComponent(s)}?v=new`
  }

  // ── derived ────────────────────────────────────────────────────────────
  const strikes: any[] = useMemo(() => (oi?.strikes || []).filter((s: any) => s.strike > 0 && (s.ce_oi > 0 || s.pe_oi > 0)), [oi])
  const cmp: number = oi?.cmp || intel?.fut_signal?.close_price || 0
  const pcr: number | null = oi?.pcr ?? intel?.max_pain?.pcr ?? null
  const maxCE = strikes.reduce((a, b) => (b.ce_oi > (a?.ce_oi || 0) ? b : a), null as any)
  const maxPE = strikes.reduce((a, b) => (b.pe_oi > (a?.pe_oi || 0) ? b : a), null as any)
  const fut = intel?.fut_signal
  const mp = intel?.max_pain
  const cpr = intel?.cpr
  const hist20: any[] = intel?.signal_history || []
  const deliv: any[] = intel?.delivery || []
  const jungle: any[] = intel?.jungle || []
  const rows: any[] = useMemo(() => (hist?.rows || []).filter((r: any) => r.strike > 0 && (r.ce_chg || r.pe_chg)), [hist])
  const cprPos = cpr && cmp ? (cmp > cpr.tc ? 'Above CPR' : cmp < cpr.bc ? 'Below CPR' : 'Inside CPR') : null
  const pcrLean = pcr == null ? null : pcr >= 1.2 ? ['Put-heavy', 'text-emerald-400'] : pcr > 1 ? ['Leans put-heavy', 'text-emerald-400'] : pcr >= 0.8 ? ['Balanced', 'text-amber-300'] : ['Call-heavy', 'text-rose-400']
  const delLatest = deliv[0]?.delivery_pct
  const delAvg = deliv.length ? deliv.reduce((s: number, d: any) => s + (d.delivery_pct || 0), 0) / deliv.length : null
  const asOf = intel?.last_trading_day || oi?.timestamp?.slice(0, 10)

  const glance: string[] = []
  if (fut) {
    const lbl = SIG_LABEL[fut.fut_signal] || fut.fut_signal
    glance.push(`Futures show ${lbl}: price ${sgn(fut.price_chg_pct || 0, 2)}, futures OI ${sgn(fut.fut_oi_chg_pct || 0, 2)}${fut.fut_oi_chg_pct_combined != null ? ` (${sgn(fut.fut_oi_chg_pct_combined, 2)} with next month)` : ''}.`)
  }
  if (pcr != null && pcrLean) glance.push(`PCR is ${pcr} — ${String(pcrLean[0]).toLowerCase()} option positioning.`)
  if (maxCE && maxPE) glance.push(`Highest call OI is at ${maxCE.strike.toLocaleString('en-IN')} (${fmtOI(maxCE.ce_oi)}, the usual resistance zone) and highest put OI at ${maxPE.strike.toLocaleString('en-IN')} (${fmtOI(maxPE.pe_oi)}, the usual support zone).`)
  if (mp?.max_pain) glance.push(`Max pain is ${mp.max_pain.toLocaleString('en-IN')}; price is ${Math.abs(mp.dist_from_mp ?? 0).toFixed(1)}% ${mp.direction === 'ABOVE' ? 'above' : 'below'} it, with ${mp.days_to_expiry} days to expiry.`)
  if (hist?.structure_desc) glance.push(`OI structure vs previous day: ${hist.structure_desc}.`)
  if (cpr) glance.push(`CPR is ${cpr.width_pct < 0.3 ? 'narrow' : cpr.width_pct < 0.6 ? 'moderate' : 'wide'} (${Number(cpr.width_pct).toFixed(2)}%) and ${String(cpr.cpr_trend || '').toLowerCase()}; price is ${cprPos?.toLowerCase()}.`)
  if (delLatest != null && delAvg != null) glance.push(`Delivery was ${delLatest}% against a ${deliv.length}-day average of ${delAvg.toFixed(1)}%.`)

  const noData = !loading && !intelLoading && !oi && !intel

  return (
    <div className="min-h-screen bg-[#07070e] text-white">
      <Navbar active="" />
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 space-y-4">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-3">
          <a href="/" className="text-xs text-gray-400 hover:text-white">← Market Pulse</a>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">{symbol}</h1>
          {isIdx && <Chip cls="text-gray-400 border-gray-700 bg-gray-900/30">INDEX</Chip>}
          {cmp > 0 && <span className="text-xl sm:text-2xl font-black text-amber-400">{inr(cmp)}</span>}
          {fut?.price_chg_pct != null && (
            <span className={`text-sm font-bold ${fut.price_chg_pct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{sgn(fut.price_chg_pct, 2)}</span>
          )}
          {fut?.fut_signal && <Chip cls={SIG_CHIP[fut.fut_signal] || SIG_CHIP.NEUTRAL}>{SIG_LABEL[fut.fut_signal] || fut.fut_signal}</Chip>}
          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
              <input list="gn-symbols" value={query} onChange={e => setQuery(e.target.value.toUpperCase())}
                onKeyDown={e => { if (e.key === 'Enter') go(query) }} placeholder="Open another stock…"
                className="bg-gray-800/40 border border-gray-700 text-gray-200 text-xs rounded-lg pl-7 pr-3 py-2 w-44 focus:outline-none focus:border-indigo-600 placeholder-gray-600" />
              <datalist id="gn-symbols">{(ALL_SYMBOLS as string[]).map(s => <option key={s} value={s} />)}</datalist>
            </div>
            <button onClick={load} disabled={loading} className="flex items-center gap-1.5 text-xs text-gray-300 border border-gray-700 rounded-lg px-3 py-2 hover:text-white disabled:opacity-50">
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
        </div>

        {asOf && (
          <div className="rounded-lg border border-gray-800 bg-gray-900/30 px-3 py-2 text-xs text-gray-400">
            🕒 Data of <b className="text-white">{asOf}</b> — the last trading session. Changes are measured against the session before it.
          </div>
        )}

        {/* How to use */}
        <div className="rounded-xl border border-indigo-800/50 bg-indigo-950/20">
          <button onClick={toggleHow} className="w-full flex items-center justify-between px-4 py-3 text-left">
            <span className="text-sm font-bold text-indigo-200">📖 How to use this screen</span>
            <span className="text-xs text-indigo-300">{howOpen ? 'Hide ▴' : 'Show ▾'}</span>
          </button>
          {howOpen && (
            <div className="px-4 pb-4 text-xs text-gray-300 leading-relaxed">
              <ol className="list-decimal pl-5 space-y-2">
                <li><b className="text-white">Start with “At a glance”.</b> It puts the main readings for this stock in plain sentences: futures signal, PCR, support and resistance, max pain, CPR and delivery.</li>
                <li><b className="text-white">Read the walls.</b> In the strike chart, the biggest red bar (call OI) is where sellers have built resistance; the biggest green bar (put OI) is where support is built. The dashed line is the current price.</li>
                <li><b className="text-white">Check what changed.</b> “OI change by strike” shows where positions were added or removed since the previous session. Red growing above the price with green shrinking is a cautious structure; the reverse is a supportive one.</li>
                <li><b className="text-white">Look for agreement.</b> Futures signal, PCR, OI structure, Stealth strikes and the CPR position tell a stronger story when they point the same way, and a weaker one when they conflict.</li>
                <li>Use the search box to jump to another stock. Everything here is a description of positioning, not a prediction.</li>
              </ol>
            </div>
          )}
        </div>

        {noData && (
          <div className="rounded-lg border border-amber-800/50 bg-amber-950/20 px-3 py-2 text-xs text-amber-200">
            No data found for “{symbol}”. Check the symbol — it should be an F&amp;O stock or index — or try again in a moment.
          </div>
        )}

        {/* Tiles */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <Tile label="FUTURES SIGNAL" value={fut ? (SIG_LABEL[fut.fut_signal] || fut.fut_signal) : '—'}
            tone={fut?.fut_signal === 'LONG_BUILDUP' || fut?.fut_signal === 'SHORT_COVERING' ? 'text-emerald-400' : fut?.fut_signal === 'SHORT_BUILDUP' || fut?.fut_signal === 'LONG_UNWINDING' ? 'text-rose-400' : 'text-gray-200'}
            sub={fut ? `OI ${sgn(fut.fut_oi_chg_pct || 0, 2)} · Px ${sgn(fut.price_chg_pct || 0, 2)}` : undefined} />
          <Tile label="PCR" value={pcr ?? '—'} tone={(pcrLean?.[1] as string) || 'text-white'} sub={pcrLean?.[0] as string} />
          <Tile label="RESISTANCE (MAX CALL OI)" value={maxCE ? maxCE.strike.toLocaleString('en-IN') : '—'} tone="text-rose-400"
            border="border-rose-900/50 bg-rose-950/10" sub={maxCE ? `${fmtOI(maxCE.ce_oi)} OI` : undefined} />
          <Tile label="SUPPORT (MAX PUT OI)" value={maxPE ? maxPE.strike.toLocaleString('en-IN') : '—'} tone="text-emerald-400"
            border="border-emerald-900/50 bg-emerald-950/10" sub={maxPE ? `${fmtOI(maxPE.pe_oi)} OI` : undefined} />
          <Tile label="MAX PAIN" value={mp?.max_pain ? mp.max_pain.toLocaleString('en-IN') : '—'} tone="text-amber-300"
            sub={mp?.max_pain ? `${Math.abs(mp.dist_from_mp ?? 0).toFixed(1)}% ${mp.direction === 'ABOVE' ? 'above' : 'below'} · ${mp.days_to_expiry}d to expiry` : undefined} />
          <Tile label="CPR" value={cpr ? `${Number(cpr.width_pct).toFixed(2)}%` : '—'} tone={cpr && cpr.width_pct < 0.3 ? 'text-orange-300' : 'text-white'}
            sub={cpr ? `${cprPos} · ${String(cpr.cpr_trend || '').toLowerCase()}` : undefined} />
        </div>

        {/* At a glance + strike chart */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <Card title={`Strike-wise OI — ${symbol}`} sub="Red = call OI (resistance) · Green = put OI (support) · Dashed = current price"
              right={oi?.expiry ? <Chip cls="text-gray-400 border-gray-700 bg-gray-900/30">Expiry {oi.expiry}</Chip> : undefined}>
              {loading ? (
                <div className="h-72 flex items-center justify-center"><RefreshCw size={22} className="text-gray-600 animate-spin" /></div>
              ) : strikes.length ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={strikes} margin={{ top: 5, right: 8, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                    <XAxis dataKey="strike" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v: number) => fmtOI(v)} width={44} />
                    <Tooltip contentStyle={tip} labelStyle={{ color: 'white', fontWeight: 'bold' }} formatter={(v: any, n: any) => [fmtOI(Number(v)), n]} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                    {cmp > 0 && strikes.length > 1 && (() => {
                      const near = strikes.reduce((a, b) => (Math.abs(b.strike - cmp) < Math.abs(a.strike - cmp) ? b : a))
                      return <ReferenceLine x={near.strike} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: `₹${cmp}`, fill: '#f59e0b', fontSize: 10 }} />
                    })()}
                    <Bar dataKey="ce_oi" name="Call OI" fill="#ef4444" opacity={0.85} radius={[3, 3, 0, 0]} />
                    <Bar dataKey="pe_oi" name="Put OI" fill="#10b981" opacity={0.85} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="text-xs text-gray-500 py-10 text-center">No option-chain data for this symbol.</p>}
            </Card>
          </div>
          <Card title="📌 At a glance" sub="What the data says, in plain words">
            {glance.length ? (
              <ul className="space-y-2.5 text-xs text-gray-300 leading-relaxed">
                {glance.map((g, i) => <li key={i} className="flex gap-2"><span className="text-indigo-400">▸</span><span>{g}</span></li>)}
              </ul>
            ) : <p className="text-xs text-gray-500">{loading || intelLoading ? 'Loading…' : 'Not enough data yet.'}</p>}
            <p className="text-[10px] text-gray-600 mt-3">A description of positioning, not a prediction or a trade call.</p>
          </Card>
        </div>

        {/* OI change + PCR */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <Card title="OI change by strike" sub={hist?.date_a ? `${hist.date_a} vs ${hist.date_b} · red = calls added, green = puts added (negative = unwinding)` : 'Versus the previous session'}
              right={hist?.structure ? <Chip cls={hist.structure.startsWith('BULL') ? 'text-emerald-300 border-emerald-700/60 bg-emerald-950/30' : hist.structure.startsWith('BEAR') ? 'text-rose-300 border-rose-700/60 bg-rose-950/30' : 'text-gray-300 border-gray-700 bg-gray-900/30'}>{String(hist.structure).replace(/_/g, ' ')}</Chip> : undefined}>
              {rows.length ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3 text-[11px]">
                    <div className="rounded-lg border border-rose-900/50 bg-rose-950/10 px-2 py-1.5">Call added <b className="text-rose-400 block text-sm">{fmtOI(hist.total_ce_buildup || 0)}</b></div>
                    <div className="rounded-lg border border-rose-900/30 bg-gray-900/30 px-2 py-1.5">Call unwound <b className="text-gray-200 block text-sm">{fmtOI(hist.total_ce_unwind || 0)}</b></div>
                    <div className="rounded-lg border border-emerald-900/50 bg-emerald-950/10 px-2 py-1.5">Put added <b className="text-emerald-400 block text-sm">{fmtOI(hist.total_pe_buildup || 0)}</b></div>
                    <div className="rounded-lg border border-emerald-900/30 bg-gray-900/30 px-2 py-1.5">Put unwound <b className="text-gray-200 block text-sm">{fmtOI(hist.total_pe_unwind || 0)}</b></div>
                  </div>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={rows} margin={{ top: 5, right: 8, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                      <XAxis dataKey="strike" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v: number) => fmtOI(v)} width={44} />
                      <Tooltip contentStyle={tip} labelStyle={{ color: 'white', fontWeight: 'bold' }} formatter={(v: any, n: any) => [fmtOI(Number(v)), n]} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                      <ReferenceLine y={0} stroke="#4b5563" />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="ce_chg" name="Call OI change" fill="#ef4444" opacity={0.85} />
                      <Bar dataKey="pe_chg" name="Put OI change" fill="#10b981" opacity={0.85} />
                    </BarChart>
                  </ResponsiveContainer>
                </>
              ) : <p className="text-xs text-gray-500 py-8 text-center">{loading ? 'Loading…' : 'No strike-level OI change available for this symbol.'}</p>}
            </Card>
          </div>
          <Card title="PCR through the day" sub="Above 1.0 leans put-heavy · below 0.8 leans call-heavy">
            {pcrPts.length > 1 ? (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={pcrPts} margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                  <XAxis dataKey="time" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} domain={['auto', 'auto']} width={34} />
                  <Tooltip contentStyle={tip} labelStyle={{ color: 'white', fontWeight: 'bold' }} />
                  <ReferenceLine y={1} stroke="#10b981" strokeDasharray="4 4" strokeOpacity={0.5} />
                  <ReferenceLine y={0.8} stroke="#ef4444" strokeDasharray="4 4" strokeOpacity={0.5} />
                  <Line type="monotone" dataKey="pcr" stroke="#f59e0b" strokeWidth={2} dot={false} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            ) : <p className="text-xs text-gray-500 py-8 text-center">{loading ? 'Loading…' : 'The intraday PCR line fills in during market hours.'}</p>}
          </Card>
        </div>

        {/* Futures history + delivery */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <Card title="Futures signal history" sub="Last sessions · what price and futures OI did each day">
              {hist20.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs min-w-[460px]">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-wide text-gray-500 text-left border-b border-gray-800">
                        <th className="py-1.5 pr-2">Date</th><th className="px-2">Signal</th><th className="px-2 text-right">Price</th><th className="px-2 text-right">Fut OI</th><th className="px-2 text-right">Volume</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hist20.slice(0, 12).map((d: any, i: number) => (
                        <tr key={i} className="border-b border-gray-800/50">
                          <td className="py-1.5 pr-2 text-gray-400">{String(d.date).slice(5)}</td>
                          <td className="px-2"><Chip cls={SIG_CHIP[d.signal] || SIG_CHIP.NEUTRAL}>{SIG_LABEL[d.signal] || d.signal}</Chip></td>
                          <td className={`px-2 text-right font-semibold ${d.price_chg >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{sgn(d.price_chg || 0, 2)}</td>
                          <td className={`px-2 text-right ${d.fut_oi_chg >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{sgn(d.fut_oi_chg || 0, 2)}</td>
                          <td className="px-2 text-right text-gray-400">{d.vol_ratio ? `${Number(d.vol_ratio).toFixed(1)}×` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <p className="text-xs text-gray-500 py-6 text-center">{intelLoading ? 'Loading… (this one can take a few seconds)' : 'No futures history.'}</p>}
            </Card>
          </div>
          <Card title="Delivery %" sub="Share of traded quantity actually taken for delivery">
            {deliv.length ? (
              <div className="space-y-2">
                {deliv.map((d: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="w-12 text-gray-500">{String(d.trade_date).slice(5)}</span>
                    <div className="flex-1 h-2 rounded-full bg-gray-800 overflow-hidden"><div className="h-full bg-indigo-500/80" style={{ width: `${Math.min(100, d.delivery_pct || 0)}%` }} /></div>
                    <span className="w-12 text-right font-bold text-gray-200">{d.delivery_pct}%</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-xs text-gray-500 py-6 text-center">{isIdx ? 'Not applicable for indices.' : intelLoading ? 'Loading…' : 'No delivery data.'}</p>}
          </Card>
        </div>

        {/* Stealth + option activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card title="🎯 Stealth strikes" sub="OI building hard while the premium barely moves (EOD window)"
            right={<a href="/strike-stealth" className="text-[11px] text-indigo-300 hover:text-indigo-200">Open Strike Stealth →</a>}>
            {stealth.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[360px]">
                  <thead><tr className="text-[10px] uppercase tracking-wide text-gray-500 text-left border-b border-gray-800">
                    <th className="py-1.5 pr-2">Strike</th><th className="px-2">Activity</th><th className="px-2 text-right">OI %</th><th className="px-2 text-right">Prem %</th><th className="px-2">Tier</th>
                  </tr></thead>
                  <tbody>
                    {stealth.slice(0, 10).map((e: any, i: number) => (
                      <tr key={i} className="border-b border-gray-800/50">
                        <td className="py-1.5 pr-2 font-bold text-white">{Number(e.strike).toLocaleString('en-IN')} <span className={e.option_type === 'CE' ? 'text-emerald-300' : 'text-rose-300'}>{e.option_type}</span></td>
                        <td className="px-2 text-gray-300">{e.activity_label || e.activity}</td>
                        <td className="px-2 text-right text-emerald-400 font-semibold">+{Number(e.oi_pct).toFixed(1)}%</td>
                        <td className="px-2 text-right text-gray-300">{sgn(Number(e.premium_pct || 0), 2)}</td>
                        <td className="px-2"><Chip cls="text-purple-300 border-purple-700/60 bg-purple-950/40">{e.best_tier || e.tier}</Chip></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="text-xs text-gray-500 py-6 text-center">{loading ? 'Loading…' : 'No Stealth strikes saved for this stock yet. They appear as the market runs.'}</p>}
          </Card>
          <Card title="Option activity" sub="Notable strikes picked up for this stock">
            {jungle.length ? (
              <div className="space-y-1.5">
                {jungle.slice(0, 8).map((j: any, i: number) => {
                  const m = SIGNAL_META[j.interpretation] || DEFAULT_META
                  return (
                    <div key={i} className="flex items-center justify-between gap-2 rounded-lg border border-gray-800 bg-gray-900/40 px-3 py-1.5 text-xs">
                      <span className="font-bold text-white truncate">{Number(j.strike).toLocaleString('en-IN')} {j.option_type}</span>
                      <span className={`${m.color} font-semibold`}>{m.icon} {m.label !== 'Alert' ? m.label : String(j.interpretation || '').replace(/_/g, ' ')}</span>
                      <span className="text-gray-400 whitespace-nowrap">{inr(j.last_price)}{j.ltp_chg_pct != null ? ` (${sgn(Number(j.ltp_chg_pct))})` : ''}</span>
                    </div>
                  )
                })}
              </div>
            ) : <p className="text-xs text-gray-500 py-6 text-center">{intelLoading ? 'Loading…' : 'No notable option activity.'}</p>}
          </Card>
        </div>

        {/* Alerts */}
        <Card title="Alerts for this stock" sub={asOf ? `Session of ${asOf}` : undefined}
          right={<a href="/alerts" className="text-[11px] text-indigo-300 hover:text-indigo-200">All alerts →</a>}>
          {alerts.length ? (
            <div className="space-y-1.5">
              {alerts.slice(0, 15).map((a: any) => {
                const m = SIGNAL_META[a.signal] || DEFAULT_META
                let t = ''
                try { t = new Date(a.receivedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }) } catch {}
                return (
                  <div key={a.id} className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border ${m.border} ${m.bg} px-3 py-1.5 text-xs`}>
                    <span className="text-gray-500 w-16">{t}</span>
                    <span className={`${m.color} font-bold`}>{m.icon} {m.label}</span>
                    {a.strike ? <span className="text-white font-semibold">{Number(a.strike).toLocaleString('en-IN')} {a.optionType}</span> : null}
                    <span className="text-gray-400 min-w-0 truncate">{a.message}</span>
                  </div>
                )
              })}
            </div>
          ) : <p className="text-xs text-gray-500 py-6 text-center">{loading ? 'Loading…' : 'No alerts for this stock in the last session.'}</p>}
        </Card>

        <p className="text-[11px] text-gray-600">
          Educational analytics only — everything here describes positioning in the market data, not what will happen next. Not investment advice; GreekNova is not SEBI registered.
        </p>
      </div>
    </div>
  )
}
