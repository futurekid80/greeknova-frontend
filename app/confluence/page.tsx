'use client'
import Navbar from '@/components/Navbar'
import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, Clock, TrendingDown, TrendingUp, Zap } from 'lucide-react'
import { useAutoRefresh } from '@/lib/useAutoRefresh'

interface ConfluenceSignal {
  symbol: string; cmp: number; pcr: number
  scanner_signal: string; oi_structure: string
  oi_spike: any; vol_spike: any
  active_signals: string[]; signal_count: number
  bias: string; ce_wall: number; pe_wall: number
  dist_ce: number; dist_pe: number; is_index: boolean
}

const SIGNAL_COLORS: Record<string, string> = {
  CALL_WRITING: 'text-red-400',
  PUT_WRITING: 'text-emerald-400',
  BATTLEGROUND: 'text-violet-400',
  SQUEEZE: 'text-amber-400',
}

const STRUCTURE_COLORS: Record<string, string> = {
  'Breakout Watch': 'text-emerald-300',
  'Breakdown Watch': 'text-red-300',
  'Resistance Test': 'text-red-400',
  'Support Test': 'text-emerald-400',
  'Upper Range': 'text-orange-400',
  'Lower Range': 'text-cyan-400',
  'Mid Range': 'text-amber-400',
}

