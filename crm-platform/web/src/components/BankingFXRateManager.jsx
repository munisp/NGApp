import { DollarSign, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { FallbackBadge } from '@/components/ui/DataStates'

const rates = [
  { pair: 'USD/NGN', bid: 1580.25, ask: 1582.50, change: +2.4, spread: 2.25, volume: '₦42.8B', lastUpdate: '2 sec ago' },
  { pair: 'GBP/NGN', bid: 2012.80, ask: 2015.40, change: -1.8, spread: 2.60, volume: '₦18.2B', lastUpdate: '5 sec ago' },
  { pair: 'EUR/NGN', bid: 1724.60, ask: 1727.10, change: +0.9, spread: 2.50, volume: '₦24.6B', lastUpdate: '3 sec ago' },
  { pair: 'CNY/NGN', bid: 218.40, ask: 219.20, change: -0.3, spread: 0.80, volume: '₦8.4B', lastUpdate: '8 sec ago' },
  { pair: 'GHS/NGN', bid: 105.20, ask: 106.80, change: +1.2, spread: 1.60, volume: '₦3.2B', lastUpdate: '12 sec ago' },
]

const alerts = [
  { type: 'threshold', message: 'USD/NGN crossed ₦1,580 — 2.4% above CBN midpoint', time: '2 min ago', severity: 'high' },
  { type: 'spread', message: 'GBP/NGN spread widened to 260 bps — above normal range', time: '15 min ago', severity: 'medium' },
  { type: 'volume', message: 'USD/NGN volume surge: ₦42.8B today vs ₦28.4B avg', time: '1 hour ago', severity: 'low' },
]

export default function BankingFXRateManager() {
  return (
    <div role="region" aria-label="FXRateManager" className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><DollarSign className="w-7 h-7 text-green-600" /> FX Rate Manager</h1><p className="text-gray-500 dark:text-gray-400 mt-1">Real-time foreign exchange rates and alerts</p></div>
        <FallbackBadge />
      </div>
      <div className="grid grid-cols-4 gap-3">
        {[{ l: 'Currency Pairs', v: rates.length }, { l: 'Total Volume', v: '₦97.2B' }, { l: 'Active Alerts', v: alerts.length }, { l: 'CBN Compliance', v: '98.2%' }].map(s => (
          <div key={s.l} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3"><p className="text-xs text-gray-500">{s.l}</p><p className="text-xl font-bold text-gray-900 dark:text-white">{s.v}</p></div>
        ))}
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <table className="w-full"><thead className="bg-gray-50 dark:bg-gray-700"><tr>{['Pair', 'Bid', 'Ask', 'Change', 'Spread', 'Volume', 'Updated'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {rates.map(r => (
            <tr key={r.pair} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
              <td className="px-4 py-3 text-sm font-bold text-gray-900 dark:text-white">{r.pair}</td>
              <td className="px-4 py-3 text-sm font-mono text-gray-900 dark:text-white">{r.bid.toFixed(2)}</td>
              <td className="px-4 py-3 text-sm font-mono text-gray-900 dark:text-white">{r.ask.toFixed(2)}</td>
              <td className="px-4 py-3"><span className={`text-xs flex items-center gap-0.5 ${r.change > 0 ? 'text-emerald-600' : 'text-red-600'}`}>{r.change > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}{r.change > 0 ? '+' : ''}{r.change}%</span></td>
              <td className="px-4 py-3 text-sm text-gray-500">{r.spread}</td>
              <td className="px-4 py-3 text-sm text-gray-500">{r.volume}</td>
              <td className="px-4 py-3 text-xs text-gray-400">{r.lastUpdate}</td>
            </tr>
          ))}
        </tbody></table>
      </div>
      <div className="space-y-2">
        <h3 className="font-semibold text-gray-900 dark:text-white">Rate Alerts</h3>
        {alerts.map((a, i) => (
          <div key={i} className={`rounded-lg border p-3 text-sm ${a.severity === 'high' ? 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/10 dark:border-red-800 dark:text-red-400' : a.severity === 'medium' ? 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/10 dark:border-amber-800 dark:text-amber-400' : 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/10 dark:border-blue-800 dark:text-blue-400'}`}>
            <div className="flex justify-between"><span>{a.message}</span><span className="text-xs opacity-75">{a.time}</span></div>
          </div>
        ))}
      </div>
    </div>
  )
}
