'use client'
import { useEffect, useRef, useState } from 'react'

const API = 'https://api.greeknova.com'

type Candle = { time: string; open: number; high: number; low: number; close: number; volume: number }
type RangeKey = '1d' | '1m' | '3m' | '6m' | '1y'

const CPR_LINE_STYLE = 2 // LineStyle.Dashed
const LEVEL_LINE_STYLE = 2 // LineStyle.Dashed

export default function StockChart({ symbol }: { symbol: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<any>(null)
  const candleSeriesRef = useRef<any>(null)
  const oiLinesRef = useRef<any[]>([])
  const gexLinesRef = useRef<any[]>([])
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
          height: 300,
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
        oiLinesRef.current = []
        gexLinesRef.current = []

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
          [data.ce_wall, '#dc2626', 'CE Wall'],
          [data.pe_wall, '#16a34a', 'PE Wall'],
          [data.poc_strike, '#a855f7', 'POC'],
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
          [data.call_wall_strike, '#f97316', 'Call Wall'],
          [data.put_wall_strike, '#0ea5e9', 'Put Wall'],
          [data.flip_point, '#e5e7eb', 'Gamma Flip'],
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
              onClick={() => setShowOI((v) => !v)}
              className={`text-[10px] px-2 py-0.5 rounded font-medium transition-colors ${
                showOI ? 'bg-fuchsia-900/60 text-fuchsia-300' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
              }`}
              title="CE Wall (red) · PE Wall (green) · POC (purple)"
            >
              OI Levels
            </button>
            <button
              onClick={() => setShowGEX((v) => !v)}
              className={`text-[10px] px-2 py-0.5 rounded font-medium transition-colors ${
                showGEX ? 'bg-orange-900/60 text-orange-300' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
              }`}
              title="Call Wall (orange) · Put Wall (blue) · Gamma Flip (white)"
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
      <div className="relative w-full h-[300px]">
        <div ref={containerRef} className="w-full h-[300px]" />
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
