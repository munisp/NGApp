import { useState } from 'react'
import { Zap, Search, Plus, CheckCircle, Clock, AlertTriangle, Filter, Play, Pause, Settings } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { FallbackBadge } from '@/components/ui/DataStates'
import { useApiData } from '@/hooks/useApiData'
import { apiClient } from '@/lib/apiClient'

const automations = [
  { id: 'AUT-001', name: 'Lead Assignment — Round Robin', trigger: 'New lead created', actions: 3, runs: 4280, success: 98.2, status: 'active', lastRun: '2 min ago', avgTime: '1.2s', created: 'Jan 15, 2026', owner: 'Sales Ops', category: 'Lead Management' },
  { id: 'AUT-002', name: 'Deal Stage Follow-up', trigger: 'Deal moves to Proposal', actions: 5, runs: 890, success: 96.8, status: 'active', lastRun: '1 hour ago', avgTime: '2.8s', created: 'Feb 3, 2026', owner: 'Sales Ops', category: 'Deal Management' },
  { id: 'AUT-003', name: 'At-Risk Account Alert', trigger: 'Health score drops below 40', actions: 4, runs: 128, success: 100, status: 'active', lastRun: '3 hours ago', avgTime: '1.5s', created: 'Mar 10, 2026', owner: 'CS Team', category: 'Customer Success' },
  { id: 'AUT-004', name: 'Invoice Reminder Sequence', trigger: 'Invoice overdue > 7 days', actions: 3, runs: 2400, success: 94.5, status: 'active', lastRun: '30 min ago', avgTime: '3.1s', created: 'Jan 8, 2026', owner: 'Finance', category: 'Billing' },
  { id: 'AUT-005', name: 'Onboarding Checklist', trigger: 'New customer activated', actions: 8, runs: 340, success: 99.1, status: 'paused', lastRun: '2 days ago', avgTime: '4.2s', created: 'Feb 20, 2026', owner: 'Onboarding', category: 'Customer Success' },
  { id: 'AUT-006', name: 'Meeting Notes Summary', trigger: 'Meeting ends', actions: 2, runs: 1680, success: 92.4, status: 'active', lastRun: '15 min ago', avgTime: '8.5s', created: 'Apr 1, 2026', owner: 'Sales Ops', category: 'AI Agent' },
]

