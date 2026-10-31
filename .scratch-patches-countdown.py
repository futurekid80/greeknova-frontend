path = "components/TrialCountdown.tsx"
with open(path) as f:
    c = f.read()

old = """'use client'
// Oct 22 2026: small navbar badge showing a trial member their own days-left
// countdown, so expiry doesn't come as a surprise the moment the backend
// gate (services/access_gate.py) starts blocking every request. Reads
// /me/trial-status, which classifies status the exact same way the gate
// does -- this can never show "3 days left" while the gate quietly
// disagrees. Renders nothing for members, signed-out visitors, or once a
// trial has actually expired (the gate's own block message covers that).
import { useEffect, useState } from 'react'"""

new = """'use client'
// Oct 22 2026: small navbar badge showing a trial member their own days-left
// countdown, so expiry doesn't come as a surprise the moment the backend
// gate (services/access_gate.py) starts blocking every request. Reads
// /me/trial-status, which classifies status the exact same way the gate
// does -- this can never show "3 days left" while the gate quietly
// disagrees. Renders nothing for signed-out visitors, or once a trial has
// actually expired (the gate's own block message covers that).
//
// Oct 24 2026: extended to paid members too -- /me/trial-status now also
// returns trial_expires_date/days_left for status === 'member' (reading
// beta_users.expires_at). Informational only, same as the trial case: this
// badge does NOT gate access, expires_at still isn't enforced anywhere
// (see access_gate.py). Only shown inside 60 days of expiry so a founding
// member mid-way through their year doesn't see a permanent badge.
import { useEffect, useState } from 'react'"""

assert old in c, "header comment not found"
c = c.replace(old, new)

old2 = """type TrialStatus = {
  status: 'member' | 'trial_active' | 'trial_expired' | 'none'
  trial_expires_date: string | null
  days_left: number | null
}"""
assert old2 in c, "type not found"
# unchanged, just confirming presence

old3 = "  if (!data || data.status !== 'trial_active' || data.days_left === null) return null\n\n  const urgent = data.days_left <= 2\n  const label = data.days_left === 0 ? 'Trial ends today' : `Trial: ${data.days_left} day${data.days_left === 1 ? '' : 's'} left`"
new3 = """  if (!data || data.days_left === null) return null
  if (data.status !== 'trial_active' && data.status !== 'member') return null
  // Paid members: only worth a badge once they're within 60 days of expiry
  // -- otherwise this would be a permanent fixture in the navbar all year.
  if (data.status === 'member' && data.days_left > 60) return null

  const urgent = data.days_left <= 2
  const label = data.status === 'member'
    ? (data.days_left <= 0 ? 'Plan expired' : `Plan: ${data.days_left} day${data.days_left === 1 ? '' : 's'} left`)
    : (data.days_left === 0 ? 'Trial ends today' : `Trial: ${data.days_left} day${data.days_left === 1 ? '' : 's'} left`)"""
assert old3 in c, "render logic not found"
c = c.replace(old3, new3)

old4 = """      title={data.trial_expires_date ? `Expires ${data.trial_expires_date}` : undefined}"""
assert old4 in c, "title attr not found"
# unchanged, just confirming presence

with open(path.replace(".tsx", "_new.tsx"), "w") as f:
    f.write(c)
print("OK")
