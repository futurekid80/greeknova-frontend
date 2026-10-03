'use client'
import { useParams } from 'next/navigation'
import Navbar from '@/components/Navbar'
import StockChart from '@/components/StockChart'

export default function StockChartPage() {
  const params = useParams()
  const symbol = String(params.symbol || '').toUpperCase()

  return (
    <>
      <Navbar active="/stock-chart" />
      <div className="max-w-5xl mx-auto px-6 py-8">
        <h1 className="text-xl font-bold text-white mb-6">{symbol} — Price Chart</h1>
        <StockChart symbol={symbol} />
      </div>
    </>
  )
}
