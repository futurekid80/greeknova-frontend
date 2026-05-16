'use client'
import Navbar from '@/components/Navbar'
import { useEffect, useState, useRef, useCallback } from 'react'
import { Send, RefreshCw, AlertTriangle, ChevronDown } from 'lucide-react'

const API = 'https://greeknova-backend-production.up.railway.app'

const INDICES = ['NIFTY', 'BANKNIFTY', 'FINNIFTY']
const STOCKS = [
  'RELIANCE','TCS','HDFCBANK','INFY','ICICIBANK','HINDUNILVR','ITC','SBIN',
  'BHARTIARTL','KOTAKBANK','LT','AXISBANK','ASIANPAINT','MARUTI','TITAN',
  'SUNPHARMA','ULTRACEMCO','BAJFINANCE','WIPRO','HCLTECH','TATACONSUM',
  'TATASTEEL','ADANIENT','POWERGRID','NTPC','ONGC','JSWSTEEL','COALINDIA',
  'BAJAJFINSV','TECHM','DRREDDY','CIPLA','BPCL','DLF','COALINDIA',
]

const SYSTEM_PROMPT = `You are GreekNova's market data analyst. You help traders understand options market structure using NSE F&O data.

STRICT RULES — you must follow these without exception:
1. ONLY describe what the data shows — never recommend buying, selling, holding or exiting positions
2. NEVER predict price direction or say "will go up/down"
3. NEVER say "your position is safe/unsafe" or give trade-specific advice
4. NEVER give targets or stop losses
5. Always frame observations as "data shows...", "OI structure indicates...", "put writers are observed at..."
6. End every response with: "📊 Informational only — based on observed NSE OI data. Not investment advice. GreekNova is not SEBI-registered."
7. If asked for direct trade advice, respond: "I can only describe what the OI data shows — for trade decisions, consult a SEBI-registered advisor."

YOU CAN:
- Explain what current OI structure shows
- Describe PCR trends and what they historically indicate
- Identify key support/resistance levels from OI concentration
- Explain Max Pain and its significance
- Describe IV levels and what they mean for premium pricing
- Summarize UOA signals observed
- Explain options strategies in educational context
- Help trader understand what the data means without telling them what to do

TONE: Calm, analytical, like a senior trader explaining market structure to a colleague. Not robotic, not alarmist. Use ₹ for prices. Use Indian market context (NSE, Nifty, Bank Nifty).`

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

interface Context {
  symbol: string
  date: string
  context: string
  cmp: number
}

const SUGGESTED_QUESTIONS = [
  "What does today's OI structure tell me about market direction?",
  "Where is smart money positioned right now?",
  "What are the key support and resistance levels from OI?",
  "Is IV cheap or expensive right now? What does that mean?",
  "What is Max Pain and how far is price from it?",
  "What do the UOA signals indicate today?",
  "How has PCR trended today and what does it show?",
  "What is the expected move for this expiry?",
]

