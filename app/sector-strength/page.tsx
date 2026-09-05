'use client'
import { useEffect, useState, useCallback } from 'react'
import { RefreshCw } from 'lucide-react'
import Navbar from '@/components/Navbar'
import { supabase } from '@/lib/supabase'
import { useAutoRefresh } from '@/lib/useAutoRefresh'

type Timeframe = 'daily' | 'weekly'

interface Row {
  index_symbol: string
  trade_date: string
  close: number
  day_chg_pct?: number
  week_chg_pct?: number
  strength_rank: number
}

// Friendlier display names for the tiles
const LABELS: Record<string, string> = {
  'NIFTY BANK': 'Bank',
  'NIFTY IT': 'IT',
  'NIFTY AUTO': 'Auto',
  'NIFTY METAL': 'Metal',
  'NIFTY FMCG': 'FMCG',
  'NIFTY PHARMA': 'Pharma',
  'NIFTY REALTY': 'Realty',
  'NIFTY ENERGY': 'Energy',
  'NIFTY MEDIA': 'Media',
  'NIFTY PSU BANK': 'PSU Bank',
  'NIFTY PVT BANK': 'Pvt Bank',
  'NIFTY FIN SERVICE': 'Fin Service',
  'NIFTY INFRA': 'Infra',
  'NIFTY CONSR DURBL': 'Consumer Durbl',
  'NIFTY HEALTHCARE': 'Healthcare',
  'NIFTY OIL AND GAS': 'Oil & Gas',
  'NIFTY CHEMICALS': 'Chemicals',
}

function tileColor(pct: number): string {
  const a = Math.min(Math.abs(pct) / 3, 1) // scale: 3%+ move = full intensity
  if (pct > 0) {
    if (a < 0.15) return 'bg-emerald-950/40 border-emerald-900/50'
    if (a < 0.35) return 'bg-emerald-900/50 border-emerald-800/60'
    if (a < 0.6)  return 'bg-emerald-800/70 border-emerald-700/70'
    if (a < 0.85) return 'bg-emerald-700/85 border-emerald-600'
    return 'bg-emerald-500 border-emerald-400'
  }
  if (pct < 0) {
    if (a < 0.15) return 'bg-red-950/40 border-red-900/50'
    if (a < 0.35) return 'bg-red-900/50 border-red-800/60'
    if (a < 0.6)  return 'bg-red-800/70 border-red-700/70'
    if (a < 0.85) return 'bg-red-700/85 border-red-600'
    return 'bg-red-500 border-red-400'
  }
  return 'bg-gray-800/50 border-gray-700'
}

function fmtDate(d: string) {
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) }
  catch { return d }
}

