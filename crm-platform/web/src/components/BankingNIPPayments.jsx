import { useState } from 'react'
import { Banknote, Search, Filter, ChevronDown, ChevronUp } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { FallbackBadge } from '@/components/ui/DataStates'
import { useApiData } from '@/hooks/useApiData'
import { apiClient } from '@/lib/apiClient'

const items = [
  { id: 'NIP-001', ref: 'NIP260504143200001', amount: '₦2,500,000', sender: 'Dangote Corp', beneficiary: 'Total Energies', status: 'successful', bank: 'First Bank', time: '14:32' },
  { id: 'NIP-002', ref: 'NIP260504113000002', amount: '₦850,000', sender: 'MTN Nigeria', beneficiary: 'NTEL', status: 'successful', bank: 'GTBank', time: '11:30' },
  { id: 'NIP-003', ref: 'NIP260504091500003', amount: '₦15,000,000', sender: 'Lafarge Cement', beneficiary: 'NNPC', status: 'failed', bank: 'Zenith Bank', time: '09:15' },
  { id: 'NIP-004', ref: 'NIP260504084500004', amount: '₦125,000', sender: 'Shoprite NG', beneficiary: 'Vendor', status: 'pending', bank: 'UBA', time: '08:45' },
  { id: 'NIP-005', ref: 'NIP260504160000005', amount: '₦4,200,000', sender: 'Zenith Pharma', beneficiary: 'Equipment Ltd', status: 'successful', bank: 'Access Bank', time: '16:00' }
]

export default function BankingNIPPayments() {
  const { data: _apiData, isLoading: _apiLoading, isUsingFallback } = useApiData('bankingnippayments', () => apiClient.dashboard.metrics(), { fallback: items })
  const { tenant } = useTenant()
  const [activeTab, setActiveTab] = useState('transactions')
  const [search, setSearch] = useState('')
  const [expandedItem, setExpandedItem] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')

  const filtered = items.filter(item => {
    const matchesSearch = !search || item.ref.toLowerCase().includes(search.toLowerCase()) || item.amount.toLowerCase().includes(search.toLowerCase()) || item.sender.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter
    return matchesSearch && matchesStatus
  })

  return (
    <div role="region" aria-label="BankingNIPPayments" className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><Banknote className="w-7 h-7 text-green-600" /> NIP Payments</h1><p className="text-gray-500 dark:text-gray-400 mt-1">NIBSS Instant Payment processing and monitoring for {tenant?.name || 'platform'}</p></div>
        <FallbackBadge />
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[{ l: 'Transactions (24h)', v: '48,291' }, { l: 'Volume', v: '₦12.8B' }, { l: 'Success Rate', v: '99.4%', c: 'text-emerald-600' }, { l: 'Avg Response', v: '1.2 sec' }].map(s => (
          <div key={s.l} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3"><p className="text-xs text-gray-500">{s.l}</p><p className={`text-xl font-bold ${s.c || 'text-gray-900 dark:text-white'}`}>{s.v}</p></div>
        ))}
      </div>

      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
        {['transactions', 'failures', 'analytics'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-400'}`}>
            {tab.charAt(0).toUpperCase() + tab.slice(1).replace('-', ' ')}
          </button>
        ))}
      </div>

      {activeTab === 'transactions' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white" /></div>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
              <option value="all">All Status</option><option value="pending">pending</option><option value="successful">successful</option><option value="failed">failed</option>
            </select>
          </div>
          <div className="space-y-2">
            {filtered.map(item => (
              <div key={item.id} onClick={() => setExpandedItem(expandedItem === item.id ? null : item.id)} className={`bg-white dark:bg-gray-800 rounded-xl border p-4 cursor-pointer hover:shadow-md transition-shadow ${expandedItem === item.id ? 'border-green-500 ring-1 ring-green-500' : 'border-gray-200 dark:border-gray-700'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-gray-900 dark:text-white">{item.ref}</h4>
                      <span className={`text-xs px-2 py-0.5 rounded ${item.status === 'pending' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : item.status === 'successful' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>{item.status}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{item.amount}</p>
                  </div>
                  <div className="text-right text-sm text-gray-600 dark:text-gray-400">{item.sender}</div>
                </div>
                {expandedItem === item.id && (
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 grid grid-cols-3 gap-4 text-xs">
                    <div><span className="text-gray-500">Beneficiary</span><p className="font-medium text-gray-900 dark:text-white mt-0.5">{item.beneficiary}</p></div>
                    <div><span className="text-gray-500">Bank</span><p className="font-medium text-gray-900 dark:text-white mt-0.5">{item.bank}</p></div>
                    <div className="flex gap-2 items-start">
                      <button className="px-3 py-1.5 bg-green-600 text-white rounded text-xs hover:bg-green-700">View Details</button>
                      <button className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs text-gray-700 dark:text-gray-300">Export</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'failures' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 text-center">
          <Banknote className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Failures</h3>
          <p className="text-sm text-gray-500">Connect data source to view failures analytics and reports.</p>
          <button className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">Configure</button>
        </div>
      )}

      {activeTab === 'analytics' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 text-center">
          <Banknote className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Analytics</h3>
          <p className="text-sm text-gray-500">Configure analytics settings and preferences.</p>
          <button className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">Setup</button>
        </div>
      )}
    </div>
  )
}
