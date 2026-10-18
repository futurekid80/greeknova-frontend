// Oct 14 2026: the dashboard-consolidation first pass. Every existing page
// in the app gets one entry here instead of being scattered across 6
// overlapping Navbar dropdowns (several pages were listed 2-3x before this).
// Nothing here deletes or moves a page -- every href below still works
// exactly as it did. This is purely a new, optional front door: /dashboard
// groups them into 4 destinations and lets each signed-in user pick which
// tiles they see, stored per-user in Supabase (dashboard_prefs), not
// localStorage, so the choice follows them across devices.
//
// `defaultEnabled: true` is the deliberately small starter set a brand-new
// signup sees before they've touched anything -- everything else exists and
// is one click away in "Customize", just not pre-selected. This is a first
// categorization, not a final one: Manish should treat the destination
// assignments and defaults as easy to move around, not as settled fact.
export type Destination = 'overview' | 'gamma-greeks' | 'option-sellers' | 'alerts'

export interface Widget {
  key: string
  label: string
  description: string
  href: string
  destination: Destination
  defaultEnabled: boolean
}

export const DESTINATIONS: { id: Destination; label: string; icon: string }[] = [
  { id: 'overview',       label: 'Overview & Positional', icon: '📡' },
  { id: 'gamma-greeks',   label: 'Gamma & Greeks',        icon: 'Θ' },
  { id: 'option-sellers', label: 'Option Sellers',        icon: '🧭' },
  { id: 'alerts',         label: 'Alerts & Scanners',     icon: '🔔' },
]

