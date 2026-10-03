'use client'
import { useEffect, useState } from 'react'

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

  return (
    <div
      className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm"
      style={{ borderColor: color }}
      title="India VIX — NSE's volatility (fear) index"
    >
      <span className="text-xs text-gray-400">VIX</span>
      <span className="font-semibold" style={{ color }}>
        {data.vix_value.toFixed(2)}
      </span>
      {data.change_pct !== null && (
        <span className="text-xs" style={{ color }}>
          {data.change_pct > 0 ? '+' : ''}
          {data.change_pct}%
        </span>
      )}
      <span
        className="text-xs px-1.5 py-0.5 rounded"
        style={{ backgroundColor: color + '22', color }}
      >
        {data.zone}
      </span>
      {data.alert && (
        <span className="text-xs font-bold animate-pulse" style={{ color }}>
          ⚡ {data.alert.type === 'VIX_SPIKE' ? 'Spiking' : 'Cooling'} {Math.abs(data.alert.move_pct)}%
        </span>
      )}
    </div>
  )
}