function SignalBadge({ label }: { label: string }) {
  const color = SIGNAL_COLORS[label] || STRUCTURE_COLORS[label] ||
    (label.includes('BUILD') ? 'text-orange-400' : label.includes('UNWIND') ? 'text-cyan-400' : 'text-gray-400')
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-md bg-gray-800 border border-gray-700 ${color}`}>
      {label.replace(/_/g, ' ')}
    </span>
  )
}

function StrengthMeter({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className={`h-2 w-4 rounded-sm ${i <= count ? (count >= 3 ? 'bg-orange-400' : 'bg-amber-400') : 'bg-gray-800'}`} />
      ))}
      <span className="text-xs text-gray-500 ml-1">{count} signals</span>
    </div>
  )
}

export default function Confluence() {
  const [data, setData] = useState<{ total: number; signals: ConfluenceSignal[]; timestamp: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [biasFilter, setBiasFilter] = useState<'all' | 'BEARISH' | 'BULLISH' | 'MIXED'>('all')
  const [lastUpdate, setLastUpdate] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('https://greeknova-backend-production.up.railway.app/confluence')
      const json = await res.json()
      setData(json)
      if (json.timestamp) {
        setLastUpdate(new Date(json.timestamp).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }))
      }
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [])

  const { enabled: autoEnabled, toggle: toggleAuto, countdownStr } = useAutoRefresh(fetchData, 5 * 60 * 1000, true)
  useEffect(() => { fetchData() }, [fetchData])

  const filtered = data?.signals.filter(s => biasFilter === 'all' || s.bias === biasFilter) || []
  const bearish = data?.signals.filter(s => s.bias === 'BEARISH').length || 0
  const bullish = data?.signals.filter(s => s.bias === 'BULLISH').length || 0
  const mixed = data?.signals.filter(s => s.bias === 'MIXED').length || 0
  const strong = data?.signals.filter(s => s.signal_count >= 3).length || 0

  return (
    <div className="min-h-screen bg-[#07070e] text-white">
      <Navbar active="/confluence" />

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black tracking-tight mb-1">Signal Confluence</h1>
            <p className="text-gray-500 text-sm">Stocks where multiple options signals align · Scanner + OI Structure + Spikes</p>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdate && <div className="flex items-center gap-1.5 text-xs text-gray-600 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2"><Clock size={11}/>{lastUpdate}</div>}
            <button onClick={toggleAuto} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${autoEnabled ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60' : 'bg-gray-900/40 text-gray-500 border-gray-800'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${autoEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`}/>
              {autoEnabled ? countdownStr : 'Auto'}
            </button>
            <button onClick={fetchData} disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-sm font-medium text-white rounded-lg border border-gray-700 transition-all disabled:opacity-50">
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''}/>Refresh
            </button>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Total Confluence</p>
            <p className="text-2xl font-black text-white">{data?.total || 0}</p>
            <p className="text-xs text-gray-600">Multi-signal stocks</p>
          </div>
          <div className="bg-orange-950/20 border border-orange-800/40 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Strong (3+ signals)</p>
            <p className="text-2xl font-black text-orange-400">{strong}</p>
            <p className="text-xs text-gray-600">High conviction</p>
          </div>
          <div className="bg-red-950/20 border border-red-800/40 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Bearish Confluence</p>
            <p className="text-2xl font-black text-red-400">{bearish}</p>
            <p className="text-xs text-gray-600">Downward bias</p>
          </div>
          <div className="bg-emerald-950/20 border border-emerald-800/40 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Bullish Confluence</p>
            <p className="text-2xl font-black text-emerald-400">{bullish}</p>
            <p className="text-xs text-gray-600">Upward bias</p>
          </div>
        </div>

        {/* How it works */}
        <div className="bg-gray-900/20 border border-gray-800/50 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-6 text-xs text-gray-500">
            <span className="font-semibold text-gray-300">How confluence works:</span>
            <span className="flex items-center gap-1.5"><Zap size={11} className="text-amber-400"/>Scanner Signal</span>
            <span>+</span>
            <span className="flex items-center gap-1.5"><TrendingDown size={11} className="text-red-400"/>OI Structure</span>
            <span>+</span>
            <span className="flex items-center gap-1.5"><TrendingUp size={11} className="text-emerald-400"/>OI/Vol Spike</span>
            <span>=</span>
            <span className="text-white font-bold">High conviction signal</span>
          </div>
        </div>

        {/* Bias filter */}
        <div className="flex gap-2 mb-5">
          {(['all', 'BEARISH', 'BULLISH', 'MIXED'] as const).map(b => (
            <button key={b} onClick={() => setBiasFilter(b)}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold border transition-all ${biasFilter === b
                ? b === 'BEARISH' ? 'bg-red-950/60 text-red-400 border-red-800' 
                  : b === 'BULLISH' ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800'
                  : b === 'MIXED' ? 'bg-amber-950/60 text-amber-400 border-amber-800'
                  : 'bg-white text-gray-900 border-white'
                : 'bg-gray-900/40 text-gray-400 border-gray-800 hover:text-white'}`}>
              {b === 'all' ? '◈ All' : b === 'BEARISH' ? '↓ Bearish' : b === 'BULLISH' ? '↑ Bullish' : '↔ Mixed'}
              {b !== 'all' && <span className="ml-1.5 opacity-60">{b === 'BEARISH' ? bearish : b === 'BULLISH' ? bullish : mixed}</span>}
            </button>
          ))}
        </div>

        {/* Confluence cards */}
        {loading ? (
          <div className="grid grid-cols-2 gap-3">{[1,2,3,4].map(i => <div key={i} className="h-48 bg-gray-900/30 border border-gray-800 rounded-xl animate-pulse"/>)}</div>
        ) : filtered.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map(sig => {
              const isBearish = sig.bias === 'BEARISH'
              const isBullish = sig.bias === 'BULLISH'
              return (
                <a href={`/stock/${sig.symbol}`} key={sig.symbol}
                  className={`block rounded-xl border p-5 hover:border-gray-600 transition-all ${
                    isBearish ? 'bg-red-950/10 border-red-900/40' 
                    : isBullish ? 'bg-emerald-950/10 border-emerald-900/40'
                    : 'bg-amber-950/10 border-amber-900/40'}`}>

                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg font-black text-white">{sig.symbol}</span>
                        {sig.is_index && <span className="text-xs px-1.5 py-0.5 bg-cyan-950 text-cyan-400 border border-cyan-800/50 rounded-md">INDEX</span>}
                        {sig.signal_count >= 3 && <span className="text-xs px-1.5 py-0.5 bg-orange-950 text-orange-400 border border-orange-800/50 rounded-md">🔥 STRONG</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-amber-400 font-bold">₹{sig.cmp.toLocaleString()}</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isBearish ? 'bg-red-950 text-red-400' : isBullish ? 'bg-emerald-950 text-emerald-400' : 'bg-amber-950 text-amber-400'}`}>
                          {isBearish ? '↓ BEARISH' : isBullish ? '↑ BULLISH' : '↔ MIXED'}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-2xl font-black ${sig.pcr > 1 ? 'text-emerald-400' : 'text-red-400'}`}>{sig.pcr}</p>
                      <p className="text-xs text-gray-600">PCR</p>
                    </div>
                  </div>

                  {/* Signal strength meter */}
                  <div className="mb-4">
                    <StrengthMeter count={sig.signal_count} />
                  </div>

                  {/* Active signals */}
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {sig.active_signals.map((s, i) => <SignalBadge key={i} label={s} />)}
                  </div>

                  {/* Walls */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-red-950/20 border border-red-900/30 rounded-lg p-2">
                      <p className="text-xs text-gray-600">CE Wall <span className="text-red-400">{sig.dist_ce}% away</span></p>
                      <p className="text-sm font-bold text-red-400">{sig.ce_wall.toLocaleString()}</p>
                    </div>
                    <div className="bg-emerald-950/20 border border-emerald-900/30 rounded-lg p-2">
                      <p className="text-xs text-gray-600">PE Wall <span className="text-emerald-400">{sig.dist_pe}% away</span></p>
                      <p className="text-sm font-bold text-emerald-400">{sig.pe_wall.toLocaleString()}</p>
                    </div>
                  </div>

                  <p className="text-xs text-gray-600 mt-3 text-right">Click for full analysis →</p>
                </a>
              )
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center border border-gray-800/50 rounded-2xl">
            <div className="text-5xl mb-4">🎯</div>
            <h3 className="text-lg font-bold text-gray-400 mb-2">No confluence signals</h3>
            <p className="text-sm text-gray-600">Multiple signals need to align — check back during active market hours</p>
          </div>
        )}
      </div>
    </div>
  )
}
