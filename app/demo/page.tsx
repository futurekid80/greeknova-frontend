'use client'
import Navbar from '@/components/Navbar'

// Oct 18 2026: new public walkthrough/demo page -- Manish's first full
// feature-walkthrough video, meant to be linked from Instagram/X bio and
// shared with prospects, plus reachable in-app via the "Watch Demo" Navbar
// link (see components/Navbar.tsx) so existing users don't have to hunt
// for it either. No auth gate -- unlike the rest of the app, this page is
// meant to be visible to logged-out visitors.
const DEMO_VIDEO_ID = 'vqdjMmgDf-k'

const FEATURES: { emoji: string; title: string; blurb: string }[] = [
  { emoji: '🧱', title: 'Wall Migration', blurb: 'Watch where the real OI wall is moving to, strike by strike, as the day unfolds.' },
  { emoji: '🧠', title: 'Positional Intelligence', blurb: 'Stealth buildup, unwind and rollover signals across NIFTY, BANKNIFTY and 200+ F&O stocks.' },
  { emoji: '⚡', title: 'Gamma Squeeze', blurb: 'Spot where dealer hedging could accelerate a move before it happens.' },
  { emoji: '📊', title: 'OI Profile & Heatmap', blurb: 'See the full strike-wise open interest picture at a glance, live.' },
  { emoji: '☀️', title: 'Pre-Market Brief', blurb: 'FII/DII flows, global cues and overnight setup, ready before the bell.' },
  { emoji: '🐺', title: 'Wolves & Custom Scanner', blurb: 'Build your own scan, or let the built-in scanners flag unusual activity for you.' },
]

export default function DemoPage() {
  return (
    <div style={{ background: '#07070e', minHeight: '100vh' }}>
      <Navbar active="/demo" />

      <div style={{ maxWidth: 880, margin: '0 auto', padding: '40px 20px 64px' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <span style={{
            display: 'inline-block', fontSize: 12, fontWeight: 600, letterSpacing: 0.4,
            color: '#34d399', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
            borderRadius: 999, padding: '4px 12px', marginBottom: 16,
          }}>
            WALKTHROUGH
          </span>
          <h1 style={{ fontSize: 30, fontWeight: 800, color: '#fff', margin: 0, marginBottom: 10 }}>
            See GreekNova in action
          </h1>
          <p style={{ fontSize: 14, color: '#9ca3af', margin: 0, maxWidth: 520, marginLeft: 'auto', marginRight: 'auto' }}>
            A full walkthrough of the platform — scanners, OI analysis, and the signals that matter for NSE F&amp;O traders.
          </p>
        </div>

        <div style={{
          position: 'relative', width: '100%', aspectRatio: '16 / 9',
          borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)', background: '#000',
        }}>
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${DEMO_VIDEO_ID}`}
            title="GreekNova Walkthrough"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>

        <div style={{ textAlign: 'center', marginTop: 28 }}>
          <a href="/login" style={{
            display: 'inline-block', background: 'linear-gradient(135deg, #34d399, #0891b2)',
            color: '#07070e', fontWeight: 700, fontSize: 14, padding: '12px 28px',
            borderRadius: 10, textDecoration: 'none',
          }}>
            Start Free →
          </a>
        </div>

        <div style={{ marginTop: 56 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#fff', textAlign: 'center', marginBottom: 24 }}>
            What's in the platform
          </h2>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 14,
          }}>
            {FEATURES.map((f) => (
              <div key={f.title} style={{
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 12, padding: '16px 18px',
              }}>
                <div style={{ fontSize: 22, marginBottom: 8 }}>{f.emoji}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{f.title}</div>
                <div style={{ fontSize: 12.5, color: '#9ca3af', lineHeight: 1.5 }}>{f.blurb}</div>
              </div>
            ))}
          </div>
        </div>

        <p style={{ textAlign: 'center', fontSize: 11, color: '#6b7280', marginTop: 48 }}>
          GreekNova is for informational and educational purposes only. Not SEBI registered. Not investment advice.
        </p>
      </div>
    </div>
  )
}
