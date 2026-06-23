'use client'
import './globals.css'
import DisclaimerModal from '@/components/DisclaimerModal'
import { useEffect } from 'react'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      // Register SW
      navigator.serviceWorker.register('/sw.js').catch(() => {})
      // Keepalive ping every 4 minutes from any tab
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
        {children}
      </body>
    </html>
  )
}
