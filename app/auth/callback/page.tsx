'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const API = 'https://api.greeknova.com'

// Oct 2026: this exact path (/auth/callback, on the greeknova-frontend.vercel.app
// domain) is the Redirect URL actually registered with Zerodha for GreekNova's
// Kite Connect app -- confirmed live, don't move this page without updating
// that registration too (developers.kite.trade -> this app's settings).
//
// This replaces an earlier, never-finished version of this page that posted
// to a backend route that doesn't exist (/api/auth/kite-callback) and relied
// on a `greeknova_pending_email` localStorage value nothing in the app ever
// set, so every real login attempt here dead-ended at "missing_token". This
// version uses the working /auth/kite-login endpoint (does the Kite checksum
// + token exchange server-side, using GreekNova's own app secret -- the user
// never sees an API key) and signs the person into the same Supabase session
// every other page already expects, instead of the old one-off cookie scheme.
function CallbackHandler() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState('Signing you in with Zerodha...')

  useEffect(() => {
    async function run() {
      const requestToken = searchParams.get('request_token')
      const kiteStatus = searchParams.get('status')

      if (!requestToken || kiteStatus === 'rejected') {
        router.push('/login?error=kite_cancelled')
        return
      }

      try {
        const res = await fetch(`${API}/auth/kite-login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ request_token: requestToken }),
        })
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          setStatus(j.detail || 'Zerodha login could not be verified.')
          await new Promise(r => setTimeout(r, 2000))
          router.push('/login?error=kite_failed')
          return
        }
        const { token_hash } = await res.json()
        const { error } = await supabase.auth.verifyOtp({ token_hash, type: 'magiclink' })
        if (error) {
          setStatus('Could not start your session.')
          await new Promise(r => setTimeout(r, 1500))
          router.push('/login?error=kite_failed')
          return
        }
        let returnTo = '/'
        try {
          returnTo = sessionStorage.getItem('gn_login_return_to') || '/'
          sessionStorage.removeItem('gn_login_return_to')
        } catch {}
        window.location.href = returnTo
      } catch {
        setStatus('Something went wrong.')
        await new Promise(r => setTimeout(r, 1500))
        router.push('/login?error=kite_failed')
      }
    }
    run()
  }, [router, searchParams])

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center max-w-md px-4">
        <div className="text-4xl mb-4">✨</div>
        <div className="text-white text-lg font-semibold">{status}</div>
      </div>
    </div>
  )
}

export default function CallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    }>
      <CallbackHandler />
    </Suspense>
  )
}
