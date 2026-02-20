import AsyncStorage from '@react-native-async-storage/async-storage';
import CertificatePinning from '../security/CertificatePinning';

interface ApiClientConfig {
  baseUrl: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
}

interface ApiResponse<T = unknown> {
  data: T;
  status: number;
  headers: Headers;
}

interface RequestOptions extends RequestInit {
  skipAuth?: boolean;
  timeout?: number;
}

const ENV_DEFAULTS: Record<string, string> = {
  production: 'https://api.agentbanking.com',
  staging: 'https://staging-api.agentbanking.com',
  development: 'http://localhost:8000',
};

class ApiClient {
  private static instance: ApiClient;
  private config: ApiClientConfig;
  private authToken: string | null = null;

  private constructor() {
    const env = process.env.REACT_NATIVE_ENV || process.env.NODE_ENV || 'production';
    const baseUrl = process.env.REACT_NATIVE_API_URL
      || process.env.VITE_API_URL
      || process.env.REACT_APP_API_URL
      || ENV_DEFAULTS[env]
      || ENV_DEFAULTS.production;

    this.config = {
      baseUrl,
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
    };
  }

  static getInstance(): ApiClient {
    if (!ApiClient.instance) {
      ApiClient.instance = new ApiClient();
    }
    return ApiClient.instance;
  }

  getBaseUrl(): string {
    return this.config.baseUrl;
  }

  setBaseUrl(url: string): void {
    this.config.baseUrl = url;
  }

  setAuthToken(token: string | null): void {
    this.authToken = token;
  }

  async loadAuthToken(): Promise<void> {
    try {
      this.authToken = await AsyncStorage.getItem('auth_token');
    } catch {
      this.authToken = null;
    }
  }

  private buildUrl(path: string): string {
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }
    const base = this.config.baseUrl.replace(/\/$/, '');
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${base}${cleanPath}`;
  }

  private async buildHeaders(options: RequestOptions): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (!options.skipAuth && this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    if (options.headers) {
      const incomingHeaders = options.headers instanceof Headers
        ? Object.fromEntries(options.headers.entries())
        : options.headers as Record<string, string>;
      Object.assign(headers, incomingHeaders);
    }

    return headers;
  }

  async request<T = unknown>(path: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    const url = this.buildUrl(path);
    const headers = await this.buildHeaders(options);
    const timeout = options.timeout || this.config.timeout;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.config.retryAttempts; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await CertificatePinning.fetch(url, {
          ...options,
          headers,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.status === 401 && !options.skipAuth) {
          this.authToken = null;
          await AsyncStorage.removeItem('auth_token');
          throw new Error('Authentication expired');
        }

        if (!response.ok && attempt < this.config.retryAttempts && response.status >= 500) {
          lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
          await this.delay(this.config.retryDelay * Math.pow(2, attempt));
          continue;
        }

        const data = await response.json() as T;
        return { data, status: response.status, headers: response.headers };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < this.config.retryAttempts && !lastError.message.includes('Authentication expired')) {
          await this.delay(this.config.retryDelay * Math.pow(2, attempt));
          continue;
        }
      }
    }

    throw lastError || new Error('Request failed');
  }

  async get<T = unknown>(path: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    return this.request<T>(path, { ...options, method: 'GET' });
  }

  async post<T = unknown>(path: string, body?: unknown, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    return this.request<T>(path, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async put<T = unknown>(path: string, body?: unknown, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    return this.request<T>(path, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T = unknown>(path: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    return this.request<T>(path, { ...options, method: 'DELETE' });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default ApiClient.getInstance();
