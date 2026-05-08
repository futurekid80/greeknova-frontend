'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function ConfirmPage() {
  const router = useRouter()

  useEffect(() => {
    async function handleConfirm() {
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      const { data: { session } } = await supabase.auth.getSession()

      if (session) {
        router.push('/')
      } else {
        router.push('/login?error=link_expired')
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
