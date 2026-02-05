/**
 * End-to-End Tests for Agent Banking Adapter Service
 * 
 * Tests integration with Paga, OPay, and Kudi agent banking networks
 * Validates cash-in, cash-out, bill payments, agent management, and commissions
 */

import { describe, it, expect, beforeAll } from 'vitest';
import axios, { AxiosInstance } from 'axios';

const AGENT_API_URL = process.env.AGENT_API_URL || 'http://localhost:8092';
const TEST_TIMEOUT = 30000;

describe('Agent Banking Adapter - End-to-End Tests', () => {
  let apiClient: AxiosInstance;

  beforeAll(() => {
    apiClient = axios.create({
      baseURL: AGENT_API_URL,
      timeout: TEST_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.AGENT_API_KEY || 'test-api-key',
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

  describe('Cash-In Transactions', () => {
    it('should process cash-in at Paga agent', async () => {
      const cashInRequest = {
        agentId: 'PG-12345',
        customerId: 'CUST-001',
        amount: 50000,
        reference: `CASHIN-${Date.now()}`,
        provider: 'paga',
      };

      const response = await apiClient.post('/api/v1/agent/cash-in', cashInRequest);

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        success: true,
        transactionId: expect.any(String),
        amount: 50000,
        agentCommission: 200,
        platformFee: 50,
      });
    });

    it('should process cash-in at OPay agent', async () => {
      const cashInRequest = {
        agentId: 'OP-67890',
        customerId: 'CUST-002',
        amount: 100000,
        reference: `CASHIN-${Date.now()}`,
        provider: 'opay',
      };

      const response = await apiClient.post('/api/v1/agent/cash-in', cashInRequest);

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.agentCommission).toBe(400);
    });

    it('should validate agent float before cash-in', async () => {
      const floatCheckRequest = {
        agentId: 'PG-12345',
        amount: 50000,
        provider: 'paga',
      };

      const response = await apiClient.post('/api/v1/agent/check-float', floatCheckRequest);

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        sufficient: expect.any(Boolean),
        availableFloat: expect.any(Number),
      });
    });
  });

  describe('Cash-Out Transactions', () => {
    it('should process cash-out at agent', async () => {
      const cashOutRequest = {
        agentId: 'PG-12345',
        customerId: 'CUST-001',
        amount: 30000,
        reference: `CASHOUT-${Date.now()}`,
        provider: 'paga',
      };

      const response = await apiClient.post('/api/v1/agent/cash-out', cashOutRequest);

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        success: true,
        transactionId: expect.any(String),
        amount: 30000,
        agentCommission: 150,
      });
    });

    it('should handle insufficient customer balance', async () => {
      const cashOutRequest = {
        agentId: 'PG-12345',
        customerId: 'CUST-EMPTY',
        amount: 1000000,
        reference: `CASHOUT-${Date.now()}`,
        provider: 'paga',
      };

      try {
        await apiClient.post('/api/v1/agent/cash-out', cashOutRequest);
        expect.fail('Should have thrown error');
      } catch (error: any) {
        expect(error.response.status).toBe(400);
        expect(error.response.data.error).toContain('Insufficient balance');
      }
    });
  });

  describe('Bill Payments via Agents', () => {
    it('should process electricity bill payment', async () => {
      const billPaymentRequest = {
        agentId: 'PG-12345',
        customerId: 'CUST-001',
        billType: 'electricity',
        meterNumber: '12345678901',
        amount: 25000,
        provider: 'paga',
        reference: `BILL-${Date.now()}`,
      };

      const response = await apiClient.post('/api/v1/agent/bill-payment', billPaymentRequest);

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        success: true,
        transactionId: expect.any(String),
        agentCommission: 100,
      });
    });
  });

  describe('Agent Location Services', () => {
    it('should find nearest agents by GPS coordinates', async () => {
      const locationRequest = {
        latitude: 6.5244,
        longitude: 3.3792,
        radius: 5,
        provider: 'paga',
      };

      const response = await apiClient.post('/api/v1/agent/locate', locationRequest);

      expect(response.status).toBe(200);
      expect(response.data.agents).toBeInstanceOf(Array);
      expect(response.data.agents.length).toBeGreaterThan(0);
      
      const agent = response.data.agents[0];
      expect(agent).toMatchObject({
        agentId: expect.any(String),
        name: expect.any(String),
        address: expect.any(String),
        distance: expect.any(Number),
        available: expect.any(Boolean),
      });
    });
  });

  describe('Commission Calculations', () => {
    it('should calculate correct commission for cash-in', async () => {
      const commissionRequest = {
        transactionType: 'cash-in',
        amount: 50000,
        provider: 'paga',
      };

      const response = await apiClient.post('/api/v1/agent/calculate-commission', commissionRequest);

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        agentCommission: 200,
        platformFee: 50,
        totalFee: 250,
      });
    });
  });

  describe('Remittance Payouts', () => {
    it('should process remittance payout at agent', async () => {
      const payoutRequest = {
        agentId: 'PG-12345',
        recipientId: 'RECIP-001',
        amount: 150000,
        remittanceId: 'REM-123456',
        provider: 'paga',
        reference: `PAYOUT-${Date.now()}`,
      };

      const response = await apiClient.post('/api/v1/agent/remittance-payout', payoutRequest);

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        success: true,
        transactionId: expect.any(String),
        amount: 150000,
        agentCommission: 600,
      });
    });
  });

  describe('Performance', () => {
    it('should complete cash-in within SLA (< 2 seconds)', async () => {
      const startTime = Date.now();
      
      await apiClient.post('/api/v1/agent/cash-in', {
        agentId: 'PG-12345',
        customerId: 'CUST-001',
        amount: 50000,
        reference: `CASHIN-SLA-${Date.now()}`,
        provider: 'paga',
      });

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(2000);
    });
  });
});
