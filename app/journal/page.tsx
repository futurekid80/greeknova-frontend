'use client'
import Navbar from '@/components/Navbar'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, X, TrendingUp, TrendingDown, BookOpen, Brain, Trash2, ChevronDown, ChevronUp } from 'lucide-react'

const API = 'https://greeknova-backend-production.up.railway.app'

const SYMBOLS = [
  "NIFTY", "BANKNIFTY", "FINNIFTY",
  "RELIANCE","TCS","HDFCBANK","INFY","ICICIBANK","HINDUNILVR","ITC","SBIN",
  "BHARTIARTL","KOTAKBANK","LT","AXISBANK","ASIANPAINT","MARUTI","TITAN",
  "SUNPHARMA","ULTRACEMCO","BAJFINANCE","WIPRO","HCLTECH","TATACONSUM",
  "TATASTEEL","ADANIENT","POWERGRID","NTPC","ONGC","JSWSTEEL","COALINDIA",
  "BAJAJFINSV","TECHM","APOLLOHOSP","BAJAJ-AUTO","BPCL","BRITANNIA","CIPLA",
  "DRREDDY","EICHERMOT","GRASIM","HEROMOTOCO","HINDALCO","HDFCLIFE",
  "INDUSINDBK","JIOFIN","M&M","NESTLEIND","SBILIFE","SHRIRAMFIN","TRENT",
  "ADANIPORTS","BANKBARODA","BEL","CANBK","CHOLAFIN","DLF","GAIL","HAVELLS",
  "HAL","INDIGO","PFC","RECLTD","SAIL","TATAPOWER","VEDL",
]

const LOT_SIZES: Record<string, number> = {
  NIFTY: 75, BANKNIFTY: 30, FINNIFTY: 65,
  RELIANCE: 250, TCS: 175, HDFCBANK: 550, INFY: 300, ICICIBANK: 700,
  HINDUNILVR: 300, ITC: 1600, SBIN: 1500, BHARTIARTL: 500,
  KOTAKBANK: 400, LT: 150, AXISBANK: 625, ASIANPAINT: 200,
  MARUTI: 100, TITAN: 375, SUNPHARMA: 350, ULTRACEMCO: 100,
  BAJFINANCE: 500, WIPRO: 1500, HCLTECH: 350, TATACONSUM: 1350,
  TATASTEEL: 5500, ADANIENT: 125, POWERGRID: 2700, NTPC: 2250,
  ONGC: 1925, JSWSTEEL: 675, COALINDIA: 4200, BAJAJFINSV: 500,
  TECHM: 600, APOLLOHOSP: 125, 'BAJAJ-AUTO': 75, BPCL: 1800,
  BRITANNIA: 200, CIPLA: 650, DRREDDY: 125, EICHERMOT: 175,
  GRASIM: 475, HEROMOTOCO: 300, HINDALCO: 2150, HDFCLIFE: 1100,
  INDUSINDBK: 900, JIOFIN: 2500, 'M&M': 700, NESTLEIND: 400,
  SBILIFE: 750, SHRIRAMFIN: 500, TRENT: 350, ADANIPORTS: 625,
  BANKBARODA: 4300, BEL: 2900, CANBK: 8925, CHOLAFIN: 500,
  DLF: 1650, GAIL: 3825, HAVELLS: 500, HAL: 150, INDIGO: 300,
  PFC: 2700, RECLTD: 3000, SAIL: 10000, TATAPOWER: 3375, VEDL: 2000,
}

function getLotSize(symbol: string): number {
  return LOT_SIZES[symbol] || 500
}

interface Trade {
  id: string
  user_email: string
  symbol: string
  option_type: string
  strike: number
  action: string
  entry_price: number
  exit_price: number | null
  quantity: number
  entry_date: string
  exit_date: string | null
  notes: string | null
  status: string
  ivr_at_entry: number | null
  pcr_at_entry: number | null
  dte_at_entry: number | null
  max_pain_entry: number | null
  iv_at_entry: number | null
  created_at: string
}

interface AddTradeForm {
  symbol: string
  option_type: string
  strike: string
  action: string
  entry_price: string
  quantity: string
  entry_date: string
  notes: string
}

const DEFAULT_FORM: AddTradeForm = {
  symbol: 'NIFTY',
  option_type: 'CE',
  strike: '',
  action: 'BUY',
  entry_price: '',
  quantity: '1',
  entry_date: new Date().toISOString().split('T')[0],
  notes: '',
}

function pnl(trade: Trade): number | null {
  if (!trade.exit_price) return null
  const lotSize = getLotSize(trade.symbol)
  const multiplier = trade.action === 'BUY' ? 1 : -1
  return multiplier * (trade.exit_price - trade.entry_price) * trade.quantity * lotSize
}

