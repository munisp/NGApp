import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart3, TrendingUp, Users, DollarSign, Target, Globe, Landmark,
  Building2, RefreshCw, ArrowUpRight, PieChart, Map, Zap, Award
} from 'lucide-react'
import { AreaChart, Area, BarChart, Bar, PieChart as RechartPie, Pie, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend, RadialBarChart, RadialBar } from 'recharts'
import { unifiedCustomerService } from '../services/unifiedCustomerService'
import { coreBankingAdapter } from '../services/coreBankingAdapter'
import { agentBankingAdapter } from '../services/agentBankingAdapter'
import { remittanceAdapter } from '../services/remittanceAdapter'

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#84cc16']

const formatCurrency = (val, symbol = '₦') => {
  if (val >= 1e12) return `${symbol}${(val / 1e12).toFixed(1)}T`
  if (val >= 1e9) return `${symbol}${(val / 1e9).toFixed(1)}B`
  if (val >= 1e6) return `${symbol}${(val / 1e6).toFixed(1)}M`
  if (val >= 1e3) return `${symbol}${(val / 1e3).toFixed(0)}K`
  return `${symbol}${val.toLocaleString()}`
}

const formatNumber = (val) => {
  if (val >= 1e6) return `${(val / 1e6).toFixed(1)}M`
  if (val >= 1e3) return `${(val / 1e3).toFixed(1)}K`
  return val.toLocaleString()
}

