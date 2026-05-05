'use client'
import { useEffect, useState } from 'react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, Legend } from 'recharts'
import { RefreshCw, ArrowLeft } from 'lucide-react'

interface StrikeData {
  strike: number; ce_oi: number; pe_oi: number
  ce_ltp: number; pe_ltp: number; ce_volume: number; pe_volume: number; is_atm: boolean
  ce_iv?: number; pe_iv?: number; atm_iv?: number
}
interface StockData {
  symbol: string; cmp: number; pcr: number
  total_ce_oi: number; total_pe_oi: number; strikes: StrikeData[]
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  const ce = payload.find((p: any) => p.dataKey === 'ce_oi')
  const pe = payload.find((p: any) => p.dataKey === 'pe_oi')
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-3 shadow-xl">
      <p className="text-white font-bold mb-2">Strike: {label}</p>
      {ce && <p className="text-sm text-red-400">CE OI: {(ce.value/100000).toFixed(1)}L</p>}
      {pe && <p className="text-sm text-emerald-400">PE OI: {(pe.value/100000).toFixed(1)}L</p>}
    </div>
  )
}

export default function StockDeepDive({ params }: { params: { symbol: string } }) {
  const symbol = params.symbol.toUpperCase()
  const [data, setData] = useState<StockData | null>(null)
  const [loading, setLoading] = useState(true)
  const [history, setHistory] = useState<any>(null)
  const [selectedStrike, setSelectedStrike] = useState<number | null>(null)
  const [pcrHistory, setPcrHistory] = useState<any[]>([])

  async function fetchData() {
    setLoading(true)
    try {
      const res = await fetch(`http://localhost:8000/stock-oi/${symbol}`)
      const json = await res.json()
      setData(json)
    } catch (e) { console.error(e) }
    try {
      const hres = await fetch(`http://localhost:8000/oi-history/${symbol}`)
      const hjson = await hres.json()
      setHistory(hjson)
      if (hjson.strikes?.length) setSelectedStrike(hjson.strikes[Math.floor(hjson.strikes.length/2)].strike)
    } catch (e) { console.error(e) }
    try {
      const pres = await fetch(`http://localhost:8000/pcr-trend/${symbol}`)
      const pjson = await pres.json()
      setPcrHistory(pjson.points || [])
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [symbol])

  const bull = data && data.pcr > 1
  const ceP = data ? Math.round((data.total_ce_oi / (data.total_ce_oi + data.total_pe_oi)) * 100) : 50
  const atm = data?.strikes.find(s => s.is_atm)
  const maxCEStrike = data?.strikes.reduce((a, b) => a.ce_oi > b.ce_oi ? a : b)
  const maxPEStrike = data?.strikes.reduce((a, b) => a.pe_oi > b.pe_oi ? a : b)

  return (
    <div className="min-h-screen bg-[#07070e] text-white">
      <nav className="sticky top-0 z-50 border-b border-gray-800/50 bg-[#07070e]/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-600 flex items-center justify-center">
              <span className="text-xs font-black text-white">GN</span>
            </div>
            <span className="font-black text-white text-base">GreekNova</span>
            <span className="ml-1 text-xs font-medium px-1.5 py-0.5 bg-emerald-950 text-emerald-500 border border-emerald-800/50 rounded-md">BETA</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="/" className="text-sm text-gray-400 hover:text-white transition-colors">Dashboard</a>
            <a href="/premarket" className="text-sm text-gray-400 hover:text-white transition-colors">Pre-Market</a>
            <a href="/watchlist" className="text-sm text-gray-400 hover:text-white transition-colors">Watchlist</a>
            <a href="/scanners" className="text-sm text-gray-400 hover:text-white transition-colors">Scanners</a>
            <a href="/charts" className="text-sm text-gray-400 hover:text-white transition-colors">OI Charts</a>
            <a href="/pcr" className="text-sm text-gray-400 hover:text-white transition-colors">PCR Trend</a>
            <a href="/spikes" className="text-sm text-gray-400 hover:text-white transition-colors">OI Spikes</a>
            <a href="/volume" className="text-sm text-gray-400 hover:text-white transition-colors">Vol Spikes</a>
            <a href="/uoa" className="text-sm text-gray-400 hover:text-white transition-colors">UOA</a>
            <a href="/confluence" className="text-sm text-gray-400 hover:text-white transition-colors">Confluence</a>
            <a href="/maxpain" className="text-sm text-gray-400 hover:text-white transition-colors">Max Pain</a>
            <a href="/alerts" className="text-sm text-gray-400 hover:text-white transition-colors">Alerts</a>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center gap-4 mb-8">
          <a href="/scanners" className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
            <ArrowLeft size={16}/>Back to Scanners
          </a>
          <div className="w-px h-5 bg-gray-800"/>
          <h1 className="text-3xl font-black tracking-tight">{symbol}</h1>
          {data && <span className="text-2xl font-black text-amber-400">₹{data.cmp.toLocaleString()}</span>}
          {data && (
            <span className={`px-3 py-1 rounded-full text-sm font-bold border ${bull ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800' : 'bg-red-950/80 text-red-400 border-red-800'}`}>
              PCR {data.pcr} — {bull ? 'BULLISH' : 'BEARISH'}
            </span>
          )}
          <button onClick={fetchData} disabled={loading} className="ml-auto flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-sm font-medium text-white rounded-lg border border-gray-700 transition-all disabled:opacity-50">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''}/>Refresh
          </button>
        </div>

        {data && (
          <div className="grid grid-cols-4 gap-3 mb-6">
            <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">ATM Strike</p>
              <p className="text-2xl font-black text-white">{atm?.strike.toLocaleString() || '—'}</p>
              <p className="text-xs text-gray-600">CMP: ₹{data.cmp}</p>
            </div>
            <div className="bg-red-950/20 border border-red-800/40 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">Max CE (Resistance)</p>
              <p className="text-2xl font-black text-red-400">{maxCEStrike?.strike.toLocaleString()}</p>
              <p className="text-xs text-gray-600">{maxCEStrike ? (maxCEStrike.ce_oi/100000).toFixed(1) : 0}L OI</p>
            </div>
            <div className="bg-emerald-950/20 border border-emerald-800/40 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">Max PE (Support)</p>
              <p className="text-2xl font-black text-emerald-400">{maxPEStrike?.strike.toLocaleString()}</p>
              <p className="text-xs text-gray-600">{maxPEStrike ? (maxPEStrike.pe_oi/100000).toFixed(1) : 0}L OI</p>
            </div>
            <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-2">OI Split</p>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-red-400">CE {ceP}%</span>
                <div className="flex-1 h-1.5 rounded-full bg-gray-800 overflow-hidden flex">
                  <div className="bg-red-500/70 h-full" style={{ width: `${ceP}%` }}/>
                  <div className="bg-emerald-500/70 h-full" style={{ width: `${100-ceP}%` }}/>
                </div>
                <span className="text-xs font-bold text-emerald-400">PE {100-ceP}%</span>
              </div>
            </div>
          </div>
        )}

        <div className="bg-gray-900/30 border border-gray-800 rounded-2xl p-6 mb-6">
          <h2 className="text-base font-bold text-white mb-1">Strike-wise OI — {symbol}</h2>
          <p className="text-xs text-gray-500 mb-5">Red = CE OI (resistance) · Green = PE OI (support) · Dashed = ATM</p>
          {loading ? (
            <div className="h-72 flex items-center justify-center"><RefreshCw size={24} className="text-gray-600 animate-spin"/></div>
          ) : data?.strikes.length ? (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={data.strikes} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false}/>
                <XAxis dataKey="strike" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false}/>
                <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={v => `${(v/100000).toFixed(0)}L`}/>
                <Tooltip content={<CustomTooltip/>} cursor={{ fill: 'rgba(255,255,255,0.03)' }}/>
                {atm && <ReferenceLine x={atm.strike} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: `ATM ${atm.strike}`, fill: '#f59e0b', fontSize: 10 }}/>}
                <Bar dataKey="ce_oi" name="CE OI" fill="#ef4444" opacity={0.85} radius={[3,3,0,0]}/>
                <Bar dataKey="pe_oi" name="PE OI" fill="#10b981" opacity={0.85} radius={[3,3,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          ) : null}
        </div>


        {/* OI History Chart */}
        {history?.strikes?.length > 0 && (
          <div className="bg-gray-900/30 border border-gray-800 rounded-2xl p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-white">Intraday OI Build-up</h2>
                <p className="text-xs text-gray-500 mt-0.5">How OI changed through the day · Select a strike to analyse</p>
              </div>
              <select
                value={selectedStrike || ''}
                onChange={e => setSelectedStrike(Number(e.target.value))}
                className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-emerald-500">
                {history.strikes.map((s: any) => (
                  <option key={s.strike} value={s.strike}>Strike {s.strike.toLocaleString()}</option>
                ))}
              </select>
            </div>
            {selectedStrike && (() => {
              const s = history.strikes.find((x: any) => x.strike === selectedStrike)
              if (!s) return null
              const chartData = history.timestamps.map((t: string, i: number) => ({
                time: t,
                CE: s.ce_series[i],
                PE: s.pe_series[i],
              })).filter((d: any) => d.CE !== null || d.PE !== null)
              const firstCE = chartData.find((d: any) => d.CE)?.CE || 0
              const lastCE = [...chartData].reverse().find((d: any) => d.CE)?.CE || 0
              const firstPE = chartData.find((d: any) => d.PE)?.PE || 0
              const lastPE = [...chartData].reverse().find((d: any) => d.PE)?.PE || 0
              const ceChg = firstCE > 0 ? Math.round((lastCE - firstCE) / firstCE * 100) : 0
              const peChg = firstPE > 0 ? Math.round((lastPE - firstPE) / firstPE * 100) : 0
              return (
                <div>
                  <div className="flex gap-3 mb-4">
                    <div className="bg-red-950/20 border border-red-800/40 rounded-xl px-4 py-2 flex items-center gap-3">
                      <div>
                        <p className="text-xs text-gray-500">CE OI Change</p>
                        <p className={`text-lg font-black ${ceChg > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{ceChg > 0 ? '+' : ''}{ceChg}%</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-600">{(firstCE/100000).toFixed(1)}L → {(lastCE/100000).toFixed(1)}L</p>
                      </div>
                    </div>
                    <div className="bg-emerald-950/20 border border-emerald-800/40 rounded-xl px-4 py-2 flex items-center gap-3">
                      <div>
                        <p className="text-xs text-gray-500">PE OI Change</p>
                        <p className={`text-lg font-black ${peChg > 0 ? 'text-emerald-400' : 'text-red-400'}`}>{peChg > 0 ? '+' : ''}{peChg}%</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-600">{(firstPE/100000).toFixed(1)}L → {(lastPE/100000).toFixed(1)}L</p>
                      </div>
                    </div>
                    <div className="bg-gray-800/40 border border-gray-700/40 rounded-xl px-4 py-2">
                      <p className="text-xs text-gray-500">Signal</p>
                      <p className="text-sm font-bold text-amber-400">
                        {ceChg > 10 && peChg < 0 ? '🔴 CE Build + PE Unwind = Bearish' :
                         peChg > 10 && ceChg < 0 ? '🟢 PE Build + CE Unwind = Bullish' :
                         ceChg > 10 && peChg > 10 ? '⚔️ Both Building = Battleground' :
                         ceChg < -10 ? '🟢 CE Unwind = Shorts Covering' :
                         '➡️ Gradual buildup'}
                      </p>
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false}/>
                      <XAxis dataKey="time" tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} axisLine={false}/>
                      <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={v => `${(v/100000).toFixed(0)}L`}/>
                      <Tooltip formatter={(v: any) => `${(v/100000).toFixed(1)}L`} contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: '12px' }} labelStyle={{ color: 'white', fontWeight: 'bold' }}/>
                      <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}/>
                      <Line type="monotone" dataKey="CE" stroke="#ef4444" strokeWidth={2} dot={{ r: 2 }} connectNulls/>
                      <Line type="monotone" dataKey="PE" stroke="#10b981" strokeWidth={2} dot={{ r: 2 }} connectNulls/>
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )
            })()}
          </div>
        )}

        
        {/* PCR Trend for this stock */}
        {pcrHistory.length > 0 && (
          <div className="bg-gray-900/30 border border-gray-800 rounded-2xl p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-white">PCR Trend — {symbol}</h2>
                <p className="text-xs text-gray-500 mt-0.5">Put-Call Ratio through the day · Above 1.0 = bullish · Below 0.8 = bearish</p>
              </div>
              <div className="flex items-center gap-3">
                <div className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${pcrHistory[pcrHistory.length-1]?.pcr > 1 ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800' : 'bg-red-950/60 text-red-400 border-red-800'}`}>
                  PCR {pcrHistory[pcrHistory.length-1]?.pcr}
                </div>
                <div className="text-xs text-gray-500">
                  {pcrHistory.length} snapshots today
                </div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={pcrHistory} margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false}/>
                <XAxis dataKey="time" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false}/>
                <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} domain={['auto','auto']}/>
                <Tooltip formatter={(v: any) => v} contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: '12px' }} labelStyle={{ color: 'white', fontWeight: 'bold' }}/>
                <ReferenceLine y={1.0} stroke="#10b981" strokeDasharray="4 4" strokeOpacity={0.5} label={{ value: '1.0', fill: '#10b981', fontSize: 9, position: 'insideRight' }}/>
                <ReferenceLine y={0.8} stroke="#ef4444" strokeDasharray="4 4" strokeOpacity={0.5} label={{ value: '0.8', fill: '#ef4444', fontSize: 9, position: 'insideRight' }}/>
                <Line type="monotone" dataKey="pcr" stroke="#f59e0b" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} connectNulls/>
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

                <div className="bg-gray-900/30 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-gray-800 flex items-center justify-between">
            <h2 className="text-base font-bold text-white">Options Chain</h2>
            <p className="text-xs text-gray-500">Highlighted = max OI strike</p>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-gray-900/60 border-b border-gray-800">
                <th className="text-xs font-semibold text-red-400 px-4 py-3 text-right">CE OI</th>
                <th className="text-xs font-semibold text-red-400 px-4 py-3 text-right">CE LTP</th>
                <th className="text-xs font-semibold text-orange-400 px-4 py-3 text-right">CE IV</th>
                <th className="text-xs font-semibold text-red-400 px-4 py-3 text-right">CE Vol</th>
                <th className="text-xs font-semibold text-white px-4 py-3 text-center bg-gray-800/60">STRIKE</th>
                <th className="text-xs font-semibold text-emerald-400 px-4 py-3 text-left">PE Vol</th>
                <th className="text-xs font-semibold text-emerald-400 px-4 py-3 text-left">PE LTP</th>
                <th className="text-xs font-semibold text-orange-400 px-4 py-3 text-left">PE IV</th>
                <th className="text-xs font-semibold text-emerald-400 px-4 py-3 text-left">PE OI</th>
              </tr>
            </thead>
            <tbody>
              {data?.strikes.map((row, i) => {
                const isMaxCE = row.ce_oi === maxCEStrike?.ce_oi
                const isMaxPE = row.pe_oi === maxPEStrike?.pe_oi
                return (
                  <tr key={row.strike} className={`border-b border-gray-800/50 transition-colors ${row.is_atm ? 'bg-amber-950/20' : i%2===0 ? '' : 'bg-gray-900/20'} hover:bg-gray-800/20`}>
                    <td className={`px-4 py-3 text-right text-sm font-bold ${isMaxCE ? 'text-red-300' : 'text-gray-400'}`}>{(row.ce_oi/100000).toFixed(1)}L</td>
                    <td className="px-4 py-3 text-right text-sm text-red-400">₹{row.ce_ltp}</td>
                    <td className="px-4 py-3 text-right text-xs font-bold text-orange-400">{row.ce_iv ? `${row.ce_iv}%` : "—"}</td>
                    <td className="px-4 py-3 text-right text-xs text-gray-500">{(row.ce_volume/100000).toFixed(1)}L</td>
                    <td className={`px-4 py-3 text-center text-sm font-black bg-gray-800/40 ${row.is_atm ? 'text-amber-400' : 'text-white'}`}>
                      {row.strike.toLocaleString()}{row.is_atm && <span className="ml-1 text-xs text-amber-500">ATM</span>}
                    </td>
                    <td className="px-4 py-3 text-left text-xs text-gray-500">{(row.pe_volume/100000).toFixed(1)}L</td>
                    <td className="px-4 py-3 text-left text-sm text-emerald-400">₹{row.pe_ltp}</td>
                    <td className="px-4 py-3 text-left text-xs font-bold text-orange-400">{row.pe_iv ? `${row.pe_iv}%` : "—"}</td>
                    <td className={`px-4 py-3 text-left text-sm font-bold ${isMaxPE ? 'text-emerald-300' : 'text-gray-400'}`}>{(row.pe_oi/100000).toFixed(1)}L</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
