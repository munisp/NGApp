import { useState } from 'react'
import { Workflow, Play, Pause, CheckCircle, XCircle, Clock, AlertTriangle, Activity, Settings, Eye, RefreshCw, ChevronRight, Zap, BarChart3 } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { FallbackBadge } from '@/components/ui/DataStates'
import { useApiData } from '@/hooks/useApiData'
import { apiClient } from '@/lib/apiClient'

const workflows = [
  { id: 'WF-001', name: 'Lead Qualification Pipeline', status: 'running', executions: 342, successRate: 96, avgDuration: '2.4s', lastRun: '30 sec ago', trigger: 'New lead created', steps: [
    { name: 'Enrich Lead Data', status: 'completed', duration: '0.8s', output: 'Company size: 500+, Industry: Finance' },
    { name: 'Score Lead (ML)', status: 'completed', duration: '1.2s', output: 'Score: 84/100, Priority: High' },
    { name: 'Assign to Rep', status: 'running', duration: '0.3s', output: 'Matching to available reps...' },
    { name: 'Send Welcome Email', status: 'pending', duration: '-', output: '' },
    { name: 'Create Task', status: 'pending', duration: '-', output: '' },
  ]},
  { id: 'WF-002', name: 'Customer Onboarding', status: 'running', executions: 128, successRate: 92, avgDuration: '48h', lastRun: '2 hours ago', trigger: 'Deal closed-won', steps: [
    { name: 'Generate Welcome Kit', status: 'completed', duration: '1.5s', output: 'PDF generated, 12 pages' },
    { name: 'Provision Account', status: 'completed', duration: '3.2s', output: 'Account ID: ACC-4821 created' },
    { name: 'Assign CSM', status: 'completed', duration: '0.5s', output: 'Assigned to Sarah Okonkwo' },
    { name: 'Schedule Kickoff', status: 'running', duration: '2.1s', output: 'Finding mutual availability...' },
    { name: 'Send Access Credentials', status: 'pending', duration: '-', output: '' },
  ]},
  { id: 'WF-003', name: 'Churn Risk Alert', status: 'idle', executions: 67, successRate: 88, avgDuration: '5.2s', lastRun: '4 hours ago', trigger: 'Health score < 40', steps: [
    { name: 'Analyze Health Signals', status: 'completed', duration: '1.8s', output: '3 risk factors identified' },
    { name: 'Generate Report', status: 'completed', duration: '2.1s', output: 'Risk report with recommendations' },
    { name: 'Notify CSM', status: 'completed', duration: '0.4s', output: 'Slack + Email sent' },
    { name: 'Create Retention Task', status: 'completed', duration: '0.9s', output: 'Task RT-892 created, due in 24h' },
  ]},
  { id: 'WF-004', name: 'Invoice Generation', status: 'failed', executions: 892, successRate: 99, avgDuration: '8.4s', lastRun: '1 hour ago', trigger: 'Monthly billing cycle', steps: [
    { name: 'Calculate Usage', status: 'completed', duration: '2.4s', output: '43,242 line items processed' },
    { name: 'Apply Discounts', status: 'completed', duration: '1.1s', output: '12 discount rules applied' },
    { name: 'Generate PDF', status: 'failed', duration: '4.9s', output: 'Error: Template rendering timeout — batch too large' },
    { name: 'Send Invoice', status: 'skipped', duration: '-', output: 'Skipped due to previous failure' },
  ]},
  { id: 'WF-005', name: 'Data Sync (Salesforce)', status: 'running', executions: 1248, successRate: 97, avgDuration: '12.8s', lastRun: '5 min ago', trigger: 'Every 15 minutes', steps: [
    { name: 'Fetch Delta Changes', status: 'completed', duration: '3.2s', output: '48 records changed since last sync' },
    { name: 'Transform Schema', status: 'completed', duration: '1.4s', output: '48 records mapped to CRM schema' },
    { name: 'Upsert Records', status: 'running', duration: '5.8s', output: '32/48 records synced...' },
    { name: 'Update Sync Log', status: 'pending', duration: '-', output: '' },
  ]},
]

