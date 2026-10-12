'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import ResultBadge from '@/components/ResultBadge'

const API = 'https://api.greeknova.com'

type Row = {
  symbol: string
  cmp: number
  days_to_expiry: number
  regime?: 'LONG_GAMMA' | 'SHORT_GAMMA' | null
  pct_to_flip?: number | null
  atm_iv?: number | null
  realized_vol?: number | null
  iv_rv_ratio?: number | null
  iv_month?: number | null
  iv_month_expiry?: string | null
  term_ratio?: number | null
  term_state?: 'FRONT_SPIKE' | 'FRONT_CHEAP' | 'NORMAL' | null
  iv_basis?: 'month' | 'near' | null
  iv_rv_basis?: number | null
  iv_regime?: 'RICH' | 'FAIR' | 'CHEAP' | null
  atm_theta_pct?: number | null
  atm_theta_per_lot?: number | null
  atm_vega_per_lot?: number | null
  iv_crush_watch?: boolean | null
  theta_peak_strike?: number | null
  iv_pctile?: number | null
  iv_hist_days?: number | null
  iv_pctile_basis?: 'iv_history' | 'realized_range' | null
  em_pct?: number | null
  em_low?: number | null
  em_high?: number | null
  call_1sd_strike?: number | null
  call_1sd_prob_itm?: number | null
  call_1sd_per_lot?: number | null
  put_1sd_strike?: number | null
  put_1sd_prob_itm?: number | null
  put_1sd_per_lot?: number | null
  atm_oi_lots?: number | null
  atm_vol_lots?: number | null
  liq_thin?: boolean | null
  result_date?: string | null
  days_to_result?: number | null
  result_before_expiry?: boolean | null
  call_wall_strike?: number | null
  call_wall_gamma_oi?: number | null
  put_wall_strike?: number | null
  put_wall_gamma_oi?: number | null
  pct_to_call_wall?: number | null
  pct_to_put_wall?: number | null
  strike_ladder?: StrikeRung[] | null
  // Range Confidence raw inputs (Oct 12 2026) — see scoreRow() for how
  // these combine into rScore. Raw, not pre-blended, so the weighting can
  // be tuned here without a backend redeploy, same as vScore/tScore/gScore.
  vix_change_pct?: number | null
  or_status?: 'INSIDE' | 'ABOVE' | 'BELOW' | null
  or_pct_outside?: number | null
  oi_skew_pct?: number | null
  ce_oi_chg_pct?: number | null
  pe_oi_chg_pct?: number | null
  max_pain_now?: number | null
  max_pain_open?: number | null
  max_pain_drift_confirms?: boolean | null
}

type StrikeRung = {
  strike: number
  is_atm: boolean
  is_call_wall: boolean
  is_put_wall: boolean
  call_oi?: number | null
  call_oi_trend_label?: 'BUILDING' | 'STEADY' | 'UNWINDING' | null
  call_oi_trend_pct?: number | null
  put_oi?: number | null
  put_oi_trend_label?: 'BUILDING' | 'STEADY' | 'UNWINDING' | null
  put_oi_trend_pct?: number | null
}

type Scored = Row & { score: number; vScore: number; tScore: number; gScore: number; rScore: number; rReasons: string[] }
type SortKey = 'symbol' | 'score' | 'days_to_expiry' | 'iv_rv_ratio' | 'atm_theta_pct' | 'atm_theta_per_lot' | 'atm_vega_per_lot' | 'pct_to_flip' | 'iv_pctile' | 'em_pct' | 'atm_vol_lots' | 'term_ratio' | 'rScore'

const fmt = (n: number | null | undefined, d = 2) =>
  n === null || n === undefined ? '—' : n.toLocaleString('en-IN', { maximumFractionDigits: d, minimumFractionDigits: d })
const clamp = (x: number) => Math.max(0, Math.min(1, x))

// Is the writer actually still defending this wall right now, or is it stale
// OI sitting from earlier in the day? BUILDING = fresh writing reinforcing it
// (the setup the "PE wall = long" read depends on), UNWINDING = the wall is
// being abandoned and shouldn't be trusted as support/resistance any more.
function wallTrend(r: Row, strike: number | null | undefined, side: 'PE' | 'CE') {
  if (!strike || !r.strike_ladder) return null
  const rung = r.strike_ladder.find((x) => x.strike === strike)
  if (!rung) return null
  const label = side === 'PE' ? rung.put_oi_trend_label : rung.call_oi_trend_label
  const pct = side === 'PE' ? rung.put_oi_trend_pct : rung.call_oi_trend_pct
  if (!label) return null
  return { label, pct }
}

// Wall quality (Oct 12 2026): an OI wall only works as a real boundary if
// it sits OUTSIDE the stock's own 1SD expected move -- a wall inside that
// band can be reached by an perfectly ordinary move, so treating it as
// "safe to sell at" is the mistake a raw OI-concentration pick can make.
function insideExpectedMove(
  wallStrike: number | null | undefined,
  emLow: number | null | undefined,
  emHigh: number | null | undefined,
  side: 'CE' | 'PE'
): boolean | null {
  if (!wallStrike || emLow === null || emLow === undefined || emHigh === null || emHigh === undefined) return null
  return side === 'CE' ? wallStrike < emHigh : wallStrike > emLow
}

// Inverted wall (Oct 12 2026): a put wall is support, so it should sit BELOW
// spot; a call wall is resistance, so it should sit ABOVE spot. The wall
// picker only chases gamma-weighted OI concentration with no such ordering
// constraint, so on a thin or fast-moving name the "support" can end up
// above price and the "resistance" below it -- not just a thin safety
// margin (insideExpectedMove) but backwards. Worth a sharper flag than
// "weak" since reading it as conventional support/resistance is wrong, not
// just close.
function invertedWall(wallStrike: number | null | undefined, cmp: number, side: 'CE' | 'PE'): boolean {
  if (!wallStrike) return false
  return side === 'PE' ? wallStrike > cmp : wallStrike < cmp
}

function strategyLink(r: Row) {
  const params = new URLSearchParams({ symbol: r.symbol })
  if (r.call_wall_strike) params.set('sellCE', String(r.call_wall_strike))
  if (r.put_wall_strike) params.set('sellPE', String(r.put_wall_strike))
  return `/strategy-builder?${params.toString()}`
}

