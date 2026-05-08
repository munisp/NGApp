import { useState } from 'react'
import { ClipboardList, CheckCircle, Clock, Circle } from 'lucide-react'
import { FallbackBadge } from '@/components/ui/DataStates'

const plans = [
  { id: 'MAP-001', deal: 'Dangote — Trade Finance', value: '₦2.5B', closeDate: 'Jun 15', completion: 72, milestones: [
    { name: 'Discovery Complete', owner: 'Both', due: 'Apr 10', status: 'completed' },
    { name: 'Technical Evaluation', owner: 'Dangote IT', due: 'Apr 25', status: 'completed' },
    { name: 'Proposal Delivered', owner: 'Acme Bank', due: 'May 5', status: 'completed' },
    { name: 'Legal Review', owner: 'Both Legal', due: 'May 20', status: 'in_progress' },
    { name: 'Final Pricing', owner: 'Acme Bank', due: 'May 30', status: 'pending' },
    { name: 'Board Approval', owner: 'Dangote Board', due: 'Jun 10', status: 'pending' },
    { name: 'Contract Signed', owner: 'Both', due: 'Jun 15', status: 'pending' },
  ]},
  { id: 'MAP-002', deal: 'MTN — Payroll', value: '₦890M', closeDate: 'Jul 30', completion: 43, milestones: [
    { name: 'Initial Demo', owner: 'Acme Bank', due: 'Apr 15', status: 'completed' },
    { name: 'POC Setup', owner: 'Both', due: 'May 1', status: 'completed' },
    { name: 'POC Evaluation', owner: 'MTN HR', due: 'May 30', status: 'in_progress' },
    { name: 'Commercial Terms', owner: 'Both', due: 'Jun 15', status: 'pending' },
    { name: 'Contract', owner: 'Both Legal', due: 'Jul 15', status: 'pending' },
    { name: 'Go-Live', owner: 'Both', due: 'Jul 30', status: 'pending' },
  ]},
]

export default function MutualActionPlan() {
  const [expanded, setExpanded] = useState(plans[0].id)

  return (
    <div role="region" aria-label="MutualActionPlan" className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><ClipboardList className="w-7 h-7 text-blue-600" /> Mutual Action Plans</h1><p className="text-gray-500 dark:text-gray-400 mt-1">Collaborative buyer-seller milestones tracking</p></div>
        <FallbackBadge />
      </div>
      <div className="grid grid-cols-4 gap-3">
        {[{ l: 'Active Plans', v: plans.length }, { l: 'Total Milestones', v: plans.reduce((s, p) => s + p.milestones.length, 0) }, { l: 'Completed', v: plans.reduce((s, p) => s + p.milestones.filter(m => m.status === 'completed').length, 0) }, { l: 'Avg Completion', v: Math.round(plans.reduce((s, p) => s + p.completion, 0) / plans.length) + '%' }].map(s => (
          <div key={s.l} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3"><p className="text-xs text-gray-500">{s.l}</p><p className="text-xl font-bold text-gray-900 dark:text-white">{s.v}</p></div>
        ))}
      </div>
      <div className="space-y-3">
        {plans.map(plan => (
          <div key={plan.id} onClick={() => setExpanded(expanded === plan.id ? null : plan.id)} className={`bg-white dark:bg-gray-800 rounded-xl border p-4 cursor-pointer ${expanded === plan.id ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-200 dark:border-gray-700'}`}>
            <div className="flex items-center justify-between mb-2">
              <div><h4 className="font-semibold text-gray-900 dark:text-white">{plan.deal}</h4><div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5"><span>{plan.value}</span><span>Close: {plan.closeDate}</span></div></div>
              <div className="text-right"><p className="text-xl font-bold text-blue-600">{plan.completion}%</p><div className="w-24 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mt-1"><div className="h-full bg-blue-500 rounded-full" style={{ width: `${plan.completion}%` }} /></div></div>
            </div>
            {expanded === plan.id && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
                {plan.milestones.map((m, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="flex flex-col items-center">
                      {m.status === 'completed' ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : m.status === 'in_progress' ? <Clock className="w-4 h-4 text-blue-500" /> : <Circle className="w-4 h-4 text-gray-300" />}
                      {i < plan.milestones.length - 1 && <div className="w-0.5 h-5 bg-gray-200 dark:bg-gray-700" />}
                    </div>
                    <div className="flex-1 flex items-center justify-between pb-1">
                      <div><span className={`text-sm ${m.status === 'completed' ? 'text-gray-500 line-through' : 'text-gray-900 dark:text-white font-medium'}`}>{m.name}</span><span className="text-xs text-gray-400 ml-2">{m.owner}</span></div>
                      <span className="text-xs text-gray-400">{m.due}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
