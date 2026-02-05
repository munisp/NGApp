/**
 * End-to-End Tests for Neobank Adapter Service
 * 
 * Tests integration with Kuda, Carbon, and FairMoney neobanks
 * Validates account creation, transfers, virtual cards, and savings products
 */

import { describe, it, expect, beforeAll } from 'vitest';
import axios, { AxiosInstance } from 'axios';

const NEOBANK_API_URL = process.env.NEOBANK_API_URL || 'http://localhost:8094';
const TEST_TIMEOUT = 30000;

describe('Neobank Adapter - End-to-End Tests', () => {
  let apiClient: AxiosInstance;

  beforeAll(() => {
    apiClient = axios.create({
      baseURL: NEOBANK_API_URL,
      timeout: TEST_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.NEOBANK_API_KEY || 'test-api-key',
      },
    });
  });

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const response = await apiClient.get('/health');
      expect(response.status).toBe(200);
      expect(response.data.status).toBe('healthy');
    });
  });

  describe('Account Management - Kuda', () => {
    it('should create new account', async () => {
      const accountRequest = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        phone: '+2348012345678',
        bvn: '12345678901',
        provider: 'kuda',
      };

      const response = await apiClient.post('/api/v1/neobank/account/create', accountRequest);

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        success: true,
        accountNumber: expect.any(String),
        accountName: expect.any(String),
        bankCode: expect.any(String),
      });
    });

    it('should get account balance', async () => {
      const balanceRequest = {
        accountNumber: '1234567890',
        provider: 'kuda',
      };

      const response = await apiClient.post('/api/v1/neobank/balance', balanceRequest);

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        accountNumber: '1234567890',
        balance: expect.any(Number),
        currency: 'NGN',
      });
    });

    it('should get transaction history', async () => {
      const historyRequest = {
        accountNumber: '1234567890',
        startDate: '2026-01-01',
        endDate: '2026-01-31',
        provider: 'kuda',
      };

      const response = await apiClient.post('/api/v1/neobank/transactions', historyRequest);

      expect(response.status).toBe(200);
      expect(response.data.transactions).toBeInstanceOf(Array);
    });
  });

  describe('Transfers - Carbon', () => {
    it('should transfer to another bank', async () => {
      const transferRequest = {
        sourceAccount: '1234567890',
        destinationAccount: '0987654321',
        destinationBank: '058',
        amount: 50000,
        narration: 'Test transfer',
        provider: 'carbon',
        reference: `CARBON-${Date.now()}`,
      };

      const response = await apiClient.post('/api/v1/neobank/transfer', transferRequest);

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        success: true,
        transactionId: expect.any(String),
        status: 'successful',
      });
    });

    it('should validate account before transfer', async () => {
      const validationRequest = {
        accountNumber: '0987654321',
        bankCode: '058',
        provider: 'carbon',
      };

      const response = await apiClient.post('/api/v1/neobank/validate-account', validationRequest);

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        valid: true,
        accountName: expect.any(String),
      });
    });
  });

  describe('Virtual Cards - Kuda', () => {
    it('should create virtual card', async () => {
      const cardRequest = {
        accountNumber: '1234567890',
        cardType: 'mastercard',
        currency: 'USD',
        provider: 'kuda',
      };

      const response = await apiClient.post('/api/v1/neobank/card/create', cardRequest);

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        success: true,
        cardId: expect.any(String),
        cardNumber: expect.any(String),
        cvv: expect.any(String),
        expiryDate: expect.any(String),
      });
    });

    it('should fund virtual card', async () => {
      const fundRequest = {
        cardId: 'CARD-123',
        amount: 100,
        currency: 'USD',
        provider: 'kuda',
      };

      const response = await apiClient.post('/api/v1/neobank/card/fund', fundRequest);

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        success: true,
        balance: expect.any(Number),
      });
    });

    it('should freeze/unfreeze card', async () => {
      const freezeRequest = {
        cardId: 'CARD-123',
        action: 'freeze',
        provider: 'kuda',
      };

      const response = await apiClient.post('/api/v1/neobank/card/control', freezeRequest);

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        success: true,
        status: 'frozen',
      });
    });
  });

  describe('Savings Products - FairMoney', () => {
    it('should create savings plan', async () => {
      const savingsRequest = {
        accountNumber: '1234567890',
        planType: 'fixed',
        amount: 100000,
        duration: 90,
        interestRate: 12,
        provider: 'fairmoney',
      };

      const response = await apiClient.post('/api/v1/neobank/savings/create', savingsRequest);

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        success: true,
        savingsId: expect.any(String),
        maturityDate: expect.any(String),
        expectedReturn: expect.any(Number),
      });
    });

    it('should get savings balance', async () => {
      const balanceRequest = {
        savingsId: 'SAV-123',
        provider: 'fairmoney',
      };

      const response = await apiClient.post('/api/v1/neobank/savings/balance', balanceRequest);

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        balance: expect.any(Number),
        interestEarned: expect.any(Number),
      });
    });
  });

  describe('Loans - Carbon', () => {
    it('should check loan eligibility', async () => {
      const eligibilityRequest = {
        accountNumber: '1234567890',
        provider: 'carbon',
      };

      const response = await apiClient.post('/api/v1/neobank/loan/eligibility', eligibilityRequest);

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        eligible: expect.any(Boolean),
        maxAmount: expect.any(Number),
        interestRate: expect.any(Number),
      });
    });

    it('should apply for loan', async () => {
      const loanRequest = {
        accountNumber: '1234567890',
        amount: 50000,
        duration: 30,
        provider: 'carbon',
      };

      const response = await apiClient.post('/api/v1/neobank/loan/apply', loanRequest);

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        success: true,
        loanId: expect.any(String),
        status: expect.stringMatching(/^(approved|pending|rejected)$/),
      });
    });
  });

  describe('Performance', () => {
    it('should complete transfer within SLA (< 3 seconds)', async () => {
      const startTime = Date.now();
      
      await apiClient.post('/api/v1/neobank/transfer', {
        sourceAccount: '1234567890',
        destinationAccount: '0987654321',
        destinationBank: '058',
        amount: 50000,
        narration: 'SLA test',
        provider: 'kuda',
        reference: `KUDA-SLA-${Date.now()}`,
      });

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(3000);
    });
  });
});
