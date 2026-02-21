/**
 * API Service Layer - Production-ready API client with error handling,
 * retry logic, and offline support integration
 */

import { useOfflineStore } from '../stores/offlineStore';

// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// Error types
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class NetworkError extends Error {
  constructor(message: string = 'Network error. Please check your connection.') {
    super(message);
    this.name = 'NetworkError';
  }
}

// Request configuration
interface RequestConfig {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: unknown;
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
  offlineQueue?: boolean;
}

// Response wrapper
interface ApiResponse<T> {
  data: T;
  status: number;
  headers: Headers;
}

// Auth token management
let authToken: string | null = null;

export const setAuthToken = (token: string | null) => {
  authToken = token;
  if (token) {
    localStorage.setItem('auth_token', token);
  } else {
    localStorage.removeItem('auth_token');
  }
};

export const getAuthToken = (): string | null => {
  if (!authToken) {
    authToken = localStorage.getItem('auth_token');
  }
  return authToken;
};

// Retry with exponential backoff
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries: number = 3,
  delay: number = 1000
): Promise<Response> {
  try {
    const response = await fetch(url, options);
    if (response.status >= 500 && retries > 0) {
      await sleep(delay);
      return fetchWithRetry(url, options, retries - 1, delay * 2);
    }
    return response;
  } catch (error) {
    if (retries > 0 && error instanceof TypeError) {
      await sleep(delay);
      return fetchWithRetry(url, options, retries - 1, delay * 2);
    }
    throw error;
  }
}

// Main API request function
async function apiRequest<T>(
  endpoint: string,
  config: RequestConfig = {}
): Promise<ApiResponse<T>> {
  const {
    method = 'GET',
    body,
    headers = {},
    timeout = 30000,
    retries = 3,
    offlineQueue = false,
  } = config;

  const url = `${API_BASE_URL}${endpoint}`;
  const token = getAuthToken();

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  if (token) {
    requestHeaders['Authorization'] = `Bearer ${token}`;
  }

  const requestOptions: RequestInit = {
    method,
    headers: requestHeaders,
    body: body ? JSON.stringify(body) : undefined,
  };

  // Check if offline and should queue
  const offlineStore = useOfflineStore.getState();
  if (!offlineStore.isOnline && offlineQueue && method !== 'GET') {
    // Queue the request for later
    const transactionType = endpoint.includes('transfer') ? 'transfer' :
                           endpoint.includes('airtime') ? 'airtime' :
                           endpoint.includes('bill') ? 'bill_payment' : 'transfer';
    
    offlineStore.addPendingTransaction({
      type: transactionType,
      data: { endpoint, method, body },
    });
    
    throw new NetworkError('You are offline. This transaction has been queued and will be processed when you reconnect.');
  }

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  requestOptions.signal = controller.signal;

  try {
    const response = await fetchWithRetry(url, requestOptions, retries);
    clearTimeout(timeoutId);

    const contentType = response.headers.get('content-type');
    let data: T;

    if (contentType?.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text() as unknown as T;
    }

    if (!response.ok) {
      const errorData = data as Record<string, unknown>;
      throw new ApiError(
        response.status,
        (errorData.code as string) || 'UNKNOWN_ERROR',
        (errorData.message as string) || 'An error occurred',
        errorData.details as Record<string, unknown>
      );
    }

    return { data, status: response.status, headers: response.headers };
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error instanceof ApiError) {
      throw error;
    }
    
    if (error instanceof TypeError || (error as Error).name === 'AbortError') {
      throw new NetworkError();
    }
    
    throw error;
  }
}

// API Methods
export const api = {
  get: <T>(endpoint: string, config?: Omit<RequestConfig, 'method' | 'body'>) =>
    apiRequest<T>(endpoint, { ...config, method: 'GET' }),

  post: <T>(endpoint: string, body?: unknown, config?: Omit<RequestConfig, 'method' | 'body'>) =>
    apiRequest<T>(endpoint, { ...config, method: 'POST', body }),

  put: <T>(endpoint: string, body?: unknown, config?: Omit<RequestConfig, 'method' | 'body'>) =>
    apiRequest<T>(endpoint, { ...config, method: 'PUT', body }),

  patch: <T>(endpoint: string, body?: unknown, config?: Omit<RequestConfig, 'method' | 'body'>) =>
    apiRequest<T>(endpoint, { ...config, method: 'PATCH', body }),

  delete: <T>(endpoint: string, config?: Omit<RequestConfig, 'method' | 'body'>) =>
    apiRequest<T>(endpoint, { ...config, method: 'DELETE' }),
};

