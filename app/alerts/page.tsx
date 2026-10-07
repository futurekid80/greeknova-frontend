'use client'
import Navbar from '@/components/Navbar'
import { useEffect, useRef, useState } from 'react'
import { Bell, BellOff, RefreshCw, Trash2, Clock, Search, X, ExternalLink } from 'lucide-react'
import { useAlerts } from '@/contexts/AlertsContext'
import AlertThresholds from '@/components/AlertThresholds'
import { SIGNAL_META, DEFAULT_META } from '@/lib/alertMeta'
import { formatReceivedAt } from '@/lib/formatTime'

export default function Alerts() {
  const {
    alerts, priorityAlerts, enabled, permission, swReady, marketOpen, lastCheck,
    spikeThreshold, volThreshold, saveThresholds,
    enableAlerts, disableAlerts, checkNow, clearAlerts, playSound,
  } = useAlerts()

  // Oct 7 2026: there used to be TWO separate threshold systems on this page
  // -- this tab's own in-browser "Alert Engine" (OI-only, defaulted to 30%,
  // ignored vol% and signal mutes entirely) and a server-saved "Push alerts
  // when..." box, each with its OWN usePushPreferences() fetch, so saving
  // one didn't update the other without a page reload. Now this page reads
  // spikeThreshold/volThreshold/saveThresholds straight from AlertsContext's
  // single shared instance -- the same one that drives the in-browser
  // engine -- so there's one number, one Save button, and it takes effect
  // immediately, no refresh needed.

  const [search, setSearch]           = useState('')
  const [typeFilter, setTypeFilter]   = useState('all')
  const [sortOrder, setSortOrder]     = useState<'newest'|'oldest'>('newest')

  // Date picker: `/alerts` defaults to TODAY only when no `since_id` is given,
  // for every query -- symbol search, signal filter, the lot. That silently
  // made yesterday's alerts (or any past day's) unreachable the moment
  // midnight passed, even though alert_log still has them -- e.g. reviewing a
  // trade the next day, or on a market holiday with zero alerts of its own.
  // '' means "today, live" (the usual rolling view from context); any other
  // value switches the whole page to a point-in-time read of that past day.
  const todayIso = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  const dateOptions = Array.from({ length: 10 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const iso = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
    const label = i === 0 ? 'Today' : i === 1 ? 'Yesterday' : d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short' })
    return { iso, label }
  })
  const [selectedDate, setSelectedDate] = useState('')   // '' = today/live
  const viewingPast = selectedDate !== '' && selectedDate !== todayIso

  // Whole-page past-day read: replaces the live `alerts` feed entirely when
  // viewingPast is true.
  const [dateAlerts, setDateAlerts] = useState<typeof alerts>([])
  const [dateLoading, setDateLoading] = useState(false)
  useEffect(() => {
    if (!viewingPast) { setDateAlerts([]); return }
    setDateLoading(true)
    fetch(`https://api.greeknova.com/alerts?date=${selectedDate}&limit=200`)
      .then((r) => r.json())
      .then((j) => setDateAlerts(j.alerts || []))
      .catch(() => setDateAlerts([]))
      .finally(() => setDateLoading(false))
  }, [viewingPast, selectedDate])

  // The live `alerts` list from context is capped at the last ~100 across every
  // stock, so on a busy morning an older alert for one symbol falls out of it
  // within minutes. Once someone searches a specific symbol, pull that
  // symbol's full day straight from alert_log instead of just filtering
  // whatever happens to still be in the capped list.
  const [symbolDayAlerts, setSymbolDayAlerts] = useState<typeof alerts>([])
  const [symbolDayLoading, setSymbolDayLoading] = useState(false)
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Oct 6 2026: search box now also accepts strike+type, e.g. "435CE" or
  // "BHEL435CE" (Manish's ask -- scrolling a long list to find one strike was
  // painful). The day-fetch below still needs a real stock SYMBOL though (the
  // backend's /alerts?symbol= expects one), so pull just the leading letters
  // off the query as the symbol guess -- "BHEL435CE" -> "BHEL", "435CE" -> ''
  // (no day-fetch, falls back to whatever's in the live capped list). The
  // actual strike/type matching happens client-side in `filtered` below.
  const symbolGuess = search.trim().toUpperCase().match(/^[A-Z&-]+/)?.[0] || ''

  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current)
    if (symbolGuess.length < 2) { setSymbolDayAlerts([]); return }
    searchDebounce.current = setTimeout(() => {
      setSymbolDayLoading(true)
      fetch(`https://api.greeknova.com/alerts?symbol=${encodeURIComponent(symbolGuess)}&limit=500${viewingPast ? `&date=${selectedDate}` : ''}`)
        .then((r) => r.json())
        .then((j) => setSymbolDayAlerts(j.alerts || []))
        .catch(() => setSymbolDayAlerts([]))
        .finally(() => setSymbolDayLoading(false))
    }, 400)
    return () => { if (searchDebounce.current) clearTimeout(searchDebounce.current) }
  }, [symbolGuess, viewingPast, selectedDate])

  // Near-Strike Unwind box: `priorityAlerts` from context is a ROLLING top-20
  // window across the whole day (refetched every 60s), so once more than 20
  // fire, morning events (e.g. the first stock that triggered it) silently
  // fall out of view even though they're still in alert_log -- same rolling-
  // cap pattern as the old 100-item bug on the main feed. Pull the FULL day
  // for this one signal directly instead, so nothing recorded today goes
  // missing from this box.
  const [unwindDayAlerts, setUnwindDayAlerts] = useState<typeof alerts>([])
  useEffect(() => {
    const url = `https://api.greeknova.com/alerts?signal=NEAR_STRIKE_UNWIND&limit=200${viewingPast ? `&date=${selectedDate}` : ''}`
    const fetchUnwind = () => {
      fetch(url)
        .then((r) => r.json())
        .then((j) => setUnwindDayAlerts(j.alerts || []))
        .catch(() => {})
    }
    fetchUnwind()
    if (viewingPast) return   // a past day is static, no need to poll it
    const t = setInterval(fetchUnwind, 60 * 1000)
    return () => clearInterval(t)
  }, [viewingPast, selectedDate])
  // Merge with the live context list too (only while viewing today live), so
  // an alert that just fired this second (before it's in alert_log's own
  // query response) still shows up.
  const unwindAll = viewingPast
    ? unwindDayAlerts
    : [
        ...unwindDayAlerts,
        ...priorityAlerts.filter(a => a.signal === 'NEAR_STRIKE_UNWIND' && !unwindDayAlerts.some(b => b.id === a.id)),
      ]

  // Base feed: a past date replaces the live context feed outright (it's a
  // static point-in-time read); today stays the usual live rolling list.
  const baseAlerts = viewingPast ? dateAlerts : alerts

  const uniqueSymbols = [...new Set(baseAlerts.map(a => a.symbol))].sort()
  const uniqueTypes   = [...new Set(baseAlerts.map(a => a.signal))]

  // Once a symbol-day search has results, that's the full day for this stock --
  // merge it with the live list (deduped by id) rather than replacing it, so a
  // fresh alert that just fired (and isn't in alert_log's search response yet
  // on this exact tick) doesn't disappear while typing. While viewing a past
  // date there's no "live" list to merge with -- the search result is already
  // the full answer for that day.
  const searchIsSymbol = symbolGuess.length >= 2
  const merged = searchIsSymbol
    ? (viewingPast ? symbolDayAlerts : [...symbolDayAlerts, ...alerts.filter((a) => !symbolDayAlerts.some((b) => b.id === a.id))])
    : baseAlerts

  const filtered = merged
    .filter(a => {
      if (search) {
        // Match symbol, strike and option type together as one string so a
        // query like "435CE" or "BHEL435CE" finds the right row without
        // needing separate strike/type inputs -- see symbolGuess comment above.
        const s = search.trim().toUpperCase().replace(/\s+/g, '')
        const composite = `${a.symbol || ''}${a.strike ?? ''}${a.optionType || ''}`.toUpperCase()
        return composite.includes(s) || a.signal?.includes(s)
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

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="bg-orange-950/20 rounded-xl p-4 border border-orange-800/30">
              <p className="text-xs text-gray-500 mb-1">🔥 OI Spikes</p>
              <p className="text-sm text-gray-300">OI changes &gt;{spikeThreshold}% in 5 mins — Options Jungle</p>
            </div>
            <div className="bg-emerald-950/20 rounded-xl p-4 border border-emerald-800/30">
              <p className="text-xs text-gray-500 mb-1">🌱 Fresh Builds</p>
              <p className="text-sm text-gray-300">Volume &gt;{volThreshold}% + OI building simultaneously</p>
            </div>
            <div className="bg-blue-950/20 rounded-xl p-4 border border-blue-800/30">
              <p className="text-xs text-gray-500 mb-1">🐋 UOA Whales</p>
              <p className="text-sm text-gray-300">High conviction signals (score 4+) from UOA scanner</p>
            </div>
            <div className="bg-fuchsia-950/20 rounded-xl p-4 border border-fuchsia-500/40">
              <p className="text-xs text-gray-500 mb-1">💥 Near-Strike Unwind</p>
              <p className="text-sm text-gray-300">Near-ATM strike OI drops &gt;40% in 20 mins — support/resistance breaking</p>
            </div>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-xs text-gray-500">
              Currently alerting at OI ≥ <span className="text-orange-400 font-bold">{spikeThreshold}%</span>, Vol ≥ <span className="text-orange-400 font-bold">{volThreshold}%</span> — edit in the box below
            </span>
            <button onClick={playSound}
              className="text-xs text-gray-500 hover:text-white border border-gray-700 hover:border-gray-600 px-3 py-1.5 rounded-lg transition-all ml-2">
              🔔 Preview Sound
            </button>
            {permission === 'denied' && (
              <span className="text-xs text-red-400 ml-2">⚠️ Notifications blocked in browser — go to browser settings to allow</span>
            )}
          </div>
        </div>

        {unwindAll.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-bold text-fuchsia-300 flex items-center gap-2 mb-1">
              💥 Near-Strike Unwind — Tradeable Breaks
            </h2>
            <p className="text-xs text-gray-500 mb-3">Near-ATM OI collapsing fast — a support/resistance wall is breaking right now. Higher conviction than routine OI spikes. Showing today's full list, not just the latest few.</p>
            <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
              {unwindAll
                .sort((a, b) => b.id - a.id)
                .map(alert => (
                  <div key={alert.id}
                    className="flex items-start justify-between p-4 rounded-xl border-2 border-fuchsia-500/60 bg-fuchsia-950/30 shadow-[0_0_20px_-8px_rgba(217,70,239,0.5)]">
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-fuchsia-900/40 flex items-center justify-center text-lg flex-shrink-0">
                        💥
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
                          {alert.direction && (
                            <span className={`text-xs font-semibold ${alert.direction === 'bullish' ? 'text-emerald-400' : 'text-red-400'}`}>
                              {alert.direction === 'bullish' ? '↑ Bullish' : '↓ Bearish'}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-fuchsia-100/90 leading-relaxed">{alert.message}</p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-4">
                      <p className="text-xs text-gray-500 mb-1">{formatReceivedAt(alert.receivedAt)}</p>
                      <a href={alert.url}
                        className="flex items-center gap-1 text-xs text-fuchsia-300 hover:text-fuchsia-200 transition-colors justify-end">
                        View <ExternalLink size={10}/>
                      </a>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Clock size={13} className="text-gray-600"/>
            <span className="text-xs text-gray-500">Viewing:</span>
            <select
              value={selectedDate || todayIso}
              onChange={(e) => setSelectedDate(e.target.value === todayIso ? '' : e.target.value)}
              className="bg-gray-900 border border-gray-800 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-cyan-700"
            >
              {dateOptions.map(d => <option key={d.iso} value={d.iso}>{d.label}</option>)}
            </select>
            {viewingPast && (
              <span className="text-[11px] text-amber-400">
                {dateLoading ? 'Loading that day…' : `Past day — static snapshot, not live`}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            Alert Feed
            {baseAlerts.length > 0 && (
              <>
                <span className="text-sm font-normal text-gray-500">({filtered.length} of {baseAlerts.length})</span>
                {searchIsSymbol && (
                  <span className="text-xs font-normal text-cyan-400 ml-1">
                    {symbolDayLoading ? 'Searching full day…' : `· full day for "${search.toUpperCase()}"${viewingPast ? '' : ' incl. alerts no longer in the live list'}`}
                  </span>
                )}
              </>
            )}
          </h2>
          {!viewingPast && alerts.length > 0 && (
            <button onClick={clearAlerts}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-400 transition-colors">
              <Trash2 size={12} />Clear all
            </button>
          )}
        </div>

        {baseAlerts.length > 0 && (
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"/>
              <input
                value={search}
                onChange={e => setSearch(e.target.value.toUpperCase())}
                placeholder="e.g. BHEL, 435CE..."
                className="bg-gray-900 border border-gray-700 text-white text-xs rounded-lg pl-8 pr-8 py-2 focus:outline-none focus:border-emerald-500 w-44"
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

        <div className="mb-4">
          <AlertThresholds spikeThreshold={spikeThreshold} volThreshold={volThreshold} onSave={saveThresholds} />
        </div>

        {baseAlerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center border border-gray-800/50 rounded-2xl bg-gray-900/20">
            <div className="text-4xl mb-4">🔔</div>
            <h3 className="text-lg font-bold text-gray-400 mb-2">
              {viewingPast ? (dateLoading ? 'Loading…' : 'No alerts logged that day') : enabled ? 'Monitoring in background' : 'Alerts disabled'}
            </h3>
            <p className="text-sm text-gray-600 max-w-sm">
              {viewingPast
                ? 'Either a non-trading day, or nothing crossed the alert thresholds that session.'
                : enabled
                ? marketOpen
                  ? 'Service worker is running across all tabs. Alerts will appear here, as browser notifications, and via the bell icon on any page.'
                  : 'Market is closed. Checks will auto-resume at 9:15 AM IST on next trading day.'
                : 'Enable alerts to start monitoring OI spikes, fresh builds and UOA whale activity.'}
            </p>
            {!viewingPast && enabled && marketOpen && (
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
                    <p className="text-xs text-gray-500 mb-1">{formatReceivedAt(alert.receivedAt)}</p>
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
