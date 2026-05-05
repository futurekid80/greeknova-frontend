'use client'
import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import Navbar from '@/components/Navbar'
import { useAutoRefresh } from '@/lib/useAutoRefresh'

const API = 'https://greeknova-backend-production.up.railway.app'

interface Item {
  symbol: string; is_index: boolean
  oi_now: number; oi_prev: number; oi_chg_abs: number; oi_chg_pct: number
  ltp: number | null; price_chg_pct: number
  signal: string; label: string; color: string; bg: string; border: string
}
interface Data { items: Item[]; as_of: string; count: number; message?: string }

function fmtOI(n: number) {
  const abs = Math.abs(n)
  if (abs >= 10000000) return `${(n/10000000).toFixed(2)}Cr`
  if (abs >= 100000)   return `${(n/100000).toFixed(1)}L`
  return n.toLocaleString()
}

const SIGNAL_ICONS: Record<string, string> = {
  LONG_BUILDUP:   '🐂',
  SHORT_BUILDUP:  '🐻',
  SHORT_COVERING: '🔄',
  LONG_UNWINDING: '⚠️',
  NEUTRAL:        '➖',
}

const SIGNAL_DESC: Record<string, string> = {
  LONG_BUILDUP:   'OI ↑ · Price ↑ — Fresh longs added',
  SHORT_BUILDUP:  'OI ↑ · Price ↓ — Fresh shorts added',
  SHORT_COVERING: 'OI ↓ · Price ↑ — Shorts exiting',
  LONG_UNWINDING: 'OI ↓ · Price ↓ — Longs exiting',
  NEUTRAL:        'No clear directional signal',
}

