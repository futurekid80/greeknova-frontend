'use client'
import './globals.css'
import { useEffect, useRef } from 'react'

// Global audio unlock - needs one user interaction
let audioUnlocked = false
function unlockAudio() {
  if (audioUnlocked) return
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
  ctx.resume().then(() => { audioUnlocked = true })
  ctx.close()
}

function playBeep() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    // Smooth two-tone alert
    gain.gain.setValueAtTime(0, ctx.currentTime)
    gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05)
    gain.gain.setValueAtTime(0.3, ctx.currentTime + 0.2)
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3)
    gain.gain.setValueAtTime(0, ctx.currentTime + 0.35)
    gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.4)
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6)
    osc.frequency.setValueAtTime(1000, ctx.currentTime)
    osc.frequency.setValueAtTime(1300, ctx.currentTime + 0.35)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.65)
    // Clean up
    osc.onended = () => ctx.close()
  } catch(e) { console.error('Sound error:', e) }
}

function showNotification(title: string, body: string, url: string) {
  if (Notification.permission !== 'granted') return
  const n = new Notification(title, {
    body,
    icon: '/favicon.ico',
    requireInteraction: true,
    tag: title + body
  })
  n.onclick = () => { window.focus(); window.location.href = url; n.close() }
  playBeep()
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const prevSpikes = useRef<Set<string>>(new Set())
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const enabledRef = useRef(false)

  async function runChecks() {
    const threshold = localStorage.getItem('gn_spike_threshold') || '10'
    const alertsEnabled = localStorage.getItem('gn_alerts_enabled') === 'true'
    if (!alertsEnabled) return

    // Check OI spikes
    try {
      const res = await fetch(`https://greeknova-backend-production.up.railway.app/oi-spikes?threshold=${threshold}`)
      const json = await res.json()
      for (const spike of (json.spikes || [])) {
        const key = `${spike.tradingsymbol}_${json.ts_new}`
        if (prevSpikes.current.has(key)) continue
        prevSpikes.current.add(key)
        const icon = spike.direction === 'BUILD' ? '🔥' : '📉'
        showNotification(
          `${icon} OI ${spike.direction} — ${spike.symbol} ${spike.strike} ${spike.option_type}`,
          `OI ${spike.oi_pct > 0 ? '+' : ''}${spike.oi_pct}% | OI: ${(spike.new_oi/100000).toFixed(1)}L | LTP: ₹${spike.last_price}`,
          '/spikes'
        )
        // Save to alert feed
        const alerts = JSON.parse(localStorage.getItem('gn_alerts') || '[]')
        alerts.unshift({
          id: Date.now(), symbol: spike.symbol, signal: 'OI_SPIKE',
          message: `${spike.option_type} ${spike.strike} OI ${spike.direction} ${spike.oi_pct}%`,
          receivedAt: new Date().toLocaleTimeString('en-IN'), url: '/spikes'
        })
        localStorage.setItem('gn_alerts', JSON.stringify(alerts.slice(0, 50)))
      }
    } catch(e) {}

    // Check volume spikes
    try {
      const res = await fetch(`https://greeknova-backend-production.up.railway.app/volume-spikes?threshold=${threshold}`)
      const json = await res.json()
      for (const spike of (json.spikes || [])) {
        if (spike.oi_signal !== 'FRESH_BUILD') continue
        const key = `vol_${spike.tradingsymbol}_${json.ts_new}`
        if (prevSpikes.current.has(key)) continue
        prevSpikes.current.add(key)
        showNotification(
          `📊 Vol Fresh Build — ${spike.symbol} ${spike.strike} ${spike.option_type}`,
          `Volume +${spike.vol_pct}% | OI +${spike.oi_pct}% | LTP: ₹${spike.last_price}`,
          '/volume'
        )
        const alerts = JSON.parse(localStorage.getItem('gn_alerts') || '[]')
        alerts.unshift({
          id: Date.now(), symbol: spike.symbol, signal: 'VOL_SPIKE',
          message: `${spike.option_type} ${spike.strike} Vol +${spike.vol_pct}% Fresh Build`,
          receivedAt: new Date().toLocaleTimeString('en-IN'), url: '/volume'
        })
        localStorage.setItem('gn_alerts', JSON.stringify(alerts.slice(0, 50)))
      }
    } catch(e) {}
  }

  useEffect(() => {
    // Unlock audio on first click anywhere
    document.addEventListener('click', unlockAudio, { once: true })

    // Start monitoring interval — runs as long as ANY GreekNova tab is open
    intervalRef.current = setInterval(runChecks, 5 * 60 * 1000)

    // Also run immediately if alerts were previously enabled
    const wasEnabled = localStorage.getItem('gn_alerts_enabled') === 'true'
    if (wasEnabled) runChecks()

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      document.removeEventListener('click', unlockAudio)
    }
  }, [])

  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
