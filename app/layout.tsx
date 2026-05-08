'use client'
import './globals.css'
import DisclaimerModal from '@/components/DisclaimerModal'

// All alert monitoring is handled by the Service Worker (sw.js)
// and the Alerts page component. No duplicate logic here.

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <DisclaimerModal />
        {children}
      </body>
    </html>
  )
}
