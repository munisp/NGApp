import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  MessageSquare, Phone, Video, Shield, TrendingUp, ArrowUpRight,
  ArrowDownRight, BarChart3, Activity, Globe, Zap, AlertTriangle
, Search } from 'lucide-react'
import { AreaChart, Area, BarChart, Bar, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell } from 'recharts'
import { useTenant } from '../contexts/TenantContext'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { useApiData } from '@/hooks/useApiData'
import { apiClient } from '@/lib/apiClient'
import { ErrorState } from '@/components/ui/DataStates'

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4']

const seedData = {
  'messageflow': {
    totalMessages: 48200000,
    smsDelivered: 32100000,
    whatsappSent: 12400000,
    voiceCalls: 2800000,
    videoSessions: 890000,
    deliveryRate: 99.2,
    avgLatencyMs: 142,
    monthlyRevenue: '$2.4M',
    activeAPIs: 847,
    p99Latency: 380,
    errorRate: 0.08,
    throughput: '14,200/sec',
    channels: [
      { name: 'SMS', volume: 32100000, revenue: 1120000, deliveryRate: 99.6, latency: 89, color: '#3b82f6' },
      { name: 'WhatsApp', volume: 12400000, revenue: 620000, deliveryRate: 98.8, latency: 210, color: '#10b981' },
      { name: 'Voice', volume: 2800000, revenue: 480000, deliveryRate: 99.1, latency: 120, color: '#8b5cf6' },
      { name: 'Video', volume: 890000, revenue: 180000, deliveryRate: 97.2, latency: 340, color: '#f59e0b' },
    ],
    hourlyTraffic: [
      { hour: '00:00', sms: 420000, whatsapp: 180000, voice: 45000 },
      { hour: '04:00', sms: 280000, whatsapp: 95000, voice: 22000 },
      { hour: '08:00', sms: 1800000, whatsapp: 720000, voice: 185000 },
      { hour: '12:00', sms: 2400000, whatsapp: 980000, voice: 210000 },
      { hour: '16:00', sms: 2100000, whatsapp: 850000, voice: 195000 },
      { hour: '20:00', sms: 1500000, whatsapp: 620000, voice: 120000 },
    ],
    topConsumers: [
      { name: 'RideShare NG', apiCalls: 8200000, channel: 'SMS', status: 'healthy' },
      { name: 'PayQuick', apiCalls: 6400000, channel: 'WhatsApp', status: 'healthy' },
      { name: 'HealthPlus', apiCalls: 4100000, channel: 'Voice', status: 'warning' },
      { name: 'EduConnect', apiCalls: 3200000, channel: 'SMS', status: 'healthy' },
      { name: 'FoodDash', apiCalls: 2900000, channel: 'WhatsApp', status: 'healthy' },
    ],
    recentAlerts: [
      { id: 1, severity: 'warning', message: 'SMS delivery rate dipped to 98.1% for MTN route', time: '12m ago' },
      { id: 2, severity: 'info', message: 'WhatsApp Business API rate limit increased to 1000/s', time: '1h ago' },
      { id: 3, severity: 'critical', message: 'Voice gateway failover activated — Lagos DC', time: '3h ago' },
    ],
  },
  'connecthub': {
    totalMessages: 12800000,
    smsDelivered: 8900000,
    whatsappSent: 2800000,
    voiceCalls: 920000,
    videoSessions: 180000,
    deliveryRate: 98.7,
    avgLatencyMs: 198,
    monthlyRevenue: '$680K',
    activeAPIs: 234,
    p99Latency: 520,
    errorRate: 0.14,
    throughput: '4,100/sec',
    channels: [
      { name: 'SMS', volume: 8900000, revenue: 312000, deliveryRate: 99.1, latency: 105, color: '#3b82f6' },
      { name: 'WhatsApp', volume: 2800000, revenue: 168000, deliveryRate: 98.2, latency: 245, color: '#10b981' },
      { name: 'Voice', volume: 920000, revenue: 156000, deliveryRate: 98.5, latency: 145, color: '#8b5cf6' },
      { name: 'Video', volume: 180000, revenue: 44000, deliveryRate: 96.8, latency: 410, color: '#f59e0b' },
    ],
    hourlyTraffic: [
      { hour: '00:00', sms: 110000, whatsapp: 42000, voice: 12000 },
      { hour: '04:00', sms: 72000, whatsapp: 28000, voice: 6000 },
      { hour: '08:00', sms: 520000, whatsapp: 195000, voice: 58000 },
      { hour: '12:00', sms: 680000, whatsapp: 240000, voice: 72000 },
      { hour: '16:00', sms: 590000, whatsapp: 210000, voice: 64000 },
      { hour: '20:00', sms: 380000, whatsapp: 145000, voice: 38000 },
    ],
    topConsumers: [
      { name: 'BankFirst NG', apiCalls: 2800000, channel: 'SMS', status: 'healthy' },
      { name: 'MediCare', apiCalls: 1900000, channel: 'Voice', status: 'healthy' },
      { name: 'LogiTrack', apiCalls: 1400000, channel: 'SMS', status: 'healthy' },
    ],
    recentAlerts: [
      { id: 1, severity: 'info', message: 'New WhatsApp template approved — promotional tier', time: '45m ago' },
      { id: 2, severity: 'warning', message: 'Voice quality score below threshold for Airtel route', time: '2h ago' },
    ],
  },
}

