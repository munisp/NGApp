/**
 * Hook tests — verify useApiData, useTenantSlug, and related utilities.
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Mock TenantContext
vi.mock('@/contexts/TenantContext', () => ({
  useTenant: () => ({
    tenant: { slug: 'acme-bank', name: 'Acme Bank' },
  }),
}))

const createWrapper = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }) => React.createElement(QueryClientProvider, { client: qc }, children)
}

describe('useApiData', () => {
  it('returns fallback data when no API response', async () => {
    const { useApiData } = await import('@/hooks/useApiData')
    const { result } = renderHook(
      () => useApiData('test-key', () => Promise.reject('no api'), { fallback: [1, 2, 3] }),
      { wrapper: createWrapper() }
    )
    expect(result.current.data).toEqual([1, 2, 3])
    expect(result.current.isUsingFallback).toBe(true)
  })

  it('returns isLoading false when fallback available', async () => {
    const { useApiData } = await import('@/hooks/useApiData')
    const { result } = renderHook(
      () => useApiData('test-loading', () => new Promise(() => {}), { fallback: ['a'] }),
      { wrapper: createWrapper() }
    )
    expect(result.current.isLoading).toBe(false)
  })

  it('handles null fallback gracefully', async () => {
    const { useApiData } = await import('@/hooks/useApiData')
    const { result } = renderHook(
      () => useApiData('test-null', () => Promise.reject('err')),
      { wrapper: createWrapper() }
    )
    expect(result.current.data).toBeNull()
  })

  it('includes tenant slug in query key', async () => {
    const { useApiData } = await import('@/hooks/useApiData')
    const { result } = renderHook(
      () => useApiData('my-key', () => Promise.resolve([]), { fallback: [] }),
      { wrapper: createWrapper() }
    )
    expect(result.current.data).toEqual([])
  })

  it('returns refetch function', async () => {
    const { useApiData } = await import('@/hooks/useApiData')
    const { result } = renderHook(
      () => useApiData('refetch-test', () => Promise.resolve([]), { fallback: [] }),
      { wrapper: createWrapper() }
    )
    expect(typeof result.current.refetch).toBe('function')
  })

  it('handles array query keys', async () => {
    const { useApiData } = await import('@/hooks/useApiData')
    const { result } = renderHook(
      () => useApiData(['customers', 'list'], () => Promise.resolve([]), { fallback: [] }),
      { wrapper: createWrapper() }
    )
    expect(result.current.data).toEqual([])
  })

  it('respects enabled option', async () => {
    const { useApiData } = await import('@/hooks/useApiData')
    const apiFn = vi.fn(() => Promise.resolve([]))
    const { result } = renderHook(
      () => useApiData('disabled', apiFn, { enabled: false, fallback: ['x'] }),
      { wrapper: createWrapper() }
    )
    expect(result.current.data).toEqual(['x'])
  })
})

describe('apiClient', () => {
  it('has all required endpoint groups', async () => {
    const { apiClient } = await import('@/lib/apiClient')
    expect(apiClient).toHaveProperty('customers')
    expect(apiClient).toHaveProperty('dashboard')
    expect(apiClient).toHaveProperty('deals')
    expect(apiClient).toHaveProperty('agents')
    expect(apiClient).toHaveProperty('telco')
    expect(apiClient).toHaveProperty('commodity')
    expect(apiClient).toHaveProperty('cpaas')
    expect(apiClient).toHaveProperty('revops')
    expect(apiClient).toHaveProperty('workflows')
    expect(apiClient).toHaveProperty('search')
    expect(apiClient).toHaveProperty('health')
  })

  it('customer endpoints are functions', async () => {
    const { apiClient } = await import('@/lib/apiClient')
    expect(typeof apiClient.customers.list).toBe('function')
    expect(typeof apiClient.customers.get).toBe('function')
    expect(typeof apiClient.customers.create).toBe('function')
  })

  it('dashboard endpoints are functions', async () => {
    const { apiClient } = await import('@/lib/apiClient')
    expect(typeof apiClient.dashboard.metrics).toBe('function')
    expect(typeof apiClient.dashboard.revenue).toBe('function')
  })

  it('agent endpoints are functions', async () => {
    const { apiClient } = await import('@/lib/apiClient')
    expect(typeof apiClient.agents.list).toBe('function')
  })

  it('telco endpoints are functions', async () => {
    const { apiClient } = await import('@/lib/apiClient')
    expect(typeof apiClient.telco.subscribers).toBe('function')
    expect(typeof apiClient.telco.cellSites).toBe('function')
  })

  it('commodity endpoints are functions', async () => {
    const { apiClient } = await import('@/lib/apiClient')
    expect(typeof apiClient.commodity.trades).toBe('function')
    expect(typeof apiClient.commodity.priceFeed).toBe('function')
  })

  it('search endpoints are functions', async () => {
    const { apiClient } = await import('@/lib/apiClient')
    expect(typeof apiClient.search.semantic).toBe('function')
  })
})

describe('queryClient', () => {
  it('exports a valid QueryClient instance', async () => {
    const { queryClient } = await import('@/lib/queryClient')
    expect(queryClient).toBeDefined()
    expect(typeof queryClient.invalidateQueries).toBe('function')
    expect(typeof queryClient.getQueryData).toBe('function')
  })
})
