'use client'
// Redesigned Wolves (ADX) Scanner view — same look as Pulse / Strike Stealth.
// Presentation only: it reads the exact same data the old page loads.
import { useMemo, useState } from 'react'
import { RefreshCw, Zap } from 'lucide-react'

type Any = any

const TIER_CHIP: Record<string, string> = {
  'Apex Wolf': 'bg-violet-950/50 text-violet-300 border-violet-700/60',
  'Alpha Wolf': 'bg-amber-950/50 text-amber-300 border-amber-700/60',
  'Scout Wolf': 'bg-cyan-950/50 text-cyan-300 border-cyan-700/60',
}
const TIER_HINT: Record<string, string> = {
  'Apex Wolf': 'Apex: ADX crossed 25 on the Weekly or Monthly chart, together with the other confluence checks. The slowest, widest-picture trigger.',
  'Alpha Wolf': 'Alpha: ADX crossed 25 on the Daily chart, together with the other confluence checks.',
  'Scout Wolf': 'Scout: ADX crossed 25 on the Hourly chart, together with the other confluence checks. The fastest, most frequent trigger.',
}
const TIER_ORDER: Record<string, number> = { 'Apex Wolf': 0, 'Alpha Wolf': 1, 'Scout Wolf': 2 }
const RANK_CHIP: Record<string, string> = {
  'A+': 'bg-emerald-950/50 text-emerald-300 border-emerald-700/60',
  A: 'bg-cyan-950/50 text-cyan-300 border-cyan-700/60',
  B: 'bg-amber-950/50 text-amber-300 border-amber-700/60',
  C: 'bg-gray-800 text-gray-400 border-gray-700',
}
const RANK_HINT: Record<string, string> = {
  'A+': 'A+: ADX, RSI and Bollinger Band all agree on 2 or more timeframes.',
  A: 'A: ADX and RSI agree across multiple timeframes.',
  B: 'B: a fresh single-trigger breakout.',
  C: 'C: a single-timeframe continuation.',
}
const RANK_ORDER: Record<string, number> = { 'A+': 0, A: 1, B: 2, C: 3 }
const EVENT_CHIP = 'bg-sky-950/40 text-sky-300 border-sky-700/50'
const FRESH_CLS: Record<string, string> = {
  'Fresh Now': 'text-lime-400',
  'Still Active': 'text-amber-400',
  'Seen Earlier Today': 'text-gray-500',
}
const TAIL_CLS: Record<string, string> = {
  'Sector Tailwind': 'text-emerald-400',
  'Against Sector': 'text-red-400',
  'Solo / Mixed Sector': 'text-gray-500',
}

const ADX_HINT = 'ADX measures how strong a trend is, not which way it is heading. Above 25 usually means a trend is developing.'
const DI_HINT = 'DI gap = difference between +DI and −DI. A wider gap means one side is clearly stronger.'
const BB_HINT = 'Bollinger Band width percentile: how narrow the bands are compared with their own history. A low number means the price has been squeezed into a tight range.'
const RSI_HINT = 'RSI (0–100) measures momentum. Above 60 = strong, below 40 = weak.'

const dirCls = (d?: string | null) => (d === 'Bullish' ? 'text-emerald-400' : d === 'Bearish' ? 'text-red-400' : 'text-gray-400')

function Chip({ cls, children, title }: { cls: string; children: React.ReactNode; title?: string }) {
  return <span title={title} className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-md border whitespace-nowrap ${cls}`}>{children}</span>
}

function Pill({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all ${on ? 'bg-indigo-950/60 text-white border-indigo-500' : 'bg-gray-900/60 text-gray-400 border-gray-700 hover:text-white'}`}>
      {children}
    </button>
  )
}

function Stat({ label, value, sub, cls, onClick, active }: { label: string; value: number | string; sub: string; cls: string; onClick?: () => void; active?: boolean }) {
  return (
    <button onClick={onClick} disabled={!onClick}
      className={`text-left rounded-xl border p-3 transition-all ${cls} ${active ? 'ring-1 ring-indigo-400' : ''} ${onClick ? 'hover:brightness-125 cursor-pointer' : 'cursor-default'}`}>
      <p className="text-[11px] text-gray-400">{label}</p>
      <p className="text-2xl font-black text-white leading-tight">{value}</p>
      <p className="text-[11px] text-gray-500 leading-snug">{sub}</p>
    </button>
  )
}

