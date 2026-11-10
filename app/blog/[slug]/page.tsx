import Link from 'next/link'
import { notFound } from 'next/navigation'
import Navbar from '@/components/Navbar'
import { BLOG_POSTS } from '@/lib/blogPosts'

export function generateStaticParams() {
  return BLOG_POSTS.filter(p => p.published).map(p => ({ slug: p.slug }))
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  const post = BLOG_POSTS.find(p => p.slug === params.slug && p.published)
  return post ? { title: `${post.title} | GreekNova`, description: post.summary } : {}
}

export default function BlogPostPage({ params }: { params: { slug: string } }) {
  const post = BLOG_POSTS.find(p => p.slug === params.slug && p.published)
  if (!post) notFound()
  return (
    <div style={{ background: '#07070e', minHeight: '100vh' }}>
      <Navbar active="/blog" />
      <article style={{ maxWidth: 720, margin: '0 auto', padding: '40px 20px 64px' }}>
        <Link href="/blog" style={{ color: '#34d399', fontSize: 13, textDecoration: 'none' }}>← All posts</Link>
        <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 800, lineHeight: 1.25, margin: '16px 0 8px' }}>{post.title}</h1>
        <div style={{ color: '#6b7280', fontSize: 12, marginBottom: 28 }}>
          {new Date(post.date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })} · {post.readMins} min read · Educational only
        </div>
        {post.body.map((b, i) => {
          if (b.type === 'h') return <h2 key={i} style={{ color: '#fff', fontSize: 20, fontWeight: 700, margin: '28px 0 10px' }}>{b.text}</h2>
          if (b.type === 'p') return <p key={i} style={{ color: '#d1d5db', fontSize: 15, lineHeight: 1.75, margin: '0 0 14px' }}>{b.text}</p>
          const Tag = b.type === 'ol' ? 'ol' : 'ul'
          return (
            <Tag key={i} style={{ color: '#d1d5db', fontSize: 15, lineHeight: 1.75, margin: '0 0 14px', paddingLeft: 22, listStyle: b.type === 'ol' ? 'decimal' : 'disc' }}>
              {b.items.map((it, j) => <li key={j} style={{ marginBottom: 6 }}>{it}</li>)}
            </Tag>
          )
        })}
        <p style={{ color: '#6b7280', fontSize: 11, marginTop: 40, lineHeight: 1.6, borderTop: '1px solid #1f2937', paddingTop: 16 }}>
          GreekNova is for informational and educational purposes only. We are not SEBI registered and nothing here is investment advice or a buy/sell recommendation.
        </p>
      </article>
    </div>
  )
}
