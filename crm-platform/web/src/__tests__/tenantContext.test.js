import { describe, it, expect } from 'vitest'

const TENANTS = [
  { slug: 'acme-bank', name: 'Acme Bank', vertical: 'banking', products: ['core_banking', 'agent_banking', 'remittance', 'lending', 'insurance', 'cards'] },
  { slug: 'nextgen-mfb', name: 'NextGen MFB', vertical: 'banking', products: ['core_banking', 'agent_banking', 'lending'] },
  { slug: 'aerotel', name: 'AeroTel', vertical: 'telco', products: ['subscriber_mgmt', 'field_ops', 'interconnect', 'network_ops', 'device_mgmt'] },
  { slug: 'netwave', name: 'NetWave', vertical: 'telco', products: ['subscriber_mgmt', 'field_ops', 'interconnect'] },
  { slug: 'petromark', name: 'PetroMark Trading', vertical: 'commodity', products: ['trading', 'broker_portal', 'settlement', 'risk_mgmt'] },
  { slug: 'agriflow', name: 'AgriFlow', vertical: 'commodity', products: ['trading', 'broker_portal', 'settlement'] },
  { slug: 'messageflow', name: 'MessageFlow', vertical: 'cpaas', products: ['messaging', 'voice_platform', 'developer_portal', 'api_platform'] },
  { slug: 'connecthub', name: 'ConnectHub', vertical: 'cpaas', products: ['messaging', 'voice_platform'] },
]

function hasProduct(tenant, product) {
  return tenant.products.includes(product)
}

describe('Tenant Context — Product Gating', () => {
  it('banking tenants have core_banking', () => {
    const banking = TENANTS.filter(t => t.vertical === 'banking')
    expect(banking.length).toBe(2)
    banking.forEach(t => expect(hasProduct(t, 'core_banking')).toBe(true))
  })

  it('telco tenants have subscriber_mgmt', () => {
    const telco = TENANTS.filter(t => t.vertical === 'telco')
    expect(telco.length).toBe(2)
    telco.forEach(t => expect(hasProduct(t, 'subscriber_mgmt')).toBe(true))
  })

  it('commodity tenants have trading', () => {
    const commodity = TENANTS.filter(t => t.vertical === 'commodity')
    expect(commodity.length).toBe(2)
    commodity.forEach(t => expect(hasProduct(t, 'trading')).toBe(true))
  })

  it('cpaas tenants have messaging', () => {
    const cpaas = TENANTS.filter(t => t.vertical === 'cpaas')
    expect(cpaas.length).toBe(2)
    cpaas.forEach(t => expect(hasProduct(t, 'messaging')).toBe(true))
  })

  it('AeroTel has network_ops but NetWave does not', () => {
    const aerotel = TENANTS.find(t => t.slug === 'aerotel')
    const netwave = TENANTS.find(t => t.slug === 'netwave')
    expect(hasProduct(aerotel, 'network_ops')).toBe(true)
    expect(hasProduct(netwave, 'network_ops')).toBe(false)
  })

  it('PetroMark has risk_mgmt but AgriFlow does not', () => {
    const petro = TENANTS.find(t => t.slug === 'petromark')
    const agri = TENANTS.find(t => t.slug === 'agriflow')
    expect(hasProduct(petro, 'risk_mgmt')).toBe(true)
    expect(hasProduct(agri, 'risk_mgmt')).toBe(false)
  })

  it('MessageFlow has api_platform but ConnectHub does not', () => {
    const mf = TENANTS.find(t => t.slug === 'messageflow')
    const ch = TENANTS.find(t => t.slug === 'connecthub')
    expect(hasProduct(mf, 'api_platform')).toBe(true)
    expect(hasProduct(ch, 'api_platform')).toBe(false)
  })

  it('all tenants have unique slugs', () => {
    const slugs = TENANTS.map(t => t.slug)
    const unique = new Set(slugs)
    expect(unique.size).toBe(slugs.length)
  })

  it('covers all 4 verticals', () => {
    const verticals = new Set(TENANTS.map(t => t.vertical))
    expect(verticals.size).toBe(4)
    expect(verticals.has('banking')).toBe(true)
    expect(verticals.has('telco')).toBe(true)
    expect(verticals.has('commodity')).toBe(true)
    expect(verticals.has('cpaas')).toBe(true)
  })
})
