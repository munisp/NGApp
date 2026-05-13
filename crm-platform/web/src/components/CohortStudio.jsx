import { useState } from 'react'
import { Users, TrendingUp, BarChart3, Calendar, Target, Search, Filter } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { FallbackBadge } from '@/components/ui/DataStates'
import { useApiData } from '@/hooks/useApiData'
import { apiClient } from '@/lib/apiClient'

const cohorts = [
  { id: 'COH-001', name: 'Jan 2026 Acquired', size: 1842, retention30: 92, retention90: 78, retention180: 65, avgLTV: '₦4.2M', topProduct: 'Business Account', source: 'Organic', color: 'bg-blue-500', churn: 8, revenue: '₦7.7B' },
  { id: 'COH-002', name: 'Q4 2025 Enterprise', size: 12, retention30: 100, retention90: 100, retention180: 92, avgLTV: '₦142M', topProduct: 'Treasury Suite', source: 'Sales', color: 'bg-emerald-500', churn: 0, revenue: '₦1.7B' },
  { id: 'COH-003', name: 'Referred Customers', size: 3200, retention30: 95, retention90: 84, retention180: 72, avgLTV: '₦6.8M', topProduct: 'Trade Finance', source: 'Referral', color: 'bg-purple-500', churn: 5, revenue: '₦21.8B' },
  { id: 'COH-004', name: 'Mobile-First Users', size: 18400, retention30: 88, retention90: 68, retention180: 52, avgLTV: '₦1.2M', topProduct: 'Mobile Banking', source: 'App Store', color: 'bg-amber-500', churn: 12, revenue: '₦22.1B' },
  { id: 'COH-005', name: 'Campaign: Q1 Promo', size: 4800, retention30: 85, retention90: 62, retention180: 48, avgLTV: '₦0.8M', topProduct: 'Savings Account', source: 'Campaign', color: 'bg-rose-500', churn: 15, revenue: '₦3.8B' },
]

export default function CohortStudio() {
  const { data: _apiData, isLoading: _apiLoading, isUsingFallback } = useApiData('cohortstudio', () => apiClient.dashboard.metrics(), { fallback: cohorts })
  const { tenant } = useTenant()
  const [activeTab, setActiveTab] = useState('cohorts')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)

  const filtered = cohorts.filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.source.toLowerCase().includes(search.toLowerCase()))

  return (
    <div role="region" aria-label="CohortStudio" className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><Users className="w-7 h-7 text-indigo-600" /> Cohort Studio</h1><p className="text-gray-500 dark:text-gray-400 mt-1">Customer cohort analysis for {tenant?.name || 'Platform'}</p></div>
        <FallbackBadge />
      </div>
      <div className="grid grid-cols-4 gap-3">
        {[{ l: 'Total Cohorts', v: cohorts.length }, { l: 'Tracked Customers', v: cohorts.reduce((s, c) => s + c.size, 0).toLocaleString() }, { l: 'Avg 90d Retention', v: Math.round(cohorts.reduce((s, c) => s + c.retention90, 0) / cohorts.length) + '%', c: 'text-emerald-600' }, { l: 'Best Source', v: 'Referral' }].map(s => (
          <div key={s.l} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3"><p className="text-xs text-gray-500">{s.l}</p><p className={`text-xl font-bold ${s.c || 'text-gray-900 dark:text-white'}`}>{s.v}</p></div>
        ))}
      </div>
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
        {['cohorts', 'retention', 'ltv'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-400'}`}>{tab === 'ltv' ? 'LTV' : tab.charAt(0).toUpperCase() + tab.slice(1)}</button>
        ))}
      </div>
      {activeTab === 'cohorts' && (<div className="space-y-4">
        <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search cohorts..." className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white" /></div>
        <div className="space-y-2">{filtered.map(c => (
          <div key={c.id} onClick={() => setSelected(selected === c.id ? null : c.id)} className={`bg-white dark:bg-gray-800 rounded-xl border p-4 cursor-pointer hover:shadow-md ${selected === c.id ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-gray-200 dark:border-gray-700'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3"><div className={`w-3 h-3 rounded-full ${c.color}`} /><div><h4 className="font-semibold text-gray-900 dark:text-white">{c.name}</h4><div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5"><span>{c.size.toLocaleString()} users</span><span>{c.source}</span><span>{c.topProduct}</span></div></div></div>
              <div className="flex items-center gap-4">{[{ l: '30d', v: c.retention30 }, { l: '90d', v: c.retention90 }, { l: '180d', v: c.retention180 }].map(r => <div key={r.l} className="text-center"><span className={`text-sm font-bold ${r.v >= 80 ? 'text-emerald-600' : r.v >= 60 ? 'text-amber-600' : 'text-red-600'}`}>{r.v}%</span><p className="text-[10px] text-gray-400">{r.l}</p></div>)}</div>
            </div>
            {selected === c.id && (<div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 grid grid-cols-4 gap-4 text-xs">
              <div><span className="text-gray-500">Avg LTV</span><p className="font-medium text-gray-900 dark:text-white mt-0.5">{c.avgLTV}</p></div>
              <div><span className="text-gray-500">Total Revenue</span><p className="font-medium text-gray-900 dark:text-white mt-0.5">{c.revenue}</p></div>
              <div><span className="text-gray-500">Churn Rate</span><p className={`font-medium mt-0.5 ${c.churn <= 5 ? 'text-emerald-600' : c.churn <= 10 ? 'text-amber-600' : 'text-red-600'}`}>{c.churn}%</p></div>
              <div className="flex gap-2 items-start"><button className="px-3 py-1.5 bg-indigo-600 text-white rounded text-xs">Analyze</button><button className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs text-gray-700 dark:text-gray-300">Export</button></div>
            </div>)}
          </div>
        ))}</div>
      </div>)}
      {activeTab === 'retention' && (<div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-4">
        <h3 className="font-semibold text-gray-900 dark:text-white">Retention Heatmap</h3>
        {cohorts.map(c => (<div key={c.id} className="flex items-center gap-2"><span className="w-40 text-xs text-gray-600 dark:text-gray-400 truncate">{c.name}</span>{[c.retention30, c.retention90, c.retention180].map((r, i) => <div key={i} className={`flex-1 h-8 rounded flex items-center justify-center text-xs font-medium text-white ${r >= 80 ? 'bg-emerald-500' : r >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}>{r}%</div>)}</div>))}
        <div className="flex items-center gap-2 mt-2"><span className="w-40" />{['30-Day', '90-Day', '180-Day'].map(l => <span key={l} className="flex-1 text-center text-xs text-gray-400">{l}</span>)}</div>
      </div>)}
      {activeTab === 'ltv' && (<div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-4">
        <h3 className="font-semibold text-gray-900 dark:text-white">Lifetime Value by Cohort</h3>
        {cohorts.map(c => (<div key={c.id} className="flex items-center gap-3"><span className="w-40 text-sm text-gray-600 dark:text-gray-400 truncate">{c.name}</span><div className="flex-1 h-6 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden"><div className={`h-full rounded-full ${c.color}`} style={{ width: `${Math.min(parseFloat(c.avgLTV.replace(/[₦BM,]/g, '')) / 150 * 100, 100)}%` }} /></div><span className="w-20 text-right text-sm font-medium text-gray-900 dark:text-white">{c.avgLTV}</span></div>))}
      </div>)}
    </div>
  )
}
