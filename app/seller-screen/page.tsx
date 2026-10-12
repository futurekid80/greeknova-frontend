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
  // or_high/or_low/or_width_pct/spot_open (Oct 12 2026, V2.1): exposed so a
  // continuous "distance from boundary" can be computed even when
  // or_status is "INSIDE" -- or_pct_outside alone is hardcoded to 0 in that
  // case and carries no information on where inside price actually sits.
  or_high?: number | null
  or_low?: number | null
  or_width_pct?: number | null
  spot_open?: number | null
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

type Scored = Row & {
  score: number; vScore: number; tScore: number; gScore: number
  rScore: number; rReasons: string[]
  rScoreV2: number; rReasonsV2: string[]
  // V2.1 (Oct 12 2026, shadow): rScoreV2_1 is null, not a number, when the
  // stock has no usable data for any of the three components -- see
  // rangeScoreV2_1(). Never treat a null here as "scored safe."
  rScoreV2_1: number | null; rReasonsV2_1: string[]; rQualityV2_1: 'FULL' | 'PARTIAL' | 'UNKNOWN'
}
type SortKey = 'symbol' | 'score' | 'days_to_expiry' | 'iv_rv_ratio' | 'atm_theta_pct' | 'atm_theta_per_lot' | 'atm_vega_per_lot' | 'pct_to_flip' | 'iv_pctile' | 'em_pct' | 'atm_vol_lots' | 'term_ratio' | 'rScore' | 'rScoreV2' | 'rScoreV2_1'

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

// Carries screening context into Strategy Builder (Oct 12 2026, external-
// review ask) so it doesn't disappear the moment a candidate is picked —
// Range Score V1/V2, market stress level, verdict and gamma regime, plus
// wall-quality flags, all read-only/informational on the other end.
function strategyLink(r: Scored & { verdict: Verdict }, stress: MarketStress, asOf: string) {
  const params = new URLSearchParams({ symbol: r.symbol })
  if (r.call_wall_strike) params.set('sellCE', String(r.call_wall_strike))
  if (r.put_wall_strike) params.set('sellPE', String(r.put_wall_strike))
  params.set('rv1', String(Math.round(r.rScore * 100)))
  params.set('rv2', String(Math.round(r.rScoreV2 * 100)))
  params.set('rv2ver', RANGE_SCORE_V2_VERSION)
  // V2.1 (Oct 12 2026, shadow): rv21 is omitted entirely when the score is
  // null (UNKNOWN — no usable component data), rather than passing a
  // misleading placeholder number through the URL.
  if (r.rScoreV2_1 !== null) {
    params.set('rv21', String(Math.round(r.rScoreV2_1 * 100)))
    params.set('rv21q', r.rQualityV2_1)
  } else {
    params.set('rv21q', 'UNKNOWN')
  }
  params.set('rv21ver', RANGE_SCORE_V2_1_VERSION)
  if (asOf) params.set('asOf', asOf)
  params.set('verdict', r.verdict.label)
  if (r.regime) params.set('gamma', r.regime === 'LONG_GAMMA' ? 'Long' : 'Short')
  params.set('stress', stress.level)
  const putWeak = insideExpectedMove(r.put_wall_strike, r.em_low, r.em_high, 'PE')
  const callWeak = insideExpectedMove(r.call_wall_strike, r.em_low, r.em_high, 'CE')
  const putInverted = invertedWall(r.put_wall_strike, r.cmp, 'PE')
  const callInverted = invertedWall(r.call_wall_strike, r.cmp, 'CE')
  const wallFlags: string[] = []
  if (putInverted || callInverted) wallFlags.push('Inverted wall')
  else if (putWeak || callWeak) wallFlags.push('Weak wall')
  if (wallFlags.length) params.set('wallFlags', wallFlags.join(','))
  return `/strategy-builder?${params.toString()}`
}

