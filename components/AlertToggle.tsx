'use client'
import { useEffect, useState } from 'react'

const API = 'https://greeknova-backend-production.up.railway.app'

/**
 * Drop this on any page to let the user turn specific alert types on/off
 * for THIS device only (per-device preference, tied to the browser's own
 * push subscription endpoint — no login system needed).
 *
 * `signals`: the exact signal type string(s) this toggle controls, e.g.
 *   ['OI_SPIKE', 'FRESH_BUILD'] for a page-wide Jungle toggle, or
 *   ['PUT_WRITING'] for a single UOA signal type toggle.
 *
 * Renders nothing if this device has never enabled push notifications at
 * all (no subscription to attach a preference to).
 */
export default function AlertToggle({ signals, label }: { signals: string[]; label: string }) {
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [endpoint, setEndpoint] = useState<string | null>(null)
  const [allSignals, setAllSignals] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) { setEnabled(null); return }
    navigator.serviceWorker.ready
      .then(reg => reg.pushManager.getSubscription())
      .then(sub => {
        if (!sub) { setEnabled(null); return }
        setEndpoint(sub.endpoint)
        return fetch(`${API}/push-preferences?endpoint=${encodeURIComponent(sub.endpoint)}`)
          .then(r => r.json())
          .then(prefs => {
            if (prefs.error) { setEnabled(null); return }
            const current: string[] = prefs.enabled_signals || []
            setAllSignals(current)
            setEnabled(signals.every(s => current.includes(s)))
          })
      })
      .catch(() => setEnabled(null))
  }, [])

  async function toggle() {
    if (!endpoint || saving) return
    setSaving(true)
    const next = !enabled
    const newSignals = next
      ? Array.from(new Set([...allSignals, ...signals]))
      : allSignals.filter(s => !signals.includes(s))

    setAllSignals(newSignals)
    setEnabled(next)

    try {
      await fetch(`${API}/push-preferences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint, enabled_signals: newSignals }),
      })
    } catch (e) {
      console.error('Failed to save alert preference', e)
    }
    setSaving(false)
  }

  if (enabled === null) return null

  return (
    <button
      onClick={toggle}
      disabled={saving}
      title={enabled ? `Alerts on for ${label} — click to mute on this device` : `Alerts muted for ${label} — click to enable on this device`}
      className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all font-medium disabled:opacity-50 ${
        enabled
          ? 'bg-emerald-950/40 text-emerald-400 border-emerald-700/50 hover:bg-emerald-950/60'
          : 'bg-gray-900/40 text-gray-500 border-gray-800 hover:text-gray-300'
      }`}
    >
      {enabled ? '🔔' : '🔕'} {label}
    </button>
  )
}
