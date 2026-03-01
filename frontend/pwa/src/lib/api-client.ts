// ============================================================
// NEXCOM Exchange - API Client with Interceptors & Retry
// ============================================================

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

interface RequestConfig extends RequestInit {
  params?: Record<string, string>;
  timeout?: number;
  retries?: number;
}

interface APIError {
  status: number;
  message: string;
  code?: string;
  details?: unknown;
}

type RequestInterceptor = (config: RequestConfig & { url: string }) => RequestConfig & { url: string };
type ResponseInterceptor = (response: Response) => Response | Promise<Response>;

class APIClient {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;
  private requestInterceptors: RequestInterceptor[] = [];
  private responseInterceptors: ResponseInterceptor[] = [];

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.defaultHeaders = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
  }

  // Interceptor registration
  addRequestInterceptor(interceptor: RequestInterceptor): void {
    this.requestInterceptors.push(interceptor);
  }

  addResponseInterceptor(interceptor: ResponseInterceptor): void {
    this.responseInterceptors.push(interceptor);
  }

  // Token management
  setAuthToken(token: string): void {
    this.defaultHeaders["Authorization"] = `Bearer ${token}`;
  }

  clearAuthToken(): void {
    delete this.defaultHeaders["Authorization"];
  }

  // Core request method
  private async request<T>(endpoint: string, config: RequestConfig = {}): Promise<T> {
    const { params, timeout = 30000, retries = 2, ...fetchConfig } = config;

    let url = `${this.baseUrl}${endpoint}`;
    if (params) {
      const searchParams = new URLSearchParams(params);
      url += `?${searchParams.toString()}`;
    }

    // Apply request interceptors
    let finalConfig: RequestConfig & { url: string } = {
      ...fetchConfig,
      url,
      headers: { ...this.defaultHeaders, ...(fetchConfig.headers as Record<string, string>) },
    };

    for (const interceptor of this.requestInterceptors) {
      finalConfig = interceptor(finalConfig);
    }

    const { url: finalUrl, ...restConfig } = finalConfig;

    // Retry logic with exponential backoff
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        let response = await fetch(finalUrl, {
          ...restConfig,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Apply response interceptors
        for (const interceptor of this.responseInterceptors) {
          response = await interceptor(response);
        }

        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({}));
          const apiError: APIError = {
            status: response.status,
            message: errorBody.message || response.statusText,
            code: errorBody.code,
            details: errorBody.details,
          };

          // Don't retry 4xx errors (except 429)
          if (response.status < 500 && response.status !== 429) {
            throw apiError;
          }

          throw apiError;
        }

        // Handle empty responses
        const contentType = response.headers.get("content-type");
        if (contentType?.includes("application/json")) {
          return await response.json();
        }
        return {} as T;
      } catch (error) {
        lastError = error as Error;

        // Don't retry on client errors
        if ((error as APIError).status && (error as APIError).status < 500 && (error as APIError).status !== 429) {
          throw error;
        }

        if (attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    throw lastError;
  }

  // HTTP methods
  async get<T>(endpoint: string, config?: RequestConfig): Promise<T> {
    return this.request<T>(endpoint, { ...config, method: "GET" });
  }

  async post<T>(endpoint: string, body?: unknown, config?: RequestConfig): Promise<T> {
    return this.request<T>(endpoint, {
      ...config,
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async put<T>(endpoint: string, body?: unknown, config?: RequestConfig): Promise<T> {
    return this.request<T>(endpoint, {
      ...config,
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async patch<T>(endpoint: string, body?: unknown, config?: RequestConfig): Promise<T> {
    return this.request<T>(endpoint, {
      ...config,
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T>(endpoint: string, config?: RequestConfig): Promise<T> {
    return this.request<T>(endpoint, { ...config, method: "DELETE" });
  }
}

// ============================================================
// Singleton API Client Instance
// ============================================================

export const apiClient = new APIClient(API_BASE_URL);

// Add auth token interceptor
apiClient.addRequestInterceptor((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("nexcom_access_token");
    if (token) {
      config.headers = {
        ...(config.headers as Record<string, string>),
        Authorization: `Bearer ${token}`,
      };
    }
  }
  return config;
});

// Add 401 response interceptor for token refresh
apiClient.addResponseInterceptor(async (response) => {
  if (response.status === 401 && typeof window !== "undefined") {
    const refreshToken = localStorage.getItem("nexcom_refresh_token");
    if (refreshToken) {
      try {
        const keycloakUrl = process.env.NEXT_PUBLIC_KEYCLOAK_URL || "http://localhost:8080";
        const realm = process.env.NEXT_PUBLIC_KEYCLOAK_REALM || "nexcom";
        const clientId = process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID || "nexcom-pwa";

        const tokenResponse = await fetch(
          `${keycloakUrl}/realms/${realm}/protocol/openid-connect/token`,
          {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              grant_type: "refresh_token",
              client_id: clientId,
              refresh_token: refreshToken,
            }),
          }
        );

        if (tokenResponse.ok) {
          const tokens = await tokenResponse.json();
          localStorage.setItem("nexcom_access_token", tokens.access_token);
          localStorage.setItem("nexcom_refresh_token", tokens.refresh_token);
        } else {
          // Refresh failed, clear tokens
          localStorage.removeItem("nexcom_access_token");
          localStorage.removeItem("nexcom_refresh_token");
          window.location.href = "/login";
        }
      } catch {
        localStorage.removeItem("nexcom_access_token");
        localStorage.removeItem("nexcom_refresh_token");
      }
    }
  }
  return response;
});

// ============================================================
// API Endpoint Functions
// ============================================================

export const api = {
  // Market Data
  markets: {
    list: () => apiClient.get<{ commodities: unknown[] }>("/markets"),
    ticker: (symbol: string) => apiClient.get(`/markets/${symbol}/ticker`),
    orderbook: (symbol: string) => apiClient.get(`/markets/${symbol}/orderbook`),
    candles: (symbol: string, interval: string, limit = 100) =>
      apiClient.get(`/markets/${symbol}/candles`, { params: { interval, limit: String(limit) } }),
    search: (query: string) => apiClient.get("/markets/search", { params: { q: query } }),
  },

  // Trading
  orders: {
    list: (status?: string) =>
      apiClient.get("/orders", status ? { params: { status } } : undefined),
    create: (order: {
      symbol: string;
      side: string;
      type: string;
      quantity: number;
      price?: number;
      stopPrice?: number;
    }) => apiClient.post("/orders", order),
    cancel: (orderId: string) => apiClient.delete(`/orders/${orderId}`),
    get: (orderId: string) => apiClient.get(`/orders/${orderId}`),
  },

  // Portfolio
  portfolio: {
    summary: () => apiClient.get("/portfolio"),
    positions: () => apiClient.get("/portfolio/positions"),
    history: (period?: string) =>
      apiClient.get("/portfolio/history", period ? { params: { period } } : undefined),
  },

  // Trades
  trades: {
    list: (params?: { symbol?: string; limit?: number }) =>
      apiClient.get("/trades", params ? { params: Object.fromEntries(
        Object.entries(params).map(([k, v]) => [k, String(v)])
      ) } : undefined),
    get: (tradeId: string) => apiClient.get(`/trades/${tradeId}`),
  },

  // Alerts
  alerts: {
    list: () => apiClient.get("/alerts"),
    create: (alert: { symbol: string; condition: string; targetPrice: number }) =>
      apiClient.post("/alerts", alert),
    update: (alertId: string, data: { active?: boolean }) =>
      apiClient.patch(`/alerts/${alertId}`, data),
    delete: (alertId: string) => apiClient.delete(`/alerts/${alertId}`),
  },

  // User / Account
  account: {
    profile: () => apiClient.get("/account/profile"),
    updateProfile: (data: Record<string, unknown>) => apiClient.patch("/account/profile", data),
    kyc: () => apiClient.get("/account/kyc"),
    sessions: () => apiClient.get("/account/sessions"),
    revokeSession: (sessionId: string) => apiClient.delete(`/account/sessions/${sessionId}`),
    preferences: () => apiClient.get("/account/preferences"),
    updatePreferences: (data: Record<string, unknown>) =>
      apiClient.patch("/account/preferences", data),
  },

  // Analytics
  analytics: {
    dashboard: () => apiClient.get("/analytics/dashboard"),
    pnlReport: (period: string) =>
      apiClient.get("/analytics/pnl", { params: { period } }),
    geospatial: (commodity: string) =>
      apiClient.get(`/analytics/geospatial/${commodity}`),
    aiInsights: () => apiClient.get("/analytics/ai-insights"),
    priceForecast: (symbol: string) =>
      apiClient.get(`/analytics/forecast/${symbol}`),
  },

  // Matching Engine - Market Makers
  marketMakers: {
    list: () => fetch(`${process.env.NEXT_PUBLIC_MATCHING_ENGINE_URL || "http://localhost:8080"}/api/v1/market-makers`).then(r => r.json()),
    get: (id: string) => fetch(`${process.env.NEXT_PUBLIC_MATCHING_ENGINE_URL || "http://localhost:8080"}/api/v1/market-makers/${id}`).then(r => r.json()),
    performance: (id: string) => fetch(`${process.env.NEXT_PUBLIC_MATCHING_ENGINE_URL || "http://localhost:8080"}/api/v1/market-makers/${id}/performance`).then(r => r.json()),
    quotes: (symbol: string) => fetch(`${process.env.NEXT_PUBLIC_MATCHING_ENGINE_URL || "http://localhost:8080"}/api/v1/market-makers/quotes/${symbol}`).then(r => r.json()),
    submitQuote: (quote: { market_maker_id: string; symbol: string; bid_price: number; bid_quantity: number; ask_price: number; ask_quantity: number }) =>
      fetch(`${process.env.NEXT_PUBLIC_MATCHING_ENGINE_URL || "http://localhost:8080"}/api/v1/market-makers/quotes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(quote) }).then(r => r.json()),
  },

  // Matching Engine - Indices
  indices: {
    list: () => fetch(`${process.env.NEXT_PUBLIC_MATCHING_ENGINE_URL || "http://localhost:8080"}/api/v1/indices`).then(r => r.json()),
    get: (id: string) => fetch(`${process.env.NEXT_PUBLIC_MATCHING_ENGINE_URL || "http://localhost:8080"}/api/v1/indices/${id}`).then(r => r.json()),
    values: () => fetch(`${process.env.NEXT_PUBLIC_MATCHING_ENGINE_URL || "http://localhost:8080"}/api/v1/indices/values`).then(r => r.json()),
    value: (id: string) => fetch(`${process.env.NEXT_PUBLIC_MATCHING_ENGINE_URL || "http://localhost:8080"}/api/v1/indices/${id}/value`).then(r => r.json()),
  },

  // Matching Engine - Corporate Actions
  corporateActions: {
    list: () => fetch(`${process.env.NEXT_PUBLIC_MATCHING_ENGINE_URL || "http://localhost:8080"}/api/v1/corporate-actions`).then(r => r.json()),
    pending: () => fetch(`${process.env.NEXT_PUBLIC_MATCHING_ENGINE_URL || "http://localhost:8080"}/api/v1/corporate-actions/pending`).then(r => r.json()),
    forSymbol: (symbol: string) => fetch(`${process.env.NEXT_PUBLIC_MATCHING_ENGINE_URL || "http://localhost:8080"}/api/v1/corporate-actions/${symbol}`).then(r => r.json()),
    process: (id: string) => fetch(`${process.env.NEXT_PUBLIC_MATCHING_ENGINE_URL || "http://localhost:8080"}/api/v1/corporate-actions/${id}/process`, { method: "POST" }).then(r => r.json()),
  },

  // Matching Engine - Brokers
  brokers: {
    list: () => fetch(`${process.env.NEXT_PUBLIC_MATCHING_ENGINE_URL || "http://localhost:8080"}/api/v1/brokers`).then(r => r.json()),
    get: (id: string) => fetch(`${process.env.NEXT_PUBLIC_MATCHING_ENGINE_URL || "http://localhost:8080"}/api/v1/brokers/${id}`).then(r => r.json()),
    connected: () => fetch(`${process.env.NEXT_PUBLIC_MATCHING_ENGINE_URL || "http://localhost:8080"}/api/v1/brokers/connected`).then(r => r.json()),
    routeOrder: (route: { broker_id: string; client_account: string; symbol: string; side: string; quantity: number }) =>
      fetch(`${process.env.NEXT_PUBLIC_MATCHING_ENGINE_URL || "http://localhost:8080"}/api/v1/brokers/route`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(route) }).then(r => r.json()),
  },

  // Matching Engine - Exchange Status
  exchangeStatus: {
    get: () => fetch(`${process.env.NEXT_PUBLIC_MATCHING_ENGINE_URL || "http://localhost:8080"}/api/v1/status`).then(r => r.json()),
  },

  // Auth
  auth: {
    login: (credentials: { email: string; password: string }) =>
      apiClient.post("/auth/login", credentials),
    logout: () => apiClient.post("/auth/logout"),
    refresh: (refreshToken: string) =>
      apiClient.post("/auth/refresh", { refreshToken }),
  },
};
