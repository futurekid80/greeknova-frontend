'use client'
import { useState, useEffect, useCallback } from 'react'
import Navbar from '@/components/Navbar'

const API = process.env.NEXT_PUBLIC_API_URL || 'https://greeknova-backend-production.up.railway.app'

// ── Types ─────────────────────────────────────────────────────────────────────
interface WallAlert {
  type: string
  label: string
  icon: string
  severity: 'HIGH' | 'MEDIUM' | 'LOW'
  detail: string
  color: string
}

interface WallSignal {
  symbol: string
  cmp: number
  ce_wall: number
  pe_wall: number
  poc: number
  ce_wall_prev: number
  pe_wall_prev: number
  range_pts: number
  range_pct: number
  zone: 'BELOW_SUPPORT' | 'IN_ZONE' | 'ABOVE_RESISTANCE'
  zone_label: string
  zone_color: string
  convergence_zone: boolean
  iv: number | null
  ivr: number | null
  ivp: number | null
  iv_history_days: number
  iv_label: string | null
  iv_color: string | null
  strategy: string | null
  alerts: WallAlert[]
  top_alert: WallAlert
  alert_count: number
}

interface WallData {
  signals: WallSignal[]
  total: number
  trade_date: string
  ts_latest: string
  ts_prev: string
  generated_at: string
  message?: string
  error?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtPrice(n: number) {
  if (!n) return '—'
  return n >= 1000
    ? n.toLocaleString('en-IN', { maximumFractionDigits: 0 })
    : n.toFixed(1)
}

function pctFrom(cmp: number, level: number) {
  if (!level || !cmp) return null
  const pct = ((cmp - level) / level) * 100
  return pct.toFixed(1)
}

const SEVERITY_COLOR: Record<string, string> = {
  HIGH:   'text-red-400 bg-red-950/40 border-red-800/50',
  MEDIUM: 'text-amber-400 bg-amber-950/40 border-amber-800/50',
  LOW:    'text-sky-400 bg-sky-950/40 border-sky-800/50',
}

const ZONE_TABS = [
  { key: 'all',               label: 'All Signals',       emoji: '📊' },
  { key: 'BELOW_SUPPORT',     label: 'Below Support',     emoji: '🔴' },
  { key: 'IN_ZONE',           label: 'In Zone',           emoji: '🟡' },
  { key: 'ABOVE_RESISTANCE',  label: 'Above Resistance',  emoji: '🟢' },
  { key: 'convergence',       label: '⭐ Convergence',    emoji: ''   },
]

// ── Zone Badge ────────────────────────────────────────────────────────────────
function ZoneBadge({ zone, convergence }: { zone: string; convergence: boolean }) {
  const cfg: Record<string, { label: string; cls: string }> = {
    BELOW_SUPPORT:    { label: 'Below Support',    cls: 'text-red-400 bg-red-950/40 border-red-800/50' },
    IN_ZONE:          { label: 'In Zone',          cls: 'text-amber-400 bg-amber-950/40 border-amber-800/50' },
    ABOVE_RESISTANCE: { label: 'Above Resistance', cls: 'text-emerald-400 bg-emerald-950/40 border-emerald-800/50' },
  }
  const z = cfg[zone] || { label: zone, cls: 'text-gray-400 bg-gray-800/40 border-gray-700/50' }
  return (
    <div className="flex items-center gap-1.5">
      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${z.cls}`}>
        {z.label}
      </span>
      {convergence && (
        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-950/50 border border-purple-700/50 text-purple-300">
          ⭐ Convergence
        </span>
      )}
    </div>
  )
}

// ── Signal Card ───────────────────────────────────────────────────────────────
function SignalCard({ s }: { s: WallSignal }) {
  const [expanded, setExpanded] = useState(false)

  const ceShift = s.ce_wall - s.ce_wall_prev
  const peShift = s.pe_wall - s.pe_wall_prev
  const pctToCe = pctFrom(s.cmp, s.ce_wall)
  const pctToPe = pctFrom(s.cmp, s.pe_wall)
  const pctToPoc = pctFrom(s.cmp, s.poc)

  const borderCls =
    s.convergence_zone ? 'border-purple-700/50' :
    s.zone === 'ABOVE_RESISTANCE' ? 'border-emerald-700/40' :
    s.zone === 'BELOW_SUPPORT' ? 'border-red-700/40' :
    'border-gray-800'

  return (
    <div className={`rounded-xl border ${borderCls} bg-gray-900/40 overflow-hidden`}>
      {/* Header */}
      <div
        className="flex items-start justify-between p-4 cursor-pointer hover:bg-gray-900/60 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-white font-black text-base">{s.symbol}</span>
            <span className="text-gray-400 text-sm">₹{fmtPrice(s.cmp)}</span>
            {s.convergence_zone && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-950/60 border border-purple-700/50 text-purple-300">
                ⭐ Convergence Zone
              </span>
            )}
          </div>
          <ZoneBadge zone={s.zone} convergence={false} />
        </div>

        {/* Top alert badge */}
        <div className="text-right ml-3">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-lg border ${SEVERITY_COLOR[s.top_alert.severity]}`}>
            {s.top_alert.icon} {s.top_alert.label}
          </span>
          {s.alert_count > 1 && (
            <p className="text-[10px] text-gray-500 mt-1">+{s.alert_count - 1} more</p>
          )}
        </div>
      </div>

      {/* Level grid */}
      <div className="px-4 pb-3">
        {/* Visual price bar */}
        <div className="relative h-6 bg-gray-800 rounded-full mb-3 overflow-hidden">
          {/* PE Wall marker */}
          {s.pe_wall > 0 && s.ce_wall > s.pe_wall && (
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-emerald-500"
              style={{ left: `${((s.pe_wall - s.pe_wall * 0.85) / (s.ce_wall * 1.15 - s.pe_wall * 0.85)) * 100}%` }}
            />
          )}
          {/* CE Wall marker */}
          {s.ce_wall > 0 && (
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-red-500"
              style={{ left: `${Math.min(95, ((s.ce_wall - s.pe_wall * 0.85) / (s.ce_wall * 1.15 - s.pe_wall * 0.85)) * 100)}%` }}
            />
          )}
          {/* POC marker */}
          {s.poc > 0 && s.ce_wall > s.pe_wall && (
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-purple-400 opacity-70"
              style={{ left: `${((s.poc - s.pe_wall * 0.85) / (s.ce_wall * 1.15 - s.pe_wall * 0.85)) * 100}%` }}
            />
          )}
          {/* CMP dot */}
          {s.cmp > 0 && s.ce_wall > 0 && s.pe_wall > 0 && (
            <div
              className="absolute top-1 bottom-1 w-3 h-4 rounded-full bg-white shadow-lg"
              style={{
                left: `${Math.max(2, Math.min(94, ((s.cmp - s.pe_wall * 0.85) / (s.ce_wall * 1.15 - s.pe_wall * 0.85)) * 100))}%`,
              }}
            />
          )}
        </div>
        <div className="flex justify-between text-[9px] text-gray-600 mb-3 -mt-1">
          <span className="text-emerald-600">🟢 PE {fmtPrice(s.pe_wall)}</span>
          <span className="text-purple-500">◆ POC {fmtPrice(s.poc)}</span>
          <span className="text-red-600">🔴 CE {fmtPrice(s.ce_wall)}</span>
        </div>

        {/* 3-column stats */}
        <div className="grid grid-cols-3 gap-2">
          {/* PE Wall */}
          <div className="bg-emerald-950/20 border border-emerald-800/30 rounded-lg p-2 text-center">
            <p className="text-[9px] text-gray-500 uppercase tracking-wide mb-0.5">PE Wall (Support)</p>
            <p className="text-sm font-bold text-emerald-400">₹{fmtPrice(s.pe_wall)}</p>
            <p className={`text-[10px] mt-0.5 ${Number(pctToPe) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {pctToPe !== null ? `${Number(pctToPe) > 0 ? '+' : ''}${pctToPe}% from CMP` : '—'}
            </p>
            {peShift !== 0 && (
              <p className={`text-[9px] mt-0.5 ${peShift > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                {peShift > 0 ? '↑' : '↓'} {Math.abs(peShift)} pts
              </p>
            )}
          </div>

          {/* POC */}
          <div className="bg-purple-950/20 border border-purple-800/30 rounded-lg p-2 text-center">
            <p className="text-[9px] text-gray-500 uppercase tracking-wide mb-0.5">POC</p>
            <p className="text-sm font-bold text-purple-300">
              {s.poc ? `₹${fmtPrice(s.poc)}` : '—'}
            </p>
            <p className={`text-[10px] mt-0.5 ${Number(pctToPoc) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {pctToPoc !== null ? `${Number(pctToPoc) > 0 ? '+' : ''}${pctToPoc}% from CMP` : '—'}
            </p>
            <p className="text-[9px] text-gray-600 mt-0.5">Highest OI strike</p>
          </div>

          {/* CE Wall */}
          <div className="bg-red-950/20 border border-red-800/30 rounded-lg p-2 text-center">
            <p className="text-[9px] text-gray-500 uppercase tracking-wide mb-0.5">CE Wall (Resistance)</p>
            <p className="text-sm font-bold text-red-400">₹{fmtPrice(s.ce_wall)}</p>
            <p className={`text-[10px] mt-0.5 ${Number(pctToCe) <= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
              {pctToCe !== null ? `${Number(pctToCe) > 0 ? '+' : ''}${pctToCe}% from CMP` : '—'}
            </p>
            {ceShift !== 0 && (
              <p className={`text-[9px] mt-0.5 ${ceShift > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                {ceShift > 0 ? '↑' : '↓'} {Math.abs(ceShift)} pts
              </p>
            )}
          </div>
        </div>

        {/* Range + IV row */}
        <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
          <span>Range: <span className="text-gray-300">{fmtPrice(s.range_pts)} pts ({s.range_pct}%)</span></span>
          <button
            onClick={e => { e.stopPropagation(); setExpanded(x => !x) }}
            className="text-gray-600 hover:text-gray-400 transition-colors"
          >
            {expanded ? '▲ Hide alerts' : '▼ All alerts'}
          </button>
        </div>

        {/* IVR/IVP row */}
        {s.iv_label && (
          <div className={`mt-2 flex items-center justify-between px-3 py-2 rounded-lg border text-xs ${
            s.iv_color === 'sky'    ? 'bg-sky-950/30 border-sky-800/40' :
            s.iv_color === 'amber'  ? 'bg-amber-950/30 border-amber-800/40' :
            s.iv_color === 'gray'   ? 'bg-gray-900/40 border-gray-700/40' :
            'bg-emerald-950/30 border-emerald-800/40'
          }`}>
            <div className="flex items-center gap-2">
              <span className={`font-bold ${
                s.iv_color === 'sky'   ? 'text-sky-400' :
                s.iv_color === 'amber' ? 'text-amber-400' :
                s.iv_color === 'gray'  ? 'text-gray-400' :
                'text-emerald-400'
              }`}>
                📊 {s.iv_label}
              </span>
              {s.ivp !== null && s.ivp !== undefined && (
                <span className="text-gray-500 text-[10px]">IVP {s.ivp?.toFixed(0)}%ile</span>
              )}
              {s.iv_history_days > 0 && (
                <span className="text-gray-600 text-[9px]">{s.iv_history_days}d history</span>
              )}
            </div>
            <span className="text-gray-300 text-[10px] max-w-[180px] text-right">{s.strategy}</span>
          </div>
        )}
      </div>

      {/* Expanded alerts */}
      {expanded && (
        <div className="border-t border-gray-800 px-4 py-3 space-y-2">
          {s.alerts.map((a, i) => (
            <div key={i} className={`flex items-start gap-2 px-3 py-2 rounded-lg border text-xs ${SEVERITY_COLOR[a.severity]}`}>
              <span className="text-base leading-none">{a.icon}</span>
              <div>
                <p className="font-semibold">{a.label}</p>
                <p className="opacity-80 mt-0.5">{a.detail}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── How To Read ───────────────────────────────────────────────────────────────
function HowToRead() {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-gray-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-900/60 hover:bg-gray-900 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <span>📖</span>
          <span className="text-sm font-semibold text-gray-300">How to read this scanner</span>
        </div>
        <span className="text-gray-500 text-sm">{open ? '▲ Close' : '▼ Open'}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-2 bg-gray-950/60 space-y-3 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
            <div className="bg-red-950/20 border border-red-800/30 rounded-lg p-3">
              <p className="text-red-400 font-bold mb-1">🔴 Below Support</p>
              <p className="text-gray-300 leading-relaxed">CMP is below the PE Wall — stock has broken through the main put writing zone. Bears in control. Watch for bounce or continuation breakdown.</p>
              <p className="text-gray-500 mt-1.5 italic">Example: ADANIENT at 2940-2960 when PE Wall + POC + CE Wall all at 3000.</p>
            </div>
            <div className="bg-amber-950/20 border border-amber-800/30 rounded-lg p-3">
              <p className="text-amber-400 font-bold mb-1">🟡 In Zone</p>
              <p className="text-gray-300 leading-relaxed">CMP is between PE Wall and CE Wall — stock is inside the OI range. Bulls and bears balancing. POC = price gravity center.</p>
              <p className="text-gray-500 mt-1.5 italic">Watch: is CMP closer to PE (bullish bias) or CE (resistance ahead)?</p>
            </div>
            <div className="bg-emerald-950/20 border border-emerald-800/30 rounded-lg p-3">
              <p className="text-emerald-400 font-bold mb-1">🟢 Above Resistance</p>
              <p className="text-gray-300 leading-relaxed">CMP has broken above the CE Wall — options writers forced to cover. Often signals momentum continuation. Watch for next CE Wall level.</p>
              <p className="text-gray-500 mt-1.5 italic">Example: ADANIENT crossing 3000 after building below it.</p>
            </div>
          </div>
          <div className="bg-purple-950/20 border border-purple-800/30 rounded-lg p-3">
            <p className="text-purple-300 font-bold mb-1">⭐ Convergence Zone — highest quality setup</p>
            <p className="text-gray-300 leading-relaxed">CE Wall + PE Wall + POC are all within 2% of each other — maximum OI concentration at one price level. When price breaks through this zone, the move is typically sharp and sustained because a large number of positions are forced to unwind simultaneously.</p>
          </div>
          <p className="text-[10px] text-gray-600 text-center">Informational only · Not SEBI registered · Not buy/sell advice</p>
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function WallMigrationPage() {
  const [data, setData]     = useState<WallData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('all')

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API}/wall-migration`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
    } catch (e: any) {
      setError(e.message || 'Failed to load')
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const filtered = (data?.signals || []).filter(s => {
    if (activeTab === 'all')          return true
    if (activeTab === 'convergence')  return s.convergence_zone
    return s.zone === activeTab
  })

  // Tab counts
  const counts = {
    all:              data?.signals.length || 0,
    BELOW_SUPPORT:    data?.signals.filter(s => s.zone === 'BELOW_SUPPORT').length || 0,
    IN_ZONE:          data?.signals.filter(s => s.zone === 'IN_ZONE').length || 0,
    ABOVE_RESISTANCE: data?.signals.filter(s => s.zone === 'ABOVE_RESISTANCE').length || 0,
    convergence:      data?.signals.filter(s => s.convergence_zone).length || 0,
  }

  if (loading) return (
    <div className="min-h-screen bg-black">
      <Navbar active="/signals/wall-migration" />
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-4">
        <div className="h-8 w-64 bg-gray-800 rounded-lg animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-48 bg-gray-900 rounded-xl animate-pulse" />)}
        </div>
      </div>
    </div>
  )

  if (error) return (
    <div className="min-h-screen bg-black">
      <Navbar active="/signals/wall-migration" />
      <div className="flex items-center justify-center py-32">
        <div className="text-center">
          <p className="text-red-400 text-lg font-semibold mb-2">Failed to load</p>
          <p className="text-gray-400 text-sm mb-4">{error}</p>
          <button onClick={fetchData} className="px-4 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg text-sm hover:bg-gray-700">Retry</button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar active="/signals/wall-migration" />
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">🧱 Wall Migration Scanner</h1>
            <p className="text-gray-400 text-sm mt-1">
              CMP vs CE Wall · PE Wall · POC — where is price relative to key OI levels?
              {data?.generated_at && <span className="text-gray-600"> · Updated {data.generated_at}</span>}
            </p>
          </div>
          <button onClick={fetchData} className="text-xs px-3 py-1.5 bg-gray-900 border border-gray-700 text-gray-300 rounded-lg hover:border-gray-500 hover:text-white transition-all">
            ↻ Refresh
          </button>
        </div>

        {/* Summary tiles */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Below Support',    count: counts.BELOW_SUPPORT,    color: 'text-red-400',     sub: 'CMP < PE Wall' },
            { label: 'In Zone',          count: counts.IN_ZONE,          color: 'text-amber-400',   sub: 'PE Wall ≤ CMP ≤ CE Wall' },
            { label: 'Above Resistance', count: counts.ABOVE_RESISTANCE, color: 'text-emerald-400', sub: 'CMP > CE Wall' },
            { label: '⭐ Convergence',   count: counts.convergence,       color: 'text-purple-400',  sub: 'All levels within 2%' },
          ].map(t => (
            <div key={t.label} className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
              <p className="text-xs text-gray-400 mb-1">{t.label}</p>
              <p className={`text-3xl font-black ${t.color}`}>{t.count}</p>
              <p className="text-[10px] text-gray-600 mt-1">{t.sub}</p>
            </div>
          ))}
        </div>

        {/* How to read */}
        <HowToRead />

        {/* Zone Tabs */}
        <div className="flex flex-wrap gap-2">
          {ZONE_TABS.map(tab => {
            const count = counts[tab.key as keyof typeof counts] ?? 0
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold transition-all ${
                  isActive
                    ? tab.key === 'convergence'
                      ? 'bg-purple-900/40 border-purple-600 text-purple-300'
                      : tab.key === 'BELOW_SUPPORT'
                      ? 'bg-red-900/30 border-red-600 text-red-300'
                      : tab.key === 'IN_ZONE'
                      ? 'bg-amber-900/30 border-amber-600 text-amber-300'
                      : tab.key === 'ABOVE_RESISTANCE'
                      ? 'bg-emerald-900/30 border-emerald-600 text-emerald-300'
                      : 'bg-gray-800 border-gray-600 text-white'
                    : 'bg-gray-900/50 border-gray-800 text-gray-400 hover:border-gray-600 hover:text-gray-300'
                }`}
              >
                {tab.emoji && <span>{tab.emoji}</span>}
                {tab.label}
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${isActive ? 'bg-black/30' : 'bg-gray-800'}`}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Signal cards */}
        {filtered.length === 0 ? (
          <div className="border border-gray-800 rounded-xl py-12 text-center">
            <p className="text-gray-400 text-sm">
              {activeTab === 'convergence'
                ? 'No convergence zones today — CE Wall, PE Wall and POC not clustered within 2%'
                : 'No signals match this filter'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map(s => <SignalCard key={s.symbol} s={s} />)}
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-gray-800 pt-4 text-center">
          <p className="text-[11px] text-gray-600">
            GreekNova · Wall Migration Scanner · Data as of {data?.trade_date} ·
            CE Wall = highest CE OI strike · PE Wall = highest PE OI strike · POC = highest combined OI strike ·
            For educational purposes only · Not SEBI registered · Not buy/sell advice
          </p>
        </div>

      </div>
    </div>
  )
}
