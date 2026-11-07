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
