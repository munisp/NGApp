import { FileSpreadsheet } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { FallbackBadge } from '@/components/ui/DataStates'
import { useApiData } from '@/hooks/useApiData'
import { apiClient } from '@/lib/apiClient'

const rows = [
    { id: 'REG-001', cells: ['Capital Adequacy (CAR)', 'CBN', 'Quarterly', 'Submitted', '2026-04-30', '2026-04-28', 'Q1 2026', 'Compliance Head'] },
    { id: 'REG-002', cells: ['AML/CFT Returns', 'NFIU', 'Monthly', 'Pending', '2026-05-15', '—', 'April 2026', 'AML Officer'] },
    { id: 'REG-003', cells: ['Prudential Returns', 'CBN', 'Monthly', 'Submitted', '2026-05-10', '2026-05-08', 'April 2026', 'Finance Head'] },
    { id: 'REG-004', cells: ['Deposit Insurance', 'NDIC', 'Quarterly', 'Draft', '2026-05-31', '—', 'Q1 2026', 'Treasury'] },
    { id: 'REG-005', cells: ['FX Exposure Report', 'CBN', 'Weekly', 'Auto-Filed', '2026-05-07', '2026-05-04', 'Week 18', 'Automated'] },
]

const headers = ['Report', 'Regulator', 'Frequency', 'Status', 'Due Date', 'Submitted', 'Period', 'Reviewer']

function statusColor(s) {
  switch (s) {
      case 'Submitted': return 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/20'
      case 'Auto-Filed': return 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/20'
      case 'Pending': return 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20'
      case 'Draft': return 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20'
      default: return 'text-gray-600 bg-gray-50 dark:text-gray-400 dark:bg-gray-900/20'
  }
}

export default function BankingRegulatoryReports() {
  const { data: _apiData, isLoading: _apiLoading, isUsingFallback } = useApiData('bankingregulatoryreports', () => apiClient.dashboard.metrics(), { fallback: rows })
  const { tenant } = useTenant()
  return (
    <div role="region" aria-label="BankingRegulatoryReports" className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <FileSpreadsheet className="w-7 h-7 text-red-600" /> Regulatory Reports
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">CBN, NDIC, and NFIU compliance reporting for {tenant?.name || 'Platform'}</p>
        </div>
        <FallbackBadge />
      </div>
      <div className="grid grid-cols-4 gap-3">
        {[{ l: 'Reports (YTD)', v: '142' }, { l: 'On Time', v: '98.6%' }, { l: 'Pending', v: '4' }, { l: 'Next Due', v: 'May 15' }].map(s => (
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
