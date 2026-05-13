import { AlertTriangle } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { FallbackBadge } from '@/components/ui/DataStates'
import { useApiData } from '@/hooks/useApiData'
import { apiClient } from '@/lib/apiClient'

const rows = [
    { id: 'CP-001', cells: ['Shell Trading', 'AA-', '$420M', '$500M', '84%', '0.12%', 'Oil & Gas', 'Normal'] },
    { id: 'CP-002', cells: ['Vitol Group', 'A+', '$380M', '$400M', '95%', '0.28%', 'Oil & Gas', 'Watch'] },
    { id: 'CP-003', cells: ['Cargill', 'AA', '$290M', '$600M', '48%', '0.08%', 'Agriculture', 'Normal'] },
    { id: 'CP-004', cells: ['Trafigura', 'BBB+', '$520M', '$500M', '104%', '0.45%', 'Metals', 'Breach'] },
    { id: 'CP-005', cells: ['Glencore', 'A-', '$340M', '$450M', '76%', '0.31%', 'Diversified', 'Normal'] },
]

const headers = ['Counterparty', 'Rating', 'Exposure', 'Limit', 'Utilization', 'PD (MCMC)', 'Sector', 'Watch']

function statusColor(s) {
  switch (s) {
      case 'Normal': return 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/20'
      case 'Watch': return 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20'
      case 'Breach': return 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20'
      default: return 'text-gray-600 bg-gray-50 dark:text-gray-400 dark:bg-gray-900/20'
  }
}

export default function CommodityCounterpartyRisk() {
  const { data: _apiData, isLoading: _apiLoading, isUsingFallback } = useApiData('commoditycounterpartyrisk', () => apiClient.dashboard.metrics(), { fallback: rows })
  const { tenant } = useTenant()
  return (
    <div role="region" aria-label="CommodityCounterpartyRisk" className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <AlertTriangle className="w-7 h-7 text-amber-600" /> Counterparty Risk
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Credit exposure and counterparty risk monitoring for {tenant?.name || 'Platform'}</p>
        </div>
        <FallbackBadge />
      </div>
      <div className="grid grid-cols-4 gap-3">
        {[{ l: 'Counterparties', v: '142' }, { l: 'Total Exposure', v: '$2.4B' }, { l: 'Avg Rating', v: 'BBB+' }, { l: 'Breaches', v: '3' }].map(s => (
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
