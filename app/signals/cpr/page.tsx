'use client'
import Navbar from '@/components/Navbar'
import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, ExternalLink } from 'lucide-react'
import { useRouter } from 'next/navigation'

const API = 'https://greeknova-backend-production.up.railway.app'

interface OISignal {
  signal_type: string; bias: string; option_type: string; strike: number; score: number;
  otm_distance_pct?: number
}

interface CPRRow {
  symbol: string; is_index: boolean; cmp: number
  prev_high: number; prev_low: number; prev_close: number
  pivot: number; tc: number; bc: number
  width_pts: number; width_pct: number
  width_label: string; width_color: string; width_emoji: string; width_priority: number
  cpr_trend: string; trend_label: string; trend_color: string
  is_virgin: boolean
  cpr_status: string | null; status_label: string | null; status_color: string | null
  cpr_position: string; position_label: string; position_bias: string; position_color: string
  has_oi_signal: boolean; confluence: boolean
  oi_signals: OISignal[]; best_signal: OISignal | null
}

interface CPRData {
  data: CPRRow[]; total: number; trade_date: string
  confluence_count: number; narrow_count: number; source: string
}

const SIGNAL_ICONS: Record<string, string> = {
  LONG_BUILDUP:'🐂', SHORT_BUILDUP:'🐻', CALL_WRITING:'✍️', PUT_WRITING:'✍️',
  SHORT_COVERING:'🔄', LONG_UNWINDING:'⚠️', VOLUME_SURGE:'⚡',
}

const WIDTH_STYLES: Record<string, string> = {
  RED:   'bg-red-950/60 text-red-400 border-red-800/60',
  AMBER: 'bg-amber-950/60 text-amber-400 border-amber-800/60',
  GRAY:  'bg-gray-900/60 text-gray-400 border-gray-700',
  BLUE:  'bg-blue-950/60 text-blue-400 border-blue-800/60',
}

const POSITION_STYLES: Record<string, string> = {
  EMERALD: 'bg-emerald-950/40 text-emerald-400 border-emerald-800/50',
  RED:     'bg-red-950/40 text-red-400 border-red-800/50',
  AMBER:   'bg-amber-950/40 text-amber-400 border-amber-800/50',
}

const TREND_STYLES: Record<string, string> = {
  EMERALD: 'text-emerald-400',
  RED:     'text-red-400',
  GRAY:    'text-gray-500',
}

const STATUS_STYLES: Record<string, string> = {
  EMERALD: 'text-emerald-400',
  RED:     'text-red-400',
  AMBER:   'text-amber-400',
}

