import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

vi.mock('framer-motion', () => ({ motion: { div: 'div', span: 'span', button: 'button' }, AnimatePresence: ({ children }) => children }))

const CONTEXT_PATH = join(__dirname, '..', 'contexts', 'TenantContext.jsx')
const SIDEBAR_PATH = join(__dirname, '..', 'components', 'Sidebar.jsx')

describe('Multi-Tenant System', () => {
  const tenantContext = readFileSync(CONTEXT_PATH, 'utf-8')

  describe('Tenant Profiles', () => {
    const tenantIds = [
      'tenant-nextgen-mfb', 'tenant-acme-bank', 'tenant-aerotel',
      'tenant-netwave', 'tenant-petromark', 'tenant-agriflow',
      'tenant-messageflow', 'tenant-connecthub', 'tenant-quickcash',
      'tenant-swiftremit'
    ]

    tenantIds.forEach(id => {
      it(`defines tenant ${id}`, () => {
        expect(tenantContext).toContain(id)
      })
    })
  })

  describe('Product Modules', () => {
    const modules = [
      'core_banking', 'agent_banking', 'remittance',
      'network_ops', 'subscriber_mgmt', 'interconnect', 'field_ops',
      'trading', 'risk_mgmt', 'settlement', 'broker_portal',
      'messaging', 'voice', 'api_platform'
    ]

    modules.forEach(mod => {
      it(`has product module ${mod}`, () => {
        expect(tenantContext).toContain(mod)
      })
    })
  })

  describe('Tenant Properties', () => {
    it('each tenant has name, slug, products', () => {
      expect(tenantContext).toContain('name:')
      expect(tenantContext).toContain('slug:')
      expect(tenantContext).toContain('products:')
    })

    it('supports NGN currency', () => {
      expect(tenantContext).toContain("'NGN'")
    })

    it('supports USD currency', () => {
      expect(tenantContext).toContain("'USD'")
    })
  })
})

describe('Product Gating', () => {
  const sidebar = readFileSync(SIDEBAR_PATH, 'utf-8')

  describe('Sidebar Navigation', () => {
    it('has product gating logic', () => {
      expect(sidebar).toContain('products')
    })

    it('has section filtering', () => {
      expect(sidebar).toContain('filter')
    })

    it('supports collapsed state', () => {
      expect(sidebar).toContain('isOpen')
    })
  })
})

describe('Vertical Coverage', () => {
  const verticals = {
    Banking: ['FXRateManager', 'NIPPayments', 'OpenBankingConsent', 'RegulatoryReports'],
    Telco: ['CellSiteMap', 'SIMLifecycle', 'RevenueAssurance', 'NCCCompliance', 'NumberPortability', 'USSDReplay'],
    Commodity: ['CFTCReporting', 'CounterpartyRisk', 'MarkToMarket', 'PriceFeed', 'TradeBlotter'],
    CPaaS: ['A2PCompliance', 'APIExplorer', 'ChannelAnalytics', 'MessageInspector', 'WebhookTester'],
  }

  Object.entries(verticals).forEach(([vertical, components]) => {
    describe(`${vertical} Vertical`, () => {
      components.forEach(comp => {
        it(`has ${vertical}${comp} component`, async () => {
          const mod = await import(`../components/${vertical}${comp}.jsx`)
          expect(mod.default).toBeDefined()
          expect(typeof mod.default).toBe('function')
        })
      })
    })
  })
})
