'use client'
import Navbar from '@/components/Navbar'
import { useEffect, useState, useCallback, useRef } from 'react'
import { RefreshCw, Clock } from 'lucide-react'
import { useRouter } from 'next/navigation'

const API = 'https://greeknova-backend-production.up.railway.app'

interface OptionsSignal {
  signal_type: string
  label: string
  strike: number
  option_type: string
  score: number
  bias: string
}

interface Signal {
  symbol: string
  cmp: number
  fut_oi_now: number
  fut_oi_open: number
  oi_chg_pct: number
  price_chg_pct: number
  vol_now: number
  vol_open: number
  vol_chg_pct: number
  vol_surge: boolean
  signal_type: string
  label: string
  bias: string
  persistence: number
  persistence_pct: number
  first_seen: string
  first_seen_ts: string
  is_active: boolean
  cpr_position: string | null
  cpr_width_emoji: string | null
  cpr_is_virgin: boolean | null
  // Options confirmation
  options_confirmation: boolean
  options_confirms: boolean | null
  options_alignment: string | null
  options_alignment_color: string | null
options_signal: OptionsSignal | null
  // OI Walls
  ce_wall: number | null
  pe_wall: number | null
  ce_wall_oi_L: number | null
  pe_wall_oi_L: number | null
  trade_range: number | null
  trade_range_pct: number | null
  range_label: string | null
}

interface LogData {
  date: string
  signals: Signal[]
  total: number
  snapshots: number
  open_time: string
  latest_time: string
  long_buildup: number
  short_buildup: number
  short_covering: number
  long_unwinding: number
  message?: string
}

const SIGNAL_META: Record<string, { color: string; bg: string; border: string; icon: string }> = {
  LONG_BUILDUP:   { color: 'text-emerald-400', bg: 'bg-emerald-950/40', border: 'border-emerald-800/50', icon: '🐂' },
  SHORT_BUILDUP:  { color: 'text-red-400',     bg: 'bg-red-950/40',     border: 'border-red-800/50',     icon: '🐻' },
  SHORT_COVERING: { color: 'text-cyan-400',    bg: 'bg-cyan-950/40',    border: 'border-cyan-800/50',    icon: '🔄' },
  LONG_UNWINDING: { color: 'text-orange-400',  bg: 'bg-orange-950/40',  border: 'border-orange-800/50',  icon: '⚠️' },
}

const OPTIONS_SIGNAL_ICONS: Record<string, string> = {
  PUT_WRITING:      '✍️',
  CALL_WRITING:     '✍️',
  LONG_BUILDUP:     '🐂',
  SHORT_BUILDUP:    '🐻',
  SHORT_COVERING:   '🔄',
  LONG_UNWINDING:   '⚠️',
  BUYER_DOMINATED:  '🐋',
  SELLER_DOMINATED: '🔻',
  FAR_OTM_ACTIVITY: '🚀',
  VOLUME_SURGE:     '⚡',
}

const CPR_COLOR: Record<string, string> = {
  'Above CPR':  'text-emerald-400',
  'Below CPR':  'text-red-400',
  'Inside CPR': 'text-amber-400',
}

function PersistenceBar({ pct, isActive }: { pct: number; isActive: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${isActive ? 'bg-emerald-400' : 'bg-gray-600'}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span className="text-[10px] text-gray-500">{pct}%</span>
    </div>
  )
}

