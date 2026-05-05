'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { RefreshCw, Clock, Zap, TrendingUp } from 'lucide-react'

interface UOASignal {
  symbol: string; tradingsymbol: string; strike: number
  option_type: string; cmp: number; ltp: number
  volume: number; oi: number; vol_oi_ratio: number
  vol_ratio: number; oi_change_pct: number; otm_pct: number
  is_otm: boolean; signal_type: string; signal_desc: string
  score: number; is_index: boolean
}

const SIGNAL_META: Record<string, { color: string; bg: string; border: string; icon: string }> = {
  BUYER_DOMINATED:  { color: 'text-blue-400',    bg: 'bg-blue-950/40',    border: 'border-blue-800/50',    icon: '🐋' },
  FRESH_CONVICTION: { color: 'text-orange-400',  bg: 'bg-orange-950/40',  border: 'border-orange-800/50',  icon: '🎯' },
  FAR_OTM_ACTIVITY: { color: 'text-violet-400',  bg: 'bg-violet-950/40',  border: 'border-violet-800/50',  icon: '🚀' },
  VOLUME_SURGE:     { color: 'text-emerald-400', bg: 'bg-emerald-950/40', border: 'border-emerald-800/50', icon: '⚡' },
  UNUSUAL_ACTIVITY: { color: 'text-amber-400',   bg: 'bg-amber-950/40',   border: 'border-amber-800/50',   icon: '👁️' },
}

function ScoreMeter({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-1">
      {[1,2,3,4,5].map(i => (
        <div key={i} className={`h-2 w-4 rounded-sm transition-all ${
          i <= score
            ? score >= 4 ? 'bg-orange-400' : score >= 3 ? 'bg-amber-400' : 'bg-blue-400'
            : 'bg-gray-800'
        }`}/>
      ))}
      <span className="text-xs text-gray-500 ml-1">{score}/5</span>
    </div>
  )
}

