import { Radio } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { FallbackBadge } from '@/components/ui/DataStates'

const rows = [
    { id: 'WTI', cells: ['WTI Crude', 'NYMEX', '$78.42', '+1.24%', '842K lots', '2.1M', '2s ago', 'ICE/CME'] },
    { id: 'BRENT', cells: ['Brent Crude', 'ICE', '$82.18', '+0.98%', '624K lots', '1.8M', '1s ago', 'ICE'] },
    { id: 'NG', cells: ['Natural Gas', 'NYMEX', '$2.84', '-2.12%', '412K lots', '1.2M', '3s ago', 'CME'] },
    { id: 'GOLD', cells: ['Gold', 'COMEX', '$2,342.80', '+0.42%', '284K lots', '520K', '1s ago', 'CME'] },
    { id: 'CORN', cells: ['Corn', 'CBOT', '$4.52', '-0.88%', '186K lots', '890K', '5s ago', 'CME'] },
]

const headers = ['Commodity', 'Exchange', 'Last Price', 'Change', 'Volume', 'Open Interest', 'Updated', 'Source']

function statusColor(s) {
  switch (s) {
      default: return 'text-gray-600 bg-gray-50 dark:text-gray-400 dark:bg-gray-900/20'
  }
}

export default function CommodityPriceFeed() {
  const { tenant } = useTenant()
  return (
    <div role="region" aria-label="CommodityPriceFeed" className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Radio className="w-7 h-7 text-green-600" /> Live Price Feed
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Real-time commodity price monitoring for {tenant?.name || 'Platform'}</p>
        </div>
        <FallbackBadge />
      </div>
      <div className="grid grid-cols-4 gap-3">
        {[{ l: 'Active Feeds', v: '48' }, { l: 'Latency', v: '12ms' }, { l: 'Updates/sec', v: '2,847' }, { l: 'Feed Health', v: '99.8%' }].map(s => (
          <div key={s.l} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
            <p className="text-xs text-gray-500">{s.l}</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{s.v}</p>
          </div>
        ))}
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>{headers.map(h => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {rows.map(r => (
              <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                {r.cells.map((c, j) => (
                  <td key={j} className={`px-4 py-3 text-sm ${j === 0 ? 'font-semibold text-gray-900 dark:text-white' : j === 3 ? statusColor(c) + ' font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
                    {j === 3 ? <span className={`px-2 py-0.5 rounded-full text-xs ${statusColor(c)}`}>{c}</span> : c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
