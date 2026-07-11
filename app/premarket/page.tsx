'use client'
import Navbar from '@/components/Navbar'
import SignalHistoryPopup from '@/components/SignalHistoryPopup'
import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Clock } from 'lucide-react'

const API = 'https://greeknova-backend-production.up.railway.app'

interface GiftNifty {
  ltp: number
  prev_close: number
  change: number
  pct_change: number
  direction: string
}

interface Commodity {
  name: string
  ticker: string
  ltp: number
  change: number
  pct_change: number
}

interface FiiDii {
  fii_net: number | null
  dii_net: number | null
  date: string
}

interface HighDelivery {
  symbol: string
  delivery_pct: number
  deliverable_L: number
}

interface OvernightConviction {
  symbol: string
  cmp: number
  signal: string
  consec_days: number
  consistency_pct: number
  cpr_position: string | null
}

interface IndexLevel {
  symbol: string
  cmp: number
  pcr: number
  max_pain: number
  dist_from_mp: number
  days_to_expiry: number
  ce_wall: number | null
  pe_wall: number | null
}

interface PremarketData {
  date: string
  generated_at: string
  gift_nifty: GiftNifty | null
  commodities: Commodity[]
  fii_dii: FiiDii | null
  high_delivery: HighDelivery[]
  overnight_conviction: OvernightConviction[]
  index_levels: IndexLevel[]
}

const SIGNAL_META: Record<string, { color: string; bg: string; border: string; icon: string }> = {
  LONG_BUILDUP:   { color: 'text-emerald-400', bg: 'bg-emerald-950/30', border: 'border-emerald-800/50', icon: '🐂' },
  SHORT_BUILDUP:  { color: 'text-red-400',     bg: 'bg-red-950/30',     border: 'border-red-800/50',     icon: '🐻' },
}

function fmt(n: number) {
  return n >= 0 ? `+${n.toFixed(2)}` : `${n.toFixed(2)}`
}

function fmtCr(n: number | null) {
  if (n === null) return '—'
  return `${n >= 0 ? '+' : ''}₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })} Cr`
}

