'use client'
import Navbar from '@/components/Navbar'
import { useEffect, useState, useCallback, useRef } from 'react'
import { RefreshCw, Clock } from 'lucide-react'

const API = 'https://greeknova-backend-production.up.railway.app'

interface Signal {
  symbol: string
  tradingsymbol: string
  strike: number
  option_type: string
  signal_type: string
  bias: string
  score: number
  cmp: number
  is_index: boolean
  first_seen: string
  last_seen: string
  appearances: number
  persistence_pct: number
  is_active: boolean
  ltp_at_first: number
  ltp_latest: number
  ltp_move: number
  ltp_chg: number
  oi_chg: number
  vol_oi_ratio: number
}

interface LogData {
  date: string
  signals: Signal[]
  total: number
  snapshots: number
  open_time: string
  latest_time: string
}

const SIGNAL_META: Record<string, { color: string; bg: string; border: string; icon: string; label: string }> = {
  LONG_BUILDUP:     { color: 'text-emerald-400', bg: 'bg-emerald-950/40', border: 'border-emerald-800/50', icon: '🐂', label: 'Long Buildup' },
  SHORT_BUILDUP:    { color: 'text-red-400',     bg: 'bg-red-950/40',     border: 'border-red-800/50',     icon: '🐻', label: 'Short Buildup' },
  CALL_WRITING:     { color: 'text-red-400',     bg: 'bg-red-950/40',     border: 'border-red-800/50',     icon: '✍️', label: 'Call Writing' },
  PUT_WRITING:      { color: 'text-emerald-400', bg: 'bg-emerald-950/40', border: 'border-emerald-800/50', icon: '✍️', label: 'Put Writing' },
  SHORT_COVERING:   { color: 'text-cyan-400',    bg: 'bg-cyan-950/40',    border: 'border-cyan-800/50',    icon: '🔄', label: 'Short Covering' },
  LONG_UNWINDING:   { color: 'text-orange-400',  bg: 'bg-orange-950/40',  border: 'border-orange-800/50',  icon: '⚠️', label: 'Long Unwinding' },
  VOLUME_SURGE:     { color: 'text-amber-400',   bg: 'bg-amber-950/40',   border: 'border-amber-800/50',   icon: '⚡', label: 'Volume Surge' },
}

function ScoreDots({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(i => (
        <div key={i} className={`h-1.5 w-3 rounded-sm ${i <= score ? score >= 4 ? 'bg-orange-400' : 'bg-amber-400' : 'bg-gray-800'}`}/>
      ))}
    </div>
  )
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

