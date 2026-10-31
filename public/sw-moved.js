// Served as /sw.js ONLY on the old greeknova-frontend.vercel.app address (see
// next.config.js). It replaces the real worker there so that browsers which
// installed the app on the old address stop raising duplicate alerts:
// it clears caches, unregisters itself, and sends any open tab to the new
// address (with ?moved=1 so the app shows a one-time "we've moved" notice).
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
    } catch (e) {}
    try { await self.registration.unregister() } catch (e) {}
    try {
      const clients = await self.clients.matchAll({ type: 'window' })
      clients.forEach((c) => c.navigate('https://app.greeknova.com/?moved=1'))
    } catch (e) {}
  })())
})
