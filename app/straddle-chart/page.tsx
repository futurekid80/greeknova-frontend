'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Navbar from '@/components/Navbar'

const API = 'https://api.greeknova.com'
const SYMBOLS = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY'] as const
type Symbol = typeof SYMBOLS[number]

type Point = { time: number; ce: number; pe: number; combined: number }
type ChartData = {
  symbol: string
  date: string
  expiry: string
  available_expiries: string[]
  strike: number
  available_strikes: number[]
  cmp: number | null
  points: Point[]
  day_open_combined: number | null
  latest_combined: number | null
  error?: string
}

const CHART_HEIGHT = 480

// BUG FIX (Oct 5 2026): same fix as StockChart.tsx -- lightweight-charts
// renders numeric Time values in UTC with no display-timezone option, so
// the true-UTC epoch seconds from the backend showed 5h30m behind real
// IST clock time. Shift every point by the IST offset right before it
// reaches the chart (setData calls only -- backend data/stat cards stay
// on true epoch, nothing else depends on these values).
const IST_OFFSET_SEC = 19800 // 5h30m
const chartTime = (t: number): any => t + IST_OFFSET_SEC

const fmt = (n: number | null | undefined, d = 2) =>
  n === null || n === undefined ? '—' : n.toLocaleString('en-IN', { maximumFractionDigits: d, minimumFractionDigits: d })

