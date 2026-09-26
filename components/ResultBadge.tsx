export default function ResultBadge({ days, beforeExpiry }: { days?: number | null; beforeExpiry?: boolean | null }) {
  if (days === null || days === undefined || days < 0) return null
  const label = days === 0 ? 'Results today' : days === 1 ? 'Results tomorrow' : `Results in ${days}d`
  const hot = beforeExpiry || days <= 3
  return (
    <span
      title={beforeExpiry ? 'Results are due before this expiry: expect an IV jump before and an IV drop after' : 'Results date (NSE board meeting calendar)'}
      className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap border ${hot ? 'bg-amber-950/40 text-amber-400 border-amber-800/60' : 'bg-gray-900 text-gray-400 border-gray-700'}`}
    >
      📅 {label}
    </span>
  )
}
