import { useState } from 'react'
import { BookOpen, Search, Filter, ChevronDown, ChevronUp } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { FallbackBadge , ErrorState } from '@/components/ui/DataStates'
import { useApiData } from '@/hooks/useApiData'
import { apiClient } from '@/lib/apiClient'

const items = [
  { id: 'TRD-001', instrument: 'Bonny Light Crude', side: 'Buy', quantity: '50,000 bbl', price: '$82.45', counterparty: 'Shell Trading', status: 'settled', tradeDate: 'May 4', settlement: 'May 6' },
  { id: 'TRD-002', instrument: 'Cocoa', side: 'Sell', quantity: '200 tonnes', price: '$8,240/t', counterparty: 'Cargill', status: 'pending', tradeDate: 'May 4', settlement: 'May 8' },
  { id: 'TRD-003', instrument: 'Natural Gas', side: 'Buy', quantity: '10,000 MMBtu', price: '$2.84', counterparty: 'Total', status: 'settled', tradeDate: 'May 3', settlement: 'May 5' },
  { id: 'TRD-004', instrument: 'Cashew Nuts', side: 'Sell', quantity: '500 tonnes', price: '$1,420/t', counterparty: 'Olam', status: 'failed', tradeDate: 'May 2', settlement: 'Failed' }
]

export default function CommodityTradeBlotter() {
  const { data: _apiData, isLoading: _apiLoading, isUsingFallback } = useApiData('commoditytradeblotter', () => apiClient.dashboard.metrics(), { fallback: items })
  const { tenant } = useTenant()
  const [activeTab, setActiveTab] = useState('trades')
  const [search, setSearch] = useState('')
  const [expandedItem, setExpandedItem] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [error, setError] = useState(null)

  const filtered = items.filter(item => {
    const matchesSearch = !search || item.instrument.toLowerCase().includes(search.toLowerCase()) || item.side.toLowerCase().includes(search.toLowerCase()) || item.quantity.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter
    return matchesSearch && matchesStatus
  })

  if (error) return <ErrorState message={error} />

  return (
    <div role="region" aria-label="CommodityTradeBlotter" className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><BookOpen className="w-7 h-7 text-blue-600" /> Trade Blotter</h1><p className="text-gray-500 dark:text-gray-400 mt-1">Real-time trade recording and settlement tracking for {tenant?.name || 'platform'}</p></div>
        <FallbackBadge />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[{ l: 'Trades (24h)', v: '847' }, { l: 'Notional Value', v: '$1.2B' }, { l: 'Settlement Rate', v: '98.4%', c: 'text-emerald-600' }, { l: 'Pending', v: '12', c: 'text-amber-600' }].map(s => (
          <div key={s.l} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3"><p className="text-xs text-gray-500">{s.l}</p><p className={`text-xl font-bold ${s.c || 'text-gray-900 dark:text-white'}`}>{s.v}</p></div>
        ))}
      </div>

      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
        {['trades', 'settlement', 'reconciliation'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-400'}`}>
            {tab.charAt(0).toUpperCase() + tab.slice(1).replace('-', ' ')}
          </button>
        ))}
      </div>

      {activeTab === 'trades' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white" /></div>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
              <option value="all">All Status</option><option value="pending">pending</option><option value="settled">settled</option><option value="failed">failed</option>
            </select>
          </div>
          <div className="space-y-2">
            {filtered.length === 0 && <div className="text-center py-8 text-gray-500 dark:text-gray-400">No records found</div>}
          {filtered.map(item => (
              <div key={item.id} onClick={() => setExpandedItem(expandedItem === item.id ? null : item.id)} className={`bg-white dark:bg-gray-800 rounded-xl border p-4 cursor-pointer hover:shadow-md transition-shadow ${expandedItem === item.id ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-200 dark:border-gray-700'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-gray-900 dark:text-white">{item.instrument}</h4>
                      <span className={`text-xs px-2 py-0.5 rounded ${item.status === 'pending' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : item.status === 'settled' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>{item.status}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{item.side}</p>
                  </div>
                  <div className="text-right text-sm text-gray-600 dark:text-gray-400">{item.quantity}</div>
                </div>
                {expandedItem === item.id && (
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 grid grid-cols-3 gap-4 text-xs">
                    <div><span className="text-gray-500">Price</span><p className="font-medium text-gray-900 dark:text-white mt-0.5">{item.price}</p></div>
                    <div><span className="text-gray-500">Counterparty</span><p className="font-medium text-gray-900 dark:text-white mt-0.5">{item.counterparty}</p></div>
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

      {activeTab === 'settlement' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 text-center">
          <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Settlement</h3>
          <p className="text-sm text-gray-500">Connect data source to view settlement analytics and reports.</p>
          <button className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">Configure</button>
        </div>
      )}

      {activeTab === 'reconciliation' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 text-center">
          <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Reconciliation</h3>
          <p className="text-sm text-gray-500">Configure reconciliation settings and preferences.</p>
          <button className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">Setup</button>
        </div>
      )}
    </div>
  )
}
