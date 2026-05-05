'use client'
import Navbar from '@/components/Navbar'
import { useEffect, useState, useCallback, useRef } from 'react'
import { RefreshCw, Clock, TrendingUp, TrendingDown, Zap } from 'lucide-react'

interface Spike {
  symbol: string; tradingsymbol: string; strike: number
  option_type: string; old_oi: number; new_oi: number
  oi_change: number; oi_pct: number; volume: number
  vol_change: number; last_price: number; is_index: boolean
  direction: 'BUILD' | 'UNWIND'
}
interface SpikeData {
  ts_new: string; ts_old: string; threshold: number
  total_spikes: number; spikes: Spike[]
}

export default function OISpikes() {
  const [data, setData] = useState<SpikeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [threshold, setThreshold] = useState(5)
  const [filter, setFilter] = useState<'all'|'BUILD'|'UNWIND'>('all')
  const [typeFilter, setTypeFilter] = useState<'all'|'CE'|'PE'>('all')
  const [lastUpdate, setLastUpdate] = useState('')
  const [autoEnabled, setAutoEnabled] = useState(false)
  const [countdown, setCountdown] = useState(300)
  const intervalRef = useRef<NodeJS.Timeout|null>(null)
  const countdownRef = useRef<NodeJS.Timeout|null>(null)
  const thresholdRef = useRef(5)

  useEffect(() => {
    try {
      const t = localStorage.getItem('gn_spike_threshold')
      if (t) { setThreshold(Number(t)); thresholdRef.current = Number(t) }
    } catch {}
  }, [])

  const fetchSpikes = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`https://greeknova-backend-production.up.railway.app/oi-spikes?threshold=${thresholdRef.current}`)
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
    localStorage.setItem('gn_spike_threshold', String(v))
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
    (filter === 'all' || s.direction === filter) &&
    (typeFilter === 'all' || s.option_type === typeFilter)
  ) || []

  const builds = data?.spikes.filter(s => s.direction === 'BUILD').length || 0
  const unwinds = data?.spikes.filter(s => s.direction === 'UNWIND').length || 0
  const mins = Math.floor(countdown/60)
  const secs = countdown % 60

  return (
    <div className="min-h-screen bg-[#07070e] text-white">
      <Navbar active="/spikes" />

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black tracking-tight mb-1">OI Spike Scanner</h1>
            <p className="text-gray-500 text-sm">Sudden OI buildups and unwinds · Compares last two snapshots</p>
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

        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Total Spikes</p>
            <p className="text-2xl font-black text-white">{data?.total_spikes || 0}</p>
            <p className="text-xs text-gray-600">above {threshold}% change</p>
          </div>
          <div className="bg-emerald-950/20 border border-emerald-800/40 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">OI Builds</p>
            <p className="text-2xl font-black text-emerald-400">{builds}</p>
            <p className="text-xs text-gray-600">fresh positions</p>
          </div>
          <div className="bg-red-950/20 border border-red-800/40 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">OI Unwinds</p>
            <p className="text-2xl font-black text-red-400">{unwinds}</p>
            <p className="text-xs text-gray-600">positions exited</p>
          </div>
          <div className="bg-amber-950/20 border border-amber-800/40 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Threshold</p>
            <div className="flex items-center gap-2 mt-1">
              <input type="range" min="2" max="30" value={threshold}
                onChange={e => handleThresholdChange(Number(e.target.value))}
                className="flex-1 accent-amber-400"/>
              <span className="text-lg font-black text-amber-400 min-w-[3rem] text-right">{threshold}%</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-4">
          {(['all','BUILD','UNWIND'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${filter===f ? 'bg-white text-gray-900 border-white' : 'bg-gray-900/40 text-gray-400 border-gray-800 hover:text-white'}`}>
              {f==='all'?'◈ All':f==='BUILD'?'↑ Builds':'↓ Unwinds'}
              <span className="ml-1.5 opacity-60">{f==='all'?data?.total_spikes:f==='BUILD'?builds:unwinds}</span>
            </button>
          ))}
          <div className="w-px h-5 bg-gray-800 mx-1"/>
          {(['all','CE','PE'] as const).map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${typeFilter===t ? 'bg-white text-gray-900 border-white' : 'bg-gray-900/40 text-gray-400 border-gray-800 hover:text-white'}`}>
              {t==='all'?'All':t}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-2">{[1,2,3,4,5].map(i=><div key={i} className="h-14 bg-gray-900/30 border border-gray-800 rounded-xl animate-pulse"/>)}</div>
        ) : filtered.length > 0 ? (
          <div className="rounded-2xl border border-gray-800 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-900/60 border-b border-gray-800">
                  {['Symbol','Strike','Type','Direction','Old OI','New OI','OI Change','OI %','Volume','LTP'].map((h,i)=>(
                    <th key={h} className={`text-xs font-semibold text-gray-500 px-4 py-3.5 ${i<=3?'text-left':'text-right'} ${i===0?'pl-5':''} ${i===9?'pr-5':''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((spike,i) => {
                  const isBuild = spike.direction==='BUILD'
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
                        <span className={`flex items-center gap-1 text-xs font-bold ${isBuild?'text-emerald-400':'text-red-400'}`}>
                          {isBuild?<TrendingUp size={12}/>:<TrendingDown size={12}/>}{spike.direction}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right text-sm text-gray-500">{spike.old_oi>=100000?(spike.old_oi/100000).toFixed(1)+'L':spike.old_oi.toLocaleString()}</td>
                      <td className="px-4 py-3.5 text-right text-sm text-gray-300">{spike.new_oi>=100000?(spike.new_oi/100000).toFixed(1)+'L':spike.new_oi.toLocaleString()}</td>
                      <td className={`px-4 py-3.5 text-right text-sm font-bold ${isBuild?'text-emerald-400':'text-red-400'}`}>{isBuild?'+':''}{spike.oi_change>=100000?(spike.oi_change/100000).toFixed(1)+'L':spike.oi_change.toLocaleString()}</td>
                      <td className="px-4 py-3.5 text-right">
                        <span className={`text-sm font-black flex items-center justify-end gap-1 ${isBuild?'text-emerald-400':'text-red-400'}`}>
                          <Zap size={11}/>{isBuild?'+':''}{spike.oi_pct}%
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right text-sm text-gray-400">{(spike.volume/100000).toFixed(1)}L</td>
                      <td className="px-5 py-3.5 text-right text-sm font-bold text-amber-400">₹{spike.last_price}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center border border-gray-800/50 rounded-2xl">
            <div className="text-5xl mb-4">📡</div>
            <h3 className="text-lg font-bold text-gray-400 mb-2">No spikes above {threshold}%</h3>
            <p className="text-sm text-gray-600">Try lowering the threshold or wait for next capture</p>
          </div>
        )}
      </div>
    </div>
  )
}
