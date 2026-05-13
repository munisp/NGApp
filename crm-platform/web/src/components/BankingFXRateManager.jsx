import { useState } from 'react'
import { DollarSign, TrendingUp, TrendingDown, RefreshCw, Search, AlertTriangle, Clock } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { FallbackBadge } from '@/components/ui/DataStates'
import { useApiData } from '@/hooks/useApiData'
import { apiClient } from '@/lib/apiClient'

const rates = [
  { pair: 'USD/NGN', bid: 1580.50, ask: 1582.00, spread: 1.50, change: +0.32, volume: '₦97.2B', high: 1585.00, low: 1575.20, source: 'CBN Official', lastUpdate: '2 min ago', alert: null },
  { pair: 'GBP/NGN', bid: 2012.30, ask: 2015.80, spread: 3.50, change: -0.18, volume: '₦24.8B', high: 2025.00, low: 2008.10, source: 'Interbank', lastUpdate: '5 min ago', alert: 'Approaching CBN band limit' },
  { pair: 'EUR/NGN', bid: 1728.40, ask: 1731.20, spread: 2.80, change: +0.15, volume: '₦18.4B', high: 1735.00, low: 1722.50, source: 'CBN Official', lastUpdate: '2 min ago', alert: null },
  { pair: 'CNY/NGN', bid: 218.60, ask: 219.40, spread: 0.80, change: -0.08, volume: '₦5.2B', high: 220.10, low: 217.90, source: 'Interbank', lastUpdate: '8 min ago', alert: null },
  { pair: 'JPY/NGN', bid: 10.28, ask: 10.32, spread: 0.04, change: +0.05, volume: '₦2.1B', high: 10.35, low: 10.22, source: 'Interbank', lastUpdate: '12 min ago', alert: null },
  { pair: 'ZAR/NGN', bid: 85.40, ask: 85.90, spread: 0.50, change: +0.42, volume: '₦3.8B', high: 86.20, low: 84.80, source: 'Interbank', lastUpdate: '3 min ago', alert: 'High volatility detected' },
]

const cbnAlerts = [
  { id: 'CBN-001', title: 'MPR Maintained at 27.50%', date: 'May 3, 2026', impact: 'Neutral', detail: 'Monetary Policy Committee held rates steady — no immediate FX impact expected' },
  { id: 'CBN-002', title: 'New FX Window Guidelines', date: 'May 1, 2026', impact: 'Positive', detail: 'NAFEM trading window extended by 2 hours — improved liquidity expected' },
  { id: 'CBN-003', title: 'BDC License Suspension — 12 Operators', date: 'Apr 28, 2026', impact: 'Negative', detail: 'Parallel market disruption — expect wider spreads on retail transactions' },
]

