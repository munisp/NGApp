/**
 * Production API Services
 * Real implementations using tRPC client for type-safe API calls
 */

import { trpc } from '../trpc';
import * as SecureStorage from '../secure-storage';

// Re-export types from mock for backwards compatibility
export type {
  LoginRequest,
  RegisterRequest,
  AuthResponse,
  User,
  Account,
  Transaction,
  PaymentMethod,
  SendMoneyRequest,
  Payment,
  PaymentRequest,
  PaymentResponse,
  KYCDocument,
  UploadKYCRequest,
  NotificationPreferences,
} from './services-mock';

import type {
  LoginRequest,
  RegisterRequest,
  AuthResponse,
  User,
  Account,
  Transaction,
  PaymentMethod,
  SendMoneyRequest,
  Payment,
  PaymentRequest,
  PaymentResponse,
  KYCDocument,
  UploadKYCRequest,
  NotificationPreferences,
} from './services-mock';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await SecureStorage.getItemAsync('auth_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = await getAuthHeaders();
  
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
      ...options.headers,
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Auth Service - Real implementation
 */
export const authService = {
  login: async (data: LoginRequest): Promise<AuthResponse> => {
    const response = await apiRequest<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    
    if (response.access_token) {
      await SecureStorage.setItemAsync('auth_token', response.access_token);
      await SecureStorage.setItemAsync('refresh_token', response.refresh_token);
    }
    
    return response;
  },

  register: async (data: RegisterRequest): Promise<AuthResponse> => {
    const response = await apiRequest<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    
    if (response.access_token) {
      await SecureStorage.setItemAsync('auth_token', response.access_token);
      await SecureStorage.setItemAsync('refresh_token', response.refresh_token);
    }
    
    return response;
  },

  verifyOTP:async (code: string): Promise<void> => {
    await apiRequest('/api/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  },

  requestOTP: async (): Promise<void> => {
    await apiRequest('/api/auth/request-otp', {
      method: 'POST',
    });
  },

  logout: async (): Promise<void> => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } finally {
      await SecureStorage.deleteItemAsync('auth_token');
      await SecureStorage.deleteItemAsync('refresh_token');
    }
  },

  refreshToken: async (): Promise<AuthResponse> => {
    const refreshToken = await SecureStorage.getItemAsync('refresh_token');
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await apiRequest<AuthResponse>('/api/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (response.access_token) {
      await SecureStorage.setItemAsync('auth_token', response.access_token);
      await SecureStorage.setItemAsync('refresh_token', response.refresh_token);
    }

    return response;
  },
};

/**
 * Account Service - Real implementation using tRPC
 */
export const accountService = {
  getAccounts: async (): Promise<Account[]> => {
    const response = await apiRequest<{ accounts: Account[] }>('/api/trpc/openBanking.getLinkedAccounts');
    return response.accounts || [];
  },

  getAccount: async (id: string): Promise<Account> => {
    const response = await apiRequest<Account>(`/api/accounts/${id}`);
    return response;
  },

  getTransactions: async (accountId: string, limit = 50): Promise<Transaction[]> => {
    const response = await apiRequest<{ transactions: Transaction[] }>(
      `/api/trpc/openBanking.getTransactions?input=${encodeURIComponent(JSON.stringify({ accountId, limit }))}`
    );
    return response.transactions || [];
  },

  createAccount: async (type: string): Promise<Account> => {
    const response = await apiRequest<Account>('/api/accounts', {
      method: 'POST',
      body: JSON.stringify({ type }),
    });
    return response;
  },

  syncAccount: async (accountId: string): Promise<void> => {
    await apiRequest(`/api/trpc/openBanking.syncAccount`, {
      method: 'POST',
      body: JSON.stringify({ accountId }),
    });
  },
};

/**
 * Payment Service - Real implementation
 */
export const paymentService = {
  getPaymentMethods: async (): Promise<PaymentMethod[]> => {
    const response = await apiRequest<{ methods: PaymentMethod[] }>('/api/payment-methods');
    return response.methods || [];
  },

  addPaymentMethod: async (data: Partial<PaymentMethod>): Promise<PaymentMethod> => {
    const response = await apiRequest<PaymentMethod>('/api/payment-methods', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response;
  },

  removePaymentMethod: async (id: string): Promise<void> => {
    await apiRequest(`/api/payment-methods/${id}`, {
      method: 'DELETE',
    });
  },

  sendMoney: async (data: SendMoneyRequest): Promise<Payment> => {
    const response = await apiRequest<Payment>('/api/payments/send', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response;
  },

  getPaymentHistory: async (limit = 50): Promise<Payment[]> => {
    const response = await apiRequest<{ payments: Payment[] }>(`/api/payments?limit=${limit}`);
    return response.payments || [];
  },

  getPayment: async (id: string): Promise<Payment> => {
    const response = await apiRequest<Payment>(`/api/payments/${id}`);
    return response;
  },

  sendPayment: async (data: PaymentRequest): Promise<PaymentResponse> => {
    const response = await apiRequest<PaymentResponse>('/api/payments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response;
  },

  getPaymentStatus: async (id: string): Promise<PaymentResponse> => {
    const response = await apiRequest<PaymentResponse>(`/api/payments/${id}/status`);
    return response;
  },

  initiateTransfer: async (data: {
    fromAccountId: string;
    toAccountNumber: string;
    toBankCode: string;
    amount: number;
    narration?: string;
  }): Promise<PaymentResponse> => {
    const response = await apiRequest<PaymentResponse>('/api/trpc/openBanking.initiateTransfer', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response;
  },
};

/**
 * User Service - Real implementation
 */
export const userService = {
  getProfile: async (): Promise<User> => {
    const response = await apiRequest<User>('/api/user/profile');
    return response;
  },

  updateProfile: async (data: Partial<User>): Promise<User> => {
    const response = await apiRequest<User>('/api/user/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return response;
  },

  uploadKYC: async (data: UploadKYCRequest): Promise<KYCDocument> => {
    const formData = new FormData();
    formData.append('document_type', data.document_type);
    formData.append('front_image', data.front_image);
    if (data.back_image) {
      formData.append('back_image', data.back_image);
    }

    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/api/kyc/upload`, {
      method: 'POST',
      headers,
      body: formData,
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Upload failed' }));
      throw new Error(error.message);
    }

    return response.json();
  },

  getKYCStatus: async (): Promise<KYCDocument[]> => {
    const response = await apiRequest<{ documents: KYCDocument[] }>('/api/kyc/status');
    return response.documents || [];
  },

  submitKYCVerification: async (data: {
    documentType: string;
    documentImageUrl: string;
    selfieImageUrl: string;
  }): Promise<{ submissionId: string; status: string }> => {
    const response = await apiRequest<{ submissionId: string; status: string }>(
      '/api/trpc/kyc.submitVerification',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
    return response;
  },
};

/**
 * Notification Service - Real implementation
 */
export const notificationService = {
  getPreferences: async (): Promise<NotificationPreferences> => {
    const response = await apiRequest<NotificationPreferences>('/api/notifications/preferences');
    return response;
  },

  updatePreferences: async (data: NotificationPreferences): Promise<void> => {
    await apiRequest('/api/notifications/preferences', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  registerPushToken: async (token: string): Promise<void> => {
    await apiRequest('/api/trpc/notifications.registerPushToken', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  },

  getNotifications: async (limit = 50): Promise<Array<{
    id: string;
    title: string;
    body: string;
    type: string;
    read: boolean;
    createdAt: string;
  }>> => {
    const response = await apiRequest<{ notifications: Array<{
      id: string;
      title: string;
      body: string;
      type: string;
      read: boolean;
      createdAt: string;
    }> }>(`/api/notifications?limit=${limit}`);
    return response.notifications || [];
  },

  markAsRead: async (notificationId: string): Promise<void> => {
    await apiRequest(`/api/notifications/${notificationId}/read`, {
      method: 'POST',
    });
  },

  markAllAsRead: async (): Promise<void> => {
    await apiRequest('/api/notifications/read-all', {
      method: 'POST',
    });
  },
};

/**
 * Budget Service - Real implementation using tRPC
 */
export const budgetService = {
  getBudgets: async () => {
    const response = await apiRequest<{ result: { data: any[] } }>('/api/trpc/budgets.getBudgets');
    return response.result?.data || [];
  },

  createBudget: async (data: {
    category: string;
    monthlyLimit: number;
    alertThreshold?: number;
  }) => {
    const response = await apiRequest('/api/trpc/budgets.createBudget', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response;
  },

  updateBudget: async (data: {
    budgetId: string;
    monthlyLimit?: number;
    alertThreshold?: number;
    isActive?: boolean;
  }) => {
    const response = await apiRequest('/api/trpc/budgets.updateBudget', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response;
  },

  deleteBudget: async (budgetId: string) => {
    await apiRequest('/api/trpc/budgets.deleteBudget', {
      method: 'POST',
      body: JSON.stringify({ budgetId }),
    });
  },

  getBudgetStatus: async (category?: string) => {
    const input = category ? { category } : {};
    const response = await apiRequest<{ result: { data: any[] } }>(
      `/api/trpc/budgets.getBudgetStatus?input=${encodeURIComponent(JSON.stringify(input))}`
    );
    return response.result?.data || [];
  },
};

/**
 * Savings Service - Real implementation using tRPC
 */
export const savingsService = {
  getGoals: async () => {
    const response = await apiRequest<{ result: { data: any[] } }>('/api/trpc/savingsGoals.getGoals');
    return response.result?.data || [];
  },

  createGoal: async (data: {
    name: string;
    targetAmount: number;
    targetDate?: string;
    category?: string;
  }) => {
    const response = await apiRequest('/api/trpc/savingsGoals.createGoal', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response;
  },

  contribute: async (data: { goalId: string; amount: number }) => {
    const response = await apiRequest('/api/trpc/savingsGoals.contribute', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response;
  },

  withdraw: async (data: { goalId: string; amount: number }) => {
    const response = await apiRequest('/api/trpc/savingsGoals.withdraw', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response;
  },
};

/**
 * BNPL Service - Real implementation using tRPC
 */
export const bnplService = {
  getApplications: async () => {
    const response = await apiRequest<{ result: { data: any[] } }>('/api/trpc/bnpl.getApplications');
    return response.result?.data || [];
  },

  createApplication: async (data: {
    schoolName: string;
    studentName: string;
    tuitionAmount: number;
    installmentPlan: number;
  }) => {
    const response = await apiRequest('/api/trpc/bnpl.createApplication', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response;
  },

  getInstallments: async (applicationId: string) => {
    const response = await apiRequest<{ result: { data: any[] } }>(
      `/api/trpc/bnpl.getInstallments?input=${encodeURIComponent(JSON.stringify({ applicationId }))}`
    );
    return response.result?.data || [];
  },

  makePayment: async (data: { installmentId: string; amount: number }) => {
    const response = await apiRequest('/api/trpc/bnpl.makePayment', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response;
  },
};

/**
 * Credit Score Service - Real implementation
 */
export const creditScoreService = {
  getScore: async () => {
    const response = await apiRequest<{ result: { data: any } }>('/api/trpc/creditScore.getScore');
    return response.result?.data;
  },

  getHistory: async () => {
    const response = await apiRequest<{ result: { data: any[] } }>('/api/trpc/creditScore.getHistory');
    return response.result?.data || [];
  },

  getFactors: async () => {
    const response = await apiRequest<{ result: { data: any[] } }>('/api/trpc/creditScore.getFactors');
    return response.result?.data || [];
  },
};
