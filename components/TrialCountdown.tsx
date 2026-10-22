'use client'
// Oct 22 2026: small navbar badge showing a trial member their own days-left
// countdown, so expiry doesn't come as a surprise the moment the backend
// gate (services/access_gate.py) starts blocking every request. Reads
// /me/trial-status, which classifies status the exact same way the gate
// does -- this can never show "3 days left" while the gate quietly
// disagrees. Renders nothing for members, signed-out visitors, or once a
// trial has actually expired (the gate's own block message covers that).
import { useEffect, useState } from 'react'

const API = 'https://api.greeknova.com'

type TrialStatus = {
  status: 'member' | 'trial_active' | 'trial_expired' | 'none'
  trial_expires_date: string | null
  days_left: number | null
}

export default function TrialCountdown() {
  const [data, setData] = useState<TrialStatus | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(`${API}/me/trial-status`, { cache: 'no-store' })
        if (!res.ok) return
        const json = await res.json()
        if (!cancelled) setData(json)
      } catch {
        // silent -- this is a nice-to-have badge, never worth surfacing an error for
      }
    }
    load()
    // Re-check once an hour -- a tab left open overnight should still flip
    // over to "expired" on its own without a manual refresh.
    const t = setInterval(load, 60 * 60 * 1000)
    return () => { cancelled = true; clearInterval(t) }
  }, [])

  if (!data || data.status !== 'trial_active' || data.days_left === null) return null

  const urgent = data.days_left <= 2
  const label = data.days_left === 0 ? 'Trial ends today' : `Trial: ${data.days_left} day${data.days_left === 1 ? '' : 's'} left`

  return (
    <div
      title={data.trial_expires_date ? `Expires ${data.trial_expires_date}` : undefined}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium whitespace-nowrap ${
        urgent
          ? 'bg-amber-950/50 border-amber-700/50 text-amber-400'
          : 'bg-emerald-950/40 border-emerald-800/40 text-emerald-400'
      }`}
    >
      {label}
    </div>
  )
}
