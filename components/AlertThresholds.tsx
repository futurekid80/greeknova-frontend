'use client'
import { useState, useEffect } from 'react'

export default function AlertThresholds({
  spikeThreshold, volThreshold, onSave,
}: {
  spikeThreshold: number
  volThreshold: number
  onSave: (oi: number, vol: number) => void
}) {
  const [oi, setOi] = useState(spikeThreshold)
  const [vol, setVol] = useState(volThreshold)
  const [dirty, setDirty] = useState(false)

  useEffect(() => { setOi(spikeThreshold); setVol(volThreshold) }, [spikeThreshold, volThreshold])

  return (
    <div className="flex items-center gap-3 bg-gray-900/40 border border-gray-800 rounded-lg px-3 py-2 text-xs">
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
      {dirty && (
        <button
          onClick={() => { onSave(oi, vol); setDirty(false) }}
          className="text-emerald-400 border border-emerald-700/50 bg-emerald-950/40 rounded px-2 py-0.5 hover:bg-emerald-950/60"
        >
          Save
        </button>
      )}
    </div>
  )
}
