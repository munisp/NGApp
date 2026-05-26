/**
 * Tenant-scoped API client for all CRM services.
 * Automatically injects tenant slug, auth token, and handles errors.
 */
const API_BASE = import.meta.env.VITE_API_BASE || '/api/v1';

interface ApiOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

interface ApiError {
  status: number;
  message: string;
  code?: string;
}

class CRMApiClient {
  private baseUrl: string;
  private tenantSlug: string = 'acme-bank';
  private authToken: string = '';

  constructor(baseUrl: string = API_BASE) {
    this.baseUrl = baseUrl;
  }

  setTenant(slug: string) {
    this.tenantSlug = slug;
  }

  setAuth(token: string) {
    this.authToken = token;
  }

  private async request<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
    const { method = 'GET', body, headers = {}, signal } = options;

    const res = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': this.tenantSlug,
        ...(this.authToken ? { Authorization: `Bearer ${this.authToken}` } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal,
    });

    if (!res.ok) {
      const error: ApiError = {
        status: res.status,
        message: `API Error: ${res.statusText}`,
      };
      try {
        const data = await res.json();
        error.message = data.message || error.message;
        error.code = data.code;
      } catch {}
      throw error;
    }

    return res.json();
  }

  // Customer endpoints
  customers = {
    list: (params?: { page?: number; limit?: number; segment?: string }) =>
      this.request<{ data: unknown[]; total: number }>(`/customers?${new URLSearchParams(params as Record<string, string>)}`),
    get: (id: string) => this.request<unknown>(`/customers/${id}`),
    create: (data: unknown) => this.request<unknown>('/customers', { method: 'POST', body: data }),
    update: (id: string, data: unknown) => this.request<unknown>(`/customers/${id}`, { method: 'PUT', body: data }),
    delete: (id: string) => this.request<void>(`/customers/${id}`, { method: 'DELETE' }),
    search: (query: string) => this.request<unknown[]>(`/customers/search?q=${encodeURIComponent(query)}`),
  };

  // Dashboard endpoints
  dashboard = {
    metrics: () => this.request<unknown>('/dashboard/metrics'),
    revenue: (range: string) => this.request<unknown[]>(`/dashboard/revenue?range=${range}`),
    funnel: () => this.request<unknown[]>('/dashboard/funnel'),
    activities: () => this.request<unknown[]>('/dashboard/activities'),
  };

  // Deal/Pipeline endpoints
  deals = {
    list: () => this.request<unknown[]>('/deals'),
    get: (id: string) => this.request<unknown>(`/deals/${id}`),
    create: (data: unknown) => this.request<unknown>('/deals', { method: 'POST', body: data }),
    updateStage: (id: string, stage: string) =>
      this.request<unknown>(`/deals/${id}/stage`, { method: 'PATCH', body: { stage } }),
    forecast: () => this.request<unknown>('/deals/forecast'),
  };

  // Telco endpoints
  telco = {
    subscribers: () => this.request<unknown>('/telco/subscribers'),
    fieldOps: () => this.request<unknown>('/telco/field-ops'),
    interconnect: () => this.request<unknown>('/telco/interconnect'),
    cellSites: () => this.request<unknown[]>('/telco/cell-sites'),
    simLifecycle: (msisdn: string) => this.request<unknown>(`/telco/sim/${msisdn}`),
  };

  // Commodity endpoints
  commodity = {
    positions: () => this.request<unknown>('/commodity/positions'),
    trades: () => this.request<unknown[]>('/commodity/trades'),
    settlements: () => this.request<unknown[]>('/commodity/settlements'),
    priceFeed: () => this.request<unknown[]>('/commodity/prices'),
    counterpartyRisk: () => this.request<unknown>('/commodity/counterparty-risk'),
  };

  // CPaaS endpoints
  cpaas = {
    channels: () => this.request<unknown>('/cpaas/channels'),
    messages: (params?: { channel?: string }) =>
      this.request<unknown[]>(`/cpaas/messages?${new URLSearchParams(params as Record<string, string>)}`),
    deliveryReport: (messageId: string) => this.request<unknown>(`/cpaas/delivery/${messageId}`),
    developers: () => this.request<unknown[]>('/cpaas/developers'),
    apiExplorer: () => this.request<unknown>('/cpaas/api-explorer'),
  };

  // Agent endpoints (Agentic AI)
  agents = {
    list: () => this.request<unknown[]>('/agents'),
    execute: (agentId: string, payload: unknown) =>
      this.request<unknown>(`/agents/${agentId}/execute`, { method: 'POST', body: payload }),
    auditLog: (agentId: string) => this.request<unknown[]>(`/agents/${agentId}/audit`),
    governance: () => this.request<unknown>('/agents/governance'),
  };

  // RevOps endpoints
  revops = {
    pipeline: () => this.request<unknown>('/revops/pipeline'),
    forecast: () => this.request<unknown>('/revops/forecast'),
    attribution: () => this.request<unknown>('/revops/attribution'),
    cdp: { profiles: () => this.request<unknown[]>('/revops/cdp/profiles') },
  };

  // Workflow endpoints
  workflows = {
    list: () => this.request<unknown[]>('/workflows'),
    get: (id: string) => this.request<unknown>(`/workflows/${id}`),
    create: (data: unknown) => this.request<unknown>('/workflows', { method: 'POST', body: data }),
    execute: (id: string) => this.request<unknown>(`/workflows/${id}/execute`, { method: 'POST' }),
    history: (id: string) => this.request<unknown[]>(`/workflows/${id}/history`),
  };

  // Search endpoints
  search = {
    semantic: (query: string) => this.request<unknown[]>(`/search/semantic?q=${encodeURIComponent(query)}`),
    advanced: (filters: unknown) => this.request<unknown[]>('/search/advanced', { method: 'POST', body: filters }),
  };

  // Health endpoints
  health = {
    scores: () => this.request<unknown[]>('/health/scores'),
    alerts: () => this.request<unknown[]>('/health/alerts'),
  };
}

export const apiClient = new CRMApiClient();
export type { ApiError, ApiOptions };
