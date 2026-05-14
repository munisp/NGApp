import { useState } from 'react'
import { Shield, Activity, AlertTriangle, CheckCircle, XCircle, Eye, Clock, Users, DollarSign, Settings, Lock, Unlock, Brain, Zap, BarChart3, Power, RefreshCw } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { FallbackBadge , ErrorState } from '@/components/ui/DataStates'
import { useApiData } from '@/hooks/useApiData'
import { apiClient } from '@/lib/apiClient'

const governanceData = {
  stats: { totalAgents: 4, activeAgents: 3, actionsToday: 276, pendingApproval: 8, costToday: '$12.40', humanOverrides: 3 },
  agents: [
    { id: 'AGT-001', name: 'Sales Agent', type: 'Autonomous', status: 'active', tier: 'Execute', actionsToday: 142, cost: '$5.20', accuracy: 94, lastAction: '2 min ago', permissions: ['lead_scoring', 'outreach_draft', 'meeting_booking', 'research'], riskLevel: 'medium', approvalRequired: false },
    { id: 'AGT-002', name: 'CS Agent', type: 'Autonomous', status: 'active', tier: 'Execute', actionsToday: 98, cost: '$4.80', accuracy: 91, lastAction: '5 min ago', permissions: ['health_monitoring', 'email_send', 'playbook_trigger', 'escalation'], riskLevel: 'medium', approvalRequired: false },
    { id: 'AGT-003', name: 'Analytics Agent', type: 'Advisory', status: 'active', tier: 'Suggest', actionsToday: 36, cost: '$2.40', accuracy: 97, lastAction: '15 min ago', permissions: ['data_analysis', 'report_generation', 'trend_detection'], riskLevel: 'low', approvalRequired: false },
    { id: 'AGT-004', name: 'Compliance Agent', type: 'Monitor', status: 'paused', tier: 'Observe', actionsToday: 0, cost: '$0.00', accuracy: 99, lastAction: '2 hours ago', permissions: ['audit_scan', 'policy_check', 'alert_generation'], riskLevel: 'low', approvalRequired: true },
  ],
  auditLog: [
    { time: '2 min ago', agent: 'Sales Agent', action: 'Lead scored', target: 'Flour Mills — 94/100', result: 'approved', cost: '$0.02', risk: 'low' },
    { time: '5 min ago', agent: 'CS Agent', action: 'Email sent', target: 'Kano Textiles — Win-back email', result: 'approved', cost: '$0.04', risk: 'medium' },
    { time: '12 min ago', agent: 'Sales Agent', action: 'Outreach drafted', target: 'NNPC — Trade finance', result: 'pending_review', cost: '$0.08', risk: 'medium' },
    { time: '30 min ago', agent: 'CS Agent', action: 'Playbook triggered', target: 'Abuja Motors — Value Reinforcement', result: 'approved', cost: '$0.03', risk: 'low' },
    { time: '1 hour ago', agent: 'Sales Agent', action: 'Meeting booked', target: 'Dangote Group — Thu 2pm', result: 'human_override', cost: '$0.01', risk: 'high' },
    { time: '2 hours ago', agent: 'Analytics Agent', action: 'Report generated', target: 'Weekly pipeline analysis', result: 'approved', cost: '$0.15', risk: 'low' },
    { time: '3 hours ago', agent: 'Sales Agent', action: 'Competitor alert', target: 'GTBank pitching to MTN', result: 'approved', cost: '$0.06', risk: 'medium' },
    { time: '4 hours ago', agent: 'CS Agent', action: 'Escalation created', target: 'Critical — Kano Textiles NPS 18', result: 'rejected', cost: '$0.02', risk: 'high' },
  ],
  pendingApprovals: [
    { id: 'APR-001', agent: 'Sales Agent', action: 'Send outreach email', target: 'NNPC — ₦1.2B Trade Finance', risk: 'high', reason: 'High-value target, requires executive approval', submitted: '12 min ago' },
    { id: 'APR-002', agent: 'CS Agent', action: 'Trigger discount offer', target: 'Port Harcourt Shipping — 15% discount', risk: 'high', reason: 'Discount > 10% requires approval per policy', submitted: '45 min ago' },
    { id: 'APR-003', agent: 'Sales Agent', action: 'Schedule executive call', target: 'Total Energies — C-suite outreach', risk: 'medium', reason: 'New prospect, no prior relationship', submitted: '1 hour ago' },
  ],
  costBreakdown: [
    { category: 'LLM Inference', cost: '$8.20', pct: 66 },
    { category: 'Embedding Generation', cost: '$2.40', pct: 19 },
    { category: 'Data Retrieval', cost: '$1.20', pct: 10 },
    { category: 'Tool Execution', cost: '$0.60', pct: 5 },
  ],
}

