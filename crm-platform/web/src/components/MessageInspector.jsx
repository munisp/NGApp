import { Search } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { FallbackBadge } from '@/components/ui/DataStates'

const rows = [
    { id: 'MSG-84271234', cells: ['MSG-84271234', 'SMS', '+234801234567', '+234901234567', 'Delivered', '0.8s', '₦4.50', '12:34:22'] },
    { id: 'MSG-84271235', cells: ['MSG-84271235', 'WhatsApp', 'BizProfile', '+234801234568', 'Read', '1.2s', '₦12.00', '12:34:18'] },
    { id: 'MSG-84271236', cells: ['MSG-84271236', 'SMS', '+234801234567', '+234701234567', 'Failed', '—', '₦0.00', '12:34:15'] },
    { id: 'MSG-84271237', cells: ['MSG-84271237', 'Voice', '+234801234567', '+234801234569', 'Completed', '45s call', '₦24.00', '12:33:45'] },
    { id: 'MSG-84271238', cells: ['MSG-84271238', 'USSD', '*123#', '+234801234570', 'Delivered', '0.3s', '₦2.00', '12:33:40'] },
]

const headers = ['Message ID', 'Channel', 'From', 'To', 'Status', 'Delivery Time', 'Cost', 'Timestamp']

function statusColor(s) {
  switch (s) {
      case 'Delivered': return 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/20'
      case 'Read': return 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/20'
      case 'Completed': return 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/20'
      case 'Failed': return 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20'
      default: return 'text-gray-600 bg-gray-50 dark:text-gray-400 dark:bg-gray-900/20'
  }
}

export default function MessageInspector() {
  const { tenant } = useTenant()
  return (
    <div role="region" aria-label="MessageInspector" className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Search className="w-7 h-7 text-teal-600" /> Message Inspector
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Real-time message delivery tracking for {tenant?.name || 'Platform'}</p>
        </div>
        <FallbackBadge />
      </div>
      <div className="grid grid-cols-4 gap-3">
        {[{ l: 'Messages Today', v: '4.2M' }, { l: 'Delivered', v: '98.4%' }, { l: 'Failed', v: '0.8%' }, { l: 'Avg Delivery', v: '1.2s' }].map(s => (
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
                  <td key={j} className={`px-4 py-3 text-sm ${j === 0 ? 'font-semibold text-gray-900 dark:text-white' : j === 4 ? statusColor(c) + ' font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
                    {j === 4 ? <span className={`px-2 py-0.5 rounded-full text-xs ${statusColor(c)}`}>{c}</span> : c}
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
