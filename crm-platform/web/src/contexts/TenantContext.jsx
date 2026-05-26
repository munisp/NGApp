/**
 * TenantContext — Multi-tenant product entitlement system
 * 
 * Provides:
 * - Current tenant configuration (id, name, branding, limits)
 * - Product access checks (hasProduct, enabledProducts)
 * - Tenant switching for admin/demo purposes
 * - UI feature gating based on subscribed products
 */
import { createContext, useContext, useState, useCallback, useMemo } from 'react'

// All available product modules (multi-vertical)
const ALL_PRODUCTS = {
  // Banking vertical
  core_banking: { label: 'Core Banking', icon: 'Building2', color: 'blue', vertical: 'banking' },
  agent_banking: { label: 'Agent Banking', icon: 'Users', color: 'green', vertical: 'banking' },
  remittance: { label: 'Remittance', icon: 'Globe', color: 'purple', vertical: 'banking' },
  payments: { label: 'Payments', icon: 'CreditCard', color: 'orange', vertical: 'banking' },
  lending: { label: 'Lending', icon: 'Landmark', color: 'cyan', vertical: 'banking' },
  insurance: { label: 'Insurance', icon: 'Shield', color: 'teal', vertical: 'banking' },
  investments: { label: 'Investments', icon: 'TrendingUp', color: 'indigo', vertical: 'banking' },
  cards: { label: 'Cards', icon: 'CreditCard', color: 'rose', vertical: 'banking' },
  // Telco vertical
  subscriber_mgmt: { label: 'Subscriber Management', icon: 'Users', color: 'blue', vertical: 'telco' },
  field_ops: { label: 'Field Operations', icon: 'Wrench', color: 'green', vertical: 'telco' },
  interconnect: { label: 'Interconnect & Settlement', icon: 'Globe', color: 'purple', vertical: 'telco' },
  network_ops: { label: 'Network Operations', icon: 'Signal', color: 'cyan', vertical: 'telco' },
  device_mgmt: { label: 'Device Management', icon: 'Smartphone', color: 'orange', vertical: 'telco' },
  // Commodity vertical
  trading: { label: 'Trading Desk', icon: 'TrendingUp', color: 'blue', vertical: 'commodity' },
  broker_portal: { label: 'Broker Portal', icon: 'Users', color: 'green', vertical: 'commodity' },
  settlement: { label: 'Trade Settlement', icon: 'DollarSign', color: 'purple', vertical: 'commodity' },
  risk_mgmt: { label: 'Risk Management', icon: 'Shield', color: 'red', vertical: 'commodity' },
  // CPaaS vertical
  messaging: { label: 'Messaging Channels', icon: 'MessageSquare', color: 'blue', vertical: 'cpaas' },
  voice_platform: { label: 'Voice Platform', icon: 'Phone', color: 'green', vertical: 'cpaas' },
  developer_portal: { label: 'Developer Portal', icon: 'Code2', color: 'purple', vertical: 'cpaas' },
  api_platform: { label: 'API Platform', icon: 'Globe', color: 'cyan', vertical: 'cpaas' },
}

