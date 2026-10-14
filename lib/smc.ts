// Rest of the Smart Money Concepts suite -- Fair Value Gaps, structure
// breaks (BOS/CHoCH), and liquidity sweeps. Sits alongside orderBlocks.ts
// (Order Blocks shipped first); shares its swing-pivot detection (findSwings)
// so all four concepts agree on what counts as a confirmed swing point.
//
// All client-side, computed from the same candle array StockChart.tsx
// already has in candlesRef -- no backend change needed, same pattern as
// the EMA/RSI/VWAP/Order Block overlays.

import { type Candle, findSwings } from './orderBlocks'

// ---------------------------------------------------------------------
// Fair Value Gap (FVG) -- a 3-candle imbalance: candle 1's high sits below
// candle 3's low (bullish gap) or candle 1's low sits above candle 3's high
// (bearish gap), meaning candle 2 traded straight through that price band
// with no overlap from either neighbor. The idea: that band has no two-sided
// trading in it, so price is statistically likely to return and "fill" it
// before continuing. Mitigated the same way an Order Block is -- first touch
// back into the zone -- for visual consistency between the two overlays.
export type FVG = {
  type: 'bullish' | 'bearish'
  top: number
  bottom: number
  startTime: string | number
  endTime: string | number | null
  mitigated: boolean
}

export function detectFVG(candles: Candle[], maxGaps = 20): FVG[] {
  if (candles.length < 3) return []
  const gaps: (FVG & { _idx: number })[] = []

  for (let i = 2; i < candles.length; i++) {
    const c1 = candles[i - 2]
    const c3 = candles[i]

    if (c1.high < c3.low) {
      gaps.push({ type: 'bullish', top: c3.low, bottom: c1.high, startTime: c1.time, endTime: null, mitigated: false, _idx: i })
    } else if (c1.low > c3.high) {
      gaps.push({ type: 'bearish', top: c1.low, bottom: c3.high, startTime: c1.time, endTime: null, mitigated: false, _idx: i })
    }

    // Check every still-active gap formed strictly before this candle --
    // the candle that forms a gap can't be the one that fills it.
    for (const g of gaps) {
      if (g.mitigated || g._idx >= i) continue
      const touched = g.type === 'bullish' ? c3.low <= g.top : c3.high >= g.bottom
      if (touched) {
        g.mitigated = true
        g.endTime = c3.time
      }
    }
  }

  const active = gaps.filter((g) => !g.mitigated)
  const mitigated = gaps.filter((g) => g.mitigated)
  const room = Math.max(0, maxGaps - active.length)
  return [...mitigated.slice(-room), ...active].map(({ _idx, ...rest }) => rest)
}

// ---------------------------------------------------------------------
// Structure breaks -- BOS (Break of Structure) and CHoCH (Change of
// Character). Both fire on the same event as an Order Block's "swing
// high/low broken" trigger (a confirmed swing level given up on a close),
// so these markers line up with the Order Block zones already on the chart.
// The label depends on the prevailing trend: a break that continues the
// current trend is a BOS; a break that reverses it is a CHoCH. The very
// first break in the series has no prior trend to continue or reverse, so
// it's labeled CHoCH (establishing the first trend).
export type StructureBreak = {
  kind: 'BOS' | 'CHoCH'
  direction: 'bullish' | 'bearish'
  time: string | number
  price: number
}

export function detectStructureBreaks(candles: Candle[], pivotLen = 5): StructureBreak[] {
  if (candles.length < pivotLen * 2 + 2) return []
  const { swingHighs, swingLows } = findSwings(candles, pivotLen)
  const breaks: StructureBreak[] = []

  let lastSwingHigh: number | null = null
  let lastSwingLow: number | null = null
  let shIdx = 0
  let slIdx = 0
  let swingHighBroken = false
  let swingLowBroken = false
  let trend: 'bullish' | 'bearish' | null = null

  for (let i = pivotLen; i < candles.length; i++) {
    while (shIdx < swingHighs.length && swingHighs[shIdx].index + pivotLen <= i) {
      lastSwingHigh = swingHighs[shIdx].price
      swingHighBroken = false
      shIdx++
    }
    while (slIdx < swingLows.length && swingLows[slIdx].index + pivotLen <= i) {
      lastSwingLow = swingLows[slIdx].price
      swingLowBroken = false
      slIdx++
    }

    const c = candles[i]

    if (lastSwingHigh != null && !swingHighBroken && c.close > lastSwingHigh) {
      swingHighBroken = true
      breaks.push({
        kind: trend === 'bullish' ? 'BOS' : 'CHoCH',
        direction: 'bullish',
        time: c.time,
        price: lastSwingHigh,
      })
      trend = 'bullish'
    }

    if (lastSwingLow != null && !swingLowBroken && c.close < lastSwingLow) {
      swingLowBroken = true
      breaks.push({
        kind: trend === 'bearish' ? 'BOS' : 'CHoCH',
        direction: 'bearish',
        time: c.time,
        price: lastSwingLow,
      })
      trend = 'bearish'
    }
  }

  return breaks
}

// ---------------------------------------------------------------------
// Liquidity sweeps -- a wick trades beyond a confirmed swing high/low
// (where stop-losses and breakout orders cluster) but the candle CLOSES
// back on the other side, so structure is never actually broken. Read as
// "smart money grabbed resting liquidity there, then reversed" -- the
// classic stop-hunt pattern. Distinct from BOS/CHoCH, which require a
// close beyond the level; a sweep is specifically a close that fails to
// follow through. Unlike a swing break, the same level can be swept more
// than once (sweeping it doesn't retire it the way breaking it does), so
// there's no "already used" flag here.
export type LiquiditySweep = {
  side: 'buy-side' | 'sell-side' // buy-side = stops resting below a swing low, swept upward into a bounce; sell-side = stops resting above a swing high, swept downward into a drop
  time: string | number
  level: number
  wick: number
}

export function detectLiquiditySweeps(candles: Candle[], pivotLen = 5, maxSweeps = 30): LiquiditySweep[] {
  if (candles.length < pivotLen * 2 + 2) return []
  const { swingHighs, swingLows } = findSwings(candles, pivotLen)
  const sweeps: LiquiditySweep[] = []

  let lastSwingHigh: number | null = null
  let lastSwingLow: number | null = null
  let shIdx = 0
  let slIdx = 0

  for (let i = pivotLen; i < candles.length; i++) {
    while (shIdx < swingHighs.length && swingHighs[shIdx].index + pivotLen <= i) {
      lastSwingHigh = swingHighs[shIdx].price
      shIdx++
    }
    while (slIdx < swingLows.length && swingLows[slIdx].index + pivotLen <= i) {
      lastSwingLow = swingLows[slIdx].price
      slIdx++
    }

    const c = candles[i]

    if (lastSwingHigh != null && c.high > lastSwingHigh && c.close < lastSwingHigh) {
      sweeps.push({ side: 'sell-side', time: c.time, level: lastSwingHigh, wick: c.high })
    }
    if (lastSwingLow != null && c.low < lastSwingLow && c.close > lastSwingLow) {
      sweeps.push({ side: 'buy-side', time: c.time, level: lastSwingLow, wick: c.low })
    }
  }

  return sweeps.slice(-maxSweeps)
}
