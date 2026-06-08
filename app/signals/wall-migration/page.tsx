'use client'
import Navbar from '@/components/Navbar'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { RefreshCw, Clock, TrendingUp, TrendingDown, Zap, Info } from 'lucide-react'

const API = 'https://greeknova-backend-production.up.railway.app'

const SEVERITY_CONFIG = {
  HIGH:   { bg: 'bg-red-950/40',    border: 'border-red-800/50',    badge: 'bg-red-900/60 text-red-300 border-red-700/50',    dot: 'bg-red-400' },
  MEDIUM: { bg: 'bg-amber-950/30',  border: 'border-amber-800/40',  badge: 'bg-amber-900/60 text-amber-300 border-amber-700/50',  dot: 'bg-amber-400' },
  LOW:    { bg: 'bg-gray-900/30',   border: 'border-gray-700/40',   badge: 'bg-gray-800/60 text-gray-300 border-gray-700/50',   dot: 'bg-gray-500' },
}

const COLOR_CONFIG: Record<string, string> = {
  red:     'text-red-400',
  emerald: 'text-emerald-400',
  orange:  'text-orange-400',
  amber:   'text-amber-400',
  blue:    'text-blue-400',
}

const TYPE_FILTER_OPTIONS = [
  { key: 'ALL',                label: '📊 All' },
  { key: 'PRICE_ABOVE_CE_WALL', label: '🔴 Above CE Wall' },
  { key: 'PRICE_BELOW_PE_WALL', label: '🟢 Below PE Wall' },
  { key: 'WALLS_CONVERGING',    label: '⚡ Converging' },
  { key: 'CE_WALL_SHIFT_UP',    label: '📈 CE Shifting Up' },
  { key: 'CE_WALL_SHIFT_DOWN',  label: '📉 CE Pressing Down' },
  { key: 'PE_WALL_SHIFT_UP',    label: '🛡️ PE Shifting Up' },
  { key: 'PE_WALL_SHIFT_DOWN',  label: '📉 PE Shifting Down' },
  { key: 'NARROW_RANGE_COILING',label: '🎯 Coiling' },
]

interface Alert {
  type: string
  label: string
  icon: string
  severity: 'HIGH' | 'MEDIUM' | 'LOW'
  detail: string
  color: string
}

interface Signal {
  symbol: string
  cmp: number
  ce_wall: number
  pe_wall: number
  ce_wall_prev: number
  pe_wall_prev: number
  range_pts: number
  range_pct: number
  alerts: Alert[]
  top_alert: Alert
  alert_count: number
}

function WallBar({ cmp, ce_wall, pe_wall, ce_wall_prev, pe_wall_prev }: {
  cmp: number; ce_wall: number; pe_wall: number; ce_wall_prev: number; pe_wall_prev: number
}) {
  const min = pe_wall * 0.998
  const max = ce_wall * 1.002
  const range = max - min
  if (range <= 0) return null
  const pct = (v: number) => Math.max(0, Math.min(100, ((v - min) / range) * 100))
  const cmpPct    = pct(cmp)
  const cePct     = pct(ce_wall)
  const pePct     = pct(pe_wall)
  const cePrevPct = pct(ce_wall_prev)
  const pePrevPct = pct(pe_wall_prev)
  const ceShifted = ce_wall !== ce_wall_prev
  const peShifted = pe_wall !== pe_wall_prev

  return (
    <div className="relative h-6 bg-gray-800/50 rounded-full overflow-visible my-2">
      {/* Zone between walls */}
      <div className="absolute top-0 bottom-0 bg-gray-700/30 rounded-full"
        style={{ left: `${pePct}%`, right: `${100 - cePct}%` }}/>
      {/* Previous wall markers (ghost) */}
      {peShifted && (
        <div className="absolute top-1 bottom-1 w-0.5 bg-emerald-700/40 rounded-full"
          style={{ left: `${pePrevPct}%` }}/>
      )}
      {ceShifted && (
        <div className="absolute top-1 bottom-1 w-0.5 bg-red-700/40 rounded-full"
          style={{ left: `${cePrevPct}%` }}/>
      )}
      {/* PE Wall */}
      <div className="absolute top-0 bottom-0 w-1 bg-emerald-500/80 rounded-full"
        style={{ left: `${pePct}%` }}/>
      {/* CE Wall */}
      <div className="absolute top-0 bottom-0 w-1 bg-red-500/80 rounded-full"
        style={{ left: `${cePct}%` }}/>
      {/* CMP dot */}
      <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-amber-400 border-2 border-gray-900 z-10"
        style={{ left: `calc(${cmpPct}% - 6px)` }}/>
    </div>
  )
}

