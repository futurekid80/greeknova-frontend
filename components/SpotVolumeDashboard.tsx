'use client'
// Redesigned Spot Volume Breakout view — same look as Pulse / Strike Stealth / Wolves.
// Presentation only: it reads the exact same /spot-volume/scan data the old page loads.
// "Breakout" is split in two: with volume (confirmed) and without volume (volume still pending).
import { useMemo, useState } from 'react'
import { RefreshCw, Zap } from 'lucide-react'

type Any = any
type Key = 'all' | 'bo_vol' | 'bo_novol' | 'bursting' | 'pausing'

const STATE_CHIP: Record<string, string> = {
  bo_vol: 'bg-emerald-950/50 text-emerald-300 border-emerald-700/60',
  bo_novol: 'bg-amber-950/50 text-amber-300 border-amber-700/60',
  bursting: 'bg-orange-950/50 text-orange-300 border-orange-700/60',
  pausing: 'bg-cyan-950/50 text-cyan-300 border-cyan-700/60',
}
const STATE_LABEL: Record<string, string> = {
  bo_vol: '📈 Breakout with volume',
  bo_novol: '⚡ Breakout without volume',
  bursting: '🔥 Bursting now',
  pausing: '⏸ Pausing',
}
const STATE_HINT: Record<string, string> = {
  bo_vol: 'Price traded above the burst day’s high, and the breakout day’s volume was 1.5× its normal level or more.',
  bo_novol: 'Price traded above the burst day’s high, but volume is below 1.5× its normal level (it may still build during the day). A move without volume is often less reliable.',
  bursting: 'A volume burst (2× normal or more) is happening today. Its high is still forming, so there is nothing to break out above yet.',
  pausing: 'A burst happened on an earlier day and price has not yet traded above that day’s high.',
}
const BAR_CLS: Record<string, string> = {
  bo_vol: 'bg-emerald-500', bo_novol: 'bg-amber-500', bursting: 'bg-orange-500', pausing: 'bg-cyan-500',
}

const fmtDate = (d?: string) => {
  try { return d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—' } catch { return d || '—' }
}
const fmtVol = (v: number) => v >= 1e7 ? `${(v / 1e7).toFixed(2)}Cr` : v >= 1e5 ? `${(v / 1e5).toFixed(2)}L` : Number(v).toLocaleString()
const istDay = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })  // YYYY-MM-DD
const keyOf = (r: Any): Key => r.state === 'breakout' ? (r.confirmed ? 'bo_vol' : 'bo_novol') : r.state === 'bursting' ? 'bursting' : 'pausing'

