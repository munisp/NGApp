import { useState } from 'react'
import { Shield, Search, Filter, ChevronDown, ChevronUp } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { FallbackBadge } from '@/components/ui/DataStates'
import { useApiData } from '@/hooks/useApiData'
import { apiClient } from '@/lib/apiClient'

const items = [
  { id: 'A2P-001', senderId: 'ACMEBANK', brand: 'Acme Bank', status: 'approved', type: 'Transactional', volume24h: '142K', complianceScore: 98, registered: '2025-08-15' },
  { id: 'A2P-002', senderId: 'MTNNG', brand: 'MTN Nigeria', status: 'approved', type: 'Promotional', volume24h: '89K', complianceScore: 95, registered: '2025-06-20' },
  { id: 'A2P-003', senderId: 'PROMO123', brand: 'Unknown', status: 'blocked', type: 'Spam', volume24h: '12K', complianceScore: 8, registered: '—' },
  { id: 'A2P-004', senderId: 'SHOPRITE', brand: 'Shoprite NG', status: 'pending', type: 'Marketing', volume24h: '0', complianceScore: 0, registered: 'May 3, 2026' }
]

export default function CPaaSA2PCompliance() {
  const { data: _apiData, isLoading: _apiLoading, isUsingFallback } = useApiData('cpaasa2pcompliance', () => apiClient.dashboard.metrics(), { fallback: items })
  const { tenant } = useTenant()
  const [activeTab, setActiveTab] = useState('senders')
  const [search, setSearch] = useState('')
  const [expandedItem, setExpandedItem] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')

  const filtered = items.filter(item => {
    const matchesSearch = !search || item.senderId.toLowerCase().includes(search.toLowerCase()) || item.brand.toLowerCase().includes(search.toLowerCase()) || item.status.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter
    return matchesSearch && matchesStatus
  })

  return (
    <div role="region" aria-label="CPaaSA2PCompliance" className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><Shield className="w-7 h-7 text-emerald-600" /> A2P Compliance</h1><p className="text-gray-500 dark:text-gray-400 mt-1">Application-to-Person messaging compliance and sender registration for {tenant?.name || 'platform'}</p></div>
        <FallbackBadge />
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[{ l: 'Registered Senders', v: '842' }, { l: 'Compliance Rate', v: '97.8%', c: 'text-emerald-600' }, { l: 'Blocked (24h)', v: '1,247', c: 'text-red-600' }, { l: 'Pending Review', v: '12', c: 'text-amber-600' }].map(s => (
          <div key={s.l} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3"><p className="text-xs text-gray-500">{s.l}</p><p className={`text-xl font-bold ${s.c || 'text-gray-900 dark:text-white'}`}>{s.v}</p></div>
        ))}
      </div>

      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
        {['senders', 'violations', 'rules'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-400'}`}>
            {tab.charAt(0).toUpperCase() + tab.slice(1).replace('-', ' ')}
          </button>
        ))}
      </div>

      {activeTab === 'senders' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white" /></div>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
              <option value="all">All Status</option><option value="pending">pending</option><option value="approved">approved</option><option value="blocked">blocked</option>
            </select>
          </div>
          <div className="space-y-2">
            {filtered.map(item => (
              <div key={item.id} onClick={() => setExpandedItem(expandedItem === item.id ? null : item.id)} className={`bg-white dark:bg-gray-800 rounded-xl border p-4 cursor-pointer hover:shadow-md transition-shadow ${expandedItem === item.id ? 'border-emerald-500 ring-1 ring-emerald-500' : 'border-gray-200 dark:border-gray-700'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-gray-900 dark:text-white">{item.senderId}</h4>
                      <span className={`text-xs px-2 py-0.5 rounded ${item.status === 'pending' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : item.status === 'approved' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>{item.status}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{item.brand}</p>
                  </div>
                  <div className="text-right text-sm text-gray-600 dark:text-gray-400">{item.status}</div>
                </div>
                {expandedItem === item.id && (
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 grid grid-cols-3 gap-4 text-xs">
                    <div><span className="text-gray-500">Volume24H</span><p className="font-medium text-gray-900 dark:text-white mt-0.5">{item.volume24h}</p></div>
                    <div><span className="text-gray-500">Compliancescore</span><p className="font-medium text-gray-900 dark:text-white mt-0.5">{item.complianceScore}</p></div>
                    <div className="flex gap-2 items-start">
                      <button className="px-3 py-1.5 bg-emerald-600 text-white rounded text-xs hover:bg-emerald-700">View Details</button>
                      <button className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs text-gray-700 dark:text-gray-300">Export</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'violations' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 text-center">
          <Shield className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Violations</h3>
          <p className="text-sm text-gray-500">Connect data source to view violations analytics and reports.</p>
          <button className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700">Configure</button>
        </div>
      )}

      {activeTab === 'rules' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 text-center">
          <Shield className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Rules</h3>
          <p className="text-sm text-gray-500">Configure rules settings and preferences.</p>
          <button className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700">Setup</button>
        </div>
      )}
    </div>
  )
}