export default function WolvesDashboard({
  wolves, events, watchlist, dates, loading, updatedAt, countdown, running, onRefresh, onRunNow,
}: {
  wolves: Any[]; events: Any[]; watchlist: Any[]
  dates: { wolves?: string; events?: string; watchlist?: string; fallback?: boolean }
  loading: boolean; updatedAt: Date | null; countdown: number; running: boolean
  onRefresh: () => void; onRunNow: () => void
}) {
  const [view, setView] = useState<'wolves' | 'events' | 'watchlist'>('wolves')
  const [q, setQ] = useState('')
  const [dir, setDir] = useState<'all' | 'Bullish' | 'Bearish'>('all')
  const [tier, setTier] = useState('all')
  const [rank, setRank] = useState('all')
  const [evType, setEvType] = useState('all')
  const [tf, setTf] = useState('all')
  const [freshOnly, setFreshOnly] = useState(false)
  const [sort, setSort] = useState<'default' | 'latest' | 'adx'>('default')

  const reset = () => { setQ(''); setDir('all'); setTier('all'); setRank('all'); setEvType('all'); setTf('all'); setFreshOnly(false); setSort('default') }
  const qq = q.trim().toLowerCase()
  const symOk = (s: string) => !qq || s.toLowerCase().includes(qq)

  const counts = useMemo(() => ({
    apex: wolves.filter(w => w.wolf_tier === 'Apex Wolf').length,
    alpha: wolves.filter(w => w.wolf_tier === 'Alpha Wolf').length,
    scout: wolves.filter(w => w.wolf_tier === 'Scout Wolf').length,
    fresh: events.filter(e => e.signal_freshness === 'Fresh Now').length,
    aplus: watchlist.filter(w => w.rank === 'A+').length,
    a: watchlist.filter(w => w.rank === 'A').length,
  }), [wolves, events, watchlist])

  const timeCmp = (a: Any, b: Any) => (b.scan_time || '').localeCompare(a.scan_time || '')

  const wRows = useMemo(() => wolves
    .filter(w => symOk(w.symbol) && (dir === 'all' || w.direction === dir) && (tier === 'all' || w.wolf_tier === tier) && (tf === 'all' || w.trigger_timeframe === tf))
    .sort((a, b) => sort === 'latest' ? timeCmp(a, b) : sort === 'adx' ? (b.adx ?? 0) - (a.adx ?? 0)
      : (TIER_ORDER[a.wolf_tier] ?? 9) - (TIER_ORDER[b.wolf_tier] ?? 9) || timeCmp(a, b)),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [wolves, qq, dir, tier, tf, sort])

  const eRows = useMemo(() => events
    .filter(e => symOk(e.symbol) && (dir === 'all' || e.direction === dir) && (evType === 'all' || e.event_type === evType)
      && (tf === 'all' || e.timeframe === tf) && (!freshOnly || e.signal_freshness === 'Fresh Now'))
    .sort((a, b) => sort === 'latest' ? timeCmp(a, b) : sort === 'adx' ? (b.adx ?? 0) - (a.adx ?? 0)
      : (a.priority ?? 9) - (b.priority ?? 9) || timeCmp(a, b)),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [events, qq, dir, evType, tf, freshOnly, sort])

  const lRows = useMemo(() => watchlist
    .filter(w => symOk(w.symbol) && (dir === 'all' || w.direction === dir) && (rank === 'all' || w.rank === rank))
    .sort((a, b) => sort === 'latest' ? timeCmp(a, b) : sort === 'adx' ? (b.adx ?? 0) - (a.adx ?? 0)
      : (RANK_ORDER[a.rank] ?? 9) - (RANK_ORDER[b.rank] ?? 9) || (b.decision_score ?? 0) - (a.decision_score ?? 0)),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [watchlist, qq, dir, rank, sort])

  const evTypes = useMemo(() => Array.from(new Set(events.map(e => e.event_type))).sort(), [events])
  const total = view === 'wolves' ? wolves.length : view === 'events' ? events.length : watchlist.length
  const shown = view === 'wolves' ? wRows.length : view === 'events' ? eRows.length : lRows.length
  const filtered = shown !== total
  const scanDate = view === 'wolves' ? dates.wolves : view === 'events' ? dates.events : dates.watchlist
  const mm = Math.floor(countdown / 60), ss = (countdown % 60).toString().padStart(2, '0')
  const stamp = updatedAt ? updatedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }) : '—'
  const sym = (s: string) => <a href={`/stock/${encodeURIComponent(s)}?v=new`} className="font-bold text-white hover:text-indigo-300">{s}</a>
  const th = 'px-3 py-2 text-left whitespace-nowrap'
  const thr = 'px-3 py-2 text-right whitespace-nowrap'
  const tdr = 'px-3 py-2.5 text-right text-gray-200'
  const empty = (cols: number) => (
    <tr><td colSpan={cols} className="text-center text-gray-500 py-10 text-sm">
      {loading ? 'Loading…' : filtered ? 'Nothing matches these filters. Press Reset to clear them.'
        : `Nothing here yet${scanDate ? ` for ${scanDate}` : ''}. Try “Run scan now” if the market is open.`}
    </td></tr>
  )

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-2">
            <Zap size={24} className="text-amber-400" /> Wolves Scanner
          </h1>
          <p className="text-gray-500 text-sm mt-1 max-w-2xl">
            Stocks where trend strength (ADX), momentum (RSI) and Bollinger Band squeezes line up. Educational screening only: it describes what the indicators are doing, not what will happen next.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-gray-400" title="The page reloads itself every 5 minutes">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Updated {stamp} · next in {mm}:{ss}
          </div>
          <button onClick={onRunNow} disabled={running}
            className="flex items-center gap-1.5 px-3 py-2 bg-amber-600 hover:bg-amber-500 text-xs font-bold text-black rounded-lg disabled:opacity-50">
            <Zap size={12} className={running ? 'animate-pulse' : ''} />{running ? 'Scanning…' : 'Run scan now'}
          </button>
          <button onClick={onRefresh} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-xs font-medium text-white rounded-lg border border-gray-700 disabled:opacity-50">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />Refresh
          </button>
        </div>
      </div>

      {/* Stat strip — tap a card to filter */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-4">
        <Stat label="🏔️ Apex" value={counts.apex} sub="Weekly / Monthly ADX cross" cls="bg-violet-950/20 border-violet-800/40"
          onClick={() => { setView('wolves'); setTier(tier === 'Apex Wolf' ? 'all' : 'Apex Wolf') }} active={view === 'wolves' && tier === 'Apex Wolf'} />
        <Stat label="🐺 Alpha" value={counts.alpha} sub="Daily ADX cross" cls="bg-amber-950/20 border-amber-800/40"
          onClick={() => { setView('wolves'); setTier(tier === 'Alpha Wolf' ? 'all' : 'Alpha Wolf') }} active={view === 'wolves' && tier === 'Alpha Wolf'} />
        <Stat label="🔍 Scout" value={counts.scout} sub="Hourly ADX cross" cls="bg-cyan-950/20 border-cyan-800/40"
          onClick={() => { setView('wolves'); setTier(tier === 'Scout Wolf' ? 'all' : 'Scout Wolf') }} active={view === 'wolves' && tier === 'Scout Wolf'} />
        <Stat label="⚡ Fresh events" value={counts.fresh} sub="first seen on the latest scans" cls="bg-lime-950/20 border-lime-800/40"
          onClick={() => { setView('events'); setFreshOnly(!freshOnly) }} active={view === 'events' && freshOnly} />
        <Stat label="⭐ Rank A+" value={counts.aplus} sub="ADX + RSI + BB on 2+ timeframes" cls="bg-emerald-950/20 border-emerald-800/40"
          onClick={() => { setView('watchlist'); setRank(rank === 'A+' ? 'all' : 'A+') }} active={view === 'watchlist' && rank === 'A+'} />
        <Stat label="Rank A" value={counts.a} sub="multi-timeframe ADX + RSI" cls="bg-gray-900/40 border-gray-800"
          onClick={() => { setView('watchlist'); setRank(rank === 'A' ? 'all' : 'A') }} active={view === 'watchlist' && rank === 'A'} />
      </div>

      {/* View switch */}
      <div className="flex items-center gap-1 mb-3 bg-gray-900 border border-gray-700 rounded-lg p-1 w-fit max-w-full overflow-x-auto">
        {([['wolves', 'Wolves (confluence)'], ['events', 'Fresh events'], ['watchlist', 'Decision watchlist']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setView(k)}
            className={`px-3 py-1.5 text-sm font-bold rounded-md whitespace-nowrap ${view === k ? 'bg-white text-gray-900' : 'text-gray-400 hover:text-white'}`}>{l}</button>
        ))}
      </div>

      {/* One filter row */}
      <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-3 mb-3 flex flex-col gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search symbol…"
            className="bg-gray-950 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white w-40 focus:outline-none focus:border-indigo-500" />
          <span className="text-[11px] text-gray-500 uppercase font-bold ml-1">Direction</span>
          {(['all', 'Bullish', 'Bearish'] as const).map(d => <Pill key={d} on={dir === d} onClick={() => setDir(d)}>{d === 'all' ? 'All' : d}</Pill>)}
          {view === 'wolves' && <>
            <span className="text-[11px] text-gray-500 uppercase font-bold ml-2">Tier</span>
            {['all', 'Apex Wolf', 'Alpha Wolf', 'Scout Wolf'].map(t => <Pill key={t} on={tier === t} onClick={() => setTier(t)}>{t === 'all' ? 'All' : t.replace(' Wolf', '')}</Pill>)}
          </>}
          {view === 'watchlist' && <>
            <span className="text-[11px] text-gray-500 uppercase font-bold ml-2">Rank</span>
            {['all', 'A+', 'A', 'B', 'C'].map(r => <Pill key={r} on={rank === r} onClick={() => setRank(r)}>{r === 'all' ? 'All' : r}</Pill>)}
          </>}
        </div>
        {view !== 'watchlist' && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-gray-500 uppercase font-bold">Timeframe</span>
            {['all', 'Hourly', 'Daily', 'Weekly', 'Monthly'].map(t => <Pill key={t} on={tf === t} onClick={() => setTf(t)}>{t === 'all' ? 'All' : t}</Pill>)}
            {view === 'events' && <>
              <span className="text-[11px] text-gray-500 uppercase font-bold ml-2">Event</span>
              <select value={evType} onChange={e => setEvType(e.target.value)}
                className="bg-gray-950 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white max-w-[14rem]">
                <option value="all">All events</option>
                {evTypes.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <Pill on={freshOnly} onClick={() => setFreshOnly(!freshOnly)}>⚡ Fresh only</Pill>
            </>}
          </div>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] text-gray-500 uppercase font-bold">Sort</span>
          <Pill on={sort === 'default'} onClick={() => setSort('default')}>{view === 'wolves' ? 'Tier' : view === 'events' ? 'Priority' : 'Rank'}</Pill>
          <Pill on={sort === 'latest'} onClick={() => setSort('latest')}>Latest first</Pill>
          {view !== 'watchlist' && <Pill on={sort === 'adx'} onClick={() => setSort('adx')}>Highest ADX</Pill>}
          <span className="text-xs text-gray-500 ml-2">
            Showing {shown} of {total}{scanDate ? ` · scan date ${scanDate}${dates.fallback ? ' (last trading day)' : ''}` : ''}
          </span>
          {(filtered || sort !== 'default' || q) && <button onClick={reset} className="text-xs text-indigo-300 hover:text-indigo-200 ml-1">Reset</button>}
        </div>
      </div>

      {/* Tables */}
      <div className="bg-gray-900/30 border border-gray-800 rounded-xl overflow-x-auto">
        {view === 'wolves' && (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-800 text-gray-500 text-[11px] uppercase">
              <th className={th}>Symbol</th><th className={th}>Tier</th><th className={th}>Direction</th><th className={th}>Timeframe</th>
              <th className={thr} title={ADX_HINT}>ADX <span className="cursor-help">ⓘ</span></th>
              <th className={thr} title={RSI_HINT}>Hourly RSI <span className="cursor-help">ⓘ</span></th>
              <th className={thr} title={DI_HINT}>DI gap <span className="cursor-help">ⓘ</span></th>
              <th className={thr} title={BB_HINT}>BB width %ile <span className="cursor-help">ⓘ</span></th>
              <th className={thr}>Close</th><th className={th}>Time</th>
            </tr></thead>
            <tbody>
              {wRows.length === 0 && empty(10)}
              {wRows.map(w => (
                <tr key={w.event_key} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                  <td className="px-3 py-2.5">{sym(w.symbol)}</td>
                  <td className="px-3 py-2.5"><Chip cls={TIER_CHIP[w.wolf_tier] || 'bg-gray-900 text-gray-400 border-gray-700'} title={TIER_HINT[w.wolf_tier]}>{w.wolf_tier}</Chip></td>
                  <td className={`px-3 py-2.5 font-medium ${dirCls(w.direction)}`}>{w.direction || '—'}</td>
                  <td className="px-3 py-2.5 text-gray-300">{w.trigger_timeframe}</td>
                  <td className={`${tdr} font-semibold`}>{w.adx ?? '—'}</td>
                  <td className={tdr}>{w.hourly_rsi ?? '—'}</td>
                  <td className={tdr}>{w.di_gap ?? '—'}</td>
                  <td className={tdr}>{w.bb_width_pct != null ? `${w.bb_width_pct}%` : '—'}</td>
                  <td className={tdr}>{w.close ?? '—'}</td>
                  <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{w.scan_time || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {view === 'events' && (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-800 text-gray-500 text-[11px] uppercase">
              <th className={th}>Symbol</th><th className={th}>Direction</th><th className={th}>Event</th><th className={th}>Timeframe</th>
              <th className={thr} title={ADX_HINT}>ADX <span className="cursor-help">ⓘ</span></th>
              <th className={thr} title={RSI_HINT}>RSI <span className="cursor-help">ⓘ</span></th>
              <th className={thr} title="Decision score: the scanner's own 0–100 ranking of how many checks line up. Higher means more checks agree.">Score <span className="cursor-help">ⓘ</span></th>
              <th className={th} title="Fresh Now = first seen on the latest scans. Still Active = seen on earlier scans and still present. Seen Earlier Today = no longer showing.">Freshness <span className="cursor-help">ⓘ</span></th>
              <th className={thr}>Seen ×</th><th className={th}>Time</th>
            </tr></thead>
            <tbody>
              {eRows.length === 0 && empty(10)}
              {eRows.map(e => (
                <tr key={e.event_key} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                  <td className="px-3 py-2.5">{sym(e.symbol)}</td>
                  <td className={`px-3 py-2.5 font-medium ${dirCls(e.direction)}`}>{e.direction}</td>
                  <td className="px-3 py-2.5"><Chip cls={EVENT_CHIP} title={e.meaning || undefined}>{e.event_type}</Chip></td>
                  <td className="px-3 py-2.5 text-gray-300">{e.timeframe}</td>
                  <td className={`${tdr} font-semibold`}>{e.adx ?? '—'}</td>
                  <td className={tdr}>{e.rsi ?? '—'}</td>
                  <td className={`${tdr} font-bold text-white`}>{e.decision_score ?? '—'}</td>
                  <td className={`px-3 py-2.5 whitespace-nowrap ${FRESH_CLS[e.signal_freshness || ''] || 'text-gray-500'}`}>
                    {e.signal_freshness === 'Fresh Now' && <span className="inline-block w-1.5 h-1.5 rounded-full bg-lime-400 mr-1 align-middle" />}{e.signal_freshness || '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right text-gray-400">{e.times_seen ?? 1}</td>
                  <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{e.scan_time || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {view === 'watchlist' && (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-800 text-gray-500 text-[11px] uppercase">
              <th className={th}>Rank</th><th className={th}>Symbol</th><th className={th}>Direction</th><th className={th}>Signal type</th>
              <th className={th}>Timeframes</th><th className={th}>Sector</th>
              <th className={thr} title="Decision score: the scanner's own 0–100 ranking of how many checks line up. Higher means more checks agree.">Score <span className="cursor-help">ⓘ</span></th>
              <th className={th}>Confidence</th><th className={th}>Why it is listed</th>
            </tr></thead>
            <tbody>
              {lRows.length === 0 && empty(9)}
              {lRows.map(w => (
                <tr key={w.event_key} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                  <td className="px-3 py-2.5"><Chip cls={RANK_CHIP[w.rank] || 'bg-gray-900 text-gray-400 border-gray-700'} title={RANK_HINT[w.rank]}>{w.rank}</Chip></td>
                  <td className="px-3 py-2.5">{sym(w.symbol)}</td>
                  <td className={`px-3 py-2.5 font-medium ${dirCls(w.direction)}`}>{w.direction}</td>
                  <td className="px-3 py-2.5 text-gray-300 text-xs">{w.signal_type || '—'}</td>
                  <td className="px-3 py-2.5 text-gray-300">{w.timeframes || '—'}</td>
                  <td className="px-3 py-2.5 text-xs">
                    <span className="text-gray-400">{w.sector || 'Unclassified'}</span>
                    {w.sector_tailwind && <span className={`block ${TAIL_CLS[w.sector_tailwind] || 'text-gray-500'}`}>{w.sector_tailwind}</span>}
                  </td>
                  <td className={`${tdr} font-bold text-white`}>{w.decision_score ?? '—'}</td>
                  <td className="px-3 py-2.5 text-gray-300">{w.confidence}</td>
                  <td className="px-3 py-2.5 text-gray-500 text-xs max-w-md leading-snug" title={w.why || undefined}>
                    <span className="line-clamp-2">{w.why || '—'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
