import React, { useState, useEffect } from 'react'
import { 
  Users, 
  CreditCard, 
  TrendingUp, 
  AlertTriangle,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  CheckCircle,
  XCircle,
  Wallet,
  Target,
  Award,
  MapPin
} from 'lucide-react'
import { LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface DashboardStats {
  totalAgents: number
  activeAgents: number
  totalTransactions: number
  transactionVolume: number
  commission: number
  floatBalance: number
  pendingTransactions: number
  successRate: number
}

interface Transaction {
  id: string
  type: 'deposit' | 'withdrawal' | 'transfer'
  amount: number
  customer: string
  status: 'completed' | 'pending' | 'failed'
  timestamp: string
  location: string
}

interface Agent {
  id: string
  name: string
  level: string
  location: string
  status: 'active' | 'inactive'
  transactions: number
  commission: number
}

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalAgents: 156,
    activeAgents: 142,
    totalTransactions: 2847,
    transactionVolume: 45678900,
    commission: 234567,
    floatBalance: 1234567,
    pendingTransactions: 23,
    successRate: 98.5
  })

  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([
    {
      id: 'TXN001',
      type: 'deposit',
      amount: 50000,
      customer: 'Adebayo Ogundimu',
      status: 'completed',
      timestamp: '2024-01-15 14:30:00',
      location: 'Lagos'
    },
    {
      id: 'TXN002',
      type: 'withdrawal',
      amount: 25000,
      customer: 'Fatima Aliyu',
      status: 'pending',
      timestamp: '2024-01-15 14:25:00',
      location: 'Kano'
    },
    {
      id: 'TXN003',
      type: 'transfer',
      amount: 75000,
      customer: 'Chinedu Okoro',
      status: 'completed',
      timestamp: '2024-01-15 14:20:00',
      location: 'Abuja'
    },
    {
      id: 'TXN004',
      type: 'deposit',
      amount: 100000,
      customer: 'Aisha Mohammed',
      status: 'failed',
      timestamp: '2024-01-15 14:15:00',
      location: 'Port Harcourt'
    }
  ])

  const [topAgents, setTopAgents] = useState<Agent[]>([
    {
      id: 'AGT001',
      name: 'Olumide Adebayo',
      level: 'Super Agent',
      location: 'Lagos',
      status: 'active',
      transactions: 234,
      commission: 45600
    },
    {
      id: 'AGT002',
      name: 'Hauwa Garba',
      level: 'Agent',
      location: 'Kano',
      status: 'active',
      transactions: 189,
      commission: 38900
    },
    {
      id: 'AGT003',
      name: 'Emeka Okafor',
      level: 'Agent',
      location: 'Enugu',
      status: 'active',
      transactions: 167,
      commission: 32400
    }
  ])

  // Mock data for charts
  const transactionData = [
    { name: 'Mon', deposits: 120000, withdrawals: 80000, transfers: 45000 },
    { name: 'Tue', deposits: 150000, withdrawals: 95000, transfers: 52000 },
    { name: 'Wed', deposits: 180000, withdrawals: 110000, transfers: 48000 },
    { name: 'Thu', deposits: 140000, withdrawals: 85000, transfers: 55000 },
    { name: 'Fri', deposits: 200000, withdrawals: 120000, transfers: 60000 },
    { name: 'Sat', deposits: 160000, withdrawals: 100000, transfers: 42000 },
    { name: 'Sun', deposits: 130000, withdrawals: 75000, transfers: 38000 }
  ]

  const performanceData = [
    { name: 'Jan', commission: 180000, target: 200000 },
    { name: 'Feb', commission: 220000, target: 200000 },
    { name: 'Mar', commission: 195000, target: 200000 },
    { name: 'Apr', commission: 240000, target: 220000 },
    { name: 'May', commission: 280000, target: 250000 },
    { name: 'Jun', commission: 310000, target: 280000 }
  ]

  const regionData = [
    { name: 'Lagos', value: 35, color: '#0088FE' },
    { name: 'Kano', value: 25, color: '#00C49F' },
    { name: 'Abuja', value: 20, color: '#FFBB28' },
    { name: 'Port Harcourt', value: 12, color: '#FF8042' },
    { name: 'Others', value: 8, color: '#8884D8' }
  ]

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return null
    }
  }

  const getTransactionTypeColor = (type: string) => {
    switch (type) {
      case 'deposit':
        return 'text-green-600 bg-green-100'
      case 'withdrawal':
        return 'text-red-600 bg-red-100'
      case 'transfer':
        return 'text-blue-600 bg-blue-100'
      default:
        return 'text-gray-600 bg-gray-100'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Agent Dashboard</h1>
            <p className="text-gray-600 mt-1">Welcome back, John Doe - Super Agent</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <p className="text-sm text-gray-500">Last Login</p>
              <p className="text-sm font-medium text-gray-900">Today, 2:30 PM</p>
            </div>
            <div className="h-12 w-12 bg-blue-600 rounded-full flex items-center justify-center">
              <span className="text-white font-medium">JD</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Users className="h-8 w-8 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Network Agents</p>
              <div className="flex items-baseline">
                <p className="text-2xl font-semibold text-gray-900">{stats.activeAgents}</p>
                <p className="ml-2 text-sm text-gray-500">/ {stats.totalAgents}</p>
              </div>
              <p className="text-sm text-green-600 flex items-center">
                <TrendingUp className="h-4 w-4 mr-1" />
                +12% from last month
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <CreditCard className="h-8 w-8 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Today's Transactions</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.totalTransactions.toLocaleString()}</p>
              <p className="text-sm text-green-600 flex items-center">
                <ArrowUpRight className="h-4 w-4 mr-1" />
                +8.2% from yesterday
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <DollarSign className="h-8 w-8 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Commission Earned</p>
              <p className="text-2xl font-semibold text-gray-900">{formatCurrency(stats.commission)}</p>
              <p className="text-sm text-green-600 flex items-center">
                <TrendingUp className="h-4 w-4 mr-1" />
                +15.3% this month
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Wallet className="h-8 w-8 text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Float Balance</p>
              <p className="text-2xl font-semibold text-gray-900">{formatCurrency(stats.floatBalance)}</p>
              <p className="text-sm text-orange-600 flex items-center">
                <AlertTriangle className="h-4 w-4 mr-1" />
                Low balance alert
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Transaction Volume Chart */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Weekly Transaction Volume</h3>
            <div className="flex items-center space-x-2">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                <span className="text-sm text-gray-600">Deposits</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
                <span className="text-sm text-gray-600">Withdrawals</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                <span className="text-sm text-gray-600">Transfers</span>
              </div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={transactionData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              <Area type="monotone" dataKey="deposits" stackId="1" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.6} />
              <Area type="monotone" dataKey="withdrawals" stackId="1" stroke="#EF4444" fill="#EF4444" fillOpacity={0.6} />
              <Area type="monotone" dataKey="transfers" stackId="1" stroke="#10B981" fill="#10B981" fillOpacity={0.6} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Performance Chart */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Commission vs Target</h3>
            <div className="flex items-center space-x-2">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                <span className="text-sm text-gray-600">Commission</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-gray-400 rounded-full mr-2"></div>
                <span className="text-sm text-gray-600">Target</span>
              </div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={performanceData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              <Bar dataKey="commission" fill="#3B82F6" />
              <Bar dataKey="target" fill="#9CA3AF" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Transactions */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Recent Transactions</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Transaction
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Location
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {recentTransactions.map((transaction) => (
                  <tr key={transaction.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTransactionTypeColor(transaction.type)}`}>
                          {transaction.type}
                        </span>
                        <span className="ml-2 text-sm text-gray-500">{transaction.id}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{transaction.customer}</div>
                      <div className="text-sm text-gray-500">{transaction.timestamp}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(transaction.amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getStatusIcon(transaction.status)}
                        <span className="ml-2 text-sm text-gray-900 capitalize">{transaction.status}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-900">
                        <MapPin className="h-4 w-4 mr-1 text-gray-400" />
                        {transaction.location}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Regional Distribution & Top Agents */}
        <div className="space-y-6">
          {/* Regional Distribution */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Regional Distribution</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={regionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {regionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-4 space-y-2">
              {regionData.map((region) => (
                <div key={region.name} className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div
                      className="w-3 h-3 rounded-full mr-2"
                      style={{ backgroundColor: region.color }}
                    ></div>
                    <span className="text-sm text-gray-600">{region.name}</span>
                  </div>
                  <span className="text-sm font-medium text-gray-900">{region.value}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top Performing Agents */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Performing Agents</h3>
            <div className="space-y-4">
              {topAgents.map((agent, index) => (
                <div key={agent.id} className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="h-8 w-8 bg-blue-600 rounded-full flex items-center justify-center">
                        <span className="text-white text-xs font-medium">{index + 1}</span>
                      </div>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-900">{agent.name}</p>
                      <p className="text-xs text-gray-500">{agent.level} • {agent.location}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">{formatCurrency(agent.commission)}</p>
                    <p className="text-xs text-gray-500">{agent.transactions} txns</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard

