import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  // Debug — log everything Kite sends back
  console.log('=== KITE CALLBACK ===')
  console.log('Full URL:', request.url)
  console.log('All params:', Object.fromEntries(searchParams))

  const requestToken = searchParams.get('request_token')
  const email = searchParams.get('state')

  console.log('request_token:', requestToken)
  console.log('state/email:', email)

  if (!requestToken || !email) {
    console.log('MISSING TOKEN OR EMAIL — redirecting to error')
    return NextResponse.redirect(
      new URL('/login?error=missing_token', request.url)
    )
  }

  try {
    // Exchange request_token for access_token via our backend
    const tokenResponse = await fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/auth/kite-callback`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_token: requestToken, email })
      }
    )

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text()
      console.log('Backend error:', errText)
      throw new Error('Token exchange failed')
    }

    const { access_token: kiteToken, kite_user_id } = await tokenResponse.json()
    console.log('Kite user ID:', kite_user_id)

    // Sign in or create user in Supabase
    const { error: signInError } =
      await supabase.auth.signInWithOtp({ email })

    if (signInError) {
      console.log('Supabase OTP error:', signInError)
      throw signInError
    }

    // Store kite token against user in Supabase DB
    const { error: upsertError } = await supabase
      .from('user_kite_tokens')
      .upsert({
        email,
        kite_user_id,
        kite_access_token: kiteToken,
        connected_at: new Date().toISOString(),
        token_date: new Date().toISOString().split('T')[0]
      })

    if (upsertError) {
      console.log('Supabase upsert error:', upsertError)
      throw upsertError
    }

    console.log('=== AUTH SUCCESS — redirecting to dashboard ===')
    return NextResponse.redirect(
      new URL('/dashboard?kite=connected', request.url)
    )

  } catch (error) {
    console.error('Kite callback error:', error)
    return NextResponse.redirect(
      new URL('/login?error=auth_failed', request.url)
    )
  }
}
