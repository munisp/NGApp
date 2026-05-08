import { useState } from 'react'
import { motion } from 'framer-motion'
import { Activity, MapPin, Signal, AlertTriangle, CheckCircle, Clock, RefreshCw } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { LoadingState, ErrorState, EmptyState, FallbackBadge } from '@/components/ui/DataStates'

const seedData = { totalPortRequests: 42800, pending: 1200, approved: 38400, rejected: 2400, inProgress: 800,
    avgProcessingDays: 2.4, targetDays: 3,
    recentRequests: [
      { msisdn: '+234801...', fromOperator: 'MTN', toOperator: 'AeroTel', status: 'approved', days: 1 },
      { msisdn: '+234802...', fromOperator: 'Airtel', toOperator: 'AeroTel', status: 'in_progress', days: 2 },
    ] }

const TelcoNumberPortability = () => {
  const { tenant } = useTenant()
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const data = seedData

  return (
    <div role="region" aria-label="TelcoNumberPortability">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Number Portability</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">NCC-compliant porting workflow with status tracking</p>
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

export default TelcoNumberPortability
