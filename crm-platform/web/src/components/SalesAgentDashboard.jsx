import { useState } from 'react'
import { Brain, Activity, Shield, Target, Users, Mail, Phone, MessageSquare, TrendingUp, Clock, Star, ChevronRight, Play, Pause, CheckCircle, AlertTriangle, Zap, BarChart3, Send, Eye, RefreshCw, Sparkles } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { FallbackBadge } from '@/components/ui/DataStates'
import { useApiData } from '@/hooks/useApiData'
import { apiClient } from '@/lib/apiClient'

const tenantAgentData = {
  'acme-bank': {
    stats: { actionsToday: 142, leadsScored: 87, outreachDrafted: 34, meetingsBooked: 8, pipelineValue: '₦4.2B', winRate: '32%' },
    pipeline: [
      { id: 'OPP-001', company: 'Dangote Group', deal: 'Trade Finance Expansion', value: '₦2.5B', stage: 'Closing', probability: 89, owner: 'Sarah Okonkwo', daysInStage: 3, nextAction: 'Final terms review', aiScore: 94, signals: ['CEO engaged', 'Budget approved', 'Competitor displaced'] },
      { id: 'OPP-002', company: 'MTN Nigeria', deal: 'Payroll Processing', value: '₦890M', stage: 'Negotiation', probability: 72, owner: 'Ahmed Musa', daysInStage: 7, nextAction: 'Send revised proposal', aiScore: 78, signals: ['CFO requested demo', 'Technical POC passed'] },
      { id: 'OPP-003', company: 'Shoprite', deal: 'POS Fleet Upgrade', value: '₦180M', stage: 'Proposal', probability: 55, owner: 'Sarah Okonkwo', daysInStage: 12, nextAction: 'Follow up on pricing', aiScore: 62, signals: ['Procurement involved', 'Comparing 3 vendors'] },
      { id: 'OPP-004', company: 'Zenith Pharma', deal: 'Corporate Banking Suite', value: '₦340M', stage: 'Discovery', probability: 35, owner: 'Chidi Obi', daysInStage: 5, nextAction: 'Schedule discovery call', aiScore: 48, signals: ['Inbound lead', 'Website visited pricing page'] },
      { id: 'OPP-005', company: 'Total Energies', deal: 'FX & Treasury', value: '₦1.2B', stage: 'Qualification', probability: 25, owner: 'Ahmed Musa', daysInStage: 2, nextAction: 'Research company needs', aiScore: 35, signals: ['Referred by existing client'] },
    ],
    outreach: [
      { id: 'OUT-001', to: 'Ibrahim Suleiman', company: 'Flour Mills', subject: 'Treasury Management Optimization', channel: 'email', status: 'draft', aiConfidence: 92, preview: 'Dear Ibrahim, Following our analysis of Flour Mills\' FX exposure patterns, I\'ve identified 3 opportunities to optimize your treasury operations that could save ₦45M annually...', tone: 'Consultative', personalization: ['Referenced Q3 FX transactions', 'Industry benchmark data', 'Specific savings estimate'] },
      { id: 'OUT-002', to: 'Amina Bakari', company: 'NNPC', subject: 'Re: Trade Finance Discussion', channel: 'email', status: 'ready', aiConfidence: 88, preview: 'Hi Amina, Great catching up at the Energy Summit. As discussed, here\'s a brief overview of how our structured trade finance solutions have helped similar oil & gas companies...', tone: 'Warm follow-up', personalization: ['Referenced event meeting', 'Sector-specific case study', 'Mutual connection mentioned'] },
      { id: 'OUT-003', to: 'David Chen', company: 'Huawei Nigeria', subject: 'Employee Benefits & Payroll', channel: 'linkedin', status: 'scheduled', aiConfidence: 76, preview: 'David — Noticed Huawei Nigeria recently expanded to 2,400 employees. Our payroll solutions integrate seamlessly with global ERP systems like SAP...', tone: 'Insight-led', personalization: ['Company growth signal', 'Tech stack compatibility', 'Competitor gap analysis'] },
    ],
    recentActions: [
      { time: '2 min ago', action: 'Scored lead', detail: 'Flour Mills — Treasury upsell scored 94/100', type: 'score' },
      { time: '15 min ago', action: 'Drafted outreach', detail: 'NNPC — Trade finance follow-up email', type: 'draft' },
      { time: '32 min ago', action: 'Research completed', detail: 'Huawei Nigeria — 12 buying signals identified', type: 'research' },
      { time: '1 hour ago', action: 'Meeting booked', detail: 'Dangote Group — Final terms review (Thu 2pm)', type: 'meeting' },
      { time: '2 hours ago', action: 'Signal detected', detail: 'Shoprite CEO mentioned POS upgrade in interview', type: 'signal' },
      { time: '3 hours ago', action: 'Competitor alert', detail: 'GTBank pitching to MTN Nigeria — counter-strategy generated', type: 'alert' },
    ],
  },
  'aerotel': {
    stats: { actionsToday: 98, leadsScored: 52, outreachDrafted: 21, meetingsBooked: 5, pipelineValue: '$48.2M', winRate: '28%' },
    pipeline: [
      { id: 'OPP-101', company: 'Federal Government', deal: '5G Spectrum License', value: '$22M', stage: 'Closing', probability: 82, owner: 'John Adeyemi', daysInStage: 5, nextAction: 'Regulatory approval pending', aiScore: 88, signals: ['NCC approval in progress', 'Funding secured'] },
      { id: 'OPP-102', company: 'Lagos State', deal: 'Smart City IoT Network', value: '$15M', stage: 'Negotiation', probability: 65, owner: 'Fatima Abubakar', daysInStage: 14, nextAction: 'Present revised SLA terms', aiScore: 72, signals: ['Governor\'s office engaged', 'Pilot successful'] },
    ],
    outreach: [
      { id: 'OUT-101', to: 'Kunle Adeoye', company: 'Access Bank', subject: 'Enterprise Connectivity Solution', channel: 'email', status: 'draft', aiConfidence: 85, preview: 'Dear Kunle, With Access Bank\'s branch expansion to 650 locations, our MPLS solution can provide 99.99% uptime SLA...', tone: 'Technical', personalization: ['Branch count data', 'Uptime requirements', 'Cost comparison'] },
    ],
    recentActions: [
      { time: '5 min ago', action: 'Lead qualified', detail: 'Access Bank — Enterprise connectivity, $2.4M ARR potential', type: 'score' },
      { time: '45 min ago', action: 'Proposal sent', detail: 'Lagos State Smart City — IoT network design document', type: 'draft' },
    ],
  },
}

