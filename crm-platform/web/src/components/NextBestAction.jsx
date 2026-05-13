import { useState } from 'react'
import { Zap, Target, TrendingUp, Clock, CheckCircle, X, Search, Filter } from 'lucide-react'
import { FallbackBadge } from '@/components/ui/DataStates'
import { useApiData } from '@/hooks/useApiData'
import { apiClient } from '@/lib/apiClient'

const actions = [
  { id: 'NBA-001', customer: 'Dangote Industries', action: 'Schedule QBR — contract renewal in 90 days', type: 'Retention', confidence: 94, impact: '₦2.4B at risk', priority: 'critical', source: 'Health Score + Contract Data', assignee: 'Sarah Okonkwo', deadline: 'May 10', status: 'pending' },
  { id: 'NBA-002', customer: 'MTN Nigeria', action: 'Send enterprise payroll case study', type: 'Expansion', confidence: 87, impact: '₦180M upsell', priority: 'high', source: 'Usage Patterns + Intent Signals', assignee: 'Chidi Obi', deadline: 'May 8', status: 'pending' },
  { id: 'NBA-003', customer: 'Kano Textiles', action: 'Escalate billing dispute — 3 weeks unresolved', type: 'Save', confidence: 92, impact: '₦45M churn risk', priority: 'critical', source: 'Support Tickets + Sentiment', assignee: 'Support Lead', deadline: 'Today', status: 'in-progress' },
  { id: 'NBA-004', customer: 'Total Energies', action: 'Offer competitive FX rate locked for 6 months', type: 'Retention', confidence: 78, impact: '₦1.2B at risk', priority: 'high', source: 'Competitor Intelligence', assignee: 'Ahmed Musa', deadline: 'May 7', status: 'pending' },
  { id: 'NBA-005', customer: 'Shoprite Nigeria', action: 'Propose branch rollout Phase 2 — 50 stores', type: 'Expansion', confidence: 82, impact: '₦90M expansion', priority: 'medium', source: 'Pilot Results + ROI', assignee: 'Chidi Obi', deadline: 'May 15', status: 'pending' },
  { id: 'NBA-006', customer: 'Lafarge Cement', action: 'Demo treasury module — expressed interest', type: 'Upsell', confidence: 88, impact: '₦120M pipeline', priority: 'medium', source: 'Meeting Notes + Web Activity', assignee: 'Fatima Ibrahim', deadline: 'May 12', status: 'completed' },
]

const priorityColors = { critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', high: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', medium: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' }
const typeColors = { Retention: 'bg-red-50 text-red-600', Expansion: 'bg-emerald-50 text-emerald-600', Save: 'bg-purple-50 text-purple-600', Upsell: 'bg-cyan-50 text-cyan-600' }

export default function NextBestAction() {
  const { data: _apiData, isLoading: _apiLoading, isUsingFallback } = useApiData('nextbestaction', () => apiClient.dashboard.metrics(), { fallback: actions })
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [expandedAction, setExpandedAction] = useState(null)

  const filtered = actions.filter(a => {
    const matchesSearch = !search || a.customer.toLowerCase().includes(search.toLowerCase()) || a.action.toLowerCase().includes(search.toLowerCase())
    const matchesType = typeFilter === 'all' || a.type === typeFilter
    const matchesStatus = statusFilter === 'all' || a.status === statusFilter
    return matchesSearch && matchesType && matchesStatus
  })

  return (
    <div role="region" aria-label="NextBestAction" className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><Zap className="w-7 h-7 text-amber-600" /> Next Best Action</h1><p className="text-gray-500 dark:text-gray-400 mt-1">AI-recommended actions ranked by impact and confidence</p></div>
        <FallbackBadge />
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[{ l: 'Active Recommendations', v: actions.filter(a => a.status !== 'completed').length }, { l: 'Critical Priority', v: actions.filter(a => a.priority === 'critical').length, c: 'text-red-600' }, { l: 'Avg Confidence', v: Math.round(actions.reduce((s, a) => s + a.confidence, 0) / actions.length) + '%', c: 'text-emerald-600' }, { l: 'Completed Today', v: actions.filter(a => a.status === 'completed').length }].map(s => (
          <div key={s.l} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3"><p className="text-xs text-gray-500">{s.l}</p><p className={`text-xl font-bold ${s.c || 'text-gray-900 dark:text-white'}`}>{s.v}</p></div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customers or actions..." className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white" /></div>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"><option value="all">All Types</option><option value="Retention">Retention</option><option value="Expansion">Expansion</option><option value="Save">Save</option><option value="Upsell">Upsell</option></select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"><option value="all">All Status</option><option value="pending">Pending</option><option value="in-progress">In Progress</option><option value="completed">Completed</option></select>
      </div>

      <div className="space-y-2">
        {filtered.map(a => (
          <div key={a.id} onClick={() => setExpandedAction(expandedAction === a.id ? null : a.id)} className={`bg-white dark:bg-gray-800 rounded-xl border p-4 cursor-pointer hover:shadow-md ${expandedAction === a.id ? 'border-amber-500 ring-1 ring-amber-500' : 'border-gray-200 dark:border-gray-700'} ${a.status === 'completed' ? 'opacity-60' : ''}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${a.priority === 'critical' ? 'bg-red-100 dark:bg-red-900/30' : a.priority === 'high' ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-blue-100 dark:bg-blue-900/30'}`}>
                  <Target className={`w-5 h-5 ${a.priority === 'critical' ? 'text-red-600' : a.priority === 'high' ? 'text-amber-600' : 'text-blue-600'}`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2"><h4 className="font-semibold text-gray-900 dark:text-white">{a.customer}</h4><span className={`text-xs px-2 py-0.5 rounded ${priorityColors[a.priority]}`}>{a.priority}</span><span className={`text-xs px-2 py-0.5 rounded ${typeColors[a.type] || 'bg-gray-100 text-gray-600'}`}>{a.type}</span>{a.status === 'completed' && <CheckCircle className="w-4 h-4 text-emerald-500" />}</div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{a.action}</p>
                </div>
              </div>
              <div className="text-right"><div className="text-lg font-bold text-gray-900 dark:text-white">{a.confidence}%</div><div className="text-xs text-gray-400">confidence</div></div>
            </div>
            {expandedAction === a.id && (
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <div className="grid grid-cols-4 gap-4 text-xs mb-3">
                  <div><span className="text-gray-500">Impact</span><p className="font-medium text-gray-900 dark:text-white mt-0.5">{a.impact}</p></div>
                  <div><span className="text-gray-500">Source</span><p className="font-medium text-gray-900 dark:text-white mt-0.5">{a.source}</p></div>
                  <div><span className="text-gray-500">Assignee</span><p className="font-medium text-gray-900 dark:text-white mt-0.5">{a.assignee}</p></div>
                  <div><span className="text-gray-500">Deadline</span><p className="font-medium text-gray-900 dark:text-white mt-0.5">{a.deadline}</p></div>
                </div>
                <div className="flex gap-2">
                  {a.status !== 'completed' && <button className="px-3 py-1.5 bg-amber-600 text-white rounded text-xs hover:bg-amber-700">Execute Action</button>}
                  <button className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs text-gray-700 dark:text-gray-300">View Customer</button>
                  {a.status !== 'completed' && <button className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs text-gray-700 dark:text-gray-300">Snooze</button>}
                  {a.status !== 'completed' && <button className="px-3 py-1.5 text-red-600 text-xs">Dismiss</button>}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
