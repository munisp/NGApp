import { KeyRound } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { FallbackBadge } from '@/components/ui/DataStates'
import { useApiData } from '@/hooks/useApiData'
import { apiClient } from '@/lib/apiClient'

const rows = [
    { id: 'CON-84271', cells: ['CON-84271', 'Dangote Corp', 'Paystack', 'Accounts + Transactions', 'Active', '2026-01-15', '2027-01-15', '2 min ago'] },
    { id: 'CON-84272', cells: ['CON-84272', 'MTN Enterprise', 'Flutterwave', 'Accounts Only', 'Active', '2025-11-20', '2026-11-20', '1 hour ago'] },
    { id: 'CON-84273', cells: ['CON-84273', 'Kano Textiles', 'Mono', 'Full Access', 'Pending', '—', '—', '—'] },
    { id: 'CON-84274', cells: ['CON-84274', 'Shoprite NG', 'Okra', 'Balance + Transactions', 'Revoked', '2025-06-10', '2026-06-10', '2026-04-28'] },
    { id: 'CON-84275', cells: ['CON-84275', 'Total Energies', 'Stitch', 'Payments', 'Active', '2026-03-01', '2027-03-01', '5 min ago'] },
]

const headers = ['Consent ID', 'Customer', 'TPP', 'Scope', 'Status', 'Granted', 'Expires', 'Last Access']

function statusColor(s) {
  switch (s) {
      case 'Active': return 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/20'
      case 'Pending': return 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20'
      case 'Revoked': return 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20'
      default: return 'text-gray-600 bg-gray-50 dark:text-gray-400 dark:bg-gray-900/20'
  }
}

export default function OpenBankingConsent() {
  const { data: _apiData, isLoading: _apiLoading, isUsingFallback } = useApiData('openbankingconsent', () => apiClient.dashboard.metrics(), { fallback: rows })
  const { tenant } = useTenant()
  return (
    <div role="region" aria-label="OpenBankingConsent" className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <KeyRound className="w-7 h-7 text-violet-600" /> Open Banking Consent
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Manage third-party data sharing consents for {tenant?.name || 'Platform'}</p>
        </div>
        <FallbackBadge />
      </div>
      <div className="grid grid-cols-4 gap-3">
        {[{ l: 'Active Consents', v: '12,847' }, { l: 'Pending', v: '342' }, { l: 'Revoked (MTD)', v: '89' }, { l: 'TPPs Connected', v: '24' }].map(s => (
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
