'use client'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { RefreshCw, Zap, ArrowUp, ArrowDown, Search, X } from 'lucide-react'
import Navbar from '@/components/Navbar'
import { useAutoRefresh } from '@/lib/useAutoRefresh'

const API = 'https://api.greeknova.com'
const PAGE_SIZE = 20

interface GexRow {
  symbol: string
  cmp: number
  expiry: string | null
  days_to_expiry: number | null
  call_wall_strike: number | null
  call_wall_gamma_oi: number | null
  put_wall_strike: number | null
  put_wall_gamma_oi: number | null
  flip_point: number | null
  net_gex: number
  net_gex_near_spot: number
  regime: 'SHORT_GAMMA' | 'LONG_GAMMA'
  pct_to_call_wall: number | null
  pct_to_put_wall: number | null
  pct_to_flip: number | null
  squeeze: boolean
  bias: 'BULLISH' | 'BEARISH' | null
  label: string
  desc: string
}

type RegimeFilter = 'ALL' | 'SHORT_GAMMA' | 'LONG_GAMMA'

function fmtNum(n: number | null) {
  if (n === null || n === undefined) return '—'
  const abs = Math.abs(n)
  if (abs >= 10000000) return (n / 10000000).toFixed(2) + 'Cr'
  if (abs >= 100000) return (n / 100000).toFixed(2) + 'L'
  if (abs >= 1000) return (n / 1000).toFixed(1) + 'K'
  return n.toLocaleString('en-IN')
}

function fmtStrike(n: number | null) {
  return n === null || n === undefined ? '—' : n.toLocaleString('en-IN')
}

function closestWallPct(r: GexRow): number {
  const vals = [r.pct_to_call_wall, r.pct_to_put_wall].filter((v): v is number => v !== null)
  if (!vals.length) return 999
  return Math.min(...vals.map(v => Math.abs(v)))
}

