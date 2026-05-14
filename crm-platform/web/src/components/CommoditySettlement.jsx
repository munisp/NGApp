import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  DollarSign, Clock, CheckCircle, AlertTriangle, ArrowRight, Activity,
  Shield, FileText, TrendingUp, BarChart3
, Search } from 'lucide-react'
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { useTenant } from '../contexts/TenantContext'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { useApiData } from '@/hooks/useApiData'
import { apiClient } from '@/lib/apiClient'

const seedData = {
  'petromark': {
    totalSettled: '$8.4B',
    pendingSettlement: '$420M',
    failedSettlements: 4,
    avgSettlementDays: 2.4,
    clearingHouses: 8,
    marginCalls: 2,
    settlements: [
      { id: 'S-84201', counterparty: 'Shell Trading', commodity: 'Crude Oil (WTI)', quantity: '120,000 bbl', amount: '$8.98M', settlementDate: '2025-06-05', status: 'settled', method: 'Physical' },
      { id: 'S-84202', counterparty: 'Vitol Group', commodity: 'Natural Gas', quantity: '500,000 MMBtu', amount: '$1.64M', settlementDate: '2025-06-06', status: 'pending', method: 'Cash' },
      { id: 'S-84203', counterparty: 'NNPC Trading', commodity: 'Crude Oil (Bonny Light)', quantity: '250,000 bbl', amount: '$19.25M', settlementDate: '2025-06-04', status: 'settled', method: 'Physical' },
      { id: 'S-84204', counterparty: 'Trafigura', commodity: 'Gold', quantity: '2,400 oz', amount: '$5.57M', settlementDate: '2025-06-07', status: 'pending', method: 'Cash' },
      { id: 'S-84205', counterparty: 'Glencore NG', commodity: 'Copper', quantity: '800 MT', amount: '$7.61M', settlementDate: '2025-06-03', status: 'settled', method: 'Physical' },
      { id: 'S-84206', counterparty: 'Oando Trading', commodity: 'Crude Oil (Brent)', quantity: '80,000 bbl', amount: '$6.25M', settlementDate: '2025-06-08', status: 'failed', method: 'Physical' },
    ],
    weeklyVolume: [
      { week: 'W1', physical: 1200, cash: 3400, total: 4600 },
      { week: 'W2', physical: 1400, cash: 3800, total: 5200 },
      { week: 'W3', physical: 1100, cash: 4200, total: 5300 },
      { week: 'W4', physical: 1600, cash: 3900, total: 5500 },
    ],
    marginRequirements: [
      { exchange: 'NYMEX', initialMargin: '$42M', maintenanceMargin: '$32M', currentMargin: '$38M', status: 'adequate' },
      { exchange: 'LME', initialMargin: '$28M', maintenanceMargin: '$21M', currentMargin: '$24M', status: 'adequate' },
      { exchange: 'ICE', initialMargin: '$18M', maintenanceMargin: '$14M', currentMargin: '$15M', status: 'warning' },
    ],
  },
  'agriflow': {
    totalSettled: '$1.2B',
    pendingSettlement: '$84M',
    failedSettlements: 1,
    avgSettlementDays: 3.8,
    clearingHouses: 4,
    marginCalls: 0,
    settlements: [
      { id: 'S-12401', counterparty: 'Olam Nigeria', commodity: 'Cocoa', quantity: '800 MT', amount: '$6.94M', settlementDate: '2025-06-06', status: 'settled', method: 'Physical' },
      { id: 'S-12402', counterparty: 'Cargill WA', commodity: 'Coffee', quantity: '1,200 bags', amount: '$5.94M', settlementDate: '2025-06-07', status: 'pending', method: 'Physical' },
      { id: 'S-12403', counterparty: 'Dangote Agro', commodity: 'Palm Oil', quantity: '2,000 MT', amount: '$1.79M', settlementDate: '2025-06-05', status: 'settled', method: 'Cash' },
    ],
    weeklyVolume: [
      { week: 'W1', physical: 280, cash: 420, total: 700 },
      { week: 'W2', physical: 320, cash: 480, total: 800 },
      { week: 'W3', physical: 290, cash: 510, total: 800 },
      { week: 'W4', physical: 340, cash: 460, total: 800 },
    ],
    marginRequirements: [
      { exchange: 'ICE Futures', initialMargin: '$4.2M', maintenanceMargin: '$3.2M', currentMargin: '$3.8M', status: 'adequate' },
      { exchange: 'CBOT', initialMargin: '$2.8M', maintenanceMargin: '$2.1M', currentMargin: '$2.4M', status: 'adequate' },
    ],
  },
}

