'use client'
import { useParams, useRouter } from 'next/navigation'
import { useMemo, useRef, useState } from 'react'
import Navbar from '@/components/Navbar'
import StockChart from '@/components/StockChart'
import { ALL_SYMBOLS } from '@/lib/symbols'

export default function StockChartPage() {
  const params = useParams()
  const router = useRouter()
  const symbol = String(params.symbol || '').toUpperCase()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  const matches = useMemo(() => {
    if (!query.trim()) return []
    const q = query.toUpperCase()
    return ALL_SYMBOLS.filter((s) => s.includes(q)).slice(0, 8)
  }, [query])

  function goTo(sym: string) {
    setQuery('')
    setOpen(false)
    router.push(`/stock-chart/${sym}`)
  }

  return (
    <>
      <Navbar active="/stock-chart" />
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6 gap-4">
          <h1 className="text-xl font-bold text-white">{symbol} — Price Chart</h1>
          <div className="relative w-64" ref={boxRef}>
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setOpen(true)
              }}
              onFocus={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && matches[0]) goTo(matches[0])
              }}
              placeholder="Switch symbol (e.g. RELIANCE)"
              className="w-full text-sm bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-white placeholder-gray-500 focus:outline-none focus:border-gray-500"
            />
            {open && matches.length > 0 && (
              <div className="absolute right-0 mt-1 w-full bg-gray-900 border border-gray-700 rounded-lg shadow-lg overflow-hidden z-10">
                {matches.map((s) => (
                  <button
                    key={s}
                    onMouseDown={() => goTo(s)}
                    className="block w-full text-left px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-800 hover:text-white"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <StockChart symbol={symbol} />
      </div>
    </>
  )
}
