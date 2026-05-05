import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Users, Building2, Landmark, Globe, TrendingUp, ArrowUpRight, ArrowDownRight,
  DollarSign, Activity, Target, Zap, Shield, BarChart3, PieChart, RefreshCw,
  AlertTriangle, CheckCircle, Clock, Wifi
} from 'lucide-react'
import { AreaChart, Area, BarChart, Bar, PieChart as RechartPie, Pie, Cell,
  ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { unifiedCustomerService } from '../services/unifiedCustomerService'
import { eventBus } from '../services/eventBus'

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899']

const formatCurrency = (val, currency = 'NGN') => {
  if (val >= 1e9) return `₦${(val / 1e9).toFixed(1)}B`
  if (val >= 1e6) return `₦${(val / 1e6).toFixed(1)}M`
  if (val >= 1e3) return `₦${(val / 1e3).toFixed(0)}K`
  return `₦${val.toLocaleString()}`
}

const formatNumber = (val) => {
  if (val >= 1e6) return `${(val / 1e6).toFixed(1)}M`
  if (val >= 1e3) return `${(val / 1e3).toFixed(1)}K`
  return val.toLocaleString()
}

const MetricCard = ({ title, value, icon: Icon, change, changeType, color, subtitle }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5"
  >
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
        {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
      </div>
      <div className={`p-3 rounded-xl ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
    </div>
    {change && (
      <div className="flex items-center mt-3 text-sm">
        {changeType === 'up' ? (
          <ArrowUpRight className="w-4 h-4 text-green-500 mr-1" />
        ) : (
          <ArrowDownRight className="w-4 h-4 text-red-500 mr-1" />
        )}
        <span className={changeType === 'up' ? 'text-green-500' : 'text-red-500'}>{change}</span>
        <span className="text-gray-400 ml-1">vs last month</span>
      </div>
    )}
  </motion.div>
)

const SourceBadge = ({ source }) => {
  const config = {
    'core-banking': { label: 'Core Banking', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
    'agent-banking': { label: 'Agent Banking', color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
    'remittance': { label: 'Remittance', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' },
  }
  const c = config[source] || { label: source, color: 'bg-gray-100 text-gray-700' }
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.color}`}>{c.label}</span>
}

const EventFeed = ({ events }) => (
  <div className="space-y-3">
    {events.map((event) => (
      <div key={event.id} className="flex items-start space-x-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
        <div className={`w-2 h-2 rounded-full mt-2 ${
          event.source === 'Core Banking' ? 'bg-blue-500' :
          event.source === 'Agent Banking' ? 'bg-green-500' :
          event.source === 'Remittance' ? 'bg-purple-500' : 'bg-gray-500'
        }`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-white">{event.type.replace(/_/g, ' ')}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {event.source} — {event.data.name || event.data.customerId || event.data.transactionId || ''}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {Math.round((Date.now() - new Date(event.timestamp)) / 60000)} min ago
          </p>
        </div>
      </div>
    ))}
  </div>
)

const UnifiedDashboard = () => {
  const [metrics, setMetrics] = useState(null)
  const [segments, setSegments] = useState([])
  const [sourceDistribution, setSourceDistribution] = useState([])
  const [recentEvents, setRecentEvents] = useState([])
  const [crossSell, setCrossSell] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    const [m, s, sd, cs] = await Promise.all([
      unifiedCustomerService.getAggregatedMetrics(),
      unifiedCustomerService.getSegmentBreakdown(),
      unifiedCustomerService.getSourceDistribution(),
      unifiedCustomerService.getCrossSellOpportunities(),
    ])
    setMetrics(m)
    setSegments(s)
    setSourceDistribution(sd)
    setCrossSell(cs)
    setRecentEvents(eventBus.getRecentEvents(8))
    setLoading(false)
  }

  if (loading || !metrics) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    )
  }

  const volumeData = [
    { name: 'Core Banking', value: metrics.totalDeposits / 12, color: '#3b82f6' },
    { name: 'Agent Banking', value: metrics.agentBankingVolume, color: '#10b981' },
    { name: 'Remittance', value: metrics.remittanceVolume, color: '#8b5cf6' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Unified CRM Hub</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Central view across Core Banking, Agent Banking & Remittance
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 px-3 py-2 bg-green-50 dark:bg-green-900/30 rounded-lg">
            <Wifi className="w-4 h-4 text-green-500" />
            <span className="text-sm text-green-700 dark:text-green-300">All Systems Connected</span>
          </div>
          <button onClick={loadData} className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* System Connection Status */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { name: 'Core Banking', icon: Landmark, status: 'Connected', events: '85/min', color: 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' },
          { name: 'Agent Banking', icon: Users, status: 'Connected', events: '130/min', color: 'border-green-500 bg-green-50 dark:bg-green-900/20' },
          { name: 'Remittance', icon: Globe, status: 'Connected', events: '66/min', color: 'border-purple-500 bg-purple-50 dark:bg-purple-900/20' },
        ].map((sys) => (
          <div key={sys.name} className={`flex items-center space-x-3 p-4 rounded-xl border-l-4 ${sys.color}`}>
            <sys.icon className="w-8 h-8 text-gray-600 dark:text-gray-300" />
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">{sys.name}</p>
              <div className="flex items-center space-x-2 text-sm">
                <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                <span className="text-green-600 dark:text-green-400">{sys.status}</span>
                <span className="text-gray-400">•</span>
                <Zap className="w-3.5 h-3.5 text-yellow-500" />
                <span className="text-gray-500 dark:text-gray-400">{sys.events}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Total Unique Customers" value={formatNumber(metrics.totalUniqueCustomers)} icon={Users} change="8.5%" changeType="up" color="bg-blue-600" subtitle="Across all systems (deduplicated)" />
        <MetricCard title="Core Banking Deposits" value={formatCurrency(metrics.totalDeposits)} icon={Landmark} change="12.3%" changeType="up" color="bg-indigo-600" subtitle={`${formatNumber(metrics.coreBankingCustomers)} customers`} />
        <MetricCard title="Agent Banking Volume" value={formatCurrency(metrics.agentBankingVolume)} icon={Building2} change="15.7%" changeType="up" color="bg-green-600" subtitle={`${formatNumber(metrics.agentBankingCustomers)} customers`} />
        <MetricCard title="Remittance Volume" value={formatCurrency(metrics.remittanceVolume)} icon={Globe} change="24.3%" changeType="up" color="bg-purple-600" subtitle={`${formatNumber(metrics.remittanceSenders)} senders`} />
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Golden Records" value={formatNumber(metrics.goldenRecords)} icon={Target} color="bg-amber-600" subtitle="Unified customer profiles" />
        <MetricCard title="Cross-System Matches" value={formatNumber(metrics.crossSystemCustomers)} icon={Activity} change="3.2%" changeType="up" color="bg-cyan-600" subtitle={`${metrics.matchRate}% match rate`} />
        <MetricCard title="KYC Compliant" value={`${metrics.kycCompliantRate}%`} icon={Shield} color="bg-emerald-600" subtitle="Across all channels" />
        <MetricCard title="Data Quality Score" value={`${metrics.dataQualityScore}%`} icon={CheckCircle} change="2.1%" changeType="up" color="bg-teal-600" subtitle="Completeness & accuracy" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Customer Source Distribution */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Customer Source Distribution</h3>
          <ResponsiveContainer width="100%" height={280}>
            <RechartPie>
              <Pie data={sourceDistribution} dataKey="count" nameKey="source" cx="50%" cy="50%" outerRadius={100} label={({ source, percentage }) => `${percentage}%`}>
                {sourceDistribution.map((entry, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(val) => formatNumber(val)} />
              <Legend />
            </RechartPie>
          </ResponsiveContainer>
        </div>

        {/* Segment Breakdown */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Customer Segments</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={segments} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis type="number" tickFormatter={formatNumber} />
              <YAxis type="category" dataKey="segment" width={100} />
              <Tooltip formatter={(val) => formatNumber(val)} />
              <Bar dataKey="count" name="Customers" radius={[0, 4, 4, 0]}>
                {segments.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Volume Comparison & Event Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Volume by System */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Monthly Volume by System</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={volumeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis dataKey="name" />
              <YAxis tickFormatter={(v) => formatCurrency(v)} />
              <Tooltip formatter={(v) => formatCurrency(v)} />
              <Bar dataKey="value" name="Monthly Volume" radius={[4, 4, 0, 0]}>
                {volumeData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Live Event Feed */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Live Events</h3>
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-xs text-gray-500">Live</span>
            </div>
          </div>
          <EventFeed events={recentEvents} />
        </div>
      </div>

      {/* Cross-Sell Opportunities */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Cross-Sell Opportunities</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Opportunity</th>
                <th className="text-right py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Target Customers</th>
                <th className="text-right py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Est. Conversion</th>
                <th className="text-right py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Potential Revenue</th>
                <th className="text-center py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Priority</th>
              </tr>
            </thead>
            <tbody>
              {crossSell.map((opp, i) => (
                <tr key={i} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="py-3 px-4 font-medium text-gray-900 dark:text-white">{opp.opportunity}</td>
                  <td className="py-3 px-4 text-right text-gray-600 dark:text-gray-300">{formatNumber(opp.targetCustomers)}</td>
                  <td className="py-3 px-4 text-right text-gray-600 dark:text-gray-300">{opp.conversionRate}%</td>
                  <td className="py-3 px-4 text-right font-semibold text-gray-900 dark:text-white">{formatCurrency(opp.potentialRevenue)}</td>
                  <td className="py-3 px-4 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      opp.priority === 'High' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' :
                      opp.priority === 'Medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' :
                      'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                    }`}>
                      {opp.priority}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default UnifiedDashboard
