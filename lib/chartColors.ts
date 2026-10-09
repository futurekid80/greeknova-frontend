// Shared chart palette for every Greeks/GEX/IV chart in the app (gex-chart,
// vega, oi-map, oiprofile, pcr, delivery-confluence, etc). One place to
// change colors so every page stays visually consistent, and the set below
// has been run through the data-viz skill's validator (OKLab CVD
// separation, dark-surface lightness band, WCAG contrast) -- all checks
// pass for our #0a0a0c-family dark backgrounds. Don't hand-pick a new hex
// for a one-off chart; add a role here instead and re-validate the set.
//
// Validated 2026-10-09 against surface #1a1a19, dark mode, all-pass:
//   node scripts/validate_palette.js "#3987e5,#d95926,#199e70,#c98500,#9085e9,#e66767" --mode dark

export const chartColors = {
  // Calls / bullish / "up" side of any CE-vs-PE split. Positional
  // encoding (above-axis bars, left side of a diverging chart) should
  // still carry the real signal -- this color is support, not the only cue.
  call: '#199e70',
  // Puts / bearish / "down" side.
  put: '#e66767',
  // Reference markers: current spot / CMP line.
  spot: '#c98500',
  // Call wall marker (kept distinct from the call fill color so a wall
  // reference line doesn't blend into the call bars).
  callWall: '#199e70',
  // Put wall marker.
  putWall: '#e66767',
  // Flip point (cumulative, the stricter/primary definition).
  flip: '#9085e9',
  // Local/nearby flip point (the looser, per-strike definition) -- same
  // hue family as flip but dashed/lighter in use so the two don't read as
  // unrelated series.
  localFlip: '#b6b0f0',
  // IV / RV / vega lines.
  iv: '#3987e5',
  rv: '#d95926',
  // Grid, axis ticks, muted text -- not part of the categorical set, just
  // the shared recessive chrome every chart uses.
  grid: '#ffffff14',
  axisTick: '#8a8a86',
  mutedText: '#6b7280',
} as const

export type ChartColorKey = keyof typeof chartColors
