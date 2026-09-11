'use client'
import type { CasRow } from '@/lib/useCasIndicative'

/** Blinking indicative-close price tile, shown only while CAS is live and
 * a row exists for this symbol. Falls back to nothing so callers can show
 * their normal CMP otherwise. */
export default function CasIndicativePrice({ row }: { row: CasRow }) {
  const up = (row.chg_pct ?? 0) >= 0
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-fuchsia-400 opacity-75"/>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-fuchsia-500"/>
      </span>
      <span className={`text-sm font-black ${up ? 'text-emerald-400' : 'text-red-400'}`}>
        ₹{row.indicative_price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
      </span>
      {row.chg_pct !== null && (
        <span className={`text-[10px] font-bold ${up ? 'text-emerald-500' : 'text-red-500'}`}>
          {up ? '+' : ''}{row.chg_pct}%
        </span>
      )}
      <span className="text-[9px] uppercase tracking-wide text-fuchsia-400/80 font-bold">CAS</span>
    </span>
  )
}
