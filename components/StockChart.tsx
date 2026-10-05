'use client'
import { useEffect, useRef, useState } from 'react'

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
  const [range, setRange] = useState<RangeKey>('6m')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // OI Profile / GEX levels are daily reference levels (not tied to the
  // intraday/day candle split like VWAP+CPR), so they're opt-in toggles
  // that overlay on top of whatever range is already showing, drawn as
  // price lines on the existing candle series rather than rebuilding the
  // whole chart.
  const [showOI, setShowOI] = useState(false)
  const [showGEX, setShowGEX] = useState(false)
  const [showEMA, setShowEMA] = useState(false)
  const [showRSI, setShowRSI] = useState(false)
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
          json.candles.map((c: Candle) => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close }))
        )
        candleSeriesRef.current = candleSeries
        candlesRef.current = json.candles
        oiLinesRef.current = []
        gexLinesRef.current = []
        emaSeriesRef.current = []
        rsiSeriesRef.current = null

        const volumeSeries = chart.addSeries(HistogramSeries, {
          color: '#374151',
          priceFormat: { type: 'volume' },
          priceScaleId: '',
        })
        volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } })
        volumeSeries.setData(
          json.candles.map((c: Candle) => ({
            time: c.time,
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
            return { time: c.time, value: cumVol > 0 ? cumPV / cumVol : typical }
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

        chart.timeScale().fitContent()
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
        series.setData(data)
        emaSeriesRef.current.push(series)
      }
    })
  }, [showEMA, chartVersion])

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
      series.setData(data)
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
        </div>
      </div>
      <div className="relative w-full" style={{ height: CHART_HEIGHT + (showRSI ? RSI_PANE_HEIGHT : 0) }}>
        <div ref={containerRef} className="w-full h-full" />
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
