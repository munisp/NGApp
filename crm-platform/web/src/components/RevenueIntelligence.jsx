import { useState } from 'react'
import { DollarSign, TrendingUp, TrendingDown, Target, BarChart3, Users, ArrowUpRight, ArrowDownRight, Activity, Calendar, AlertTriangle, CheckCircle, Settings, Search } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { LoadingState, ErrorState, EmptyState, FallbackBadge, ExportButton } from '@/components/ui/DataStates'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { useApiData } from '@/hooks/useApiData'
import { apiClient } from '@/lib/apiClient'

const revenueData = {
  forecast: [
    { quarter: 'Q1 2026', target: '₦3.2B', actual: '₦3.48B', attainment: 109, deals: 42 },
    { quarter: 'Q2 2026', target: '₦3.5B', projected: '₦3.72B', attainment: 106, deals: 38 },
    { quarter: 'Q3 2026', target: '₦3.8B', projected: '₦3.65B', attainment: 96, deals: 45 },
    { quarter: 'Q4 2026', target: '₦4.2B', projected: '₦4.08B', attainment: 97, deals: 51 },
  ],
  repPerformance: [
    { name: 'Sarah Okonkwo', quota: '₦1.2B', closed: '₦1.38B', attainment: 115, deals: 18, avgCycle: '38 days' },
    { name: 'Ahmed Musa', quota: '₦1.0B', closed: '₦0.92B', attainment: 92, deals: 14, avgCycle: '42 days' },
    { name: 'Chidi Obi', quota: '₦0.8B', closed: '₦0.74B', attainment: 93, deals: 12, avgCycle: '51 days' },
    { name: 'Fatima Ibrahim', quota: '₦0.6B', closed: '₦0.68B', attainment: 113, deals: 9, avgCycle: '35 days' },
  ],
  insights: [
    { type: 'opportunity', message: 'Enterprise segment deals close 28% faster when CFO is engaged before proposal stage', impact: '+₦240M' },
    { type: 'risk', message: 'Q3 pipeline coverage dropped to 1.4x — below 2.0x benchmark. Need 8 more qualified deals.', impact: '-₦350M' },
    { type: 'trend', message: 'Trade Finance deals have 3.2x higher win rate than average. Consider vertical specialization.', impact: '+₦520M' },
  ],
}