export default function StraddleChartPage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<any>(null)

  const [symbol, setSymbol] = useState<Symbol>('NIFTY')
  const [strike, setStrike] = useState<number | null>(null)
  const [expiry, setExpiry] = useState<string | null>(null)
  const [data, setData] = useState<ChartData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [vwapPoints, setVwapPoints] = useState<{ time: number; value: number }[]>([])
  const [spotPoints, setSpotPoints] = useState<{ time: number; value: number }[]>([])

  const load = useCallback(async (sym: Symbol, strikeOverride: number | null, expiryOverride: string | null) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ t: String(Date.now()) })
      if (strikeOverride != null) params.set('strike', String(strikeOverride))
      if (expiryOverride) params.set('expiry', expiryOverride)
      const [res, chartRes] = await Promise.all([
        fetch(`${API}/straddle-chart/${sym}?${params}`, { cache: 'no-store' }),
        // Spot + VWAP come from the same intraday candle endpoint the Price
        // Chart page uses — option sellers watch spot vs VWAP for direction
        // bias while the straddle premium itself is on a different scale,
        // so both get plotted in a separate chart pane.
        fetch(`${API}/chart-data/${sym}?interval=minute&range=1d&t=${Date.now()}`, { cache: 'no-store' }).catch(() => null),
      ])
      const j: ChartData = await res.json()
      if (j.error) {
        setError(j.error)
        setData(null)
        setVwapPoints([])
        setSpotPoints([])
      } else {
        setData(j)
        setStrike(j.strike)
        setExpiry(j.expiry)

        if (chartRes) {
          try {
            const cj = await chartRes.json()
            const allCandles = cj.candles || []
            // BUG FIX (Oct 5 2026): /chart-data?range=1d deliberately returns
            // up to 5 CALENDAR days of candles (so the 1D view still has data
            // right after a weekend/holiday -- see chart_data.py) while the
            // straddle series itself is always exactly one trading day. Left
            // untrimmed, Spot/VWAP carried several days of history against
            // Combined/CE/PE's single day: the two mismatched date ranges
            // made Spot/VWAP look "frozen" when panning -- it wasn't frozen,
            // its time domain was just several times wider, so the same drag
            // distance moved it proportionally far less. Trim to the most
            // recent trading day's candles only, same technique StockChart.tsx
            // uses for its own 1D session view, so Spot/VWAP cover exactly
            // the same window as the straddle premium series.
            const toIstDate = (epochSec: number) =>
              new Date(epochSec * 1000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
            const lastDate = allCandles.length ? toIstDate(allCandles[allCandles.length - 1].time) : null
            const candles = lastDate ? allCandles.filter((c: any) => toIstDate(c.time) === lastDate) : allCandles
            setSpotPoints(candles.map((c: any) => ({ time: c.time, value: c.close })))
            let cumPV = 0
            let cumVol = 0
            setVwapPoints(
              candles.map((c: any) => {
                const typical = (c.high + c.low + c.close) / 3
                cumPV += typical * (c.volume || 0)
                cumVol += c.volume || 0
                return { time: c.time, value: cumVol > 0 ? cumPV / cumVol : typical }
              })
            )
          } catch {
            setSpotPoints([])
            setVwapPoints([])
          }
        }
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load straddle chart')
      setData(null)
    }
    setLoading(false)
  }, [])

  // Symbol switch resets strike/expiry selection — new symbol, new chain
  useEffect(() => {
    setStrike(null)
    setExpiry(null)
    load(symbol, null, null)
  }, [symbol, load])

  useEffect(() => {
    let disposed = false
    async function render() {
      if (!data || !data.points.length || !containerRef.current) return
      const { createChart, LineSeries, ColorType } = await import('lightweight-charts')
      if (disposed || !containerRef.current) return

      if (chartRef.current) {
        chartRef.current.remove()
        chartRef.current = null
      }

      const chart = createChart(containerRef.current, {
        layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#9ca3af' },
        grid: { vertLines: { color: '#1f2937' }, horzLines: { color: '#1f2937' } },
        width: containerRef.current.clientWidth,
        height: CHART_HEIGHT,
        timeScale: { borderColor: '#374151', timeVisible: true, secondsVisible: false },
        rightPriceScale: { borderColor: '#374151' },
        handleScale: { axisPressedMouseMove: { time: true, price: false }, mouseWheel: true, pinch: true },
        handleScroll: { pressedMouseMove: true, mouseWheel: true, horzTouchDrag: true, vertTouchDrag: false },
      })
      chartRef.current = chart

      // DESIGN FIX (Oct 9 2026): Spot/VWAP and Combined/CE/PE used to share
      // one plot area on two differently-scaled price axes (~22,600 vs
      // ~150-350). Same axes or not, both sets of lines occupied the same
      // pixels, so the chart read as a tangle no matter how the legend
      // labeled them -- that's the "messy, haphazard" complaint. Splitting
      // them into two stacked panes (same synced time axis, independent
      // price scales each) removes the overlap at the source instead of
      // trying to fix it with more labels or colors. Premium (the page's
      // actual subject) gets the larger top pane; Spot/VWAP is directional
      // context in a smaller pane below.
      const combinedSeries = chart.addSeries(LineSeries, { color: '#f59e0b', lineWidth: 3, title: 'Combined (CE+PE)' }, 0)
      combinedSeries.setData(data.points.map((p) => ({ time: chartTime(p.time), value: p.combined })) as any)

      const ceSeries = chart.addSeries(LineSeries, { color: '#16a34a', lineWidth: 1, title: 'CE' }, 0)
      ceSeries.setData(data.points.map((p) => ({ time: chartTime(p.time), value: p.ce })) as any)

      const peSeries = chart.addSeries(LineSeries, { color: '#dc2626', lineWidth: 1, title: 'PE' }, 0)
      peSeries.setData(data.points.map((p) => ({ time: chartTime(p.time), value: p.pe })) as any)

      if (spotPoints.length) {
        const spotSeries = chart.addSeries(LineSeries, { color: '#60a5fa', lineWidth: 1, title: 'Spot' }, 1)
        spotSeries.setData(spotPoints.map((p) => ({ time: chartTime(p.time), value: p.value })) as any)
      }
      if (vwapPoints.length) {
        const vwapSeries = chart.addSeries(LineSeries, {
          color: '#a855f7',
          lineWidth: 2,
          lineStyle: 2, // dashed
          title: 'VWAP',
        }, 1)
        vwapSeries.setData(vwapPoints.map((p) => ({ time: chartTime(p.time), value: p.value })) as any)
      }

      // Premium pane gets roughly 2x the vertical space of the Spot/VWAP
      // context pane below it.
      const panes = chart.panes()
      panes[0]?.setStretchFactor(2)
      panes[1]?.setStretchFactor(1)

      chart.timeScale().fitContent()
    }
    render()
    return () => {
      disposed = true
      if (chartRef.current) {
        chartRef.current.remove()
        chartRef.current = null
      }
    }
  }, [data, spotPoints, vwapPoints])

  useEffect(() => {
    function onResize() {
      if (chartRef.current && containerRef.current) {
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth })
      }
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const changeFromOpen =
    data?.day_open_combined != null && data?.latest_combined != null
      ? data.latest_combined - data.day_open_combined
      : null
  const changeFromOpenPct =
    changeFromOpen != null && data?.day_open_combined
      ? (changeFromOpen / data.day_open_combined) * 100
      : null

  return (
    <div className="min-h-screen bg-[#07070e] text-gray-200">
      <Navbar active="/straddle-chart" />
      <div className="px-4 sm:px-8 py-8 max-w-[1500px] mx-auto">
        <div className="flex items-start justify-between flex-wrap gap-3 mb-2">
          <div>
            <h1 className="text-2xl font-black text-white">🍲 Straddle Chart</h1>
            <p className="text-sm text-gray-500 mt-1">
              Intraday CE+PE combined premium at a fixed strike — watch a straddle actually move through the
              session, not just its payoff at expiry. For a payoff diagram, use Strategy Builder.
            </p>
          </div>
          <button
            onClick={() => load(symbol, strike, expiry)}
            className="px-4 py-2 rounded-lg border border-gray-700 text-sm text-gray-300 hover:border-gray-500"
          >
            Refresh
          </button>
        </div>

        {/* Symbol / strike / expiry controls — one consistent toolbar
            language (segmented control + divided chip group) instead of
            three visually different control styles stacked side by side. */}
        <div className="flex items-center gap-3 flex-wrap mb-5 mt-4 text-xs">
          <div className="flex items-center bg-gray-900/60 border border-gray-800 rounded-lg overflow-hidden">
            {SYMBOLS.map((s, i) => (
              <button
                key={s}
                onClick={() => setSymbol(s)}
                className={`px-3.5 py-2 font-semibold transition-colors ${i > 0 ? 'border-l border-gray-800' : ''} ${
                  symbol === s
                    ? 'bg-amber-950/40 text-amber-400'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {data && (data.available_expiries.length > 0 || data.available_strikes.length > 0 || data.cmp != null) && (
            <div className="flex items-center bg-gray-900/60 border border-gray-800 rounded-lg divide-x divide-gray-800 overflow-hidden">
              {data.available_expiries.length > 0 && (
                <div className="flex items-center gap-2 px-3.5 py-2">
                  <span className="text-gray-500">Expiry</span>
                  <select
                    value={expiry || data.expiry}
                    onChange={(e) => load(symbol, null, e.target.value)}
                    className="bg-transparent text-white font-semibold focus:outline-none cursor-pointer"
                  >
                    {data.available_expiries.map((exp) => (
                      <option key={exp} value={exp} className="bg-gray-900">
                        {new Date(exp + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {data.available_strikes.length > 0 && (
                <div className="flex items-center gap-2 px-3.5 py-2">
                  <span className="text-gray-500">Strike</span>
                  <select
                    value={strike ?? data.strike}
                    onChange={(e) => load(symbol, Number(e.target.value), expiry)}
                    className="bg-transparent text-white font-semibold focus:outline-none cursor-pointer"
                  >
                    {data.available_strikes.map((s) => (
                      <option key={s} value={s} className="bg-gray-900">
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {data.cmp != null && (
                <div className="flex items-center gap-1.5 px-3.5 py-2 text-gray-400">
                  CMP <span className="text-white font-semibold">{fmt(data.cmp)}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="mb-4 bg-red-950/30 border border-red-800/40 rounded-xl px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}
        {loading && <p className="text-gray-500 text-sm">Loading…</p>}

        {!loading && !error && data && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              <div className="bg-gray-900/40 border border-gray-800 rounded-xl px-4 py-3">
                <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Strike</p>
                <p className="text-lg font-black text-white">{data.strike}</p>
              </div>
              <div className="bg-gray-900/40 border border-gray-800 rounded-xl px-4 py-3">
                <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Day Open Combined</p>
                <p className="text-lg font-black text-white">{fmt(data.day_open_combined)}</p>
              </div>
              <div className="bg-gray-900/40 border border-gray-800 rounded-xl px-4 py-3">
                <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Latest Combined</p>
                <p className="text-lg font-black text-white">{fmt(data.latest_combined)}</p>
              </div>
              <div
                className={`rounded-xl px-4 py-3 border ${
                  (changeFromOpen ?? 0) <= 0
                    ? 'bg-emerald-950/20 border-emerald-900/40'
                    : 'bg-red-950/20 border-red-900/40'
                }`}
              >
                <p
                  className={`text-[10px] uppercase tracking-wide mb-1 ${
                    (changeFromOpen ?? 0) <= 0 ? 'text-emerald-600' : 'text-red-500'
                  }`}
                >
                  Change from Open
                </p>
                <p className={`text-lg font-black ${(changeFromOpen ?? 0) <= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {changeFromOpen != null ? (changeFromOpen >= 0 ? '+' : '') + fmt(changeFromOpen) : '—'}
                  {changeFromOpenPct != null && (
                    <span className="text-xs ml-1 font-normal opacity-70">
                      ({changeFromOpenPct >= 0 ? '+' : ''}
                      {fmt(changeFromOpenPct, 1)}%)
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="bg-gray-900/20 border border-gray-800 rounded-xl p-4">
              {/* Legend grouped by pane, so it reads as "two charts, clearly
                  labeled" instead of one flat row of five mixed-scale lines. */}
              <div className="flex flex-col gap-2 mb-3 text-xs">
                <div className="flex items-center gap-4 flex-wrap">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-600 w-16 shrink-0">
                    Premium
                  </span>
                  <span className="flex items-center gap-1.5 text-amber-400">
                    <span className="w-3 h-0.5 bg-amber-500 inline-block" /> Combined (CE+PE)
                  </span>
                  <span className="flex items-center gap-1.5 text-emerald-400">
                    <span className="w-3 h-0.5 bg-emerald-500 inline-block" /> CE
                  </span>
                  <span className="flex items-center gap-1.5 text-red-400">
                    <span className="w-3 h-0.5 bg-red-500 inline-block" /> PE
                  </span>
                </div>
                <div className="flex items-center gap-4 flex-wrap">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-600 w-16 shrink-0">
                    Price
                  </span>
                  <span className="flex items-center gap-1.5 text-blue-400">
                    <span className="w-3 h-0.5 bg-blue-400 inline-block" /> Spot
                  </span>
                  <span className="flex items-center gap-1.5 text-purple-400">
                    <span className="w-3 border-t-2 border-dashed border-purple-400 inline-block" /> VWAP
                  </span>
                </div>
              </div>
              <div ref={containerRef} />
            </div>

            <p className="text-xs text-gray-600 mt-3">
              Strike is fixed for the day (defaults to ATM at the first capture) — switching symbols or picking a
              different strike/expiry reloads the series. Indices only for now.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
