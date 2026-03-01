/**
 * NEXCOM Exchange - Mobile API Client
 * Connects React Native screens to the Go Gateway backend.
 * Falls back to mock data when backend is unavailable.
 */

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000/api/v1";

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  setToken(token: string | null) {
    this.token = token;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };
    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...options,
        headers,
      });
      const json = await response.json();
      return json as ApiResponse<T>;
    } catch {
      return { success: false, error: "Network error" };
    }
  }

  // Auth
  async login(email: string, password: string) {
    return this.request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  }

  async logout() {
    return this.request("/auth/logout", { method: "POST" });
  }

  // Markets
  async getMarkets(category?: string, search?: string) {
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (search) params.set("q", search);
    const qs = params.toString();
    return this.request(`/markets${qs ? `?${qs}` : ""}`);
  }

  async getTicker(symbol: string) {
    return this.request(`/markets/${symbol}/ticker`);
  }

  async getOrderBook(symbol: string) {
    return this.request(`/markets/${symbol}/orderbook`);
  }

  async getCandles(symbol: string, interval = "1h", limit = 100) {
    return this.request(
      `/markets/${symbol}/candles?interval=${interval}&limit=${limit}`
    );
  }

  // Orders
  async getOrders(status?: string) {
    const qs = status ? `?status=${status}` : "";
    return this.request(`/orders${qs}`);
  }

  async createOrder(order: {
    symbol: string;
    side: string;
    type: string;
    quantity: number;
    price?: number;
  }) {
    return this.request("/orders", {
      method: "POST",
      body: JSON.stringify(order),
    });
  }

  async cancelOrder(orderId: string) {
    return this.request(`/orders/${orderId}`, { method: "DELETE" });
  }

  // Trades
  async getTrades(symbol?: string) {
    const qs = symbol ? `?symbol=${symbol}` : "";
    return this.request(`/trades${qs}`);
  }

  // Portfolio
  async getPortfolio() {
    return this.request("/portfolio");
  }

  async getPositions() {
    return this.request("/portfolio/positions");
  }

  async closePosition(positionId: string) {
    return this.request(`/portfolio/positions/${positionId}`, {
      method: "DELETE",
    });
  }

  // Alerts
  async getAlerts() {
    return this.request("/alerts");
  }

  async createAlert(alert: {
    symbol: string;
    condition: string;
    targetPrice: number;
  }) {
    return this.request("/alerts", {
      method: "POST",
      body: JSON.stringify(alert),
    });
  }

  async updateAlert(alertId: string, active: boolean) {
    return this.request(`/alerts/${alertId}`, {
      method: "PATCH",
      body: JSON.stringify({ active }),
    });
  }

  async deleteAlert(alertId: string) {
    return this.request(`/alerts/${alertId}`, { method: "DELETE" });
  }

  // Account
  async getProfile() {
    return this.request("/account/profile");
  }

  async updateProfile(data: Record<string, string>) {
    return this.request("/account/profile", {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async getPreferences() {
    return this.request("/account/preferences");
  }

  async updatePreferences(prefs: Record<string, boolean | string>) {
    return this.request("/account/preferences", {
      method: "PATCH",
      body: JSON.stringify(prefs),
    });
  }

  // Notifications
  async getNotifications() {
    return this.request("/notifications");
  }

  async markNotificationRead(notifId: string) {
    return this.request(`/notifications/${notifId}/read`, { method: "PATCH" });
  }

  async markAllRead() {
    return this.request("/notifications/read-all", { method: "POST" });
  }

  // Analytics
  async getDashboard() {
    return this.request("/analytics/dashboard");
  }

  async getGeospatial(commodity: string) {
    return this.request(`/analytics/geospatial/${commodity}`);
  }

  async getAiInsights() {
    return this.request("/analytics/ai-insights");
  }

  async getPriceForecast(symbol: string) {
    return this.request(`/analytics/forecast/${symbol}`);
  }

  // Matching Engine (proxied through gateway)
  async getMatchingEngineStatus() {
    return this.request("/matching-engine/status");
  }

  async getFuturesContracts() {
    return this.request("/matching-engine/futures/contracts");
  }

  // Ingestion Engine (proxied through gateway)
  async getIngestionFeeds() {
    return this.request("/ingestion/feeds");
  }

  async getLakehouseStatus() {
    return this.request("/ingestion/lakehouse/status");
  }

  // Market Makers (proxied through gateway)
  async getMarketMakers() {
    return this.request("/matching-engine/market-makers");
  }

  async getMarketMaker(id: string) {
    return this.request(`/matching-engine/market-makers/${id}`);
  }

  async getMarketMakerPerformance(id: string) {
    return this.request(`/matching-engine/market-makers/${id}/performance`);
  }

  // Indices (proxied through gateway)
  async getIndices() {
    return this.request("/matching-engine/indices");
  }

  async getIndex(id: string) {
    return this.request(`/matching-engine/indices/${id}`);
  }

  async getIndexValues() {
    return this.request("/matching-engine/indices/values");
  }

  // Corporate Actions (proxied through gateway)
  async getCorporateActions() {
    return this.request("/matching-engine/corporate-actions");
  }

  async getPendingCorporateActions() {
    return this.request("/matching-engine/corporate-actions/pending");
  }

  // Brokers (proxied through gateway)
  async getBrokers() {
    return this.request("/matching-engine/brokers");
  }

  async getBroker(id: string) {
    return this.request(`/matching-engine/brokers/${id}`);
  }

  async getConnectedBrokers() {
    return this.request("/matching-engine/brokers/connected");
  }

  // Blockchain - Digital Assets + IPFS + Fractional Trading (proxied through gateway)
  async getFractionalAssets() {
    return this.request("/blockchain/fractions/assets");
  }

  async getFractionalAsset(assetId: string) {
    return this.request(`/blockchain/fractions/assets/${assetId}`);
  }

  async getFractionalOrderbook(assetId: string) {
    return this.request(`/blockchain/fractions/orderbook/${assetId}`);
  }

  async submitFractionalOrder(order: {
    asset_id: string;
    trader_id: string;
    side: string;
    quantity: number;
    price: number;
  }) {
    return this.request("/blockchain/fractions/orders", {
      method: "POST",
      body: JSON.stringify(order),
    });
  }

  async getFractionalTrades() {
    return this.request("/blockchain/fractions/trades");
  }

  async getFractionalPortfolio(holderId: string) {
    return this.request(`/blockchain/fractions/portfolio/${holderId}`);
  }

  async getChainStatus() {
    return this.request("/blockchain/chains/status");
  }

  async getIpfsStatus() {
    return this.request("/blockchain/ipfs/status");
  }

  async getTokens() {
    return this.request("/blockchain/tokens");
  }

  // Health
  async getHealth() {
    return this.request("/health");
  }

  async getPlatformHealth() {
    return this.request("/platform/health");
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
export default apiClient;
