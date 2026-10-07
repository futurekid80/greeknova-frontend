'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Suspense } from 'react'

const API = 'https://api.greeknova.com'

// Oct 2026: this exact path (/login/zerodha/callback) is the Redirect URL
// registered with Zerodha for GreekNova's own Kite Connect app -- it cannot
// be changed per-request, only by editing the app's settings on
// developers.kite.trade, so don't move this page without updating that too.
// Zerodha lands here after the user approves/denies on kite.zerodha.com with
// either `request_token` (approved) or a non-success `status` (rejected).
// This page just hands the token to the backend (which does the actual
// checksum + token exchange using the app's own secret -- never the
// browser), then redeems the Supabase magic-link token_hash it gets back,
// same pattern as the existing demo-login flow.
function KiteCallbackHandler() {
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
        const returnTo = sessionStorage.getItem('gn_login_return_to') || '/'
        sessionStorage.removeItem('gn_login_return_to')
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

export default function KiteCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    }>
      <KiteCallbackHandler />
    </Suspense>
  )
}
