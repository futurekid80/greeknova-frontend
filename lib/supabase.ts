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

export async function getSessionCached(): Promise<{ data: { session: Session | null } }> {
  if (_sessionLoaded) return { data: { session: _cachedSession } }
  if (!_sessionInFlight) {
    _sessionInFlight = supabase.auth.getSession().then((r) => {
      _cachedSession = r.data.session
      _sessionLoaded = true
      _sessionInFlight = null
      return r
    })
  }
  return _sessionInFlight
}

supabase.auth.onAuthStateChange((_event, session) => {
  _cachedSession = session
  _sessionLoaded = true
})
