/**
 * End-to-End Tests for Integration Orchestration Service
 * 
 * Tests cross-platform transfers and unified API layer
 * Validates Kuda→GTBank, Flutterwave→Western Union, Paga→Carbon flows
 */

import { describe, it, expect, beforeAll } from 'vitest';
import axios, { AxiosInstance } from 'axios';

const ORCHESTRATION_API_URL = process.env.ORCHESTRATION_API_URL || 'http://localhost:8095';
const TEST_TIMEOUT = 30000;

describe('Integration Orchestration - End-to-End Tests', () => {
  let apiClient: AxiosInstance;

  beforeAll(() => {
    apiClient = axios.create({
      baseURL: ORCHESTRATION_API_URL,
      timeout: TEST_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.ORCHESTRATION_API_KEY || 'test-api-key',
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

  describe('Cross-Platform Transfers', () => {
    it('should transfer from Kuda to GTBank', async () => {
      const transferRequest = {
        sourceType: 'neobank',
        sourceProvider: 'kuda',
        sourceAccount: '1234567890',
        destinationType: 'bank',
        destinationProvider: 'gtbank',
        destinationAccount: '0987654321',
        amount: 100000,
        narration: 'Cross-platform transfer',
        reference: `XFER-${Date.now()}`,
      };

      const response = await apiClient.post('/api/v1/orchestration/transfer', transferRequest);

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        success: true,
        transactionId: expect.any(String),
        status: 'successful',
        platformFee: 500,
      });
    });

    it('should transfer from Flutterwave to Paga agent', async () => {
      const transferRequest = {
        sourceType: 'payment',
        sourceProvider: 'flutterwave',
        sourceAccount: 'FLW-WALLET-123',
        destinationType: 'agent',
        destinationProvider: 'paga',
        destinationAgent: 'PG-12345',
        amount: 50000,
        reference: `XFER-${Date.now()}`,
      };

      const response = await apiClient.post('/api/v1/orchestration/transfer', transferRequest);

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
    });

    it('should handle remittance to bank transfer', async () => {
      const transferRequest = {
        sourceType: 'remittance',
        sourceProvider: 'western_union',
        mtcn: 'WU-123456',
        destinationType: 'bank',
        destinationProvider: 'access_bank',
        destinationAccount: '0123456789',
        amount: 250000,
        reference: `REM-BANK-${Date.now()}`,
      };

      const response = await apiClient.post('/api/v1/orchestration/transfer', transferRequest);

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
    });
  });

  describe('Multi-Step Transactions', () => {
    it('should process payment and split to multiple accounts', async () => {
      const splitRequest = {
        paymentProvider: 'paystack',
        paymentReference: 'PSK-123456',
        totalAmount: 150000,
        splits: [
          {
            type: 'bank',
            provider: 'gtbank',
            account: '0111111111',
            amount: 100000,
          },
          {
            type: 'neobank',
            provider: 'kuda',
            account: '2222222222',
            amount: 50000,
          },
        ],
      };

      const response = await apiClient.post('/api/v1/orchestration/split-payment', splitRequest);

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        success: true,
        completedSplits: 2,
        totalAmount: 150000,
      });
    });
  });

  describe('Balance Aggregation', () => {
    it('should get unified balance across platforms', async () => {
      const balanceRequest = {
        userId: 'USER-001',
        accounts: [
          { type: 'bank', provider: 'gtbank', account: '0123456789' },
          { type: 'neobank', provider: 'kuda', account: '1234567890' },
          { type: 'payment', provider: 'flutterwave', account: 'FLW-WALLET-123' },
        ],
      };

      const response = await apiClient.post('/api/v1/orchestration/balance/aggregate', balanceRequest);

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        totalBalance: expect.any(Number),
        accounts: expect.arrayContaining([
          expect.objectContaining({
            type: expect.any(String),
            provider: expect.any(String),
            balance: expect.any(Number),
          }),
        ]),
      });
    });
  });

  describe('Transaction History', () => {
    it('should get unified transaction history', async () => {
      const historyRequest = {
        userId: 'USER-001',
        startDate: '2026-01-01',
        endDate: '2026-01-31',
        platforms: ['bank', 'neobank', 'payment'],
      };

      const response = await apiClient.post('/api/v1/orchestration/transactions', historyRequest);

      expect(response.status).toBe(200);
      expect(response.data.transactions).toBeInstanceOf(Array);
      expect(response.data.transactions.length).toBeGreaterThan(0);
      
      const transaction = response.data.transactions[0];
      expect(transaction).toMatchObject({
        transactionId: expect.any(String),
        type: expect.any(String),
        amount: expect.any(Number),
        timestamp: expect.any(String),
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle source account insufficient funds', async () => {
      const transferRequest = {
        sourceType: 'neobank',
        sourceProvider: 'kuda',
        sourceAccount: 'EMPTY-ACCOUNT',
        destinationType: 'bank',
        destinationProvider: 'gtbank',
        destinationAccount: '0987654321',
        amount: 1000000,
        reference: `XFER-${Date.now()}`,
      };

      try {
        await apiClient.post('/api/v1/orchestration/transfer', transferRequest);
        expect.fail('Should have thrown error');
      } catch (error: any) {
        expect(error.response.status).toBe(400);
        expect(error.response.data.error).toContain('Insufficient funds');
      }
    });

    it('should rollback failed multi-step transaction', async () => {
      const splitRequest = {
        paymentProvider: 'paystack',
        paymentReference: 'PSK-FAIL',
        totalAmount: 150000,
        splits: [
          {
            type: 'bank',
            provider: 'gtbank',
            account: '0111111111',
            amount: 100000,
          },
          {
            type: 'neobank',
            provider: 'invalid_provider',
            account: '2222222222',
            amount: 50000,
          },
        ],
      };

      try {
        await apiClient.post('/api/v1/orchestration/split-payment', splitRequest);
        expect.fail('Should have thrown error');
      } catch (error: any) {
        expect(error.response.status).toBe(500);
        expect(error.response.data.error).toContain('Transaction rolled back');
      }
    });
  });

  describe('Performance', () => {
    it('should complete cross-platform transfer within SLA (< 5 seconds)', async () => {
      const startTime = Date.now();
      
      await apiClient.post('/api/v1/orchestration/transfer', {
        sourceType: 'neobank',
        sourceProvider: 'kuda',
        sourceAccount: '1234567890',
        destinationType: 'bank',
        destinationProvider: 'gtbank',
        destinationAccount: '0987654321',
        amount: 100000,
        reference: `XFER-SLA-${Date.now()}`,
      });

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(5000);
    });

    it('should handle concurrent transfers', async () => {
      const concurrentRequests = 5;
      const requests = Array(concurrentRequests).fill(null).map((_, index) =>
        apiClient.post('/api/v1/orchestration/transfer', {
          sourceType: 'neobank',
          sourceProvider: 'kuda',
          sourceAccount: `ACCOUNT-${index}`,
          destinationType: 'bank',
          destinationProvider: 'gtbank',
          destinationAccount: '0987654321',
          amount: 50000,
          reference: `CONCURRENT-${Date.now()}-${index}`,
        })
      );

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.data.success).toBe(true);
      });
    });
  });
});
