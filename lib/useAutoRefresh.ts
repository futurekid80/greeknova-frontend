'use client'
import { useEffect, useRef, useState, useCallback } from 'react'

const STORAGE_KEY = 'greeknova_auto_refresh'

// Nov 14 2026: the old version trusted setInterval. Browsers slow or freeze timers in background tabs and
// when a phone sleeps, so a tab you came back to could sit on old data (and a frozen countdown) until the
// next timer happened to fire. This version keeps one 1-second timer that works out the time left from the
// real clock, and re-checks the moment the tab becomes visible, regains focus, comes back from the
// back/forward cache, or the network returns. If a refresh is already due, it runs right away.
export function useAutoRefresh(
  callback: () => void,
  intervalMs: number = 5 * 60 * 1000,
  autoStart: boolean = false
) {
  // Always start from the same value on server and client to avoid a
  // hydration mismatch (reading localStorage here made SSR say "off" and
  // the client's very first paint say "on", which crashed hydration for
  // everything below it). The effect below re-syncs from localStorage
  // right after mount instead.
  const [enabled, setEnabled] = useState(autoStart)
  const [countdown, setCountdown] = useState(intervalMs / 1000)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const nextAtRef = useRef(0)
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  const clearTimer = () => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
  }

  const tick = useCallback(() => {
    const left = nextAtRef.current - Date.now()
    if (left <= 0) {
      nextAtRef.current = Date.now() + intervalMs
      setCountdown(Math.round(intervalMs / 1000))
      try { callbackRef.current() } catch (e) { console.error('auto-refresh callback failed:', e) }
    } else {
      setCountdown(Math.ceil(left / 1000))
    }
  }, [intervalMs])

  const stop = useCallback(() => {
    setEnabled(false)
    try { localStorage.setItem(STORAGE_KEY, 'false') } catch {}
    clearTimer()
  }, [])

  const start = useCallback(() => {
    setEnabled(true)
    try { localStorage.setItem(STORAGE_KEY, 'true') } catch {}
    nextAtRef.current = Date.now() + intervalMs
    setCountdown(intervalMs / 1000)
    clearTimer()
    intervalRef.current = setInterval(tick, 1000)
  }, [intervalMs, tick])

  const toggle = useCallback(() => {
    if (enabled) stop()
    else start()
  }, [enabled, start, stop])

  useEffect(() => {
    // Auto-start if persisted as enabled or autoStart prop
    let persisted = false
    try { persisted = localStorage.getItem(STORAGE_KEY) === 'true' } catch {}
    if (persisted || autoStart) start()
    return () => clearTimer()
  }, [autoStart, start])

  // Catch up the moment the page is back in front of the member.
  useEffect(() => {
    if (!enabled) return
    const wake = () => { if (document.visibilityState === 'visible') tick() }
    document.addEventListener('visibilitychange', wake)
    window.addEventListener('focus', wake)
    window.addEventListener('pageshow', wake)
    window.addEventListener('online', wake)
    return () => {
      document.removeEventListener('visibilitychange', wake)
      window.removeEventListener('focus', wake)
      window.removeEventListener('pageshow', wake)
      window.removeEventListener('online', wake)
    }
  }, [enabled, tick])

  const mins = Math.floor(countdown / 60)
  const secs = countdown % 60
  const countdownStr = `${mins}:${secs.toString().padStart(2, '0')}`

  return { enabled, toggle, countdownStr }
}
