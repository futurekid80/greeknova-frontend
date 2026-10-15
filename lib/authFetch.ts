// Adds the signed-in user's GreekNova sign-in token to every request sent to
// the GreekNova data API, so the API can tell members from strangers.
// Runs once, at import time (before any page effect fires its first request).
import { supabase, getSessionCached } from '@/lib/supabase'

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

// Oct 15 2026: this banner was only ever added, never removed. A
// token/dashboard_prefs race at page load (two tabs open, lock stolen)
// could 401 the FIRST gated request on a page even with the retries above
// -- one real failure, after which the session is perfectly fine again
// (confirmed live: the very next call to the same endpoint succeeds) --
// but the banner stayed on screen regardless, because nothing ever told
// it the problem had passed. That's "this message keeps popping" even
// though the account was never actually signed out. Clear it the moment
// any gated call succeeds.
function clearAccessBanner() {
  try {
    document.getElementById('gn-access-banner')?.remove()
  } catch (e) {
    // ignore
  }
}

// Oct 14 2026: pages cache real market data (CPR, breadth, etc.) in
// sessionStorage for a few minutes so the homepage doesn't look empty while
// a fresh fetch is in flight. That cache has its own clock -- it doesn't
// care whether the person is still signed in -- so on its own it's a hole
// Zerodha could fault us for: sign out, don't close the tab, and the last
// few minutes of real data are still sitting there to be shown again. Any
// place that signs someone out (forced or voluntary) must also wipe this,
// so "signed out" and "no cached data visible" are the same moment. Keep
// this list in sync with the sessionStorage keys pages write real data to.
const CACHED_MARKET_DATA_KEYS = [
  'gn_cpr_cache', 'gn_cpr_time',
  'gn_breadth_cache', 'gn_breadth_stocks',
]
export function clearCachedMarketData() {
  try {
    for (const k of CACHED_MARKET_DATA_KEYS) sessionStorage.removeItem(k)
  } catch {}
}

// Oct 14 2026: kite_session_stale means the GreekNova (Supabase) session is
// still technically valid but the Zerodha login behind it isn't current for
// today -- Zerodha requires data to stop the moment that's true, not just
// show a dismissible banner the person can ignore. Sign out of Supabase
// (so every other tab/request stops being treated as authenticated too),
// wipe any cached market data sitting in this tab, and send them back to
// /login to reconnect Zerodha.
let signingOutForStaleKite = false
function forceReLoginForStaleKite() {
  if (signingOutForStaleKite) return
  signingOutForStaleKite = true
  try {
    sessionStorage.setItem('gn_login_return_to', window.location.pathname + window.location.search)
  } catch {}
  clearCachedMarketData()
  supabase.auth.signOut().finally(() => {
    window.location.href = '/login?error=kite_session_stale'
  })
}

async function watchAccess(p: Promise<Response>, gated: boolean): Promise<Response> {
  const res = await p
  if (gated && (res.status === 401 || res.status === 403)) {
    try {
      const j = await res.clone().json()
      if (j && j.code === 'kite_session_stale') {
        forceReLoginForStaleKite()
      } else if (j && (j.code === 'user_no_token' || j.code === 'user_bad_token' || j.code === 'user_not_member')) {
        showAccessBanner(j.code)
      }
    } catch (e) {
      // not a gate response
    }
  } else if (gated && res.ok) {
    // A gated call just succeeded -- whatever transient auth hiccup
    // triggered the banner (if any) has passed, so stop telling the
    // person their session expired.
    clearAccessBanner()
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
        // Oct 15 2026: a cross-tab lock-steal can reject this call even
        // after getSessionCached() clears its own cache on failure (see
        // lib/supabase.ts) -- the first call after a steal still throws,
        // it just no longer poisons later calls. One retry here is what
        // keeps THIS request from going out unauthenticated and tripping
        // the "session expired" banner for no real reason.
        let data
        try {
          ;({ data } = await getSessionCached())
        } catch (e) {
          // A short pause before retrying gives a same-tick burst of
          // concurrent getSession() calls (several components mounting
          // on the same page load, each racing for the same lock) a
          // moment to settle, instead of the retry landing right back in
          // the same storm it just lost to.
          await new Promise((r) => setTimeout(r, 400))
          ;({ data } = await getSessionCached())
        }
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
    const { data } = await getSessionCached()
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
