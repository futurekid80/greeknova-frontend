'use client'
// Nov 5 2026: "Biggest OI added today" -- where the most money was added to option OI since yesterday's close.
// Plain size ranking (OI added x current premium). No price condition, so it complements Strike Stealth.
import { useEffect, useState } from 'react'

const API = 'https://api.greeknova.com'

type Item = {
  symbol: string; tradingsymbol: string; strike: number; option_type: 'CE' | 'PE'; expiry?: string
  old_oi: number; new_oi: number; oi_added: number; oi_pct: number; premium: number; money: number; cmp?: number
}
type Resp = { index?: Item[]; stocks?: Item[]; ts_new?: string | null }

const fmtOI = (n: number) => (n >= 1e7 ? `${(n / 1e7).toFixed(2)} Cr` : n >= 1e5 ? `${(n / 1e5).toFixed(1)} L` : n >= 1e3 ? `${(n / 1e3).toFixed(1)} K` : String(n))
const fmtMoney = (n: number) => (n >= 1e7 ? `₹${(n / 1e7).toFixed(1)} Cr` : `₹${(n / 1e5).toFixed(0)} L`)
const fmtExp = (e?: string) => { try { return e ? new Date(e).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '' } catch { return '' } }

function marketOpenIST() {
  try {
    const ist = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
    const d = ist.getDay(), m = ist.getHours() * 60 + ist.getMinutes()
    return d !== 0 && d !== 6 && m >= 540 && m <= 945
  } catch { return false }
}

function Table({ title, rows }: { title: string; rows: Item[] }) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-950/40 overflow-hidden">
      <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-gray-400 border-b border-gray-800">{title}</div>
      {rows.length === 0 ? (
        <div className="px-3 py-4 text-xs text-gray-500">Nothing large enough yet.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 text-[10px] uppercase">
                <th className="px-3 py-1.5 text-left font-medium">Contract</th>
                <th className="px-2 py-1.5 text-right font-medium">OI added</th>
                <th className="px-2 py-1.5 text-right font-medium">OI up</th>
                <th className="px-2 py-1.5 text-right font-medium">Premium</th>
                <th className="px-3 py-1.5 text-right font-medium">Money added</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.tradingsymbol} className="border-t border-gray-800/60">
                  <td className="px-3 py-1.5 whitespace-nowrap">
                    <span className="font-bold text-white">{r.symbol}</span>{' '}
                    <span className="text-gray-300">{r.strike}</span>{' '}
                    <span className={`px-1 rounded text-[10px] font-bold ${r.option_type === 'CE' ? 'bg-emerald-950 text-emerald-300' : 'bg-red-950 text-red-300'}`}>{r.option_type}</span>
                    <span className="ml-1 text-[10px] text-gray-500">{fmtExp(r.expiry)}</span>
                  </td>
                  <td className="px-2 py-1.5 text-right text-gray-200">{fmtOI(r.oi_added)}</td>
                  <td className="px-2 py-1.5 text-right text-gray-400">+{r.oi_pct >= 1000 ? Math.round(r.oi_pct).toLocaleString('en-IN') : r.oi_pct}%</td>
                  <td className="px-2 py-1.5 text-right text-gray-400">₹{r.premium}</td>
                  <td className="px-3 py-1.5 text-right font-bold text-white">{fmtMoney(r.money)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function OIAddedToday() {
  const [data, setData] = useState<Resp | null>(null)

  useEffect(() => {
    let dead = false
    const run = () => fetch(`${API}/oi-added-today`).then(r => (r.ok ? r.json() : null)).catch(() => null)
      .then(j => { if (!dead && j) setData(j) })
    run()
    const id = setInterval(() => { if (marketOpenIST() && document.visibilityState === 'visible') run() }, 60000)
    return () => { dead = true; clearInterval(id) }
  }, [])

  const idx = data?.index || []
  const stk = data?.stocks || []
  if (!data || (idx.length === 0 && stk.length === 0)) return null

  return (
    <div className="mb-6 rounded-xl border border-gray-800 bg-gray-900/30 p-4">
      <p className="text-sm font-bold text-gray-100">Biggest OI added today</p>
      <p className="text-[11px] text-gray-500 mb-3">
        Where the most money was added to open interest since yesterday&apos;s close (OI added × current premium). Shows size, not direction, and it does not look at the price move,
        so it also catches heavy activity on big-move days. Put or call OI added does not say who is buying or selling. Educational only.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        <Table title="Indices" rows={idx} />
        <Table title="Stocks" rows={stk} />
      </div>
    </div>
  )
}
