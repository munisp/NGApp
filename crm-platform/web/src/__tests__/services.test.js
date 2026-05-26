/**
 * Service layer tests — verify API client, event bus, adapters export correctly.
 */
import { describe, it, expect, vi } from 'vitest'

describe('apiClient service', () => {
  it('exports apiClient object', async () => {
    const { apiClient } = await import('@/lib/apiClient')
    expect(apiClient).toBeDefined()
    expect(typeof apiClient).toBe('object')
  })

  it('has customers endpoint group', async () => {
    const { apiClient } = await import('@/lib/apiClient')
    expect(apiClient.customers).toBeDefined()
    expect(typeof apiClient.customers.list).toBe('function')
    expect(typeof apiClient.customers.get).toBe('function')
    expect(typeof apiClient.customers.create).toBe('function')
    expect(typeof apiClient.customers.update).toBe('function')
    expect(typeof apiClient.customers.delete).toBe('function')
  })

  it('has dashboard endpoint group', async () => {
    const { apiClient } = await import('@/lib/apiClient')
    expect(apiClient.dashboard).toBeDefined()
    expect(typeof apiClient.dashboard.metrics).toBe('function')
    expect(typeof apiClient.dashboard.revenue).toBe('function')
  })

  it('has deals endpoint group', async () => {
    const { apiClient } = await import('@/lib/apiClient')
    expect(apiClient.deals).toBeDefined()
    expect(typeof apiClient.deals.list).toBe('function')
  })

  it('has telco endpoint group', async () => {
    const { apiClient } = await import('@/lib/apiClient')
    expect(apiClient.telco).toBeDefined()
    expect(typeof apiClient.telco.subscribers).toBe('function')
    expect(typeof apiClient.telco.cellSites).toBe('function')
    expect(typeof apiClient.telco.simLifecycle).toBe('function')
  })

  it('has commodity endpoint group', async () => {
    const { apiClient } = await import('@/lib/apiClient')
    expect(apiClient.commodity).toBeDefined()
    expect(typeof apiClient.commodity.trades).toBe('function')
    expect(typeof apiClient.commodity.priceFeed).toBe('function')
    expect(typeof apiClient.commodity.positions).toBe('function')
  })

  it('has cpaas endpoint group', async () => {
    const { apiClient } = await import('@/lib/apiClient')
    expect(apiClient.cpaas).toBeDefined()
    expect(typeof apiClient.cpaas.channels).toBe('function')
    expect(typeof apiClient.cpaas.messages).toBe('function')
  })

  it('has revops endpoint group', async () => {
    const { apiClient } = await import('@/lib/apiClient')
    expect(apiClient.revops).toBeDefined()
  })

  it('has search endpoint group', async () => {
    const { apiClient } = await import('@/lib/apiClient')
    expect(apiClient.search).toBeDefined()
    expect(typeof apiClient.search.semantic).toBe('function')
  })

  it('has health endpoint group', async () => {
    const { apiClient } = await import('@/lib/apiClient')
    expect(apiClient.health).toBeDefined()
    expect(typeof apiClient.health.scores).toBe('function')
  })

  it('has agents endpoint group', async () => {
    const { apiClient } = await import('@/lib/apiClient')
    expect(apiClient.agents).toBeDefined()
    expect(typeof apiClient.agents.list).toBe('function')
  })

  it('has workflows endpoint group', async () => {
    const { apiClient } = await import('@/lib/apiClient')
    expect(apiClient.workflows).toBeDefined()
  })
})

describe('queryClient service', () => {
  it('exports queryClient', async () => {
    const { queryClient } = await import('@/lib/queryClient')
    expect(queryClient).toBeDefined()
    expect(typeof queryClient.invalidateQueries).toBe('function')
    expect(typeof queryClient.getQueryData).toBe('function')
    expect(typeof queryClient.setQueryData).toBe('function')
    expect(typeof queryClient.clear).toBe('function')
  })
})

describe('utils', () => {
  it('exports cn utility', async () => {
    const { cn } = await import('@/lib/utils')
    expect(cn).toBeDefined()
    expect(typeof cn).toBe('function')
  })

  it('cn merges classnames', async () => {
    const { cn } = await import('@/lib/utils')
    const result = cn('foo', 'bar')
    expect(result).toContain('foo')
    expect(result).toContain('bar')
  })

  it('cn handles conditional classes', async () => {
    const { cn } = await import('@/lib/utils')
    const result = cn('base', false && 'hidden', 'visible')
    expect(result).toContain('base')
    expect(result).toContain('visible')
    expect(result).not.toContain('hidden')
  })
})
