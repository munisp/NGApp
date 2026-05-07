import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  Target,
  Calendar,
  Download,
  Filter,
  RefreshCw,
  Eye,
  ArrowUpRight,
  ArrowDownRight,
  PieChart,
  LineChart,
  Activity,
  Zap,
  Award,
  Clock
} from 'lucide-react'
import {
  BarChart,
  Bar,
  LineChart as RechartsLineChart,
  Line,
  AreaChart,
  Area,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  Scatter,
  ScatterChart,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts'
import { LoadingState, ErrorState, EmptyState, FallbackBadge, ExportButton } from '@/components/ui/DataStates'
import { useTranslation } from '@/lib/i18n/useTranslation'

const Analytics = () => {
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState('30d')
  const [activeMetric, setActiveMetric] = useState('revenue')
  const [refreshing, setRefreshing] = useState(false)

  // Mock analytics data
  const [analyticsData, setAnalyticsData] = useState({
    kpis: {
      totalRevenue: 2847392,
      totalCustomers: 12847,
      conversionRate: 24.8,
      avgDealSize: 15420,
      customerLifetimeValue: 45600,
      churnRate: 3.2,
      monthlyRecurringRevenue: 234500,
      customerAcquisitionCost: 1250
    },
    trends: {
      revenue: 12.5,
      customers: 8.3,
      conversion: -2.1,
      dealSize: 5.7,
      clv: 15.2,
      churn: -8.4,
      mrr: 18.7,
      cac: -12.3
    },
    revenueData: [
      { month: 'Jan', revenue: 245000, target: 250000, customers: 1200, deals: 45 },
      { month: 'Feb', revenue: 267000, target: 260000, customers: 1350, deals: 52 },
      { month: 'Mar', revenue: 289000, target: 280000, customers: 1480, deals: 58 },
      { month: 'Apr', revenue: 312000, target: 300000, customers: 1620, deals: 64 },
      { month: 'May', revenue: 298000, target: 320000, customers: 1580, deals: 61 },
      { month: 'Jun', revenue: 334000, target: 340000, customers: 1750, deals: 68 }
    ],
    customerSegments: [
      { segment: 'Enterprise', count: 450, revenue: 1250000, color: '#8B5CF6' },
      { segment: 'Professional', count: 1200, revenue: 890000, color: '#3B82F6' },
      { segment: 'Starter', count: 2800, revenue: 420000, color: '#10B981' },
      { segment: 'Trial', count: 1500, revenue: 0, color: '#F59E0B' }
    ],
    salesFunnel: [
      { stage: 'Leads', count: 2500, conversion: 100 },
      { stage: 'Qualified', count: 1875, conversion: 75 },
      { stage: 'Proposal', count: 1125, conversion: 45 },
      { stage: 'Negotiation', count: 562, conversion: 22.5 },
      { stage: 'Closed Won', count: 281, conversion: 11.25 }
    ],
    topProducts: [
      { name: 'Enterprise Suite', revenue: 1450000, units: 145, growth: 15.2 },
      { name: 'Professional Plan', revenue: 980000, units: 245, growth: 8.7 },
      { name: 'Starter Package', revenue: 670000, units: 445, growth: -3.2 },
      { name: 'Custom Solutions', revenue: 1340000, units: 67, growth: 22.1 },
      { name: 'Support Services', revenue: 560000, units: 189, growth: 12.8 }
    ],
    performanceMetrics: [
      { metric: 'Sales Velocity', value: 85, target: 90, unit: 'days' },
      { metric: 'Lead Response Time', value: 2.3, target: 2.0, unit: 'hours' },
      { metric: 'Deal Close Rate', value: 68, target: 70, unit: '%' },
      { metric: 'Customer Satisfaction', value: 4.6, target: 4.5, unit: '/5' },
      { metric: 'Support Resolution', value: 92, target: 95, unit: '%' },
      { metric: 'Upsell Rate', value: 34, target: 40, unit: '%' }
    ],
    geographicData: [
      { region: 'North America', revenue: 1420000, customers: 4500, growth: 12.5 },
      { region: 'Europe', revenue: 890000, customers: 3200, growth: 8.7 },
      { region: 'Asia Pacific', revenue: 650000, customers: 2800, growth: 22.1 },
      { region: 'Latin America', revenue: 320000, customers: 1200, growth: 15.3 },
      { region: 'Middle East & Africa', revenue: 180000, customers: 800, growth: 18.9 }
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

  const MetricCard = ({ title, value, trend, icon: Icon, format = 'number', subtitle }) => {
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
      if (format === 'decimal') {
        return val.toFixed(1)
      }
      return new Intl.NumberFormat('en-US').format(val)
    }

    const isPositive = trend > 0
    const TrendIcon = isPositive ? ArrowUpRight : ArrowDownRight

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ scale: 1.02 }}
        tabIndex="0" className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 cursor-pointer"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
            <Icon className="h-6 w-6 text-white" />
          </div>
          <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-sm font-medium ${
            isPositive 
              ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'
              : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300'
          }`}>
            <TrendIcon className="h-3 w-3" />
            <span>{Math.abs(trend)}%</span>
          </div>
        </div>
        <div>
          <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">{title}</h3>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {formatValue(value)}
          </p>
          {subtitle && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{subtitle}</p>
          )}
        </div>
      </motion.div>
    )
  }

  const PerformanceGauge = ({ metric }) => {
    const percentage = (metric.value / metric.target) * 100
    const isOnTarget = percentage >= 100

    return (
      <div role="region" aria-label="Analytics"  className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium text-gray-900 dark:text-gray-100">{metric.metric}</h4>
          <span className={`text-sm font-medium ${
            isOnTarget ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
          }`}>
            {metric.value}{metric.unit}
          </span>
        </div>
        <div className="relative">
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${
                isOnTarget ? 'bg-green-500' : 'bg-red-500'
              }`}
              style={{ width: `${Math.min(percentage, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mt-1">
            <span>0</span>
            <span>Target: {metric.target}{metric.unit}</span>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Analytics Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Comprehensive business intelligence and performance metrics
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="1y">Last year</option>
          </select>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center space-x-2"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center space-x-2">
            <Download className="h-4 w-4" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Key Performance Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Revenue"
          value={analyticsData.kpis.totalRevenue}
          trend={analyticsData.trends.revenue}
          icon={DollarSign}
          format="currency"
          subtitle="Monthly recurring revenue"
        />
        <MetricCard
          title="Total Customers"
          value={analyticsData.kpis.totalCustomers}
          trend={analyticsData.trends.customers}
          icon={Users}
          subtitle="Active customer base"
        />
        <MetricCard
          title="Conversion Rate"
          value={analyticsData.kpis.conversionRate}
          trend={analyticsData.trends.conversion}
          icon={Target}
          format="percentage"
          subtitle="Lead to customer"
        />
        <MetricCard
          title="Avg Deal Size"
          value={analyticsData.kpis.avgDealSize}
          trend={analyticsData.trends.dealSize}
          icon={Award}
          format="currency"
          subtitle="Per closed deal"
        />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Customer Lifetime Value"
          value={analyticsData.kpis.customerLifetimeValue}
          trend={analyticsData.trends.clv}
          icon={TrendingUp}
          format="currency"
          subtitle="Average CLV"
        />
        <MetricCard
          title="Churn Rate"
          value={analyticsData.kpis.churnRate}
          trend={analyticsData.trends.churn}
          icon={TrendingDown}
          format="percentage"
          subtitle="Monthly churn"
        />
        <MetricCard
          title="Monthly Recurring Revenue"
          value={analyticsData.kpis.monthlyRecurringRevenue}
          trend={analyticsData.trends.mrr}
          icon={Activity}
          format="currency"
          subtitle="Recurring revenue"
        />
        <MetricCard
          title="Customer Acquisition Cost"
          value={analyticsData.kpis.customerAcquisitionCost}
          trend={analyticsData.trends.cac}
          icon={Zap}
          format="currency"
          subtitle="Cost per customer"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trends */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Revenue vs Target
            </h3>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setActiveMetric('revenue')}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                  activeMetric === 'revenue'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                Revenue
              </button>
              <button
                onClick={() => setActiveMetric('customers')}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                  activeMetric === 'customers'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                Customers
              </button>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={analyticsData.revenueData}>
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
              <Legend />
              <Bar
                dataKey={activeMetric}
                fill="#3B82F6"
                radius={[4, 4, 0, 0]}
                name={activeMetric === 'revenue' ? 'Revenue' : 'Customers'}
              />
              {activeMetric === 'revenue' && (
                <Line
                  type="monotone"
                  dataKey="target"
                  stroke="#EF4444"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  name="Target"
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Customer Segments */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Customer Segments
            </h3>
            <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
              <Eye className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            </button>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <RechartsPieChart>
              <Pie
                data={analyticsData.customerSegments}
                cx="50%"
                cy="50%"
                outerRadius={100}
                fill="#8884d8"
                dataKey="count"
                label={({ segment, count }) => `${segment}: ${count}`}
              >
                {analyticsData.customerSegments.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name) => [value, 'Customers']}
                labelFormatter={(label) => `Segment: ${label}`}
              />
            </RechartsPieChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Sales Funnel and Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Funnel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700"
        >
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6">
            Sales Funnel Analysis
          </h3>
          <div className="space-y-4">
            {analyticsData.salesFunnel.map((stage, index) => (
              <div key={stage.stage} className="relative">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {stage.stage}
                  </span>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {stage.count} leads
                    </span>
                    <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                      {stage.conversion}%
                    </span>
                  </div>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-purple-600 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${stage.conversion}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Performance Metrics */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700"
        >
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6">
            Performance Metrics
          </h3>
          <div className="grid grid-cols-1 gap-4">
            {analyticsData.performanceMetrics.map(metric => (
              <PerformanceGauge key={metric.metric} metric={metric} />
            ))}
          </div>
        </motion.div>
      </div>

      {/* Top Products and Geographic Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700"
        >
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6">
            Top Performing Products
          </h3>
          <div className="space-y-4">
            {analyticsData.topProducts.map((product, index) => (
              <div key={product.name} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                    <span className="text-white text-sm font-bold">{index + 1}</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{product.name}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{product.units} units sold</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900 dark:text-gray-100">
                    ${product.revenue.toLocaleString()}
                  </p>
                  <div className="flex items-center space-x-1">
                    {product.growth > 0 ? (
                      <TrendingUp className="h-3 w-3 text-green-600" />
                    ) : (
                      <TrendingDown className="h-3 w-3 text-red-600" />
                    )}
                    <span className={`text-sm font-medium ${
                      product.growth > 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {Math.abs(product.growth)}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Geographic Performance */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700"
        >
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6">
            Geographic Performance
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analyticsData.geographicData} layout="horizontal">
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis type="number" stroke="#6B7280" />
              <YAxis dataKey="region" type="category" stroke="#6B7280" width={120} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#F9FAFB'
                }}
              />
              <Bar dataKey="revenue" fill="#3B82F6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Recent Activity Summary */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700"
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Analytics Summary
          </h3>
          <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
            <Clock className="h-4 w-4" />
            <span>Last updated: {new Date().toLocaleString()}</span>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-2">
              {((analyticsData.kpis.totalRevenue / 3000000) * 100).toFixed(1)}%
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Revenue Goal Achievement</p>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-2">
              {analyticsData.salesFunnel[4].conversion}%
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Overall Conversion Rate</p>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-purple-600 dark:text-purple-400 mb-2">
              {analyticsData.performanceMetrics.filter(m => (m.value / m.target) >= 1).length}
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Metrics On Target</p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

export default Analytics

