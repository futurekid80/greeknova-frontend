'use client'
import Navbar from '@/components/Navbar'
import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, Clock, Calendar } from 'lucide-react'
import { ALL_SYMBOLS } from '@/lib/symbols'

const API = 'https://greeknova-backend-production.up.railway.app'
const INDICES = ['NIFTY', 'BANKNIFTY', 'FINNIFTY']

interface Greeks { ltp: number; iv: number | null; oi: number; volume: number; delta?: number; gamma?: number; theta?: number; vega?: number }
interface ChainRow { strike: number; is_atm: boolean; ce: Greeks; pe: Greeks }
interface ChainData { symbol: string; date: string; timestamp: string; spot: number; expiry: string; days_left: number; expiries: string[]; chain: ChainRow[]; error?: string }

function fmt(n: number | undefined | null, dec = 2) {
  if (n == null) return '—'
  return n.toFixed(dec)
}
function fmtOI(n: number) {
  if (n >= 10000000) return `${(n / 10000000).toFixed(1)}Cr`
  if (n >= 100000)   return `${(n / 100000).toFixed(1)}L`
  return n.toLocaleString()
}
function formatExpiry(e: string) {
  try { return new Date(e).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) }
  catch { return e }
}
function formatSnapTime(ts: string) {
  try { return new Date(ts).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }) }
  catch { return ts }
}

