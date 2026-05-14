// hooks/useAlertSound.ts
// Generates a classy trading-terminal alert tone using Web Audio API.
// No audio file needed — synthesized in browser. Zero cache issues.

import { useCallback, useRef } from 'react'

/**
 * Plays a two-tone professional terminal beep:
 *   • Primary tone  : 880 Hz (A5) — crisp, attention-grabbing
 *   • Harmony tone  : 1108 Hz (C#6) — adds depth, not harsh
 *   • Envelope      : fast attack, smooth exponential decay (~0.4s total)
 *   • Character     : Bloomberg/Reuters terminal feel — clean, confident
 */
function playTerminalBeep(ctx: AudioContext) {
  const now = ctx.currentTime

  // ── Oscillator 1: primary tone ──────────────────────────────────────────
  const osc1 = ctx.createOscillator()
  const gain1 = ctx.createGain()
  osc1.type = 'sine'
  osc1.frequency.setValueAtTime(880, now)                  // A5
  gain1.gain.setValueAtTime(0, now)
  gain1.gain.linearRampToValueAtTime(0.35, now + 0.01)     // fast attack
  gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.42) // smooth decay
  osc1.connect(gain1)
  gain1.connect(ctx.destination)
  osc1.start(now)
  osc1.stop(now + 0.42)

  // ── Oscillator 2: harmony (slightly delayed for richness) ───────────────
  const osc2 = ctx.createOscillator()
  const gain2 = ctx.createGain()
  osc2.type = 'sine'
  osc2.frequency.setValueAtTime(1108, now)                 // C#6
  gain2.gain.setValueAtTime(0, now)
  gain2.gain.linearRampToValueAtTime(0.18, now + 0.015)    // softer, blends in
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35)
  osc2.connect(gain2)
  gain2.connect(ctx.destination)
  osc2.start(now + 0.01)                                   // 10ms offset for layering
  osc2.stop(now + 0.35)

  // ── Optional: subtle click transient for "terminal" feel ───────────────
  const click = ctx.createOscillator()
  const clickGain = ctx.createGain()
  click.type = 'sine'
  click.frequency.setValueAtTime(2400, now)
  clickGain.gain.setValueAtTime(0.08, now)
  clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.025)
  click.connect(clickGain)
  clickGain.connect(ctx.destination)
  click.start(now)
  click.stop(now + 0.025)
}

// ─────────────────────────────────────────────────────────────────────────────

export function useAlertSound() {
  // AudioContext must be created after a user gesture (browser policy)
  const ctxRef = useRef<AudioContext | null>(null)

  const getContext = useCallback((): AudioContext => {
    if (!ctxRef.current) {
      ctxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
    // Context can be suspended if created before user interaction
    if (ctxRef.current.state === 'suspended') {
      ctxRef.current.resume()
    }
    return ctxRef.current
  }, [])

  /** Call this to play the alert sound */
  const playSound = useCallback(() => {
    try {
      const ctx = getContext()
      playTerminalBeep(ctx)
    } catch (err) {
      console.warn('[useAlertSound] Could not play sound:', err)
    }
  }, [getContext])

  /** Call this once on a user gesture (e.g. when user enables alerts)
   *  to "unlock" the AudioContext for future auto-plays */
  const unlock = useCallback(() => {
    try {
      getContext()
    } catch {
      // ignore — context will be created on first playSound() call
    }
  }, [getContext])

  return { playSound, unlock }
}
