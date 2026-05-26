import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Users, Phone, Wifi, Signal, TrendingUp, ArrowUpRight, ArrowDownRight,
  Smartphone, Activity, AlertTriangle, CheckCircle, Search, Filter
} from 'lucide-react'
import { AreaChart, Area, BarChart, Bar, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell } from 'recharts'
import { useTenant } from '../contexts/TenantContext'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { useApiData } from '@/hooks/useApiData'
import { apiClient } from '@/lib/apiClient'
import { ErrorState } from '@/components/ui/DataStates'

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899']

const seedData = {
  'aerotel': {
    totalSubscribers: 18400000,
    activeSubscribers: 15200000,
    prepaid: 12800000,
    postpaid: 2400000,
    mobileData: 14100000,
    churnRate: 2.8,
    arpu: '$8.40',
    monthlyRevenue: '$127.7M',
    newActivations: 284000,
    simSwaps: 12400,
    portIns: 8200,
    portOuts: 4100,
    plans: [
      { name: 'Flexi Prepaid', subscribers: 8200000, revenue: 42000000, arpu: 5.12, color: '#3b82f6' },
      { name: 'Data Unlimited', subscribers: 4600000, revenue: 38000000, arpu: 8.26, color: '#10b981' },
      { name: 'Postpaid Premium', subscribers: 2400000, revenue: 36000000, arpu: 15.0, color: '#8b5cf6' },
      { name: 'Youth Bundle', subscribers: 2100000, revenue: 8400000, arpu: 4.0, color: '#f59e0b' },
      { name: 'Enterprise', subscribers: 1100000, revenue: 22000000, arpu: 20.0, color: '#ef4444' },
    ],
    usageTrends: [
      { month: 'Jan', data_gb: 4200000, voice_min: 890000000, sms: 420000000 },
      { month: 'Feb', data_gb: 4500000, voice_min: 870000000, sms: 400000000 },
      { month: 'Mar', data_gb: 4900000, voice_min: 850000000, sms: 385000000 },
      { month: 'Apr', data_gb: 5400000, voice_min: 830000000, sms: 370000000 },
      { month: 'May', data_gb: 5800000, voice_min: 810000000, sms: 355000000 },
      { month: 'Jun', data_gb: 6200000, voice_min: 790000000, sms: 340000000 },
    ],
    topSubscribers: [
      { name: 'Dangote Industries', plan: 'Enterprise', lines: 4200, monthlySpend: '$84,000', status: 'active' },
      { name: 'GTBank', plan: 'Enterprise', lines: 3800, monthlySpend: '$76,000', status: 'active' },
      { name: 'MTN Tower Co', plan: 'Enterprise', lines: 2100, monthlySpend: '$42,000', status: 'active' },
      { name: 'Access Bank', plan: 'Enterprise', lines: 1900, monthlySpend: '$38,000', status: 'active' },
      { name: 'Shell NG', plan: 'Enterprise', lines: 1500, monthlySpend: '$30,000', status: 'at_risk' },
    ],
    networkHealth: { coverage4G: 82.4, coverage5G: 18.2, avgDownload: 42.8, avgUpload: 12.4, latency: 28 },
  },
  'netwave': {
    totalSubscribers: 4200000,
    activeSubscribers: 3400000,
    prepaid: 2800000,
    postpaid: 600000,
    mobileData: 3100000,
    churnRate: 3.4,
    arpu: '$6.20',
    monthlyRevenue: '$21.1M',
    newActivations: 68000,
    simSwaps: 3200,
    portIns: 2100,
    portOuts: 1800,
    plans: [
      { name: 'Basic Prepaid', subscribers: 1800000, revenue: 7200000, arpu: 4.0, color: '#3b82f6' },
      { name: 'Data Plus', subscribers: 1000000, revenue: 6500000, arpu: 6.5, color: '#10b981' },
      { name: 'Business Line', subscribers: 600000, revenue: 5400000, arpu: 9.0, color: '#8b5cf6' },
      { name: 'Student Plan', subscribers: 800000, revenue: 2400000, arpu: 3.0, color: '#f59e0b' },
    ],
    usageTrends: [
      { month: 'Jan', data_gb: 820000, voice_min: 180000000, sms: 92000000 },
      { month: 'Feb', data_gb: 880000, voice_min: 175000000, sms: 88000000 },
      { month: 'Mar', data_gb: 950000, voice_min: 170000000, sms: 84000000 },
      { month: 'Apr', data_gb: 1020000, voice_min: 165000000, sms: 80000000 },
      { month: 'May', data_gb: 1100000, voice_min: 160000000, sms: 76000000 },
      { month: 'Jun', data_gb: 1180000, voice_min: 155000000, sms: 72000000 },
    ],
    topSubscribers: [
      { name: 'Flour Mills NG', plan: 'Business Line', lines: 820, monthlySpend: '$7,380', status: 'active' },
      { name: 'Oando Energy', plan: 'Business Line', lines: 640, monthlySpend: '$5,760', status: 'active' },
      { name: 'Zenith Bank', plan: 'Business Line', lines: 480, monthlySpend: '$4,320', status: 'at_risk' },
    ],
    networkHealth: { coverage4G: 64.2, coverage5G: 4.8, avgDownload: 28.4, avgUpload: 8.2, latency: 38 },
  },
}

