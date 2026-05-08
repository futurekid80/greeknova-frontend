'use client'

import { useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

function ConfirmHandler() {
  const router = useRouter()

  useEffect(() => {
    async function handleConfirm() {
      // Supabase magic link puts session in URL hash
      // getSession() picks it up automatically
      const { data: { session }, error } = await supabase.auth.getSession()

      if (error || !session) {
        // Try once more after short delay
        setTimeout(async () => {
          const { data: { session: retrySession } } = await supabase.auth.getSession()
          if (retrySession) {
            router.push('/')
          } else {
            router.push('/login?error=link_expired')
          }
        }, 2000)
        return
      }

      router.push('/')
    }

    handleConfirm()
  }, [router])

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
