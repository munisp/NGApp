import { useState } from 'react'
import { KeyRound, Search, Filter, ChevronDown, ChevronUp } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { FallbackBadge } from '@/components/ui/DataStates'
import { useApiData } from '@/hooks/useApiData'
import { apiClient } from '@/lib/apiClient'

const items = [
  { id: 'OBC-001', customer: 'Dangote Industries', tpp: 'Flutterwave', scope: 'Account Balance, Transaction History', status: 'active', granted: '2026-01-15', expires: '2027-01-15', accessCount: '1,247' },
  { id: 'OBC-002', customer: 'MTN Nigeria', tpp: 'Paystack', scope: 'Account Balance, Payments', status: 'active', granted: '2025-11-20', expires: '2026-11-20', accessCount: '3,891' },
  { id: 'OBC-003', customer: 'Kano Textiles', tpp: 'Mono', scope: 'Transaction History', status: 'revoked', granted: '2025-06-10', expires: '—', accessCount: '89' },
  { id: 'OBC-004', customer: 'Shoprite Nigeria', tpp: 'Okra', scope: 'Account Balance, Identity', status: 'active', granted: '2026-03-01', expires: '2027-03-01', accessCount: '456' }
]

export default function BankingOpenBankingConsent() {
  const { data: _apiData, isLoading: _apiLoading, isUsingFallback } = useApiData('bankingopenbankingconsent', () => apiClient.dashboard.metrics(), { fallback: items })
  const { tenant } = useTenant()
  const [activeTab, setActiveTab] = useState('consents')
  const [search, setSearch] = useState('')
  const [expandedItem, setExpandedItem] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')

  const filtered = items.filter(item => {
    const matchesSearch = !search || item.customer.toLowerCase().includes(search.toLowerCase()) || item.tpp.toLowerCase().includes(search.toLowerCase()) || item.scope.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter
    return matchesSearch && matchesStatus
  })

  return (
    <div role="region" aria-label="BankingOpenBankingConsent" className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><KeyRound className="w-7 h-7 text-blue-600" /> Open Banking Consent</h1><p className="text-gray-500 dark:text-gray-400 mt-1">Customer consent management for Open Banking API access for {tenant?.name || 'platform'}</p></div>
        <FallbackBadge />
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[{ l: 'Active Consents', v: '8,421' }, { l: 'TPPs Connected', v: '24' }, { l: 'Revoked (MTD)', v: '142', c: 'text-amber-600' }, { l: 'Consent Rate', v: '78%', c: 'text-emerald-600' }].map(s => (
          <div key={s.l} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3"><p className="text-xs text-gray-500">{s.l}</p><p className={`text-xl font-bold ${s.c || 'text-gray-900 dark:text-white'}`}>{s.v}</p></div>
        ))}
      </div>

      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
        {['consents', 'tpps', 'audit'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-400'}`}>
            {tab.charAt(0).toUpperCase() + tab.slice(1).replace('-', ' ')}
          </button>
        ))}
      </div>

      {activeTab === 'consents' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white" /></div>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
              <option value="all">All Status</option><option value="active">active</option><option value="revoked">revoked</option>
            </select>
          </div>
          <div className="space-y-2">
            {filtered.map(item => (
              <div key={item.id} onClick={() => setExpandedItem(expandedItem === item.id ? null : item.id)} className={`bg-white dark:bg-gray-800 rounded-xl border p-4 cursor-pointer hover:shadow-md transition-shadow ${expandedItem === item.id ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-200 dark:border-gray-700'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-gray-900 dark:text-white">{item.customer}</h4>
                      <span className={`text-xs px-2 py-0.5 rounded ${item.status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : item.status === 'revoked' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>{item.status}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{item.tpp}</p>
                  </div>
                  <div className="text-right text-sm text-gray-600 dark:text-gray-400">{item.scope}</div>
                </div>
                {expandedItem === item.id && (
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 grid grid-cols-3 gap-4 text-xs">
                    <div><span className="text-gray-500">Granted</span><p className="font-medium text-gray-900 dark:text-white mt-0.5">{item.granted}</p></div>
                    <div><span className="text-gray-500">Expires</span><p className="font-medium text-gray-900 dark:text-white mt-0.5">{item.expires}</p></div>
                    <div className="flex gap-2 items-start">
                      <button className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700">View Details</button>
                      <button className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs text-gray-700 dark:text-gray-300">Export</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'tpps' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 text-center">
          <KeyRound className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Tpps</h3>
          <p className="text-sm text-gray-500">Connect data source to view tpps analytics and reports.</p>
          <button className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">Configure</button>
        </div>
      )}

      {activeTab === 'audit' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 text-center">
          <KeyRound className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Audit</h3>
          <p className="text-sm text-gray-500">Configure audit settings and preferences.</p>
          <button className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">Setup</button>
        </div>
      )}
    </div>
  )
}
