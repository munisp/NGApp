import { useState } from 'react'
import { motion } from 'framer-motion'
import { Activity, MapPin, Signal, AlertTriangle, CheckCircle, Clock, RefreshCw } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { LoadingState, ErrorState, EmptyState, FallbackBadge } from '@/components/ui/DataStates'

const seedData = { sites: [
      { id: 'CS-001', name: 'Victoria Island Tower', lat: 6.4281, lng: 3.4219, tech: '5G', status: 'operational', utilization: 78.2, subscribers: 12400 },
      { id: 'CS-002', name: 'Ikeja Central', lat: 6.6018, lng: 3.3515, tech: '4G', status: 'degraded', utilization: 94.1, subscribers: 28900 },
      { id: 'CS-003', name: 'Lekki Phase 1', lat: 6.4478, lng: 3.4723, tech: '4G', status: 'operational', utilization: 62.7, subscribers: 8700 },
      { id: 'CS-004', name: 'Abuja Central', lat: 9.0579, lng: 7.4951, tech: '5G', status: 'maintenance', utilization: 0, subscribers: 0 },
    ], totalSites: 847, operational: 812, degraded: 28, maintenance: 7 }

const TelcoCellSiteMap = () => {
  const { tenant } = useTenant()
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const data = seedData

  return (
    <div role="region" aria-label="TelcoCellSiteMap">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Cell Site Performance Map</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Network coverage and tower health visualization</p>
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

export default TelcoCellSiteMap
