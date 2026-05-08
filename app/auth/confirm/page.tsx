'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function ConfirmPage() {
  const router = useRouter()

  useEffect(() => {
    async function handleConfirm() {
      // Give Supabase time to process the hash fragment
      await new Promise(resolve => setTimeout(resolve, 2000))

      const { data: { session } } = await supabase.auth.getSession()

      if (session) {
        router.push('/')
      } else {
        // Listen for auth state change
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          (event, session) => {
            if (event === 'SIGNED_IN' && session) {
              subscription.unsubscribe()
              router.push('/')
            }
          }
        )

        // Timeout after 10 seconds
        setTimeout(() => {
          subscription.unsubscribe()
          router.push('/login?error=link_expired')
        }, 10000)
      }
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
