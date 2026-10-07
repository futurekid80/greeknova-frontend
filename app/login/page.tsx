'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

const DEMO_API = 'https://api.greeknova.com'

// Oct 2026: Zerodha Kite Connect login. Requires NEXT_PUBLIC_KITE_API_KEY
// (the app's public API key -- safe to expose, mirrors any other Kite
// Connect integration) to be set on Vercel; the matching secret stays
// server-side only (see /auth/kite-login in the backend).
const KITE_API_KEY = process.env.NEXT_PUBLIC_KITE_API_KEY || ''
const KITE_LOGIN_URL = KITE_API_KEY ? `https://kite.zerodha.com/connect/login?v=3&api_key=${KITE_API_KEY}` : ''

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'email' | 'otp' | 'demo'>('email')
  const [error, setError] = useState('')
  const [demoCode, setDemoCode] = useState('')
  const [disclaimerChecked, setDisclaimerChecked] = useState(false)

  function handleKiteLogin() {
    if (!disclaimerChecked) {
      setError('Please tick the disclaimer checkbox first.')
      return
    }
    if (!KITE_LOGIN_URL) {
      setError('Zerodha login is not configured yet.')
      return
    }
    const returnTo = new URLSearchParams(window.location.search).get('returnTo') || '/'
    sessionStorage.setItem('gn_login_return_to', returnTo)
    window.location.href = KITE_LOGIN_URL
  }

  async function handleEmailSubmit() {
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address')
      return
    }
    setLoading(true)
    setError('')
    const { data, error: dbError } = await supabase
      .from('beta_users')
      .select('email')
      .eq('email', email.toLowerCase().trim())
      .single()
    if (dbError || !data) {
      setError('This email is not on our beta list. Please contact Manish to get access.')
      setLoading(false)
      return
    }
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: email.toLowerCase().trim(),
      options: { shouldCreateUser: true }
    })
    if (otpError) {
      setError('Something went wrong. Please try again.')
      setLoading(false)
      return
    }
    setStep('otp')
    setLoading(false)
  }

  async function handleOtpSubmit() {
    if (!otp || otp.length < 4) {
      setError('Please enter the code from your email')
      return
    }
    setLoading(true)
    setError('')
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: email.toLowerCase().trim(),
      token: otp.trim(),
      type: 'email'
    })
    if (verifyError) {
      setError('Invalid or expired code. Please request a new one.')
      setLoading(false)
      return
    }
    const rTo = new URLSearchParams(window.location.search).get('returnTo') || '/'; window.location.href = rTo
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
                Welcome to GreekNova Beta
              </h2>
              <p className="text-gray-400 text-sm mb-6">
                Enter your email to receive a one-time login code, or log in with Zerodha below.
              </p>

              <label className="flex items-start gap-2 mb-4 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={disclaimerChecked}
                  onChange={(e) => { setDisclaimerChecked(e.target.checked); setError('') }}
                  className="mt-0.5 h-4 w-4 accent-blue-500"
                />
                <span className="text-gray-400 text-xs leading-snug">
                  I understand GreekNova is an analytics tool for educational and
                  informational purposes only, is not a SEBI-registered investment
                  adviser, and nothing on this platform is investment advice.
                </span>
              </label>

              <button
                onClick={handleKiteLogin}
                disabled={loading || !disclaimerChecked}
                className="w-full bg-[#387ed1] hover:bg-[#2f6bb5] text-white font-semibold py-3 rounded-lg text-sm transition disabled:opacity-40 disabled:cursor-not-allowed mb-5"
              >
                Login with Zerodha →
              </button>

              <div className="flex items-center gap-3 mb-5">
                <div className="flex-1 h-px bg-gray-800" />
                <span className="text-gray-600 text-xs uppercase tracking-wider">or</span>
                <div className="flex-1 h-px bg-gray-800" />
              </div>

              <label className="text-gray-400 text-xs uppercase tracking-wider mb-1 block">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleEmailSubmit()}
                placeholder="you@example.com"
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-blue-500 mb-4"
              />
              {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
              <button
                onClick={handleEmailSubmit}
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-lg text-sm transition disabled:opacity-50"
              >
                {loading ? 'Sending...' : 'Send Login Code →'}
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
          {step === 'otp' && (
            <div>
              <h2 className="text-white text-lg font-semibold mb-1">
                Check your email
              </h2>
              <p className="text-gray-400 text-sm mb-2">
                We sent a login code to:
              </p>
              <p className="text-blue-400 font-medium text-sm mb-6">{email}</p>
              <label className="text-gray-400 text-xs uppercase tracking-wider mb-1 block">
                Enter code from email
              </label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\s/g, '').replace(/\D/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && handleOtpSubmit()}
                placeholder="Enter code"
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-blue-500 mb-4 text-center tracking-[0.5em] text-lg font-bold"
              />
              {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
              <button
                onClick={handleOtpSubmit}
                disabled={loading || otp.length < 4}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-lg text-sm transition disabled:opacity-50"
              >
                {loading ? 'Verifying...' : 'Login →'}
              </button>
              <button
                onClick={() => { setStep('email'); setOtp(''); setError('') }}
                className="w-full text-gray-500 hover:text-gray-300 text-sm py-2 mt-2 transition"
              >
                ← Request a new code
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
