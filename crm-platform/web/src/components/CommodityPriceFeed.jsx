import { useState } from 'react'
import { TrendingUp, Search, Filter, ChevronDown, ChevronUp } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { FallbackBadge , ErrorState } from '@/components/ui/DataStates'
import { useApiData } from '@/hooks/useApiData'
import { apiClient } from '@/lib/apiClient'

const items = [
  { id: 'PF-001', commodity: 'Crude Oil (Bonny Light)', price: '$82.45', change: '+1.2%', unit: 'barrel', exchange: 'NYMEX', lastUpdate: '30 sec ago', dayHigh: '$83.10', dayLow: '$81.20' },
  { id: 'PF-002', commodity: 'Natural Gas', price: '$2.84', change: '-0.8%', unit: 'MMBtu', exchange: 'NYMEX', lastUpdate: '45 sec ago', dayHigh: '$2.92', dayLow: '$2.80' },
  { id: 'PF-003', commodity: 'Cocoa', price: '$8,240', change: '+2.5%', unit: 'tonne', exchange: 'ICE', lastUpdate: '1 min ago', dayHigh: '$8,310', dayLow: '$8,040' },
  { id: 'PF-004', commodity: 'Cashew Nuts', price: '$1,420', change: '+0.3%', unit: 'tonne', exchange: 'Lagos', lastUpdate: '5 min ago', dayHigh: '$1,430', dayLow: '$1,410' },
  { id: 'PF-005', commodity: 'Gold', price: '$2,342', change: '-0.1%', unit: 'oz', exchange: 'LBMA', lastUpdate: '2 min ago', dayHigh: '$2,358', dayLow: '$2,335' }
]

export default function CommodityPriceFeed() {
  const { data: _apiData, isLoading: _apiLoading, isUsingFallback } = useApiData('commoditypricefeed', () => apiClient.dashboard.metrics(), { fallback: items })
  const { tenant } = useTenant()
  const [activeTab, setActiveTab] = useState('prices')
  const [search, setSearch] = useState('')
  const [expandedItem, setExpandedItem] = useState(null)
  const [error, setError] = useState(null)

  const filtered = items.filter(item => {
    const matchesSearch = !search || item.commodity.toLowerCase().includes(search.toLowerCase()) || item.price.toLowerCase().includes(search.toLowerCase()) || item.change.toLowerCase().includes(search.toLowerCase())
    return matchesSearch
  })

  if (error) return <ErrorState message={error} />

  return (
    <div role="region" aria-label="CommodityPriceFeed" className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><TrendingUp className="w-7 h-7 text-amber-600" /> Live Price Feed</h1><p className="text-gray-500 dark:text-gray-400 mt-1">Real-time commodity price monitoring with alerts for {tenant?.name || 'platform'}</p></div>
        <FallbackBadge />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[{ l: 'Active Feeds', v: '12' }, { l: 'Price Alerts', v: '5', c: 'text-amber-600' }, { l: 'Avg Latency', v: '< 200ms', c: 'text-emerald-600' }, { l: 'Markets Open', v: '3/4' }].map(s => (
          <div key={s.l} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3"><p className="text-xs text-gray-500">{s.l}</p><p className={`text-xl font-bold ${s.c || 'text-gray-900 dark:text-white'}`}>{s.v}</p></div>
        ))}
      </div>

      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
        {['prices', 'alerts', 'history'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-400'}`}>
            {tab.charAt(0).toUpperCase() + tab.slice(1).replace('-', ' ')}
          </button>
        ))}
      </div>

      {activeTab === 'prices' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white" /></div>
          </div>
          <div className="space-y-2">
            {filtered.length === 0 && <div className="text-center py-8 text-gray-500 dark:text-gray-400">No records found</div>}
          {filtered.map(item => (
              <div key={item.id} onClick={() => setExpandedItem(expandedItem === item.id ? null : item.id)} className={`bg-white dark:bg-gray-800 rounded-xl border p-4 cursor-pointer hover:shadow-md transition-shadow ${expandedItem === item.id ? 'border-amber-500 ring-1 ring-amber-500' : 'border-gray-200 dark:border-gray-700'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-gray-900 dark:text-white">{item.commodity}</h4>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{item.price}</p>
                  </div>
                  <div className="text-right text-sm text-gray-600 dark:text-gray-400">{item.change}</div>
                </div>
                {expandedItem === item.id && (
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 grid grid-cols-3 gap-4 text-xs">
                    <div><span className="text-gray-500">Unit</span><p className="font-medium text-gray-900 dark:text-white mt-0.5">{item.unit}</p></div>
                    <div><span className="text-gray-500">Exchange</span><p className="font-medium text-gray-900 dark:text-white mt-0.5">{item.exchange}</p></div>
                    <div className="flex gap-2 items-start">
                      <button className="px-3 py-1.5 bg-amber-600 text-white rounded text-xs hover:bg-amber-700">View Details</button>
                      <button className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs text-gray-700 dark:text-gray-300">Export</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'alerts' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 text-center">
          <TrendingUp className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Alerts</h3>
          <p className="text-sm text-gray-500">Connect data source to view alerts analytics and reports.</p>
          <button className="mt-4 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm hover:bg-amber-700">Configure</button>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 text-center">
          <TrendingUp className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">History</h3>
          <p className="text-sm text-gray-500">Configure history settings and preferences.</p>
          <button className="mt-4 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm hover:bg-amber-700">Setup</button>
        </div>
      )}
    </div>
  )
}
