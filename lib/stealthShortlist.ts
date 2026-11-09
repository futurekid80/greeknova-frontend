// Nov 7 2026: "Buyer's shortlist" -- the few strikes worth a look, not the whole list. A strike makes it when it is
// Elite or Strong, has a clear Buying/Writing read, is still active, carries real money and is a meaningful slice of
// that stock's whole option chain; then only the strongest strike per stock and side is kept.
import { signalsMixed } from './stealthLabel'
const MIN_RS = 2_500_000        // Rs 25 lakh of premium added
const MIN_CHAIN_SHARE = 5       // % of the chain's open interest
const MIN_RS_NO_CHAIN = 10_000_000  // Rs 1 crore: used instead when the chain share is not available (e.g. saved rows after a restart)

type Row = {
  symbol: string; option_type: string; tier: string; activity?: string | null
  old_oi: number; new_oi: number; new_premium: number; premium_pct?: number | null
  chain_share_added?: number | null; money_added?: number; freshness?: string
}
const money = (h: Row) => h.money_added ?? Math.max(h.new_oi - h.old_oi, 0) * h.new_premium

// Nov 9 2026: a row whose label and premium direction disagree is left out (requireAgree, on by default).
export function buyerShortlist<T extends Row>(hits: T[], isUnclear: (h: T) => boolean, requireAgree = true): T[] {
  const best = new Map<string, T>()
  for (const h of hits) {
    if (h.tier !== 'ELITE' && h.tier !== 'STRONG') continue
    if (h.activity !== 'BUYING' && h.activity !== 'WRITING') continue
    if (h.freshness === 'Seen Earlier Today') continue
    if (isUnclear(h)) continue
    if (requireAgree && signalsMixed(h.activity, h.premium_pct)) continue
    if (money(h) < MIN_RS) continue
    if (h.chain_share_added == null) { if (money(h) < MIN_RS_NO_CHAIN) continue }
    else if (h.chain_share_added < MIN_CHAIN_SHARE) continue
    const k = `${h.symbol}|${h.option_type}|${h.activity}`
    const cur = best.get(k)
    if (!cur || money(h) > money(cur)) best.set(k, h)
  }
  return Array.from(best.values()).sort((a, b) => money(b) - money(a))
}
