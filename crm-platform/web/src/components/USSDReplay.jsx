import { Terminal } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { FallbackBadge } from '@/components/ui/DataStates'

const rows = [
    { id: 'USS-90012', cells: ['USS-90012', '08031234567', '*123#', '5 steps', '28s', 'Completed', '2026-05-04 12:34', 'GW-Lagos-01'] },
    { id: 'USS-90013', cells: ['USS-90013', '09091234567', '*456*1#', '3 steps', '12s', 'Timeout', '2026-05-04 12:33', 'GW-Abuja-02'] },
    { id: 'USS-90014', cells: ['USS-90014', '07061234567', '*123*4*2#', '7 steps', '45s', 'Completed', '2026-05-04 12:32', 'GW-Lagos-03'] },
    { id: 'USS-90015', cells: ['USS-90015', '08101234567', '*100#', '2 steps', '8s', 'Error', '2026-05-04 12:31', 'GW-PH-01'] },
    { id: 'USS-90016', cells: ['USS-90016', '08051234567', '*123*1#', '4 steps', '22s', 'Completed', '2026-05-04 12:30', 'GW-Kano-01'] },
]

const headers = ['Session ID', 'MSISDN', 'USSD Code', 'Steps', 'Duration', 'Status', 'Timestamp', 'Gateway']

function statusColor(s) {
  switch (s) {
      case 'Completed': return 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/20'
      case 'Timeout': return 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20'
      case 'Error': return 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20'
      default: return 'text-gray-600 bg-gray-50 dark:text-gray-400 dark:bg-gray-900/20'
  }
}

export default function USSDReplay() {
  const { tenant } = useTenant()
  return (
    <div role="region" aria-label="USSDReplay" className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Terminal className="w-7 h-7 text-gray-600" /> USSD Session Replay
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Debug and replay USSD sessions for {tenant?.name || 'Platform'}</p>
        </div>
        <FallbackBadge />
      </div>
      <div className="grid grid-cols-4 gap-3">
        {[{ l: 'Sessions Today', v: '842K' }, { l: 'Avg Duration', v: '34s' }, { l: 'Error Rate', v: '2.1%' }, { l: 'Top Code', v: '*123#' }].map(s => (
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
                  <td key={j} className={`px-4 py-3 text-sm ${j === 0 ? 'font-semibold text-gray-900 dark:text-white' : j === 5 ? statusColor(c) + ' font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
                    {j === 5 ? <span className={`px-2 py-0.5 rounded-full text-xs ${statusColor(c)}`}>{c}</span> : c}
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
