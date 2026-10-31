'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const API = 'https://api.greeknova.com'

// Oct 2026: this exact path (/auth/callback) is the Redirect URL registered
// with Zerodha for GreekNova's Kite Connect app. As of Oct 31 2026 that is
// https://app.greeknova.com/auth/callback (confirmed in the Kite console) --
// don't move this page without updating that registration too
// (developers.kite.trade -> this app's settings).
//
// Oct 31 2026: the final catch used to say only "Something went wrong." with
// no hint why -- a user whose browser could not reach the server at all
// (VPN, ad-blocker, restrictive network) just saw that and nothing to try.
// It now says what likely happened and what to do, retries once if the very
// first request never got a response, and logs the real error to the console.
//
// This replaces an earlier, never-finished version of this page that posted
// to a backend route that doesn't exist (/api/auth/kite-callback) and relied
// on a `greeknova_pending_email` localStorage value nothing in the app ever
// set, so every real login attempt here dead-ended at "missing_token". This
// version uses the working /auth/kite-login endpoint (does the Kite checksum
// + token exchange server-side, using GreekNova's own app secret -- the user
// never sees an API key) and signs the person into the same Supabase session
// every other page already expects, instead of the old one-off cookie scheme.
//
// Oct 24 2026: added a one-time WhatsApp-number ask, shown ONLY on this
// screen and ONLY for a brand-new trial sign-up (is_new_trial from
// /auth/kite-login -- true exactly once, the very first time this email
// ever logs in and isn't an existing paid member). An earlier version put
// this ask in the dashboard Navbar instead, re-checking and re-showing it
// on every page navigation until dismissed -- felt naggy. This version
// asks at most once per person, right here, then never again anywhere in
// the app (optional either way -- "Skip" moves on immediately, no second
// chance, no penalty).
function CallbackHandler() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState('Signing you in with Zerodha...')
  const [askPhone, setAskPhone] = useState(false)
  const [phone, setPhone] = useState('')
  const [phoneError, setPhoneError] = useState('')
  const [savingPhone, setSavingPhone] = useState(false)
  const [returnTo, setReturnTo] = useState('/')

  function goToApp(dest: string) {
    window.location.href = dest
  }

  async function submitPhone() {
    const digits = phone.replace(/[^0-9]/g, '')
    if (digits.length < 10) {
      setPhoneError('Enter a valid 10-digit mobile number')
      return
    }
    setSavingPhone(true)
    setPhoneError('')
    try {
      const res = await fetch(`${API}/me/update-phone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: digits }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setPhoneError(j.detail || 'Could not save that, you can skip instead')
        setSavingPhone(false)
        return
      }
    } catch {
      setPhoneError('Could not save that, you can skip instead')
      setSavingPhone(false)
      return
    }
    goToApp(returnTo)
  }

  useEffect(() => {
    async function run() {
      const requestToken = searchParams.get('request_token')
      const kiteStatus = searchParams.get('status')

      if (!requestToken || kiteStatus === 'rejected') {
        router.push('/login?error=kite_cancelled')
        return
      }

      try {
        const doLogin = () => fetch(`${API}/auth/kite-login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ request_token: requestToken }),
        })
        let res: Response
        try {
          res = await doLogin()
        } catch (firstErr) {
          // No response at all (the request never reached us) -- safe to try
          // once more, the single-use Zerodha token has not been spent yet.
          console.error('kite-login first attempt failed', firstErr)
          setStatus('Connection hiccup, retrying…')
          await new Promise(r => setTimeout(r, 1500))
          res = await doLogin()
        }
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          setStatus(j.detail || 'Zerodha login could not be verified.')
          await new Promise(r => setTimeout(r, 2000))
          router.push('/login?error=kite_failed')
          return
        }
        const { token_hash, is_new_trial } = await res.json()
        const { error } = await supabase.auth.verifyOtp({ token_hash, type: 'magiclink' })
        if (error) {
          console.error('verifyOtp failed', error)
          setStatus('Could not start your session. Please try signing in again.')
          await new Promise(r => setTimeout(r, 2500))
          router.push('/login?error=kite_failed')
          return
        }
        let dest = '/'
        try {
          dest = sessionStorage.getItem('gn_login_return_to') || '/'
          sessionStorage.removeItem('gn_login_return_to')
        } catch {}
        setReturnTo(dest)

        if (is_new_trial) {
          setAskPhone(true)
          return
        }
        goToApp(dest)
      } catch (err) {
        console.error('kite callback failed', err)
        setStatus(
          "We couldn't reach GreekNova's servers. Please check your internet connection and turn off any VPN or ad-blocker for this site, then try signing in again."
        )
        await new Promise(r => setTimeout(r, 6000))
        router.push('/login?error=kite_failed&reason=network')
      }
    }
    run()
  }, [router, searchParams])

  if (askPhone) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center max-w-sm px-4 w-full">
          <div className="text-4xl mb-4">🎉</div>
          <div className="text-white text-lg font-semibold mb-1">You're in! 7-day free trial started.</div>
          <p className="text-gray-400 text-sm mb-4">
            Want us to reach you on WhatsApp for support or before your trial ends? Totally optional.
          </p>
          <input
            type="tel"
            inputMode="numeric"
            placeholder="10-digit mobile number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-md bg-[#141c2e] border border-gray-700 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-500 outline-none focus:border-emerald-600 mb-2"
          />
          {phoneError && <p className="text-xs text-red-400 mb-2">{phoneError}</p>}
          <div className="flex gap-2">
            <button
              onClick={submitPhone}
              disabled={savingPhone}
              className="flex-1 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-sm font-medium px-3 py-2"
            >
              {savingPhone ? 'Saving…' : 'Continue'}
            </button>
            <button
              onClick={() => goToApp(returnTo)}
              disabled={savingPhone}
              className="flex-1 rounded-md bg-transparent hover:bg-white/5 border border-gray-700 text-gray-300 text-sm font-medium px-3 py-2"
            >
              Skip
            </button>
          </div>
        </div>
      </div>
    )
  }

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
