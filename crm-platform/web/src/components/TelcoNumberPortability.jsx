import { ArrowRightLeft } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { FallbackBadge } from '@/components/ui/DataStates'
import { useApiData } from '@/hooks/useApiData'
import { apiClient } from '@/lib/apiClient'

const rows = [
    { id: 'MNP-8842', cells: ['MNP-8842', '08031234567', 'Port-In', 'MTN', 'AeroTel', 'Completed', '2026-05-02', 'Within SLA'] },
    { id: 'MNP-8843', cells: ['MNP-8843', '09091234567', 'Port-Out', 'AeroTel', 'Airtel', 'Processing', '2026-05-03', 'Within SLA'] },
    { id: 'MNP-8844', cells: ['MNP-8844', '07061234567', 'Port-In', 'Glo', 'AeroTel', 'Rejected', '2026-05-01', 'N/A'] },
    { id: 'MNP-8845', cells: ['MNP-8845', '08101234567', 'Port-In', '9mobile', 'AeroTel', 'Pending', '2026-05-04', 'Pending'] },
    { id: 'MNP-8846', cells: ['MNP-8846', '08051234567', 'Port-Out', 'AeroTel', 'MTN', 'Completed', '2026-04-30', 'Within SLA'] },
]

const headers = ['Port ID', 'MSISDN', 'Direction', 'Donor', 'Recipient', 'Status', 'Submitted', 'SLA']

function statusColor(s) {
  switch (s) {
      case 'Completed': return 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/20'
      case 'Processing': return 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20'
      case 'Pending': return 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20'
      default: return 'text-gray-600 bg-gray-50 dark:text-gray-400 dark:bg-gray-900/20'
  }
}

export default function TelcoNumberPortability() {
  const { data: _apiData, isLoading: _apiLoading, isUsingFallback } = useApiData('telconumberportability', () => apiClient.dashboard.metrics(), { fallback: rows })
  const { tenant } = useTenant()
  return (
    <div role="region" aria-label="TelcoNumberPortability" className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ArrowRightLeft className="w-7 h-7 text-purple-600" /> Number Portability
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">MNP port-in and port-out tracking for {tenant?.name || 'Platform'}</p>
        </div>
        <FallbackBadge />
      </div>
      <div className="grid grid-cols-4 gap-3">
        {[{ l: 'Port-Ins (MTD)', v: '4,821' }, { l: 'Port-Outs (MTD)', v: '2,134' }, { l: 'Net Gain', v: '+2,687' }, { l: 'Avg Processing', v: '2.4 hrs' }].map(s => (
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
