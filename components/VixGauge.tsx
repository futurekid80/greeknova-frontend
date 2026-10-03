'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

const API = 'https://api.greeknova.com'

const ZONE_COLORS: Record<string, string> = {
  green: '#16a34a',
  yellow: '#ca8a04',
  orange: '#ea580c',
  red: '#dc2626',
}

type VixData = {
  vix_value: number
  change_pct: number | null
  zone: string
  color: string
  alert: { type: string; move_pct: number } | null
}

export default function VixGauge() {
  const [data, setData] = useState<VixData | null>(null)

  useEffect(() => {
    const fetchVix = async () => {
      try {
        const res = await fetch(`${API}/vix-pulse?t=${Date.now()}`, { cache: 'no-store' })
        if (!res.ok) return
        const json = await res.json()
        setData(json)
      } catch (e) {
        console.error('VIX fetch failed', e)
      }
    }
    fetchVix()
    const interval = setInterval(fetchVix, 30000)
    return () => clearInterval(interval)
  }, [])

  if (!data) return null
  const color = ZONE_COLORS[data.color] || '#6b7280'
  const alertTitle = data.alert
    ? `VIX ${data.alert.type === 'VIX_SPIKE' ? 'spiking' : 'cooling'} ${Math.abs(data.alert.move_pct)}% intraday`
    : `India VIX — ${data.zone}`

  return (
    <Link
      href="/vix"
      className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm shrink-0 hover:bg-gray-800/40 transition-colors"
      style={{ borderColor: color }}
      title={alertTitle}
    >
      <span className="text-[10px] text-gray-500">VIX</span>
      <span className="font-semibold tabular-nums" style={{ color }}>
        {data.vix_value.toFixed(2)}
      </span>
      {data.change_pct !== null && (
        <span className="text-xs tabular-nums" style={{ color }}>
          {data.change_pct > 0 ? '+' : ''}
          {data.change_pct}%
        </span>
      )}
      {data.alert && <span className="text-xs animate-pulse">⚡</span>}
    </Link>
  )
}