const formatNum = (n) => {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`
  return n.toLocaleString()
}

const CPaaSChannelDashboard = () => {
  const { data: _apiData, isLoading: _apiLoading, isUsingFallback } = useApiData('cpaaschanneldashboard', () => apiClient.dashboard.metrics(), { fallback: COLORS })
  const { tenant } = useTenant()
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState('overview')
  const [search, setSearch] = useState('')
  const [channelFilter, setChannelFilter] = useState('all')
  const [selectedCampaign, setSelectedCampaign] = useState(null)
  const [error, setError] = useState(null)
  const data = seedData[tenant?.slug] || seedData['messageflow']
  const filteredCampaigns = data.campaigns ? data.campaigns.filter(c => {
    const matchSearch = !search || (c.name && c.name.toLowerCase().includes(search.toLowerCase()))
    const matchChannel = channelFilter === 'all' || (c.channel && c.channel.toLowerCase() === channelFilter)
    return matchSearch && matchChannel
  }) : []

  const tabs = ['overview', 'channels', 'consumers', 'alerts']

  if (error) return <ErrorState message={error} />

  return (
    <div role="region" aria-label="CPaaSChannelDashboard" className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {t('nav.cpaasChannels', 'Channel Dashboard')}
          </h1>
          <p className="text-gray-500 dark:text-gray-400">Communications platform performance & analytics</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="px-2 py-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full">
            {data.throughput} throughput
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {[
          { label: 'Total Messages', value: formatNum(data.totalMessages), icon: MessageSquare, color: 'blue' },
          { label: 'Delivery Rate', value: `${data.deliveryRate}%`, icon: TrendingUp, color: 'green' },
          { label: 'Avg Latency', value: `${data.avgLatencyMs}ms`, icon: Zap, color: 'yellow' },
          { label: 'Monthly Revenue', value: data.monthlyRevenue, icon: BarChart3, color: 'purple' },
          { label: 'Active APIs', value: data.activeAPIs.toLocaleString(), icon: Globe, color: 'cyan' },
          { label: 'Error Rate', value: `${data.errorRate}%`, icon: AlertTriangle, color: 'red' },
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

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg w-fit">
        {tabs.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm rounded-md capitalize transition-colors ${
              activeTab === tab ? 'bg-white dark:bg-gray-700 shadow-sm font-medium text-gray-900 dark:text-gray-100'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}>
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Channel Volume Breakdown */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Channel Volume</h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={data.channels} dataKey="volume" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {data.channels.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip formatter={(v) => formatNum(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Hourly Traffic */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Hourly Traffic</h3>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={data.hourlyTraffic}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" />
                <YAxis tickFormatter={formatNum} />
                <Tooltip formatter={(v) => formatNum(v)} />
                <Legend />
                <Area type="monotone" dataKey="sms" stroke="#3b82f6" fill="#3b82f680" name="SMS" />
                <Area type="monotone" dataKey="whatsapp" stroke="#10b981" fill="#10b98180" name="WhatsApp" />
                <Area type="monotone" dataKey="voice" stroke="#8b5cf6" fill="#8b5cf680" name="Voice" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {activeTab === 'channels' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  {['Channel', 'Volume', 'Revenue', 'Delivery Rate', 'Avg Latency'].map(h => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {data.channels.map((ch, i) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">{ch.name}</td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{formatNum(ch.volume)}</td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300">${(ch.revenue / 1000).toFixed(0)}K</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${ch.deliveryRate >= 99 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'}`}>
                        {ch.deliveryRate}%
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{ch.latency}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'consumers' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  {['Consumer', 'API Calls', 'Primary Channel', 'Status'].map(h => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {data.topConsumers.map((c, i) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">{c.name}</td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{formatNum(c.apiCalls)}</td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{c.channel}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${c.status === 'healthy' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'}`}>
                        {c.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'alerts' && (
        <div className="space-y-3">
          {data.recentAlerts.map(alert => (
            <div key={alert.id} className={`bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border-l-4 ${
              alert.severity === 'critical' ? 'border-l-red-500' : alert.severity === 'warning' ? 'border-l-yellow-500' : 'border-l-blue-500'
            } border border-gray-200 dark:border-gray-700`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertTriangle className={`w-4 h-4 ${alert.severity === 'critical' ? 'text-red-500' : alert.severity === 'warning' ? 'text-yellow-500' : 'text-blue-500'}`} />
                  <span className="text-sm text-gray-900 dark:text-gray-100">{alert.message}</span>
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400">{alert.time}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default CPaaSChannelDashboard
