'use client'
import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, ArrowUpRight, ArrowDownRight, ArrowUp, ArrowDown } from 'lucide-react'
import Navbar from '@/components/Navbar'
import { useAutoRefresh } from '@/lib/useAutoRefresh'

const API = 'https://greeknova-backend-production.up.railway.app'
const BENCHMARKS = ['NIFTY', 'BANKNIFTY', 'FINNIFTY']

interface Item {
  symbol: string; ltp: number; prev: number; open: number
  chg_pct: number; rs: number; signal: string; color: string
}
interface Data {
  benchmark: string; bench_ltp: number; bench_chg_pct: number
  items: Item[]; as_of: string; count: number
}

type SortKey = 'rs' | 'chg_pct' | 'symbol' | 'ltp'

export default function RelativeStrength() {
  const [data, setData]         = useState<Data | null>(null)
  const [loading, setLoading]   = useState(true)
  const [benchmark, setBenchmark] = useState('NIFTY')
  const [sortKey, setSortKey]   = useState<SortKey>('rs')
  const [sortAsc, setSortAsc]   = useState(false)
  const [filter, setFilter]     = useState<'all'|'out'|'under'>('all')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch(`${API}/relative-strength?benchmark=${benchmark}`)
      const json = await res.json()
      setData(json)
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [benchmark])

  useEffect(() => { fetchData() }, [benchmark])
  const { enabled: autoOn, toggle: toggleAuto, countdownStr } = useAutoRefresh(fetchData, 5*60*1000, true)

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(a => !a)
    else { setSortKey(key); setSortAsc(false) }
  }

  const items = (data?.items || [])
    .filter(i => {
      if (filter === 'out')   return i.rs > 0
      if (filter === 'under') return i.rs < 0
      return true
    })
    .sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey]
      if (typeof av === 'string') return sortAsc ? av.localeCompare(bv as string) : (bv as string).localeCompare(av)
      return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number)
    })

  const outperformers = data?.items.filter(i => i.rs > 0).length || 0
  const underperformers = data?.items.filter(i => i.rs < 0).length || 0

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <span className="text-gray-700 ml-1">↕</span>
    return sortAsc ? <ArrowUp size={11} className="inline ml-1"/> : <ArrowDown size={11} className="inline ml-1"/>
  }

  return (
    <div className="min-h-screen bg-[#07070e] text-white">
      <Navbar active="/rs" />
      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="text-3xl font-black tracking-tight mb-1">Relative Strength</h1>
            <p className="text-gray-500 text-sm">Stock performance vs benchmark index · Identify leaders & laggards</p>
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

        {/* Benchmark selector */}
        <div className="flex gap-2 mb-4">
          {BENCHMARKS.map(b => (
            <button key={b} onClick={() => setBenchmark(b)}
              className={`px-5 py-2.5 rounded-xl text-sm font-bold border transition-all ${benchmark === b ? 'bg-white text-gray-900 border-white' : 'bg-gray-900/40 text-gray-400 border-gray-800 hover:text-white'}`}>
              {b}
            </button>
          ))}
        </div>

        {/* Benchmark stats */}
        {data && (
          <div className="grid grid-cols-4 gap-3 mb-6">
            <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">{data.benchmark} Level</p>
              <p className="text-xl font-black text-white">{data.bench_ltp.toLocaleString()}</p>
            </div>
            <div className={`rounded-xl p-4 border ${data.bench_chg_pct >= 0 ? 'bg-emerald-950/20 border-emerald-800/40' : 'bg-red-950/20 border-red-800/40'}`}>
              <p className="text-xs text-gray-500 mb-1">{data.benchmark} Change</p>
              <p className={`text-xl font-black flex items-center gap-1 ${data.bench_chg_pct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {data.bench_chg_pct >= 0 ? <ArrowUpRight size={18}/> : <ArrowDownRight size={18}/>}
                {data.bench_chg_pct > 0 ? '+' : ''}{data.bench_chg_pct}%
              </p>
            </div>
            <div className="bg-emerald-950/20 border border-emerald-800/40 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">Outperformers</p>
              <p className="text-xl font-black text-emerald-400">{outperformers}</p>
              <p className="text-xs text-gray-600">RS {'>'} 0</p>
            </div>
            <div className="bg-red-950/20 border border-red-800/40 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">Underperformers</p>
              <p className="text-xl font-black text-red-400">{underperformers}</p>
              <p className="text-xs text-gray-600">RS {'<'} 0</p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-3 mb-4">
          {([['all','All'],['out','Outperformers ↑'],['under','Underperformers ↓']] as const).map(([v,l]) => (
            <button key={v} onClick={() => setFilter(v)}
              className={`px-4 py-2 rounded-lg text-xs font-bold border transition-all ${filter===v ? 'bg-white text-gray-900 border-white' : 'bg-gray-900/40 text-gray-400 border-gray-800 hover:text-white'}`}>
              {l}
            </button>
          ))}
          <span className="ml-auto text-xs text-gray-600">{items.length} stocks</span>
        </div>

        {/* Table */}
        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <RefreshCw size={24} className="text-gray-600 animate-spin"/>
          </div>
        ) : (
          <div className="bg-gray-900/20 border border-gray-800 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-500 text-xs">
                  <th className="py-3 px-5 text-left cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('symbol')}>
                    Symbol <SortIcon k="symbol"/>
                  </th>
                  <th className="py-3 px-4 text-right cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('ltp')}>
                    LTP <SortIcon k="ltp"/>
                  </th>
                  <th className="py-3 px-4 text-right cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('chg_pct')}>
                    Change % <SortIcon k="chg_pct"/>
                  </th>
                  <th className="py-3 px-4 text-right cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('rs')}>
                    RS vs {benchmark} <SortIcon k="rs"/>
                  </th>
                  <th className="py-3 px-5 text-left">Signal</th>
                  <th className="py-3 px-4 text-center">Strength Bar</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={item.symbol}
                    className={`border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors cursor-pointer ${i%2===0?'':'bg-gray-900/10'}`}
                    onClick={() => window.location.href=`/stock/${item.symbol}`}>
                    <td className="py-3 px-5">
                      <span className="font-black text-white hover:text-emerald-400 transition-colors">{item.symbol}</span>
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-white">
                      ₹{item.ltp.toLocaleString()}
                    </td>
                    <td className={`py-3 px-4 text-right font-bold ${item.chg_pct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      <span className="flex items-center justify-end gap-0.5">
                        {item.chg_pct >= 0 ? <ArrowUpRight size={13}/> : <ArrowDownRight size={13}/>}
                        {item.chg_pct > 0 ? '+' : ''}{item.chg_pct}%
                      </span>
                    </td>
                    <td className={`py-3 px-4 text-right font-black text-base ${item.rs > 0 ? 'text-emerald-400' : item.rs < 0 ? 'text-red-400' : 'text-gray-500'}`}>
                      {item.rs > 0 ? '+' : ''}{item.rs}
                    </td>
                    <td className={`py-3 px-5 text-xs font-semibold ${item.color}`}>{item.signal}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-1">
                        <div className="w-24 h-2 bg-gray-800 rounded-full overflow-hidden flex">
                          {item.rs >= 0 ? (
                            <>
                              <div className="w-1/2 h-full"/>
                              <div className="h-full bg-emerald-500 rounded-full transition-all"
                                style={{ width: `${Math.min(Math.abs(item.rs)*10, 50)}%` }}/>
                            </>
                          ) : (
                            <>
                              <div className="h-full bg-red-500 rounded-full transition-all ml-auto"
                                style={{ width: `${Math.min(Math.abs(item.rs)*10, 50)}%` }}/>
                              <div className="w-1/2 h-full"/>
                            </>
                          )}
                        </div>
                        <span className="text-[10px] text-gray-600 w-8 text-right">{item.rs > 0 ? '+' : ''}{item.rs}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Legend */}
        <div className="mt-4 flex items-center gap-6 text-xs text-gray-600">
          <span><span className="text-emerald-400">Strong Outperformer</span> — RS {'>'} +1%</span>
          <span><span className="text-green-400">Outperformer</span> — RS 0 to +1%</span>
          <span><span className="text-orange-400">Underperformer</span> — RS -1% to 0</span>
          <span><span className="text-red-400">Weak Underperformer</span> — RS {'<'} -1%</span>
        </div>
      </div>
    </div>
  )
}
