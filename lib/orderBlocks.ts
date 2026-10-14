// Order Block (Smart Money Concepts) detection + drawing for StockChart.
//
// Computed entirely client-side from the same candle data the chart already
// has -- same pattern as the EMA/RSI/VWAP overlays in StockChart.tsx -- so
// no backend change or extra data feed is needed.
//
// What an Order Block is (standard SMC definition used here):
//   Bullish OB: the last down-close (red) candle right before an impulsive
//   up-move that breaks market structure (closes above the most recent
//   swing high). The OB "zone" is that red candle's high-to-low range --
//   the idea being that's the last pocket of resting sell orders before
//   smart money flipped the market bullish, so price often returns there
//   once before continuing up.
//   Bearish OB: the mirror image -- last up-close (green) candle before a
//   down-move that breaks below the most recent swing low.
//
// A block is "mitigated" once price later trades back into its zone --
// after that it's no longer a fresh zone, so it stops extending to the
// right and (optionally) gets filtered out of the display.

export type Candle = { time: string | number; open: number; high: number; low: number; close: number; volume: number }

export type OrderBlock = {
  type: 'bullish' | 'bearish'
  top: number
  bottom: number
  startTime: string | number
  // null while still active (unmitigated) -- box extends to the chart's
  // right edge; set to the time it got mitigated once price trades back in
  endTime: string | number | null
  mitigated: boolean
}

/**
 * Swing highs/lows using a simple fractal: candle i is a swing high if its
 * high is the strict max within the +/- `pivotLen` window around it (swing
 * low: mirror on lows). This is the same "structure" building block used by
 * most SMC indicators (BOS/CHoCH detection) -- a swing point isn't
 * confirmed until `pivotLen` candles have printed after it, which is why
 * detection naturally lags the live edge of the chart by that many candles.
 */
export function findSwings(candles: Candle[], pivotLen = 5) {
  const swingHighs: { index: number; price: number }[] = []
  const swingLows: { index: number; price: number }[] = []
  for (let i = pivotLen; i < candles.length - pivotLen; i++) {
    const windowSlice = candles.slice(i - pivotLen, i + pivotLen + 1)
    const h = candles[i].high
    const l = candles[i].low
    if (windowSlice.every((c) => c.high <= h) && windowSlice.filter((c) => c.high === h).length === 1) {
      swingHighs.push({ index: i, price: h })
    }
    if (windowSlice.every((c) => c.low >= l) && windowSlice.filter((c) => c.low === l).length === 1) {
      swingLows.push({ index: i, price: l })
    }
  }
  return { swingHighs, swingLows }
}

export function detectOrderBlocks(candles: Candle[], pivotLen = 5, maxBlocks = 20): OrderBlock[] {
  if (candles.length < pivotLen * 2 + 2) return []

  const { swingHighs, swingLows } = findSwings(candles, pivotLen)
  const blocks: OrderBlock[] = []

  // Walk forward tracking the most recent CONFIRMED swing high/low (i.e.
  // only swings whose +/- pivotLen confirmation window has already passed
  // by candle i -- using a future swing here would be lookahead bias).
  let lastSwingHigh: number | null = null
  let lastSwingLow: number | null = null
  let shIdx = 0
  let slIdx = 0
  // Has the current lastSwingHigh/Low already produced a BOS block, so we
  // don't stamp a new OB on every subsequent candle that closes through it
  let swingHighBroken = false
  let swingLowBroken = false

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

    // Bullish BOS: close breaks above the last confirmed swing high
    if (lastSwingHigh != null && !swingHighBroken && c.close > lastSwingHigh) {
      swingHighBroken = true
      // last down-close candle strictly before this breakout candle
      for (let j = i - 1; j >= Math.max(0, i - 15); j--) {
        if (candles[j].close < candles[j].open) {
          blocks.push({
            type: 'bullish',
            top: candles[j].high,
            bottom: candles[j].low,
            startTime: candles[j].time,
            endTime: null,
            mitigated: false,
          })
          break
        }
      }
    }

    // Bearish BOS: close breaks below the last confirmed swing low
    if (lastSwingLow != null && !swingLowBroken && c.close < lastSwingLow) {
      swingLowBroken = true
      // last up-close candle strictly before this breakdown candle
      for (let j = i - 1; j >= Math.max(0, i - 15); j--) {
        if (candles[j].close > candles[j].open) {
          blocks.push({
            type: 'bearish',
            top: candles[j].high,
            bottom: candles[j].low,
            startTime: candles[j].time,
            endTime: null,
            mitigated: false,
          })
          break
        }
      }
    }

    // Mitigation check: any still-active block whose zone price has now traded
    for (const b of blocks) {
      if (b.mitigated) continue
      if (b.startTime === c.time) continue // the OB candle itself can't mitigate its own block
      const touched = b.type === 'bullish' ? c.low <= b.top : c.high >= b.bottom
      if (touched) {
        b.mitigated = true
        b.endTime = c.time
      }
    }
  }

  // Keep it readable on the chart: show every still-active (unmitigated)
  // block -- there are usually only a handful at once -- plus the most
  // recent mitigated ones to fill out the cap, for context.
  const active = blocks.filter((b) => !b.mitigated)
  const mitigated = blocks.filter((b) => b.mitigated)
  const mitigatedRoom = Math.max(0, maxBlocks - active.length)
  return [...mitigated.slice(-mitigatedRoom), ...active]
}
