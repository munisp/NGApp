/**
 * Vertical component rendering tests — verify all 4 verticals render correctly.
 */
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import React, { Suspense } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('@/contexts/TenantContext', () => ({
  useTenant: () => ({
    tenant: {
      slug: 'aerotel', name: 'AeroTel',
      products: ['subscriber_mgmt', 'field_ops', 'interconnect', 'network_ops', 'device_mgmt',
        'core_banking', 'trading', 'messaging', 'voice_platform'],
    },
    tenants: [],
    switchTenant: vi.fn(),
  }),
}))

vi.mock('@/hooks/useApiData', () => ({
  useApiData: (key, fn, opts) => ({
    data: opts?.fallback || [],
    isLoading: false,
    isUsingFallback: true,
    refetch: vi.fn(),
  }),
}))

vi.mock('@/lib/apiClient', () => ({
  apiClient: new Proxy({}, {
    get: () => new Proxy(() => Promise.resolve([]), { get: () => () => Promise.resolve([]) }),
  }),
}))

vi.mock('@/lib/i18n/useTranslation', () => ({
  useTranslation: () => ({ t: (k) => k }),
  I18nProvider: ({ children }) => children,
}))

vi.mock('framer-motion', () => ({
  motion: new Proxy({}, { get: (_, tag) => ({ children, ...props }) => React.createElement(tag === 'div' ? 'div' : tag === 'button' ? 'button' : 'div', props, children) }),
  AnimatePresence: ({ children }) => children,
}))

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query')
  return { ...actual }
})

vi.mock('@/components/ui/DataStates', () => ({
  LoadingState: () => React.createElement('div', null, 'Loading'),
  ErrorState: () => React.createElement('div', null, 'Error'),
  EmptyState: () => React.createElement('div', null, 'Empty'),
  FallbackBadge: () => React.createElement('span', null, 'Fallback'),
  ExportButton: () => React.createElement('button', null, 'Export'),
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { name: 'Test', role: 'admin' }, hasPermission: () => true }),
  AuthProvider: ({ children }) => children,
}))

vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light', toggleTheme: vi.fn() }),
  ThemeProvider: ({ children }) => children,
}))

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
const wrapper = ({ children }) =>
  React.createElement(QueryClientProvider, { client: qc },
    React.createElement(Suspense, { fallback: React.createElement('div', null, 'Loading...') }, children))

const safeRender = async (importPath) => {
  const mod = await import(importPath)
  const Component = mod.default
  let error = null
  try { render(React.createElement(Component), { wrapper }) } catch (e) { error = e }
  return error
}

describe('Banking Vertical Components', () => {
  it('renders CoreBankingView', async () => {
    expect(await safeRender('@/components/CoreBankingView')).toBeNull()
  })
  it('renders AgentBankingView', async () => {
    expect(await safeRender('@/components/AgentBankingView')).toBeNull()
  })
  it('renders RemittanceView', async () => {
    expect(await safeRender('@/components/RemittanceView')).toBeNull()
  })
  it('renders BankingFXRateManager', async () => {
    expect(await safeRender('@/components/BankingFXRateManager')).toBeNull()
  })
  it('renders BankingNIPPayments', async () => {
    expect(await safeRender('@/components/BankingNIPPayments')).toBeNull()
  })
  it('renders BankingOpenBankingConsent', async () => {
    expect(await safeRender('@/components/BankingOpenBankingConsent')).toBeNull()
  })
  it('renders BankingRegulatoryReports', async () => {
    expect(await safeRender('@/components/BankingRegulatoryReports')).toBeNull()
  })
})

describe('Telco Vertical Components', () => {
  it('renders TelcoSubscriberManagement', async () => {
    expect(await safeRender('@/components/TelcoSubscriberManagement')).toBeNull()
  })
  it('renders TelcoFieldOps', async () => {
    expect(await safeRender('@/components/TelcoFieldOps')).toBeNull()
  })
  it('renders TelcoInterconnect', async () => {
    expect(await safeRender('@/components/TelcoInterconnect')).toBeNull()
  })
  it('renders TelcoCellSiteMap', async () => {
    expect(await safeRender('@/components/TelcoCellSiteMap')).toBeNull()
  })
  it('renders TelcoSIMLifecycle', async () => {
    expect(await safeRender('@/components/TelcoSIMLifecycle')).toBeNull()
  })
  it('renders TelcoRevenueAssurance', async () => {
    expect(await safeRender('@/components/TelcoRevenueAssurance')).toBeNull()
  })
  it('renders TelcoNCCCompliance', async () => {
    expect(await safeRender('@/components/TelcoNCCCompliance')).toBeNull()
  })
  it('renders TelcoNumberPortability', async () => {
    expect(await safeRender('@/components/TelcoNumberPortability')).toBeNull()
  })
  it('renders TelcoUSSDReplay', async () => {
    expect(await safeRender('@/components/TelcoUSSDReplay')).toBeNull()
  })
})

describe('Commodity Vertical Components', () => {
  it('renders CommodityTradingDesk', async () => {
    expect(await safeRender('@/components/CommodityTradingDesk')).toBeNull()
  })
  it('renders CommodityBrokerPortal', async () => {
    expect(await safeRender('@/components/CommodityBrokerPortal')).toBeNull()
  })
  it('renders CommoditySettlement', async () => {
    expect(await safeRender('@/components/CommoditySettlement')).toBeNull()
  })
  it('renders CommodityTradeBlotter', async () => {
    expect(await safeRender('@/components/CommodityTradeBlotter')).toBeNull()
  })
  it('renders CommodityPriceFeed', async () => {
    expect(await safeRender('@/components/CommodityPriceFeed')).toBeNull()
  })
  it('renders CommodityCounterpartyRisk', async () => {
    expect(await safeRender('@/components/CommodityCounterpartyRisk')).toBeNull()
  })
  it('renders CommodityMarkToMarket', async () => {
    expect(await safeRender('@/components/CommodityMarkToMarket')).toBeNull()
  })
  it('renders CommodityCFTCReporting', async () => {
    expect(await safeRender('@/components/CommodityCFTCReporting')).toBeNull()
  })
})

describe('CPaaS Vertical Components', () => {
  it('renders CPaaSChannelDashboard', async () => {
    expect(await safeRender('@/components/CPaaSChannelDashboard')).toBeNull()
  })
  it('renders CPaaSDeveloperOnboarding', async () => {
    expect(await safeRender('@/components/CPaaSDeveloperOnboarding')).toBeNull()
  })
  it('renders CPaaSAPIExplorer', async () => {
    expect(await safeRender('@/components/CPaaSAPIExplorer')).toBeNull()
  })
  it('renders CPaaSMessageInspector', async () => {
    expect(await safeRender('@/components/CPaaSMessageInspector')).toBeNull()
  })
  it('renders CPaaSWebhookTester', async () => {
    expect(await safeRender('@/components/CPaaSWebhookTester')).toBeNull()
  })
  it('renders CPaaSA2PCompliance', async () => {
    expect(await safeRender('@/components/CPaaSA2PCompliance')).toBeNull()
  })
  it('renders CPaaSChannelAnalytics', async () => {
    expect(await safeRender('@/components/CPaaSChannelAnalytics')).toBeNull()
  })
})
