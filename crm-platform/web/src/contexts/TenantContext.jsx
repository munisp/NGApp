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

// All available product modules
const ALL_PRODUCTS = {
  core_banking: { label: 'Core Banking', icon: 'Building2', color: 'blue' },
  agent_banking: { label: 'Agent Banking', icon: 'Users', color: 'green' },
  remittance: { label: 'Remittance', icon: 'Globe', color: 'purple' },
  payments: { label: 'Payments', icon: 'CreditCard', color: 'orange' },
  lending: { label: 'Lending', icon: 'Landmark', color: 'cyan' },
  insurance: { label: 'Insurance', icon: 'Shield', color: 'teal' },
  investments: { label: 'Investments', icon: 'TrendingUp', color: 'indigo' },
  cards: { label: 'Cards', icon: 'CreditCard', color: 'rose' },
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
}

const TenantContext = createContext(null)

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
