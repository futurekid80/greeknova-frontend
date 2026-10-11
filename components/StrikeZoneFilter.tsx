'use client'

// Shared ATM/±1/±2/±5/±10/All strike-zone selector -- Manish's Oct 11 2026
// ask: "let users define their own filters... ATM, ±1, ±2, ±5 or even ±10
// strikes, and an option to select All." One component, reused on Jungle,
// UOA and OI Profile rather than each page inventing its own version.
//
// The value this emits (e.g. "ATM", "2", "all") is sent straight to the
// backend as the `strike_zone` query param -- see services/strike_zones.py
// on the backend for how it's interpreted. This is a SERVER-SIDE filter
// (it changes which strikes are even considered before any top-N cap), not
// a client-side list filter, so changing it should trigger a refetch, same
// as the OI/Vol threshold presets on Jungle.

const ZONES: { value: string; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'ATM', label: 'ATM' },
  { value: '1',   label: '±1' },
  { value: '2',   label: '±2' },
  { value: '5',   label: '±5' },
  { value: '10',  label: '±10' },
]

interface Props {
  value: string
  onChange: (zone: string) => void
  /** Optional label override (defaults to "🎯 Strike zone:") */
  label?: string
}

export default function StrikeZoneFilter({ value, onChange, label = '🎯 Strike zone:' }: Props) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-500 whitespace-nowrap">{label}</span>
      <div className="flex gap-1.5">
        {ZONES.map(z => {
          const isActive = value === z.value
          return (
            <button
              key={z.value}
              onClick={() => onChange(z.value)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                isActive
                  ? 'bg-cyan-950/60 text-cyan-400 border-cyan-700'
                  : 'bg-gray-800/40 text-gray-500 border-gray-700 hover:text-white'
              }`}
            >
              {z.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
