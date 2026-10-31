'use client'
// Oct 24 2026: a skippable, one-time-ish ask for a WhatsApp number from
// trial users. Kite's OAuth login never returns a phone number, so this is
// the only way GreekNova gets one -- needed to reach trial users directly
// (renewal nudges, support, expiry reminders) instead of relying on email
// alone. Deliberately NOT a blocking field: the Zerodha-only login is a
// real selling point (zero extra friction to sign up), so this must stay
// optional and easy to dismiss, shown only to active trial users who
// haven't already given a number.
import { useEffect, useState } from 'react'

const API = 'https://api.greeknova.com'
const SNOOZE_KEY = 'gn_phone_prompt_snoozed_until'
const NEVER_KEY = 'gn_phone_prompt_never'
const SNOOZE_DAYS = 3

type TrialStatus = {
  status: 'member' | 'trial_active' | 'trial_expired' | 'none'
  phone_captured: boolean | null
}

function isSnoozed(): boolean {
  try {
    if (localStorage.getItem(NEVER_KEY) === '1') return true
    const until = localStorage.getItem(SNOOZE_KEY)
    if (until && Date.now() < Number(until)) return true
  } catch {}
  return false
}

export default function TrialPhonePrompt() {
  const [visible, setVisible] = useState(false)
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (isSnoozed()) return
      try {
        const res = await fetch(`${API}/me/trial-status`, { cache: 'no-store' })
        if (!res.ok) return
        const json: TrialStatus = await res.json()
        if (!cancelled && json.status === 'trial_active' && json.phone_captured === false) {
          setVisible(true)
        }
      } catch {
        // silent -- this is a nice-to-have prompt, never worth surfacing an error for
      }
    }
    load()
  }, [])

  if (!visible) return null

  function snooze() {
    try { localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_DAYS * 86400000)) } catch {}
    setVisible(false)
  }

  function dismissForever() {
    try { localStorage.setItem(NEVER_KEY, '1') } catch {}
    setVisible(false)
  }

  async function save() {
    const digits = phone.replace(/[^0-9]/g, '')
    if (digits.length < 10) {
      setError('Enter a valid 10-digit mobile number')
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`${API}/me/update-phone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: digits }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setError(j.detail || 'Could not save that number, please try again')
        setSaving(false)
        return
      }
      setSaved(true)
      setTimeout(() => setVisible(false), 1400)
    } catch {
      setError('Could not save that number, please try again')
      setSaving(false)
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-[9998] w-[min(92vw,360px)] rounded-xl border border-emerald-800/40 bg-[#0b1220] shadow-xl p-4">
      {saved ? (
        <p className="text-sm text-emerald-400">Thanks! We'll use this only for GreekNova support & reminders.</p>
      ) : (
        <>
          <p className="text-sm font-medium text-gray-100 mb-1">Add your WhatsApp number?</p>
          <p className="text-xs text-gray-400 mb-3">
            So we can reach you directly for support or trial/renewal reminders. Totally optional.
          </p>
          <div className="flex gap-2 mb-2">
            <input
              type="tel"
              inputMode="numeric"
              placeholder="10-digit mobile number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="flex-1 min-w-0 rounded-md bg-[#141c2e] border border-gray-700 px-2.5 py-1.5 text-sm text-gray-100 placeholder:text-gray-500 outline-none focus:border-emerald-600"
            />
            <button
              onClick={save}
              disabled={saving}
              className="shrink-0 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-sm font-medium px-3 py-1.5"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
          {error && <p className="text-xs text-red-400 mb-2">{error}</p>}
          <div className="flex items-center justify-between text-xs text-gray-500">
            <button onClick={snooze} className="hover:text-gray-300 underline-offset-2 hover:underline">
              Maybe later
            </button>
            <button onClick={dismissForever} className="hover:text-gray-300 underline-offset-2 hover:underline">
              Don't ask again
            </button>
          </div>
        </>
      )}
    </div>
  )
}
