import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Users, DollarSign, Shield, TrendingUp, Activity, AlertTriangle,
  CheckCircle, Clock, FileText, Globe, ArrowUpRight
, Search } from 'lucide-react'
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { useTenant } from '../contexts/TenantContext'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { useApiData } from '@/hooks/useApiData'
import { apiClient } from '@/lib/apiClient'
import { ErrorState } from '@/components/ui/DataStates'

const seedData = {
  'petromark': {
    totalCounterparties: 342,
    activeCounterparties: 298,
    pendingOnboarding: 12,
    avgCreditLimit: '$48M',
    totalExposure: '$1.8B',
    creditBreaches: 3,
    counterparties: [
      { name: 'Shell Trading', type: 'Major', creditLimit: '$180M', currentExposure: '$142M', utilization: 78.9, rating: 'AA', status: 'active', lastTrade: '2h ago' },
      { name: 'Vitol Group', type: 'Major', creditLimit: '$150M', currentExposure: '$98M', utilization: 65.3, rating: 'A+', status: 'active', lastTrade: '4h ago' },
      { name: 'Trafigura', type: 'Major', creditLimit: '$120M', currentExposure: '$105M', utilization: 87.5, rating: 'A', status: 'warning', lastTrade: '1h ago' },
      { name: 'Glencore NG', type: 'Major', creditLimit: '$200M', currentExposure: '$128M', utilization: 64.0, rating: 'AA-', status: 'active', lastTrade: '6h ago' },
      { name: 'NNPC Trading', type: 'State', creditLimit: '$300M', currentExposure: '$245M', utilization: 81.7, rating: 'A-', status: 'active', lastTrade: '30m ago' },
      { name: 'Oando Trading', type: 'Local', creditLimit: '$45M', currentExposure: '$38M', utilization: 84.4, rating: 'BBB+', status: 'warning', lastTrade: '8h ago' },
      { name: 'Sahara Energy', type: 'Local', creditLimit: '$60M', currentExposure: '$42M', utilization: 70.0, rating: 'A-', status: 'active', lastTrade: '3h ago' },
    ],
    onboardingPipeline: [
      { name: 'MerchantBridge Ltd', stage: 'KYC Review', daysInStage: 4, assignedTo: 'Legal Team', documents: 8 },
      { name: 'CrossAtlantic Oil', stage: 'Credit Assessment', daysInStage: 2, assignedTo: 'Risk Desk', documents: 12 },
      { name: 'Pacific Grain Co', stage: 'Contract Negotiation', daysInStage: 8, assignedTo: 'Sales', documents: 15 },
    ],
    volumeByCounterparty: [
      { name: 'Shell', volume: 420, trades: 184 },
      { name: 'Vitol', volume: 380, trades: 156 },
      { name: 'NNPC', volume: 520, trades: 98 },
      { name: 'Glencore', volume: 290, trades: 142 },
      { name: 'Trafigura', volume: 340, trades: 128 },
    ],
  },
  'agriflow': {
    totalCounterparties: 98,
    activeCounterparties: 84,
    pendingOnboarding: 4,
    avgCreditLimit: '$8M',
    totalExposure: '$320M',
    creditBreaches: 1,
    counterparties: [
      { name: 'Olam Nigeria', type: 'Major', creditLimit: '$42M', currentExposure: '$28M', utilization: 66.7, rating: 'A', status: 'active', lastTrade: '3h ago' },
      { name: 'Cargill West Africa', type: 'Major', creditLimit: '$38M', currentExposure: '$32M', utilization: 84.2, rating: 'AA', status: 'active', lastTrade: '1h ago' },
      { name: 'Dangote Agro', type: 'Local', creditLimit: '$25M', currentExposure: '$18M', utilization: 72.0, rating: 'A-', status: 'active', lastTrade: '5h ago' },
      { name: 'Flour Mills NG', type: 'Local', creditLimit: '$20M', currentExposure: '$19M', utilization: 95.0, rating: 'BBB+', status: 'warning', lastTrade: '2h ago' },
    ],
    onboardingPipeline: [
      { name: 'Green Harvest Co', stage: 'KYC Review', daysInStage: 3, assignedTo: 'Compliance', documents: 6 },
    ],
    volumeByCounterparty: [
      { name: 'Olam', volume: 120, trades: 68 },
      { name: 'Cargill', volume: 95, trades: 54 },
      { name: 'Dangote', volume: 80, trades: 42 },
      { name: 'Flour Mills', volume: 65, trades: 38 },
    ],
  },
}

