import { useState } from 'react'
import { Target, TrendingUp, TrendingDown, Search, BarChart3, CheckCircle, XCircle } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { FallbackBadge } from '@/components/ui/DataStates'
import { useApiData } from '@/hooks/useApiData'
import { apiClient } from '@/lib/apiClient'

const deals = [
  { id: 'WL-001', deal: 'Dangote Trade Finance', outcome: 'won', value: '₦2.5B', cycle: '38 days', competitors: ['GTBank', 'Zenith'], decisionMaker: 'CFO Office', lostReason: null, factors: [{ f: 'CEO relationship', impact: '+' }, { f: 'Competitive pricing', impact: '+' }, { f: 'Fast POC delivery', impact: '+' }] },
  { id: 'WL-002', deal: 'NNPC Infrastructure', outcome: 'lost', value: '₦1.8B', cycle: '92 days', competitors: ['First Bank'], decisionMaker: 'Procurement', lostReason: 'Price + compliance', factors: [{ f: 'Price too high', impact: '-' }, { f: 'Slow response time', impact: '-' }, { f: 'Missing compliance cert', impact: '-' }] },
  { id: 'WL-003', deal: 'Lafarge Cement', outcome: 'won', value: '₦450M', cycle: '28 days', competitors: ['Access Bank'], decisionMaker: 'CFO', lostReason: null, factors: [{ f: 'Industry expertise', impact: '+' }, { f: 'Referral from Dangote', impact: '+' }, { f: 'Flexible terms', impact: '+' }] },
  { id: 'WL-004', deal: 'Coca-Cola Nigeria', outcome: 'lost', value: '₦890M', cycle: '120 days', competitors: ['Stanbic', 'UBA'], decisionMaker: 'CTO', lostReason: 'Feature gap + bundled pricing', factors: [{ f: 'No executive sponsor', impact: '-' }, { f: 'Feature gap in FX', impact: '-' }, { f: 'Bundled competitor pricing', impact: '-' }] },
  { id: 'WL-005', deal: 'MTN Payroll', outcome: 'won', value: '₦890M', cycle: '42 days', competitors: ['Zenith'], decisionMaker: 'CFO', lostReason: null, factors: [{ f: 'CFO champion', impact: '+' }, { f: 'POC success', impact: '+' }] },
]

