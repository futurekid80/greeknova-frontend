// Shared IST time formatting -- single source of truth.
//
// Oct 6 2026: the Alerts page was printing raw backend ISO/UTC timestamps
// straight to the UI (e.g. "2026-10-06T05:31:41.738492+00:00") for any
// alert fetched over REST (date/symbol/unwind history views), while live
// push alerts showed a nice "06 Oct, 3:27 pm" IST string formatted client
// side in public/sw.js at receive time. Two near-identical local `toIST`
// helpers already existed (app/uoa/page.tsx, app/vacuum/page.tsx) before
// this, each doing their own manual +5:30 offset math instead of trusting
// the browser's Intl/timeZone support -- that's the drift pattern this repo
// keeps running into with hand-maintained logic, so this is the one place
// to add to or fix, not a new copy.

/**
 * Formats an ISO timestamp (any timezone offset, including naive) into the
 * "06 Oct, 3:27 pm" IST display style used across GreekNova -- matches the
 * style already used for live alerts in public/sw.js / AlertsContext.tsx.
 */
export function formatIST(iso: string): string {
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return iso
    return d.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  } catch {
    return iso
  }
}

/** Same as formatIST but HH:MM only (no date) -- for compact table rows. */
export function formatISTTime(iso: string): string {
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return '—'
    return d.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  } catch {
    return '—'
  }
}

/**
 * Alerts' `receivedAt` field is dual-purpose: live/pushed alerts already
 * carry a pre-formatted "06 Oct, 3:27 pm" string (set at receive time by
 * public/sw.js), while alerts fetched over REST (date/symbol/unwind
 * history) carry the backend's raw ISO timestamp untouched. This detects
 * which one it got and only reformats the raw case, so neither path ends
 * up double-formatted or left as a raw UTC string.
 */
export function formatReceivedAt(value: string): string {
  if (!value) return value
  // Raw ISO timestamps start with YYYY-MM-DD -- already-formatted strings
  // (from sw.js) start with a 2-digit day, e.g. "06 Oct, 3:27 pm".
  const looksLikeIso = /^\d{4}-\d{2}-\d{2}T/.test(value)
  return looksLikeIso ? formatIST(value) : value
}
