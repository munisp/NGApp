import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Users,
  TrendingUp,
  DollarSign,
  Package,
  Target,
  Calendar,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  MoreHorizontal,
  Plus,
  Filter,
  Download,
  RefreshCw
} from 'lucide-react'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'
import { LoadingState, ErrorState, EmptyState, FallbackBadge, ExportButton } from '@/components/ui/DataStates'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { useApiData } from '@/hooks/useApiData'
import { apiClient } from '@/lib/apiClient'

const Dashboard = () => {
  const { data: _apiData, isLoading: _apiLoading, isUsingFallback } = useApiData('dashboard', () => apiClient.dashboard.metrics(), { fallback: [] })
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState('7d')
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedMetric, setSelectedMetric] = useState(null)
  const [dashboardData, setDashboardData] = useState({
    metrics: {
      totalCustomers: 12847,
      totalRevenue: 2847392,
      activeLeads: 1247,
      inventoryValue: 847392,
      conversionRate: 24.8,
      avgDealSize: 15420
    },
    trends: {
      customers: 12.5,
      revenue: 8.3,
      leads: -2.1,
      inventory: 5.7
    },
    revenueData: [
      { month: 'Jan', revenue: 245000, target: 250000 },
      { month: 'Feb', revenue: 267000, target: 260000 },
      { month: 'Mar', revenue: 289000, target: 280000 },
      { month: 'Apr', revenue: 312000, target: 300000 },
      { month: 'May', revenue: 298000, target: 320000 },
      { month: 'Jun', revenue: 334000, target: 340000 }
    ],
    salesFunnel: [
      { stage: 'Leads', count: 1247, color: '#3B82F6' },
      { stage: 'Qualified', count: 847, color: '#10B981' },
      { stage: 'Proposal', count: 423, color: '#F59E0B' },
      { stage: 'Negotiation', count: 187, color: '#EF4444' },
      { stage: 'Closed Won', count: 92, color: '#8B5CF6' }
    ],
    topProducts: [
      { name: 'Enterprise Suite', revenue: 145000, growth: 15.2 },
      { name: 'Professional Plan', revenue: 98000, growth: 8.7 },
      { name: 'Starter Package', revenue: 67000, growth: -3.2 },
      { name: 'Custom Solutions', revenue: 234000, growth: 22.1 }
    ],
    recentActivities: [
      {
        id: 1,
        type: 'customer',
        title: 'New customer registered',
        description: 'Acme Corp signed up for Enterprise Suite',
        time: '2 minutes ago',
        icon: Users,
        color: 'text-green-600'
      },
      {
        id: 2,
        type: 'deal',
        title: 'Deal closed',
        description: '$45,000 deal with TechStart Inc.',
        time: '15 minutes ago',
        icon: DollarSign,
        color: 'text-blue-600'
      },
      {
        id: 3,
        type: 'inventory',
        title: 'Low stock alert',
        description: 'Professional licenses running low',
        time: '1 hour ago',
        icon: AlertTriangle,
        color: 'text-yellow-600'
      },
      {
        id: 4,
        type: 'lead',
        title: 'New qualified lead',
        description: 'Enterprise prospect from marketing campaign',
        time: '2 hours ago',
        icon: Target,
        color: 'text-purple-600'
      }
    ]
  })

  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => {
      setLoading(false)
    }, 1000)

    return () => clearTimeout(timer)
  }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000))
    setRefreshing(false)
  }

  const MetricCard = ({ title, value, trend, icon: Icon, format = 'number' }) => {
    const formatValue = (val) => {
      if (format === 'currency') {
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0
        }).format(val)
      }
      if (format === 'percentage') {
        return `${val}%`
      }
      return new Intl.NumberFormat('en-US').format(val)
    }

    const isPositive = trend > 0
    const TrendIcon = isPositive ? ArrowUpRight : ArrowDownRight

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        tabIndex="0" className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">
              {formatValue(value)}
            </p>
          </div>
          <div className={`p-3 rounded-full ${
            isPositive ? 'bg-green-100 dark:bg-green-900/20' : 'bg-red-100 dark:bg-red-900/20'
          }`}>
            <Icon className={`h-6 w-6 ${
              isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
            }`} />
          </div>
        </div>
        <div className="flex items-center mt-4">
          <TrendIcon className={`h-4 w-4 ${
            isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
          }`} />
          <span className={`text-sm font-medium ml-1 ${
            isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
          }`}>
            {Math.abs(trend)}%
          </span>
          <span className="text-sm text-gray-600 dark:text-gray-400 ml-2">vs last period</span>
        </div>
      </motion.div>
    )
  }

  const QuickAction = ({ title, description, icon: Icon, color, onClick }) => (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="w-full p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all text-left"
    >
      <div className="flex items-center space-x-3">
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div>
          <h3 className="font-medium text-gray-900 dark:text-gray-100">{title}</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">{description}</p>
        </div>
      </div>
    </motion.button>
  )

  if (loading) {
    return (
      <div role="region" aria-label="Dashboard"  className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Welcome back! Here's what's happening with your business today.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="24h">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center space-x-2"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Customers"
          value={dashboardData.metrics.totalCustomers}
          trend={dashboardData.trends.customers}
          icon={Users}
        />
        <MetricCard
          title="Total Revenue"
          value={dashboardData.metrics.totalRevenue}
          trend={dashboardData.trends.revenue}
          icon={DollarSign}
          format="currency"
        />
        <MetricCard
          title="Active Leads"
          value={dashboardData.metrics.activeLeads}
          trend={dashboardData.trends.leads}
          icon={Target}
        />
        <MetricCard
          title="Inventory Value"
          value={dashboardData.metrics.inventoryValue}
          trend={dashboardData.trends.inventory}
          icon={Package}
          format="currency"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Revenue vs Target
            </h3>
            <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
              <MoreHorizontal className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            </button>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={dashboardData.revenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis dataKey="month" stroke="#6B7280" />
              <YAxis stroke="#6B7280" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#F9FAFB'
                }}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#3B82F6"
                fill="#3B82F6"
                fillOpacity={0.1}
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="target"
                stroke="#EF4444"
                strokeDasharray="5 5"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Sales Funnel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Sales Funnel
            </h3>
            <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
              <MoreHorizontal className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            </button>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dashboardData.salesFunnel} layout="horizontal">
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis type="number" stroke="#6B7280" />
              <YAxis dataKey="stage" type="category" stroke="#6B7280" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#F9FAFB'
                }}
              />
              <Bar dataKey="count" fill="#3B82F6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activities */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Recent Activities
            </h3>
            <button className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
              View all
            </button>
          </div>
          <div className="space-y-4">
            {dashboardData.recentActivities.map((activity) => {
              const Icon = activity.icon
              return (
                <div key={activity.id} className="flex items-start space-x-3">
                  <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                    <Icon className={`h-4 w-4 ${activity.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {activity.title}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {activity.description}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      {activity.time}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700"
        >
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6">
            Quick Actions
          </h3>
          <div className="space-y-3">
            <QuickAction
              title="Add Customer"
              description="Create a new customer record"
              icon={Users}
              color="bg-blue-600"
              onClick={() => console.log('Add customer')}
            />
            <QuickAction
              title="Create Lead"
              description="Add a new sales lead"
              icon={Target}
              color="bg-green-600"
              onClick={() => console.log('Create lead')}
            />
            <QuickAction
              title="Add Product"
              description="Add new inventory item"
              icon={Package}
              color="bg-purple-600"
              onClick={() => console.log('Add product')}
            />
            <QuickAction
              title="Generate Report"
              description="Create analytics report"
              icon={Download}
              color="bg-orange-600"
              onClick={() => console.log('Generate report')}
            />
          </div>
        </motion.div>
      </div>
    </div>
  )
}

export default Dashboard

