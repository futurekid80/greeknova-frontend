'use client'
import Navbar from '@/components/Navbar'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid, ReferenceLine, Cell } from 'recharts'
import { RefreshCw, TrendingUp, TrendingDown } from 'lucide-react'

interface ChartPoint { strike: number; CE: number; PE: number; total: number; isATM: boolean }

const INDICES = ['NIFTY', 'BANKNIFTY', 'FINNIFTY']
const STOCKS = [
  'RELIANCE','TCS','HDFCBANK','INFY','ICICIBANK','HINDUNILVR','ITC','SBIN','BHARTIARTL',
  'KOTAKBANK','LT','AXISBANK','ASIANPAINT','MARUTI','TITAN','SUNPHARMA','ULTRACEMCO',
  'BAJFINANCE','WIPRO','HCLTECH','TATACONSUM','TATASTEEL','ADANIENT','POWERGRID','NTPC',
  'ONGC','JSWSTEEL','COALINDIA','BAJAJFINSV','TECHM','APOLLOHOSP','BAJAJ-AUTO','BPCL',
  'BRITANNIA','CIPLA','DRREDDY','EICHERMOT','GRASIM','HEROMOTOCO','HINDALCO','HDFCLIFE',
  'INDUSINDBK','JIOFIN','M&M','NESTLEIND','SBILIFE','SHRIRAMFIN','TRENT','ADANIPORTS',
  'BANKBARODA','BEL','CANBK','CHOLAFIN','DLF','GAIL','HAVELLS','HAL','INDIGO','PFC',
  'RECLTD','SAIL','TATAPOWER','VEDL',
]

const CustomTooltip = ({ active, payload, label, atm, cmp }: any) => {
  if (!active || !payload?.length) return null
  const isATM = label === atm
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-3 shadow-xl">
      <p className="text-white font-bold mb-1">
        Strike: {Number(label).toLocaleString()}
        {isATM && <span className="ml-2 text-amber-400 text-xs">⭐ ATM</span>}
      </p>
      {cmp && <p className="text-xs text-gray-500 mb-2">CMP: ₹{Number(cmp).toLocaleString()}</p>}
      {payload.map((p: any) => (
        <p key={p.name} className="text-sm" style={{ color: p.color }}>
          {p.name}: {(p.value / 100000).toFixed(1)}L
        </p>
      ))}
    </div>
  )
}

export default function Charts() {
  const [symbol, setSymbo
