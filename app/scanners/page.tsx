'use client'
import Navbar from '@/components/Navbar'
export const dynamic = 'force-dynamic'
import { useAutoRefresh } from "@/lib/useAutoRefresh"
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { RefreshCw, TrendingUp, TrendingDown, Clock } from 'lucide-react'

interface StockRow {
  symbol: string; pcr: number; totalCE: number; totalPE: number
  ceWall: number; peWall: number; signal: string; strength: string
  isIndex: boolean; cmp: number; distToCE: number; distToPE: number
}

const TABS = [
  { id: 'all', label: 'All Signals', icon: '◈' },
  { id: 'PUT_WRITING', label: 'Put Writing', icon: '↑', desc: 'Support building' },
  { id: 'CALL_WRITING', label: 'Call Writing', icon: '↓', desc: 'Ceiling forming' },
  { id: 'SQUEEZE', label: 'IV Squeeze', icon: '⚡', desc: 'Big move pending' },
  { id: 'BATTLEGROUND', label: 'Battleground', icon: '⚔', desc: 'Two-way writing' },
]

const META: Record<string, { color: string; bg: string; border: string; label: string }> = {
  PUT_WRITING:  { color: 'text-emerald-400', bg: 'bg-emerald-950/50', border: 'border-emerald-800/50', label: 'Put Writing' },
  CALL_WRITING: { color: 'text-red-400',     bg: 'bg-red-950/50',     border: 'border-red-800/50',     label: 'Call Writing' },
  SQUEEZE:      { color: 'text-amber-400',   bg: 'bg-amber-950/50',   border: 'border-amber-800/50',   label: 'IV Squeeze' },
  BATTLEGROUND: { color: 'text-violet-400',  bg: 'bg-violet-950/50',  border: 'border-violet-800/50',  label: 'Battleground' },
}


function getMarketStructure(cmp: number, ceWall: number, peWall: number): { label: string; color: string } {
  if (!cmp || !ceWall || !peWall) return { label: 'Insufficient Data', color: 'text-gray-500' }
  const distToCE = ceWall > cmp ? ((ceWall - cmp) / cmp * 100) : 0
  const distToPE = peWall < cmp ? ((cmp - peWall) / cmp * 100) : 0
  const totalRange = ceWall - peWall
  const posInRange = totalRange > 0 ? ((cmp - peWall) / totalRange * 100) : 50

  if (distToCE <= 0.5) return { label: 'Breakout Watch', color: 'text-emerald-300' }
  if (distToPE <= 0.5) return { label: 'Breakdown Watch', color: 'text-red-300' }
  if (distToCE <= 2) return { label: 'Resistance Test', color: 'text-red-400' }
  if (distToPE <= 2) return { label: 'Support Test', color: 'text-emerald-400' }
  if (posInRange >= 60) return { label: 'Upper Range', color: 'text-orange-400' }
  if (posInRange <= 40) return { label: 'Lower Range', color: 'text-cyan-400' }
  return { label: 'Mid Range', color: 'text-amber-400' }
}

function getSignal(pcr: number, totalCE: number, totalPE: number): string {
  const ratio = totalPE / (totalCE + totalPE)
  if (pcr > 1.4) return 'PUT_WRITING'
  if (pcr < 0.6) return 'CALL_WRITING'
  if (ratio > 0.44 && ratio < 0.56) return 'BATTLEGROUND'
  return 'SQUEEZE'
}

function DistanceBar({ cmp, ceWall, peWall }: { cmp: number; ceWall: number; peWall: number }) {
  if (!cmp || !ceWall || !peWall) return null
  const distCE = ceWall > cmp ? ((ceWall - cmp) / cmp * 100) : 0
  const distPE = peWall < cmp ? ((cmp - peWall) / cmp * 100) : 0
  const totalRange = ceWall - peWall
  const pos = totalRange > 0 ? ((cmp - peWall) / totalRange * 100) : 50
  return (
    <div className="mt-3 pt-3 border-t border-gray-800/60">
      <div className="flex justify-between text-xs mb-1.5">
        <span className="text-emerald-400 font-medium">PE {peWall.toLocaleString()} <span className="text-gray-600">↓{distPE.toFixed(1)}%</span></span>
        <span className="text-amber-400 font-bold">₹{cmp.toLocaleString()}</span>
        <span className="text-red-400 font-medium"><span className="text-gray-600">{distCE.toFixed(1)}%↑</span> CE {ceWall.toLocaleString()}</span>
      </div>
      <div className="relative h-2 bg-gray-800 rounded-full overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-900/60 via-gray-700/30 to-red-900/60 rounded-full" />
        <div className="absolute top-0 h-full w-0.5 bg-white rounded-full transition-all duration-500"
          style={{ left: `${Math.min(95, Math.max(5, pos))}%` }} />
      </div>
      <p className="text-xs text-gray-600 mt-1 text-center">
        {distCE < distPE ? `${distCE.toFixed(1)}% to resistance` : `${distPE.toFixed(1)}% to support`}
      </p>
    </div>
  )
}

