'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Settings, Check } from 'lucide-react'
import Navbar from '@/components/Navbar'
import { supabase, getSessionCached } from '@/lib/supabase'
import { DESTINATIONS, WIDGETS, widgetsByDestination, Destination } from '@/lib/widgetRegistry'

// Oct 14 2026: first pass at screen consolidation -- see lib/widgetRegistry.ts
// for the full rationale. This page is additive: every page it links to
// still works exactly as before at its own URL, nothing was removed. The
// only new thing is per-user, per-device-synced (Supabase, not localStorage)
// control over which tiles show by default in each of the 4 destinations.
//
// Same race-condition pattern as custom-scanner's saved scans: don't query
// dashboard_prefs until a real session is confirmed, or RLS will correctly
// but silently return nothing and defaults will look wrong for a split
// second. Customize mode (toggling widgets on/off) is hidden on small
// screens on purpose -- mobile gets the fixed, already-chosen set rather
// than a fiddly toggle UI, per Manish's call.
export default function DashboardPage() {
  const [activeDest, setActiveDest] = useState<Destination>('overview')
  const [prefs, setPrefs] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [customizing, setCustomizing] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [saveError, setSaveError] = useState('')

  const loadPrefs = useCallback(async () => {
    const { data: { session } } = await getSessionCached()
    if (!session) { window.location.href = '/login'; return }
    const { data, error } = await supabase
      .from('dashboard_prefs')
      .select('widget_key, enabled')
      .eq('user_id', session.user.id)
    if (!error && data) {
      const overrides: Record<string, boolean> = {}
      for (const row of data) overrides[row.widget_key] = row.enabled
      setPrefs(overrides)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadPrefs()
    const { data: sub } = supabase.auth.onAuthStateChange(() => { loadPrefs() })
    return () => sub.subscription.unsubscribe()
  }, [loadPrefs])

  function isEnabled(key: string) {
    const widget = WIDGETS.find(w => w.key === key)
    return prefs[key] ?? widget?.defaultEnabled ?? false
  }

  async function toggleWidget(key: string) {
    const next = !isEnabled(key)
    setPrefs(p => ({ ...p, [key]: next }))
    setSaveError('')
    const { data: { session } } = await getSessionCached()
    if (!session) return
    const { error } = await supabase
      .from('dashboard_prefs')
      .upsert({ user_id: session.user.id, widget_key: key, enabled: next, updated_at: new Date().toISOString() }, { onConflict: 'user_id,widget_key' })
    if (error) {
      setSaveError('Could not save that change. Please try again.')
      setPrefs(p => ({ ...p, [key]: !next }))
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950">
        <Navbar active="/dashboard" />
        <div className="flex items-center justify-center py-24">
          <div className="text-gray-400 text-sm">Loading your dashboard...</div>
        </div>
      </div>
    )
  }

  const destWidgets = widgetsByDestination(activeDest)
  const enabledWidgets = destWidgets.filter(w => isEnabled(w.key))
  // Oct 14 2026: "See All" is a read-only browse of every page in this
  // destination, on by default or not -- not an editing mode, so (unlike
  // Customize) it's available on mobile too. Lets someone reach a page
  // that isn't in their curated set without going into settings they may
  // not even have the controls for on a small screen.
  const visibleWidgets = customizing ? destWidgets : (showAll ? destWidgets : enabledWidgets)

  return (
    <div className="min-h-screen bg-gray-950">
      <Navbar active="/dashboard" />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">Dashboard</h1>
            <p className="text-gray-500 text-sm mt-1">Everything GreekNova has, organized into four places. Pick what you want to see.</p>
          </div>
          <div className="flex items-center gap-2">
            {!customizing && enabledWidgets.length < destWidgets.length && (
              <button
                onClick={() => setShowAll(s => !s)}
                className="flex items-center gap-1.5 bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-300 text-sm font-medium px-4 py-2 rounded-lg transition"
              >
                {showAll ? 'Show less' : `See all (${destWidgets.length})`}
              </button>
            )}
            <button
              onClick={() => { setCustomizing(c => !c); setShowAll(false) }}
              className="hidden md:flex items-center gap-2 bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-300 text-sm font-medium px-4 py-2 rounded-lg transition"
            >
              {customizing ? <Check size={16} /> : <Settings size={16} />}
              {customizing ? 'Done' : 'Customize'}
            </button>
          </div>
        </div>

        {saveError && <p className="text-red-400 text-sm mb-4">{saveError}</p>}

        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {DESTINATIONS.map(d => (
            <button
              key={d.id}
              onClick={() => { setActiveDest(d.id); setShowAll(false) }}
              className={`shrink-0 px-4 py-2 rounded-lg text-sm font-semibold transition border ${
                activeDest === d.id
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'bg-gray-900 border-gray-800 text-gray-400 hover:text-gray-200'
              }`}
            >
              {d.icon} {d.label}
            </button>
          ))}
        </div>

        {customizing && (
          <p className="text-gray-500 text-xs mb-4">
            Tap a tile to turn it on or off for this destination. Changes save instantly and follow you to any device.
          </p>
        )}

        {visibleWidgets.length === 0 && !customizing && (
          <div className="text-center py-16 text-gray-500 text-sm">
            Nothing enabled here yet. Tap <span className="text-gray-300">See all</span> to browse everything, or <span className="text-gray-300">Customize</span> to pick what shows by default.
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {visibleWidgets.map(w => {
            const enabled = isEnabled(w.key)
            if (customizing) {
              return (
                <button
                  key={w.key}
                  onClick={() => toggleWidget(w.key)}
                  className={`text-left p-4 rounded-xl border transition ${
                    enabled
                      ? 'bg-gray-900 border-blue-700/60'
                      : 'bg-gray-900/40 border-gray-800 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-white text-sm font-semibold">{w.label}</div>
                    <div className={`shrink-0 w-9 h-5 rounded-full relative transition ${enabled ? 'bg-blue-600' : 'bg-gray-700'}`}>
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition ${enabled ? 'left-4' : 'left-0.5'}`} />
                    </div>
                  </div>
                  <div className="text-gray-500 text-xs mt-1">{w.description}</div>
                </button>
              )
            }
            return (
              <Link
                key={w.key}
                href={w.href}
                className={`block p-4 rounded-xl bg-gray-900 border transition ${
                  enabled ? 'border-gray-800 hover:border-gray-700' : 'border-gray-800/50 opacity-50 hover:opacity-80'
                }`}
              >
                <div className="text-white text-sm font-semibold">{w.label}</div>
                <div className="text-gray-500 text-xs mt-1">{w.description}</div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
