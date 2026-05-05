self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()))

let spikeThreshold = 10
let enabled = false
let previousSpikes = new Set()
let checkTimer = null

// Respond to keep-alive fetches
self.addEventListener('fetch', e => {
  if (e.request.url.includes('/sw-keepalive')) {
    e.respondWith(new Response(JSON.stringify({ alive: true, enabled }), {
      headers: { 'Content-Type': 'application/json' }
    }))
  }
})

self.addEventListener('message', async (event) => {
  const { type, data } = event.data || {}
  
  if (type === 'ENABLE') {
    enabled = true
    spikeThreshold = data?.spikeThreshold || 10
    startTimer()
  }
  if (type === 'DISABLE') {
    enabled = false
    if (checkTimer) { clearInterval(checkTimer); checkTimer = null }
  }
  if (type === 'UPDATE_THRESHOLD') {
    spikeThreshold = data?.spikeThreshold || 10
  }
  if (type === 'CHECK_NOW') {
    // Page is pinging us — use this to run checks
    if (enabled) {
      event.waitUntil(runChecks())
    }
  }
})

function startTimer() {
  if (checkTimer) clearInterval(checkTimer)
  // Run immediately then every 5 minutes
  runChecks()
  checkTimer = setInterval(() => {
    if (enabled) runChecks()
  }, 5 * 60 * 1000)
}

async function runChecks() {
  if (!enabled) return
  try { await checkOISpikes() } catch(e) { console.error('Spike check failed:', e) }
  try { await checkVolumeSpikes() } catch(e) { console.error('Vol check failed:', e) }
}

function playSound() {
  // Notify all clients to play sound
  self.clients.matchAll({ type: 'window' }).then(clients => {
    clients.forEach(c => c.postMessage({ type: 'PLAY_SOUND' }))
  })
}

async function checkOISpikes() {
  const res = await fetch(`http://localhost:8000/oi-spikes?threshold=${spikeThreshold}`)
  const json = await res.json()
  if (!json.spikes) return
  for (const spike of json.spikes) {
    const key = `${spike.tradingsymbol}_${json.ts_new}`
    if (previousSpikes.has(key)) continue
    previousSpikes.add(key)
    playSound()
    const icon = spike.direction === 'BUILD' ? '🔥' : '📉'
    await self.registration.showNotification(
      `${icon} OI ${spike.direction} — ${spike.symbol} ${spike.strike} ${spike.option_type}`,
      {
        body: `OI ${spike.oi_pct > 0 ? '+' : ''}${spike.oi_pct}% in 5 min | OI: ${(spike.new_oi/100000).toFixed(1)}L | LTP: ₹${spike.last_price}`,
        icon: '/favicon.ico', tag: key,
        requireInteraction: true,
        data: { url: '/spikes' }
      }
    )
  }
}

async function checkVolumeSpikes() {
  const res = await fetch(`http://localhost:8000/volume-spikes?threshold=${spikeThreshold}`)
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
        icon: '/favicon.ico', tag: key,
        requireInteraction: true,
        data: { url: '/volume' }
      }
    )
  }
}

self.addEventListener('notificationclick', e => {
  e.notification.close()
  e.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clients => {
      const url = e.notification.data?.url || '/'
      if (clients.length > 0) { clients[0].focus(); clients[0].navigate(url) }
      else self.clients.openWindow(url)
    })
  )
})