function SignalCard({ row }: { row: StockRow }) {
  const m = META[row.signal]
  const bull = row.pcr > 1
  const ceP = Math.round((row.totalCE / (row.totalCE + row.totalPE)) * 100)
  return (
    <a href={"/stock/" + row.symbol} className="block bg-gray-900/30 border border-gray-800 rounded-xl p-4 hover:border-emerald-700 hover:bg-gray-900/50 transition-all">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-base font-black text-white">{row.symbol}</span>
            {row.isIndex && <span className="text-xs px-1.5 py-0.5 bg-cyan-950 text-cyan-400 border border-cyan-800/50 rounded-md">INDEX</span>}
          </div>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-lg border mt-1.5 inline-flex items-center gap-1 ${m.color} ${m.bg} ${m.border}`}>{m.label}</span>
        </div>
        <div className="text-right">
          <p className={`text-xl font-black ${bull ? 'text-emerald-400' : 'text-red-400'}`}>{row.pcr.toFixed(2)}</p>
          <p className="text-xs text-gray-600">PCR</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div className="bg-red-950/20 border border-red-900/30 rounded-lg p-2">
          <p className="text-xs text-gray-600 mb-0.5">CE Wall</p>
          <p className="text-sm font-bold text-red-400">{row.ceWall.toLocaleString()}</p>
        </div>
        <div className="bg-emerald-950/20 border border-emerald-900/30 rounded-lg p-2">
          <p className="text-xs text-gray-600 mb-0.5">PE Wall</p>
          <p className="text-sm font-bold text-emerald-400">{row.peWall.toLocaleString()}</p>
        </div>
      </div>
      <div className="mb-1">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-red-400">CE {ceP}%</span>
          <span className="text-emerald-400">PE {100-ceP}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-gray-800 overflow-hidden flex">
          <div className="bg-red-500/70 h-full" style={{ width: `${ceP}%` }} />
          <div className="bg-emerald-500/70 h-full" style={{ width: `${100-ceP}%` }} />
        </div>
      </div>
      <DistanceBar cmp={row.cmp} ceWall={row.ceWall} peWall={row.peWall} />
      {row.cmp > 0 && (() => {
        const ms = getMarketStructure(row.cmp, row.ceWall, row.peWall)
        return (
          <div className="mt-2 pt-2 border-t border-gray-800/60 flex items-center justify-between">
            <span className="text-xs text-gray-600">OI Structure</span>
            <span className={`text-xs font-bold ${ms.color}`}>{ms.label}</span>
          </div>
        )
      })()}
    </a>
  )
}

export default function Scanners() {
  const [tab, setTab] = useState('all')
  const [view, setView] = useState<'cards' | 'table'>('cards')
  const [rows, setRows] = useState<StockRow[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState('')
  const { enabled: autoEnabled, toggle: toggleAuto, countdownStr } = useAutoRefresh(fetchData)
  const [filter, setFilter] = useState<'all' | 'index' | 'stocks'>('all')
  const [structureFilter, setStructureFilter] = useState<string>('all')

  async function fetchData() {
    setLoading(true)
    try {
      const { data: latest } = await supabase.from('oi_snapshots')
        .select('timestamp').order('timestamp', { ascending: false }).limit(1)
      if (!latest?.length) { setLoading(false); return }

      const ts = latest[0].timestamp
      setLastUpdate(new Date(ts).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }))

      const [{ data }, { data: cmpData }] = await Promise.all([
        supabase.from('oi_snapshots').select('*').eq('timestamp', ts),
        supabase.from('cmp_prices').select('*').order('timestamp', { ascending: false }).limit(100)
      ])

      if (!data) { setLoading(false); return }

      // Build CMP map from latest prices
      const cmpMap: Record<string, number> = {}
      if (cmpData) {
        const seen = new Set()
        cmpData.forEach((c: any) => {
          if (!seen.has(c.symbol)) { cmpMap[c.symbol] = c.cmp; seen.add(c.symbol) }
        })
      }

      const symbols = [...new Set(data.map((d: any) => d.symbol))]
      const result: StockRow[] = []

      for (const sym of symbols) {
        const r = data.filter((d: any) => d.symbol === sym)
        const ce = r.filter((d: any) => d.option_type === 'CE')
        const pe = r.filter((d: any) => d.option_type === 'PE')
        const totalCE = ce.reduce((s: number, d: any) => s + d.oi, 0)
        const totalPE = pe.reduce((s: number, d: any) => s + d.oi, 0)
        if (!totalCE && !totalPE) continue
        const pcr = totalCE > 0 ? totalPE / totalCE : 0
        const ceWall = [...ce].sort((a: any, b: any) => b.oi - a.oi)[0]?.strike || 0
        const peWall = [...pe].sort((a: any, b: any) => b.oi - a.oi)[0]?.strike || 0
        const isIndex = ['NIFTY', 'BANKNIFTY', 'FINNIFTY'].includes(sym as string)
        const cmp = cmpMap[sym as string] || 0
        const distToCE = ceWall > cmp && cmp > 0 ? (ceWall - cmp) / cmp * 100 : 0
        const distToPE = peWall < cmp && cmp > 0 ? (cmp - peWall) / cmp * 100 : 0

        result.push({
          symbol: sym as string, pcr: Math.round(pcr * 100) / 100,
          totalCE, totalPE, ceWall, peWall, isIndex,
          cmp: Math.round(cmp * 100) / 100,
          distToCE: Math.round(distToCE * 10) / 10,
          distToPE: Math.round(distToPE * 10) / 10,
          signal: getSignal(pcr, totalCE, totalPE),
          strength: Math.abs(pcr - 1) > 0.5 ? 'Strong' : 'Moderate',
        })
      }
      if (result.length > 0) setRows(result.sort((a, b) => Math.abs(b.pcr - 1) - Math.abs(a.pcr - 1)))
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])
  const filtered = rows.filter(r => tab === 'all' || r.signal === tab).filter(r => filter === 'all' || (filter === 'index' ? r.isIndex : !r.isIndex))
    .filter(r => {
      if (structureFilter === 'all') return true
      const ms = getMarketStructure(r.cmp, r.ceWall, r.peWall)
      return ms.label === structureFilter
    })

  return (
    <div className="min-h-screen bg-[#07070e] text-white">
      <Navbar active="/scanners" />

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black tracking-tight mb-1">Options Scanner</h1>
            <p className="text-gray-500 text-sm">30 F&O stocks + 3 indices · Live CMP vs OI walls</p>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdate && <div className="flex items-center gap-1.5 text-xs text-gray-600 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2"><Clock size={11}/>{lastUpdate}</div>}
            <button onClick={toggleAuto} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${autoEnabled ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60' : 'bg-gray-900/40 text-gray-500 border-gray-800'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${autoEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`}/>
              {autoEnabled ? countdownStr : 'Auto'}
            </button>
            <button onClick={fetchData} disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-sm font-medium text-white rounded-lg border border-gray-700 transition-all disabled:opacity-50">
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''}/>Refresh
            </button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3 mb-6">
          {TABS.filter(t => t.id !== 'all').map(t => {
            const count = rows.filter(r => r.signal === t.id).length
            const m = META[t.id]
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`p-4 rounded-xl border text-left transition-all ${tab === t.id ? `${m.bg} ${m.border}` : 'bg-gray-900/30 border-gray-800 hover:border-gray-700'}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-lg">{t.icon}</span>
                  <span className={`text-2xl font-black ${tab === t.id ? m.color : 'text-white'}`}>{count}</span>
                </div>
                <p className={`text-sm font-bold ${tab === t.id ? m.color : 'text-gray-400'}`}>{t.label}</p>
                <p className="text-xs text-gray-600">{t.desc}</p>
              </button>
            )
          })}
        </div>

        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-2 flex-wrap">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${tab === t.id ? 'bg-white text-gray-900 border-white' : 'bg-gray-900/40 text-gray-400 border-gray-800 hover:text-white'}`}>
                {t.icon} {t.label}
                {t.id !== 'all' && <span className="ml-1.5 opacity-60">{rows.filter(r => r.signal === t.id).length}</span>}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {['all','index','stocks'].map(f => (
              <button key={f} onClick={() => setFilter(f as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all capitalize ${filter === f ? 'bg-gray-700 text-white border-gray-600' : 'bg-gray-900/40 text-gray-500 border-gray-800 hover:text-white'}`}>{f}</button>
            ))}
            <div className="w-px h-5 bg-gray-800 mx-1"/>
            {[
              { label: 'All Structure', value: 'all' },
              { label: 'Breakout Watch', value: 'Breakout Watch' },
              { label: 'Breakdown Watch', value: 'Breakdown Watch' },
              { label: 'Resistance Test', value: 'Resistance Test' },
              { label: 'Support Test', value: 'Support Test' },
              { label: 'Mid Range', value: 'Mid Range' },
            ].map(s => (
              <button key={s.value} onClick={() => setStructureFilter(s.value)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all whitespace-nowrap ${structureFilter === s.value ? 'bg-white text-gray-900 border-white' : 'bg-gray-900/40 text-gray-400 border-gray-800 hover:text-white'}`}>
                {s.label}
              </button>
            ))}
            <div className="w-px h-5 bg-gray-800 mx-1"/>
            {(['cards','table'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${view === v ? 'bg-gray-700 text-white border-gray-600' : 'bg-gray-900/40 text-gray-500 border-gray-800 hover:text-white'}`}>
                {v === 'cards' ? '⊞ Cards' : '≡ Table'}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-3 gap-3">{[1,2,3,4,5,6].map(i=><div key={i} className="h-56 bg-gray-900/30 border border-gray-800 rounded-xl animate-pulse"/>)}</div>
        ) : filtered.length > 0 ? (
          view === 'cards' ? (
            <div className="grid grid-cols-3 gap-3">{filtered.map(row=><SignalCard key={row.symbol} row={row}/>)}</div>
          ) : (
            <div className="rounded-2xl border border-gray-800 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-900/60 border-b border-gray-800">
                    {['Symbol','Signal','PCR','CMP','CE Wall','→CE%','PE Wall','→PE%','OI Split'].map((h,i)=>(
                      <th key={h} className={`text-xs font-semibold text-gray-500 px-4 py-3.5 ${i<=1||i===8?'text-left':'text-right'} ${i===0?'pl-5':''} ${i===9?'pr-5':''}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row,i)=>{
                    const m=META[row.signal]
                    const ceP=Math.round((row.totalCE/(row.totalCE+row.totalPE))*100)
                    return (
                      <tr key={row.symbol} className={`border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors ${i%2===0?'':'bg-gray-900/20'}`}>
                        <td className="px-5 py-3.5"><div className="flex items-center gap-2"><span className="text-sm font-black text-white">{row.symbol}</span>{row.isIndex&&<span className="text-xs px-1.5 py-0.5 bg-cyan-950 text-cyan-400 border border-cyan-800/50 rounded-md">IDX</span>}</div></td>
                        <td className="px-4 py-3.5"><span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${m.color} ${m.bg} ${m.border}`}>{m.label}</span></td>
                        <td className={`px-4 py-3.5 text-right text-sm font-black ${row.pcr>1?'text-emerald-400':'text-red-400'}`}>{row.pcr.toFixed(2)}</td>
                        <td className="px-4 py-3.5 text-right text-sm font-bold text-amber-400">₹{row.cmp.toLocaleString()}</td>
                        <td className="px-4 py-3.5 text-right text-sm font-bold text-red-400">{row.ceWall.toLocaleString()}</td>
                        <td className="px-4 py-3.5 text-right text-xs text-red-300">{row.distToCE}%</td>
                        <td className="px-4 py-3.5 text-right text-sm font-bold text-emerald-400">{row.peWall.toLocaleString()}</td>
                        <td className="px-4 py-3.5 text-right text-xs text-emerald-300">{row.distToPE}%</td>
                        <td className="px-4 py-3.5 text-left">
                        {(() => { const ms = getMarketStructure(row.cmp, row.ceWall, row.peWall); return <span className={`text-xs font-bold ${ms.color}`}>{ms.label}</span> })()}
                      </td>
                      <td className="px-5 py-3.5 text-right text-xs text-gray-500">{ceP}%/{100-ceP}%</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="text-5xl mb-4">🔍</div>
            <h3 className="text-lg font-bold text-gray-400 mb-2">No signals for this filter</h3>
            <p className="text-sm text-gray-600">Live signals appear during market hours · Mon–Fri 9:15–3:30</p>
          </div>
        )}
      </div>
    </div>
  )
}
