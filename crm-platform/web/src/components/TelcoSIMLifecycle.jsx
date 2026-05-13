import { CreditCard } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { FallbackBadge } from '@/components/ui/DataStates'
import { useApiData } from '@/hooks/useApiData'
import { apiClient } from '@/lib/apiClient'

const rows = [
    { id: 'SIM-001', cells: ['8923410012345678', '09012345678', 'Active', 'eSIM', 'Dangote Corp', '2026-01-15', '5G SA', '24.8 GB'] },
    { id: 'SIM-002', cells: ['8923410087654321', '08098765432', 'Active', 'Physical', 'MTN Enterprise', '2025-11-20', '5G NSA', '48.2 GB'] },
    { id: 'SIM-003', cells: ['8923410011223344', '07011223344', 'Suspended', 'Physical', 'Kano Textiles', '2024-06-10', '4G', '0.2 GB'] },
    { id: 'SIM-004', cells: ['8923410055667788', '09055667788', 'Pre-Active', 'eSIM', 'New Subscriber', '2026-05-01', '4G', '0 GB'] },
    { id: 'SIM-005', cells: ['8923410033445566', '08033445566', 'Deactivated', 'Physical', 'Former Sub', '2023-08-15', '3G', '0 GB'] },
]

const headers = ['ICCID', 'MSISDN', 'Status', 'Type', 'Customer', 'Activated', 'Network', 'Data Used']

function statusColor(s) {
  switch (s) {
      case 'Active': return 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/20'
      case 'Suspended': return 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20'
      case 'Pre-Active': return 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20'
      default: return 'text-gray-600 bg-gray-50 dark:text-gray-400 dark:bg-gray-900/20'
  }
}

export default function TelcoSIMLifecycle() {
  const { data: _apiData, isLoading: _apiLoading, isUsingFallback } = useApiData('telcosimlifecycle', () => apiClient.dashboard.metrics(), { fallback: rows })
  const { tenant } = useTenant()
  return (
    <div role="region" aria-label="TelcoSIMLifecycle" className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <CreditCard className="w-7 h-7 text-teal-600" /> SIM Lifecycle Management
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Track SIM provisioning, activation, and deactivation for {tenant?.name || 'Platform'}</p>
        </div>
        <FallbackBadge />
      </div>
      <div className="grid grid-cols-4 gap-3">
        {[{ l: 'Total SIMs', v: '142,847' }, { l: 'Active', v: '128,562' }, { l: 'Suspended', v: '8,421' }, { l: 'eSIM Ratio', v: '34.2%' }].map(s => (
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
                  <td key={j} className={`px-4 py-3 text-sm ${j === 0 ? 'font-semibold text-gray-900 dark:text-white' : j === 2 ? statusColor(c) + ' font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
                    {j === 2 ? <span className={`px-2 py-0.5 rounded-full text-xs ${statusColor(c)}`}>{c}</span> : c}
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
