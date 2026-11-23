'use client'
// Nov 23 2026: one-tap invite to the trial WhatsApp group, shown to ACTIVE trial members who have not
// shared a number and have not already tapped Join. Deliberately quiet: bottom-right card, "Maybe later"
// snoozes it 3 days, and it shows at most twice per browser in total (the earlier in-navbar phone prompt
// was removed on Oct 24 for feeling naggy, so this must stay rare). Never blocks anything.
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

const API = 'https://api.greeknova.com'
export const TRIAL_GROUP_URL = 'https://chat.whatsapp.com/DOyN0cWLwUF6PZlH3kMzAR?mode=gi_t'
const SNOOZE_KEY = 'gn_wa_card_snoozed_until'
const SHOWN_KEY = 'gn_wa_card_shown'
const MAX_SHOWS = 2
const SNOOZE_DAYS = 3

type TrialStatus = {
  status: 'member' | 'trial_active' | 'trial_expired' | 'none'
  phone_captured: boolean | null
  whatsapp_clicked: boolean | null
}

function blocked(): boolean {
  try {
    if (Number(localStorage.getItem(SHOWN_KEY) || '0') >= MAX_SHOWS) return true
    const until = localStorage.getItem(SNOOZE_KEY)
    if (until && Date.now() < Number(until)) return true
  } catch {}
  return false
}

export default function TrialWhatsAppCard() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (blocked()) return
      try {
        const res = await fetch(`${API}/me/trial-status`, { cache: 'no-store' })
        if (!res.ok) return
        const j: TrialStatus = await res.json()
        if (!cancelled && j.status === 'trial_active' && j.phone_captured === false && j.whatsapp_clicked === false) {
          try { localStorage.setItem(SHOWN_KEY, String(Number(localStorage.getItem(SHOWN_KEY) || '0') + 1)) } catch {}
          setVisible(true)
        }
      } catch {
        // silent: a nice-to-have card, never worth surfacing an error
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  if (!visible) return null

  function later() {
    try { localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_DAYS * 86400000)) } catch {}
    setVisible(false)
  }

  function join() {
    fetch(`${API}/me/whatsapp-clicked`, { method: 'POST' }).catch(() => {})
    setVisible(false)
  }

  // Rendered into <body> on purpose: this component is mounted inside the navbar, whose backdrop-blur makes it
  // the containing block for any position:fixed child, which pushed the card off-screen (Nov 23 2026).
  return createPortal(
    <div className="fixed bottom-4 right-4 z-[9998] w-[min(92vw,360px)] rounded-xl border border-emerald-800/40 bg-[#0b1220] shadow-xl p-4">
      <p className="text-sm font-medium text-gray-100 mb-1">Get the daily note on WhatsApp</p>
      <p className="text-xs text-gray-400 mb-3">
        Each day I share a short note in the trial group on what to look at and how to read it. Join in one tap.
      </p>
      <div className="flex items-center gap-3">
        <a
          href={TRIAL_GROUP_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={join}
          className="rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium px-3 py-1.5"
        >
          Join the group
        </a>
        <button onClick={later} className="text-xs text-gray-500 hover:text-gray-300 underline-offset-2 hover:underline">
          Maybe later
        </button>
      </div>
    </div>,
    document.body
  )
}
