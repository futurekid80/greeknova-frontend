'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'email' | 'otp'>('email')
  const [error, setError] = useState('')

  async function handleEmailSubmit() {
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address')
      return
    }

    setLoading(true)
    setError('')

    // Check beta list
    const { data, error: dbError } = await supabase
      .from('beta_users')
      .select('email')
      .eq('email', email.toLowerCase().trim())
      .single()

    if (dbError || !data) {
      setError('This email is not on our beta list. Please contact Manish to get access.')
      setLoading(false)
      return
    }

    // Send OTP code
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: email.toLowerCase().trim(),
      options: {
        shouldCreateUser: false,
      }
    })

    if (otpError) {
      setError('Something went wrong. Please try again.')
      setLoading(false)
      return
    }

    setStep('otp')
    setLoading(false)
  }

  async function handleOtpSubmit() {
    if (!otp || otp.length < 6) {
      setError('Please enter the 6-digit code from your email')
      return
    }

    setLoading(true)
    setError('')

    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: email.toLowerCase().trim(),
      token: otp.trim(),
      type: 'email'
    })

    if (verifyError) {
      setError('Invalid or expired code. Please try again.')
      setLoading(false)
      return
    }

    // Success — redirect to dashboard
    window.location.href = '/'
  }

  return (
    <div className="min-h-screen bg-gray-950 f
