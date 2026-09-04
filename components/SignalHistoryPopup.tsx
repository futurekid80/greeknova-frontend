'use client'
import { useState, useEffect } from 'react'

const API = 'https://api.greeknova.com'

interface SignalHistoryRow {
  date: string
  signal: string
  fut_oi_chg: number
  price_chg: number
  close_price: number
  volume?: number
  vol_ratio?: number | null
}

interface SignalHistoryData {
  symbol: string
  history: SignalHistoryRow[]
  total: number
}

export default function SignalHistoryPopup({ symbol, onClose }: { symbol: string; onClose: () => void }) {
  const [data, setData] = useState<SignalHistoryData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API}/stock-signal-history/${symbol}?days=20`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [symbol])

  const signalConfig: Record<string, { label: string; color: string; dot: string; bar: string }> = {
    LONG_BUILDUP:   { label: 'Long Buildup',   color: 'text-emerald-400', dot: 'bg-emerald-500', bar: 'bg-emerald-500' },
    SHORT_BUILDUP:  { label: 'Short Buildup',  color: 'text-red-400',     dot: 'bg-red-500',     bar: 'bg-red-500'     },
    SHORT_COVERING: { label: 'Short Covering', color: 'text-sky-400',     dot: 'bg-sky-500',     bar: 'bg-sky-500'     },
    LONG_UNWINDING: { label: 'Long Unwinding', color: 'text-orange-400',  dot: 'bg-orange-500',  bar: 'bg-orange-500'  },
    NEUTRAL:        { label: 'Neutral',         color: 'text-gray-500',    dot: 'bg-gray-700',    bar: 'bg-gray-700'    },
  }

  function fmt(n: number) { return n >= 0 ? `+${n.toFixed(2)}%` : `${n.toFixed(2)}%` }
  function fmtDate(d: string) {
    const dt = new Date(d)
    return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
  }

  const history = data?.history || []
  let streakSignal = history[0]?.signal
  let streakCount = 0
  for (const row of history) {
    if (row.signal === streakSignal && row.signal !== 'NEUTRAL') streakCount++
    else break
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-gray-950 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden">

        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-white font-black text-lg">{symbol}</h3>
              {streakCount >= 2 && (
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  streakSignal === 'LONG_BUILDUP'
                    ? 'bg-emerald-950/60 border border-emerald-800/50 text-emerald-400'
                    : 'bg-red-950/60 border border-red-800/50 text-red-400'
                }`}>
                  🔥 {streakCount}d streak
                </span>
              )}
            </div>
            <p className="text-gray-400 text-xs mt-0.5">FUT Signal History — last {data?.total || '—'} trading days</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors text-xl leading-none">✕</button>
        </div>

        {!loading && history.length > 0 && (
          <div className="px-5 pt-4 pb-2">
            <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-2">Signal timeline (oldest → newest)</p>
            <div className="flex gap-1 items-end h-8">
              {[...history].reverse().map((row, i) => {
                const cfg = signalConfig[row.signal] || signalConfig.NEUTRAL
                return (
                  <div key={i} title={`${row.date}: ${cfg.label}`}
                    className={`flex-1 rounded-sm ${cfg.bar} opacity-90`}
                    style={{ height: row.signal === 'NEUTRAL' ? '30%' : '100%' }}
                  />
                )
              })}
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[9px] text-gray-600">{fmtDate(history[history.length - 1]?.date)}</span>
              <span className="text-[9px] text-gray-600">{fmtDate(history[0]?.date)}</span>
            </div>
          </div>
        )}

        <div className="overflow-y-auto max-h-96">
          {loading ? (
            <div className="py-10 text-center">
              <p className="text-gray-500 text-sm animate-pulse">Loading signal history...</p>
            </div>
          ) : history.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-gray-500 text-sm">No history available</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="sticky top-0 bg-gray-950">
                <tr className="border-b border-gray-800">
                  <th className="text-left px-5 py-2 text-[10px] text-gray-500 uppercase tracking-wide">Date</th>
                  <th className="text-left px-3 py-2 text-[10px] text-gray-500 uppercase tracking-wide">Signal</th>
                  <th className="text-right px-3 py-2 text-[10px] text-gray-500 uppercase tracking-wide">FUT OI Chg</th>
                  <th className="text-right px-3 py-2 text-[10px] text-gray-500 uppercase tracking-wide">Price Chg</th>
                  <th className="text-right px-3 py-2 text-[10px] text-gray-500 uppercase tracking-wide">Volume</th>
                  <th className="text-right px-5 py-2 text-[10px] text-gray-500 uppercase tracking-wide">Close</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row, i) => {
                  const cfg = signalConfig[row.signal] || signalConfig.NEUTRAL
                  const isFirst = i === 0
                  return (
                    <tr key={row.date}
                      className={`border-b border-gray-800/40 ${isFirst ? 'bg-gray-900/40' : 'hover:bg-gray-900/20'} transition-colors`}>
                      <td className="px-5 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                          <span className={`text-xs font-mono ${isFirst ? 'text-white font-bold' : 'text-gray-300'}`}>
                            {fmtDate(row.date)}
                          </span>
                          {isFirst && <span className="text-[9px] text-gray-500">latest</span>}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <span className={`text-xs font-mono font-semibold ${row.fut_oi_chg >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {fmt(row.fut_oi_chg)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <span className={`text-xs font-mono font-semibold ${row.price_chg >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {fmt(row.price_chg)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {row.volume ? (
                          <div className="flex flex-col items-end">
                            <span className="text-xs text-gray-300 font-mono">
                              {row.volume >= 10000000
                                ? `${(row.volume / 10000000).toFixed(1)}Cr`
                                : `${(row.volume / 100000).toFixed(1)}L`}
                            </span>
                            {row.vol_ratio !== null && row.vol_ratio !== undefined && (
                              <span className={`text-[9px] font-semibold ${
                                row.vol_ratio >= 1.5 ? 'text-emerald-400'
                                : row.vol_ratio <= 0.5 ? 'text-red-400'
                                : 'text-gray-500'
                              }`}>
                                {row.vol_ratio}x avg
                              </span>
                            )}
                          </div>
                        ) : <span className="text-xs text-gray-600">—</span>}
                      </td>
                      <td className="px-5 py-2.5 text-right">
                        <span className="text-xs text-gray-300 font-mono">
                          ₹{row.close_price >= 1000
                            ? row.close_price.toLocaleString('en-IN', { maximumFractionDigits: 0 })
                            : row.close_price.toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="px-5 py-3 border-t border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3 text-[10px] text-gray-600">
            {Object.entries(signalConfig).filter(([k]) => k !== 'NEUTRAL').map(([, cfg]) => (
              <span key={cfg.label} className="flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                <span>{cfg.label}</span>
              </span>
            ))}
          </div>
          <p className="text-[10px] text-gray-700">Not investment advice</p>
        </div>
      </div>
    </div>
  )
}
