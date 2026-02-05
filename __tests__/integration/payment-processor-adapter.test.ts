/**
 * End-to-End Tests for Payment Processor Adapter Service
 * 
 * Tests integration with Flutterwave, Paystack, and Interswitch payment processors
 * Validates card payments, bank transfers, mobile money, USSD, QR codes, and webhooks
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import axios, { AxiosInstance } from 'axios';

// Test configuration
const PAYMENT_API_URL = process.env.PAYMENT_API_URL || 'http://localhost:8091';
const TEST_TIMEOUT = 30000; // 30 seconds

// Test data
const testCards = {
  visa: {
    number: '4187427415564246',
    cvv: '828',
    expiryMonth: '09',
    expiryYear: '32',
    pin: '3310',
  },
  mastercard: {
    number: '5531886652142950',
    cvv: '564',
    expiryMonth: '09',
    expiryYear: '32',
    pin: '3310',
  },
  verve: {
    number: '5061020000000000094',
    cvv: '123',
    expiryMonth: '12',
    expiryYear: '28',
    pin: '1234',
  },
};

describe('Payment Processor Adapter - End-to-End Tests', () => {
  let apiClient: AxiosInstance;

  beforeAll(() => {
    apiClient = axios.create({
      baseURL: PAYMENT_API_URL,
      timeout: TEST_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.PAYMENT_API_KEY || 'test-api-key',
      },
    });
  });

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const response = await apiClient.get('/health');
      
      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        status: 'healthy',
        service: 'payment-processor-adapter',
      });
    });
  });

  describe('Card Payments - Flutterwave', () => {
    it('should process Visa card payment', async () => {
      const paymentRequest = {
        amount: 150000,
        currency: 'NGN',
        email: 'customer@example.com',
        fullName: 'John Doe',
        phone: '+2348012345678',
        card: testCards.visa,
        provider: 'flutterwave',
        reference: `FLW-VISA-${Date.now()}`,
      };

      const response = await apiClient.post('/api/v1/payment/card', paymentRequest);

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        success: true,
        transactionId: expect.any(String),
        status: 'successful',
        amount: paymentRequest.amount,
        currency: 'NGN',
        provider: 'flutterwave',
      });
    });

    it('should process Mastercard payment', async () => {
      const paymentRequest = {
        amount: 75000,
        currency: 'NGN',
        email: 'customer@example.com',
        fullName: 'Jane Smith',
        phone: '+2348012345678',
        card: testCards.mastercard,
        provider: 'flutterwave',
        reference: `FLW-MC-${Date.now()}`,
      };

      const response = await apiClient.post('/api/v1/payment/card', paymentRequest);

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.status).toBe('successful');
    });

    it('should handle 3D Secure authentication', async () => {
      const paymentRequest = {
        amount: 200000,
        currency: 'NGN',
        email: 'customer@example.com',
        fullName: 'John Doe',
        phone: '+2348012345678',
        card: testCards.visa,
        provider: 'flutterwave',
        reference: `FLW-3DS-${Date.now()}`,
        require3DS: true,
      };

      const response = await apiClient.post('/api/v1/payment/card', paymentRequest);

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        success: true,
        status: 'pending_3ds',
        authUrl: expect.any(String),
        transactionId: expect.any(String),
      });
    });

    it('should handle declined card', async () => {
      const paymentRequest = {
        amount: 150000,
        currency: 'NGN',
        email: 'customer@example.com',
        fullName: 'John Doe',
        phone: '+2348012345678',
        card: {
          number: '4000000000000002', // Test card for decline
          cvv: '123',
          expiryMonth: '12',
          expiryYear: '28',
          pin: '1234',
        },
        provider: 'flutterwave',
        reference: `FLW-DECLINE-${Date.now()}`,
      };

      try {
        await apiClient.post('/api/v1/payment/card', paymentRequest);
        expect.fail('Should have thrown error');
      } catch (error: any) {
        expect(error.response.status).toBe(400);
        expect(error.response.data.error).toContain('declined');
      }
    });

    it('should handle insufficient funds', async () => {
      const paymentRequest = {
        amount: 150000,
        currency: 'NGN',
        email: 'customer@example.com',
        fullName: 'John Doe',
        phone: '+2348012345678',
        card: {
          number: '4000000000009995', // Test card for insufficient funds
          cvv: '123',
          expiryMonth: '12',
          expiryYear: '28',
          pin: '1234',
        },
        provider: 'flutterwave',
        reference: `FLW-INSUF-${Date.now()}`,
      };

      try {
        await apiClient.post('/api/v1/payment/card', paymentRequest);
        expect.fail('Should have thrown error');
      } catch (error: any) {
        expect(error.response.status).toBe(400);
        expect(error.response.data.error).toContain('Insufficient funds');
      }
    });
  });

  describe('Card Payments - Paystack', () => {
    it('should process Verve card payment', async () => {
      const paymentRequest = {
        amount: 50000,
        currency: 'NGN',
        email: 'customer@example.com',
        fullName: 'Chidi Okafor',
        phone: '+2348012345678',
        card: testCards.verve,
        provider: 'paystack',
        reference: `PSK-VERVE-${Date.now()}`,
      };

      const response = await apiClient.post('/api/v1/payment/card', paymentRequest);

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        success: true,
        status: 'successful',
        provider: 'paystack',
      });
    });

    it('should validate card before charging', async () => {
      const validationRequest = {
        cardNumber: testCards.visa.number,
        provider: 'paystack',
      };

      const response = await apiClient.post('/api/v1/payment/card/validate', validationRequest);

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        valid: true,
        cardType: 'visa',
        bank: expect.any(String),
      });
    });
  });

  describe('Bank Transfer Payments', () => {
    it('should initiate bank transfer payment', async () => {
      const transferRequest = {
        amount: 250000,
        currency: 'NGN',
        email: 'customer@example.com',
        fullName: 'Amara Nwosu',
        phone: '+2348012345678',
        provider: 'flutterwave',
        reference: `FLW-TRANSFER-${Date.now()}`,
      };

      const response = await apiClient.post('/api/v1/payment/bank-transfer', transferRequest);

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        success: true,
        status: 'pending',
        accountNumber: expect.any(String),
        bankName: expect.any(String),
        accountName: expect.any(String),
        expiresAt: expect.any(String),
      });
    });

    it('should verify bank transfer payment', async () => {
      const reference = 'FLW-TRANSFER-1234567890';
      
      const response = await apiClient.get(`/api/v1/payment/verify/${reference}`);

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        reference,
        status: expect.stringMatching(/^(pending|successful|failed)$/),
        amount: expect.any(Number),
      });
    });
  });

  describe('Mobile Money Payments', () => {
    it('should process M-Pesa payment', async () => {
      const mobileMoneyRequest = {
        amount: 100000,
        currency: 'KES',
        phoneNumber: '+254712345678',
        provider: 'flutterwave',
        network: 'mpesa',
        reference: `FLW-MPESA-${Date.now()}`,
      };

      const response = await apiClient.post('/api/v1/payment/mobile-money', mobileMoneyRequest);

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        success: true,
        status: 'pending',
        transactionId: expect.any(String),
        message: expect.stringContaining('STK push sent'),
      });
    });

    it('should process MTN Mobile Money payment', async () => {
      const mobileMoneyRequest = {
        amount: 50000,
        currency: 'NGN',
        phoneNumber: '+2348012345678',
        provider: 'flutterwave',
        network: 'mtn',
        reference: `FLW-MTN-${Date.now()}`,
      };

      const response = await apiClient.post('/api/v1/payment/mobile-money', mobileMoneyRequest);

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.status).toBe('pending');
    });

    it('should process Airtel Money payment', async () => {
      const mobileMoneyRequest = {
        amount: 75000,
        currency: 'NGN',
        phoneNumber: '+2348012345678',
        provider: 'flutterwave',
        network: 'airtel',
        reference: `FLW-AIRTEL-${Date.now()}`,
      };

      const response = await apiClient.post('/api/v1/payment/mobile-money', mobileMoneyRequest);

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
    });
  });

  describe('USSD Payments', () => {
    it('should initiate USSD payment', async () => {
      const ussdRequest = {
        amount: 50000,
        currency: 'NGN',
        accountNumber: '0123456789',
        bank: 'gtbank',
        provider: 'paystack',
        reference: `PSK-USSD-${Date.now()}`,
      };

      const response = await apiClient.post('/api/v1/payment/ussd', ussdRequest);

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        success: true,
        status: 'pending',
        ussdCode: expect.any(String),
        instructions: expect.any(String),
      });
    });
  });

  describe('QR Code Payments', () => {
    it('should generate QR code for payment', async () => {
      const qrRequest = {
        amount: 25000,
        currency: 'NGN',
        merchantId: 'MERCHANT-001',
        provider: 'paystack',
        reference: `PSK-QR-${Date.now()}`,
      };

      const response = await apiClient.post('/api/v1/payment/qr/generate', qrRequest);

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        success: true,
        qrCode: expect.any(String), // Base64 encoded image
        qrData: expect.any(String), // QR code data string
        expiresAt: expect.any(String),
      });
    });

    it('should process QR code payment', async () => {
      const qrPaymentRequest = {
        qrData: 'QR-DATA-STRING',
        customerId: 'CUST-001',
        provider: 'paystack',
      };

      const response = await apiClient.post('/api/v1/payment/qr/pay', qrPaymentRequest);

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        success: true,
        status: 'successful',
        transactionId: expect.any(String),
      });
    });
  });

  describe('Refunds and Chargebacks', () => {
    it('should process full refund', async () => {
      const refundRequest = {
        transactionId: 'TXN-123456',
        amount: 150000,
        reason: 'Customer request',
        provider: 'flutterwave',
      };

      const response = await apiClient.post('/api/v1/payment/refund', refundRequest);

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        success: true,
        refundId: expect.any(String),
        status: 'pending',
        amount: refundRequest.amount,
      });
    });

    it('should process partial refund', async () => {
      const refundRequest = {
        transactionId: 'TXN-123456',
        amount: 50000, // Original: ₦150,000
        reason: 'Partial refund',
        provider: 'flutterwave',
      };

      const response = await apiClient.post('/api/v1/payment/refund', refundRequest);

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.amount).toBe(50000);
    });

    it('should handle chargeback notification', async () => {
      const chargebackWebhook = {
        event: 'charge.chargeback',
        transactionId: 'TXN-123456',
        amount: 150000,
        reason: 'Fraudulent transaction',
        chargebackId: 'CB-123',
        provider: 'flutterwave',
      };

      const response = await apiClient.post('/api/v1/webhooks/payment', chargebackWebhook);

      expect(response.status).toBe(200);
      expect(response.data.received).toBe(true);
    });
  });

  describe('Fraud Detection', () => {
    it('should calculate fraud score', async () => {
      const fraudCheckRequest = {
        amount: 500000,
        email: 'suspicious@example.com',
        phone: '+2348012345678',
        ipAddress: '192.168.1.1',
        cardBin: '418742',
        provider: 'flutterwave',
      };

      const response = await apiClient.post('/api/v1/payment/fraud-check', fraudCheckRequest);

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        fraudScore: expect.any(Number),
        riskLevel: expect.stringMatching(/^(low|medium|high)$/),
        recommendation: expect.stringMatching(/^(approve|review|decline)$/),
      });
      expect(response.data.fraudScore).toBeGreaterThanOrEqual(0);
      expect(response.data.fraudScore).toBeLessThanOrEqual(100);
    });

    it('should block high-risk transaction', async () => {
      const paymentRequest = {
        amount: 1000000,
        currency: 'NGN',
        email: 'fraud@example.com',
        fullName: 'Suspicious User',
        phone: '+2348012345678',
        card: testCards.visa,
        provider: 'flutterwave',
        reference: `FLW-FRAUD-${Date.now()}`,
        simulateHighRisk: true, // Test flag
      };

      try {
        await apiClient.post('/api/v1/payment/card', paymentRequest);
        expect.fail('Should have thrown error');
      } catch (error: any) {
        expect(error.response.status).toBe(403);
        expect(error.response.data.error).toContain('High fraud risk');
      }
    });
  });

  describe('Payment Links', () => {
    it('should create payment link', async () => {
      const linkRequest = {
        amount: 100000,
        currency: 'NGN',
        description: 'School fees payment',
        merchantId: 'MERCHANT-001',
        provider: 'paystack',
        reference: `PSK-LINK-${Date.now()}`,
        expiresIn: 86400, // 24 hours
      };

      const response = await apiClient.post('/api/v1/payment/link/create', linkRequest);

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        success: true,
        paymentLink: expect.any(String),
        linkId: expect.any(String),
        expiresAt: expect.any(String),
      });
      expect(response.data.paymentLink).toMatch(/^https?:\/\//);
    });

    it('should retrieve payment link status', async () => {
      const linkId = 'LINK-123456';
      
      const response = await apiClient.get(`/api/v1/payment/link/${linkId}`);

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        linkId,
        status: expect.stringMatching(/^(active|expired|paid)$/),
        amount: expect.any(Number),
      });
    });
  });

  describe('Recurring Payments', () => {
    it('should create subscription', async () => {
      const subscriptionRequest = {
        amount: 50000,
        currency: 'NGN',
        interval: 'monthly',
        customerId: 'CUST-001',
        email: 'customer@example.com',
        card: testCards.visa,
        provider: 'paystack',
        planName: 'Premium Subscription',
      };

      const response = await apiClient.post('/api/v1/payment/subscription/create', subscriptionRequest);

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        success: true,
        subscriptionId: expect.any(String),
        status: 'active',
        nextChargeDate: expect.any(String),
      });
    });

    it('should cancel subscription', async () => {
      const cancelRequest = {
        subscriptionId: 'SUB-123456',
        reason: 'Customer request',
        provider: 'paystack',
      };

      const response = await apiClient.post('/api/v1/payment/subscription/cancel', cancelRequest);

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        success: true,
        subscriptionId: cancelRequest.subscriptionId,
        status: 'cancelled',
      });
    });
  });

  describe('Webhooks', () => {
    it('should handle successful payment webhook', async () => {
      const webhook = {
        event: 'charge.success',
        data: {
          id: 'TXN-123456',
          amount: 150000,
          currency: 'NGN',
          customer: {
            email: 'customer@example.com',
          },
          status: 'successful',
        },
      };

      const response = await apiClient.post('/api/v1/webhooks/flutterwave', webhook, {
        headers: {
          'verif-hash': 'test-hash',
        },
      });

      expect(response.status).toBe(200);
      expect(response.data.received).toBe(true);
    });

    it('should handle failed payment webhook', async () => {
      const webhook = {
        event: 'charge.failed',
        data: {
          id: 'TXN-123456',
          amount: 150000,
          currency: 'NGN',
          status: 'failed',
          failureReason: 'Insufficient funds',
        },
      };

      const response = await apiClient.post('/api/v1/webhooks/paystack', webhook);

      expect(response.status).toBe(200);
      expect(response.data.received).toBe(true);
    });

    it('should verify webhook signature', async () => {
      const webhook = {
        event: 'charge.success',
        data: { id: 'TXN-123456' },
      };

      const invalidSignature = 'invalid-signature';

      try {
        await apiClient.post('/api/v1/webhooks/flutterwave', webhook, {
          headers: {
            'verif-hash': invalidSignature,
          },
        });
        expect.fail('Should have thrown error');
      } catch (error: any) {
        expect(error.response.status).toBe(401);
        expect(error.response.data.error).toContain('Invalid signature');
      }
    });
  });

  describe('Performance and Load', () => {
    it('should handle concurrent card payments', async () => {
      const concurrentRequests = 10;
      const requests = Array(concurrentRequests).fill(null).map((_, index) =>
        apiClient.post('/api/v1/payment/card', {
          amount: 50000,
          currency: 'NGN',
          email: `customer${index}@example.com`,
          fullName: `Customer ${index}`,
          phone: '+2348012345678',
          card: testCards.visa,
          provider: 'flutterwave',
          reference: `FLW-CONCURRENT-${Date.now()}-${index}`,
        })
      );

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.data.success).toBe(true);
      });
    });

    it('should complete payment within SLA (< 3 seconds)', async () => {
      const startTime = Date.now();
      
      await apiClient.post('/api/v1/payment/card', {
        amount: 50000,
        currency: 'NGN',
        email: 'customer@example.com',
        fullName: 'John Doe',
        phone: '+2348012345678',
        card: testCards.visa,
        provider: 'flutterwave',
        reference: `FLW-SLA-${Date.now()}`,
      });

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(3000);
    });
  });
});

describe('Payment Processor Adapter - Integration Scenarios', () => {
  let apiClient: AxiosInstance;

  beforeAll(() => {
    apiClient = axios.create({
      baseURL: PAYMENT_API_URL,
      timeout: TEST_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.PAYMENT_API_KEY || 'test-api-key',
      },
    });
  });

  describe('School Fees Payment Scenario', () => {
    it('should process school fees card payment end-to-end', async () => {
      const schoolFeesAmount = 150000;
      
      // Step 1: Calculate fees
      const feeResponse = await apiClient.post('/api/v1/payment/calculate-fee', {
        amount: schoolFeesAmount,
        provider: 'flutterwave',
        method: 'card',
      });
      expect(feeResponse.data.platformFee).toBe(750); // ₦750 platform fee
      expect(feeResponse.data.processorFee).toBeGreaterThan(0);

      // Step 2: Process payment
      const paymentResponse = await apiClient.post('/api/v1/payment/card', {
        amount: schoolFeesAmount,
        currency: 'NGN',
        email: 'parent@example.com',
        fullName: 'Parent Name',
        phone: '+2348012345678',
        card: testCards.visa,
        provider: 'flutterwave',
        reference: `SCHOOL-FEES-${Date.now()}`,
        metadata: {
          type: 'school_fees',
          schoolId: 'SCHOOL-001',
          studentId: 'STUDENT-001',
          term: 'Term 1 2026',
        },
      });
      expect(paymentResponse.data.success).toBe(true);
      expect(paymentResponse.data.status).toBe('successful');

      // Step 3: Verify transaction
      const verifyResponse = await apiClient.get(`/api/v1/payment/verify/${paymentResponse.data.reference}`);
      expect(verifyResponse.data.status).toBe('successful');
      expect(verifyResponse.data.amount).toBe(schoolFeesAmount);
    });
  });

  describe('Bill Payment Scenario', () => {
    it('should process electricity bill payment', async () => {
      const billPaymentResponse = await apiClient.post('/api/v1/payment/card', {
        amount: 25000,
        currency: 'NGN',
        email: 'customer@example.com',
        fullName: 'Customer Name',
        phone: '+2348012345678',
        card: testCards.mastercard,
        provider: 'paystack',
        reference: `ELEC-BILL-${Date.now()}`,
        metadata: {
          type: 'bill_payment',
          billType: 'electricity',
          meterNumber: '12345678901',
          disco: 'EKEDC',
        },
      });

      expect(billPaymentResponse.data.success).toBe(true);
      expect(billPaymentResponse.data.status).toBe('successful');
    });
  });

  describe('Loan Repayment Scenario', () => {
    it('should process loan repayment via direct debit', async () => {
      const loanRepaymentResponse = await apiClient.post('/api/v1/payment/card', {
        amount: 50000,
        currency: 'NGN',
        email: 'borrower@example.com',
        fullName: 'Borrower Name',
        phone: '+2348012345678',
        card: testCards.visa,
        provider: 'flutterwave',
        reference: `LOAN-REPAY-${Date.now()}`,
        metadata: {
          type: 'loan_repayment',
          loanId: 'LOAN-001',
          installmentNumber: 3,
        },
      });

      expect(loanRepaymentResponse.data.success).toBe(true);
      expect(loanRepaymentResponse.data.status).toBe('successful');
    });
  });
});
