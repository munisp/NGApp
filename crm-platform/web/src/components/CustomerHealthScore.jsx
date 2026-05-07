import { useState } from 'react'
import { Heart, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Users, Phone, Mail, MessageSquare, Activity, ArrowUpRight, ArrowDownRight, Clock, Target, Shield, DollarSign, BarChart3 } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { LoadingState, ErrorState, EmptyState, FallbackBadge, ExportButton } from '@/components/ui/DataStates'
import { useTranslation } from '@/lib/i18n/useTranslation'

const tenantHealthData = {
  'acme-bank': {
    summary: { avgScore: 72, atRisk: 142, healthy: 38420, needsAttention: 4680, improved: 892, declined: 234, totalCustomers: 43242 },
    distribution: [
      { range: '90-100', count: 12840, pct: 29.7, color: 'bg-emerald-500' },
      { range: '70-89', count: 25580, pct: 59.2, color: 'bg-blue-500' },
      { range: '50-69', count: 3480, pct: 8.0, color: 'bg-amber-500' },
      { range: '30-49', count: 1200, pct: 2.8, color: 'bg-orange-500' },
      { range: '0-29', count: 142, pct: 0.3, color: 'bg-red-500' },
    ],
    factors: [
      { name: 'Product Usage', weight: 25, avgScore: 78, icon: Activity },
      { name: 'Support Tickets', weight: 20, avgScore: 65, icon: MessageSquare },
      { name: 'Payment Behavior', weight: 20, avgScore: 82, icon: DollarSign },
      { name: 'Engagement Recency', weight: 15, avgScore: 71, icon: Clock },
      { name: 'NPS Response', weight: 10, avgScore: 68, icon: Target },
      { name: 'Feature Adoption', weight: 10, avgScore: 59, icon: BarChart3 },
    ],
    atRiskCustomers: [
      { id: 'CUS-001', name: 'Adamu Trading Co.', score: 18, change: -24, reason: 'No login in 45 days, 3 open tickets', segment: 'SME', value: '₦12.4M' },
      { id: 'CUS-002', name: 'Lagos Fresh Markets', score: 22, change: -18, reason: 'Payment missed, declining usage', segment: 'Commercial', value: '₦8.7M' },
      { id: 'CUS-003', name: 'Kano Textiles Ltd', score: 25, change: -31, reason: 'NPS detractor, escalated complaint', segment: 'Enterprise', value: '₦45.2M' },
      { id: 'CUS-004', name: 'Abuja Motors Group', score: 28, change: -12, reason: 'Downgraded plan, reduced usage', segment: 'Corporate', value: '₦22.1M' },
      { id: 'CUS-005', name: 'Port Harcourt Shipping', score: 31, change: -15, reason: 'Contract renewal due, no engagement', segment: 'Enterprise', value: '₦67.8M' },
      { id: 'CUS-006', name: 'Ibadan AgriTech', score: 33, change: -9, reason: 'Feature adoption dropped 60%', segment: 'SME', value: '₦5.3M' },
    ],
    trends: [
      { month: 'Nov', avgScore: 69, atRisk: 198 },
      { month: 'Dec', avgScore: 70, atRisk: 185 },
      { month: 'Jan', avgScore: 68, atRisk: 210 },
      { month: 'Feb', avgScore: 71, atRisk: 178 },
      { month: 'Mar', avgScore: 72, atRisk: 156 },
      { month: 'Apr', avgScore: 72, atRisk: 142 },
    ],
    alerts: [
      { type: 'critical', message: 'Kano Textiles (₦45.2M) health dropped 31 points — escalated complaint unresolved 7 days', time: '2 hours ago' },
      { type: 'warning', message: '23 Enterprise accounts below score 50 — up from 18 last week', time: '4 hours ago' },
      { type: 'positive', message: '892 accounts improved health score this month (+12% vs last month)', time: '1 day ago' },
      { type: 'warning', message: 'Agent Banking segment average score dropped to 64 (was 71)', time: '1 day ago' },
    ],
  },
  'nextgen-mfb': {
    summary: { avgScore: 65, atRisk: 48, healthy: 8200, needsAttention: 1520, improved: 312, declined: 89, totalCustomers: 9768 },
    distribution: [
      { range: '90-100', count: 2100, pct: 21.5, color: 'bg-emerald-500' },
      { range: '70-89', count: 6100, pct: 62.4, color: 'bg-blue-500' },
      { range: '50-69', count: 1120, pct: 11.5, color: 'bg-amber-500' },
      { range: '30-49', count: 400, pct: 4.1, color: 'bg-orange-500' },
      { range: '0-29', count: 48, pct: 0.5, color: 'bg-red-500' },
    ],
    factors: [
      { name: 'Product Usage', weight: 25, avgScore: 68, icon: Activity },
      { name: 'Support Tickets', weight: 20, avgScore: 60, icon: MessageSquare },
      { name: 'Payment Behavior', weight: 20, avgScore: 72, icon: DollarSign },
      { name: 'Engagement Recency', weight: 15, avgScore: 62, icon: Clock },
      { name: 'NPS Response', weight: 10, avgScore: 58, icon: Target },
      { name: 'Feature Adoption', weight: 10, avgScore: 52, icon: BarChart3 },
    ],
    atRiskCustomers: [
      { id: 'CUS-101', name: 'Micro Savings Coop', score: 15, change: -20, reason: 'Account dormant 60 days', segment: 'Micro', value: '₦1.2M' },
    ],
    trends: [
      { month: 'Nov', avgScore: 62, atRisk: 67 },
      { month: 'Dec', avgScore: 63, atRisk: 61 },
      { month: 'Jan', avgScore: 61, atRisk: 72 },
      { month: 'Feb', avgScore: 64, atRisk: 55 },
      { month: 'Mar', avgScore: 65, atRisk: 50 },
      { month: 'Apr', avgScore: 65, atRisk: 48 },
    ],
    alerts: [
      { type: 'warning', message: '48 micro-finance accounts at risk of churn', time: '3 hours ago' },
    ],
  },
}

