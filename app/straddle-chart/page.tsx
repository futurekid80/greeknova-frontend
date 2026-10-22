'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Navbar from '@/components/Navbar'

const API = 'https://api.greeknova.com'
const SYMBOLS = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY', 'SENSEX'] as const
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

const CHART_HEIGHT = 560 // taller now: 3 stacked panes instead of 2 (Oct 18 2026 redesign)

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
      // Oct 22 2026: Spot/VWAP overlay removed -- it depended on
      // /chart-data, which fails platform-wide right now (Kite Connect's
      // Historical Data API isn't subscribed on the production app -- see
      // Navbar.tsx for the full story). Leaving it in meant every load of
      // this page paid for a guaranteed-to-fail fetch before it could
      // finish. spotPoints/vwapPoints stay declared as permanently-empty
      // state below so the chart-render effect and derived badges degrade
      // to "no overlay" cleanly -- re-add this fetch the moment Historical
      // Data is sorted (see git history for the removed version).
      const res = await fetch(`${API}/straddle-chart/${sym}?${params}`, { cache: 'no-store' })
      const j: ChartData = await res.json()
      if (j.error) {
        setError(j.error)
        setData(null)
      } else {
        setData(j)
        setStrike(j.strike)
        setExpiry(j.expiry)
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
      const { createChart, LineSeries, BaselineSeries, ColorType } = await import('lightweight-charts')
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

      // DESIGN FIX (Oct 18 2026): replaces the Oct 9 2026 two-pane layout.
      // That fix solved the axis-scale collision (CE/PE/Combined vs
      // Spot/VWAP) but left two panes that didn't read as useful: CE and PE
      // sat as two near-parallel flat lines in the Premium pane telling no
      // real story, and Spot/VWAP in their own pane move so closely
      // together most sessions that the pane looked dead even though it
      // was rendering correctly ("all disoriented... CE/PE doing nothing...
      // Spot/VWAP sitting down doing nothing" -- Manish, Oct 18 2026).
      // Three panes now, each with one job: Combined premium (magnitude,
      // unchanged), Call-Put Skew (which leg is pricier right now, a
      // BaselineSeries that colors itself green/red around zero instead of
      // two flat lines), Spot vs VWAP (spot's %% distance from VWAP, same
      // diverging treatment, so "above or below" reads as a color instead
      // of comparing two squiggly price lines across panes). Previewed as
      // a mocked artifact and approved before building this.
      const combinedSeries = chart.addSeries(LineSeries, { color: '#f59e0b', lineWidth: 3, title: 'Combined (CE+PE)' }, 0)
      combinedSeries.setData(data.points.map((p) => ({ time: chartTime(p.time), value: p.combined })) as any)

      if (data.points.length) {
        const skewSeries = chart.addSeries(BaselineSeries, {
          baseValue: { type: 'price', price: 0 },
          topLineColor: '#22c55e', topFillColor1: 'rgba(34,197,94,0.28)', topFillColor2: 'rgba(34,197,94,0.02)',
          bottomLineColor: '#ef4444', bottomFillColor1: 'rgba(239,68,68,0.02)', bottomFillColor2: 'rgba(239,68,68,0.26)',
          lineWidth: 2,
          title: 'Call − Put Skew',
        }, 1)
        skewSeries.setData(data.points.map((p) => ({ time: chartTime(p.time), value: p.ce - p.pe })) as any)
      }

      // Spot/VWAP deviation needs both arrays aligned by index -- they're
      // built from the same `candles` map in `load()` above, so index i in
      // each shares the same timestamp.
      if (spotPoints.length && vwapPoints.length) {
        const devPoints = spotPoints.map((sp, i) => {
          const vw = vwapPoints[i]?.value
          return vw ? { time: sp.time, value: ((sp.value - vw) / vw) * 100 } : null
        }).filter(Boolean) as { time: number; value: number }[]
        if (devPoints.length) {
          const vwapDevSeries = chart.addSeries(BaselineSeries, {
            baseValue: { type: 'price', price: 0 },
            topLineColor: '#22c55e', topFillColor1: 'rgba(34,197,94,0.28)', topFillColor2: 'rgba(34,197,94,0.02)',
            bottomLineColor: '#ef4444', bottomFillColor1: 'rgba(239,68,68,0.02)', bottomFillColor2: 'rgba(239,68,68,0.26)',
            lineWidth: 2,
            title: 'Spot vs VWAP %',
          }, 2)
          vwapDevSeries.setData(devPoints as any)
        }
      }

      // Premium pane gets roughly 3x the vertical space of each context
      // pane below it.
      const panes = chart.panes()
      panes[0]?.setStretchFactor(3)
      panes[1]?.setStretchFactor(1)
      panes[2]?.setStretchFactor(1)

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
              {/* DESIGN FIX (Oct 18 2026): legend now matches the 3-pane
                  layout above -- Premium (just Combined now), Skew (CE vs
                  PE as one diverging line instead of two flat ones), and
                  Spot vs VWAP (as a %% deviation instead of two raw price
                  lines). */}
              <div className="flex flex-col gap-2 mb-3 text-xs">
                <div className="flex items-center gap-4 flex-wrap">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-600 w-20 shrink-0">
                    Premium
                  </span>
                  <span className="flex items-center gap-1.5 text-amber-400">
                    <span className="w-3 h-0.5 bg-amber-500 inline-block" /> Combined (CE+PE)
                  </span>
                </div>
                <div className="flex items-center gap-4 flex-wrap">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-600 w-20 shrink-0">
                    Skew
                  </span>
                  <span className="flex items-center gap-1.5 text-emerald-400">
                    <span className="w-3 h-0.5 bg-emerald-500 inline-block" /> Calls richer
                  </span>
                  <span className="flex items-center gap-1.5 text-red-400">
                    <span className="w-3 h-0.5 bg-red-500 inline-block" /> Puts richer
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