export default function IntradaySignalLog() {
  const [data, setData]         = useState<LogData | null>(null)
  const [loading, setLoading]   = useState(true)
  const [biasFilter, setBiasFilter] = useState<'all'|'BULLISH'|'BEARISH'>('all')
  const [typeFilter, setTypeFilter] = useState<'all'|'index'|'stocks'>('all')
  const [activeFilter, setActiveFilter] = useState<'all'|'active'|'gone'>('all')
  const [minScore, setMinScore] = useState(3)
  const [countdown, setCountdown] = useState(300)
  const intervalRef  = useRef<NodeJS.Timeout|null>(null)
  const countdownRef = useRef<NodeJS.Timeout|null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch(`${API}/signal-log`)
      const json = await res.json()
      setData(json)
    } catch(e) { console.error(e) }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchData()
    // Auto refresh every 5 mins
    intervalRef.current  = setInterval(() => { fetchData(); setCountdown(300) }, 5*60*1000)
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
    .filter(s => typeFilter === 'all' || (typeFilter === 'index' ? s.is_index : !s.is_index))
    .filter(s => activeFilter === 'all' || (activeFilter === 'active' ? s.is_active : !s.is_active))
    .filter(s => s.score >= minScore)

  const activeCount  = signals.filter(s => s.is_active).length
  const bullishCount = signals.filter(s => s.bias === 'BULLISH').length
  const bearishCount = signals.filter(s => s.bias === 'BEARISH').length
  const highConvCount = signals.filter(s => s.score >= 4).length

  return (
    <div className="min-h-screen bg-[#07070e] text-white">
      <Navbar active="/signals/intraday" />

      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="text-3xl font-black tracking-tight mb-1">📋 Intraday Signal Log</h1>
            <p className="text-gray-500 text-sm">
              All UOA signals that appeared today · When they fired · How long they persisted · Still active or gone
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
              {mins}:{secs.toString().padStart(2,'0')}
            </div>
            <button onClick={fetchData} disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-sm font-medium text-white rounded-lg border border-gray-700 disabled:opacity-50 transition-all">
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''}/>Refresh
            </button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Total Signals Today</p>
            <p className="text-2xl font-black text-white">{data?.total || 0}</p>
            <p className="text-xs text-gray-600">unique signal appearances</p>
          </div>
          <div className="bg-emerald-950/20 border border-emerald-800/40 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">🟢 Still Active</p>
            <p className="text-2xl font-black text-emerald-400">{activeCount}</p>
            <p className="text-xs text-gray-600">in latest snapshot</p>
          </div>
          <div className="bg-orange-950/20 border border-orange-800/40 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">🎯 High Conviction</p>
            <p className="text-2xl font-black text-orange-400">{highConvCount}</p>
            <p className="text-xs text-gray-600">score 4-5 signals</p>
          </div>
          <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">↑↓ Bias Split</p>
            <p className="text-sm font-black">
              <span className="text-emerald-400">{bullishCount} Bull</span>
              <span className="text-gray-600"> · </span>
              <span className="text-red-400">{bearishCount} Bear</span>
            </p>
            <p className="text-xs text-gray-600 mt-1">
              {bullishCount > bearishCount ? '🐂 Bullish day' : bearishCount > bullishCount ? '🐻 Bearish day' : '⚖️ Balanced'}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {(['all','active','gone'] as const).map(f => (
            <button key={f} onClick={() => setActiveFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all capitalize ${activeFilter===f
                ? f==='active' ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                : f==='gone' ? 'bg-gray-800 text-gray-400 border-gray-700'
                : 'bg-white text-gray-900 border-white'
                : 'bg-gray-900/40 text-gray-400 border-gray-800 hover:text-white'}`}>
              {f === 'active' ? '🟢 Active' : f === 'gone' ? '⚫ Gone' : 'All'}
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
          {(['all','index','stocks'] as const).map(f => (
            <button key={f} onClick={() => setTypeFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all capitalize ${typeFilter===f ? 'bg-white text-gray-900 border-white' : 'bg-gray-900/40 text-gray-400 border-gray-800 hover:text-white'}`}>
              {f}
            </button>
          ))}
          <div className="w-px h-5 bg-gray-800 mx-1"/>
          <div className="flex items-center gap-2 bg-gray-900/30 border border-gray-800 rounded-lg px-3 py-1.5">
            <span className="text-xs text-gray-500">Min score:</span>
            <input type="range" min="1" max="5" value={minScore} onChange={e => setMinScore(Number(e.target.value))} className="w-16 accent-amber-400"/>
            <span className="text-xs font-black text-amber-400">{minScore}+</span>
          </div>
        </div>

        <p className="text-xs text-gray-600 mb-4">{filtered.length} signals · Informational only</p>

        {/* Signal table */}
        {loading ? (
          <div className="space-y-2">{[1,2,3,4,5].map(i=>(
            <div key={i} className="h-14 bg-gray-900/30 border border-gray-800 rounded-xl animate-pulse"/>
          ))}</div>
        ) : filtered.length > 0 ? (
          <div className="rounded-2xl border border-gray-800 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-900/60 border-b border-gray-800">
                  {['Symbol','Strike','Signal','Bias','First Seen','Last Seen','Persistence','LTP Move','Score','Status'].map((h,i) => (
                    <th key={h} className={`text-xs font-semibold text-gray-500 px-4 py-3 ${i <= 3 ? 'text-left' : 'text-center'} ${i===0?'pl-5':''} ${i===9?'pr-5':''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((sig, i) => {
                  const m = SIGNAL_META[sig.signal_type] || SIGNAL_META.VOLUME_SURGE
                  return (
                    <tr key={`${sig.tradingsymbol}-${i}`}
                      className={`border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors ${sig.is_active ? '' : 'opacity-60'} ${i%2===0?'':'bg-gray-900/10'}`}>

                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-white">{sig.symbol}</span>
                          {sig.is_index && <span className="text-[10px] px-1 py-0.5 bg-cyan-950 text-cyan-400 border border-cyan-800/50 rounded">IDX</span>}
                        </div>
                        <p className="text-xs text-gray-600">CMP ₹{sig.cmp.toLocaleString()}</p>
                      </td>

                      <td className="px-4 py-3">
                        <p className="text-sm font-bold text-gray-300">{sig.strike.toLocaleString()}</p>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${sig.option_type === 'CE' ? 'bg-red-950/50 text-red-400' : 'bg-emerald-950/50 text-emerald-400'}`}>
                          {sig.option_type}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <div className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg border ${m.color} ${m.bg} ${m.border}`}>
                          {m.icon} {m.label}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <span className={`text-xs font-bold ${sig.bias === 'BULLISH' ? 'text-emerald-400' : sig.bias === 'BEARISH' ? 'text-red-400' : 'text-gray-400'}`}>
                          {sig.bias === 'BULLISH' ? '↑ Bullish' : sig.bias === 'BEARISH' ? '↓ Bearish' : '⟷ Mixed'}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-center">
                        <p className="text-xs font-bold text-amber-400">{sig.first_seen}</p>
                        <p className="text-[10px] text-gray-600">₹{sig.ltp_at_first.toFixed(1)}</p>
                      </td>

                      <td className="px-4 py-3 text-center">
                        <p className={`text-xs font-bold ${sig.is_active ? 'text-emerald-400' : 'text-gray-500'}`}>{sig.last_seen}</p>
                        <p className="text-[10px] text-gray-600">₹{sig.ltp_latest.toFixed(1)}</p>
                      </td>

                      <td className="px-4 py-3 text-center">
                        <PersistenceBar pct={sig.persistence_pct} isActive={sig.is_active}/>
                        <p className="text-[10px] text-gray-600 mt-0.5">{sig.appearances} snapshots</p>
                      </td>

                      <td className="px-4 py-3 text-center">
                        <p className={`text-xs font-bold ${sig.ltp_move > 0 ? 'text-emerald-400' : sig.ltp_move < 0 ? 'text-red-400' : 'text-gray-500'}`}>
                          {sig.ltp_move > 0 ? '+' : ''}{sig.ltp_move.toFixed(1)}
                        </p>
                        <p className={`text-[10px] ${sig.ltp_chg > 0 ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
                          {sig.ltp_chg > 0 ? '+' : ''}{sig.ltp_chg.toFixed(1)}%
                        </p>
                      </td>

                      <td className="px-4 py-3 text-center">
                        <ScoreDots score={sig.score}/>
                      </td>

                      <td className="px-5 py-3 text-center">
                        {sig.is_active ? (
                          <span className="text-xs font-bold px-2 py-1 bg-emerald-950/60 text-emerald-400 border border-emerald-800/50 rounded-lg">
                            🟢 ACTIVE
                          </span>
                        ) : (
                          <span className="text-xs font-bold px-2 py-1 bg-gray-900/60 text-gray-500 border border-gray-800 rounded-lg">
                            ⚫ GONE
                          </span>
                        )}
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
            <p className="text-gray-500">No signals yet — data builds up during market hours</p>
          </div>
        )}

        <div className="mt-6 bg-gray-900/20 border border-gray-800/40 rounded-xl p-4">
          <p className="text-xs text-gray-600 leading-relaxed">
            <span className="text-gray-400 font-semibold">How to read: </span>
            <span className="text-emerald-400">ACTIVE</span> = signal still present in latest snapshot ·
            <span className="text-gray-500"> GONE</span> = appeared earlier but not in latest snapshot ·
            <span className="text-amber-400"> Persistence</span> = % of today's snapshots where signal was present ·
            High persistence + ACTIVE = strong institutional conviction ·
            Observational only · Not investment advice
          </p>
        </div>
      </div>
    </div>
  )
}
