'use client'
import './globals.css'
import DisclaimerModal from '@/components/DisclaimerModal'
import { useEffect, useState } from 'react'

const API = 'https://greeknova-backend-production.up.railway.app'

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
      <body>
        <DisclaimerModal />
        <HolidayBanner />
        {children}
      </body>
    </html>
  )
}
