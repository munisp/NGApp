import { useState } from 'react'
import { Workflow, Plus, Play, Pause, Trash2, Copy, Settings, ArrowRight, CheckCircle, AlertTriangle, Clock, Zap, GitBranch, Mail, MessageSquare, Filter } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { LoadingState, ErrorState, EmptyState, FallbackBadge, ExportButton } from '@/components/ui/DataStates'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { useApiData } from '@/hooks/useApiData'
import { apiClient } from '@/lib/apiClient'

const templates = [
  { id: 'TPL-001', name: 'Lead Qualification', category: 'Sales', steps: 5, uses: 342, rating: 4.8, description: 'Automatically qualify, score, and route new leads' },
  { id: 'TPL-002', name: 'Customer Onboarding', category: 'Success', steps: 8, uses: 128, rating: 4.6, description: 'End-to-end onboarding with provisioning and welcome kit' },
  { id: 'TPL-003', name: 'Churn Risk Response', category: 'Retention', steps: 4, uses: 67, rating: 4.5, description: 'Triggered when health score drops below threshold' },
  { id: 'TPL-004', name: 'Invoice & Billing', category: 'Finance', steps: 6, uses: 892, rating: 4.9, description: 'Monthly billing cycle with usage calculation and PDF generation' },
  { id: 'TPL-005', name: 'Data Sync', category: 'Integration', steps: 4, uses: 1248, rating: 4.7, description: 'Bi-directional sync with Salesforce, HubSpot, or custom CRM' },
  { id: 'TPL-006', name: 'Approval Chain', category: 'Governance', steps: 3, uses: 456, rating: 4.4, description: 'Multi-level approval workflow with escalation rules' },
]
const nodeTypes = [
  { type: 'Trigger', icon: Zap, color: 'bg-amber-500', desc: 'Start the workflow' },
  { type: 'Action', icon: Play, color: 'bg-blue-500', desc: 'Execute a task' },
  { type: 'Condition', icon: GitBranch, color: 'bg-purple-500', desc: 'Branch logic' },
  { type: 'Email', icon: Mail, color: 'bg-emerald-500', desc: 'Send notification' },
  { type: 'Wait', icon: Clock, color: 'bg-gray-500', desc: 'Delay execution' },
  { type: 'Filter', icon: Filter, color: 'bg-rose-500', desc: 'Filter records' },
]

const activeWorkflows = [
  { id: 'WF-001', name: 'Lead Auto-Qualification', template: 'Lead Qualification', status: 'active', executions: 1248, lastRun: '2 min ago', successRate: 98.2, avgDuration: '4.2s', errors: 22, category: 'Sales' },
  { id: 'WF-002', name: 'Enterprise Onboarding', template: 'Customer Onboarding', status: 'active', executions: 342, lastRun: '18 min ago', successRate: 96.5, avgDuration: '12.8s', errors: 12, category: 'Success' },
  { id: 'WF-003', name: 'Churn Alert Pipeline', template: 'Churn Risk Response', status: 'paused', executions: 89, lastRun: '2 hours ago', successRate: 100, avgDuration: '2.1s', errors: 0, category: 'Retention' },
  { id: 'WF-004', name: 'Monthly Billing Cycle', template: 'Invoice & Billing', status: 'active', executions: 4820, lastRun: '5 min ago', successRate: 99.1, avgDuration: '8.4s', errors: 43, category: 'Finance' },
  { id: 'WF-005', name: 'Salesforce Bi-Sync', template: 'Data Sync', status: 'error', executions: 2400, lastRun: '45 min ago', successRate: 94.2, avgDuration: '15.6s', errors: 139, category: 'Integration' },
  { id: 'WF-006', name: 'Deal Approval Flow', template: 'Approval Chain', status: 'active', executions: 678, lastRun: '1 hour ago', successRate: 97.8, avgDuration: '6.2s', errors: 15, category: 'Governance' },
]