export default function RevenueIntelligence() {
  const { data: _apiData, isLoading: _apiLoading, isUsingFallback } = useApiData('revenueintelligence', () => apiClient.dashboard.metrics(), { fallback: revenueData })
  const { tenant } = useTenant()
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState('forecast')
  const [search, setSearch] = useState('')
  const [selectedRep, setSelectedRep] = useState(null)
  const [selectedQuarter, setSelectedQuarter] = useState(null)
  const filteredReps = revenueData.repPerformance.filter(r => !search || r.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div role="region" aria-label="RevenueIntelligence" className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><DollarSign className="w-7 h-7 text-emerald-600" /> Revenue Intelligence</h1><p className="text-gray-500 dark:text-gray-400 mt-1">AI-driven revenue insights, deal analytics, and forecasting</p></div>
        <FallbackBadge />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { l: "Q1 Revenue", v: "₦3.48B" },
          { l: "Pipeline", v: "₦5.1B" },
          { l: "Win Rate", v: "32%" },
          { l: "Avg Deal Size", v: "₦82M" },
        ].map(s => (
          <div key={s.l} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3"><p className="text-xs text-gray-500">{s.l}</p><p className="text-xl font-bold text-gray-900 dark:text-white">{s.v}</p></div>
        ))}
      </div>
      <div className="border-b border-gray-200 dark:border-gray-700"><div className="flex space-x-6">
        {[
            { id: "forecast", label: "Forecast" },
            { id: "reps", label: "Rep Performance" },
            { id: "insights", label: "AI Insights" },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`pb-3 text-sm font-medium border-b-2 ${activeTab === tab.id ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-gray-500'}`}>{tab.label}</button>
        ))}
      </div></div>
      {(activeTab === 'reps' || activeTab === 'forecast') && <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder={activeTab === 'reps' ? 'Search reps...' : 'Search quarters...'} className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white" /></div>}
      {activeTab === 'forecast' && (<div className="space-y-2">
        {revenueData.forecast.filter(q => !search || q.quarter.toLowerCase().includes(search.toLowerCase())).map(q => (
          <div key={q.quarter} onClick={() => setSelectedQuarter(selectedQuarter === q.quarter ? null : q.quarter)} className={`bg-white dark:bg-gray-800 rounded-xl border p-4 cursor-pointer hover:shadow-md ${selectedQuarter === q.quarter ? 'border-emerald-500 ring-1 ring-emerald-500' : 'border-gray-200 dark:border-gray-700'}`}>
            <div className="flex items-center justify-between">
              <div><h4 className="font-semibold text-gray-900 dark:text-white">{q.quarter}</h4><span className="text-xs text-gray-400">{q.deals} deals</span></div>
              <div className="flex items-center gap-6">
                <div className="text-right"><p className="text-xs text-gray-400">Target</p><p className="text-sm font-medium text-gray-900 dark:text-white">{q.target}</p></div>
                <div className="text-right"><p className="text-xs text-gray-400">{q.actual ? 'Actual' : 'Projected'}</p><p className="text-sm font-medium text-gray-900 dark:text-white">{q.actual || q.projected}</p></div>
                <div className={`px-3 py-1 rounded-lg text-sm font-bold ${q.attainment >= 100 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>{q.attainment}%</div>
              </div>
            </div>
            {selectedQuarter === q.quarter && (<div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 mb-2"><div className={`h-3 rounded-full ${q.attainment >= 100 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${Math.min(q.attainment, 120)}%` }} /></div>
              <div className="flex gap-2 mt-3"><button className="px-3 py-1.5 bg-emerald-600 text-white rounded text-xs hover:bg-emerald-700"><BarChart3 className="w-3 h-3 inline mr-1" />View Deals</button><button className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs text-gray-700 dark:text-gray-300"><Calendar className="w-3 h-3 inline mr-1" />Schedule Review</button></div>
            </div>)}
          </div>
        ))}
      </div>)}
      {activeTab === 'reps' && (<div className="space-y-2">
        {filteredReps.map(r => (
          <div key={r.name} onClick={() => setSelectedRep(selectedRep === r.name ? null : r.name)} className={`bg-white dark:bg-gray-800 rounded-xl border p-4 cursor-pointer hover:shadow-md ${selectedRep === r.name ? 'border-emerald-500 ring-1 ring-emerald-500' : 'border-gray-200 dark:border-gray-700'}`}>
            <div className="flex items-center justify-between">
              <div><h4 className="font-semibold text-gray-900 dark:text-white">{r.name}</h4><p className="text-xs text-gray-500">{r.deals} deals · {r.avgCycle} avg cycle</p></div>
              <div className="flex items-center gap-4"><div className="text-right"><p className="text-xs text-gray-400">Closed</p><p className="text-sm font-medium text-gray-900 dark:text-white">{r.closed}</p></div><span className={`text-xs px-2 py-0.5 rounded-full ${r.attainment >= 100 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{r.attainment}%</span></div>
            </div>
            {selectedRep === r.name && (<div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-3">{[{ l: 'Quota', v: r.quota }, { l: 'Gap', v: r.attainment >= 100 ? 'Exceeded' : `₦${((parseFloat(r.quota.replace(/[₦B]/g, '')) - parseFloat(r.closed.replace(/[₦B]/g, ''))) * 1).toFixed(2)}B` }, { l: 'Win Rate', v: Math.round(r.deals / (r.deals * 1.4) * 100) + '%' }].map(s => <div key={s.l} className="text-center bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2"><p className="text-xs text-gray-400">{s.l}</p><p className="text-sm font-bold text-gray-900 dark:text-white">{s.v}</p></div>)}</div>
              <div className="flex gap-2"><button className="px-3 py-1.5 bg-emerald-600 text-white rounded text-xs">View Pipeline</button><button className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs text-gray-700 dark:text-gray-300">Schedule 1:1</button></div>
            </div>)}
          </div>
        ))}
      </div>)}
      {activeTab === 'insights' && (<div className="space-y-3">
        {revenueData.insights.map((ins, i) => (
          <div key={i} className={`rounded-xl border p-4 ${ins.type === 'opportunity' ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/10 dark:border-emerald-800' : ins.type === 'risk' ? 'bg-red-50 border-red-200 dark:bg-red-900/10 dark:border-red-800' : 'bg-blue-50 border-blue-200 dark:bg-blue-900/10 dark:border-blue-800'}`}>
            <div className="flex items-start justify-between"><p className="text-sm text-gray-800 dark:text-gray-200">{ins.message}</p><span className={`text-sm font-bold ml-4 whitespace-nowrap ${ins.type === 'risk' ? 'text-red-600' : 'text-emerald-600'}`}>{ins.impact}</span></div>
            <button className="mt-2 px-3 py-1 text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-gray-700 dark:text-gray-300">Take Action</button>
          </div>
        ))}
      </div>)}
    </div>
  )
}
