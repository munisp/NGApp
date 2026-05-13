import { useState } from 'react'
import {
  BarChart3, Activity, DollarSign, Zap, TrendingUp, Clock, AlertTriangle,
  Download, FileText, ArrowUp, ArrowDown
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell } from 'recharts'
import { useTenant } from '../contexts/TenantContext'
import { LoadingState, ErrorState, EmptyState, FallbackBadge, ExportButton } from '@/components/ui/DataStates'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { useApiData } from '@/hooks/useApiData'
import { apiClient } from '@/lib/apiClient'

const TIER_QUOTAS = {
  trial: { monthly: 10000, daily: 500, rps: 10, bandwidth: 1, price: 0, overage: 0 },
  growth: { monthly: 500000, daily: 25000, rps: 100, bandwidth: 50, price: 299, overage: 0.50 },
  enterprise: { monthly: 10000000, daily: 500000, rps: 1000, bandwidth: 500, price: 1499, overage: 0.25 },
}

const TENANT_USAGE = {
  'tenant-acme-bank': { calls: 3_842_100, bandwidth: 45.2, avgLatency: 42, errorRate: 1.8, tier: 'enterprise' },
  'tenant-quickcash': { calls: 285_400, bandwidth: 12.8, avgLatency: 38, errorRate: 2.3, tier: 'growth' },
  'tenant-swiftremit': { calls: 2_156_800, bandwidth: 38.5, avgLatency: 55, errorRate: 1.2, tier: 'enterprise' },
  'tenant-nextgen-mfb': { calls: 3_420, bandwidth: 0.12, avgLatency: 65, errorRate: 4.1, tier: 'trial' },
}

const genDaily = (base, days = 30) => {
  const data = []
  const now = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const variation = 1 + Math.sin(i * 0.7) * 0.2
    data.push({
      date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      calls: Math.round(base / days * variation),
      errors: Math.round(base / days * variation * 0.02),
      bandwidth: +(base / days * variation * 0.000012).toFixed(2),
    })
  }
  return data
}

const ENDPOINT_BREAKDOWN = {
  'tenant-acme-bank': [
    { endpoint: '/v1/customers', method: 'GET', calls: 1_250_000, avgMs: 35, errorPct: 0.8, bwMB: 4200 },
    { endpoint: '/v1/banking/transactions', method: 'POST', calls: 890_000, avgMs: 85, errorPct: 1.5, bwMB: 7800 },
    { endpoint: '/v1/banking/transactions', method: 'GET', calls: 720_000, avgMs: 28, errorPct: 0.5, bwMB: 3100 },
    { endpoint: '/v1/analytics/dashboard', method: 'GET', calls: 410_000, avgMs: 55, errorPct: 0.3, bwMB: 6200 },
    { endpoint: '/v1/campaigns', method: 'GET', calls: 280_000, avgMs: 22, errorPct: 0.2, bwMB: 1200 },
    { endpoint: '/v1/agents', method: 'GET', calls: 192_100, avgMs: 30, errorPct: 1.0, bwMB: 850 },
    { endpoint: '/v1/remittance/transfers', method: 'POST', calls: 100_000, avgMs: 150, errorPct: 3.2, bwMB: 2400 },
  ],
  'tenant-quickcash': [
    { endpoint: '/v1/agents', method: 'GET', calls: 98_000, avgMs: 25, errorPct: 1.5, bwMB: 420 },
    { endpoint: '/v1/agents/transactions', method: 'POST', calls: 85_000, avgMs: 65, errorPct: 2.8, bwMB: 1200 },
    { endpoint: '/v1/customers', method: 'GET', calls: 62_000, avgMs: 30, errorPct: 0.9, bwMB: 280 },
    { endpoint: '/v1/banking/transactions', method: 'GET', calls: 40_400, avgMs: 35, errorPct: 1.1, bwMB: 180 },
  ],
  'tenant-swiftremit': [
    { endpoint: '/v1/remittance/transfers', method: 'POST', calls: 820_000, avgMs: 140, errorPct: 1.0, bwMB: 9800 },
    { endpoint: '/v1/remittance/corridors', method: 'GET', calls: 650_000, avgMs: 18, errorPct: 0.2, bwMB: 1800 },
    { endpoint: '/v1/customers', method: 'GET', calls: 410_000, avgMs: 32, errorPct: 0.8, bwMB: 1400 },
    { endpoint: '/v1/banking/transactions', method: 'GET', calls: 276_800, avgMs: 40, errorPct: 1.5, bwMB: 1100 },
  ],
  'tenant-nextgen-mfb': [
    { endpoint: '/v1/customers', method: 'GET', calls: 1_800, avgMs: 45, errorPct: 3.0, bwMB: 8 },
    { endpoint: '/v1/customers', method: 'POST', calls: 1_200, avgMs: 120, errorPct: 5.5, bwMB: 15 },
    { endpoint: '/v1/banking/transactions', method: 'GET', calls: 420, avgMs: 55, errorPct: 2.0, bwMB: 2 },
  ],
}

