'use client'
import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react'

export interface Alert {
  id: number; signal: string; symbol: string; strike?: number
  optionType?: string; message: string; url: string
  receivedAt: string; score?: number; bias?: string
  oiPct?: number; volPct?: number; ltp?: number; direction?: string
}

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

interface AlertsContextValue {
  alerts: Alert[]
  enabled: boolean
  permission: string
  swReady: boolean
  marketOpen: boolean
  lastCheck: string
  unreadCount: number
  spikeThreshold: number
  setSpikeThreshold: (v: number) => void
  enableAlerts: () => Promise<void>
  disableAlerts: () => Promise<void>
  checkNow: () => Promise<void>
  clearAlerts: () => void
  markAllRead: () => void
  playSound: () => void
}

const AlertsContext = createContext<AlertsContextValue | null>(null)

export function AlertsProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabled]         = useState(false)
  const [permission, setPermission]   = useState('default')
  const [swReady, setSwReady]         = useState(false)
  const [spikeThreshold, setSpikeThresholdState] = useState(10)
  const [lastCheck, setLastCheck]     = useState('')
  const [alerts, setAlerts]           = useState<Alert[]>([])
  const [marketOpen, setMarketOpen]   = useState(false)
  const [lastSeenId, setLastSeenId]   = useState(0)
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

  useEffect(() => {
    try {
      const saved = localStorage.getItem('gn_alerts')
      if (saved) setAlerts(JSON.parse(saved))
      const seen = localStorage.getItem('gn_alerts_last_seen')
      if (seen) setLastSeenId(Number(seen))
    } catch {}
    setSpikeThresholdState(Number(localStorage.getItem('gn_spike_threshold') || 10))
    setMarketOpen(isMarketOpen())
    const t = setInterval(() => setMarketOpen(isMarketOpen()), 30000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if ('Notification' in window) setPermission(Notification.permission)

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(async () => {
        setSwReady(true)
        const wasEnabled = localStorage.getItem('gn_alerts_enabled') === 'true'
        const threshold  = Number(localStorage.getItem('gn_spike_threshold') || 10)
        if (wasEnabled && Notification.permission === 'granted') {
          setEnabled(true)
          navigator.serviceWorker.ready.then(reg => {
            reg.active?.postMessage({ type: 'ENABLE', data: { spikeThreshold: threshold } })
          })
        }
      }).catch(() => {})

      const handler = (e: MessageEvent) => {
        if (e.data.type === 'STATUS') setEnabled(e.data.enabled)

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
      }

      navigator.serviceWorker.addEventListener('message', handler)

      // Service workers get suspended by the browser after idling, which kills
      // any setTimeout-based self-scheduling loop running inside them — that's
      // what causes alerts to appear "stuck" then arrive in a sudden batch once
      // the app is reopened. A foreground page timer is much more reliable, so
      // as long as any tab is open, nudge the worker to check every 2 minutes
      // instead of relying solely on its own internal timer.
      const heartbeat = setInterval(() => {
        const wasEnabled = localStorage.getItem('gn_alerts_enabled') === 'true'
        if (wasEnabled) {
          navigator.serviceWorker.ready.then(reg => {
            reg.active?.postMessage({ type: 'CHECK_NOW' })
          }).catch(() => {})
        }
      }, 2 * 60 * 1000)

      return () => {
        navigator.serviceWorker.removeEventListener('message', handler)
        clearInterval(heartbeat)
      }
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

  function markAllRead() {
    const maxId = alerts.reduce((m, a) => Math.max(m, a.id), 0)
    setLastSeenId(maxId)
    try { localStorage.setItem('gn_alerts_last_seen', String(maxId)) } catch {}
  }

  function setSpikeThreshold(v: number) {
    setSpikeThresholdState(v)
    localStorage.setItem('gn_spike_threshold', String(v))
    navigator.serviceWorker?.ready.then(reg => {
      reg.active?.postMessage({ type: 'UPDATE_THRESHOLD', data: { spikeThreshold: v } })
    })
  }

  const unreadCount = alerts.filter(a => a.id > lastSeenId).length

  return (
    <AlertsContext.Provider value={{
      alerts, enabled, permission, swReady, marketOpen, lastCheck, unreadCount,
      spikeThreshold, setSpikeThreshold,
      enableAlerts, disableAlerts, checkNow, clearAlerts, markAllRead, playSound,
    }}>
      {children}
    </AlertsContext.Provider>
  )
}

export function useAlerts() {
  const ctx = useContext(AlertsContext)
  if (!ctx) throw new Error('useAlerts must be used within AlertsProvider')
  return ctx
}
