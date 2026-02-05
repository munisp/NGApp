import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getDb } from '../db';
import { 
  bnplApplications, 
  bnplInstallments,
  creditScores,
  creditScoreHistory,
  creditScoreFactors,
  bankConnections,
  linkedBankAccounts,
  bankTransactions,
  apiKeys,
  apiUsageLogs
} from '../../drizzle/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

describe('Database CRUD Operations', () => {
  let db: Awaited<ReturnType<typeof getDb>>;
  const testUserId = 'test-user-' + Date.now();

  beforeAll(async () => {
    db = await getDb();
    if (!db) {
      throw new Error('Database connection failed');
    }
  });

  describe('BNPL Operations', () => {
    const applicationId = crypto.randomUUID();
    
    it('should create a BNPL application', async () => {
      const application = {
        id: applicationId,
        userId: testUserId,
        studentName: 'Test Student',
        schoolName: 'Test School',
        grade: 'Grade 10',
        schoolFeesAmount: '1000.00',
        totalAmount: '1050.00',
        installmentPlan: 4,
        monthlyPayment: '262.50',
        employmentStatus: 'Employed',
        monthlyIncome: '5000.00',
        documents: {
          id: 'doc-123',
          proofOfIncome: 'income-proof.pdf',
          studentId: 'student-id.pdf',
        },
        status: 'pending' as const,
        rejectionReason: null,
        approvedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await db!.insert(bnplApplications).values(application);
      
      const result = await db!.select().from(bnplApplications).where(eq(bnplApplications.id, applicationId));
      expect(result).toHaveLength(1);
      expect(result[0].studentName).toBe('Test Student');
      expect(result[0].schoolFeesAmount).toBe('1000.00');
    });

    it('should update BNPL application status', async () => {
      await db!.update(bnplApplications)
        .set({ status: 'approved', approvedAt: new Date() })
        .where(eq(bnplApplications.id, applicationId));

      const result = await db!.select().from(bnplApplications).where(eq(bnplApplications.id, applicationId));
      expect(result[0].status).toBe('approved');
      expect(result[0].approvedAt).not.toBeNull();
    });

    it('should create BNPL installments', async () => {
      const installment = {
        id: crypto.randomUUID(),
        applicationId,
        installmentNumber: 1,
        amount: '262.50',
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: 'pending' as const,
        paidAt: null,
        paidAmount: null,
        createdAt: new Date(),
      };

      await db!.insert(bnplInstallments).values(installment);
      
      const result = await db!.select().from(bnplInstallments).where(eq(bnplInstallments.applicationId, applicationId));
      expect(result).toHaveLength(1);
      expect(result[0].amount).toBe('262.50');
    });

    it('should delete BNPL application and installments', async () => {
      await db!.delete(bnplInstallments).where(eq(bnplInstallments.applicationId, applicationId));
      await db!.delete(bnplApplications).where(eq(bnplApplications.id, applicationId));
      
      const result = await db!.select().from(bnplApplications).where(eq(bnplApplications.id, applicationId));
      expect(result).toHaveLength(0);
    });
  });

  describe('Credit Score Operations', () => {
    const scoreId = crypto.randomUUID();
    
    it('should create a credit score', async () => {
      const score = {
        id: scoreId,
        userId: testUserId,
        score: 750,
        grade: 'good' as const,
        lastCalculated: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await db!.insert(creditScores).values(score);
      
      const result = await db!.select().from(creditScores).where(eq(creditScores.id, scoreId));
      expect(result).toHaveLength(1);
      expect(result[0].score).toBe(750);
    });

    it('should create credit score history', async () => {
      const history = {
        id: crypto.randomUUID(),
        userId: testUserId,
        score: 750,
        grade: 'good' as const,
        calculatedAt: new Date(),
        createdAt: new Date(),
      };

      await db!.insert(creditScoreHistory).values(history);
      
      const result = await db!.select().from(creditScoreHistory).where(eq(creditScoreHistory.userId, testUserId));
      expect(result.length).toBeGreaterThan(0);
    });

    it('should create credit score factors', async () => {
      const factor = {
        id: crypto.randomUUID(),
        userId: testUserId,
        factorType: 'payment_history',
        impact: 'positive' as const,
        weight: '0.35',
        value: '85.00',
        description: 'Good payment history',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await db!.insert(creditScoreFactors).values(factor);
      
      const result = await db!.select().from(creditScoreFactors).where(eq(creditScoreFactors.userId, testUserId));
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].factorType).toBe('payment_history');
    });

    it('should delete credit score and related data', async () => {
      await db!.delete(creditScoreFactors).where(eq(creditScoreFactors.userId, testUserId));
      await db!.delete(creditScoreHistory).where(eq(creditScoreHistory.userId, testUserId));
      await db!.delete(creditScores).where(eq(creditScores.id, scoreId));
      
      const result = await db!.select().from(creditScores).where(eq(creditScores.id, scoreId));
      expect(result).toHaveLength(0);
    });
  });

  describe('Open Banking Operations', () => {
    const connectionId = crypto.randomUUID();
    const accountId = crypto.randomUUID();
    
    it('should create a bank connection', async () => {
      const connection = {
        id: connectionId,
        userId: testUserId,
        bankCode: '058',
        bankName: 'GTBank',
        status: 'pending' as const,
        consentId: 'consent-123',
        consentExpiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSyncedAt: null,
        sessionId: 'session-123',
      };

      await db!.insert(bankConnections).values(connection);
      
      const result = await db!.select().from(bankConnections).where(eq(bankConnections.id, connectionId));
      expect(result).toHaveLength(1);
      expect(result[0].bankName).toBe('GTBank');
    });

    it('should create a linked bank account', async () => {
      const account = {
        id: accountId,
        userId: testUserId,
        bankCode: '058',
        bankName: 'GTBank',
        accountNumber: '1234567890',
        accountName: 'Test Account',
        accountType: 'savings',
        balance: '50000.00',
        currency: 'NGN',
        status: 'active' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await db!.insert(linkedBankAccounts).values(account);
      
      const result = await db!.select().from(linkedBankAccounts).where(eq(linkedBankAccounts.id, accountId));
      expect(result).toHaveLength(1);
      expect(result[0].balance).toBe('50000.00');
    });

    it('should create bank transactions', async () => {
      const transaction = {
        id: crypto.randomUUID(),
        userId: testUserId,
        accountId,
        transactionId: 'TXN-' + crypto.randomUUID(),
        type: 'debit' as const,
        amount: '5000.00',
        currency: 'NGN',
        description: 'Test transaction',
        category: 'shopping',
        balance: '45000.00',
        transactionDate: new Date(),
        createdAt: new Date(),
      };

      await db!.insert(bankTransactions).values(transaction);
      
      const result = await db!.select().from(bankTransactions).where(eq(bankTransactions.accountId, accountId));
      expect(result).toHaveLength(1);
      expect(result[0].amount).toBe('5000.00');
    });

    it('should delete bank data', async () => {
      await db!.delete(bankTransactions).where(eq(bankTransactions.accountId, accountId));
      await db!.delete(linkedBankAccounts).where(eq(linkedBankAccounts.id, accountId));
      await db!.delete(bankConnections).where(eq(bankConnections.id, connectionId));
      
      const result = await db!.select().from(bankConnections).where(eq(bankConnections.id, connectionId));
      expect(result).toHaveLength(0);
    });
  });

  describe('Developer Portal Operations', () => {
    const keyId = crypto.randomUUID();
    
    it('should create an API key', async () => {
      const apiKey = {
        id: keyId,
        userId: testUserId,
        name: 'Test API Key',
        keyValue: 'test-key-' + crypto.randomUUID(),
        secretValue: 'test-secret-' + crypto.randomUUID(),
        environment: 'development' as const,
        permissions: 'read,write',
        status: 'active' as const,
        requestCount: '0',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastUsedAt: null,
      };

      await db!.insert(apiKeys).values(apiKey);
      
      const result = await db!.select().from(apiKeys).where(eq(apiKeys.id, keyId));
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Test API Key');
    });

    it('should create API usage logs', async () => {
      const log = {
        id: crypto.randomUUID(),
        apiKeyId: keyId,
        endpoint: '/api/v1/test',
        method: 'GET',
        statusCode: 200,
        responseTime: '150',
        timestamp: new Date(),
        cost: '0.01',
        createdAt: new Date(),
      };

      await db!.insert(apiUsageLogs).values(log);
      
      const result = await db!.select().from(apiUsageLogs).where(eq(apiUsageLogs.apiKeyId, keyId));
      expect(result).toHaveLength(1);
      expect(result[0].endpoint).toBe('/api/v1/test');
    });

    it('should delete API key and logs', async () => {
      await db!.delete(apiUsageLogs).where(eq(apiUsageLogs.apiKeyId, keyId));
      await db!.delete(apiKeys).where(eq(apiKeys.id, keyId));
      
      const result = await db!.select().from(apiKeys).where(eq(apiKeys.id, keyId));
      expect(result).toHaveLength(0);
    });
  });
});