export default function SmartTaskAutomation() {
  const { data: _apiData, isLoading: _apiLoading, isUsingFallback } = useApiData('smarttaskautomation', () => apiClient.dashboard.metrics(), { fallback: automations })
  const { tenant } = useTenant()
  const [activeTab, setActiveTab] = useState('automations')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selected, setSelected] = useState(null)

  const filtered = automations.filter(a => {
    const matchesSearch = !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.trigger.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === 'all' || a.status === statusFilter
    return matchesSearch && matchesStatus
  })

  return (
    <div role="region" aria-label="SmartTaskAutomation" className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><Zap className="w-7 h-7 text-amber-600" /> Smart Task Automation</h1><p className="text-gray-500 dark:text-gray-400 mt-1">AI-powered workflow automation for {tenant?.name || 'Platform'}</p></div>
        <div className="flex gap-2"><button className="px-3 py-2 bg-amber-600 text-white rounded-lg text-sm flex items-center gap-1 hover:bg-amber-700"><Plus className="w-4 h-4" /> New Automation</button><FallbackBadge /></div>
      </div>
      <div className="grid grid-cols-4 gap-3">
        {[{ l: 'Active Automations', v: automations.filter(a => a.status === 'active').length }, { l: 'Total Runs', v: automations.reduce((s, a) => s + a.runs, 0).toLocaleString() }, { l: 'Avg Success Rate', v: (automations.reduce((s, a) => s + a.success, 0) / automations.length).toFixed(1) + '%', c: 'text-emerald-600' }, { l: 'Time Saved', v: '~420 hrs/mo' }].map(s => (
          <div key={s.l} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3"><p className="text-xs text-gray-500">{s.l}</p><p className={`text-xl font-bold ${s.c || 'text-gray-900 dark:text-white'}`}>{s.v}</p></div>
        ))}
      </div>
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
        {['automations', 'history', 'templates'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-400'}`}>{tab.charAt(0).toUpperCase() + tab.slice(1)}</button>
        ))}
      </div>
      {activeTab === 'automations' && (<div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search automations..." className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white" /></div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"><option value="all">All Status</option><option value="active">Active</option><option value="paused">Paused</option></select>
        </div>
        <div className="space-y-2">{filtered.map(a => (
          <div key={a.id} onClick={() => setSelected(selected === a.id ? null : a.id)} className={`bg-white dark:bg-gray-800 rounded-xl border p-4 cursor-pointer hover:shadow-md ${selected === a.id ? 'border-amber-500 ring-1 ring-amber-500' : 'border-gray-200 dark:border-gray-700'}`}>
            <div className="flex items-center justify-between">
              <div className="flex-1"><div className="flex items-center gap-2"><h4 className="font-semibold text-gray-900 dark:text-white">{a.name}</h4><span className={`text-xs px-2 py-0.5 rounded ${a.status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'}`}>{a.status}</span><span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500">{a.category}</span></div><p className="text-xs text-gray-500 mt-0.5">Trigger: {a.trigger} → {a.actions} actions</p></div>
              <div className="text-right"><p className="text-lg font-bold text-gray-900 dark:text-white">{a.runs.toLocaleString()}</p><p className="text-xs text-gray-400">runs ({a.success}% success)</p></div>
            </div>
            {selected === a.id && (<div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
              <div className="grid grid-cols-4 gap-4 text-xs mb-3">
                <div><span className="text-gray-500">Last Run</span><p className="font-medium text-gray-900 dark:text-white mt-0.5">{a.lastRun}</p></div>
                <div><span className="text-gray-500">Avg Duration</span><p className="font-medium text-gray-900 dark:text-white mt-0.5">{a.avgTime}</p></div>
                <div><span className="text-gray-500">Owner</span><p className="font-medium text-gray-900 dark:text-white mt-0.5">{a.owner}</p></div>
                <div><span className="text-gray-500">Created</span><p className="font-medium text-gray-900 dark:text-white mt-0.5">{a.created}</p></div>
              </div>
              <div className="flex gap-2">
                {a.status === 'active' ? <button className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded text-xs text-gray-700 dark:text-gray-300 flex items-center gap-1"><Pause className="w-3 h-3" /> Pause</button> : <button className="px-3 py-1.5 bg-emerald-600 text-white rounded text-xs flex items-center gap-1"><Play className="w-3 h-3" /> Resume</button>}
                <button className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs text-gray-700 dark:text-gray-300 flex items-center gap-1"><Settings className="w-3 h-3" /> Configure</button>
                <button className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs text-gray-700 dark:text-gray-300">View Logs</button>
              </div>
            </div>)}
          </div>
        ))}</div>
      </div>)}
      {activeTab === 'history' && (<div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
        <h3 className="font-semibold text-gray-900 dark:text-white">Recent Runs</h3>
        {automations.filter(a => a.status === 'active').slice(0, 4).map(a => (
          <div key={a.id} className="flex items-center gap-3 py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
            <CheckCircle className="w-4 h-4 text-emerald-500" /><span className="flex-1 text-sm text-gray-900 dark:text-white">{a.name}</span><span className="text-xs text-gray-400">{a.lastRun}</span><span className="text-xs text-gray-400">{a.avgTime}</span>
          </div>))}
      </div>)}
      {activeTab === 'templates' && (<div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 text-center">
        <Zap className="w-12 h-12 text-gray-300 mx-auto mb-3" /><h3 className="font-semibold text-gray-900 dark:text-white mb-1">Automation Templates</h3><p className="text-sm text-gray-500 mb-4">Pre-built automation workflows for common use cases.</p>
        <div className="grid grid-cols-3 gap-3 max-w-lg mx-auto">{['Lead Routing', 'Follow-up Sequence', 'Health Alerts', 'Invoice Reminders', 'Onboarding', 'Reporting'].map(t => <button key={t} className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">{t}</button>)}</div>
      </div>)}
    </div>
  )
}