// Sample tenants matching the Go service seed data
const TENANTS = {
  'tenant-acme-bank': {
    id: 'tenant-acme-bank',
    name: 'Acme Microfinance Bank',
    slug: 'acme-bank',
    status: 'active',
    subscriptionTier: 'enterprise',
    products: {
      core_banking: true,
      agent_banking: true,
      remittance: true,
      payments: true,
      lending: true,
      cards: true,
      insurance: false,
      investments: false,
    },
    branding: {
      primaryColor: '#1E40AF',
      accentColor: '#7C3AED',
      companyName: 'Acme Microfinance Bank',
    },
    settings: {
      defaultCurrency: 'NGN',
      supportedCurrencies: ['NGN', 'USD', 'GBP', 'EUR'],
      timezone: 'Africa/Lagos',
      maxUsers: 500,
      maxAgents: 2000,
      apiRateLimit: 1000,
    },
    limits: {
      maxCustomers: 500000,
      maxTransactionsPerDay: 100000,
      maxTransferAmount: 50000000,
      maxAgentCashLimit: 5000000,
      maxRemittanceAmount: 10000000,
    },
    stats: {
      totalCustomers: 48900,
      activeAgents: 1538,
      monthlyVolume: '₦230.5B',
      corridors: 8,
    },
  },
  'tenant-quickcash': {
    id: 'tenant-quickcash',
    name: 'QuickCash Mobile Money',
    slug: 'quickcash',
    status: 'active',
    subscriptionTier: 'growth',
    products: {
      core_banking: false,
      agent_banking: true,
      remittance: false,
      payments: true,
      lending: false,
      cards: false,
      insurance: false,
      investments: false,
    },
    branding: {
      primaryColor: '#059669',
      accentColor: '#F59E0B',
      companyName: 'QuickCash',
    },
    settings: {
      defaultCurrency: 'NGN',
      supportedCurrencies: ['NGN'],
      timezone: 'Africa/Lagos',
      maxUsers: 50,
      maxAgents: 5000,
      apiRateLimit: 500,
    },
    limits: {
      maxCustomers: 200000,
      maxTransactionsPerDay: 50000,
      maxTransferAmount: 1000000,
      maxAgentCashLimit: 2000000,
    },
    stats: {
      totalCustomers: 28500,
      activeAgents: 3200,
      monthlyVolume: '₦2.9B',
    },
  },
  'tenant-swiftremit': {
    id: 'tenant-swiftremit',
    name: 'SwiftRemit International',
    slug: 'swiftremit',
    status: 'active',
    subscriptionTier: 'enterprise',
    products: {
      core_banking: false,
      agent_banking: false,
      remittance: true,
      payments: true,
      lending: false,
      cards: false,
      insurance: false,
      investments: false,
    },
    branding: {
      primaryColor: '#7C3AED',
      accentColor: '#EC4899',
      companyName: 'SwiftRemit',
    },
    settings: {
      defaultCurrency: 'USD',
      supportedCurrencies: ['USD', 'NGN', 'GBP', 'EUR', 'CAD', 'GHS', 'KES'],
      timezone: 'UTC',
      maxUsers: 100,
      apiRateLimit: 2000,
    },
    limits: {
      maxCustomers: 100000,
      maxTransactionsPerDay: 25000,
      maxRemittanceAmount: 50000000,
    },
    stats: {
      totalCustomers: 43800,
      corridors: 8,
      monthlyVolume: '$125.0M',
    },
  },
  'tenant-nextgen-mfb': {
    id: 'tenant-nextgen-mfb',
    name: 'NextGen MFB',
    slug: 'nextgen-mfb',
    status: 'trial',
    subscriptionTier: 'trial',
    products: {
      core_banking: true,
      agent_banking: true,
      remittance: false,
      payments: false,
      lending: false,
      cards: false,
      insurance: false,
      investments: false,
    },
    branding: {
      primaryColor: '#DC2626',
      accentColor: '#EA580C',
      companyName: 'NextGen MFB',
    },
    settings: {
      defaultCurrency: 'NGN',
      supportedCurrencies: ['NGN'],
      timezone: 'Africa/Lagos',
      maxUsers: 10,
      maxAgents: 50,
      apiRateLimit: 100,
    },
    limits: {
      maxCustomers: 1000,
      maxTransactionsPerDay: 500,
      maxTransferAmount: 500000,
      maxAgentCashLimit: 100000,
    },
    stats: {
      totalCustomers: 850,
      activeAgents: 42,
      monthlyVolume: '₦12.4M',
    },
  },
  // --- Telco vertical tenants ---
  'tenant-aerotel': {
    id: 'tenant-aerotel',
    name: 'AeroTel Communications',
    slug: 'aerotel',
    status: 'active',
    vertical: 'telco',
    subscriptionTier: 'enterprise',
    products: {
      subscriber_mgmt: true,
      field_ops: true,
      interconnect: true,
      network_ops: true,
      device_mgmt: true,
    },
    branding: {
      primaryColor: '#0EA5E9',
      accentColor: '#8B5CF6',
      companyName: 'AeroTel',
    },
    settings: {
      defaultCurrency: 'USD',
      supportedCurrencies: ['USD', 'NGN', 'GBP'],
      timezone: 'Africa/Lagos',
      maxUsers: 1000,
      apiRateLimit: 5000,
    },
    limits: {
      maxSubscribers: 50000000,
      maxCellSites: 10000,
    },
    stats: {
      totalSubscribers: 18400000,
      activeTechnicians: 842,
      monthlyRevenue: '$127.7M',
    },
  },
  'tenant-netwave': {
    id: 'tenant-netwave',
    name: 'NetWave Mobile',
    slug: 'netwave',
    status: 'active',
    vertical: 'telco',
    subscriptionTier: 'growth',
    products: {
      subscriber_mgmt: true,
      field_ops: true,
      interconnect: true,
      network_ops: false,
      device_mgmt: false,
    },
    branding: {
      primaryColor: '#059669',
      accentColor: '#F59E0B',
      companyName: 'NetWave',
    },
    settings: {
      defaultCurrency: 'USD',
      supportedCurrencies: ['USD', 'NGN'],
      timezone: 'Africa/Lagos',
      maxUsers: 200,
      apiRateLimit: 1000,
    },
    limits: {
      maxSubscribers: 10000000,
      maxCellSites: 2000,
    },
    stats: {
      totalSubscribers: 4200000,
      activeTechnicians: 248,
      monthlyRevenue: '$21.1M',
    },
  },
  // --- Commodity vertical tenants ---
  'tenant-petromark': {
    id: 'tenant-petromark',
    name: 'PetroMark Trading',
    slug: 'petromark',
    status: 'active',
    vertical: 'commodity',
    subscriptionTier: 'enterprise',
    products: {
      trading: true,
      broker_portal: true,
      settlement: true,
      risk_mgmt: true,
    },
    branding: {
      primaryColor: '#DC2626',
      accentColor: '#F59E0B',
      companyName: 'PetroMark',
    },
    settings: {
      defaultCurrency: 'USD',
      supportedCurrencies: ['USD', 'EUR', 'GBP', 'NGN'],
      timezone: 'UTC',
      maxUsers: 500,
      apiRateLimit: 3000,
    },
    limits: {
      maxCounterparties: 1000,
      maxDailyTrades: 50000,
    },
    stats: {
      totalPositions: '$2.4B',
      counterparties: 342,
      dailyPnL: '+$18.2M',
    },
  },
  'tenant-agriflow': {
    id: 'tenant-agriflow',
    name: 'AgriFlow Commodities',
    slug: 'agriflow',
    status: 'active',
    vertical: 'commodity',
    subscriptionTier: 'growth',
    products: {
      trading: true,
      broker_portal: true,
      settlement: true,
      risk_mgmt: false,
    },
    branding: {
      primaryColor: '#059669',
      accentColor: '#84CC16',
      companyName: 'AgriFlow',
    },
    settings: {
      defaultCurrency: 'USD',
      supportedCurrencies: ['USD', 'NGN', 'GHS'],
      timezone: 'Africa/Lagos',
      maxUsers: 100,
      apiRateLimit: 1000,
    },
    limits: {
      maxCounterparties: 500,
      maxDailyTrades: 5000,
    },
    stats: {
      totalPositions: '$420M',
      counterparties: 98,
      dailyPnL: '+$2.8M',
    },
  },
  // --- CPaaS vertical tenants ---
  'tenant-messageflow': {
    id: 'tenant-messageflow',
    name: 'MessageFlow CPaaS',
    slug: 'messageflow',
    status: 'active',
    vertical: 'cpaas',
    subscriptionTier: 'enterprise',
    products: {
      messaging: true,
      voice_platform: true,
      developer_portal: true,
      api_platform: true,
    },
    branding: {
      primaryColor: '#7C3AED',
      accentColor: '#3B82F6',
      companyName: 'MessageFlow',
    },
    settings: {
      defaultCurrency: 'USD',
      supportedCurrencies: ['USD', 'EUR', 'NGN'],
      timezone: 'UTC',
      maxUsers: 200,
      apiRateLimit: 10000,
    },
    limits: {
      maxDevelopers: 50000,
      maxApiCallsPerSec: 50000,
    },
    stats: {
      totalMessages: 48200000,
      activeDevelopers: 1923,
      monthlyRevenue: '$2.4M',
    },
  },
  'tenant-connecthub': {
    id: 'tenant-connecthub',
    name: 'ConnectHub Communications',
    slug: 'connecthub',
    status: 'active',
    vertical: 'cpaas',
    subscriptionTier: 'growth',
    products: {
      messaging: true,
      voice_platform: true,
      developer_portal: true,
      api_platform: false,
    },
    branding: {
      primaryColor: '#0EA5E9',
      accentColor: '#10B981',
      companyName: 'ConnectHub',
    },
    settings: {
      defaultCurrency: 'USD',
      supportedCurrencies: ['USD', 'NGN'],
      timezone: 'Africa/Lagos',
      maxUsers: 50,
      apiRateLimit: 2000,
    },
    limits: {
      maxDevelopers: 10000,
      maxApiCallsPerSec: 10000,
    },
    stats: {
      totalMessages: 12800000,
      activeDevelopers: 567,
      monthlyRevenue: '$680K',
    },
  },
}

