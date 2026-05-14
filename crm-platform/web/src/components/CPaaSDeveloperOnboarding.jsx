import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Users, Code2, Key, CheckCircle, Clock, AlertTriangle, TrendingUp,
  ArrowUpRight, Play, FileText, Globe, Zap
, Search } from 'lucide-react'
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { useTenant } from '../contexts/TenantContext'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { useApiData } from '@/hooks/useApiData'
import { apiClient } from '@/lib/apiClient'

const seedData = {
  'messageflow': {
    totalDevelopers: 2847,
    activeDevelopers: 1923,
    newThisMonth: 184,
    avgTimeToFirstCall: '4.2 hrs',
    trialConversion: 34.2,
    avgRevPerDev: '$842',
    pendingApprovals: 23,
    sandboxApps: 1420,
    stages: [
      { stage: 'Signed Up', count: 2847, conversion: 100 },
      { stage: 'Email Verified', count: 2680, conversion: 94.1 },
      { stage: 'API Key Created', count: 2340, conversion: 82.2 },
      { stage: 'First API Call', count: 1923, conversion: 67.5 },
      { stage: 'Production App', count: 847, conversion: 29.8 },
      { stage: 'Paying Customer', count: 612, conversion: 21.5 },
    ],
    recentSignups: [
      { name: 'TechVentures NG', email: 'dev@techventures.ng', plan: 'Growth', status: 'active', channels: ['SMS', 'WhatsApp'], joined: '2h ago' },
      { name: 'FinServe API', email: 'api@finserve.com', plan: 'Enterprise', status: 'active', channels: ['Voice', 'SMS', 'Video'], joined: '5h ago' },
      { name: 'HealthConnect', email: 'dev@healthconnect.ng', plan: 'Starter', status: 'pending', channels: ['SMS'], joined: '8h ago' },
      { name: 'EduBridge', email: 'tech@edubridge.com', plan: 'Growth', status: 'active', channels: ['SMS', 'WhatsApp'], joined: '1d ago' },
      { name: 'LogiPro', email: 'dev@logipro.ng', plan: 'Starter', status: 'trial', channels: ['SMS'], joined: '1d ago' },
    ],
    weeklySignups: [
      { week: 'W1', signups: 38, activated: 26, converted: 8 },
      { week: 'W2', signups: 42, activated: 31, converted: 12 },
      { week: 'W3', signups: 51, activated: 35, converted: 11 },
      { week: 'W4', signups: 53, activated: 38, converted: 14 },
    ],
  },
  'connecthub': {
    totalDevelopers: 842,
    activeDevelopers: 567,
    newThisMonth: 48,
    avgTimeToFirstCall: '6.8 hrs',
    trialConversion: 28.4,
    avgRevPerDev: '$520',
    pendingApprovals: 8,
    sandboxApps: 380,
    stages: [
      { stage: 'Signed Up', count: 842, conversion: 100 },
      { stage: 'Email Verified', count: 795, conversion: 94.4 },
      { stage: 'API Key Created', count: 680, conversion: 80.8 },
      { stage: 'First API Call', count: 567, conversion: 67.3 },
      { stage: 'Production App', count: 234, conversion: 27.8 },
      { stage: 'Paying Customer', count: 156, conversion: 18.5 },
    ],
    recentSignups: [
      { name: 'MediAlert', email: 'dev@medialert.ng', plan: 'Growth', status: 'active', channels: ['SMS', 'Voice'], joined: '4h ago' },
      { name: 'ShopEasy', email: 'tech@shopeasy.com', plan: 'Starter', status: 'trial', channels: ['SMS'], joined: '12h ago' },
      { name: 'TransitGo', email: 'api@transitgo.ng', plan: 'Starter', status: 'pending', channels: ['SMS'], joined: '1d ago' },
    ],
    weeklySignups: [
      { week: 'W1', signups: 10, activated: 7, converted: 2 },
      { week: 'W2', signups: 12, activated: 9, converted: 3 },
      { week: 'W3', signups: 14, activated: 10, converted: 4 },
      { week: 'W4', signups: 12, activated: 8, converted: 3 },
    ],
  },
}

