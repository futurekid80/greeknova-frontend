'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit() {
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address')
      return
    }

    setLoading(true)
    setError('')

    // Check if email is on beta list
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

    // Send magic link
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: email.toLowerCase().trim(),
      options: {
        shouldCreateUser: false,
        emailRedirectTo: 'https://greeknova-frontend.vercel.app/auth/confirm'
      }
    })

    if (otpError) {
      setError('Something went wrong. Please try again.')
      setLoading(false)
      return
    }

    setSent(true)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Greek<span className="text-blue-400">Nova</span>
          </h1>
          <p className="text-gray-400 mt-2 text-sm">
            F&O Analytics Platform — Beta Access
          </p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-xl">

          {!sent ? (
            <>
              <h2 className="text-white text-lg font-semibold mb-1">
                Welcome to GreekNova Beta
              </h2>
              <p className="text-gray-400 text-sm mb-6">
                Enter your email to receive a magic login link. No password needed.
              </p>

              <label className="text-gray-400 text-xs uppercase tracking-wider mb-1 block">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                placeholder="you@example.com"
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-blue-500 mb-4"
              />

              {error && (
                <p className="text-red-400 text-sm mb-4">{error}</p>
              )}

              <button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-lg text-sm transition disabled:opacity-50"
              >
                {loading ? 'Checking...' : 'Send Magic Link →'}
              </button>
            </>
          ) : (
            <>
              <div className="text-center py-4">
                <div className="text-4xl mb-4">📧</div>
                <h2 className="text-white text-lg font-semibold mb-2">
                  Check your email
                </h2>
                <p className="text-gray-400 text-sm mb-4">
                  We sent a login link to:
                </p>
                <p className="text-blue-400 font-medium mb-6">{email}</p>
                <p className="text-gray-500 text-xs">
                  Click the link in the email to access GreekNova.
                  The link expires in 1 hour.
                </p>
                <button
                  onClick={() => { setSent(false); setEmail('') }}
                  className="mt-6 text-gray-500 hover:text-gray-300 text-sm transition"
                >
                  ← Use a different email
                </button>
              </div>
            </>
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
