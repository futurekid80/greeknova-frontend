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


// If the API ever answers "sign in required" / "no access", show one small
// banner instead of letting pages silently go blank.
function showAccessBanner(code: string) {
  try {
    if (document.getElementById('gn-access-banner')) return
    const noAccess = code === 'user_not_member'
    const bar = document.createElement('div')
    bar.id = 'gn-access-banner'
    bar.style.cssText =
      'position:fixed;top:0;left:0;right:0;z-index:99999;padding:10px 16px;text-align:center;' +
      'font:14px system-ui,sans-serif;background:#7a5b12;color:#fff;'
    bar.textContent = noAccess
      ? 'This email does not have GreekNova access. Contact support if you think this is a mistake.'
      : 'Your session has expired. '
    if (!noAccess) {
      const b = document.createElement('button')
      b.textContent = 'Refresh now'
      b.style.cssText = 'margin-left:8px;padding:3px 12px;border-radius:6px;border:0;cursor:pointer;'
      b.onclick = () => window.location.reload()
      bar.appendChild(b)
    }
    document.body.appendChild(bar)
  } catch (e) {
    // ignore
  }
}

async function watchAccess(p: Promise<Response>, gated: boolean): Promise<Response> {
  const res = await p
  if (gated && (res.status === 401 || res.status === 403)) {
    try {
      const j = await res.clone().json()
      if (j && (j.code === 'user_no_token' || j.code === 'user_bad_token' || j.code === 'user_not_member')) {
        showAccessBanner(j.code)
      }
    } catch (e) {
      // not a gate response
    }
  }
  return res
}

if (typeof window !== 'undefined' && !window.__gnAuthFetchInstalled) {
  window.__gnAuthFetchInstalled = true
  const originalFetch = window.fetch.bind(window)

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    let gatedCall = false
    try {
      const rawUrl =
        typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      const u = new URL(rawUrl, window.location.href)
      const isApi = API_HOSTS.includes(u.hostname)
      const isOwnProxy = u.origin === window.location.origin && u.pathname.startsWith('/api/')
      if ((isApi || isOwnProxy) && !u.pathname.startsWith('/public/')) {
        gatedCall = true
        const { data } = await supabase.auth.getSession()
        const token = data.session?.access_token
        if (token) {
          const headers = new Headers(
            init?.headers || (input instanceof Request ? input.headers : undefined)
          )
          if (!headers.has('Authorization')) {
            headers.set('Authorization', `Bearer ${token}`)
          }
          return watchAccess(originalFetch(input, { ...init, headers }), true)
        }
      }
    } catch (e) {
      // never let the sign-in helper break a page: fall through to a plain request
    }
    return watchAccess(originalFetch(input, init), gatedCall)
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
