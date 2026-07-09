'use client'
import Navbar from '@/components/Navbar'
import { useState } from 'react'
import { Bell, BellOff, RefreshCw, Trash2, Clock, Search, X, ExternalLink } from 'lucide-react'
import { useAlerts } from '@/contexts/AlertsContext'
import { SIGNAL_META, DEFAULT_META } from '@/lib/alertMeta'

export default function Alerts() {
  const {
    alerts, enabled, permission, swReady, marketOpen, lastCheck,
    spikeThreshold, setSpikeThreshold,
    enableAlerts, disableAlerts, checkNow, clearAlerts, playSound,
  } = useAlerts()

  const [search, setSearch]           = useState('')
  const [typeFilter, setTypeFilter]   = useState('all')
  const [sortOrder, setSortOrder]     = useState<'newest'|'oldest'>('newest')

  const uniqueSymbols = [...new Set(alerts.map(a => a.symbol))].sort()
  const uniqueTypes   = [...new Set(alerts.map(a => a.signal))]

  const filtered = alerts
    .filter(a => {
      if (search) {
        const s = search.toUpperCase()
        return a.symbol?.includes(s) || a.signal?.includes(s)
      }
      return true
    })
    .filter(a => typeFilter === 'all' || a.signal === typeFilter)
    .sort((a, b) => sortOrder === 'newest' ? b.id - a.id : a.id - b.id)

  const statusText = () => {
    if (!swReady) return 'Loading service worker...'
    if (permission === 'denied') return '⚠️ Notifications blocked — enable in browser settings'
    if (!enabled) return 'Click Enable to start background monitoring'
    if (!marketOpen) return '⏸️ Active — market closed, checks auto-resume at 9:15 AM IST'
    return '✅ Running — self-scheduling every 5 min, works across all tabs'
  }

  return (
    <div className="min-h-screen bg-[#07070e] text-white">
      <Navbar active="/alerts" />

      <div className="max-w-7xl mx-auto px-6 py-8">

        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="text-3xl font-black tracking-tight mb-1">🔔 Signal Alerts</h1>
            <p className="text-gray-500 text-sm">Background monitoring · Works across all tabs · Also visible via the bell icon on every page</p>
          </div>
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border ${marketOpen ? 'bg-emerald-950/30 border-emerald-800/50 text-emerald-400' : 'bg-gray-900 border-gray-800 text-gray-500'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${marketOpen ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`} />
              {marketOpen ? 'Market Open' : 'Market Closed'}
            </div>
            {lastCheck && (
              <div className="flex items-center gap-1.5 text-xs text-gray-600 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2">
                <Clock size={11} />Last: {lastCheck}
              </div>
            )}
            {enabled && (
              <button onClick={checkNow}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-lg px-3 py-2 transition-all">
                <RefreshCw size={11} />Check Now
              </button>
            )}
          </div>
        </div>

        <div className="bg-gray-900/30 border border-gray-800 rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-bold text-white mb-1">Alert Engine</h2>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${enabled && marketOpen ? 'bg-emerald-400 animate-pulse' : enabled ? 'bg-amber-400' : 'bg-gray-600'}`} />
                <p className="text-sm text-gray-500">{statusText()}</p>
              </div>
            </div>
            <button onClick={enabled ? disableAlerts : enableAlerts}
              disabled={!swReady || permission === 'denied'}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all ${
                enabled
                  ? 'bg-red-950/60 text-red-400 border border-red-800/60 hover:bg-red-950'
                  : !swReady || permission === 'denied'
                  ? 'bg-gray-800 text-gray-600 border border-gray-700 cursor-not-allowed'
                  : 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 hover:bg-emerald-950'
              }`}>
              {enabled ? <><BellOff size={16} />Disable</> : <><Bell size={16} />Enable Alerts</>}
            </button>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="bg-orange-950/20 rounded-xl p-4 border border-orange-800/30">
              <p className="text-xs text-gray-500 mb-1">🔥 OI Spikes</p>
              <p className="text-sm text-gray-300">OI changes &gt;{spikeThreshold}% in 5 mins — Options Jungle</p>
            </div>
            <div className="bg-emerald-950/20 rounded-xl p-4 border border-emerald-800/30">
              <p className="text-xs text-gray-500 mb-1">🌱 Fresh Builds</p>
              <p className="text-sm text-gray-300">Volume spike + OI building simultaneously</p>
            </div>
            <div className="bg-blue-950/20 rounded-xl p-4 border border-blue-800/30">
              <p className="text-xs text-gray-500 mb-1">🐋 UOA Whales</p>
              <p className="text-sm text-gray-300">High conviction signals (score 4+) from UOA scanner</p>
            </div>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-xs text-gray-500">OI spike threshold:</span>
            <input type="range" min="2" max="30" value={spikeThreshold}
              onChange={e => setSpikeThreshold(Number(e.target.value))}
              className="w-32 accent-orange-400" />
            <span className="text-sm font-black text-orange-400">{spikeThreshold}%</span>
            <button onClick={playSound}
              className="text-xs text-gray-500 hover:text-white border border-gray-700 hover:border-gray-600 px-3 py-1.5 rounded-lg transition-all ml-2">
              🔔 Preview Sound
            </button>
            {permission === 'denied' && (
              <span className="text-xs text-red-400 ml-2">⚠️ Notifications blocked in browser — go to browser settings to allow</span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            Alert Feed
            {alerts.length > 0 && (
              <span className="text-sm font-normal text-gray-500">({filtered.length} of {alerts.length})</span>
            )}
          </h2>
          {alerts.length > 0 && (
            <button onClick={clearAlerts}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-400 transition-colors">
              <Trash2 size={12} />Clear all
            </button>
          )}
        </div>

        {alerts.length > 0 && (
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"/>
              <input
                value={search}
                onChange={e => setSearch(e.target.value.toUpperCase())}
                placeholder="Search symbol..."
                className="bg-gray-900 border border-gray-700 text-white text-xs rounded-lg pl-8 pr-8 py-2 focus:outline-none focus:border-emerald-500 w-40"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                  <X size={11}/>
                </button>
              )}
            </div>

            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
              className="bg-gray-900 border border-gray-700 text-white text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500">
              <option value="all">All Types</option>
              {uniqueTypes.map(t => (
                <option key={t} value={t}>{(SIGNAL_META[t] || DEFAULT_META).label}</option>
              ))}
            </select>

            <button onClick={() => setSortOrder(s => s === 'newest' ? 'oldest' : 'newest')}
              className="text-xs bg-gray-900 border border-gray-700 text-gray-400 hover:text-white px-3 py-2 rounded-lg transition-all">
              {sortOrder === 'newest' ? '↓ Newest first' : '↑ Oldest first'}
            </button>

            {uniqueSymbols.slice(0, 5).map(sym => (
              <button key={sym} onClick={() => setSearch(search === sym ? '' : sym)}
                className={`text-xs px-2.5 py-1.5 rounded-lg border transition-all ${search === sym ? 'bg-white text-gray-900 border-white' : 'bg-gray-900 border-gray-700 text-gray-400 hover:text-white'}`}>
                {sym}
              </button>
            ))}
          </div>
        )}

        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center border border-gray-800/50 rounded-2xl bg-gray-900/20">
            <div className="text-4xl mb-4">🔔</div>
            <h3 className="text-lg font-bold text-gray-400 mb-2">
              {enabled ? 'Monitoring in background' : 'Alerts disabled'}
            </h3>
            <p className="text-sm text-gray-600 max-w-sm">
              {enabled
                ? marketOpen
                  ? 'Service worker is running across all tabs. Alerts will appear here, as browser notifications, and via the bell icon on any page.'
                  : 'Market is closed. Checks will auto-resume at 9:15 AM IST on next trading day.'
                : 'Enable alerts to start monitoring OI spikes, fresh builds and UOA whale activity.'}
            </p>
            {enabled && marketOpen && (
              <div className="mt-4 flex items-center gap-2 text-xs text-emerald-500">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Self-scheduling every 5 minutes · Works across all tabs
              </div>
            )}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center border border-gray-800/50 rounded-2xl">
            <p className="text-gray-500 text-sm">No alerts match current filters</p>
            <button onClick={() => { setSearch(''); setTypeFilter('all') }}
              className="mt-3 text-xs text-emerald-400 hover:text-emerald-300">
              Clear filters
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(alert => {
              const m = SIGNAL_META[alert.signal] || DEFAULT_META
              return (
                <div key={alert.id}
                  className={`flex items-start justify-between p-4 rounded-xl border transition-all hover:brightness-110 ${m.bg} ${m.border}`}>
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-gray-900/50 flex items-center justify-center text-lg flex-shrink-0">
                      {m.icon}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-base font-black text-white">{alert.symbol}</span>
                        {alert.strike && (
                          <span className="text-sm font-bold text-amber-400">{alert.strike}</span>
                        )}
                        {alert.optionType && (
                          <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${alert.optionType === 'CE' ? 'bg-red-950/50 text-red-400' : 'bg-emerald-950/50 text-emerald-400'}`}>
                            {alert.optionType}
                          </span>
                        )}
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-lg border ${m.color} ${m.bg} ${m.border}`}>
                          {m.label}
                        </span>
                        {alert.score && (
                          <span className="text-xs text-orange-400 font-bold">{alert.score}/5</span>
                        )}
                        {alert.bias && (
                          <span className={`text-xs font-semibold ${alert.bias === 'BULLISH' ? 'text-emerald-400' : 'text-red-400'}`}>
                            {alert.bias === 'BULLISH' ? '↑' : '↓'} {alert.bias}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 leading-relaxed">{alert.message}</p>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0 ml-4">
                    <p className="text-xs text-gray-500 mb-1">{alert.receivedAt}</p>
                    <a href={alert.url}
                      className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition-colors justify-end">
                      View <ExternalLink size={10}/>
                    </a>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div className="mt-8 bg-gray-900/20 border border-gray-800/40 rounded-xl p-4">
          <p className="text-xs text-gray-600">
            <span className="text-gray-400 font-semibold">Disclaimer:</span> Alerts are based on observed options activity patterns. Not investment advice. GreekNova is not SEBI-registered.
          </p>
        </div>
      </div>
    </div>
  )
}
