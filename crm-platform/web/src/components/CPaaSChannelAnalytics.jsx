import { useState } from 'react'
import { BarChart3, Search, Filter, ChevronDown, ChevronUp } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { FallbackBadge } from '@/components/ui/DataStates'
import { useApiData } from '@/hooks/useApiData'
import { apiClient } from '@/lib/apiClient'

const items = [
  { id: 'CH-001', channel: 'SMS', volume: '4.2M', deliveryRate: '97.8%', avgLatency: '1.4s', cost: '$82K', costPerMsg: '$0.019', trend: 'stable' },
  { id: 'CH-002', channel: 'WhatsApp', volume: '2.8M', deliveryRate: '99.1%', avgLatency: '0.8s', cost: '$42K', costPerMsg: '$0.015', trend: 'growing' },
  { id: 'CH-003', channel: 'RCS', volume: '890K', deliveryRate: '96.2%', avgLatency: '1.8s', cost: '$12K', costPerMsg: '$0.013', trend: 'growing' },
  { id: 'CH-004', channel: 'Voice', volume: '420K', deliveryRate: '94.5%', avgLatency: '2.1s', cost: '$6K', costPerMsg: '$0.014', trend: 'declining' }
]

export default function CPaaSChannelAnalytics() {
  const { data: _apiData, isLoading: _apiLoading, isUsingFallback } = useApiData('cpaaschannelanalytics', () => apiClient.dashboard.metrics(), { fallback: items })
  const { tenant } = useTenant()
  const [activeTab, setActiveTab] = useState('overview')
  const [search, setSearch] = useState('')
  const [expandedItem, setExpandedItem] = useState(null)

  const filtered = items.filter(item => {
    const matchesSearch = !search || item.channel.toLowerCase().includes(search.toLowerCase()) || item.volume.toLowerCase().includes(search.toLowerCase()) || item.deliveryRate.toLowerCase().includes(search.toLowerCase())
    return matchesSearch
  })

  return (
    <div role="region" aria-label="CPaaSChannelAnalytics" className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><BarChart3 className="w-7 h-7 text-purple-600" /> Channel Analytics</h1><p className="text-gray-500 dark:text-gray-400 mt-1">Cross-channel messaging performance and cost analysis for {tenant?.name || 'platform'}</p></div>
        <FallbackBadge />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[{ l: 'Total Messages', v: '8.4M' }, { l: 'Cost (MTD)', v: '$142K' }, { l: 'Avg Delivery', v: '98.2%', c: 'text-emerald-600' }, { l: 'Best Channel', v: 'WhatsApp' }].map(s => (
          <div key={s.l} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3"><p className="text-xs text-gray-500">{s.l}</p><p className={`text-xl font-bold ${s.c || 'text-gray-900 dark:text-white'}`}>{s.v}</p></div>
        ))}
      </div>

      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
        {['overview', 'channels', 'costs'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-400'}`}>
            {tab.charAt(0).toUpperCase() + tab.slice(1).replace('-', ' ')}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white" /></div>
          </div>
          <div className="space-y-2">
            {filtered.map(item => (
              <div key={item.id} onClick={() => setExpandedItem(expandedItem === item.id ? null : item.id)} className={`bg-white dark:bg-gray-800 rounded-xl border p-4 cursor-pointer hover:shadow-md transition-shadow ${expandedItem === item.id ? 'border-purple-500 ring-1 ring-purple-500' : 'border-gray-200 dark:border-gray-700'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-gray-900 dark:text-white">{item.channel}</h4>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{item.volume}</p>
                  </div>
                  <div className="text-right text-sm text-gray-600 dark:text-gray-400">{item.deliveryRate}</div>
                </div>
                {expandedItem === item.id && (
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 grid grid-cols-3 gap-4 text-xs">
                    <div><span className="text-gray-500">Avglatency</span><p className="font-medium text-gray-900 dark:text-white mt-0.5">{item.avgLatency}</p></div>
                    <div><span className="text-gray-500">Cost</span><p className="font-medium text-gray-900 dark:text-white mt-0.5">{item.cost}</p></div>
                    <div className="flex gap-2 items-start">
                      <button className="px-3 py-1.5 bg-purple-600 text-white rounded text-xs hover:bg-purple-700">View Details</button>
                      <button className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs text-gray-700 dark:text-gray-300">Export</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'channels' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 text-center">
          <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Channels</h3>
          <p className="text-sm text-gray-500">Connect data source to view channels analytics and reports.</p>
          <button className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700">Configure</button>
        </div>
      )}

      {activeTab === 'costs' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 text-center">
          <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Costs</h3>
          <p className="text-sm text-gray-500">Configure costs settings and preferences.</p>
          <button className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700">Setup</button>
        </div>
      )}
    </div>
  )
}
