import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Users, Search, Filter, Building2, Landmark, Globe, ChevronRight,
  Phone, Mail, MapPin, Shield, DollarSign, Activity, Clock, ArrowUpRight,
  CreditCard, Send, UserCheck, AlertTriangle, CheckCircle, X, Eye
} from 'lucide-react'
import { unifiedCustomerService } from '../services/unifiedCustomerService'
import { LoadingState, ErrorState, EmptyState, FallbackBadge, ExportButton } from '@/components/ui/DataStates'
import { useTranslation } from '@/lib/i18n/useTranslation'

const SourceBadge = ({ source }) => {
  const config = {
    'core-banking': { label: 'Core Banking', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300', dot: 'bg-blue-500' },
    'agent-banking': { label: 'Agent Banking', color: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300', dot: 'bg-green-500' },
    'remittance': { label: 'Remittance', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300', dot: 'bg-purple-500' },
  }
  const c = config[source] || { label: source, color: 'bg-gray-100 text-gray-700', dot: 'bg-gray-500' }
  return (
    <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-medium ${c.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      <span>{c.label}</span>
    </span>
  )
}

const formatCurrency = (val, currency = 'NGN') => {
  if (currency === 'USD') return `$${val.toLocaleString()}`
  if (currency === 'GBP') return `£${val.toLocaleString()}`
  if (currency === 'EUR') return `€${val.toLocaleString()}`
  if (currency === 'AED') return `AED ${val.toLocaleString()}`
  if (val >= 1e6) return `₦${(val / 1e6).toFixed(1)}M`
  return `₦${val.toLocaleString()}`
}

const CustomerDetail = ({ customer, onClose }) => {
  if (!customer) return null

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      tabIndex="0" className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
    >
      {/* Customer Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center text-2xl font-bold">
              {customer.fullName.split(' ').map(n => n[0]).join('')}
            </div>
            <div>
              <h2 className="text-2xl font-bold">{customer.fullName}</h2>
              <p className="text-blue-100">{customer.segment} • {customer.id}</p>
              <div className="flex items-center space-x-2 mt-2">
                {customer.sources.map(s => (
                  <span key={s} className="px-2 py-0.5 bg-white/20 rounded-full text-xs">{s}</span>
                ))}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Contact Info */}
        <div className="grid grid-cols-3 gap-4">
          {customer.email && (
            <div className="flex items-center space-x-2 text-sm">
              <Mail className="w-4 h-4 text-gray-400" />
              <span className="text-gray-600 dark:text-gray-300">{customer.email}</span>
            </div>
          )}
          {customer.phone && (
            <div className="flex items-center space-x-2 text-sm">
              <Phone className="w-4 h-4 text-gray-400" />
              <span className="text-gray-600 dark:text-gray-300">{customer.phone}</span>
            </div>
          )}
          {customer.bvn && (
            <div className="flex items-center space-x-2 text-sm">
              <Shield className="w-4 h-4 text-gray-400" />
              <span className="text-gray-600 dark:text-gray-300">BVN: {customer.bvn}</span>
            </div>
          )}
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(customer.lifetimeValue)}</p>
            <p className="text-xs text-gray-500 mt-1">Lifetime Value</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{customer.riskScore}</p>
            <p className="text-xs text-gray-500 mt-1">Risk Score</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{customer.totalProducts}</p>
            <p className="text-xs text-gray-500 mt-1">Products</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{customer.sources.length}</p>
            <p className="text-xs text-gray-500 mt-1">Data Sources</p>
          </div>
        </div>

        {/* Source-Specific Data */}
        {customer.coreBanking && (
          <div className="border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-3">
              <Landmark className="w-5 h-5 text-blue-600" />
              <h4 className="font-semibold text-gray-900 dark:text-white">Core Banking</h4>
              <SourceBadge source="core-banking" />
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-500">Account:</span> <span className="font-medium text-gray-900 dark:text-white">{customer.coreBanking.accountNumber}</span></div>
              <div><span className="text-gray-500">Type:</span> <span className="font-medium text-gray-900 dark:text-white">{customer.coreBanking.accountType}</span></div>
              <div><span className="text-gray-500">Balance:</span> <span className="font-medium text-green-600">{formatCurrency(customer.coreBanking.balance)}</span></div>
              <div><span className="text-gray-500">Branch:</span> <span className="font-medium text-gray-900 dark:text-white">{customer.coreBanking.branch}</span></div>
              <div><span className="text-gray-500">KYC Level:</span> <span className="font-medium text-gray-900 dark:text-white">{customer.coreBanking.kycLevel}/3</span></div>
              <div><span className="text-gray-500">Products:</span> <span className="font-medium text-gray-900 dark:text-white">{customer.coreBanking.products.length}</span></div>
            </div>
            <div className="flex flex-wrap gap-1 mt-3">
              {customer.coreBanking.products.map(p => (
                <span key={p} className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs">{p}</span>
              ))}
            </div>
          </div>
        )}

        {customer.agentBanking && (
          <div className="border border-green-200 dark:border-green-800 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-3">
              <Users className="w-5 h-5 text-green-600" />
              <h4 className="font-semibold text-gray-900 dark:text-white">Agent Banking</h4>
              <SourceBadge source="agent-banking" />
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-500">Agent:</span> <span className="font-medium text-gray-900 dark:text-white">{customer.agentBanking.agentName}</span></div>
              <div><span className="text-gray-500">Agent ID:</span> <span className="font-medium text-gray-900 dark:text-white">{customer.agentBanking.agentId}</span></div>
              <div><span className="text-gray-500">Transactions:</span> <span className="font-medium text-gray-900 dark:text-white">{customer.agentBanking.totalTransactions}</span></div>
              <div><span className="text-gray-500">Volume:</span> <span className="font-medium text-green-600">{formatCurrency(customer.agentBanking.totalVolume)}</span></div>
            </div>
            <div className="flex flex-wrap gap-1 mt-3">
              {customer.agentBanking.services.map(s => (
                <span key={s} className="px-2 py-0.5 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded text-xs">{s}</span>
              ))}
            </div>
          </div>
        )}

        {customer.remittance && (
          <div className="border border-purple-200 dark:border-purple-800 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-3">
              <Globe className="w-5 h-5 text-purple-600" />
              <h4 className="font-semibold text-gray-900 dark:text-white">Remittance</h4>
              <SourceBadge source="remittance" />
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-500">Role:</span> <span className="font-medium text-gray-900 dark:text-white">{customer.remittance.role}</span></div>
              <div><span className="text-gray-500">Corridor:</span> <span className="font-medium text-gray-900 dark:text-white">{customer.remittance.corridor}</span></div>
              <div><span className="text-gray-500">Total:</span> <span className="font-medium text-purple-600">{formatCurrency(customer.remittance.totalReceived || customer.remittance.totalSent, customer.remittance.currency)}</span></div>
              <div><span className="text-gray-500">Last Activity:</span> <span className="font-medium text-gray-900 dark:text-white">{customer.remittance.lastReceived || customer.remittance.lastSent}</span></div>
            </div>
          </div>
        )}

        {/* Interaction Timeline */}
        <div>
          <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Recent Interactions</h4>
          <div className="space-y-3">
            {customer.interactions.map((interaction, i) => (
              <div key={i} className="flex items-start space-x-3 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  interaction.type === 'Transaction' ? 'bg-blue-100 text-blue-600' :
                  interaction.type === 'Remittance' ? 'bg-purple-100 text-purple-600' :
                  interaction.type === 'Agent Transaction' ? 'bg-green-100 text-green-600' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {interaction.type === 'Transaction' ? <CreditCard className="w-4 h-4" /> :
                   interaction.type === 'Remittance' ? <Send className="w-4 h-4" /> :
                   interaction.type === 'Agent Transaction' ? <Users className="w-4 h-4" /> :
                   <Activity className="w-4 h-4" />}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{interaction.description}</p>
                  <p className="text-xs text-gray-500">{interaction.date} • {interaction.channel}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

const Customer360 = () => {
  const [customers, setCustomers] = useState([])
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [search, setSearch] = useState('')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadCustomers()
  }, [sourceFilter])

  const loadCustomers = async () => {
    setLoading(true)
    const filters = {}
    if (sourceFilter !== 'all') filters.source = sourceFilter
    if (search) filters.search = search
    const data = await unifiedCustomerService.fetchAllUnified(filters)
    setCustomers(data)
    setLoading(false)
  }

  const handleSearch = (e) => {
    setSearch(e.target.value)
    if (e.target.value.length > 2 || e.target.value.length === 0) {
      loadCustomers()
    }
  }

  return (
    <div role="region" aria-label="Customer360"  className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Customer 360°</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Unified view of all customer profiles across systems</p>
      </div>

      {/* Filters */}
      <div className="flex items-center space-x-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={handleSearch}
            placeholder="Search by name, email, phone, BVN..."
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm"
          />
        </div>
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-gray-400" />
          {['all', 'core-banking', 'agent-banking', 'remittance'].map(f => (
            <button
              key={f}
              onClick={() => setSourceFilter(f)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                sourceFilter === f
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {f === 'all' ? 'All Sources' : f.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Customer List */}
        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-12 text-gray-500">Loading customers...</div>
          ) : customers.length === 0 ? (
            <div className="text-center py-12 text-gray-500">No customers found</div>
          ) : (
            customers.map(customer => (
              <motion.div
                key={customer.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={() => setSelectedCustomer(customer)}
                className={`bg-white dark:bg-gray-800 rounded-xl border p-4 cursor-pointer transition hover:shadow-md ${
                  selectedCustomer?.id === customer.id
                    ? 'border-blue-500 shadow-md'
                    : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                      {customer.fullName.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">{customer.fullName}</p>
                      <p className="text-xs text-gray-500">{customer.segment} • LTV: {formatCurrency(customer.lifetimeValue)}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
                <div className="flex items-center space-x-2 mt-3">
                  {customer.sources.map(s => <SourceBadge key={s} source={s} />)}
                </div>
              </motion.div>
            ))
          )}
        </div>

        {/* Customer Detail */}
        <div>
          {selectedCustomer ? (
            <CustomerDetail customer={selectedCustomer} onClose={() => setSelectedCustomer(null)} />
          ) : (
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 flex items-center justify-center h-96">
              <div className="text-center">
                <Eye className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400">Select a customer to view their 360° profile</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Customer360
