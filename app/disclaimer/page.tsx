'use client'
import Navbar from '@/components/Navbar'
import Link from 'next/link'

export default function Disclaimer() {
  return (
    <div className="min-h-screen bg-[#07070e] text-white">
      <Navbar active="/disclaimer" />
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-10">
          <h1 className="text-4xl font-black tracking-tight mb-3">Disclaimer & Terms of Use</h1>
          <p className="text-gray-500">Last updated: May 2026</p>
        </div>

        <div className="space-y-8 text-gray-300 leading-relaxed">

          <div className="bg-amber-950/30 border border-amber-800/50 rounded-2xl p-6">
            <h2 className="text-lg font-black text-amber-400 mb-3">⚠️ Important Notice</h2>
            <p className="text-amber-200/80">
              GreekNova is <strong>not registered with SEBI</strong> (Securities and Exchange Board of India) 
              as an investment advisor, research analyst, or portfolio manager. The information provided 
              on this platform is strictly for <strong>educational and informational purposes only</strong> 
              and does not constitute investment advice, research recommendations, or any form of financial guidance.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-black text-white mb-4">1. Nature of Information</h2>
            <ul className="space-y-2 text-gray-400 list-disc list-inside">
              <li>GreekNova displays open interest (OI), volume, Put-Call Ratio (PCR), Greeks, and other derivatives data sourced from Zerodha Kite API.</li>
              <li>All data displayed is for analytical observation only. It does not represent a buy, sell, or hold recommendation for any security.</li>
              <li>OI Structure labels such as "Breakout Watch", "Breakdown Watch", "Long Buildup", "Short Buildup" are analytical observations based on mathematical formulas — not trading signals or advice.</li>
              <li>Past OI patterns, PCR trends, or any historical data shown on this platform are not indicative of future performance.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-black text-white mb-4">2. No Investment Advice</h2>
            <p className="text-gray-400">
              Nothing on GreekNova should be construed as investment advice. We do not recommend 
              buying or selling any security, derivative, or financial instrument. Users should 
              conduct their own research and consult a SEBI-registered investment advisor before 
              making any financial decisions.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-black text-white mb-4">3. Risk Disclosure</h2>
            <div className="bg-red-950/20 border border-red-800/30 rounded-xl p-5 space-y-2 text-gray-400">
              <p>• <strong className="text-white">Derivatives trading involves substantial risk</strong> of loss and is not suitable for all investors.</p>
              <p>• Options and futures can result in losses exceeding your initial investment.</p>
              <p>• OI and volume data alone should never be the sole basis for any trading decision.</p>
              <p>• Market conditions can change rapidly and past patterns may not repeat.</p>
              <p>• <strong className="text-white">You may lose all of your invested capital.</strong> Trade only with risk capital you can afford to lose.</p>
            </div>
          </div>

          <div>
            <h2 className="text-xl font-black text-white mb-4">4. Data Accuracy</h2>
            <p className="text-gray-400">
              While we strive to display accurate and timely data sourced from Zerodha Kite API, 
              GreekNova does not guarantee the accuracy, completeness, or timeliness of any data. 
              Data may be delayed, incorrect, or unavailable due to technical issues. 
              Always verify critical data with your broker before making any trading decisions.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-black text-white mb-4">5. User Responsibility</h2>
            <p className="text-gray-400">
              By using GreekNova, you acknowledge that:
            </p>
            <ul className="space-y-2 text-gray-400 list-disc list-inside mt-3">
              <li>You are using this platform entirely at your own risk.</li>
              <li>You will not hold GreekNova, its creators, or contributors liable for any trading losses.</li>
              <li>You understand that OI and derivatives data is complex and requires expertise to interpret correctly.</li>
              <li>You are solely responsible for your investment and trading decisions.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-black text-white mb-4">6. Beta Usage</h2>
            <p className="text-gray-400">
              GreekNova is currently in beta. Features may be incomplete, inaccurate, or change 
              without notice. Beta access is provided as-is with no warranties of any kind. 
              By participating in the beta program, you agree to provide feedback and understand 
              that the platform is still under active development.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-black text-white mb-4">7. Contact</h2>
            <p className="text-gray-400">
              For questions about these terms or the platform, please reach out via 
              Twitter/X to the GreekNova team. We are committed to transparency and 
              will respond to all genuine queries.
            </p>
          </div>

          <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 text-center">
            <p className="text-gray-500 text-sm">
              By using GreekNova, you confirm that you have read, understood, and agreed to these terms.
            </p>
            <Link href="/" className="inline-block mt-4 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-xl transition-colors">
              I Understand — Take Me to Dashboard
            </Link>
          </div>

        </div>
      </div>
    </div>
  )
}
