import { useState } from 'react'
import { Heart, Shield, Activity, AlertTriangle, TrendingDown, TrendingUp, Users, Mail, Phone, CheckCircle, Clock, Zap, BarChart3, Play, Pause, Eye, RefreshCw, Brain, MessageSquare } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { FallbackBadge } from '@/components/ui/DataStates'
import { useApiData } from '@/hooks/useApiData'
import { apiClient } from '@/lib/apiClient'

const tenantCSData = {
  'acme-bank': {
    stats: { monitored: 43242, atRisk: 142, interventions: 34, saved: 28, revenueProtected: '₦2.8B', avgHealth: 72 },
    atRiskAccounts: [
      { id: 'CUS-003', name: 'Kano Textiles Ltd', health: 25, change: -24, segment: 'SME', value: '₦45.2M', reason: 'No login 45 days, 3 open tickets', playbook: 'Win-Back Campaign', playbookStatus: 'executing', actions: [{ type: 'email', desc: 'Personalized re-engagement sent', status: 'sent', time: '2 hours ago' }, { type: 'call', desc: 'CSM outreach scheduled', status: 'pending', time: 'Tomorrow 10am' }] },
      { id: 'CUS-006', name: 'Lagos Fresh Markets', health: 22, change: -18, segment: 'SME', value: '₦8.7M', reason: 'Payment missed, declining usage', playbook: 'Payment Recovery', playbookStatus: 'executing', actions: [{ type: 'email', desc: 'Payment reminder + flexible terms offer', status: 'sent', time: '4 hours ago' }, { type: 'sms', desc: 'SMS follow-up', status: 'scheduled', time: 'In 24 hours' }] },
      { id: 'CUS-005', name: 'Abuja Motors Group', health: 28, change: -12, segment: 'Corporate', value: '₦22.1M', reason: 'Downgraded plan, reduced usage', playbook: 'Value Reinforcement', playbookStatus: 'ready', actions: [{ type: 'email', desc: 'ROI report with savings analysis', status: 'draft', time: 'Ready to send' }] },
      { id: 'CUS-008', name: 'Port Harcourt Shipping', health: 31, change: -15, segment: 'Enterprise', value: '₦67.8M', reason: 'Contract renewal due, no engagement', playbook: 'Renewal Acceleration', playbookStatus: 'executing', actions: [{ type: 'call', desc: 'Executive sponsor outreach', status: 'completed', time: '1 day ago' }, { type: 'meeting', desc: 'QBR scheduled', status: 'confirmed', time: 'Next Wednesday' }] },
      { id: 'CUS-009', name: 'Ibadan AgriTech', health: 33, change: -9, segment: 'SME', value: '₦5.3M', reason: 'Feature adoption dropped 60%', playbook: 'Adoption Boost', playbookStatus: 'ready', actions: [{ type: 'email', desc: 'Feature tutorial series', status: 'draft', time: 'Ready to send' }] },
    ],
    playbooks: [
      { name: 'Win-Back Campaign', trigger: 'Health < 30, inactive > 30 days', active: 12, successRate: 68, avgRecovery: '₦18M' },
      { name: 'Payment Recovery', trigger: 'Missed payment, health declining', active: 8, successRate: 74, avgRecovery: '₦12M' },
      { name: 'Value Reinforcement', trigger: 'Plan downgrade or feature drop', active: 15, successRate: 52, avgRecovery: '₦8M' },
      { name: 'Renewal Acceleration', trigger: 'Renewal < 90 days, low engagement', active: 22, successRate: 81, avgRecovery: '₦45M' },
      { name: 'Adoption Boost', trigger: 'Feature adoption < 40%', active: 18, successRate: 63, avgRecovery: '₦6M' },
      { name: 'NPS Recovery', trigger: 'NPS score < 5 (detractor)', active: 9, successRate: 45, avgRecovery: '₦22M' },
    ],
    recentActions: [
      { time: '5 min ago', action: 'Intervention triggered', detail: 'Kano Textiles — Win-Back Campaign activated', type: 'trigger' },
      { time: '2 hours ago', action: 'Email sent', detail: 'Lagos Fresh Markets — Payment reminder with flexible terms', type: 'email' },
      { time: '4 hours ago', action: 'Health alert', detail: 'Abuja Motors — Health dropped below 30 threshold', type: 'alert' },
      { time: '1 day ago', action: 'Save confirmed', detail: 'Micro Savings Coop — Upgraded after Value Reinforcement', type: 'save' },
      { time: '2 days ago', action: 'QBR scheduled', detail: 'Port Harcourt Shipping — Executive sponsor engaged', type: 'meeting' },
    ],
  },
  'aerotel': {
    stats: { monitored: 18400, atRisk: 89, interventions: 18, saved: 14, revenueProtected: '$4.2M', avgHealth: 78 },
    atRiskAccounts: [
      { id: 'SUB-004', name: 'Abuja Government Contract', health: 45, change: -12, segment: 'Government', value: '$8.9M ARR', reason: 'Renewal risk, compliance pending', playbook: 'Renewal Acceleration', playbookStatus: 'executing', actions: [{ type: 'call', desc: 'Government liaison meeting', status: 'completed', time: '2 days ago' }, { type: 'email', desc: 'Compliance documentation sent', status: 'sent', time: '1 day ago' }] },
    ],
    playbooks: [
      { name: 'Churn Prevention', trigger: 'Usage drop > 40%, SLA breach', active: 8, successRate: 72, avgRecovery: '$1.2M' },
      { name: 'Renewal Acceleration', trigger: 'Contract renewal < 60 days', active: 14, successRate: 85, avgRecovery: '$3.8M' },
    ],
    recentActions: [
      { time: '1 hour ago', action: 'SLA alert', detail: 'Northern Region — Uptime dropped below 99.9% threshold', type: 'alert' },
      { time: '3 hours ago', action: 'Save confirmed', detail: 'Enterprise client renewed $2.4M contract after intervention', type: 'save' },
    ],
  },
}

