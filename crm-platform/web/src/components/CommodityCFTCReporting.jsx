import { useState } from 'react'
import { FileText, Search, Filter, ChevronDown, ChevronUp } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { FallbackBadge , ErrorState } from '@/components/ui/DataStates'
import { useApiData } from '@/hooks/useApiData'
import { apiClient } from '@/lib/apiClient'

const items = [
  { id: 'CFTC-001', type: 'Large Trader Report', authority: 'CFTC', dueDate: 'May 5, 2026', status: 'in-progress', trades: '142', notional: '$1.2B' },
  { id: 'CFTC-002', type: 'EMIR Trade Report', authority: 'ESMA', dueDate: 'May 4, 2026', status: 'submitted', trades: '89', notional: '$680M' },
  { id: 'CFTC-003', type: 'Position Report', authority: 'CFTC', dueDate: 'May 5, 2026', status: 'pending', trades: '28', notional: '$420M' },
  { id: 'CFTC-004', type: 'Dodd-Frank Swap Report', authority: 'SEC', dueDate: 'May 7, 2026', status: 'scheduled', trades: '12', notional: '$180M' }
]

export default function CommodityCFTCReporting() {
  const { data: _apiData, isLoading: _apiLoading, isUsingFallback } = useApiData('commoditycftcreporting', () => apiClient.dashboard.metrics(), { fallback: items })
  const { tenant } = useTenant()
  const [activeTab, setActiveTab] = useState('reports')
  const [search, setSearch] = useState('')
  const [expandedItem, setExpandedItem] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [error, setError] = useState(null)

  const filtered = items.filter(item => {
    const matchesSearch = !search || item.type.toLowerCase().includes(search.toLowerCase()) || item.authority.toLowerCase().includes(search.toLowerCase()) || item.dueDate.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter
    return matchesSearch && matchesStatus
  })

  if (error) return <ErrorState message={error} />

  return (
    <div role="region" aria-label="CommodityCFTCReporting" className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><FileText className="w-7 h-7 text-indigo-600" /> CFTC/EMIR Reporting</h1><p className="text-gray-500 dark:text-gray-400 mt-1">Regulatory trade reporting for commodity derivatives for {tenant?.name || 'platform'}</p></div>
        <FallbackBadge />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[{ l: 'Reports Due', v: '4', c: 'text-amber-600' }, { l: 'Submitted Today', v: '12', c: 'text-emerald-600' }, { l: 'Rejection Rate', v: '0.2%' }, { l: 'Compliance', v: '99.8%', c: 'text-emerald-600' }].map(s => (
          <div key={s.l} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3"><p className="text-xs text-gray-500">{s.l}</p><p className={`text-xl font-bold ${s.c || 'text-gray-900 dark:text-white'}`}>{s.v}</p></div>
        ))}
      </div>

      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
        {['reports', 'submissions', 'errors'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-400'}`}>
            {tab.charAt(0).toUpperCase() + tab.slice(1).replace('-', ' ')}
          </button>
        ))}
      </div>

      {activeTab === 'reports' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white" /></div>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
              <option value="all">All Status</option><option value="submitted">submitted</option><option value="in-progress">in-progress</option><option value="pending">pending</option><option value="scheduled">scheduled</option>
            </select>
          </div>
          <div className="space-y-2">
            {filtered.length === 0 && <div className="text-center py-8 text-gray-500 dark:text-gray-400">No records found</div>}
          {filtered.map(item => (
              <div key={item.id} onClick={() => setExpandedItem(expandedItem === item.id ? null : item.id)} className={`bg-white dark:bg-gray-800 rounded-xl border p-4 cursor-pointer hover:shadow-md transition-shadow ${expandedItem === item.id ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-gray-200 dark:border-gray-700'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-gray-900 dark:text-white">{item.type}</h4>
                      <span className={`text-xs px-2 py-0.5 rounded ${item.status === 'submitted' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : item.status === 'in-progress' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>{item.status}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{item.authority}</p>
                  </div>
                  <div className="text-right text-sm text-gray-600 dark:text-gray-400">{item.dueDate}</div>
                </div>
                {expandedItem === item.id && (
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 grid grid-cols-3 gap-4 text-xs">
                    <div><span className="text-gray-500">Trades</span><p className="font-medium text-gray-900 dark:text-white mt-0.5">{item.trades}</p></div>
                    <div><span className="text-gray-500">Notional</span><p className="font-medium text-gray-900 dark:text-white mt-0.5">{item.notional}</p></div>
                    <div className="flex gap-2 items-start">
                      <button className="px-3 py-1.5 bg-indigo-600 text-white rounded text-xs hover:bg-indigo-700">View Details</button>
                      <button className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs text-gray-700 dark:text-gray-300">Export</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'submissions' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 text-center">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Submissions</h3>
          <p className="text-sm text-gray-500">Connect data source to view submissions analytics and reports.</p>
          <button className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">Configure</button>
        </div>
      )}

      {activeTab === 'errors' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 text-center">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Errors</h3>
          <p className="text-sm text-gray-500">Configure errors settings and preferences.</p>
          <button className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">Setup</button>
        </div>
      )}
    </div>
  )
}
