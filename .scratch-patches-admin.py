path = 'app/admin/members/page.tsx'
with open(path) as f:
    c = f.read()

old1 = """import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

const API = 'https://api.greeknova.com'
const ADMIN_EMAIL = 'megha.jethmalani@gmail.com'"""
new1 = """import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

const API = 'https://api.greeknova.com'
const ADMIN_EMAIL = 'megha.jethmalani@gmail.com'

// FIX (Oct 24 2026): local YYYY-MM-DD, not toISOString() -- that reads the
// UTC date, which is still 'yesterday' for ~5.5 hours every night in IST
// (e.g. 1AM IST on the 24th is 7:30PM UTC on the 23rd), so the date field
// would silently default to the wrong day overnight.
function todayStr() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}"""
assert old1 in c, "old1 not found"
c = c.replace(old1, new1)

old2 = "const [form, setForm] = useState({ email: '', name: '', plan: 'monthly' })"
new2 = "const [form, setForm] = useState({ email: '', name: '', plan: 'monthly', payment_date: todayStr() })"
assert old2 in c, "old2 not found"
c = c.replace(old2, new2)

old3 = "setForm({ email: '', name: '', plan: form.plan })"
new3 = "setForm({ email: '', name: '', plan: form.plan, payment_date: todayStr() })"
assert old3 in c, "old3 not found"
c = c.replace(old3, new3)

old4 = """        <form onSubmit={handleSubmit} className="bg-white/5 border border-white/10 rounded-lg p-5 mb-10 grid gap-4 sm:grid-cols-[2fr_1.5fr_2fr_auto] items-end">"""
new4 = """        <form onSubmit={handleSubmit} className="bg-white/5 border border-white/10 rounded-lg p-5 mb-10 grid gap-4 sm:grid-cols-[2fr_1.5fr_1.3fr_2fr_auto] items-end">"""
assert old4 in c, "old4 not found"
c = c.replace(old4, new4)

old5 = """          <div>
            <label className="block text-xs text-gray-500 mb-1">Plan paid for</label>"""
new5 = """          <div>
            <label className="block text-xs text-gray-500 mb-1" title="New member's subscription starts this date, rolled to the next trading day if it's a weekend/holiday. Renewals still extend from their existing expiry instead.">
              Payment date
            </label>
            <input
              type="date"
              required
              value={form.payment_date}
              max={todayStr()}
              onChange={(e) => setForm({ ...form, payment_date: e.target.value })}
              className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Plan paid for</label>"""
assert old5 in c, "old5 not found"
c = c.replace(old5, new5)

with open(path.replace('.tsx', '_new.tsx'), 'w') as f:
    f.write(c)
print("OK")