export const WIDGETS: Widget[] = [
  // ── Overview & Positional ────────────────────────────────────────────
  { key: 'market-pulse',       label: 'Market Pulse',            description: 'Index cards, breadth, CPR — the homepage',            href: '/',                     destination: 'overview', defaultEnabled: true },
  { key: 'positional-intel',   label: 'Positional Intelligence',  description: 'Stealth Buildup / Elite Setups, conviction tiers',    href: '/positional',           destination: 'overview', defaultEnabled: true },
  { key: 'premarket',          label: 'Pre-Market Brief',         description: 'Pre-open summary and prior-day EOD intelligence',     href: '/premarket',            destination: 'overview', defaultEnabled: true },
  { key: 'watchlist',          label: 'Watchlist',                description: 'Your saved symbols at a glance',                       href: '/watchlist',            destination: 'overview', defaultEnabled: false },
  { key: 'journal',            label: 'Journal',                  description: 'Your trading journal',                                 href: '/journal',              destination: 'overview', defaultEnabled: false },
  { key: 'price-chart',        label: 'Price Chart',              description: 'Candlestick chart for any symbol',                     href: '/stock-chart/NIFTY',    destination: 'overview', defaultEnabled: false },
  { key: 'oi-buildup-period',  label: 'Weekly/Monthly OI Buildup',description: 'OI buildup across weekly and monthly series',          href: '/oi-buildup-period',    destination: 'overview', defaultEnabled: false },
  { key: 'rollover',           label: 'Rollover Tracker',         description: 'Futures rollover percentages into next series',       href: '/rollover',             destination: 'overview', defaultEnabled: false },
  { key: 'delivery-confluence',label: 'Delivery Confluence',      description: 'FUT OI x cash delivery scoring',                       href: '/delivery-confluence',  destination: 'overview', defaultEnabled: false },
  { key: 'participant-flow',   label: 'Participant Flow',         description: 'FII/DII/Pro/Client participant-wise flow',            href: '/participant-flow',     destination: 'overview', defaultEnabled: false },
  { key: 'sector-strength',    label: 'Sector Strength',          description: 'Relative sector strength ranking',                     href: '/sector-strength',      destination: 'overview', defaultEnabled: false },
  { key: 'rel-strength',       label: 'Relative Strength',        description: 'Stock vs index relative strength',                     href: '/rs',                   destination: 'overview', defaultEnabled: false },
  { key: 'eod',                label: 'EOD Analysis',             description: 'End-of-day analysis',                                  href: '/eod',                  destination: 'overview', defaultEnabled: false },
  { key: 'eod-report',         label: 'EOD Report',               description: 'Formatted end-of-day report',                         href: '/eod-report',           destination: 'overview', defaultEnabled: false },
  { key: 'confluence',         label: 'Signal Confluence',        description: 'Multiple signals agreeing on one symbol',             href: '/confluence',           destination: 'overview', defaultEnabled: false },
  { key: 'first-hour-breakout',label: 'First Hour Breakout',      description: 'Opening-hour breakout scanner',                        href: '/first-hour-breakout',  destination: 'overview', defaultEnabled: false },

  // ── Gamma & Greeks ────────────────────────────────────────────────────
  { key: 'gamma-squeeze',      label: 'Gamma Squeeze',            description: 'Net GEX, flip point, wall velocity',                   href: '/gamma-squeeze',        destination: 'gamma-greeks', defaultEnabled: true },
  { key: 'iv-analysis',        label: 'IV Analysis',              description: 'IV percentile/rank across the F&O universe',          href: '/iv',                    destination: 'gamma-greeks', defaultEnabled: true },
  { key: 'vix',                label: 'VIX',                      description: 'India VIX level and trend',                            href: '/vix',                  destination: 'gamma-greeks', defaultEnabled: true },
  { key: 'gex-chart',          label: 'GEX Chart',                description: 'Gamma exposure by strike',                             href: '/gex-chart',            destination: 'gamma-greeks', defaultEnabled: false },
  { key: 'theta',              label: 'Theta Decay',              description: 'Theta decay exposure',                                 href: '/theta',                destination: 'gamma-greeks', defaultEnabled: false },
  { key: 'vega',               label: 'Vega Exposure',            description: 'Vega exposure and term structure',                     href: '/vega',                 destination: 'gamma-greeks', defaultEnabled: false },
  { key: 'session-replay',     label: 'Session Replay',           description: 'Replay a trading day’s GEX/DEX vs price',         href: '/session-replay',       destination: 'gamma-greeks', defaultEnabled: false },

  // ── Option Sellers ──────────────────────────────────────────────────
  { key: 'seller-screen',      label: 'Premium Screen',           description: 'Ranked seller-favorable conditions across stocks',    href: '/seller-screen',        destination: 'option-sellers', defaultEnabled: true },
  { key: 'optionchain',        label: 'Option Chain',             description: 'Live option chain for any symbol',                     href: '/optionchain',          destination: 'option-sellers', defaultEnabled: true },
  { key: 'strategy-builder',   label: 'Strategy Builder',         description: 'Build and price multi-leg option strategies',         href: '/strategy-builder',     destination: 'option-sellers', defaultEnabled: true },
  { key: 'straddle-chart',     label: 'Straddle Chart',           description: 'ATM straddle premium over time',                       href: '/straddle-chart',       destination: 'option-sellers', defaultEnabled: false },
  { key: 'maxpain',            label: 'Max Pain',                 description: 'Max pain strike by expiry',                            href: '/maxpain',              destination: 'option-sellers', defaultEnabled: false },
  { key: 'pcr',                label: 'PCR Trend',                description: 'Put-call ratio trend',                                 href: '/pcr',                  destination: 'option-sellers', defaultEnabled: false },
  { key: 'historicalchain',    label: 'Historical Chain',         description: 'Option chain snapshots over time',                     href: '/historicalchain',      destination: 'option-sellers', defaultEnabled: false },
  { key: 'oiprofile',          label: 'OI Profile',               description: 'OI distribution by strike',                            href: '/oiprofile',            destination: 'option-sellers', defaultEnabled: false },
  { key: 'oiheatmap',          label: 'OI Heatmap',               description: 'OI heatmap across strikes and expiries',               href: '/oiheatmap',            destination: 'option-sellers', defaultEnabled: false },
  { key: 'oihistory',          label: 'OI History',               description: 'Historical OI by strike',                              href: '/oihistory',            destination: 'option-sellers', defaultEnabled: false },
  { key: 'jungle',             label: 'Options Jungle',           description: 'Broad options activity scanner',                       href: '/jungle',               destination: 'option-sellers', defaultEnabled: false },
  { key: 'uoa',                label: 'UOA',                      description: 'Unusual options activity',                             href: '/uoa',                  destination: 'option-sellers', defaultEnabled: false },
  { key: 'custom-scanner',     label: 'Custom Scanner',           description: 'Build and save your own scan conditions',             href: '/custom-scanner',       destination: 'option-sellers', defaultEnabled: false },
  { key: 'wall-migration',     label: 'Wall Migration',           description: 'OI wall convergence/migration scanner',                href: '/signals/wall-migration',destination: 'option-sellers', defaultEnabled: false },

  // ── Alerts & Scanners ─────────────────────────────────────────────────
  { key: 'alerts',             label: 'Alerts',                   description: 'Your live alert feed',                                 href: '/alerts',               destination: 'alerts', defaultEnabled: true },
  { key: 'volume',             label: 'Volume Scanner',           description: 'Unusual volume scanner',                               href: '/volume',               destination: 'alerts', defaultEnabled: false },
  { key: 'spotvolume',         label: 'Spot Volume Breakout',     description: 'Cash-market volume breakout scanner',                  href: '/spotvolume',           destination: 'alerts', defaultEnabled: false },
  // Oct 18 2026: 'Trend Ignition' removed -- this route (/trend-ignition)
  // is entirely CommodityNova/MCX backend logic (commoditynova/mcx_*.py),
  // never an F&O feature -- it had been mistakenly offered here as if it
  // were a GreekNova scanner. Manish wants MCX hidden from discovery for
  // now (CUG backend scanning stays live for existing members).
  // Oct 15 2026: these two existed under the old "⚡ Intraday" nav group
  // (Intraday Futures Scanner, CPR Scanner) but got missed when every page
  // was given a widget entry here on Oct 14 -- with the old dropdown nav
  // retired, that left them with literally no link anywhere in the app. A
  // user flagged the intraday one missing entirely. defaultEnabled: true so
  // they reappear immediately for everyone rather than needing to be found
  // via Customize.
  { key: 'intraday-scanner',   label: 'Intraday Futures Scanner', description: 'Live futures OI/price scan, intraday',                 href: '/signals/intraday',     destination: 'alerts', defaultEnabled: true },
  { key: 'cpr-scanner',        label: 'CPR Scanner',              description: 'Central Pivot Range scan across the F&O universe',     href: '/signals/cpr',          destination: 'alerts', defaultEnabled: true },
  // Oct 16 2026: ADX+RSI+BB "3 Wolves" confluence scan, ported from
  // Manish's local Fyers Streamlit tool onto Kite data.
  { key: 'wolves-scanner',     label: 'Wolves Scanner',           description: 'ADX+RSI+BB confluence scan — Scout/Alpha/Apex tiers', href: '/wolves',               destination: 'alerts', defaultEnabled: true },
  // Oct 18 2026: 'Ask GreekNova' and 'OI Map' tiles removed -- both are
  // retired/never-linked pages (no entry in the Classic nav either) that
  // had slipped back in as selectable Dashboard tiles during the Oct 14
  // consolidation pass. Same precedent as oipulse below: page files left
  // in place, untouched, just no longer discoverable anywhere.
  // Oct 16 2026: oipulse's tile removed -- the page itself was retired when
  // Positional Radar -> Positional Intelligence replaced it (see
  // app/oipulse/page.tsx's own "do not edit, dead page" note). It was still
  // selectable here, so a user could add a dead tile to their dashboard.
]

export function widgetsByDestination(destination: Destination): Widget[] {
  return WIDGETS.filter(w => w.destination === destination)
}
