import { useState } from 'react'
import { ShieldAlert, Search, Filter, ChevronDown, ChevronUp } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { FallbackBadge , ErrorState } from '@/components/ui/DataStates'
import { useApiData } from '@/hooks/useApiData'
import { apiClient } from '@/lib/apiClient'

const items = [
  { id: 'CP-001', name: 'Shell Trading', exposure: '$420M', limit: '$500M', utilization: '84%', creditScore: 85, rating: 'A', outlook: 'Stable', lastReview: '2 weeks ago' },
  { id: 'CP-002', name: 'Cargill', exposure: '$380M', limit: '$450M', utilization: '84%', creditScore: 82, rating: 'A-', outlook: 'Stable', lastReview: '1 month ago' },
  { id: 'CP-003', name: 'Total Energies', exposure: '$290M', limit: '$300M', utilization: '97%', creditScore: 78, rating: 'BBB+', outlook: 'Negative', lastReview: '1 week ago' },
  { id: 'CP-004', name: 'Olam Group', exposure: '$180M', limit: '$250M', utilization: '72%', creditScore: 65, rating: 'BBB-', outlook: 'Watch', lastReview: '3 days ago' },
  { id: 'CP-005', name: 'Local Trader X', exposure: '$45M', limit: '$50M', utilization: '90%', creditScore: 42, rating: 'B', outlook: 'Negative', lastReview: '2 days ago' }
]

export default function CommodityCounterpartyRisk() {
  const { data: _apiData, isLoading: _apiLoading, isUsingFallback } = useApiData('commoditycounterpartyrisk', () => apiClient.dashboard.metrics(), { fallback: items })
  const { tenant } = useTenant()
  const [activeTab, setActiveTab] = useState('exposure')
  const [search, setSearch] = useState('')
  const [expandedItem, setExpandedItem] = useState(null)
  const [error, setError] = useState(null)

  const filtered = items.filter(item => {
    const matchesSearch = !search || item.name.toLowerCase().includes(search.toLowerCase()) || item.exposure.toLowerCase().includes(search.toLowerCase()) || item.limit.toLowerCase().includes(search.toLowerCase())
    return matchesSearch
  })

  if (error) return <ErrorState message={error} />

  return (
    <div role="region" aria-label="CommodityCounterpartyRisk" className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><ShieldAlert className="w-7 h-7 text-red-600" /> Counterparty Risk</h1><p className="text-gray-500 dark:text-gray-400 mt-1">Credit risk assessment and exposure monitoring for {tenant?.name || 'platform'}</p></div>
        <FallbackBadge />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[{ l: 'Active Counterparties', v: '48' }, { l: 'Total Exposure', v: '$2.8B' }, { l: 'High Risk', v: '3', c: 'text-red-600' }, { l: 'Avg Credit Score', v: '72' }].map(s => (
          <div key={s.l} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3"><p className="text-xs text-gray-500">{s.l}</p><p className={`text-xl font-bold ${s.c || 'text-gray-900 dark:text-white'}`}>{s.v}</p></div>
        ))}
      </div>

      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
        {['exposure', 'ratings', 'limits'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-400'}`}>
            {tab.charAt(0).toUpperCase() + tab.slice(1).replace('-', ' ')}
          </button>
        ))}
      </div>

      {activeTab === 'exposure' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white" /></div>
          </div>
          <div className="space-y-2">
            {filtered.length === 0 && <div className="text-center py-8 text-gray-500 dark:text-gray-400">No records found</div>}
          {filtered.map(item => (
              <div key={item.id} onClick={() => setExpandedItem(expandedItem === item.id ? null : item.id)} className={`bg-white dark:bg-gray-800 rounded-xl border p-4 cursor-pointer hover:shadow-md transition-shadow ${expandedItem === item.id ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-200 dark:border-gray-700'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-gray-900 dark:text-white">{item.name}</h4>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{item.exposure}</p>
                  </div>
                  <div className="text-right text-sm text-gray-600 dark:text-gray-400">{item.limit}</div>
                </div>
                {expandedItem === item.id && (
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 grid grid-cols-3 gap-4 text-xs">
                    <div><span className="text-gray-500">Utilization</span><p className="font-medium text-gray-900 dark:text-white mt-0.5">{item.utilization}</p></div>
                    <div><span className="text-gray-500">Creditscore</span><p className="font-medium text-gray-900 dark:text-white mt-0.5">{item.creditScore}</p></div>
                    <div className="flex gap-2 items-start">
                      <button className="px-3 py-1.5 bg-red-600 text-white rounded text-xs hover:bg-red-700">View Details</button>
                      <button className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs text-gray-700 dark:text-gray-300">Export</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'ratings' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 text-center">
          <ShieldAlert className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Ratings</h3>
          <p className="text-sm text-gray-500">Connect data source to view ratings analytics and reports.</p>
          <button className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700">Configure</button>
        </div>
      )}

      {activeTab === 'limits' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 text-center">
          <ShieldAlert className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Limits</h3>
          <p className="text-sm text-gray-500">Configure limits settings and preferences.</p>
          <button className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700">Setup</button>
        </div>
      )}
    </div>
  )
}
