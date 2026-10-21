import { createClient, type Session } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce'
  }
})

// Oct 15 2026: root cause of "loading nonstop without showing any data",
// which the earlier (Kite-side) rate-limit fix didn't fully explain --
// confirmed live via Claude in Chrome that on a fresh page load, ZERO
// backend requests were even being dispatched yet, stuck well past 15s.
// Console showed: '@supabase/gotrue-js: Lock "lock:sb-...-auth-token" was
// not released within 5000ms ... Forcefully acquiring the lock to
// recover.' -- gotrue-js serializes every supabase.auth.getSession() call
// through the browser's Web Locks API, and this app was calling it
// directly from ~6+ independent places on a single page load at once:
// AlertsContext (global, every page), Navbar's classic-menu pref (global,
// every page), the homepage's own checkAuth() and fetchData(), AND
// authFetch.ts's window.fetch patch calling it again for every single
// outgoing API request (so the 4-5 parallel homepage fetches each
// triggered their own call too). All of those raced on the same lock
// simultaneously, and that's what the "orphaned lock" recovery was
// actually recovering from -- not an internet issue, a client-side
// thundering herd on the browser auth lock, compounding the separate
// Kite-side thundering herd already fixed server-side.
//
// Fix: a single shared in-memory cache for the session. The first caller
// in any burst makes the real supabase.auth.getSession() call (one lock
// acquisition); every other near-simultaneous caller reuses that same
// in-flight promise instead of starting its own. Once resolved, the
// session is kept in memory and read synchronously -- no further lock
// acquisitions at all -- until auth actually changes (sign-in, sign-out,
// token refresh), which onAuthStateChange keeps it in sync with.
let _cachedSession: Session | null = null
let _sessionLoaded = false
let _sessionInFlight: Promise<{ data: { session: Session | null } }> | null = null

// Oct 15 2026 (second pass): the catch below handles a lock getting
// *stolen* (gotrue rejects and we recover). Live testing with two tabs
// open turned up a worse case the catch can't touch: the lock sometimes
// never resolves OR rejects at all -- confirmed by watching the network
// panel during a stuck "Loading your dashboard..." and seeing ZERO
// requests fire, not even the dashboard_prefs query, meaning the code was
// still parked on `await getSessionCached()` itself. No exception, so no
// catch block runs, so nothing recovers on its own. A hard timeout is the
// only thing that can save a caller from an underlying promise that
// simply never settles. It does NOT cancel or reset the real in-flight
// request -- that keeps running and will still populate the cache for
// the next call if the lock ever does clear -- it just stops THIS caller
// from waiting on it forever.
// Takes a PromiseLike rather than a Promise -- Supabase's own query
// builders (e.g. supabase.from(...).select(...)) are thenables, not real
// Promise instances, and are exactly what this needs to wrap at other
// call sites (their own internal getSession() call is a second,
// independent lock acquisition this helper also needs to guard).
export function withTimeout<T>(p: PromiseLike<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`getSessionCached timed out after ${ms}ms`)), ms)
    p.then((v) => { clearTimeout(t); resolve(v) }, (e) => { clearTimeout(t); reject(e) })
  })
}

// Oct 21 2026 BUG FIX: once _sessionLoaded became true, the cached
// session was trusted forever with no expiry check at all. If a tab sits
// backgrounded long enough for the real access_token to expire (Chrome
// throttles timers hard on inactive background tabs, including
// Supabase's own internal auto-refresh timer), every call here kept
// handing out that same stale, now-expired token with zero
// re-validation -- that's what produced the "Your session has expired"
// banner on returning to an idle tab mid-day, reported by Manish and
// multiple users, even though nobody was actually signed out. A manual
// reload only "fixed" it by re-running this module from scratch and
// forcing a real getSession() call. Now: treat a cached session that's
// expired (or expiring within 60s) as a cache miss, so it goes through
// the real supabase.auth.getSession() call below, which transparently
// refreshes via the refresh_token when the access_token has expired.
function isSessionStale(s: Session | null): boolean {
  if (!s?.expires_at) return false
  return s.expires_at * 1000 < Date.now() + 60_000
}

export async function getSessionCached(): Promise<{ data: { session: Session | null } }> {
  if (_sessionLoaded && !isSessionStale(_cachedSession)) return { data: { session: _cachedSession } }
  if (!_sessionInFlight) {
    _sessionInFlight = supabase.auth.getSession().then((r) => {
      _cachedSession = r.data.session
      _sessionLoaded = true
      _sessionInFlight = null
      return r
    }).catch((e) => {
      // Oct 15 2026: confirmed live with two app.greeknova.com tabs open in
      // the same browser at once (completely normal -- Manish had
      // /dashboard and /oiprofile open together) -- gotrue-js's
      // navigator.locks-based lock gets "stolen" by the other tab's own
      // concurrent getSession() call, which throws here: 'Lock
      // "lock:sb-...-auth-token" was released because another request
      // stole it'. Without this catch, that rejection was never cleared --
      // _sessionInFlight stayed set to the now-rejected promise forever
      // (never reset to null) and _sessionLoaded never became true, so
      // EVERY subsequent getSessionCached() call across the whole app --
      // every page's auth check, every outgoing API request's auth header
      // in authFetch.ts -- kept re-throwing/returning this same stale
      // failure until a full page reload reset the module. That's what hung
      // /dashboard on "Loading your dashboard..." indefinitely and made the
      // "Your session has expired" banner keep reappearing on every
      // request, even though the session itself was perfectly valid the
      // whole time. Reset so the very next call gets a clean, real retry
      // instead of staying poisoned.
      _sessionInFlight = null
      throw e
    })
  }
  return withTimeout(_sessionInFlight, 4000)
}

supabase.auth.onAuthStateChange((_event, session) => {
  _cachedSession = session
  _sessionLoaded = true
})
