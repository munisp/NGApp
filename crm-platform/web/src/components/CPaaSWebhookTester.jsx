import { useState } from 'react'
import { Webhook, Search, Filter, ChevronDown, ChevronUp } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { FallbackBadge } from '@/components/ui/DataStates'
import { useApiData } from '@/hooks/useApiData'
import { apiClient } from '@/lib/apiClient'

const items = [
  { id: 'WH-001', url: 'https://api.acmebank.com/webhooks/sms', events: 'message.delivered, message.failed', status: 'active', successRate: '99.4%', lastEvent: '2 min ago', retries: 0 },
  { id: 'WH-002', url: 'https://hooks.mtn.ng/cpaas', events: 'message.delivered', status: 'active', successRate: '98.8%', lastEvent: '5 min ago', retries: 2 },
  { id: 'WH-003', url: 'https://notify.shoprite.ng/msg', events: 'message.delivered, message.read', status: 'failing', successRate: '82.1%', lastEvent: '1 hour ago', retries: 12 },
  { id: 'WH-004', url: 'https://api.test.local/webhook', events: 'all', status: 'inactive', successRate: '—', lastEvent: '3 days ago', retries: 0 }
]

export default function CPaaSWebhookTester() {
  const { data: _apiData, isLoading: _apiLoading, isUsingFallback } = useApiData('cpaaswebhooktester', () => apiClient.dashboard.metrics(), { fallback: items })
  const { tenant } = useTenant()
  const [activeTab, setActiveTab] = useState('webhooks')
  const [search, setSearch] = useState('')
  const [expandedItem, setExpandedItem] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')

  const filtered = items.filter(item => {
    const matchesSearch = !search || item.url.toLowerCase().includes(search.toLowerCase()) || item.events.toLowerCase().includes(search.toLowerCase()) || item.status.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter
    return matchesSearch && matchesStatus
  })

  return (
    <div role="region" aria-label="CPaaSWebhookTester" className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><Webhook className="w-7 h-7 text-orange-600" /> Webhook Tester</h1><p className="text-gray-500 dark:text-gray-400 mt-1">Test and debug webhook event delivery for {tenant?.name || 'platform'}</p></div>
        <FallbackBadge />
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[{ l: 'Active Webhooks', v: '24' }, { l: 'Events (24h)', v: '184K' }, { l: 'Success Rate', v: '99.1%', c: 'text-emerald-600' }, { l: 'Avg Latency', v: '245ms' }].map(s => (
          <div key={s.l} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3"><p className="text-xs text-gray-500">{s.l}</p><p className={`text-xl font-bold ${s.c || 'text-gray-900 dark:text-white'}`}>{s.v}</p></div>
        ))}
      </div>

      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
        {['webhooks', 'events', 'testing'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-400'}`}>
            {tab.charAt(0).toUpperCase() + tab.slice(1).replace('-', ' ')}
          </button>
        ))}
      </div>

      {activeTab === 'webhooks' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white" /></div>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
              <option value="all">All Status</option><option value="active">active</option><option value="inactive">inactive</option><option value="failing">failing</option>
            </select>
          </div>
          <div className="space-y-2">
            {filtered.map(item => (
              <div key={item.id} onClick={() => setExpandedItem(expandedItem === item.id ? null : item.id)} className={`bg-white dark:bg-gray-800 rounded-xl border p-4 cursor-pointer hover:shadow-md transition-shadow ${expandedItem === item.id ? 'border-orange-500 ring-1 ring-orange-500' : 'border-gray-200 dark:border-gray-700'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-gray-900 dark:text-white">{item.url}</h4>
                      <span className={`text-xs px-2 py-0.5 rounded ${item.status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : item.status === 'inactive' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>{item.status}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{item.events}</p>
                  </div>
                  <div className="text-right text-sm text-gray-600 dark:text-gray-400">{item.status}</div>
                </div>
                {expandedItem === item.id && (
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 grid grid-cols-3 gap-4 text-xs">
                    <div><span className="text-gray-500">Lastevent</span><p className="font-medium text-gray-900 dark:text-white mt-0.5">{item.lastEvent}</p></div>
                    <div><span className="text-gray-500">Retries</span><p className="font-medium text-gray-900 dark:text-white mt-0.5">{item.retries}</p></div>
                    <div className="flex gap-2 items-start">
                      <button className="px-3 py-1.5 bg-orange-600 text-white rounded text-xs hover:bg-orange-700">View Details</button>
                      <button className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs text-gray-700 dark:text-gray-300">Export</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'events' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 text-center">
          <Webhook className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Events</h3>
          <p className="text-sm text-gray-500">Connect data source to view events analytics and reports.</p>
          <button className="mt-4 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm hover:bg-orange-700">Configure</button>
        </div>
      )}

      {activeTab === 'testing' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 text-center">
          <Webhook className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Testing</h3>
          <p className="text-sm text-gray-500">Configure testing settings and preferences.</p>
          <button className="mt-4 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm hover:bg-orange-700">Setup</button>
        </div>
      )}
    </div>
  )
}
