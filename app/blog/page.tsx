import Link from 'next/link'
import Navbar from '@/components/Navbar'
import { publishedPosts } from '@/lib/blogPosts'

// Public page (no login needed), same as /demo.
export const metadata = {
  title: 'Learn | GreekNova',
  description: 'Plain-words explainers on how GreekNova screens work and the thinking behind them. Educational only.',
}

export default function BlogIndex() {
  const posts = publishedPosts()
  return (
    <div style={{ background: '#07070e', minHeight: '100vh' }}>
      <Navbar active="/blog" />
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '40px 20px 64px' }}>
        <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Learn: Behind the Build</h1>
        <p style={{ color: '#9ca3af', fontSize: 14, lineHeight: 1.6, marginBottom: 32 }}>
          Why each GreekNova screen exists, how to read it, and what it cannot tell you. Written for new traders, in plain words.
        </p>
        {posts.length === 0 && <p style={{ color: '#6b7280', fontSize: 14 }}>First posts are on the way.</p>}
        <div style={{ display: 'grid', gap: 16 }}>
          {posts.map(p => (
            <Link key={p.slug} href={`/blog/${p.slug}`} style={{ display: 'block', background: 'rgba(17,24,39,0.5)', border: '1px solid #1f2937', borderRadius: 16, padding: 20, textDecoration: 'none' }}>
              <div style={{ color: '#34d399', fontSize: 11, fontWeight: 600, marginBottom: 6 }}>
                {new Date(p.date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} · {p.readMins} min read
              </div>
              <div style={{ color: '#fff', fontSize: 18, fontWeight: 700, marginBottom: 6 }}>{p.title}</div>
              <div style={{ color: '#9ca3af', fontSize: 13, lineHeight: 1.55 }}>{p.summary}</div>
            </Link>
          ))}
        </div>
        <p style={{ color: '#6b7280', fontSize: 11, marginTop: 40, lineHeight: 1.6 }}>
          GreekNova is for informational and educational purposes only. We are not SEBI registered and nothing here is investment advice or a buy/sell recommendation.
        </p>
      </div>
    </div>
  )
}
