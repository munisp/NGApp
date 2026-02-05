import { z } from 'zod';
import { router, protectedProcedure } from '../_core/trpc';
import { getDb } from '../db';
import { bankConnections, linkedBankAccounts, bankTransactions } from '../../drizzle/schema';
import { eq, desc, and, gte, lte } from 'drizzle-orm';
import { getBankIntegration, getRegisteredBankCodes, getAllBankIntegrations } from '../integrations/banks/index';
import { deliverWebhookEvent, WebhookEvents } from '../services/webhook-delivery';

// Supported banks with their codes
const supportedBanks = [
  { id: 'gtbank', name: 'GTBank', logo: '🏦', color: '#FF6B00', code: '058' },
  { id: 'access', name: 'Access Bank', logo: '🏦', color: '#EF7D00', code: '044' },
  { id: 'zenith', name: 'Zenith Bank', logo: '🏦', color: '#E31E24', code: '057' },
];

export const openBankingRouter = router({
  // Get supported banks (only show banks that are actually configured)
  getSupportedBanks: protectedProcedure
    .query(async () => {
      const registeredCodes = getRegisteredBankCodes();
      return supportedBanks.filter(bank => registeredCodes.includes(bank.code));
    }),

  // Get linked accounts
  getLinkedAccounts: protectedProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) {
        throw new Error('Database not available');
      }

      const userId = ctx.user?.openId || 'anonymous';

      const accounts = await db
        .select()
        .from(linkedBankAccounts)
        .where(eq(linkedBankAccounts.userId, userId))
        .orderBy(desc(linkedBankAccounts.createdAt));

      return accounts;
    }),

  // Initiate account linking (may require OTP)
  initiateAccountLinking: protectedProcedure
    .input(z.object({
      bankCode: z.string(),
      accountNumber: z.string().min(10).max(10),
      bvn: z.string().min(11).max(11),
      phoneNumber: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error('Database not available');
      }

      const userId = ctx.user?.openId || 'anonymous';

      // Get bank integration
      const bankIntegration = getBankIntegration(input.bankCode);
      if (!bankIntegration) {
        throw new Error(`Bank ${input.bankCode} is not configured or supported`);
      }

      // Check if account already linked
      const existing = await db
        .select()
        .from(linkedBankAccounts)
        .where(
          and(
            eq(linkedBankAccounts.userId, userId),
            eq(linkedBankAccounts.accountNumber, input.accountNumber)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        throw new Error('Account already linked');
      }

      // Initiate account linking with the bank
      const result = await bankIntegration.initiateAccountLinking({
        accountNumber: input.accountNumber,
        bvn: input.bvn,
        phoneNumber: input.phoneNumber,
      });

      if (!result.success) {
        throw new Error(result.message || 'Failed to initiate account linking');
      }

      // If OTP is required, store session and return
      if (result.requiresOTP && result.sessionId) {
        // Store connection session in database
        await db.insert(bankConnections).values({
          id: `conn_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          userId,
          bankCode: input.bankCode,
          bankName: bankIntegration.getBankName(),
          status: 'pending',
          sessionId: result.sessionId,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        return {
          success: true,
          requiresOTP: true,
          sessionId: result.sessionId,
          message: 'OTP sent to your registered phone number',
        };
      }

      // If no OTP required, link account directly
      if (result.account) {
        const accountId = `acc_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        
        await db.insert(linkedBankAccounts).values({
          id: accountId,
          userId,
          bankCode: input.bankCode,
          bankName: bankIntegration.getBankName(),
          accountNumber: result.account.accountNumber,
          accountName: result.account.accountName,
          accountType: result.account.accountType,
          balance: result.account.balance,
          currency: result.account.currency,
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        return {
          success: true,
          requiresOTP: false,
          account: result.account,
          message: 'Account linked successfully',
        };
      }

      throw new Error('Unexpected response from bank');
    }),

  // Complete account linking with OTP
  completeAccountLinking: protectedProcedure
    .input(z.object({
      sessionId: z.string(),
      otp: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error('Database not available');
      }

      const userId = ctx.user?.openId || 'anonymous';

      // Find connection session
      const connections = await db
        .select()
        .from(bankConnections)
        .where(
          and(
            eq(bankConnections.userId, userId),
            eq(bankConnections.sessionId, input.sessionId),
            eq(bankConnections.status, 'pending')
          )
        )
        .limit(1);

      if (connections.length === 0) {
        throw new Error('Invalid or expired session');
      }

      const connection = connections[0];

      // Get bank integration
      const bankIntegration = getBankIntegration(connection.bankCode);
      if (!bankIntegration) {
        throw new Error('Bank integration not available');
      }

      // Complete account linking with OTP
      const result = await bankIntegration.completeAccountLinking(input.sessionId, input.otp);

      if (!result.success || !result.account) {
        throw new Error(result.message || 'OTP verification failed');
      }

      // Link account in database
      const accountId = `acc_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      await db.insert(linkedBankAccounts).values({
        id: accountId,
        userId,
        bankCode: connection.bankCode,
        bankName: connection.bankName,
        accountNumber: result.account.accountNumber,
        accountName: result.account.accountName,
        accountType: result.account.accountType,
        balance: result.account.balance,
        currency: result.account.currency,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Update connection status
      await db
        .update(bankConnections)
        .set({ status: 'active', updatedAt: new Date() })
        .where(eq(bankConnections.id, connection.id));

      return {
        success: true,
        account: result.account,
        message: 'Account linked successfully',
      };
    }),

  // Unlink bank account
  unlinkAccount: protectedProcedure
    .input(z.object({
      accountId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error('Database not available');
      }

      const userId = ctx.user?.openId || 'anonymous';

      // Verify ownership
      const accounts = await db
        .select()
        .from(linkedBankAccounts)
        .where(
          and(
            eq(linkedBankAccounts.id, input.accountId),
            eq(linkedBankAccounts.userId, userId)
          )
        )
        .limit(1);

      if (accounts.length === 0) {
        throw new Error('Account not found');
      }

      // Update status to inactive
      await db
        .update(linkedBankAccounts)
        .set({ status: 'inactive', updatedAt: new Date() })
        .where(eq(linkedBankAccounts.id, input.accountId));

      return { success: true, message: 'Account unlinked successfully' };
    }),

  // Sync account balance and transactions
  syncAccount: protectedProcedure
    .input(z.object({
      accountId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error('Database not available');
      }

      const userId = ctx.user?.openId || 'anonymous';

      // Get account details
      const accounts = await db
        .select()
        .from(linkedBankAccounts)
        .where(
          and(
            eq(linkedBankAccounts.id, input.accountId),
            eq(linkedBankAccounts.userId, userId),
            eq(linkedBankAccounts.status, 'active')
          )
        )
        .limit(1);

      if (accounts.length === 0) {
        throw new Error('Account not found or inactive');
      }

      const account = accounts[0];

      // Get bank integration
      const bankIntegration = getBankIntegration(account.bankCode);
      if (!bankIntegration) {
        throw new Error('Bank integration not available');
      }

      try {
        // Fetch updated balance
        const balanceResponse = await bankIntegration.getBalance(account.accountNumber);

        // Update account balance
        await db
          .update(linkedBankAccounts)
          .set({
            balance: balanceResponse.availableBalance,
            updatedAt: new Date(),
          })
          .where(eq(linkedBankAccounts.id, input.accountId));

        // Fetch recent transactions (last 30 days)
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);

        const transactions = await bankIntegration.getTransactions(
          account.accountNumber,
          startDate,
          endDate,
          50
        );

        // Store transactions in database
        for (const txn of transactions) {
          // Check if transaction already exists
          const existing = await db
            .select()
            .from(bankTransactions)
            .where(eq(bankTransactions.transactionId, txn.transactionId))
            .limit(1);

          if (existing.length === 0) {
            await db.insert(bankTransactions).values({
              accountId: input.accountId,
              userId,
              transactionId: txn.transactionId,
              type: txn.type,
              amount: txn.amount,
              currency: txn.currency,
              description: txn.description,
              category: txn.category || 'other',
              balance: txn.balance,
              transactionDate: txn.transactionDate,
              createdAt: new Date(),
            });

            // Fire webhook event for new transaction
            await deliverWebhookEvent(
              WebhookEvents.TRANSACTION_CREATED,
              {
                transactionId: txn.transactionId,
                accountId: input.accountId,
                type: txn.type,
                amount: txn.amount,
                currency: txn.currency,
                description: txn.description,
                category: txn.category || 'other',
                transactionDate: txn.transactionDate,
              },
              userId
            );
          }
        }

        return {
          success: true,
          balance: balanceResponse.availableBalance,
          transactionsCount: transactions.length,
          message: 'Account synced successfully',
        };
      } catch (error: any) {
        throw new Error(`Failed to sync account: ${error.message}`);
      }
    }),

  // Get transactions for an account
  getTransactions: protectedProcedure
    .input(z.object({
      accountId: z.string(),
      limit: z.number().optional().default(50),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error('Database not available');
      }

      const userId = ctx.user?.openId || 'anonymous';

      // Verify account ownership
      const accounts = await db
        .select()
        .from(linkedBankAccounts)
        .where(
          and(
            eq(linkedBankAccounts.id, input.accountId),
            eq(linkedBankAccounts.userId, userId)
          )
        )
        .limit(1);

      if (accounts.length === 0) {
        throw new Error('Account not found');
      }

      // Get transactions from database
      const transactions = await db
        .select()
        .from(bankTransactions)
        .where(eq(bankTransactions.accountId, input.accountId))
        .orderBy(desc(bankTransactions.transactionDate))
        .limit(input.limit);

      return transactions;
    }),

  // Get spending insights
  getSpendingInsights: protectedProcedure
    .input(z.object({
      accountId: z.string(),
      days: z.number().optional().default(30),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error('Database not available');
      }

      const userId = ctx.user?.openId || 'anonymous';

      // Verify account ownership
      const accounts = await db
        .select()
        .from(linkedBankAccounts)
        .where(
          and(
            eq(linkedBankAccounts.id, input.accountId),
            eq(linkedBankAccounts.userId, userId)
          )
        )
        .limit(1);

      if (accounts.length === 0) {
        throw new Error('Account not found');
      }

      // Get transactions for the specified period
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - input.days);

      const transactions = await db
        .select()
        .from(bankTransactions)
        .where(
          and(
            eq(bankTransactions.accountId, input.accountId),
            gte(bankTransactions.transactionDate, cutoffDate)
          )
        );

      // Calculate insights
      const categorySpending: Record<string, number> = {};
      let totalIncome = 0;
      let totalExpenses = 0;

      for (const txn of transactions) {
        const amount = parseFloat(txn.amount);

        if (txn.type === 'credit') {
          totalIncome += amount;
        } else {
          totalExpenses += amount;
          const category = txn.category || 'other';
          categorySpending[category] = (categorySpending[category] || 0) + amount;
        }
      }

      // Convert to array and sort by amount
      const spendingByCategory = Object.entries(categorySpending)
        .map(([category, amount]) => ({ category, amount: amount.toString() }))
        .sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount));

      return {
        totalIncome: totalIncome.toString(),
        totalExpenses: totalExpenses.toString(),
        netCashFlow: (totalIncome - totalExpenses).toString(),
        spendingByCategory,
        transactionCount: transactions.length,
      };
    }),
});