const CommoditySettlement = () => {
  const { data: _apiData, isLoading: _apiLoading, isUsingFallback } = useApiData('commoditysettlement', () => apiClient.dashboard.metrics(), { fallback: seedData })
  const { tenant } = useTenant()
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState('settlements')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedSettlement, setSelectedSettlement] = useState(null)
  const data = seedData[tenant?.slug] || seedData['petromark']
  const filteredSettlements = data.settlements ? data.settlements.filter(s => {
    const matchSearch = !search || (s.tradeId && s.tradeId.toLowerCase().includes(search.toLowerCase())) || (s.counterparty && s.counterparty.toLowerCase().includes(search.toLowerCase()))
    const matchStatus = statusFilter === 'all' || s.status === statusFilter
    return matchSearch && matchStatus
  }) : []

  return (
    <div role="region" aria-label="CommoditySettlement" className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {t('nav.commoditySettlement', 'Trade Settlement')}
          </h1>
          <p className="text-gray-500 dark:text-gray-400">Settlement lifecycle, clearing & margin management</p>
        </div>
        {data.failedSettlements > 0 && (
          <span className="px-3 py-1 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-full text-sm font-medium">
            {data.failedSettlements} failed settlement{data.failedSettlements > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Total Settled', value: data.totalSettled, icon: CheckCircle, color: 'green' },
          { label: 'Pending', value: data.pendingSettlement, icon: Clock, color: 'yellow' },
          { label: 'Failed', value: data.failedSettlements, icon: AlertTriangle, color: 'red' },
          { label: 'Avg Settlement', value: `${data.avgSettlementDays}d`, icon: Activity, color: 'blue' },
          { label: 'Clearing Houses', value: data.clearingHouses, icon: Shield, color: 'purple' },
          { label: 'Margin Calls', value: data.marginCalls, icon: DollarSign, color: 'cyan' },
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
        {['settlements', 'volume', 'margin'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm rounded-md capitalize transition-colors ${
              activeTab === tab ? 'bg-white dark:bg-gray-700 shadow-sm font-medium text-gray-900 dark:text-gray-100'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}>
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'settlements' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  {['Settlement ID', 'Counterparty', 'Commodity', 'Quantity', 'Amount', 'Date', 'Method', 'Status'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {data.settlements.map((s, i) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-4 font-mono text-sm text-blue-600 dark:text-blue-400">{s.id}</td>
                    <td className="px-4 py-4 font-medium text-gray-900 dark:text-gray-100">{s.counterparty}</td>
                    <td className="px-4 py-4 text-gray-600 dark:text-gray-300">{s.commodity}</td>
                    <td className="px-4 py-4 text-gray-600 dark:text-gray-300">{s.quantity}</td>
                    <td className="px-4 py-4 font-medium text-gray-900 dark:text-gray-100">{s.amount}</td>
                    <td className="px-4 py-4 text-gray-500 dark:text-gray-400 text-sm">{s.settlementDate}</td>
                    <td className="px-4 py-4"><span className="px-2 py-1 bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded-full text-xs">{s.method}</span></td>
                    <td className="px-4 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        s.status === 'settled' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : s.status === 'failed' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'}`}>
                        {s.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'volume' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Weekly Settlement Volume ($M)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.weeklyVolume}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="week" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="physical" fill="#3b82f6" name="Physical" stackId="a" />
              <Bar dataKey="cash" fill="#10b981" name="Cash" stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {activeTab === 'margin' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  {['Exchange', 'Initial Margin', 'Maintenance', 'Current', 'Status'].map(h => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {data.marginRequirements.map((m, i) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">{m.exchange}</td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{m.initialMargin}</td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{m.maintenanceMargin}</td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{m.currentMargin}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${m.status === 'adequate' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'}`}>
                        {m.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default CommoditySettlement
