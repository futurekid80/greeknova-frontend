'use client'
import { useEffect, useRef, useState, useCallback } from 'react'

export function useAutoRefresh(
  callback: () => void,
  intervalMs: number = 5 * 60 * 1000,
  autoStart: boolean = false
) {
  const [enabled, setEnabled] = useState(false)
  const [countdown, setCountdown] = useState(intervalMs / 1000)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const countdownRef = useRef<NodeJS.Timeout | null>(null)
  const callbackRef = useRef(callback)
  const startedRef = useRef(false)
  callbackRef.current = callback

  const stop = useCallback(() => {
    setEnabled(false)
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null }
  }, [])

  const start = useCallback(() => {
    setEnabled(true)
    setCountdown(intervalMs / 1000)
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (countdownRef.current) clearInterval(countdownRef.current)
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

  // Auto-start on mount when autoStart is true
  useEffect(() => {
    if (autoStart && !startedRef.current) {
      startedRef.current = true
      start()
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [autoStart, start])

  const mins = Math.floor(countdown / 60)
  const secs = countdown % 60
  const countdownStr = `${mins}:${secs.toString().padStart(2, '0')}`

  return { enabled, toggle, countdownStr }
}
