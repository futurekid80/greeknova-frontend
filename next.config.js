/** @type {import('next').NextConfig} */

// Oct 31 2026: duplicate-alert fix. The same app was reachable on both
// app.greeknova.com and the old greeknova-frontend.vercel.app address.
// Browser notification permission, the service worker and localStorage are
// all PER-ORIGIN, so a user who had both open got every alert twice (and had
// different alert settings on each). The old address now redirects to
// app.greeknova.com. Zerodha's registered Redirect URL is already
// https://app.greeknova.com/auth/callback, so login is unaffected.
// Only the production alias is redirected -- Vercel preview URLs are not.
const OLD_HOST = 'greeknova-frontend.vercel.app'

const nextConfig = {
  async redirects() {
    return [
      {
        // Everything EXCEPT /sw.js: browsers refuse a service-worker script
        // that sits behind a redirect, so the old origin's existing worker
        // could never be replaced. /sw.js is rewritten below instead.
        source: '/:path((?!sw\\.js$).*)',
        has: [{ type: 'host', value: OLD_HOST }],
        destination: 'https://app.greeknova.com/:path?moved=1',
        permanent: false,
      },
    ]
  },
  async rewrites() {
    return [
      {
        // On the OLD origin only, serve a self-removing worker in place of
        // the real one so existing installs unregister themselves and stop
        // raising duplicate notifications.
        source: '/sw.js',
        has: [{ type: 'host', value: OLD_HOST }],
        destination: '/sw-moved.js',
      },
    ]
  },
  async headers() {
    return [
      {
        // sw.js was being cached for days by the browser/CDN, meaning fixes
        // to alert-checking logic never actually reached users' browsers
        // even after deploy. Force it to always revalidate.
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        ],
      },
      {
        source: '/sw-moved.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        ],
      },
    ]
  },
}
module.exports = nextConfig
