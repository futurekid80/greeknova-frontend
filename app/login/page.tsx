'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const DEMO_API = 'https://api.greeknova.com'

// Oct 14 2026: the Zerodha login block below is the same flow Zerodha
// reviewed and approved at the standalone /zerodha-login-review page (Oct 9
// demo) -- same KITE_API_KEY, same /auth/kite-login backend, same
// /auth/callback redirect target. Moved onto the real /login page because
// Zerodha has now asked for a production demo (Oct 15 noon). The
// review-only page is left in place, unlinked, not removed.
const KITE_API_KEY = process.env.NEXT_PUBLIC_KITE_API_KEY || ''
const KITE_LOGIN_URL = KITE_API_KEY ? `https://kite.zerodha.com/connect/login?v=3&api_key=${KITE_API_KEY}` : ''

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'email' | 'demo'>('email')
  const [error, setError] = useState('')
  const [demoCode, setDemoCode] = useState('')
  const [kiteDisclaimerChecked, setKiteDisclaimerChecked] = useState(false)
  const [kiteError, setKiteError] = useState('')
  const [returnNotice, setReturnNotice] = useState('')

  useEffect(() => {
    try {
      const err = new URLSearchParams(window.location.search).get('error')
      if (err === 'kite_session_stale') {
        setReturnNotice('Your Zerodha session has expired for today — please log in again to continue.')
      }
    } catch {}
  }, [])

  function handleZerodhaLogin() {
    if (!kiteDisclaimerChecked) {
      setKiteError('Please tick the disclaimer checkbox first.')
      return
    }
    if (!KITE_LOGIN_URL) {
      setKiteError('Zerodha login is not configured yet.')
      return
    }
    const returnTo = new URLSearchParams(window.location.search).get('returnTo') || '/'
    sessionStorage.setItem('gn_login_return_to', returnTo)
    window.location.href = KITE_LOGIN_URL
  }

  async function handleDemoSubmit() {
    if (!demoCode) {
      setError('Please enter the demo access code')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${DEMO_API}/auth/demo-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: demoCode.trim() }),
      })
      if (!res.ok) {
        setError('Invalid demo code. Please check and try again.')
        setLoading(false)
        return
      }
      const { token_hash } = await res.json()
      const { error: verifyError } = await supabase.auth.verifyOtp({
        token_hash,
        type: 'magiclink',
      })
      if (verifyError) {
        setError('Could not start demo session. Please try again.')
        setLoading(false)
        return
      }
      const rTo = new URLSearchParams(window.location.search).get('returnTo') || '/'
      window.location.href = rTo
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Greek<span className="text-blue-400">Nova</span>
          </h1>
          <p className="text-gray-400 mt-2 text-sm">
            F&O Analytics Platform — Beta Access
          </p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-xl">
          {step === 'email' && (
            <div>
              <h2 className="text-white text-lg font-semibold mb-1">
                Welcome to GreekNova
              </h2>
              <p className="text-gray-400 text-sm mb-6">
                Log in with your Zerodha Kite account. New here? You get a
                free 7-day trial automatically &mdash; no card, no payment,
                just your Zerodha login.
              </p>

              {returnNotice && (
                <p className="text-amber-400 text-xs mb-4 bg-amber-950/30 border border-amber-800/40 rounded-lg px-3 py-2">
                  {returnNotice}
                </p>
              )}

              <label className="flex items-start gap-2 mb-4 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={kiteDisclaimerChecked}
                  onChange={(e) => { setKiteDisclaimerChecked(e.target.checked); setKiteError('') }}
                  className="mt-0.5 h-4 w-4 accent-blue-500"
                />
                <span className="text-gray-400 text-xs leading-snug">
                  I understand GreekNova is an analytics tool for educational and
                  informational purposes only, is not a SEBI-registered investment
                  adviser, and nothing on this platform is investment advice.
                </span>
              </label>

              {kiteError && <p className="text-red-400 text-sm mb-4">{kiteError}</p>}

              <button
                onClick={handleZerodhaLogin}
                disabled={!kiteDisclaimerChecked}
                className="w-full bg-[#387ed1] hover:bg-[#2f6bb5] text-white font-semibold py-3 rounded-lg text-sm transition disabled:opacity-40 disabled:cursor-not-allowed mb-2"
              >
                Continue with Zerodha →
              </button>
              <button
                onClick={() => { setStep('demo'); setError('') }}
                className="w-full text-gray-500 hover:text-gray-300 text-sm py-2 mt-2 transition"
              >
                Have a demo access code?
              </button>
            </div>
          )}
          {step === 'demo' && (
            <div>
              <h2 className="text-white text-lg font-semibold mb-1">
                Demo Access
              </h2>
              <p className="text-gray-400 text-sm mb-6">
                Enter the shared demo code given to you.
              </p>
              <label className="text-gray-400 text-xs uppercase tracking-wider mb-1 block">
                Demo Code
              </label>
              <input
                type="text"
                value={demoCode}
                onChange={(e) => setDemoCode(e.target.value.replace(/\s/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && handleDemoSubmit()}
                placeholder="Enter demo code"
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-blue-500 mb-4 text-center tracking-[0.5em] text-lg font-bold"
              />
              {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
              <button
                onClick={handleDemoSubmit}
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-lg text-sm transition disabled:opacity-50"
              >
                {loading ? 'Verifying...' : 'Enter Demo →'}
              </button>
              <button
                onClick={() => { setStep('email'); setDemoCode(''); setError('') }}
                className="w-full text-gray-500 hover:text-gray-300 text-sm py-2 mt-2 transition"
              >
                ← Back to login
              </button>
            </div>
          )}
        </div>
        <p className="text-center text-gray-600 text-xs mt-6 px-4">
          GreekNova is an analytics tool, not an investment adviser.
          Nothing on this platform constitutes investment advice.
        </p>
      </div>
    </div>
  )
}
