import { useState } from 'react'
import { ListChecks, Search, Plus, CheckCircle, Clock, AlertTriangle, Users } from 'lucide-react'
import { FallbackBadge } from '@/components/ui/DataStates'
import { useApiData } from '@/hooks/useApiData'
import { apiClient } from '@/lib/apiClient'

const plans = [
  { id: 'MAP-001', deal: 'Dangote — Trade Finance Expansion', value: '₦2.5B', owner: 'Sarah Okonkwo', totalTasks: 12, completed: 10, overdue: 0, progress: 83, targetClose: 'May 30, 2026', status: 'on-track',
    tasks: [
      { task: 'NDA signed', owner: 'Legal', due: 'Apr 5', status: 'completed' },
      { task: 'Technical demo delivered', owner: 'Sarah', due: 'Apr 12', status: 'completed' },
      { task: 'Pilot environment provisioned', owner: 'DevOps', due: 'Apr 20', status: 'completed' },
      { task: 'Security review completed', owner: 'CISO', due: 'Apr 28', status: 'completed' },
      { task: 'Final pricing approved', owner: 'CFO', due: 'May 5', status: 'in-progress' },
      { task: 'Contract review', owner: 'Legal', due: 'May 15', status: 'pending' },
    ] },
  { id: 'MAP-002', deal: 'MTN — Enterprise Payroll', value: '₦890M', owner: 'Chidi Obi', totalTasks: 8, completed: 4, overdue: 1, progress: 50, targetClose: 'Jun 15, 2026', status: 'at-risk',
    tasks: [
      { task: 'Requirements gathering', owner: 'Chidi', due: 'Mar 20', status: 'completed' },
      { task: 'Architecture review', owner: 'CTO', due: 'Apr 1', status: 'completed' },
      { task: 'Integration testing', owner: 'QA', due: 'Apr 15', status: 'overdue' },
      { task: 'Payroll data migration plan', owner: 'Data Team', due: 'May 10', status: 'in-progress' },
    ] },
  { id: 'MAP-003', deal: 'Lafarge — Treasury Module', value: '₦450M', owner: 'Fatima Ibrahim', totalTasks: 10, completed: 7, overdue: 0, progress: 70, targetClose: 'May 25, 2026', status: 'on-track',
    tasks: [
      { task: 'Treasury needs assessment', owner: 'Fatima', due: 'Mar 10', status: 'completed' },
      { task: 'Cash management demo', owner: 'Product', due: 'Mar 25', status: 'completed' },
      { task: 'ROI analysis delivered', owner: 'Fatima', due: 'Apr 8', status: 'completed' },
      { task: 'Procurement approval', owner: 'CFO', due: 'May 8', status: 'in-progress' },
    ] },
]

const taskStatusIcons = { completed: CheckCircle, 'in-progress': Clock, pending: Clock, overdue: AlertTriangle }
const taskStatusColors = { completed: 'text-emerald-500', 'in-progress': 'text-blue-500', pending: 'text-gray-400', overdue: 'text-red-500' }

export default function MutualActionPlan() {
  const { data: _apiData, isLoading: _apiLoading, isUsingFallback } = useApiData('mutualactionplan', () => apiClient.dashboard.metrics(), { fallback: plans })
  const [search, setSearch] = useState('')
  const [selectedPlan, setSelectedPlan] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')

  const filtered = plans.filter(p => {
    const matchesSearch = !search || p.deal.toLowerCase().includes(search.toLowerCase()) || p.owner.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter
    return matchesSearch && matchesStatus
  })

  return (
    <div role="region" aria-label="MutualActionPlan" className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><ListChecks className="w-7 h-7 text-teal-600" /> Mutual Action Plans</h1><p className="text-gray-500 dark:text-gray-400 mt-1">Collaborative closing plans with buyer stakeholders</p></div>
        <div className="flex gap-2"><button className="px-3 py-2 bg-teal-600 text-white rounded-lg text-sm flex items-center gap-1 hover:bg-teal-700"><Plus className="w-4 h-4" /> New Plan</button><FallbackBadge /></div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[{ l: 'Active Plans', v: plans.length }, { l: 'On Track', v: plans.filter(p => p.status === 'on-track').length, c: 'text-emerald-600' }, { l: 'At Risk', v: plans.filter(p => p.status === 'at-risk').length, c: 'text-red-600' }, { l: 'Overdue Tasks', v: plans.reduce((s, p) => s + p.overdue, 0), c: plans.reduce((s, p) => s + p.overdue, 0) > 0 ? 'text-red-600' : 'text-emerald-600' }].map(s => (
          <div key={s.l} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3"><p className="text-xs text-gray-500">{s.l}</p><p className={`text-xl font-bold ${s.c || 'text-gray-900 dark:text-white'}`}>{s.v}</p></div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search plans..." className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white" /></div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"><option value="all">All Status</option><option value="on-track">On Track</option><option value="at-risk">At Risk</option></select>
      </div>

      <div className="space-y-3">
        {filtered.map(p => (
          <div key={p.id} onClick={() => setSelectedPlan(selectedPlan === p.id ? null : p.id)} className={`bg-white dark:bg-gray-800 rounded-xl border p-4 cursor-pointer hover:shadow-md ${selectedPlan === p.id ? 'border-teal-500 ring-1 ring-teal-500' : 'border-gray-200 dark:border-gray-700'}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2"><h4 className="font-semibold text-gray-900 dark:text-white">{p.deal}</h4><span className={`text-xs px-2 py-0.5 rounded ${p.status === 'on-track' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{p.status}</span></div>
                <div className="flex items-center gap-3 text-xs text-gray-500 mt-1"><span>{p.value}</span><span><Users className="w-3 h-3 inline mr-0.5" />{p.owner}</span><span>Close: {p.targetClose}</span></div>
              </div>
              <div className="text-right"><div className="text-lg font-bold text-gray-900 dark:text-white">{p.progress}%</div><div className="w-20 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full"><div className={`h-full rounded-full ${p.progress >= 70 ? 'bg-emerald-500' : p.progress >= 40 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${p.progress}%` }} /></div></div>
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-500"><span>{p.completed}/{p.totalTasks} tasks done</span>{p.overdue > 0 && <span className="text-red-600">{p.overdue} overdue</span>}</div>
            {selectedPlan === p.id && (
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 space-y-2">
                {p.tasks.map((t, i) => {
                  const Icon = taskStatusIcons[t.status] || Clock
                  return (
                    <div key={i} className="flex items-center gap-3 py-1">
                      <Icon className={`w-4 h-4 ${taskStatusColors[t.status]}`} />
                      <span className={`flex-1 text-sm ${t.status === 'completed' ? 'line-through text-gray-400' : 'text-gray-900 dark:text-white'}`}>{t.task}</span>
                      <span className="text-xs text-gray-500">{t.owner}</span>
                      <span className={`text-xs ${t.status === 'overdue' ? 'text-red-600 font-medium' : 'text-gray-400'}`}>{t.due}</span>
                    </div>
                  )
                })}
                <div className="flex gap-2 mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                  <button className="px-3 py-1.5 bg-teal-600 text-white rounded text-xs hover:bg-teal-700 flex items-center gap-1"><Plus className="w-3 h-3" /> Add Task</button>
                  <button className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs text-gray-700 dark:text-gray-300">Share with Buyer</button>
                  <button className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs text-gray-700 dark:text-gray-300">Export PDF</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
