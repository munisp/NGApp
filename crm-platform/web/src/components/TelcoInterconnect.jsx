import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Globe, ArrowRight, DollarSign, TrendingUp, Activity, AlertTriangle,
  CheckCircle, Clock, BarChart3, ArrowUpRight, ArrowDownRight
} from 'lucide-react'
import { AreaChart, Area, BarChart, Bar, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { useTenant } from '../contexts/TenantContext'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { useApiData } from '@/hooks/useApiData'
import { apiClient } from '@/lib/apiClient'

const seedData = {
  'aerotel': {
    totalSettlements: '$42.8M',
    pendingSettlements: '$8.4M',
    roamingRevenue: '$12.2M',
    interconnectPartners: 28,
    avgSettlementDays: 14,
    disputeRate: 1.2,
    partners: [
      { name: 'MTN Nigeria', type: 'Domestic', trafficIn: 4200000000, trafficOut: 3800000000, netSettlement: '$2.4M', status: 'settled', lastSettled: '3 days ago' },
      { name: 'Airtel NG', type: 'Domestic', trafficIn: 3100000000, trafficOut: 2900000000, netSettlement: '$1.2M', status: 'settled', lastSettled: '5 days ago' },
      { name: 'Glo Mobile', type: 'Domestic', trafficIn: 1800000000, trafficOut: 2200000000, netSettlement: '-$1.8M', status: 'pending', lastSettled: '12 days ago' },
      { name: 'Vodafone UK', type: 'Roaming', trafficIn: 180000000, trafficOut: 420000000, netSettlement: '$3.2M', status: 'settled', lastSettled: '7 days ago' },
      { name: 'Orange France', type: 'Roaming', trafficIn: 95000000, trafficOut: 280000000, netSettlement: '$2.1M', status: 'pending', lastSettled: '14 days ago' },
      { name: 'Safaricom KE', type: 'Roaming', trafficIn: 120000000, trafficOut: 180000000, netSettlement: '$0.8M', status: 'settled', lastSettled: '4 days ago' },
    ],
    monthlyTrend: [
      { month: 'Jan', inbound: 28.4, outbound: 24.2, net: 4.2 },
      { month: 'Feb', inbound: 30.1, outbound: 25.8, net: 4.3 },
      { month: 'Mar', inbound: 32.5, outbound: 27.1, net: 5.4 },
      { month: 'Apr', inbound: 34.2, outbound: 28.9, net: 5.3 },
      { month: 'May', inbound: 36.8, outbound: 30.4, net: 6.4 },
      { month: 'Jun', inbound: 38.4, outbound: 32.1, net: 6.3 },
    ],
    disputes: [
      { id: 'D-2841', partner: 'Glo Mobile', amount: '$420K', reason: 'Volume discrepancy — CDR mismatch', status: 'under_review', filed: '8 days ago' },
      { id: 'D-2839', partner: 'Orange France', amount: '$182K', reason: 'Roaming rate disagreement — Q2 2025', status: 'escalated', filed: '21 days ago' },
    ],
  },
  'netwave': {
    totalSettlements: '$8.2M',
    pendingSettlements: '$2.1M',
    roamingRevenue: '$1.8M',
    interconnectPartners: 12,
    avgSettlementDays: 18,
    disputeRate: 2.1,
    partners: [
      { name: 'MTN Nigeria', type: 'Domestic', trafficIn: 920000000, trafficOut: 1100000000, netSettlement: '-$0.8M', status: 'pending', lastSettled: '10 days ago' },
      { name: 'Airtel NG', type: 'Domestic', trafficIn: 680000000, trafficOut: 720000000, netSettlement: '-$0.2M', status: 'settled', lastSettled: '6 days ago' },
      { name: 'Aerotel', type: 'Domestic', trafficIn: 580000000, trafficOut: 520000000, netSettlement: '$0.4M', status: 'settled', lastSettled: '4 days ago' },
    ],
    monthlyTrend: [
      { month: 'Jan', inbound: 5.2, outbound: 6.1, net: -0.9 },
      { month: 'Feb', inbound: 5.8, outbound: 6.4, net: -0.6 },
      { month: 'Mar', inbound: 6.1, outbound: 6.8, net: -0.7 },
      { month: 'Apr', inbound: 6.5, outbound: 7.0, net: -0.5 },
      { month: 'May', inbound: 6.9, outbound: 7.2, net: -0.3 },
      { month: 'Jun', inbound: 7.2, outbound: 7.4, net: -0.2 },
    ],
    disputes: [
      { id: 'D-412', partner: 'MTN Nigeria', amount: '$95K', reason: 'CDR discrepancy — December billing', status: 'under_review', filed: '15 days ago' },
    ],
  },
}

const formatMinutes = (n) => {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B min`
  if (n >= 1e6) return `${(n / 1e6).toFixed(0)}M min`
  return `${(n / 1e3).toFixed(0)}K min`
}

const TelcoInterconnect = () => {
  const { data: _apiData, isLoading: _apiLoading, isUsingFallback } = useApiData('telcointerconnect', () => apiClient.dashboard.metrics(), { fallback: seedData })
  const { tenant } = useTenant()
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState('partners')
  const data = seedData[tenant?.slug] || seedData['aerotel']

  return (
    <div role="region" aria-label="TelcoInterconnect" className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {t('nav.telcoInterconnect', 'Interconnect & Settlement')}
          </h1>
          <p className="text-gray-500 dark:text-gray-400">Carrier settlements, roaming agreements & dispute management</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Total Settlements', value: data.totalSettlements, icon: DollarSign, color: 'green' },
          { label: 'Pending', value: data.pendingSettlements, icon: Clock, color: 'yellow' },
          { label: 'Roaming Revenue', value: data.roamingRevenue, icon: Globe, color: 'purple' },
          { label: 'Partners', value: data.interconnectPartners, icon: ArrowRight, color: 'blue' },
          { label: 'Avg Settlement', value: `${data.avgSettlementDays} days`, icon: Activity, color: 'cyan' },
          { label: 'Dispute Rate', value: `${data.disputeRate}%`, icon: AlertTriangle, color: 'red' },
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
        {['partners', 'trends', 'disputes'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm rounded-md capitalize transition-colors ${
              activeTab === tab ? 'bg-white dark:bg-gray-700 shadow-sm font-medium text-gray-900 dark:text-gray-100'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}>
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'partners' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  {['Partner', 'Type', 'Traffic In', 'Traffic Out', 'Net Settlement', 'Status', 'Last Settled'].map(h => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {data.partners.map((p, i) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">{p.name}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${p.type === 'Roaming' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                        {p.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{formatMinutes(p.trafficIn)}</td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{formatMinutes(p.trafficOut)}</td>
                    <td className={`px-6 py-4 font-medium ${p.netSettlement.startsWith('-') ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                      {p.netSettlement}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${p.status === 'settled' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500 dark:text-gray-400 text-sm">{p.lastSettled}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'trends' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Monthly Settlement Trends ($M)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data.monthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={(v) => `$${v}M`} />
              <Tooltip formatter={(v) => `$${v}M`} />
              <Legend />
              <Area type="monotone" dataKey="inbound" stroke="#10b981" fill="#10b98140" name="Inbound" />
              <Area type="monotone" dataKey="outbound" stroke="#ef4444" fill="#ef444440" name="Outbound" />
              <Area type="monotone" dataKey="net" stroke="#3b82f6" fill="#3b82f640" name="Net" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {activeTab === 'disputes' && (
        <div className="space-y-3">
          {data.disputes.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-8 text-center shadow-sm border border-gray-200 dark:border-gray-700">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <p className="text-gray-600 dark:text-gray-300">No active disputes</p>
            </div>
          ) : data.disputes.map(d => (
            <div key={d.id} className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border-l-4 border-l-yellow-500 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm text-blue-600 dark:text-blue-400">{d.id}</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{d.partner}</span>
                  <span className="text-lg font-bold text-red-600 dark:text-red-400">{d.amount}</span>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${d.status === 'escalated' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'}`}>
                  {d.status.replace('_', ' ')}
                </span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300">{d.reason}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Filed {d.filed}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default TelcoInterconnect
