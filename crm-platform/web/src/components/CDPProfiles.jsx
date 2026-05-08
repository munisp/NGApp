import { useState } from 'react'
import { motion } from 'framer-motion'
import { DollarSign, TrendingUp, Users, Target, BarChart3 } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { FallbackBadge } from '@/components/ui/DataStates'

const CDPProfiles = () => {
  const { tenant } = useTenant()
  const { t } = useTranslation()

  const stages = [
    { name: 'Discovery', count: 142, value: 2400000, color: '#3B82F6' },
    { name: 'Qualification', count: 87, value: 1800000, color: '#10B981' },
    { name: 'Proposal', count: 52, value: 1200000, color: '#F59E0B' },
    { name: 'Negotiation', count: 28, value: 840000, color: '#EF4444' },
    { name: 'Closed Won', count: 15, value: 620000, color: '#8B5CF6' },
  ]

  return (
    <div role="region" aria-label="CDPProfiles">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Customer Data Platform</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Cross-vertical revenue tracking and forecasting</p>
        </div>
        <FallbackBadge />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-600 dark:text-gray-400">Total Pipeline</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">$6.86M</p>
        </motion.div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-600 dark:text-gray-400">Weighted Value</p>
          <p className="text-2xl font-bold text-green-600">$3.42M</p>
        </motion.div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-600 dark:text-gray-400">Avg Cycle</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">34 days</p>
        </motion.div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-600 dark:text-gray-400">Win Rate</p>
          <p className="text-2xl font-bold text-blue-600">10.6%</p>
        </motion.div>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold mb-4">Pipeline Stages</h2>
        <div className="space-y-3">
          {stages.map(stage => (
            <div key={stage.name} className="flex items-center gap-4">
              <span className="w-28 text-sm text-gray-600 dark:text-gray-400">{stage.name}</span>
              <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-6 overflow-hidden">
                <div style={{ width: `${(stage.count / 142) * 100}%`, backgroundColor: stage.color }} className="h-full rounded-full flex items-center justify-end pr-2">
                  <span className="text-xs text-white font-medium">{stage.count}</span>
                </div>
              </div>
              <span className="w-24 text-right text-sm font-medium text-gray-900 dark:text-gray-100">${(stage.value / 1000000).toFixed(1)}M</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default CDPProfiles
