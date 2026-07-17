'use client'
import { useEffect, useState, useCallback } from 'react'

const API = 'https://greeknova-backend-production.up.railway.app'

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
        const sub = await reg.pushManager.getSubscription()
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
