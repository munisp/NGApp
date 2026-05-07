import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Globe, Send, DollarSign, TrendingUp, Users, Shield, RefreshCw,
  ArrowUpRight, ArrowDownRight, MapPin, Clock, AlertTriangle, CheckCircle,
  ArrowRight, BarChart3, Eye
} from 'lucide-react'
import { AreaChart, Area, BarChart, Bar, Cell,
  ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { remittanceAdapter } from '../services/remittanceAdapter'
import { LoadingState, ErrorState, EmptyState, FallbackBadge, ExportButton } from '@/components/ui/DataStates'
import { useTranslation } from '@/lib/i18n/useTranslation'

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#84cc16']

const formatCurrency = (val, symbol = '$') => {
  if (val >= 1e9) return `${symbol}${(val / 1e9).toFixed(1)}B`
  if (val >= 1e6) return `${symbol}${(val / 1e6).toFixed(1)}M`
  if (val >= 1e3) return `${symbol}${(val / 1e3).toFixed(0)}K`
  return `${symbol}${val.toLocaleString()}`
}

const RemittanceView = () => {
  const [metrics, setMetrics] = useState(null)
  const [corridors, setCorridors] = useState([])
  const [customers, setCustomers] = useState([])
  const [trends, setTrends] = useState([])
  const [compliance, setCompliance] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    const [m, cor, cust, t, comp] = await Promise.all([
      remittanceAdapter.getMetrics(),
      remittanceAdapter.fetchCorridorData(),
      remittanceAdapter.fetchCustomers(),
      remittanceAdapter.fetchMonthlyTrends(),
      remittanceAdapter.fetchComplianceData(),
    ])
    setMetrics(m)
    setCorridors(cor)
    setCustomers(cust)
    setTrends(t)
    setCompliance(comp)
    setLoading(false)
  }

  if (loading || !metrics) {
    return (
      <div role="region" aria-label="RemittanceView"  className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
            <Globe className="w-7 h-7 text-purple-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Remittance</h1>
            <p className="text-gray-500 dark:text-gray-400">Cross-border money transfers — {metrics.diasporaCountries} countries, {metrics.corridors} corridors</p>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Total Volume', value: formatCurrency(metrics.totalVolume), icon: DollarSign, color: 'bg-purple-600' },
          { label: 'Transactions', value: `${(metrics.totalTransactions / 1000).toFixed(1)}K`, icon: TrendingUp, color: 'bg-blue-600' },
          { label: 'Unique Senders', value: `${(metrics.uniqueSenders / 1000).toFixed(1)}K`, icon: Send, color: 'bg-green-600' },
          { label: 'Unique Receivers', value: `${(metrics.uniqueReceivers / 1000).toFixed(1)}K`, icon: Users, color: 'bg-amber-600' },
          { label: 'Avg Completion', value: metrics.avgCompletionTime, icon: Clock, color: 'bg-cyan-600' },
          { label: 'Compliance Rate', value: `${metrics.complianceRate}%`, icon: Shield, color: 'bg-emerald-600' },
        ].map((m, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            tabIndex="0" className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">{m.label}</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white mt-1">{m.value}</p>
              </div>
              <div className={`p-2 rounded-lg ${m.color}`}>
                <m.icon className="w-4 h-4 text-white" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Channel Distribution */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Mobile App', pct: metrics.mobileChannelShare, color: 'bg-purple-500' },
          { label: 'Bank Transfer', pct: metrics.bankTransferShare, color: 'bg-blue-500' },
          { label: 'Cash Pickup', pct: metrics.cashPickupShare, color: 'bg-green-500' },
        ].map((ch, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-500">{ch.label}</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{ch.pct}%</p>
            </div>
            <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div className={`h-2 rounded-full ${ch.color}`} style={{ width: `${ch.pct}%` }} />
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Volume & Transaction Trends</h3>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={trends}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis dataKey="month" />
              <YAxis yAxisId="left" tickFormatter={(v) => formatCurrency(v)} />
              <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `${(v/1000).toFixed(0)}K`} />
              <Tooltip />
              <Legend />
              <Area yAxisId="left" type="monotone" dataKey="volume" name="Volume ($)" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.1} />
              <Area yAxisId="right" type="monotone" dataKey="transactions" name="Transactions" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Corridor Volume</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={corridors} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis type="number" tickFormatter={(v) => formatCurrency(v)} />
              <YAxis type="category" dataKey="corridor" width={90} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v) => formatCurrency(v)} />
              <Bar dataKey="volume" name="Volume" radius={[0, 4, 4, 0]}>
                {corridors.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Corridors Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Corridor Analytics</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-3 px-4 text-gray-500 font-medium">Corridor</th>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">Country</th>
                <th className="text-right py-3 px-4 text-gray-500 font-medium">Volume</th>
                <th className="text-right py-3 px-4 text-gray-500 font-medium">Transactions</th>
                <th className="text-right py-3 px-4 text-gray-500 font-medium">Avg Amount</th>
                <th className="text-right py-3 px-4 text-gray-500 font-medium">Growth</th>
                <th className="text-right py-3 px-4 text-gray-500 font-medium">Senders</th>
                <th className="text-right py-3 px-4 text-gray-500 font-medium">Receivers</th>
              </tr>
            </thead>
            <tbody>
              {corridors.map((cor, i) => (
                <tr key={i} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="py-3 px-4 font-medium text-gray-900 dark:text-white">{cor.corridor}</td>
                  <td className="py-3 px-4 text-gray-600 dark:text-gray-300">{cor.country}</td>
                  <td className="py-3 px-4 text-right font-semibold text-gray-900 dark:text-white">{formatCurrency(cor.volume)}</td>
                  <td className="py-3 px-4 text-right text-gray-600 dark:text-gray-300">{cor.transactions.toLocaleString()}</td>
                  <td className="py-3 px-4 text-right text-gray-600 dark:text-gray-300">{formatCurrency(cor.avgAmount)}</td>
                  <td className="py-3 px-4 text-right">
                    <span className="text-green-600 flex items-center justify-end space-x-1">
                      <ArrowUpRight className="w-3.5 h-3.5" />
                      <span>{cor.growth}%</span>
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right text-gray-600 dark:text-gray-300">{cor.senders.toLocaleString()}</td>
                  <td className="py-3 px-4 text-right text-gray-600 dark:text-gray-300">{cor.receivers.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Compliance Dashboard */}
      {compliance && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center space-x-2 mb-4">
            <Shield className="w-5 h-5 text-purple-600" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Compliance & Sanctions Screening</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: 'Total Screened', value: compliance.totalScreened.toLocaleString(), color: 'text-blue-600' },
              { label: 'Sanctions Hits', value: compliance.sanctionsHits, color: 'text-red-600' },
              { label: 'False Positives', value: compliance.falsePositives, color: 'text-yellow-600' },
              { label: 'PEP Matches', value: compliance.pepMatches, color: 'text-orange-600' },
              { label: 'Blocked', value: compliance.blockedTransactions, color: 'text-red-600' },
            ].map((item, i) => (
              <div key={i} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 text-center">
                <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
                <p className="text-xs text-gray-500 mt-1">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Customers */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Remittance Customers</h3>
        <div className="space-y-3">
          {customers.map((customer) => (
            <div key={customer.externalId} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow transition">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                    customer.role === 'Sender' ? 'bg-purple-500' : 'bg-blue-500'
                  }`}>
                    {customer.fullName.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">{customer.fullName}</p>
                    <div className="flex items-center space-x-2 text-sm text-gray-500">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>{customer.city}, {customer.country}</span>
                      <span>•</span>
                      <span className={`font-medium ${customer.role === 'Sender' ? 'text-purple-600' : 'text-blue-600'}`}>{customer.role}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-gray-900 dark:text-white">
                    {customer.currency === 'NGN' ? '₦' : customer.currency === 'GBP' ? '£' : customer.currency === 'EUR' ? '€' : '$'}
                    {customer.totalVolume.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500">{customer.totalRemittances} transfers • {customer.corridor}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default RemittanceView