const WorkflowRuntime = () => {
  const { data: _apiData, isLoading: _apiLoading, isUsingFallback } = useApiData('workflowruntime', () => apiClient.dashboard.metrics(), { fallback: workflows })
  const { tenant } = useTenant()
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState('workflows')
  const [selectedWorkflow, setSelectedWorkflow] = useState(null)

  const statusConfig = {
    running: { color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: RefreshCw, animate: true },
    idle: { color: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400', icon: Pause, animate: false },
    failed: { color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: XCircle, animate: false },
    completed: { color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', icon: CheckCircle, animate: false },
  }
  const stepStatusConfig = {
    completed: { color: 'text-emerald-500', bg: 'bg-emerald-500' },
    running: { color: 'text-blue-500', bg: 'bg-blue-500' },
    pending: { color: 'text-gray-300 dark:text-gray-600', bg: 'bg-gray-300 dark:bg-gray-600' },
    failed: { color: 'text-red-500', bg: 'bg-red-500' },
    skipped: { color: 'text-gray-400', bg: 'bg-gray-400' },
  }

  const totalExec = workflows.reduce((s, w) => s + w.executions, 0)
  const runningCount = workflows.filter(w => w.status === 'running').length
  const failedCount = workflows.filter(w => w.status === 'failed').length

  return (
    <div role="region" aria-label="WorkflowRuntime" className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><Workflow className="w-7 h-7 text-cyan-600" /> Workflow Runtime</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Execution engine for automated workflows</p>
        </div>
        <FallbackBadge />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { l: 'Total Workflows', v: workflows.length, icon: Workflow },
          { l: 'Running', v: runningCount, icon: RefreshCw },
          { l: 'Failed', v: failedCount, icon: XCircle },
          { l: 'Executions Today', v: totalExec.toLocaleString(), icon: Activity },
          { l: 'Avg Success', v: Math.round(workflows.reduce((s, w) => s + w.successRate, 0) / workflows.length) + '%', icon: CheckCircle },
        ].map(s => (
          <div key={s.l} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
            <div className="flex items-center gap-1.5 mb-1"><s.icon className="w-3.5 h-3.5 text-gray-400" /><p className="text-xs text-gray-500">{s.l}</p></div>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{s.v}</p>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        {workflows.map(wf => {
          const cfg = statusConfig[wf.status]
          const StatusIcon = cfg.icon
          const isExpanded = selectedWorkflow === wf.id
          return (
            <div key={wf.id} onClick={() => setSelectedWorkflow(isExpanded ? null : wf.id)} className={`bg-white dark:bg-gray-800 rounded-xl border p-4 cursor-pointer transition-all hover:shadow-md ${isExpanded ? 'border-cyan-500 ring-1 ring-cyan-500' : 'border-gray-200 dark:border-gray-700'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <StatusIcon className={`w-5 h-5 ${cfg.animate ? 'animate-spin' : ''} ${wf.status === 'running' ? 'text-blue-500' : wf.status === 'failed' ? 'text-red-500' : 'text-gray-400'}`} />
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-gray-900 dark:text-white">{wf.name}</h4>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${cfg.color}`}>{wf.status}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                      <span>Trigger: {wf.trigger}</span>
                      <span>Last: {wf.lastRun}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-right">
                  <div><p className="text-xs text-gray-400">Executions</p><p className="text-sm font-bold text-gray-900 dark:text-white">{wf.executions}</p></div>
                  <div><p className="text-xs text-gray-400">Success</p><p className="text-sm font-bold text-gray-900 dark:text-white">{wf.successRate}%</p></div>
                  <div><p className="text-xs text-gray-400">Avg Time</p><p className="text-sm font-bold text-gray-900 dark:text-white">{wf.avgDuration}</p></div>
                  <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                </div>
              </div>
              {isExpanded && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <h5 className="text-xs font-medium text-gray-500 mb-3">Execution Steps</h5>
                  <div className="space-y-1">
                    {wf.steps.map((step, i) => {
                      const scfg = stepStatusConfig[step.status]
                      return (
                        <div key={i} className="flex items-start gap-3">
                          <div className="flex flex-col items-center">
                            <div className={`w-3 h-3 rounded-full ${scfg.bg} ${step.status === 'running' ? 'animate-pulse' : ''}`} />
                            {i < wf.steps.length - 1 && <div className="w-0.5 h-6 bg-gray-200 dark:bg-gray-700" />}
                          </div>
                          <div className="flex-1 pb-2">
                            <div className="flex items-center justify-between">
                              <span className={`text-sm font-medium ${step.status === 'completed' ? 'text-gray-900 dark:text-white' : step.status === 'running' ? 'text-blue-600' : step.status === 'failed' ? 'text-red-600' : 'text-gray-400'}`}>{step.name}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-400">{step.duration}</span>
                                <span className={`text-xs px-1.5 py-0.5 rounded ${step.status === 'completed' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20' : step.status === 'running' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20' : step.status === 'failed' ? 'bg-red-50 text-red-600 dark:bg-red-900/20' : 'bg-gray-50 text-gray-400 dark:bg-gray-700'}`}>{step.status}</span>
                              </div>
                            </div>
                            {step.output && <p className="text-xs text-gray-500 mt-0.5">{step.output}</p>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <div className="flex gap-2 mt-3">
                    {wf.status === 'failed' && <button className="px-3 py-1.5 bg-cyan-600 text-white rounded text-xs hover:bg-cyan-700 flex items-center gap-1"><RefreshCw className="w-3 h-3" /> Retry</button>}
                    {wf.status === 'running' && <button className="px-3 py-1.5 bg-amber-600 text-white rounded text-xs hover:bg-amber-700 flex items-center gap-1"><Pause className="w-3 h-3" /> Pause</button>}
                    <button className="px-3 py-1.5 border border-gray-200 dark:border-gray-600 rounded text-xs text-gray-700 dark:text-gray-300 flex items-center gap-1"><Eye className="w-3 h-3" /> View Logs</button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default WorkflowRuntime
