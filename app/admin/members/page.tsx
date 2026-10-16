'use client'
// Oct 16 2026: manual payment-logging stopgap. No Razorpay webhook exists
// yet, so this is how a payment Manish sees in his Razorpay dashboard gets
// turned into a plan + expiry record on beta_users (was previously just a
// bare email with no plan or expiry tracked at all -- see
// services/admin_members.py on the backend for the full story).
// Restricted to Manish's own signed-in account; not linked from the navbar.
import Navbar from '@/components/Navbar'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

const API = 'https://api.greeknova.com'
const ADMIN_EMAIL = 'megha.jethmalani@gmail.com'

const PLAN_OPTIONS = [
  { value: 'founding', label: 'Founding — ₹3,999 (lifetime-locked, 100 seats)' },
  { value: 'monthly', label: 'Monthly — ₹499' },
  { value: 'quarterly', label: 'Quarterly — ₹1,399' },
  { value: 'semiannual', label: 'Semiannual — ₹2,699' },
  { value: 'annual', label: 'Annual (regular) — ₹4,999' },
]

interface Member {
  email: string
  name: string | null
  plan: string | null
  amount_paid: number | null
  paid_at: string | null
  expires_at: string | null
  invited_at: string | null
  days_left: number | null
  status: 'lapsed' | 'due_soon' | 'active' | 'no_expiry_on_record'
}

function statusPill(status: Member['status'], daysLeft: number | null) {
  const styles: Record<string, string> = {
    lapsed: 'bg-red-500/20 text-red-400 border-red-500/40',
    due_soon: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
    active: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
    no_expiry_on_record: 'bg-gray-500/20 text-gray-400 border-gray-500/40',
  }
  const text: Record<string, string> = {
    lapsed: `Lapsed ${daysLeft !== null ? Math.abs(daysLeft) + 'd ago' : ''}`,
    due_soon: `Due in ${daysLeft}d`,
    active: `Active (${daysLeft}d left)`,
    no_expiry_on_record: 'No plan on record',
  }
  return (
    <span className={`text-xs font-semibold px-2 py-1 rounded border ${styles[status]}`}>
      {text[status]}
    </span>
  )
}

export default function AdminMembersPage() {
  const [checking, setChecking] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [members, setMembers] = useState<Member[]>([])
  const [loadingMembers, setLoadingMembers] = useState(false)
  const [form, setForm] = useState({ email: '', name: '', plan: 'monthly' })
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)

  const loadMembers = useCallback(async () => {
    setLoadingMembers(true)
    try {
      const res = await fetch(`${API}/admin/members-overview`)
      const data = await res.json()
      if (res.ok) setMembers(data.members || [])
    } catch (e) {
      // ignore -- table just stays empty
    }
    setLoadingMembers(false)
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const email = (data.user?.email || '').toLowerCase().trim()
      setAuthorized(email === ADMIN_EMAIL)
      setChecking(false)
      if (email === ADMIN_EMAIL) loadMembers()
    })
  }, [loadMembers])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setResult(null)
    try {
      const res = await fetch(`${API}/admin/log-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        setResult({ ok: false, text: data.error || 'Something went wrong' })
      } else {
        setResult({
          ok: true,
          text: `${data.status === 'renewed' ? 'Renewed' : 'Added'} ${data.email} on ${data.plan_label} — expires ${new Date(data.expires_at).toLocaleDateString('en-IN')}`,
        })
        setForm({ email: '', name: '', plan: form.plan })
        loadMembers()
      }
    } catch (e) {
      setResult({ ok: false, text: 'Network error — please try again' })
    }
    setSubmitting(false)
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-[#07070e] text-white flex items-center justify-center">
        <p className="text-gray-500">Checking access…</p>
      </div>
    )
  }

  if (!authorized) {
    return (
      <div className="min-h-screen bg-[#07070e] text-white">
        <Navbar />
        <div className="flex flex-col items-center justify-center py-32">
          <h2 className="text-xl font-bold text-gray-400 mb-2">Not authorized</h2>
          <p className="text-sm text-gray-600">This page is restricted.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#07070e] text-white">
      <Navbar />
      <div className="max-w-5xl mx-auto px-6 py-8">
        <h1 className="text-xl font-black mb-1">Log a payment</h1>
        <p className="text-sm text-gray-500 mb-6">
          Manual stopgap — there&apos;s no Razorpay webhook yet, so after you see a payment land in your Razorpay dashboard, log it here. This records the plan and computes an expiry date, but <strong className="text-amber-400">access is not auto-revoked when a plan lapses</strong> — it&apos;s tracked here so you can see who&apos;s due, not enforced yet.
        </p>

        <form onSubmit={handleSubmit} className="bg-white/5 border border-white/10 rounded-lg p-5 mb-10 grid gap-4 sm:grid-cols-[2fr_1.5fr_2fr_auto] items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Email (who paid)</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="trader@example.com"
              className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Name (optional)</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="optional"
              className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Plan paid for</label>
            <select
              value={form.plan}
              onChange={(e) => setForm({ ...form, plan: e.target.value })}
              className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-sm"
            >
              {PLAN_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-bold px-5 py-2 rounded text-sm"
          >
            {submitting ? 'Saving…' : 'Log payment'}
          </button>
        </form>

        {result && (
          <div className={`mb-8 text-sm px-4 py-3 rounded border ${result.ok ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
            {result.text}
          </div>
        )}

        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold">Members ({members.length})</h2>
          <button onClick={loadMembers} className="text-xs text-gray-500 hover:text-gray-300">
            {loadingMembers ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
        <div className="border border-white/10 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-gray-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-2">Email</th>
                <th className="text-left px-4 py-2">Plan</th>
                <th className="text-left px-4 py-2">Paid</th>
                <th className="text-left px-4 py-2">Expires</th>
                <th className="text-left px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.email} className="border-t border-white/5">
                  <td className="px-4 py-2">{m.email}</td>
                  <td className="px-4 py-2 text-gray-400">{m.plan || '—'}{m.amount_paid ? ` (₹${m.amount_paid})` : ''}</td>
                  <td className="px-4 py-2 text-gray-500">{m.paid_at ? new Date(m.paid_at).toLocaleDateString('en-IN') : '—'}</td>
                  <td className="px-4 py-2 text-gray-500">{m.expires_at ? new Date(m.expires_at).toLocaleDateString('en-IN') : '—'}</td>
                  <td className="px-4 py-2">{statusPill(m.status, m.days_left)}</td>
                </tr>
              ))}
              {members.length === 0 && !loadingMembers && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-600">No members yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
