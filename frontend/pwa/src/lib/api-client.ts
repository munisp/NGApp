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

// Generic API response type for gateway endpoints
interface APIResponse {
  success?: boolean;
  data?: Record<string, unknown> | Record<string, unknown>[];
  error?: string;
}

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

  // Matching Engine - Market Makers (proxied through gateway)
  marketMakers: {
    list: () => apiClient.get<APIResponse>("/matching-engine/market-makers"),
    get: (id: string) => apiClient.get<APIResponse>(`/matching-engine/market-makers/${id}`),
    performance: (id: string) => apiClient.get<APIResponse>(`/matching-engine/market-makers/${id}/performance`),
    quotes: (symbol: string) => apiClient.get<APIResponse>(`/matching-engine/market-makers/quotes/${symbol}`),
    submitQuote: (quote: { market_maker_id: string; symbol: string; bid_price: number; bid_quantity: number; ask_price: number; ask_quantity: number }) =>
      apiClient.post<APIResponse>("/matching-engine/market-makers/quotes", quote),
  },

  // Matching Engine - Indices (proxied through gateway)
  indices: {
    list: () => apiClient.get<APIResponse>("/matching-engine/indices"),
    get: (id: string) => apiClient.get<APIResponse>(`/matching-engine/indices/${id}`),
    values: () => apiClient.get<APIResponse>("/matching-engine/indices/values"),
    value: (id: string) => apiClient.get<APIResponse>(`/matching-engine/indices/${id}/value`),
  },

  // Matching Engine - Corporate Actions (proxied through gateway)
  corporateActions: {
    list: () => apiClient.get<APIResponse>("/matching-engine/corporate-actions"),
    pending: () => apiClient.get<APIResponse>("/matching-engine/corporate-actions/pending"),
    forSymbol: (symbol: string) => apiClient.get<APIResponse>(`/matching-engine/corporate-actions/${symbol}`),
    process: (id: string) => apiClient.post<APIResponse>(`/matching-engine/corporate-actions/${id}/process`),
  },

  // Matching Engine - Brokers (proxied through gateway)
  brokers: {
    list: () => apiClient.get<APIResponse>("/matching-engine/brokers"),
    get: (id: string) => apiClient.get<APIResponse>(`/matching-engine/brokers/${id}`),
    connected: () => apiClient.get<APIResponse>("/matching-engine/brokers/connected"),
    routeOrder: (route: { broker_id: string; client_account: string; symbol: string; side: string; quantity: number }) =>
      apiClient.post<APIResponse>("/matching-engine/brokers/route", route),
  },

  // Matching Engine - Exchange Status (proxied through gateway)
  exchangeStatus: {
    get: () => apiClient.get<APIResponse>("/matching-engine/status"),
  },

  // Blockchain - Digital Assets + IPFS + Fractional Trading (proxied through gateway)
  blockchain: {
    // Tokenization
    tokenize: (data: { commodity_symbol: string; quantity: string; owner_id: string; warehouse_receipt_id: string; chain: string; unit?: string; warehouse_location?: string; quality_grade?: string }) =>
      apiClient.post<APIResponse>("/blockchain/tokenize", data),
    listTokens: () => apiClient.get<APIResponse>("/blockchain/tokens"),
    getToken: (tokenId: string) => apiClient.get<APIResponse>(`/blockchain/tokens/${tokenId}`),
    transferToken: (tokenId: string, data: { from_address: string; to_address: string; quantity: string }) =>
      apiClient.post<APIResponse>(`/blockchain/tokens/${tokenId}/transfer`, data),
    fractionalizeToken: (tokenId: string, data: { total_fractions: number; price_per_fraction: number }) =>
      apiClient.post<APIResponse>(`/blockchain/tokens/${tokenId}/fractionalize`, data),
    // Settlement (DvP)
    settle: (data: { trade_id: string; buyer_address: string; seller_address: string; token_id: string; quantity: string; price: string; chain: string }) =>
      apiClient.post<APIResponse>("/blockchain/settle", data),
    getTransaction: (txHash: string) => apiClient.get<APIResponse>(`/blockchain/tx/${txHash}`),
    // Bridge
    bridgeInitiate: (data: { token_id: string; from_chain: string; to_chain: string; quantity: string }) =>
      apiClient.post<APIResponse>("/blockchain/bridge/initiate", data),
    chainStatus: () => apiClient.get<APIResponse>("/blockchain/chains/status"),
    // Fractional trading
    fractionalAssets: () => apiClient.get<APIResponse>("/blockchain/fractions/assets"),
    fractionalAsset: (assetId: string) => apiClient.get<APIResponse>(`/blockchain/fractions/assets/${assetId}`),
    fractionalOrder: (data: { asset_id: string; trader_id: string; side: string; quantity: number; price: number }) =>
      apiClient.post<APIResponse>("/blockchain/fractions/orders", data),
    fractionalOrderbook: (assetId: string) => apiClient.get<APIResponse>(`/blockchain/fractions/orderbook/${assetId}`),
    fractionalTrades: () => apiClient.get<APIResponse>("/blockchain/fractions/trades"),
    fractionalPortfolio: (holderId: string) => apiClient.get<APIResponse>(`/blockchain/fractions/portfolio/${holderId}`),
    // IPFS
    ipfsPin: (data: { data: unknown; name?: string }) => apiClient.post<APIResponse>("/blockchain/ipfs/pin", data),
    ipfsGet: (cid: string) => apiClient.get<APIResponse>(`/blockchain/ipfs/get/${cid}`),
    ipfsStatus: () => apiClient.get<APIResponse>("/blockchain/ipfs/status"),
  },

  // Forex Trading
  forex: {
    pairs: (category?: string) =>
      apiClient.get<APIResponse>("/forex/pairs", category ? { params: { category } } : undefined),
    pair: (symbol: string) => apiClient.get<APIResponse>(`/forex/pairs/${encodeURIComponent(symbol)}`),
    searchPairs: (query: string) => apiClient.get<APIResponse>("/forex/pairs/search", { params: { q: query } }),
    orders: (status?: string) =>
      apiClient.get<APIResponse>("/forex/orders", status ? { params: { status } } : undefined),
    order: (id: string) => apiClient.get<APIResponse>(`/forex/orders/${id}`),
    createOrder: (order: {
      pair: string; side: string; type: string; lotSize: number;
      price?: number; stopLoss?: number; takeProfit?: number;
      trailingStopPips?: number; ocoStopPrice?: number; ocoLimitPrice?: number;
      leverage: number; comment?: string;
    }) => apiClient.post<APIResponse>("/forex/orders", order),
    cancelOrder: (id: string) => apiClient.delete<APIResponse>(`/forex/orders/${id}`),
    positions: (status?: string) =>
      apiClient.get<APIResponse>("/forex/positions", status ? { params: { status } } : undefined),
    position: (id: string) => apiClient.get<APIResponse>(`/forex/positions/${id}`),
    modifyPosition: (id: string, data: { stopLoss?: number; takeProfit?: number; trailingStopPips?: number }) =>
      apiClient.patch<APIResponse>(`/forex/positions/${id}`, data),
    closePosition: (id: string) => apiClient.delete<APIResponse>(`/forex/positions/${id}`),
    account: () => apiClient.get<APIResponse>("/forex/account"),
    swapRates: () => apiClient.get<APIResponse>("/forex/swap-rates"),
    crossRates: () => apiClient.get<APIResponse>("/forex/cross-rates"),
    marginRequirements: () => apiClient.get<APIResponse>("/forex/margin-requirements"),
    tradingHours: () => apiClient.get<APIResponse>("/forex/trading-hours"),
    liquidityProviders: () => apiClient.get<APIResponse>("/forex/liquidity-providers"),
    regulatory: () => apiClient.get<APIResponse>("/forex/regulatory"),
    pipCalculator: (data: { pair: string; lotSize: number; pips: number }) =>
      apiClient.post<APIResponse>("/forex/pip-calculator", data),
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
