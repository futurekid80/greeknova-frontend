'use client'
import Navbar from '@/components/Navbar'
import { useEffect, useState, useRef, useCallback } from 'react'
import { Bell, BellOff, RefreshCw, Trash2, Clock, Search, X, ExternalLink } from 'lucide-react'

function isMarketOpen() {
  const now = new Date()
  const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
  const day = ist.getDay()
  if (day === 0 || day === 6) return false
  const h = ist.getHours(), m = ist.getMinutes()
  const total = h * 60 + m
  return total >= 555 && total <= 930
}

function playTerminalBeep(ctx: AudioContext) {
  const now = ctx.currentTime
  const osc1 = ctx.createOscillator()
  const gain1 = ctx.createGain()
  osc1.type = 'sine'
  osc1.frequency.setValueAtTime(880, now)
  gain1.gain.setValueAtTime(0, now)
  gain1.gain.linearRampToValueAtTime(0.35, now + 0.01)
  gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.42)
  osc1.connect(gain1); gain1.connect(ctx.destination)
  osc1.start(now); osc1.stop(now + 0.42)

  const osc2 = ctx.createOscillator()
  const gain2 = ctx.createGain()
  osc2.type = 'sine'
  osc2.frequency.setValueAtTime(1108, now)
  gain2.gain.setValueAtTime(0, now)
  gain2.gain.linearRampToValueAtTime(0.18, now + 0.015)
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35)
  osc2.connect(gain2); gain2.connect(ctx.destination)
  osc2.start(now + 0.01); osc2.stop(now + 0.35)
}

const SIGNAL_META: Record<string, { color: string; bg: string; border: string; icon: string; label: string }> = {
  OI_SPIKE:       { color: 'text-orange-400', bg: 'bg-orange-950/40', border: 'border-orange-800/50', icon: '🔥', label: 'OI Spike' },
  FRESH_BUILD:    { color: 'text-emerald-400',bg: 'bg-emerald-950/40',border: 'border-emerald-800/50',icon: '🌱', label: 'Fresh Build' },
  LONG_BUILDUP:   { color: 'text-emerald-400',bg: 'bg-emerald-950/40',border: 'border-emerald-800/50',icon: '🐂', label: 'Long Buildup' },
  SHORT_BUILDUP:  { color: 'text-red-400',    bg: 'bg-red-950/40',    border: 'border-red-800/50',    icon: '🐻', label: 'Short Buildup' },
  CALL_WRITING:   { color: 'text-red-400',    bg: 'bg-red-950/40',    border: 'border-red-800/50',    icon: '✍️', label: 'Call Writing' },
  PUT_WRITING:    { color: 'text-emerald-400',bg: 'bg-emerald-950/40',border: 'border-emerald-800/50',icon: '✍️', label: 'Put Writing' },
  SHORT_COVERING: { color: 'text-cyan-400',   bg: 'bg-cyan-950/40',   border: 'border-cyan-800/50',   icon: '🔄', label: 'Short Covering' },
  LONG_UNWINDING: { color: 'text-amber-400',  bg: 'bg-amber-950/40',  border: 'border-amber-800/50',  icon: '⚠️', label: 'Long Unwinding' },
  VOLUME_SURGE:   { color: 'text-blue-400',   bg: 'bg-blue-950/40',   border: 'border-blue-800/50',   icon: '⚡', label: 'Volume Surge' },
}

const DEFAULT_META = { color: 'text-gray-400', bg: 'bg-gray-900/40', border: 'border-gray-800', icon: '🔔', label: 'Alert' }

interface Alert {
  id: number; signal: string; symbol: string; strike?: number
  optionType?: string; message: string; url: string
  receivedAt: string; score?: number; bias?: string
  oiPct?: number; volPct?: number; ltp?: number; direction?: string
}

