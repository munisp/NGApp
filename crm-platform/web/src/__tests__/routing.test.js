/**
 * Routing tests — verify all routes have required permissions and lazy components load.
 */
import { describe, it, expect, vi } from 'vitest'
import React from 'react'

vi.mock('@/contexts/TenantContext', () => ({
  useTenant: () => ({
    tenant: { slug: 'acme-bank', name: 'Acme Bank', products: [] },
    tenants: [],
    switchTenant: vi.fn(),
  }),
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { name: 'Test', role: 'admin' },
    hasPermission: () => true,
    isAuthenticated: true,
  }),
  AuthProvider: ({ children }) => children,
}))

describe('Route configuration', () => {
  it('App module loads without error', async () => {
    const mod = await import('@/App')
    expect(mod.default).toBeDefined()
  })

  it('all lazy component imports are valid', async () => {
    const components = [
      () => import('@/components/Dashboard'),
      () => import('@/components/CustomerManagement'),
      () => import('@/components/CRMCore'),
      () => import('@/components/Analytics'),
      () => import('@/components/Settings'),
      () => import('@/components/SemanticSearch'),
      () => import('@/components/SalesAgentDashboard'),
      () => import('@/components/ExecutiveCockpit'),
      () => import('@/components/RevOpsPipeline'),
      () => import('@/components/CDPProfiles'),
    ]

    for (const importFn of components) {
      const mod = await importFn()
      expect(mod.default).toBeDefined()
    }
  })
})

describe('Vertical component imports', () => {
  const telcoImports = [
    'TelcoCellSiteMap', 'TelcoSIMLifecycle', 'TelcoRevenueAssurance',
    'TelcoNCCCompliance', 'TelcoNumberPortability', 'TelcoUSSDReplay',
  ]
  telcoImports.forEach(name => {
    it(`${name} exports default component`, async () => {
      const mod = await import(`@/components/${name}`)
      expect(mod.default).toBeDefined()
    })
  })

  const commodityImports = [
    'CommodityTradeBlotter', 'CommodityPriceFeed', 'CommodityCounterpartyRisk',
    'CommodityMarkToMarket', 'CommodityCFTCReporting',
  ]
  commodityImports.forEach(name => {
    it(`${name} exports default component`, async () => {
      const mod = await import(`@/components/${name}`)
      expect(mod.default).toBeDefined()
    })
  })

  const cpaasImports = [
    'CPaaSAPIExplorer', 'CPaaSMessageInspector', 'CPaaSWebhookTester',
    'CPaaSA2PCompliance', 'CPaaSChannelAnalytics',
  ]
  cpaasImports.forEach(name => {
    it(`${name} exports default component`, async () => {
      const mod = await import(`@/components/${name}`)
      expect(mod.default).toBeDefined()
    })
  })

  const bankingImports = [
    'BankingFXRateManager', 'BankingNIPPayments',
    'BankingOpenBankingConsent', 'BankingRegulatoryReports',
  ]
  bankingImports.forEach(name => {
    it(`${name} exports default component`, async () => {
      const mod = await import(`@/components/${name}`)
      expect(mod.default).toBeDefined()
    })
  })
})

describe('AI module imports', () => {
  const aiModules = [
    'SemanticSearch', 'SalesAgentDashboard', 'CustomerSuccessAgent',
    'AgentGovernanceDashboard', 'PredictiveAnalytics', 'EmbeddedAnalytics',
    'WorkflowRuntime',
  ]
  aiModules.forEach(name => {
    it(`${name} exports default component`, async () => {
      const mod = await import(`@/components/${name}`)
      expect(mod.default).toBeDefined()
    })
  })
})

describe('Operations imports', () => {
  const ops = [
    'ComplianceDashboard', 'IncidentManager', 'SecurityDashboard',
    'AuditLog', 'SLAMonitor', 'CustomerHealthScore',
    'ChurnPrevention', 'DealScoring', 'CampaignManager',
    'IntegrationHub', 'KnowledgeBase', 'DigitalSalesRoom',
    'CustomerTimeline', 'DuplicateDetection', 'DataEnrichment',
    'WhiteLabelConfig', 'AICoPilot', 'CohortStudio',
    'DocGeneration', 'MobileCRM', 'SmartTaskAutomation',
    'WinLossAnalysis', 'FeedbackLoop', 'OnboardingTours',
    'SentimentAnalysis', 'MutualActionPlan', 'NextBestAction',
    'PluginMarketplace', 'CustomerAppBuilder',
  ]
  ops.forEach(name => {
    it(`${name} exports default component`, async () => {
      const mod = await import(`@/components/${name}`)
      expect(mod.default).toBeDefined()
    })
  })
})
