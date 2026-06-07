/**
 * NDSEP Mobile API Client
 * Handles all communication with the NDSEP backend.
 * Supports offline-first with queue and sync.
 */
import * as SecureStore from "expo-secure-store";

const API_BASE = process.env.EXPO_PUBLIC_API_URL || "https://api.ndsep.gov.ng";

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  offlineAllowed?: boolean;
}

class NDSEPApiClient {
  private token: string | null = null;
  private offlineQueue: Array<{ url: string; options: RequestOptions; timestamp: number }> = [];

  async init() {
    this.token = await SecureStore.getItemAsync("auth_token");
  }

  private async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const url = `${API_BASE}${endpoint}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Platform": "mobile",
      "X-App-Version": "1.0.0",
      ...options.headers,
    };

    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, {
        method: options.method || "GET",
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      if (options.offlineAllowed) {
        this.offlineQueue.push({ url: endpoint, options, timestamp: Date.now() });
        throw new Error("OFFLINE_QUEUED");
      }
      throw error;
    }
  }

  // ── Auth ────────────────────────────────────────────────────────────────────

  async login(credentials: { email: string; password: string }) {
    const result = await this.request<{ token: string; user: unknown }>("/api/auth/login", {
      method: "POST",
      body: credentials,
    });
    this.token = result.token;
    await SecureStore.setItemAsync("auth_token", result.token);
    return result;
  }

  async biometricLogin() {
    const storedToken = await SecureStore.getItemAsync("biometric_token");
    if (!storedToken) throw new Error("No biometric token stored");
    this.token = storedToken;
    return this.request("/api/auth/verify");
  }

  async logout() {
    this.token = null;
    await SecureStore.deleteItemAsync("auth_token");
    await SecureStore.deleteItemAsync("biometric_token");
  }

  // ── Compliance ──────────────────────────────────────────────────────────────

  async getComplianceOverview() {
    return this.request<{
      overallScore: number;
      trend: string;
      dimensions: Record<string, number>;
    }>("/api/v2/compliance/overview");
  }

  async getComplianceScore(orgId: string) {
    return this.request(`/api/v2/compliance/score/${orgId}`);
  }

  // ── Alerts ──────────────────────────────────────────────────────────────────

  async getActiveAlerts() {
    return this.request<Array<{
      id: string;
      type: string;
      severity: string;
      title: string;
      timestamp: string;
    }>>("/api/v2/alerts/active");
  }

  // ── Breach Management ───────────────────────────────────────────────────────

  async reportBreach(data: {
    organizationId: string;
    description: string;
    affectedSubjects: number;
    dataCategories: string[];
    severity: string;
  }) {
    return this.request("/api/v2/breach/report", {
      method: "POST",
      body: data,
      offlineAllowed: true,
    });
  }

  // ── DSAR ────────────────────────────────────────────────────────────────────

  async submitDSAR(data: {
    subjectName: string;
    requestType: string;
    organizationId: string;
    details: string;
  }) {
    return this.request("/api/v2/dsar/submit", {
      method: "POST",
      body: data,
      offlineAllowed: true,
    });
  }

  // ── Platform Metrics ────────────────────────────────────────────────────────

  async getPlatformMetrics() {
    return this.request<{
      totalOrgs: number;
      activeCases: number;
      breaches30d: number;
      avgCompliance: number;
    }>("/api/v2/metrics/platform");
  }

  // ── NOC ─────────────────────────────────────────────────────────────────────

  async getNOCStatus() {
    return this.request("/api/v2/noc/status");
  }

  async acknowledgeAlert(alertId: string) {
    return this.request(`/api/v2/noc/alerts/${alertId}/acknowledge`, {
      method: "POST",
      offlineAllowed: true,
    });
  }

  // ── Enforcement ─────────────────────────────────────────────────────────────

  async getEnforcementCases(filters?: { status?: string; sector?: string }) {
    const params = new URLSearchParams(filters as Record<string, string>);
    return this.request(`/api/v2/enforcement/cases?${params}`);
  }

  // ── Offline Sync ────────────────────────────────────────────────────────────

  async syncOfflineQueue() {
    const queue = [...this.offlineQueue];
    this.offlineQueue = [];
    const results = [];

    for (const item of queue) {
      try {
        const result = await this.request(item.url, item.options);
        results.push({ success: true, url: item.url, result });
      } catch (error) {
        this.offlineQueue.push(item);
        results.push({ success: false, url: item.url, error });
      }
    }

    return results;
  }

  getOfflineQueueSize() {
    return this.offlineQueue.length;
  }
}

export const api = new NDSEPApiClient();