export default function CPRScanner() {
  const [data, setData]       = useState<CPRData | null>(null)
  const [loading, setLoading] = useState(true)
  const [posFilter, setPosFilter]         = useState<'all'|'ABOVE_CPR'|'BELOW_CPR'|'INSIDE_CPR'>('all')
  const [widthFilter, setWidthFilter]     = useState<'all'|'narrow'|'normal'>('all')
  const [trendFilter, setTrendFilter]     = useState<'all'|'ASCENDING'|'DESCENDING'|'SIDEWAYS'>('all')
  const [confluenceOnly, setConfluenceOnly] = useState(false)
  const [virginOnly, setVirginOnly]         = useState(false)
  const [typeFilter, setTypeFilter]       = useState<'all'|'index'|'stocks'>('all')
  const router = useRouter()

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch(`${API}/cpr-scanner`)
      const json = await res.json()
      setData(json)
    } catch(e) { console.error(e) }
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const rows = data?.data || []
  const filtered = rows
    .filter(r => posFilter === 'all' || r.cpr_position === posFilter)
    .filter(r => widthFilter === 'all' || (widthFilter === 'narrow' ? r.width_priority <= 2 : r.width_priority === 3))
    .filter(r => trendFilter === 'all' || r.cpr_trend === trendFilter)
    .filter(r => !confluenceOnly || r.confluence)
    .filter(r => !virginOnly || r.is_virgin)
    .filter(r => typeFilter === 'all' || (typeFilter === 'index' ? r.is_index : !r.is_index))

  return (
    <div className="min-h-screen bg-[#07070e] text-white">
      <Navbar active="/signals/cpr" />
      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="text-3xl font-black tracking-tight mb-1">📐 CPR Scanner</h1>
            <p className="text-gray-500 text-sm">
              Daily Central Pivot Range · Frank Ochoa's Pivot Boss ·
              Narrow CPR = compression = breakout brewing
            </p>
          </div>
          <div className="flex items-center gap-3">
            {data?.trade_date && (
              <div className="text-xs bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-gray-400">
                Trade date: {data.trade_date}
                {data.source === 'live' && <span className="text-amber-400 ml-1">(live fallback)</span>}
              </div>
            )}
            <button onClick={fetchData} disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-sm font-medium text-white rounded-lg border border-gray-700 disabled:opacity-50 transition-all">
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''}/>Refresh
            </button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-5 gap-3 mb-5">
          <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Total Symbols</p>
            <p className="text-2xl font-black text-white">{data?.total || 0}</p>
            <p className="text-xs text-gray-600">F&O stocks + indices</p>
          </div>
          <div className="bg-amber-950/20 border border-amber-800/40 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">🔴🟡 Narrow CPR</p>
            <p className="text-2xl font-black text-amber-400">{data?.narrow_count || 0}</p>
            <p className="text-xs text-gray-600">width &lt; 0.30%</p>
          </div>
          <div className="bg-orange-950/20 border border-orange-800/40 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">⚡ Confluence</p>
            <p className="text-2xl font-black text-orange-400">{data?.confluence_count || 0}</p>
            <p className="text-xs text-gray-600">Narrow CPR + OI signal</p>
          </div>
          <div className="bg-cyan-950/20 border border-cyan-800/40 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">🔵 Virgin CPR</p>
            <p className="text-2xl font-black text-cyan-400">{rows.filter(r => r.is_virgin).length}</p>
            <p className="text-xs text-gray-600">never tested today</p>
          </div>
          <div className="bg-emerald-950/20 border border-emerald-800/40 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">↑ Ascending CPR</p>
            <p className="text-2xl font-black text-emerald-400">{rows.filter(r => r.cpr_trend === 'ASCENDING').length}</p>
            <p className="text-xs text-gray-600">bullish continuation</p>
          </div>
        </div>

        {/* CPR explanation */}
        <div className="bg-gray-900/20 border border-gray-700 rounded-xl px-4 py-3 mb-5">
          <p className="text-xs text-gray-500 leading-relaxed">
            <span className="text-white font-semibold">Pivot Boss CPR: </span>
            <span className="text-amber-400">Pivot</span> = (H+L+C)/3 ·
            <span className="text-emerald-400"> TC</span> = Top Central (resistance) ·
            <span className="text-red-400"> BC</span> = Bottom Central (support) ·
            <span className="text-cyan-400"> 🔵 Virgin</span> = CPR never tested today = strong magnet ·
            <span className="text-emerald-400"> ↑ Ascending</span> = today's CPR above yesterday's = uptrend ·
            <span className="text-amber-400"> ⚠️ Inside CPR</span> = trend not persisting = avoid new entries
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <button onClick={() => setConfluenceOnly(v => !v)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${confluenceOnly ? 'bg-orange-950/60 text-orange-400 border-orange-800/60' : 'bg-gray-900/40 text-gray-400 border-gray-800'}`}>
            ⚡ Confluence Only
          </button>
          <button onClick={() => setVirginOnly(v => !v)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${virginOnly ? 'bg-cyan-950/60 text-cyan-400 border-cyan-800/60' : 'bg-gray-900/40 text-gray-400 border-gray-800'}`}>
            🔵 Virgin Only
          </button>
          <div className="w-px h-5 bg-gray-800 mx-1"/>
          {(['all','narrow','normal'] as const).map(f => (
            <button key={f} onClick={() => setWidthFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${widthFilter===f ? 'bg-white text-gray-900 border-white' : 'bg-gray-900/40 text-gray-400 border-gray-800 hover:text-white'}`}>
              {f === 'narrow' ? '🔴🟡 Narrow' : f === 'normal' ? '⚪ Normal' : 'All Width'}
            </button>
          ))}
          <div className="w-px h-5 bg-gray-800 mx-1"/>
          {(['all','ASCENDING','DESCENDING','SIDEWAYS'] as const).map(f => (
            <button key={f} onClick={() => setTrendFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${trendFilter===f
                ? f==='ASCENDING' ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                : f==='DESCENDING' ? 'bg-red-950 text-red-400 border-red-800'
                : f==='SIDEWAYS' ? 'bg-gray-800 text-gray-400 border-gray-700'
                : 'bg-white text-gray-900 border-white'
                : 'bg-gray-900/40 text-gray-400 border-gray-800 hover:text-white'}`}>
              {f === 'all' ? 'All Trend' : f === 'ASCENDING' ? '↑ Ascending' : f === 'DESCENDING' ? '↓ Descending' : '→ Sideways'}
            </button>
          ))}
          <div className="w-px h-5 bg-gray-800 mx-1"/>
          {(['all','ABOVE_CPR','BELOW_CPR','INSIDE_CPR'] as const).map(f => (
            <button key={f} onClick={() => setPosFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${posFilter===f
                ? f==='ABOVE_CPR' ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                : f==='BELOW_CPR' ? 'bg-red-950 text-red-400 border-red-800'
                : f==='INSIDE_CPR' ? 'bg-amber-950 text-amber-400 border-amber-800'
                : 'bg-white text-gray-900 border-white'
                : 'bg-gray-900/40 text-gray-400 border-gray-800 hover:text-white'}`}>
              {f === 'all' ? 'All Position' : f === 'ABOVE_CPR' ? '↑ Above' : f === 'BELOW_CPR' ? '↓ Below' : '⟷ Inside'}
            </button>
          ))}
          <div className="w-px h-5 bg-gray-800 mx-1"/>
          {(['all','index','stocks'] as const).map(f => (
            <button key={f} onClick={() => setTypeFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all capitalize ${typeFilter===f ? 'bg-white text-gray-900 border-white' : 'bg-gray-900/40 text-gray-400 border-gray-800 hover:text-white'}`}>
              {f}
            </button>
          ))}
        </div>

        <p className="text-xs text-gray-600 mb-4">{filtered.length} symbols · Confluence + narrowest first</p>

        {/* Table */}
        {loading ? (
          <div className="space-y-2">{[1,2,3,4,5,6,7,8].map(i=>(
            <div key={i} className="h-14 bg-gray-900/30 border border-gray-800 rounded-xl animate-pulse"/>
          ))}</div>
        ) : filtered.length > 0 ? (
          <div className="rounded-2xl border border-gray-800 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-900/60 border-b border-gray-800">
                  {['Symbol','Prev OHLC','CPR Levels','Width','Trend + Status','Position','OI Signal','Action'].map((h,i) => (
                    <th key={h} className={`text-xs font-semibold text-gray-500 px-4 py-3.5 text-left ${i===0?'pl-5':''} ${i===7?'text-center pr-5':''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, i) => (
                  <tr key={row.symbol}
                    className={`border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors ${row.confluence ? 'bg-amber-950/5' : i%2===0?'':'bg-gray-900/10'}`}>

                    {/* Symbol */}
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-black text-white">{row.symbol}</span>
                        {row.is_index && <span className="text-[10px] px-1 py-0.5 bg-cyan-950 text-cyan-400 border border-cyan-800/50 rounded">IDX</span>}
                        {row.confluence && <span className="text-[10px] px-1.5 py-0.5 bg-orange-950 text-orange-400 border border-orange-800/50 rounded-md font-bold">⚡</span>}
                        {row.is_virgin && <span className="text-[10px] px-1.5 py-0.5 bg-cyan-950/60 text-cyan-400 border border-cyan-800/50 rounded-md">🔵V</span>}
                      </div>
                      <p className="text-xs text-amber-400 font-bold mt-0.5">₹{row.cmp.toLocaleString()}</p>
                    </td>

                    {/* Prev OHLC */}
                    <td className="px-4 py-3">
                      <div className="text-xs space-y-0.5 text-gray-500">
                        <p>H: <span className="text-emerald-400">{row.prev_high.toLocaleString()}</span></p>
                        <p>L: <span className="text-red-400">{row.prev_low.toLocaleString()}</span></p>
                        <p>C: <span className="text-gray-300">{row.prev_close.toLocaleString()}</span></p>
                      </div>
                    </td>

                    {/* CPR Levels */}
                    <td className="px-4 py-3">
                      <div className="text-xs space-y-0.5">
                        <p><span className="text-emerald-400 font-bold">TC</span> <span className="text-white">{row.tc.toLocaleString()}</span></p>
                        <p><span className="text-amber-400 font-bold">P </span> <span className="text-gray-400">{row.pivot.toLocaleString()}</span></p>
                        <p><span className="text-red-400 font-bold">BC</span> <span className="text-white">{row.bc.toLocaleString()}</span></p>
                      </div>
                    </td>

                    {/* Width */}
                    <td className="px-4 py-3">
                      <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-xs font-bold ${WIDTH_STYLES[row.width_color] || WIDTH_STYLES.GRAY}`}>
                        {row.width_emoji} {row.width_label}
                      </div>
                      <p className="text-[10px] text-gray-600 mt-1">{row.width_pct}% · {row.width_pts}pts</p>
                    </td>

                    {/* Trend + Status */}
                    <td className="px-4 py-3">
                      <p className={`text-xs font-bold ${TREND_STYLES[row.trend_color] || 'text-gray-500'}`}>
                        {row.trend_label}
                      </p>
                      {row.status_label && (
                        <p className={`text-xs mt-1 ${STATUS_STYLES[row.status_color || 'GRAY'] || 'text-gray-500'}`}>
                          {row.status_label}
                        </p>
                      )}
                      {!row.status_label && (
                        <p className="text-[10px] text-gray-700 mt-1">Status updates at 9:15 AM</p>
                      )}
                    </td>

                    {/* Position */}
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-md border ${POSITION_STYLES[row.position_color] || POSITION_STYLES.AMBER}`}>
                        {row.cpr_position === 'ABOVE_CPR' ? '↑' : row.cpr_position === 'BELOW_CPR' ? '↓' : '⟷'} {row.position_label}
                      </span>
                      <p className="text-[10px] text-gray-600 mt-1">
                        {row.cpr_position === 'ABOVE_CPR' ? `+${(row.cmp - row.tc).toFixed(1)} above TC`
                         : row.cpr_position === 'BELOW_CPR' ? `${(row.cmp - row.bc).toFixed(1)} below BC`
                         : 'between TC & BC'}
                      </p>
                    </td>

                    {/* OI Signal */}
                    <td className="px-4 py-3">
                      {row.best_signal ? (
                        <div>
                          <div className="flex items-center gap-1">
                            <span>{SIGNAL_ICONS[row.best_signal.signal_type] || '👁️'}</span>
                            <span className={`text-xs font-bold ${row.best_signal.bias === 'BULLISH' ? 'text-emerald-400' : row.best_signal.bias === 'BEARISH' ? 'text-red-400' : 'text-gray-400'}`}>
                              {row.best_signal.signal_type.replace(/_/g,' ')}
                            </span>
                          </div>
                          <p className="text-[10px] text-gray-600">{row.best_signal.strike.toLocaleString()} {row.best_signal.option_type} · {row.best_signal.score}/5</p>
                          {(row.best_signal as any).otm_distance_pct !== undefined && (
                            <p className={`text-[10px] font-semibold mt-0.5 ${
                              (row.best_signal as any).otm_distance_pct <= 2
                                ? 'text-emerald-400'
                                : (row.best_signal as any).otm_distance_pct <= 5
                                ? 'text-amber-400'
                                : 'text-red-400'
                            }`}>
                              {(row.best_signal as any).otm_distance_pct <= 2 ? '✅' :
                               (row.best_signal as any).otm_distance_pct <= 5 ? '⚠️' : '🔴'}{' '}
                              {(row.best_signal as any).otm_distance_pct}% from CMP
                            </p>
                          )}
                          {row.oi_signals.length > 1 && <p className="text-[10px] text-gray-700">+{row.oi_signals.length-1} more</p>}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-700">—</span>
                      )}
                    </td>

                    {/* Action */}
                    <td className="px-5 py-3 text-center">
                      <button onClick={() => router.push(`/signals/intraday?symbol=${row.symbol}`)}
                        className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 border border-cyan-800/40 px-2 py-1 rounded-lg transition-colors mx-auto">
                        <ExternalLink size={10}/>Log
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 border border-gray-800/50 rounded-2xl">
            <div className="text-4xl mb-4">📐</div>
            <p className="text-gray-500">No data — CPR computed at 3:35 PM EOD</p>
          </div>
        )}

        <div className="mt-6 bg-gray-900/20 border border-gray-800/40 rounded-xl p-4">
          <p className="text-xs text-gray-600 leading-relaxed">
            <span className="text-gray-400 font-semibold">Trading with CPR (Pivot Boss): </span>
            <span className="text-emerald-400">↑ Ascending + Above TC + Holding</span> = strong long setup ·
            <span className="text-red-400"> ↓ Descending + Below BC + Holding</span> = strong short setup ·
            <span className="text-amber-400"> Inside CPR</span> = trend not persisting = avoid new entries ·
            <span className="text-cyan-400"> 🔵 Virgin CPR</span> = never tested = expect strong reaction when touched ·
            <span className="text-orange-400"> ⚡ Confluence</span> = Narrow CPR + OI signal = highest probability setup ·
            Informational only · Not investment advice
          </p>
        </div>
      </div>
    </div>
  )
}
