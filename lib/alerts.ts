import { supabase } from './supabase'

export interface Alert {
  symbol: string
  signal: string
  pcr: number
  ceWall: number
  peWall: number
  cmp: number
  timestamp: string
}

const SIGNAL_LABELS: Record<string, string> = {
  PUT_WRITING: 'Put Writing — Support building 🟢',
  CALL_WRITING: 'Call Writing — Resistance forming 🔴',
  SQUEEZE: 'IV Squeeze — Big move pending ⚡',
  BATTLEGROUND: 'Battleground — Two-way writing ⚔️',
}

const SIGNAL_ICONS: Record<string, string> = {
  PUT_WRITING: '↑',
  CALL_WRITING: '↓',
  SQUEEZE: '⚡',
  BATTLEGROUND: '⚔️',
}

function getSignal(pcr: number, totalCE: number, totalPE: number): string {
  const ratio = totalPE / (totalCE + totalPE)
  if (pcr > 1.4) return 'PUT_WRITING'
  if (pcr < 0.6) return 'CALL_WRITING'
  if (ratio > 0.44 && ratio < 0.56) return 'BATTLEGROUND'
  return 'SQUEEZE'
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const result = await Notification.requestPermission()
  return result === 'granted'
}

export function sendNotification(title: string, body: string, tag: string) {
  if (Notification.permission !== 'granted') return
  const n = new Notification(title, {
    body,
    tag,
    icon: '/favicon.ico',
    requireInteraction: false,
  })
  n.onclick = () => { window.focus(); window.location.href = '/scanners' }
  setTimeout(() => n.close(), 8000)
}

export async function checkForNewSignals(
  previousSignals: Record<string, string>,
  onNewAlert: (alert: Alert) => void
): Promise<Record<string, string>> {
  try {
    const { data: latest } = await supabase
      .from('oi_snapshots')
      .select('timestamp')
      .order('timestamp', { ascending: false })
      .limit(1)

    if (!latest?.length) return previousSignals

    const ts = latest[0].timestamp
    const { data } = await supabase.from('oi_snapshots').select('*').eq('timestamp', ts)
    const { data: cmpData } = await supabase.from('cmp_prices').select('*').order('timestamp', { ascending: false }).limit(100)

    if (!data) return previousSignals

    const cmpMap: Record<string, number> = {}
    if (cmpData) {
      const seen = new Set()
      cmpData.forEach((c: any) => {
        if (!seen.has(c.symbol)) { cmpMap[c.symbol] = c.cmp; seen.add(c.symbol) }
      })
    }

    const symbols = [...new Set(data.map((d: any) => d.symbol))]
    const newSignals: Record<string, string> = {}

    for (const sym of symbols) {
      const r = data.filter((d: any) => d.symbol === sym)
      const ce = r.filter((d: any) => d.option_type === 'CE')
      const pe = r.filter((d: any) => d.option_type === 'PE')
      const totalCE = ce.reduce((s: number, d: any) => s + d.oi, 0)
      const totalPE = pe.reduce((s: number, d: any) => s + d.oi, 0)
      if (!totalCE && !totalPE) continue

      const pcr = totalCE > 0 ? totalPE / totalCE : 0
      const signal = getSignal(pcr, totalCE, totalPE)
      const ceWall = [...ce].sort((a: any, b: any) => b.oi - a.oi)[0]?.strike || 0
      const peWall = [...pe].sort((a: any, b: any) => b.oi - a.oi)[0]?.strike || 0
      const cmp = cmpMap[sym as string] || 0

      newSignals[sym as string] = signal

      // Only alert if signal CHANGED from previous check
      const prevSignal = previousSignals[sym as string]
      if (prevSignal && prevSignal !== signal) {
        const alert: Alert = {
          symbol: sym as string,
          signal,
          pcr: Math.round(pcr * 100) / 100,
          ceWall,
          peWall,
          cmp,
          timestamp: ts,
        }
        onNewAlert(alert)
        sendNotification(
          `${SIGNAL_ICONS[signal]} ${sym} — Signal Changed`,
          `${SIGNAL_LABELS[signal]}\nPCR: ${alert.pcr} | CMP: ₹${cmp}`,
          `${sym}-${signal}`
        )
      }
    }

    return newSignals
  } catch (e) {
    console.error('Alert check failed:', e)
    return previousSignals
  }
}
