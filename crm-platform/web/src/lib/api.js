/**
 * API Client — Unified HTTP client for all CRM backend services
 * Handles auth tokens, tenant headers, error normalization, retry logic
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1'
const AUTH_BASE_URL = import.meta.env.VITE_AUTH_BASE_URL || '/auth'
const MAX_RETRIES = 2
const RETRY_DELAY_MS = 1000

class ApiError extends Error {
  constructor(status, message, details = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

const getAuthHeaders = () => {
  const token = localStorage.getItem('auth_token')
  const tenantId = localStorage.getItem('tenant_id') || 'tenant-acme-bank'
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : '',
    'X-Tenant-ID': tenantId,
    'X-Request-ID': crypto.randomUUID(),
  }
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

const handleResponse = async (response) => {
  if (response.ok) {
    const contentType = response.headers.get('content-type')
    if (contentType && contentType.includes('application/json')) {
      return response.json()
    }
    return response.text()
  }

  let errorMessage = `HTTP ${response.status}`
  let details = null
  try {
    const body = await response.json()
    errorMessage = body.message || body.error || errorMessage
    details = body.details || body.errors || null
  } catch {
    errorMessage = response.statusText || errorMessage
  }

  throw new ApiError(response.status, errorMessage, details)
}

const fetchWithRetry = async (url, options, retries = MAX_RETRIES) => {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, { ...options, headers: getAuthHeaders() })

      if (response.status === 401) {
        localStorage.removeItem('auth_token')
        window.dispatchEvent(new CustomEvent('auth:expired'))
        throw new ApiError(401, 'Session expired')
      }

      if (response.status === 429 && attempt < retries) {
        const retryAfter = response.headers.get('Retry-After')
        await sleep((retryAfter ? parseInt(retryAfter) * 1000 : RETRY_DELAY_MS) * (attempt + 1))
        continue
      }

      if (response.status >= 500 && attempt < retries) {
        await sleep(RETRY_DELAY_MS * (attempt + 1))
        continue
      }

      return handleResponse(response)
    } catch (error) {
      if (error instanceof ApiError) throw error
      if (attempt === retries) throw new ApiError(0, 'Network error — check your connection')
      await sleep(RETRY_DELAY_MS * (attempt + 1))
    }
  }
}

// HTTP methods
export const api = {
  get: (path, params) => {
    const url = new URL(`${API_BASE_URL}${path}`, window.location.origin)
    if (params) Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, v)
    })
    return fetchWithRetry(url.toString(), { method: 'GET' })
  },

  post: (path, body) =>
    fetchWithRetry(`${API_BASE_URL}${path}`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  put: (path, body) =>
    fetchWithRetry(`${API_BASE_URL}${path}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  patch: (path, body) =>
    fetchWithRetry(`${API_BASE_URL}${path}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  delete: (path) =>
    fetchWithRetry(`${API_BASE_URL}${path}`, { method: 'DELETE' }),
}

// Domain-specific API modules
export const customersApi = {
  list: (params) => api.get('/customers', params),
  get: (id) => api.get(`/customers/${id}`),
  create: (data) => api.post('/customers', data),
  update: (id, data) => api.put(`/customers/${id}`, data),
  delete: (id) => api.delete(`/customers/${id}`),
  getProfile: (id) => api.get(`/customers/${id}/profile`),
  updateProfile: (id, data) => api.put(`/customers/${id}/profile`, data),
  getInteractions: (id) => api.get(`/customers/${id}/interactions`),
  createInteraction: (id, data) => api.post(`/customers/${id}/interactions`, data),
  search: (query) => api.get('/search/customers', { q: query }),
  advancedSearch: (filters) => api.post('/search/customers/advanced', filters),
  bulkCreate: (customers) => api.post('/bulk/customers', { customers }),
  bulkUpdate: (updates) => api.put('/bulk/customers', { updates }),
  bulkDelete: (ids) => api.delete('/bulk/customers', { ids }),
}

export const analyticsApi = {
  segments: (params) => api.get('/analytics/segments', params),
  lifecycle: (params) => api.get('/analytics/lifecycle', params),
  value: (params) => api.get('/analytics/value', params),
  churn: (params) => api.get('/analytics/churn', params),
}

export const campaignsApi = {
  list: (params) => api.get('/campaigns', params),
  get: (id) => api.get(`/campaigns/${id}`),
  create: (data) => api.post('/campaigns', data),
  update: (id, data) => api.put(`/campaigns/${id}`, data),
  delete: (id) => api.delete(`/campaigns/${id}`),
  launch: (id) => api.post(`/campaigns/${id}/launch`),
  pause: (id) => api.post(`/campaigns/${id}/pause`),
  getMetrics: (id) => api.get(`/campaigns/${id}/metrics`),
}

export const tenantsApi = {
  list: () => api.get('/tenants'),
  get: (id) => api.get(`/tenants/${id}`),
  update: (id, data) => api.put(`/tenants/${id}`, data),
  getSettings: (id) => api.get(`/tenants/${id}/settings`),
  updateSettings: (id, data) => api.put(`/tenants/${id}/settings`, data),
}

export const bankingApi = {
  accounts: {
    list: (params) => api.get('/banking/accounts', params),
    get: (id) => api.get(`/banking/accounts/${id}`),
    create: (data) => api.post('/banking/accounts', data),
    getTransactions: (id, params) => api.get(`/banking/accounts/${id}/transactions`, params),
  },
  transactions: {
    list: (params) => api.get('/banking/transactions', params),
    get: (id) => api.get(`/banking/transactions/${id}`),
    create: (data) => api.post('/banking/transactions', data),
  },
  fraud: {
    alerts: (params) => api.get('/banking/fraud/alerts', params),
    review: (id, data) => api.post(`/banking/fraud/alerts/${id}/review`, data),
  },
}

export const inventoryApi = {
  products: {
    list: (params) => api.get('/inventory/products', params),
    get: (id) => api.get(`/inventory/products/${id}`),
    create: (data) => api.post('/inventory/products', data),
    update: (id, data) => api.put(`/inventory/products/${id}`, data),
    delete: (id) => api.delete(`/inventory/products/${id}`),
  },
  stock: {
    list: (params) => api.get('/inventory/stock', params),
    adjust: (id, data) => api.post(`/inventory/stock/${id}/adjust`, data),
  },
}

export const auditApi = {
  logs: (params) => api.get('/audit/logs', params),
  get: (id) => api.get(`/audit/logs/${id}`),
  export: (params) => api.post('/audit/export', params),
}

export const securityApi = {
  dashboard: () => api.get('/security/dashboard'),
  threats: (params) => api.get('/security/threats', params),
  incidents: (params) => api.get('/security/incidents', params),
  createIncident: (data) => api.post('/security/incidents', data),
  updateIncident: (id, data) => api.put(`/security/incidents/${id}`, data),
}

export const documentsApi = {
  list: (params) => api.get('/documents', params),
  get: (id) => api.get(`/documents/${id}`),
  upload: (formData) => fetchWithRetry(`${API_BASE_URL}/documents`, {
    method: 'POST',
    body: formData,
  }),
  delete: (id) => api.delete(`/documents/${id}`),
}

export const tasksApi = {
  list: (params) => api.get('/tasks', params),
  get: (id) => api.get(`/tasks/${id}`),
  create: (data) => api.post('/tasks', data),
  update: (id, data) => api.put(`/tasks/${id}`, data),
  delete: (id) => api.delete(`/tasks/${id}`),
}

export const apiKeysApi = {
  list: () => api.get('/api-keys'),
  create: (data) => api.post('/api-keys', data),
  revoke: (id) => api.delete(`/api-keys/${id}`),
  regenerate: (id) => api.post(`/api-keys/${id}/regenerate`),
}

export const webhooksApi = {
  list: () => api.get('/webhooks'),
  create: (data) => api.post('/webhooks', data),
  update: (id, data) => api.put(`/webhooks/${id}`, data),
  delete: (id) => api.delete(`/webhooks/${id}`),
  test: (id) => api.post(`/webhooks/${id}/test`),
}

export const aiApi = {
  gnn: {
    fraudAnalysis: (params) => api.get('/ai/gnn/fraud', params),
    communityDetection: (params) => api.get('/ai/gnn/communities', params),
  },
  mcmc: {
    riskAnalysis: (params) => api.get('/ai/mcmc/risk', params),
    stressTest: (data) => api.post('/ai/mcmc/stress-test', data),
  },
  kgqa: {
    query: (question) => api.post('/ai/kgqa/query', { question }),
  },
  graphrag: {
    query: (question) => api.post('/ai/graphrag/query', { question }),
  },
  ollama: {
    models: () => api.get('/ai/ollama/models'),
    generate: (data) => api.post('/ai/ollama/generate', data),
  },
}

export const authApi = {
  login: (credentials) => fetchWithRetry(`${AUTH_BASE_URL}/login`, {
    method: 'POST',
    body: JSON.stringify(credentials),
  }),
  logout: () => fetchWithRetry(`${AUTH_BASE_URL}/logout`, { method: 'POST' }),
  refresh: () => fetchWithRetry(`${AUTH_BASE_URL}/refresh`, { method: 'POST' }),
  me: () => fetchWithRetry(`${AUTH_BASE_URL}/me`, { method: 'GET' }),
}

export { ApiError }
export default api
