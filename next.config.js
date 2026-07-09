/** @type {import('next').NextConfig} */
const nextConfig = {
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
    ]
  },
}
module.exports = nextConfig
