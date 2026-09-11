'use client'
import { useEffect, useRef, useState, useCallback } from 'react'

const API = 'https://api.greeknova.com'

export interface CasRow {
  symbol: string
  indicative_price: number
  prev_close: number | null
  chg_pct: number | null
  imbalance_qty: number
  imbalance_side: 'BUY' | 'SELL' | null
  matched_qty: number
  ltp_at_315: number
  updated_at: string
}

function isInCasWindowIST(): boolean {
  // Client-side gate so we don't poll all day -- server double-checks anyway.
  const nowUtc = new Date()
  const istMinutes = ((nowUtc.getUTCHours() * 60 + nowUtc.getUTCMinutes()) + 330) % 1440
  const day = new Date(nowUtc.getTime() + 330 * 60000).getUTCDay()
  if (day === 0 || day === 6) return false
  return istMinutes >= 15 * 60 + 15 && istMinutes <= 15 * 60 + 35
}

/** Polls /cas-indicative every 2s, but only while the Closing Auction
 * Session is actually live -- otherwise it's a no-op. Returns a symbol ->
 * row map plus whether CAS is currently active. */
export function useCasIndicative() {
  const [rows, setRows] = useState<Record<string, CasRow>>({})
  const [casActive, setCasActive] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`${API}/cas-indicative`)
      const data = await res.json()
      setCasActive(!!data.cas_active)
      const map: Record<string, CasRow> = {}
      ;(data.rows || []).forEach((r: CasRow) => { map[r.symbol] = r })
      setRows(map)
    } catch { /* ignore transient failures, next tick retries */ }
  }, [])

  useEffect(() => {
    let active = true
    const tick = () => {
      if (!active) return
      if (isInCasWindowIST()) {
        poll()
        timerRef.current = setTimeout(tick, 2000)
      } else {
        setCasActive(false)
        // Check back every 30s outside the window so the badge appears
        // promptly once 15:15 hits, without hammering the API all day.
        timerRef.current = setTimeout(tick, 30000)
      }
    }
    tick()
    return () => {
      active = false
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [poll])

  return { rows, casActive }
}
