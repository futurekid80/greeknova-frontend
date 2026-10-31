'use client'
// Oct 31 2026: "What's happening right now" row for the Pulse page (preview, ?v=new).
// Four live cards in the Stealth-dashboard style: Stealth strikes, volume bursts,
// latest alerts and market tone. Uses data the page already has (stocks) plus two
// light feeds (saved Stealth events, latest alerts). Educational only.
import { useEffect, useMemo, useState } from 'react'
import { SIGNAL_META, DEFAULT_META } from '@/lib/alertMeta'

const API = 'https://api.greeknova.com'
const INDICES = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY', 'SENSEX']

interface Props {
  stocks: any[]
  onSymbolClick?: (sym: string) => void
  loading?: boolean
  day?: string | null
}

function Card({ title, sub, right, children }: { title: string; sub?: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/30 p-3.5 min-w-0 flex flex-col">
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-200">{title}</p>
          {sub && <p className="text-[11px] text-gray-500">{sub}</p>}
        </div>
        {right}
      </div>
      <div className="flex-1">{children}</div>
    </div>
  )
}

const Empty = ({ text }: { text: string }) => <p className="text-xs text-gray-500 py-5 text-center">{text}</p>

export default function PulseNowStrip({ stocks, onSymbolClick, loading, day }: Props) {
  const [stealth, setStealth] = useState<any[] | null>(null)
  const [alerts, setAlerts] = useState<any[] | null>(null)

  useEffect(() => {
    let dead = false
    const get = async (p: string) => { try { const r = await fetch(API + p); return r.ok ? await r.json() : null } catch { return null } }
    get('/option-stealth-buildup/saved?window=eod&zone=5').then(s => { if (!dead) setStealth(s?.events || []) })
    return () => { dead = true }
  }, [])

  // Alerts for the active trading day (the last session when the market is closed).
  useEffect(() => {
    let dead = false
    fetch(`${API}/alerts?limit=8${day ? `&date=${day}` : ''}`)
      .then(r => (r.ok ? r.json() : null)).catch(() => null)
      .then(a => { if (!dead) setAlerts(a?.alerts || []) })
    return () => { dead = true }
  }, [day])

  const eq = useMemo(() => (stocks || []).filter(s => !INDICES.includes(s.symbol)), [stocks])

  const bursts = useMemo(
    () => eq.filter(s => s.vol_surge && (s.vol_ratio || 0) > 0).sort((a, b) => (b.vol_ratio || 0) - (a.vol_ratio || 0)).slice(0, 5),
    [eq]
  )

  const tone = useMemo(() => {
    const c = { up: 0, down: 0, lb: 0, sb: 0, sc: 0, lu: 0 }
    eq.forEach(s => {
      if ((s.price_chg_pct || 0) > 0) c.up++
      else if ((s.price_chg_pct || 0) < 0) c.down++
      if (s.signal === 'LONG_BUILDUP') c.lb++
      else if (s.signal === 'SHORT_BUILDUP') c.sb++
      else if (s.signal === 'SHORT_COVERING') c.sc++
      else if (s.signal === 'LONG_UNWINDING') c.lu++
    })
    return c
  }, [eq])

  const topStealth = useMemo(
    () => (stealth || []).slice().sort((a, b) => Number(b.oi_pct || 0) - Number(a.oi_pct || 0)).slice(0, 5),
    [stealth]
  )

  const total = tone.up + tone.down || 1
  const upPct = Math.round((tone.up / total) * 100)
  const click = (sym: string) => onSymbolClick?.(sym)

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">What&apos;s happening right now</h2>
        <span className="text-xs text-gray-600">Click a stock to open its dashboard</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <Card title="🎯 Stealth strikes" sub="OI building while premium stays quiet"
          right={<a href="/strike-stealth" className="text-[11px] text-indigo-300 hover:text-indigo-200 whitespace-nowrap">Open →</a>}>
          {stealth === null ? <Empty text="Loading…" /> : topStealth.length ? (
            <div className="space-y-1.5">
              {topStealth.map((e, i) => (
                <button key={i} onClick={() => click(e.symbol)} className="w-full flex items-center justify-between gap-2 rounded-lg border border-gray-800 bg-gray-900/40 px-2.5 py-1.5 text-xs hover:border-gray-600 text-left">
                  <span className="font-bold text-white truncate">{e.symbol} <span className="text-gray-400 font-normal">{Number(e.strike).toLocaleString('en-IN')}</span> <span className={e.option_type === 'CE' ? 'text-emerald-300' : 'text-rose-300'}>{e.option_type}</span></span>
                  <span className="text-emerald-400 font-semibold whitespace-nowrap">+{Number(e.oi_pct || 0).toFixed(0)}% OI</span>
                </button>
              ))}
            </div>
          ) : <Empty text="No Stealth strikes saved yet. They appear as the market runs." />}
        </Card>

        <Card title="🔥 Volume bursts" sub="Volume well above its usual level"
          right={<span className="text-[11px] text-gray-600 whitespace-nowrap">{bursts.length ? `${eq.filter(s => s.vol_surge).length} stocks` : ''}</span>}>
          {loading && !eq.length ? <Empty text="Loading…" /> : bursts.length ? (
            <div className="space-y-1.5">
              {bursts.map(s => (
                <button key={s.symbol} onClick={() => click(s.symbol)} className="w-full flex items-center justify-between gap-2 rounded-lg border border-gray-800 bg-gray-900/40 px-2.5 py-1.5 text-xs hover:border-gray-600 text-left">
                  <span className="font-bold text-white">{s.symbol}</span>
                  <span className={`font-semibold ${(s.price_chg_pct || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{(s.price_chg_pct || 0) >= 0 ? '+' : ''}{(s.price_chg_pct || 0).toFixed(2)}%</span>
                  <span className="text-amber-300 font-semibold whitespace-nowrap">{(s.vol_ratio || 0).toFixed(1)}× vol</span>
                </button>
              ))}
            </div>
          ) : <Empty text="No volume bursts right now." />}
        </Card>

        <Card title="🔔 Latest alerts" sub="Most recent option alerts"
          right={<a href="/alerts" className="text-[11px] text-indigo-300 hover:text-indigo-200 whitespace-nowrap">All →</a>}>
          {alerts === null ? <Empty text="Loading…" /> : alerts.length ? (
            <div className="space-y-1.5">
              {alerts.slice(0, 5).map((a, i) => {
                const m = SIGNAL_META[a.signal] || DEFAULT_META
                let t = ''
                try { t = new Date(a.receivedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }) } catch {}
                return (
                  <button key={a.id || i} onClick={() => a.symbol && click(a.symbol)} className={`w-full flex items-center justify-between gap-2 rounded-lg border ${m.border} ${m.bg} px-2.5 py-1.5 text-xs text-left`}>
                    <span className="font-bold text-white truncate">{a.symbol}</span>
                    <span className={`${m.color} font-semibold truncate`}>{m.icon} {m.label !== 'Alert' ? m.label : String(a.signal || 'alert').replace(/_/g, ' ').toLowerCase().replace(/^./, (c: string) => c.toUpperCase())}</span>
                    <span className="text-gray-500 whitespace-nowrap">{t}</span>
                  </button>
                )
              })}
            </div>
          ) : <Empty text="No alerts yet." />}
        </Card>

        <Card title="🧭 Market tone" sub="F&O stocks, price vs previous close">
          {!eq.length ? <Empty text="Loading…" /> : (
            <div>
              <div className="flex h-2.5 rounded-full overflow-hidden bg-gray-800 mb-1.5">
                <div className="bg-emerald-500" style={{ width: `${upPct}%` }} />
                <div className="bg-rose-500" style={{ width: `${100 - upPct}%` }} />
              </div>
              <div className="flex justify-between text-xs mb-3">
                <span className="text-emerald-400 font-semibold">{tone.up} up</span>
                <span className="text-rose-400 font-semibold">{tone.down} down</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                <div className="rounded-lg border border-emerald-900/60 bg-emerald-950/20 px-2.5 py-1.5"><p className="text-gray-400 text-[10px]">Long buildup</p><p className="text-emerald-300 font-bold">{tone.lb}</p></div>
                <div className="rounded-lg border border-rose-900/60 bg-rose-950/20 px-2.5 py-1.5"><p className="text-gray-400 text-[10px]">Short buildup</p><p className="text-rose-300 font-bold">{tone.sb}</p></div>
                <div className="rounded-lg border border-cyan-900/60 bg-cyan-950/20 px-2.5 py-1.5"><p className="text-gray-400 text-[10px]">Short covering</p><p className="text-cyan-300 font-bold">{tone.sc}</p></div>
                <div className="rounded-lg border border-amber-900/60 bg-amber-950/20 px-2.5 py-1.5"><p className="text-gray-400 text-[10px]">Long unwinding</p><p className="text-amber-300 font-bold">{tone.lu}</p></div>
              </div>
              <p className="text-[10px] text-gray-600 mt-2">Describes positioning, not a prediction.</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
