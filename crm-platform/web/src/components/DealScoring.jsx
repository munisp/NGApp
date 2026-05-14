import { useState } from 'react'
import { useApiData } from '@/hooks/useApiData'
import { Target, TrendingUp, TrendingDown, DollarSign, Clock, Users, BarChart3, ArrowRight, AlertTriangle, CheckCircle, Eye, Mail, Calendar, Phone, Search } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { LoadingState, ErrorState, EmptyState, FallbackBadge, ExportButton } from '@/components/ui/DataStates'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { apiClient } from '@/lib/apiClient'

const tenantData = {
  'acme-bank': {
    pipeline: { totalDeals: 186, totalValue: '₦4.8B', avgWinProb: 62, avgCycle: '34 days', forecast: '₦2.98B' },
    stages: [
      { name: 'Prospecting', count: 42, value: '₦680M', avgScore: 28 },
      { name: 'Qualification', count: 38, value: '₦920M', avgScore: 45 },
      { name: 'Proposal', count: 31, value: '₦1.2B', avgScore: 68 },
      { name: 'Negotiation', count: 24, value: '₦1.1B', avgScore: 78 },
      { name: 'Closing', count: 18, value: '₦560M', avgScore: 89 },
      { name: 'Won', count: 33, value: '₦340M', avgScore: 100 },
    ],
    deals: [
      { id: 'D-001', name: 'Dangote Group — Trade Finance Facility', value: '₦2.5B', score: 92, stage: 'Closing', owner: 'Sarah Okonkwo', signals: { emails: 34, meetings: 8, docViews: 12 }, daysInStage: 5, stakeholders: 6, nextAction: 'Final signature meeting scheduled', risk: 'none' },
      { id: 'D-002', name: 'MTN Nigeria — Payroll Processing', value: '₦890M', score: 78, stage: 'Negotiation', owner: 'Ahmed Musa', signals: { emails: 22, meetings: 5, docViews: 8 }, daysInStage: 12, stakeholders: 4, nextAction: 'Pricing revision due Friday', risk: 'competitor' },
      { id: 'D-003', name: 'Flour Mills — Supply Chain Finance', value: '₦450M', score: 65, stage: 'Proposal', owner: 'David Chen', signals: { emails: 15, meetings: 3, docViews: 4 }, daysInStage: 18, stakeholders: 3, nextAction: 'Technical demo next week', risk: 'slow' },
      { id: 'D-004', name: 'Nigerian Breweries — Treasury Mgmt', value: '₦320M', score: 45, stage: 'Qualification', owner: 'Fatima Ali', signals: { emails: 8, meetings: 2, docViews: 1 }, daysInStage: 25, stakeholders: 2, nextAction: 'Decision maker meeting pending', risk: 'stalled' },
      { id: 'D-005', name: 'Shoprite Nigeria — POS Fleet', value: '₦180M', score: 82, stage: 'Negotiation', owner: 'Sarah Okonkwo', signals: { emails: 28, meetings: 6, docViews: 10 }, daysInStage: 8, stakeholders: 5, nextAction: 'Contract review in progress', risk: 'none' },
      { id: 'D-006', name: 'Zenith Insurance — Digital Onboarding', value: '₦95M', score: 34, stage: 'Prospecting', owner: 'Ahmed Musa', signals: { emails: 3, meetings: 1, docViews: 0 }, daysInStage: 30, stakeholders: 1, nextAction: 'No response to last 2 emails', risk: 'dead' },
    ],
    aiInsights: [
      { type: 'alert', text: 'Deal "Nigerian Breweries — Treasury" stalled 25 days in Qualification. Similar deals that stalled 20+ days had 15% win rate.', action: 'Schedule executive sponsor call' },
      { type: 'opportunity', text: 'Dangote Group engagement signals are 3x higher than average Closing-stage deals. Very likely to close this week.', action: 'Prepare onboarding package' },
      { type: 'risk', text: 'MTN deal: competitor mention in last meeting transcript. Access Bank offering 0.5% lower rate.', action: 'Escalate to Head of Commercial' },
      { type: 'coaching', text: 'Fatima Ali has 2 deals stalled in early stages. Recommend pipeline review with team lead.', action: 'Schedule coaching session' },
    ],
  },
  'nextgen-mfb': {
    pipeline: { totalDeals: 24, totalValue: '₦45M', avgWinProb: 55, avgCycle: '12 days', forecast: '₦24.8M' },
    stages: [
      { name: 'Prospecting', count: 8, value: '₦12M', avgScore: 30 },
      { name: 'Qualification', count: 6, value: '₦10M', avgScore: 48 },
      { name: 'Proposal', count: 4, value: '₦8M', avgScore: 65 },
      { name: 'Negotiation', count: 3, value: '₦7M', avgScore: 75 },
      { name: 'Closing', count: 2, value: '₦5M', avgScore: 88 },
      { name: 'Won', count: 1, value: '₦3M', avgScore: 100 },
    ],
    deals: [
      { id: 'D-101', name: 'Lagos Market Women Coop — Group Savings', value: '₦15M', score: 72, stage: 'Proposal', owner: 'Binta Hassan', signals: { emails: 5, meetings: 2, docViews: 3 }, daysInStage: 7, stakeholders: 2, nextAction: 'Site visit scheduled', risk: 'none' },
    ],
    aiInsights: [
      { type: 'opportunity', text: 'Group savings products convert at 78% for cooperatives. Prioritize this segment.', action: 'Run targeted outreach' },
    ],
  },
}