const formatNum = (n) => {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`
  return n.toLocaleString()
}

const TelcoSubscriberManagement = () => {
  const { data: _apiData, isLoading: _apiLoading, isUsingFallback } = useApiData('telcosubscribermanagement', () => apiClient.dashboard.metrics(), { fallback: COLORS })
  const { tenant } = useTenant()
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState('overview')
  const [search, setSearch] = useState('')
  const [planFilter, setPlanFilter] = useState('all')
  const [selectedSub, setSelectedSub] = useState(null)
  const [error, setError] = useState(null)
  const data = seedData[tenant?.slug] || seedData['aerotel']
  const filteredSubs = data.subscribers ? data.subscribers.filter(s => {
    const matchSearch = !search || (s.name && s.name.toLowerCase().includes(search.toLowerCase())) || (s.msisdn && s.msisdn.includes(search))
    const matchPlan = planFilter === 'all' || (s.plan && s.plan.toLowerCase() === planFilter)
    return matchSearch && matchPlan
  }) : []

  if (error) return <ErrorState message={error} />

  return (
    <div role="region" aria-label="TelcoSubscriberManagement" className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {t('nav.telcoSubscribers', 'Subscriber Management')}
          </h1>
          <p className="text-gray-500 dark:text-gray-400">Subscriber lifecycle, plans & usage analytics</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="px-2 py-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full">
            {formatNum(data.activeSubscribers)} active
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {[
          { label: 'Total Subscribers', value: formatNum(data.totalSubscribers), icon: Users, color: 'blue' },
          { label: 'Monthly Revenue', value: data.monthlyRevenue, icon: TrendingUp, color: 'green' },
          { label: 'ARPU', value: data.arpu, icon: Activity, color: 'purple' },
          { label: 'Churn Rate', value: `${data.churnRate}%`, icon: AlertTriangle, color: 'red' },
          { label: 'New Activations', value: formatNum(data.newActivations), icon: Smartphone, color: 'cyan' },
          { label: 'Port-Ins', value: formatNum(data.portIns), icon: ArrowUpRight, color: 'indigo' },
        ].map((kpi, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <kpi.icon className={`w-4 h-4 text-${kpi.color}-500`} />
              <span className="text-xs text-gray-500 dark:text-gray-400">{kpi.label}</span>
            </div>
            <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{kpi.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Network Health Bar */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-8 flex-wrap">
          <div className="flex items-center gap-2">
            <Signal className="w-4 h-4 text-blue-500" />
            <span className="text-sm text-gray-600 dark:text-gray-300">4G Coverage: <strong>{data.networkHealth.coverage4G}%</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <Wifi className="w-4 h-4 text-purple-500" />
            <span className="text-sm text-gray-600 dark:text-gray-300">5G Coverage: <strong>{data.networkHealth.coverage5G}%</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <ArrowDownRight className="w-4 h-4 text-green-500" />
            <span className="text-sm text-gray-600 dark:text-gray-300">Avg Download: <strong>{data.networkHealth.avgDownload} Mbps</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-yellow-500" />
            <span className="text-sm text-gray-600 dark:text-gray-300">Latency: <strong>{data.networkHealth.latency}ms</strong></span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg w-fit">
        {['overview', 'plans', 'usage', 'enterprise'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm rounded-md capitalize transition-colors ${
              activeTab === tab ? 'bg-white dark:bg-gray-700 shadow-sm font-medium text-gray-900 dark:text-gray-100'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}>
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Subscriber Mix by Plan</h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={data.plans} dataKey="subscribers" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {data.plans.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip formatter={(v) => formatNum(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Revenue by Plan</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data.plans}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(v) => `$${(v / 1e6).toFixed(0)}M`} />
                <Tooltip formatter={(v) => `$${(v / 1e6).toFixed(1)}M`} />
                <Bar dataKey="revenue" fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {activeTab === 'plans' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  {['Plan', 'Subscribers', 'Revenue', 'ARPU', 'Share'].map(h => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {data.plans.map((plan, i) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: plan.color }} />
                        {plan.name}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{formatNum(plan.subscribers)}</td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300">${(plan.revenue / 1e6).toFixed(1)}M</td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300">${plan.arpu.toFixed(2)}</td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{((plan.subscribers / data.totalSubscribers) * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'usage' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Usage Trends (Data Growing, Voice/SMS Declining)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data.usageTrends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={formatNum} />
              <Tooltip formatter={(v) => formatNum(v)} />
              <Legend />
              <Area type="monotone" dataKey="data_gb" stroke="#3b82f6" fill="#3b82f680" name="Data (GB)" />
              <Area type="monotone" dataKey="voice_min" stroke="#10b981" fill="#10b98180" name="Voice (min)" />
              <Area type="monotone" dataKey="sms" stroke="#8b5cf6" fill="#8b5cf680" name="SMS" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {activeTab === 'enterprise' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  {['Enterprise', 'Plan', 'Lines', 'Monthly Spend', 'Status'].map(h => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {data.topSubscribers.map((sub, i) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">{sub.name}</td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{sub.plan}</td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{sub.lines.toLocaleString()}</td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{sub.monthlySpend}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        sub.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                        {sub.status === 'at_risk' ? 'At Risk' : 'Active'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default TelcoSubscriberManagement
