'use client'
import { useEffect, useRef, useState } from 'react'

const API = 'https://api.greeknova.com'

type Status = { state: 'live' | 'finalising' | 'final' | 'provisional'; for_date: string } | null

function fmtDate(iso: string) {
  try {
    const d = new Date(iso + 'T12:00:00+05:30')
    return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })
  } catch { return iso }
}

// Short tag beside the "MARKET CLOSED" label. Says whether the closing data is still being finalised or is final,
// so members who log in after the close know they can analyse tonight instead of waiting for the next day.
// The detail opens on hover (desktop) or tap (phone). Shows nothing while the market is live (the LIVE label already
// says it) or if the status cannot be read.
export default function DataStatusTag() {
  const [st, setSt] = useState<Status>(null)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const ref = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    let dead = false
    const load = () => {
      if (document.visibilityState !== 'visible') return
      fetch(`${API}/data-status`).then(r => r.json()).then(j => { if (!dead) setSt(j) }).catch(() => {})
    }
    load()
    const id = setInterval(load, 120000)
    return () => { dead = true; clearInterval(id) }
  }, [])

  // Phones: tapping anywhere else closes the detail (there is no mouse-leave on touch screens).
  useEffect(() => {
    if (!open) return
    const close = (e: Event) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('touchstart', close)
    return () => document.removeEventListener('touchstart', close)
  }, [open])

  const show = () => {
    const r = ref.current?.getBoundingClientRect()
    if (r) setPos({ top: r.bottom + 8, left: Math.max(8, Math.min(r.left, window.innerWidth - 308)) })
    setOpen(true)
  }

  if (!st || st.state === 'live' || st.state === 'provisional') return null
  const final = st.state === 'final'
  const d = fmtDate(st.for_date)
  const label = final ? `FINAL DATA · ${d}` : 'FINALISING'
  const detail = final
    ? `Final data for ${d} is ready. You can analyse tonight; no need to wait for tomorrow.`
    : 'Today’s closing data is being finalised. Final figures usually by 8 pm.'

  return (
    <div className="flex-shrink-0 px-2 h-full flex items-center">
      <button
        ref={ref}
        type="button"
        onMouseEnter={show}
        onMouseLeave={() => setOpen(false)}
        onFocus={show}
        onBlur={() => setOpen(false)}
        onClick={show}
        aria-label={detail}
        className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-black tracking-wide ${
          final
            ? 'bg-emerald-500/20 border-emerald-400/70 text-emerald-300 shadow-[0_0_10px_rgba(52,211,153,0.35)]'
            : 'bg-amber-500/20 border-amber-400/70 text-amber-300 shadow-[0_0_10px_rgba(251,191,36,0.3)]'
        }`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${final ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
        {label}
      </button>
      {open && pos && (
        <div
          role="tooltip"
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: 300, zIndex: 60 }}
          className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2.5 text-xs leading-relaxed text-gray-200 shadow-xl"
        >
          {detail}
        </div>
      )}
    </div>
  )
}
