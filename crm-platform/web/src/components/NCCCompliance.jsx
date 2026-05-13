import { Shield } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { FallbackBadge } from '@/components/ui/DataStates'
import { useApiData } from '@/hooks/useApiData'
import { apiClient } from '@/lib/apiClient'

const rows = [
    { id: 'NCC-01', cells: ['SIM Registration Compliance', 'Compliant', '2026-06-30', '98.2%', '2026-04-28', 'Subscriber', 'Low'] },
    { id: 'NCC-02', cells: ['QoS Standards (Voice)', 'Non-Compliant', '2026-05-15', '82.4%', '2026-04-25', 'Quality', 'High'] },
    { id: 'NCC-03', cells: ['Data Protection (NDPR)', 'Compliant', '2026-07-31', '96.1%', '2026-04-22', 'Privacy', 'Low'] },
    { id: 'NCC-04', cells: ['Number Portability SLA', 'Warning', '2026-05-31', '88.7%', '2026-04-20', 'Operations', 'Medium'] },
    { id: 'NCC-05', cells: ['Infrastructure Sharing', 'Compliant', '2026-12-31', '95.3%', '2026-04-15', 'Network', 'Low'] },
]

const headers = ['Regulation', 'Status', 'Due Date', 'Score', 'Last Check', 'Category', 'Risk Level']

function statusColor(s) {
  switch (s) {
      case 'Compliant': return 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/20'
      case 'Warning': return 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20'
      case 'Non-Compliant': return 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20'
      default: return 'text-gray-600 bg-gray-50 dark:text-gray-400 dark:bg-gray-900/20'
  }
}

export default function NCCCompliance() {
  const { data: _apiData, isLoading: _apiLoading, isUsingFallback } = useApiData('ncccompliance', () => apiClient.dashboard.metrics(), { fallback: rows })
  const { tenant } = useTenant()
  return (
    <div role="region" aria-label="NCCCompliance" className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Shield className="w-7 h-7 text-blue-600" /> NCC Compliance
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Nigerian Communications Commission regulatory compliance for {tenant?.name || 'Platform'}</p>
        </div>
        <FallbackBadge />
      </div>
      <div className="grid grid-cols-4 gap-3">
        {[{ l: 'Compliance Score', v: '94.8%' }, { l: 'Open Violations', v: '3' }, { l: 'Reports Due', v: '2' }, { l: 'Last Audit', v: '2026-04-15' }].map(s => (
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
                  <td key={j} className={`px-4 py-3 text-sm ${j === 0 ? 'font-semibold text-gray-900 dark:text-white' : j === 1 ? statusColor(c) + ' font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
                    {j === 1 ? <span className={`px-2 py-0.5 rounded-full text-xs ${statusColor(c)}`}>{c}</span> : c}
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
