import { useState } from 'react'
import { TrendingUp, ArrowRight, Search, Filter, ChevronDown, ChevronUp, DollarSign, Users, Clock, Target } from 'lucide-react'
import { FallbackBadge , ErrorState } from '@/components/ui/DataStates'
import { useApiData } from '@/hooks/useApiData'
import { apiClient } from '@/lib/apiClient'

const stages = [
  { name: 'Qualification', deals: 28, value: '₦1.8B', avgDays: 12, convRate: 68, color: 'bg-blue-500' },
  { name: 'Discovery', deals: 22, value: '₦2.1B', avgDays: 18, convRate: 72, color: 'bg-cyan-500' },
  { name: 'Proposal', deals: 15, value: '₦1.6B', avgDays: 14, convRate: 65, color: 'bg-purple-500' },
  { name: 'Negotiation', deals: 8, value: '₦2.4B', avgDays: 22, convRate: 78, color: 'bg-amber-500' },
  { name: 'Closing', deals: 4, value: '₦1.2B', avgDays: 8, convRate: 89, color: 'bg-emerald-500' },
]

const topDeals = [
  { id: 'DEAL-001', name: 'Dangote — Trade Finance', value: '₦2.5B', stage: 'Closing', probability: 89, owner: 'Sarah Okonkwo', daysInStage: 3, vertical: 'Banking', nextAction: 'Final contract review', lastActivity: '2 hours ago' },
  { id: 'DEAL-002', name: 'MTN — Enterprise Payroll', value: '₦890M', stage: 'Proposal', probability: 72, owner: 'Chidi Obi', daysInStage: 8, vertical: 'Telco', nextAction: 'Technical demo', lastActivity: '1 day ago' },
  { id: 'DEAL-003', name: 'Total Energies — FX Hedging', value: '₦1.2B', stage: 'Discovery', probability: 25, owner: 'Ahmed Musa', daysInStage: 28, vertical: 'Commodity', nextAction: 'Stakeholder mapping', lastActivity: '5 days ago' },
  { id: 'DEAL-004', name: 'Lafarge — Treasury Mgmt', value: '₦450M', stage: 'Negotiation', probability: 68, owner: 'Fatima Ibrahim', daysInStage: 5, vertical: 'Banking', nextAction: 'Pricing approval', lastActivity: '12 hours ago' },
  { id: 'DEAL-005', name: 'Zenith Pharma — Trade Finance', value: '₦320M', stage: 'Qualification', probability: 35, owner: 'Sarah Okonkwo', daysInStage: 2, vertical: 'Banking', nextAction: 'Initial discovery call', lastActivity: '1 day ago' },
  { id: 'DEAL-006', name: 'Shoprite — POS Integration', value: '₦180M', stage: 'Proposal', probability: 55, owner: 'Chidi Obi', daysInStage: 12, vertical: 'Banking', nextAction: 'Pilot store selection', lastActivity: '3 days ago' },
]

const forecastScenarios = [
  { name: 'Conservative', value: '₦2.8B', probability: '75%+', deals: 6, color: 'bg-emerald-500' },
  { name: 'Most Likely', value: '₦4.1B', probability: '50%+', deals: 12, color: 'bg-blue-500' },
  { name: 'Optimistic', value: '₦6.2B', probability: '25%+', deals: 22, color: 'bg-purple-500' },
]

