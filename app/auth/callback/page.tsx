'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function CallbackPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    async function handleCallback() {
      const requestToken = searchParams.get('request_token')
      const email = sessionStorage.getItem('greeknova_pending_email')

      console.log('Callback — request_token:', requestToken)
      console.log('Callback — email from sessionStorage:', email)

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
          const err = await response.text()
          console.error('Backend error:', err)
          router.push('/login?error=auth_failed')
          return
        }

        const { kite_user_id } = await response.json()
        console.log('Auth success — kite_user_id:', kite_user_id)

        // Clear pending email
        sessionStorage.removeItem('greeknova_pending_email')

        // Store session in localStorage so middleware knows user is logged in
        localStorage.setItem('greeknova_user', JSON.stringify({ email, kite_user_id }))

        router.push('/dashboard?kite=connected')

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
        <div className="text-white text-lg font-semibold mb-2">Connecting your Kite account...</div>
        <div className="text-gray-400 text-sm">Please wait, do not close this tab.</div>
      </div>
    </div>
  )
}