function exportCsv(list: (Scored & { verdict: Verdict })[], totalRows: number, filterSummary: string) {
  const headers = [
    'Symbol', 'CMP', 'Verdict', 'Score', 'DTE', 'IV/RV', 'Decay %/day', 'IV Percentile', '1SD Move %',
    'Gamma Regime', 'To Flip %',
    'Put Wall (support)', 'Put Wall Quality', 'Call Wall (resistance)', 'Call Wall Quality',
    'Call Beyond 1SD Strike', 'Call Beyond 1SD Prob ITM %', 'Call Beyond 1SD Premium/Lot',
    'Put Beyond 1SD Strike', 'Put Beyond 1SD Prob ITM %', 'Put Beyond 1SD Premium/Lot',
    'Range Score', 'Range Flags',
  ]
  const rows = list.map((r) => {
    const putWeak = insideExpectedMove(r.put_wall_strike, r.em_low, r.em_high, 'PE')
    const callWeak = insideExpectedMove(r.call_wall_strike, r.em_low, r.em_high, 'CE')
    const putInverted = invertedWall(r.put_wall_strike, r.cmp, 'PE')
    const callInverted = invertedWall(r.call_wall_strike, r.cmp, 'CE')
    const wallLabel = (weak: boolean | null, inverted: boolean) =>
      inverted ? 'INVERTED (wrong side of spot)' : weak === null ? '' : weak ? 'Inside 1SD' : 'Outside 1SD'
    return [
      r.symbol, r.cmp, r.verdict.label, r.score, r.days_to_expiry,
      r.iv_rv_basis ?? r.iv_rv_ratio ?? '', r.atm_theta_pct ?? '', r.iv_pctile ?? '', r.em_pct ?? '',
      r.regime ?? '', r.pct_to_flip ?? '', r.put_wall_strike ?? '',
      wallLabel(putWeak, putInverted),
      r.call_wall_strike ?? '',
      wallLabel(callWeak, callInverted),
      r.call_1sd_strike ?? '', r.call_1sd_prob_itm ?? '', r.call_1sd_per_lot ?? '',
      r.put_1sd_strike ?? '', r.put_1sd_prob_itm ?? '', r.put_1sd_per_lot ?? '',
      Math.round(r.rScore * 100), r.rReasons.join('; '),
    ]
  })
  // Leading comment row (Oct 12 2026): an export that silently reflects
  // whatever filters happen to be active, with no record of it in the file
  // itself, reads like a data gap later -- "218 vs 168 instruments, why?"
  // is unanswerable from the CSV alone otherwise.
  const coverageLine = [`# Exported ${list.length} of ${totalRows} total instruments scanned. Active filters: ${filterSummary || 'none'}.`]
  const lines = [coverageLine, headers, ...rows].map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `greeknova-seller-screen-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// Range Confidence (Oct 12 2026): separate from vScore/tScore/gScore on
// purpose -- those answer "is premium rich enough to sell," this answers
// "is today's move going to hold a direction long enough to breach my
// strikes," which is a different question a non-directional seller needs
// answered regardless of how rich premium looks. Starts at full confidence
// (1.0) and each real-world red flag subtracts from it, rather than
// building up from zero -- a day with no data for a signal yet (early
// morning, say) should read as "no reason for concern yet," not "unscored."
function rangeScore(r: Row): { rScore: number; rReasons: string[] } {
  const reasons: string[] = []
  let score = 1.0

  if (r.vix_change_pct !== null && r.vix_change_pct !== undefined) {
    if (r.vix_change_pct >= 5) { score -= 0.35; reasons.push(`VIX up ${fmt(r.vix_change_pct, 1)}% today`) }
    else if (r.vix_change_pct >= 3) { score -= 0.2; reasons.push(`VIX up ${fmt(r.vix_change_pct, 1)}% today`) }
  }

  if (r.or_status === 'ABOVE' || r.or_status === 'BELOW') {
    const mag = r.or_pct_outside ?? 0
    score -= clamp(mag / 1.5) * 0.3
    reasons.push(`Price broke ${r.or_status === 'ABOVE' ? 'above' : 'below'} the opening range and hasn't reclaimed it`)
  }

  if (r.oi_skew_pct !== null && r.oi_skew_pct !== undefined && Math.abs(r.oi_skew_pct) >= 40) {
    score -= 0.15
    reasons.push(`${r.oi_skew_pct > 0 ? 'Call' : 'Put'} OI building much faster than the other side today`)
  }

  if (r.max_pain_drift_confirms) {
    score -= 0.2
    reasons.push('Max pain is crawling with price — fresh positioning, not just OI decay')
  }

  if (r.days_to_expiry !== null && r.days_to_expiry !== undefined && r.days_to_expiry <= 1) {
    score = Math.min(score, 0.6)
    reasons.push(`Only ${r.days_to_expiry} day(s) to expiry — gamma is strike-concentrated, regime read is less stable`)
  }

  return { rScore: clamp(score), rReasons: reasons }
}

function scoreRow(r: Row): Scored {
  // Vega: IV richer than realized vol scores higher (ratio 0.9 -> 0, 1.8 -> 1)
  const ratio = r.iv_rv_basis ?? r.iv_rv_ratio
  const ratioScore = ratio ? clamp((ratio - 0.9) / 0.9) : 0
  // Blend with the stock's own IV percentile (when enough history) so a naturally high-IV stock is not always "rich"
  const vScore = r.iv_pctile !== null && r.iv_pctile !== undefined ? (ratioScore + r.iv_pctile / 100) / 2 : ratioScore
  // Theta: faster ATM decay scores higher (0.5%/day -> 0, 6%/day -> 1)
  // Decay %/day rises naturally as expiry nears (about 50 / days-to-expiry for an ATM straddle), so compare
  // it with that norm. 1.0 = normal for this expiry distance, so a stock only scores if it decays faster than normal.
  const norm = r.atm_theta_pct ? (r.atm_theta_pct * Math.max(r.days_to_expiry, 1)) / 50 : 0
  const tScore = norm ? clamp((norm - 0.8) / 0.6) : 0
  // Gamma: long gamma is calmer; short gamma scores low; a flip level close to spot reduces it
  let gScore = r.regime === 'LONG_GAMMA' ? 1 : 0
  if (gScore && r.pct_to_flip !== null && r.pct_to_flip !== undefined && Math.abs(r.pct_to_flip) < 1.5) gScore = 0.5
  // Front premium: near-expiry IV rich versus next-month IV adds up to 8 points, a cheap front takes up to 8 away
  const adj = r.term_ratio ? Math.max(-1, Math.min(1, (r.term_ratio - 1) / 0.3)) * 8 : 0
  const score = Math.max(0, Math.min(100, Math.round(vScore * 45 + tScore * 20 + gScore * 35 + adj)))
  const { rScore, rReasons } = rangeScore(r)
  return { ...r, score, vScore, tScore, gScore, rScore, rReasons }
}

const INDEX_SYMBOLS = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY', 'SENSEX']