const AgentGovernanceDashboard = () => {
  const { data: _apiData, isLoading: _apiLoading, isUsingFallback } = useApiData('agentgovernancedashboard', () => apiClient.dashboard.metrics(), { fallback: governanceData })
  const { tenant } = useTenant()
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState('agents')
  const [agents, setAgents] = useState(governanceData.agents)
  const [error, setError] = useState(null)

  const toggleAgent = (id) => {
    setAgents(prev => prev.map(a => a.id === id ? { ...a, status: a.status === 'active' ? 'paused' : 'active' } : a))
  }

  const resultColor = (r) => ({ approved: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20', rejected: 'text-red-600 bg-red-50 dark:bg-red-900/20', pending_review: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20', human_override: 'text-purple-600 bg-purple-50 dark:bg-purple-900/20' })[r] || 'text-gray-600 bg-gray-50'
  const tierColor = (tier) => ({ Execute: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', Suggest: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', Observe: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' })[tier] || 'bg-gray-100 text-gray-600'

  if (error) return <ErrorState message={error} />

  return (
    <div role="region" aria-label="AgentGovernanceDashboard" className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><Shield className="w-7 h-7 text-indigo-600" /> Agent Governance & Audit</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Permission tiers, kill switches, cost tracking, and human-in-the-loop gates</p>
        </div>
        <FallbackBadge />
      </div>

      <div className="grid grid-cols-6 gap-3">
        {[
          { l: 'Total Agents', v: governanceData.stats.totalAgents, icon: Brain },
          { l: 'Active', v: agents.filter(a => a.status === 'active').length, icon: Activity },
          { l: 'Actions Today', v: governanceData.stats.actionsToday, icon: Zap },
          { l: 'Pending Approval', v: governanceData.pendingApprovals.length, icon: Clock },
          { l: 'Cost Today', v: governanceData.stats.costToday, icon: DollarSign },
          { l: 'Human Overrides', v: governanceData.stats.humanOverrides, icon: Users },
        ].map(s => (
          <div key={s.l} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
            <div className="flex items-center gap-1.5 mb-1"><s.icon className="w-3.5 h-3.5 text-gray-400" /><p className="text-xs text-gray-500">{s.l}</p></div>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{s.v}</p>
          </div>
        ))}
      </div>

      <div className="border-b border-gray-200 dark:border-gray-700">
        <div className="flex space-x-6">
          {[{ id: 'agents', label: 'Agents', icon: Brain }, { id: 'approvals', label: `Approvals (${governanceData.pendingApprovals.length})`, icon: CheckCircle }, { id: 'audit', label: 'Audit Log', icon: Eye }, { id: 'costs', label: 'Cost Tracking', icon: DollarSign }].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`pb-3 text-sm font-medium border-b-2 flex items-center gap-2 ${activeTab === tab.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              <tab.icon className="w-4 h-4" /> {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'agents' && (
        <div className="space-y-3">
          {agents.map(agent => (
            <div key={agent.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${agent.status === 'active' ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-gray-900 dark:text-white">{agent.name}</h4>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${tierColor(agent.tier)}`}>{agent.tier}</span>
                      <span className="text-xs text-gray-400">{agent.type}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                      <span>{agent.actionsToday} actions</span>
                      <span>{agent.accuracy}% accuracy</span>
                      <span>Cost: {agent.cost}</span>
                      <span>Last: {agent.lastAction}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {agent.approvalRequired && <Lock className="w-4 h-4 text-amber-500" title="Approval required" />}
                  <button onClick={() => toggleAgent(agent.id)} className={`p-2 rounded-lg ${agent.status === 'active' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400'}`}>
                    <Power className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                {agent.permissions.map(p => (
                  <span key={p} className="text-xs px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400">{p.replace(/_/g, ' ')}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'approvals' && (
        <div className="space-y-2">
          {governanceData.pendingApprovals.map(a => (
            <div key={a.id} className="bg-white dark:bg-gray-800 rounded-xl border border-amber-200 dark:border-amber-800 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-gray-900 dark:text-white">{a.action}</h4>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${a.risk === 'high' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{a.risk} risk</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">{a.target}</p>
                  <p className="text-xs text-gray-400 mt-1">Agent: {a.agent} · {a.reason} · {a.submitted}</p>
                </div>
                <div className="flex gap-2">
                  <button className="px-3 py-1.5 bg-emerald-600 text-white rounded text-xs hover:bg-emerald-700 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Approve</button>
                  <button className="px-3 py-1.5 bg-red-600 text-white rounded text-xs hover:bg-red-700 flex items-center gap-1"><XCircle className="w-3 h-3" /> Reject</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'audit' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>{['Time', 'Agent', 'Action', 'Target', 'Result', 'Cost', 'Risk'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {governanceData.auditLog.map((log, i) => (
                <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-4 py-3 text-xs text-gray-500">{log.time}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{log.agent}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{log.action}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{log.target}</td>
                  <td className="px-4 py-3"><span className={`text-xs px-1.5 py-0.5 rounded ${resultColor(log.result)}`}>{log.result.replace(/_/g, ' ')}</span></td>
                  <td className="px-4 py-3 text-xs text-gray-500">{log.cost}</td>
                  <td className="px-4 py-3"><span className={`text-xs px-1.5 py-0.5 rounded ${log.risk === 'high' ? 'bg-red-100 text-red-700' : log.risk === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>{log.risk}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'costs' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Cost Breakdown Today</h3>
            <div className="space-y-3">
              {governanceData.costBreakdown.map(c => (
                <div key={c.category}>
                  <div className="flex justify-between mb-1"><span className="text-sm text-gray-600 dark:text-gray-400">{c.category}</span><span className="text-sm font-medium text-gray-900 dark:text-white">{c.cost} ({c.pct}%)</span></div>
                  <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full"><div className="h-full bg-indigo-500 rounded-full" style={{ width: `${c.pct}%` }} /></div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-between">
              <span className="font-medium text-gray-900 dark:text-white">Total Today</span>
              <span className="font-bold text-gray-900 dark:text-white">{governanceData.stats.costToday}</span>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Cost per Agent</h3>
            <div className="space-y-3">
              {agents.map(a => (
                <div key={a.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${a.status === 'active' ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                    <span className="text-sm text-gray-900 dark:text-white">{a.name}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{a.cost}</p>
                    <p className="text-xs text-gray-400">{a.actionsToday} actions</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AgentGovernanceDashboard
