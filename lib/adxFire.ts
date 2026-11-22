'use client'
import { useEffect, useState } from 'react'

const API = 'https://api.greeknova.com'

export type AdxDirs = Record<string, { bull: string[]; bear: string[] }>

// Fresh ADX breakouts per stock (latest scan day), read from the Wolves feed that is already stored.
export function useAdxDirections(): AdxDirs {
  const [dirs, setDirs] = useState<AdxDirs>({})
  useEffect(() => {
    let live = true
    fetch(`${API}/wolves/fresh-events`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (!live || !d || !Array.isArray(d.events)) return
        const out: AdxDirs = {}
        for (const e of d.events) {
          if (!e || typeof e.event_type !== 'string' || !e.event_type.startsWith('ADX Cross')) continue
          const sym = String(e.symbol || '').toUpperCase()
          if (!sym) continue
          const side = String(e.direction || '').toLowerCase() === 'bullish' ? 'bull' : String(e.direction || '').toLowerCase() === 'bearish' ? 'bear' : null
          if (!side) continue
          const rec = (out[sym] = out[sym] || { bull: [], bear: [] })
          const tf = String(e.timeframe || '')
          if (tf && !rec[side].includes(tf)) rec[side].push(tf)
        }
        setDirs(out)
      })
      .catch(() => {})
    return () => { live = false }
  }, [])
  return dirs
}

function isOtm(h: any): boolean {
  if (h.strikes_away === 0 || (h.atm_strike != null && h.strike === h.atm_strike)) return false
  const ref = h.cmp ?? h.atm_strike
  if (ref == null) return h.strikes_away != null && h.strikes_away !== 0
  return h.option_type === 'CE' ? h.strike > ref : h.strike < ref
}

// 🔥 when an OTM position points the same way as a fresh ADX breakout on the stock:
// bullish = put writing or call buying, bearish = call writing or put buying.
export function adxFire(h: any, dirs: AdxDirs): { dir: 'bull' | 'bear'; tfs: string[] } | null {
  const rec = dirs[String(h.symbol || '').toUpperCase()]
  if (!rec || !isOtm(h)) return null
  const bullish = (h.activity === 'WRITING' && h.option_type === 'PE') || (h.activity === 'BUYING' && h.option_type === 'CE')
  const bearish = (h.activity === 'WRITING' && h.option_type === 'CE') || (h.activity === 'BUYING' && h.option_type === 'PE')
  if (bullish && rec.bull.length) return { dir: 'bull', tfs: rec.bull }
  if (bearish && rec.bear.length) return { dir: 'bear', tfs: rec.bear }
  return null
}

export function fireTitle(f: { dir: 'bull' | 'bear'; tfs: string[] }): string {
  return `Fresh ${f.dir === 'bull' ? 'bullish' : 'bearish'} ADX breakout on this stock (${f.tfs.join(', ')}), in the same direction as this out-of-the-money position`
}