function PnLBadge({ trade }: { trade: Trade }) {
  const p = pnl(trade)
  if (p === null) return <span className="text-xs text-gray-500">Open</span>
  return (
    <span className={`text-sm font-black ${p >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
      {p >= 0 ? '+' : ''}₹{Math.abs(p).toLocaleString('en-IN')}
    </span>
  )
}

export default function TradingJournal() {
  const [trades, setTrades]         = useState<Trade[]>([])
  const [loading, setLoading]       = useState(true)
  const [userEmail, setUserEmail]   = useState('')
  const [userId, setUserId]         = useState('')
  const [showAdd, setShowAdd]       = useState(false)
  const [showClose, setShowClose]   = useState<string | null>(null)
  const [exitPrice, setExitPrice]   = useState('')
  const [exitDate, setExitDate]     = useState(new Date().toISOString().split('T')[0])
  const [form, setForm]             = useState<AddTradeForm>(DEFAULT_FORM)
  const [saving, setSaving]         = useState(false)
  const [symbolSearch, setSymbolSearch] = useState('')
  const [showSymbolDrop, setShowSymbolDrop] = useState(false)
  const [insights, setInsights]     = useState('')
  const [loadingInsights, setLoadingInsights] = useState(false)
  const [showInsights, setShowInsights]         = useState(false)
  const [insightMode, setInsightMode]           = useState<'pattern'|'live'>('pattern')
  const [statusFilter, setStatusFilter]         = useState<'ALL'|'OPEN'|'CLOSED'>('ALL')

  // Load session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUserEmail(session.user.email || '')
        setUserId(session.user.id)
      }
    })
  }, [])

  // Load trades
  const loadTrades = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    const { data, error } = await supabase
      .from('trading_journal')
      .select('*')
      .order('entry_date', { ascending: false })
    if (!error && data) setTrades(data)
    setLoading(false)
  }, [userId])

  useEffect(() => { if (userId) loadTrades() }, [userId, loadTrades])

  // Summary stats
  const openTrades   = trades.filter(t => t.status === 'OPEN')
  const closedTrades = trades.filter(t => t.status === 'CLOSED')
  const totalPnL     = closedTrades.reduce((sum, t) => sum + (pnl(t) || 0), 0)
  const winners      = closedTrades.filter(t => (pnl(t) || 0) > 0)
  const winRate      = closedTrades.length > 0
    ? Math.round(winners.length / closedTrades.length * 100)
    : 0

  // Fetch market context at entry
  async function fetchContext(symbol: string) {
    try {
      const res  = await fetch(`${API}/iv-analysis/${symbol}`)
      const json = await res.json()
      if (json.results?.[0]) {
        const r = json.results[0]
        return {
          ivr_at_entry:   r.ivr,
          iv_at_entry:    r.current_iv,
          dte_at_entry:   r.dte,
        }
      }
    } catch {}

    try {
      const res  = await fetch(`${API}/ask-context/${symbol}`)
      const json = await res.json()
      const ctx  = json.context || ''
      const pcr  = ctx.match(/Current PCR: ([\d.]+)/)?.[1]
      const mp   = ctx.match(/Max Pain: ([\d,]+)/)?.[1]
      return {
        pcr_at_entry:   pcr ? parseFloat(pcr) : null,
        max_pain_entry: mp  ? parseFloat(mp.replace(',','')) : null,
      }
    } catch {}
    return {}
  }

  // Save new trade
  async function saveTrade() {
    if (!form.symbol || !form.strike || !form.entry_price || !userId) return
    setSaving(true)

    const context = await fetchContext(form.symbol)

    const { error } = await supabase.from('trading_journal').insert({
      user_id:     userId,
      user_email:  userEmail,
      symbol:      form.symbol,
      option_type: form.option_type,
      strike:      parseFloat(form.strike),
      action:      form.action,
      entry_price: parseFloat(form.entry_price),
      quantity:    parseInt(form.quantity),
      entry_date:  form.entry_date,
      notes:       form.notes || null,
      status:      'OPEN',
      ...context,
    })

    if (!error) {
      setForm(DEFAULT_FORM)
      setShowAdd(false)
      await loadTrades()
    }
    setSaving(false)
  }

  // Close a trade
  async function closeTrade(tradeId: string) {
    if (!exitPrice) return
    setSaving(true)
    const { error } = await supabase
      .from('trading_journal')
      .update({
        exit_price: parseFloat(exitPrice),
        exit_date:  exitDate,
        status:     'CLOSED',
        updated_at: new Date().toISOString(),
      })
      .eq('id', tradeId)

    if (!error) {
      setShowClose(null)
      setExitPrice('')
      await loadTrades()
    }
    setSaving(false)
  }

  // Delete a trade
  async function deleteTrade(tradeId: string) {
    if (!confirm('Delete this trade?')) return
    await supabase.from('trading_journal').delete().eq('id', tradeId)
    await loadTrades()
  }

  // Claude insights
  async function getInsights() {
    if (closedTrades.length < 3) return
    setLoadingInsights(true)
    setShowInsights(true)

    const tradeSummary = closedTrades.slice(0, 20).map(t => ({
      symbol:     t.symbol,
      type:       `${t.action} ${t.strike} ${t.option_type}`,
      entry:      t.entry_price,
      exit:       t.exit_price,
      pnl:        pnl(t),
      ivr:        t.ivr_at_entry,
      pcr:        t.pcr_at_entry,
      dte:        t.dte_at_entry,
      max_pain:   t.max_pain_entry,
      date:       t.entry_date,
    }))

    const prompt = `You are analyzing a trader's options journal from NSE India.
Return ONLY a JSON object — no markdown, no explanation, no backticks.

Trades data:
${JSON.stringify(tradeSummary, null, 2)}

Return this exact JSON structure:
{
  "stats": {
    "win_rate": 40,
    "total_pnl": -2400,
    "winners": 2,
    "losers": 3,
    "avg_winner": 3200,
    "avg_loser": -1800,
    "best_trade": "NIFTY BUY +3200",
    "worst_trade": "BANKNIFTY BUY -2100"
  },
  "patterns": [
    {
      "finding": "short title e.g. High IVR entries",
      "detail": "specific observation with numbers e.g. 3 of 4 losses had IVR > 60 at entry",
      "signal": "NEGATIVE" or "POSITIVE" or "NEUTRAL"
    }
  ],
  "top_insight": "single most important pattern observed — specific and data-driven",
  "disclaimer": "Pattern analysis based on journal data. Not investment advice."
}`

    try {
      const res  = await fetch(`${API}/ask-claude`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          system:   'You are a trading journal analyst. Return ONLY valid JSON, no markdown fences, no explanation. Be specific and data-driven. Never give buy/sell/hold recommendations.',
          messages: [{ role: 'user', content: prompt }],
        }),
      })
      const data = await res.json()
      try {
        const parsed = JSON.parse(data.content)
        setInsights(JSON.stringify(parsed))
      } catch {
        const match = data.content?.match(/\{[\s\S]*\}/)
        setInsights(match ? match[0] : data.content || 'Could not generate insights')
      }
    } catch {
      setInsights('{"error": "Failed to load insights. Please try again."}')
    }
    setLoadingInsights(false)
  }

  // Live position review — works with any open trade
  async function getLiveReview() {
    if (openTrades.length === 0) return
    setLoadingInsights(true)
    setInsightMode('live')
    setShowInsights(true)

    // Fetch current market context for each open position
    const positionReviews = await Promise.all(
      openTrades.slice(0, 5).map(async (t) => {
        try {
          const res  = await fetch(`${API}/iv-analysis/${t.symbol}`)
          const json = await res.json()
          const iv   = json.results?.[0]
          return {
            symbol:          t.symbol,
            strike:          t.strike,
            option_type:     t.option_type,
            action:          t.action,
            entry_price:     t.entry_price,
            entry_date:      t.entry_date,
            ivr_at_entry:    t.ivr_at_entry,
            iv_at_entry:     t.iv_at_entry,
            dte_at_entry:    t.dte_at_entry,
            current_ivr:     iv?.ivr ?? null,
            current_iv:      iv?.current_iv ?? null,
            current_dte:     iv?.dte ?? null,
            expected_move:   iv?.expected_move_pts ?? null,
            upper_range:     iv?.upper_range ?? null,
            lower_range:     iv?.lower_range ?? null,
            atm_straddle:    iv?.atm_straddle ?? null,
          }
        } catch {
          return { symbol: t.symbol, strike: t.strike, error: true }
        }
      })
    )

    const prompt = `You are reviewing a trader's open options positions on NSE India.
Return ONLY a JSON object — no markdown, no explanation, no backticks.

Data for each position:
${JSON.stringify(positionReviews, null, 2)}

Return this exact JSON structure:
{
  "positions": [
    {
      "symbol": "SUNPHARMA",
      "strike": 1900,
      "option_type": "CE",
      "action": "BUY",
      "entry_price": 18.7,
      "iv_change": {
        "entry": 14.4,
        "current": 19.0,
        "direction": "UP",
        "meaning": "one sentence — what this means for the position"
      },
      "dte_change": {
        "entry": 9,
        "current": 7,
        "days_elapsed": 2,
        "meaning": "one sentence about time decay impact"
      },
      "strike_vs_range": {
        "position": "INSIDE" or "ABOVE" or "BELOW" or "AT_TOP" or "AT_BOTTOM",
        "upper": 1912,
        "lower": 1843,
        "meaning": "one sentence — where strike sits in expected range"
      },
      "key_observation": "one concise factual observation about this position",
      "signals": ["signal 1", "signal 2"]
    }
  ],
  "summary": "one overall summary sentence"
}`

    try {
      const res  = await fetch(`${API}/ask-claude`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          system:   'You are a trading position analyst. Return ONLY valid JSON, no markdown fences, no explanation. Be factual with numbers. Never say buy/sell/hold/exit.',
          messages: [{ role: 'user', content: prompt }],
        }),
      })
      const data = await res.json()
      // Parse JSON response
      try {
        const parsed = JSON.parse(data.content)
        setInsights(JSON.stringify(parsed))
      } catch {
        // Fallback: try to extract JSON from response
        const match = data.content?.match(/\{[\s\S]*\}/)
        setInsights(match ? match[0] : data.content || 'Could not generate review')
      }
    } catch {
      setInsights('{"error": "Failed to load position review. Please try again."}')
    }
    setLoadingInsights(false)
  }

  const filteredTrades = trades.filter(t =>
    statusFilter === 'ALL' || t.status === statusFilter
  )

  const filteredSymbols = SYMBOLS.filter(s =>
    s.toLowerCase().includes(symbolSearch.toLowerCase())
  )

  if (!userEmail) {
    return (
      <div className="min-h-screen bg-[#07070e] text-white">
        <Navbar active="/journal"/>
        <div className="flex flex-col items-center justify-center py-32">
          <div className="text-5xl mb-4">📓</div>
          <h2 className="text-xl font-bold text-gray-400 mb-2">Login required</h2>
          <p className="text-sm text-gray-600">Please login to access your trading journal</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#07070e] text-white">
      <Navbar active="/journal"/>

      <div className="max-w-6xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="text-3xl font-black tracking-tight mb-1 flex items-center gap-3">
              📓 Trading Journal
            </h1>
            <p className="text-gray-500 text-sm">
              {userEmail} · Private journal · Market context auto-attached at entry
            </p>
          </div>
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-xl transition-all">
            <Plus size={16}/>Log Trade
          </button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Total Trades</p>
            <p className="text-2xl font-black text-white">{trades.length}</p>
            <p className="text-xs text-gray-600">{openTrades.length} open · {closedTrades.length} closed</p>
          </div>
          <div className={`border rounded-xl p-4 ${totalPnL >= 0 ? 'bg-emerald-950/20 border-emerald-800/40' : 'bg-red-950/20 border-red-800/40'}`}>
            <p className="text-xs text-gray-500 mb-1">Total P&L</p>
            <p className={`text-2xl font-black ${totalPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {totalPnL >= 0 ? '+' : ''}₹{Math.abs(totalPnL).toLocaleString('en-IN')}
            </p>
            <p className="text-xs text-gray-600">closed trades only</p>
          </div>
          <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Win Rate</p>
            <p className={`text-2xl font-black ${winRate >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>
              {winRate}%
            </p>
            <p className="text-xs text-gray-600">{winners.length}/{closedTrades.length} winners</p>
          </div>
          <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-4 flex flex-col gap-2">
            <p className="text-xs text-gray-500">🧠 Claude AI</p>
            {/* Live review — works immediately with open trades */}
            <button
              onClick={getLiveReview}
              disabled={openTrades.length === 0 || loadingInsights}
              className="w-full flex items-center justify-between px-3 py-2 bg-emerald-950/40 border border-emerald-800/40 rounded-lg text-xs font-bold text-emerald-400 hover:bg-emerald-950/60 transition-all disabled:opacity-40">
              <span>📍 Review open positions</span>
              <span>→</span>
            </button>
            {/* Pattern analysis — needs 3 closed trades */}
            <button
              onClick={() => { setInsightMode('pattern'); getInsights() }}
              disabled={closedTrades.length < 3 || loadingInsights}
              className="w-full flex items-center justify-between px-3 py-2 bg-purple-950/40 border border-purple-800/40 rounded-lg text-xs font-bold text-purple-400 hover:bg-purple-950/60 transition-all disabled:opacity-40">
              <span>📊 Pattern analysis</span>
              <span>{closedTrades.length < 3 ? `(need ${3 - closedTrades.length} more)` : '→'}</span>
            </button>
          </div>
        </div>

        {/* AI Insights Panel */}
        {showInsights && (
          <div className="bg-purple-950/20 border border-purple-800/40 rounded-2xl p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-purple-400 flex items-center gap-2">
                <Brain size={16}/>
                {insightMode === 'live' ? '📍 Live Position Review' : '📊 Pattern Analysis'}
              </h3>
              <button onClick={() => setShowInsights(false)} className="text-gray-600 hover:text-white">
                <X size={16}/>
              </button>
            </div>

            {loadingInsights ? (
              <div className="flex items-center gap-3 text-sm text-gray-500">
                <div className="flex gap-1">
                  {[0,1,2].map(i => (
                    <div key={i} className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce"
                      style={{ animationDelay: `${i*150}ms` }}/>
                  ))}
                </div>
                {insightMode === 'live'
                  ? `Fetching live data for ${openTrades.length} position${openTrades.length > 1 ? 's' : ''}...`
                  : `Analysing ${closedTrades.length} closed trades...`
                }
              </div>
            ) : (() => {
              try {
                const data = JSON.parse(insights)
                if (data.error) return <p className="text-sm text-red-400">{data.error}</p>

                // ── LIVE POSITION REVIEW RENDERER ──────────────────────────
                if (insightMode === 'live' && data.positions) {
                  return (
                    <div className="space-y-4">
                      {data.positions.map((p: any, i: number) => (
                        <div key={i} className="bg-gray-900/50 border border-gray-700 rounded-xl p-4">
                          {/* Position header */}
                          <div className="flex items-center gap-2 mb-4">
                            <span className="text-base font-black text-white">{p.symbol}</span>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded ${p.option_type==='CE' ? 'bg-red-950/50 text-red-400' : 'bg-emerald-950/50 text-emerald-400'}`}>
                              {p.strike} {p.option_type}
                            </span>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded ${p.action==='BUY' ? 'bg-emerald-950/50 text-emerald-400' : 'bg-red-950/50 text-red-400'}`}>
                              {p.action}
                            </span>
                            <span className="text-xs text-gray-500 ml-auto">Entry ₹{p.entry_price}</span>
                          </div>

                          {/* Metrics table */}
                          <div className="grid grid-cols-3 gap-3 mb-4">
                            {/* IV Change */}
                            {p.iv_change && (
                              <div className="bg-gray-800/50 rounded-xl p-3">
                                <p className="text-[10px] text-gray-500 mb-1">Implied Volatility</p>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-bold text-gray-400">{p.iv_change.entry}%</span>
                                  <span className="text-xs text-gray-600">→</span>
                                  <span className={`text-sm font-black ${p.iv_change.direction === 'UP' ? 'text-orange-400' : 'text-emerald-400'}`}>
                                    {p.iv_change.current}%
                                  </span>
                                  <span className={`text-[10px] px-1 py-0.5 rounded font-bold ${p.iv_change.direction === 'UP' ? 'bg-orange-950/50 text-orange-400' : 'bg-emerald-950/50 text-emerald-400'}`}>
                                    {p.iv_change.direction}
                                  </span>
                                </div>
                                <p className="text-[10px] text-gray-500 mt-1">{p.iv_change.meaning}</p>
                              </div>
                            )}

                            {/* DTE Change */}
                            {p.dte_change && (
                              <div className="bg-gray-800/50 rounded-xl p-3">
                                <p className="text-[10px] text-gray-500 mb-1">Days to Expiry</p>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-bold text-gray-400">{p.dte_change.entry}d</span>
                                  <span className="text-xs text-gray-600">→</span>
                                  <span className={`text-sm font-black ${p.dte_change.current <= 3 ? 'text-red-400' : 'text-white'}`}>
                                    {p.dte_change.current}d
                                  </span>
                                </div>
                                <p className="text-[10px] text-gray-500 mt-1">{p.dte_change.days_elapsed}d elapsed · {p.dte_change.meaning}</p>
                              </div>
                            )}

                            {/* Strike vs Range */}
                            {p.strike_vs_range && (
                              <div className="bg-gray-800/50 rounded-xl p-3">
                                <p className="text-[10px] text-gray-500 mb-1">Strike vs Expected Range</p>
                                <span className={`text-xs font-black px-2 py-1 rounded-lg ${
                                  p.strike_vs_range.position === 'INSIDE'     ? 'bg-emerald-950/50 text-emerald-400' :
                                  p.strike_vs_range.position === 'AT_TOP'     ? 'bg-amber-950/50 text-amber-400' :
                                  p.strike_vs_range.position === 'AT_BOTTOM'  ? 'bg-amber-950/50 text-amber-400' :
                                  'bg-red-950/50 text-red-400'
                                }`}>
                                  {p.strike_vs_range.position.replace('_', ' ')}
                                </span>
                                <p className="text-[10px] text-gray-500 mt-1">
                                  Range: {p.strike_vs_range.lower} – {p.strike_vs_range.upper}
                                </p>
                              </div>
                            )}
                          </div>

                          {/* Key observation */}
                          {p.key_observation && (
                            <div className="bg-blue-950/20 border border-blue-800/30 rounded-xl px-4 py-3 mb-3">
                              <p className="text-xs text-blue-300">💡 {p.key_observation}</p>
                            </div>
                          )}

                          {/* Signal tags */}
                          {p.signals?.length > 0 && (
                            <div className="flex gap-2 flex-wrap">
                              {p.signals.map((s: string, j: number) => (
                                <span key={j} className="text-[10px] px-2 py-1 bg-gray-800 border border-gray-700 rounded-lg text-gray-400">
                                  {s}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}

                      {/* Summary */}
                      {data.summary && (
                        <p className="text-xs text-gray-500 text-center pt-2">
                          📊 {data.summary} · Not investment advice
                        </p>
                      )}
                    </div>
                  )
                }

                // ── PATTERN ANALYSIS RENDERER ──────────────────────────────
                if (insightMode === 'pattern' && data.stats) {
                  return (
                    <div className="space-y-4">
                      {/* Stats row */}
                      <div className="grid grid-cols-4 gap-3">
                        {[
                          { label: 'Win Rate',    val: `${data.stats.win_rate}%`,   color: data.stats.win_rate >= 50 ? 'text-emerald-400' : 'text-red-400' },
                          { label: 'Total P&L',   val: `${data.stats.total_pnl >= 0 ? '+' : ''}₹${Math.abs(data.stats.total_pnl).toLocaleString()}`, color: data.stats.total_pnl >= 0 ? 'text-emerald-400' : 'text-red-400' },
                          { label: 'Avg Winner',  val: `+₹${data.stats.avg_winner?.toLocaleString() || '—'}`, color: 'text-emerald-400' },
                          { label: 'Avg Loser',   val: `-₹${Math.abs(data.stats.avg_loser || 0).toLocaleString()}`, color: 'text-red-400' },
                        ].map(({ label, val, color }) => (
                          <div key={label} className="bg-gray-900/50 border border-gray-700 rounded-xl p-3 text-center">
                            <p className="text-[10px] text-gray-500 mb-1">{label}</p>
                            <p className={`text-lg font-black ${color}`}>{val}</p>
                          </div>
                        ))}
                      </div>

                      {/* Patterns */}
                      {data.patterns?.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-bold text-gray-400 mb-2">Patterns Found:</p>
                          {data.patterns.map((p: any, i: number) => (
                            <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border ${
                              p.signal === 'POSITIVE' ? 'bg-emerald-950/20 border-emerald-800/30' :
                              p.signal === 'NEGATIVE' ? 'bg-red-950/20 border-red-800/30' :
                              'bg-gray-800/30 border-gray-700'
                            }`}>
                              <span className="text-base flex-shrink-0">
                                {p.signal === 'POSITIVE' ? '✅' : p.signal === 'NEGATIVE' ? '⚠️' : 'ℹ️'}
                              </span>
                              <div>
                                <p className={`text-xs font-bold mb-0.5 ${
                                  p.signal === 'POSITIVE' ? 'text-emerald-400' :
                                  p.signal === 'NEGATIVE' ? 'text-red-400' : 'text-gray-300'
                                }`}>{p.finding}</p>
                                <p className="text-xs text-gray-500">{p.detail}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Top insight */}
                      {data.top_insight && (
                        <div className="bg-purple-950/30 border border-purple-800/40 rounded-xl p-4">
                          <p className="text-xs font-bold text-purple-400 mb-1">🎯 Key Insight</p>
                          <p className="text-sm text-gray-300">{data.top_insight}</p>
                        </div>
                      )}

                      {/* Best/worst */}
                      {(data.stats.best_trade || data.stats.worst_trade) && (
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-emerald-950/10 border border-emerald-800/20 rounded-xl p-3">
                            <p className="text-[10px] text-gray-500 mb-1">Best Trade</p>
                            <p className="text-xs font-bold text-emerald-400">{data.stats.best_trade}</p>
                          </div>
                          <div className="bg-red-950/10 border border-red-800/20 rounded-xl p-3">
                            <p className="text-[10px] text-gray-500 mb-1">Worst Trade</p>
                            <p className="text-xs font-bold text-red-400">{data.stats.worst_trade}</p>
                          </div>
                        </div>
                      )}

                      <p className="text-[10px] text-gray-600 text-center">{data.disclaimer}</p>
                    </div>
                  )
                }

                // Fallback — raw text if JSON structure unexpected
                return <p className="text-sm text-gray-300 whitespace-pre-wrap">{insights}</p>

              } catch {
                // Not JSON — render as plain text
                return <p className="text-sm text-gray-300 whitespace-pre-wrap">{insights}</p>
              }
            })()}
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-2 mb-4">
          {(['ALL','OPEN','CLOSED'] as const).map(f => (
            <button key={f} onClick={() => setStatusFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${statusFilter===f
                ? f==='OPEN' ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                : f==='CLOSED' ? 'bg-gray-800 text-white border-gray-600'
                : 'bg-white text-gray-900 border-white'
                : 'bg-gray-900/40 text-gray-400 border-gray-800 hover:text-white'}`}>
              {f} {f==='OPEN' ? `(${openTrades.length})` : f==='CLOSED' ? `(${closedTrades.length})` : `(${trades.length})`}
            </button>
          ))}
        </div>

        {/* Trade list */}
        {loading ? (
          <div className="space-y-2">{[1,2,3].map(i => (
            <div key={i} className="h-20 bg-gray-900/30 border border-gray-800 rounded-xl animate-pulse"/>
          ))}</div>
        ) : filteredTrades.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 border border-gray-800/50 rounded-2xl">
            <div className="text-5xl mb-4">📓</div>
            <h3 className="text-lg font-bold text-gray-400 mb-2">No trades yet</h3>
            <p className="text-sm text-gray-600 mb-4">Log your first trade to start tracking your options journey</p>
            <button onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-xl">
              <Plus size={14}/>Log First Trade
            </button>
          </div>
        ) : (
          <div className="rounded-2xl border border-gray-800 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-900/60 border-b border-gray-800">
                  {['Date','Trade','Entry','Exit','P&L','Context at Entry','Notes',''].map((h,i) => (
                    <th key={h} className={`text-xs font-semibold text-gray-500 px-4 py-3.5 ${i===0?'pl-5 text-left':i<=2?'text-left':'text-right'} ${i===7?'pr-5':''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredTrades.map((trade, i) => {
                  const p = pnl(trade)
                  return (
                    <tr key={trade.id} className={`border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors ${i%2===0?'':'bg-gray-900/20'}`}>

                      {/* Date */}
                      <td className="px-5 py-3.5">
                        <p className="text-xs text-gray-400">{trade.entry_date}</p>
                        {trade.exit_date && <p className="text-xs text-gray-600">→ {trade.exit_date}</p>}
                      </td>

                      {/* Trade */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-black text-white">{trade.symbol}</span>
                          <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${trade.option_type==='CE' ? 'bg-red-950/50 text-red-400' : 'bg-emerald-950/50 text-emerald-400'}`}>
                            {trade.strike} {trade.option_type}
                          </span>
                          <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${trade.action==='BUY' ? 'bg-emerald-950/50 text-emerald-400' : 'bg-red-950/50 text-red-400'}`}>
                            {trade.action}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600">{trade.quantity} lot{trade.quantity>1?'s':''} · Lot: {getLotSize(trade.symbol)}</p>
                      </td>

                      {/* Entry */}
                      <td className="px-4 py-3.5">
                        <p className="text-sm font-bold text-amber-400">₹{trade.entry_price}</p>
                      </td>

                      {/* Exit */}
                      <td className="px-4 py-3.5 text-right">
                        {trade.exit_price
                          ? <p className="text-sm font-bold text-white">₹{trade.exit_price}</p>
                          : <span className="text-xs text-gray-600">—</span>
                        }
                      </td>

                      {/* P&L */}
                      <td className="px-4 py-3.5 text-right">
                        {p !== null ? (
                          <p className={`text-sm font-black ${p >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {p >= 0 ? '+' : ''}₹{Math.abs(p).toLocaleString('en-IN')}
                          </p>
                        ) : (
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold
                            ${trade.status === 'OPEN' ? 'bg-emerald-950/30 text-emerald-400 border-emerald-800/50' : 'bg-gray-800 text-gray-400 border-gray-700'}`}>
                            {trade.status}
                          </span>
                        )}
                      </td>

                      {/* Context */}
                      <td className="px-4 py-3.5 text-right">
                        <div className="text-xs space-y-0.5">
                          {trade.ivr_at_entry !== null && (
                            <p className={trade.ivr_at_entry >= 75 ? 'text-red-400' : trade.ivr_at_entry <= 25 ? 'text-emerald-400' : 'text-gray-400'}>
                              IVR {trade.ivr_at_entry}
                            </p>
                          )}
                          {trade.pcr_at_entry !== null && (
                            <p className="text-gray-500">PCR {trade.pcr_at_entry}</p>
                          )}
                          {trade.dte_at_entry !== null && (
                            <p className="text-gray-500">{trade.dte_at_entry}d to expiry</p>
                          )}
                        </div>
                      </td>

                      {/* Notes */}
                      <td className="px-4 py-3.5 text-right">
                        <p className="text-xs text-gray-500 max-w-[120px] truncate">{trade.notes || '—'}</p>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center gap-2 justify-end">
                          {trade.status === 'OPEN' && (
                            <button onClick={() => { setShowClose(trade.id); setExitPrice('') }}
                              className="text-xs px-2.5 py-1.5 bg-emerald-950/40 text-emerald-400 border border-emerald-800/50 rounded-lg hover:bg-emerald-950 transition-all">
                              Close
                            </button>
                          )}
                          <button onClick={() => deleteTrade(trade.id)}
                            className="text-gray-600 hover:text-red-400 transition-colors">
                            <Trash2 size={13}/>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Disclaimer */}
        <div className="mt-8 bg-gray-900/20 border border-gray-800/40 rounded-xl p-4">
          <p className="text-xs text-gray-600">
            <span className="text-gray-400 font-semibold">Note:</span> Market context (IVR, PCR, DTE) is fetched from GreekNova at time of logging.
            P&L is calculated using standard lot sizes. Journal is private — only visible to you.
            Not investment advice.
          </p>
        </div>
      </div>

      {/* Add Trade Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowAdd(false)}/>
          <div className="relative w-full max-w-md bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-white">Log New Trade</h3>
              <button onClick={() => setShowAdd(false)} className="text-gray-600 hover:text-white"><X size={18}/></button>
            </div>

            <div className="space-y-4">

              {/* Symbol */}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Symbol</label>
                <div className="relative">
                  <input
                    value={symbolSearch || form.symbol}
                    onChange={e => { setSymbolSearch(e.target.value); setShowSymbolDrop(true) }}
                    onFocus={() => setShowSymbolDrop(true)}
                    placeholder="Type to search..."
                    className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-emerald-500"
                  />
                  {showSymbolDrop && filteredSymbols.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-10 max-h-48 overflow-y-auto">
                      {filteredSymbols.map(s => (
                        <button key={s} onClick={() => {
                          setForm(f => ({ ...f, symbol: s }))
                          setSymbolSearch('')
                          setShowSymbolDrop(false)
                        }} className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors">
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-xs text-emerald-400 mt-1">Selected: {form.symbol} · Lot size: {getLotSize(form.symbol)}</p>
              </div>

              {/* Option Type + Action */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Option Type</label>
                  <div className="flex gap-2">
                    {['CE','PE'].map(t => (
                      <button key={t} onClick={() => setForm(f => ({...f, option_type: t}))}
                        className={`flex-1 py-2 rounded-xl text-sm font-bold border transition-all ${form.option_type===t
                          ? t==='CE' ? 'bg-red-950/60 text-red-400 border-red-800' : 'bg-emerald-950/60 text-emerald-400 border-emerald-800'
                          : 'bg-gray-800 text-gray-500 border-gray-700'}`}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Action</label>
                  <div className="flex gap-2">
                    {['BUY','SELL'].map(a => (
                      <button key={a} onClick={() => setForm(f => ({...f, action: a}))}
                        className={`flex-1 py-2 rounded-xl text-sm font-bold border transition-all ${form.action===a
                          ? a==='BUY' ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800' : 'bg-red-950/60 text-red-400 border-red-800'
                          : 'bg-gray-800 text-gray-500 border-gray-700'}`}>
                        {a}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Strike + Entry Price */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Strike</label>
                  <input type="number" value={form.strike}
                    onChange={e => setForm(f => ({...f, strike: e.target.value}))}
                    placeholder="e.g. 23700"
                    className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-emerald-500"/>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Entry Price (₹)</label>
                  <input type="number" value={form.entry_price}
                    onChange={e => setForm(f => ({...f, entry_price: e.target.value}))}
                    placeholder="e.g. 45"
                    className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-emerald-500"/>
                </div>
              </div>

              {/* Quantity + Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Lots</label>
                  <input type="number" value={form.quantity} min="1"
                    onChange={e => setForm(f => ({...f, quantity: e.target.value}))}
                    className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-emerald-500"/>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Entry Date</label>
                  <input type="date" value={form.entry_date}
                    onChange={e => setForm(f => ({...f, entry_date: e.target.value}))}
                    className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-emerald-500"/>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Notes (optional)</label>
                <input value={form.notes}
                  onChange={e => setForm(f => ({...f, notes: e.target.value}))}
                  placeholder="e.g. Theta play, breakout trade, hedging..."
                  className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-emerald-500"/>
              </div>

              {/* P&L preview */}
              {form.entry_price && form.quantity && (
                <div className="bg-gray-800/50 rounded-xl px-4 py-3">
                  <p className="text-xs text-gray-500">
                    Total exposure: ₹{(parseFloat(form.entry_price) * parseInt(form.quantity) * getLotSize(form.symbol)).toLocaleString('en-IN')}
                    <span className="ml-2 text-gray-600">({form.quantity} lot{parseInt(form.quantity)>1?'s':''} × {getLotSize(form.symbol)} × ₹{form.entry_price})</span>
                  </p>
                </div>
              )}

              <p className="text-xs text-gray-600">
                💡 Market context (IVR, PCR, DTE, Max Pain) will be automatically attached from live GreekNova data
              </p>

              <button onClick={saveTrade} disabled={saving || !form.strike || !form.entry_price}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-sm transition-all">
                {saving ? 'Saving + fetching context...' : 'Log Trade →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Close Trade Modal */}
      {showClose && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowClose(null)}/>
          <div className="relative w-full max-w-sm bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-white">Close Trade</h3>
              <button onClick={() => setShowClose(null)} className="text-gray-600 hover:text-white"><X size={18}/></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Exit Price (₹)</label>
                <input type="number" value={exitPrice}
                  onChange={e => setExitPrice(e.target.value)}
                  placeholder="e.g. 28"
                  className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-emerald-500"
                  autoFocus/>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Exit Date</label>
                <input type="date" value={exitDate}
                  onChange={e => setExitDate(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-emerald-500"/>
              </div>

              {/* P&L preview */}
              {exitPrice && showClose && (() => {
                const trade = trades.find(t => t.id === showClose)
                if (!trade) return null
                const lotSize = getLotSize(trade.symbol)
                const mult = trade.action === 'BUY' ? 1 : -1
                const previewPnl = mult * (parseFloat(exitPrice) - trade.entry_price) * trade.quantity * lotSize
                return (
                  <div className={`rounded-xl px-4 py-3 border ${previewPnl >= 0 ? 'bg-emerald-950/20 border-emerald-800/40' : 'bg-red-950/20 border-red-800/40'}`}>
                    <p className={`text-sm font-black ${previewPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      P&L: {previewPnl >= 0 ? '+' : ''}₹{Math.abs(previewPnl).toLocaleString('en-IN')}
                    </p>
                    <p className="text-xs text-gray-600 mt-0.5">
                      ({trade.action === 'BUY' ? parseFloat(exitPrice) - trade.entry_price : trade.entry_price - parseFloat(exitPrice)} pts × {trade.quantity} lots × {lotSize})
                    </p>
                  </div>
                )
              })()}

              <button onClick={() => closeTrade(showClose)} disabled={saving || !exitPrice}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-sm transition-all">
                {saving ? 'Closing...' : 'Close Trade →'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