function rVerdict(rScore: number): { label: string; action: string; cls: string; emoji: string } {
  if (rScore >= 0.7) return { label: 'Range holding', action: 'Normal sizing for non-directional positions', cls: 'bg-emerald-950/40 text-emerald-300 border-emerald-900/50', emoji: '🟢' }
  if (rScore >= 0.4) return { label: 'Range wobbling', action: 'Reduce size on fresh non-directional entries; tighten stops on existing ones', cls: 'bg-amber-950/40 text-amber-300 border-amber-900/50', emoji: '🟡' }
  return { label: 'Range at risk', action: 'Avoid fresh non-directional entries; consider trimming existing ones toward breakeven', cls: 'bg-red-950/40 text-red-300 border-red-900/50', emoji: '🔴' }
}

type Verdict = {
  type: 'sellers' | 'buyers' | 'event' | 'caution' | 'neutral'
  label: string
  emoji: string
  reason: string
  cls: string
}

function verdictFor(r: Scored): Verdict {
  if (r.result_before_expiry) {
    return {
      type: 'event', emoji: '🟠', label: 'Event risk',
      reason: `Results due in ${r.days_to_result ?? '?'} day(s), before this expiry — expect IV swings around the announcement, in either direction.`,
      cls: 'bg-orange-950/40 text-orange-300 border-orange-900/50',
    }
  }
  if (r.liq_thin) {
    return {
      type: 'caution', emoji: '⚪', label: 'Caution: thin liquidity',
      reason: 'Low ATM volume at this strike — fills may be poor and spreads wide. Trade smaller size or use limit orders.',
      cls: 'bg-gray-800/60 text-gray-300 border-gray-700',
    }
  }
  // Flip is judged against the stock's own 1SD expected move (em_pct), not a flat number: close to
  // expiry every stock's flip level sits near spot, so a fixed percent flags almost everything. A flip
  // that is closer than roughly a third of a stock's own typical move to expiry is the one worth a flag.
  const flipBand = r.em_pct ? r.em_pct * 0.35 : 1.5
  if (r.pct_to_flip !== null && r.pct_to_flip !== undefined && Math.abs(r.pct_to_flip) < flipBand) {
    return {
      type: 'caution', emoji: '⚪', label: 'Caution: near gamma flip',
      reason: `The flip level is only ${fmt(r.pct_to_flip)}% away, closer than this stock's own expected move to expiry (${r.em_pct ? fmt(r.em_pct) : '—'}%) — a small move here can shift dealer hedging from calming moves to amplifying them.`,
      cls: 'bg-gray-800/60 text-gray-300 border-gray-700',
    }
  }
  const reasons: string[] = []
  let sellCount = 0, buyCount = 0
  if (r.vScore >= 0.6) { sellCount++; reasons.push('IV is rich versus realized moves') }
  if (r.vScore <= 0.3) { buyCount++; reasons.push('IV is cheap versus realized moves') }
  if (r.tScore >= 0.6) { sellCount++; reasons.push('decay is faster than normal for this expiry') }
  if (r.gScore >= 1) { sellCount++; reasons.push('long gamma keeps moves calmer') }
  if (r.regime === 'SHORT_GAMMA') { buyCount++; reasons.push('short gamma can amplify moves') }
  if (r.term_state === 'FRONT_SPIKE') { sellCount++; reasons.push('near-expiry IV is rich versus next month') }
  if (r.term_state === 'FRONT_CHEAP') { buyCount++; reasons.push('near-expiry IV is cheap versus next month') }

  if (sellCount >= 2 && sellCount > buyCount) {
    return { type: 'sellers', emoji: '🟢', label: 'Favors sellers', reason: reasons.slice(0, 2).join('; ') + '.', cls: 'bg-emerald-950/40 text-emerald-300 border-emerald-900/50' }
  }
  if (buyCount >= 2 && buyCount > sellCount) {
    return { type: 'buyers', emoji: '🔵', label: 'Favors buyers', reason: reasons.slice(0, 2).join('; ') + '.', cls: 'bg-sky-950/40 text-sky-300 border-sky-900/50' }
  }
  return {
    type: 'neutral', emoji: '⚪', label: 'Neutral / mixed',
    reason: reasons.length ? reasons.slice(0, 2).join('; ') + '.' : 'No strong signal either way right now.',
    cls: 'bg-gray-800/60 text-gray-400 border-gray-700',
  }
}

