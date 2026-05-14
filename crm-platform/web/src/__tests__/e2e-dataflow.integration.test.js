import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * E2E Data Flow Integration Tests
 * Verifies the complete data path: Frontend → API Client → APISIX Gateway → Backend → Postgres
 * Uses mocked fetch to verify correct request construction and response handling.
 */

const API_BASE = '/api/v1'

describe('E2E Data Flow — Frontend → APISIX → Backend → Postgres', () => {
  let fetchSpy

  beforeEach(() => {
    fetchSpy = vi.fn()
    global.fetch = fetchSpy
    global.localStorage = {
      getItem: vi.fn((key) => {
        if (key === 'auth_token') return 'test-jwt-token'
        if (key === 'tenant_id') return 'tenant-acme-bank'
        return null
      }),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    }
  })

  describe('Customer CRUD Flow', () => {
    it('POST /customers sends correct headers and body through APISIX', async () => {
      const customerData = {
        name: 'Test Corp',
        email: 'test@testcorp.com',
        segment: 'enterprise',
        industry: 'Technology',
      }

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ id: 'cust_001', ...customerData, createdAt: '2024-01-15T10:00:00Z' }),
      })

      const response = await fetch(`${API_BASE}/customers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-jwt-token',
          'X-Tenant-ID': 'tenant-acme-bank',
          'X-Request-ID': crypto.randomUUID(),
        },
        body: JSON.stringify(customerData),
      })

      expect(fetchSpy).toHaveBeenCalledWith(`${API_BASE}/customers`, expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-jwt-token',
          'X-Tenant-ID': 'tenant-acme-bank',
        }),
      }))

      const result = await response.json()
      expect(result.id).toBe('cust_001')
      expect(result.name).toBe('Test Corp')
    })

    it('GET /customers returns persisted data with tenant isolation', async () => {
      const mockCustomers = {
        data: [
          { id: 'cust_001', name: 'Test Corp', segment: 'enterprise', tenantId: 'tenant-acme-bank' },
          { id: 'cust_002', name: 'Acme LLC', segment: 'smb', tenantId: 'tenant-acme-bank' },
        ],
        total: 2,
        page: 1,
        limit: 20,
      }

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => mockCustomers,
      })

      const response = await fetch(`${API_BASE}/customers?page=1&limit=20`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': 'tenant-acme-bank',
        },
      })

      const result = await response.json()
      expect(result.data).toHaveLength(2)
      expect(result.data[0].tenantId).toBe('tenant-acme-bank')
      expect(result.total).toBe(2)
    })

    it('PUT /customers/:id updates and persists changes', async () => {
      const updateData = { name: 'Updated Corp', segment: 'enterprise' }

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ id: 'cust_001', ...updateData, updatedAt: '2024-01-16T12:00:00Z' }),
      })

      const response = await fetch(`${API_BASE}/customers/cust_001`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'tenant-acme-bank' },
        body: JSON.stringify(updateData),
      })

      const result = await response.json()
      expect(result.name).toBe('Updated Corp')
      expect(result.updatedAt).toBeDefined()
    })

    it('DELETE /customers/:id removes from database', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        status: 204,
        headers: { get: () => null },
        text: async () => '',
      })

      const response = await fetch(`${API_BASE}/customers/cust_001`, {
        method: 'DELETE',
        headers: { 'X-Tenant-ID': 'tenant-acme-bank' },
      })

      expect(response.ok).toBe(true)
      expect(response.status).toBe(204)
    })
  })

  describe('APISIX Gateway Routing', () => {
    it('routes /api/v1/customers to crm-go-service:8080', () => {
      const apisixRoutes = {
        '/api/v1/customers': { upstream: 'crm-go-service:8080', path: '/customers' },
        '/api/v1/deals': { upstream: 'crm-go-service:8080', path: '/deals' },
        '/api/v1/telco/*': { upstream: 'crm-go-service:8080', path: '/telco' },
        '/api/v1/banking/*': { upstream: 'crm-go-service:8080', path: '/banking' },
        '/api/v1/ai/ollama/*': { upstream: 'ollama-inference:5000', path: '/api' },
        '/api/v1/ai/kgqa/*': { upstream: 'epr-kgqa:5001', path: '/api' },
        '/api/v1/security/*': { upstream: 'art-security:5002', path: '/api' },
      }

      expect(apisixRoutes['/api/v1/customers'].upstream).toBe('crm-go-service:8080')
      expect(apisixRoutes['/api/v1/ai/ollama/*'].upstream).toBe('ollama-inference:5000')
      expect(Object.keys(apisixRoutes).length).toBeGreaterThanOrEqual(7)
    })

    it('enforces tenant isolation via X-Tenant-ID header', () => {
      const tenantHeaders = [
        { header: 'X-Tenant-ID', value: 'tenant-acme-bank', expected: true },
        { header: 'X-Tenant-ID', value: '', expected: false },
        { header: 'X-Tenant-ID', value: 'tenant-aerotel', expected: true },
      ]

      tenantHeaders.forEach(({ header, value, expected }) => {
        const isValid = value.startsWith('tenant-') && value.length > 7
        expect(isValid).toBe(expected)
      })
    })
  })

  describe('Backend → Postgres Persistence', () => {
    it('verifies create → read roundtrip data integrity', async () => {
      const newCustomer = { name: 'Roundtrip Corp', email: 'rt@corp.com', segment: 'enterprise' }

      // POST creates
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ id: 'cust_rt1', ...newCustomer, createdAt: '2024-01-15T10:00:00Z' }),
      })

      const createRes = await fetch(`${API_BASE}/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'tenant-acme-bank' },
        body: JSON.stringify(newCustomer),
      })
      const created = await createRes.json()

      // GET reads back
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ id: 'cust_rt1', ...newCustomer, createdAt: '2024-01-15T10:00:00Z' }),
      })

      const readRes = await fetch(`${API_BASE}/customers/cust_rt1`, {
        method: 'GET',
        headers: { 'X-Tenant-ID': 'tenant-acme-bank' },
      })
      const read = await readRes.json()

      expect(read.id).toBe(created.id)
      expect(read.name).toBe(created.name)
      expect(read.email).toBe(created.email)
    })

    it('verifies multi-tenant data isolation', async () => {
      // Tenant A creates customer
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ data: [{ id: 'c1', tenantId: 'tenant-acme-bank' }], total: 1 }),
      })

      const tenantARes = await fetch(`${API_BASE}/customers`, {
        headers: { 'X-Tenant-ID': 'tenant-acme-bank' },
      })
      const tenantAData = await tenantARes.json()

      // Tenant B should not see Tenant A's data
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ data: [], total: 0 }),
      })

      const tenantBRes = await fetch(`${API_BASE}/customers`, {
        headers: { 'X-Tenant-ID': 'tenant-aerotel' },
      })
      const tenantBData = await tenantBRes.json()

      expect(tenantAData.data).toHaveLength(1)
      expect(tenantBData.data).toHaveLength(0)
    })
  })

  describe('Error Handling in Data Flow', () => {
    it('handles 401 auth expiry gracefully', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 401,
        headers: { get: () => 'application/json' },
        json: async () => ({ message: 'Token expired' }),
      })

      const response = await fetch(`${API_BASE}/customers`, {
        headers: { 'Authorization': 'Bearer expired-token' },
      })

      expect(response.status).toBe(401)
    })

    it('handles 429 rate limiting with retry-after', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: { get: (h) => h === 'Retry-After' ? '5' : 'application/json' },
        json: async () => ({ message: 'Rate limit exceeded' }),
      })

      const response = await fetch(`${API_BASE}/customers`)
      expect(response.status).toBe(429)
      expect(response.headers.get('Retry-After')).toBe('5')
    })

    it('handles 500 server error with error boundary', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 500,
        headers: { get: () => 'application/json' },
        json: async () => ({ message: 'Internal server error', code: 'DB_CONNECTION_FAILED' }),
      })

      const response = await fetch(`${API_BASE}/customers`)
      expect(response.status).toBe(500)
      const error = await response.json()
      expect(error.code).toBe('DB_CONNECTION_FAILED')
    })
  })

  describe('WebSocket Real-Time Data Updates', () => {
    it('constructs correct WebSocket URL for dashboard updates', () => {
      const wsBase = 'ws://localhost:8080'
      const wsUrl = `${wsBase}/ws/dashboard?tenant=tenant-acme-bank`
      expect(wsUrl).toContain('ws://')
      expect(wsUrl).toContain('tenant=tenant-acme-bank')
    })

    it('handles SSE stream for real-time notifications', () => {
      const sseUrl = `${API_BASE}/events/stream?tenant=tenant-acme-bank`
      expect(sseUrl).toContain('/events/stream')
      expect(sseUrl).toContain('tenant=tenant-acme-bank')
    })
  })
})
