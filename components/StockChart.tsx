'use client'
import { useEffect, useRef, useState } from 'react'

const API = 'https://api.greeknova.com'

type Candle = { time: string; open: number; high: number; low: number; close: number; volume: number }
type RangeKey = '1m' | '3m' | '6m' | '1y'

export default function StockChart({ symbol }: { symbol: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<any>(null)
  const [range, setRange] = useState<RangeKey>('6m')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let disposed = false
    let chart: any = null

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`${API}/chart-data/${symbol}?interval=day&range=${range}&t=${Date.now()}`, {
          cache: 'no-store',
        })
        const json = await res.json()
        if (disposed) return
        if (json.error || !json.candles?.length) {
          setError(json.error || 'No chart data available')
          setLoading(false)
          return
        }

        const { createChart, CandlestickSeries, HistogramSeries, ColorType } = await import('lightweight-charts')
        if (disposed || !containerRef.current) return

        if (chartRef.current) {
          chartRef.current.remove()
          chartRef.current = null
        }

        chart = createChart(containerRef.current, {
          layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#9ca3af' },
          grid: { vertLines: { color: '#1f2937' }, horzLines: { color: '#1f2937' } },
          width: containerRef.current.clientWidth,
          height: 300,
          timeScale: { borderColor: '#374151' },
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

        chart.timeScale().fitContent()
        setLoading(false)
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
      }
    }
  }, [symbol, range])

  return (
    <div className="bg-gray-950/40 border border-gray-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-gray-400 font-bold">📈 Price Chart</p>
        <div className="flex gap-1">
          {(['1m', '3m', '6m', '1y'] as RangeKey[]).map((r) => (
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
      {loading && <div className="h-[300px] flex items-center justify-center text-sm text-gray-600">Loading chart...</div>}
      {error && !loading && (
        <div className="h-[300px] flex items-center justify-center text-sm text-gray-600">{error}</div>
      )}
      <div ref={containerRef} className={loading || error ? 'hidden' : ''} />
    </div>
  )
}