function exportCsv(list: (Scored & { verdict: Verdict })[], totalRows: number, filterSummary: string, stress: MarketStress, asOf: string) {
  const headers = [
    'Symbol', 'CMP', 'Verdict', 'Score', 'DTE', 'IV/RV', 'Decay %/day', 'IV Percentile', '1SD Move %',
    'Gamma Regime', 'To Flip %',
    'Put Wall (support)', 'Put Wall Quality', 'Call Wall (resistance)', 'Call Wall Quality',
    'Call Beyond 1SD Strike', 'Call Beyond 1SD Prob ITM %', 'Call Beyond 1SD Premium/Lot',
    'Put Beyond 1SD Strike', 'Put Beyond 1SD Prob ITM %', 'Put Beyond 1SD Premium/Lot',
    'Range Score V1 (live)', 'Range V1 Flags',
    `Range Score V2 (shadow ${RANGE_SCORE_V2_VERSION}, stock-specific only)`, 'Range V2 Flags',
    `Range Score V2.1 (shadow ${RANGE_SCORE_V2_1_VERSION}, continuous scoring)`, 'Range V2.1 Data Quality', 'Range V2.1 Flags',
    'Market Stress (shared, all rows)',
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
      Math.round(r.rScoreV2 * 100), r.rReasonsV2.join('; '),
      // Never write a bare number for a null (UNKNOWN) V2.1 score — an
      // empty string in the CSV is visibly "no value," not a fabricated 0
      // or 100 that a downstream sort/filter could silently treat as real.
      r.rScoreV2_1 !== null ? Math.round(r.rScoreV2_1 * 100) : '',
      r.rQualityV2_1, r.rReasonsV2_1.join('; '),
      stress.label,
    ]
  })
  // Leading comment row (Oct 12 2026): an export that silently reflects
  // whatever filters happen to be active, with no record of it in the file
  // itself, reads like a data gap later -- "218 vs 168 instruments, why?"
  // is unanswerable from the CSV alone otherwise.
  const coverageLine = [`# Exported ${list.length} of ${totalRows} total instruments scanned, data as of ${asOf || 'unknown time'} IST. Active filters: ${filterSummary || 'none'}. Range Score V1 still drives all live filters/presets; V2 (${RANGE_SCORE_V2_VERSION}) and V2.1 (${RANGE_SCORE_V2_1_VERSION}) are shadow-mode only, for comparison — treat any saved V2/V2.1 numbers as tied to their formula version and this timestamp, since opening-range/OI-skew/max-pain-drift inputs are intraday and the weights may be recalibrated later. A blank V2.1 cell means UNKNOWN (insufficient data that session), not a zero or a perfect score.`]
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
// Range Score V1 (Oct 12 2026 original) — kept byte-for-byte as the live,
// filter-driving formula. The VIX-move penalty here uses one shared,
// market-wide reading applied identically to every stock, which on a
// sharply-up-VIX day caps nearly the whole universe at a similar ceiling
// regardless of individual stock behavior. Confirmed via external review +
// code audit Oct 12 2026 (see rangeScoreV2 below) and intentionally left
// unchanged so every live filter, preset and the index-risk banner keep
// behaving exactly as before while V2 runs alongside it in shadow mode.
function rangeScoreV1(r: Row): { rScore: number; rReasons: string[] } {
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

// Range Score V2 (Oct 12 2026, shadow mode) — stock-specific components
// only. Market-wide VIX is deliberately removed here, not just zeroed out:
// it now lives solely in marketStress() below, as its own status layer
// (shown in the banner + Strategy Builder) rather than double-counted
// inside a per-stock ranking score. The three remaining signals (opening-
// range break, OI skew, max-pain drift) are rescaled from V1's own
// relative weights (0.30 : 0.15 : 0.20, the budget V1 gave them out of a
// 1.0 total alongside VIX's 0.35) up to fill the full 1.0 range now that
// VIX no longer shares it — same relative importance to each other, not an
// arbitrary new formula, and NOT simply "V1 + 35 points." The DTE-near-
// expiry cap is kept as-is: it is a stock-specific regime fact (this
// stock's own gamma is strike-concentrated right now), not a market-wide
// one, so it stays in both versions.
// Bump this whenever V2's weights/components change, so a CSV or Strategy
// Builder link exported under one formula can never be mistaken for another
// later on (Oct 12 2026 external-review ask — calibration history must stay
// distinguishable from the formula that produced it).
const RANGE_SCORE_V2_VERSION = 'v2.0-shadow'
const V1_OR_WEIGHT = 0.30, V1_OI_WEIGHT = 0.15, V1_MP_WEIGHT = 0.20
const V1_NON_VIX_BUDGET = V1_OR_WEIGHT + V1_OI_WEIGHT + V1_MP_WEIGHT // 0.65
const V2_OR_WEIGHT = V1_OR_WEIGHT / V1_NON_VIX_BUDGET // ≈0.4615
const V2_OI_WEIGHT = V1_OI_WEIGHT / V1_NON_VIX_BUDGET // ≈0.2308
const V2_MP_WEIGHT = V1_MP_WEIGHT / V1_NON_VIX_BUDGET // ≈0.3077

function rangeScoreV2(r: Row): { rScore: number; rReasons: string[] } {
  const reasons: string[] = []
  let score = 1.0

  if (r.or_status === 'ABOVE' || r.or_status === 'BELOW') {
    const mag = r.or_pct_outside ?? 0
    score -= clamp(mag / 1.5) * V2_OR_WEIGHT
    reasons.push(`Price broke ${r.or_status === 'ABOVE' ? 'above' : 'below'} the opening range and hasn't reclaimed it`)
  }

  if (r.oi_skew_pct !== null && r.oi_skew_pct !== undefined && Math.abs(r.oi_skew_pct) >= 40) {
    score -= V2_OI_WEIGHT
    reasons.push(`${r.oi_skew_pct > 0 ? 'Call' : 'Put'} OI building much faster than the other side today`)
  }

  if (r.max_pain_drift_confirms) {
    score -= V2_MP_WEIGHT
    reasons.push('Max pain is crawling with price — fresh positioning, not just OI decay')
  }

  if (r.days_to_expiry !== null && r.days_to_expiry !== undefined && r.days_to_expiry <= 1) {
    score = Math.min(score, 0.6)
    reasons.push(`Only ${r.days_to_expiry} day(s) to expiry — gamma is strike-concentrated, regime read is less stable`)
  }

  return { rScore: clamp(score), rReasons: reasons }
}

// Range Score V2.1 (Oct 12 2026, shadow mode) — conditionally approved by
// external review. Same three stock-specific components as V2 (OR break,
// OI skew, max-pain drift), same relative weights (V2_OR/OI/MP_WEIGHT,
// unchanged), but each penalty is now continuous/graduated instead of a
// binary threshold -- the direct fix for V2's ceiling-clustering problem
// (51/218 stocks tied at exactly 100), which the component audit traced to
// three valid-but-unused continuous observations being collapsed into
// flat zero penalties, not to missing data. Per the review's explicit,
// component-by-component decisions:
//   - OR containment: continuous normalized distance from the nearest OR
//     boundary, including while still "inside" it (or_pct_outside alone
//     is hardcoded to 0.0 whenever status is INSIDE and loses all
//     proximity information -- see or_high/or_low below). OR width
//     (or_width_pct) and the window's own data are recorded in the reasons
//     list but deliberately NOT folded into the penalty yet -- the review
//     was explicit that midpoint containment should not yet be treated as
//     proven predictive evidence, so a 1% OR and a 5% OR both at their
//     midpoint still get the same (zero) containment penalty today.
//   - OI skew: continuous magnitude scaling replaces the old 40% hard
//     gate. Sign is reported (which side is building faster) but NOT
//     auto-interpreted as bullish/bearish -- per review, that
//     interpretation needs historical validation first.
//   - Max-pain drift: continuous magnitude, but ONLY for same-direction
//     ("confirms") drift. Contrarian drift gets NO bonus and NO penalty —
//     strictly neutral, per explicit review instruction, since max pain
//     hasn't been shown to be a reliable mean-reversion magnet. Unchanged
//     max pain is likewise neutral.
//   - DTE stays a separate cap/modifier, identical to V1/V2 — never folded
//     into the three-component weighted formula.
//   - UNKNOWN safeguard: a stock with NO usable data for any of the three
//     components returns rScore: null, never a silent 100. A null score
//     must never be read by any caller as "fully safe" — it means "not
//     enough data yet, not scored." Partial data (1 or 2 of 3 components
//     present) still produces a real number, just flagged dataQuality:
//     'PARTIAL' so a consumer can tell the difference from a 'FULL' read.
// Bump RANGE_SCORE_V2_1_VERSION whenever this formula/weights change, same
// discipline as RANGE_SCORE_V2_VERSION above, for the same reason.
const RANGE_SCORE_V2_1_VERSION = 'v2.1-shadow'

type V2_1Result = { rScore: number | null; rReasons: string[]; dataQuality: 'FULL' | 'PARTIAL' | 'UNKNOWN' }

function rangeScoreV2_1(r: Row): V2_1Result {
  const reasons: string[] = []
  let componentsWithData = 0
  let penalty = 0

  // 1. OR containment — continuous distance from the nearest boundary
  const haveOrData = r.or_status !== null && r.or_status !== undefined
    && r.or_high !== null && r.or_high !== undefined
    && r.or_low !== null && r.or_low !== undefined
    && r.or_high > r.or_low
  if (haveOrData) {
    componentsWithData++
    if (r.or_status === 'ABOVE' || r.or_status === 'BELOW') {
      const mag = r.or_pct_outside ?? 0
      penalty += clamp(mag / 1.5) * V2_OR_WEIGHT
      reasons.push(`Price broke ${r.or_status === 'ABOVE' ? 'above' : 'below'} the opening range and hasn't reclaimed it`)
    } else {
      // INSIDE: normalize distance from the nearer boundary to the half-
      // width (0 at a boundary, 1 at dead center). Risk fraction is the
      // complement, so a stock hugging the edge still carries a graduated
      // penalty instead of V1/V2's flat zero for every "inside" reading
      // regardless of where inside it is.
      const half = (r.or_high! - r.or_low!) / 2
      const mid = (r.or_high! + r.or_low!) / 2
      const normalizedDistFromBoundary = half > 0 ? clamp(1 - Math.abs(r.cmp - mid) / half) : 0
      const riskFraction = 1 - normalizedDistFromBoundary
      if (riskFraction > 0.02) {
        penalty += riskFraction * V2_OR_WEIGHT
        reasons.push('Price is sitting close to the opening-range boundary (inside it, but not centered)')
      }
      if (r.or_width_pct !== null && r.or_width_pct !== undefined) {
        reasons.push(`Opening range formed ${fmt(r.or_width_pct, 2)}% wide today (recorded, not yet weighted into the score)`)
      }
    }
  } else {
    reasons.push('Opening-range data unavailable — containment component UNKNOWN')
  }

  // 2. OI skew — continuous magnitude, sign preserved but not auto-interpreted
  const haveOiData = r.oi_skew_pct !== null && r.oi_skew_pct !== undefined
  if (haveOiData) {
    componentsWithData++
    const mag = Math.abs(r.oi_skew_pct!)
    // Graduated between ~10% (noise floor) and 80% (double V2's old hard
    // gate) instead of a binary cliff at exactly 40%.
    const fraction = clamp((mag - 10) / 70)
    if (fraction > 0) {
      penalty += fraction * V2_OI_WEIGHT
      reasons.push(`${r.oi_skew_pct! > 0 ? 'Call' : 'Put'}-side OI building faster today (magnitude-scaled risk flag, not a directional call)`)
    }
  } else {
    reasons.push('OI-skew data unavailable — OI component UNKNOWN')
  }

  // 3. Max-pain drift — continuous magnitude, same-direction only.
  // Contrarian and unchanged are BOTH strictly neutral: no bonus, no
  // penalty, per explicit review decision.
  const haveMpData = r.max_pain_now !== null && r.max_pain_now !== undefined
    && r.max_pain_open !== null && r.max_pain_open !== undefined
    && r.spot_open !== null && r.spot_open !== undefined
  if (haveMpData) {
    componentsWithData++
    if (r.max_pain_drift_confirms === true) {
      const driftMag = Math.abs(r.max_pain_now! - r.max_pain_open!) / r.spot_open! * 100
      const fraction = clamp(driftMag / 2) // 2% of spot drift = full weight
      penalty += fraction * V2_MP_WEIGHT
      reasons.push('Max pain is crawling with price — fresh positioning, not just OI decay (magnitude-scaled)')
    } else if (r.max_pain_drift_confirms === false) {
      reasons.push('Max pain drifted against price — recorded as neutral, no bonus (not yet validated as a mean-reversion signal)')
    }
    // max_pain_drift_confirms === null → max pain unchanged → neutral, no reason needed
  } else {
    reasons.push('Max-pain data unavailable — drift component UNKNOWN')
  }

  // Safeguard: zero usable components → UNKNOWN, never a silent clean 100.
  if (componentsWithData === 0) {
    return { rScore: null, rReasons: ['Insufficient data for all three Range Score V2.1 components'], dataQuality: 'UNKNOWN' }
  }

  let score = clamp(1 - penalty)

  // DTE stays a separate modifier, identical to V1/V2.
  if (r.days_to_expiry !== null && r.days_to_expiry !== undefined && r.days_to_expiry <= 1) {
    score = Math.min(score, 0.6)
    reasons.push(`Only ${r.days_to_expiry} day(s) to expiry — gamma is strike-concentrated, regime read is less stable`)
  }

  return { rScore: score, rReasons: reasons, dataQuality: componentsWithData === 3 ? 'FULL' : 'PARTIAL' }
}

type MarketStress = { level: 'ELEVATED' | 'WATCH' | 'NORMAL' | 'UNKNOWN'; label: string; guidance: string; cls: string; emoji: string }

// Market Stress (Oct 12 2026) — the market-wide VIX-move signal, now kept
// OUT of the per-stock Range Score and surfaced here instead as its own
// status. This is advisory: GreekNova has no live order execution or
// position-sizing engine today, so "restricts new trades and position
// sizing" means a prominent, hard-to-miss guidance banner a trader has to
// see before acting — not an automated block. If/when GreekNova ever wires
// into actual order placement, this is the layer that status would gate.
function marketStress(vixChangePct: number | null | undefined): MarketStress {
  if (vixChangePct === null || vixChangePct === undefined) {
    return { level: 'UNKNOWN', label: 'No VIX reading yet', guidance: 'Market-wide stress signal unavailable right now.', cls: 'bg-gray-800/60 text-gray-400 border-gray-700', emoji: '⚪' }
  }
  if (vixChangePct >= 5) {
    return {
      level: 'ELEVATED', label: `Elevated — VIX up ${fmt(vixChangePct, 1)}% today`,
      guidance: 'Market-wide stress is high. Reduce size on fresh non-directional entries across every stock, not just the ones flagged individually — this is a shared condition, not a stock-specific one.',
      cls: 'bg-red-950/40 text-red-300 border-red-900/50', emoji: '🔴',
    }
  }
  if (vixChangePct >= 3) {
    return {
      level: 'WATCH', label: `Watch — VIX up ${fmt(vixChangePct, 1)}% today`,
      guidance: 'Market-wide stress is building. Size new non-directional entries a notch smaller than usual; no action needed on existing positions yet.',
      cls: 'bg-amber-950/40 text-amber-300 border-amber-900/50', emoji: '🟡',
    }
  }
  return {
    level: 'NORMAL', label: `Normal — VIX ${vixChangePct >= 0 ? '+' : ''}${fmt(vixChangePct, 1)}% today`,
    guidance: 'No market-wide stress signal active right now.',
    cls: 'bg-emerald-950/40 text-emerald-300 border-emerald-900/50', emoji: '🟢',
  }
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
  const { rScore, rReasons } = rangeScoreV1(r)
  const { rScore: rScoreV2, rReasons: rReasonsV2 } = rangeScoreV2(r)
  const { rScore: rScoreV2_1, rReasons: rReasonsV2_1, dataQuality: rQualityV2_1 } = rangeScoreV2_1(r)
  return { ...r, score, vScore, tScore, gScore, rScore, rReasons, rScoreV2, rReasonsV2, rScoreV2_1, rReasonsV2_1, rQualityV2_1 }
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

  // Market-wide, same value on every row (backend broadcasts one vix_change_pct
  // per refresh cycle) — pull it from any row rather than per-symbol.
  const stress = useMemo(() => marketStress(rows[0]?.vix_change_pct), [rows])

  // Shadow-mode comparison (Oct 12 2026): V1 stays the live, filter-driving
  // score untouched; this is purely informational so the before/after shift
  // can be reviewed before any decision to switch the live filter to V2.
  const v1v2Compare = useMemo(() => {
    if (!scored.length) return null
    const n = scored.length
    const avg = (f: (s: Scored) => number) => scored.reduce((a, s) => a + f(s), 0) / n
    const avgV1 = avg((s) => s.rScore * 100)
    const avgV2 = avg((s) => s.rScoreV2 * 100)
    const bucket = (v: number) => (v >= 70 ? 'holding' : v >= 40 ? 'wobbling' : 'at_risk')
    let bucketShifts = 0
    for (const s of scored) if (bucket(s.rScore * 100) !== bucket(s.rScoreV2 * 100)) bucketShifts++
    // Candidate-count impact: how many stocks would pass each preset's own
    // Min Range Score threshold under V1 vs under V2, with every other
    // preset filter applied as-is. Hypothetical only — does not change the
    // live filter.
    const presetThresholds: { name: string; minRangeScore: number }[] = [
      { name: 'Conservative (≥60)', minRangeScore: 60 },
      { name: 'Balanced (≥45)', minRangeScore: 45 },
      { name: 'Higher premium (≥35)', minRangeScore: 35 },
    ]
    const presetCounts = presetThresholds.map((p) => ({
      name: p.name,
      v1: scored.filter((s) => s.rScore * 100 >= p.minRangeScore).length,
      v2: scored.filter((s) => s.rScoreV2 * 100 >= p.minRangeScore).length,
    }))
    const atCapV1 = scored.filter((s) => Math.round(s.rScore * 100) === 65).length
    // V2's own ceiling-clustering check (Oct 12 2026 external-review ask):
    // a stock with none of the three stock-specific flags today sits at the
    // V2 max (100) by construction -- worth surfacing on its own, the same
    // way the V1 65%-cap was, since a cluster at the top can limit how well
    // Conservative-style top-percentile thresholds actually differentiate.
    const atCeilingV2 = scored.filter((s) => Math.round(s.rScoreV2 * 100) === 100).length
    // Hard-exclusion independence check: Event risk / thin liquidity / wrong-
    // side walls are separate filter predicates in `shown` (see hideThin,
    // noResults, hideWeakWalls below) that never read rScore or rScoreV2 --
    // their average V2 should land close to the non-excluded average if that
    // independence holds in practice, not just in the code path.
    const isHardExcluded = (s: Scored) => {
      const putInverted = invertedWall(s.put_wall_strike, s.cmp, 'PE')
      const callInverted = invertedWall(s.call_wall_strike, s.cmp, 'CE')
      return !!(s.result_before_expiry || s.liq_thin || putInverted || callInverted)
    }
    const excluded = scored.filter(isHardExcluded)
    const notExcluded = scored.filter((s) => !isHardExcluded(s))
    const avgV2NotExcluded = notExcluded.length ? notExcluded.reduce((a, s) => a + s.rScoreV2 * 100, 0) / notExcluded.length : 0
    const avgV2ExcludedClean = excluded.length ? excluded.reduce((a, s) => a + s.rScoreV2 * 100, 0) / excluded.length : 0
    const biggestMovers = [...scored]
      .map((s) => ({ symbol: s.symbol, delta: Math.round(s.rScoreV2 * 100) - Math.round(s.rScore * 100), v1: Math.round(s.rScore * 100), v2: Math.round(s.rScoreV2 * 100) }))
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 5)

    // V2.1 stats (Oct 12 2026) — the direct check on whether continuous
    // scoring actually relieved V2's ceiling-clustering problem, plus the
    // UNKNOWN/PARTIAL data-quality breakdown the review's safeguards
    // require surfacing (no genuinely-missing-data stock should be
    // invisible inside an average as if it were a clean, scored 100).
    const unknownV2_1 = scored.filter((s) => s.rQualityV2_1 === 'UNKNOWN')
    const partialV2_1 = scored.filter((s) => s.rQualityV2_1 === 'PARTIAL')
    const scoredV2_1 = scored.filter((s) => s.rScoreV2_1 !== null)
    const avgV2_1 = scoredV2_1.length ? scoredV2_1.reduce((a, s) => a + (s.rScoreV2_1 as number) * 100, 0) / scoredV2_1.length : 0
    const atCeilingV2_1 = scoredV2_1.filter((s) => Math.round((s.rScoreV2_1 as number) * 100) === 100).length
    // Ranking-stability spot check: of the stocks V2 ties at its ceiling
    // (100), how many does V2.1 actually manage to spread apart? This is
    // the acceptance-test item "ceiling concentration materially reduced,"
    // measured directly rather than inferred from the overall average.
    const v2CeilingStocks = scored.filter((s) => Math.round(s.rScoreV2 * 100) === 100 && s.rScoreV2_1 !== null)
    const v2CeilingSpread = v2CeilingStocks.length
      ? Math.max(...v2CeilingStocks.map((s) => Math.round((s.rScoreV2_1 as number) * 100))) -
        Math.min(...v2CeilingStocks.map((s) => Math.round((s.rScoreV2_1 as number) * 100)))
      : 0
    const v2CeilingStillAt100 = v2CeilingStocks.filter((s) => Math.round((s.rScoreV2_1 as number) * 100) === 100).length
    const biggestMoversV2_1 = [...scoredV2_1]
      .map((s) => ({ symbol: s.symbol, delta: Math.round((s.rScoreV2_1 as number) * 100) - Math.round(s.rScoreV2 * 100), v2: Math.round(s.rScoreV2 * 100), v2_1: Math.round((s.rScoreV2_1 as number) * 100) }))
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 5)

    return {
      n, avgV1, avgV2, bucketShifts, presetCounts, atCapV1, atCeilingV2, biggestMovers,
      hardExcludedCount: excluded.length, avgV2Excluded: avgV2ExcludedClean, avgV2NotExcluded,
      avgV2_1, atCeilingV2_1, scoredV2_1Count: scoredV2_1.length,
      unknownV2_1Count: unknownV2_1.length, partialV2_1Count: partialV2_1.length,
      v2CeilingCount: v2CeilingStocks.length, v2CeilingSpread, v2CeilingStillAt100,
      biggestMoversV2_1,
    }
  }, [scored])

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
          <button onClick={() => exportCsv(shown, rows.length, filterSummary, stress, asOf)} className="px-4 py-2 rounded-lg border border-gray-700 text-sm text-gray-300 hover:border-gray-500">Export CSV</button>
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
          {stress.level !== 'NORMAL' && (
            <div className={`rounded-xl border px-5 py-4 mb-3 ${stress.cls}`}>
              <div className="flex items-start justify-between flex-wrap gap-2">
                <div>
                  <p className="font-bold text-base">{stress.emoji} Market Stress — {stress.label}</p>
                  <p className="text-sm mt-1 opacity-90">{stress.guidance}</p>
                </div>
                <p className="text-[11px] opacity-60 whitespace-nowrap max-w-[220px] text-right">Shared across every stock today · advisory only, not an automated block</p>
              </div>
            </div>
          )}
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
                <p className="text-[11px] opacity-60 whitespace-nowrap">Range Confidence V1 (live) · not a recommendation, a data read</p>
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

          {v1v2Compare && (
            <details className="mb-4 rounded-lg border border-gray-800 bg-[#0c0c16] p-4 text-xs text-gray-400">
              <summary className="cursor-pointer text-gray-300 font-semibold">Range Score V1 vs V2 — shadow comparison ({v1v2Compare.n} stocks)</summary>
              <div className="mt-3 space-y-3">
                <p>
                  V1 (live, drives all filters/presets today) averages <b className="text-gray-200">{fmt(v1v2Compare.avgV1, 0)}</b>.
                  V2 (shadow — stock-specific only, VIX moved to Market Stress above) averages <b className="text-gray-200">{fmt(v1v2Compare.avgV2, 0)}</b>.
                  {v1v2Compare.atCapV1 > 0 && <> {v1v2Compare.atCapV1} of {v1v2Compare.n} stocks sit at exactly 65 under V1 today (the shared-VIX ceiling); V2 spreads those out by each stock's own signals instead.</>}
                </p>
                <p><b className="text-gray-200">{v1v2Compare.bucketShifts}</b> of {v1v2Compare.n} stocks would land in a different Range tier (Holding / Wobbling / At risk) under V2 vs V1.</p>
                <p>
                  <b className="text-gray-200">{v1v2Compare.atCeilingV2}</b> of {v1v2Compare.n} stocks sit at V2's own ceiling (100) today — none of its three flags (opening-range break, OI skew, max-pain drift) fired for them, so V2 can't yet tell those stocks apart from each other. A top-percentile threshold (e.g. "top 15%") will be comparing mostly-tied scores until the formula or its components are revisited.
                </p>
                <p>
                  Hard exclusions (Event risk, thin liquidity, inverted walls — {v1v2Compare.hardExcludedCount} of {v1v2Compare.n} stocks today) are a separate filter step that never reads Range Score: excluded stocks average <b className="text-gray-200">{fmt(v1v2Compare.avgV2Excluded, 0)}</b> under V2, non-excluded stocks average <b className="text-gray-200">{fmt(v1v2Compare.avgV2NotExcluded, 0)}</b> — close to each other, consistent with the two being independent rather than one driving the other.
                </p>
                <div>
                  <p className="text-gray-300 font-semibold mb-1">Candidate count if a preset's Range threshold were applied to each version (hypothetical — live filter is still V1):</p>
                  <table className="text-[11px]">
                    <thead><tr className="text-gray-500"><th className="text-left pr-4 py-1">Preset threshold</th><th className="text-right pr-4">V1 passes</th><th className="text-right">V2 passes</th></tr></thead>
                    <tbody>
                      {v1v2Compare.presetCounts.map((p) => (
                        <tr key={p.name}><td className="text-left pr-4 py-1">{p.name}</td><td className="text-right pr-4">{p.v1}</td><td className="text-right">{p.v2}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div>
                  <p className="text-gray-300 font-semibold mb-1">Biggest V1→V2 movers today:</p>
                  <p>{v1v2Compare.biggestMovers.map((m) => `${m.symbol} (${m.v1}→${m.v2}, ${m.delta > 0 ? '+' : ''}${m.delta})`).join(' · ')}</p>
                </div>
                <p className="text-gray-600">This panel is for review before any decision to switch the live filter/presets to V2 — nothing here changes what's currently filtered, sized, or export-flagged as a candidate.</p>
              </div>
            </details>
          )}

          {v1v2Compare && (
            <details className="mb-4 rounded-lg border border-gray-800 bg-[#0c0c16] p-4 text-xs text-gray-400">
              <summary className="cursor-pointer text-gray-300 font-semibold">Range Score V2.1 — continuous scoring, shadow comparison ({v1v2Compare.n} stocks)</summary>
              <div className="mt-3 space-y-3">
                <p>
                  V2.1 (shadow — same three components as V2, but continuous/graduated instead of binary thresholds) scores <b className="text-gray-200">{v1v2Compare.scoredV2_1Count}</b> of {v1v2Compare.n} stocks, averaging <b className="text-gray-200">{fmt(v1v2Compare.avgV2_1, 0)}</b> among those scored.
                  {v1v2Compare.unknownV2_1Count > 0 && <> <b className="text-amber-300">{v1v2Compare.unknownV2_1Count}</b> stocks are UNKNOWN today (no usable data for any of the three components — excluded from that average, never silently scored as a clean 100).</>}
                  {v1v2Compare.partialV2_1Count > 0 && <> <b className="text-gray-200">{v1v2Compare.partialV2_1Count}</b> are PARTIAL (only 1–2 of 3 components had data).</>}
                </p>
                <p>
                  <b className="text-gray-200">{v1v2Compare.atCeilingV2_1}</b> of {v1v2Compare.scoredV2_1Count} scored stocks sit at V2.1's ceiling (100), versus <b className="text-gray-200">{v1v2Compare.atCeilingV2}</b> of {v1v2Compare.n} under V2 — the direct read on whether continuous scoring is actually relieving the ceiling-clustering problem the component audit flagged, not just adding decimal precision.
                </p>
                {v1v2Compare.v2CeilingCount > 0 && (
                  <p>
                    Of the <b className="text-gray-200">{v1v2Compare.v2CeilingCount}</b> stocks tied at exactly 100 under V2, V2.1 spreads them across a <b className="text-gray-200">{v1v2Compare.v2CeilingSpread}-point</b> range — <b className="text-gray-200">{v1v2Compare.v2CeilingStillAt100}</b> of them are still at 100 under V2.1 too (meaning even the continuous versions of all three components found literally nothing for that stock today, not that the formula failed to differentiate).
                  </p>
                )}
                <div>
                  <p className="text-gray-300 font-semibold mb-1">Biggest V2→V2.1 movers today (scored stocks only):</p>
                  <p>{v1v2Compare.biggestMoversV2_1.map((m) => `${m.symbol} (${m.v2}→${m.v2_1}, ${m.delta > 0 ? '+' : ''}${m.delta})`).join(' · ') || '—'}</p>
                </div>
                <p className="text-gray-600">
                  V2.1 is a conditionally-approved design, shadow-mode only — it does not drive any live filter, preset or capital-sizing decision, same as V2. Weights are unchanged from V2 (same relative importance between OR/OI/max-pain); only the shape of each penalty changed from a step function to a continuous one. Contrarian max-pain drift is scored strictly neutral (no bonus) per explicit review decision, pending historical validation. Formula version: {RANGE_SCORE_V2_1_VERSION}.
                </p>
              </div>
            </details>
          )}

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
                  <th className={th} onClick={() => sortBy('rScore')} title="Range Score V1 (live — drives all filters/presets today). Combines VIX move (shared market-wide, so it can cap every stock on a high-VIX day), opening-range break, OI skew, max-pain drift and DTE — separate from the richness/decay/gamma score above. See Market Stress banner for the VIX read on its own.">Range V1{arrow('rScore')}</th>
                  {more && <th className={th} onClick={() => sortBy('rScoreV2')} title="Range Score V2 (shadow mode — not live, does not drive any filter yet). Stock-specific only: opening-range break, OI skew, max-pain drift and DTE. VIX is intentionally excluded here and shown instead as the separate Market Stress banner above.">Range V2 (shadow){arrow('rScoreV2')}</th>}
                  {more && <th className={th} onClick={() => sortBy('rScoreV2_1')} title="Range Score V2.1 (shadow mode — not live). Same three V2 components, but continuous/graduated instead of binary thresholds, to relieve V2's ceiling-clustering. '—' means UNKNOWN: no usable data for any component today, never a silently-clean score.">Range V2.1 (shadow){arrow('rScoreV2_1')}</th>}
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
                    {more && (
                      <td className="px-3 py-2.5 text-right whitespace-nowrap" title={r.rReasonsV2.length ? r.rReasonsV2.join(' · ') : 'No stock-specific range-risk flags right now'}>
                        <span className={dot(r.rScoreV2)}>● </span>{Math.round(r.rScoreV2 * 100)}
                      </td>
                    )}
                    {more && (
                      <td className="px-3 py-2.5 text-right whitespace-nowrap" title={r.rScoreV2_1 === null ? 'UNKNOWN — no usable data for any of the three V2.1 components today' : (r.rReasonsV2_1.length ? `[${r.rQualityV2_1}] ${r.rReasonsV2_1.join(' · ')}` : 'No range-risk flags right now')}>
                        {r.rScoreV2_1 === null ? (
                          <span className="text-gray-600">—</span>
                        ) : (
                          <>
                            <span className={dot(r.rScoreV2_1)}>● </span>{Math.round(r.rScoreV2_1 * 100)}
                            {r.rQualityV2_1 === 'PARTIAL' && <span className="text-amber-400 text-[10px] ml-1" title="Only 1–2 of 3 components had usable data">p</span>}
                          </>
                        )}
                      </td>
                    )}
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
                      <Link href={strategyLink(r, stress, asOf)} className="px-2 py-1 rounded-md text-[11px] font-semibold border border-cyan-900/60 text-cyan-400 hover:bg-cyan-950/40">
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
              <li><b>Range Score V1 (live) vs V2 (shadow):</b> V1 is the original formula and still drives every filter, preset and the index-risk banner — unchanged. It blends a market-wide VIX-move penalty (same for every stock that day) with stock-specific signals, which meant a sharply-up-VIX day could cap most or all stocks at a similar ceiling regardless of individual behavior. V2 removes VIX from the per-stock score entirely — it's opening-range break, OI skew, max-pain drift and DTE only, VIX moved out to its own Market Stress status instead — and is shown in shadow mode (More columns) purely for comparison. Nothing is filtered, sized, or export-flagged by V2 yet; see the "V1 vs V2 shadow comparison" panel above the table for today's before/after numbers.</li>
              <li><b>Market Stress:</b> the VIX-move signal, now its own status (banner at the top when VIX is up ≥3% today) rather than baked into every stock's Range Score. It's advisory — GreekNova doesn't place trades or size positions automatically, so this is guidance to read before sizing, not an enforced block.</li>
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
