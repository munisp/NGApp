import { useState } from 'react'
import { Workflow, Plus, Play, Pause, Trash2, Copy, Settings, ArrowRight, CheckCircle, AlertTriangle, Clock, Zap, GitBranch, Mail, MessageSquare, Filter } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { LoadingState, ErrorState, EmptyState, FallbackBadge, ExportButton } from '@/components/ui/DataStates'
import { useTranslation } from '@/lib/i18n/useTranslation'

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

export default function WorkflowBuilder() {
  const { tenant } = useTenant()
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState('templates')

  return (
    <div role="region" aria-label="WorkflowBuilder" className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><Workflow className="w-7 h-7 text-cyan-600" /> Workflow Builder</h1><p className="text-gray-500 dark:text-gray-400 mt-1">Visual drag-and-drop workflow automation builder</p></div>
        <FallbackBadge />
      </div>
      <div className="grid grid-cols-4 gap-3">
        {[
          { l: "Active Workflows", v: "142" },
          { l: "Executions/Day", v: "3,840" },
          { l: "Avg Time Saved", v: "4.2 hrs" },
          { l: "Success Rate", v: "97.8%" },
        ].map(s => (
          <div key={s.l} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3"><p className="text-xs text-gray-500">{s.l}</p><p className="text-xl font-bold text-gray-900 dark:text-white">{s.v}</p></div>
        ))}
      </div>
      <div className="border-b border-gray-200 dark:border-gray-700"><div className="flex space-x-6">
        {[
            { id: "templates", label: "Templates" },
            { id: "nodes", label: "Node Types" },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`pb-3 text-sm font-medium border-b-2 ${activeTab === tab.id ? 'border-cyan-600 text-cyan-600' : 'border-transparent text-gray-500'}`}>{tab.label}</button>
        ))}
      </div></div>
      {activeTab === "templates" && (

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {templates.map(tpl => (
            <div key={tpl.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-gray-900 dark:text-white">{tpl.name}</h4>
                <span className="text-xs px-2 py-0.5 rounded bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400">{tpl.category}</span>
              </div>
              <p className="text-sm text-gray-500 mb-3">{tpl.description}</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  <span>{tpl.steps} steps</span><span>{tpl.uses} uses</span><span>★ {tpl.rating}</span>
                </div>
                <button className="px-3 py-1.5 bg-cyan-600 text-white rounded text-xs hover:bg-cyan-700">Use Template</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {activeTab === "nodes" && (

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {nodeTypes.map(node => (
            <div key={node.type} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 cursor-grab hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-8 h-8 rounded-lg ${node.color} flex items-center justify-center`}><node.icon className="w-4 h-4 text-white" /></div>
                <h4 className="font-semibold text-gray-900 dark:text-white">{node.type}</h4>
              </div>
              <p className="text-xs text-gray-500">{node.desc}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
