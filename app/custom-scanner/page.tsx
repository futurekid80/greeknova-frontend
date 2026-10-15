'use client'
import Navbar from '@/components/Navbar'
import { useState, useCallback, useEffect } from 'react'
import { RefreshCw, Plus, X, Save, Trash2 } from 'lucide-react'
import { supabase, getSessionCached } from '@/lib/supabase'

const API = 'https://api.greeknova.com'

type StrikeSelect = 'ATM' | 'OTM1' | 'OTM2' | 'OTM5' | 'ITM1' | 'ITM2' | 'ITM5' | 'ANY'
type OptionType = 'CE' | 'PE'
type Direction = 'BUILD' | 'UNWIND'
type Link = 'AND' | 'OR'

interface Condition {
  strike_select: StrikeSelect
  option_type: OptionType
  direction: Direction
  link: Link  // ignored on the first condition
}

const STRIKE_OPTIONS: { value: StrikeSelect; label: string }[] = [
  { value: 'ATM',  label: 'ATM' },
  { value: 'OTM1', label: 'Next 1 OTM' },
  { value: 'OTM2', label: 'Next 2 OTM' },
  { value: 'OTM5', label: 'Next 5 OTM' },
  { value: 'ITM1', label: 'Next 1 ITM' },
  { value: 'ITM2', label: 'Next 2 ITM' },
  { value: 'ITM5', label: 'Next 5 ITM' },
  { value: 'ANY',  label: 'Any strike' },
]

function describeCondition(c: Condition): string {
  const zone = STRIKE_OPTIONS.find(s => s.value === c.strike_select)?.label || c.strike_select
  const side = c.option_type === 'CE' ? 'Call' : 'Put'
  const dir = c.direction === 'BUILD' ? 'addition' : 'unwinding'
  return `${zone} ${side} ${dir}`
}

function defaultCondition(link: Link = 'AND'): Condition {
  return { strike_select: 'ATM', option_type: 'CE', direction: 'UNWIND', link }
}

interface MatchDetail {
  condition_index: number
  strike: number
  option_type: string
  strikes_away: number
  oi_change: number
  oi_pct: number
}

interface ScanMatch {
  symbol: string
  cmp: number | null
  atm_strike: number | null
  is_index: boolean
  matched_conditions: MatchDetail[]
}

interface ScanResult {
  date: string | null
  ts_new: string | null
  total: number
  matches: ScanMatch[]
  error?: string
}

function fmtOI(n: number) {
  const abs = Math.abs(n)
  if (abs >= 10000000) return `${(n / 10000000).toFixed(2)}Cr`
  if (abs >= 100000) return `${(n / 100000).toFixed(1)}L`
  return n.toLocaleString()
}

function toIST(ts: string | null) {
  if (!ts) return '—'
  try {
    const clean = ts.split('+')[0].split('Z')[0]
    const dt = new Date(clean + 'Z')
    const ist = dt.getTime() + (5.5 * 60 * 60 * 1000)
    const d = new Date(ist)
    return `${d.getUTCHours().toString().padStart(2, '0')}:${d.getUTCMinutes().toString().padStart(2, '0')}`
  } catch { return '—' }
}

interface SavedScan {
  id: string
  name: string
  conditions: Condition[]
  last_run_at: string | null
}

