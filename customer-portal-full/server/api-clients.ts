/**
 * API Client Utilities for Service Integration
 * 
 * This module provides type-safe clients for calling Go microservices
 * and Python services from the customer portal backend.
 */

import { TRPCError } from '@trpc/server';

// ============================================================================
// Configuration
// ============================================================================

const SERVICE_URLS = {
  // Core services
  policy: process.env.POLICY_SERVICE_URL || 'http://localhost:8081',
  claim: process.env.CLAIM_SERVICE_URL || 'http://localhost:8082',
  payment: process.env.PAYMENT_SERVICE_URL || 'http://localhost:8083',
  customer: process.env.CUSTOMER_SERVICE_URL || 'http://localhost:8084',
  verification: process.env.VERIFICATION_SERVICE_URL || 'http://localhost:8085',
  telco: process.env.TELCO_SERVICE_URL || 'http://localhost:8010',
  fraud: process.env.FRAUD_DATABASE_URL || 'http://localhost:8020',
  // Extended microservices
  actuarial: process.env.ACTUARIAL_SERVICE_URL || 'http://localhost:8091',
  bancassurance: process.env.BANCASSURANCE_SERVICE_URL || 'http://localhost:8092',
  groupLife: process.env.GROUP_LIFE_SERVICE_URL || 'http://localhost:8093',
  nmid: process.env.NMID_SERVICE_URL || 'http://localhost:8094',
  pfa: process.env.PFA_SERVICE_URL || 'http://localhost:8095',
  reinsurance: process.env.REINSURANCE_SERVICE_URL || 'http://localhost:8096',
  kyc: process.env.KYC_SERVICE_URL || 'http://localhost:8097',
  analytics: process.env.ANALYTICS_SERVICE_URL || 'http://localhost:8098',
  geospatial: process.env.GEOSPATIAL_SERVICE_URL || 'http://localhost:8099',
  communication: process.env.COMMUNICATION_SERVICE_URL || 'http://localhost:8100',
  document: process.env.DOCUMENT_SERVICE_URL || 'http://localhost:8101',
  underwriting: process.env.UNDERWRITING_SERVICE_URL || 'http://localhost:8102',
  erpnext: process.env.ERPNEXT_SERVICE_URL || 'http://localhost:8103',
  openimis: process.env.OPENIMIS_SERVICE_URL || 'http://localhost:8104',
  etherisc: process.env.ETHERISC_SERVICE_URL || 'http://localhost:8105',
  mojaloop: process.env.MOJALOOP_SERVICE_URL || 'http://localhost:8106',
  gdpr: process.env.GDPR_SERVICE_URL || 'http://localhost:8107',
  ussd: process.env.USSD_SERVICE_URL || 'http://localhost:8108',
};

const TIMEOUT_MS = 10000; // 10 seconds
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

// ============================================================================
// Base HTTP Client with Retry Logic
// ============================================================================

async function fetchWithRetry(
  url: string,
  options?: RequestInit,
  retries = MAX_RETRIES
): Promise<Response> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok && retries > 0 && response.status >= 500) {
      // Retry on server errors
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
      return fetchWithRetry(url, options, retries - 1);
    }

    return response;
  } catch (error: any) {
    if (retries > 0 && (error.name === 'AbortError' || error.code === 'ECONNREFUSED')) {
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
      return fetchWithRetry(url, options, retries - 1);
    }
    throw error;
  }
}

