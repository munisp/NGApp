import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// API Base URL - update with your backend URL
const API_BASE_URL = __DEV__
  ? 'http://localhost:3000/api'  // Development
  : 'https://api.insureportal.ng/api';  // Production

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      await AsyncStorage.removeItem('auth_token');
      // Navigate to login screen
    }
    return Promise.reject(error);
  }
);

// API Services
export const policiesApi = {
  getAll: () => apiClient.get('/policies'),
  getById: (id: number) => apiClient.get(`/policies/${id}`),
  renew: (id: number) => apiClient.post(`/policies/${id}/renew`),
};

export const claimsApi = {
  getAll: () => apiClient.get('/claims'),
  getById: (id: number) => apiClient.get(`/claims/${id}`),
  create: (data: any) => apiClient.post('/claims', data),
  uploadDocument: (claimId: number, file: any) =>
    apiClient.post(`/claims/${claimId}/documents`, file, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
};

export const paymentsApi = {
  getAll: () => apiClient.get('/payments'),
  getById: (id: number) => apiClient.get(`/payments/${id}`),
  process: (id: number, method: string) =>
    apiClient.post(`/payments/${id}/process`, { method }),
};

export const profileApi = {
  get: () => apiClient.get('/profile'),
  update: (data: any) => apiClient.patch('/profile', data),
};

export const referralsApi = {
  getAll: () => apiClient.get('/referrals'),
  getStats: () => apiClient.get('/referrals/stats'),
  create: (data: any) => apiClient.post('/referrals', data),
};

export const reviewsApi = {
  getAll: () => apiClient.get('/reviews'),
  create: (data: any) => apiClient.post('/reviews', data),
};