export default function WinLossAnalysis() {
  const { data: _apiData, isLoading: _apiLoading, isUsingFallback } = useApiData('winlossanalysis', () => apiClient.dashboard.metrics(), { fallback: deals })
  const { tenant } = useTenant()
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState('deals')
  const [selected, setSelected] = useState(null)

  const filtered = deals.filter(d => {
    const matchesFilter = filter === 'all' || d.outcome === filter
    const matchesSearch = !search || d.deal.toLowerCase().includes(search.toLowerCase())
    return matchesFilter && matchesSearch
  })
  const wins = deals.filter(d => d.outcome === 'won')
  const losses = deals.filter(d => d.outcome === 'lost')

  return (
    <div role="region" aria-label="WinLossAnalysis" className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><Target className="w-7 h-7 text-rose-600" /> Win/Loss Analysis</h1><p className="text-gray-500 dark:text-gray-400 mt-1">Analyze deal outcomes for {tenant?.name || 'Platform'}</p></div>
        <FallbackBadge />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[{ l: 'Total Deals', v: deals.length }, { l: 'Won', v: wins.length, c: 'text-emerald-600' }, { l: 'Lost', v: losses.length, c: 'text-red-600' }, { l: 'Win Rate', v: Math.round(wins.length / deals.length * 100) + '%' }, { l: 'Avg Cycle', v: Math.round(deals.reduce((s, d) => s + parseInt(d.cycle), 0) / deals.length) + 'd' }].map(s => (
          <div key={s.l} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3"><p className="text-xs text-gray-500">{s.l}</p><p className={`text-xl font-bold ${s.c || 'text-gray-900 dark:text-white'}`}>{s.v}</p></div>
        ))}
      </div>
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
        {['deals', 'insights', 'competitors'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-400'}`}>{tab.charAt(0).toUpperCase() + tab.slice(1)}</button>
        ))}
      </div>
      {activeTab === 'deals' && (<div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search deals..." className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white" /></div>
          <div className="flex gap-1">{['all', 'won', 'lost'].map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize ${filter === f ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>{f}</button>
          ))}</div>
        </div>
        <div className="space-y-2">{filtered.map(d => (
          <div key={d.id} onClick={() => setSelected(selected === d.id ? null : d.id)} className={`bg-white dark:bg-gray-800 rounded-xl border-l-4 ${d.outcome === 'won' ? 'border-l-emerald-500' : 'border-l-red-500'} border border-gray-200 dark:border-gray-700 p-4 cursor-pointer hover:shadow-md ${selected === d.id ? 'ring-1 ring-rose-500' : ''}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2"><h4 className="font-semibold text-gray-900 dark:text-white">{d.deal}</h4><span className={`text-xs px-2 py-0.5 rounded ${d.outcome === 'won' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{d.outcome}</span></div>
              <div className="flex items-center gap-3 text-sm"><span className="font-medium text-gray-900 dark:text-white">{d.value}</span><span className="text-gray-400">{d.cycle}</span></div>
            </div>
            <div className="flex items-center gap-3 mb-2"><span className="text-xs text-gray-400">Competitors:</span>{d.competitors.map(c => <span key={c} className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">{c}</span>)}</div>
            <div className="flex flex-wrap gap-1">{d.factors.map(f => <span key={f.f} className={`text-xs px-2 py-0.5 rounded ${f.impact === '+' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'}`}>{f.impact === '+' ? '✓' : '✗'} {f.f}</span>)}</div>
            {selected === d.id && (<div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs mb-3">
                <div><span className="text-gray-500">Decision Maker</span><p className="font-medium text-gray-900 dark:text-white mt-0.5">{d.decisionMaker}</p></div>
                <div><span className="text-gray-500">Cycle Length</span><p className="font-medium text-gray-900 dark:text-white mt-0.5">{d.cycle}</p></div>
                {d.lostReason && <div><span className="text-gray-500">Lost Reason</span><p className="font-medium text-red-600 mt-0.5">{d.lostReason}</p></div>}
              </div>
              <div className="flex gap-2"><button className="px-3 py-1.5 bg-rose-600 text-white rounded text-xs hover:bg-rose-700">View Full Analysis</button><button className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs text-gray-700 dark:text-gray-300">Export</button></div>
            </div>)}
          </div>
        ))}</div>
      </div>)}
      {activeTab === 'insights' && (<div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-4">
        <h3 className="font-semibold text-gray-900 dark:text-white">Win/Loss Insights</h3>
        <div className="space-y-3">
          <div><h4 className="text-sm font-medium text-emerald-600 mb-2">Top Win Factors</h4>{['CEO/CFO relationship (3 wins)', 'POC success (2 wins)', 'Competitive pricing (2 wins)', 'Industry expertise (1 win)', 'Referral network (1 win)'].map(f => <div key={f} className="flex items-center gap-2 py-1"><CheckCircle className="w-4 h-4 text-emerald-500" /><span className="text-sm text-gray-700 dark:text-gray-300">{f}</span></div>)}</div>
          <div><h4 className="text-sm font-medium text-red-600 mb-2">Top Loss Factors</h4>{['Pricing not competitive (2 losses)', 'Slow response time (1 loss)', 'Missing certifications (1 loss)', 'No executive sponsor (1 loss)', 'Feature gaps (1 loss)'].map(f => <div key={f} className="flex items-center gap-2 py-1"><XCircle className="w-4 h-4 text-red-500" /><span className="text-sm text-gray-700 dark:text-gray-300">{f}</span></div>)}</div>
        </div>
      </div>)}
      {activeTab === 'competitors' && (<div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-4">
        <h3 className="font-semibold text-gray-900 dark:text-white">Competitor Analysis</h3>
        {['GTBank', 'Zenith', 'First Bank', 'Access Bank', 'Stanbic', 'UBA'].map(comp => {
          const encounters = deals.filter(d => d.competitors.includes(comp))
          const winsAgainst = encounters.filter(d => d.outcome === 'won').length
          return (<div key={comp} className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <span className="w-28 text-sm font-medium text-gray-900 dark:text-white">{comp}</span>
            <div className="flex-1 h-4 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden"><div className={`h-full rounded-full ${winsAgainst > 0 ? 'bg-emerald-500' : 'bg-red-500'}`} style={{ width: `${encounters.length > 0 ? (winsAgainst / encounters.length) * 100 : 0}%` }} /></div>
            <span className="text-xs text-gray-500">{winsAgainst}/{encounters.length} wins</span>
          </div>)
        })}
      </div>)}
    </div>
  )
}