export default function WallMigrationPage() {
  const [data, setData]         = useState<any>(null)
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState('ALL')
  const [lastUpdate, setLastUpdate] = useState('')

  async function fetchData() {
    setLoading(true)
    try {
      const res  = await fetch(`${API}/wall-migration`)
      const json = await res.json()
      setData(json)
      setLastUpdate(json.generated_at || '')
    } catch(e) { console.error(e) }
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const signals: Signal[] = data?.signals || []

  const filtered = filter === 'ALL'
    ? signals
    : signals.filter(s => s.alerts.some(a => a.type === filter))

  const highCount   = signals.filter(s => s.top_alert?.severity === 'HIGH').length
  const mediumCount = signals.filter(s => s.top_alert?.severity === 'MEDIUM').length
  const lowCount    = signals.filter(s => s.top_alert?.severity === 'LOW').length

  return (
    <div className="min-h-screen bg-[#07070e] text-white">
      <Navbar active="/signals/wall-migration"/>

      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-end justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-3xl font-black text-white tracking-tight">Wall Migration Scanner</h1>
              <span className="text-xs px-2 py-1 bg-purple-950/60 border border-purple-700/50 text-purple-300 rounded-full font-bold">
                🧪 Experimental
              </span>
            </div>
            <p className="text-gray-500 text-sm">Live OI wall shifts · Price breaches · Convergence detection</p>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdate && (
              <div className="flex items-center gap-1.5 text-xs text-gray-600 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2">
                <Clock size={11}/>{lastUpdate}
              </div>
            )}
            <button onClick={fetchData} disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-sm font-medium text-white rounded-lg border border-gray-700 transition-all">
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''}/>Refresh
            </button>
          </div>
        </div>

        {/* Info banner */}
        <div className="flex items-start gap-3 bg-purple-950/20 border border-purple-800/30 rounded-xl p-4 mb-6">
          <Info size={14} className="text-purple-400 mt-0.5 flex-shrink-0"/>
          <p className="text-xs text-purple-300/80 leading-relaxed">
            Wall Migration compares the current OI snapshot against the market open snapshot to detect wall shifts across the full session to detect shifts in CE/PE walls.
            During market hours this is highly actionable. On weekends it shows Friday's last session data.
            This is an experimental feature — use alongside CPR and OI signals for confluence.
          </p>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Total Signals', value: signals.length, color: 'text-white', bg: 'bg-gray-900/40', border: 'border-gray-700/50' },
            { label: '🔴 High Severity', value: highCount, color: 'text-red-400', bg: 'bg-red-950/20', border: 'border-red-800/30' },
            { label: '🟡 Medium', value: mediumCount, color: 'text-amber-400', bg: 'bg-amber-950/20', border: 'border-amber-800/30' },
            { label: '⚪ Low / Coiling', value: lowCount, color: 'text-gray-400', bg: 'bg-gray-900/20', border: 'border-gray-800/40' },
          ].map(s => (
            <div key={s.label} className={`rounded-xl border p-4 ${s.bg} ${s.border}`}>
              <p className="text-xs text-gray-500 mb-1">{s.label}</p>
              <p className={`text-3xl font-black ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="flex flex-wrap gap-2 mb-5">
          {TYPE_FILTER_OPTIONS.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-all font-medium ${
                filter === f.key
                  ? 'bg-white text-gray-900 border-white'
                  : 'bg-gray-900/40 text-gray-400 border-gray-800 hover:text-white'
              }`}>
              {f.label}
              {f.key !== 'ALL' && (
                <span className="ml-1 opacity-50">
                  ({signals.filter(s => s.alerts.some(a => a.type === f.key)).length})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Signals grid */}
        {loading && !data ? (
          <div className="grid grid-cols-2 gap-4">
            {[1,2,3,4].map(i => (
              <div key={i} className="bg-gray-900/30 border border-gray-800 rounded-2xl p-5 animate-pulse space-y-3">
                <div className="h-5 w-32 bg-gray-800 rounded"/>
                <div className="h-6 bg-gray-800 rounded-full"/>
                <div className="h-4 w-48 bg-gray-800 rounded"/>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-600">
            <p className="text-lg font-bold mb-2">No signals for this filter</p>
            <p className="text-sm">Try a different filter or refresh during market hours</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {filtered.map(s => {
              const sev = SEVERITY_CONFIG[s.top_alert?.severity || 'LOW']
              return (
                <div key={s.symbol} className={`rounded-2xl border p-5 ${sev.bg} ${sev.border}`}>
                  {/* Symbol row */}
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-black text-white">{s.symbol}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-bold ${sev.badge}`}>
                          {s.top_alert?.severity}
                        </span>
                        {s.alert_count > 1 && (
                          <span className="text-xs text-gray-500">+{s.alert_count - 1} more</span>
                        )}
                      </div>
                      <p className="text-amber-400 font-bold text-sm mt-0.5">₹{s.cmp.toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Range</p>
                      <p className="text-sm font-bold text-white">{s.range_pts} pts</p>
                      <p className="text-xs text-gray-600">{s.range_pct}%</p>
                    </div>
                  </div>

                  {/* Visual wall bar */}
                  <WallBar
                    cmp={s.cmp}
                    ce_wall={s.ce_wall}
                    pe_wall={s.pe_wall}
                    ce_wall_prev={s.ce_wall_prev}
                    pe_wall_prev={s.pe_wall_prev}
                  />

                  {/* Wall levels */}
                  <div className="flex justify-between text-xs mb-3">
                    <span className="text-emerald-400 font-bold">PE {s.pe_wall.toLocaleString()}
                      {s.pe_wall !== s.pe_wall_prev && (
                        <span className="text-gray-600 ml-1">← {s.pe_wall_prev.toLocaleString()}</span>
                      )}
                    </span>
                    <span className="text-red-400 font-bold">CE {s.ce_wall.toLocaleString()}
                      {s.ce_wall !== s.ce_wall_prev && (
                        <span className="text-gray-600 ml-1">← {s.ce_wall_prev.toLocaleString()}</span>
                      )}
                    </span>
                  </div>

                  {/* Alerts */}
                  <div className="space-y-1.5">
                    {s.alerts.map((a, i) => (
                      <div key={i} className="flex items-start gap-2 bg-gray-900/40 rounded-lg px-3 py-2">
                        <span className="text-sm">{a.icon}</span>
                        <div>
                          <p className={`text-xs font-bold ${COLOR_CONFIG[a.color] || 'text-gray-400'}`}>{a.label}</p>
                          <p className="text-[10px] text-gray-500 mt-0.5">{a.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Disclaimer */}
        <div className="mt-8 bg-gray-900/20 border border-gray-800/40 rounded-xl p-3">
          <p className="text-xs text-gray-600">
            <span className="text-gray-400 font-semibold">Disclaimer:</span> Wall Migration is experimental. OI wall detection is based on nearest significant strike with ≥10% of max OI. Not investment advice. Always use alongside other signals.
          </p>
        </div>
      </div>
    </div>
  )
}
