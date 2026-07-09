export const SIGNAL_META: Record<string, { color: string; bg: string; border: string; icon: string; label: string }> = {
  OI_SPIKE:       { color: 'text-orange-400', bg: 'bg-orange-950/40', border: 'border-orange-800/50', icon: '🔥', label: 'OI Spike' },
  FRESH_BUILD:    { color: 'text-emerald-400',bg: 'bg-emerald-950/40',border: 'border-emerald-800/50',icon: '🌱', label: 'Fresh Build' },
  LONG_BUILDUP:   { color: 'text-emerald-400',bg: 'bg-emerald-950/40',border: 'border-emerald-800/50',icon: '🐂', label: 'Long Buildup' },
  SHORT_BUILDUP:  { color: 'text-red-400',    bg: 'bg-red-950/40',    border: 'border-red-800/50',    icon: '🐻', label: 'Short Buildup' },
  CALL_WRITING:   { color: 'text-red-400',    bg: 'bg-red-950/40',    border: 'border-red-800/50',    icon: '✍️', label: 'Call Writing' },
  PUT_WRITING:    { color: 'text-emerald-400',bg: 'bg-emerald-950/40',border: 'border-emerald-800/50',icon: '✍️', label: 'Put Writing' },
  SHORT_COVERING: { color: 'text-cyan-400',   bg: 'bg-cyan-950/40',   border: 'border-cyan-800/50',   icon: '🔄', label: 'Short Covering' },
  LONG_UNWINDING: { color: 'text-amber-400',  bg: 'bg-amber-950/40',  border: 'border-amber-800/50',  icon: '⚠️', label: 'Long Unwinding' },
  VOLUME_SURGE:   { color: 'text-blue-400',   bg: 'bg-blue-950/40',   border: 'border-blue-800/50',   icon: '⚡', label: 'Volume Surge' },
}

export const DEFAULT_META = { color: 'text-gray-400', bg: 'bg-gray-900/40', border: 'border-gray-800', icon: '🔔', label: 'Alert' }