const CPaaSDeveloperOnboarding = () => {
  const { data: _apiData, isLoading: _apiLoading, isUsingFallback } = useApiData('cpaasdeveloperonboarding', () => apiClient.dashboard.metrics(), { fallback: seedData })
  const { tenant } = useTenant()
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState('funnel')
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState('all')
  const [selectedDev, setSelectedDev] = useState(null)
  const data = seedData[tenant?.slug] || seedData['messageflow']
  const filteredDevs = data.developers ? data.developers.filter(d => {
    const matchSearch = !search || (d.name && d.name.toLowerCase().includes(search.toLowerCase())) || (d.email && d.email.toLowerCase().includes(search.toLowerCase()))
    const matchStage = stageFilter === 'all' || (d.stage && d.stage.toLowerCase() === stageFilter)
    return matchSearch && matchStage
  }) : []

  return (
    <div role="region" aria-label="CPaaSDeveloperOnboarding" className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {t('nav.cpaasDeveloperOnboarding', 'Developer Onboarding')}
          </h1>
          <p className="text-gray-500 dark:text-gray-400">API consumer acquisition, activation & conversion</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Developers', value: data.totalDevelopers.toLocaleString(), icon: Users, color: 'blue', sub: `${data.newThisMonth} new this month` },
          { label: 'Active Developers', value: data.activeDevelopers.toLocaleString(), icon: Code2, color: 'green', sub: `${((data.activeDevelopers / data.totalDevelopers) * 100).toFixed(1)}% activation rate` },
          { label: 'Time to First Call', value: data.avgTimeToFirstCall, icon: Clock, color: 'yellow', sub: 'Avg from signup to API call' },
          { label: 'Trial → Paid', value: `${data.trialConversion}%`, icon: TrendingUp, color: 'purple', sub: `Avg $${data.avgRevPerDev}/dev/mo` },
        ].map((kpi, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <kpi.icon className={`w-5 h-5 text-${kpi.color}-500`} />
              <span className="text-sm text-gray-500 dark:text-gray-400">{kpi.label}</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{kpi.value}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{kpi.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg w-fit">
        {['funnel', 'signups', 'weekly'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm rounded-md capitalize transition-colors ${
              activeTab === tab ? 'bg-white dark:bg-gray-700 shadow-sm font-medium text-gray-900 dark:text-gray-100'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}>
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'funnel' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Developer Activation Funnel</h3>
          <div className="space-y-3">
            {data.stages.map((stage, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="w-40 text-sm text-gray-600 dark:text-gray-300 shrink-0">{stage.stage}</div>
                <div className="flex-1 h-8 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${stage.conversion}%` }} transition={{ delay: i * 0.1, duration: 0.5 }}
                    className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-end pr-3">
                    <span className="text-xs font-medium text-white">{stage.count.toLocaleString()}</span>
                  </motion.div>
                </div>
                <div className="w-16 text-sm text-gray-500 dark:text-gray-400 text-right">{stage.conversion}%</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'signups' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  {['Developer', 'Email', 'Plan', 'Channels', 'Status', 'Joined'].map(h => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {data.recentSignups.map((dev, i) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">{dev.name}</td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{dev.email}</td>
                    <td className="px-6 py-4"><span className="px-2 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-full text-xs">{dev.plan}</span></td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{dev.channels.join(', ')}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        dev.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : dev.status === 'trial' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>
                        {dev.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500 dark:text-gray-400 text-sm">{dev.joined}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'weekly' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Weekly Developer Metrics</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.weeklySignups}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="week" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="signups" fill="#3b82f6" name="Signups" />
              <Bar dataKey="activated" fill="#10b981" name="Activated" />
              <Bar dataKey="converted" fill="#8b5cf6" name="Converted" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

export default CPaaSDeveloperOnboarding
