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
function findSwings(candles: Candle[], pivotLen = 5) {
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

// ── Drawing: lightweight-charts v5 Series Primitive ─────────────────────
// Order Blocks are shaded rectangles, which lightweight-charts has no
// built-in series type for (unlike price lines, used elsewhere in
// StockChart for CPR/OI/GEX levels) -- the Primitives API is the
// documented way to draw arbitrary shapes on the canvas in sync with the
// chart's pan/zoom. One primitive instance renders ALL current blocks;
// `setBlocks` is called whenever detection re-runs (new symbol/range/data)
// and triggers a redraw via requestUpdate().

class OrderBlockPaneRenderer {
  private _blocks: OrderBlock[]
  private _toX: (time: string | number) => number | null
  private _toY: (price: number) => number | null
  private _rightEdge: () => number

  constructor(
    blocks: OrderBlock[],
    toX: (time: string | number) => number | null,
    toY: (price: number) => number | null,
    rightEdge: () => number
  ) {
    this._blocks = blocks
    this._toX = toX
    this._toY = toY
    this._rightEdge = rightEdge
  }

  draw(target: any) {
    const w = window as any
    w.__obDrawCalls = (w.__obDrawCalls || 0) + 1
    target.useMediaCoordinateSpace(({ context: ctx, mediaSize, bitmapSize }: any) => {
      w.__obDrawMediaCalls = (w.__obDrawMediaCalls || 0) + 1
      w.__obLastMediaSize = mediaSize
      w.__obLastBitmapSize = bitmapSize
      // TEMP sanity check: an unconditional, impossible-to-miss shape to
      // confirm this primitive's canvas layer is actually visible at all,
      // independent of any coordinate math.
      ctx.fillStyle = 'rgba(255,0,255,0.9)'
      ctx.fillRect(50, 50, 300, 200)
      for (const b of this._blocks) {
        const x1 = this._toX(b.startTime)
        const y1 = this._toY(b.top)
        const y2 = this._toY(b.bottom)
        if (x1 == null || y1 == null || y2 == null) continue
        const x2 = b.endTime != null ? this._toX(b.endTime) ?? this._rightEdge() : this._rightEdge()

        const isBull = b.type === 'bullish'
        ctx.fillStyle = b.mitigated
          ? isBull
            ? 'rgba(22,163,74,0.08)'
            : 'rgba(220,38,38,0.08)'
          : isBull
          ? 'rgba(22,163,74,0.22)'
          : 'rgba(220,38,38,0.22)'
        ctx.fillRect(x1, Math.min(y1, y2), Math.max(1, x2 - x1), Math.abs(y2 - y1))

        ctx.strokeStyle = isBull ? 'rgba(22,163,74,0.6)' : 'rgba(220,38,38,0.6)'
        ctx.lineWidth = 1
        ctx.strokeRect(x1, Math.min(y1, y2), Math.max(1, x2 - x1), Math.abs(y2 - y1))
      }
    })
  }
}

class OrderBlockPaneView {
  private _source: OrderBlockPrimitive
  constructor(source: OrderBlockPrimitive) {
    this._source = source
  }
  // Draw above the candle series -- default z-order sits behind/level with
  // the series, which was silently hiding every box under the candles
  // (confirmed via logged draw coordinates matching the visible chart area
  // exactly, yet nothing rendered -- a z-order issue, not a coordinate bug).
  zOrder(): 'top' {
    return 'top'
  }
  renderer() {
    const s = this._source
    if (!s.series || !s.chart) return null
    return new OrderBlockPaneRenderer(
      s.blocks,
      (time) => s.chart!.timeScale().timeToCoordinate(s.shiftTime(time) as any),
      (price) => s.series!.priceToCoordinate(price),
      () => s.chart!.timeScale().width()
    )
  }
}

export class OrderBlockPrimitive {
  blocks: OrderBlock[] = []
  chart: any = null
  series: any = null
  shiftTime: (t: string | number) => string | number
  private _paneViews: OrderBlockPaneView[]
  private _requestUpdate: (() => void) | null = null

  constructor(shiftTime: (t: string | number) => string | number) {
    this.shiftTime = shiftTime
    this._paneViews = [new OrderBlockPaneView(this)]
  }

  attached(param: { chart: any; series: any; requestUpdate: () => void }) {
    this.chart = param.chart
    this.series = param.series
    this._requestUpdate = param.requestUpdate
  }

  detached() {
    this.chart = null
    this.series = null
  }

  updateAllViews() {}

  paneViews() {
    return this._paneViews
  }

  setBlocks(blocks: OrderBlock[]) {
    this.blocks = blocks
    this._requestUpdate?.()
  }
}