const STATUS_COLORS = { '2xx': '#10b981', '4xx': '#f59e0b', '5xx': '#ef4444' }

const UsageMetering = () => {
  const { data: _apiData, isLoading: _apiLoading, isUsingFallback } = useApiData('usagemetering', () => apiClient.dashboard.metrics(), { fallback: TIER_QUOTAS })
  const { tenant, tenantId } = useTenant()
  const [tab, setTab] = useState('overview')
  const usage = TENANT_USAGE[tenantId] || TENANT_USAGE['tenant-nextgen-mfb']
  const quota = TIER_QUOTAS[usage.tier]
  const dailyData = genDaily(usage.calls)
  const endpoints = ENDPOINT_BREAKDOWN[tenantId] || ENDPOINT_BREAKDOWN['tenant-nextgen-mfb']
  const utilization = (usage.calls / quota.monthly * 100)
  const overage = Math.max(0, usage.calls - quota.monthly)
  const overageCost = (overage / 1000) * quota.overage
  const totalCost = quota.price + overageCost

  const statusData = [
    { name: '2xx', value: Math.round(usage.calls * (1 - usage.errorRate / 100)) },
    { name: '4xx', value: Math.round(usage.calls * usage.errorRate / 200) },
    { name: '5xx', value: Math.round(usage.calls * usage.errorRate / 200) },
  ]

  const tabs = ['overview', 'endpoints', 'billing']

  return (
    <div role="region" aria-label="UsageMetering"  className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl">
            <BarChart3 className="w-7 h-7 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Usage & Metering</h1>
            <p className="text-gray-500 dark:text-gray-400">API usage tracking for {tenant?.name} ({usage.tier} tier)</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1 w-fit">
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-md text-sm font-medium capitalize transition ${tab === t ? 'bg-white dark:bg-gray-600 shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <>
          {/* Quota Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div tabIndex="0" className="bg-white dark:bg-gray-800 rounded-xl border p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-500">API Calls</span>
                <Activity className="w-4 h-4 text-indigo-500" />
              </div>
              <p className="text-2xl font-bold">{(usage.calls / 1_000_000).toFixed(1)}M</p>
              <div className="mt-2 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div className={`h-2 rounded-full ${utilization > 90 ? 'bg-red-500' : utilization > 70 ? 'bg-amber-500' : 'bg-indigo-500'}`}
                  style={{ width: `${Math.min(utilization, 100)}%` }} />
              </div>
              <p className="text-xs text-gray-400 mt-1">{utilization.toFixed(1)}% of {(quota.monthly / 1_000_000).toFixed(0)}M limit</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-500">Bandwidth</span>
                <TrendingUp className="w-4 h-4 text-green-500" />
              </div>
              <p className="text-2xl font-bold">{usage.bandwidth} GB</p>
              <div className="mt-2 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div className="h-2 rounded-full bg-green-500" style={{ width: `${(usage.bandwidth / quota.bandwidth * 100).toFixed(0)}%` }} />
              </div>
              <p className="text-xs text-gray-400 mt-1">{(usage.bandwidth / quota.bandwidth * 100).toFixed(0)}% of {quota.bandwidth} GB</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-500">Avg Latency</span>
                <Clock className="w-4 h-4 text-amber-500" />
              </div>
              <p className="text-2xl font-bold">{usage.avgLatency}ms</p>
              <p className="text-xs text-gray-400 mt-1">P95: {Math.round(usage.avgLatency * 2.1)}ms / P99: {Math.round(usage.avgLatency * 3.5)}ms</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-500">Error Rate</span>
                <AlertTriangle className={`w-4 h-4 ${usage.errorRate > 3 ? 'text-red-500' : 'text-green-500'}`} />
              </div>
              <p className="text-2xl font-bold">{usage.errorRate}%</p>
              <p className="text-xs text-gray-400 mt-1">{Math.round(usage.calls * usage.errorRate / 100).toLocaleString()} failed requests</p>
            </div>
          </div>

          {/* Daily Usage Chart */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border p-4">
            <h3 className="font-semibold mb-4">Daily API Calls (30 days)</h3>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Area type="monotone" dataKey="calls" stroke="#6366f1" fill="#6366f180" name="Calls" />
                <Area type="monotone" dataKey="errors" stroke="#ef4444" fill="#ef444440" name="Errors" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Status Distribution */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl border p-4">
              <h3 className="font-semibold mb-4">Response Status Distribution</h3>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {statusData.map((entry, i) => (
                      <Cell key={i} fill={STATUS_COLORS[entry.name]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border p-4">
              <h3 className="font-semibold mb-4">Quota Summary</h3>
              <div className="space-y-3">
                {[
                  { label: 'Monthly API Calls', used: usage.calls, limit: quota.monthly },
                  { label: 'Daily Calls (today)', used: Math.round(usage.calls / 30), limit: quota.daily },
                  { label: 'Bandwidth', used: usage.bandwidth, limit: quota.bandwidth, unit: 'GB' },
                ].map((q, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-sm">
                      <span>{q.label}</span>
                      <span className="font-medium">{q.used.toLocaleString()} / {q.limit.toLocaleString()} {q.unit || ''}</span>
                    </div>
                    <div className="mt-1 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                      <div className={`h-1.5 rounded-full ${q.used / q.limit > 0.9 ? 'bg-red-500' : 'bg-indigo-500'}`}
                        style={{ width: `${Math.min(q.used / q.limit * 100, 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {tab === 'endpoints' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Endpoint</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Method</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Calls</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Avg Latency</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Error Rate</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Bandwidth</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {endpoints.map((ep, i) => (
                <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                  <td className="px-4 py-3 font-mono text-sm">{ep.endpoint}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${ep.method === 'GET' ? 'bg-green-100 text-green-700' : ep.method === 'POST' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                      {ep.method}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-medium">{ep.calls.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-sm">{ep.avgMs}ms</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`text-sm ${ep.errorPct > 3 ? 'text-red-600 font-medium' : 'text-gray-600'}`}>{ep.errorPct}%</span>
                  </td>
                  <td className="px-4 py-3 text-right text-sm">{ep.bwMB >= 1000 ? `${(ep.bwMB / 1000).toFixed(1)} GB` : `${ep.bwMB} MB`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'billing' && (
        <div className="space-y-4">
          {/* Current Invoice */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Current Period Invoice</h3>
              <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm font-medium">Draft</span>
            </div>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium">Description</th>
                    <th className="px-4 py-3 text-right text-sm font-medium">Quantity</th>
                    <th className="px-4 py-3 text-right text-sm font-medium">Unit Price</th>
                    <th className="px-4 py-3 text-right text-sm font-medium">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  <tr>
                    <td className="px-4 py-3">{usage.tier.charAt(0).toUpperCase() + usage.tier.slice(1)} Plan - Monthly Subscription</td>
                    <td className="px-4 py-3 text-right">1</td>
                    <td className="px-4 py-3 text-right">${quota.price.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-medium">${quota.price.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3">API Calls ({(quota.monthly / 1_000_000).toFixed(0)}M included)</td>
                    <td className="px-4 py-3 text-right">{Math.min(usage.calls, quota.monthly).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">$0.00</td>
                    <td className="px-4 py-3 text-right font-medium">$0.00</td>
                  </tr>
                  {overage > 0 && (
                    <tr className="bg-red-50 dark:bg-red-900/10">
                      <td className="px-4 py-3 text-red-700">Overage API Calls (${quota.overage}/1,000)</td>
                      <td className="px-4 py-3 text-right text-red-700">{overage.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-red-700">${(quota.overage / 1000).toFixed(4)}</td>
                      <td className="px-4 py-3 text-right font-medium text-red-700">${overageCost.toFixed(2)}</td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 dark:bg-gray-700 font-bold">
                    <td colSpan={3} className="px-4 py-3 text-right">Total</td>
                    <td className="px-4 py-3 text-right text-lg">${totalCost.toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Tier Comparison */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border p-6">
            <h3 className="text-lg font-semibold mb-4">Plan Comparison</h3>
            <div className="grid grid-cols-3 gap-4">
              {Object.entries(TIER_QUOTAS).map(([tier, q]) => (
                <div key={tier} className={`p-4 rounded-lg border-2 ${tier === usage.tier ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-gray-200'}`}>
                  <h4 className="font-bold text-lg capitalize">{tier}</h4>
                  <p className="text-2xl font-bold mt-1">${q.price}<span className="text-sm font-normal text-gray-500">/mo</span></p>
                  <ul className="mt-3 space-y-1 text-sm text-gray-600">
                    <li>{(q.monthly / 1000).toLocaleString()}K API calls/mo</li>
                    <li>{q.rps} req/sec</li>
                    <li>{q.bandwidth} GB bandwidth</li>
                    <li>${q.overage}/1K overage</li>
                  </ul>
                  {tier === usage.tier && <span className="mt-2 inline-block text-xs font-medium text-indigo-600">Current Plan</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default UsageMetering
