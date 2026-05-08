'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Suspense } from 'react'

function ConfirmHandler() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    async function handleConfirm() {
      const code = searchParams.get('code')
      const token_hash = searchParams.get('token_hash')
      const type = searchParams.get('type')

      console.log('Confirm params:', { code, token_hash, type })

      try {
        if (code) {
          // PKCE flow — exchange code for session
          const { data, error } = await supabase.auth.exchangeCodeForSession(code)
          console.log('Exchange result:', data, error)
          if (error) throw error
          router.push('/')
          return
        }

        if (token_hash && type) {
          // Token hash flow
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash,
            type: type as any
          })
          console.log('Verify result:', data, error)
          if (error) throw error
          router.push('/')
          return
        }

        // Try getting existing session
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          router.push('/')
          return
        }

        // Nothing worked
        router.push('/login?error=link_expired')

      } catch (error) {
        console.error('Confirm error:', error)
        router.push('/login?error=auth_failed')
      }
    }

    handleConfirm()
  }, [router, searchParams])

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl mb-4">✨</div>
        <div className="text-white text-lg font-semibold mb-2">
          Logging you in...
        </div>
        <div className="text-gray-400 text-sm">
          Please wait, do not close this tab.
        </div>
      </div>
    </div>
  )
}

export default function ConfirmPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    }>
      <ConfirmHandler />
    </Suspense>
  )
}
