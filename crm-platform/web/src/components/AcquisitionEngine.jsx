import { useState, useContext, useEffect } from 'react';
import { TenantContext } from '../contexts/TenantContext';
import { UserPlus, Target, TrendingUp, Filter, Search, BarChart3, ArrowRight, Phone, Mail, MessageSquare, Users, Zap, DollarSign, Clock, Star, ChevronDown, ChevronUp, Globe } from 'lucide-react';
import { LoadingState, ErrorState, EmptyState, FallbackBadge, ExportButton } from '@/components/ui/DataStates'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { useApiData } from '@/hooks/useApiData'
import { apiClient } from '@/lib/apiClient'

const LEAD_SOURCES = [
  { id: 'facebook', name: 'Facebook', icon: Globe, color: 'bg-blue-500', leads: 3200, conv: 6.0, cpa: 1250, roas: 12.0 },
  { id: 'instagram', name: 'Instagram', icon: Globe, color: 'bg-pink-500', leads: 2100, conv: 6.0, cpa: 1450, roas: 10.3 },
  { id: 'whatsapp', name: 'WhatsApp', icon: MessageSquare, color: 'bg-green-500', leads: 2800, conv: 7.0, cpa: 850, roas: 16.5 },
  { id: 'agent', name: 'Agent Network', icon: Users, color: 'bg-teal-500', leads: 1800, conv: 9.0, cpa: 2100, roas: 8.6 },
  { id: 'referral', name: 'Referral', icon: Star, color: 'bg-yellow-500', leads: 1500, conv: 12.0, cpa: 500, roas: 24.0 },
  { id: 'ussd', name: 'USSD', icon: Phone, color: 'bg-gray-500', leads: 1050, conv: 6.0, cpa: 350, roas: 25.7 },
];

const FUNNEL_STAGES = [
  { stage: 'Awareness', count: 12450, pct: 100, color: 'bg-blue-400' },
  { stage: 'Interest', count: 8230, pct: 66.1, color: 'bg-cyan-400' },
  { stage: 'Consideration', count: 4120, pct: 50.1, color: 'bg-teal-400' },
  { stage: 'Intent', count: 2060, pct: 50.0, color: 'bg-green-400' },
  { stage: 'Evaluation', count: 1030, pct: 50.0, color: 'bg-emerald-400' },
  { stage: 'Conversion', count: 618, pct: 60.0, color: 'bg-green-600' },
  { stage: 'Retention', count: 556, pct: 89.9, color: 'bg-green-700' },
];

const SAMPLE_LEADS = [
  { id: 'L-001', name: 'Amina Bello', phone: '+234 803 456 7890', source: 'facebook', product: 'Savings Account', score: 92, stage: 'evaluation', last_activity: '2 hours ago', probability: 0.78, ltv: 2450000 },
  { id: 'L-002', name: 'Chinedu Okwu', phone: '+234 706 123 4567', source: 'whatsapp', product: 'Agent Banking', score: 85, stage: 'intent', last_activity: '5 hours ago', probability: 0.65, ltv: 850000 },
  { id: 'L-003', name: 'Fatima Usman', phone: '+234 812 789 0123', source: 'referral', product: 'Micro Loan', score: 88, stage: 'consideration', last_activity: '1 day ago', probability: 0.58, ltv: 1200000 },
  { id: 'L-004', name: 'Oluwaseun Ade', phone: '+234 901 234 5678', source: 'agent', product: 'Savings Account', score: 76, stage: 'interest', last_activity: '2 days ago', probability: 0.42, ltv: 3200000 },
  { id: 'L-005', name: 'Ibrahim Musa', phone: '+234 805 678 9012', source: 'ussd', product: 'Cash-In/Out', score: 71, stage: 'interest', last_activity: '3 days ago', probability: 0.35, ltv: 450000 },
  { id: 'L-006', name: 'Grace Nwosu', phone: '+234 702 345 6789', source: 'instagram', product: 'Personal Loan', score: 94, stage: 'conversion', last_activity: '30 min ago', probability: 0.92, ltv: 5800000 },
  { id: 'L-007', name: 'Yusuf Abdullahi', phone: '+234 810 567 8901', source: 'facebook', product: 'Remittance', score: 68, stage: 'awareness', last_activity: '5 days ago', probability: 0.22, ltv: 1800000 },
  { id: 'L-008', name: 'Blessing Eze', phone: '+234 904 890 1234', source: 'whatsapp', product: 'Fixed Deposit', score: 81, stage: 'intent', last_activity: '1 day ago', probability: 0.55, ltv: 8500000 },
];

const SCORE_COLORS = { high: 'text-green-600 bg-green-50', medium: 'text-yellow-600 bg-yellow-50', low: 'text-red-600 bg-red-50' };
const getScoreColor = (s) => s >= 80 ? SCORE_COLORS.high : s >= 50 ? SCORE_COLORS.medium : SCORE_COLORS.low;

