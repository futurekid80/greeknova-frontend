'use client'
import { useEffect, useRef, useState } from 'react'
import { detectOrderBlocks, type OrderBlock } from '@/lib/orderBlocks'
import { detectFVG, detectStructureBreaks, detectLiquiditySweeps, type FVG } from '@/lib/smc'

const API = 'https://api.greeknova.com'

// `time` is a "YYYY-MM-DD" string for daily candles, or a Unix timestamp
// (seconds) for intraday candles -- lightweight-charts requires the latter
// numeric form for anything with a time-of-day component.
type Candle = { time: string | number; open: number; high: number; low: number; close: number; volume: number }
type RangeKey = '1d' | '1m' | '3m' | '6m' | '1y'

const CPR_LINE_STYLE = 2 // LineStyle.Dashed
const LEVEL_LINE_STYLE = 2 // LineStyle.Dashed
const CHART_HEIGHT = 520
const RSI_PANE_HEIGHT = 160

// BUG FIX (Oct 5 2026): lightweight-charts always renders numeric Time
// values (intraday Unix timestamps) using UTC -- it has no "display
// timezone" option, unlike the date-string business-day type used for
// daily candles. The backend correctly sends true UTC epoch seconds, so
// without this, every intraday chart showed times 5:30 behind real IST
// clock time. Fix: shift numeric timestamps by the IST offset before
// handing them to the chart, so its UTC-formatted labels read correctly
// as IST. Date-string times (daily candles) are untouched -- those are
// already timezone-agnostic "business days". Only applied right before
// data reaches the chart API (setData / setVisibleRange); all other
// logic (toIstDate session-boundary detection, EMA/RSI math) keeps using
// the true, unshifted epoch from candlesRef.
const IST_OFFSET_SEC = 19800 // 5h30m
const chartTime = (t: string | number): any => (typeof t === 'number' ? t + IST_OFFSET_SEC : t)

// EMA: standard exponential moving average, seeded with an SMA of the
// first `period` closes (the usual convention) rather than seeding from
// the very first close, which would skew early values.
function computeEMA(candles: Candle[], period: number): { time: string | number; value: number }[] {
  if (candles.length < period) return []
  const k = 2 / (period + 1)
  const out: { time: string | number; value: number }[] = []
  let sma = 0
  for (let i = 0; i < period; i++) sma += candles[i].close
  sma /= period
  let prev = sma
  out.push({ time: candles[period - 1].time, value: sma })
  for (let i = period; i < candles.length; i++) {
    prev = candles[i].close * k + prev * (1 - k)
    out.push({ time: candles[i].time, value: prev })
  }
  return out
}

// RSI(14), Wilder's smoothing (the standard RSI definition -- a plain
// moving average of gains/losses instead understates the indicator and
// won't match what traders see on TradingView/Zerodha).
function computeRSI(candles: Candle[], period = 14): { time: string | number; value: number }[] {
  if (candles.length < period + 1) return []
  const out: { time: string | number; value: number }[] = []
  let gainSum = 0
  let lossSum = 0
  for (let i = 1; i <= period; i++) {
    const diff = candles[i].close - candles[i - 1].close
    if (diff > 0) gainSum += diff
    else lossSum += -diff
  }
  let avgGain = gainSum / period
  let avgLoss = lossSum / period
  const rsiAt = (ag: number, al: number) => (al === 0 ? 100 : 100 - 100 / (1 + ag / al))
  out.push({ time: candles[period].time, value: rsiAt(avgGain, avgLoss) })
  for (let i = period + 1; i < candles.length; i++) {
    const diff = candles[i].close - candles[i - 1].close
    const gain = diff > 0 ? diff : 0
    const loss = diff < 0 ? -diff : 0
    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period
    out.push({ time: candles[i].time, value: rsiAt(avgGain, avgLoss) })
  }
  return out
}

