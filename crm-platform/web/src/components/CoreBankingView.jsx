import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Landmark, Users, DollarSign, TrendingUp, CreditCard, Building2,
  ArrowUpRight, ArrowDownRight, RefreshCw, Search, Filter, Download,
  AlertTriangle, CheckCircle, Clock, Eye, BarChart3, PieChart
} from 'lucide-react'
import { AreaChart, Area, BarChart, Bar, PieChart as RechartPie, Pie, Cell,
  ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { coreBankingAdapter } from '../services/coreBankingAdapter'
import { LoadingState, ErrorState, EmptyState, FallbackBadge, ExportButton } from '@/components/ui/DataStates'
import { useTranslation } from '@/lib/i18n/useTranslation'

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#84cc16']

const formatCurrency = (val) => {
  if (val >= 1e9) return `₦${(val / 1e9).toFixed(1)}B`
  if (val >= 1e6) return `₦${(val / 1e6).toFixed(1)}M`
  if (val >= 1e3) return `₦${(val / 1e3).toFixed(0)}K`
  return `₦${val.toLocaleString()}`
}

const CoreBankingView = () => {
  const [metrics, setMetrics] = useState(null)
  const [customers, setCustomers] = useState([])
  const [branches, setBranches] = useState([])
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    const [m, c, b] = await Promise.all([
      coreBankingAdapter.getMetrics(),
      coreBankingAdapter.fetchCustomers(),
      coreBankingAdapter.fetchBranches(),
    ])
    setMetrics(m)
    setCustomers(c)
    setBranches(b)
    setLoading(false)
  }

  const selectCustomer = async (customer) => {
    setSelectedCustomer(customer)
    const txns = await coreBankingAdapter.fetchTransactions(customer.externalId)
    setTransactions(txns)
  }

  if (loading || !metrics) {
    return (
      <div role="region" aria-label="CoreBankingView"  className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    )
  }

  const accountTypeData = [
    { name: 'Savings', value: 22500, color: '#3b82f6' },
    { name: 'Current', value: 12800, color: '#10b981' },
    { name: 'Corporate', value: 5400, color: '#8b5cf6' },
    { name: 'Domiciliary', value: 4200, color: '#f59e0b' },
    { name: 'Fixed Deposit', value: 4000, color: '#ef4444' },
  ]

  const monthlyTrend = [
    { month: 'Aug', deposits: 195000000000, loans: 78000000000, newAccounts: 1050 },
    { month: 'Sep', deposits: 202000000000, loans: 80000000000, newAccounts: 1100 },
    { month: 'Oct', deposits: 210000000000, loans: 82000000000, newAccounts: 1150 },
    { month: 'Nov', deposits: 218000000000, loans: 83500000000, newAccounts: 1180 },
    { month: 'Dec', deposits: 225000000000, loans: 84500000000, newAccounts: 1220 },
    { month: 'Jan', deposits: 230500000000, loans: 85200000000, newAccounts: 1250 },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
            <Landmark className="w-7 h-7 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Core Banking</h1>
            <p className="text-gray-500 dark:text-gray-400">Customer data from core banking system (T24/Finacle)</p>
          </div>
        </div>
        <div className="flex items-center space-x-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
          <CheckCircle className="w-4 h-4 text-blue-500" />
          <span className="text-sm text-blue-700 dark:text-blue-300">Synced 2 min ago</span>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Total Customers', value: metrics.totalCustomers.toLocaleString(), icon: Users, color: 'bg-blue-600' },
          { label: 'Total Deposits', value: formatCurrency(metrics.totalDeposits), icon: DollarSign, color: 'bg-green-600' },
          { label: 'Total Loans', value: formatCurrency(metrics.totalLoans), icon: CreditCard, color: 'bg-purple-600' },
          { label: 'Branches', value: metrics.branches.toString(), icon: Building2, color: 'bg-amber-600' },
          { label: 'NPL Ratio', value: `${metrics.nplRatio}%`, icon: AlertTriangle, color: 'bg-red-600' },
        ].map((m, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            tabIndex="0" className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">{m.label}</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{m.value}</p>
              </div>
              <div className={`p-2 rounded-lg ${m.color}`}>
                <m.icon className="w-4 h-4 text-white" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Deposits & Loans Trend</h3>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={monthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={formatCurrency} />
              <Tooltip formatter={(v) => formatCurrency(v)} />
              <Legend />
              <Area type="monotone" dataKey="deposits" name="Deposits" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} />
              <Area type="monotone" dataKey="loans" name="Loans" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.1} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Account Types</h3>
          <ResponsiveContainer width="100%" height={260}>
            <RechartPie>
              <Pie data={accountTypeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, value }) => `${name}: ${(value / 1000).toFixed(1)}K`}>
                {accountTypeData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </RechartPie>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Branch Performance */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Branch Performance</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-3 px-4 text-gray-500 font-medium">Branch</th>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">Region</th>
                <th className="text-right py-3 px-4 text-gray-500 font-medium">Customers</th>
                <th className="text-right py-3 px-4 text-gray-500 font-medium">Total Deposits</th>
              </tr>
            </thead>
            <tbody>
              {branches.map((branch, i) => (
                <tr key={i} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="py-3 px-4 font-medium text-gray-900 dark:text-white">{branch.name}</td>
                  <td className="py-3 px-4 text-gray-600 dark:text-gray-300">{branch.region}</td>
                  <td className="py-3 px-4 text-right text-gray-600 dark:text-gray-300">{branch.customerCount.toLocaleString()}</td>
                  <td className="py-3 px-4 text-right font-semibold text-gray-900 dark:text-white">{formatCurrency(branch.totalDeposits)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer List */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Core Banking Customers</h3>
        <div className="space-y-3">
          {customers.map((customer) => (
            <div key={customer.externalId} onClick={() => selectCustomer(customer)}
              className={`p-4 rounded-lg border cursor-pointer transition hover:shadow ${
                selectedCustomer?.externalId === customer.externalId
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700'
              }`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">{customer.fullName}</p>
                  <p className="text-sm text-gray-500">{customer.accountType} • {customer.accountNumber} • {customer.branch}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-gray-900 dark:text-white">{formatCurrency(customer.balance)}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    customer.kycStatus === 'Verified' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>{customer.kycStatus} (L{customer.kycLevel})</span>
                </div>
              </div>
              {selectedCustomer?.externalId === customer.externalId && transactions.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Recent Transactions</p>
                  {transactions.map(txn => (
                    <div key={txn.id} className="flex items-center justify-between py-2 text-sm">
                      <div>
                        <p className="text-gray-900 dark:text-white">{txn.description}</p>
                        <p className="text-xs text-gray-500">{txn.date} • {txn.channel}</p>
                      </div>
                      <p className={`font-medium ${txn.type === 'Credit' ? 'text-green-600' : 'text-red-600'}`}>
                        {txn.type === 'Credit' ? '+' : '-'}{formatCurrency(txn.amount)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default CoreBankingView