const STAGE_COLORS = {
  awareness: 'bg-blue-100 text-blue-700', interest: 'bg-cyan-100 text-cyan-700',
  consideration: 'bg-teal-100 text-teal-700', intent: 'bg-green-100 text-green-700',
  evaluation: 'bg-emerald-100 text-emerald-700', conversion: 'bg-green-200 text-green-800',
  retention: 'bg-green-300 text-green-900',
};

export default function AcquisitionEngine() {
  const { data: _apiData, isLoading: _apiLoading, isUsingFallback } = useApiData('acquisitionengine', () => apiClient.dashboard.metrics(), { fallback: LEAD_SOURCES })
  const { t } = useTranslation()
  const { tenantId } = useContext(TenantContext);
  const [activeTab, setActiveTab] = useState('funnel');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLead, setSelectedLead] = useState(null);
  const [stageFilter, setStageFilter] = useState('all');

  const filteredLeads = SAMPLE_LEADS.filter(l => {
    const matchesSearch = l.name.toLowerCase().includes(searchQuery.toLowerCase()) || l.product.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStage = stageFilter === 'all' || l.stage === stageFilter;
    return matchesSearch && matchesStage;
  });

  const totalLeads = 12450;
  const totalConversions = 618;
  const overallConvRate = (totalConversions / totalLeads * 100).toFixed(1);
  const avgCPA = 1200;
  const totalRevenue = 196550000;
  const roi = 342.5;

  const tabs = [
    { id: 'funnel', label: 'Acquisition Funnel', icon: Target },
    { id: 'leads', label: 'Lead Pipeline', icon: Users },
    { id: 'sources', label: 'Source Performance', icon: BarChart3 },
    { id: 'scoring', label: 'Lead Scoring', icon: Zap },
  ];

  return (
    <div role="region" aria-label="AcquisitionEngine"  className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <UserPlus className="w-7 h-7 text-green-600" /> Customer Acquisition Engine
          </h1>
          <p className="text-gray-500 mt-1">Lead scoring, funnel management, and conversion optimization</p>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-5 gap-4">
        {[
          { label: 'Total Leads', value: totalLeads.toLocaleString(), icon: Users, color: 'text-blue-600' },
          { label: 'Conversions', value: totalConversions.toLocaleString(), icon: Target, color: 'text-green-600' },
          { label: 'Conv. Rate', value: `${overallConvRate}%`, icon: TrendingUp, color: 'text-teal-600' },
          { label: 'Avg CPA', value: `₦${avgCPA.toLocaleString()}`, icon: DollarSign, color: 'text-orange-600' },
          { label: 'ROI', value: `${roi}%`, icon: Zap, color: 'text-indigo-600' },
        ].map((kpi, i) => (
          <div key={i} tabIndex="0" className="bg-white dark:bg-gray-800 rounded-xl border p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500">{kpi.label}</span>
              <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
            </div>
            <div className="text-2xl font-bold text-gray-900">{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === tab.id ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'funnel' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border p-6">
          <h2 className="text-lg font-bold mb-6">Acquisition Funnel — May 2025</h2>
          <div className="space-y-3">
            {FUNNEL_STAGES.map((s, i) => {
              const nextStage = FUNNEL_STAGES[i + 1];
              const dropoff = nextStage ? ((s.count - nextStage.count) / s.count * 100).toFixed(1) : null;
              return (
                <div key={s.stage}>
                  <div className="flex items-center gap-4">
                    <div className="w-28 text-sm font-medium text-gray-700">{s.stage}</div>
                    <div className="flex-1 relative">
                      <div className="h-10 bg-gray-100 rounded-lg overflow-hidden">
                        <div className={`h-full ${s.color} rounded-lg flex items-center justify-end pr-3 transition-all`} style={{ width: `${(s.count / 12450) * 100}%` }}>
                          <span className="text-white text-sm font-bold">{s.count.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                    <div className="w-16 text-right text-sm text-gray-500">{i > 0 ? `${s.pct}%` : ''}</div>
                  </div>
                  {dropoff && (
                    <div className="flex items-center gap-4 py-1">
                      <div className="w-28" />
                      <div className="flex-1 flex items-center gap-2 text-xs text-red-500 pl-4">
                        <ArrowRight className="w-3 h-3" /> {dropoff}% drop-off ({(s.count - nextStage.count).toLocaleString()} lost)
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'leads' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border">
          <div className="p-4 border-b flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search leads..." className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm" />
            </div>
            <select value={stageFilter} onChange={e => setStageFilter(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
              <option value="all">All Stages</option>
              {['awareness','interest','consideration','intent','evaluation','conversion'].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
          </div>
          <div className="divide-y">
            {filteredLeads.map(lead => (
              <div key={lead.id} onClick={() => setSelectedLead(selectedLead?.id === lead.id ? null : lead)} className="p-4 hover:bg-gray-50 cursor-pointer">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                      {lead.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{lead.name}</div>
                      <div className="text-xs text-gray-500">{lead.phone} · {lead.product}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${STAGE_COLORS[lead.stage]}`}>{lead.stage}</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${getScoreColor(lead.score)}`}>{lead.score}</span>
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-900">{(lead.probability * 100).toFixed(0)}% likely</div>
                      <div className="text-xs text-gray-500">{lead.last_activity}</div>
                    </div>
                  </div>
                </div>
                {selectedLead?.id === lead.id && (
                  <div className="mt-3 pt-3 border-t grid grid-cols-4 gap-4">
                    <div><div className="text-xs text-gray-500">Source</div><div className="text-sm font-medium capitalize">{lead.source}</div></div>
                    <div><div className="text-xs text-gray-500">Est. LTV</div><div className="text-sm font-medium">₦{(lead.ltv / 1000000).toFixed(1)}M</div></div>
                    <div><div className="text-xs text-gray-500">Score</div><div className="text-sm font-medium">{lead.score}/100</div></div>
                    <div><div className="text-xs text-gray-500">Conv. Probability</div><div className="text-sm font-medium">{(lead.probability * 100).toFixed(0)}%</div></div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'sources' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border p-6">
          <h2 className="text-lg font-bold mb-4">Acquisition Source Performance</h2>
          <div className="space-y-4">
            {LEAD_SOURCES.map(src => {
              const SrcIcon = src.icon;
              return (
                <div key={src.id} className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50">
                  <div className={`w-10 h-10 ${src.color} rounded-lg flex items-center justify-center`}>
                    <SrcIcon className="w-5 h-5 text-white" />
                  </div>
                  <div className="w-32 font-medium text-gray-900">{src.name}</div>
                  <div className="flex-1 grid grid-cols-4 gap-4 text-sm">
                    <div><div className="text-xs text-gray-500">Leads</div><div className="font-bold">{src.leads.toLocaleString()}</div></div>
                    <div><div className="text-xs text-gray-500">Conv. Rate</div><div className="font-bold text-green-600">{src.conv}%</div></div>
                    <div><div className="text-xs text-gray-500">CPA</div><div className="font-bold">₦{src.cpa.toLocaleString()}</div></div>
                    <div><div className="text-xs text-gray-500">ROAS</div><div className="font-bold text-indigo-600">{src.roas}x</div></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'scoring' && (
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl border p-5">
            <h3 className="font-semibold mb-4">Lead Scoring Model</h3>
            <div className="space-y-3">
              {[
                { factor: 'Behavioral Signals', weight: 30, desc: 'Product views, app usage, form completions' },
                { factor: 'Demographic Fit', weight: 25, desc: 'Income bracket, location, KYC status, BVN/NIN' },
                { factor: 'Engagement Level', weight: 20, desc: 'Response rate, channel interactions, time on site' },
                { factor: 'Product Fit', weight: 15, desc: 'Product interest vs. eligibility match' },
                { factor: 'Recency', weight: 10, desc: 'Time since last activity or interaction' },
              ].map((f, i) => (
                <div key={i} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium">{f.factor}</span>
                    <span className="text-sm font-bold text-indigo-600">{f.weight}%</span>
                  </div>
                  <p className="text-xs text-gray-500">{f.desc}</p>
                  <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
                    <div className="bg-indigo-600 h-1.5 rounded-full" style={{ width: `${f.weight * 3.33}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border p-5">
            <h3 className="font-semibold mb-4">Score Distribution</h3>
            <div className="space-y-3">
              {[
                { range: '90-100 (Hot)', count: 1245, pct: 10, color: 'bg-red-500' },
                { range: '70-89 (Warm)', count: 3735, pct: 30, color: 'bg-orange-500' },
                { range: '50-69 (Nurture)', count: 4980, pct: 40, color: 'bg-yellow-500' },
                { range: '30-49 (Cold)', count: 1867, pct: 15, color: 'bg-blue-400' },
                { range: '0-29 (Dormant)', count: 623, pct: 5, color: 'bg-gray-400' },
              ].map((d, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-36 text-sm text-gray-700">{d.range}</div>
                  <div className="flex-1">
                    <div className="w-full bg-gray-100 rounded-full h-6 overflow-hidden">
                      <div className={`${d.color} h-full rounded-full flex items-center pl-2`} style={{ width: `${d.pct}%` }}>
                        <span className="text-xs text-white font-bold">{d.count.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="w-10 text-sm text-gray-500 text-right">{d.pct}%</div>
                </div>
              ))}
            </div>
            <div className="mt-6 p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="text-sm font-medium text-green-800">Conversion Prediction</div>
              <div className="text-xs text-green-600 mt-1">Based on current pipeline: <strong>618 conversions</strong> expected this month (4.96% overall rate)</div>
              <div className="text-xs text-green-600 mt-1">Estimated revenue: <strong>₦196.6M</strong> | ROI: <strong>342.5%</strong></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