export default function GammaSqueeze() {
  const [watchlist, setWatchlist] = useState<GexRow[]>([])
  const [signals, setSignals]     = useState<GexRow[]>([])
  const [sortCol, setSortCol] = useState<string>('regime')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [asOf, setAsOf] = useState('')
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)

  // Filters — shared across signal cards and the watchlist table
  const [search, setSearch] = useState('')
  const [regimeFilter, setRegimeFilter] = useState<RegimeFilter>('ALL')
  const [maxWallDist, setMaxWallDist] = useState<number>(100) // % — 100 = no filter
  const [page, setPage] = useState(1)
  const [showAllSignals, setShowAllSignals] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API}/gamma-squeeze?t=${Date.now()}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`Server returned ${res.status}`)
      const json = await res.json()
      setWatchlist(json.watchlist || [])
      setSignals(json.signals || [])
      setAsOf(json.as_of || '')
    } catch (e: any) {
      console.error(e)
      setError(e?.message || 'Failed to load gamma exposure data')
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])
  const { enabled: autoOn, toggle: toggleAuto, countdownStr } = useAutoRefresh(fetchData, 5 * 60 * 1000, false)

  const shortGamma = watchlist.filter(r => r.regime === 'SHORT_GAMMA')
  const longGamma  = watchlist.filter(r => r.regime === 'LONG_GAMMA')

  const handleSort = (col: string) => {
    if (sortCol === col) {
      setSortDir(d => (d === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortCol(col)
      setSortDir('desc')
    }
  }

  const searchTerm = search.trim().toUpperCase()
  const filtersActive = searchTerm !== '' || regimeFilter !== 'ALL' || maxWallDist < 100

  const filteredWatchlist = useMemo(() => {
    return watchlist.filter(r => {
      if (searchTerm && !r.symbol.includes(searchTerm)) return false
      if (regimeFilter !== 'ALL' && r.regime !== regimeFilter) return false
      if (maxWallDist < 100 && closestWallPct(r) > maxWallDist) return false
      return true
    })
  }, [watchlist, searchTerm, regimeFilter, maxWallDist])

  const sortedWatchlist = useMemo(() => {
    const arr = [...filteredWatchlist]
    arr.sort((a: any, b: any) => {
      let av = a[sortCol]
      let bv = b[sortCol]
      if (['pct_to_call_wall', 'pct_to_put_wall', 'pct_to_flip', 'net_gex_near_spot'].includes(sortCol)) {
        av = Math.abs(av ?? 0)
        bv = Math.abs(bv ?? 0)
      }
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      }
      av = av ?? 0
      bv = bv ?? 0
      return sortDir === 'asc' ? av - bv : bv - av
    })
    return arr
  }, [filteredWatchlist, sortCol, sortDir])

  // Reset to page 1 whenever the filtered set or sort changes underneath the current page
  useEffect(() => { setPage(1) }, [searchTerm, regimeFilter, maxWallDist, sortCol, sortDir])

  const totalPages = Math.max(1, Math.ceil(sortedWatchlist.length / PAGE_SIZE))
  const pageSafe = Math.min(page, totalPages)
  const pagedWatchlist = sortedWatchlist.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE)

  const filteredSignals = useMemo(() => {
    return signals.filter(r => {
      if (searchTerm && !r.symbol.includes(searchTerm)) return false
      if (regimeFilter === 'LONG_GAMMA') return false // signals are always short-gamma
      return true
    })
  }, [signals, searchTerm, regimeFilter])

  const visibleSignals = showAllSignals ? filteredSignals : filteredSignals.slice(0, 8)

  const clearFilters = () => {
    setSearch('')
    setRegimeFilter('ALL')
    setMaxWallDist(100)
  }

  return (
    <div className="min-h-screen bg-[#07070e] text-white">
      <Navbar active="/gamma-squeeze" />
      <div className="max-w-6xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-black tracking-tight mb-1 flex items-center gap-2">
              <Zap size={26} className="text-yellow-400" /> Gamma Exposure
            </h1>
            <p className="text-gray-500 text-sm">
              Real dealer gamma per stock — Call Wall / Put Wall from IV-solved option gamma weighted by OI, and whether dealer hedging is currently amplifying or dampening moves
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

        {asOf && (
          <p className="text-xs text-gray-600 mb-5">As of {asOf} IST · nearest active expiry per stock · walls & regime computed from IV-implied gamma × OI across the live chain</p>
        )}

        {error && (
          <div className="mb-4 bg-red-950/30 border border-red-800/40 rounded-xl px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {!loading && !error && watchlist.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
            <div className="bg-gray-900/30 border border-gray-800 rounded-xl px-4 py-3">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Squeeze Signals</p>
              <p className="text-lg font-black text-white">{signals.length}</p>
            </div>
            <button onClick={() => setRegimeFilter(regimeFilter === 'SHORT_GAMMA' ? 'ALL' : 'SHORT_GAMMA')}
              className={`text-left bg-red-950/30 border rounded-xl px-4 py-3 transition-all ${regimeFilter === 'SHORT_GAMMA' ? 'border-red-500' : 'border-red-900/40 hover:border-red-700/60'}`}>
              <p className="text-[10px] text-red-600 uppercase tracking-wide mb-1">Short Gamma — Amplifying</p>
              <p className="text-lg font-black text-red-400">{shortGamma.length}</p>
            </button>
            <button onClick={() => setRegimeFilter(regimeFilter === 'LONG_GAMMA' ? 'ALL' : 'LONG_GAMMA')}
              className={`text-left bg-emerald-950/30 border rounded-xl px-4 py-3 transition-all ${regimeFilter === 'LONG_GAMMA' ? 'border-emerald-500' : 'border-emerald-900/40 hover:border-emerald-700/60'}`}>
              <p className="text-[10px] text-emerald-600 uppercase tracking-wide mb-1">Long Gamma — Pinning</p>
              <p className="text-lg font-black text-emerald-400">{longGamma.length}</p>
            </button>
          </div>
        )}

        {/* Filter bar */}
        {!loading && !error && watchlist.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-6 bg-gray-900/20 border border-gray-800/40 rounded-xl px-3 py-2.5">
            <div className="relative flex-1 min-w-[160px]">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-600" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search symbol…"
                className="w-full bg-gray-900/60 border border-gray-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-gray-600"
              />
            </div>
            <div className="flex items-center gap-1 bg-gray-900/60 border border-gray-800 rounded-lg p-0.5">
              {(['ALL', 'SHORT_GAMMA', 'LONG_GAMMA'] as RegimeFilter[]).map(opt => (
                <button key={opt} onClick={() => setRegimeFilter(opt)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                    regimeFilter === opt
                      ? opt === 'SHORT_GAMMA' ? 'bg-red-900/60 text-red-300' : opt === 'LONG_GAMMA' ? 'bg-emerald-900/60 text-emerald-300' : 'bg-gray-700 text-white'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}>
                  {opt === 'ALL' ? 'All' : opt === 'SHORT_GAMMA' ? 'Short' : 'Long'}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-[11px] text-gray-500">
              Within
              <select
                value={maxWallDist}
                onChange={e => setMaxWallDist(Number(e.target.value))}
                className="bg-gray-900/60 border border-gray-800 rounded-lg px-2 py-1.5 text-[11px] text-white focus:outline-none focus:border-gray-600"
              >
                <option value={100}>any distance</option>
                <option value={5}>5%</option>
                <option value={3}>3%</option>
                <option value={1.5}>1.5%</option>
                <option value={1}>1%</option>
                <option value={0.5}>0.5%</option>
              </select>
              of a wall
            </label>
            {filtersActive && (
              <button onClick={clearFilters} className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-white px-2 py-1.5">
                <X size={12} /> Clear
              </button>
            )}
            <span className="ml-auto text-[11px] text-gray-600">{filteredWatchlist.length} of {watchlist.length} stocks</span>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-28 bg-gray-900/30 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : !error && filteredSignals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 border border-gray-800/50 rounded-2xl mb-8">
            <div className="text-4xl mb-4">⚡</div>
            <p className="text-gray-500">{signals.length === 0 ? 'No squeeze signals right now' : 'No squeeze signals match your filters'}</p>
            <p className="text-gray-700 text-xs mt-1">
              {signals.length === 0
                ? "Nothing is both in a short-gamma regime and pressing into its call or put wall — check the watchlist below for what's closest"
                : 'Try clearing the search or regime filter above'}
            </p>
          </div>
        ) : (
          <div className="mb-8">
            <div className="space-y-3">
              {visibleSignals.map(r => (
                <div key={r.symbol}
                  className={`rounded-xl border p-4 ${r.bias === 'BULLISH' ? 'bg-emerald-950/20 border-emerald-900/40' : 'bg-red-950/20 border-red-900/40'}`}>
                  <div className="flex items-start justify-between flex-wrap gap-2 mb-2">
                    <div>
                      <p className="font-black text-white text-sm">
                        {r.symbol}
                        <span className={`ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full ${r.bias === 'BULLISH' ? 'bg-emerald-900/60 text-emerald-400' : 'bg-red-900/60 text-red-400'}`}>
                          {r.bias}
                        </span>
                        <span className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-900/40 text-red-400">
                          SHORT GAMMA
                        </span>
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">{r.label}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-gray-500 uppercase tracking-wide">Spot (CMP)</p>
                      <p className="text-xl font-black text-yellow-400">₹{r.cmp.toLocaleString('en-IN')}</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mb-3">{r.desc}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                    <div>
                      <p className="text-gray-600">Call Wall</p>
                      <p className="text-white font-semibold">{fmtStrike(r.call_wall_strike)}</p>
                      <p className="text-gray-500">{r.pct_to_call_wall !== null ? `${r.pct_to_call_wall > 0 ? '+' : ''}${r.pct_to_call_wall.toFixed(1)}% away` : '—'}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Put Wall</p>
                      <p className="text-white font-semibold">{fmtStrike(r.put_wall_strike)}</p>
                      <p className="text-gray-500">{r.pct_to_put_wall !== null ? `${r.pct_to_put_wall > 0 ? '+' : ''}${r.pct_to_put_wall.toFixed(1)}% away` : '—'}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Flip Point</p>
                      <p className="text-white font-semibold">{fmtStrike(r.flip_point)}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Net GEX (near spot)</p>
                      <p className={`font-semibold ${r.net_gex_near_spot < 0 ? 'text-red-400' : 'text-emerald-400'}`}>{fmtNum(r.net_gex_near_spot)}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Days to Expiry</p>
                      <p className="text-white font-semibold">{r.days_to_expiry ?? '—'}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {filteredSignals.length > 8 && (
              <button onClick={() => setShowAllSignals(v => !v)}
                className="mt-3 text-xs font-semibold text-gray-400 hover:text-white px-3 py-1.5 rounded-lg border border-gray-800 hover:border-gray-600 transition-all">
                {showAllSignals ? 'Show fewer' : `Show all ${filteredSignals.length} signals`}
              </button>
            )}
          </div>
        )}

        {/* Watchlist — every stock's gamma profile */}
        {!loading && watchlist.length > 0 && (
          <div className="mt-2">
            <h2 className="text-sm font-black text-gray-300 mb-1 flex items-center gap-2">
              👀 Watchlist — Gamma Profile by Stock
            </h2>
            <p className="text-xs text-gray-600 mb-3">
              Every stock's call wall, put wall, flip point and current gamma regime. Click any column header to sort, or use the filters above to narrow the list.
            </p>
            {sortedWatchlist.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 border border-gray-800/50 rounded-xl">
                <p className="text-gray-500 text-sm">No stocks match your filters</p>
                <button onClick={clearFilters} className="mt-2 text-xs text-gray-400 hover:text-white underline">Clear filters</button>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto rounded-xl border border-gray-800">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-900/60 text-gray-500 text-left">
                        <SortTh label="Stock" col="symbol" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                        <SortTh label="CMP" col="cmp" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                        <SortTh label="Call Wall" col="call_wall_strike" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                        <SortTh label="% to Call Wall" col="pct_to_call_wall" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                        <SortTh label="Put Wall" col="put_wall_strike" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                        <SortTh label="% to Put Wall" col="pct_to_put_wall" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                        <SortTh label="Flip Point" col="flip_point" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                        <SortTh label="Net GEX" col="net_gex_near_spot" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                        <SortTh label="Regime" col="regime" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                      </tr>
                    </thead>
                    <tbody>
                      {pagedWatchlist.map(w => (
                        <tr key={w.symbol} className="border-t border-gray-800/60 hover:bg-gray-900/30">
                          <td className="px-3 py-2 font-bold text-white">{w.symbol}</td>
                          <td className="px-3 py-2 text-gray-300">₹{w.cmp.toLocaleString('en-IN')}</td>
                          <td className="px-3 py-2 text-gray-300">{fmtStrike(w.call_wall_strike)}</td>
                          <td className="px-3 py-2">
                            <span className={w.pct_to_call_wall !== null && Math.abs(w.pct_to_call_wall) <= 1.5 ? 'text-orange-400 font-bold' : 'text-gray-400'}>
                              {w.pct_to_call_wall !== null ? `${w.pct_to_call_wall > 0 ? '+' : ''}${w.pct_to_call_wall.toFixed(1)}%` : '—'}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-gray-300">{fmtStrike(w.put_wall_strike)}</td>
                          <td className="px-3 py-2">
                            <span className={w.pct_to_put_wall !== null && Math.abs(w.pct_to_put_wall) <= 1.5 ? 'text-orange-400 font-bold' : 'text-gray-400'}>
                              {w.pct_to_put_wall !== null ? `${w.pct_to_put_wall > 0 ? '+' : ''}${w.pct_to_put_wall.toFixed(1)}%` : '—'}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-gray-400">{fmtStrike(w.flip_point)}</td>
                          <td className="px-3 py-2">
                            <span className={w.net_gex_near_spot < 0 ? 'text-red-400' : 'text-emerald-400'}>{fmtNum(w.net_gex_near_spot)}</span>
                          </td>
                          <td className="px-3 py-2">
                            <span className={`font-bold px-2 py-0.5 rounded-full text-[10px] ${w.regime === 'SHORT_GAMMA' ? 'bg-red-900/40 text-red-400' : 'bg-emerald-900/40 text-emerald-400'}`}>
                              {w.regime === 'SHORT_GAMMA' ? 'SHORT' : 'LONG'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
                    <span>Showing {(pageSafe - 1) * PAGE_SIZE + 1}–{Math.min(pageSafe * PAGE_SIZE, sortedWatchlist.length)} of {sortedWatchlist.length}</span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={pageSafe === 1}
                        className="px-2.5 py-1 rounded-md border border-gray-800 hover:border-gray-600 disabled:opacity-30 disabled:hover:border-gray-800">
                        Prev
                      </button>
                      <span className="px-2 text-gray-400">{pageSafe} / {totalPages}</span>
                      <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={pageSafe === totalPages}
                        className="px-2.5 py-1 rounded-md border border-gray-800 hover:border-gray-600 disabled:opacity-30 disabled:hover:border-gray-800">
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <div className="mt-6 bg-gray-900/20 border border-gray-800/40 rounded-xl p-4">
          <p className="text-xs text-gray-600 leading-relaxed">
            <span className="text-gray-400 font-semibold">How to read (Gamma Exposure): </span>
            For every stock we back out implied volatility from each strike's live premium, compute that strike's Black-Scholes gamma, and weight it by
            open interest across the whole nearest-expiry chain. The <span className="text-gray-400">Call Wall</span> and <span className="text-gray-400">Put Wall</span> are
            the strikes carrying the most gamma-weighted OI on each side — real dealer hedging concentration, not just raw OI — and tend to act as resistance /
            support respectively. <span className="text-gray-400">Regime</span> is whether dealers are net <span className="text-red-400">short gamma</span> (their
            hedging amplifies moves — buying into strength, selling into weakness) or net <span className="text-emerald-400">long gamma</span> (hedging dampens
            moves, price tends to pin) right now, read from the gamma balance near the current spot. A <span className="text-yellow-400">squeeze signal</span> fires
            when a stock is short-gamma AND spot is pressing into its call or put wall — the setup where a breakout is most likely to accelerate rather than stall.
            No lot-size table is wired in yet, so Net GEX is shown in relative "gamma × OI" units, not rupees — still exactly right for comparing walls and regime
            within one stock, just not for ranking absolute size across stocks · Not investment advice
          </p>
        </div>
      </div>
    </div>
  )
}

function SortTh({ label, col, sortCol, sortDir, onSort }: {
  label: string
  col: string
  sortCol: string
  sortDir: 'asc' | 'desc'
  onSort: (col: string) => void
}) {
  const active = sortCol === col
  return (
    <th
      onClick={() => onSort(col)}
      className={`px-3 py-2 font-semibold cursor-pointer select-none whitespace-nowrap hover:text-white transition-colors ${active ? 'text-white' : ''}`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active ? (
          sortDir === 'desc' ? <ArrowDown size={11} /> : <ArrowUp size={11} />
        ) : (
          <span className="w-[11px]" />
        )}
      </span>
    </th>
  )
}