export default function SellerScreenPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [asOf, setAsOf] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [minIvRv, setMinIvRv] = useState(0)
  const [minDecay, setMinDecay] = useState(0)
  const [maxDte, setMaxDte] = useState(30)
  const [minPctile, setMinPctile] = useState(0)
  const [maxPctile, setMaxPctile] = useState(100)
  const [minDte, setMinDte] = useState(0)
  const [maxEmPct, setMaxEmPct] = useState(100)
  const [minRangeScore, setMinRangeScore] = useState(0)
  const [minFlipDist, setMinFlipDist] = useState(0)
  const [hideWeakWalls, setHideWeakWalls] = useState(false)
  const [preset, setPreset] = useState<'NONE' | 'CONSERVATIVE' | 'BALANCED' | 'PREMIUM'>('NONE')
  const [hideThin, setHideThin] = useState(false)
  const [noResults, setNoResults] = useState(false)
  const [more, setMore] = useState(false)
  const [gammaPref, setGammaPref] = useState<'ANY' | 'LONG' | 'SHORT'>('ANY')
  const [audience, setAudience] = useState<'ALL' | 'SELLERS' | 'BUYERS'>('ALL')
  const [sortKey, setSortKey] = useState<SortKey>('score')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API}/gamma-squeeze?t=${Date.now()}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`Server returned ${res.status}`)
      const j = await res.json()
      setRows(j.watchlist || [])
      setAsOf(j.as_of ? `${j.date ? j.date + ' ' : ''}${j.as_of}` : '')
    } catch (e: any) {
      setError(e?.message || 'Failed to load data')
    }
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  // Three starting-point presets (Oct 12 2026), not empirically backtested
  // thresholds -- a quick way to go from "218 stocks" to "a short, defensible
  // list," with Balanced/Higher-premium trading safety margin for more
  // candidates. All individually editable afterward via Advanced filters.
  function applyPreset(p: 'CONSERVATIVE' | 'BALANCED' | 'PREMIUM') {
    setPreset(p)
    setSearch('')
    if (p === 'CONSERVATIVE') {
      setMinIvRv(1.25); setMinPctile(65); setMaxPctile(95); setMinDte(10); setMaxDte(25)
      setMinRangeScore(60); setMaxEmPct(6); setMinFlipDist(3); setGammaPref('LONG')
      setHideThin(true); setNoResults(true); setHideWeakWalls(true)
    } else if (p === 'BALANCED') {
      setMinIvRv(1.1); setMinPctile(50); setMaxPctile(100); setMinDte(7); setMaxDte(30)
      setMinRangeScore(45); setMaxEmPct(8); setMinFlipDist(2); setGammaPref('LONG')
      setHideThin(true); setNoResults(true); setHideWeakWalls(false)
    } else {
      setMinIvRv(1.0); setMinPctile(40); setMaxPctile(100); setMinDte(5); setMaxDte(35)
      setMinRangeScore(35); setMaxEmPct(12); setMinFlipDist(1); setGammaPref('ANY')
      setHideThin(false); setNoResults(false); setHideWeakWalls(false)
    }
  }
  function clearFilters() {
    setPreset('NONE')
    setMinIvRv(0); setMinDecay(0); setMaxDte(30); setMinPctile(0); setMaxPctile(100)
    setMinDte(0); setMinRangeScore(0); setMaxEmPct(100); setMinFlipDist(0)
    setHideThin(false); setNoResults(false); setGammaPref('ANY'); setHideWeakWalls(false)
  }

  const scored = useMemo(() => rows.map(scoreRow).map((s) => ({ ...s, verdict: verdictFor(s) })), [rows])

  const shown = useMemo(() => {
    const q = search.trim().toUpperCase()
    const list = scored.filter((r) => {
      if (q && !r.symbol.includes(q)) return false
      if (q) return true  // a typed search always shows the stock, whatever the number filters say
      if ((r.iv_rv_ratio ?? 0) < minIvRv) return false
      if ((r.atm_theta_pct ?? 0) < minDecay) return false
      if (r.days_to_expiry > maxDte) return false
      if (minPctile > 0 && (r.iv_pctile ?? -1) < minPctile) return false
      if (maxPctile < 100 && (r.iv_pctile ?? 101) > maxPctile) return false
      if (minDte > 0 && r.days_to_expiry < minDte) return false
      if (maxEmPct < 100 && (r.em_pct ?? 0) > maxEmPct) return false
      if (minRangeScore > 0 && r.rScore * 100 < minRangeScore) return false
      if (minFlipDist > 0 && (r.pct_to_flip === null || r.pct_to_flip === undefined || Math.abs(r.pct_to_flip) < minFlipDist)) return false
      if (hideWeakWalls) {
        const callWeak = insideExpectedMove(r.call_wall_strike, r.em_low, r.em_high, 'CE')
        const putWeak = insideExpectedMove(r.put_wall_strike, r.em_low, r.em_high, 'PE')
        if (callWeak || putWeak) return false
      }
      if (hideThin && r.liq_thin) return false
      if (noResults && r.result_before_expiry) return false
      if (gammaPref === 'LONG' && r.regime !== 'LONG_GAMMA') return false
      if (gammaPref === 'SHORT' && r.regime !== 'SHORT_GAMMA') return false
      if (audience === 'SELLERS' && r.verdict.type === 'buyers') return false
      if (audience === 'BUYERS' && r.verdict.type === 'sellers') return false
      return true
    })
    const dir = sortDir === 'asc' ? 1 : -1
    return [...list].sort((a, b) => {
      if (sortKey === 'symbol') return a.symbol.localeCompare(b.symbol) * dir
      const av = (a as any)[sortKey]
      const bv = (b as any)[sortKey]
      if (av === null || av === undefined) return 1
      if (bv === null || bv === undefined) return -1
      return (av - bv) * dir
    })
  }, [scored, search, minIvRv, minDecay, maxDte, minPctile, maxPctile, minDte, maxEmPct, minRangeScore, minFlipDist, hideWeakWalls, hideThin, noResults, gammaPref, audience, sortKey, sortDir])

  const filterSummary = useMemo(() => {
    const parts: string[] = []
    if (search.trim()) parts.push(`search="${search.trim()}"`)
    if (preset !== 'NONE') parts.push(`preset=${preset}`)
    if (minIvRv > 0) parts.push(`minIvRv=${minIvRv}`)
    if (minDecay > 0) parts.push(`minDecay=${minDecay}`)
    if (maxDte < 30) parts.push(`maxDte=${maxDte}`)
    if (minDte > 0) parts.push(`minDte=${minDte}`)
    if (minPctile > 0) parts.push(`minPctile=${minPctile}`)
    if (maxPctile < 100) parts.push(`maxPctile=${maxPctile}`)
    if (maxEmPct < 100) parts.push(`maxEmPct=${maxEmPct}`)
    if (minRangeScore > 0) parts.push(`minRangeScore=${minRangeScore}`)
    if (minFlipDist > 0) parts.push(`minFlipDist=${minFlipDist}`)
    if (hideWeakWalls) parts.push('hideWeakWalls')
    if (hideThin) parts.push('hideThin')
    if (noResults) parts.push('excludeResultsBeforeExpiry')
    if (gammaPref !== 'ANY') parts.push(`gamma=${gammaPref}`)
    if (audience !== 'ALL') parts.push(`audience=${audience}`)
    return parts.join(', ')
  }, [search, preset, minIvRv, minDecay, maxDte, minDte, minPctile, maxPctile, maxEmPct, minRangeScore, minFlipDist, hideWeakWalls, hideThin, noResults, gammaPref, audience])

  function sortBy(k: SortKey) {
    if (k === sortKey) setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    else { setSortKey(k); setSortDir(k === 'symbol' ? 'asc' : 'desc') }
  }
  const arrow = (k: SortKey) => (k === sortKey ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '')
  const th = 'px-3 py-3 text-right text-[11px] uppercase tracking-wide text-gray-500 font-semibold cursor-pointer select-none whitespace-nowrap hover:text-gray-300'
  const chip = (on: boolean) =>
    `px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${on ? 'bg-white text-gray-900 border-white' : 'bg-gray-900 text-gray-300 border-gray-800 hover:border-gray-600'}`
  const inp = 'bg-gray-900 border border-gray-800 rounded-lg px-2 py-1.5 text-xs text-gray-200 w-20'
  const dot = (v: number) => (v >= 0.66 ? 'text-emerald-400' : v >= 0.33 ? 'text-amber-400' : 'text-gray-600')

  return (
    <div className="min-h-screen bg-[#07070e] text-gray-200">
    <Navbar active="/seller-screen" />
    <div className="px-4 sm:px-8 py-8 max-w-[1500px] mx-auto">
      <div className="flex items-start justify-between flex-wrap gap-3 mb-2">
        <div>
          <h1 className="text-2xl font-black text-white">Premium Conditions Screen</h1>
          <p className="text-sm text-gray-500 mt-1">
            Gamma, Theta and Vega combined into a plain verdict for each stock — favors sellers, favors buyers, or a caution/event flag. Nearest active expiry.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportCsv(shown, rows.length, filterSummary)} className="px-4 py-2 rounded-lg border border-gray-700 text-sm text-gray-300 hover:border-gray-500">Export CSV</button>
          <button onClick={load} className="px-4 py-2 rounded-lg border border-gray-700 text-sm text-gray-300 hover:border-gray-500">Refresh</button>
        </div>
      </div>
      {asOf && <p className="text-xs text-gray-600 mb-1">As of {asOf} IST · scores are a data ranking, not a recommendation</p>}
      <p className="text-xs text-gray-600 mb-5">Within 7 days of expiry, IV/RV and IV percentile use next-month IV (marked M) so they stay comparable. The Term column compares near-expiry IV with month IV, so a front-month spike is never hidden.</p>

      {error && <div className="mb-4 bg-red-950/30 border border-red-800/40 rounded-xl px-4 py-3 text-sm text-red-400">{error}</div>}
      {loading && <p className="text-gray-500 text-sm">Loading…</p>}

      {!loading && !error && rows.length > 0 && (() => {
        const indexRows = scored.filter((r) => INDEX_SYMBOLS.includes(r.symbol))
        const worst = indexRows.length ? indexRows.reduce((a, b) => (b.rScore < a.rScore ? b : a)) : null
        const v = worst ? rVerdict(worst.rScore) : null
        return (
        <>
          {worst && v && (
            <div className={`rounded-xl border px-5 py-4 mb-5 ${v.cls}`}>
              <div className="flex items-start justify-between flex-wrap gap-2">
                <div>
                  <p className="font-bold text-base">{v.emoji} {v.label} — {worst.symbol} ({fmt(worst.rScore * 100, 0)}/100)</p>
                  <p className="text-sm mt-1 opacity-90">{v.action}</p>
                  {worst.rReasons.length > 0 && (
                    <p className="text-xs mt-2 opacity-75">{worst.rReasons.join(' · ')}</p>
                  )}
                </div>
                <p className="text-[11px] opacity-60 whitespace-nowrap">Range Confidence · not a recommendation, a data read</p>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2 flex-wrap mb-3">
            <span className="text-[11px] text-gray-500 mr-1">Show for:</span>
            <button className={chip(audience === 'ALL')} onClick={() => setAudience('ALL')}>Everyone</button>
            <button className={chip(audience === 'SELLERS')} onClick={() => setAudience('SELLERS')}>🟢 Sellers</button>
            <button className={chip(audience === 'BUYERS')} onClick={() => setAudience('BUYERS')}>🔵 Buyers</button>
          </div>

          <div className="flex items-center gap-2 flex-wrap mb-3">
            <span className="text-[11px] text-gray-500 mr-1">Presets:</span>
            <button className={chip(preset === 'CONSERVATIVE')} onClick={() => applyPreset('CONSERVATIVE')} title="IV/RV ≥1.25 · IV pctile 65–95 · DTE 10–25 · Range ≥60 · 1SD ≤6% · flip ≥3% away · long gamma · liquid · no pre-expiry results · walls outside 1SD only">Conservative</button>
            <button className={chip(preset === 'BALANCED')} onClick={() => applyPreset('BALANCED')} title="IV/RV ≥1.1 · IV pctile ≥50 · DTE 7–30 · Range ≥45 · 1SD ≤8% · flip ≥2% away · long gamma · liquid · no pre-expiry results">Balanced</button>
            <button className={chip(preset === 'PREMIUM')} onClick={() => applyPreset('PREMIUM')} title="IV/RV ≥1.0 · IV pctile ≥40 · DTE 5–35 · Range ≥35 · 1SD ≤12% · flip ≥1% away · any gamma — wider net, less safety margin">Higher premium</button>
            {preset !== 'NONE' && <button className="text-[11px] text-gray-500 hover:text-gray-300 underline" onClick={clearFilters}>Clear filters</button>}
            <span className="text-[11px] text-gray-600">Starting points, not backtested — tune in Advanced filters below.</span>
          </div>

          <div className="flex items-end gap-4 flex-wrap mb-4">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search stock"
              className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-1.5 text-sm text-gray-200 w-40" />
            <button className={chip(hideThin)} onClick={() => setHideThin(!hideThin)}>Hide thin liquidity</button>
            <button className={chip(noResults)} onClick={() => setNoResults(!noResults)}>Exclude results before expiry</button>
            <button className={chip(hideWeakWalls)} onClick={() => setHideWeakWalls(!hideWeakWalls)} title="Hide stocks whose put or call wall sits inside the stock's own 1SD expected move — a wall that close isn't a safety margin, an ordinary move can reach it">Hide weak walls</button>
            <div className="flex gap-2">
              <button className={chip(gammaPref === 'ANY')} onClick={() => setGammaPref('ANY')}>Any gamma</button>
              <button className={chip(gammaPref === 'LONG')} onClick={() => setGammaPref('LONG')}>Long gamma only</button>
              <button className={chip(gammaPref === 'SHORT')} onClick={() => setGammaPref('SHORT')}>Short gamma only</button>
            </div>
            <button className={chip(more)} onClick={() => setMore(!more)}>{more ? 'Fewer columns' : 'More columns'}</button>
            <span className="text-xs text-gray-500 pb-2">{shown.length} of {rows.length} stocks</span>
          </div>

          <details className="mb-4">
            <summary className="cursor-pointer text-[11px] text-gray-500 hover:text-gray-300">Advanced number filters</summary>
            <div className="flex items-end gap-4 flex-wrap mt-3">
              <label className="text-[11px] text-gray-500">Min IV/RV
                <input type="number" step="0.1" value={minIvRv} onChange={(e) => setMinIvRv(Number(e.target.value) || 0)} className={inp + ' block mt-1'} /></label>
              <label className="text-[11px] text-gray-500">Min decay %/day
                <input type="number" step="0.5" value={minDecay} onChange={(e) => setMinDecay(Number(e.target.value) || 0)} className={inp + ' block mt-1'} /></label>
              <label className="text-[11px] text-gray-500">Max days to expiry
                <input type="number" step="1" value={maxDte} onChange={(e) => setMaxDte(Number(e.target.value) || 0)} className={inp + ' block mt-1'} /></label>
              <label className="text-[11px] text-gray-500">Min IV percentile
                <input type="number" step="10" value={minPctile} onChange={(e) => setMinPctile(Number(e.target.value) || 0)} className={inp + ' block mt-1'} /></label>
              <label className="text-[11px] text-gray-500">Max IV percentile
                <input type="number" step="10" value={maxPctile} onChange={(e) => setMaxPctile(Number(e.target.value) || 100)} className={inp + ' block mt-1'} /></label>
              <label className="text-[11px] text-gray-500">Min days to expiry
                <input type="number" step="1" value={minDte} onChange={(e) => setMinDte(Number(e.target.value) || 0)} className={inp + ' block mt-1'} /></label>
              <label className="text-[11px] text-gray-500">Max 1SD move %
                <input type="number" step="0.5" value={maxEmPct} onChange={(e) => setMaxEmPct(Number(e.target.value) || 100)} className={inp + ' block mt-1'} /></label>
              <label className="text-[11px] text-gray-500" title="Minimum % distance between spot and the gamma flip level. Stocks with no flip-distance data are excluded when this is set above 0, not passed through as a free pass.">Min flip distance %
                <input type="number" step="0.5" value={minFlipDist} onChange={(e) => setMinFlipDist(Number(e.target.value) || 0)} className={inp + ' block mt-1'} /></label>
              <label className="text-[11px] text-gray-500" title="Minimum Range Confidence score (0-100) — is today's move likely to hold a direction long enough to breach strikes.">Min Range score
                <input type="number" step="5" value={minRangeScore} onChange={(e) => setMinRangeScore(Number(e.target.value) || 0)} className={inp + ' block mt-1'} /></label>
            </div>
          </details>

          <div className="overflow-x-auto rounded-xl border border-gray-800">
            <table className="w-full text-sm">
              <thead className="bg-gray-900/60">
                <tr>
                  <th className={th + ' !text-left'} onClick={() => sortBy('symbol')}>Stock{arrow('symbol')}</th>
                  <th className={th + ' !text-left'}>Verdict</th>
                  <th className={th} onClick={() => sortBy('score')}>Score{arrow('score')}</th>
                  <th className={th} onClick={() => sortBy('days_to_expiry')}>DTE{arrow('days_to_expiry')}</th>
                  <th className={th} onClick={() => sortBy('iv_rv_ratio')}>IV/RV (Vega){arrow('iv_rv_ratio')}</th>
                  <th className={th} onClick={() => sortBy('term_ratio')}>Term: near / month IV{arrow('term_ratio')}</th>
                  <th className={th} onClick={() => sortBy('atm_theta_pct')}>Decay %/day (Theta){arrow('atm_theta_pct')}</th>
                  {more && <th className={th} onClick={() => sortBy('atm_theta_per_lot')}>₹/lot/day{arrow('atm_theta_per_lot')}</th>}
                  {more && <th className={th} onClick={() => sortBy('atm_vega_per_lot')}>₹/lot per IV pt{arrow('atm_vega_per_lot')}</th>}
                  <th className={th} onClick={() => sortBy('iv_pctile')}>IV percentile{arrow('iv_pctile')}</th>
                  <th className={th} onClick={() => sortBy('em_pct')}>1SD move %{arrow('em_pct')}</th>
                  <th className={th}>Call beyond 1SD</th>
                  <th className={th}>Put beyond 1SD</th>
                  {more && <th className={th} onClick={() => sortBy('atm_vol_lots')}>ATM vol (lots){arrow('atm_vol_lots')}</th>}
                  <th className={th}>Gamma</th>
                  <th className={th} onClick={() => sortBy('rScore')} title="Is today's move likely to hold a direction long enough to breach your strikes? Combines VIX move (shared market-wide, so it can cap every stock on a high-VIX day), opening-range break, OI skew, max-pain drift and DTE — separate from the richness/decay/gamma score above.">Range{arrow('rScore')}</th>
                  <th className={th + ' !text-left'} title="Strikes carrying the most gamma-weighted OI on each side — candidates to research, not a recommendation to sell there. ✍️writing means fresh OI is still being added today (actively defended); ⚠stale means it's unwinding. ⚠1SD means the strike sits inside this stock's own expected move, no real safety margin. ⚠WRONG SIDE means the wall landed on the wrong side of spot entirely (a 'put wall' above price, say) — treat as a data flag, not support/resistance.">Candidate strikes</th>
                  <th className={th} onClick={() => sortBy('pct_to_flip')}>To flip %{arrow('pct_to_flip')}</th>
                  <th className={th + ' !text-left'}>Flags</th>
                  <th className={th + ' !text-left'}>Strategy</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.symbol} className="border-t border-gray-800/70 hover:bg-gray-900/40">
                    <td className="px-3 py-2 font-bold text-white whitespace-nowrap">{r.symbol}<span className="text-gray-600 text-[10px] ml-2">{fmt(r.cmp)}</span><ResultBadge days={r.days_to_result} beforeExpiry={r.result_before_expiry} /></td>
                    <td className="px-3 py-2.5 text-left whitespace-nowrap" title={r.verdict.reason}>
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold border ${r.verdict.cls}`}>{r.verdict.emoji} {r.verdict.label}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-black text-white">{r.score}</td>
                    <td className="px-3 py-2.5 text-right text-gray-400">{r.days_to_expiry}</td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap"><span className={dot(r.vScore)}>● </span>{fmt(r.iv_rv_basis ?? r.iv_rv_ratio)}{r.iv_basis === 'month' && <span className="text-sky-300 text-[10px] ml-1" title={`Judged on next-month IV (${r.iv_month_expiry || ''}) because expiry is within 7 days`}>M</span>}</td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap text-gray-300" title="Near-expiry ATM IV, next-month ATM IV and their ratio">
                      {r.term_ratio ? <>{fmt(r.term_ratio)}x<span className="text-gray-500 text-[10px] ml-1">{fmt(r.atm_iv, 1)} / {fmt(r.iv_month, 1)}</span></> : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right"><span className={dot(r.tScore)}>● </span>{fmt(r.atm_theta_pct)}</td>
                    {more && <td className="px-3 py-2.5 text-right text-gray-300">{fmt(r.atm_theta_per_lot, 0)}</td>}
                    {more && <td className="px-3 py-2.5 text-right text-gray-300">{fmt(r.atm_vega_per_lot, 0)}</td>}
                    <td className="px-3 py-2.5 text-right whitespace-nowrap" title={r.iv_pctile_basis === 'realized_range' ? 'Stand-in: today\'s IV ranked against this stock\'s own realized-volatility range over the past year, because its option history is still short' : r.iv_hist_days ? `Based on ${r.iv_hist_days} past sessions of this stock's own IV` : 'Not enough history yet'}>
                      {r.iv_pctile !== null && r.iv_pctile !== undefined ? <span className={r.iv_pctile_basis === 'realized_range' ? 'text-sky-300' : ''}>{r.iv_pctile_basis === 'realized_range' ? '~' : ''}{r.iv_pctile}</span> : '—'}
                      <span className="text-gray-600 text-[10px] ml-1">{r.iv_pctile_basis === 'realized_range' ? '(RV range)' : r.iv_hist_days ? `(${r.iv_hist_days}d)` : ''}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right text-gray-300" title={r.em_low && r.em_high ? `Range ${fmt(r.em_low)} to ${fmt(r.em_high)}` : ''}>{fmt(r.em_pct)}</td>
                    <td className="px-3 py-2.5 text-right text-gray-300 whitespace-nowrap">{r.call_1sd_strike ? <>{fmt(r.call_1sd_strike, 0)}<span className="text-gray-500 text-[10px] ml-1">{fmt(r.call_1sd_prob_itm, 0)}% · ₹{fmt(r.call_1sd_per_lot, 0)}</span></> : '—'}</td>
                    <td className="px-3 py-2.5 text-right text-gray-300 whitespace-nowrap">{r.put_1sd_strike ? <>{fmt(r.put_1sd_strike, 0)}<span className="text-gray-500 text-[10px] ml-1">{fmt(r.put_1sd_prob_itm, 0)}% · ₹{fmt(r.put_1sd_per_lot, 0)}</span></> : '—'}</td>
                    {more && <td className="px-3 py-2.5 text-right text-gray-400">{r.atm_vol_lots !== null && r.atm_vol_lots !== undefined ? fmt(r.atm_vol_lots, 0) : '—'}</td>}
                    <td className="px-3 py-2.5 text-right whitespace-nowrap"><span className={dot(r.gScore)}>● </span>{r.regime === 'LONG_GAMMA' ? 'Long' : r.regime === 'SHORT_GAMMA' ? 'Short' : '—'}</td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap" title={r.rReasons.length ? r.rReasons.join(' · ') : 'No range-risk flags right now'}>
                      <span className={dot(r.rScore)}>● </span>{Math.round(r.rScore * 100)}
                    </td>
                    <td className="px-3 py-2.5 text-left whitespace-nowrap text-[11px]">
                      {r.put_wall_strike ? (() => {
                        const t = wallTrend(r, r.put_wall_strike, 'PE')
                        const weak = insideExpectedMove(r.put_wall_strike, r.em_low, r.em_high, 'PE')
                        const inverted = invertedWall(r.put_wall_strike, r.cmp, 'PE')
                        return (
                          <span className={inverted ? 'text-red-400 font-bold' : 'text-emerald-400'} title={`Put wall — most gamma-weighted PE open interest${inverted ? '. WARNING: this strike is ABOVE current spot — it cannot be acting as support from below, treat as a data flag, not a trade level' : ', acting as support'}${r.pct_to_put_wall !== null && r.pct_to_put_wall !== undefined ? ` (${fmt(r.pct_to_put_wall)}% below spot)` : ''}${t ? ` — OI ${t.label.toLowerCase()}${t.pct !== null && t.pct !== undefined ? ` (${t.pct > 0 ? '+' : ''}${fmt(t.pct, 0)}%)` : ''} since day's open` : ''}${!inverted && weak ? ' — inside this stock\'s own 1SD expected move: an ordinary move can reach it, not a real safety margin' : ''}`}>
                            PE {fmt(r.put_wall_strike, 0)}
                            {t?.label === 'BUILDING' && <span className="ml-1 text-emerald-300">✍️writing</span>}
                            {t?.label === 'UNWINDING' && <span className="ml-1 text-amber-400">⚠stale</span>}
                            {inverted ? <span className="ml-1 text-red-400">⚠WRONG SIDE</span> : weak && <span className="ml-1 text-red-400">⚠1SD</span>}
                          </span>
                        )
                      })() : <span className="text-gray-600">—</span>}
                      {' / '}
                      {r.call_wall_strike ? (() => {
                        const t = wallTrend(r, r.call_wall_strike, 'CE')
                        const weak = insideExpectedMove(r.call_wall_strike, r.em_low, r.em_high, 'CE')
                        const inverted = invertedWall(r.call_wall_strike, r.cmp, 'CE')
                        return (
                          <span className={inverted ? 'text-red-400 font-bold' : 'text-sky-400'} title={`Call wall — most gamma-weighted CE open interest${inverted ? '. WARNING: this strike is BELOW current spot — it cannot be acting as resistance from above, treat as a data flag, not a trade level' : ', acting as resistance'}${r.pct_to_call_wall !== null && r.pct_to_call_wall !== undefined ? ` (${fmt(r.pct_to_call_wall)}% above spot)` : ''}${t ? ` — OI ${t.label.toLowerCase()}${t.pct !== null && t.pct !== undefined ? ` (${t.pct > 0 ? '+' : ''}${fmt(t.pct, 0)}%)` : ''} since day's open` : ''}${!inverted && weak ? ' — inside this stock\'s own 1SD expected move: an ordinary move can reach it, not a real safety margin' : ''}`}>
                            CE {fmt(r.call_wall_strike, 0)}
                            {t?.label === 'BUILDING' && <span className="ml-1 text-sky-300">✍️writing</span>}
                            {t?.label === 'UNWINDING' && <span className="ml-1 text-amber-400">⚠stale</span>}
                            {inverted ? <span className="ml-1 text-red-400">⚠WRONG SIDE</span> : weak && <span className="ml-1 text-red-400">⚠1SD</span>}
                          </span>
                        )
                      })() : <span className="text-gray-600">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right text-gray-400">{fmt(r.pct_to_flip)}</td>
                    <td className="px-3 py-2.5 text-left text-[10px] whitespace-nowrap">
                      {[
                        r.iv_crush_watch && 'IV crush',
                        r.term_state === 'FRONT_SPIKE' && 'Front spike',
                        r.term_state === 'FRONT_CHEAP' && 'Front cheap',
                        r.result_before_expiry && 'Results',
                        r.liq_thin && 'Thin',
                        r.regime === 'SHORT_GAMMA' && 'Short γ',
                        r.pct_to_flip !== null && r.pct_to_flip !== undefined && Math.abs(r.pct_to_flip) < 1.5 && 'Near flip',
                        r.days_to_expiry <= 5 && 'Delivery',
                        (invertedWall(r.put_wall_strike, r.cmp, 'PE') || invertedWall(r.call_wall_strike, r.cmp, 'CE')) && 'Inverted wall',
                        !invertedWall(r.put_wall_strike, r.cmp, 'PE') && !invertedWall(r.call_wall_strike, r.cmp, 'CE') &&
                          (insideExpectedMove(r.put_wall_strike, r.em_low, r.em_high, 'PE') || insideExpectedMove(r.call_wall_strike, r.em_low, r.em_high, 'CE')) && 'Weak wall',
                      ].filter(Boolean).map((f) => (
                        <span key={String(f)} className="mr-1 px-1.5 py-0.5 rounded bg-amber-950/40 text-amber-400 border border-amber-900/50">{f}</span>
                      ))}
                    </td>
                    <td className="px-3 py-2.5 text-left whitespace-nowrap">
                      <Link href={strategyLink(r)} className="px-2 py-1 rounded-md text-[11px] font-semibold border border-cyan-900/60 text-cyan-400 hover:bg-cyan-950/40">
                        🛠️ Build →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <details className="mt-6 rounded-lg border border-gray-800 bg-[#0c0c16] p-4 text-xs text-gray-400 leading-relaxed">
            <summary className="cursor-pointer text-gray-300 font-semibold">How the score works</summary>
            <ul className="mt-3 space-y-2 list-disc pl-5">
              <li><b>Verdict:</b> 🟢 Favors sellers means at least two of (IV rich vs realized, decay faster than normal, long gamma, front-month IV spike) point the same way, and it isn't already flagged below. 🔵 Favors buyers is the mirror case (IV cheap, short gamma, front-month IV cheap). 🟠 Event risk always takes priority when results fall before this expiry — IV can swing either way around the announcement, so it overrides the sell/buy read. ⚪ Caution flags thin liquidity or a gamma flip level closer than roughly a third of the stock's own expected move to expiry, both of which matter to buyers and sellers alike. ⚪ Neutral / mixed means the signals don't agree. Hover a verdict pill for the one-line reason. Use the Sellers/Buyers toggle above the table to hide rows that don't suit you (Event/Caution rows stay visible either way, since they're risk warnings for everyone).</li>
              <li><b>Vega (45 points):</b> how expensive options are versus what the stock actually moved (IV/RV of 0.9 scores zero, 1.8 or more scores full), blended with IV percentile, meaning how high today's IV is against this stock's own past readings.</li>
              <li><b>Month IV and Term:</b> the Term column shows near-expiry IV divided by next-month IV, with both IV values. Above 1.15 (Front spike) the front month is expensive relative to next month, which usually means an event or stress, and it adds up to 8 points. Below 0.85 (Front cheap) it takes points away. Within 7 days of expiry, IV/RV and the IV percentile are judged on next-month IV, shown with M, because a contract a few days from expiry is not comparable with a year of history. Decay, gamma and the 1SD columns still describe the near expiry.</li>
              <li><b>To flip %:</b> the distance from price to the gamma flip level. Negative means price is below the flip level and positive means above. Within 1.5% is tagged Near flip.</li>
              <li><b>IV percentile:</b> the share of past sessions with lower IV. The number in brackets is how many sessions it is based on. For stocks whose option history is still short, a blue number with a ~ and (RV range) is a stand-in: today's IV ranked against the range of realized volatility the stock has shown over the past year. It will switch to the true IV percentile as history builds.</li>
              <li><b>1SD move %:</b> the one-standard-deviation move the options imply until expiry. About two thirds of the time price is expected to finish inside that range. The Call and Put beyond 1SD columns show the first strike outside it, its probability of finishing in the money, and the premium per lot. Probabilities are model estimates from implied volatility.</li>
              <li><b>ATM vol (lots) and Thin liquidity:</b> options volume at the at-the-money strike. Thin means fills may be poor and spreads wide.</li>
              <li><b>Flags:</b> IV crush = rich IV with expiry within 10 days. Results = results date falls before expiry. Thin = low ATM liquidity. Short γ = short gamma, moves can amplify. Near flip = gamma flip within 1.5% of price. Delivery = expiry within 5 days, and stock options settle by delivery in India, so in-the-money positions carry delivery and higher margin implications. Weak wall = the put or call wall sits inside this stock's own 1SD expected move — an ordinary move can reach it, so it isn't acting as a real safety margin the way a wall outside the expected move would. Inverted wall = the "support" put wall landed above spot, or the "resistance" call wall landed below it — the OI-concentration pick has no built-in check that it lands on the sensible side of price, so this is a data flag to investigate, not a level to trade off.</li>
              <li><b>Range score and VIX:</b> the VIX-move penalty inside Range Confidence uses one shared, market-wide reading, the same for every stock that day — so on a day VIX is up sharply, it can cap most or all stocks at a similar ceiling regardless of how any individual stock is actually behaving. A cluster of stocks landing on the same Range score on such a day reflects that shared market factor, not a coincidence or a broken scale.</li>
              <li><b>Presets (Conservative / Balanced / Higher premium):</b> starting-point filter combinations across IV/RV, IV percentile, DTE, Range score, 1SD move, gamma-flip distance and gamma regime — not backtested thresholds, just a quicker way to go from 218 stocks to a short list. Every value they set is editable afterward in Advanced number filters.</li>
              <li><b>More columns:</b> adds ₹ per lot for decay and IV sensitivity, and ATM volume in lots.</li>
              <li><b>Theta (20 points):</b> whether the ATM straddle decays faster than is normal for how close expiry is. Decay %/day always rises near expiry, so being high in expiry week is normal and scores little on its own.</li>
              <li><b>Gamma (35 points):</b> long gamma (dealer hedging tends to dampen moves) scores full, halved when the gamma flip level is within 1.5% of price. Short gamma scores zero.</li>
              <li>Green dot means strong, amber means middling, grey means weak for that Greek.</li>
              <li>A high score means conditions that premium sellers typically look for are present. It says nothing about direction, event risk, margin or your position size. Always check results, news and open interest levels separately.</li>
              <li>Selling options carries unlimited-loss risk on the naked side. Use the sliders to build your own filter.</li>
            </ul>
          </details>

          <details className="mt-4 rounded-lg border border-gray-800 bg-[#0c0c16] p-4 text-xs text-gray-400 leading-relaxed">
            <summary className="cursor-pointer text-gray-300 font-semibold">Worked example: how to read one row</summary>
            <div className="mt-3 space-y-2">
              <p>Say a row shows <b>score 85, DTE 4, IV/RV 1.80, decay 12%/day, Gamma Long (amber), To flip -1.2%</b>, flags: IV crush watch, Near gamma flip.</p>
              <p><b>IV/RV 1.80:</b> options price in about 1.8 times the movement the stock actually delivered, so premium is rich.</p>
              <p><b>Decay 12%/day:</b> the ATM straddle loses about 12% of its value each day. High because expiry is near.</p>
              <p><b>Long gamma, amber dot:</b> dealer hedging tends to calm moves, but the flip level is only about 1.2% away. Crossing it can turn calm into amplified moves.</p>
              <p><b>Flags:</b> IV is rich with expiry close, so IV may fall after events. The flip is near, so a sharp move is possible.</p>
              <p><b>Takeaway:</b> conditions are present, but check the option chain, OI walls, news and results dates, and your own risk before any decision. Short gamma rows are the opposite case: moves can amplify, so read them with more caution.</p>
              <p>Near expiry every stock shows high decay, so IV/RV and gamma do most of the ranking that week.</p>
            </div>
          </details>

          <p className="mt-4 text-[11px] text-gray-600">Informational and educational only. Not SEBI registered. Not investment advice.</p>
        </>
        )
      })()}
      {!loading && !error && rows.length === 0 && <p className="text-gray-500 text-sm">No data available yet.</p>}
    </div>
    </div>
  )
}