export default function HistoricalChain() {
  const [symbol, setSymbol]       = useState('NIFTY')
  const [search, setSearch]       = useState('')
  const [dates, setDates]         = useState<string[]>([])
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [snapshots, setSnapshots] = useState<string[]>([])
  const [selectedSnap, setSelectedSnap] = useState<string>('')
  const [expiry, setExpiry]       = useState<string>('')
  const [data, setData]           = useState<ChainData | null>(null)
  const [loading, setLoading]     = useState(false)
  const [datesLoading, setDatesLoading] = useState(false)

  useEffect(() => {
    setDatesLoading(true)
    setDates([]); setSelectedDate(''); setSnapshots([]); setSelectedSnap(''); setData(null); setExpiry('')
    fetch(`${API}/historical-chain/dates/${symbol}`)
      .then(r => r.json())
      .then(json => {
        setDates(json.dates || [])
        if (json.dates?.length) setSelectedDate(json.dates[0])
      })
      .catch(console.error)
      .finally(() => setDatesLoading(false))
  }, [symbol])

  useEffect(() => {
    if (!selectedDate) return
    setSnapshots([]); setSelectedSnap(''); setData(null); setExpiry('')
    fetch(`${API}/historical-chain/snapshots/${symbol}?date=${selectedDate}`)
      .then(r => r.json())
      .then(json => {
        const snaps = json.snapshots || []
        setSnapshots(snaps)
        if (snaps.length) setSelectedSnap(snaps[snaps.length - 1])
      })
      .catch(console.error)
  }, [symbol, selectedDate])

  const fetchChain = useCallback(async () => {
    if (!selectedDate || !selectedSnap) return
    setLoading(true)
    try {
      const url = `${API}/historical-chain/${symbol}?date=${selectedDate}&timestamp=${encodeURIComponent(selectedSnap)}${expiry ? `&expiry=${expiry}` : ''}`
      const res  = await fetch(url)
      const json = await res.json()
      setData(json)
      if (!expiry && json.expiry) setExpiry(json.expiry)
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [symbol, selectedDate, selectedSnap, expiry])

  useEffect(() => { fetchChain() }, [symbol, selectedDate, selectedSnap, expiry])

  const atm = data?.chain?.find(r => r.is_atm)
  const filteredSymbols = search
    ? ALL_SYMBOLS.filter(s => s.startsWith(search.toUpperCase())).slice(0, 8)
    : []

  return (
    <div className="min-h-screen bg-[#07070e] text-white">
      <Navbar active="/historicalchain" />

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-black tracking-tight mb-1">🕰️ Historical Option Chain</h1>
          <p className="text-gray-500 text-sm">Browse a past chain snapshot — Greeks recalculated for that moment in time</p>
          <p className="text-xs text-gray-600 mt-1">Data available from 26 May 2026 onward</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-4">
          {INDICES.map(idx => (
            <button key={idx} onClick={() => setSymbol(idx)}
              className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${symbol === idx ? 'bg-white text-gray-900 border-white' : 'bg-gray-900/40 text-gray-400 border-gray-800 hover:text-white'}`}>
              {idx}
            </button>
          ))}
          <div className="relative">
            <input
              value={search || symbol}
              onFocus={() => setSearch('')}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search stock..."
              className="px-4 py-2 rounded-xl text-sm bg-gray-900/40 border border-gray-800 text-white placeholder-gray-600 w-44 focus:outline-none focus:border-cyan-700"
            />
            {filteredSymbols.length > 0 && (
              <div className="absolute z-10 mt-1 w-44 bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-xl">
                {filteredSymbols.map(s => (
                  <div key={s} onClick={() => { setSymbol(s); setSearch('') }}
                    className="px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 cursor-pointer">
                    {s}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-4 bg-gray-900/30 border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2">
            <Calendar size={14} className="text-gray-500"/>
            <span className="text-xs text-gray-500">Date:</span>
            <select value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
              disabled={datesLoading || !dates.length}
              className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-1.5 text-sm text-white disabled:opacity-50">
              {datesLoading && <option>Loading…</option>}
              {!datesLoading && !dates.length && <option>No data available</option>}
              {dates.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Clock size={14} className="text-gray-500"/>
            <span className="text-xs text-gray-500">Time:</span>
            <select value={selectedSnap} onChange={e => setSelectedSnap(e.target.value)}
              disabled={!snapshots.length}
              className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-1.5 text-sm text-white disabled:opacity-50">
              {!snapshots.length && <option>—</option>}
              {snapshots.map(ts => <option key={ts} value={ts}>{formatSnapTime(ts)} IST</option>)}
            </select>
          </div>

          <button onClick={fetchChain} disabled={loading || !selectedSnap}
            className="flex items-center gap-2 px-4 py-1.5 bg-gray-800 hover:bg-gray-700 text-sm font-medium text-white rounded-lg border border-gray-700 transition-all disabled:opacity-50 ml-auto">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''}/>Load
          </button>
        </div>

        {data?.expiries && data.expiries.length > 0 && (
          <div className="flex items-center gap-2 mb-6">
            <span className="text-xs text-gray-500 mr-1">Expiry:</span>
            {data.expiries.map((e, i) => (
              <button key={e} onClick={() => setExpiry(e)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${expiry === e ? 'bg-cyan-950/60 text-cyan-400 border-cyan-800/60' : 'bg-gray-900/40 text-gray-500 border-gray-800 hover:text-white'}`}>
                {formatExpiry(e)}
              </button>
            ))}
          </div>
        )}

        {data?.spot && !data.error && (
          <div className="grid grid-cols-5 gap-3 mb-6">
            <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">Spot (est.)</p>
              <p className="text-xl font-black text-white">{data.spot.toLocaleString()}</p>
            </div>
            <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">ATM Strike</p>
              <p className="text-xl font-black text-amber-400">{atm?.strike.toLocaleString() ?? '—'}</p>
            </div>
            <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">Days to Expiry (then)</p>
              <p className="text-xl font-black text-cyan-400">{data.days_left}d</p>
            </div>
            <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">ATM CE IV</p>
              <p className="text-xl font-black text-red-400">{atm?.ce.iv != null ? `${atm.ce.iv}%` : '—'}</p>
            </div>
            <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">ATM PE IV</p>
              <p className="text-xl font-black text-emerald-400">{atm?.pe.iv != null ? `${atm.pe.iv}%` : '—'}</p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <RefreshCw size={24} className="text-gray-600 animate-spin"/>
          </div>
        ) : data?.error || !data?.chain?.length ? (
          <div className="h-64 flex items-center justify-center flex-col gap-3">
            <div className="text-4xl">🕰️</div>
            <p className="text-gray-500 text-sm">{data?.error || 'Pick a date and time above to load a past chain'}</p>
          </div>
        ) : (
          <div className="bg-gray-900/20 border border-gray-800 rounded-2xl overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-800">
                  <th colSpan={6} className="py-3 text-center text-red-400 font-bold text-[11px] tracking-wider border-r border-gray-800">CALLS</th>
                  <th className="py-3 px-4 text-center text-amber-400 font-black text-[11px] tracking-wider">STRIKE</th>
                  <th colSpan={6} className="py-3 text-center text-emerald-400 font-bold text-[11px] tracking-wider border-l border-gray-800">PUTS</th>
                </tr>
                <tr className="border-b border-gray-800 text-gray-500">
                  <th className="py-2 px-2 text-right">OI</th>
                  <th className="py-2 px-2 text-right">Vol</th>
                  <th className="py-2 px-2 text-right">IV%</th>
                  <th className="py-2 px-2 text-right">Δ Delta</th>
                  <th className="py-2 px-2 text-right">Θ Theta</th>
                  <th className="py-2 px-3 text-right border-r border-gray-800">LTP</th>
                  <th className="py-2 px-4 text-center text-amber-400 font-bold"></th>
                  <th className="py-2 px-3 text-left border-l border-gray-800">LTP</th>
                  <th className="py-2 px-2 text-left">Θ Theta</th>
                  <th className="py-2 px-2 text-left">Δ Delta</th>
                  <th className="py-2 px-2 text-left">IV%</th>
                  <th className="py-2 px-2 text-left">Vol</th>
                  <th className="py-2 px-2 text-left">OI</th>
                </tr>
              </thead>
              <tbody>
                {data.chain.map((row) => (
                  <tr key={row.strike}
                    className={`border-b border-gray-800/50 transition-colors hover:bg-gray-800/20 ${row.is_atm ? 'bg-amber-950/20' : ''}`}>
                    <td className="py-2 px-2 text-right text-gray-300">{fmtOI(row.ce.oi)}</td>
                    <td className="py-2 px-2 text-right text-gray-500">{fmtOI(row.ce.volume)}</td>
                    <td className="py-2 px-2 text-right text-orange-400">{row.ce.iv != null ? `${row.ce.iv}` : '—'}</td>
                    <td className="py-2 px-2 text-right text-blue-400">{fmt(row.ce.delta, 3)}</td>
                    <td className="py-2 px-2 text-right text-rose-400">{fmt(row.ce.theta)}</td>
                    <td className={`py-2 px-3 text-right font-bold border-r border-gray-800 ${row.is_atm ? 'text-amber-300' : 'text-red-400'}`}>
                      {row.ce.ltp.toFixed(2)}
                    </td>
                    <td className={`py-2 px-4 text-center font-black ${row.is_atm ? 'text-amber-400 text-sm' : 'text-gray-300'}`}>
                      {row.strike.toLocaleString()}
                      {row.is_atm && <span className="ml-1 text-[9px] text-amber-600">ATM</span>}
                    </td>
                    <td className={`py-2 px-3 text-left font-bold border-l border-gray-800 ${row.is_atm ? 'text-amber-300' : 'text-emerald-400'}`}>
                      {row.pe.ltp.toFixed(2)}
                    </td>
                    <td className="py-2 px-2 text-left text-rose-400">{fmt(row.pe.theta)}</td>
                    <td className="py-2 px-2 text-left text-blue-400">{fmt(row.pe.delta, 3)}</td>
                    <td className="py-2 px-2 text-left text-orange-400">{row.pe.iv != null ? `${row.pe.iv}` : '—'}</td>
                    <td className="py-2 px-2 text-left text-gray-500">{fmtOI(row.pe.volume)}</td>
                    <td className="py-2 px-2 text-left text-gray-300">{fmtOI(row.pe.oi)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center gap-6 mt-4 text-xs text-gray-600">
          <span><span className="text-blue-400">Δ Delta</span> — directional exposure</span>
          <span><span className="text-rose-400">Θ Theta</span> — daily time decay (₹)</span>
          <span><span className="text-orange-400">IV%</span> — implied volatility, recalculated for that moment</span>
          <span><span className="text-amber-400">ATM</span> — at-the-money strike at that moment</span>
          <span className="text-gray-700">Spot is estimated from put-call parity — no live quote exists for a past moment</span>
        </div>
      </div>
    </div>
  )
}