function OICard({ item }: { item: Item }) {
  return (
    <a href={`/stock/${item.symbol}`}
      className={`block rounded-xl p-4 border ${item.bg} ${item.border} hover:scale-[1.02] transition-all cursor-pointer`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-black text-white text-base">{item.symbol}</span>
            {item.is_index && <span className="text-[10px] px-1.5 py-0.5 bg-cyan-950 text-cyan-400 border border-cyan-800/50 rounded-md">IDX</span>}
          </div>
          <p className={`text-xs font-semibold mt-0.5 ${item.color}`}>
            {SIGNAL_ICONS[item.signal]} {item.label}
          </p>
        </div>
        <div className="text-right">
          {item.ltp && <p className="text-sm font-black text-white">₹{item.ltp.toLocaleString()}</p>}
          {item.ltp && (
            <p className={`text-xs font-bold flex items-center justify-end gap-0.5 ${item.price_chg_pct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {item.price_chg_pct >= 0 ? <ArrowUpRight size={11}/> : <ArrowDownRight size={11}/>}
              {item.price_chg_pct > 0 ? '+' : ''}{item.price_chg_pct}%
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500">OI Change</p>
          <p className={`text-lg font-black ${item.oi_chg_pct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {item.oi_chg_pct > 0 ? '+' : ''}{item.oi_chg_pct}%
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">Abs Change</p>
          <p className={`text-sm font-bold ${item.oi_chg_abs >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {item.oi_chg_abs > 0 ? '+' : ''}{fmtOI(item.oi_chg_abs)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">Total OI</p>
          <p className="text-sm font-bold text-gray-300">{fmtOI(item.oi_now)}</p>
        </div>
      </div>

      <p className="text-[10px] text-gray-600 mt-2">{SIGNAL_DESC[item.signal]}</p>
    </a>
  )
}

export default function OIPulse() {
  const [data, setData]       = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState<'all'|'index'|'stocks'>('all')
  const [sigFilter, setSigFilter] = useState<string>('all')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch(`${API}/oi-pulse?filter=${filter}`)
      const json = await res.json()
      setData(json)
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [filter])

  useEffect(() => { fetchData() }, [filter])
  const { enabled: autoOn, toggle: toggleAuto, countdownStr } = useAutoRefresh(fetchData, 5*60*1000, true)

  const filtered = sigFilter === 'all'
    ? items
    : items.filter(i => i.signal === sigFilter)

  const items = items
  const counts = {
    LONG_BUILDUP:   items.filter(i => i.signal === 'LONG_BUILDUP').length,
    SHORT_BUILDUP:  items.filter(i => i.signal === 'SHORT_BUILDUP').length,
    SHORT_COVERING: items.filter(i => i.signal === 'SHORT_COVERING').length,
    LONG_UNWINDING: items.filter(i => i.signal === 'LONG_UNWINDING').length,
  }

  return (
    <div className="min-h-screen bg-[#07070e] text-white">
      <Navbar active="/oipulse" />
      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="text-3xl font-black tracking-tight mb-1">OI Pulse</h1>
            <p className="text-gray-500 text-sm">Long/Short Buildup · Covering · Unwinding — across all F&O stocks</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={toggleAuto} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${autoOn ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60' : 'bg-gray-900/40 text-gray-500 border-gray-800'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${autoOn ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`}/>
              {autoOn ? countdownStr : 'Auto'}
            </button>
            <button onClick={fetchData} disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-sm font-medium text-white rounded-lg border border-gray-700 transition-all disabled:opacity-50">
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />Refresh
            </button>
          </div>
        </div>

        {/* Summary cards */}
        {data?.items.length ? (
          <div className="grid grid-cols-4 gap-3 mb-6">
            {[
              { sig: 'LONG_BUILDUP',   label: 'Long Buildup',   color: 'text-emerald-400', bg: 'bg-emerald-950/20', border: 'border-emerald-800/40', icon: '🐂' },
              { sig: 'SHORT_BUILDUP',  label: 'Short Buildup',  color: 'text-red-400',     bg: 'bg-red-950/20',     border: 'border-red-800/40',     icon: '🐻' },
              { sig: 'SHORT_COVERING', label: 'Short Covering', color: 'text-cyan-400',    bg: 'bg-cyan-950/20',    border: 'border-cyan-800/40',    icon: '🔄' },
              { sig: 'LONG_UNWINDING', label: 'Long Unwinding', color: 'text-orange-400',  bg: 'bg-orange-950/20',  border: 'border-orange-800/40',  icon: '⚠️' },
            ].map(s => (
              <button key={s.sig} onClick={() => setSigFilter(f => f===s.sig ? 'all' : s.sig)}
                className={`rounded-xl p-4 border text-left transition-all ${sigFilter===s.sig ? s.bg+' '+s.border : 'bg-gray-900/30 border-gray-800'} hover:${s.border}`}>
                <p className="text-2xl mb-1">{s.icon}</p>
                <p className={`text-2xl font-black ${s.color}`}>{counts[s.sig as keyof typeof counts]}</p>
                <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
              </button>
            ))}
          </div>
        ) : null}

        {/* Filters */}
        <div className="flex items-center gap-3 mb-6">
          {(['all','index','stocks'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-xs font-bold border transition-all capitalize ${filter===f ? 'bg-white text-gray-900 border-white' : 'bg-gray-900/40 text-gray-400 border-gray-800 hover:text-white'}`}>
              {f === 'all' ? 'All' : f === 'index' ? 'Indices' : 'Stocks'}
            </button>
          ))}
          {sigFilter !== 'all' && (
            <button onClick={() => setSigFilter('all')} className="ml-auto text-xs text-gray-500 hover:text-white transition-colors">
              Clear filter ✕
            </button>
          )}
          <span className="ml-auto text-xs text-gray-600">{filtered.length} symbols</span>
        </div>

        {/* Content */}
        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <RefreshCw size={24} className="text-gray-600 animate-spin"/>
          </div>
        ) : !filtered.length ? (
          <div className="h-64 flex items-center justify-center flex-col gap-3">
            <div className="text-4xl">📡</div>
            <p className="text-gray-500 text-sm">
              {data?.message || 'Need 2+ snapshots to classify OI activity'}
            </p>
            <p className="text-gray-600 text-xs">Data builds up during market hours · Check back tomorrow morning</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {filtered.map(item => <OICard key={item.symbol} item={item}/>)}
          </div>
        )}

        {/* Legend */}
        <div className="mt-8 bg-gray-900/30 border border-gray-800 rounded-xl p-4">
          <p className="text-xs font-bold text-gray-400 mb-3">How to read OI Pulse</p>
          <div className="grid grid-cols-2 gap-3 text-xs text-gray-500">
            <div className="flex items-start gap-2"><span>🐂</span><span><span className="text-emerald-400 font-semibold">Long Buildup</span> — OI rising + Price rising. Fresh long positions being added. Bullish signal.</span></div>
            <div className="flex items-start gap-2"><span>🐻</span><span><span className="text-red-400 font-semibold">Short Buildup</span> — OI rising + Price falling. Fresh short positions being added. Bearish signal.</span></div>
            <div className="flex items-start gap-2"><span>🔄</span><span><span className="text-cyan-400 font-semibold">Short Covering</span> — OI falling + Price rising. Shorts exiting, buying pressure. Bullish reversal.</span></div>
            <div className="flex items-start gap-2"><span>⚠️</span><span><span className="text-orange-400 font-semibold">Long Unwinding</span> — OI falling + Price falling. Longs exiting, selling pressure. Bearish reversal.</span></div>
          </div>
        </div>
      </div>
    </div>
  )
}
