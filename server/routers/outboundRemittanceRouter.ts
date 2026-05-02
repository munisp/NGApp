/**
 * Outbound Remittance tRPC Router
 * 
 * Server-side data filtering by participant ID from auth context.
 * Participants see ONLY their own data. Admin/CBN see all.
 */

import { z } from 'zod';
import { protectedProcedure, router } from '../_core/trpc';
import { TRPCError } from '@trpc/server';
import { eq, and, desc, count } from 'drizzle-orm';
import {
  switchParticipants,
  outboundTransfers,
  prefundAccounts,
  complianceScreenings,
  participantBilling,
} from '../../drizzle/schema';
import { getDb } from '../db';

// The db instance uses mysql2 driver but schema uses pgTable definitions.
// This is a known architectural pattern in this codebase — cast to bypass the type mismatch.
type AnyDb = { select: (...args: any[]) => any };

async function getTypedDb(): Promise<AnyDb> {
  const db = await getDb();
  if (!db) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
  }
  return db as unknown as AnyDb;
}

// Determine the user's role and participant scope from auth context
function getParticipantScope(user: { id: number; role: string }) {
  const isAdmin = user.role === 'admin' || user.role === 'cbn';
  return { isAdmin, userId: user.id, role: user.role };
}

// Shared types for frontend consumption
interface TransferRecord {
  id: number;
  transferRef: string;
  participantId: number;
  senderRef: string;
  beneficiaryName: string;
  beneficiaryAccount: string | null;
  corridor: string;
  amountNgn: string;
  amountDest: string;
  destCurrency: string;
  fxRate: string | null;
  provider: string | null;
  status: string;
  lifecycleStep: string;
  complianceResult: string | null;
  feeAmount: string | null;
  purpose: string | null;
  submittedAt: Date;
  completedAt: Date | null;
  createdAt: Date;
}