export default function RevOpsPipeline() {
  const { data: _apiData, isLoading: _apiLoading, isUsingFallback } = useApiData('revopspipeline', () => apiClient.dashboard.metrics(), { fallback: stages })
  const [activeTab, setActiveTab] = useState('pipeline')
  const [search, setSearch] = useState('')
  const [expandedDeal, setExpandedDeal] = useState(null)
  const [stageFilter, setStageFilter] = useState('all')
  const [sortBy, setSortBy] = useState('value')
  const [error, setError] = useState(null)

  const filteredDeals = topDeals.filter(d => {
    const matchesSearch = !search || d.name.toLowerCase().includes(search.toLowerCase()) || d.owner.toLowerCase().includes(search.toLowerCase())
    const matchesStage = stageFilter === 'all' || d.stage === stageFilter
    return matchesSearch && matchesStage
  }).sort((a, b) => {
    if (sortBy === 'value') return parseFloat(b.value.replace(/[₦BM,]/g, '')) - parseFloat(a.value.replace(/[₦BM,]/g, ''))
    if (sortBy === 'probability') return b.probability - a.probability
    return a.daysInStage - b.daysInStage
  })

  if (error) return <ErrorState message={error} />

  return (
    <div role="region" aria-label="RevOpsPipeline" className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><TrendingUp className="w-7 h-7 text-emerald-600" /> Revenue Operations Pipeline</h1><p className="text-gray-500 dark:text-gray-400 mt-1">Cross-vertical revenue pipeline with Monte Carlo forecasting</p></div>
        <FallbackBadge />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[{ l: 'Pipeline Value', v: '₦9.1B', icon: DollarSign }, { l: 'Active Deals', v: stages.reduce((s, st) => s + st.deals, 0), icon: Target }, { l: 'Weighted Forecast', v: '₦3.2B', icon: TrendingUp }, { l: 'Avg Cycle', v: '45 days', icon: Clock }, { l: 'Win Rate', v: '32%', icon: Users }].map(s => (
          <div key={s.l} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
            <div className="flex items-center gap-2"><s.icon className="w-4 h-4 text-gray-400" /><p className="text-xs text-gray-500">{s.l}</p></div>
            <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{s.v}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
        {['pipeline', 'deals', 'forecast'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}>
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === 'pipeline' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Pipeline Funnel</h3>
          <div className="space-y-3">
            {stages.map((stage, i) => (
              <div key={stage.name} className="flex items-center gap-3">
                <div className="w-28 text-sm text-gray-600 dark:text-gray-400">{stage.name}</div>
                <div className="flex-1 relative h-10 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
                  <div className={`absolute inset-y-0 left-0 ${stage.color} rounded-lg flex items-center pl-3 text-white text-sm font-medium`} style={{ width: `${(stage.deals / 28) * 100}%` }}>
                    {stage.deals} deals
                  </div>
                </div>
                <div className="w-20 text-right text-sm font-medium text-gray-900 dark:text-white">{stage.value}</div>
                <div className="w-16 text-right text-xs text-emerald-600">{stage.convRate}%</div>
                {i < stages.length - 1 && <ArrowRight className="w-3 h-3 text-gray-300 flex-shrink-0" />}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'deals' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search deals or owners..." className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white" /></div>
            <select value={stageFilter} onChange={e => setStageFilter(e.target.value)} className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
              <option value="all">All Stages</option>
              {stages.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
            </select>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
              <option value="value">Sort: Value</option>
              <option value="probability">Sort: Probability</option>
              <option value="days">Sort: Days in Stage</option>
            </select>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
            <div className="overflow-x-auto"><table className="min-w-full w-full"><thead className="bg-gray-50 dark:bg-gray-700"><tr>{['Deal', 'Value', 'Stage', 'Probability', 'Owner', 'Days', 'Vertical'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredDeals.length === 0 ? <tr><td colSpan="7" className="text-center py-8 text-gray-500 dark:text-gray-400">No results found</td></tr> : null}
              {filteredDeals.map(d => (
                <>
                  <tr key={d.id} onClick={() => setExpandedDeal(expandedDeal === d.id ? null : d.id)} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer">
                    <td className="px-4 py-3"><div className="text-sm font-medium text-gray-900 dark:text-white">{d.name}</div><div className="text-xs text-gray-400">{d.id}</div></td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white">{d.value}</td>
                    <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">{d.stage}</span></td>
                    <td className="px-4 py-3"><div className="flex items-center gap-2"><div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full"><div className={`h-full rounded-full ${d.probability >= 70 ? 'bg-emerald-500' : d.probability >= 40 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${d.probability}%` }} /></div><span className={`text-xs font-medium ${d.probability >= 70 ? 'text-emerald-600' : d.probability >= 40 ? 'text-amber-600' : 'text-red-600'}`}>{d.probability}%</span></div></td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{d.owner}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{d.daysInStage}d</td>
                    <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">{d.vertical}</span></td>
                  </tr>
                  {expandedDeal === d.id && (
                    <tr key={`${d.id}-details`}><td colSpan={7} className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                        <div><span className="text-gray-500">Next Action:</span><p className="font-medium text-gray-900 dark:text-white mt-0.5">{d.nextAction}</p></div>
                        <div><span className="text-gray-500">Last Activity:</span><p className="font-medium text-gray-900 dark:text-white mt-0.5">{d.lastActivity}</p></div>
                        <div className="flex gap-2 items-start">
                          <button className="px-3 py-1.5 bg-emerald-600 text-white rounded text-xs hover:bg-emerald-700">Advance Stage</button>
                          <button className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs text-gray-700 dark:text-gray-300">Add Note</button>
                          <button className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs text-gray-700 dark:text-gray-300">Schedule Call</button>
                        </div>
                      </div>
                    </td></tr>
                  )}
                </>
              ))}
            </tbody></table></div>
          </div>
        </div>
      )}

      {activeTab === 'forecast' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Monte Carlo Forecast — Q2 2026</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {forecastScenarios.map(scenario => (
                <div key={scenario.name} className="p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2 mb-3"><div className={`w-3 h-3 rounded-full ${scenario.color}`} /><span className="text-sm font-medium text-gray-900 dark:text-white">{scenario.name}</span></div>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">{scenario.value}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-500"><span>{scenario.deals} deals</span><span>Win prob ≥ {scenario.probability}</span></div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Revenue by Vertical</h3>
            <div className="space-y-2">
              {[{ vertical: 'Banking', value: '₦4.8B', pct: 53 }, { vertical: 'Telco', value: '₦2.1B', pct: 23 }, { vertical: 'Commodity', value: '₦1.5B', pct: 16 }, { vertical: 'CPaaS', value: '₦0.7B', pct: 8 }].map(v => (
                <div key={v.vertical} className="flex items-center gap-3">
                  <span className="w-20 text-sm text-gray-600 dark:text-gray-400">{v.vertical}</span>
                  <div className="flex-1 h-6 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 rounded-full flex items-center pl-2 text-xs text-white font-medium" style={{ width: `${v.pct}%` }}>{v.pct > 10 ? v.value : ''}</div></div>
                  <span className="w-16 text-right text-sm font-medium text-gray-900 dark:text-white">{v.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
