import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  TrendingUp, TrendingDown, DollarSign, BarChart3, Activity, AlertTriangle,
  ArrowUpRight, ArrowDownRight, Layers, Shield, Clock, Zap
, Search } from 'lucide-react'
import { AreaChart, Area, BarChart, Bar, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell } from 'recharts'
import { useTenant } from '../contexts/TenantContext'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { useApiData } from '@/hooks/useApiData'
import { apiClient } from '@/lib/apiClient'

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899']

const seedData = {
  'petromark': {
    totalPositions: '$2.4B',
    dailyPnL: '+$18.2M',
    openTrades: 1847,
    avgTradeSize: '$1.3M',
    varLimit: '$120M',
    currentVar: '$84.2M',
    marginUtilization: 72.4,
    counterparties: 342,
    positions: [
      { commodity: 'Crude Oil (WTI)', position: 'Long', quantity: '42,000 bbl', avgEntry: '$72.40', mark: '$74.80', pnl: '+$100.8K', unrealized: true },
      { commodity: 'Crude Oil (Brent)', position: 'Long', quantity: '85,000 bbl', avgEntry: '$76.20', mark: '$78.10', pnl: '+$161.5K', unrealized: true },
      { commodity: 'Natural Gas', position: 'Short', quantity: '180,000 MMBtu', avgEntry: '$3.42', mark: '$3.28', pnl: '+$25.2K', unrealized: true },
      { commodity: 'Gold', position: 'Long', quantity: '1,200 oz', avgEntry: '$2,280', mark: '$2,320', pnl: '+$48.0K', unrealized: true },
      { commodity: 'Copper', position: 'Short', quantity: '500 MT', avgEntry: '$9,420', mark: '$9,510', pnl: '-$45.0K', unrealized: true },
      { commodity: 'Wheat (CBOT)', position: 'Long', quantity: '50,000 bu', avgEntry: '$6.82', mark: '$6.95', pnl: '+$6.5K', unrealized: true },
    ],
    pnlHistory: [
      { date: 'Mon', realized: 4200000, unrealized: 8400000, total: 12600000 },
      { date: 'Tue', realized: -1800000, unrealized: 12200000, total: 10400000 },
      { date: 'Wed', realized: 6400000, unrealized: 9800000, total: 16200000 },
      { date: 'Thu', realized: 2100000, unrealized: 14200000, total: 16300000 },
      { date: 'Fri', realized: 3800000, unrealized: 14400000, total: 18200000 },
    ],
    sectorExposure: [
      { name: 'Energy', value: 1200000000, color: '#3b82f6' },
      { name: 'Precious Metals', value: 480000000, color: '#f59e0b' },
      { name: 'Base Metals', value: 320000000, color: '#8b5cf6' },
      { name: 'Agriculture', value: 240000000, color: '#10b981' },
      { name: 'Softs', value: 160000000, color: '#ef4444' },
    ],
    riskMetrics: { sharpeRatio: 1.82, maxDrawdown: -4.2, winRate: 62.4, avgWin: '$2.4M', avgLoss: '-$1.1M' },
  },
  'agriflow': {
    totalPositions: '$420M',
    dailyPnL: '+$2.8M',
    openTrades: 428,
    avgTradeSize: '$980K',
    varLimit: '$28M',
    currentVar: '$18.4M',
    marginUtilization: 65.7,
    counterparties: 98,
    positions: [
      { commodity: 'Cocoa', position: 'Long', quantity: '2,400 MT', avgEntry: '$8,420', mark: '$8,680', pnl: '+$624K', unrealized: true },
      { commodity: 'Coffee (Arabica)', position: 'Long', quantity: '1,800 bags', avgEntry: '$4.82/lb', mark: '$4.95/lb', pnl: '+$156K', unrealized: true },
      { commodity: 'Palm Oil', position: 'Short', quantity: '5,000 MT', avgEntry: '$920', mark: '$895', pnl: '+$125K', unrealized: true },
      { commodity: 'Cashew Nuts', position: 'Long', quantity: '800 MT', avgEntry: '$1,240', mark: '$1,280', pnl: '+$32K', unrealized: true },
    ],
    pnlHistory: [
      { date: 'Mon', realized: 820000, unrealized: 1200000, total: 2020000 },
      { date: 'Tue', realized: -420000, unrealized: 1800000, total: 1380000 },
      { date: 'Wed', realized: 1100000, unrealized: 2100000, total: 3200000 },
      { date: 'Thu', realized: 640000, unrealized: 1900000, total: 2540000 },
      { date: 'Fri', realized: 480000, unrealized: 2320000, total: 2800000 },
    ],
    sectorExposure: [
      { name: 'Softs', value: 180000000, color: '#10b981' },
      { name: 'Agriculture', value: 140000000, color: '#f59e0b' },
      { name: 'Oilseeds', value: 60000000, color: '#8b5cf6' },
      { name: 'Nuts & Spices', value: 40000000, color: '#ef4444' },
    ],
    riskMetrics: { sharpeRatio: 1.42, maxDrawdown: -6.8, winRate: 58.2, avgWin: '$420K', avgLoss: '-$280K' },
  },
}