async function apiCall<T>(
  serviceName: keyof typeof SERVICE_URLS,
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${SERVICE_URLS[serviceName]}${endpoint}`;

  try {
    const response = await fetchWithRetry(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new TRPCError({
        code: response.status >= 500 ? 'INTERNAL_SERVER_ERROR' : 'BAD_REQUEST',
        message: `${serviceName} service error: ${errorText}`,
      });
    }

    return await response.json();
  } catch (error: any) {
    if (error instanceof TRPCError) throw error;

    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `Failed to call ${serviceName} service: ${error.message}`,
    });
  }
}

// ============================================================================
// Policy Service Client
// ============================================================================

export const policyService = {
  async list(customerId: string) {
    return apiCall('policy', `/api/v1/policies/customer/${customerId}`);
  },

  async get(policyId: string) {
    return apiCall('policy', `/api/v1/policies/${policyId}`);
  },

  async create(data: any) {
    return apiCall('policy', '/api/v1/policies', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(policyId: string, data: any) {
    return apiCall('policy', `/api/v1/policies/${policyId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async renew(policyId: string) {
    return apiCall('policy', `/api/v1/policies/${policyId}/renew`, {
      method: 'POST',
    });
  },

  async cancel(policyId: string) {
    return apiCall('policy', `/api/v1/policies/${policyId}/cancel`, {
      method: 'POST',
    });
  },

  async generateQuote(data: any) {
    return apiCall('policy', '/api/v1/quotes', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

// ============================================================================
// Claim Service Client
// ============================================================================

export const claimService = {
  async list(customerId?: string, policyId?: string) {
    const params = new URLSearchParams();
    if (customerId) params.append('customer_id', customerId);
    if (policyId) params.append('policy_id', policyId);
    return apiCall('claim', `/api/v1/claims?${params.toString()}`);
  },

  async get(claimId: string) {
    return apiCall('claim', `/api/v1/claims/${claimId}`);
  },

  async create(data: any) {
    return apiCall('claim', '/api/v1/claims', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(claimId: string, data: any) {
    return apiCall('claim', `/api/v1/claims/${claimId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async approve(claimId: string, approvedAmount: number) {
    return apiCall('claim', `/api/v1/claims/${claimId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ approved_amount: approvedAmount }),
    });
  },

  async reject(claimId: string, reason: string) {
    return apiCall('claim', `/api/v1/claims/${claimId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ rejection_reason: reason }),
    });
  },

  async settle(claimId: string) {
    return apiCall('claim', `/api/v1/claims/${claimId}/settle`, {
      method: 'POST',
    });
  },

  async uploadDocument(claimId: string, documentData: any) {
    return apiCall('claim', `/api/v1/claims/${claimId}/documents`, {
      method: 'POST',
      body: JSON.stringify(documentData),
    });
  },
};

// ============================================================================
// Payment Service Client
// ============================================================================

export const paymentService = {
  async list(customerId?: string, policyId?: string) {
    const params = new URLSearchParams();
    if (customerId) params.append('customer_id', customerId);
    if (policyId) params.append('policy_id', policyId);
    return apiCall('payment', `/api/v1/payments?${params.toString()}`);
  },

  async get(paymentId: string) {
    return apiCall('payment', `/api/v1/payments/${paymentId}`);
  },

  async create(data: any) {
    return apiCall('payment', '/api/v1/payments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async process(paymentId: string, paymentData: any) {
    return apiCall('payment', `/api/v1/payments/${paymentId}/process`, {
      method: 'POST',
      body: JSON.stringify(paymentData),
    });
  },

  async refund(paymentId: string, reason: string) {
    return apiCall('payment', `/api/v1/payments/${paymentId}/refund`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  async addPaymentMethod(customerId: string, methodData: any) {
    return apiCall('payment', '/api/v1/payment-methods', {
      method: 'POST',
      body: JSON.stringify({ customer_id: customerId, ...methodData }),
    });
  },

  async getPaymentMethods(customerId: string) {
    return apiCall('payment', `/api/v1/payment-methods/customer/${customerId}`);
  },
};

// ============================================================================
// Customer Service Client
// ============================================================================

export const customerService = {
  async get(customerId: string) {
    return apiCall('customer', `/api/v1/customers/${customerId}`);
  },

  async create(data: any) {
    return apiCall('customer', '/api/v1/customers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(customerId: string, data: any) {
    return apiCall('customer', `/api/v1/customers/${customerId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async search(query: string) {
    return apiCall('customer', `/api/v1/customers/search?q=${encodeURIComponent(query)}`);
  },

  async uploadDocument(customerId: string, documentData: any) {
    return apiCall('customer', `/api/v1/customers/${customerId}/documents`, {
      method: 'POST',
      body: JSON.stringify(documentData),
    });
  },

  async getPolicies(customerId: string) {
    return apiCall('customer', `/api/v1/customers/${customerId}/policies`);
  },

  async getClaims(customerId: string) {
    return apiCall('customer', `/api/v1/customers/${customerId}/claims`);
  },
};

// ============================================================================
// Verification Service Client
// ============================================================================

export const verificationService = {
  async verifyNIN(nin: string, firstName: string, lastName: string) {
    return apiCall('verification', '/api/v1/verify/nin', {
      method: 'POST',
      body: JSON.stringify({ nin, first_name: firstName, last_name: lastName }),
    });
  },

  async verifyCAC(rcNumber: string, companyName: string) {
    return apiCall('verification', '/api/v1/verify/cac', {
      method: 'POST',
      body: JSON.stringify({ rc_number: rcNumber, company_name: companyName }),
    });
  },

  async verifyBiometric(customerId: string, biometricData: any) {
    return apiCall('verification', '/api/v1/verify/biometric', {
      method: 'POST',
      body: JSON.stringify({ customer_id: customerId, ...biometricData }),
    });
  },

  async verifyPhone(phone: string, otp: string) {
    return apiCall('verification', '/api/v1/verify/phone', {
      method: 'POST',
      body: JSON.stringify({ phone, otp }),
    });
  },

  async get(verificationId: string) {
    return apiCall('verification', `/api/v1/verifications/${verificationId}`);
  },

  async getCustomerVerifications(customerId: string) {
    return apiCall('verification', `/api/v1/verifications/customer/${customerId}`);
  },
};

// ============================================================================
// Telco Service Client
// ============================================================================

export const telcoService = {
  async getCreditScore(customerId: string, phoneNumber: string) {
    return apiCall('telco', '/api/v1/credit-score/calculate', {
      method: 'POST',
      body: JSON.stringify({ customer_id: customerId, phone_number: phoneNumber }),
    });
  },

  async getHybridScore(customerId: string, phoneNumber: string, telcoData: any) {
    return apiCall('telco', '/api/v1/hybrid/score', {
      method: 'POST',
      body: JSON.stringify({
        customer_id: customerId,
        phone_number: phoneNumber,
        telco_data: telcoData,
        use_dynamic_weighting: true,
      }),
    });
  },

  async recordLoanApplication(customerId: string, phoneNumber: string, creditScore: number, loanAmount: number) {
    return apiCall('telco', '/api/v1/data-collection/loan-applications', {
      method: 'POST',
      body: JSON.stringify({
        customer_id: customerId,
        phone_number: phoneNumber,
        credit_score: creditScore,
        loan_amount: loanAmount,
      }),
    });
  },
};

// ============================================================================
// Fraud Database Client
// ============================================================================

export const fraudService = {
  async checkCustomer(nin: string, companyId: string) {
    return apiCall('fraud', '/api/v1/fraud/check', {
      method: 'POST',
      body: JSON.stringify({ nin, company_id: companyId }),
    });
  },

  async reportFraud(data: any) {
    return apiCall('fraud', '/api/v1/fraud/report', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getStatistics(companyId: string) {
    return apiCall('fraud', `/api/v1/analytics/statistics?company_id=${companyId}`);
  },
};

// ============================================================================
// Health Check Utilities
// ============================================================================

export async function checkServiceHealth(serviceName: keyof typeof SERVICE_URLS): Promise<boolean> {
  try {
    const response = await fetch(`${SERVICE_URLS[serviceName]}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function checkAllServicesHealth(): Promise<Record<string, boolean>> {
  const services = Object.keys(SERVICE_URLS) as Array<keyof typeof SERVICE_URLS>;
  const results = await Promise.all(
    services.map(async service => ({
      service,
      healthy: await checkServiceHealth(service),
    }))
  );

  return Object.fromEntries(results.map(r => [r.service, r.healthy]));
}
