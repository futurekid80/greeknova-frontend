'use client'
// Nov 22 2026 EXPERIMENT. Admin-only sector accumulation / turning read. Not linked from the navbar and not
// shown to members. Same access check as /admin/members. To discard: delete this file and
// services/sector_intel.py + the /admin/sector-intel route on the backend.
import Navbar from '@/components/Navbar'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

const API = 'https://api.greeknova.com'
const ADMIN_EMAIL = 'megha.jethmalani@gmail.com'

interface Stk { symbol: string; state: string; oi_pct: number; px_pct: number }
interface StockRow extends Stk { px20: number | null }
interface Sec {
  sector: string; stocks: number; label: string
  recent_score: number; prior_score: number | null; change: number | null
  breadth_pct: number; avg_px_5d: number; avg_px_prior: number | null
  counts: Record<string, number>; leaders: Stk[]; weak: Stk[]; stock_rows: StockRow[]; flip_kind?: string | null
}
interface Hist {
  label: string; sector_days: number
  n5: number; excess_5d_pct: number | null; beat_market_5d_pct: number | null
  n10: number; excess_10d_pct: number | null; beat_market_10d_pct: number | null
}
interface Data { turning_up_count?: number; turning_down_count?: number; wave_min?: number; as_of: string; history_days: number; window_recent: number; window_prior: number; sectors: Sec[]; history_check: Hist[]; note: string; error?: string }

const LABEL_STYLE: Record<string, string> = {
  'Turning up': 'text-emerald-300 border-emerald-600 bg-emerald-950/50',
  'Accumulating': 'text-emerald-400 border-emerald-800 bg-emerald-950/30',
  'Mixed': 'text-gray-300 border-gray-700 bg-gray-800/40',
  'Distributing': 'text-red-400 border-red-800 bg-red-950/30',
  'Turning down': 'text-red-300 border-red-600 bg-red-950/50',
}
const STATE_NAME: Record<string, string> = { LB: 'Long buildup', SC: 'Short covering', SB: 'Short buildup', LU: 'Long unwinding', N: 'Neutral' }
const sign = (n: number | null | undefined, d = 1) => (n == null ? '—' : `${n > 0 ? '+' : ''}${n.toFixed(d)}`)

function Bar({ v }: { v: number }) {
  const w = Math.min(100, Math.abs(v)) / 2
  return (
    <div className="relative h-1.5 w-full bg-gray-800 rounded">
      <div className="absolute top-0 bottom-0 left-1/2 w-px bg-gray-600" />
      <div className={`absolute top-0 bottom-0 rounded ${v >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`}
        style={v >= 0 ? { left: '50%', width: `${w}%` } : { right: '50%', width: `${w}%` }} />
    </div>
  )
}

