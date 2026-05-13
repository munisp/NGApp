import { ShieldCheck } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { FallbackBadge } from '@/components/ui/DataStates'
import { useApiData } from '@/hooks/useApiData'
import { apiClient } from '@/lib/apiClient'

const rows = [
    { id: 'SID-001', cells: ['ACMEBANK', 'Acme Bank', 'Approved', 'SMS', '142K', '0.02%', '2024-01-15', 'Passed'] },
    { id: 'SID-002', cells: ['DANGTRADE', 'Dangote Trade', 'Approved', 'SMS+WhatsApp', '84K', '0.01%', '2024-03-20', 'Passed'] },
    { id: 'SID-003', cells: ['MTNPROMO', 'MTN Promotions', 'Under Review', 'SMS', '0', '—', '2026-05-01', 'Pending'] },
    { id: 'SID-004', cells: ['SHOPRITE', 'Shoprite NG', 'Approved', 'WhatsApp', '28K', '0.05%', '2025-06-10', 'Passed'] },
    { id: 'SID-005', cells: ['SPAMTEST', 'Unknown Entity', 'Blocked', 'SMS', '0', '12.4%', '2026-04-28', 'Failed'] },
]

const headers = ['Sender ID', 'Brand', 'Status', 'Channel', 'Volume/Day', 'Complaints', 'Registered', 'Review']

function statusColor(s) {
  switch (s) {
      case 'Approved': return 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/20'
      case 'Under Review': return 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20'
      case 'Blocked': return 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20'
      default: return 'text-gray-600 bg-gray-50 dark:text-gray-400 dark:bg-gray-900/20'
  }
}

export default function CPaaSA2PCompliance() {
  const { data: _apiData, isLoading: _apiLoading, isUsingFallback } = useApiData('cpaasa2pcompliance', () => apiClient.dashboard.metrics(), { fallback: rows })
  const { tenant } = useTenant()
  return (
    <div role="region" aria-label="CPaaSA2PCompliance" className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-7 h-7 text-emerald-600" /> A2P Compliance
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Application-to-Person messaging compliance for {tenant?.name || 'Platform'}</p>
        </div>
        <FallbackBadge />
      </div>
      <div className="grid grid-cols-4 gap-3">
        {[{ l: 'Registered Senders', v: '842' }, { l: 'Compliance Rate', v: '99.2%' }, { l: 'Blocked (Today)', v: '1,247' }, { l: 'DND Checks', v: '4.2M' }].map(s => (
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