export default function CustomScanner() {
  const [conditions, setConditions] = useState<Condition[]>([defaultCondition(), defaultCondition()])
  const [result, setResult] = useState<ScanResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [hasRun, setHasRun] = useState(false)

  const [savedScans, setSavedScans] = useState<SavedScan[]>([])
  const [selectedScanId, setSelectedScanId] = useState<string>('')
  const [savingName, setSavingName] = useState<string | null>(null)
  const [saveBusy, setSaveBusy] = useState(false)
  const [saveError, setSaveError] = useState('')

  const loadSavedScans = useCallback(async () => {
    const { data, error } = await supabase
      .from('saved_scans')
      .select('id, name, conditions, last_run_at')
      .order('created_at', { ascending: false })
    if (!error && data) setSavedScans(data as SavedScan[])
  }, [])

  // Oct 14 2026: on a fresh page load the Supabase client hasn't finished
  // restoring the login session from storage yet, so firing the saved_scans
  // query immediately ran as an anonymous request and silently came back
  // empty (RLS correctly hid every row) -- the dropdown looked broken even
  // though the save itself worked. Waiting for getSession() first, and
  // re-loading on any later auth state change, fixes that race.
  useEffect(() => {
    let cancelled = false
    getSessionCached().then(() => { if (!cancelled) loadSavedScans() })
    const { data: sub } = supabase.auth.onAuthStateChange(() => { loadSavedScans() })
    return () => { cancelled = true; sub.subscription.unsubscribe() }
  }, [loadSavedScans])

  const applyScan = (scan: SavedScan) => {
    setConditions(scan.conditions)
    setSelectedScanId(scan.id)
  }

  const handleSelectScan = (id: string) => {
    setSelectedScanId(id)
    if (!id) return
    const scan = savedScans.find(s => s.id === id)
    if (scan) applyScan(scan)
  }

  // Oct 14 2026: this used to fail silently -- the name box just closed with
  // no feedback whether the save actually went through, whether because the
  // login session wasn't ready yet or the insert itself was rejected. Now it
  // shows the actual reason and leaves the box open on failure so the name
  // isn't lost and the user can retry without redoing it.
  const saveCurrentScan = async () => {
    const name = (savingName || '').trim()
    if (!name) return
    setSaveBusy(true)
    setSaveError('')
    const { data: userData, error: userErr } = await supabase.auth.getUser()
    const userId = userData?.user?.id
    if (userErr || !userId) {
      setSaveError('Not signed in — please refresh the page and log in again, then retry.')
      setSaveBusy(false)
      return
    }
    const { data, error } = await supabase
      .from('saved_scans')
      .insert({ user_id: userId, name, conditions })
      .select('id, name, conditions, last_run_at')
      .single()
    if (error || !data) {
      setSaveError(error?.message || 'Could not save this scan. Please try again.')
      setSaveBusy(false)
      return
    }
    setSavedScans(cs => [data as SavedScan, ...cs])
    setSelectedScanId((data as SavedScan).id)
    setSavingName(null)
    setSaveBusy(false)
  }

  const deleteSelectedScan = async () => {
    if (!selectedScanId) return
    const { error } = await supabase.from('saved_scans').delete().eq('id', selectedScanId)
    if (!error) {
      setSavedScans(cs => cs.filter(s => s.id !== selectedScanId))
      setSelectedScanId('')
    } else {
      setSaveError(error.message || 'Could not delete this scan. Please try again.')
    }
  }

  const updateCondition = (i: number, patch: Partial<Condition>) => {
    setConditions(cs => cs.map((c, idx) => idx === i ? { ...c, ...patch } : c))
    setSelectedScanId('')
  }

  const addCondition = () => {
    if (conditions.length >= 3) return
    setConditions(cs => [...cs, defaultCondition('AND')])
    setSelectedScanId('')
  }

  const removeCondition = (i: number) => {
    if (conditions.length <= 1) return
    setConditions(cs => cs.filter((_, idx) => idx !== i))
    setSelectedScanId('')
  }

  // Oct 14 2026: remembers the last condition set in this browser so reopening
  // the scanner later the same day (or any day) doesn't start back at the
  // ATM/Unwinding default -- separate from named saved scans below, which are
  // explicit combinations the user wants to recall by name across devices.
  useEffect(() => {
    try {
      const raw = localStorage.getItem('gn_scanner_last_conditions')
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed) && parsed.length > 0) setConditions(parsed)
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    try { localStorage.setItem('gn_scanner_last_conditions', JSON.stringify(conditions)) } catch {}
  }, [conditions])

  const runScan = useCallback(async () => {
    setLoading(true)
    setHasRun(true)
    try {
      const res = await fetch(`${API}/custom-scanner`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conditions }),
      })
      const json = await res.json()
      setResult(json)
      if (selectedScanId) {
        supabase.from('saved_scans').update({ last_run_at: new Date().toISOString() }).eq('id', selectedScanId).then(() => {})
      }
    } catch (e) {
      console.error(e)
      setResult({ date: null, ts_new: null, total: 0, matches: [], error: 'Request failed' })
    }
    setLoading(false)
  }, [conditions, selectedScanId])

  return (
    <div className="min-h-screen bg-[#07070e] text-white">
      <Navbar active="/custom-scanner" />
      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-black tracking-tight mb-1">🎯 Custom Scanner</h1>
          <p className="text-gray-500 text-sm">
            Build your own OI condition and scan the whole F&amp;O universe for symbols matching it right now · 5-min snapshot comparison
          </p>
        </div>

        {/* Saved scans */}
        <div className="flex items-center gap-3 mb-2 flex-wrap">
          <select
            value={selectedScanId}
            onChange={e => handleSelectScan(e.target.value)}
            className="bg-gray-900 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-500 min-w-[220px]"
          >
            <option value="">
              {savedScans.length === 0 ? 'Saved scans…' : `Saved scans… (${savedScans.length})`}
            </option>
            {savedScans.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          {selectedScanId && (
            <button onClick={deleteSelectedScan}
              className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-red-400 border border-gray-700 rounded-lg px-3 py-2 transition-all">
              <Trash2 size={13} /> Delete
            </button>
          )}

          {savingName === null ? (
            <button onClick={() => setSavingName('')}
              className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-white border border-gray-700 rounded-lg px-3 py-2 transition-all">
              <Save size={13} /> Save this combination
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={savingName}
                onChange={e => setSavingName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveCurrentScan()}
                placeholder="Name this scan…"
                className="bg-gray-900 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-500 w-44"
              />
              <button onClick={saveCurrentScan} disabled={saveBusy || !savingName.trim()}
                className="text-xs font-bold text-cyan-400 hover:text-cyan-300 disabled:opacity-40 px-2">
                {saveBusy ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => { setSavingName(null); setSaveError('') }} className="text-xs text-gray-600 hover:text-gray-400 px-1">
                Cancel
              </button>
            </div>
          )}
        </div>

        {saveError && (
          <p className="text-red-400 text-xs mb-4">{saveError}</p>
        )}

        {/* Condition builder */}
        <div className="bg-gray-900/30 border border-gray-800 rounded-2xl p-5 mb-6">
          <div className="flex flex-col gap-3">
            {conditions.map((c, i) => (
              <div key={i} className="flex items-center gap-3 flex-wrap">
                {i === 0 ? (
                  <span className="w-12 text-xs font-bold text-gray-500">IF</span>
                ) : (
                  <div className="flex w-12 gap-0.5">
                    {(['AND', 'OR'] as const).map(l => (
                      <button key={l} onClick={() => updateCondition(i, { link: l })}
                        className={`flex-1 text-[10px] font-black py-1 rounded transition-all ${c.link === l
                          ? 'bg-cyan-950/60 text-cyan-400 border border-cyan-700'
                          : 'bg-gray-800/40 text-gray-500 border border-gray-700 hover:text-white'}`}>
                        {l}
                      </button>
                    ))}
                  </div>
                )}

                <select value={c.strike_select} onChange={e => updateCondition(i, { strike_select: e.target.value as StrikeSelect })}
                  className="bg-gray-900 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-500">
                  {STRIKE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>

                <div className="flex bg-gray-900 border border-gray-700 rounded-lg p-0.5">
                  {(['CE', 'PE'] as const).map(t => (
                    <button key={t} onClick={() => updateCondition(i, { option_type: t })}
                      className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${c.option_type === t
                        ? t === 'CE' ? 'bg-red-950/60 text-red-400' : 'bg-emerald-950/60 text-emerald-400'
                        : 'text-gray-500 hover:text-white'}`}>
                      {t === 'CE' ? 'Call' : 'Put'}
                    </button>
                  ))}
                </div>

                <div className="flex bg-gray-900 border border-gray-700 rounded-lg p-0.5">
                  {(['BUILD', 'UNWIND'] as const).map(d => (
                    <button key={d} onClick={() => updateCondition(i, { direction: d })}
                      className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${c.direction === d
                        ? d === 'BUILD' ? 'bg-emerald-950/60 text-emerald-400' : 'bg-orange-950/60 text-orange-400'
                        : 'text-gray-500 hover:text-white'}`}>
                      {d === 'BUILD' ? 'Addition' : 'Unwinding'}
                    </button>
                  ))}
                </div>

                <span className="text-xs text-gray-600 italic flex-1 min-w-[140px]">{describeCondition(c)}</span>

                {conditions.length > 1 && (
                  <button onClick={() => removeCondition(i)} className="text-gray-600 hover:text-red-400 transition-colors">
                    <X size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 mt-4 pt-4 border-t border-gray-800">
            {conditions.length < 3 && (
              <button onClick={addCondition}
                className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-white border border-gray-700 rounded-lg px-3 py-2 transition-all">
                <Plus size={13} /> Add condition (max 3)
              </button>
            )}
            <button onClick={runScan} disabled={loading}
              className="ml-auto flex items-center gap-2 px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-sm font-bold text-white rounded-lg transition-all disabled:opacity-50">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              {loading ? 'Scanning…' : 'Run Scan'}
            </button>
          </div>
        </div>

        {/* Results */}
        {hasRun && (
          <div>
            {result?.error ? (
              <div className="bg-amber-950/20 border border-amber-800/40 rounded-xl p-4 text-amber-400 text-sm">
                {result.error}
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <h2 className="text-lg font-bold">{result?.total ?? 0} symbols matched</h2>
                  <span className="text-xs text-gray-600">as of {toIST(result?.ts_new ?? null)} IST · {result?.date}</span>
                </div>

                {result && result.total === 0 ? (
                  <div className="h-40 flex items-center justify-center flex-col gap-2 text-gray-600 text-sm">
                    <div className="text-3xl">🔍</div>
                    No symbols currently match this combination — try loosening a condition (e.g. a wider OTM range, or Any strike).
                  </div>
                ) : (
                  <div className="bg-gray-900/20 border border-gray-800 rounded-2xl overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-800 text-gray-500">
                          <th className="py-3 px-4 text-left">Symbol</th>
                          <th className="py-3 px-3 text-right">CMP</th>
                          <th className="py-3 px-3 text-right">ATM</th>
                          <th className="py-3 px-4 text-left">Matched at</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result?.matches.map(m => (
                          <tr key={m.symbol} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                            <td className="py-2.5 px-4 font-bold text-white">
                              {m.symbol} {m.is_index && <span className="text-[9px] text-cyan-500 ml-1">INDEX</span>}
                            </td>
                            <td className="py-2.5 px-3 text-right text-gray-300">{m.cmp ? `₹${m.cmp.toLocaleString()}` : '—'}</td>
                            <td className="py-2.5 px-3 text-right text-amber-400 font-semibold">{m.atm_strike?.toLocaleString() ?? '—'}</td>
                            <td className="py-2.5 px-4">
                              <div className="flex flex-wrap gap-1.5">
                                {m.matched_conditions.map((d, idx) => (
                                  <span key={idx}
                                    className={`text-[10px] font-bold px-2 py-1 rounded-md border ${d.oi_change > 0
                                      ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/50'
                                      : 'bg-orange-950/40 text-orange-400 border-orange-800/50'}`}>
                                    #{d.condition_index + 1}: {d.strike.toLocaleString()} {d.option_type} ({d.oi_change > 0 ? '+' : ''}{fmtOI(d.oi_change)}, {d.oi_pct}%)
                                  </span>
                                ))}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {!hasRun && (
          <p className="text-xs text-gray-600">Set your conditions above and click Run Scan. Informational only — not investment advice.</p>
        )}
      </div>
    </div>
  )
}
