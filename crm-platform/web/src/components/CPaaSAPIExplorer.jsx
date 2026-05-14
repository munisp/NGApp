import { useState } from 'react'
import { Code, Search, Filter, ChevronDown, ChevronUp } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { FallbackBadge , ErrorState } from '@/components/ui/DataStates'
import { useApiData } from '@/hooks/useApiData'
import { apiClient } from '@/lib/apiClient'

const items = [
  { id: 'API-001', method: 'POST', path: '/v2/messages/send', description: 'Send SMS/WhatsApp/RCS message', latency: '120ms', calls24h: '420K', errorRate: '0.1%' },
  { id: 'API-002', method: 'GET', path: '/v2/messages/{id}/status', description: 'Get message delivery status', latency: '45ms', calls24h: '380K', errorRate: '0.05%' },
  { id: 'API-003', method: 'POST', path: '/v2/voice/call', description: 'Initiate voice call', latency: '200ms', calls24h: '89K', errorRate: '0.8%' },
  { id: 'API-004', method: 'POST', path: '/v2/verify/start', description: 'Start 2FA verification', latency: '180ms', calls24h: '245K', errorRate: '0.2%' },
  { id: 'API-005', method: 'GET', path: '/v2/account/balance', description: 'Check account balance', latency: '30ms', calls24h: '12K', errorRate: '0.01%' }
]

export default function CPaaSAPIExplorer() {
  const { data: _apiData, isLoading: _apiLoading, isUsingFallback } = useApiData('cpaasapiexplorer', () => apiClient.dashboard.metrics(), { fallback: items })
  const { tenant } = useTenant()
  const [activeTab, setActiveTab] = useState('endpoints')
  const [search, setSearch] = useState('')
  const [expandedItem, setExpandedItem] = useState(null)
  const [error, setError] = useState(null)

  const filtered = items.filter(item => {
    const matchesSearch = !search || item.method.toLowerCase().includes(search.toLowerCase()) || item.path.toLowerCase().includes(search.toLowerCase()) || item.description.toLowerCase().includes(search.toLowerCase())
    return matchesSearch
  })

  if (error) return <ErrorState message={error} />

  return (
    <div role="region" aria-label="CPaaSAPIExplorer" className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><Code className="w-7 h-7 text-violet-600" /> API Explorer</h1><p className="text-gray-500 dark:text-gray-400 mt-1">Interactive API documentation and testing console for {tenant?.name || 'platform'}</p></div>
        <FallbackBadge />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[{ l: 'Endpoints', v: '48' }, { l: 'API Calls (24h)', v: '1.2M' }, { l: 'Avg Latency', v: '145ms' }, { l: 'Error Rate', v: '0.3%', c: 'text-emerald-600' }].map(s => (
          <div key={s.l} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3"><p className="text-xs text-gray-500">{s.l}</p><p className={`text-xl font-bold ${s.c || 'text-gray-900 dark:text-white'}`}>{s.v}</p></div>
        ))}
      </div>

      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
        {['endpoints', 'testing', 'logs'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-400'}`}>
            {tab.charAt(0).toUpperCase() + tab.slice(1).replace('-', ' ')}
          </button>
        ))}
      </div>

      {activeTab === 'endpoints' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white" /></div>
          </div>
          <div className="space-y-2">
            {filtered.length === 0 && <div className="text-center py-8 text-gray-500 dark:text-gray-400">No records found</div>}
          {filtered.map(item => (
              <div key={item.id} onClick={() => setExpandedItem(expandedItem === item.id ? null : item.id)} className={`bg-white dark:bg-gray-800 rounded-xl border p-4 cursor-pointer hover:shadow-md transition-shadow ${expandedItem === item.id ? 'border-violet-500 ring-1 ring-violet-500' : 'border-gray-200 dark:border-gray-700'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-gray-900 dark:text-white">{item.method}</h4>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{item.path}</p>
                  </div>
                  <div className="text-right text-sm text-gray-600 dark:text-gray-400">{item.description}</div>
                </div>
                {expandedItem === item.id && (
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 grid grid-cols-3 gap-4 text-xs">
                    <div><span className="text-gray-500">Latency</span><p className="font-medium text-gray-900 dark:text-white mt-0.5">{item.latency}</p></div>
                    <div><span className="text-gray-500">Calls24H</span><p className="font-medium text-gray-900 dark:text-white mt-0.5">{item.calls24h}</p></div>
                    <div className="flex gap-2 items-start">
                      <button className="px-3 py-1.5 bg-violet-600 text-white rounded text-xs hover:bg-violet-700">View Details</button>
                      <button className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs text-gray-700 dark:text-gray-300">Export</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'testing' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 text-center">
          <Code className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Testing</h3>
          <p className="text-sm text-gray-500">Connect data source to view testing analytics and reports.</p>
          <button className="mt-4 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm hover:bg-violet-700">Configure</button>
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 text-center">
          <Code className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Logs</h3>
          <p className="text-sm text-gray-500">Configure logs settings and preferences.</p>
          <button className="mt-4 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm hover:bg-violet-700">Setup</button>
        </div>
      )}
    </div>
  )
}