export default function StockChart({ symbol }: { symbol: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<any>(null)
  const candleSeriesRef = useRef<any>(null)
  const candlesRef = useRef<Candle[]>([])
  const oiLinesRef = useRef<any[]>([])
  const gexLinesRef = useRef<any[]>([])
  const emaSeriesRef = useRef<any[]>([])
  const rsiSeriesRef = useRef<any>(null)
  const obBlocksRef = useRef<OrderBlock[]>([])
  const obUnsubRef = useRef<(() => void) | null>(null)
  const fvgBlocksRef = useRef<FVG[]>([])
  const fvgUnsubRef = useRef<(() => void) | null>(null)
  const smcMarkersPluginRef = useRef<any>(null)
  const [range, setRange] = useState<RangeKey>('6m')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Pixel rects for the Order Block / FVG overlays (DOM divs, not a canvas
  // series -- see the showOB effect below for why), recomputed whenever the
  // chart's visible range changes (pan/zoom) or new data loads.
  const [obRects, setObRects] = useState<
    { left: number; top: number; width: number; height: number; type: 'bullish' | 'bearish'; mitigated: boolean }[]
  >([])
  const [fvgRects, setFvgRects] = useState<
    { left: number; top: number; width: number; height: number; type: 'bullish' | 'bearish'; mitigated: boolean }[]
  >([])
  // OI Profile / GEX levels are daily reference levels (not tied to the
  // intraday/day candle split like VWAP+CPR), so they're opt-in toggles
  // that overlay on top of whatever range is already showing, drawn as
  // price lines on the existing candle series rather than rebuilding the
  // whole chart.
  const [showOI, setShowOI] = useState(false)
  const [showGEX, setShowGEX] = useState(false)
  const [showEMA, setShowEMA] = useState(false)
  const [showRSI, setShowRSI] = useState(false)
  const [showOB, setShowOB] = useState(false)
  const [showFVG, setShowFVG] = useState(false)
  const [showStructure, setShowStructure] = useState(false)
  const [showLiquidity, setShowLiquidity] = useState(false)
  const [chartVersion, setChartVersion] = useState(0)

  useEffect(() => {
    let disposed = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const interval = range === '1d' ? 'minute' : 'day'
        const fetches: Promise<any>[] = [
          fetch(`${API}/chart-data/${symbol}?interval=${interval}&range=${range}&t=${Date.now()}`, {
            cache: 'no-store',
          }).then((r) => r.json()),
        ]
        // CPR (pivot/TC/BC) is a daily reference level -- only meaningful
        // overlaid on the intraday view, not stretched across months of candles
        if (range === '1d') {
          fetches.push(
            fetch(`${API}/cpr-levels/${symbol}?t=${Date.now()}`, { cache: 'no-store' })
              .then((r) => r.json())
              .catch(() => null)
          )
        }
        const [json, cprResp] = await Promise.all(fetches)
        if (disposed) return
        if (json.error || !json.candles?.length) {
          setError(json.error || 'No chart data available')
          setLoading(false)
          return
        }

        const { createChart, CandlestickSeries, HistogramSeries, LineSeries, ColorType } = await import(
          'lightweight-charts'
        )
        if (disposed || !containerRef.current) return

        if (chartRef.current) {
          chartRef.current.remove()
          chartRef.current = null
        }

        const chart = createChart(containerRef.current, {
          layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#9ca3af' },
          grid: { vertLines: { color: '#1f2937' }, horzLines: { color: '#1f2937' } },
          width: containerRef.current.clientWidth,
          height: CHART_HEIGHT + (showRSI ? RSI_PANE_HEIGHT : 0),
          timeScale: { borderColor: '#374151', timeVisible: range === '1d', secondsVisible: false },
          rightPriceScale: { borderColor: '#374151' },
        })
        chartRef.current = chart

        const candleSeries = chart.addSeries(CandlestickSeries, {
          upColor: '#16a34a',
          downColor: '#dc2626',
          borderVisible: false,
          wickUpColor: '#16a34a',
          wickDownColor: '#dc2626',
        })
        candleSeries.setData(
          json.candles.map((c: Candle) => ({ time: chartTime(c.time), open: c.open, high: c.high, low: c.low, close: c.close }))
        )
        candleSeriesRef.current = candleSeries
        candlesRef.current = json.candles
        oiLinesRef.current = []
        gexLinesRef.current = []
        emaSeriesRef.current = []
        rsiSeriesRef.current = null
        if (obUnsubRef.current) {
          obUnsubRef.current()
          obUnsubRef.current = null
        }
        setObRects([])
        if (fvgUnsubRef.current) {
          fvgUnsubRef.current()
          fvgUnsubRef.current = null
        }
        setFvgRects([])
        // The old chart instance (and everything attached to it, including
        // this plugin) was just .remove()'d above -- drop the stale
        // reference so the structure/liquidity effect creates a fresh one
        // on the new chart instead of calling setMarkers on a dead plugin.
        smcMarkersPluginRef.current = null

        const volumeSeries = chart.addSeries(HistogramSeries, {
          color: '#374151',
          priceFormat: { type: 'volume' },
          priceScaleId: '',
        })
        volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } })
        volumeSeries.setData(
          json.candles.map((c: Candle) => ({
            time: chartTime(c.time),
            value: c.volume,
            color: c.close >= c.open ? '#16a34a33' : '#dc262633',
          }))
        )

        // VWAP -- only meaningful intraday (resets each session); computed
        // client-side from the same minute candles, no extra backend call
        if (range === '1d') {
          let cumPV = 0
          let cumVol = 0
          const vwapData = json.candles.map((c: Candle) => {
            const typical = (c.high + c.low + c.close) / 3
            cumPV += typical * (c.volume || 0)
            cumVol += c.volume || 0
            return { time: chartTime(c.time), value: cumVol > 0 ? cumPV / cumVol : typical }
          })
          const vwapSeries = chart.addSeries(LineSeries, {
            color: '#3b82f6',
            lineWidth: 2,
            title: 'VWAP',
            priceLineVisible: false,
            lastValueVisible: false,
          })
          vwapSeries.setData(vwapData)

          // CPR (pivot/TC/BC) as dashed horizontal reference levels
          const cpr = cprResp?.cpr
          if (cpr) {
            candleSeries.createPriceLine({
              price: cpr.pivot,
              color: '#eab308',
              lineWidth: 1,
              lineStyle: CPR_LINE_STYLE,
              axisLabelVisible: true,
              title: 'Pivot',
            })
            candleSeries.createPriceLine({
              price: cpr.tc,
              color: '#6b7280',
              lineWidth: 1,
              lineStyle: CPR_LINE_STYLE,
              axisLabelVisible: true,
              title: 'TC',
            })
            candleSeries.createPriceLine({
              price: cpr.bc,
              color: '#6b7280',
              lineWidth: 1,
              lineStyle: CPR_LINE_STYLE,
              axisLabelVisible: true,
              title: 'BC',
            })
          }
        }

        if (range === '1d') {
          // Focus on just the most recent trading session instead of the
          // full multi-day fetch window (widened to 5 days so the 1D view
          // always reaches the last real session across weekends/holidays)
          // -- fitContent() alone would zoom out to show all of it, leaving
          // today's handful of candles squeezed flat at one edge.
          const toIstDate = (epochSec: number) =>
            new Date(epochSec * 1000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
          const lastTime = json.candles[json.candles.length - 1].time as number
          const lastDate = toIstDate(lastTime)
          const sessionStartCandle = json.candles.find((c: Candle) => toIstDate(c.time as number) === lastDate)
          if (sessionStartCandle) {
            chart.timeScale().setVisibleRange({ from: chartTime(sessionStartCandle.time), to: chartTime(lastTime) })
          } else {
            chart.timeScale().fitContent()
          }
        } else {
          chart.timeScale().fitContent()
        }
        setLoading(false)
        // candleSeriesRef/chart are freshly (re)built here — bump so the
        // OI/GEX overlay effects below know to (re)draw onto the new series
        setChartVersion((v) => v + 1)
      } catch (e: any) {
        if (!disposed) {
          setError(e?.message || 'Failed to load chart')
          setLoading(false)
        }
      }
    }
    load()

    return () => {
      disposed = true
      if (chartRef.current) {
        chartRef.current.remove()
        chartRef.current = null
        candleSeriesRef.current = null
      }
    }
  }, [symbol, range])

  // OI Profile overlay: CE Wall (resistance), PE Wall (support), POC
  useEffect(() => {
    const series = candleSeriesRef.current
    if (!series) return
    for (const line of oiLinesRef.current) {
      try { series.removePriceLine(line) } catch {}
    }
    oiLinesRef.current = []
    if (!showOI) return

    let cancelled = false
    fetch(`${API}/oi-profile/${symbol}?t=${Date.now()}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || !data || data.error || candleSeriesRef.current !== series) return
        const specs: [number | null | undefined, string, string][] = [
          [data.ce_wall, '#dc2626', 'OI: CE Wall'],
          [data.pe_wall, '#16a34a', 'OI: PE Wall'],
          [data.poc_strike, '#a855f7', 'OI: POC'],
        ]
        for (const [price, color, title] of specs) {
          if (price == null) continue
          const line = series.createPriceLine({
            price,
            color,
            lineWidth: 1,
            lineStyle: LEVEL_LINE_STYLE,
            axisLabelVisible: true,
            title,
          })
          oiLinesRef.current.push(line)
        }
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [symbol, showOI, chartVersion])

  // GEX overlay: Call Wall, Put Wall, Gamma Flip Point
  useEffect(() => {
    const series = candleSeriesRef.current
    if (!series) return
    for (const line of gexLinesRef.current) {
      try { series.removePriceLine(line) } catch {}
    }
    gexLinesRef.current = []
    if (!showGEX) return

    let cancelled = false
    fetch(`${API}/gamma-by-strike/${symbol}?t=${Date.now()}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || !data || data.error || candleSeriesRef.current !== series) return
        const specs: [number | null | undefined, string, string][] = [
          [data.call_wall_strike, '#f97316', 'GEX: Call Wall'],
          [data.put_wall_strike, '#0ea5e9', 'GEX: Put Wall'],
          [data.flip_point, '#e5e7eb', 'GEX: Gamma Flip'],
        ]
        for (const [price, color, title] of specs) {
          if (price == null) continue
          const line = series.createPriceLine({
            price,
            color,
            lineWidth: 1,
            lineStyle: LEVEL_LINE_STYLE,
            axisLabelVisible: true,
            title,
          })
          gexLinesRef.current.push(line)
        }
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [symbol, showGEX, chartVersion])

  // EMA 20/50 overlay -- computed client-side from the already-loaded
  // candles (no extra backend call), same pattern as VWAP
  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    for (const s of emaSeriesRef.current) {
      try { chart.removeSeries(s) } catch {}
    }
    emaSeriesRef.current = []
    if (!showEMA) return

    import('lightweight-charts').then(({ LineSeries }) => {
      if (chartRef.current !== chart) return
      const candles = candlesRef.current
      const specs: [number, string][] = [
        [20, '#fbbf24'],
        [50, '#38bdf8'],
      ]
      for (const [period, color] of specs) {
        const data = computeEMA(candles, period)
        if (!data.length) continue
        const series = chart.addSeries(LineSeries, {
          color,
          lineWidth: 1,
          title: `EMA ${period}`,
          priceLineVisible: false,
          lastValueVisible: true,
        })
        series.setData(data.map((d) => ({ time: chartTime(d.time), value: d.value })))
        emaSeriesRef.current.push(series)
      }
    })
  }, [showEMA, chartVersion])

  // Order Blocks (Smart Money Concepts) -- computed client-side from the
  // already-loaded candles, same pattern as EMA/RSI/VWAP. Drawn as
  // absolutely-positioned DOM rectangles over the chart (see the render
  // below), not a canvas series: lightweight-charts has no built-in series
  // type for boxes, and the v5 Series Primitives (canvas) API -- the
  // "proper" way to draw shapes in sync with the chart -- turned out to
  // silently produce zero pixels in this build despite its draw() callback
  // firing with correct coordinates every time (instrumented and confirmed
  // live: draw() ran, media size matched the chart, fillRect calls
  // happened, yet getImageData showed the target canvas completely
  // untouched). Rather than fight an opaque rendering-pipeline mismatch,
  // this uses the same technique several public lightweight-charts box/
  // zone plugins fall back to: position plain divs using the chart's own
  // timeToCoordinate/priceToCoordinate, recomputed on every pan/zoom via
  // subscribeVisibleTimeRangeChange. Reliable, inspectable in devtools,
  // and needs no canvas-layer debugging ever again.
  useEffect(() => {
    const chart = chartRef.current
    const series = candleSeriesRef.current
    if (obUnsubRef.current) {
      obUnsubRef.current()
      obUnsubRef.current = null
    }
    if (!chart || !series || !showOB) {
      setObRects([])
      return
    }

    obBlocksRef.current = detectOrderBlocks(candlesRef.current)

    const recompute = () => {
      const w = chart.timeScale().width()
      const rects = obBlocksRef.current
        .map((b) => {
          const x1 = chart.timeScale().timeToCoordinate(chartTime(b.startTime))
          const y1 = series.priceToCoordinate(b.top)
          const y2 = series.priceToCoordinate(b.bottom)
          if (x1 == null || y1 == null || y2 == null) return null
          const x2End = b.endTime != null ? chart.timeScale().timeToCoordinate(chartTime(b.endTime)) : null
          const x2 = x2End != null ? x2End : w
          return {
            left: x1,
            top: Math.min(y1, y2),
            width: Math.max(1, x2 - x1),
            height: Math.max(1, Math.abs(y2 - y1)),
            type: b.type,
            mitigated: b.mitigated,
          }
        })
        .filter((r): r is NonNullable<typeof r> => r != null)
      setObRects(rects)
    }

    recompute()
    chart.timeScale().subscribeVisibleTimeRangeChange(recompute)
    obUnsubRef.current = () => {
      try { chart.timeScale().unsubscribeVisibleTimeRangeChange(recompute) } catch {}
    }
  }, [showOB, chartVersion])

  // Fair Value Gaps -- same DOM-overlay technique as Order Blocks above
  // (same reasoning: the canvas Primitives API doesn't render in this
  // build). Kept as its own effect/state/ref set rather than merged with
  // Order Blocks so the two can be toggled independently.
  useEffect(() => {
    const chart = chartRef.current
    const series = candleSeriesRef.current
    if (fvgUnsubRef.current) {
      fvgUnsubRef.current()
      fvgUnsubRef.current = null
    }
    if (!chart || !series || !showFVG) {
      setFvgRects([])
      return
    }

    fvgBlocksRef.current = detectFVG(candlesRef.current)

    const recompute = () => {
      const w = chart.timeScale().width()
      const rects = fvgBlocksRef.current
        .map((b) => {
          const x1 = chart.timeScale().timeToCoordinate(chartTime(b.startTime))
          const y1 = series.priceToCoordinate(b.top)
          const y2 = series.priceToCoordinate(b.bottom)
          if (x1 == null || y1 == null || y2 == null) return null
          const x2End = b.endTime != null ? chart.timeScale().timeToCoordinate(chartTime(b.endTime)) : null
          const x2 = x2End != null ? x2End : w
          return {
            left: x1,
            top: Math.min(y1, y2),
            width: Math.max(1, x2 - x1),
            height: Math.max(1, Math.abs(y2 - y1)),
            type: b.type,
            mitigated: b.mitigated,
          }
        })
        .filter((r): r is NonNullable<typeof r> => r != null)
      setFvgRects(rects)
    }

    recompute()
    chart.timeScale().subscribeVisibleTimeRangeChange(recompute)
    fvgUnsubRef.current = () => {
      try { chart.timeScale().unsubscribeVisibleTimeRangeChange(recompute) } catch {}
    }
  }, [showFVG, chartVersion])

  // Structure breaks (BOS/CHoCH) + liquidity sweeps -- unlike Order Blocks
  // and FVG these are point events, not zones, so they use lightweight-
  // charts' own built-in series-markers plugin instead of DOM overlay divs.
  // This is a core (non-Primitive) API that renders natively and correctly
  // tracks pan/zoom/data updates on its own -- no manual coordinate math
  // needed, unlike the box overlays above.
  useEffect(() => {
    const chart = chartRef.current
    const series = candleSeriesRef.current
    if (!chart || !series) return

    if (!showStructure && !showLiquidity) {
      if (smcMarkersPluginRef.current) smcMarkersPluginRef.current.setMarkers([])
      return
    }

    let cancelled = false
    import('lightweight-charts').then(({ createSeriesMarkers }) => {
      if (cancelled || chartRef.current !== chart || candleSeriesRef.current !== series) return

      const markers: any[] = []
      if (showStructure) {
        for (const b of detectStructureBreaks(candlesRef.current)) {
          const bullish = b.direction === 'bullish'
          markers.push({
            time: chartTime(b.time),
            position: bullish ? 'belowBar' : 'aboveBar',
            color: b.kind === 'CHoCH' ? '#f59e0b' : bullish ? '#16a34a' : '#dc2626',
            shape: bullish ? 'arrowUp' : 'arrowDown',
            text: b.kind,
          })
        }
      }
      if (showLiquidity) {
        for (const s of detectLiquiditySweeps(candlesRef.current)) {
          const buySide = s.side === 'buy-side'
          markers.push({
            time: chartTime(s.time),
            position: buySide ? 'belowBar' : 'aboveBar',
            color: '#a855f7',
            shape: 'circle',
            text: buySide ? 'BSL' : 'SSL',
          })
        }
      }
      // The markers plugin requires ascending time order; string (daily)
      // times sort correctly as plain strings, numeric (intraday) as numbers.
      markers.sort((a, c) => (a.time > c.time ? 1 : a.time < c.time ? -1 : 0))

      if (!smcMarkersPluginRef.current) {
        smcMarkersPluginRef.current = createSeriesMarkers(series, markers)
      } else {
        smcMarkersPluginRef.current.setMarkers(markers)
      }
    })

    return () => {
      cancelled = true
    }
  }, [showStructure, showLiquidity, chartVersion])

  // RSI(14) -- own pane below the main chart (lightweight-charts v5 native
  // multi-pane support), since it's an oscillator on a 0-100 scale and
  // doesn't make sense overlaid on price
  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return

    if (rsiSeriesRef.current) {
      const paneIdx = rsiSeriesRef.current.paneIndex ? rsiSeriesRef.current.paneIndex() : null
      try { chart.removeSeries(rsiSeriesRef.current) } catch {}
      rsiSeriesRef.current = null
      try {
        if (paneIdx != null && chart.panes().length > paneIdx) chart.removePane(paneIdx)
      } catch {}
      if (containerRef.current) {
        chart.resize(containerRef.current.clientWidth, CHART_HEIGHT)
      }
    }
    if (!showRSI) return

    import('lightweight-charts').then(({ LineSeries }) => {
      if (chartRef.current !== chart) return
      const data = computeRSI(candlesRef.current, 14)
      if (!data.length) return
      const series = chart.addSeries(
        LineSeries,
        { color: '#c084fc', lineWidth: 1, title: 'RSI 14', priceLineVisible: false, lastValueVisible: true },
        1
      )
      series.setData(data.map((d) => ({ time: chartTime(d.time), value: d.value })))
      series.createPriceLine({ price: 60, color: '#6b7280', lineWidth: 1, lineStyle: LEVEL_LINE_STYLE, axisLabelVisible: true, title: 'Overbought' })
      series.createPriceLine({ price: 40, color: '#6b7280', lineWidth: 1, lineStyle: LEVEL_LINE_STYLE, axisLabelVisible: true, title: 'Oversold' })
      rsiSeriesRef.current = series

      if (containerRef.current) {
        chart.resize(containerRef.current.clientWidth, CHART_HEIGHT + RSI_PANE_HEIGHT)
      }
      const panes = chart.panes()
      if (panes[0]) panes[0].setHeight(CHART_HEIGHT)
      if (panes[1]) panes[1].setHeight(RSI_PANE_HEIGHT)
    })
  }, [showRSI, chartVersion])

  return (
    <div className="bg-gray-950/40 border border-gray-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <p className="text-xs text-gray-400 font-bold">📈 Price Chart</p>
          {range === '1d' && (
            <span className="text-[10px] text-gray-600">VWAP (blue) · CPR Pivot/TC/BC (dashed)</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <button
              onClick={() => setShowEMA((v) => !v)}
              className={`text-[10px] px-2 py-0.5 rounded font-medium transition-colors ${
                showEMA ? 'bg-amber-900/60 text-amber-300' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
              }`}
              title="EMA 20 (amber) · EMA 50 (sky blue)"
            >
              EMA
            </button>
            <button
              onClick={() => setShowRSI((v) => !v)}
              className={`text-[10px] px-2 py-0.5 rounded font-medium transition-colors ${
                showRSI ? 'bg-violet-900/60 text-violet-300' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
              }`}
              title="RSI (14) in its own pane below, with 60/40 reference lines"
            >
              RSI
            </button>
            <button
              onClick={() => setShowOB((v) => !v)}
              className={`text-[10px] px-2 py-0.5 rounded font-medium transition-colors ${
                showOB ? 'bg-teal-900/60 text-teal-300' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
              }`}
              title="Order Blocks (SMC): bullish (green) · bearish (red) · faded = mitigated"
            >
              Order Blocks
            </button>
            <button
              onClick={() => setShowFVG((v) => !v)}
              className={`text-[10px] px-2 py-0.5 rounded font-medium transition-colors ${
                showFVG ? 'bg-sky-900/60 text-sky-300' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
              }`}
              title="Fair Value Gaps (SMC): bullish (sky blue) · bearish (pink) · faded = filled"
            >
              FVG
            </button>
            <button
              onClick={() => setShowStructure((v) => !v)}
              className={`text-[10px] px-2 py-0.5 rounded font-medium transition-colors ${
                showStructure ? 'bg-amber-900/60 text-amber-300' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
              }`}
              title="Structure (SMC): BOS = trend-continuation break (green/red) · CHoCH = trend reversal (amber)"
            >
              BOS/CHoCH
            </button>
            <button
              onClick={() => setShowLiquidity((v) => !v)}
              className={`text-[10px] px-2 py-0.5 rounded font-medium transition-colors ${
                showLiquidity ? 'bg-purple-900/60 text-purple-300' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
              }`}
              title="Liquidity Sweeps (SMC): wick through a swing high/low that closes back inside -- a stop hunt"
            >
              Liquidity
            </button>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => setShowOI((v) => !v)}
              className={`text-[10px] px-2 py-0.5 rounded font-medium transition-colors ${
                showOI ? 'bg-fuchsia-900/60 text-fuchsia-300' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
              }`}
              title="OI: CE Wall (red) · PE Wall (green) · POC (purple)"
            >
              OI Levels
            </button>
            <button
              onClick={() => setShowGEX((v) => !v)}
              className={`text-[10px] px-2 py-0.5 rounded font-medium transition-colors ${
                showGEX ? 'bg-orange-900/60 text-orange-300' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
              }`}
              title="GEX: Call Wall (orange) · Put Wall (blue) · Gamma Flip (white)"
            >
              GEX Levels
            </button>
          </div>
          <div className="flex gap-1">
            {(['1d', '1m', '3m', '6m', '1y'] as RangeKey[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`text-[10px] px-2 py-0.5 rounded font-medium transition-colors ${
                  range === r ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
                }`}
              >
                {r.toUpperCase()}
              </button>
            ))}
          </div>
          <button
            onClick={() => {
              if (!chartRef.current) return
              if (range === '1d' && candlesRef.current.length) {
                const toIstDate = (epochSec: number) =>
                  new Date(epochSec * 1000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
                const lastTime = candlesRef.current[candlesRef.current.length - 1].time as number
                const lastDate = toIstDate(lastTime)
                const sessionStartCandle = candlesRef.current.find((c) => toIstDate(c.time as number) === lastDate)
                if (sessionStartCandle) {
                  chartRef.current.timeScale().setVisibleRange({ from: chartTime(sessionStartCandle.time), to: chartTime(lastTime) })
                  return
                }
              }
              chartRef.current.timeScale().fitContent()
            }}
            className="text-[10px] px-2 py-0.5 rounded font-medium text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
            title={range === '1d' ? "Reset to today's session" : 'Reset zoom — fit full range'}
          >
            ⟲ Reset
          </button>
        </div>
      </div>
      <div className="relative w-full" style={{ height: CHART_HEIGHT + (showRSI ? RSI_PANE_HEIGHT : 0) }}>
        <div ref={containerRef} className="w-full h-full" />
        {showOB && obRects.length > 0 && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {obRects.map((r, i) => (
              <div
                key={i}
                className="absolute border"
                style={{
                  left: r.left,
                  top: r.top,
                  width: r.width,
                  height: r.height,
                  backgroundColor:
                    r.type === 'bullish'
                      ? r.mitigated
                        ? 'rgba(22,163,74,0.08)'
                        : 'rgba(22,163,74,0.22)'
                      : r.mitigated
                      ? 'rgba(220,38,38,0.08)'
                      : 'rgba(220,38,38,0.22)',
                  borderColor: r.type === 'bullish' ? 'rgba(22,163,74,0.6)' : 'rgba(220,38,38,0.6)',
                }}
              />
            ))}
          </div>
        )}
        {showFVG && fvgRects.length > 0 && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {fvgRects.map((r, i) => (
              <div
                key={i}
                className="absolute border"
                style={{
                  left: r.left,
                  top: r.top,
                  width: r.width,
                  height: r.height,
                  backgroundColor:
                    r.type === 'bullish'
                      ? r.mitigated
                        ? 'rgba(14,165,233,0.08)'
                        : 'rgba(14,165,233,0.22)'
                      : r.mitigated
                      ? 'rgba(236,72,153,0.08)'
                      : 'rgba(236,72,153,0.22)',
                  borderColor: r.type === 'bullish' ? 'rgba(14,165,233,0.6)' : 'rgba(236,72,153,0.6)',
                }}
              />
            ))}
          </div>
        )}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-600 bg-gray-950/40">
            Loading chart...
          </div>
        )}
        {error && !loading && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-600 bg-gray-950/40">
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
