import { useState } from 'react'
import { motion } from 'framer-motion'
import { Activity, MapPin, Signal, AlertTriangle, CheckCircle, Clock, RefreshCw } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { LoadingState, ErrorState, EmptyState, FallbackBadge } from '@/components/ui/DataStates'

const seedData = { overallCompliance: 94.2, simRegistration: { compliant: 21200000, nonCompliant: 1400000, deadline: '2026-06-30' },
    qosMetrics: { callSetupSuccess: 99.1, dropRate: 0.8, dataAvailability: 99.4, target: 99.0 },
    reports: [
      { name: 'Monthly QoS Report', status: 'submitted', period: 'Apr 2026' },
      { name: 'SIM Registration Audit', status: 'pending', period: 'Q2 2026' },
    ] }

const TelcoNCCCompliance = () => {
  const { tenant } = useTenant()
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const data = seedData

  return (
    <div role="region" aria-label="TelcoNCCCompliance">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">NCC Compliance Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Regulatory compliance tracking for Nigerian Communications Commission</p>
        </div>
        <FallbackBadge />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {Object.entries(data).filter(([k, v]) => typeof v === 'number').slice(0, 4).map(([key, value]) => (
          <motion.div key={key} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-400 capitalize">{key.replace(/([A-Z])/g, ' $1')}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{typeof value === 'number' && value > 1000 ? value.toLocaleString() : value}</p>
          </motion.div>
        ))}
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Details</h2>
        <pre className="text-xs text-gray-600 dark:text-gray-400 overflow-auto max-h-96">{JSON.stringify(data, null, 2)}</pre>
      </div>
    </div>
  )
}

export default TelcoNCCCompliance
