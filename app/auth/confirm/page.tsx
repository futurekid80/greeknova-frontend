'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function ConfirmPage() {
  const router = useRouter()

  useEffect(() => {
    async function handleConfirm() {
      // PKCE flow — Supabase handles token exchange automatically
      // Just need to check session after a short delay
      let attempts = 0
      
      const check = async () => {
        attempts++
        const { data: { session } } = await supabase.auth.getSession()
        
        if (session) {
          router.push('/')
          return
        }

        if (attempts < 10) {
          setTimeout(check, 1000)
        } else {
          router.push('/login?error=link_expired')
        }
      }

      setTimeout(check, 1500)
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
