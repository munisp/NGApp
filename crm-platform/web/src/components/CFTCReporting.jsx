import { FileText } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { FallbackBadge } from '@/components/ui/DataStates'
import { useApiData } from '@/hooks/useApiData'
import { apiClient } from '@/lib/apiClient'

const rows = [
    { id: 'CFTC-2024-142', cells: ['CFTC-2024-142', 'Large Trader', 'Q1 2026', 'Filed', '2026-04-15', '847 positions', '2026-04-30', 'Compliance Desk'] },
    { id: 'CFTC-2024-143', cells: ['CFTC-2024-143', 'Swap Data', 'April 2026', 'Pending', '—', '234 swaps', '2026-05-15', 'Compliance Desk'] },
    { id: 'CFTC-2024-144', cells: ['CFTC-2024-144', 'Position Limits', 'Weekly W18', 'Filed', '2026-05-02', '12 contracts', '2026-05-03', 'Risk Team'] },
    { id: 'CFTC-2024-145', cells: ['CFTC-2024-145', 'Ownership Report', 'Annual 2025', 'Filed', '2026-03-31', 'Full portfolio', '2026-03-31', 'Legal'] },
    { id: 'CFTC-2024-146', cells: ['CFTC-2024-146', 'Trade Execution', 'Daily', 'Auto-Filed', '2026-05-04', '1,247 trades', 'T+1', 'Automated'] },
]

const headers = ['Report ID', 'Type', 'Period', 'Status', 'Filed Date', 'Positions', 'Deadline', 'Reviewer']

function statusColor(s) {
  switch (s) {
      case 'Filed': return 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/20'
      case 'Auto-Filed': return 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/20'
      case 'Pending': return 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20'
      default: return 'text-gray-600 bg-gray-50 dark:text-gray-400 dark:bg-gray-900/20'
  }
}

export default function CFTCReporting() {
  const { data: _apiData, isLoading: _apiLoading, isUsingFallback } = useApiData('cftcreporting', () => apiClient.dashboard.metrics(), { fallback: rows })
  const { tenant } = useTenant()
  return (
    <div role="region" aria-label="CFTCReporting" className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <FileText className="w-7 h-7 text-blue-600" /> CFTC Reporting
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Commodity Futures Trading Commission compliance for {tenant?.name || 'Platform'}</p>
        </div>
        <FallbackBadge />
      </div>
      <div className="grid grid-cols-4 gap-3">
        {[{ l: 'Reports Filed (YTD)', v: '284' }, { l: 'Pending', v: '8' }, { l: 'Late Filings', v: '1' }, { l: 'Compliance', v: '99.6%' }].map(s => (
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