// ============================================
// Domain-specific API services
// ============================================

// Auth Service
export const authService = {
  login: (email: string, password: string) =>
    api.post<{ token: string; user: User }>('/auth/login', { email, password }),

  register: (data: RegisterData) =>
    api.post<{ token: string; user: User }>('/auth/register', data),

  requestOtp: (email: string) =>
    api.post<{ message: string }>('/auth/request-otp', { email }),

  verifyOtp: (email: string, otp: string) =>
    api.post<{ token: string; user: User }>('/auth/verify-otp', { email, otp }),

  logout: () => api.post<void>('/auth/logout'),

  refreshToken: () =>
    api.post<{ token: string }>('/auth/refresh'),

  getProfile: () =>
    api.get<User>('/auth/profile'),
};

// Transaction Service
export const transactionService = {
  transfer: (data: TransferRequest) =>
    api.post<Transaction>('/transactions/transfer', data, { offlineQueue: true }),

  getHistory: (params?: { page?: number; limit?: number; type?: string }) =>
    api.get<{ transactions: Transaction[]; total: number; page: number }>(
      `/transactions?${new URLSearchParams(params as Record<string, string>).toString()}`
    ),

  getById: (id: string) =>
    api.get<Transaction>(`/transactions/${id}`),

  cancel: (id: string) =>
    api.post<Transaction>(`/transactions/${id}/cancel`),
};

// Wallet Service
export const walletService = {
  getBalance: () =>
    api.get<WalletBalance>('/wallet/balance'),

  getBalances: () =>
    api.get<WalletBalance[]>('/wallet/balances'),

  fund: (data: FundWalletRequest) =>
    api.post<Transaction>('/wallet/fund', data, { offlineQueue: true }),

  withdraw: (data: WithdrawRequest) =>
    api.post<Transaction>('/wallet/withdraw', data),

  getTransactions: (currency?: string) =>
    api.get<Transaction[]>(`/wallet/transactions${currency ? `?currency=${currency}` : ''}`),
};

// Exchange Rate Service
export const exchangeRateService = {
  getRates: (from?: string, to?: string) =>
    api.get<ExchangeRate[]>(`/exchange-rates${from ? `?from=${from}` : ''}${to ? `&to=${to}` : ''}`),

  getRate: (from: string, to: string) =>
    api.get<ExchangeRate>(`/exchange-rates/${from}/${to}`),

  lockRate: (from: string, to: string, amount: number) =>
    api.post<RateLock>('/exchange-rates/lock', { from, to, amount }),

  unlockRate: (lockId: string) =>
    api.delete<void>(`/exchange-rates/lock/${lockId}`),

  getHistory: (from: string, to: string, days?: number) =>
    api.get<ExchangeRateHistory[]>(`/exchange-rates/history/${from}/${to}?days=${days || 30}`),
};

// Airtime Service
export const airtimeService = {
  purchase: (data: AirtimePurchaseRequest) =>
    api.post<AirtimeTransaction>('/airtime/purchase', data, { offlineQueue: true }),

  getProviders: (country?: string) =>
    api.get<AirtimeProvider[]>(`/airtime/providers${country ? `?country=${country}` : ''}`),

  getDataPlans: (provider: string) =>
    api.get<DataPlan[]>(`/airtime/data-plans/${provider}`),

  getHistory: () =>
    api.get<AirtimeTransaction[]>('/airtime/history'),
};

