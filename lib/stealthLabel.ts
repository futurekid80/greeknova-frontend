// Nov 7 2026: a Buying/Writing label can disagree with the premium column
// (e.g. "Call Writing" while the premium is up 20%) because the EOD label is
// judged on implied volatility, not on the premium. When the two clearly point
// different ways the label is shown muted with a "?" and is left out of the
// bias counts, so an unclear reading does not swing a stock's Bullish/Bearish read.
const CLEAR_MOVE_PCT = 10

export function labelUnclear(activity?: string | null, premiumPct?: number | null): boolean {
  if (premiumPct == null || Number.isNaN(Number(premiumPct))) return false
  const p = Number(premiumPct)
  if (activity === 'WRITING') return p >= CLEAR_MOVE_PCT
  return false
}

export const UNCLEAR_LABEL_HINT =
  'Unclear: the premium and the pricing signal point different ways here (the label says Writing but the premium is up sharply). Treat this label with caution; it is left out of the Bias counts.'

// Nov 7 2026 PREVIEW (?v=nb): "neighbour check". A Writing/Buying label is unclear when at least
// two neighbouring strikes (same stock, expiry and side, within 2 strikes, read at about the same
// time) all say the opposite. It needs no premium threshold, so a correct label is not muted
// just because the stock moved. Rows frozen at a very different time than their neighbours are
// not judged at all.
type NbHit = { symbol: string; expiry?: string | null; strike: number; option_type: string; strikes_away?: number | null; activity?: string | null; last_seen?: string | null }
const NB_MAX_STRIKES = 2
const NB_MAX_GAP_MS = 30 * 60 * 1000
export const hitKey = (h: NbHit) => `${h.symbol}|${h.expiry ?? ''}|${h.strike}|${h.option_type}`
export function neighbourUnclearKeys(hits: NbHit[]): Set<string> {
  const out = new Set<string>()
  const groups = new Map<string, NbHit[]>()
  for (const h of hits) {
    if (h.activity !== 'BUYING' && h.activity !== 'WRITING') continue
    if (h.strikes_away == null) continue
    const g = `${h.symbol}|${h.expiry ?? ''}|${h.option_type}`
    const arr = groups.get(g); if (arr) arr.push(h); else groups.set(g, [h])
  }
  groups.forEach(arr => {
    for (const h of arr) {
      const t = h.last_seen ? Date.parse(h.last_seen) : NaN
      const peers = arr.filter(p => {
        if (p === h || Math.abs((p.strikes_away as number) - (h.strikes_away as number)) > NB_MAX_STRIKES) return false
        const pt = p.last_seen ? Date.parse(p.last_seen) : NaN
        return Number.isNaN(t) || Number.isNaN(pt) || Math.abs(pt - t) <= NB_MAX_GAP_MS
      })
      if (peers.length >= 2 && peers.every(p => p.activity !== h.activity)) out.add(hitKey(h))
    }
  })
  return out
}
export const NB_UNCLEAR_HINT =
  'Unclear: neighbouring strikes on this stock read the opposite way, so this label may be a quirk of how it is priced. Left out of the Bias counts.'
