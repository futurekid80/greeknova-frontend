import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Pages that don't require login
const PUBLIC_PATHS = [
  '/login',
  '/auth/callback',
  '/disclaimer',
]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public paths through
  const isPublic = PUBLIC_PATHS.some(path => pathname.startsWith(path))
  if (isPublic) return NextResponse.next()

  // Allow static files and API routes through
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // Check for Supabase session cookie
  const supabaseCookie = request.cookies.get('sb-ovadytserwakjdiefehn-auth-token')

  if (!supabaseCookie) {
    // Not logged in — redirect to login
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
