import { useState } from 'react'
import { Zap, CheckCircle, Clock, AlertTriangle, ArrowUp, ArrowDown, User, Brain, Filter } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { FallbackBadge } from '@/components/ui/DataStates'
import { useTranslation } from '@/lib/i18n/useTranslation'

const tasks = [
  { id: 'TSK-001', title: 'Follow up: Dangote Trade Finance', priority: 'high', assignee: 'Sarah Okonkwo', due: 'Today', source: 'AI — Deal stage changed', status: 'overdue' },
  { id: 'TSK-002', title: 'Prepare QBR: Port Harcourt Shipping', priority: 'high', assignee: 'Ahmed Musa', due: 'Tomorrow', source: 'AI — Renewal in 30 days', status: 'in_progress' },
  { id: 'TSK-003', title: 'Update contact: Shoprite procurement', priority: 'medium', assignee: 'Chidi Obi', due: 'This week', source: 'AI — LinkedIn change detected', status: 'pending' },
  { id: 'TSK-004', title: 'Review: Kano Textiles complaint', priority: 'critical', assignee: 'Manager', due: 'Overdue', source: 'AI — SLA breach alert', status: 'escalated' },
  { id: 'TSK-005', title: 'Send proposal: Zenith Pharma', priority: 'medium', assignee: 'Chidi Obi', due: 'Wednesday', source: 'AI — Discovery call completed', status: 'pending' },
  { id: 'TSK-006', title: 'Competitor analysis: GTBank FX product', priority: 'low', assignee: 'Fatima Ibrahim', due: 'Friday', source: 'AI — Competitor alert', status: 'pending' },
  { id: 'TSK-007', title: 'Renewal prep: MTN annual contract', priority: 'high', assignee: 'Sarah Okonkwo', due: 'Next week', source: 'AI — Contract expiring', status: 'pending' },
]

const priorityConfig = {
  critical: { color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: AlertTriangle },
  high: { color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', icon: ArrowUp },
  medium: { color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: Clock },
  low: { color: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400', icon: ArrowDown },
}
const statusConfig = {
  overdue: 'bg-red-100 text-red-700', in_progress: 'bg-blue-100 text-blue-700', pending: 'bg-gray-100 text-gray-600', escalated: 'bg-purple-100 text-purple-700', completed: 'bg-emerald-100 text-emerald-700',
}

export default function SmartTaskAutomation() {
  const { tenant } = useTenant()
  const { t } = useTranslation()
  const [filter, setFilter] = useState('all')

  const filtered = filter === 'all' ? tasks : tasks.filter(t => t.priority === filter)

  return (
    <div role="region" aria-label="SmartTaskAutomation" className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><Zap className="w-7 h-7 text-amber-600" /> Smart Task Automation</h1><p className="text-gray-500 dark:text-gray-400 mt-1">AI-driven task creation, prioritization, and routing</p></div>
        <FallbackBadge />
      </div>
      <div className="grid grid-cols-5 gap-3">
        {[{ l: 'Total Tasks', v: tasks.length }, { l: 'Critical', v: tasks.filter(t => t.priority === 'critical').length }, { l: 'Overdue', v: tasks.filter(t => t.status === 'overdue' || t.status === 'escalated').length }, { l: 'AI Created', v: tasks.length }, { l: 'Completion', v: '78%' }].map(s => (
          <div key={s.l} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3"><p className="text-xs text-gray-500">{s.l}</p><p className="text-xl font-bold text-gray-900 dark:text-white">{s.v}</p></div>
        ))}
      </div>
      <div className="flex gap-1">
        {['all', 'critical', 'high', 'medium', 'low'].map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize ${filter === f ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>{f}</button>
        ))}
      </div>
      <div className="space-y-2">
        {filtered.map(task => {
          const pCfg = priorityConfig[task.priority]
          return (
            <div key={task.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between hover:shadow-sm">
              <div className="flex items-start gap-3">
                <pCfg.icon className={`w-4 h-4 mt-0.5 ${task.priority === 'critical' ? 'text-red-500' : task.priority === 'high' ? 'text-orange-500' : 'text-gray-400'}`} />
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white text-sm">{task.title}</h4>
                  <div className="flex items-center gap-3 text-xs text-gray-400 mt-1"><span><User className="w-3 h-3 inline mr-0.5" />{task.assignee}</span><span>Due: {task.due}</span><span><Brain className="w-3 h-3 inline mr-0.5" />{task.source}</span></div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded ${pCfg.color}`}>{task.priority}</span>
                <span className={`text-xs px-2 py-0.5 rounded ${statusConfig[task.status]}`}>{task.status.replace('_', ' ')}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
