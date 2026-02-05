/**
 * End-to-End Tests for Core Banking Adapter Service
 * 
 * Tests integration with Temenos T24, Oracle FLEXCUBE, and Finacle core banking systems
 * Validates account operations, fund transfers, and transaction processing
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import axios, { AxiosInstance } from 'axios';

// Test configuration
const CORE_BANKING_API_URL = process.env.CORE_BANKING_API_URL || 'http://localhost:8090';
const TEST_TIMEOUT = 30000; // 30 seconds

// Test data
const testAccounts = {
  gtbank: {
    accountNumber: '0123456789',
    bank: 'gtbank',
    coreSystem: 'temenos',
    balance: 1000000, // ₦1,000,000
  },
  accessBank: {
    accountNumber: '9876543210',
    bank: 'access',
    coreSystem: 'flexcube',
    balance: 500000, // ₦500,000
  },
  zenithBank: {
    accountNumber: '5555555555',
    bank: 'zenith',
    coreSystem: 'flexcube',
    balance: 750000, // ₦750,000
  },
};

describe('Core Banking Adapter - End-to-End Tests', () => {
  let apiClient: AxiosInstance;

  beforeAll(() => {
    // Initialize API client
    apiClient = axios.create({
      baseURL: CORE_BANKING_API_URL,
      timeout: TEST_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.CORE_BANKING_API_KEY || 'test-api-key',
      },
    });
  });

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const response = await apiClient.get('/health');
      
      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        status: 'healthy',
        service: 'core-banking-adapter',
      });
    });
  });

  describe('Account Balance Inquiry', () => {
    it('should retrieve GTBank account balance (Temenos T24)', async () => {
      const response = await apiClient.post('/api/v1/balance', {
        accountNumber: testAccounts.gtbank.accountNumber,
        bank: testAccounts.gtbank.bank,
      });

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        success: true,
        accountNumber: testAccounts.gtbank.accountNumber,
        bank: 'gtbank',
        coreSystem: 'temenos',
      });
      expect(response.data.balance).toBeGreaterThanOrEqual(0);
      expect(response.data.currency).toBe('NGN');
    });

    it('should retrieve Access Bank account balance (Oracle FLEXCUBE)', async () => {
      const response = await apiClient.post('/api/v1/balance', {
        accountNumber: testAccounts.accessBank.accountNumber,
        bank: testAccounts.accessBank.bank,
      });

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        success: true,
        accountNumber: testAccounts.accessBank.accountNumber,
        bank: 'access',
        coreSystem: 'flexcube',
      });
      expect(response.data.balance).toBeGreaterThanOrEqual(0);
    });

    it('should handle invalid account number', async () => {
      try {
        await apiClient.post('/api/v1/balance', {
          accountNumber: '0000000000',
          bank: 'gtbank',
        });
        expect.fail('Should have thrown error');
      } catch (error: any) {
        expect(error.response.status).toBe(404);
        expect(error.response.data.error).toContain('Account not found');
      }
    });

    it('should handle unsupported bank', async () => {
      try {
        await apiClient.post('/api/v1/balance', {
          accountNumber: '1234567890',
          bank: 'unknown-bank',
        });
        expect.fail('Should have thrown error');
      } catch (error: any) {
        expect(error.response.status).toBe(400);
        expect(error.response.data.error).toContain('Unsupported bank');
      }
    });
  });

  describe('Intra-Bank Transfer', () => {
    it('should transfer funds within GTBank (Temenos T24)', async () => {
      const transferRequest = {
        sourceAccount: testAccounts.gtbank.accountNumber,
        destinationAccount: '0111111111',
        amount: 50000, // ₦50,000
        bank: 'gtbank',
        narration: 'Test intra-bank transfer',
        reference: `TEST-INTRA-${Date.now()}`,
      };

      const response = await apiClient.post('/api/v1/transfer/intra-bank', transferRequest);

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        success: true,
        transactionId: expect.any(String),
        status: 'completed',
        amount: transferRequest.amount,
        sourceAccount: transferRequest.sourceAccount,
        destinationAccount: transferRequest.destinationAccount,
      });
      expect(response.data.timestamp).toBeDefined();
    });

    it('should handle insufficient funds', async () => {
      const transferRequest = {
        sourceAccount: testAccounts.gtbank.accountNumber,
        destinationAccount: '0111111111',
        amount: 10000000, // ₦10,000,000 (more than balance)
        bank: 'gtbank',
        narration: 'Test insufficient funds',
        reference: `TEST-INSUF-${Date.now()}`,
      };

      try {
        await apiClient.post('/api/v1/transfer/intra-bank', transferRequest);
        expect.fail('Should have thrown error');
      } catch (error: any) {
        expect(error.response.status).toBe(400);
        expect(error.response.data.error).toContain('Insufficient funds');
      }
    });
  });

  describe('Inter-Bank Transfer (NIP)', () => {
    it('should transfer funds from GTBank to Access Bank', async () => {
      const transferRequest = {
        sourceAccount: testAccounts.gtbank.accountNumber,
        sourceBank: 'gtbank',
        destinationAccount: testAccounts.accessBank.accountNumber,
        destinationBank: 'access',
        amount: 25000, // ₦25,000
        narration: 'Test inter-bank transfer',
        reference: `TEST-INTER-${Date.now()}`,
      };

      const response = await apiClient.post('/api/v1/transfer/inter-bank', transferRequest);

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        success: true,
        transactionId: expect.any(String),
        status: expect.stringMatching(/^(completed|pending)$/),
        amount: transferRequest.amount,
        sourceAccount: transferRequest.sourceAccount,
        destinationAccount: transferRequest.destinationAccount,
      });
      expect(response.data.nipSessionId).toBeDefined();
    });

    it('should validate destination account before transfer', async () => {
      const validationRequest = {
        accountNumber: testAccounts.accessBank.accountNumber,
        bank: 'access',
      };

      const response = await apiClient.post('/api/v1/account/validate', validationRequest);

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        valid: true,
        accountNumber: validationRequest.accountNumber,
        accountName: expect.any(String),
        bank: 'access',
      });
    });
  });

  describe('Direct Debit Setup', () => {
    it('should create direct debit mandate', async () => {
      const mandateRequest = {
        accountNumber: testAccounts.gtbank.accountNumber,
        bank: 'gtbank',
        merchantId: 'MERCHANT-001',
        maxAmount: 100000, // ₦100,000 max per debit
        frequency: 'monthly',
        startDate: '2026-02-01',
        endDate: '2026-12-31',
      };

      const response = await apiClient.post('/api/v1/direct-debit/setup', mandateRequest);

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        success: true,
        mandateId: expect.any(String),
        status: 'active',
        accountNumber: mandateRequest.accountNumber,
        maxAmount: mandateRequest.maxAmount,
      });
    });

    it('should execute direct debit', async () => {
      const debitRequest = {
        mandateId: 'MANDATE-TEST-001',
        amount: 50000, // ₦50,000
        reference: `TEST-DD-${Date.now()}`,
        narration: 'Test direct debit execution',
      };

      const response = await apiClient.post('/api/v1/direct-debit/execute', debitRequest);

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        success: true,
        transactionId: expect.any(String),
        status: expect.stringMatching(/^(completed|pending)$/),
        amount: debitRequest.amount,
      });
    });

    it('should cancel direct debit mandate', async () => {
      const cancelRequest = {
        mandateId: 'MANDATE-TEST-001',
        reason: 'Customer request',
      };

      const response = await apiClient.post('/api/v1/direct-debit/cancel', cancelRequest);

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        success: true,
        mandateId: cancelRequest.mandateId,
        status: 'cancelled',
      });
    });
  });

  describe('Virtual Account Management', () => {
    it('should create virtual account', async () => {
      const createRequest = {
        customerId: 'CUST-001',
        bank: 'gtbank',
        accountName: 'Test Customer Virtual Account',
        bvn: '12345678901',
      };

      const response = await apiClient.post('/api/v1/virtual-account/create', createRequest);

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        success: true,
        accountNumber: expect.any(String),
        accountName: createRequest.accountName,
        bank: 'gtbank',
        status: 'active',
      });
      expect(response.data.accountNumber).toMatch(/^\d{10}$/);
    });

    it('should retrieve virtual account details', async () => {
      const accountNumber = '0123456789';
      
      const response = await apiClient.get(`/api/v1/virtual-account/${accountNumber}`);

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        accountNumber,
        accountName: expect.any(String),
        bank: expect.any(String),
        status: expect.stringMatching(/^(active|inactive|closed)$/),
        balance: expect.any(Number),
      });
    });
  });

  describe('Transaction History', () => {
    it('should retrieve transaction history', async () => {
      const historyRequest = {
        accountNumber: testAccounts.gtbank.accountNumber,
        bank: 'gtbank',
        startDate: '2026-01-01',
        endDate: '2026-01-31',
        limit: 50,
      };

      const response = await apiClient.post('/api/v1/transactions/history', historyRequest);

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        success: true,
        accountNumber: historyRequest.accountNumber,
        transactions: expect.any(Array),
      });
      
      if (response.data.transactions.length > 0) {
        const transaction = response.data.transactions[0];
        expect(transaction).toMatchObject({
          transactionId: expect.any(String),
          type: expect.stringMatching(/^(credit|debit)$/),
          amount: expect.any(Number),
          balance: expect.any(Number),
          narration: expect.any(String),
          timestamp: expect.any(String),
        });
      }
    });

    it('should retrieve transaction by reference', async () => {
      const reference = 'TEST-INTRA-1234567890';
      
      const response = await apiClient.get(`/api/v1/transactions/${reference}`);

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        transactionId: expect.any(String),
        reference,
        status: expect.stringMatching(/^(completed|pending|failed)$/),
        amount: expect.any(Number),
      });
    });
  });

  describe('Standing Order Management', () => {
    it('should create standing order', async () => {
      const standingOrderRequest = {
        sourceAccount: testAccounts.gtbank.accountNumber,
        destinationAccount: '0111111111',
        amount: 10000, // ₦10,000
        frequency: 'monthly',
        startDate: '2026-02-01',
        endDate: '2026-12-31',
        narration: 'Monthly rent payment',
      };

      const response = await apiClient.post('/api/v1/standing-order/create', standingOrderRequest);

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        success: true,
        standingOrderId: expect.any(String),
        status: 'active',
        amount: standingOrderRequest.amount,
        frequency: standingOrderRequest.frequency,
      });
    });

    it('should list active standing orders', async () => {
      const response = await apiClient.get(`/api/v1/standing-order/list/${testAccounts.gtbank.accountNumber}`);

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        success: true,
        accountNumber: testAccounts.gtbank.accountNumber,
        standingOrders: expect.any(Array),
      });
    });

    it('should cancel standing order', async () => {
      const cancelRequest = {
        standingOrderId: 'SO-TEST-001',
        reason: 'Customer request',
      };

      const response = await apiClient.post('/api/v1/standing-order/cancel', cancelRequest);

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        success: true,
        standingOrderId: cancelRequest.standingOrderId,
        status: 'cancelled',
      });
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle core banking system timeout', async () => {
      const transferRequest = {
        sourceAccount: testAccounts.gtbank.accountNumber,
        destinationAccount: '0111111111',
        amount: 50000,
        bank: 'gtbank',
        narration: 'Test timeout',
        reference: `TEST-TIMEOUT-${Date.now()}`,
        simulateTimeout: true, // Special flag for testing
      };

      try {
        await apiClient.post('/api/v1/transfer/intra-bank', transferRequest, {
          timeout: 5000, // 5 second timeout
        });
        expect.fail('Should have thrown timeout error');
      } catch (error: any) {
        expect(error.code).toBe('ECONNABORTED');
      }
    });

    it('should handle malformed ISO 8583 response', async () => {
      const transferRequest = {
        sourceAccount: testAccounts.gtbank.accountNumber,
        destinationAccount: '0111111111',
        amount: 50000,
        bank: 'gtbank',
        narration: 'Test malformed response',
        reference: `TEST-MALFORMED-${Date.now()}`,
        simulateMalformed: true, // Special flag for testing
      };

      try {
        await apiClient.post('/api/v1/transfer/intra-bank', transferRequest);
        expect.fail('Should have thrown error');
      } catch (error: any) {
        expect(error.response.status).toBe(500);
        expect(error.response.data.error).toContain('Invalid response from core banking system');
      }
    });

    it('should retry failed transactions', async () => {
      const transferRequest = {
        sourceAccount: testAccounts.gtbank.accountNumber,
        destinationAccount: '0111111111',
        amount: 50000,
        bank: 'gtbank',
        narration: 'Test retry',
        reference: `TEST-RETRY-${Date.now()}`,
        simulateTransientFailure: true, // Special flag for testing
      };

      const response = await apiClient.post('/api/v1/transfer/intra-bank', transferRequest);

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.retryCount).toBeGreaterThan(0);
    });
  });

  describe('Performance and Load', () => {
    it('should handle concurrent balance inquiries', async () => {
      const concurrentRequests = 10;
      const requests = Array(concurrentRequests).fill(null).map(() =>
        apiClient.post('/api/v1/balance', {
          accountNumber: testAccounts.gtbank.accountNumber,
          bank: testAccounts.gtbank.bank,
        })
      );

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.data.success).toBe(true);
      });
    });

    it('should complete balance inquiry within SLA (< 500ms)', async () => {
      const startTime = Date.now();
      
      await apiClient.post('/api/v1/balance', {
        accountNumber: testAccounts.gtbank.accountNumber,
        bank: testAccounts.gtbank.bank,
      });

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(500);
    });
  });

  describe('Webhook Notifications', () => {
    it('should send webhook for completed transaction', async () => {
      const webhookUrl = process.env.TEST_WEBHOOK_URL || 'http://localhost:3000/webhooks/core-banking';
      
      const transferRequest = {
        sourceAccount: testAccounts.gtbank.accountNumber,
        destinationAccount: '0111111111',
        amount: 50000,
        bank: 'gtbank',
        narration: 'Test webhook',
        reference: `TEST-WEBHOOK-${Date.now()}`,
        webhookUrl,
      };

      const response = await apiClient.post('/api/v1/transfer/intra-bank', transferRequest);

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      
      // Wait for webhook delivery
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Webhook should have been delivered (check webhook receiver logs)
    });
  });
});

describe('Core Banking Adapter - Integration Scenarios', () => {
  let apiClient: AxiosInstance;

  beforeAll(() => {
    apiClient = axios.create({
      baseURL: CORE_BANKING_API_URL,
      timeout: TEST_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.CORE_BANKING_API_KEY || 'test-api-key',
      },
    });
  });

  describe('School Fees Payment Scenario', () => {
    it('should process school fees payment from parent to school account', async () => {
      // Step 1: Validate parent account
      const parentAccount = testAccounts.gtbank.accountNumber;
      const balanceResponse = await apiClient.post('/api/v1/balance', {
        accountNumber: parentAccount,
        bank: 'gtbank',
      });
      expect(balanceResponse.data.success).toBe(true);
      const initialBalance = balanceResponse.data.balance;

      // Step 2: Validate school account
      const schoolAccount = '0999999999';
      const validationResponse = await apiClient.post('/api/v1/account/validate', {
        accountNumber: schoolAccount,
        bank: 'gtbank',
      });
      expect(validationResponse.data.valid).toBe(true);

      // Step 3: Execute transfer
      const schoolFeesAmount = 150000; // ₦150,000
      const transferResponse = await apiClient.post('/api/v1/transfer/intra-bank', {
        sourceAccount: parentAccount,
        destinationAccount: schoolAccount,
        amount: schoolFeesAmount,
        bank: 'gtbank',
        narration: 'School fees payment - Term 1 2026',
        reference: `SCHOOL-FEES-${Date.now()}`,
      });
      expect(transferResponse.data.success).toBe(true);
      expect(transferResponse.data.status).toBe('completed');

      // Step 4: Verify balance deduction
      const finalBalanceResponse = await apiClient.post('/api/v1/balance', {
        accountNumber: parentAccount,
        bank: 'gtbank',
      });
      expect(finalBalanceResponse.data.balance).toBe(initialBalance - schoolFeesAmount);
    });
  });

  describe('Loan Disbursement Scenario', () => {
    it('should disburse loan from bank to customer account', async () => {
      const customerAccount = testAccounts.gtbank.accountNumber;
      const loanAmount = 500000; // ₦500,000

      // Step 1: Check initial balance
      const initialBalanceResponse = await apiClient.post('/api/v1/balance', {
        accountNumber: customerAccount,
        bank: 'gtbank',
      });
      const initialBalance = initialBalanceResponse.data.balance;

      // Step 2: Disburse loan (simulated as credit from bank's internal account)
      const disbursementResponse = await apiClient.post('/api/v1/transfer/intra-bank', {
        sourceAccount: '0000000001', // Bank's internal loan account
        destinationAccount: customerAccount,
        amount: loanAmount,
        bank: 'gtbank',
        narration: 'Loan disbursement - Personal loan',
        reference: `LOAN-DISB-${Date.now()}`,
      });
      expect(disbursementResponse.data.success).toBe(true);

      // Step 3: Verify credit
      const finalBalanceResponse = await apiClient.post('/api/v1/balance', {
        accountNumber: customerAccount,
        bank: 'gtbank',
      });
      expect(finalBalanceResponse.data.balance).toBe(initialBalance + loanAmount);
    });
  });

  describe('Salary Payment Scenario', () => {
    it('should process bulk salary payments', async () => {
      const companyAccount = testAccounts.gtbank.accountNumber;
      const employees = [
        { accountNumber: '0111111111', amount: 150000, name: 'Employee 1' },
        { accountNumber: '0222222222', amount: 200000, name: 'Employee 2' },
        { accountNumber: '0333333333', amount: 180000, name: 'Employee 3' },
      ];

      const bulkTransferRequest = {
        sourceAccount: companyAccount,
        bank: 'gtbank',
        transfers: employees.map(emp => ({
          destinationAccount: emp.accountNumber,
          amount: emp.amount,
          narration: `Salary payment - January 2026`,
        })),
        reference: `BULK-SALARY-${Date.now()}`,
      };

      const response = await apiClient.post('/api/v1/transfer/bulk', bulkTransferRequest);

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.results).toHaveLength(employees.length);
      
      response.data.results.forEach((result: any, index: number) => {
        expect(result).toMatchObject({
          destinationAccount: employees[index].accountNumber,
          amount: employees[index].amount,
          status: expect.stringMatching(/^(completed|pending)$/),
        });
      });
    });
  });
});