const formatCurrency = (n) => {
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(1)}B`
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(0)}K`
  return `$${n.toLocaleString()}`
}

const CommodityTradingDesk = () => {
  const { data: _apiData, isLoading: _apiLoading, isUsingFallback } = useApiData('commoditytradingdesk', () => apiClient.dashboard.metrics(), { fallback: COLORS })
  const { tenant } = useTenant()
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState('positions')
  const [search, setSearch] = useState('')
  const [commodityFilter, setCommodityFilter] = useState('all')
  const [selectedPosition, setSelectedPosition] = useState(null)
  const data = seedData[tenant?.slug] || seedData['petromark']
  const filteredPositions = data.positions ? data.positions.filter(p => {
    const matchSearch = !search || (p.commodity && p.commodity.toLowerCase().includes(search.toLowerCase())) || (p.trader && p.trader.toLowerCase().includes(search.toLowerCase()))
    const matchCommodity = commodityFilter === 'all' || (p.commodity && p.commodity.toLowerCase().includes(commodityFilter))
    return matchSearch && matchCommodity
  }) : []

  const varPct = (data.currentVar.replace(/[^0-9.]/g, '') / data.varLimit.replace(/[^0-9.]/g, '') * 100).toFixed(1)

  return (
    <div role="region" aria-label="CommodityTradingDesk" className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {t('nav.commodityTrading', 'Trading Desk')}
          </h1>
          <p className="text-gray-500 dark:text-gray-400">Real-time positions, P&L & risk management</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 rounded-full text-sm font-bold ${data.dailyPnL.startsWith('+') ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
            Daily P&L: {data.dailyPnL}
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {[
          { label: 'Total Positions', value: data.totalPositions, icon: Layers },
          { label: 'Open Trades', value: data.openTrades.toLocaleString(), icon: Activity },
          { label: 'Avg Trade Size', value: data.avgTradeSize, icon: BarChart3 },
          { label: 'VaR Utilization', value: `${varPct}%`, icon: Shield },
          { label: 'Margin Used', value: `${data.marginUtilization}%`, icon: AlertTriangle },
          { label: 'Counterparties', value: data.counterparties, icon: DollarSign },
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

      {/* VaR Bar */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">VaR: {data.currentVar} / {data.varLimit} limit</span>
          <span className="text-sm text-gray-500 dark:text-gray-400">Risk: Sharpe {data.riskMetrics.sharpeRatio} | Win Rate {data.riskMetrics.winRate}% | Max DD {data.riskMetrics.maxDrawdown}%</span>
        </div>
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${parseFloat(varPct) > 80 ? 'bg-red-500' : parseFloat(varPct) > 60 ? 'bg-yellow-500' : 'bg-green-500'}`}
            style={{ width: `${varPct}%` }} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg w-fit">
        {['positions', 'pnl', 'exposure'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm rounded-md capitalize transition-colors ${
              activeTab === tab ? 'bg-white dark:bg-gray-700 shadow-sm font-medium text-gray-900 dark:text-gray-100'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}>
            {tab === 'pnl' ? 'P&L' : tab}
          </button>
        ))}
      </div>

      {activeTab === 'positions' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  {['Commodity', 'Position', 'Quantity', 'Avg Entry', 'Mark', 'P&L'].map(h => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {data.positions.map((pos, i) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">{pos.commodity}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${pos.position === 'Long' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                        {pos.position}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{pos.quantity}</td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{pos.avgEntry}</td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{pos.mark}</td>
                    <td className={`px-6 py-4 font-medium ${pos.pnl.startsWith('+') ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {pos.pnl}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'pnl' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Weekly P&L Breakdown</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.pnlHistory}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis tickFormatter={(v) => formatCurrency(v)} />
              <Tooltip formatter={(v) => formatCurrency(v)} />
              <Legend />
              <Bar dataKey="realized" fill="#10b981" name="Realized" />
              <Bar dataKey="unrealized" fill="#3b82f680" name="Unrealized" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {activeTab === 'exposure' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Sector Exposure</h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={data.sectorExposure} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {data.sectorExposure.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip formatter={(v) => formatCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Risk Metrics</h3>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Sharpe Ratio', value: data.riskMetrics.sharpeRatio },
                { label: 'Max Drawdown', value: `${data.riskMetrics.maxDrawdown}%` },
                { label: 'Win Rate', value: `${data.riskMetrics.winRate}%` },
                { label: 'Avg Win', value: data.riskMetrics.avgWin },
                { label: 'Avg Loss', value: data.riskMetrics.avgLoss },
                { label: 'Win/Loss Ratio', value: (parseFloat(data.riskMetrics.avgWin.replace(/[^0-9.]/g, '')) / parseFloat(data.riskMetrics.avgLoss.replace(/[^0-9.]/g, ''))).toFixed(2) },
              ].map((m, i) => (
                <div key={i} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <span className="text-xs text-gray-500 dark:text-gray-400">{m.label}</span>
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{m.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CommodityTradingDesk
