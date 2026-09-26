'use client'

import { useEffect, useState } from 'react'

const API = 'https://api.greeknova.com'

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export default function KiteCallbackPage() {
  const [state, setState] = useState<'working' | 'ok' | 'error'>('working')
  const [message, setMessage] = useState('Finishing your Zerodha login…')

  useEffect(() => {
    async function run() {
      const params = new URLSearchParams(window.location.search)
      const requestToken = params.get('request_token') || ''
      const status = params.get('status')

      if (status !== 'success' || !requestToken) {
        setState('error')
        setMessage('Zerodha did not complete the login. Please try again.')
        return
      }

      let key = ''
      let secret = ''
      try {
        key = sessionStorage.getItem('gn_kite_key') || ''
        secret = sessionStorage.getItem('gn_kite_secret') || ''
        if (!key || !secret) {
          const raw = localStorage.getItem('gn_kite_saved')
          if (raw) { const v = JSON.parse(raw); key = v?.k || ''; secret = v?.s || '' }
        }
      } catch (e) { /* ignore */ }

      if (!key || !secret) {
        setState('error')
        setMessage('Your details were not found in this browser. Please start again from the Connect Kite page.')
        return
      }

      try {
        const checksum = await sha256Hex(key + requestToken + secret)
        const res = await fetch(`${API}/kite/connect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ api_key: key, request_token: requestToken, checksum }),
        })
        const j = await res.json().catch(() => ({}))
        try { sessionStorage.removeItem('gn_kite_secret'); sessionStorage.removeItem('gn_kite_key') } catch (e) { /* ignore */ }
        if (res.ok && j.ok) {
          setState('ok')
          setMessage(`Connected as ${j.kite_user_id}. Taking you to GreekNova…`)
          setTimeout(() => { window.location.href = '/' }, 2000)
        } else {
          setState('error')
          setMessage(j.error || 'Could not confirm your login. Please try again.')
        }
      } catch (e) {
        setState('error')
        setMessage('Network problem. Please try again.')
      }
    }
    run()
  }, [])

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
        <h1 className="text-xl font-bold text-white mb-3">Zerodha connection</h1>
        <p className={state === 'error' ? 'text-red-400 text-sm' : state === 'ok' ? 'text-green-400 text-sm' : 'text-gray-400 text-sm'}>
          {message}
        </p>
        {state === 'error' && (
          <a href="/connect-kite" className="inline-block mt-5 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-5 py-2 rounded-lg text-sm">
            Back to Connect Kite
          </a>
        )}
      </div>
    </div>
  )
}
