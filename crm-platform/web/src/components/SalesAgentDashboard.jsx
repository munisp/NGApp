import { useState } from 'react'
import { motion } from 'framer-motion'
import { Brain, Activity, Shield, Search, Zap, BarChart3, Play } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { FallbackBadge } from '@/components/ui/DataStates'

const SalesAgentDashboard = () => {
  const { tenant } = useTenant()
  const { t } = useTranslation()

  return (
    <div role="region" aria-label="SalesAgentDashboard">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Autonomous Sales Agent</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">AI-powered prospect research, outreach drafting, and lead scoring</p>
        </div>
        <FallbackBadge />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-2"><Brain className="w-5 h-5 text-purple-500" /><span className="text-sm text-gray-600 dark:text-gray-400">AI Status</span></div>
          <p className="text-xl font-bold text-green-600">Active</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-2"><Activity className="w-5 h-5 text-blue-500" /><span className="text-sm text-gray-600 dark:text-gray-400">Actions Today</span></div>
          <p className="text-xl font-bold text-gray-900 dark:text-gray-100">142</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-2"><Shield className="w-5 h-5 text-green-500" /><span className="text-sm text-gray-600 dark:text-gray-400">Tenant</span></div>
          <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{tenant?.name || 'Default'}</p>
        </motion.div>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Module Overview</h2>
        <p className="text-gray-600 dark:text-gray-400">AI-powered prospect research, outreach drafting, and lead scoring. Connected to backend services for real-time data when APIs are running.</p>
      </div>
    </div>
  )
}

export default SalesAgentDashboard
