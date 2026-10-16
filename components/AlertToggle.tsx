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

  // Oct 16 2026 ("still i can see notification for PDL when i have kept it
  // off"): a bundled button (e.g. ['PDH_CROSS','PDL_CROSS']) used to show
  // "on" only when EVERY signal in the bundle was present -- so a stale or
  // partially-saved subscription with just ONE half still in the list (a
  // leftover from a since-fixed race in usePushPreferences' toggleSignal)
  // rendered this whole button as OFF, hiding the fact that the orphaned
  // half was still live and still firing real notifications. Showing "on"
  // when ANY signal in the bundle is present means a half-on state is never
  // silently invisible -- it displays as on, and clicking it (which always
  // sets every signal in the bundle to the SAME new value) clears all of
  // them at once, self-healing the stale state instead of hiding it.
  const enabled = signals.some(s => enabledSignals.includes(s))

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
