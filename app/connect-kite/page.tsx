'use client'

import { useEffect, useState } from 'react'

const API = 'https://api.greeknova.com'
const REDIRECT_URL = 'https://app.greeknova.com/kite-connect/callback'

type Status = {
  connected_today?: boolean
  ever_connected?: boolean
  kite_user_id?: string
  last_connected_on?: string
  api_key?: string
  error?: string
}

function goToZerodha(apiKey: string, secret: string, remember: boolean) {
  try {
    sessionStorage.setItem('gn_kite_key', apiKey)
    sessionStorage.setItem('gn_kite_secret', secret)
    if (remember) {
      localStorage.setItem('gn_kite_saved', JSON.stringify({ k: apiKey, s: secret }))
    } else {
      localStorage.removeItem('gn_kite_saved')
    }
  } catch (e) {
    // storage blocked: the login cannot be completed without it
  }
  window.location.href = `https://kite.zerodha.com/connect/login?v=3&api_key=${encodeURIComponent(apiKey)}`
}

export default function ConnectKitePage() {
  const [status, setStatus] = useState<Status | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [secret, setSecret] = useState('')
  const [remember, setRemember] = useState(false)
  const [saved, setSaved] = useState<{ k: string; s: string } | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    try {
      const raw = localStorage.getItem('gn_kite_saved')
      if (raw) {
        const v = JSON.parse(raw)
        if (v?.k && v?.s) { setSaved(v); setApiKey(v.k); setRemember(true) }
      }
    } catch (e) { /* ignore */ }
    fetch(`${API}/kite/status`)
      .then((r) => r.json())
      .then((j: Status) => {
        setStatus(j)
        if (j.api_key) setApiKey((prev) => prev || j.api_key || '')
      })
      .catch(() => setStatus({ error: 'Could not load your status' }))
  }, [])

  function start() {
    setError('')
    const k = apiKey.trim()
    const s = secret.trim()
    if (!/^[A-Za-z0-9]{8,32}$/.test(k)) { setError('Enter your Kite API key (letters and numbers only).'); return }
    if (!/^[A-Za-z0-9]{8,64}$/.test(s)) { setError('Enter your Kite API secret.'); return }
    goToZerodha(k, s, remember)
  }

  const box = 'bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-4'
  const input = 'w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-blue-500 mb-4'

  return (
    <div className="min-h-screen bg-gray-950 flex justify-center px-4 py-10">
      <div className="w-full max-w-xl">
        <h1 className="text-2xl font-bold text-white mb-1">Connect your Zerodha Kite</h1>
        <p className="text-gray-400 text-sm mb-6">
          GreekNova needs you to log in with your own Kite Connect app once each trading day.
          Your API secret is used only in your browser to sign the login and is never sent to or stored by GreekNova.
        </p>

        <div className={box}>
          {status === null && <p className="text-gray-400 text-sm">Checking your connection…</p>}
          {status?.connected_today && (
            <p className="text-green-400 text-sm">
              Connected for today{status.kite_user_id ? ` as ${status.kite_user_id}` : ''}. You are all set.
            </p>
          )}
          {status && !status.connected_today && !status.error && (
            <p className="text-amber-400 text-sm">
              Not connected today.{status.last_connected_on ? ` Last connected on ${status.last_connected_on}.` : ''} Log in below.
            </p>
          )}
          {status?.error && <p className="text-red-400 text-sm">{status.error}</p>}
        </div>

        {saved && (
          <div className={box}>
            <p className="text-gray-300 text-sm mb-3">Your Kite details are saved on this device.</p>
            <button
              onClick={() => goToZerodha(saved.k, saved.s, true)}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-lg text-sm transition"
            >
              Log in with Zerodha (one click)
            </button>
          </div>
        )}

        <div className={box}>
          <h2 className="text-white font-semibold mb-3">{saved ? 'Use different details' : 'Log in with Zerodha'}</h2>
          <label className="text-gray-400 text-xs uppercase tracking-wider mb-1 block">Kite API key</label>
          <input className={input} value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Your API key" autoComplete="off" />
          <label className="text-gray-400 text-xs uppercase tracking-wider mb-1 block">Kite API secret</label>
          <input className={input} type="password" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="Your API secret" autoComplete="off" />
          <label className="flex items-start gap-2 text-gray-400 text-xs mb-4">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="mt-0.5" />
            <span>Remember on this device for one-click daily login. Only tick this on your own personal device. It is stored in this browser only, never on our servers.</span>
          </label>
          {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
          <button
            onClick={start}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-lg text-sm transition"
          >
            Log in with Zerodha →
          </button>
        </div>

        <div className={box}>
          <h2 className="text-white font-semibold mb-3">First time? Set up your Kite Connect app</h2>
          <ol className="text-gray-300 text-sm space-y-2 list-decimal pl-5">
            <li>Go to <span className="text-blue-400">developers.kite.trade</span> and sign in with your Zerodha account.</li>
            <li>Subscribe to Kite Connect (paid separately to Zerodha, currently ₹500 per month) and create an app.</li>
            <li>
              Set the app&apos;s <b>Redirect URL</b> to exactly:
              <div className="mt-1 bg-gray-800 rounded px-3 py-2 text-xs text-gray-200 break-all select-all">{REDIRECT_URL}</div>
            </li>
            <li>Copy the app&apos;s <b>API key</b> and <b>API secret</b> into the form above.</li>
            <li>Click <b>Log in with Zerodha</b>, sign in on Zerodha&apos;s page, and you will return here connected.</li>
          </ol>
          <p className="text-gray-500 text-xs mt-3">
            Kite logins expire every morning, so repeat the login once each trading day. GreekNova is not affiliated with Zerodha.
          </p>
        </div>
      </div>
    </div>
  )
}
