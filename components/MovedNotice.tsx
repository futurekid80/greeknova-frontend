'use client'
import { useEffect, useState } from 'react'

// Oct 31 2026: shown once to people redirected here from the old
// greeknova-frontend.vercel.app address (?moved=1). Alert permission and
// alert settings are stored per website address, so they do not carry over.
export default function MovedNotice() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    try {
      const url = new URL(window.location.href)
      if (url.searchParams.get('moved') === '1') {
        setShow(true)
        url.searchParams.delete('moved')
        window.history.replaceState({}, '', url.pathname + (url.search ? url.search : '') + url.hash)
      }
    } catch {}
  }, [])

  if (!show) return null
  return (
    <div className="w-full bg-cyan-950/60 border-b border-cyan-800/40 px-6 py-2 text-center">
      <p className="text-xs text-cyan-200">
        📍 <strong>GreekNova now lives only at app.greeknova.com.</strong> Please bookmark this address.
        Alert permission and alert settings are saved per address, so if you used alerts on the old one,
        check your alert settings here and allow notifications again.{' '}
        <button onClick={() => setShow(false)} className="underline ml-1">Dismiss</button>
      </p>
    </div>
  )
}
