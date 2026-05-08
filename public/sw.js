// ── GreekNova Service Worker ──────────────────────────────────────────────────
// BUMP THIS VERSION every time you change this file.
// The browser sees a byte-change → installs new SW → old cache is gone.
const SW_VERSION = 'v1.0.2'

self.addEventListener('install', (e) => {
  console.log(`[SW ${SW_VERSION}] Installing`)
  // Skip waiting immediately so new SW activates without waiting for old tabs to close
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  console.log(`[SW ${SW_VERSION}] Activated`)
  e.waitUntil(self.clients.claim())
})

// ── State ─────────────────────────────────────────────────────────────────────
let spikeThreshold = 10
let enabled = false
let previousSpikes = new Set()

// ── Keep-alive ping (page pings SW to keep it alive) ─────────────────────────
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
    // Run an immediate check when user enables alerts
    event.waitUntil(runChecks())
  }

  if (type === 'DISABLE') {
    enabled = false
    console.log(`[SW ${SW_VERSION}] Disabled`)
  }

  if (type === 'UPDATE_THRESHOLD') {
    spikeThreshold = data?.spikeThreshold ?? 10
    console.log(`[SW ${SW_VERSION}] Threshold updated → ${spikeThreshold}`)
  }

  if (type === 'CHECK_NOW') {
    // Page is pinging us to run a check (correct keep-alive pattern)
    if (enabled) {
      event.waitUntil(runChecks())
    }
  }

  // Allow page to query SW status (useful for debugging)
  if (type === 'GET_STATUS') {
    event.source?.postMessage({
      type: 'STATUS',
      data: { enabled, spikeThreshold, version: SW_VERSION },
    })
  }
})

// ── Check runner ──────────────────────────────────────────────────────────────
async function runChecks() {
  if (!enabled) return
  try { await checkOISpikes() } catch (e) { console.error('[SW] OI spike check failed:', e) }
  try { await checkVolumeSpikes() } catch (e) { console.error('[SW] Vol spike check failed:', e) }
}

// ── Sound: delegate to page (SW cannot use Web Audio API) ────────────────────
function playSound() {
  self.clients.matchAll({ type: 'window' }).then((clients) => {
    clients.forEach((c) => c.postMessage({ type: 'PLAY_SOUND' }))
  })
}

// ── OI Spike check ────────────────────────────────────────────────────────────
async function checkOISpikes() {
  const res = await fetch(
    `https://greeknova-backend-production.up.railway.app/oi-spikes?threshold=${spikeThreshold}`
  )
  const json = await res.json()
  if (!json.spikes) return

  for (const spike of json.spikes) {
    const key = `oi_${spike.tradingsymbol}_${json.ts_new}`
    if (previousSpikes.has(key)) continue
    previousSpikes.add(key)

    playSound()

    const icon = spike.direction === 'BUILD' ? '🔥' : '📉'
    await self.registration.showNotification(
      `${icon} OI ${spike.direction} — ${spike.symbol} ${spike.strike} ${spike.option_type}`,
      {
        body: `OI ${spike.oi_pct > 0 ? '+' : ''}${spike.oi_pct}% in 5 min | OI: ${(spike.new_oi / 100000).toFixed(1)}L | LTP: ₹${spike.last_price}`,
        icon: '/favicon.ico',
        tag: key,
        requireInteraction: true,
        data: { url: '/spikes' },
      }
    )
  }
}

// ── Volume Spike check ────────────────────────────────────────────────────────
async function checkVolumeSpikes() {
  const res = await fetch(
    `https://greeknova-backend-production.up.railway.app/volume-spikes?threshold=${spikeThreshold}`
  )
  const json = await res.json()
  if (!json.spikes) return

  for (const spike of json.spikes) {
    if (spike.oi_signal !== 'FRESH_BUILD') continue
    const key = `vol_${spike.tradingsymbol}_${json.ts_new}`
    if (previousSpikes.has(key)) continue
    previousSpikes.add(key)

    playSound()

    await self.registration.showNotification(
      `📊 Vol Fresh Build — ${spike.symbol} ${spike.strike} ${spike.option_type}`,
      {
        body: `Volume +${spike.vol_pct}% | OI +${spike.oi_pct}% | LTP: ₹${spike.last_price}`,
        icon: '/favicon.ico',
        tag: key,
        requireInteraction: true,
        data: { url: '/volume' },
      }
    )
  }
}

// ── Notification click → open page ───────────────────────────────────────────
self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  e.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
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
