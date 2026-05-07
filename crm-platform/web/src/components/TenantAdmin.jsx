import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Crown, Building2, Users, Globe, CreditCard, Shield, TrendingUp,
  Landmark, MapPin, Settings, Check, X, Search, ChevronRight,
  BarChart3, Package, Zap, Eye, Edit2, ToggleLeft, ToggleRight,
  AlertTriangle, Clock, Activity, DollarSign
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTenant } from '@/contexts/TenantContext'
import { LoadingState, ErrorState, EmptyState, FallbackBadge, ExportButton } from '@/components/ui/DataStates'
import { useTranslation } from '@/lib/i18n/useTranslation'

const productIcons = {
  core_banking: Landmark,
  agent_banking: MapPin,
  remittance: Globe,
  payments: CreditCard,
  lending: DollarSign,
  insurance: Shield,
  investments: TrendingUp,
  cards: CreditCard,
}

const productColors = {
  core_banking: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', dot: 'bg-blue-500' },
  agent_banking: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300', dot: 'bg-green-500' },
  remittance: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300', dot: 'bg-purple-500' },
  payments: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-300', dot: 'bg-orange-500' },
  lending: { bg: 'bg-cyan-100 dark:bg-cyan-900/30', text: 'text-cyan-700 dark:text-cyan-300', dot: 'bg-cyan-500' },
  insurance: { bg: 'bg-teal-100 dark:bg-teal-900/30', text: 'text-teal-700 dark:text-teal-300', dot: 'bg-teal-500' },
  investments: { bg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-700 dark:text-indigo-300', dot: 'bg-indigo-500' },
  cards: { bg: 'bg-rose-100 dark:bg-rose-900/30', text: 'text-rose-700 dark:text-rose-300', dot: 'bg-rose-500' },
}

const statusColors = {
  active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  suspended: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  trial: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  pending: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300',
}

const tierLimits = {
  trial: { maxProducts: 2, maxUsers: 10, maxCustomers: '1K', price: 'Free' },
  growth: { maxProducts: 4, maxUsers: 50, maxCustomers: '200K', price: '$499/mo' },
  enterprise: { maxProducts: 8, maxUsers: 500, maxCustomers: '500K', price: '$2,499/mo' },
}

const TenantAdmin = () => {
  const { tenant, allTenants, switchTenant, allProducts } = useTenant()
  const [activeTab, setActiveTab] = useState('overview')
  const [selectedTenant, setSelectedTenant] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [editingProducts, setEditingProducts] = useState(null)

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'tenants', label: 'Tenants', icon: Building2 },
    { id: 'products', label: 'Product Matrix', icon: Package },
    { id: 'comparison', label: 'Compare', icon: Eye },
  ]

  const filteredTenants = useMemo(() => {
    if (!searchQuery) return allTenants
    return allTenants.filter(t =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.slug.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [allTenants, searchQuery])

  const platformStats = useMemo(() => {
    const active = allTenants.filter(t => t.status === 'active').length
    const trial = allTenants.filter(t => t.status === 'trial').length
    const totalProducts = allTenants.reduce((sum, t) => sum + Object.values(t.products).filter(Boolean).length, 0)
    const totalCustomers = allTenants.reduce((sum, t) => sum + (t.stats?.totalCustomers || 0), 0)
    return { active, trial, total: allTenants.length, totalProducts, totalCustomers }
  }, [allTenants])

  return (
    <div role="region" aria-label="TenantAdmin"  className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Crown className="w-7 h-7 text-purple-600" />
            Multi-Tenant Management
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Manage organizations, product entitlements, and access controls
          </p>
        </div>
        <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2">
          <Building2 className="w-4 h-4" />
          New Tenant
        </button>
      </div>

      {/* Platform Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total Tenants', value: platformStats.total, icon: Building2, color: 'text-blue-600' },
          { label: 'Active', value: platformStats.active, icon: Check, color: 'text-green-600' },
          { label: 'Trial', value: platformStats.trial, icon: Clock, color: 'text-amber-600' },
          { label: 'Product Subscriptions', value: platformStats.totalProducts, icon: Package, color: 'text-purple-600' },
          { label: 'Total Customers', value: platformStats.totalCustomers.toLocaleString(), icon: Users, color: 'text-indigo-600' },
        ].map(stat => (
          <div key={stat.label} tabIndex="0" className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <stat.icon className={cn('w-5 h-5', stat.color)} />
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors',
              activeTab === tab.id
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Product Distribution */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Product Adoption</h3>
              <div className="space-y-3">
                {Object.entries(allProducts).map(([key, product]) => {
                  const count = allTenants.filter(t => t.products[key]).length
                  const pct = Math.round((count / allTenants.length) * 100)
                  const colors = productColors[key]
                  return (
                    <div key={key} className="flex items-center gap-3">
                      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', colors.bg)}>
                        {(() => { const Icon = productIcons[key]; return <Icon className={cn('w-4 h-4', colors.text)} /> })()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">{product.label}</span>
                          <span className="text-sm text-gray-500">{count}/{allTenants.length} tenants</span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div className={cn('h-2 rounded-full', colors.dot)} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Subscription Tiers */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Subscription Tiers</h3>
              <div className="space-y-4">
                {Object.entries(tierLimits).map(([tier, limits]) => {
                  const count = allTenants.filter(t => t.subscriptionTier === tier).length
                  return (
                    <div key={tier} className="p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-900 dark:text-white capitalize">{tier}</span>
                          <span className="text-xs px-2 py-0.5 bg-gray-200 dark:bg-gray-600 rounded-full text-gray-600 dark:text-gray-300">{count} tenants</span>
                        </div>
                        <span className="text-sm font-bold text-purple-600">{limits.price}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <span>Up to {limits.maxProducts} products</span>
                        <span>Up to {limits.maxUsers} users</span>
                        <span>Up to {limits.maxCustomers} customers</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'tenants' && (
        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tenants..."
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm"
            />
          </div>

          {/* Tenant Cards */}
          <div className="space-y-4">
            {filteredTenants.map(t => {
              const enabledCount = Object.values(t.products).filter(Boolean).length
              const isExpanded = selectedTenant === t.id
              return (
                <motion.div
                  key={t.id}
                  layout
                  className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
                >
                  <button
                    onClick={() => setSelectedTenant(isExpanded ? null : t.id)}
                    className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
                        style={{ backgroundColor: t.branding?.primaryColor || '#666' }}
                      >
                        {t.name.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{t.name}</h3>
                          <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', statusColors[t.status])}>{t.status}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
                          <span>{t.slug}</span>
                          <span>{enabledCount} products</span>
                          <span>{t.subscriptionTier}</span>
                          {t.stats?.totalCustomers && <span>{t.stats.totalCustomers.toLocaleString()} customers</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex -space-x-1">
                        {Object.entries(t.products).filter(([, v]) => v).slice(0, 4).map(([key]) => {
                          const Icon = productIcons[key]
                          const colors = productColors[key]
                          return (
                            <div key={key} className={cn('w-6 h-6 rounded-full flex items-center justify-center border-2 border-white dark:border-gray-800', colors.bg)}>
                              <Icon className={cn('w-3 h-3', colors.text)} />
                            </div>
                          )
                        })}
                        {enabledCount > 4 && (
                          <div className="w-6 h-6 rounded-full flex items-center justify-center bg-gray-100 dark:bg-gray-700 border-2 border-white dark:border-gray-800 text-[10px] text-gray-500">
                            +{enabledCount - 4}
                          </div>
                        )}
                      </div>
                      <ChevronRight className={cn('w-4 h-4 text-gray-400 transition-transform', isExpanded && 'rotate-90')} />
                    </div>
                  </button>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="border-t border-gray-200 dark:border-gray-700"
                      >
                        <div className="p-4 space-y-4">
                          {/* Products Grid */}
                          <div>
                            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Product Entitlements</h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                              {Object.entries(allProducts).map(([key, product]) => {
                                const enabled = t.products[key]
                                const Icon = productIcons[key]
                                const colors = productColors[key]
                                return (
                                  <div
                                    key={key}
                                    className={cn(
                                      'p-3 rounded-lg border flex items-center gap-2',
                                      enabled
                                        ? cn('border-gray-200 dark:border-gray-600', colors.bg)
                                        : 'border-dashed border-gray-300 dark:border-gray-600 opacity-40'
                                    )}
                                  >
                                    <Icon className={cn('w-4 h-4', enabled ? colors.text : 'text-gray-400')} />
                                    <span className={cn('text-xs font-medium', enabled ? colors.text : 'text-gray-400')}>{product.label}</span>
                                    {enabled ? (
                                      <Check className="w-3 h-3 text-green-500 ml-auto" />
                                    ) : (
                                      <X className="w-3 h-3 text-gray-300 ml-auto" />
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          </div>

                          {/* Tenant Details */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                              <p className="text-xs text-gray-500 dark:text-gray-400">Currency</p>
                              <p className="text-sm font-medium text-gray-900 dark:text-white">{t.settings?.defaultCurrency}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 dark:text-gray-400">Timezone</p>
                              <p className="text-sm font-medium text-gray-900 dark:text-white">{t.settings?.timezone}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 dark:text-gray-400">Max Users</p>
                              <p className="text-sm font-medium text-gray-900 dark:text-white">{t.settings?.maxUsers}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 dark:text-gray-400">API Rate Limit</p>
                              <p className="text-sm font-medium text-gray-900 dark:text-white">{t.settings?.apiRateLimit}/min</p>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex gap-2 pt-2">
                            <button
                              onClick={() => switchTenant(t.id)}
                              className="px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-medium hover:bg-blue-100 dark:hover:bg-blue-900/40 flex items-center gap-1"
                            >
                              <Eye className="w-3 h-3" />
                              Switch to this tenant
                            </button>
                            <button className="px-3 py-1.5 bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-medium hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-1">
                              <Edit2 className="w-3 h-3" />
                              Edit
                            </button>
                            <button className="px-3 py-1.5 bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-medium hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-1">
                              <Settings className="w-3 h-3" />
                              Settings
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )
            })}
          </div>
        </div>
      )}

      {activeTab === 'products' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Tenant</th>
                {Object.entries(allProducts).map(([key, product]) => (
                  <th key={key} className="px-3 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400">
                    <div className="flex flex-col items-center gap-1">
                      {(() => { const Icon = productIcons[key]; return <Icon className="w-4 h-4" /> })()}
                      <span className="whitespace-nowrap">{product.label}</span>
                    </div>
                  </th>
                ))}
                <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400">Tier</th>
              </tr>
            </thead>
            <tbody>
              {allTenants.map(t => (
                <tr key={t.id} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded flex items-center justify-center text-white text-xs font-bold"
                        style={{ backgroundColor: t.branding?.primaryColor || '#666' }}
                      >
                        {t.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{t.name}</p>
                        <p className="text-[10px] text-gray-500">{t.slug}</p>
                      </div>
                    </div>
                  </td>
                  {Object.keys(allProducts).map(key => (
                    <td key={key} className="px-3 py-3 text-center">
                      {t.products[key] ? (
                        <div className="flex justify-center">
                          <div className={cn('w-6 h-6 rounded-full flex items-center justify-center', productColors[key].bg)}>
                            <Check className={cn('w-3 h-3', productColors[key].text)} />
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-center">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center bg-gray-100 dark:bg-gray-700">
                            <X className="w-3 h-3 text-gray-300 dark:text-gray-500" />
                          </div>
                        </div>
                      )}
                    </td>
                  ))}
                  <td className="px-3 py-3 text-center">
                    <span className={cn(
                      'text-xs px-2 py-0.5 rounded-full font-medium capitalize',
                      t.subscriptionTier === 'enterprise' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                        : t.subscriptionTier === 'growth' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                    )}>
                      {t.subscriptionTier}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'comparison' && (
        <div className="space-y-6">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Side-by-side comparison of tenant configurations. Click &quot;Switch to this tenant&quot; in the Tenants tab to preview the UI as that tenant.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {allTenants.slice(0, 4).map(t => {
              const enabledCount = Object.values(t.products).filter(Boolean).length
              return (
                <div key={t.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-lg"
                      style={{ backgroundColor: t.branding?.primaryColor || '#666' }}
                    >
                      {t.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-gray-900 dark:text-white">{t.name}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={cn('text-xs px-1.5 py-0.5 rounded font-medium', statusColors[t.status])}>{t.status}</span>
                        <span className="text-xs text-gray-500 capitalize">{t.subscriptionTier}</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="text-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <p className="text-lg font-bold text-gray-900 dark:text-white">{enabledCount}</p>
                      <p className="text-[10px] text-gray-500">Products</p>
                    </div>
                    <div className="text-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <p className="text-lg font-bold text-gray-900 dark:text-white">{t.stats?.totalCustomers?.toLocaleString() || '0'}</p>
                      <p className="text-[10px] text-gray-500">Customers</p>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    {Object.entries(allProducts).map(([key, product]) => {
                      const enabled = t.products[key]
                      return (
                        <div key={key} className="flex items-center justify-between py-1">
                          <span className={cn('text-xs', enabled ? 'text-gray-900 dark:text-white' : 'text-gray-400 line-through')}>{product.label}</span>
                          {enabled ? (
                            <Check className="w-3.5 h-3.5 text-green-500" />
                          ) : (
                            <X className="w-3.5 h-3.5 text-gray-300" />
                          )}
                        </div>
                      )
                    })}
                  </div>

                  <button
                    onClick={() => switchTenant(t.id)}
                    className={cn(
                      'w-full mt-4 py-2 rounded-lg text-xs font-medium transition-colors',
                      t.id === tenant?.id
                        ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                        : 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40'
                    )}
                  >
                    {t.id === tenant?.id ? 'Currently viewing' : 'Switch to this tenant'}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default TenantAdmin