export default function AskClaude() {
  const [symbol, setSymbol]       = useState('NIFTY')
  const [context, setContext]     = useState<Context | null>(null)
  const [loadingCtx, setLoadingCtx] = useState(false)
  const [messages, setMessages]   = useState<Message[]>([])
  const [input, setInput]         = useState('')
  const [sending, setSending]     = useState(false)
  const [error, setError]         = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const conversationRef = useRef<{ role: string; content: string }[]>([])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => { scrollToBottom() }, [messages])

  const loadContext = useCallback(async (sym: string) => {
    setLoadingCtx(true)
    setError('')
    try {
      const res  = await fetch(`${API}/ask-context/${sym}`)
      const json = await res.json()
      setContext(json)
      // Reset conversation when symbol changes
      setMessages([])
      conversationRef.current = []
    } catch (e) {
      setError('Failed to load market context. Check backend connection.')
    }
    setLoadingCtx(false)
  }, [])

  useEffect(() => { loadContext(symbol) }, [symbol, loadContext])

  async function sendMessage(text?: string) {
    const userText = (text || input).trim()
    if (!userText || sending || !context) return

    setInput('')
    setError('')

    const userMsg: Message = {
      role:      'user',
      content:   userText,
      timestamp: new Date().toLocaleTimeString('en-IN'),
    }

    setMessages(prev => [...prev, userMsg])
    conversationRef.current = [
      ...conversationRef.current,
      { role: 'user', content: userText }
    ]

    setSending(true)

    try {
      // Build messages for Claude API
      // First message always includes the full market context
      const apiMessages = conversationRef.current.length === 1
        ? [
            {
              role: 'user',
              content: `Here is today's market data for ${context.symbol}:\n\n${context.context}\n\nMy question: ${userText}`
            }
          ]
        : [
            {
              role: 'user',
              content: `Here is today's market data for ${context.symbol}:\n\n${context.context}\n\nMy question: ${conversationRef.current[0].content}`
            },
            ...conversationRef.current.slice(1)
          ]

      // Call Railway backend — which calls Claude API securely
      // Never call Anthropic API directly from browser (CORS + key exposure)
      const response = await fetch(`${API}/ask-claude`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system:   SYSTEM_PROMPT,
          messages: apiMessages,
        }),
      })

      const data = await response.json()

      if (data.error) {
        throw new Error(data.error || 'Claude API error')
      }

      const assistantText = data.content || 'No response received'

      const assistantMsg: Message = {
        role:      'assistant',
        content:   assistantText,
        timestamp: new Date().toLocaleTimeString('en-IN'),
      }

      setMessages(prev => [...prev, assistantMsg])
      conversationRef.current = [
        ...conversationRef.current,
        { role: 'assistant', content: assistantText }
      ]

    } catch (e: any) {
      setError(e.message || 'Failed to get response from Claude')
      // Remove the user message on error
      setMessages(prev => prev.slice(0, -1))
      conversationRef.current = conversationRef.current.slice(0, -1)
    }

    setSending(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const isStock = STOCKS.includes(symbol)

  return (
    <div className="min-h-screen bg-[#07070e] text-white flex flex-col">
      <Navbar active="/ask" />

      <div className="max-w-4xl mx-auto w-full px-6 py-6 flex flex-col flex-1" style={{ minHeight: 'calc(100vh - 120px)' }}>

        {/* Header */}
        <div className="mb-5">
          <h1 className="text-2xl font-black tracking-tight mb-1 flex items-center gap-2">
            🤖 Ask GreekNova
          </h1>
          <p className="text-gray-500 text-sm">
            Ask about OI structure, PCR, key levels, IV — powered by live NSE data + Claude AI
          </p>
        </div>

        {/* SEBI disclaimer */}
        <div className="bg-amber-950/10 border border-amber-800/30 rounded-xl px-4 py-3 mb-4 flex items-start gap-3">
          <AlertTriangle size={14} className="text-amber-500 flex-shrink-0 mt-0.5"/>
          <p className="text-xs text-gray-500">
            <span className="text-amber-400 font-semibold">Observational only.</span> Responses describe what OI data shows — not investment advice.
            GreekNova is not SEBI-registered. Always consult a registered advisor before trading.
          </p>
        </div>

        {/* Symbol selector + context info */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex items-center gap-2 flex-wrap">
            {INDICES.map(idx => (
              <button key={idx} onClick={() => setSymbol(idx)}
                className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${symbol===idx ? 'bg-white text-gray-900 border-white' : 'bg-gray-900/40 text-gray-400 border-gray-800 hover:text-white'}`}>
                {idx}
              </button>
            ))}
            <select
              value={isStock ? symbol : ''}
              onChange={e => e.target.value && setSymbol(e.target.value)}
              className={`rounded-xl text-sm font-bold border transition-all px-3 py-2 focus:outline-none ${isStock ? 'bg-white text-gray-900 border-white' : 'bg-gray-900/40 text-gray-400 border-gray-800'}`}>
              <option value="">Stocks ▾</option>
              {STOCKS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <button onClick={() => loadContext(symbol)} disabled={loadingCtx}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-white border border-gray-700 px-3 py-2 rounded-lg transition-all ml-auto">
            <RefreshCw size={11} className={loadingCtx ? 'animate-spin' : ''}/>
            Refresh data
          </button>
        </div>

        {/* Context loaded indicator */}
        {context && !loadingCtx && (
          <div className="bg-gray-900/30 border border-gray-800 rounded-xl px-4 py-2.5 mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block"/>
              <span>Context loaded: <span className="text-white font-semibold">{context.symbol}</span></span>
              {context.cmp > 0 && <span>CMP: <span className="text-amber-400 font-bold">₹{context.cmp.toLocaleString('en-IN')}</span></span>}
              <span>Date: {context.date}</span>
            </div>
            <span className="text-xs text-gray-600">OI + PCR + UOA + IV loaded</span>
          </div>
        )}

        {loadingCtx && (
          <div className="bg-gray-900/30 border border-gray-800 rounded-xl px-4 py-3 mb-4 flex items-center gap-2 text-xs text-gray-500">
            <RefreshCw size={11} className="animate-spin"/>
            Loading market data for {symbol}...
          </div>
        )}

        {/* Chat area */}
        <div className="flex-1 flex flex-col">

          {/* Messages */}
          <div className="flex-1 space-y-4 mb-4 overflow-y-auto" style={{ maxHeight: '480px', minHeight: '300px' }}>

            {/* Welcome message */}
            {messages.length === 0 && !sending && (
              <div className="text-center py-8">
                <div className="text-4xl mb-3">📊</div>
                <p className="text-gray-400 text-sm mb-6">
                  Ask me about {symbol} OI structure, key levels, PCR trend, IV or UOA signals.
                </p>
                <div className="grid grid-cols-2 gap-2 max-w-2xl mx-auto">
                  {SUGGESTED_QUESTIONS.map((q, i) => (
                    <button key={i} onClick={() => sendMessage(q)}
                      className="text-left text-xs text-gray-400 hover:text-white bg-gray-900/40 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 rounded-xl px-3 py-2.5 transition-all leading-relaxed">
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Message list */}
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-emerald-950/60 border border-emerald-800/50 text-white'
                    : 'bg-gray-900/60 border border-gray-800 text-gray-200'
                }`}>
                  {msg.role === 'assistant' && (
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="text-xs font-bold text-emerald-400">GreekNova AI</span>
                      <span className="text-xs text-gray-600">{msg.timestamp}</span>
                    </div>
                  )}
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  {msg.role === 'user' && (
                    <p className="text-xs text-gray-500 mt-1 text-right">{msg.timestamp}</p>
                  )}
                </div>
              </div>
            ))}

            {/* Thinking indicator */}
            {sending && (
              <div className="flex justify-start">
                <div className="bg-gray-900/60 border border-gray-800 rounded-2xl px-4 py-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="text-xs font-bold text-emerald-400">GreekNova AI</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <div className="flex gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '0ms' }}/>
                      <div className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '150ms' }}/>
                      <div className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '300ms' }}/>
                    </div>
                    Analysing {symbol} data...
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef}/>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-950/30 border border-red-800/50 rounded-xl px-4 py-3 mb-3 text-xs text-red-400 flex items-center gap-2">
              <AlertTriangle size={12}/>
              {error}
            </div>
          )}

          {/* Input */}
          <div className="bg-gray-900/40 border border-gray-700 rounded-2xl p-3 flex items-end gap-3">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={context ? `Ask about ${symbol} — OI structure, key levels, PCR, IV, UOA...` : 'Loading market context...'}
              disabled={!context || loadingCtx || sending}
              rows={2}
              className="flex-1 bg-transparent text-white text-sm resize-none focus:outline-none placeholder:text-gray-600 leading-relaxed"
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || sending || !context}
              className="flex-shrink-0 w-9 h-9 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-all">
              <Send size={15} className="text-white"/>
            </button>
          </div>
          <p className="text-xs text-gray-700 mt-2 text-center">
            Enter to send · Shift+Enter for new line · Context refreshes with Refresh button
          </p>
        </div>

        {/* Bottom disclaimer */}
        <div className="mt-4 bg-gray-900/20 border border-gray-800/40 rounded-xl p-3">
          <p className="text-xs text-gray-600 leading-relaxed">
            <span className="text-gray-400 font-semibold">How this works:</span> Your question is sent to Claude AI along with live GreekNova market data
            (OI structure, PCR, UOA signals, IV, Max Pain). Claude describes what the data shows in plain language.
            Responses are observational only — not trading recommendations. GreekNova is not SEBI-registered.
          </p>
        </div>
      </div>
    </div>
  )
}
