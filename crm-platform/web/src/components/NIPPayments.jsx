import { CreditCard, CheckCircle, XCircle, Clock } from 'lucide-react'
import { FallbackBadge } from '@/components/ui/DataStates'

const transactions = [
  { id: 'NIP-284901', type: 'Inward', amount: '₦45,000,000', sender: 'GTBank', beneficiary: 'Dangote Industries', status: 'completed', time: '2 min ago', reference: 'TRF/2026/05/28490' },
  { id: 'NIP-284902', type: 'Outward', amount: '₦12,500,000', sender: 'Acme Bank', beneficiary: 'MTN Nigeria', status: 'completed', time: '5 min ago', reference: 'TRF/2026/05/28491' },
  { id: 'NIP-284903', type: 'Inward', amount: '₦890,000', sender: 'First Bank', beneficiary: 'Kano Textiles', status: 'pending', time: '8 min ago', reference: 'TRF/2026/05/28492' },
  { id: 'NIP-284904', type: 'Outward', amount: '₦2,400,000', sender: 'Acme Bank', beneficiary: 'Shoprite Nigeria', status: 'failed', time: '12 min ago', reference: 'TRF/2026/05/28493' },
  { id: 'NIP-284905', type: 'Inward', amount: '₦78,000,000', sender: 'Zenith Bank', beneficiary: 'Total Energies', status: 'completed', time: '15 min ago', reference: 'TRF/2026/05/28494' },
]

export default function NIPPayments() {
  return (
    <div role="region" aria-label="NIPPayments" className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><CreditCard className="w-7 h-7 text-blue-600" /> NIBSS NIP 3.0 Payments</h1><p className="text-gray-500 dark:text-gray-400 mt-1">Real-time instant payment processing via NIP</p></div>
        <FallbackBadge />
      </div>
      <div className="grid grid-cols-5 gap-3">
        {[{ l: 'Transactions Today', v: '12,842' }, { l: 'Volume', v: '₦4.2B' }, { l: 'Success Rate', v: '99.7%' }, { l: 'Avg Latency', v: '1.2s' }, { l: 'Failed', v: '38' }].map(s => (
          <div key={s.l} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3"><p className="text-xs text-gray-500">{s.l}</p><p className="text-xl font-bold text-gray-900 dark:text-white">{s.v}</p></div>
        ))}
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <table className="w-full"><thead className="bg-gray-50 dark:bg-gray-700"><tr>{['ID', 'Type', 'Amount', 'Sender', 'Beneficiary', 'Status', 'Time'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {transactions.map(tx => (
            <tr key={tx.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
              <td className="px-4 py-3 text-xs font-mono text-gray-500">{tx.id}</td>
              <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded ${tx.type === 'Inward' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>{tx.type}</span></td>
              <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{tx.amount}</td>
              <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{tx.sender}</td>
              <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{tx.beneficiary}</td>
              <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded flex items-center gap-1 w-fit ${tx.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : tx.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{tx.status === 'completed' ? <CheckCircle className="w-3 h-3" /> : tx.status === 'pending' ? <Clock className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}{tx.status}</span></td>
              <td className="px-4 py-3 text-xs text-gray-400">{tx.time}</td>
            </tr>
          ))}
        </tbody></table>
      </div>
    </div>
  )
}
