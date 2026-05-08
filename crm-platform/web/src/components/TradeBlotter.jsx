import { BookOpen } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { FallbackBadge } from '@/components/ui/DataStates'

const rows = [
    { id: 'T-284712', cells: ['T-284712', 'WTI Jun26', 'Buy', '500 lots', '$78.42', '$39.2M', 'Filled', '12:34:22.847'] },
    { id: 'T-284713', cells: ['T-284713', 'Brent Jul26', 'Sell', '200 lots', '$82.18', '$16.4M', 'Filled', '12:34:18.234'] },
    { id: 'T-284714', cells: ['T-284714', 'Gold Aug26', 'Buy', '100 lots', '$2,342.80', '$23.4M', 'Partial', '12:34:15.112'] },
    { id: 'T-284715', cells: ['T-284715', 'Corn Dec26', 'Sell', '1,000 lots', '$4.52', '$22.6M', 'Pending', '12:34:12.005'] },
    { id: 'T-284716', cells: ['T-284716', 'NG Jul26', 'Buy', '300 lots', '$2.84', '$8.5M', 'Rejected', '12:34:10.998'] },
]

const headers = ['Trade ID', 'Instrument', 'Side', 'Quantity', 'Price', 'Notional', 'Status', 'Timestamp']

function statusColor(s) {
  switch (s) {
      case 'Filled': return 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/20'
      case 'Partial': return 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20'
      case 'Pending': return 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20'
      default: return 'text-gray-600 bg-gray-50 dark:text-gray-400 dark:bg-gray-900/20'
  }
}

export default function TradeBlotter() {
  const { tenant } = useTenant()
  return (
    <div role="region" aria-label="TradeBlotter" className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <BookOpen className="w-7 h-7 text-indigo-600" /> Trade Blotter
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Real-time trade execution log for {tenant?.name || 'Platform'}</p>
        </div>
        <FallbackBadge />
      </div>
      <div className="grid grid-cols-4 gap-3">
        {[{ l: 'Trades Today', v: '1,247' }, { l: 'Notional', v: '$2.8B' }, { l: 'Avg Fill', v: '12ms' }, { l: 'Rejection Rate', v: '0.3%' }].map(s => (
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
                  <td key={j} className={`px-4 py-3 text-sm ${j === 0 ? 'font-semibold text-gray-900 dark:text-white' : j === 6 ? statusColor(c) + ' font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
                    {j === 6 ? <span className={`px-2 py-0.5 rounded-full text-xs ${statusColor(c)}`}>{c}</span> : c}
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