export default function Alerts() {
  const [enabled, setEnabled]         = useState(false)
  const [permission, setPermission]   = useState('default')
  const [swReady, setSwReady]         = useState(false)
  const [spikeThreshold, setSpikeThreshold] = useState(10)
  const [lastCheck, setLastCheck]     = useState('')
  const [alerts, setAlerts]           = useState<Alert[]>([])
  const [marketOpen, setMarketOpen]   = useState(false)
  const [search, setSearch]           = useState('')
  const [typeFilter, setTypeFilter]   = useState('all')
  const [sortOrder, setSortOrder]     = useState<'newest'|'oldest'>('newest')
  const audioCtxRef = useRef<AudioContext | null>(null)

  const getAudioCtx = useCallback((): AudioContext => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
    if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume()
    return audioCtxRef.current
  }, [])

  const playSound = useCallback(() => {
    try { playTerminalBeep(getAudioCtx()) } catch (e) {}
  }, [getAudioCtx])

  // Load saved alerts
  useEffect(() => {
    try {
      const saved = localStorage.getItem('gn_alerts')
      if (saved) setAlerts(JSON.parse(saved))
    } catch {}
    setSpikeThreshold(Number(localStorage.getItem('gn_spike_threshold') || 10))
    setMarketOpen(isMarketOpen())
    const t = setInterval(() => setMarketOpen(isMarketOpen()), 30000)
    return () => clearInterval(t)
  }, [])

  // Register SW + listen for new alerts
  useEffect(() => {
    if ('Notification' in window) setPermission(Notification.permission)

    if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').then(async reg => {
    // Wait for SW to be fully active before sending messages
    if (reg.installing) {
      await new Promise<void>(resolve => {
        reg.installing!.addEventListener('statechange', function() {
          if (this.state === 'activated') resolve()
        })
      })
    }
    // Use ready to guarantee active SW
    const activeReg = await navigator.serviceWorker.ready
    setSwReady(true)

    const wasEnabled = localStorage.getItem('gn_alerts_enabled') === 'true'
    const threshold  = Number(localStorage.getItem('gn_spike_threshold') || 10)
    if (wasEnabled && Notification.permission === 'granted') {
      setEnabled(true)
      activeReg.active?.postMessage({ type: 'ENABLE', data: { spikeThreshold: threshold } })
    }
  }).catch(e => console.error('SW registration failed:', e))

      navigator.serviceWorker.addEventListener('message', (e) => {
        if (e.data.type === 'STATUS') setEnabled(e.data.enabled)

        // ── Handle new alerts broadcast from SW ───────────────────────────
        if (e.data.type === 'NEW_ALERT') {
          const newAlert: Alert = {
            id:         e.data.id || Date.now(),
            signal:     e.data.signal,
            symbol:     e.data.symbol,
            strike:     e.data.strike,
            optionType: e.data.optionType,
            message:    e.data.message,
            url:        e.data.url || '/jungle',
            receivedAt: e.data.receivedAt || new Date().toLocaleTimeString('en-IN'),
            score:      e.data.score,
            bias:       e.data.bias,
            oiPct:      e.data.oiPct,
            volPct:     e.data.volPct,
            ltp:        e.data.ltp,
            direction:  e.data.direction,
          }

          setAlerts(prev => {
            // Dedup by id
            if (prev.find(a => a.id === newAlert.id)) return prev
            const updated = [newAlert, ...prev].slice(0, 100)
            try { localStorage.setItem('gn_alerts', JSON.stringify(updated)) } catch {}
            return updated
          })

          setLastCheck(new Date().toLocaleTimeString('en-IN'))
        }

        if (e.data.type === 'PLAY_SOUND') {
          if (isMarketOpen()) playSound()
        }
      })
    }
  }, [playSound])

  async function enableAlerts() {
    getAudioCtx()
    const result = await Notification.requestPermission()
    setPermission(result)
    if (result !== 'granted') return
    localStorage.setItem('gn_alerts_enabled', 'true')
    localStorage.setItem('gn_spike_threshold', String(spikeThreshold))
    setEnabled(true)
    const reg = await navigator.serviceWorker.ready
    reg.active?.postMessage({ type: 'ENABLE', data: { spikeThreshold } })
  }

  async function disableAlerts() {
    localStorage.setItem('gn_alerts_enabled', 'false')
    setEnabled(false)
    const reg = await navigator.serviceWorker.ready
    reg.active?.postMessage({ type: 'DISABLE' })
  }

  async function checkNow() {
    const reg = await navigator.serviceWorker.ready
    reg.active?.postMessage({ type: 'CHECK_NOW' })
    setLastCheck(new Date().toLocaleTimeString('en-IN'))
  }

  function clearAlerts() {
    setAlerts([])
    try { localStorage.removeItem('gn_alerts') } catch {}
  }

  // ── Filter + sort ─────────────────────────────────────────────────────────
  const uniqueSymbols = [...new Set(alerts.map(a => a.symbol))].sort()
  const uniqueTypes   = [...new Set(alerts.map(a => a.signal))]

  const filtered = alerts
    .filter(a => {
      if (search) {
        const s = search.toUpperCase()
        return a.symbol?.includes(s) || a.signal?.includes(s)
      }
      return true
    })
    .filter(a => typeFilter === 'all' || a.signal === typeFilter)
    .sort((a, b) => sortOrder === 'newest' ? b.id - a.id : a.id - b.id)

  const statusText = () => {
    if (!swReady) return 'Loading service worker...'
    if (permission === 'denied') return '⚠️ Notifications blocked — enable in browser settings'
    if (!enabled) return 'Click Enable to start background monitoring'
    if (!marketOpen) return '⏸️ Active — market closed, checks auto-resume at 9:15 AM IST'
    return '✅ Running — self-scheduling every 5 min, works across all tabs'
  }

  const mins = Math.floor(spikeThreshold)

  return (
    <div className="min-h-screen bg-[#07070e] text-white">
      <Navbar active="/alerts" />

      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="text-3xl font-black tracking-tight mb-1">🔔 Signal Alerts</h1>
            <p className="text-gray-500 text-sm">Background monitoring · Works across all tabs · Self-scheduling service worker</p>
          </div>
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border ${marketOpen ? 'bg-emerald-950/30 border-emerald-800/50 text-emerald-400' : 'bg-gray-900 border-gray-800 text-gray-500'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${marketOpen ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`} />
              {marketOpen ? 'Market Open' : 'Market Closed'}
            </div>
            {lastCheck && (
              <div className="flex items-center gap-1.5 text-xs text-gray-600 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2">
                <Clock size={11} />Last: {lastCheck}
              </div>
            )}
            {enabled && (
              <button onClick={checkNow}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-lg px-3 py-2 transition-all">
                <RefreshCw size={11} />Check Now
              </button>
            )}
          </div>
        </div>

        {/* Alert Engine */}
        <div className="bg-gray-900/30 border border-gray-800 rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-bold text-white mb-1">Alert Engine</h2>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${enabled && marketOpen ? 'bg-emerald-400 animate-pulse' : enabled ? 'bg-amber-400' : 'bg-gray-600'}`} />
                <p className="text-sm text-gray-500">{statusText()}</p>
              </div>
            </div>
            <button onClick={enabled ? disableAlerts : enableAlerts}
              disabled={!swReady || permission === 'denied'}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all ${
                enabled
                  ? 'bg-red-950/60 text-red-400 border border-red-800/60 hover:bg-red-950'
                  : !swReady || permission === 'denied'
                  ? 'bg-gray-800 text-gray-600 border border-gray-700 cursor-not-allowed'
                  : 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 hover:bg-emerald-950'
              }`}>
              {enabled ? <><BellOff size={16} />Disable</> : <><Bell size={16} />Enable Alerts</>}
            </button>
          </div>

          {/* What gets monitored */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="bg-orange-950/20 rounded-xl p-4 border border-orange-800/30">
              <p className="text-xs text-gray-500 mb-1">🔥 OI Spikes</p>
              <p className="text-sm text-gray-300">OI changes &gt;{spikeThreshold}% in 5 mins — Options Jungle</p>
            </div>
            <div className="bg-emerald-950/20 rounded-xl p-4 border border-emerald-800/30">
              <p className="text-xs text-gray-500 mb-1">🌱 Fresh Builds</p>
              <p className="text-sm text-gray-300">Volume spike + OI building simultaneously</p>
            </div>
            <div className="bg-blue-950/20 rounded-xl p-4 border border-blue-800/30">
              <p className="text-xs text-gray-500 mb-1">🐋 UOA Whales</p>
              <p className="text-sm text-gray-300">High conviction signals (score 4+) from UOA scanner</p>
            </div>
          </div>

          {/* Threshold + sound preview */}
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-xs text-gray-500">OI spike threshold:</span>
            <input type="range" min="2" max="30" value={spikeThreshold}
              onChange={e => {
                const v = Number(e.target.value)
                setSpikeThreshold(v)
                localStorage.setItem('gn_spike_threshold', String(v))
                navigator.serviceWorker.ready.then(reg => {
                  reg.active?.postMessage({ type: 'UPDATE_THRESHOLD', data: { spikeThreshold: v } })
                })
              }}
              className="w-32 accent-orange-400" />
            <span className="text-sm font-black text-orange-400">{spikeThreshold}%</span>
            <button onClick={() => { getAudioCtx(); playSound() }}
              className="text-xs text-gray-500 hover:text-white border border-gray-700 hover:border-gray-600 px-3 py-1.5 rounded-lg transition-all ml-2">
              🔔 Preview Sound
            </button>
            {permission === 'denied' && (
              <span className="text-xs text-red-400 ml-2">⚠️ Notifications blocked in browser — go to browser settings to allow</span>
            )}
          </div>
        </div>

        {/* Alert Feed header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            Alert Feed
            {alerts.length > 0 && (
              <span className="text-sm font-normal text-gray-500">({filtered.length} of {alerts.length})</span>
            )}
          </h2>
          {alerts.length > 0 && (
            <button onClick={clearAlerts}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-400 transition-colors">
              <Trash2 size={12} />Clear all
            </button>
          )}
        </div>

        {/* Search + filters */}
        {alerts.length > 0 && (
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            {/* Search */}
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"/>
              <input
                value={search}
                onChange={e => setSearch(e.target.value.toUpperCase())}
                placeholder="Search symbol..."
                className="bg-gray-900 border border-gray-700 text-white text-xs rounded-lg pl-8 pr-8 py-2 focus:outline-none focus:border-emerald-500 w-40"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                  <X size={11}/>
                </button>
              )}
            </div>

            {/* Type filter */}
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
              className="bg-gray-900 border border-gray-700 text-white text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500">
              <option value="all">All Types</option>
              {uniqueTypes.map(t => (
                <option key={t} value={t}>{(SIGNAL_META[t] || DEFAULT_META).label}</option>
              ))}
            </select>

            {/* Sort */}
            <button onClick={() => setSortOrder(s => s === 'newest' ? 'oldest' : 'newest')}
              className="text-xs bg-gray-900 border border-gray-700 text-gray-400 hover:text-white px-3 py-2 rounded-lg transition-all">
              {sortOrder === 'newest' ? '↓ Newest first' : '↑ Oldest first'}
            </button>

            {/* Quick symbol filters */}
            {uniqueSymbols.slice(0, 5).map(sym => (
              <button key={sym} onClick={() => setSearch(search === sym ? '' : sym)}
                className={`text-xs px-2.5 py-1.5 rounded-lg border transition-all ${search === sym ? 'bg-white text-gray-900 border-white' : 'bg-gray-900 border-gray-700 text-gray-400 hover:text-white'}`}>
                {sym}
              </button>
            ))}
          </div>
        )}

        {/* Alert feed */}
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center border border-gray-800/50 rounded-2xl bg-gray-900/20">
            <div className="text-4xl mb-4">🔔</div>
            <h3 className="text-lg font-bold text-gray-400 mb-2">
              {enabled ? 'Monitoring in background' : 'Alerts disabled'}
            </h3>
            <p className="text-sm text-gray-600 max-w-sm">
              {enabled
                ? marketOpen
                  ? 'Service worker is running across all tabs. Alerts will appear here and as browser notifications.'
                  : 'Market is closed. Checks will auto-resume at 9:15 AM IST on next trading day.'
                : 'Enable alerts to start monitoring OI spikes, fresh builds and UOA whale activity.'}
            </p>
            {enabled && marketOpen && (
              <div className="mt-4 flex items-center gap-2 text-xs text-emerald-500">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Self-scheduling every 5 minutes · Works across all tabs
              </div>
            )}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center border border-gray-800/50 rounded-2xl">
            <p className="text-gray-500 text-sm">No alerts match current filters</p>
            <button onClick={() => { setSearch(''); setTypeFilter('all') }}
              className="mt-3 text-xs text-emerald-400 hover:text-emerald-300">
              Clear filters
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(alert => {
              const m = SIGNAL_META[alert.signal] || DEFAULT_META
              return (
                <div key={alert.id}
                  className={`flex items-start justify-between p-4 rounded-xl border transition-all hover:brightness-110 ${m.bg} ${m.border}`}>
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    {/* Icon */}
                    <div className="w-10 h-10 rounded-lg bg-gray-900/50 flex items-center justify-center text-lg flex-shrink-0">
                      {m.icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-base font-black text-white">{alert.symbol}</span>
                        {alert.strike && (
                          <span className="text-sm font-bold text-amber-400">{alert.strike}</span>
                        )}
                        {alert.optionType && (
                          <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${alert.optionType === 'CE' ? 'bg-red-950/50 text-red-400' : 'bg-emerald-950/50 text-emerald-400'}`}>
                            {alert.optionType}
                          </span>
                        )}
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-lg border ${m.color} ${m.bg} ${m.border}`}>
                          {m.label}
                        </span>
                        {alert.score && (
                          <span className="text-xs text-orange-400 font-bold">{alert.score}/5</span>
                        )}
                        {alert.bias && (
                          <span className={`text-xs font-semibold ${alert.bias === 'BULLISH' ? 'text-emerald-400' : 'text-red-400'}`}>
                            {alert.bias === 'BULLISH' ? '↑' : '↓'} {alert.bias}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 leading-relaxed">{alert.message}</p>
                    </div>
                  </div>

                  {/* Right side */}
                  <div className="text-right flex-shrink-0 ml-4">
                    <p className="text-xs text-gray-500 mb-1">{alert.receivedAt}</p>
                    <a href={alert.url}
                      className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition-colors justify-end">
                      View <ExternalLink size={10}/>
                    </a>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* SEBI disclaimer */}
        <div className="mt-8 bg-gray-900/20 border border-gray-800/40 rounded-xl p-4">
          <p className="text-xs text-gray-600">
            <span className="text-gray-400 font-semibold">Disclaimer:</span> Alerts are based on observed options activity patterns. Not investment advice. GreekNova is not SEBI-registered.
          </p>
        </div>
      </div>
    </div>
  )
}
