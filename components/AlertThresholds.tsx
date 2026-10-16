'use client'
import { useState, useEffect } from 'react'

// Oct 16 2026 ("even 1 rupee option alert i get"): same ATM/±1/±2/±5/±10/All
// zones as StrikeZoneFilter elsewhere, kept as this component's own small
// button row (not the shared component) since the "Push alerts when..." box
// is already a dense single-line strip -- the shared component's label
// ("🎯 Strike zone:") and spacing are sized for a standalone row, not for
// squeezing into this one.
const ZONES: { value: string; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'ATM', label: 'ATM' },
  { value: '1',   label: '±1' },
  { value: '2',   label: '±2' },
  { value: '5',   label: '±5' },
  { value: '10',  label: '±10' },
]

export default function AlertThresholds({
  spikeThreshold, volThreshold, strikeZone, onSave,
}: {
  spikeThreshold: number
  volThreshold: number
  strikeZone?: string
  onSave: (oi: number, vol: number, zone?: string) => void
}) {
  const [oi, setOi] = useState(spikeThreshold)
  const [vol, setVol] = useState(volThreshold)
  const [zone, setZone] = useState(strikeZone ?? 'all')
  const [dirty, setDirty] = useState(false)

  useEffect(() => { setOi(spikeThreshold); setVol(volThreshold) }, [spikeThreshold, volThreshold])
  useEffect(() => { if (strikeZone !== undefined) setZone(strikeZone) }, [strikeZone])

  return (
    <div className="flex items-center gap-3 bg-gray-900/40 border border-gray-800 rounded-lg px-3 py-2 text-xs flex-wrap">
      <span className="text-gray-500">Push alerts when:</span>
      <div className="flex items-center gap-1.5">
        <span className="text-gray-400">OI ≥</span>
        <input
          type="number"
          value={oi}
          onChange={e => { setOi(Number(e.target.value)); setDirty(true) }}
          className="w-14 bg-gray-950 border border-gray-700 rounded px-1.5 py-0.5 text-white text-xs"
        />
        <span className="text-gray-500">%</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-gray-400">Vol ≥</span>
        <input
          type="number"
          value={vol}
          onChange={e => { setVol(Number(e.target.value)); setDirty(true) }}
          className="w-14 bg-gray-950 border border-gray-700 rounded px-1.5 py-0.5 text-white text-xs"
        />
        <span className="text-gray-500">%</span>
      </div>
      {strikeZone !== undefined && (
        <div className="flex items-center gap-1">
          <span className="text-gray-400 mr-0.5">Strike:</span>
          {ZONES.map(z => (
            <button
              key={z.value}
              onClick={() => { setZone(z.value); setDirty(true) }}
              className={`px-2 py-0.5 rounded border font-bold ${
                zone === z.value
                  ? 'bg-cyan-950/60 text-cyan-400 border-cyan-700'
                  : 'bg-gray-800/40 text-gray-500 border-gray-700 hover:text-white'
              }`}
            >
              {z.label}
            </button>
          ))}
        </div>
      )}
      {dirty && (
        <button
          onClick={() => { onSave(oi, vol, zone); setDirty(false) }}
          className="text-emerald-400 border border-emerald-700/50 bg-emerald-950/40 rounded px-2 py-0.5 hover:bg-emerald-950/60"
        >
          Save
        </button>
      )}
    </div>
  )
}