const CommodityBrokerPortal = () => {
  const { data: _apiData, isLoading: _apiLoading, isUsingFallback } = useApiData('commoditybrokerportal', () => apiClient.dashboard.metrics(), { fallback: seedData })
  const { tenant } = useTenant()
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState('counterparties')
  const [search, setSearch] = useState('')
  const [ratingFilter, setRatingFilter] = useState('all')
  const [selectedCP, setSelectedCP] = useState(null)
  const [error, setError] = useState(null)
  const data = seedData[tenant?.slug] || seedData['petromark']
  const filteredCPs = data.counterparties ? data.counterparties.filter(c => {
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase())
    const matchRating = ratingFilter === 'all' || c.rating === ratingFilter
    return matchSearch && matchRating
  }) : []

  if (error) return <ErrorState message={error} />

  return (
    <div role="region" aria-label="CommodityBrokerPortal" className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {t('nav.commodityBroker', 'Broker Portal')}
          </h1>
          <p className="text-gray-500 dark:text-gray-400">Counterparty management, credit limits & onboarding</p>
        </div>
        {data.creditBreaches > 0 && (
          <span className="px-3 py-1 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-full text-sm font-medium">
            {data.creditBreaches} credit breach{data.creditBreaches > 1 ? 'es' : ''}
          </span>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Counterparties', value: data.totalCounterparties, icon: Users },
          { label: 'Active', value: data.activeCounterparties, icon: CheckCircle },
          { label: 'Pending Onboard', value: data.pendingOnboarding, icon: Clock },
          { label: 'Avg Credit Limit', value: data.avgCreditLimit, icon: Shield },
          { label: 'Total Exposure', value: data.totalExposure, icon: DollarSign },
          { label: 'Credit Breaches', value: data.creditBreaches, icon: AlertTriangle },
        ].map((kpi, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <kpi.icon className="w-4 h-4 text-blue-500" />
              <span className="text-xs text-gray-500 dark:text-gray-400">{kpi.label}</span>
            </div>
            <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{kpi.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg w-fit">
        {['counterparties', 'onboarding', 'volume'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm rounded-md capitalize transition-colors ${
              activeTab === tab ? 'bg-white dark:bg-gray-700 shadow-sm font-medium text-gray-900 dark:text-gray-100'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}>
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'counterparties' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  {['Counterparty', 'Type', 'Credit Limit', 'Exposure', 'Utilization', 'Rating', 'Status', 'Last Trade'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {data.counterparties.map((cp, i) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-4 font-medium text-gray-900 dark:text-gray-100">{cp.name}</td>
                    <td className="px-4 py-4"><span className="px-2 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-full text-xs">{cp.type}</span></td>
                    <td className="px-4 py-4 text-gray-600 dark:text-gray-300">{cp.creditLimit}</td>
                    <td className="px-4 py-4 text-gray-600 dark:text-gray-300">{cp.currentExposure}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${cp.utilization > 85 ? 'bg-red-500' : cp.utilization > 70 ? 'bg-yellow-500' : 'bg-green-500'}`} style={{ width: `${cp.utilization}%` }} />
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400">{cp.utilization}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 font-mono text-sm text-gray-600 dark:text-gray-300">{cp.rating}</td>
                    <td className="px-4 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${cp.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'}`}>
                        {cp.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-gray-500 dark:text-gray-400 text-sm">{cp.lastTrade}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'onboarding' && (
        <div className="space-y-4">
          {data.onboardingPipeline.map((cp, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-gray-900 dark:text-gray-100">{cp.name}</h4>
                <span className="px-2 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-full text-xs">{cp.stage}</span>
              </div>
              <div className="flex items-center gap-6 text-sm text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {cp.daysInStage} days in stage</span>
                <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {cp.assignedTo}</span>
                <span className="flex items-center gap-1"><FileText className="w-3 h-3" /> {cp.documents} documents</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'volume' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Trading Volume by Counterparty ($M)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.volumeByCounterparty}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="volume" fill="#3b82f6" name="Volume ($M)" />
              <Bar dataKey="trades" fill="#8b5cf6" name="# Trades" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

export default CommodityBrokerPortal
