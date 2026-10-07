'use client'

import { useState } from 'react'

// Oct 2026: standalone, unlinked page for Zerodha (Nagaveni Jalihal / Z-Connect)
// to review the "Continue with Zerodha" login flow ahead of their decision on
// granting GreekNova multi-user Kite Connect access. Deliberately NOT linked
// from /login, the navbar, or anywhere else a regular beta user would find it --
// per Manish's call (Oct 7 2026): existing beta users log in via email/demo
// only, unaffected, until Zerodha approves and this moves into the normal
// production login page. Same backend (/auth/kite-login) and the same
// registered Kite redirect URL (https://greeknova-frontend.vercel.app/auth/callback)
// as the real thing -- this page IS the real flow, just not surfaced yet.
const KITE_API_KEY = process.env.NEXT_PUBLIC_KITE_API_KEY || ''
const KITE_LOGIN_URL = KITE_API_KEY ? `https://kite.zerodha.com/connect/login?v=3&api_key=${KITE_API_KEY}` : ''

export default function ZerodhaLoginReviewPage() {
  const [disclaimerChecked, setDisclaimerChecked] = useState(false)
  const [error, setError] = useState('')

  function handleZerodhaLogin() {
    if (!disclaimerChecked) {
      setError('Please tick the disclaimer checkbox first.')
      return
    }
    if (!KITE_LOGIN_URL) {
      setError('Zerodha login is not configured yet.')
      return
    }
    sessionStorage.setItem('gn_login_return_to', '/')
    window.location.href = KITE_LOGIN_URL
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Greek<span className="text-blue-400">Nova</span>
          </h1>
          <p className="text-gray-400 mt-2 text-sm">
            F&O Analytics Platform — Zerodha Login (Review)
          </p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-xl">
          <h2 className="text-white text-lg font-semibold mb-1">
            Continue with Zerodha
          </h2>
          <p className="text-gray-400 text-sm mb-6">
            Log in with your Zerodha Kite account to access GreekNova.
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

          {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

          <button
            onClick={handleZerodhaLogin}
            disabled={!disclaimerChecked}
            className="w-full bg-[#387ed1] hover:bg-[#2f6bb5] text-white font-semibold py-3 rounded-lg text-sm transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Continue with Zerodha →
          </button>
        </div>
        <p className="text-center text-gray-600 text-xs mt-6 px-4">
          GreekNova is an analytics tool, not an investment adviser.
          Nothing on this platform constitutes investment advice.
        </p>
      </div>
    </div>
  )
}
