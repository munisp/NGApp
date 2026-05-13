import { BarChart3 } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { FallbackBadge } from '@/components/ui/DataStates'
import { useApiData } from '@/hooks/useApiData'
import { apiClient } from '@/lib/apiClient'

const rows = [
    { id: 'BK-CRUDE', cells: ['Crude Oil', 'Energy Desk', '$1.8B', '$420M', '+$8.4M', '+$62M', '$22M', '1.42'] },
    { id: 'BK-NG', cells: ['Natural Gas', 'Energy Desk', '$620M', '$180M', '+$3.2M', '+$28M', '$8M', '1.18'] },
    { id: 'BK-METALS', cells: ['Base Metals', 'Metals Desk', '$940M', '$280M', '-$1.2M', '+$34M', '$12M', '0.94'] },
    { id: 'BK-AGRI', cells: ['Agriculture', 'Agri Desk', '$480M', '$120M', '+$4.8M', '+$12M', '$4M', '1.65'] },
    { id: 'BK-POWER', cells: ['Power & Emissions', 'Energy Desk', '$360M', '$90M', '+$3.0M', '+$6M', '$2M', '1.28'] },
]

const headers = ['Book', 'Desk', 'Gross Value', 'Net Value', 'Daily P&L', 'MTD P&L', 'VaR', 'Sharpe']

function statusColor(s) {
  switch (s) {
      default: return 'text-gray-600 bg-gray-50 dark:text-gray-400 dark:bg-gray-900/20'
  }
}

export default function CommodityMarkToMarket() {
  const { data: _apiData, isLoading: _apiLoading, isUsingFallback } = useApiData('commoditymarktomarket', () => apiClient.dashboard.metrics(), { fallback: rows })
  const { tenant } = useTenant()
  return (
    <div role="region" aria-label="CommodityMarkToMarket" className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-violet-600" /> Mark-to-Market
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Real-time portfolio valuation and P&L for {tenant?.name || 'Platform'}</p>
        </div>
        <FallbackBadge />
      </div>
      <div className="grid grid-cols-4 gap-3">
        {[{ l: 'Portfolio Value', v: '$4.2B' }, { l: 'Daily P&L', v: '+$18.2M' }, { l: 'MTD P&L', v: '+$142M' }, { l: 'VaR (99%)', v: '$48M' }].map(s => (
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
