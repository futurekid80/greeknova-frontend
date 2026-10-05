'use client'
import { useEffect, useState, useCallback } from 'react'

const API = 'https://api.greeknova.com'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export function usePushPreferences() {
  const [endpoint, setEndpoint] = useState<string | null>(null)
  const [enabledSignals, setEnabledSignals] = useState<string[] | null>(null)
  const [spikeThreshold, setSpikeThreshold] = useState<number>(10)
  const [volThreshold, setVolThreshold] = useState<number>(20)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!('serviceWorker' in navigator)) { setLoading(false); return }
      try {
        const reg = await navigator.serviceWorker.ready
        let sub = await reg.pushManager.getSubscription()

        // BUG FIX (Oct 5 2026): this used to just give up here if no
        // subscription existed, hiding the entire per-signal mute row (OI
        // Spikes / Call Writing / Put Writing / etc. in AlertToggle) with no
        // explanation -- the OI/Vol threshold box isn't gated the same way,
        // so it kept showing, which is exactly what made this look like the
        // mute buttons had vanished. A push subscription can go missing
        // after a service-worker update, the browser clearing site data, or
        // just switching devices, even though the user already granted
        // notification permission once. Mirror AlertsContext.enableAlerts'
        // re-subscribe logic: if permission is already granted but the
        // subscription is gone, recreate it silently instead of bailing.
        if (!sub && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          try {
            const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
            if (vapidKey && 'PushManager' in window) {
              sub = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(vapidKey),
              })
              await fetch(`${API}/push-subscribe`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subscription: sub.toJSON() }),
              })
            }
          } catch (e) {
            console.error('[Push] Re-subscribe failed:', e)
          }
        }

        if (!sub || cancelled) { setLoading(false); return }

        setEndpoint(sub.endpoint)
        const res = await fetch(`${API}/push-preferences?endpoint=${encodeURIComponent(sub.endpoint)}`)
        const prefs = await res.json()
        if (cancelled) return
        if (!prefs.error) {
          setEnabledSignals(prefs.enabled_signals || [])
          if (prefs.spike_threshold != null) setSpikeThreshold(Number(prefs.spike_threshold))
          if (prefs.vol_threshold != null) setVolThreshold(Number(prefs.vol_threshold))
        }
      } catch (e) {
        console.error('Failed to load push preferences', e)
      }
      if (!cancelled) setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [])

  const toggleSignal = useCallback(async (signal: string, on: boolean) => {
    if (!endpoint || enabledSignals === null) return
    const next = on
      ? Array.from(new Set([...enabledSignals, signal]))
      : enabledSignals.filter(s => s !== signal)
    setEnabledSignals(next)
    try {
      await fetch(`${API}/push-preferences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint, enabled_signals: next }),
      })
    } catch (e) {
      console.error('Failed to save alert preference', e)
    }
  }, [endpoint, enabledSignals])

  const saveThresholds = useCallback(async (oi: number, vol: number) => {
    if (!endpoint || enabledSignals === null) return
    setSpikeThreshold(oi)
    setVolThreshold(vol)
    try {
      await fetch(`${API}/push-preferences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint, enabled_signals: enabledSignals, spike_threshold: oi, vol_threshold: vol }),
      })
    } catch (e) {
      console.error('Failed to save thresholds', e)
    }
  }, [endpoint, enabledSignals])

  return { endpoint, enabledSignals, spikeThreshold, volThreshold, loading, toggleSignal, saveThresholds }
}
