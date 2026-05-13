import { useState } from 'react'
import { Terminal, Search, Filter, ChevronDown, ChevronUp } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { FallbackBadge } from '@/components/ui/DataStates'
import { useApiData } from '@/hooks/useApiData'
import { apiClient } from '@/lib/apiClient'

const items = [
  { id: 'USSD-001', code: '*123#', desc: 'Airtime Balance Check', sessions: '142,847', successRate: '99.2%', avgSteps: '3', avgTime: '12 sec' },
  { id: 'USSD-002', code: '*131#', desc: 'Data Bundle Purchase', sessions: '89,421', successRate: '96.8%', avgSteps: '5', avgTime: '28 sec' },
  { id: 'USSD-003', code: '*556#', desc: 'Account Self-Service', sessions: '34,892', successRate: '94.1%', avgSteps: '4', avgTime: '35 sec' },
  { id: 'USSD-004', code: '*901#', desc: 'Mobile Money Transfer', sessions: '12,032', successRate: '91.5%', avgSteps: '6', avgTime: '48 sec' },
  { id: 'USSD-005', code: '*888#', desc: 'Tariff Plan Change', sessions: '5,000', successRate: '98.4%', avgSteps: '3', avgTime: '18 sec' }
]

export default function TelcoUSSDReplay() {
  const { data: _apiData, isLoading: _apiLoading, isUsingFallback } = useApiData('telcoussdreplay', () => apiClient.dashboard.metrics(), { fallback: items })
  const { tenant } = useTenant()
  const [activeTab, setActiveTab] = useState('sessions')
  const [search, setSearch] = useState('')
  const [expandedItem, setExpandedItem] = useState(null)

  const filtered = items.filter(item => {
    const matchesSearch = !search || item.code.toLowerCase().includes(search.toLowerCase()) || item.desc.toLowerCase().includes(search.toLowerCase()) || item.sessions.toLowerCase().includes(search.toLowerCase())
    return matchesSearch
  })

  return (
    <div role="region" aria-label="TelcoUSSDReplay" className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><Terminal className="w-7 h-7 text-green-600" /> USSD Session Replay</h1><p className="text-gray-500 dark:text-gray-400 mt-1">Debug and replay USSD menu sessions for troubleshooting for {tenant?.name || 'platform'}</p></div>
        <FallbackBadge />
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[{ l: 'Sessions (24h)', v: '284,192' }, { l: 'Avg Duration', v: '42 sec' }, { l: 'Error Rate', v: '2.1%', c: 'text-red-600' }, { l: 'Popular Menu', v: '*123#' }].map(s => (
          <div key={s.l} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3"><p className="text-xs text-gray-500">{s.l}</p><p className={`text-xl font-bold ${s.c || 'text-gray-900 dark:text-white'}`}>{s.v}</p></div>
        ))}
      </div>

      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
        {['sessions', 'errors', 'menus'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-400'}`}>
            {tab.charAt(0).toUpperCase() + tab.slice(1).replace('-', ' ')}
          </button>
        ))}
      </div>

      {activeTab === 'sessions' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white" /></div>
          </div>
          <div className="space-y-2">
            {filtered.map(item => (
              <div key={item.id} onClick={() => setExpandedItem(expandedItem === item.id ? null : item.id)} className={`bg-white dark:bg-gray-800 rounded-xl border p-4 cursor-pointer hover:shadow-md transition-shadow ${expandedItem === item.id ? 'border-green-500 ring-1 ring-green-500' : 'border-gray-200 dark:border-gray-700'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-gray-900 dark:text-white">{item.code}</h4>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                  </div>
                  <div className="text-right text-sm text-gray-600 dark:text-gray-400">{item.sessions}</div>
                </div>
                {expandedItem === item.id && (
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 grid grid-cols-3 gap-4 text-xs">
                    <div><span className="text-gray-500">Successrate</span><p className="font-medium text-gray-900 dark:text-white mt-0.5">{item.successRate}</p></div>
                    <div><span className="text-gray-500">Avgsteps</span><p className="font-medium text-gray-900 dark:text-white mt-0.5">{item.avgSteps}</p></div>
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

      {activeTab === 'errors' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 text-center">
          <Terminal className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Errors</h3>
          <p className="text-sm text-gray-500">Connect data source to view errors analytics and reports.</p>
          <button className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">Configure</button>
        </div>
      )}

      {activeTab === 'menus' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 text-center">
          <Terminal className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Menus</h3>
          <p className="text-sm text-gray-500">Configure menus settings and preferences.</p>
          <button className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">Setup</button>
        </div>
      )}
    </div>
  )
}
