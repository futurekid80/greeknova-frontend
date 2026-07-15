'use client'

export default function AlertToggle({
  signals, label, enabledSignals, onToggle,
}: {
  signals: string[]
  label: string
  enabledSignals: string[] | null
  onToggle: (signal: string, on: boolean) => void
}) {
  if (enabledSignals === null) return null

  const enabled = signals.every(s => enabledSignals.includes(s))

  return (
    <button
      onClick={() => signals.forEach(s => onToggle(s, !enabled))}
      title={enabled ? `Alerts on for ${label} — click to mute on this device` : `Alerts muted for ${label} — click to enable on this device`}
      className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all font-medium ${
        enabled
          ? 'bg-emerald-950/40 text-emerald-400 border-emerald-700/50 hover:bg-emerald-950/60'
          : 'bg-gray-900/40 text-gray-500 border-gray-800 hover:text-gray-300'
      }`}
    >
      {enabled ? '🔔' : '🔕'} {label}
    </button>
  )
}
