import { useState } from 'react'
import { MessageSquare, Search, Filter, ChevronDown, ChevronUp } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { FallbackBadge , ErrorState } from '@/components/ui/DataStates'
import { useApiData } from '@/hooks/useApiData'
import { apiClient } from '@/lib/apiClient'

const items = [
  { id: 'MSG-001', channel: 'SMS', recipient: '+234901234567', status: 'delivered', content: 'Your OTP is 284731', timestamp: '14:32:15', latency: '1.2s', provider: 'Route Mobile' },
  { id: 'MSG-002', channel: 'WhatsApp', recipient: '+234809876543', status: 'delivered', content: 'Order confirmation #ORD-2847', timestamp: '14:30:42', latency: '0.8s', provider: 'Meta BSP' },
  { id: 'MSG-003', channel: 'SMS', recipient: '+234701122334', status: 'failed', content: 'Payment reminder', timestamp: '14:28:10', latency: '—', provider: 'Infobip', error: 'Invalid number' },
  { id: 'MSG-004', channel: 'RCS', recipient: '+234905566778', status: 'queued', content: 'Promotional offer', timestamp: '14:25:00', latency: '—', provider: 'Google RBM' }
]

export default function CPaaSMessageInspector() {
  const { data: _apiData, isLoading: _apiLoading, isUsingFallback } = useApiData('cpaasmessageinspector', () => apiClient.dashboard.metrics(), { fallback: items })
  const { tenant } = useTenant()
  const [activeTab, setActiveTab] = useState('messages')
  const [search, setSearch] = useState('')
  const [expandedItem, setExpandedItem] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [error, setError] = useState(null)

  const filtered = items.filter(item => {
    const matchesSearch = !search || item.channel.toLowerCase().includes(search.toLowerCase()) || item.recipient.toLowerCase().includes(search.toLowerCase()) || item.status.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter
    return matchesSearch && matchesStatus
  })

  if (error) return <ErrorState message={error} />

  return (
    <div role="region" aria-label="CPaaSMessageInspector" className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><MessageSquare className="w-7 h-7 text-blue-600" /> Message Inspector</h1><p className="text-gray-500 dark:text-gray-400 mt-1">Real-time message delivery tracking and debugging for {tenant?.name || 'platform'}</p></div>
        <FallbackBadge />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[{ l: 'Messages (24h)', v: '2.4M' }, { l: 'Delivered', v: '98.2%', c: 'text-emerald-600' }, { l: 'Failed', v: '1.1%', c: 'text-red-600' }, { l: 'Queued', v: '0.7%', c: 'text-amber-600' }].map(s => (
          <div key={s.l} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3"><p className="text-xs text-gray-500">{s.l}</p><p className={`text-xl font-bold ${s.c || 'text-gray-900 dark:text-white'}`}>{s.v}</p></div>
        ))}
      </div>

      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
        {['messages', 'failures', 'channels'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-400'}`}>
            {tab.charAt(0).toUpperCase() + tab.slice(1).replace('-', ' ')}
          </button>
        ))}
      </div>

      {activeTab === 'messages' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white" /></div>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
              <option value="all">All Status</option><option value="queued">queued</option><option value="delivered">delivered</option><option value="failed">failed</option>
            </select>
          </div>
          <div className="space-y-2">
            {filtered.length === 0 && <div className="text-center py-8 text-gray-500 dark:text-gray-400">No records found</div>}
          {filtered.map(item => (
              <div key={item.id} onClick={() => setExpandedItem(expandedItem === item.id ? null : item.id)} className={`bg-white dark:bg-gray-800 rounded-xl border p-4 cursor-pointer hover:shadow-md transition-shadow ${expandedItem === item.id ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-200 dark:border-gray-700'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-gray-900 dark:text-white">{item.channel}</h4>
                      <span className={`text-xs px-2 py-0.5 rounded ${item.status === 'queued' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : item.status === 'delivered' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>{item.status}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{item.recipient}</p>
                  </div>
                  <div className="text-right text-sm text-gray-600 dark:text-gray-400">{item.status}</div>
                </div>
                {expandedItem === item.id && (
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 grid grid-cols-3 gap-4 text-xs">
                    <div><span className="text-gray-500">Timestamp</span><p className="font-medium text-gray-900 dark:text-white mt-0.5">{item.timestamp}</p></div>
                    <div><span className="text-gray-500">Latency</span><p className="font-medium text-gray-900 dark:text-white mt-0.5">{item.latency}</p></div>
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

      {activeTab === 'failures' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 text-center">
          <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Failures</h3>
          <p className="text-sm text-gray-500">Connect data source to view failures analytics and reports.</p>
          <button className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">Configure</button>
        </div>
      )}

      {activeTab === 'channels' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 text-center">
          <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Channels</h3>
          <p className="text-sm text-gray-500">Configure channels settings and preferences.</p>
          <button className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">Setup</button>
        </div>
      )}
    </div>
  )
}