export const TenantContext = createContext(null)

export function TenantProvider({ children }) {
  const [currentTenantId, setCurrentTenantId] = useState('tenant-acme-bank')
  
  const tenant = TENANTS[currentTenantId]

  const hasProduct = useCallback((product) => {
    if (!tenant) return false
    return tenant.products[product] === true
  }, [tenant])

  const hasAnyProduct = useCallback((products) => {
    if (!tenant) return false
    return products.some(p => tenant.products[p] === true)
  }, [tenant])

  const hasAllProducts = useCallback((products) => {
    if (!tenant) return false
    return products.every(p => tenant.products[p] === true)
  }, [tenant])

  const enabledProducts = useMemo(() => {
    if (!tenant) return []
    return Object.entries(tenant.products)
      .filter(([, enabled]) => enabled)
      .map(([product]) => product)
  }, [tenant])

  const disabledProducts = useMemo(() => {
    if (!tenant) return []
    return Object.entries(tenant.products)
      .filter(([, enabled]) => !enabled)
      .map(([product]) => product)
  }, [tenant])

  const switchTenant = useCallback((tenantId) => {
    if (TENANTS[tenantId]) {
      setCurrentTenantId(tenantId)
    }
  }, [])

  const allTenants = useMemo(() => Object.values(TENANTS), [])

  const value = useMemo(() => ({
    tenant,
    tenantId: currentTenantId,
    hasProduct,
    hasAnyProduct,
    hasAllProducts,
    enabledProducts,
    disabledProducts,
    switchTenant,
    allTenants,
    allProducts: ALL_PRODUCTS,
  }), [tenant, currentTenantId, hasProduct, hasAnyProduct, hasAllProducts, enabledProducts, disabledProducts, switchTenant, allTenants])

  return (
    <TenantContext.Provider value={value}>
      {children}
    </TenantContext.Provider>
  )
}

// Hook to access tenant context
export function useTenant() {
  const context = useContext(TenantContext)
  if (!context) {
    throw new Error('useTenant must be used within a TenantProvider')
  }
  return context
}

// Hook that returns true/false for a specific product
export function useProductAccess(product) {
  const { hasProduct } = useTenant()
  return hasProduct(product)
}

// Component that conditionally renders children based on product access
export function ProductGate({ product, products, requireAll, fallback, children }) {
  const { hasProduct, hasAnyProduct, hasAllProducts } = useTenant()

  let hasAccess = false
  if (product) {
    hasAccess = hasProduct(product)
  } else if (products && requireAll) {
    hasAccess = hasAllProducts(products)
  } else if (products) {
    hasAccess = hasAnyProduct(products)
  }

  if (!hasAccess) {
    return fallback || null
  }

  return children
}

export default TenantContext