export default function SectorIntelPage() {
  const [checking, setChecking] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [basis, setBasis] = useState<'5d' | '20d'>('5d')

  const load = useCallback(async (refresh = false) => {
    setLoading(true); setErr('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${API}/admin/sector-intel${refresh ? '?refresh=1' : ''}`, {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      })
      const j = await res.json()
      if (!res.ok || j.error) setErr(j.error || 'Could not load')
      else setData(j)
    } catch {
      setErr('Network error. Try again.')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function check() {
      const { data: { session } } = await supabase.auth.getSession()
      const email = (session?.user?.email || '').toLowerCase().trim()
      if (cancelled) return
      setAuthorized(email === ADMIN_EMAIL)
      setChecking(false)
      if (email === ADMIN_EMAIL) load()
    }
    check()
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      const email = (session?.user?.email || '').toLowerCase().trim()
      setAuthorized(email === ADMIN_EMAIL)
      setChecking(false)
      if (email === ADMIN_EMAIL) load()
    })
    return () => { cancelled = true; listener.subscription.unsubscribe() }
  }, [load])

  if (checking) return <div className="min-h-screen bg-[#07070e] text-white flex items-center justify-center"><p className="text-gray-500">Checking access…</p></div>
  if (!authorized) return (
    <div className="min-h-screen bg-[#07070e] text-white"><Navbar />
      <div className="flex flex-col items-center justify-center py-32"><h2 className="text-xl font-bold text-gray-400 mb-2">Not authorized</h2><p className="text-sm text-gray-600">This page is restricted.</p></div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#07070e] text-white">
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-8">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
          <div>
            <h1 className="text-xl font-black">Sector Turnaround Watch <span className="ml-2 text-[10px] font-bold uppercase tracking-wide border border-amber-700 text-amber-300 rounded px-1.5 py-0.5 align-middle">experiment · admin only</span></h1>
            <p className="text-sm text-gray-400 mt-1">Which sectors are quietly accumulating or distributing, and which are turning. A clue from futures OI and price (near + next month together), not a prediction.</p>
          </div>
          <button onClick={() => load(true)} disabled={loading} className="text-xs px-3 py-1.5 rounded-lg border border-gray-700 text-gray-300 hover:text-white disabled:opacity-50">{loading ? 'Loading…' : 'Refresh'}</button>
        </div>

        {err && <p className="text-red-400 text-sm my-4">{err}</p>}
        {loading && !data && <p className="text-gray-500 text-sm my-6">Calculating… the first load can take 20 to 30 seconds.</p>}

        {data && (
          <>
            <p className="text-xs text-gray-500 mb-4">As of {data.as_of} · recent = last {data.window_recent} trading days, prior = the {data.window_prior} days before that · {data.history_days} days of history</p>

            {((data.turning_up_count ?? 0) >= (data.wave_min ?? 4) || (data.turning_down_count ?? 0) >= (data.wave_min ?? 4)) && (
              <div className="border border-amber-700/60 bg-amber-950/30 text-amber-200 rounded-xl p-3 mb-4 text-xs">
                Market-wide move today: {data.turning_up_count} sectors turning up and {data.turning_down_count} turning down. When many sectors flip together it says more about the market than about any one sector, so read single-sector flips with more weight.
              </div>
            )}

            <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 mb-5 text-xs text-gray-400 leading-relaxed">
              <b className="text-gray-200">How to read the score (-100 to +100):</b> every stock in the sector is read as long buildup, short covering, short buildup or long unwinding over the window. Long buildup counts fully for the sector, short covering counts half, and the bearish two count the same way against it.
              <b className="text-gray-200"> Turning up</b> = weak in the prior window, clearly better in the last 5 days with most stocks rising. <b className="text-gray-200">Accumulating / Distributing</b> = a strong one-sided read that was not weak before.
            </div>

            <p className="text-[11px] text-gray-500 mb-2">Tap a tile to see how the stocks in that sector compare with each other. Tile colour = sector score (green bullish, red bearish).</p>
            <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 mb-5">
              {data.sectors.map(s => {
                const a = Math.min(1, Math.abs(s.recent_score) / 100) * 0.5 + 0.06
                const bg = s.recent_score >= 0 ? `rgba(16,185,129,${a})` : `rgba(239,68,68,${a})`
                const on = selected === s.sector
                return (
                  <button key={s.sector} onClick={() => setSelected(on ? null : s.sector)}
                    className={`text-left rounded-xl border p-3 min-w-0 transition ${on ? 'border-white/70' : 'border-gray-800 hover:border-gray-600'}`}
                    style={{ background: bg }}>
                    <div className="font-bold text-sm truncate">{s.sector}</div>
                    <div className="flex items-baseline justify-between gap-1 mt-1">
                      <span className="text-xl font-black">{sign(s.recent_score, 0)}</span>
                      <span className="text-[10px] text-gray-300">{sign(s.prior_score, 0)} before</span>
                    </div>
                    <div className="text-[10px] font-bold uppercase tracking-wide mt-1 text-gray-200 truncate">{s.label}</div>
                    <div className="text-[9px] text-gray-400 h-3">{s.flip_kind === 'sector-only' ? 'sector-only flip' : s.flip_kind === 'market-wide' ? 'with the market' : ''}</div>
                  </button>
                )
              })}
            </div>

            {(() => {
              const s = data.sectors.find(x => x.sector === selected)
              if (!s) return null
              const val = (r: StockRow) => (basis === '5d' ? r.px_pct : r.px20)
              const rows = s.stock_rows.filter(r => val(r) != null)
              const avg = rows.length ? rows.reduce((t, r) => t + (val(r) as number), 0) / rows.length : 0
              const rel = rows.map(r => ({ r, rel: (val(r) as number) - avg })).sort((x, y) => y.rel - x.rel)
              const maxAbs = Math.max(1, ...rel.map(x => Math.abs(x.rel)))
              return (
                <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 mb-8">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div className="font-bold">{s.sector} <span className="text-gray-500 font-normal text-xs">· {s.stocks} stocks · {s.label}</span></div>
                    <div className="flex gap-1 text-xs">
                      {(['5d', '20d'] as const).map(b => (
                        <button key={b} onClick={() => setBasis(b)} className={`px-2.5 py-1 rounded-lg border ${basis === b ? 'border-white/60 text-white' : 'border-gray-700 text-gray-400'}`}>{b === '5d' ? 'Last 5 days' : 'Last 20 days'}</button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs mb-3 max-w-md">
                    <div><div className="text-gray-500 mb-1">Recent {sign(s.recent_score, 0)}</div><Bar v={s.recent_score} /></div>
                    <div><div className="text-gray-500 mb-1">Prior {sign(s.prior_score, 0)}</div><Bar v={s.prior_score ?? 0} /></div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 text-[10px] mb-4">
                    {(['LB', 'SC', 'SB', 'LU'] as const).map(k => (
                      <span key={k} className="border border-gray-700 rounded px-1.5 py-0.5 text-gray-400">{STATE_NAME[k]} <b className="text-gray-200">{s.counts[k] ?? 0}</b></span>
                    ))}
                    <span className="border border-gray-700 rounded px-1.5 py-0.5 text-gray-400">Stocks rising <b className="text-gray-200">{s.breadth_pct}%</b></span>
                  </div>
                  <p className="text-[11px] text-gray-500 mb-2">Each bar shows how far a stock is ahead of (green, right) or behind (red, left) the sector average price move over the {basis === '5d' ? 'last 5' : 'last 20'} days. The sector average is {sign(avg, 1)}%. Chips show the stock&apos;s OI and price read over the last 5 days.</p>
                  <div className="space-y-1">
                    {rel.map(({ r, rel: v }) => (
                      <div key={r.symbol} className="flex items-center gap-2 text-[11px]">
                        <div className="w-24 sm:w-28 truncate font-semibold text-gray-200">{r.symbol}</div>
                        <div className="relative flex-1 h-3 bg-gray-800/70 rounded">
                          <div className="absolute top-0 bottom-0 left-1/2 w-px bg-gray-600" />
                          <div className={`absolute top-0 bottom-0 rounded ${v >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`}
                            style={v >= 0 ? { left: '50%', width: `${(v / maxAbs) * 50}%` } : { right: '50%', width: `${(-v / maxAbs) * 50}%` }} />
                        </div>
                        <div className="w-28 sm:w-40 text-right text-gray-400 shrink-0">
                          <span className={(val(r) as number) >= 0 ? 'text-emerald-400' : 'text-red-400'}>{sign(val(r) as number, 1)}%</span>
                          <span className="text-gray-600"> · </span>
                          <span title={`${STATE_NAME[r.state]}: OI ${sign(r.oi_pct, 0)}%, price ${sign(r.px_pct, 0)}% (5d)`}>{STATE_NAME[r.state]}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}

            <h2 className="text-sm font-bold mb-2">History check (for you only)</h2>
            <p className="text-xs text-gray-500 mb-3">What sectors in each state did over the next 5 and 10 trading days, versus the average F&amp;O stock over the same days. Windows overlap and the history is short, so this is indicative only. Members would never see this.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[640px]">
                <thead><tr className="text-[10px] uppercase tracking-wide text-gray-500 text-left border-b border-gray-800">
                  <th className="px-3 py-2">State</th><th className="px-2 py-2 text-right">Sector-days</th>
                  <th className="px-2 py-2 text-right">Next 5d vs market</th><th className="px-2 py-2 text-right">Beat market</th>
                  <th className="px-2 py-2 text-right">Next 10d vs market</th><th className="px-2 py-2 text-right">Beat market</th>
                </tr></thead>
                <tbody>
                  {data.history_check.map(h => (
                    <tr key={h.label} className="border-b border-gray-800/60">
                      <td className="px-3 py-2"><span className={`text-[10px] font-bold uppercase border rounded px-2 py-0.5 ${LABEL_STYLE[h.label] || LABEL_STYLE.Mixed}`}>{h.label}</span></td>
                      <td className="px-2 py-2 text-right text-gray-300">{h.sector_days}</td>
                      <td className={`px-2 py-2 text-right ${(h.excess_5d_pct ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{h.excess_5d_pct == null ? '—' : `${sign(h.excess_5d_pct, 2)}%`} <span className="text-gray-600">({h.n5})</span></td>
                      <td className="px-2 py-2 text-right text-gray-300">{h.beat_market_5d_pct == null ? '—' : `${h.beat_market_5d_pct}%`}</td>
                      <td className={`px-2 py-2 text-right ${(h.excess_10d_pct ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{h.excess_10d_pct == null ? '—' : `${sign(h.excess_10d_pct, 2)}%`} <span className="text-gray-600">({h.n10})</span></td>
                      <td className="px-2 py-2 text-right text-gray-300">{h.beat_market_10d_pct == null ? '—' : `${h.beat_market_10d_pct}%`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-gray-600 mt-6">Educational analytics only. Not investment advice. Experiment for internal testing.</p>
          </>
        )}
      </div>
    </div>
  )
}
