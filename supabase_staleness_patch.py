import os

path = os.path.expanduser("~/mnt/greeknova-frontend/lib/supabase.ts")
with open(path) as f:
    src = f.read()

old = '''export async function getSessionCached(): Promise<{ data: { session: Session | null } }> {
  if (_sessionLoaded) return { data: { session: _cachedSession } }
  if (!_sessionInFlight) {'''

new = '''// Oct 21 2026 BUG FIX: once _sessionLoaded became true, the cached
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
  if (!_sessionInFlight) {'''

assert old in src, "anchor not found"
src = src.replace(old, new, 1)

with open(os.path.expanduser("~/mnt/greeknova-frontend/lib/supabase_new.ts"), "w") as f:
    f.write(src)
print("OK, wrote supabase_new.ts, len", len(src))