const riskBadge = { none: null, competitor: { label: 'Competitor', color: 'bg-orange-100 text-orange-700' }, slow: { label: 'Slow Moving', color: 'bg-amber-100 text-amber-700' }, stalled: { label: 'Stalled', color: 'bg-red-100 text-red-700' }, dead: { label: 'At Risk', color: 'bg-red-100 text-red-700' } }

export default function DealScoring() {
  const { data: _apiData, isLoading: _apiLoading, isUsingFallback } = useApiData('dealscoring', () => apiClient.dashboard.metrics(), { fallback: tenantData })
  const { t } = useTranslation()
  const { tenant } = useTenant()
  const [activeTab, setActiveTab] = useState('pipeline')
  const [search, setSearch] = useState('')
  const [riskFilter, setRiskFilter] = useState('all')
  const [selectedDeal, setSelectedDeal] = useState(null)
  const data = tenantData[tenant?.slug] || tenantData['acme-bank']
  const filteredDeals = data.deals.filter(d => {
    const matchSearch = !search || d.name.toLowerCase().includes(search.toLowerCase()) || d.owner.toLowerCase().includes(search.toLowerCase())
    const matchRisk = riskFilter === 'all' || d.risk === riskFilter
    return matchSearch && matchRisk
  })

  return (
    <div role="region" aria-label="DealScoring"  className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Target className="w-7 h-7 text-purple-600" /> AI Deal Scoring & Pipeline Intelligence
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">{data.pipeline.totalDeals} active deals worth {data.pipeline.totalValue}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Pipeline Value', value: data.pipeline.totalValue },
          { label: 'Avg Win Probability', value: `${data.pipeline.avgWinProb}%` },
          { label: 'Avg Cycle', value: data.pipeline.avgCycle },
          { label: 'Weighted Forecast', value: data.pipeline.forecast },
          { label: 'Active Deals', value: data.pipeline.totalDeals },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Pipeline Funnel */}
      <div tabIndex="0" className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Pipeline Stages</h3>
        <div className="flex items-end gap-2">
          {data.stages.map((s, i) => (
            <div key={s.name} className="flex-1 text-center">
              <p className="text-xs text-gray-500 mb-1">{s.count} deals</p>
              <div className="mx-auto bg-gray-100 dark:bg-gray-700 rounded-t" style={{ height: '120px', position: 'relative' }}>
                <div className={`absolute bottom-0 w-full rounded-t ${s.avgScore >= 80 ? 'bg-emerald-500' : s.avgScore >= 50 ? 'bg-blue-500' : 'bg-amber-500'}`}
                  style={{ height: `${(s.avgScore / 100) * 120}px` }} />
              </div>
              <p className="text-xs font-medium text-gray-900 dark:text-white mt-2">{s.name}</p>
              <p className="text-xs text-gray-500">{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="border-b border-gray-200 dark:border-gray-700">
        <div className="flex space-x-6">
          {['pipeline', 'insights'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`pb-3 text-sm font-medium capitalize border-b-2 ${activeTab === tab ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500'}`}>
              {tab === 'insights' ? 'AI Insights' : 'Deal Pipeline'}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'pipeline' && (<>
        <div className="flex gap-2"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search deals or owners..." className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white" /></div><select value={riskFilter} onChange={e => setRiskFilter(e.target.value)} className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-sm"><option value="all">All Risks</option><option value="none">No Risk</option><option value="competitor">Competitor</option><option value="slow">Slow</option><option value="stalled">Stalled</option><option value="dead">Dead</option></select></div>
        <div className="space-y-3">
          {filteredDeals.map(deal => (
            <div key={deal.id} onClick={() => setSelectedDeal(selectedDeal === deal.id ? null : deal.id)} className={`bg-white dark:bg-gray-800 rounded-xl border p-4 cursor-pointer hover:shadow-md ${selectedDeal === deal.id ? 'border-purple-500 ring-1 ring-purple-500' : 'border-gray-200 dark:border-gray-700'}`}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">{deal.name}</h4>
                  <p className="text-xs text-gray-500">{deal.owner} · {deal.stage} · {deal.daysInStage} days</p>
                </div>
                <div className="flex items-center gap-3">
                  {riskBadge[deal.risk] && <span className={`text-xs px-2 py-0.5 rounded-full ${riskBadge[deal.risk].color}`}>{riskBadge[deal.risk].label}</span>}
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold ${deal.score >= 70 ? 'bg-emerald-100 text-emerald-700' : deal.score >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                    {deal.score}%
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />{deal.value}</span>
                <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{deal.signals.emails} emails</span>
                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{deal.signals.meetings} meetings</span>
                <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{deal.signals.docViews} doc views</span>
                <span className="flex items-center gap-1"><Users className="w-3 h-3" />{deal.stakeholders} stakeholders</span>
              </div>
              <p className="text-xs text-blue-600 mt-2 flex items-center gap-1"><ArrowRight className="w-3 h-3" />Next: {deal.nextAction}</p>
            </div>
          ))}
        </div>
      </>)}

      {activeTab === 'insights' && (
        <div className="space-y-3">
          {data.aiInsights.map((insight, i) => (
            <div key={i} className={`p-4 rounded-xl border ${insight.type === 'risk' ? 'bg-red-50 dark:bg-red-900/20 border-red-200' : insight.type === 'alert' ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200' : insight.type === 'coaching' ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-200' : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200'}`}>
              <p className="text-sm text-gray-900 dark:text-white">{insight.text}</p>
              <p className="text-xs text-blue-600 mt-2 font-medium">Recommended: {insight.action}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
