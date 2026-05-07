import { useState } from 'react'
import { ClipboardList, CheckCircle, Clock, AlertTriangle, Users, Calendar, ArrowRight, Plus } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { LoadingState, ErrorState, EmptyState, FallbackBadge, ExportButton } from '@/components/ui/DataStates'
import { useTranslation } from '@/lib/i18n/useTranslation'
const plans = [
  { id: 'MAP-001', deal: 'Dangote Group — Trade Finance', status: 'on_track', progress: 85, tasks: [
    { task: 'Submit financial statements (3 years)', owner: 'Client', status: 'completed', due: 'Mar 15', completed: 'Mar 14' },
    { task: 'Complete credit assessment', owner: 'Bank', status: 'completed', due: 'Mar 22', completed: 'Mar 20' },
    { task: 'Legal review of facility agreement', owner: 'Both', status: 'completed', due: 'Mar 28', completed: 'Mar 30' },
    { task: 'Board approval (internal)', owner: 'Bank', status: 'completed', due: 'Apr 2', completed: 'Apr 1' },
    { task: 'Client sign term sheet', owner: 'Client', status: 'in_progress', due: 'Apr 8', completed: null },
    { task: 'Final documentation & disbursement', owner: 'Bank', status: 'pending', due: 'Apr 12', completed: null },
  ]},
  { id: 'MAP-002', deal: 'MTN — Payroll Processing', status: 'at_risk', progress: 45, tasks: [
    { task: 'Technical requirements document', owner: 'Client', status: 'completed', due: 'Mar 10', completed: 'Mar 12' },
    { task: 'API integration sandbox access', owner: 'Bank', status: 'completed', due: 'Mar 15', completed: 'Mar 15' },
    { task: 'Security audit of integration', owner: 'Both', status: 'in_progress', due: 'Mar 25', completed: null },
    { task: 'Pilot with 500 employees', owner: 'Both', status: 'pending', due: 'Apr 5', completed: null },
    { task: 'Full rollout decision', owner: 'Client', status: 'pending', due: 'Apr 15', completed: null },
  ]},
]
const statusColors = { completed: 'bg-emerald-100 text-emerald-700', in_progress: 'bg-blue-100 text-blue-700', pending: 'bg-gray-100 text-gray-600', overdue: 'bg-red-100 text-red-700' }
export default function MutualActionPlan() {
  const { t } = useTranslation()
  const [selected, setSelected] = useState('MAP-001')
  const plan = plans.find(p => p.id === selected)
  return (
    <div role="region" aria-label="MutualActionPlan"  className="space-y-6">
      <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><ClipboardList className="w-7 h-7 text-sky-600" /> Mutual Action Plans</h1><p className="text-gray-500 dark:text-gray-400 mt-1">Collaborative deal plans shared between bank and customer</p></div>
      <div className="grid grid-cols-4 gap-3">{[{ l: 'Active Plans', v: '18' }, { l: 'On Track', v: '12' }, { l: 'At Risk', v: '4' }, { l: 'Avg Completion', v: '72%' }].map(s => (<div key={s.l} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3"><p className="text-xs text-gray-500">{s.l}</p><p className="text-xl font-bold text-gray-900 dark:text-white">{s.v}</p></div>))}</div>
      <div className="flex gap-2">{plans.map(p => (<button key={p.id} onClick={() => setSelected(p.id)} className={`px-3 py-2 text-sm rounded-lg border text-left ${selected === p.id ? 'border-sky-500 bg-sky-50 dark:bg-sky-900/20' : 'border-gray-200 dark:border-gray-700'}`}><div className="font-medium text-gray-900 dark:text-white">{p.deal}</div><div className="text-xs text-gray-500">{p.progress}% complete · {p.status.replace('_', ' ')}</div></button>))}</div>
      {plan && (<div tabIndex="0" className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4"><h3 className="font-semibold text-gray-900 dark:text-white">{plan.deal}</h3><div className="flex items-center gap-2"><div className="w-32 h-3 bg-gray-200 dark:bg-gray-600 rounded-full"><div className="h-full bg-sky-500 rounded-full" style={{width: `${plan.progress}%`}} /></div><span className="text-sm font-bold text-sky-600">{plan.progress}%</span></div></div>
        <div className="space-y-3">{plan.tasks.map((t, i) => (<div key={i} className="flex items-center gap-4 p-3 rounded-lg bg-gray-50 dark:bg-gray-700"><div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${t.status === 'completed' ? 'bg-emerald-500 text-white' : t.status === 'in_progress' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-400'}`}>{t.status === 'completed' ? <CheckCircle className="w-4 h-4" /> : t.status === 'in_progress' ? <Clock className="w-4 h-4" /> : <span className="text-xs">{i+1}</span>}</div><div className="flex-1"><p className={`text-sm ${t.status === 'completed' ? 'text-gray-500 line-through' : 'text-gray-900 dark:text-white'}`}>{t.task}</p><div className="flex gap-3 text-xs text-gray-500 mt-0.5"><span>Owner: {t.owner}</span><span>Due: {t.due}</span>{t.completed && <span>Done: {t.completed}</span>}</div></div><span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[t.status]}`}>{t.status.replace('_', ' ')}</span></div>))}</div>
      </div>)}
    </div>
  )
}