'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'

export default function DisclaimerModal() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const accepted = localStorage.getItem('gn_disclaimer_accepted')
    if (!accepted) setShow(true)
  }, [])

  function accept() {
    localStorage.setItem('gn_disclaimer_accepted', '1')
    setShow(false)
  }

  if (!show) return null

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0d0d1a] border border-gray-700 rounded-2xl max-w-lg w-full p-8 shadow-2xl">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-600 flex items-center justify-center mx-auto mb-4">
            <span className="text-xl font-black text-white">GN</span>
          </div>
          <h2 className="text-2xl font-black text-white mb-2">Welcome to GreekNova</h2>
          <p className="text-gray-500 text-sm">Please read before continuing</p>
        </div>

        <div className="bg-amber-950/40 border border-amber-800/50 rounded-xl p-4 mb-6">
          <p className="text-amber-200/80 text-sm leading-relaxed">
            ⚠️ GreekNova is an <strong>educational analytics tool</strong> — not SEBI-registered 
            and not investment advice. OI data, Greeks, and signals shown are for 
            informational purposes only.
          </p>
        </div>

        <ul className="space-y-2 text-sm text-gray-400 mb-6">
          <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">✓</span>I understand this is not investment advice</li>
          <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">✓</span>I will not trade solely based on data shown here</li>
          <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">✓</span>I accept full responsibility for my trading decisions</li>
          <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">✓</span>Derivatives trading carries substantial risk of loss</li>
        </ul>

        <button onClick={accept}
          className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-colors mb-3">
          I Understand & Accept
        </button>
        <p className="text-center text-xs text-gray-600">
          <Link href="/disclaimer" className="hover:text-gray-400 underline">Read full disclaimer & terms</Link>
        </p>
      </div>
    </div>
  )
}
