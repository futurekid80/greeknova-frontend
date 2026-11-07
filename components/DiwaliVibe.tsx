'use client'
// Nov 7 2026: light Diwali touch -- a flickering diya next to the page title and
// a one-time ~8 second burst of crackers. Built to stay cheap:
//  - no libraries, no images, no network calls
//  - canvas runs only for ~8s, once per browser session, then is removed
//  - skipped for visitors who ask for reduced motion, and on low-power devices
//  - never blocks clicks (pointer-events none), sits under the navbar
//  - switches itself off after 10 Nov (IST), so nothing needs cleaning up
import { useEffect, useState } from 'react'

const END_DATE = '2026-11-10' // last day shown, IST
const SEEN_KEY = 'gn_diwali_crackers_seen'

function active(): boolean {
  try {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
    return today <= END_DATE
  } catch { return false }
}

function reducedMotion(): boolean {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
}

function lowPower(): boolean {
  try {
    const n: any = navigator
    return (n.hardwareConcurrency && n.hardwareConcurrency <= 2) || (n.deviceMemory && n.deviceMemory <= 2) || n.connection?.saveData === true
  } catch { return false }
}

const COLORS = ['#ffd166', '#ff9f1c', '#ff595e', '#ff7bb0', '#7bf1a8', '#8ecae6']

function runCrackers(canvas: HTMLCanvasElement, onDone: () => void) {
  const ctx = canvas.getContext('2d')
  if (!ctx) { onDone(); return }
  const w = (canvas.width = window.innerWidth)
  const h = (canvas.height = window.innerHeight)
  type P = { x: number; y: number; vx: number; vy: number; life: number; c: string }
  let parts: P[] = []
  const burst = () => {
    const cx = w * (0.15 + Math.random() * 0.7)
    const cy = h * (0.12 + Math.random() * 0.3)
    const c = COLORS[Math.floor(Math.random() * COLORS.length)]
    for (let i = 0; i < 56; i++) {
      const a = (Math.PI * 2 * i) / 56
      const s = 1.8 + Math.random() * 3.2
      parts.push({ x: cx, y: cy, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, c })
    }
  }
  const start = performance.now()
  const burstAt = [0, 600, 1300, 2100, 2900, 3700, 4500, 5400, 6300]
  let next = 0
  let raf = 0
  const frame = (t: number) => {
    const el = t - start
    while (next < burstAt.length && el >= burstAt[next]) { burst(); next++ }
    // soft trails: fade the previous frame instead of wiping it
    ctx.globalCompositeOperation = 'destination-out'
    ctx.fillStyle = 'rgba(0,0,0,0.2)'
    ctx.fillRect(0, 0, w, h)
    ctx.globalCompositeOperation = 'source-over'
    parts = parts.filter(p => p.life > 0)
    for (const p of parts) {
      p.x += p.vx; p.y += p.vy; p.vy += 0.04; p.vx *= 0.99; p.life -= 0.011
      ctx.globalAlpha = Math.max(p.life, 0)
      ctx.fillStyle = p.c
      ctx.fillRect(p.x, p.y, 3, 3)
    }
    ctx.globalAlpha = 1
    if (el < 8500 && (parts.length > 0 || next < burstAt.length)) raf = requestAnimationFrame(frame)
    else onDone()
  }
  raf = requestAnimationFrame(frame)
  return () => cancelAnimationFrame(raf)
}

// Inline flickering diya for the page title. Click it to replay the crackers.
export function Diya({ onClick }: { onClick?: () => void }) {
  const [on, setOn] = useState(false)
  useEffect(() => { setOn(active()) }, [])
  if (!on) return null
  return (
    <>
      <style>{`
        @keyframes gnFlicker { 0%,100%{opacity:1;transform:scale(1)} 25%{opacity:.82;transform:scale(.96)} 55%{opacity:1;transform:scale(1.04)} 80%{opacity:.9;transform:scale(.98)} }
        .gn-diya { display:inline-block; cursor:pointer; filter: drop-shadow(0 0 6px rgba(255,170,60,.65)); animation: gnFlicker 1.6s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .gn-diya { animation: none } }
      `}</style>
      <span className="gn-diya ml-2" role="img" aria-label="Diwali diya" title="Happy Diwali from GreekNova" onClick={onClick}>🪔</span>
    </>
  )
}

// Mount once per page. Plays the crackers once per session; replay(): bumped by clicking the diya.
export default function DiwaliVibe({ replayKey = 0 }: { replayKey?: number }) {
  const [show, setShow] = useState(false)
  const [key, setKey] = useState(0)

  useEffect(() => {
    if (!active() || reducedMotion() || lowPower()) return
    let seen = false
    try { seen = sessionStorage.getItem(SEEN_KEY) === '1' } catch {}
    if (seen) return
    try { sessionStorage.setItem(SEEN_KEY, '1') } catch {}
    const t = setTimeout(() => { setShow(true); setKey(k => k + 1) }, 800)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (replayKey > 0 && active() && !reducedMotion()) { setShow(true); setKey(k => k + 1) }
  }, [replayKey])

  if (!show) return null
  return <Crackers key={key} onDone={() => setShow(false)} />
}

function Crackers({ onDone }: { onDone: () => void }) {
  const [el, setEl] = useState<HTMLCanvasElement | null>(null)
  useEffect(() => {
    if (!el) return
    const stop = runCrackers(el, onDone)
    return () => { if (stop) stop() }
  }, [el])
  return <canvas ref={setEl} aria-hidden="true" style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: 40 }} />
}