export default function WorkflowBuilder() {
  const { data: _apiData, isLoading: _apiLoading, isUsingFallback } = useApiData('workflowbuilder', () => apiClient.dashboard.metrics(), { fallback: templates })
  const { tenant } = useTenant()
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState('workflows')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  const filteredWorkflows = activeWorkflows.filter(wf => {
    const matchSearch = !search || wf.name.toLowerCase().includes(search.toLowerCase()) || wf.template.toLowerCase().includes(search.toLowerCase())
    const matchCat = categoryFilter === 'all' || wf.category === categoryFilter
    const matchStatus = statusFilter === 'all' || wf.status === statusFilter
    return matchSearch && matchCat && matchStatus
  })
  const filteredTemplates = templates.filter(t => !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.category.toLowerCase().includes(search.toLowerCase()))

  return (
    <div role="region" aria-label="WorkflowBuilder" className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><Workflow className="w-7 h-7 text-cyan-600" /> Workflow Builder</h1><p className="text-gray-500 dark:text-gray-400 mt-1">Visual drag-and-drop workflow automation for {tenant?.name || 'Platform'}</p></div>
        <div className="flex gap-2"><button className="px-3 py-2 bg-cyan-600 text-white rounded-lg text-sm flex items-center gap-1 hover:bg-cyan-700"><Plus className="w-4 h-4" /> New Workflow</button><FallbackBadge /></div>
      </div>
      <div className="grid grid-cols-4 gap-3">
        {[{ l: 'Active Workflows', v: activeWorkflows.filter(w => w.status === 'active').length }, { l: 'Executions/Day', v: '3,840' }, { l: 'Avg Time Saved', v: '4.2 hrs' }, { l: 'Success Rate', v: (activeWorkflows.reduce((s, w) => s + w.successRate, 0) / activeWorkflows.length).toFixed(1) + '%', c: 'text-emerald-600' }].map(s => (
          <div key={s.l} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3"><p className="text-xs text-gray-500">{s.l}</p><p className={`text-xl font-bold ${s.c || 'text-gray-900 dark:text-white'}`}>{s.v}</p></div>
        ))}
      </div>
      <div className="border-b border-gray-200 dark:border-gray-700"><div className="flex space-x-6">
        {[{ id: 'workflows', label: 'Active Workflows' }, { id: 'templates', label: 'Templates' }, { id: 'nodes', label: 'Node Types' }].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`pb-3 text-sm font-medium border-b-2 ${activeTab === tab.id ? 'border-cyan-600 text-cyan-600' : 'border-transparent text-gray-500'}`}>{tab.label}</button>
        ))}
      </div></div>
      <div className="flex gap-2">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search workflows and templates..." className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white" /></div>
        {activeTab === 'workflows' && (<><select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white"><option value="all">All Categories</option>{['Sales', 'Success', 'Retention', 'Finance', 'Integration', 'Governance'].map(c => <option key={c} value={c}>{c}</option>)}</select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white"><option value="all">All Status</option>{['active', 'paused', 'error'].map(s => <option key={s} value={s}>{s}</option>)}</select></>)}
      </div>
      {activeTab === 'workflows' && (<div className="space-y-2">{filteredWorkflows.map(wf => (
        <div key={wf.id} onClick={() => setSelected(selected === wf.id ? null : wf.id)} className={`bg-white dark:bg-gray-800 rounded-xl border p-4 cursor-pointer hover:shadow-md transition-shadow ${selected === wf.id ? 'border-cyan-500 ring-1 ring-cyan-500' : 'border-gray-200 dark:border-gray-700'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3"><div className={`w-2.5 h-2.5 rounded-full ${wf.status === 'active' ? 'bg-emerald-500' : wf.status === 'paused' ? 'bg-amber-500' : 'bg-red-500'}`} /><div><h4 className="font-semibold text-gray-900 dark:text-white">{wf.name}</h4><p className="text-xs text-gray-500">Template: {wf.template} · Last run: {wf.lastRun}</p></div></div>
            <div className="flex items-center gap-4 text-xs text-gray-500"><span>{wf.executions.toLocaleString()} runs</span><span className={wf.successRate >= 97 ? 'text-emerald-600' : 'text-amber-600'}>{wf.successRate}%</span></div>
          </div>
          {selected === wf.id && (<div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-4 gap-3 mb-3">{[{ l: 'Avg Duration', v: wf.avgDuration }, { l: 'Total Errors', v: wf.errors }, { l: 'Category', v: wf.category }, { l: 'Status', v: wf.status }].map(s => <div key={s.l} className="text-center"><p className="text-xs text-gray-400">{s.l}</p><p className="text-sm font-bold text-gray-900 dark:text-white">{s.v}</p></div>)}</div>
            <div className="flex gap-2">{wf.status === 'active' ? <button className="px-3 py-1.5 bg-amber-500 text-white rounded text-xs hover:bg-amber-600 flex items-center gap-1"><Pause className="w-3 h-3" /> Pause</button> : <button className="px-3 py-1.5 bg-emerald-600 text-white rounded text-xs hover:bg-emerald-700 flex items-center gap-1"><Play className="w-3 h-3" /> Resume</button>}<button className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs text-gray-700 dark:text-gray-300 flex items-center gap-1"><Copy className="w-3 h-3" /> Clone</button><button className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs text-gray-700 dark:text-gray-300 flex items-center gap-1"><Settings className="w-3 h-3" /> Configure</button><button className="px-3 py-1.5 border border-red-300 text-red-600 rounded text-xs flex items-center gap-1"><Trash2 className="w-3 h-3" /> Delete</button></div>
          </div>)}
        </div>
      ))}</div>)}
      {activeTab === 'templates' && (<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filteredTemplates.map(tpl => (
          <div key={tpl.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2"><h4 className="font-semibold text-gray-900 dark:text-white">{tpl.name}</h4><span className="text-xs px-2 py-0.5 rounded bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400">{tpl.category}</span></div>
            <p className="text-sm text-gray-500 mb-3">{tpl.description}</p>
            <div className="flex items-center justify-between"><div className="flex items-center gap-3 text-xs text-gray-400"><span>{tpl.steps} steps</span><span>{tpl.uses} uses</span><span>★ {tpl.rating}</span></div><button className="px-3 py-1.5 bg-cyan-600 text-white rounded text-xs hover:bg-cyan-700">Use Template</button></div>
          </div>
        ))}
      </div>)}
      {activeTab === 'nodes' && (<div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {nodeTypes.map(node => (
          <div key={node.type} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 cursor-grab hover:shadow-md transition-shadow">
            <div className="flex items-center gap-2 mb-2"><div className={`w-8 h-8 rounded-lg ${node.color} flex items-center justify-center`}><node.icon className="w-4 h-4 text-white" /></div><h4 className="font-semibold text-gray-900 dark:text-white">{node.type}</h4></div>
            <p className="text-xs text-gray-500">{node.desc}</p>
          </div>
        ))}
      </div>)}
    </div>
  )
}
