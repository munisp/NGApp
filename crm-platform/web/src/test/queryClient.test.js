import { describe, it, expect } from 'vitest'
import { queryClient, queryKeys } from '@/lib/queryClient'

describe('QueryClient', () => {
  it('has correct default stale time', () => {
    const defaults = queryClient.getDefaultOptions()
    expect(defaults.queries.staleTime).toBe(30_000)
  })

  it('has correct gc time', () => {
    const defaults = queryClient.getDefaultOptions()
    expect(defaults.queries.gcTime).toBe(5 * 60_000)
  })

  it('enables refetch on window focus', () => {
    const defaults = queryClient.getDefaultOptions()
    expect(defaults.queries.refetchOnWindowFocus).toBe(true)
  })

  it('has retry configured', () => {
    const defaults = queryClient.getDefaultOptions()
    expect(defaults.queries.retry).toBe(2)
    expect(defaults.mutations.retry).toBe(1)
  })
})

describe('queryKeys', () => {
  it('generates customer list keys', () => {
    const key = queryKeys.customers.list({ page: 1 })
    expect(key).toEqual(['customers', 'list', { page: 1 }])
  })

  it('generates customer detail keys', () => {
    const key = queryKeys.customers.detail('cust-123')
    expect(key).toEqual(['customers', 'detail', 'cust-123'])
  })

  it('generates campaign keys', () => {
    const key = queryKeys.campaigns.detail('camp-456')
    expect(key).toEqual(['campaigns', 'detail', 'camp-456'])
  })

  it('generates analytics keys', () => {
    const key = queryKeys.analytics.segments({ period: '30d' })
    expect(key).toEqual(['analytics', 'segments', { period: '30d' }])
  })

  it('generates AI/ML keys', () => {
    const gnnKey = queryKeys.ai.gnn({ type: 'fraud' })
    expect(gnnKey).toEqual(['ai', 'gnn', { type: 'fraud' }])

    const mcmcKey = queryKeys.ai.mcmc({ customer: 'C001' })
    expect(mcmcKey).toEqual(['ai', 'mcmc', { customer: 'C001' }])
  })

  it('generates security keys', () => {
    const key = queryKeys.security.threats({ severity: 'high' })
    expect(key).toEqual(['security', 'threats', { severity: 'high' }])
  })

  it('generates tenant keys', () => {
    expect(queryKeys.tenants.current()).toEqual(['tenants', 'current'])
  })
})
