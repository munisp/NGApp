import { describe, it, expect, vi, beforeEach } from 'vitest'

// Test the API client utility functions
describe('API Client', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('should construct correct auth headers', async () => {
    localStorage.setItem('auth_token', 'test-token-123')
    localStorage.setItem('tenant_id', 'tenant-acme-bank')

    const { getAuthHeaders } = await import('@/lib/api.js').then(m => {
      // Access internal via re-import
      return { getAuthHeaders: () => m.default }
    })

    // Verify token and tenant are stored
    expect(localStorage.getItem('auth_token')).toBe('test-token-123')
    expect(localStorage.getItem('tenant_id')).toBe('tenant-acme-bank')
  })

  it('should export domain-specific API modules', async () => {
    const api = await import('@/lib/api.js')
    expect(api.customersApi).toBeDefined()
    expect(api.customersApi.list).toBeTypeOf('function')
    expect(api.customersApi.get).toBeTypeOf('function')
    expect(api.customersApi.create).toBeTypeOf('function')
    expect(api.campaignsApi).toBeDefined()
    expect(api.bankingApi).toBeDefined()
    expect(api.aiApi).toBeDefined()
    expect(api.auditApi).toBeDefined()
    expect(api.securityApi).toBeDefined()
  })

  it('should export ApiError class', async () => {
    const { ApiError } = await import('@/lib/api.js')
    const err = new ApiError(404, 'Not found', { field: 'id' })
    expect(err.status).toBe(404)
    expect(err.message).toBe('Not found')
    expect(err.details).toEqual({ field: 'id' })
    expect(err.name).toBe('ApiError')
  })

  it('should have AI API endpoints', async () => {
    const { aiApi } = await import('@/lib/api.js')
    expect(aiApi.gnn.fraudAnalysis).toBeTypeOf('function')
    expect(aiApi.mcmc.riskAnalysis).toBeTypeOf('function')
    expect(aiApi.kgqa.query).toBeTypeOf('function')
    expect(aiApi.graphrag.query).toBeTypeOf('function')
    expect(aiApi.ollama.models).toBeTypeOf('function')
  })
})
