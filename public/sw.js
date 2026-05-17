// ── GreekNova Service Worker ──────────────────────────────────────────────────
// BUMP THIS VERSION every time you change this file.
const SW_VERSION = 'v2.0.1'

const API = 'https://greeknova-backend-production.up.railway.app'
const CHECK_INTERVAL_MS = 5 * 60 * 1000  // 5 minutes

self.addEventListener('install', (e) => {
  console.log(`[SW ${SW_VERSION}] Installing`)
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  console.log(`[SW ${SW_VERSION}] Activated`)
  e.waitUntil(self.clients.claim())
})

// ── State ─────────────────────────────────────────────────────────────────────
let spikeThreshold = 10
let enabled        = false
let schedulerTimer = null
let previousKeys   = new Set()  // dedup alerts

// ── Market hours check (IST) ──────────────────────────────────────────────────
function isMarketOpen() {
  const now = new Date()
  const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
  const day = ist.getDay()
  if (day === 0 || day === 6) return false  // weekend
  const h = ist.getHours()
  const m = ist.getMinutes()
  const total = h * 60 + m
  return total >= 555 && total <= 930  // 9:15 AM to 3:30 PM IST
}

// ── Self-scheduling loop ──────────────────────────────────────────────────────
// SW keeps itself alive by extending its lifetime with waitUntil
// This fires even when all tabs are on other pages
function scheduleNext() {
  if (!enabled) return

  schedulerTimer = setTimeout(() => {
    if (!enabled) return

    const checkPromise = runChecks().then(() => {
      scheduleNext()  // Schedule next after current completes
    }).catch(e => {
      console.error('[SW] Check failed:', e)
      scheduleNext()  // Still reschedule even on error
    })

    // Keep SW alive during the check
    self.registration.active?.postMessage?.({ type: 'KEEPALIVE' })
  }, CHECK_INTERVAL_MS)
}

// ── Keep-alive ping ───────────────────────────────────────────────────────────
self.addEventListener('fetch', (e) => {
  if (e.request.url.includes('/sw-keepalive')) {
    e.respondWith(
      new Response(JSON.stringify({ alive: true, enabled, version: SW_VERSION }), {
        headers: { 'Content-Type': 'application/json' },
      })
    )
  }
})

// ── Message handler ───────────────────────────────────────────────────────────
self.addEventListener('message', async (event) => {
  const { type, data } = event.data || {}

  if (type === 'ENABLE') {
    enabled = true
    spikeThreshold = data?.spikeThreshold ?? 10
    console.log(`[SW ${SW_VERSION}] Enabled | threshold=${spikeThreshold}`)
    // Clear old dedup keys on enable
    previousKeys.clear()
    // Run immediate check + start self-scheduling
    if (schedulerTimer) clearTimeout(schedulerTimer)
    event.waitUntil(runChecks().then(() => scheduleNext()))
  }

  if (type === 'DISABLE') {
    enabled = false
    if (schedulerTimer) {
      clearTimeout(schedulerTimer)
      schedulerTimer = null
    }
    console.log(`[SW ${SW_VERSION}] Disabled`)
  }

  if (type === 'UPDATE_THRESHOLD') {
    spikeThreshold = data?.spikeThreshold ?? 10
    previousKeys.clear()  // Clear dedup so alerts refire at new threshold
    console.log(`[SW ${SW_VERSION}] Threshold → ${spikeThreshold}`)
  }

  if (type === 'CHECK_NOW') {
    if (enabled) {
      event.waitUntil(runChecks())
    }
  }

  if (type === 'GET_STATUS') {
    event.source?.postMessage({
      type: 'STATUS',
      data: { enabled, spikeThreshold, version: SW_VERSION },
    })
  }
})

// ── Main check runner ─────────────────────────────────────────────────────────
async function runChecks() {
  if (!enabled) return

  // ── MARKET HOURS GUARD ────────────────────────────────────────────────────
  if (!isMarketOpen()) {
    console.log('[SW] Market closed — skipping checks')
    notifyClients({ type: 'MARKET_CLOSED' })
    return
  }

  console.log(`[SW ${SW_VERSION}] Running checks at ${new Date().toLocaleTimeString('en-IN')}`)

  try { await checkOptionsJungle() } catch (e) { console.error('[SW] Jungle check failed:', e) }
  try { await checkUOAWhales()     } catch (e) { console.error('[SW] UOA check failed:', e)    }
}

// ── Notify all open tabs ──────────────────────────────────────────────────────
function notifyClients(data) {
  self.clients.matchAll({ type: 'window' }).then(clients => {
    clients.forEach(c => c.postMessage(data))
  })
}

function playSound() {
  notifyClients({ type: 'PLAY_SOUND' })
}

// ── Broadcast alert to feed ───────────────────────────────────────────────────
function broadcastAlert(alert) {
  self.clients.matchAll({ type: 'window' }).then(clients => {
    clients.forEach(c => c.postMessage({ type: 'NEW_ALERT', ...alert }))
  })
}