const stages = ['Qualification', 'Discovery', 'Proposal', 'Negotiation', 'Closing']
const stageColors = { Qualification: 'bg-gray-500', Discovery: 'bg-blue-500', Proposal: 'bg-indigo-500', Negotiation: 'bg-purple-500', Closing: 'bg-emerald-500' }

const SalesAgentDashboard = () => {
  const { data: _apiData, isLoading: _apiLoading, isUsingFallback } = useApiData('salesagentdashboard', () => apiClient.dashboard.metrics(), { fallback: tenantAgentData })
  const { tenant } = useTenant()
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState('pipeline')
  const [agentStatus, setAgentStatus] = useState('active')
  const [selectedDeal, setSelectedDeal] = useState(null)
  const [selectedOutreach, setSelectedOutreach] = useState(null)

  const tenantSlug = tenant?.slug || 'acme-bank'
  const data = tenantAgentData[tenantSlug] || tenantAgentData['acme-bank']
  const tabs = [
    { id: 'pipeline', label: 'Lead Pipeline', icon: Target },
    { id: 'outreach', label: 'AI Outreach', icon: Send },
    { id: 'activity', label: 'Agent Activity', icon: Activity },
  ]

  const actionIcon = (type) => ({ score: Star, draft: Mail, research: Eye, meeting: Users, signal: Zap, alert: AlertTriangle })[type] || Activity
  const actionColor = (type) => ({ score: 'text-amber-500', draft: 'text-blue-500', research: 'text-purple-500', meeting: 'text-emerald-500', signal: 'text-cyan-500', alert: 'text-red-500' })[type] || 'text-gray-500'

  return (
    <div role="region" aria-label="SalesAgentDashboard" className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Brain className="w-7 h-7 text-purple-600" /> Autonomous Sales Agent
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">AI-powered prospect research, outreach drafting, and lead scoring for {tenant?.name || 'platform'}</p>
        </div>
        <div className="flex items-center gap-3">
          <FallbackBadge />
          <button onClick={() => setAgentStatus(s => s === 'active' ? 'paused' : 'active')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${agentStatus === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>
            {agentStatus === 'active' ? <><Play className="w-4 h-4" /> Agent Active</> : <><Pause className="w-4 h-4" /> Agent Paused</>}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { l: 'Actions Today', v: data.stats.actionsToday, icon: Activity, color: 'text-blue-500' },
          { l: 'Leads Scored', v: data.stats.leadsScored, icon: Star, color: 'text-amber-500' },
          { l: 'Outreach Drafted', v: data.stats.outreachDrafted, icon: Mail, color: 'text-purple-500' },
          { l: 'Meetings Booked', v: data.stats.meetingsBooked, icon: Users, color: 'text-emerald-500' },
          { l: 'Pipeline Value', v: data.stats.pipelineValue, icon: TrendingUp, color: 'text-cyan-500' },
          { l: 'Win Rate', v: data.stats.winRate, icon: Target, color: 'text-rose-500' },
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
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`pb-3 text-sm font-medium border-b-2 flex items-center gap-2 ${activeTab === tab.id ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              <tab.icon className="w-4 h-4" /> {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'pipeline' && (
        <div className="space-y-4">
          <div className="flex gap-2 mb-2">
            {stages.map(stage => {
              const count = data.pipeline.filter(d => d.stage === stage).length
              return (
                <div key={stage} className="flex-1 text-center">
                  <div className={`h-1 rounded-full ${stageColors[stage]} mb-1`} />
                  <p className="text-xs text-gray-500">{stage} ({count})</p>
                </div>
              )
            })}
          </div>
          <div className="space-y-2">
            {data.pipeline.map(deal => (
              <div key={deal.id} onClick={() => setSelectedDeal(selectedDeal?.id === deal.id ? null : deal)} className={`bg-white dark:bg-gray-800 rounded-xl border p-4 cursor-pointer transition-all hover:shadow-md ${selectedDeal?.id === deal.id ? 'border-purple-500 ring-1 ring-purple-500' : 'border-gray-200 dark:border-gray-700'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-gray-900 dark:text-white">{deal.company}</h4>
                      <span className={`text-xs px-2 py-0.5 rounded-full text-white ${stageColors[deal.stage]}`}>{deal.stage}</span>
                      <span className="text-xs text-gray-400">{deal.daysInStage}d in stage</span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{deal.deal}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-gray-500 flex items-center gap-1"><Users className="w-3 h-3" />{deal.owner}</span>
                      <span className="text-xs text-gray-500 flex items-center gap-1"><Zap className="w-3 h-3" />{deal.nextAction}</span>
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <p className="font-bold text-gray-900 dark:text-white">{deal.value}</p>
                    <div className="flex items-center gap-2 mt-1 justify-end">
                      <span className="text-xs text-gray-500">{deal.probability}% prob</span>
                      <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30">
                        <Brain className="w-3 h-3 text-purple-600" />
                        <span className="text-xs font-semibold text-purple-600">{deal.aiScore}</span>
                      </div>
                    </div>
                  </div>
                </div>
                {selectedDeal?.id === deal.id && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <h5 className="text-xs font-medium text-gray-500 mb-2">AI-Detected Buying Signals</h5>
                    <div className="flex flex-wrap gap-2">
                      {deal.signals.map(sig => (
                        <span key={sig} className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400">
                          <CheckCircle className="w-3 h-3" /> {sig}
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button className="px-3 py-1.5 bg-purple-600 text-white rounded text-xs hover:bg-purple-700 flex items-center gap-1"><Mail className="w-3 h-3" /> Draft Outreach</button>
                      <button className="px-3 py-1.5 border border-gray-200 dark:border-gray-600 rounded text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-1"><Eye className="w-3 h-3" /> Research</button>
                      <button className="px-3 py-1.5 border border-gray-200 dark:border-gray-600 rounded text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-1"><Users className="w-3 h-3" /> Book Meeting</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'outreach' && (
        <div className="space-y-3">
          {data.outreach.map(o => (
            <div key={o.id} onClick={() => setSelectedOutreach(selectedOutreach?.id === o.id ? null : o)} className={`bg-white dark:bg-gray-800 rounded-xl border p-4 cursor-pointer transition-all hover:shadow-md ${selectedOutreach?.id === o.id ? 'border-purple-500 ring-1 ring-purple-500' : 'border-gray-200 dark:border-gray-700'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-gray-900 dark:text-white">{o.subject}</h4>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${o.status === 'ready' ? 'bg-emerald-100 text-emerald-700' : o.status === 'scheduled' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{o.status}</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">To: {o.to} at {o.company} via {o.channel}</p>
                </div>
                <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-purple-100 dark:bg-purple-900/30">
                  <Sparkles className="w-3 h-3 text-purple-600" />
                  <span className="text-xs font-semibold text-purple-600">{o.aiConfidence}% confidence</span>
                </div>
              </div>
              {selectedOutreach?.id === o.id && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-gray-500">Preview</span>
                      <span className="text-xs text-gray-400">Tone: {o.tone}</span>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300 italic">{o.preview}</p>
                  </div>
                  <div>
                    <h5 className="text-xs font-medium text-gray-500 mb-1.5">Personalization Applied</h5>
                    <div className="flex flex-wrap gap-1.5">
                      {o.personalization.map(p => (
                        <span key={p} className="text-xs px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 flex items-center gap-1"><CheckCircle className="w-3 h-3" />{p}</span>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="px-3 py-1.5 bg-purple-600 text-white rounded text-xs hover:bg-purple-700 flex items-center gap-1"><Send className="w-3 h-3" /> Send Now</button>
                    <button className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 flex items-center gap-1"><Clock className="w-3 h-3" /> Schedule</button>
                    <button className="px-3 py-1.5 border border-gray-200 dark:border-gray-600 rounded text-xs text-gray-700 dark:text-gray-300 flex items-center gap-1"><RefreshCw className="w-3 h-3" /> Regenerate</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {activeTab === 'activity' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2"><Activity className="w-4 h-4 text-purple-500" /> Real-Time Agent Activity</h3>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {data.recentActions.map((action, i) => {
              const Icon = actionIcon(action.type)
              return (
                <div key={i} className="p-4 flex items-start gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <div className={`mt-0.5 ${actionColor(action.type)}`}><Icon className="w-4 h-4" /></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{action.action}</p>
                    <p className="text-sm text-gray-500 mt-0.5">{action.detail}</p>
                  </div>
                  <span className="text-xs text-gray-400 whitespace-nowrap">{action.time}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default SalesAgentDashboard