export default function SectorStrength() {
  const [timeframe, setTimeframe] = useState<Timeframe>('daily')
  const [rows, setRows]           = useState<Row[]>([])
  const [asOf, setAsOf]           = useState<string>('')
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const view = timeframe === 'daily' ? 'sector_index_strength_daily' : 'sector_index_strength_weekly'
      // Get the latest trade_date first
      const { data: latest, error: latestErr } = await supabase
        .from(view)
        .select('trade_date')
        .order('trade_date', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (latestErr) throw latestErr
      if (!latest) { setRows([]); setLoading(false); return }

      const { data, error: rowsErr } = await supabase
        .from(view)
        .select('*')
        .eq('trade_date', latest.trade_date)
        .order('strength_rank', { ascending: true })

      if (rowsErr) throw rowsErr
      setRows((data || []) as Row[])
      setAsOf(latest.trade_date)
    } catch (e: any) {
      console.error(e)
      setError(e?.message || 'Failed to load sector strength data')
    }
    setLoading(false)
  }, [timeframe])

  useEffect(() => { fetchData() }, [fetchData])
  const { enabled: autoOn, toggle: toggleAuto, countdownStr } = useAutoRefresh(fetchData, 15 * 60 * 1000, false)

  const chgKey = timeframe === 'daily' ? 'day_chg_pct' : 'week_chg_pct'
  const sorted = [...rows].sort((a, b) => (b[chgKey] ?? 0) - (a[chgKey] ?? 0))
  const strongest = sorted[0]
  const weakest = sorted[sorted.length - 1]
  const advancers = rows.filter(r => (r[chgKey] ?? 0) > 0).length
  const decliners = rows.filter(r => (r[chgKey] ?? 0) < 0).length

  return (
    <div className="min-h-screen bg-[#07070e] text-white">
      <Navbar active="/sector-strength" />
      <div className="max-w-6xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-black tracking-tight mb-1">🔥 Sector Strength</h1>
            <p className="text-gray-500 text-sm">Which NSE sector is leading or lagging · Ranked by real sectoral index price change</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={toggleAuto} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${autoOn ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60' : 'bg-gray-900/40 text-gray-500 border-gray-800'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${autoOn ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`}/>
              {autoOn ? countdownStr : 'Auto'}
            </button>
            <button onClick={fetchData} disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-sm font-medium text-white rounded-lg border border-gray-700 disabled:opacity-50 transition-all">
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''}/>Refresh
            </button>
          </div>
        </div>

        {/* Timeframe selector */}
        <div className="flex items-center gap-2 mb-5">
          {(['daily', 'weekly'] as const).map(tf => (
            <button key={tf} onClick={() => setTimeframe(tf)}
              className={`px-5 py-2.5 rounded-xl text-sm font-bold border transition-all ${timeframe === tf ? 'bg-white text-gray-900 border-white' : 'bg-gray-900/40 text-gray-400 border-gray-800 hover:text-white'}`}>
              {tf === 'daily' ? '1 Day' : '5 Day (Weekly)'}
            </button>
          ))}
          {asOf && (
            <span className="text-xs text-gray-600 ml-2">As of {fmtDate(asOf)}</span>
          )}
        </div>

        {error && (
          <div className="mb-4 bg-red-950/30 border border-red-800/40 rounded-xl px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Summary strip */}
        {!loading && !error && rows.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="bg-gray-900/30 border border-gray-800 rounded-xl px-4 py-3">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Strongest</p>
              <p className="text-sm font-black text-emerald-400">{strongest ? LABELS[strongest.index_symbol] || strongest.index_symbol : '—'}</p>
              <p className="text-xs text-emerald-500">{strongest ? `+${(strongest[chgKey] ?? 0).toFixed(2)}%` : ''}</p>
            </div>
            <div className="bg-gray-900/30 border border-gray-800 rounded-xl px-4 py-3">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Weakest</p>
              <p className="text-sm font-black text-red-400">{weakest ? LABELS[weakest.index_symbol] || weakest.index_symbol : '—'}</p>
              <p className="text-xs text-red-500">{weakest ? `${(weakest[chgKey] ?? 0).toFixed(2)}%` : ''}</p>
            </div>
            <div className="bg-gray-900/30 border border-gray-800 rounded-xl px-4 py-3">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Advancing</p>
              <p className="text-sm font-black text-emerald-400">{advancers} / {rows.length}</p>
            </div>
            <div className="bg-gray-900/30 border border-gray-800 rounded-xl px-4 py-3">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Declining</p>
              <p className="text-sm font-black text-red-400">{decliners} / {rows.length}</p>
            </div>
          </div>
        )}

        {/* Heatmap tiles */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {Array.from({ length: 17 }).map((_, i) => (
              <div key={i} className="h-28 bg-gray-900/30 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : !error && rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 border border-gray-800/50 rounded-2xl">
            <div className="text-4xl mb-4">🔥</div>
            <p className="text-gray-500">No sector strength data available yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {sorted.map(r => {
              const pct = r[chgKey] ?? 0
              return (
                <div key={r.index_symbol}
                  className={`relative rounded-xl border p-4 h-28 flex flex-col justify-between transition-transform hover:scale-[1.02] ${tileColor(pct)}`}>
                  <div className="flex items-start justify-between">
                    <p className="text-xs font-black text-white leading-tight">{LABELS[r.index_symbol] || r.index_symbol}</p>
                    <span className="text-[10px] text-white/60 font-bold">#{r.strength_rank}</span>
                  </div>
                  <div>
                    <p className="text-lg font-black text-white">{pct > 0 ? '+' : ''}{pct.toFixed(2)}%</p>
                    <p className="text-[10px] text-white/60">₹{r.close.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div className="mt-6 bg-gray-900/20 border border-gray-800/40 rounded-xl p-4">
          <p className="text-xs text-gray-600 leading-relaxed">
            <span className="text-gray-400 font-semibold">How to read: </span>
            Ranked by real NSE sectoral index price change (1-day or 5-day) — not a stock-count aggregate, so a sector with just one or two tracked stocks doesn&apos;t skew the read.
            Green = outperforming, Red = underperforming · Brighter tile = stronger move · Not investment advice
          </p>
        </div>
      </div>
    </div>
  )
}