// ── Options Jungle alerts (OI spikes + Vol fresh builds) ──────────────────────
async function checkOptionsJungle() {
  const res = await fetch(
    `${API}/options-jungle?oi_threshold=${spikeThreshold}&vol_threshold=50`
  )
  const json = await res.json()

  // OI Spikes
  for (const spike of (json.oi_spikes || [])) {
    const key = `oi_${spike.tradingsymbol}_${json.ts_new}`
    if (previousKeys.has(key)) continue
    previousKeys.add(key)

    const isBuild = spike.direction === 'BUILD'
    const icon    = isBuild ? '🔥' : '📉'
    const title   = `${icon} OI ${spike.direction} — ${spike.symbol} ${spike.strike} ${spike.option_type}`
    const body    = `OI ${spike.oi_pct > 0 ? '+' : ''}${spike.oi_pct}% in 5 min | OI: ${fmtOI(spike.new_oi)} | LTP: ₹${spike.last_price}${spike.interpretation ? ' | ' + spike.interpretation.replace(/_/g,' ') : ''}`

    playSound()

    await self.registration.showNotification(title, {
      body,
      icon: '/favicon.ico',
      tag: key,
      requireInteraction: false,
      data: { url: '/jungle' },
    })

    broadcastAlert({
      id:         Date.now() + Math.random(),
      signal:     'OI_SPIKE',
      symbol:     spike.symbol,
      strike:     spike.strike,
      optionType: spike.option_type,
      direction:  spike.direction,
      message:    body,
      url:        '/jungle',
      receivedAt: new Date().toLocaleTimeString('en-IN'),
      oiPct:      spike.oi_pct,
      ltp:        spike.last_price,
    })
  }

  // Volume Fresh Builds only (FRESH_BUILD = vol spike + OI building)
  for (const spike of (json.vol_spikes || [])) {
    if (spike.vol_signal !== 'FRESH_BUILD') continue
    const key = `vol_${spike.tradingsymbol}_${json.ts_new}`
    if (previousKeys.has(key)) continue
    previousKeys.add(key)

    const title = `🌱 Fresh Build — ${spike.symbol} ${spike.strike} ${spike.option_type}`
    const body  = `Vol +${spike.vol_pct}% | OI +${spike.oi_pct}% | LTP: ₹${spike.last_price}`

    playSound()

    await self.registration.showNotification(title, {
      body,
      icon: '/favicon.ico',
      tag: key,
      requireInteraction: false,
      data: { url: '/jungle' },
    })

    broadcastAlert({
      id:         Date.now() + Math.random(),
      signal:     'FRESH_BUILD',
      symbol:     spike.symbol,
      strike:     spike.strike,
      optionType: spike.option_type,
      message:    body,
      url:        '/jungle',
      receivedAt: new Date().toLocaleTimeString('en-IN'),
      volPct:     spike.vol_pct,
      oiPct:      spike.oi_pct,
      ltp:        spike.last_price,
    })
  }
}

// ── UOA Whale alerts ──────────────────────────────────────────────────────────
async function checkUOAWhales() {
  const res  = await fetch(`${API}/uoa`)
  const json = await res.json()

  for (const sig of (json.signals || [])) {
    // Only alert on high conviction (score 4+) or two-way activity
    if (sig.score < 4) continue

    const key = `uoa_${sig.tradingsymbol}_${json.timestamp}`
    if (previousKeys.has(key)) continue
    previousKeys.add(key)

    const signalLabel = sig.signal_type.replace(/_/g, ' ')
    const title = `🐋 ${signalLabel} — ${sig.symbol} ${sig.strike} ${sig.option_type}`
    const body  = `Score ${sig.score}/5 | OI 30m: ${sig.oi_chg_30min > 0 ? '+' : ''}${sig.oi_chg_30min}% | LTP from open: ${sig.ltp_chg_from_open > 0 ? '+' : ''}${sig.ltp_chg_from_open}% | ${sig.bias} bias`

    playSound()

    await self.registration.showNotification(title, {
      body,
      icon: '/favicon.ico',
      tag: key,
      requireInteraction: false,
      data: { url: '/uoa' },
    })

    broadcastAlert({
      id:          Date.now() + Math.random(),
      signal:      sig.signal_type,
      symbol:      sig.symbol,
      strike:      sig.strike,
      optionType:  sig.option_type,
      message:     body,
      url:         '/uoa',
      receivedAt:  new Date().toLocaleTimeString('en-IN'),
      score:       sig.score,
      bias:        sig.bias,
      ltp:         sig.ltp,
    })
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtOI(n) {
  if (Math.abs(n) >= 10000000) return `${(n/10000000).toFixed(2)}Cr`
  if (Math.abs(n) >= 100000)   return `${(n/100000).toFixed(1)}L`
  return n.toLocaleString()
}

// ── Notification click → open page ───────────────────────────────────────────
self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  e.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clients => {
      const url = e.notification.data?.url || '/'
      if (clients.length > 0) {
        clients[0].focus()
        clients[0].navigate(url)
      } else {
        self.clients.openWindow(url)
      }
    })
  )
})