function Pill({ on, onClick, children, title }: { on: boolean; onClick: () => void; children: React.ReactNode; title?: string }) {
  return (
    <button onClick={onClick} title={title}
      className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all ${on ? 'bg-indigo-950/60 text-white border-indigo-500' : 'bg-gray-900/60 text-gray-400 border-gray-700 hover:text-white'}`}>
      {children}
    </button>
  )
}

function Stat({ label, value, sub, cls, onClick, active }: { label: string; value: number | string; sub: string; cls: string; onClick: () => void; active: boolean }) {
  return (
    <button onClick={onClick}
      className={`text-left rounded-xl border p-3 transition-all hover:brightness-125 ${cls} ${active ? 'ring-1 ring-indigo-400' : ''}`}>
      <p className="text-[11px] text-gray-400">{label}</p>
      <p className="text-2xl font-black text-white leading-tight">{value}</p>
      <p className="text-[11px] text-gray-500 leading-snug">{sub}</p>
    </button>
  )
}

// A small horizontal bar: how many times normal volume (capped at 6x so one giant bar doesn't flatten the rest)
function VolBar({ ratio, cls }: { ratio?: number | null; cls: string }) {
  const r = Number(ratio) || 0
  const w = Math.max(4, Math.min(100, (r / 6) * 100))
  return (
    <div className="flex items-center gap-2 justify-end">
      <div className="w-20 h-1.5 rounded-full bg-gray-800 overflow-hidden"><div className={`h-full rounded-full ${cls}`} style={{ width: `${w}%` }} /></div>
      <span className="font-bold text-white tabular-nums w-12 text-right">{r ? `${r}×` : '—'}</span>
    </div>
  )
}

export default function SpotVolumeDashboard({
  rows, towerRows, futMap, scanned, generatedAt, loading, updatedAt, countdown, onRefresh,
}: {
  rows: Any[]; towerRows: Any[]; futMap: Record<string, number>
  scanned: number; generatedAt: string; loading: boolean; updatedAt: Date | null; countdown: number; onRefresh: () => void
}) {
  const [view, setView] = useState<Key>('all')
  const [q, setQ] = useState('')
  const [todayOnly, setTodayOnly] = useState(false)
  const [candle, setCandle] = useState<'all' | 'green' | 'red'>('all')
  const [sort, setSort] = useState<'default' | 'vol'>('default')

  const today = istDay(new Date())
  const isNew = (r: Any) => r.state === 'breakout' ? (r.breakout_date || '').slice(0, 10) === today : r.state === 'bursting'
  const counts = useMemo(() => {
    const c: Record<string, number> = { bo_vol: 0, bo_novol: 0, bursting: 0, pausing: 0, newToday: 0 }
    rows.forEach(r => { c[keyOf(r)]++; if (r.state === 'breakout' && isNew(r)) c.newToday++ })
    return c
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, today])

  const qq = q.trim().toLowerCase()
  const shown = useMemo(() => rows
    .filter(r => (view === 'all' || keyOf(r) === view)
      && (!qq || r.symbol.toLowerCase().includes(qq))
      && (!todayOnly || isNew(r))
      && (candle === 'all' || (candle === 'green' ? r.burst_is_green === true : r.burst_is_green === false)))
    .sort((a, b) => {
      const order: Record<Key, number> = { bo_vol: 0, bo_novol: 1, bursting: 2, pausing: 3, all: 9 }
      const va = a.state === 'breakout' ? a.breakout_vol_ratio : a.burst_ratio
      const vb = b.state === 'breakout' ? b.breakout_vol_ratio : b.burst_ratio
      if (sort === 'vol') return (vb ?? 0) - (va ?? 0)
      return order[keyOf(a)] - order[keyOf(b)] || (vb ?? 0) - (va ?? 0)
    }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [rows, view, qq, todayOnly, candle, sort, today])

  const towerShown = towerRows.filter(t => !qq || t.symbol.toLowerCase().includes(qq))
  const maxTower = Math.max(6, ...towerRows.map(t => t.tower_ratio || 0))
  const filtered = view !== 'all' || !!qq || todayOnly || candle !== 'all'
  const reset = () => { setView('all'); setQ(''); setTodayOnly(false); setCandle('all'); setSort('default') }
  const mm = Math.floor(countdown / 60), ss = (countdown % 60).toString().padStart(2, '0')
  const stamp = updatedAt ? updatedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }) : '—'
  const scanStamp = generatedAt ? new Date(generatedAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }) : ''
  const th = 'px-3 py-2 text-left whitespace-nowrap'
  const thr = 'px-3 py-2 text-right whitespace-nowrap'
  const sym = (s: string) => <a href={`/stock/${encodeURIComponent(s)}?v=new`} className="font-bold text-white hover:text-indigo-300">{s}</a>

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-2">
            <Zap size={24} className="text-amber-400" /> Spot Volume Breakout
          </h1>
          <p className="text-gray-500 text-sm mt-1 max-w-2xl">
            Burst → pause → breakout, measured on real cash-market volume, which avoids the false readings futures volume gives in rollover weeks. Educational screening only: it describes volume and price behaviour, not what happens next.
          </p>
          {scanned > 0 && <p className="text-xs text-gray-600 mt-1">Scanned {scanned} stocks{scanStamp ? ` · scan data from ${scanStamp} IST` : ''}</p>}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-gray-400" title="The page reloads itself every 5 minutes">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Updated {stamp} · next in {mm}:{ss}
          </div>
          <button onClick={onRefresh} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-xs font-medium text-white rounded-lg border border-gray-700 disabled:opacity-50">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />Refresh
          </button>
        </div>
      </div>

      {/* Tower Day */}
      {towerRows.length > 0 && (
        <div className="mb-4 bg-gradient-to-r from-amber-950/30 via-amber-900/10 to-transparent border border-amber-700/40 rounded-2xl p-4">
          <div className="flex items-baseline gap-2 mb-3 flex-wrap">
            <h2 className="text-base font-black text-amber-300">🏢 Tower Day</h2>
            <span className="text-xs text-gray-500" title="Today’s volume is 6× or more its trailing 20-day average. It resets every day and only shows on the day it happens.">
              today’s volume is 6× or more the 20-day average · {towerRows.length} stock{towerRows.length === 1 ? '' : 's'} <span className="cursor-help">ⓘ</span>
            </span>
          </div>
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))' }}>
            {towerShown.map(t => (
              <a key={t.symbol} href={`/stock/${encodeURIComponent(t.symbol)}?v=new`}
                className="bg-black/30 border border-amber-800/40 hover:border-amber-600/60 rounded-xl p-3 transition-colors">
                <div className="flex items-baseline justify-between">
                  <span className="font-bold text-white">{t.symbol}</span>
                  <span className="text-amber-400 font-black text-lg">{t.tower_ratio}×</span>
                </div>
                <div className="h-1.5 rounded-full bg-gray-800 overflow-hidden my-1.5">
                  <div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.min(100, (t.tower_ratio / maxTower) * 100)}%` }} />
                </div>
                <div className="text-[11px] text-gray-500">{fmtVol(t.tower_volume)} vs {fmtVol(t.avg_volume_20d)} avg · CMP {t.cmp?.toLocaleString()}</div>
              </a>
            ))}
            {towerShown.length === 0 && <p className="text-xs text-gray-500">No Tower Day stock matches the search.</p>}
          </div>
        </div>
      )}

      {/* Stat strip — tap a card to filter */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
        <Stat label="📈 Breakout with volume" value={counts.bo_vol} sub="broke the burst high, volume ≥ 1.5× normal" cls="bg-emerald-950/20 border-emerald-800/40"
          onClick={() => setView(view === 'bo_vol' ? 'all' : 'bo_vol')} active={view === 'bo_vol'} />
        <Stat label="⚡ Breakout without volume" value={counts.bo_novol} sub="broke the burst high, volume still below 1.5×" cls="bg-amber-950/20 border-amber-800/40"
          onClick={() => setView(view === 'bo_novol' ? 'all' : 'bo_novol')} active={view === 'bo_novol'} />
        <Stat label="🔥 Bursting now" value={counts.bursting} sub="volume burst forming today" cls="bg-orange-950/20 border-orange-800/40"
          onClick={() => setView(view === 'bursting' ? 'all' : 'bursting')} active={view === 'bursting'} />
        <Stat label="⏸ Pausing" value={counts.pausing} sub="burst earlier, not yet above its high" cls="bg-cyan-950/20 border-cyan-800/40"
          onClick={() => setView(view === 'pausing' ? 'all' : 'pausing')} active={view === 'pausing'} />
        <Stat label="🆕 New today" value={counts.newToday} sub="breakouts that happened today" cls="bg-lime-950/20 border-lime-800/40"
          onClick={() => setTodayOnly(!todayOnly)} active={todayOnly} />
      </div>

      {/* One filter row */}
      <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-3 mb-3 flex flex-col gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search symbol…"
            className="bg-gray-950 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white w-40 focus:outline-none focus:border-indigo-500" />
          <span className="text-[11px] text-gray-500 uppercase font-bold ml-1">Show</span>
          <Pill on={view === 'all'} onClick={() => setView('all')}>All</Pill>
          <Pill on={view === 'bo_vol'} onClick={() => setView('bo_vol')} title={STATE_HINT.bo_vol}>Breakout with volume</Pill>
          <Pill on={view === 'bo_novol'} onClick={() => setView('bo_novol')} title={STATE_HINT.bo_novol}>Breakout without volume</Pill>
          <Pill on={view === 'bursting'} onClick={() => setView('bursting')} title={STATE_HINT.bursting}>Bursting</Pill>
          <Pill on={view === 'pausing'} onClick={() => setView('pausing')} title={STATE_HINT.pausing}>Pausing</Pill>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Pill on={todayOnly} onClick={() => setTodayOnly(!todayOnly)} title="Only breakouts that happened today, plus bursts forming today">🆕 New today</Pill>
          <span className="text-[11px] text-gray-500 uppercase font-bold ml-2" title="The colour of the burst day’s candle. Green = it closed up (buyers stepped in). Red = it closed down (often a selling climax).">Burst candle ⓘ</span>
          {(['all', 'green', 'red'] as const).map(c => <Pill key={c} on={candle === c} onClick={() => setCandle(c)}>{c === 'all' ? 'All' : c === 'green' ? '🟢 Green' : '🔴 Red'}</Pill>)}
          <span className="text-[11px] text-gray-500 uppercase font-bold ml-2">Sort</span>
          <Pill on={sort === 'default'} onClick={() => setSort('default')}>Type</Pill>
          <Pill on={sort === 'vol'} onClick={() => setSort('vol')}>Highest volume</Pill>
          <span className="text-xs text-gray-500 ml-2">Showing {shown.length} of {rows.length}</span>
          {(filtered || sort !== 'default') && <button onClick={reset} className="text-xs text-indigo-300 hover:text-indigo-200 ml-1">Reset</button>}
        </div>
      </div>

      {/* Table */}
      <div className="bg-gray-900/30 border border-gray-800 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-800 text-gray-500 text-[11px] uppercase">
            <th className={th}>Symbol</th>
            <th className={th}>State</th>
            <th className={thr}>CMP</th>
            <th className={thr} title="Spot (cash-market) volume vs its normal level. For breakouts this is the breakout day; for bursts it is the burst day. The bar is capped at 6×.">Spot volume ⓘ</th>
            <th className={thr} title="Futures volume vs its normal level, for comparison. A red ⚠️ means spot and futures disagree noticeably, often a rollover-week effect on the futures side.">Futures vol ⓘ</th>
            <th className={th}>Burst day</th>
            <th className={thr}>Burst high</th>
            <th className={th}>Breakout / since</th>
          </tr></thead>
          <tbody>
            {shown.length === 0 && (
              <tr><td colSpan={8} className="text-center text-gray-500 py-10 text-sm">
                {loading ? 'Loading…' : filtered ? 'Nothing matches these filters. Press Reset to clear them.' : 'No stocks currently match this pattern.'}
              </td></tr>
            )}
            {shown.map(r => {
              const k = keyOf(r)
              const fut = futMap[r.symbol]
              const vr = r.state === 'breakout' ? r.breakout_vol_ratio : r.burst_ratio
              const divergent = fut != null && Math.abs(fut - (vr ?? 0)) >= 1.0
              return (
                <tr key={r.symbol} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {sym(r.symbol)}
                    {isNew(r) && <span className="ml-1.5 text-[10px] font-bold text-lime-300 bg-lime-950/50 border border-lime-700/50 rounded px-1 py-px align-middle" title="Happened today">NEW</span>}
                  </td>
                  <td className="px-3 py-2.5"><span title={STATE_HINT[k]} className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-md border whitespace-nowrap ${STATE_CHIP[k]}`}>{STATE_LABEL[k]}</span></td>
                  <td className="px-3 py-2.5 text-right text-gray-300">{r.cmp?.toLocaleString() ?? '—'}</td>
                  <td className="px-3 py-2.5">
                    <VolBar ratio={vr} cls={BAR_CLS[k]} />
                    {r.state === 'breakout' && <p className="text-[10px] text-gray-600 text-right">burst was {r.burst_ratio}× ({r.baseline_used})</p>}
                    {r.state !== 'breakout' && <p className="text-[10px] text-gray-600 text-right">vs {r.baseline_used} avg</p>}
                  </td>
                  <td className={`px-3 py-2.5 text-right font-bold ${divergent ? 'text-red-400' : 'text-gray-400'}`}>
                    {fut != null ? `${fut}×` : '—'}{divergent && <span className="ml-1 text-[10px]" title="Spot and futures volume differ noticeably">⚠️</span>}
                  </td>
                  <td className="px-3 py-2.5 text-gray-400 whitespace-nowrap">
                    {fmtDate(r.burst_date)}
                    {r.burst_is_green != null && <span className="ml-1.5" title={r.burst_is_green ? 'Burst day closed green: buyers stepped in' : 'Burst day closed red: often a selling climax, not accumulation'}>{r.burst_is_green ? '🟢' : '🔴'}</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right text-gray-400">{r.burst_high?.toLocaleString()}</td>
                  <td className="px-3 py-2.5 text-gray-400 whitespace-nowrap">
                    {r.state === 'breakout' ? fmtDate(r.breakout_date)
                      : r.state === 'bursting' ? 'Forming today'
                      : <>
                          {r.pause_days} day{r.pause_days === 1 ? '' : 's'}
                          {r.avg_pause_vol_ratio != null && (
                            <span className={`ml-1.5 text-xs ${r.avg_pause_vol_ratio < 0.8 ? 'text-cyan-500' : 'text-gray-600'}`}
                              title={r.avg_pause_vol_ratio < 0.8 ? 'Volume went quiet during the pause: a genuinely dull consolidation' : 'Volume during the pause stayed near or above normal: not a quiet coil'}>
                              · vol {r.avg_pause_vol_ratio}× avg
                            </span>
                          )}
                        </>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-gray-600 mt-3 leading-relaxed">
        A pause is dropped from the list if price closes below the burst day’s low, because that is a failed setup, not a healthy hold.
        Volume multiples compare each day with the stock’s own recent average (5, 10 or 20 days, shown under the figure).
      </p>
    </div>
  )
}