// Bill Payment Service
export const billPaymentService = {
  pay: (data: BillPaymentRequest) =>
    api.post<BillPaymentTransaction>('/bills/pay', data, { offlineQueue: true }),

  getCategories: () =>
    api.get<BillCategory[]>('/bills/categories'),

  getBillers: (category: string) =>
    api.get<Biller[]>(`/bills/billers/${category}`),

  validateCustomer: (billerId: string, customerId: string) =>
    api.post<CustomerValidation>('/bills/validate', { billerId, customerId }),

  getHistory: () =>
    api.get<BillPaymentTransaction[]>('/bills/history'),
};

// KYC Service
export const kycService = {
  getProfile: () =>
    api.get<KYCProfile>('/kyc/profile'),

  updateProfile: (data: Partial<KYCProfile>) =>
    api.put<KYCProfile>('/kyc/profile', data),

  uploadDocument: (type: string, file: File) => {
    const formData = new FormData();
    formData.append('type', type);
    formData.append('file', file);
    return api.post<KYCDocument>('/kyc/documents', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  getDocuments: () =>
    api.get<KYCDocument[]>('/kyc/documents'),

  verifyBvn: (bvn: string) =>
    api.post<BVNVerification>('/kyc/verify-bvn', { bvn }),

  getLimits: () =>
    api.get<KYCLimits>('/kyc/limits'),

  requestTierUpgrade: (tier: string) =>
    api.post<KYCUpgradeRequest>('/kyc/upgrade', { tier }),
};

// Property Transaction KYC Service
export const propertyKycService = {
  // Party Management
  createParty: (data: CreatePartyRequest) =>
    api.post<Party>('/property-kyc/parties', data),

  getParty: (partyId: string) =>
    api.get<Party>(`/property-kyc/parties/${partyId}`),

  verifyParty: (partyId: string, verifiedBy: string) =>
    api.put<Party>(`/property-kyc/parties/${partyId}/verify`, { verified_by: verifiedBy }),

  // Transaction Management
  createTransaction: (data: CreatePropertyTransactionRequest) =>
    api.post<PropertyTransaction>('/property-kyc/transactions', data),

  getTransaction: (transactionId: string) =>
    api.get<PropertyTransaction>(`/property-kyc/transactions/${transactionId}`),

  addSeller: (transactionId: string, sellerId: string) =>
    api.post<PropertyTransaction>(`/property-kyc/transactions/${transactionId}/add-seller`, { seller_id: sellerId }),

  // Source of Funds
  submitSourceOfFunds: (transactionId: string, data: SourceOfFundsRequest) =>
    api.post<SourceOfFunds>(`/property-kyc/transactions/${transactionId}/source-of-funds`, data),

  verifySourceOfFunds: (sofId: string, verifiedBy: string) =>
    api.put<SourceOfFunds>(`/property-kyc/source-of-funds/${sofId}/verify`, { verified_by: verifiedBy }),

  // Bank Statements
  uploadBankStatement: (transactionId: string, data: BankStatementRequest) =>
    api.post<BankStatement>(`/property-kyc/transactions/${transactionId}/bank-statements`, data),

  validateBankStatements: (transactionId: string) =>
    api.get<BankStatementValidation>(`/property-kyc/transactions/${transactionId}/bank-statements/validate`),

  // Income Documents
  uploadIncomeDocument: (transactionId: string, data: IncomeDocumentRequest) =>
    api.post<IncomeDocument>(`/property-kyc/transactions/${transactionId}/income-documents`, data),

  verifyIncomeDocument: (docId: string, verifiedBy: string) =>
    api.put<IncomeDocument>(`/property-kyc/income-documents/${docId}/verify`, { verified_by: verifiedBy }),

  // Purchase Agreement
  uploadPurchaseAgreement: (transactionId: string, data: PurchaseAgreementRequest) =>
    api.post<PurchaseAgreement>(`/property-kyc/transactions/${transactionId}/purchase-agreement`, data),

  validatePurchaseAgreement: (agreementId: string) =>
    api.post<PurchaseAgreementValidation>(`/property-kyc/purchase-agreements/${agreementId}/validate`),

  verifyPurchaseAgreement: (agreementId: string, verifiedBy: string) =>
    api.put<PurchaseAgreement>(`/property-kyc/purchase-agreements/${agreementId}/verify`, { verified_by: verifiedBy }),

  // Transaction Flow
  getChecklist: (transactionId: string) =>
    api.get<PropertyTransactionChecklist>(`/property-kyc/transactions/${transactionId}/checklist`),

  submitForReview: (transactionId: string) =>
    api.post<PropertyTransaction>(`/property-kyc/transactions/${transactionId}/submit-for-review`),

  approveTransaction: (transactionId: string, reviewerId: string, notes?: string) =>
    api.put<PropertyTransaction>(`/property-kyc/transactions/${transactionId}/approve`, { reviewer_id: reviewerId, notes }),

  rejectTransaction: (transactionId: string, reviewerId: string, reason: string) =>
    api.put<PropertyTransaction>(`/property-kyc/transactions/${transactionId}/reject`, { reviewer_id: reviewerId, reason }),

  // Flow Documentation
  getFlowDocumentation: () =>
    api.get<FlowDocumentation>('/property-kyc/flow-documentation'),
};

// Virtual Account Service
export const virtualAccountService = {
  create: (data: CreateVirtualAccountRequest) =>
    api.post<VirtualAccount>('/virtual-accounts', data),

  getAccounts: () =>
    api.get<VirtualAccount[]>('/virtual-accounts'),

  getById: (id: string) =>
    api.get<VirtualAccount>(`/virtual-accounts/${id}`),

  getTransactions: (accountId: string) =>
    api.get<Transaction[]>(`/virtual-accounts/${accountId}/transactions`),
};

// Card Service
export const cardService = {
  create: (data: CreateCardRequest) =>
    api.post<VirtualCard>('/cards', data),

  getCards: () =>
    api.get<VirtualCard[]>('/cards'),

  getById: (id: string) =>
    api.get<VirtualCard>(`/cards/${id}`),

  freeze: (id: string) =>
    api.post<VirtualCard>(`/cards/${id}/freeze`),

  unfreeze: (id: string) =>
    api.post<VirtualCard>(`/cards/${id}/unfreeze`),

  setLimit: (id: string, limit: number) =>
    api.put<VirtualCard>(`/cards/${id}/limit`, { limit }),

  getTransactions: (cardId: string) =>
    api.get<CardTransaction[]>(`/cards/${cardId}/transactions`),
};

// Referral Service
export const referralService = {
  getReferralCode: () =>
    api.get<{ code: string; link: string }>('/referrals/code'),

  getReferrals: () =>
    api.get<Referral[]>('/referrals'),

  getRewards: () =>
    api.get<ReferralReward[]>('/referrals/rewards'),

  claimReward: (rewardId: string) =>
    api.post<ReferralReward>(`/referrals/rewards/${rewardId}/claim`),
};

// Savings Service
export const savingsService = {
  createGoal: (data: CreateSavingsGoalRequest) =>
    api.post<SavingsGoal>('/savings/goals', data),

  getGoals: () =>
    api.get<SavingsGoal[]>('/savings/goals'),

  getGoal: (id: string) =>
    api.get<SavingsGoal>(`/savings/goals/${id}`),

  contribute: (goalId: string, amount: number) =>
    api.post<SavingsContribution>(`/savings/goals/${goalId}/contribute`, { amount }),

  withdraw: (goalId: string, amount: number) =>
    api.post<SavingsWithdrawal>(`/savings/goals/${goalId}/withdraw`, { amount }),
};

// ============================================
// Type Definitions
// ============================================

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  kycTier: string;
  createdAt: string;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

export interface Transaction {
  id: string;
  type: string;
  amount: number;
  currency: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  reference: string;
  description?: string;
  recipient?: string;
  sender?: string;
  fee?: number;
  exchangeRate?: number;
  createdAt: string;
  completedAt?: string;
}

export interface TransferRequest {
  recipientType: 'phone' | 'email' | 'bank';
  recipient: string;
  recipientName: string;
  amount: number;
  currency: string;
  destinationCurrency: string;
  note?: string;
  deliveryMethod: string;
  rateLockId?: string;
}

export interface WalletBalance {
  currency: string;
  available: number;
  pending: number;
  total: number;
}

export interface FundWalletRequest {
  amount: number;
  currency: string;
  paymentMethod: string;
}

export interface WithdrawRequest {
  amount: number;
  currency: string;
  bankCode: string;
  accountNumber: string;
}

export interface ExchangeRate {
  from: string;
  to: string;
  rate: number;
  inverseRate: number;
  provider: string;
  lastUpdated: string;
  validUntil: string;
}

export interface RateLock {
  id: string;
  from: string;
  to: string;
  rate: number;
  amount: number;
  lockedAt: string;
  expiresAt: string;
}

export interface ExchangeRateHistory {
  date: string;
  rate: number;
  high: number;
  low: number;
}

export interface AirtimePurchaseRequest {
  phone: string;
  amount: number;
  provider: string;
  type: 'airtime' | 'data';
  planId?: string;
}

export interface AirtimeTransaction {
  id: string;
  phone: string;
  amount: number;
  provider: string;
  type: string;
  status: string;
  createdAt: string;
}

export interface AirtimeProvider {
  id: string;
  name: string;
  logo: string;
  country: string;
}

export interface DataPlan {
  id: string;
  name: string;
  amount: number;
  data: string;
  validity: string;
}

export interface BillPaymentRequest {
  category: string;
  billerId: string;
  customerId: string;
  amount: number;
  customerName?: string;
}

export interface BillPaymentTransaction {
  id: string;
  category: string;
  biller: string;
  customerId: string;
  amount: number;
  status: string;
  createdAt: string;
}

export interface BillCategory {
  id: string;
  name: string;
  icon: string;
}

export interface Biller {
  id: string;
  name: string;
  logo: string;
  category: string;
}

export interface CustomerValidation {
  valid: boolean;
  customerName: string;
  customerId: string;
  minimumAmount?: number;
  maximumAmount?: number;
}

export interface KYCProfile {
  id: string;
  userId: string;
  currentTier: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  phone?: string;
  phoneVerified: boolean;
  email?: string;
  emailVerified: boolean;
  bvn?: string;
  bvnVerified: boolean;
  address?: string;
  idDocumentStatus: string;
  selfieStatus: string;
  addressProofStatus: string;
}

export interface KYCDocument {
  id: string;
  type: string;
  status: string;
  uploadedAt: string;
  verifiedAt?: string;
}

export interface BVNVerification {
  valid: boolean;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  phone: string;
}

export interface KYCLimits {
  tier: string;
  dailyLimit: number;
  monthlyLimit: number;
  singleTransactionLimit: number;
}

export interface KYCUpgradeRequest {
  id: string;
  requestedTier: string;
  status: string;
  createdAt: string;
}

// Property Transaction KYC Types
export interface Party {
  id: string;
  role: 'buyer' | 'seller' | 'agent' | 'lawyer' | 'escrow';
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  idType: string;
  idNumber: string;
  bvn?: string;
  nin?: string;
  kycStatus: string;
  createdAt: string;
}

export interface CreatePartyRequest {
  role: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  nationality: string;
  email: string;
  phone: string;
  addressLine1: string;
  city: string;
  state: string;
  country: string;
  idType: string;
  idNumber: string;
  idIssuingCountry: string;
  idIssueDate: string;
  idExpiryDate: string;
  bvn?: string;
  nin?: string;
}

export interface PropertyTransaction {
  id: string;
  referenceNumber: string;
  propertyType: string;
  propertyAddress: string;
  purchasePrice: number;
  currency: string;
  buyerId: string;
  sellerId?: string;
  buyerKycComplete: boolean;
  sellerKycComplete: boolean;
  sourceOfFundsVerified: boolean;
  bankStatementsVerified: boolean;
  incomeVerified: boolean;
  purchaseAgreementVerified: boolean;
  status: string;
  riskScore: number;
  createdAt: string;
}

export interface CreatePropertyTransactionRequest {
  propertyType: string;
  propertyAddress: string;
  purchasePrice: number;
  currency?: string;
  buyerId: string;
}

export interface SourceOfFunds {
  id: string;
  transactionId: string;
  primarySource: string;
  secondarySource?: string;
  employerName?: string;
  businessName?: string;
  status: string;
}

export interface SourceOfFundsRequest {
  primarySource: string;
  secondarySource?: string;
  employerName?: string;
  businessName?: string;
  annualIncome?: number;
  additionalDetails?: string;
}

export interface BankStatement {
  id: string;
  transactionId: string;
  bankName: string;
  accountNumber: string;
  statementStartDate: string;
  statementEndDate: string;
  status: string;
}

export interface BankStatementRequest {
  bankName: string;
  accountNumber: string;
  accountHolderName: string;
  statementStartDate: string;
  statementEndDate: string;
  documentUrl: string;
}

export interface BankStatementValidation {
  valid: boolean;
  message: string;
  coverageDays: number;
  requiredDays: number;
}

export interface IncomeDocument {
  id: string;
  transactionId: string;
  documentType: string;
  status: string;
}

export interface IncomeDocumentRequest {
  documentType: string;
  documentUrl: string;
  issuerName?: string;
  documentDate?: string;
  amount?: number;
}

export interface PurchaseAgreement {
  id: string;
  transactionId: string;
  buyerName: string;
  sellerName: string;
  propertyAddress: string;
  purchasePrice: number;
  buyerInfoMatchesKyc: boolean;
  sellerInfoMatchesKyc: boolean;
  status: string;
}

export interface PurchaseAgreementRequest {
  documentUrl: string;
  buyerName: string;
  buyerAddress: string;
  sellerName: string;
  sellerAddress: string;
  propertyAddress: string;
  propertyDescription: string;
  propertyType: string;
  purchasePrice: number;
  completionDate?: string;
}

export interface PurchaseAgreementValidation {
  buyerMatch: { matches: boolean; kycName: string; agreementName: string };
  sellerMatch: { matches: boolean; kycName: string; agreementName: string };
  priceMatch: { matches: boolean; transactionPrice: number; agreementPrice: number };
  allValid: boolean;
}

export interface PropertyTransactionChecklist {
  transactionId: string;
  requirements: {
    name: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    description: string;
  }[];
  overallProgress: number;
  canSubmitForReview: boolean;
}

export interface FlowDocumentation {
  steps: {
    step: number;
    name: string;
    description: string;
    endpoint: string;
  }[];
}

export interface VirtualAccount {
  id: string;
  accountNumber: string;
  accountName: string;
  bankName: string;
  currency: string;
  status: string;
  createdAt: string;
}

export interface CreateVirtualAccountRequest {
  currency: string;
  bankPreference?: string;
}

export interface VirtualCard {
  id: string;
  cardNumber: string;
  expiryDate: string;
  cvv: string;
  cardType: string;
  currency: string;
  balance: number;
  limit: number;
  status: 'active' | 'frozen' | 'expired';
  createdAt: string;
}

export interface CreateCardRequest {
  cardType: string;
  currency: string;
  initialFunding?: number;
}

export interface CardTransaction {
  id: string;
  cardId: string;
  amount: number;
  currency: string;
  merchant: string;
  status: string;
  createdAt: string;
}

export interface Referral {
  id: string;
  referredEmail: string;
  status: string;
  rewardEarned: number;
  createdAt: string;
}

export interface ReferralReward {
  id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'available' | 'claimed';
  source: string;
  createdAt: string;
}

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  currency: string;
  targetDate: string;
  status: 'active' | 'completed' | 'withdrawn';
  interestRate: number;
  createdAt: string;
}

export interface CreateSavingsGoalRequest {
  name: string;
  targetAmount: number;
  currency: string;
  targetDate: string;
  autoDebit?: boolean;
  autoDebitAmount?: number;
  autoDebitFrequency?: string;
}

export interface SavingsContribution {
  id: string;
  goalId: string;
  amount: number;
  createdAt: string;
}

export interface SavingsWithdrawal {
  id: string;
  goalId: string;
  amount: number;
  penalty?: number;
  createdAt: string;
}

export default api;
