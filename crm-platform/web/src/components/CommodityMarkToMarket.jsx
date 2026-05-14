import { useState } from 'react'
import { Calculator, Search, Filter, ChevronDown, ChevronUp } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { FallbackBadge } from '@/components/ui/DataStates'
import { useApiData } from '@/hooks/useApiData'
import { apiClient } from '@/lib/apiClient'

const items = [
  { id: 'MTM-001', instrument: 'Bonny Light Crude', position: 'Long 250K bbl', entryPrice: '$80.20', markPrice: '$82.45', unrealizedPnL: '+$562,500', dayChange: '+$300,000' },
  { id: 'MTM-002', instrument: 'Cocoa Futures', position: 'Short 500 tonnes', entryPrice: '$8,100', markPrice: '$8,240', unrealizedPnL: '-$70,000', dayChange: '-$25,000' },
  { id: 'MTM-003', instrument: 'Natural Gas Swap', position: 'Long 100K MMBtu', entryPrice: '$2.90', markPrice: '$2.84', unrealizedPnL: '-$6,000', dayChange: '-$2,000' },
  { id: 'MTM-004', instrument: 'Gold Forward', position: 'Long 1,000 oz', entryPrice: '$2,310', markPrice: '$2,342', unrealizedPnL: '+$32,000', dayChange: '-$1,200' }
]

export default function CommodityMarkToMarket() {
  const { data: _apiData, isLoading: _apiLoading, isUsingFallback } = useApiData('commoditymarktomarket', () => apiClient.dashboard.metrics(), { fallback: items })
  const { tenant } = useTenant()
  const [activeTab, setActiveTab] = useState('positions')
  const [search, setSearch] = useState('')
  const [expandedItem, setExpandedItem] = useState(null)

  const filtered = items.filter(item => {
    const matchesSearch = !search || item.instrument.toLowerCase().includes(search.toLowerCase()) || item.position.toLowerCase().includes(search.toLowerCase()) || item.entryPrice.toLowerCase().includes(search.toLowerCase())
    return matchesSearch
  })

  return (
    <div role="region" aria-label="CommodityMarkToMarket" className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><Calculator className="w-7 h-7 text-cyan-600" /> Mark-to-Market</h1><p className="text-gray-500 dark:text-gray-400 mt-1">Portfolio valuation and P&L tracking for {tenant?.name || 'platform'}</p></div>
        <FallbackBadge />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[{ l: 'Portfolio NAV', v: '$4.2B' }, { l: 'Day P&L', v: '+$12.4M', c: 'text-emerald-600' }, { l: 'MTD P&L', v: '+$89.2M', c: 'text-emerald-600' }, { l: 'Unrealized', v: '-$3.8M', c: 'text-red-600' }].map(s => (
          <div key={s.l} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3"><p className="text-xs text-gray-500">{s.l}</p><p className={`text-xl font-bold ${s.c || 'text-gray-900 dark:text-white'}`}>{s.v}</p></div>
        ))}
      </div>

      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
        {['positions', 'pnl', 'risk'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-400'}`}>
            {tab.charAt(0).toUpperCase() + tab.slice(1).replace('-', ' ')}
          </button>
        ))}
      </div>

      {activeTab === 'positions' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white" /></div>
          </div>
          <div className="space-y-2">
            {filtered.map(item => (
              <div key={item.id} onClick={() => setExpandedItem(expandedItem === item.id ? null : item.id)} className={`bg-white dark:bg-gray-800 rounded-xl border p-4 cursor-pointer hover:shadow-md transition-shadow ${expandedItem === item.id ? 'border-cyan-500 ring-1 ring-cyan-500' : 'border-gray-200 dark:border-gray-700'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-gray-900 dark:text-white">{item.instrument}</h4>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{item.position}</p>
                  </div>
                  <div className="text-right text-sm text-gray-600 dark:text-gray-400">{item.entryPrice}</div>
                </div>
                {expandedItem === item.id && (
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 grid grid-cols-3 gap-4 text-xs">
                    <div><span className="text-gray-500">Markprice</span><p className="font-medium text-gray-900 dark:text-white mt-0.5">{item.markPrice}</p></div>
                    <div><span className="text-gray-500">Unrealizedpnl</span><p className="font-medium text-gray-900 dark:text-white mt-0.5">{item.unrealizedPnL}</p></div>
                    <div className="flex gap-2 items-start">
                      <button className="px-3 py-1.5 bg-cyan-600 text-white rounded text-xs hover:bg-cyan-700">View Details</button>
                      <button className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs text-gray-700 dark:text-gray-300">Export</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'pnl' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 text-center">
          <Calculator className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Pnl</h3>
          <p className="text-sm text-gray-500">Connect data source to view pnl analytics and reports.</p>
          <button className="mt-4 px-4 py-2 bg-cyan-600 text-white rounded-lg text-sm hover:bg-cyan-700">Configure</button>
        </div>
      )}

      {activeTab === 'risk' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 text-center">
          <Calculator className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Risk</h3>
          <p className="text-sm text-gray-500">Configure risk settings and preferences.</p>
          <button className="mt-4 px-4 py-2 bg-cyan-600 text-white rounded-lg text-sm hover:bg-cyan-700">Setup</button>
        </div>
      )}
    </div>
  )
}