export default function PreMarket() {
  const [data, setData] = useState<PremarketData | null>(null)
  const [loading, setLoading] = useState(true)
  const [historySymbol, setHistorySymbol] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/premarket-brief`)
      const json = await res.json()
      setData(json)
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  return (
    <div className="min-h-screen bg-[#07070e] text-white">
      <Navbar active="/premarket" />

      {historySymbol && (
        <SignalHistoryPopup symbol={historySymbol} onClose={() => setHistorySymbol(null)} />
      )}

      <div className="max-w-6xl mx-auto px-6 py-8">

        <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight mb-1">☀️ Pre-Market Brief</h1>
            <p className="text-gray-500 text-sm">
              What to check before 9:15 AM — quick and focused, not a full report
              {data ? ` · Based on ${data.date} close · Updated ${data.generated_at}` : ''}
            </p>
          </div>
          <button onClick={fetchData} disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-sm font-medium text-white rounded-lg border border-gray-700 transition-all disabled:opacity-50">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''}/>Refresh
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1,2,3,4,5,6].map(i => <div key={i} className="h-40 bg-gray-900/40 rounded-xl animate-pulse" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">

            <div className="bg-gray-900/40 border border-gray-800 rounded-xl p-4">
              <p className="text-xs text-gray-400 mb-2 flex items-center gap-1.5">🌏 GIFT Nifty — Gap Indicator</p>
              {data?.gift_nifty ? (
                <>
                  <p className={`text-3xl font-black ${data.gift_nifty.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {data.gift_nifty.ltp.toLocaleString('en-IN')}
                  </p>
                  <p className={`text-sm font-bold mt-1 ${data.gift_nifty.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {data.gift_nifty.direction === 'UP' ? '▲' : data.gift_nifty.direction === 'DOWN' ? '▼' : '—'} {fmt(data.gift_nifty.change)} ({fmt(data.gift_nifty.pct_change)}%)
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    {data.gift_nifty.change > 20 ? 'Suggests gap-up open' : data.gift_nifty.change < -20 ? 'Suggests gap-down open' : 'Flattish open expected'}
                  </p>
                </>
              ) : <p className="text-sm text-gray-600">Not available (market closed)</p>}
            </div>

            <div className="bg-gray-900/40 border border-gray-800 rounded-xl p-4">
              <p className="text-xs text-gray-400 mb-2">🏦 FII / DII — {data?.fii_dii?.date || 'Yesterday'}</p>
              {data?.fii_dii ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">FII</span>
                    <span className={`text-lg font-bold ${(data.fii_dii.fii_net || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {fmtCr(data.fii_dii.fii_net)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">DII</span>
                    <span className={`text-lg font-bold ${(data.fii_dii.dii_net || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {fmtCr(data.fii_dii.dii_net)}
                    </span>
                  </div>
                </div>
              ) : <p className="text-sm text-gray-600">Not available</p>}
            </div>

            <div className="bg-gray-900/40 border border-gray-800 rounded-xl p-4">
              <p className="text-xs text-gray-400 mb-2">🛢️ Global Commodities (USD)</p>
              {data?.commodities && data.commodities.length > 0 ? (
                <div className="space-y-1.5">
                  {data.commodities.map(c => (
                    <div key={c.ticker} className="flex items-center justify-between text-xs">
                      <span className="text-gray-400">{c.name}</span>
                      <span className={`font-bold ${c.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {c.ltp.toLocaleString('en-US')} <span className="text-[10px]">({fmt(c.pct_change)}%)</span>
                      </span>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-gray-600">Not available (market closed)</p>}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          <div>
            <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-orange-400"/>Overnight Carry-Forward
            </h2>
            <div className="space-y-2">
              {loading ? [1,2,3].map(i => <div key={i} className="h-14 bg-gray-900/30 border border-gray-800 rounded-xl animate-pulse"/>) :
                data?.overnight_conviction.length ? data.overnight_conviction.map(s => {
                  const m = SIGNAL_META[s.signal] || SIGNAL_META.LONG_BUILDUP
                  return (
                    <button key={s.symbol} onClick={() => setHistorySymbol(s.symbol)}
                      className={`block w-full text-left rounded-xl border p-3 hover:border-gray-600 transition-all ${m.bg} ${m.border}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-black text-white">{s.symbol}</span>
                        <span className={`text-xs font-bold ${m.color}`}>{m.icon} {s.consec_days}d streak</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                        <span>₹{s.cmp.toLocaleString('en-IN')}</span>
                        <span>· {s.consistency_pct}% consistent</span>
                        {s.cpr_position && <span>· {s.cpr_position}</span>}
                      </div>
                    </button>
                  )
                }) : <div className="text-xs text-gray-600 text-center py-8 border border-gray-800/50 rounded-xl">No 2+ day conviction signals right now</div>
              }
            </div>
          </div>

          <div>
            <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400"/>Index Key Levels
            </h2>
            <div className="space-y-3">
              {loading ? [1,2,3].map(i => <div key={i} className="h-28 bg-gray-900/30 border border-gray-800 rounded-xl animate-pulse"/>) :
                data?.index_levels.map(idx => (
                  <div key={idx.symbol} className="bg-gray-900/30 border border-gray-800 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-black text-white">{idx.symbol}</span>
                      <span className="text-xs text-amber-400 font-bold">₹{idx.cmp.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div><p className="text-gray-600">CE Wall</p><p className="text-red-400 font-bold">{idx.ce_wall ? `₹${idx.ce_wall.toLocaleString('en-IN')}` : '—'}</p></div>
                      <div><p className="text-gray-600">PE Wall</p><p className="text-emerald-400 font-bold">{idx.pe_wall ? `₹${idx.pe_wall.toLocaleString('en-IN')}` : '—'}</p></div>
                      <div><p className="text-gray-600">PCR</p><p className={`font-bold ${idx.pcr > 1 ? 'text-emerald-400' : 'text-red-400'}`}>{idx.pcr}</p></div>
                      {idx.days_to_expiry <= 2 ? (
                        <div><p className="text-gray-600">Max Pain</p><p className="text-orange-400 font-bold">₹{idx.max_pain.toLocaleString('en-IN')} 🔥</p></div>
                      ) : (
                        <div><p className="text-gray-600">Expiry</p><p className="text-gray-400 font-bold">{idx.days_to_expiry}d</p></div>
                      )}
                    </div>
                  </div>
                ))
              }
            </div>
          </div>

          <div>
            <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-400"/>High Delivery Yesterday
            </h2>
            <div className="bg-gray-900/20 border border-gray-800 rounded-2xl overflow-hidden">
              {loading ? (
                <div className="p-4 space-y-2">
                  {[1,2,3,4].map(i => <div key={i} className="h-6 bg-gray-800 rounded animate-pulse"/>)}
                </div>
              ) : data?.high_delivery.length ? (
                <table className="w-full text-xs">
                  <tbody>
                    {data.high_delivery.map(d => (
                      <tr key={d.symbol} className="border-b border-gray-800/40 last:border-0">
                        <td className="px-4 py-2.5">
                          <button onClick={() => setHistorySymbol(d.symbol)} className="font-bold text-white hover:text-emerald-400 transition-colors">
                            {d.symbol}
                          </button>
                        </td>
                        <td className="px-4 py-2.5 text-right text-purple-400 font-bold">{d.delivery_pct.toFixed(1)}%</td>
                        <td className="px-4 py-2.5 text-right text-gray-500">{d.deliverable_L.toFixed(1)}L</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <div className="text-xs text-gray-600 text-center py-8">No stocks ≥60% delivery yesterday</div>}
            </div>
          </div>
        </div>

        <div className="mt-8 bg-gray-900/20 border border-gray-800/40 rounded-xl p-4">
          <p className="text-xs text-gray-600">
            GIFT Nifty via NSE IX · Commodities via free market data (Gold, Silver, Brent & WTI Crude in USD) · FII/DII and delivery data from previous trading day's close.
            Informational only — not investment advice. GreekNova is not SEBI registered.
          </p>
        </div>
      </div>
    </div>
  )
}