const getScoreColor = (score) => {
  if (score >= 80) return 'text-emerald-600 dark:text-emerald-400'
  if (score >= 60) return 'text-blue-600 dark:text-blue-400'
  if (score >= 40) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
}

const getScoreBg = (score) => {
  if (score >= 80) return 'bg-emerald-100 dark:bg-emerald-900/30'
  if (score >= 60) return 'bg-blue-100 dark:bg-blue-900/30'
  if (score >= 40) return 'bg-amber-100 dark:bg-amber-900/30'
  return 'bg-red-100 dark:bg-red-900/30'
}

export default function CustomerHealthScore() {
  const { t } = useTranslation()
  const { tenant } = useTenant()
  const [activeTab, setActiveTab] = useState('overview')
  const data = tenantHealthData[tenant?.slug] || tenantHealthData['acme-bank']

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'atRisk', label: `At Risk (${data.summary.atRisk})` },
    { id: 'factors', label: 'Health Factors' },
    { id: 'alerts', label: 'Alerts' },
  ]

  return (
    <div role="region" aria-label="CustomerHealthScore"  className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Heart className="w-7 h-7 text-red-500" /> Customer Health Scoring
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Real-time composite health scores across {data.summary.totalCustomers.toLocaleString()} accounts</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className={`p-4 rounded-xl ${getScoreBg(data.summary.avgScore)}`}>
          <p className="text-sm text-gray-600 dark:text-gray-400">Average Score</p>
          <p className={`text-3xl font-bold ${getScoreColor(data.summary.avgScore)}`}>{data.summary.avgScore}</p>
          <p className="text-xs text-gray-500 mt-1">out of 100</p>
        </div>
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20">
          <p className="text-sm text-gray-600 dark:text-gray-400">Critical Risk</p>
          <p className="text-3xl font-bold text-red-600 dark:text-red-400">{data.summary.atRisk}</p>
          <p className="text-xs text-gray-500 mt-1">score below 30</p>
        </div>
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20">
          <p className="text-sm text-gray-600 dark:text-gray-400">Improved</p>
          <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">+{data.summary.improved}</p>
          <p className="text-xs text-gray-500 mt-1">this month</p>
        </div>
        <div className="p-4 rounded-xl bg-orange-50 dark:bg-orange-900/20">
          <p className="text-sm text-gray-600 dark:text-gray-400">Declined</p>
          <p className="text-3xl font-bold text-orange-600 dark:text-orange-400">-{data.summary.declined}</p>
          <p className="text-xs text-gray-500 mt-1">this month</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <div className="flex space-x-6">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Distribution */}
          <div tabIndex="0" className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Score Distribution</h3>
            <div className="space-y-3">
              {data.distribution.map(d => (
                <div key={d.range} className="flex items-center gap-3">
                  <span className="text-sm text-gray-600 dark:text-gray-400 w-16">{d.range}</span>
                  <div className="flex-1 h-8 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div className={`h-full ${d.color} rounded-full flex items-center justify-end pr-2`} style={{ width: `${Math.max(d.pct, 3)}%` }}>
                      <span className="text-xs text-white font-medium">{d.count.toLocaleString()}</span>
                    </div>
                  </div>
                  <span className="text-sm text-gray-500 w-12 text-right">{d.pct}%</span>
                </div>
              ))}
            </div>
          </div>
          {/* Trend */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">6-Month Trend</h3>
            <div className="flex items-end gap-4 h-48">
              {data.trends.map(t => (
                <div key={t.month} className="flex-1 flex flex-col items-center">
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{t.avgScore}</span>
                  <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-t" style={{ height: `${(t.avgScore / 100) * 160}px` }}>
                    <div className="w-full bg-blue-500 rounded-t" style={{ height: `${(t.avgScore / 100) * 160}px` }} />
                  </div>
                  <span className="text-xs text-gray-500 mt-2">{t.month}</span>
                  <span className="text-xs text-red-500">{t.atRisk} risk</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'atRisk' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  {['Customer', 'Score', 'Change', 'Segment', 'Value', 'Risk Reason', 'Action'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {data.atRiskCustomers.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 dark:text-white">{c.name}</div>
                      <div className="text-xs text-gray-500">{c.id}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-sm font-bold ${getScoreBg(c.score)} ${getScoreColor(c.score)}`}>
                        {c.score}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center text-red-600 text-sm font-medium">
                        <ArrowDownRight className="w-4 h-4 mr-1" />{c.change}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{c.segment}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{c.value}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 max-w-xs">{c.reason}</td>
                    <td className="px-4 py-3">
                      <button className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700">Intervene</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'factors' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.factors.map(f => (
            <div key={f.name} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 rounded-lg ${getScoreBg(f.avgScore)}`}>
                  <f.icon className={`w-5 h-5 ${getScoreColor(f.avgScore)}`} />
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">{f.name}</h4>
                  <p className="text-xs text-gray-500">Weight: {f.weight}%</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${f.avgScore >= 70 ? 'bg-emerald-500' : f.avgScore >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${f.avgScore}%` }} />
                </div>
                <span className={`text-lg font-bold ${getScoreColor(f.avgScore)}`}>{f.avgScore}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'alerts' && (
        <div className="space-y-3">
          {data.alerts.map((a, i) => (
            <div key={i} className={`p-4 rounded-xl border ${a.type === 'critical' ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' : a.type === 'warning' ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'}`}>
              <div className="flex items-start gap-3">
                {a.type === 'critical' ? <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" /> : a.type === 'warning' ? <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" /> : <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5" />}
                <div className="flex-1">
                  <p className="text-sm text-gray-900 dark:text-white">{a.message}</p>
                  <p className="text-xs text-gray-500 mt-1">{a.time}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
