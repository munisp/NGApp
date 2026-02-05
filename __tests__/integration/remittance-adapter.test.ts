/**
 * End-to-End Tests for Remittance Adapter Service
 * 
 * Tests integration with Western Union, MoneyGram, and WorldRemit
 * Validates international transfers, payouts, exchange rates, and compliance
 */

import { describe, it, expect, beforeAll } from 'vitest';
import axios, { AxiosInstance } from 'axios';

const REMITTANCE_API_URL = process.env.REMITTANCE_API_URL || 'http://localhost:8093';
const TEST_TIMEOUT = 30000;

describe('Remittance Adapter - End-to-End Tests', () => {
  let apiClient: AxiosInstance;

  beforeAll(() => {
    apiClient = axios.create({
      baseURL: REMITTANCE_API_URL,
      timeout: TEST_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.REMITTANCE_API_KEY || 'test-api-key',
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

  describe('Send Money - Western Union', () => {
    it('should initiate remittance transfer', async () => {
      const transferRequest = {
        senderName: 'John Doe',
        senderCountry: 'US',
        senderPhone: '+12025551234',
        recipientName: 'Jane Smith',
        recipientCountry: 'NG',
        recipientPhone: '+2348012345678',
        amount: 500,
        sourceCurrency: 'USD',
        destinationCurrency: 'NGN',
        provider: 'western_union',
        reference: `WU-${Date.now()}`,
      };

      const response = await apiClient.post('/api/v1/remittance/send', transferRequest);

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        success: true,
        mtcn: expect.any(String),
        exchangeRate: expect.any(Number),
        recipientAmount: expect.any(Number),
        fee: expect.any(Number),
      });
    });

    it('should calculate exchange rate and fees', async () => {
      const quoteRequest = {
        amount: 500,
        sourceCurrency: 'USD',
        destinationCurrency: 'NGN',
        provider: 'western_union',
      };

      const response = await apiClient.post('/api/v1/remittance/quote', quoteRequest);

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        exchangeRate: expect.any(Number),
        recipientAmount: expect.any(Number),
        fee: expect.any(Number),
        totalCost: expect.any(Number),
      });
    });
  });

  describe('Receive Money - MoneyGram', () => {
    it('should process payout', async () => {
      const payoutRequest = {
        referenceNumber: 'MG-12345678',
        recipientId: 'RECIP-001',
        recipientName: 'Jane Smith',
        amount: 250000,
        currency: 'NGN',
        provider: 'moneygram',
      };

      const response = await apiClient.post('/api/v1/remittance/payout', payoutRequest);

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        success: true,
        transactionId: expect.any(String),
        amount: 250000,
        platformFee: 1250,
      });
    });
  });

  describe('WorldRemit Integration', () => {
    it('should send money to mobile wallet', async () => {
      const mobileTransferRequest = {
        senderName: 'John Doe',
        senderCountry: 'UK',
        recipientName: 'Jane Smith',
        recipientPhone: '+254712345678',
        recipientCountry: 'KE',
        amount: 100,
        sourceCurrency: 'GBP',
        destinationCurrency: 'KES',
        payoutMethod: 'mobile_wallet',
        provider: 'worldremit',
        reference: `WR-${Date.now()}`,
      };

      const response = await apiClient.post('/api/v1/remittance/send', mobileTransferRequest);

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        success: true,
        transactionId: expect.any(String),
        status: 'completed',
      });
    });
  });

  describe('Compliance and KYC', () => {
    it('should validate sender KYC', async () => {
      const kycRequest = {
        name: 'John Doe',
        dateOfBirth: '1985-05-15',
        idType: 'passport',
        idNumber: 'AB1234567',
        country: 'US',
      };

      const response = await apiClient.post('/api/v1/remittance/kyc/validate', kycRequest);

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        valid: true,
        riskLevel: expect.stringMatching(/^(low|medium|high)$/),
      });
    });

    it('should check sanctions list', async () => {
      const sanctionsRequest = {
        name: 'John Doe',
        country: 'US',
      };

      const response = await apiClient.post('/api/v1/remittance/sanctions-check', sanctionsRequest);

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        clear: expect.any(Boolean),
        matches: expect.any(Array),
      });
    });
  });

  describe('Performance', () => {
    it('should complete transfer within SLA (< 5 seconds)', async () => {
      const startTime = Date.now();
      
      await apiClient.post('/api/v1/remittance/send', {
        senderName: 'John Doe',
        senderCountry: 'US',
        recipientName: 'Jane Smith',
        recipientCountry: 'NG',
        amount: 500,
        sourceCurrency: 'USD',
        destinationCurrency: 'NGN',
        provider: 'western_union',
        reference: `WU-SLA-${Date.now()}`,
      });

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(5000);
    });
  });
});
