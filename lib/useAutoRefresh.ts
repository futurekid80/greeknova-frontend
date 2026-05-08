'use client'
import { useEffect, useRef, useState, useCallback } from 'react'

const STORAGE_KEY = 'greeknova_auto_refresh'

export function useAutoRefresh(
  callback: () => void,
  intervalMs: number = 5 * 60 * 1000,
  autoStart: boolean = false
) {
  const [enabled, setEnabled] = useState(() => {
    // Read persisted state on mount
    if (typeof window !== 'undefined') {
      return localStorage.getItem(STORAGE_KEY) === 'true'
    }
    return autoStart
  })
  const [countdown, setCountdown] = useState(intervalMs / 1000)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const countdownRef = useRef<NodeJS.Timeout | null>(null)
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  const stop = useCallback(() => {
    setEnabled(false)
    localStorage.setItem(STORAGE_KEY, 'false')
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null }
  }, [])

  const start = useCallback(() => {
    setEnabled(true)
    localStorage.setItem(STORAGE_KEY, 'true')
    setCountdown(intervalMs / 1000)
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null }
    intervalRef.current = setInterval(() => {
      callbackRef.current()
      setCountdown(intervalMs / 1000)
    }, intervalMs)
    countdownRef.current = setInterval(() => {
      setCountdown(p => Math.max(0, p - 1))
    }, 1000)
  }, [intervalMs])

  const toggle = useCallback(() => {
    if (enabled) stop()
    else start()
  }, [enabled, start, stop])

  useEffect(() => {
    // Auto-start if persisted as enabled or autoStart prop
    const persisted = localStorage.getItem(STORAGE_KEY) === 'true'
    if (persisted || autoStart) start()
    return () => {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
      if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null }
    }
  }, [autoStart, start])

  const mins = Math.floor(countdown / 60)
  const secs = countdown % 60
  const countdownStr = `${mins}:${secs.toString().padStart(2, '0')}`

  return { enabled, toggle, countdownStr }
}
