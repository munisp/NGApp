/**
 * Component rendering tests — verify all major CRM components render without errors.
 * Tests each component category: AI modules, vertical deep, generic tables, partial builds.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import React from 'react'

// Mock TenantContext
vi.mock('@/contexts/TenantContext', () => ({
  useTenant: () => ({
    tenant: {
      slug: 'acme-bank',
      name: 'Acme Bank',
      products: ['core_banking', 'agent_banking', 'remittance', 'insurance', 'trade_finance', 'fx_services'],
      hasProduct: (p) => ['core_banking', 'agent_banking', 'remittance', 'insurance', 'trade_finance', 'fx_services'].includes(p),
    },
    tenants: [{ slug: 'acme-bank', name: 'Acme Bank' }],
    switchTenant: vi.fn(),
  }),
  TenantContext: React.createContext({}),
}))

// Mock useApiData hook
vi.mock('@/hooks/useApiData', () => ({
  useApiData: (key, fn, opts) => ({
    data: opts?.fallback ?? [],
    isLoading: false,
    isError: false,
    error: null,
    isFetching: false,
    isUsingFallback: true,
    refetch: vi.fn(),
  }),
  useApiMutation: () => ({
    mutate: vi.fn(),
    isLoading: false,
  }),
  useTenantSlug: () => 'acme-bank',
}))

// Mock apiClient
vi.mock('@/lib/apiClient', () => ({
  apiClient: {
    dashboard: { metrics: vi.fn(), revenue: vi.fn(), funnel: vi.fn(), activities: vi.fn() },
    customers: { list: vi.fn(), get: vi.fn(), create: vi.fn(), search: vi.fn() },
    deals: { list: vi.fn(), get: vi.fn(), forecast: vi.fn() },
    agents: { list: vi.fn(), governance: vi.fn(), execute: vi.fn(), auditLog: vi.fn() },
    telco: { subscribers: vi.fn(), cellSites: vi.fn(), fieldOps: vi.fn() },
    commodity: { trades: vi.fn(), priceFeed: vi.fn(), positions: vi.fn(), counterpartyRisk: vi.fn() },
    cpaas: { channels: vi.fn(), messages: vi.fn(), apiExplorer: vi.fn() },
    revops: { pipeline: vi.fn(), forecast: vi.fn(), attribution: vi.fn(), cdp: { profiles: vi.fn() } },
    workflows: { list: vi.fn(), get: vi.fn() },
    search: { semantic: vi.fn(), advanced: vi.fn() },
    health: { scores: vi.fn(), alerts: vi.fn() },
  },
}))

// Mock i18n
vi.mock('@/lib/i18n/useTranslation', () => ({
  useTranslation: () => ({
    t: (key) => key,
    locale: 'en',
    setLocale: vi.fn(),
  }),
}))

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: new Proxy({}, {
    get: (_, tag) => {
      const component = React.forwardRef(({ children, ...props }, ref) =>
        React.createElement(tag, { ...props, ref }, children)
      )
      component.displayName = `motion.${tag}`
      return component
    },
  }),
  AnimatePresence: ({ children }) => React.createElement(React.Fragment, null, children),
  useMotionValue: () => ({ set: vi.fn(), get: () => 0 }),
  useTransform: () => ({ set: vi.fn(), get: () => 0 }),
  useSpring: () => ({ set: vi.fn(), get: () => 0 }),
}))

// Mock react-query
vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: null, isLoading: false, isError: false }),
  useMutation: () => ({ mutate: vi.fn(), isLoading: false }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  QueryClientProvider: ({ children }) => children,
  QueryClient: vi.fn(),
}))

// Mock DataStates
vi.mock('@/components/ui/DataStates', () => ({
  LoadingState: () => React.createElement('div', null, 'Loading...'),
  ErrorState: () => React.createElement('div', null, 'Error'),
  EmptyState: () => React.createElement('div', null, 'Empty'),
  FallbackBadge: () => React.createElement('span', null, 'Fallback'),
  ExportButton: () => React.createElement('button', null, 'Export'),
}))

// Mock AuthContext
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { name: 'Test User', email: 'test@test.com', role: 'admin' },
    hasPermission: () => true,
    isAuthenticated: true,
    logout: vi.fn(),
  }),
}))

// Mock ThemeContext
vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({ isDark: false, toggle: vi.fn() }),
}))

const Wrapper = ({ children }) => (
  React.createElement(BrowserRouter, null, children)
)

const renderComponent = async (importFn) => {
  try {
    const mod = await importFn()
    const Component = mod.default || mod
    const { container } = render(React.createElement(Component), { wrapper: Wrapper })
    return { container, error: null }
  } catch (e) {
    return { container: null, error: e }
  }
}

describe('AI Module Components', () => {
  const modules = [
    ['SemanticSearch', () => import('@/components/SemanticSearch')],
    ['SalesAgentDashboard', () => import('@/components/SalesAgentDashboard')],
    ['CustomerSuccessAgent', () => import('@/components/CustomerSuccessAgent')],
    ['AgentGovernanceDashboard', () => import('@/components/AgentGovernanceDashboard')],
    ['PredictiveAnalytics', () => import('@/components/PredictiveAnalytics')],
    ['EmbeddedAnalytics', () => import('@/components/EmbeddedAnalytics')],
    ['WorkflowRuntime', () => import('@/components/WorkflowRuntime')],
  ]

  modules.forEach(([name, importFn]) => {
    it(`renders ${name} without error`, async () => {
      const { error } = await renderComponent(importFn)
      expect(error).toBeNull()
    })
  })
})

describe('Executive & Core Components', () => {
  const components = [
    ['ExecutiveCockpit', () => import('@/components/ExecutiveCockpit')],
    ['UnifiedDashboard', () => import('@/components/UnifiedDashboard')],
    ['Dashboard', () => import('@/components/Dashboard')],
    ['Analytics', () => import('@/components/Analytics')],
    ['CustomerManagement', () => import('@/components/CustomerManagement')],
    ['Customer360', () => import('@/components/Customer360')],
    ['CRMCore', () => import('@/components/CRMCore')],
    ['WorkflowBuilder', () => import('@/components/WorkflowBuilder')],
  ]

  components.forEach(([name, importFn]) => {
    it(`renders ${name} without error`, async () => {
      const { error } = await renderComponent(importFn)
      expect(error).toBeNull()
    })
  })
})

describe('Banking Vertical Components', () => {
  const components = [
    ['BankingFXRateManager', () => import('@/components/BankingFXRateManager')],
    ['BankingNIPPayments', () => import('@/components/BankingNIPPayments')],
    ['BankingOpenBankingConsent', () => import('@/components/BankingOpenBankingConsent')],
    ['BankingRegulatoryReports', () => import('@/components/BankingRegulatoryReports')],
    ['CoreBankingView', () => import('@/components/CoreBankingView')],
    ['AgentBankingView', () => import('@/components/AgentBankingView')],
  ]

  components.forEach(([name, importFn]) => {
    it(`renders ${name} without error`, async () => {
      const { error } = await renderComponent(importFn)
      expect(error).toBeNull()
    })
  })
})

describe('Telco Vertical Components', () => {
  const components = [
    ['TelcoCellSiteMap', () => import('@/components/TelcoCellSiteMap')],
    ['TelcoSIMLifecycle', () => import('@/components/TelcoSIMLifecycle')],
    ['TelcoRevenueAssurance', () => import('@/components/TelcoRevenueAssurance')],
    ['TelcoNCCCompliance', () => import('@/components/TelcoNCCCompliance')],
    ['TelcoNumberPortability', () => import('@/components/TelcoNumberPortability')],
    ['TelcoUSSDReplay', () => import('@/components/TelcoUSSDReplay')],
  ]

  components.forEach(([name, importFn]) => {
    it(`renders ${name} without error`, async () => {
      const { error } = await renderComponent(importFn)
      expect(error).toBeNull()
    })
  })
})

describe('Commodity Vertical Components', () => {
  const components = [
    ['CommodityTradeBlotter', () => import('@/components/CommodityTradeBlotter')],
    ['CommodityPriceFeed', () => import('@/components/CommodityPriceFeed')],
    ['CommodityCounterpartyRisk', () => import('@/components/CommodityCounterpartyRisk')],
    ['CommodityMarkToMarket', () => import('@/components/CommodityMarkToMarket')],
    ['CommodityCFTCReporting', () => import('@/components/CommodityCFTCReporting')],
  ]

  components.forEach(([name, importFn]) => {
    it(`renders ${name} without error`, async () => {
      const { error } = await renderComponent(importFn)
      expect(error).toBeNull()
    })
  })
})

describe('CPaaS Vertical Components', () => {
  const components = [
    ['CPaaSAPIExplorer', () => import('@/components/CPaaSAPIExplorer')],
    ['CPaaSMessageInspector', () => import('@/components/CPaaSMessageInspector')],
    ['CPaaSWebhookTester', () => import('@/components/CPaaSWebhookTester')],
    ['CPaaSA2PCompliance', () => import('@/components/CPaaSA2PCompliance')],
    ['CPaaSChannelAnalytics', () => import('@/components/CPaaSChannelAnalytics')],
  ]

  components.forEach(([name, importFn]) => {
    it(`renders ${name} without error`, async () => {
      const { error } = await renderComponent(importFn)
      expect(error).toBeNull()
    })
  })
})

describe('RevOps & CDP Components', () => {
  const components = [
    ['RevOpsPipeline', () => import('@/components/RevOpsPipeline')],
    ['CDPProfiles', () => import('@/components/CDPProfiles')],
    ['RevenueIntelligence', () => import('@/components/RevenueIntelligence')],
    ['MultiTouchAttribution', () => import('@/components/MultiTouchAttribution')],
    ['RevenueAttribution', () => import('@/components/RevenueAttribution')],
  ]

  components.forEach(([name, importFn]) => {
    it(`renders ${name} without error`, async () => {
      const { error } = await renderComponent(importFn)
      expect(error).toBeNull()
    })
  })
})

describe('Operations & Tools Components', () => {
  const components = [
    ['ComplianceDashboard', () => import('@/components/ComplianceDashboard')],
    ['IncidentManager', () => import('@/components/IncidentManager')],
    ['SecurityDashboard', () => import('@/components/SecurityDashboard')],
    ['AuditLog', () => import('@/components/AuditLog')],
    ['SLAMonitor', () => import('@/components/SLAMonitor')],
    ['CustomerHealthScore', () => import('@/components/CustomerHealthScore')],
    ['ChurnPrevention', () => import('@/components/ChurnPrevention')],
    ['DealScoring', () => import('@/components/DealScoring')],
    ['CampaignManager', () => import('@/components/CampaignManager')],
    ['IntegrationHub', () => import('@/components/IntegrationHub')],
    ['KnowledgeBase', () => import('@/components/KnowledgeBase')],
    ['DigitalSalesRoom', () => import('@/components/DigitalSalesRoom')],
    ['CustomerTimeline', () => import('@/components/CustomerTimeline')],
    ['DuplicateDetection', () => import('@/components/DuplicateDetection')],
    ['DataEnrichment', () => import('@/components/DataEnrichment')],
  ]

  components.forEach(([name, importFn]) => {
    it(`renders ${name} without error`, async () => {
      const { error } = await renderComponent(importFn)
      expect(error).toBeNull()
    })
  })
})

describe('Utility & Feature Components', () => {
  const components = [
    ['WhiteLabelConfig', () => import('@/components/WhiteLabelConfig')],
    ['AICoPilot', () => import('@/components/AICoPilot')],
    ['CohortStudio', () => import('@/components/CohortStudio')],
    ['DocGeneration', () => import('@/components/DocGeneration')],
    ['MobileCRM', () => import('@/components/MobileCRM')],
    ['SmartTaskAutomation', () => import('@/components/SmartTaskAutomation')],
    ['WinLossAnalysis', () => import('@/components/WinLossAnalysis')],
    ['FeedbackLoop', () => import('@/components/FeedbackLoop')],
    ['OnboardingTours', () => import('@/components/OnboardingTours')],
    ['SentimentAnalysis', () => import('@/components/SentimentAnalysis')],
    ['MutualActionPlan', () => import('@/components/MutualActionPlan')],
    ['NextBestAction', () => import('@/components/NextBestAction')],
    ['PluginMarketplace', () => import('@/components/PluginMarketplace')],
    ['CustomerAppBuilder', () => import('@/components/CustomerAppBuilder')],
  ]

  components.forEach(([name, importFn]) => {
    it(`renders ${name} without error`, async () => {
      const { error } = await renderComponent(importFn)
      expect(error).toBeNull()
    })
  })
})
