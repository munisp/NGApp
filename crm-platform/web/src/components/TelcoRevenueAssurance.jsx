import { TrendingUp } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { FallbackBadge } from '@/components/ui/DataStates'
import { useApiData } from '@/hooks/useApiData'
import { apiClient } from '@/lib/apiClient'

const rows = [
    { id: 'RA-2401', cells: ['RA-2401', 'CDR Gap', '₦42.8M', 'Investigating', 'Mediation', '2026-04-28', 'Revenue Team A', 'Critical'] },
    { id: 'RA-2402', cells: ['RA-2402', 'Billing Error', '₦18.2M', 'Resolved', 'IN Platform', '2026-04-25', 'Revenue Team B', 'High'] },
    { id: 'RA-2403', cells: ['RA-2403', 'Interconnect', '₦156M', 'Open', 'Settlement', '2026-04-22', 'Revenue Team A', 'Critical'] },
    { id: 'RA-2404', cells: ['RA-2404', 'Roaming', '₦8.4M', 'Investigating', 'TADIG', '2026-04-20', 'Revenue Team C', 'Medium'] },
    { id: 'RA-2405', cells: ['RA-2405', 'VAS Billing', '₦3.2M', 'Resolved', 'CP Platform', '2026-04-18', 'Revenue Team B', 'Low'] },
]

const headers = ['Case ID', 'Type', 'Amount', 'Status', 'Source', 'Detected', 'Assigned To', 'Priority']

function statusColor(s) {
  switch (s) {
      case 'Resolved': return 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/20'
      case 'Open': return 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20'
      case 'Investigating': return 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20'
      default: return 'text-gray-600 bg-gray-50 dark:text-gray-400 dark:bg-gray-900/20'
  }
}

export default function TelcoRevenueAssurance() {
  const { data: _apiData, isLoading: _apiLoading, isUsingFallback } = useApiData('telcorevenueassurance', () => apiClient.dashboard.metrics(), { fallback: rows })
  const { tenant } = useTenant()
  return (
    <div role="region" aria-label="TelcoRevenueAssurance" className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <TrendingUp className="w-7 h-7 text-emerald-600" /> Revenue Assurance
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Detect revenue leakage and billing discrepancies for {tenant?.name || 'Platform'}</p>
        </div>
        <FallbackBadge />
      </div>
      <div className="grid grid-cols-4 gap-3">
        {[{ l: 'Monthly Revenue', v: '₦18.4B' }, { l: 'Leakage Detected', v: '₦342M' }, { l: 'Recovery Rate', v: '87.2%' }, { l: 'Open Cases', v: '156' }].map(s => (
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
