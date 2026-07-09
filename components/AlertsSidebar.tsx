'use client'
import { useState } from 'react'
import { Bell, X, ExternalLink } from 'lucide-react'
import { useAlerts } from '@/contexts/AlertsContext'
import { SIGNAL_META, DEFAULT_META } from '@/lib/alertMeta'

export default function AlertsSidebar() {
  const [open, setOpen] = useState(false)
  const { alerts, unreadCount, marketOpen, enabled, markAllRead } = useAlerts()

  function toggle() {
    setOpen(o => {
      if (!o) markAllRead()
      return !o
    })
  }

  return (
    <>
      <button
        onClick={toggle}
        className="fixed top-20 right-4 z-[90] w-11 h-11 rounded-full bg-gray-900 border border-gray-700 hover:border-gray-500 flex items-center justify-center shadow-lg transition-all"
        aria-label="Toggle alerts sidebar"
      >
        <Bell size={18} className={enabled && marketOpen ? 'text-emerald-400' : 'text-gray-400'} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-[95]"
          onClick={() => setOpen(false)}
        />
      )}

      <div
        className={`fixed top-0 right-0 h-full w-full sm:w-96 bg-[#0b0b14] border-l border-gray-800 z-[100] transform transition-transform duration-200 ease-out flex flex-col ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-white font-bold text-base">Alerts</h2>
            <div className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border ${
              enabled && marketOpen
                ? 'bg-emerald-950/40 border-emerald-800/50 text-emerald-400'
                : 'bg-gray-900 border-gray-800 text-gray-500'
            }`}>
              <div className={`w-1.5 h-1.5 rounded-full ${enabled && marketOpen ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`} />
              {enabled ? (marketOpen ? 'Live' : 'Market Closed') : 'Off'}
            </div>
          </div>
          <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              <div className="text-3xl mb-3">🔔</div>
              <p className="text-sm text-gray-500">
                {enabled ? 'Monitoring in background — alerts will appear here as they fire.' : 'Alerts are off. Enable them from the Alerts page to start monitoring.'}
              </p>
            </div>
          ) : (
            <div className="p-3 space-y-2">
              {alerts.map(alert => {
                const m = SIGNAL_META[alert.signal] || DEFAULT_META
                return (
                  <a
                    key={alert.id}
                    href={alert.url}
                    className={`block p-3 rounded-lg border transition-all hover:brightness-110 ${m.bg} ${m.border}`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-gray-900/50 flex items-center justify-center text-sm flex-shrink-0">
                        {m.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                          <span className="text-sm font-black text-white">{alert.symbol}</span>
                          {alert.strike && <span className="text-xs font-bold text-amber-400">{alert.strike}</span>}
                          {alert.optionType && (
                            <span className={`text-[10px] font-bold px-1 py-0.5 rounded ${alert.optionType === 'CE' ? 'bg-red-950/50 text-red-400' : 'bg-emerald-950/50 text-emerald-400'}`}>
                              {alert.optionType}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-400 leading-relaxed line-clamp-2">{alert.message}</p>
                        <div className="flex items-center justify-between mt-1.5">
                          <span className={`text-[10px] font-semibold ${m.color}`}>{m.label}</span>
                          <span className="text-[10px] text-gray-600">{alert.receivedAt}</span>
                        </div>
                      </div>
                    </div>
                  </a>
                )
              })}
            </div>
          )}
        </div>

        <div className="border-t border-gray-800 p-3 flex-shrink-0">
          <a
            href="/alerts"
            className="flex items-center justify-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors py-2"
          >
            Open full Alerts page <ExternalLink size={11} />
          </a>
        </div>
      </div>
    </>
  )
}