function OptionsConfirmation({ sig }: { sig: Signal }) {
  if (!sig.options_confirmation || !sig.options_signal) {
    return <span className="text-[10px] text-gray-600">—</span>
  }

  const opt = sig.options_signal
  const isConfirms = sig.options_confirms === true
  const icon = OPTIONS_SIGNAL_ICONS[opt.signal_type] || '👁️'

  return (
    <div className="flex flex-col gap-1">
      <div className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${
        isConfirms
          ? 'text-emerald-400 bg-emerald-950/40 border-emerald-800/50'
          : 'text-amber-400 bg-amber-950/40 border-amber-800/50'
      }`}>
        {isConfirms ? '✅' : '⚠️'} {sig.options_alignment}
      </div>
      <p className="text-[10px] text-gray-400">
        {icon} {opt.label}
      </p>
      <p className="text-[10px] text-gray-600">
        {opt.strike.toLocaleString()} {opt.option_type} · Score {opt.score}/5
      </p>
    </div>
  )
}

function fmt(n: number) {
  if (n >= 10000000) return `${(n/10000000).toFixed(1)}Cr`
  if (n >= 100000)   return `${(n/100000).toFixed(1)}L`
  if (n >= 1000)     return `${(n/1000).toFixed(1)}K`
  return String(n)
}

export default function IntradaySignalLog() {
  const [data, setData]       = useState<LogData | null>(null)
  const [loading, setLoading] = useState(true)
  const [biasFilter, setBiasFilter] = useState<'all'|'BULLISH'|'BEARISH'>('all')
  const [sigFilter, setSigFilter]   = useState<'all'|'LONG_BUILDUP'|'SHORT_BUILDUP'|'SHORT_COVERING'|'LONG_UNWINDING'>('all')
  const [minPersist, setMinPersist] = useState(1)
  const [confirmedOnly, setConfirmedOnly] = useState(false)
  const [countdown, setCountdown]   = useState(300)
  const router = useRouter()
  const intervalRef  = useRef<NodeJS.Timeout|null>(null)
  const countdownRef = useRef<NodeJS.Timeout|null>(null)

  const fetchData = useCallback(async (isAutoRefresh = false) => {
    // Auto-refresh: don't show loading spinner or blank screen — keep existing data visible
    if (!isAutoRefresh) setLoading(true)
    try {
      const res  = await fetch(`${API}/signal-log`)
      const json = await res.json()
      // Only update data if new response has signals OR we have no data yet
      if (json.total > 0 || !data) {
        setData(json)
      }
    } catch(e) { console.error(e) }
    if (!isAutoRefresh) setLoading(false)
  }, [data])

  useEffect(() => {
    fetchData()
    intervalRef.current  = setInterval(() => { fetchData(true); setCountdown(300) }, 5*60*1000)
    countdownRef.current = setInterval(() => setCountdown(p => Math.max(0, p-1)), 1000)
    return () => {
      if (intervalRef.current)  clearInterval(intervalRef.current)
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [fetchData])

  const mins = Math.floor(countdown/60)
  const secs = countdown % 60
  const signals = data?.signals || []

  const filtered = signals
    .filter(s => biasFilter === 'all' || s.bias === biasFilter)
    .filter(s => sigFilter  === 'all' || s.signal_type === sigFilter)
    .filter(s => s.persistence >= minPersist)
    .filter(s => !confirmedOnly || (s.options_confirmation && s.options_confirms === true))

  const surgeCount     = signals.filter(s => s.vol_surge).length
  const confirmedCount = signals.filter(s => s.options_confirmation && s.options_confirms === true).length

  return (
    <div className="min-h-screen bg-[#07070e] text-white">
      <Navbar active="/signals/intraday" />

      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="text-3xl font-black tracking-tight mb-1">📋 Intraday Futures Scanner</h1>
            <p className="text-gray-500 text-sm">
              FUT OI + Options Confirmation · Higher conviction when both align · Updates every 5 mins
            </p>
          </div>
          <div className="flex items-center gap-3">
            {data && (
              <div className="flex items-center gap-1.5 text-xs bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-gray-400">
                <Clock size={11}/>{data.open_time} → {data.latest_time} · {data.snapshots} snapshots
              </div>
            )}
            <div className="flex items-center gap-1.5 text-xs bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-gray-400">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/>
              Next refresh in {mins}:{secs.toString().padStart(2,'0')}
            </div>
            <button onClick={() => fetchData(false)} disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-sm font-medium text-white rounded-lg border border-gray-700 disabled:opacity-50 transition-all">
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''}/>Refresh
            </button>
          </div>
            
        </div>
        {/* HIGH CONV Alert Banner */}
        {confirmedCount > 0 && (
          <div className="mb-4 flex items-center gap-3 bg-emerald-950/30 border border-emerald-700/50 rounded-xl px-4 py-3">
            <span className="text-lg">🎯</span>
            <div className="flex-1">
              <p className="text-sm font-bold text-emerald-400">
                {confirmedCount} HIGH CONV signal{confirmedCount > 1 ? 's' : ''} active
              </p>
              <p className="text-xs text-gray-400">
                {signals
                  .filter(s => s.options_confirmation && s.options_confirms === true)
                  .map(s => s.symbol)
                  .join(' · ')}
              </p>
            </div>
            <span className="text-[10px] text-gray-600">Updates every 5 mins</span>
          </div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-5 gap-3 mb-6">
          <div className="bg-emerald-950/20 border border-emerald-800/40 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">🐂 Long Buildup</p>
            <p className="text-2xl font-black text-emerald-400">{data?.long_buildup || 0}</p>
            <p className="text-xs text-gray-600">FUT OI ↑ + Price ↑</p>
          </div>
          <div className="bg-red-950/20 border border-red-800/40 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">🐻 Short Buildup</p>
            <p className="text-2xl font-black text-red-400">{data?.short_buildup || 0}</p>
            <p className="text-xs text-gray-600">FUT OI ↑ + Price ↓</p>
          </div>
          <div className="bg-cyan-950/20 border border-cyan-800/40 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">🔄 Unwinding</p>
            <p className="text-2xl font-black text-cyan-400">{(data?.short_covering || 0) + (data?.long_unwinding || 0)}</p>
            <p className="text-xs text-gray-600">FUT OI ↓ — positions closing</p>
          </div>
          <div className="bg-amber-950/20 border border-amber-800/40 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">⚡ Volume Surge</p>
            <p className="text-2xl font-black text-amber-400">{surgeCount}</p>
            <p className="text-xs text-gray-600">Vol {'>'} 50% above open</p>
          </div>
          <div className="bg-emerald-950/30 border border-emerald-700/60 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">✅ Confirmed</p>
            <p className="text-2xl font-black text-emerald-300">{confirmedCount}</p>
            <p className="text-xs text-gray-600">FUT + Options aligned</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {(['all','LONG_BUILDUP','SHORT_BUILDUP','SHORT_COVERING','LONG_UNWINDING'] as const).map(f => (
            <button key={f} onClick={() => setSigFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${sigFilter===f
                ? f==='LONG_BUILDUP'   ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                : f==='SHORT_BUILDUP'  ? 'bg-red-950 text-red-400 border-red-800'
                : f==='SHORT_COVERING' ? 'bg-cyan-950 text-cyan-400 border-cyan-800'
                : f==='LONG_UNWINDING' ? 'bg-orange-950 text-orange-400 border-orange-800'
                : 'bg-white text-gray-900 border-white'
                : 'bg-gray-900/40 text-gray-400 border-gray-800 hover:text-white'}`}>
              {f==='all' ? 'All' : f==='LONG_BUILDUP' ? '🐂 Long Buildup' : f==='SHORT_BUILDUP' ? '🐻 Short Buildup' : f==='SHORT_COVERING' ? '🔄 Short Covering' : '⚠️ Long Unwinding'}
            </button>
          ))}
          <div className="w-px h-5 bg-gray-800 mx-1"/>
          {(['all','BULLISH','BEARISH'] as const).map(b => (
            <button key={b} onClick={() => setBiasFilter(b)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${biasFilter===b
                ? b==='BULLISH' ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                : b==='BEARISH' ? 'bg-red-950 text-red-400 border-red-800'
                : 'bg-white text-gray-900 border-white'
                : 'bg-gray-900/40 text-gray-400 border-gray-800 hover:text-white'}`}>
              {b==='all' ? 'All Bias' : b==='BULLISH' ? '↑ Bullish' : '↓ Bearish'}
            </button>
          ))}
          <div className="w-px h-5 bg-gray-800 mx-1"/>
          {/* Confirmed only toggle */}
          <button onClick={() => setConfirmedOnly(!confirmedOnly)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${confirmedOnly
              ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
              : 'bg-gray-900/40 text-gray-400 border-gray-800 hover:text-white'}`}>
            ✅ Confirmed Only
          </button>
          <div className="w-px h-5 bg-gray-800 mx-1"/>
          <div className="flex items-center gap-2 bg-gray-900/30 border border-gray-800 rounded-lg px-3 py-1.5">
            <span className="text-xs text-gray-500">Min snapshots:</span>
            <input type="range" min="1" max="10" value={minPersist} onChange={e => setMinPersist(Number(e.target.value))} className="w-16 accent-amber-400"/>
            <span className="text-xs font-black text-amber-400">{minPersist}+</span>
          </div>
        </div>

        <p className="text-xs text-gray-600 mb-4">{filtered.length} stocks · Futures OI only · Informational</p>

        {/* Table */}
        {loading ? (
          <div className="space-y-2">{[1,2,3,4,5].map(i=>(
            <div key={i} className="h-14 bg-gray-900/30 border border-gray-800 rounded-xl animate-pulse"/>
          ))}</div>
        ) : data?.message && signals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 border border-gray-800/50 rounded-2xl">
            <div className="text-4xl mb-4">📋</div>
            <p className="text-gray-500">{data.message}</p>
          </div>
        ) : filtered.length > 0 ? (
          <div className="rounded-2xl border border-gray-800 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-900/60 border-b border-gray-800">
                  {['Symbol','FUT OI Chg','Price Chg','Volume','Signal','CPR','Options Confirmation','Persistence','Since'].map((h,i) => (
                    <th key={h} className={`text-xs font-semibold text-gray-500 px-4 py-3 ${i===0?'text-left pl-5':'text-center'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((sig, i) => {
                  const m = SIGNAL_META[sig.signal_type] || SIGNAL_META.LONG_BUILDUP
                  const isHighConviction = sig.options_confirmation && sig.options_confirms === true
                  return (
                    <tr key={`${sig.symbol}-${i}`}
                      className={`border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors ${
                        isHighConviction ? 'bg-emerald-950/10 border-l-2 border-l-emerald-700'
                        : i%2===0 ? '' : 'bg-gray-900/10'
                      }`}>

                      {/* Symbol */}
                      <td className="px-5 py-3">
                        <div 
                          className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => router.push(`/uoa?symbol=${sig.symbol}`)}
                        >
                          <p className="text-sm font-black text-white underline-offset-2 hover:underline">{sig.symbol}</p>
                          {isHighConviction && (
                            <span className="text-[9px] px-1 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-800/50 rounded font-bold">
                              HIGH CONV
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">₹{sig.cmp.toLocaleString()}</p>
                      </td>

                      {/* FUT OI Chg */}
                      <td className="px-4 py-3 text-center">
                        <p className={`text-sm font-bold ${sig.oi_chg_pct > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {sig.oi_chg_pct > 0 ? '+' : ''}{sig.oi_chg_pct}%
                        </p>
                        <p className="text-[10px] text-gray-600">{fmt(sig.fut_oi_open)} → {fmt(sig.fut_oi_now)}</p>
                      </td>

                      {/* Price Chg */}
                      <td className="px-4 py-3 text-center">
                        <p className={`text-sm font-bold ${sig.price_chg_pct > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {sig.price_chg_pct > 0 ? '+' : ''}{sig.price_chg_pct}%
                        </p>
                      </td>

                      {/* Volume */}
                      <td className="px-4 py-3 text-center">
                        <p className={`text-sm font-bold ${sig.vol_surge ? 'text-amber-400' : 'text-gray-300'}`}>
                          {sig.vol_chg_pct > 0 ? '+' : ''}{sig.vol_chg_pct}%
                          {sig.vol_surge && <span className="ml-1 text-[10px]">⚡</span>}
                        </p>
                        <p className="text-[10px] text-gray-600">{fmt(sig.vol_now)} vs open {fmt(sig.vol_open)}</p>
                      </td>

                      {/* Signal */}
                      <td className="px-4 py-3 text-center">
                        <div className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg border ${m.color} ${m.bg} ${m.border}`}>
                          {m.icon} {sig.label}
                        </div>
                        {sig.ce_wall && sig.pe_wall && (
                          <div className="flex items-center justify-center gap-1.5 mt-1.5 flex-wrap">
                            <span className="text-[10px] font-bold text-red-400 bg-red-950/30 border border-red-800/30 px-1.5 py-0.5 rounded">
                              📈 CE ₹{sig.ce_wall.toLocaleString()}
                            </span>
                            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/30 border border-emerald-800/30 px-1.5 py-0.5 rounded">
                              📉 PE ₹{sig.pe_wall.toLocaleString()}
                            </span>
                            {sig.range_label && (
                              <span className="text-[10px] text-gray-600">
                                {sig.trade_range_pct}% {sig.range_label}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* CPR */}
                      <td className="px-4 py-3 text-center">
                        {sig.cpr_position ? (
                          <>
                            <p className={`text-xs font-bold ${CPR_COLOR[sig.cpr_position] || 'text-gray-400'}`}>
                              {sig.cpr_position}
                            </p>
                            <p className="text-[10px] text-gray-600">
                              {sig.cpr_is_virgin ? '🔵 Virgin' : ''} {sig.cpr_width_emoji || ''}
                            </p>
                          </>
                        ) : <span className="text-[10px] text-gray-600">—</span>}
                      </td>

                      {/* Options Confirmation */}
                      <td className="px-4 py-3 text-center">
                        <OptionsConfirmation sig={sig} />
                      </td>

                      {/* Persistence */}
                      <td className="px-4 py-3 text-center">
                        <PersistenceBar pct={sig.persistence_pct} isActive={sig.is_active}/>
                        <p className="text-[10px] text-gray-600 mt-0.5">{sig.persistence} snaps</p>
                      </td>

                      {/* Since */}
                      <td className="px-4 py-3 text-center">
                        <p className="text-xs font-bold text-amber-400">{sig.first_seen}</p>
                        <p className="text-[10px] text-gray-600">
                          {sig.is_active
                            ? <span className="text-emerald-400">● Active</span>
                            : <span className="text-gray-600">● Gone</span>}
                        </p>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 border border-gray-800/50 rounded-2xl">
            <div className="text-4xl mb-4">📋</div>
            <p className="text-gray-500">No signals matching filters — try reducing min snapshots</p>
          </div>
        )}

        <div className="mt-6 bg-gray-900/20 border border-gray-800/40 rounded-xl p-4">
          <p className="text-xs text-gray-600 leading-relaxed">
            <span className="text-gray-400 font-semibold">How to read: </span>
            FUT OI Chg = futures open interest change from day open · Price Chg = change from today's 9:15 AM open (not yesterday's close) · A positive Price Chg after a gap-down open = institutional buying the dip · Volume = today's volume vs opening volume ·
            <span className="text-amber-400"> ⚡ Surge</span> = volume {'>'} 50% above open ·
            <span className="text-emerald-400"> ✅ Confirms</span> = options market activity aligns with FUT signal (e.g. Put Writing + Long Buildup) ·
            <span className="text-amber-400"> ⚠️ Contradicts</span> = options signal opposes FUT direction — treat with caution ·
            <span className="text-gray-300"> HIGH CONV</span> = FUT + Options both confirm — higher conviction setup ·
            Observational only · Not investment advice
          </p>
        </div>
      </div>
    </div>
  )
}
