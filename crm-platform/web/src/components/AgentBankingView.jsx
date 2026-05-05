import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Users, MapPin, TrendingUp, DollarSign, UserPlus, Activity, RefreshCw,
  ArrowUpRight, Building2, Target, Shield, BarChart3, Star, ChevronRight
} from 'lucide-react'
import { AreaChart, Area, BarChart, Bar, Cell,
  ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { agentBankingAdapter } from '../services/agentBankingAdapter'

const COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#84cc16']

const formatCurrency = (val) => {
  if (val >= 1e9) return `₦${(val / 1e9).toFixed(1)}B`
  if (val >= 1e6) return `₦${(val / 1e6).toFixed(1)}M`
  if (val >= 1e3) return `₦${(val / 1e3).toFixed(0)}K`
  return `₦${val.toLocaleString()}`
}

const AgentBankingView = () => {
  const [metrics, setMetrics] = useState(null)
  const [agents, setAgents] = useState([])
  const [customers, setCustomers] = useState([])
  const [performance, setPerformance] = useState([])
  const [regionalData, setRegionalData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    const [m, a, c, p, r] = await Promise.all([
      agentBankingAdapter.getMetrics(),
      agentBankingAdapter.fetchAgents(),
      agentBankingAdapter.fetchCustomers(),
      agentBankingAdapter.fetchAgentPerformance(),
      agentBankingAdapter.fetchRegionalData(),
    ])
    setMetrics(m)
    setAgents(a)
    setCustomers(c)
    setPerformance(p)
    setRegionalData(r)
    setLoading(false)
  }

  if (loading || !metrics) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-green-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-xl">
            <Users className="w-7 h-7 text-green-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Agent Banking</h1>
            <p className="text-gray-500 dark:text-gray-400">Field agents collecting customer data & processing transactions</p>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Total Agents', value: metrics.totalAgents.toLocaleString(), icon: Users, color: 'bg-green-600' },
          { label: 'Active Agents', value: metrics.activeAgents.toLocaleString(), icon: Activity, color: 'bg-blue-600' },
          { label: 'Customers Registered', value: `${(metrics.totalCustomersRegistered / 1000).toFixed(1)}K`, icon: UserPlus, color: 'bg-purple-600' },
          { label: 'Monthly Volume', value: formatCurrency(metrics.monthlyVolume), icon: DollarSign, color: 'bg-amber-600' },
          { label: 'Monthly Transactions', value: `${(metrics.monthlyTransactions / 1000).toFixed(0)}K`, icon: TrendingUp, color: 'bg-cyan-600' },
          { label: 'KYC Conversion', value: `${metrics.kycConversionRate}%`, icon: Shield, color: 'bg-red-600' },
        ].map((m, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
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

      {/* Volume Split */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Cash-In', value: formatCurrency(metrics.cashInVolume), pct: '50%', color: 'text-green-600' },
          { label: 'Cash-Out', value: formatCurrency(metrics.cashOutVolume), pct: '40%', color: 'text-blue-600' },
          { label: 'Bill Payment', value: formatCurrency(metrics.billPaymentVolume), pct: '10%', color: 'text-purple-600' },
        ].map((v, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <p className="text-sm text-gray-500">{v.label}</p>
            <p className={`text-2xl font-bold mt-1 ${v.color}`}>{v.value}</p>
            <div className="mt-2 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div className={`h-2 rounded-full ${v.color === 'text-green-600' ? 'bg-green-500' : v.color === 'text-blue-600' ? 'bg-blue-500' : 'bg-purple-500'}`}
                style={{ width: v.pct }} />
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Transaction & Customer Growth</h3>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={performance}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis dataKey="month" />
              <YAxis yAxisId="left" tickFormatter={(v) => `${(v/1000).toFixed(0)}K`} />
              <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `${(v/1000).toFixed(0)}K`} />
              <Tooltip />
              <Legend />
              <Area yAxisId="left" type="monotone" dataKey="transactions" name="Transactions" stroke="#10b981" fill="#10b981" fillOpacity={0.1} />
              <Area yAxisId="right" type="monotone" dataKey="newCustomers" name="New Customers" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.1} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Regional Distribution</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={regionalData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis dataKey="region" />
              <YAxis tickFormatter={(v) => `${v}`} />
              <Tooltip />
              <Legend />
              <Bar dataKey="agents" name="Agents" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="customers" name="Customers" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Agent Leaderboard */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Agent Leaderboard</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-3 px-4 text-gray-500 font-medium">Agent</th>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">Region</th>
                <th className="text-right py-3 px-4 text-gray-500 font-medium">Customers</th>
                <th className="text-right py-3 px-4 text-gray-500 font-medium">Transactions</th>
                <th className="text-right py-3 px-4 text-gray-500 font-medium">Volume</th>
                <th className="text-right py-3 px-4 text-gray-500 font-medium">Commission</th>
                <th className="text-center py-3 px-4 text-gray-500 font-medium">Rating</th>
                <th className="text-center py-3 px-4 text-gray-500 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent, i) => (
                <tr key={agent.id} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="py-3 px-4">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{agent.name}</p>
                      <p className="text-xs text-gray-500">{agent.id}</p>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-gray-600 dark:text-gray-300">{agent.region}</td>
                  <td className="py-3 px-4 text-right text-gray-600 dark:text-gray-300">{agent.customersRegistered}</td>
                  <td className="py-3 px-4 text-right text-gray-600 dark:text-gray-300">{agent.monthlyTransactions.toLocaleString()}</td>
                  <td className="py-3 px-4 text-right font-medium text-gray-900 dark:text-white">{formatCurrency(agent.monthlyVolume)}</td>
                  <td className="py-3 px-4 text-right text-green-600">{formatCurrency(agent.commission)}</td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center space-x-1">
                      <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                      <span className="text-gray-900 dark:text-white">{agent.rating}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      agent.status === 'Active' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                      'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                    }`}>{agent.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Registered Customers */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recently Registered Customers</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {customers.map((customer) => (
            <div key={customer.externalId} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold text-gray-900 dark:text-white">{customer.fullName}</p>
                <span className={`px-2 py-0.5 rounded-full text-xs ${
                  customer.kycStatus === 'Enhanced' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                }`}>{customer.kycStatus}</span>
              </div>
              <p className="text-sm text-gray-500 mb-2">{customer.location.address}</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-gray-400">Agent:</span> <span className="text-gray-700 dark:text-gray-300">{customer.agentName}</span></div>
                <div><span className="text-gray-400">Channel:</span> <span className="text-gray-700 dark:text-gray-300">{customer.channel}</span></div>
                <div><span className="text-gray-400">Txns:</span> <span className="text-gray-700 dark:text-gray-300">{customer.totalTransactions}</span></div>
                <div><span className="text-gray-400">Volume:</span> <span className="text-green-600">{formatCurrency(customer.totalVolume)}</span></div>
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {customer.services.map(s => (
                  <span key={s} className="px-1.5 py-0.5 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded text-xs">{s}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default AgentBankingView
