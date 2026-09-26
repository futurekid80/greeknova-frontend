'use client'

import { useEffect, useState } from 'react'
import ResultBadge from '@/components/ResultBadge'

const API = 'https://api.greeknova.com'
type ResMap = Record<string, string>

let cache: { at: number; map: ResMap } | null = null
let inflight: Promise<ResMap> | null = null

function loadResults(): Promise<ResMap> {
  if (cache && Date.now() - cache.at < 10 * 60 * 1000) return Promise.resolve(cache.map)
  if (inflight) return inflight
  inflight = fetch(`${API}/earnings/upcoming?days=90`)
    .then((r) => (r.ok ? r.json() : { results: [] }))
    .then((j) => {
      const map: ResMap = {}
      for (const x of j.results || []) map[x.symbol] = x.date
      cache = { at: Date.now(), map }
      return map
    })
    .catch(() => ({} as ResMap))
    .finally(() => { inflight = null })
  return inflight
}

export default function SymbolResult({ symbol, expiry }: { symbol: string; expiry?: string | null }) {
  const [map, setMap] = useState<ResMap>(cache?.map || {})
  useEffect(() => {
    let live = true
    loadResults().then((m) => { if (live) setMap(m) })
    return () => { live = false }
  }, [])
  const d = map[symbol]
  if (!d) return null
  const days = Math.round((new Date(d + 'T00:00:00').getTime() - new Date(new Date().toDateString()).getTime()) / 86400000)
  const before = expiry ? d <= expiry.slice(0, 10) : false
  return <ResultBadge days={days} beforeExpiry={before} />
}