const CustomerSuccessAgent = () => {
  const { data: _apiData, isLoading: _apiLoading, isUsingFallback } = useApiData('customersuccessagent', () => apiClient.dashboard.metrics(), { fallback: tenantCSData })
  const { tenant } = useTenant()
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [riskFilter, setRiskFilter] = useState('all')
  const [activeTab, setActiveTab] = useState('at-risk')
  const [agentStatus, setAgentStatus] = useState('active')
  const [expandedAccount, setExpandedAccount] = useState(null)

  const tenantSlug = tenant?.slug || 'acme-bank'
  const data = tenantCSData[tenantSlug] || tenantCSData['acme-bank']
  const tabs = [
    { id: 'at-risk', label: 'At-Risk Accounts', icon: AlertTriangle },
    { id: 'playbooks', label: 'Retention Playbooks', icon: Shield },
    { id: 'activity', label: 'Agent Activity', icon: Activity },
  ]

  const statusColor = (s) => ({ executing: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', ready: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' })[s] || 'bg-gray-100 text-gray-600'
  const actionStatusIcon = (s) => ({ sent: CheckCircle, completed: CheckCircle, confirmed: CheckCircle, pending: Clock, scheduled: Clock, draft: Eye })[s] || Clock
  const actionTypeIcon = (type) => ({ email: Mail, call: Phone, sms: MessageSquare, meeting: Users })[type] || Zap

  return (
    <div role="region" aria-label="CustomerSuccessAgent" className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Heart className="w-7 h-7 text-rose-600" /> Customer Success Agent
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Automated health monitoring and retention for {tenant?.name || 'platform'}</p>
        </div>
        <div className="flex items-center gap-3">
          <FallbackBadge />
          <button onClick={() => setAgentStatus(s => s === 'active' ? 'paused' : 'active')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${agentStatus === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>
            {agentStatus === 'active' ? <><Play className="w-4 h-4" /> Monitoring</> : <><Pause className="w-4 h-4" /> Paused</>}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-6 gap-3">
        {[
          { l: 'Monitored', v: data.stats.monitored.toLocaleString(), icon: Users, color: 'text-blue-500' },
          { l: 'At Risk', v: data.stats.atRisk, icon: AlertTriangle, color: 'text-red-500' },
          { l: 'Interventions', v: data.stats.interventions, icon: Zap, color: 'text-purple-500' },
          { l: 'Saved', v: data.stats.saved, icon: CheckCircle, color: 'text-emerald-500' },
          { l: 'Revenue Protected', v: data.stats.revenueProtected, icon: Shield, color: 'text-cyan-500' },
          { l: 'Avg Health', v: data.stats.avgHealth, icon: Heart, color: 'text-rose-500' },
        ].map(s => (
          <div key={s.l} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
            <div className="flex items-center gap-1.5 mb-1"><s.icon className={`w-3.5 h-3.5 ${s.color}`} /><p className="text-xs text-gray-500">{s.l}</p></div>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{s.v}</p>
          </div>
        ))}
      </div>

      <div className="border-b border-gray-200 dark:border-gray-700">
        <div className="flex space-x-6">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`pb-3 text-sm font-medium border-b-2 flex items-center gap-2 ${activeTab === tab.id ? 'border-rose-600 text-rose-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              <tab.icon className="w-4 h-4" /> {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'at-risk' && (
        <div className="space-y-2">
          {data.atRiskAccounts.map(acct => (
            <div key={acct.id} onClick={() => setExpandedAccount(expandedAccount === acct.id ? null : acct.id)} className={`bg-white dark:bg-gray-800 rounded-xl border p-4 cursor-pointer transition-all hover:shadow-md ${expandedAccount === acct.id ? 'border-rose-500 ring-1 ring-rose-500' : 'border-gray-200 dark:border-gray-700'}`}>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-gray-900 dark:text-white">{acct.name}</h4>
                    <span className="text-xs text-gray-400">{acct.id}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${statusColor(acct.playbookStatus)}`}>{acct.playbook}</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">{acct.reason}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                    <span>{acct.segment}</span><span>{acct.value}</span>
                  </div>
                </div>
                <div className="text-right ml-4">
                  <p className={`text-2xl font-bold ${acct.health < 30 ? 'text-red-600' : 'text-amber-600'}`}>{acct.health}</p>
                  <p className="text-xs text-red-500 flex items-center gap-0.5 justify-end"><TrendingDown className="w-3 h-3" />{acct.change} pts</p>
                </div>
              </div>
              {expandedAccount === acct.id && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <h5 className="text-xs font-medium text-gray-500 mb-2">Automated Actions</h5>
                  <div className="space-y-2">
                    {acct.actions.map((action, i) => {
                      const TypeIcon = actionTypeIcon(action.type)
                      const StatusIcon = actionStatusIcon(action.status)
                      return (
                        <div key={i} className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                          <TypeIcon className="w-4 h-4 text-gray-400" />
                          <div className="flex-1">
                            <p className="text-sm text-gray-900 dark:text-white">{action.desc}</p>
                            <p className="text-xs text-gray-400">{action.time}</p>
                          </div>
                          <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded ${action.status === 'sent' || action.status === 'completed' || action.status === 'confirmed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-600 dark:text-gray-300'}`}>
                            <StatusIcon className="w-3 h-3" />{action.status}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {activeTab === 'playbooks' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {data.playbooks.map(pb => (
            <div key={pb.name} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <h4 className="font-semibold text-gray-900 dark:text-white">{pb.name}</h4>
              <p className="text-xs text-gray-500 mt-1">Trigger: {pb.trigger}</p>
              <div className="grid grid-cols-3 gap-2 mt-3">
                <div><p className="text-xs text-gray-400">Active</p><p className="text-lg font-bold text-gray-900 dark:text-white">{pb.active}</p></div>
                <div><p className="text-xs text-gray-400">Success Rate</p><p className="text-lg font-bold text-emerald-600">{pb.successRate}%</p></div>
                <div><p className="text-xs text-gray-400">Avg Recovery</p><p className="text-lg font-bold text-blue-600">{pb.avgRecovery}</p></div>
              </div>
              <div className="mt-2 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full"><div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pb.successRate}%` }} /></div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'activity' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700">
          {data.recentActions.map((a, i) => (
            <div key={i} className="p-4 flex items-start gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/50">
              <div className={`mt-0.5 ${a.type === 'alert' ? 'text-red-500' : a.type === 'save' ? 'text-emerald-500' : a.type === 'email' ? 'text-blue-500' : 'text-purple-500'}`}>
                {a.type === 'alert' ? <AlertTriangle className="w-4 h-4" /> : a.type === 'save' ? <CheckCircle className="w-4 h-4" /> : a.type === 'email' ? <Mail className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-white">{a.action}</p>
                <p className="text-sm text-gray-500">{a.detail}</p>
              </div>
              <span className="text-xs text-gray-400 whitespace-nowrap">{a.time}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default CustomerSuccessAgent
