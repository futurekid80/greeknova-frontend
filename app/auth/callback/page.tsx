'use client'

import { useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function CallbackHandler() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    async function handleCallback() {
      const requestToken = searchParams.get('request_token')
      const email = localStorage.getItem('greeknova_pending_email')

      if (!requestToken || !email) {
        router.push('/login?error=missing_token')
        return
      }

      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/auth/kite-callback`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ request_token: requestToken, email })
          }
        )

        if (!response.ok) {
          router.push('/login?error=auth_failed')
          return
        }

        const { kite_user_id } = await response.json()

        localStorage.removeItem('greeknova_pending_email')
        localStorage.setItem('greeknova_user', JSON.stringify({ email, kite_user_id }))

        router.push('/')

      } catch (error) {
        console.error('Callback error:', error)
        router.push('/login?error=auth_failed')
      }
    }

    handleCallback()
  }, [searchParams, router])

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center">
        <div className="text-white text-lg font-semibold mb-2">
          Connecting your Kite account...
        </div>
        <div className="text-gray-400 text-sm">
          Please wait, do not close this tab.
        </div>
      </div>
    </div>
  )
}

export default function CallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    }>
      <CallbackHandler />
    </Suspense>
  )
}
