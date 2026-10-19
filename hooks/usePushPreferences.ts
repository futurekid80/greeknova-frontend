'use client'
import { useEffect, useState, useCallback, useRef } from 'react'

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
  // Oct 16 2026 ("even 1 rupee option alert i get"): same ATM/±1/±2/±5/±10/
  // All vocabulary as StrikeZoneFilter elsewhere -- 'all' means no filter,
  // matching the push_subscriptions.strike_zone column default.
  const [strikeZone, setStrikeZone] = useState<string>('all')
  const [loading, setLoading] = useState(true)

  // BUG FIX (Oct 11 2026): AlertToggle can bundle several signal names into
  // one button (e.g. ['EMA_BULLISH_CROSS','EMA_BEARISH_CROSS'] for "9/21 EMA
  // Cross") and fires onToggle for each one in a synchronous forEach. Every
  // one of those calls closed over the SAME stale `enabledSignals` from when
  // the click started, so each built its "next" list from the pre-click
  // state -- the second call's save silently clobbered the first's. A ref
  // mirroring the latest value (updated synchronously, not just via
  // setState) lets toggleSignal always build "next" from what the previous
  // call in the same click just saved, so a multi-signal button actually
  // saves all of its signals, not just the last one.
  const enabledSignalsRef = useRef<string[] | null>(null)

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
          const loaded = prefs.enabled_signals || []
          enabledSignalsRef.current = loaded
          setEnabledSignals(loaded)
          if (prefs.spike_threshold != null) setSpikeThreshold(Number(prefs.spike_threshold))
          if (prefs.vol_threshold != null) setVolThreshold(Number(prefs.vol_threshold))
          if (prefs.strike_zone) setStrikeZone(String(prefs.strike_zone))
        }
      } catch (e) {
        console.error('Failed to load push preferences', e)
      }
      if (!cancelled) setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [])

  // BUG FIX (Oct 19 2026, "freshbuildup off but still getting the chrome
  // alert, persistent, reported by users"): the old save here was
  // fire-and-forget -- it updated enabledSignalsRef/enabledSignals (what
  // every page's toggle renders, since AlertsProvider is a single instance
  // mounted once in app/layout.tsx) BEFORE the POST even went out, and the
  // POST's result was never looked at. fetch() only throws on a network
  // failure, not on an HTTP error status, and /push-preferences'
  // save_preferences() returns {"error": ...} with a plain 200 on a
  // Supabase failure -- so a cold Railway dyno, a transient Supabase
  // blip, or a save racing the dead-subscription cleanup in
  // push_notifications._send_one() all left the UI showing "muted"
  // everywhere (same shared context, never re-checked against the server
  // except on a full reload) while the push_subscriptions row kept
  // whatever it had before -- FRESH_BUILD still enabled, still firing.
  // postSignals() now verifies the response (network error, non-2xx, or a
  // JSON {"error": ...} body all count as failure), retries once, and --
  // only if both attempts fail -- rolls the optimistic update back to the
  // last known-saved value, so the toggle never claims a mute that the
  // server doesn't actually have.
  const postSignals = useCallback(async (payload: Record<string, unknown>) => {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(`${API}/push-preferences`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = await res.json().catch(() => ({}))
        if (res.ok && !data.error) return true
        console.error('Failed to save push preference (server):', data.error || res.status)
      } catch (e) {
        console.error('Failed to save push preference (network):', e)
      }
      if (attempt === 0) await new Promise(r => setTimeout(r, 800))
    }
    return false
  }, [])

  const toggleSignal = useCallback(async (signal: string, on: boolean) => {
    const previous = enabledSignalsRef.current
    if (!endpoint || previous === null) return
    const next = on
      ? Array.from(new Set([...previous, signal]))
      : previous.filter(s => s !== signal)
    enabledSignalsRef.current = next
    setEnabledSignals(next)
    const ok = await postSignals({ endpoint, enabled_signals: next })
    if (!ok && enabledSignalsRef.current === next) {
      // Save never landed -- the device is still actually subscribed to
      // whatever `previous` says, so show that instead of a mute the
      // server never applied.
      enabledSignalsRef.current = previous
      setEnabledSignals(previous)
    }
  }, [endpoint, postSignals])

  // zone defaults to the current strikeZone when a caller doesn't pass one
  // (keeps the two existing 2-arg call sites working untouched).
  const saveThresholds = useCallback(async (oi: number, vol: number, zone?: string) => {
    const current = enabledSignalsRef.current
    if (!endpoint || current === null) return
    const nextZone = zone ?? strikeZone
    const prevThreshold = spikeThreshold
    const prevVol = volThreshold
    const prevZone = strikeZone
    setSpikeThreshold(oi)
    setVolThreshold(vol)
    setStrikeZone(nextZone)
    const ok = await postSignals({ endpoint, enabled_signals: current, spike_threshold: oi, vol_threshold: vol, strike_zone: nextZone })
    if (!ok) {
      setSpikeThreshold(prevThreshold)
      setVolThreshold(prevVol)
      setStrikeZone(prevZone)
    }
  }, [endpoint, strikeZone, spikeThreshold, volThreshold, postSignals])

  return { endpoint, enabledSignals, spikeThreshold, volThreshold, strikeZone, loading, toggleSignal, saveThresholds }
}