export default function BankingFXRateManager() {
  const { data: _apiData, isLoading: _apiLoading, isUsingFallback } = useApiData('bankingfxratemanager', () => apiClient.dashboard.metrics(), { fallback: rates })
  const { tenant } = useTenant()
  const [activeTab, setActiveTab] = useState('rates')
  const [search, setSearch] = useState('')
  const [selectedPair, setSelectedPair] = useState(null)
  const [sourceFilter, setSourceFilter] = useState('all')

  const filtered = rates.filter(r => {
    const matchesSearch = !search || r.pair.toLowerCase().includes(search.toLowerCase())
    const matchesSource = sourceFilter === 'all' || r.source === sourceFilter
    return matchesSearch && matchesSource
  })

  return (
    <div role="region" aria-label="BankingFXRateManager" className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><DollarSign className="w-7 h-7 text-emerald-600" /> FX Rate Manager</h1><p className="text-gray-500 dark:text-gray-400 mt-1">Live currency rates and CBN compliance for {tenant?.name || 'bank'}</p></div>
        <FallbackBadge />
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[{ l: 'Active Pairs', v: rates.length }, { l: 'Total Volume', v: '₦151.5B' }, { l: 'CBN Alerts', v: cbnAlerts.length, c: 'text-amber-600' }, { l: 'Last Refresh', v: '2 min ago' }].map(s => (
          <div key={s.l} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3"><p className="text-xs text-gray-500">{s.l}</p><p className={`text-xl font-bold ${s.c || 'text-gray-900 dark:text-white'}`}>{s.v}</p></div>
        ))}
      </div>

      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
        {['rates', 'alerts', 'history'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-400'}`}>
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === 'rates' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search currency pairs..." className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white" /></div>
            <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)} className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
              <option value="all">All Sources</option><option value="CBN Official">CBN Official</option><option value="Interbank">Interbank</option>
            </select>
            <button className="px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm flex items-center gap-1 hover:bg-emerald-700"><RefreshCw className="w-4 h-4" /> Refresh</button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {filtered.map(r => (
              <div key={r.pair} onClick={() => setSelectedPair(selectedPair === r.pair ? null : r.pair)} className={`bg-white dark:bg-gray-800 rounded-xl border p-4 cursor-pointer hover:shadow-md ${selectedPair === r.pair ? 'border-emerald-500 ring-1 ring-emerald-500' : 'border-gray-200 dark:border-gray-700'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-lg font-bold text-gray-900 dark:text-white">{r.pair}</span>
                  <span className={`flex items-center gap-1 text-sm font-medium ${r.change >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{r.change >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}{r.change >= 0 ? '+' : ''}{r.change}%</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-gray-500 text-xs">Bid</span><p className="font-mono font-medium text-gray-900 dark:text-white">{r.bid.toLocaleString()}</p></div>
                  <div><span className="text-gray-500 text-xs">Ask</span><p className="font-mono font-medium text-gray-900 dark:text-white">{r.ask.toLocaleString()}</p></div>
                </div>
                {r.alert && <div className="mt-2 flex items-center gap-1 text-xs text-amber-600"><AlertTriangle className="w-3 h-3" />{r.alert}</div>}
                {selectedPair === r.pair && (
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-gray-500">Spread</span><p className="font-medium text-gray-900 dark:text-white">{r.spread}</p></div>
                    <div><span className="text-gray-500">Volume</span><p className="font-medium text-gray-900 dark:text-white">{r.volume}</p></div>
                    <div><span className="text-gray-500">Day High</span><p className="font-medium text-emerald-600">{r.high.toLocaleString()}</p></div>
                    <div><span className="text-gray-500">Day Low</span><p className="font-medium text-red-600">{r.low.toLocaleString()}</p></div>
                    <div><span className="text-gray-500">Source</span><p className="font-medium text-gray-900 dark:text-white">{r.source}</p></div>
                    <div><span className="text-gray-500">Updated</span><p className="font-medium text-gray-900 dark:text-white">{r.lastUpdate}</p></div>
                    <div className="col-span-2 flex gap-2 mt-2">
                      <button className="px-3 py-1.5 bg-emerald-600 text-white rounded text-xs hover:bg-emerald-700">Set Alert</button>
                      <button className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs text-gray-700 dark:text-gray-300">View Chart</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'alerts' && (
        <div className="space-y-2">
          {cbnAlerts.map(alert => (
            <div key={alert.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center justify-between mb-1">
                <h4 className="font-semibold text-gray-900 dark:text-white">{alert.title}</h4>
                <span className={`text-xs px-2 py-0.5 rounded ${alert.impact === 'Positive' ? 'bg-emerald-100 text-emerald-700' : alert.impact === 'Negative' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>{alert.impact}</span>
              </div>
              <p className="text-xs text-gray-500 mb-1"><Clock className="w-3 h-3 inline mr-1" />{alert.date}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">{alert.detail}</p>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 text-center">
          <DollarSign className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Historical Rate Data</h3>
          <p className="text-sm text-gray-500">Connect to CBN/NAFEM data feed to view 90-day rate history, volatility analysis, and trend predictions.</p>
          <button className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700">Configure Data Feed</button>
        </div>
      )}
    </div>
  )
}