interface ParticipantRecord {
  id: number;
  userId: number;
  name: string;
  shortCode: string;
  type: string;
  cbnLicense: string | null;
  tier: string;
  status: string;
  prefundAccountId: string | null;
  dailyLimit: string | null;
  activeCorridors: number;
  webhookUrl: string | null;
  apiKeyPrefix: string | null;
  onboardedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface PrefundRecord {
  id: number;
  participantId: number;
  accountRef: string;
  currency: string;
  balance: string;
  committedBalance: string;
  availableBalance: string;
  dailyLimit: string | null;
  lastTopUp: Date | null;
  createdAt: Date;
}

interface BillingRecord {
  id: number;
  participantId: number;
  billingPeriod: string;
  subscriptionFee: string;
  transactionFees: string;
  corridorFees: string;
  fxRevShare: string;
  totalAmount: string;
  status: string;
  invoiceRef: string | null;
  dueDate: Date | null;
  createdAt: Date;
}

interface ComplianceRecord {
  id: number;
  transferId: number;
  participantId: number;
  screeningType: string;
  listChecked: string;
  matchScore: string;
  decision: string;
  matchedEntity: string | null;
  reviewedBy: number | null;
  createdAt: Date;
}

export const outboundRemittanceRouter = router({
  /**
   * Get current user's role and participant info
   */
  getMyContext: protectedProcedure.query(async ({ ctx }): Promise<{
    role: 'participant' | 'admin' | 'cbn';
    isAdmin: boolean;
    userId: number;
    participantId: number | null;
  }> => {
    const { isAdmin, role } = getParticipantScope(ctx.user);
    return {
      role: role as 'participant' | 'admin' | 'cbn',
      isAdmin,
      userId: ctx.user.id,
      participantId: isAdmin ? null : ctx.user.id,
    };
  }),

  /**
   * List transfers - filtered by participant
   */
  listTransfers: protectedProcedure
    .input(z.object({
      status: z.string().optional(),
      corridor: z.string().optional(),
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    }).optional())
    .query(async ({ ctx, input }): Promise<TransferRecord[]> => {
      const { isAdmin } = getParticipantScope(ctx.user);
      const db = await getTypedDb();

      const conditions: any[] = [];
      
      // CRITICAL: Non-admin users can only see their own transfers
      if (!isAdmin) {
        conditions.push(eq(outboundTransfers.participantId, ctx.user.id));
      }

      if (input?.status) {
        conditions.push(eq(outboundTransfers.status, input.status as any));
      }
      if (input?.corridor) {
        conditions.push(eq(outboundTransfers.corridor, input.corridor));
      }

      const transfers = await db.select()
        .from(outboundTransfers)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(outboundTransfers.submittedAt))
        .limit(input?.limit ?? 50)
        .offset(input?.offset ?? 0);

      return transfers as TransferRecord[];
    }),

  /**
   * Get prefund account(s) - participant sees own, admin sees all
   */
  getPrefundAccounts: protectedProcedure.query(async ({ ctx }): Promise<PrefundRecord[]> => {
    const { isAdmin } = getParticipantScope(ctx.user);
    const db = await getTypedDb();

    if (isAdmin) {
      const result = await db.select().from(prefundAccounts);
      return result as PrefundRecord[];
    }

    // Participant sees ONLY their own prefund account
    const result = await db.select()
      .from(prefundAccounts)
      .where(eq(prefundAccounts.participantId, ctx.user.id));
    return result as PrefundRecord[];
  }),

  /**
   * Get billing records - participant sees own, admin sees all
   */
  getBilling: protectedProcedure
    .input(z.object({
      period: z.string().optional(),
    }).optional())
    .query(async ({ ctx, input }): Promise<BillingRecord[]> => {
      const { isAdmin } = getParticipantScope(ctx.user);
      const db = await getTypedDb();

      const conditions: any[] = [];

      if (!isAdmin) {
        conditions.push(eq(participantBilling.participantId, ctx.user.id));
      }
      if (input?.period) {
        conditions.push(eq(participantBilling.billingPeriod, input.period));
      }

      const result = await db.select()
        .from(participantBilling)
        .where(conditions.length > 0 ? and(...conditions) : undefined);
      return result as BillingRecord[];
    }),

  /**
   * Get compliance screenings - participant sees own, admin sees all
   */
  getComplianceScreenings: protectedProcedure
    .input(z.object({
      decision: z.string().optional(),
    }).optional())
    .query(async ({ ctx, input }): Promise<ComplianceRecord[]> => {
      const { isAdmin } = getParticipantScope(ctx.user);
      const db = await getTypedDb();

      const conditions: any[] = [];

      if (!isAdmin) {
        conditions.push(eq(complianceScreenings.participantId, ctx.user.id));
      }
      if (input?.decision) {
        conditions.push(eq(complianceScreenings.decision, input.decision));
      }

      const result = await db.select()
        .from(complianceScreenings)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(complianceScreenings.createdAt))
        .limit(50);
      return result as ComplianceRecord[];
    }),

  /**
   * List all participants (ADMIN/CBN ONLY)
   */
  listParticipants: protectedProcedure.query(async ({ ctx }): Promise<ParticipantRecord[]> => {
    const { isAdmin } = getParticipantScope(ctx.user);

    if (!isAdmin) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Only admin/CBN can view all participants' });
    }

    const db = await getTypedDb();
    const result = await db.select().from(switchParticipants);
    return result as ParticipantRecord[];
  }),

  /**
   * Get dashboard metrics - scoped by role
   */
  getDashboardMetrics: protectedProcedure.query(async ({ ctx }): Promise<{
    isAdmin: boolean;
    totalTransfers: number;
  }> => {
    const { isAdmin } = getParticipantScope(ctx.user);
    const db = await getTypedDb();

    const conditions: any[] = [];
    if (!isAdmin) {
      conditions.push(eq(outboundTransfers.participantId, ctx.user.id));
    }

    // Return metrics scoped to user's access level
    const transferCount = await db.select({ count: count() })
      .from(outboundTransfers)
      .where(conditions.length > 0 ? conditions[0] : undefined);

    return {
      isAdmin,
      totalTransfers: transferCount[0]?.count ?? 0,
    };
  }),
});
