'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Suspense } from 'react'

function ConfirmHandler() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState('Starting...')

  useEffect(() => {
    async function handleConfirm() {
      const code = searchParams.get('code')
      const token_hash = searchParams.get('token_hash')
      const type = searchParams.get('type')

      setStatus(`Params: code=${code ? 'YES' : 'NO'} token_hash=${token_hash ? 'YES' : 'NO'} type=${type}`)

      await new Promise(r => setTimeout(r, 3000))

      try {
        if (code) {
          setStatus('Exchanging code...')
          const { data, error } = await supabase.auth.exchangeCodeForSession(code)
          setStatus(`Exchange: ${error ? error.message : 'SUCCESS user=' + data.session?.user?.email}`)
          await new Promise(r => setTimeout(r, 3000))
          if (error) throw error
          router.push('/')
          return
        }

        if (token_hash && type) {
          setStatus('Verifying token...')
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash,
            type: type as any
          })
          setStatus(`Verify: ${error ? error.message : 'SUCCESS user=' + data.session?.user?.email}`)
          await new Promise(r => setTimeout(r, 3000))
          if (error) throw error
          router.push('/')
          return
        }

        setStatus('No code or token found — checking session...')
        await new Promise(r => setTimeout(r, 3000))
        const { data: { session } } = await supabase.auth.getSession()
        setStatus(`Session: ${session ? 'FOUND user=' + session.user.email : 'NOT FOUND'}`)
        await new Promise(r => setTimeout(r, 3000))

        if (session) {
          router.push('/')
          return
        }

        router.push('/login?error=link_expired')

      } catch (error: any) {
        setStatus(`ERROR: ${error.message}`)
        await new Promise(r => setTimeout(r, 5000))
        router.push('/login?error=auth_failed')
      }
    }

    handleConfirm()
  }, [router, searchParams])

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center max-w-lg px-4">
        <div className="text-4xl mb-4">✨</div>
        <div className="text-white text-lg font-semibold mb-4">
          Logging you in...
        </div>
        <div className="text-yellow-400 text-sm font-mono bg-gray-900 p-4 rounded-xl border border-gray-700">
          {status}
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
