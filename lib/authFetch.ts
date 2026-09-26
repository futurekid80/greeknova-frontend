// Adds the signed-in user's GreekNova sign-in token to every request sent to
// the GreekNova data API, so the API can tell members from strangers.
// Runs once, at import time (before any page effect fires its first request).
import { supabase } from '@/lib/supabase'

const API_HOSTS = ['api.greeknova.com']

declare global {
  interface Window {
    __gnAuthFetchInstalled?: boolean
  }
}

if (typeof window !== 'undefined' && !window.__gnAuthFetchInstalled) {
  window.__gnAuthFetchInstalled = true
  const originalFetch = window.fetch.bind(window)

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    try {
      const rawUrl =
        typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      const u = new URL(rawUrl, window.location.href)
      const isApi = API_HOSTS.includes(u.hostname)
      const isOwnProxy = u.origin === window.location.origin && u.pathname.startsWith('/api/')
      if ((isApi || isOwnProxy) && !u.pathname.startsWith('/public/')) {
        const { data } = await supabase.auth.getSession()
        const token = data.session?.access_token
        if (token) {
          const headers = new Headers(
            init?.headers || (input instanceof Request ? input.headers : undefined)
          )
          if (!headers.has('Authorization')) {
            headers.set('Authorization', `Bearer ${token}`)
          }
          return originalFetch(input, { ...init, headers })
        }
      }
    } catch (e) {
      // never let the sign-in helper break a page: fall through to a plain request
    }
    return originalFetch(input, init)
  }
}

// Hand the current token to the background alert worker (it cannot read the
// browser session itself). Re-sent on every sign-in change and every 4 minutes.
async function pushTokenToWorker() {
  try {
    if (!('serviceWorker' in navigator)) return
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) return
    const reg = await navigator.serviceWorker.ready
    reg.active?.postMessage({ type: 'TOKEN', data: { token } })
  } catch (e) {
    // ignore
  }
}

if (typeof window !== 'undefined') {
  pushTokenToWorker()
  supabase.auth.onAuthStateChange(() => { pushTokenToWorker() })
  setInterval(pushTokenToWorker, 4 * 60 * 1000)
}

export {}
