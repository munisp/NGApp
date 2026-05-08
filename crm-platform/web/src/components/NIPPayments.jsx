import { Banknote } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { FallbackBadge } from '@/components/ui/DataStates'

const rows = [
    { id: 'NIP-2605-001', cells: ['NIP-2605-001', 'Transfer', '₦2,500,000', 'Successful', 'Dangote Corp', 'Shell Nigeria', 'GTBank', '12:34:22'] },
    { id: 'NIP-2605-002', cells: ['NIP-2605-002', 'Bill Pay', '₦84,500', 'Successful', 'MTN Enterprise', 'EKEDC', 'UBA', '12:34:18'] },
    { id: 'NIP-2605-003', cells: ['NIP-2605-003', 'Transfer', '₦15,000,000', 'Processing', 'Kano Textiles', 'Dangote Cement', 'Zenith', '12:34:15'] },
    { id: 'NIP-2605-004', cells: ['NIP-2605-004', 'Salary', '₦450,000', 'Successful', 'Acme Bank', 'Employee Batch', 'Acme MFB', '12:34:12'] },
    { id: 'NIP-2605-005', cells: ['NIP-2605-005', 'Transfer', '₦8,200,000', 'Failed', 'Unknown Sender', 'Unknown Beneficiary', 'Access', '12:33:45'] },
]

const headers = ['Reference', 'Type', 'Amount', 'Status', 'Sender', 'Beneficiary', 'Bank', 'Timestamp']

function statusColor(s) {
  switch (s) {
      case 'Successful': return 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/20'
      case 'Processing': return 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20'
      case 'Failed': return 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20'
      default: return 'text-gray-600 bg-gray-50 dark:text-gray-400 dark:bg-gray-900/20'
  }
}

export default function NIPPayments() {
  const { tenant } = useTenant()
  return (
    <div role="region" aria-label="NIPPayments" className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Banknote className="w-7 h-7 text-green-600" /> NIBSS NIP Payments
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Instant payment processing via NIBSS NIP 3.0 for {tenant?.name || 'Platform'}</p>
        </div>
        <FallbackBadge />
      </div>
      <div className="grid grid-cols-4 gap-3">
        {[{ l: 'Transactions (Today)', v: '84,247' }, { l: 'Volume', v: '₦42.8B' }, { l: 'Success Rate', v: '99.2%' }, { l: 'Avg Processing', v: '1.8s' }].map(s => (
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
