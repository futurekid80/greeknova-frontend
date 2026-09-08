'use client'
import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, Zap } from 'lucide-react'
import Navbar from '@/components/Navbar'
import { useAutoRefresh } from '@/lib/useAutoRefresh'

const API = 'https://api.greeknova.com'

interface Squeeze {
  symbol: string
  tradingsymbol: string
  strike: number
  option_type: 'CE' | 'PE'
  level_kind: 'Resistance' | 'Support'
  cmp: number
  ltp: number
  ltp_chg_30min_pct: number
  oi: number
  oi_chg_30min_pct: number
  oi_chg_from_open_pct: number
  volume: number
  vol_spike_ratio: number
  days_to_expiry: number | null
  conviction: 'HIGH' | 'LOW'
  conviction_note: string
  squeeze_score: number
  bias: 'BULLISH' | 'BEARISH'
  label: string
  desc: string
}

function fmtNum(n: number) {
  if (n >= 10000000) return (n / 10000000).toFixed(2) + 'Cr'
  if (n >= 100000) return (n / 100000).toFixed(2) + 'L'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
  return n.toLocaleString('en-IN')
}

export default function GammaSqueeze() {
  const [rows, setRows]           = useState<Squeeze[]>([])
  const [windowTime, setWindowTime] = useState('')
  const [closeTime, setCloseTime] = useState('')
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API}/gamma-squeeze`)
      if (!res.ok) throw new Error(`Server returned ${res.status}`)
      const json = await res.json()
      setRows(json.signals || [])
      setWindowTime(json.window_time || '')
      setCloseTime(json.close_time || '')
    } catch (e: any) {
      console.error(e)
      setError(e?.message || 'Failed to load gamma squeeze data')
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])
  const { enabled: autoOn, toggle: toggleAuto, countdownStr } = useAutoRefresh(fetchData, 5 * 60 * 1000, false)

  const bullish = rows.filter(r => r.bias === 'BULLISH')
  const bearish = rows.filter(r => r.bias === 'BEARISH')

  return (
    <div className="min-h-screen bg-[#07070e] text-white">
      <Navbar active="/gamma-squeeze" />
      <div className="max-w-6xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-black tracking-tight mb-1 flex items-center gap-2">
              <Zap size={26} className="text-yellow-400" /> Gamma Squeeze
            </h1>
            <p className="text-gray-500 text-sm">
              Highest-OI strike per stock (the real support/resistance) where writers are getting squeezed out — OI unwinding + abnormal volume + premium spiking, together
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={toggleAuto} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${autoOn ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60' : 'bg-gray-900/40 text-gray-500 border-gray-800'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${autoOn ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`}/>
              {autoOn ? countdownStr : 'Auto'}
            </button>
            <button onClick={fetchData} disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-sm font-medium text-white rounded-lg border border-gray-700 disabled:opacity-50 transition-all">
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''}/>Refresh
            </button>
          </div>
        </div>

        {(windowTime || closeTime) && (
          <p className="text-xs text-gray-600 mb-5">Comparing {closeTime} IST vs ~30 min ago ({windowTime} IST) at each stock's highest-OI strike · all expiries shown, tagged by conviction</p>
        )}

        {error && (
          <div className="mb-4 bg-red-950/30 border border-red-800/40 rounded-xl px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {!loading && !error && rows.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
            <div className="bg-gray-900/30 border border-gray-800 rounded-xl px-4 py-3">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Total Setups</p>
              <p className="text-lg font-black text-white">{rows.length}</p>
            </div>
            <div className="bg-emerald-950/30 border border-emerald-900/40 rounded-xl px-4 py-3">
              <p className="text-[10px] text-emerald-600 uppercase tracking-wide mb-1">Bullish — Resistance Squeeze</p>
              <p className="text-lg font-black text-emerald-400">{bullish.length}</p>
            </div>
            <div className="bg-red-950/30 border border-red-900/40 rounded-xl px-4 py-3">
              <p className="text-[10px] text-red-600 uppercase tracking-wide mb-1">Bearish — Support Squeeze</p>
              <p className="text-lg font-black text-red-400">{bearish.length}</p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-28 bg-gray-900/30 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : !error && rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 border border-gray-800/50 rounded-2xl">
            <div className="text-4xl mb-4">⚡</div>
            <p className="text-gray-500">No squeeze setups right now</p>
            <p className="text-gray-700 text-xs mt-1">Nothing has its key strike unwinding 4%+ OI with an abnormal volume spike and premium up 3%+ in the last 30 min</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map(r => (
              <div key={r.tradingsymbol}
                className={`rounded-xl border p-4 ${r.bias === 'BULLISH' ? 'bg-emerald-950/20 border-emerald-900/40' : 'bg-red-950/20 border-red-900/40'}`}>
                <div className="flex items-start justify-between flex-wrap gap-2 mb-2">
                  <div>
                    <p className="font-black text-white text-sm">
                      {r.symbol} {r.strike.toLocaleString('en-IN')} {r.option_type}
                      <span className={`ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full ${r.bias === 'BULLISH' ? 'bg-emerald-900/60 text-emerald-400' : 'bg-red-900/60 text-red-400'}`}>
                        {r.bias}
                      </span>
                      <span className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">
                        {r.level_kind} · highest OI strike
                      </span>
                      <span className={`ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full ${r.conviction === 'HIGH' ? 'bg-emerald-900/60 text-emerald-400' : 'bg-yellow-900/50 text-yellow-500'}`}>
                        {r.conviction === 'HIGH' ? '🟢 Near Expiry' : '🟡 Early Cycle'}
                      </span>
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{r.label}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wide">Squeeze Score</p>
                    <p className="text-xl font-black text-yellow-400">{r.squeeze_score.toFixed(1)}</p>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mb-1">{r.desc}</p>
                <p className={`text-[11px] mb-3 ${r.conviction === 'HIGH' ? 'text-emerald-500/80' : 'text-yellow-600/80'}`}>{r.conviction_note}</p>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                  <div>
                    <p className="text-gray-600">Premium (30 min)</p>
                    <p className="text-white font-semibold">₹{r.ltp.toFixed(2)}</p>
                    <p className="text-emerald-400">+{r.ltp_chg_30min_pct.toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-gray-600">OI (30 min)</p>
                    <p className="text-white font-semibold">{fmtNum(r.oi)}</p>
                    <p className="text-red-400">{r.oi_chg_30min_pct.toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Volume Spike</p>
                    <p className="text-white font-semibold">{r.vol_spike_ratio.toFixed(1)}x baseline</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Spot (CMP)</p>
                    <p className="text-white font-semibold">₹{r.cmp.toLocaleString('en-IN')}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Days to Expiry</p>
                    <p className="text-white font-semibold">{r.days_to_expiry ?? '—'}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 bg-gray-900/20 border border-gray-800/40 rounded-xl p-4">
          <p className="text-xs text-gray-600 leading-relaxed">
            <span className="text-gray-400 font-semibold">How to read (Gamma Move strategy): </span>
            For every stock we take the single strike carrying the most open interest on each side — that strike IS the real support (PE) or resistance (CE),
            since that's where the most writers are positioned. We watch that one strike for three things happening together in the last ~30 minutes: its OI
            unwinding fast, its volume running well above its own recent baseline rate, and its own premium rising — the sign that writers there are being
            forced to cover, which can accelerate the move further. Shown for every expiry, tagged 🟢 Near Expiry (≤14 days — matches the strategy's own
            conditions) or 🟡 Early Cycle (further out — the pattern showed up, but writers may not be under real pressure to cover yet, so weight it
            accordingly). Call-side squeezes (resistance) are bullish, put-side (support) are bearish · Not investment advice
          </p>
        </div>
      </div>
    </div>
  )
}