const CrossSystemAnalytics = () => {
  const [metrics, setMetrics] = useState(null)
  const [segments, setSegments] = useState([])
  const [crossSell, setCrossSell] = useState([])
  const [cbBranches, setCbBranches] = useState([])
  const [agentRegions, setAgentRegions] = useState([])
  const [corridors, setCorridors] = useState([])
  const [remTrends, setRemTrends] = useState([])
  const [agentPerf, setAgentPerf] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    const [m, seg, cs, br, ar, cor, rt, ap] = await Promise.all([
      unifiedCustomerService.getAggregatedMetrics(),
      unifiedCustomerService.getSegmentBreakdown(),
      unifiedCustomerService.getCrossSellOpportunities(),
      coreBankingAdapter.fetchBranches(),
      agentBankingAdapter.fetchRegionalData(),
      remittanceAdapter.fetchCorridorData(),
      remittanceAdapter.fetchMonthlyTrends(),
      agentBankingAdapter.fetchAgentPerformance(),
    ])
    setMetrics(m)
    setSegments(seg)
    setCrossSell(cs)
    setCbBranches(br)
    setAgentRegions(ar)
    setCorridors(cor)
    setRemTrends(rt)
    setAgentPerf(ap)
    setLoading(false)
  }

  if (loading || !metrics) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    )
  }

  // Customer Lifetime Value by segment
  const clvData = segments.map(s => ({
    segment: s.segment,
    avgValue: s.avgValue,
    count: s.count,
    totalValue: s.value,
    color: s.color,
  }))

  // Geographic data combining branches and agent regions
  const geoData = [
    ...cbBranches.map(b => ({ region: b.name, cbCustomers: b.customerCount, cbDeposits: b.totalDeposits })),
  ]

  // Regional overlap data
  const overlapData = agentRegions.map(r => {
    const branch = cbBranches.find(b => b.name.includes(r.region))
    return {
      region: r.region,
      agentCustomers: r.customers,
      agentVolume: r.volume,
      cbCustomers: branch?.customerCount || 0,
      cbDeposits: branch?.totalDeposits || 0,
    }
  })

  // Combined growth trends
  const combinedTrends = remTrends.map((rt, i) => ({
    month: rt.month,
    remittanceVolume: rt.volume,
    agentVolume: agentPerf[i]?.volume || 0,
    remittanceTxns: rt.transactions,
    agentTxns: agentPerf[i]?.transactions || 0,
  }))

  // Radar chart data for system health
  const healthRadar = [
    { metric: 'Data Quality', value: 87.5 },
    { metric: 'KYC Compliance', value: parseFloat(metrics.kycCompliantRate) },
    { metric: 'Match Rate', value: metrics.matchRate },
    { metric: 'Coverage', value: 78.5 },
    { metric: 'Timeliness', value: 95.2 },
    { metric: 'Completeness', value: 82.3 },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-xl">
            <BarChart3 className="w-7 h-7 text-amber-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Cross-System Analytics</h1>
            <p className="text-gray-500 dark:text-gray-400">Customer lifetime value, cross-sell, geographic insights</p>
          </div>
        </div>
      </div>

      {/* CLV by Segment */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Customer Lifetime Value by Segment</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={clvData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis dataKey="segment" />
              <YAxis tickFormatter={(v) => formatCurrency(v)} />
              <Tooltip formatter={(v, name) => [formatCurrency(v), name === 'avgValue' ? 'Avg CLV' : 'Total Value']} />
              <Legend />
              <Bar dataKey="avgValue" name="Avg CLV" radius={[4, 4, 0, 0]}>
                {clvData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="space-y-3">
            {clvData.map((s, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{s.segment}</p>
                    <p className="text-xs text-gray-500">{formatNumber(s.count)} customers</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-gray-900 dark:text-white">{formatCurrency(s.avgValue)}</p>
                  <p className="text-xs text-gray-500">Total: {formatCurrency(s.totalValue)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Combined Volume Trends */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Cross-System Volume Trends</h3>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={combinedTrends}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            <XAxis dataKey="month" />
            <YAxis tickFormatter={(v) => formatCurrency(v)} />
            <Tooltip formatter={(v) => formatCurrency(v)} />
            <Legend />
            <Area type="monotone" dataKey="remittanceVolume" name="Remittance Volume" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.15} />
            <Area type="monotone" dataKey="agentVolume" name="Agent Banking Volume" stroke="#10b981" fill="#10b981" fillOpacity={0.15} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Geographic & Regional Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Regional Overlap — Core Banking vs Agent</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={overlapData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis dataKey="region" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(v) => formatNumber(v)} />
              <Tooltip formatter={(v) => formatNumber(v)} />
              <Legend />
              <Bar dataKey="cbCustomers" name="Core Banking" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="agentCustomers" name="Agent Banking" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Data Quality Radar</h3>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={healthRadar}>
              <PolarGrid stroke="#374151" />
              <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11 }} />
              <Radar name="Score" dataKey="value" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} />
              <Tooltip />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Corridors & Cross-Sell */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Top Remittance Corridors by Growth</h3>
          <div className="space-y-3">
            {corridors.sort((a, b) => b.growth - a.growth).slice(0, 6).map((cor, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{cor.corridor}</p>
                  <p className="text-xs text-gray-500">{cor.country} — {formatCurrency(cor.volume, '$')} volume</p>
                </div>
                <div className="flex items-center space-x-1 text-green-600">
                  <ArrowUpRight className="w-4 h-4" />
                  <span className="font-bold">{cor.growth}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Cross-Sell Revenue Potential</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={crossSell} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis type="number" tickFormatter={(v) => formatCurrency(v)} />
              <YAxis type="category" dataKey="opportunity" width={180} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => formatCurrency(v)} />
              <Bar dataKey="potentialRevenue" name="Potential Revenue" radius={[0, 4, 4, 0]}>
                {crossSell.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Summary Score Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl p-6 text-white">
          <div className="flex items-center space-x-2 mb-4">
            <Landmark className="w-6 h-6" />
            <h3 className="text-lg font-semibold">Core Banking Score</h3>
          </div>
          <p className="text-4xl font-bold mb-2">92/100</p>
          <div className="space-y-1 text-sm text-blue-100">
            <p>• {formatNumber(metrics.coreBankingCustomers)} customers onboarded</p>
            <p>• {formatCurrency(metrics.totalDeposits)} total deposits</p>
            <p>• 8 branches connected</p>
            <p>• 3.2% NPL ratio</p>
          </div>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-green-700 rounded-xl p-6 text-white">
          <div className="flex items-center space-x-2 mb-4">
            <Users className="w-6 h-6" />
            <h3 className="text-lg font-semibold">Agent Banking Score</h3>
          </div>
          <p className="text-4xl font-bold mb-2">85/100</p>
          <div className="space-y-1 text-sm text-green-100">
            <p>• {formatNumber(metrics.agentBankingCustomers)} customers registered</p>
            <p>• {formatCurrency(metrics.agentBankingVolume)} monthly volume</p>
            <p>• 24 states covered</p>
            <p>• 62.5% rural penetration</p>
          </div>
        </div>
        <div className="bg-gradient-to-br from-purple-500 to-purple-700 rounded-xl p-6 text-white">
          <div className="flex items-center space-x-2 mb-4">
            <Globe className="w-6 h-6" />
            <h3 className="text-lg font-semibold">Remittance Score</h3>
          </div>
          <p className="text-4xl font-bold mb-2">88/100</p>
          <div className="space-y-1 text-sm text-purple-100">
            <p>• {formatNumber(metrics.remittanceSenders)} active senders</p>
            <p>• {formatCurrency(metrics.remittanceVolume, '$')} total volume</p>
            <p>• 8 corridors active</p>
            <p>• 99.2% compliance rate</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CrossSystemAnalytics
