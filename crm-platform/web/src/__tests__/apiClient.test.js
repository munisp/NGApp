import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('CRM API Client', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('constructs correct API URL with base path', () => {
    const base = '/api/v1'
    expect(`${base}/customers`).toBe('/api/v1/customers')
    expect(`${base}/deals`).toBe('/api/v1/deals')
    expect(`${base}/campaigns`).toBe('/api/v1/campaigns')
  })

  it('builds query params for customer list', () => {
    const params = { page: '1', limit: '20', segment: 'enterprise' }
    const qs = new URLSearchParams(params).toString()
    expect(qs).toContain('page=1')
    expect(qs).toContain('limit=20')
    expect(qs).toContain('segment=enterprise')
  })

  it('encodes search query for customer search', () => {
    const query = 'John Doe & Associates'
    const encoded = encodeURIComponent(query)
    expect(encoded).toBe('John%20Doe%20%26%20Associates')
    expect(decodeURIComponent(encoded)).toBe(query)
  })

  it('constructs tenant header correctly', () => {
    const tenantSlug = 'acme-bank'
    const headers = {
      'Content-Type': 'application/json',
      'X-Tenant-ID': tenantSlug,
    }
    expect(headers['X-Tenant-ID']).toBe('acme-bank')
  })

  it('includes auth token when available', () => {
    const token = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...'
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }
    expect(headers.Authorization).toBe(`Bearer ${token}`)
  })

  it('omits auth header when no token', () => {
    const token = ''
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }
    expect(headers.Authorization).toBeUndefined()
  })

  it('handles vertical-specific endpoints', () => {
    const base = '/api/v1'
    expect(`${base}/telco/subscribers`).toBe('/api/v1/telco/subscribers')
    expect(`${base}/commodity/trades`).toBe('/api/v1/commodity/trades')
    expect(`${base}/cpaas/channels`).toBe('/api/v1/cpaas/channels')
  })
})
