'use client'
import Navbar from '@/components/Navbar'
import { useEffect, useState } from 'react'
import { Bell, BellOff, RefreshCw, Trash2, Clock } from 'lucide-react'

export default function Alerts() {
  const [enabled, setEnabled] = useState(false)
  const [permission, setPermission] = useState('default')
  const [swReady, setSwReady] = useState(false)
  const [spikeThreshold, setSpikeThreshold] = useState(10)
  const [lastCheck, setLastCheck] = useState('')
  const [alerts, setAlerts] = useState<any[]>([])

  useEffect(() => {
    const saved = localStorage.getItem('gn_alerts')
    if (saved) setAlerts(JSON.parse(saved))
  }, [])

  useEffect(() => {
    if ('Notification' in window) setPermission(Notification.permission)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then(reg => {
        setSwReady(true)
        const wasEnabled = localStorage.getItem('gn_alerts_enabled') === 'true'
        if (wasEnabled && Notification.permission === 'granted') {
          setEnabled(true)
          reg.active?.postMessage({ type: 'ENABLE', data: { spikeThreshold: Number(localStorage.getItem('gn_spike_threshold') || 10) } })
        }
      }).catch(e => console.error('SW registration failed:', e))

      navigator.serviceWorker.addEventListener('message', (e) => {
        if (e.data.type === 'STATUS') setEnabled(e.data.enabled)
      })
    }

    // Listen for notifications via BroadcastChannel
    const bc = new BroadcastChannel('gn_alerts')
    bc.onmessage = (e) => {
      setAlerts(prev => {
        const updated = [{ ...e.data, id: Date.now(), receivedAt: new Date().toLocaleTimeString('en-IN') }, ...prev].slice(0, 50)
        localStorage.setItem('gn_alerts', JSON.stringify(updated))
        return updated
      })
      setLastCheck(new Date().toLocaleTimeString('en-IN'))
    }
    return () => bc.close()
  }, [])


  // Play sound using Web Audio API
  function playAlertSound(type: string = 'spike') {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const oscillator = ctx.createOscillator()
      const gainNode = ctx.createGain()
      oscillator.connect(gainNode)
      gainNode.connect(ctx.destination)
      oscillator.frequency.setValueAtTime(type === 'spike' ? 880 : 660, ctx.currentTime)
      oscillator.frequency.setValueAtTime(type === 'spike' ? 1100 : 880, ctx.currentTime + 0.1)
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
      oscillator.start(ctx.currentTime)
      oscillator.stop(ctx.currentTime + 0.3)
    } catch(e) { console.error('Sound failed:', e) }
  }

  // Keep service worker alive with periodic ping + trigger checks
  useEffect(() => {
    if (!enabled) return
    const keepAlive = setInterval(async () => {
      try {
        // Ping SW to keep it alive
        await fetch('/sw-keepalive')
        // Tell SW to run checks
        const reg = await navigator.serviceWorker.ready
        reg.active?.postMessage({ type: 'CHECK_NOW', data: {} })
      } catch(e) {}
    }, 4 * 60 * 1000) // Every 4 minutes (before 30s SW timeout)
    
    // Listen for sound requests from SW
    const handleSWMessage = (e: MessageEvent) => {
      if (e.data.type === 'PLAY_SOUND') playAlertSound(e.data.alert)
    }
    navigator.serviceWorker.addEventListener('message', handleSWMessage)
    
    return () => {
      clearInterval(keepAlive)
      navigator.serviceWorker.removeEventListener('message', handleSWMessage)
    }
  }, [enabled])

  async function enableAlerts() {
    const result = await Notification.requestPermission()
    setPermission(result)
    if (result !== 'granted') return
    localStorage.setItem('gn_alerts_enabled', 'true')
    localStorage.setItem('gn_spike_threshold', String(spikeThreshold))
    setEnabled(true)
  }

  function disableAlerts() {
    localStorage.setItem('gn_alerts_enabled', 'false')
    setEnabled(false)
  }

  const SIGNAL_META: Record<string, { color: string; bg: string; border: string; icon: string }> = {
    PUT_WRITING:  { color: 'text-emerald-400', bg: 'bg-emerald-950/50', border: 'border-emerald-800/50', icon: '↑' },
    CALL_WRITING: { color: 'text-red-400',     bg: 'bg-red-950/50',     border: 'border-red-800/50',     icon: '↓' },
    SQUEEZE:      { color: 'text-amber-400',   bg: 'bg-amber-950/50',   border: 'border-amber-800/50',   icon: '⚡' },
    BATTLEGROUND: { color: 'text-violet-400',  bg: 'bg-violet-950/50',  border: 'border-violet-800/50',  icon: '⚔️' },
    OI_SPIKE:     { color: 'text-orange-400',  bg: 'bg-orange-950/50',  border: 'border-orange-800/50',  icon: '🔥' },
    VOL_SPIKE:    { color: 'text-blue-400',    bg: 'bg-blue-950/50',    border: 'border-blue-800/50',    icon: '📊' },
  }

  return (
    <div className="min-h-screen bg-[#07070e] text-white">
      <Navbar active="/alerts" />

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black tracking-tight mb-1">Signal Alerts</h1>
            <p className="text-gray-500 text-sm">Background monitoring · Works even when you switch tabs · Service Worker powered</p>
          </div>
          {lastCheck && (
            <div className="flex items-center gap-1.5 text-xs text-gray-600 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2">
              <Clock size={11}/>Last: {lastCheck}
            </div>
          )}
        </div>

        <div className="bg-gray-900/30 border border-gray-800 rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-bold text-white mb-1">Alert Engine</h2>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${enabled ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`}/>
                <p className="text-sm text-gray-500">
                  {!swReady ? 'Loading service worker...'
                    : permission === 'denied' ? '⚠️ Notifications blocked in browser settings'
                    : enabled ? '✅ Running in background — works even when you switch tabs'
                    : 'Click Enable to start background monitoring'}
                </p>
              </div>
            </div>
            <button onClick={enabled ? disableAlerts : enableAlerts}
              disabled={!swReady || permission === 'denied'}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all ${
                enabled ? 'bg-red-950/60 text-red-400 border border-red-800/60 hover:bg-red-950'
                  : !swReady || permission === 'denied' ? 'bg-gray-800 text-gray-600 border border-gray-700 cursor-not-allowed'
                  : 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 hover:bg-emerald-950'}`}>
              {enabled ? <><BellOff size={16}/>Disable</> : <><Bell size={16}/>Enable Alerts</>}
            </button>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gray-800/40 rounded-xl p-4 border border-gray-700/40">
              <p className="text-xs text-gray-500 mb-1">📊 Scanner Signal Changes</p>
              <p className="text-sm text-gray-300">Fires when any stock changes signal — e.g. RELIANCE shifts to Call Writing</p>
            </div>
            <div className="bg-orange-950/20 rounded-xl p-4 border border-orange-800/30">
              <p className="text-xs text-gray-500 mb-1">🔥 OI Spike Alerts</p>
              <p className="text-sm text-gray-300">Fires when OI changes by more than {spikeThreshold}% in 5 minutes</p>
            </div>
            <div className="bg-blue-950/20 rounded-xl p-4 border border-blue-800/30">
              <p className="text-xs text-gray-500 mb-1">📊 Volume Fresh Build</p>
              <p className="text-sm text-gray-300">Fires when volume spikes AND OI builds simultaneously</p>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <span className="text-xs text-gray-500">Spike threshold:</span>
            <input type="range" min="2" max="30" value={spikeThreshold}
              onChange={e => {
                setSpikeThreshold(Number(e.target.value))
                localStorage.setItem('gn_spike_threshold', e.target.value)
                navigator.serviceWorker.ready.then(reg => {
                  reg.active?.postMessage({ type: 'UPDATE_THRESHOLD', data: { spikeThreshold: Number(e.target.value) } })
                })
              }}
              className="w-32 accent-orange-400"/>
            <span className="text-sm font-black text-orange-400">{spikeThreshold}%</span>
          </div>
        </div>

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">
            Alert Feed {alerts.length > 0 && <span className="text-sm font-normal text-gray-500 ml-2">({alerts.length})</span>}
          </h2>
          {alerts.length > 0 && (
            <button onClick={() => { setAlerts([]); localStorage.removeItem('gn_alerts') }}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-400 transition-colors">
              <Trash2 size={12}/>Clear all
            </button>
          )}
        </div>

        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center border border-gray-800/50 rounded-2xl bg-gray-900/20">
            <div className="text-4xl mb-4">🔔</div>
            <h3 className="text-lg font-bold text-gray-400 mb-2">{enabled ? 'Monitoring in background' : 'Alerts disabled'}</h3>
            <p className="text-sm text-gray-600 max-w-sm">
              {enabled ? 'Service worker is running. Alerts will appear here and as browser notifications even when you switch tabs.'
                : 'Enable alerts to start background monitoring across all signals.'}
            </p>
            {enabled && <div className="mt-4 flex items-center gap-2 text-xs text-emerald-500"><div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"/>Checking every 5 minutes in background</div>}
          </div>
        ) : (
          <div className="space-y-2">
            {alerts.map(alert => {
              const m = SIGNAL_META[alert.signal] || SIGNAL_META.SQUEEZE
              return (
                <div key={alert.id} className={`flex items-center justify-between p-4 rounded-xl border ${m.bg} ${m.border}`}>
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-gray-900/50 flex items-center justify-center text-lg">{m.icon}</div>
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-base font-black text-white">{alert.symbol}</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-lg border ${m.color} ${m.bg} ${m.border}`}>{alert.signal?.replace('_', ' ')}</span>
                      </div>
                      <p className="text-xs text-gray-500">{alert.message || `Signal detected at ${alert.receivedAt}`}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">{alert.receivedAt}</p>
                    <a href={alert.url || '/scanners'} className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors">View →</a>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