export default function UOA() {
  const [data, setData] = useState<{ signals: UOASignal[]; total: number; timestamp: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all'|'index'|'stocks'>('all')
  const [typeFilter, setTypeFilter] = useState<'all'|'CE'|'PE'>('all')
  const [signalFilter, setSignalFilter] = useState<string>('all')
  const [minScore, setMinScore] = useState(2)
  const [lastUpdate, setLastUpdate] = useState('')
  const [autoEnabled, setAutoEnabled] = useState(false)
  const [countdown, setCountdown] = useState(300)
  const intervalRef = useRef<NodeJS.Timeout|null>(null)
  const countdownRef = useRef<NodeJS.Timeout|null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('https://greeknova-backend-production.up.railway.app/uoa')
      const json = await res.json()
      setData(json)
      if (json.timestamp) setLastUpdate(new Date(json.timestamp).toLocaleString('en-IN', { dateStyle:'medium', timeStyle:'short', timeZone:'UTC' }))
    } catch(e) { console.error(e) }
    setLoading(false)
  }, [])

  function startAuto() {
    setAutoEnabled(true); setCountdown(300)
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (countdownRef.current) clearInterval(countdownRef.current)
    intervalRef.current = setInterval(() => { fetchData(); setCountdown(300) }, 5*60*1000)
    countdownRef.current = setInterval(() => setCountdown(p => Math.max(0, p-1)), 1000)
  }
  function stopAuto() {
    setAutoEnabled(false)
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null }
  }

  useEffect(() => {
    fetchData(); startAuto()
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [])

  const filtered = (data?.signals || [])
    .filter(s => filter === 'all' || (filter === 'index' ? s.is_index : !s.is_index))
    .filter(s => typeFilter === 'all' || s.option_type === typeFilter)
    .filter(s => signalFilter === 'all' || s.signal_type === signalFilter)
    .filter(s => s.score >= minScore)

  const mins = Math.floor(countdown/60)
  const secs = countdown % 60

  const buyerDom = data?.signals.filter(s => s.signal_type === 'BUYER_DOMINATED').length || 0
  const freshConv = data?.signals.filter(s => s.signal_type === 'FRESH_CONVICTION').length || 0
  const farOtm = data?.signals.filter(s => s.signal_type === 'FAR_OTM_ACTIVITY').length || 0
  const highConv = data?.signals.filter(s => s.score >= 4).length || 0

  return (
    <div className="min-h-screen bg-[#07070e] text-white">
      <nav className="sticky top-0 z-50 border-b border-gray-800/50 bg-[#07070e]/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-600 flex items-center justify-center">
              <span className="text-xs font-black text-white">GN</span>
            </div>
            <span className="font-black text-white text-base">GreekNova</span>
            <span className="ml-1 text-xs font-medium px-1.5 py-0.5 bg-emerald-950 text-emerald-500 border border-emerald-800/50 rounded-md">BETA</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="/" className="text-sm text-gray-400 hover:text-white transition-colors">Dashboard</a>
            <a href="/premarket" className="text-sm text-gray-400 hover:text-white transition-colors">Pre-Market</a>
            <a href="/watchlist" className="text-sm text-gray-400 hover:text-white transition-colors">Watchlist</a>
            <a href="/scanners" className="text-sm text-gray-400 hover:text-white transition-colors">Scanners</a>
            <a href="/pcr" className="text-sm text-gray-400 hover:text-white transition-colors">PCR Trend</a>
            <a href="/spikes" className="text-sm text-gray-400 hover:text-white transition-colors">OI Spikes</a>
            <a href="/volume" className="text-sm text-gray-400 hover:text-white transition-colors">Vol Spikes</a>
            <a href="/uoa" className="text-sm font-semibold text-white border-b border-emerald-500 pb-0.5">UOA</a>
            <a href="/confluence" className="text-sm text-gray-400 hover:text-white transition-colors">Confluence</a>
            <a href="/maxpain" className="text-sm text-gray-400 hover:text-white transition-colors">Max Pain</a>
            <a href="/alerts" className="text-sm text-gray-400 hover:text-white transition-colors">Alerts</a>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black tracking-tight mb-1 flex items-center gap-3">
              <span>🐋</span> Unusual Options Activity
            </h1>
            <p className="text-gray-500 text-sm">Smart money detection · High vol/OI ratio = buyers · Far OTM activity = directional bets · Score 1-5 conviction</p>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdate && <div className="flex items-center gap-1.5 text-xs text-gray-600 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2"><Clock size={11}/>{lastUpdate}</div>}
            <button onClick={() => autoEnabled ? stopAuto() : startAuto()}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${autoEnabled ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60' : 'bg-gray-900/40 text-gray-500 border-gray-800'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${autoEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`}/>
              {autoEnabled ? `${mins}:${secs.toString().padStart(2,'0')}` : 'Auto OFF'}
            </button>
            <button onClick={fetchData} disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-sm font-medium text-white rounded-lg border border-gray-700 transition-all disabled:opacity-50">
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''}/>Refresh
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Total UOA Signals</p>
            <p className="text-2xl font-black text-white">{data?.total || 0}</p>
            <p className="text-xs text-gray-600">unusual activity detected</p>
          </div>
          <div className="bg-orange-950/20 border border-orange-800/40 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">🎯 High Conviction (4-5)</p>
            <p className="text-2xl font-black text-orange-400">{highConv}</p>
            <p className="text-xs text-gray-600">strongest signals</p>
          </div>
          <div className="bg-violet-950/20 border border-violet-800/40 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">🚀 Far OTM Activity</p>
            <p className="text-2xl font-black text-violet-400">{farOtm}</p>
            <p className="text-xs text-gray-600">speculative/hedging bets</p>
          </div>
          <div className="bg-blue-950/20 border border-blue-800/40 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">🐋 Buyer Dominated</p>
            <p className="text-2xl font-black text-blue-400">{buyerDom}</p>
            <p className="text-xs text-gray-600">vol {'>'} OI — buyers active</p>
          </div>
        </div>

        {/* How to read */}
        <div className="bg-gray-900/20 border border-gray-800/50 rounded-xl p-4 mb-6">
          <div className="grid grid-cols-4 gap-4 text-xs">
            <div><span className="text-blue-400 font-bold">🐋 Buyer Dominated</span><p className="text-gray-500 mt-1">Volume {'>'} OI — more contracts changing hands than open. Someone buying against existing writers.</p></div>
            <div><span className="text-orange-400 font-bold">🎯 Fresh Conviction</span><p className="text-gray-500 mt-1">Both volume AND OI rising together. Strong directional bet — new positions being built.</p></div>
            <div><span className="text-violet-400 font-bold">🚀 Far OTM Activity</span><p className="text-gray-500 mt-1">Heavy volume on strikes 3%+ away. Either hedging a large position or speculative directional bet.</p></div>
            <div><span className="text-emerald-400 font-bold">⚡ Volume Surge</span><p className="text-gray-500 mt-1">4x+ normal volume. Unusual interest — something may be happening. Watch closely.</p></div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {(['all','index','stocks'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all capitalize ${filter===f ? 'bg-white text-gray-900 border-white' : 'bg-gray-900/40 text-gray-400 border-gray-800 hover:text-white'}`}>
              {f}
            </button>
          ))}
          <div className="w-px h-5 bg-gray-800 mx-1"/>
          {(['all','CE','PE'] as const).map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${typeFilter===t ? 'bg-white text-gray-900 border-white' : 'bg-gray-900/40 text-gray-400 border-gray-800 hover:text-white'}`}>
              {t==='all'?'All':t}
            </button>
          ))}
          <div className="w-px h-5 bg-gray-800 mx-1"/>
          {Object.entries(SIGNAL_META).map(([key, m]) => (
            <button key={key} onClick={() => setSignalFilter(signalFilter===key?'all':key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${signalFilter===key ? `${m.bg} ${m.color} ${m.border}` : 'bg-gray-900/40 text-gray-400 border-gray-800 hover:text-white'}`}>
              {m.icon} {key.replace(/_/g,' ')}
            </button>
          ))}
          <div className="w-px h-5 bg-gray-800 mx-1"/>
          <div className="flex items-center gap-2 bg-gray-900/30 border border-gray-800 rounded-lg px-3 py-1.5">
            <span className="text-xs text-gray-500">Min score:</span>
            <input type="range" min="1" max="5" value={minScore} onChange={e => setMinScore(Number(e.target.value))} className="w-20 accent-amber-400"/>
            <span className="text-xs font-black text-amber-400">{minScore}+</span>
          </div>
        </div>

        <p className="text-xs text-gray-600 mb-4">{filtered.length} signals</p>

        {/* Table */}
        {loading ? (
          <div className="space-y-2">{[1,2,3,4,5].map(i=><div key={i} className="h-14 bg-gray-900/30 border border-gray-800 rounded-xl animate-pulse"/>)}</div>
        ) : filtered.length > 0 ? (
          <div className="rounded-2xl border border-gray-800 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-900/60 border-b border-gray-800">
                  {['Symbol','Strike','Type','Signal','Conviction','Vol/OI','Volume','OI Δ%','OTM%','LTP'].map((h,i)=>(
                    <th key={h} className={`text-xs font-semibold text-gray-500 px-4 py-3.5 ${i<=3?'text-left':'text-right'} ${i===0?'pl-5':''} ${i===9?'pr-5':''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((sig, i) => {
                  const m = SIGNAL_META[sig.signal_type] || SIGNAL_META.UNUSUAL_ACTIVITY
                  const isCE = sig.option_type === 'CE'
                  return (
                    <tr key={`${sig.tradingsymbol}-${i}`}
                      className={`border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors ${i%2===0?'':'bg-gray-900/20'}`}>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <a href={`/stock/${sig.symbol}`} className="text-sm font-black text-white hover:text-emerald-400 transition-colors">{sig.symbol}</a>
                          {sig.is_index && <span className="text-xs px-1.5 py-0.5 bg-cyan-950 text-cyan-400 border border-cyan-800/50 rounded-md">IDX</span>}
                        </div>
                        <p className="text-xs text-gray-600 mt-0.5">CMP: ₹{sig.cmp.toLocaleString()}</p>
                      </td>
                      <td className="px-4 py-3.5 text-sm font-bold text-gray-300">{sig.strike.toLocaleString()}</td>
                      <td className="px-4 py-3.5">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${isCE?'bg-red-950/50 text-red-400 border border-red-800/50':'bg-emerald-950/50 text-emerald-400 border border-emerald-800/50'}`}>{sig.option_type}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className={`inline-flex items-center gap-1.5 text-xs font-bold px-2 py-1 rounded-lg border ${m.color} ${m.bg} ${m.border}`}>
                          <span>{m.icon}</span>
                          <span>{sig.signal_type.replace(/_/g,' ')}</span>
                        </div>
                        <p className="text-xs text-gray-600 mt-0.5 max-w-[180px]">{sig.signal_desc}</p>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <ScoreMeter score={sig.score}/>
                      </td>
                      <td className={`px-4 py-3.5 text-right text-sm font-black ${sig.vol_oi_ratio > 5 ? 'text-orange-400' : sig.vol_oi_ratio > 2 ? 'text-amber-400' : 'text-gray-400'}`}>
                        {sig.vol_oi_ratio}x
                      </td>
                      <td className="px-4 py-3.5 text-right text-sm text-gray-300">{(sig.volume/100000).toFixed(1)}L</td>
                      <td className={`px-4 py-3.5 text-right text-sm font-semibold ${sig.oi_change_pct > 0 ? 'text-red-400' : sig.oi_change_pct < 0 ? 'text-emerald-400' : 'text-gray-500'}`}>
                        {sig.oi_change_pct > 0 ? '+' : ''}{sig.oi_change_pct}%
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        {sig.is_otm ? (
                          <span className="text-xs font-bold text-violet-400">{sig.otm_pct}% OTM</span>
                        ) : (
                          <span className="text-xs text-gray-600">ITM/ATM</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right text-sm font-bold text-amber-400">₹{sig.ltp}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center border border-gray-800/50 rounded-2xl">
            <div className="text-5xl mb-4">🐋</div>
            <h3 className="text-lg font-bold text-gray-400 mb-2">No unusual activity detected</h3>
            <p className="text-sm text-gray-600">Lower the minimum score or check back during active market hours</p>
          </div>
        )}
      </div>
    </div>
  )
}
