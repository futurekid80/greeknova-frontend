'use client'
import './globals.css'
import DisclaimerModal from '@/components/DisclaimerModal'
import AlertsSidebar from '@/components/AlertsSidebar'
import { AlertsProvider } from '@/contexts/AlertsContext'
import { useEffect, useState } from 'react'
import '@/lib/authFetch'

const API = 'https://api.greeknova.com'

function HolidayBanner() {
  const [status, setStatus] = useState<any>(null)

  useEffect(() => {
    fetch(`${API}/market-status`)
      .then(r => r.json())
      .then(setStatus)
      .catch(() => {})
  }, [])

  if (!status) return null

  if (!status.is_trading_day && status.today_holiday) {
    return (
      <div className="w-full bg-blue-950/60 border-b border-blue-800/40 px-6 py-2 text-center">
        <p className="text-xs text-blue-300">
          🏖️ <strong>Market Holiday Today:</strong> {status.today_holiday} · Next trading day:{' '}
          {new Date(status.next_trading_day + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' })}
        </p>
      </div>
    )
  }

  if (status.tomorrow_holiday) {
    return (
      <div className="w-full bg-amber-950/40 border-b border-amber-800/30 px-6 py-2 text-center">
        <p className="text-xs text-amber-400">
          ⚠️ <strong>Market Holiday Tomorrow:</strong> {status.tomorrow_holiday}
          {status.long_weekend
            ? ` · ${status.days_to_next_trading - 1}-day break · Next trading: ${new Date(status.next_trading_day + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' })}`
            : ''}
        </p>
      </div>
    )
  }

  return null
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
      const interval = setInterval(() => {
        navigator.serviceWorker.ready.then(reg => {
          reg.active?.postMessage({ type: 'KEEPALIVE' })
        }).catch(() => {})
      }, 4 * 60 * 1000)
      return () => clearInterval(interval)
    }
  }, [])

  return (
    <html lang="en">
      <head>
        {/* Oct 25 2026: PWA setup -- lets GreekNova be "Added to Home
            Screen" on phones (installable, full-screen, no browser
            address bar) without a separate native app build. sw.js was
            already being registered above for push alerts; this just
            adds the manifest + icons + iOS meta tags that make the
            browser treat the site as installable. */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0a0e14" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="GreekNova" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body>
        <AlertsProvider>
          <DisclaimerModal />
          <HolidayBanner />
          <AlertsSidebar />
          {children}
        </AlertsProvider>
      </body>
    </html>
  )
}
