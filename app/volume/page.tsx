'use client'
import Navbar from '@/components/Navbar'
import { useEffect, useState, useCallback, useRef } from 'react'
import { RefreshCw, Clock, Activity } from 'lucide-react'

interface VolumeSpike {
  symbol: string; tradingsymbol: string; strike: number
  option_type: string; old_volume: number; new_volume: number
  vol_pct: number; oi_pct: number; oi_signal: string
  last_price: number; is_index: boolean
}
interface SpikeData {
  ts_new: string; ts_old: string; threshold: number
  total_spikes: number; spikes: VolumeSpike[]
}

const SIGNAL_META: Record<string, { color: string; bg: string; border: string; label: string; desc: string }> = {
  FRESH_BUILD: { color:'text-red-400', bg:'bg-red-950/50', border:'border-red-800/50', label:'Fresh Build', desc:'Volume + OI rising = new positions' },
  UNWINDING:   { color:'text-emerald-400', bg:'bg-emerald-950/50', border:'border-emerald-800/50', label:'Unwinding', desc:'Volume rising + OI falling = exiting' },
  CHURN:       { color:'text-amber-400', bg:'bg-amber-950/50', border:'border-amber-800/50', label:'Churn', desc:'High volume, OI unchanged = rolling' },
}

export default function VolumeSpikes() {
  const [data, setData] = useState<SpikeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [threshold, setThreshold] = useState(20)
  const [filter, setFilter] = useState<'all'|'FRESH_BUILD'|'UNWINDING'|'CHURN'>('all')
  const [typeFilter, setTypeFilter] = useState<'all'|'CE'|'PE'>('all')
  const [lastUpdate, setLastUpdate] = useState('')
  const [autoEnabled, setAutoEnabled] = useState(false)
  const [countdown, setCountdown] = useState(300)
  const intervalRef = useRef<NodeJS.Timeout|null>(null)
  const countdownRef = useRef<NodeJS.Timeout|null>(null)
  const thresholdRef = useRef(20)

  useEffect(() => {
    try {
      const t = localStorage.getItem('gn_vol_threshold')
      if (t) { setThreshold(Number(t)); thresholdRef.current = Number(t) }
    } catch {}
  }, [])

  const fetchSpikes = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`https://greeknova-backend-production.up.railway.app/volume-spikes?threshold=${thresholdRef.current}`)
      const json = await res.json()
      setData(json)
      setLastUpdate(new Date(json.ts_new).toLocaleString('en-IN', { dateStyle:'medium', timeStyle:'short', timeZone:'UTC' }))
    } catch(e) { console.error(e) }
    setLoading(false)
  }, [])


  const debounceRef = useRef<NodeJS.Timeout|null>(null)
  function handleThresholdChange(v: number) {
    setThreshold(v)
    thresholdRef.current = v
    localStorage.setItem('gn_vol_threshold', String(v))
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchSpikes(), 600)
  }

  function startAuto() {
    setAutoEnabled(true)
    setCountdown(300)
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (countdownRef.current) clearInterval(countdownRef.current)
    intervalRef.current = setInterval(() => { fetchSpikes(); setCountdown(300) }, 5*60*1000)
    countdownRef.current = setInterval(() => setCountdown(p => Math.max(0, p-1)), 1000)
  }

  function stopAuto() {
    setAutoEnabled(false)
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null }
  }

  useEffect(() => {
    fetchSpikes()
    startAuto()
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [])

  const filtered = data?.spikes.filter(s =>
    (filter==='all' || s.oi_signal===filter) &&
    (typeFilter==='all' || s.option_type===typeFilter)
  ) || []

  const freshBuilds = data?.spikes.filter(s => s.oi_signal==='FRESH_BUILD').length || 0
  const unwinds = data?.spikes.filter(s => s.oi_signal==='UNWINDING').length || 0
  const churns = data?.spikes.filter(s => s.oi_signal==='CHURN').length || 0
  const mins = Math.floor(countdown/60)
  const secs = countdown % 60

  return (
    <div className="min-h-screen bg-[#07070e] text-white">
      <Navbar active="/volume" />

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black tracking-tight mb-1">Volume Spike Scanner</h1>
            <p className="text-gray-500 text-sm">Sudden volume surges · Fresh Build = new positions · Unwinding = exits · Churn = rolling</p>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdate && <div className="flex items-center gap-1.5 text-xs text-gray-600 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2"><Clock size={11}/>{lastUpdate}</div>}
            <button onClick={() => autoEnabled ? stopAuto() : startAuto()}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${autoEnabled ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60' : 'bg-gray-900/40 text-gray-500 border-gray-800'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${autoEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`}/>
              {autoEnabled ? `${mins}:${secs.toString().padStart(2,'0')}` : 'Auto OFF'}
            </button>
            <button onClick={fetchSpikes} disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-sm font-medium text-white rounded-lg border border-gray-700 transition-all disabled:opacity-50">
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''}/>Refresh
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          {Object.entries(SIGNAL_META).map(([key, m]) => {
            const count = key==='FRESH_BUILD'?freshBuilds:key==='UNWINDING'?unwinds:churns
            return (
              <button key={key} onClick={() => setFilter(filter===key?'all':key as any)}
                className={`p-4 rounded-xl border text-left transition-all ${filter===key ? `${m.bg} ${m.border}` : 'bg-gray-900/30 border-gray-800 hover:border-gray-700'}`}>
                <div className="flex items-center justify-between mb-1">
                  <Activity size={16} className={m.color}/>
                  <span className={`text-2xl font-black ${filter===key?m.color:'text-white'}`}>{count}</span>
                </div>
                <p className={`text-sm font-bold ${filter===key?m.color:'text-gray-400'}`}>{m.label}</p>
                <p className="text-xs text-gray-600 mt-0.5">{m.desc}</p>
              </button>
            )
          })}
        </div>

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-gray-900/30 border border-gray-800 rounded-lg px-3 py-2">
              <span className="text-xs text-gray-500">Min volume spike:</span>
              <input type="range" min="10" max="100" value={threshold}
                onChange={e => handleThresholdChange(Number(e.target.value))}
                className="w-24 accent-amber-400"/>
              <span className="text-sm font-black text-amber-400 min-w-[3rem]">{threshold}%</span>
            </div>
            {(['all','CE','PE'] as const).map(t => (
              <button key={t} onClick={() => setTypeFilter(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${typeFilter===t ? 'bg-white text-gray-900 border-white' : 'bg-gray-900/40 text-gray-400 border-gray-800 hover:text-white'}`}>
                {t==='all'?'All':t}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-600">{filtered.length} results</p>
        </div>

        {loading ? (
          <div className="space-y-2">{[1,2,3,4,5].map(i=><div key={i} className="h-14 bg-gray-900/30 border border-gray-800 rounded-xl animate-pulse"/>)}</div>
        ) : filtered.length > 0 ? (
          <div className="rounded-2xl border border-gray-800 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-900/60 border-b border-gray-800">
                  {['Symbol','Strike','Type','Signal','Old Vol','New Vol','Vol %','OI %','LTP'].map((h,i)=>(
                    <th key={h} className={`text-xs font-semibold text-gray-500 px-4 py-3.5 ${i<=3?'text-left':'text-right'} ${i===0?'pl-5':''} ${i===8?'pr-5':''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((spike,i) => {
                  const m = SIGNAL_META[spike.oi_signal]
                  const isCE = spike.option_type==='CE'
                  return (
                    <tr key={`${spike.tradingsymbol}-${i}`} className={`border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors ${i%2===0?'':'bg-gray-900/20'}`}>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-white">{spike.symbol}</span>
                          {spike.is_index && <span className="text-xs px-1.5 py-0.5 bg-cyan-950 text-cyan-400 border border-cyan-800/50 rounded-md">IDX</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-sm font-bold text-gray-300">{spike.strike.toLocaleString()}</td>
                      <td className="px-4 py-3.5">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${isCE?'bg-red-950/50 text-red-400 border border-red-800/50':'bg-emerald-950/50 text-emerald-400 border border-emerald-800/50'}`}>{spike.option_type}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-lg border ${m?.color} ${m?.bg} ${m?.border}`}>{m?.label}</span>
                      </td>
                      <td className="px-4 py-3.5 text-right text-sm text-gray-500">{(spike.old_volume/100000).toFixed(1)}L</td>
                      <td className="px-4 py-3.5 text-right text-sm text-gray-300">{(spike.new_volume/100000).toFixed(1)}L</td>
                      <td className="px-4 py-3.5 text-right"><span className="text-sm font-black text-amber-400">+{spike.vol_pct}%</span></td>
                      <td className={`px-4 py-3.5 text-right text-sm font-semibold ${spike.oi_pct>0?'text-red-400':'text-emerald-400'}`}>{spike.oi_pct>0?'+':''}{spike.oi_pct}%</td>
                      <td className="px-5 py-3.5 text-right text-sm font-bold text-amber-400">₹{spike.last_price}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center border border-gray-800/50 rounded-2xl">
            <div className="text-5xl mb-4">📊</div>
            <h3 className="text-lg font-bold text-gray-400 mb-2">No volume spikes above {threshold}%</h3>
            <p className="text-sm text-gray-600">Lower the threshold or wait for next capture</p>
          </div>
        )}
      </div>
    </div>
  )
}
