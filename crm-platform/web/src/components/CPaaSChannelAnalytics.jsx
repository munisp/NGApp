import { BarChart2 } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { FallbackBadge } from '@/components/ui/DataStates'

const rows = [
    { id: 'CH-SMS', cells: ['SMS', '29.8M', '98.4%', '$521K', '0.8s', '0.4%', '+12%', 'Healthy'] },
    { id: 'CH-WA', cells: ['WhatsApp', '12.4M', '99.1%', '$248K', '1.2s', '0.2%', '+34%', 'Healthy'] },
    { id: 'CH-VOICE', cells: ['Voice', '2.8M', '97.2%', '$56K', '2.4s', '1.1%', '+8%', 'Warning'] },
    { id: 'CH-USSD', cells: ['USSD', '2.1M', '96.8%', '$12K', '0.3s', '1.8%', '-5%', 'Degraded'] },
    { id: 'CH-RCS', cells: ['RCS', '1.1M', '94.2%', '$5K', '1.8s', '2.4%', '+142%', 'Beta'] },
]

const headers = ['Channel', 'Messages', 'Delivered %', 'Revenue', 'Avg Latency', 'Errors', 'Growth', 'Status']

function statusColor(s) {
  switch (s) {
      case 'Healthy': return 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/20'
      case 'Warning': return 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20'
      case 'Degraded': return 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20'
      case 'Beta': return 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20'
      default: return 'text-gray-600 bg-gray-50 dark:text-gray-400 dark:bg-gray-900/20'
  }
}

export default function CPaaSChannelAnalytics() {
  const { tenant } = useTenant()
  return (
    <div role="region" aria-label="CPaaSChannelAnalytics" className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <BarChart2 className="w-7 h-7 text-purple-600" /> Channel Analytics
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Messaging channel performance metrics for {tenant?.name || 'Platform'}</p>
        </div>
        <FallbackBadge />
      </div>
      <div className="grid grid-cols-4 gap-3">
        {[{ l: 'Total Messages', v: '48.2M' }, { l: 'Revenue', v: '$842K' }, { l: 'Avg Cost/Msg', v: '$0.0175' }, { l: 'Top Channel', v: 'SMS (62%)' }].map(s => (
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
                  <td key={j} className={`px-4 py-3 text-sm ${j === 0 ? 'font-semibold text-gray-900 dark:text-white' : j === 7 ? statusColor(c) + ' font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
                    {j === 7 ? <span className={`px-2 py-0.5 rounded-full text-xs ${statusColor(c)}`}>{c}</span> : c}
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
