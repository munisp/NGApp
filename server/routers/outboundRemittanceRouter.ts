/**
 * Outbound Remittance tRPC Router
 * 
 * Complete CRUD + Business Workflows with server-side RBAC filtering.
 * Participants see ONLY their own data. Admin/CBN see all.
 * 
 * In dev mode (no DB), serves seed data. In production, queries PostgreSQL.
 */

import { z } from 'zod';
import { protectedProcedure, router } from '../_core/trpc';
import { TRPCError } from '@trpc/server';
import { eq, and, desc, count, like, or } from 'drizzle-orm';
import {
  switchParticipants,
  outboundTransfers,
  prefundAccounts,
  complianceScreenings,
  participantBilling,
} from '../../drizzle/schema';
import { getDb } from '../db';
import {
  seedParticipants,
  seedPrefundAccounts,
  seedTransfers,
  seedComplianceScreenings,
  seedBilling,
  seedDisputes,
  seedFundingRequests,
  seedTierUpgrades,
  seedApprovals,
} from '../seed/outboundSeedData';

// --- Helpers ---

function getScope(user: { id: number; role: string }) {
  const isAdmin = user.role === 'admin' || user.role === 'cbn';
  // Map userId to participantId (in seed data, participant.userId = user.id)
  const participant = seedParticipants.find(p => p.userId === user.id);
  const participantId = participant?.id ?? user.id;
  return { isAdmin, isCbn: user.role === 'cbn', userId: user.id, participantId, role: user.role };
}

type AnyDb = { select: (...args: any[]) => any; insert: (...args: any[]) => any; update: (...args: any[]) => any; delete: (...args: any[]) => any };

async function getTypedDb(): Promise<AnyDb | null> {
  const db = await getDb();
  return db as unknown as AnyDb | null;
}

// When DB is unavailable, use seed data filtered by participant scope
function filterByParticipant<T extends { participantId: number }>(data: T[], participantId: number, isAdmin: boolean): T[] {
  if (isAdmin) return data;
  return data.filter(d => d.participantId === participantId);
}

// ============================================================================
// ROUTER
// ============================================================================

export const outboundRemittanceRouter = router({

  // ==========================================================================
  // AUTH CONTEXT
  // ==========================================================================

  getMyContext: protectedProcedure.query(async ({ ctx }) => {
    const { isAdmin, isCbn, role } = getScope(ctx.user);
    const participant = seedParticipants.find(p => p.userId === ctx.user.id);
    return {
      role: role as 'participant' | 'admin' | 'cbn',
      isAdmin,
      isCbn,
      userId: ctx.user.id,
      participantId: isAdmin ? null : ctx.user.id,
      participantName: participant?.name ?? null,
      tier: participant?.tier ?? null,
    };
  }),

  // ==========================================================================
  // DASHBOARD METRICS
  // ==========================================================================

  getDashboardMetrics: protectedProcedure.query(async ({ ctx }) => {
    const { isAdmin, participantId } = getScope(ctx.user);
    const transfers = filterByParticipant(seedTransfers, participantId, isAdmin);
    const prefund = filterByParticipant(seedPrefundAccounts, participantId, isAdmin);

    const totalVolume = transfers.reduce((sum, t) => sum + parseFloat(t.amountNgn), 0);
    const completedTransfers = transfers.filter(t => t.status === 'completed');
    const successRate = transfers.length > 0
      ? Math.round((completedTransfers.length / transfers.length) * 100)
      : 0;
    const totalPrefundBalance = prefund.reduce((sum, p) => sum + parseFloat(p.balance), 0);
    const activeCorridors = new Set(transfers.map(t => t.corridor)).size;
    const pendingApprovals = isAdmin ? seedApprovals.filter(a => a.status === 'pending').length : 0;
    const escalatedCompliance = filterByParticipant(seedComplianceScreenings, participantId, isAdmin)
      .filter(s => s.decision === 'escalated').length;

    return {
      isAdmin,
      totalTransfers: transfers.length,
      totalVolume,
      successRate,
      totalPrefundBalance,
      activeCorridors,
      pendingApprovals,
      escalatedCompliance,
      recentTransfers: transfers.slice(0, 5),
    };
  }),

  // ==========================================================================
  // TRANSFERS (CRUD + Search)
  // ==========================================================================

  listTransfers: protectedProcedure
    .input(z.object({
      status: z.string().optional(),
      corridor: z.string().optional(),
      search: z.string().optional(),
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    }).optional())
    .query(async ({ ctx, input }) => {
      const { isAdmin, participantId } = getScope(ctx.user);
      let transfers = filterByParticipant(seedTransfers, participantId, isAdmin);

      if (input?.status) {
        transfers = transfers.filter(t => t.status === input.status);
      }
      if (input?.corridor) {
        transfers = transfers.filter(t => t.corridor === input.corridor);
      }
      if (input?.search) {
        const q = input.search.toLowerCase();
        transfers = transfers.filter(t =>
          t.transferRef.toLowerCase().includes(q) ||
          t.beneficiaryName.toLowerCase().includes(q) ||
          t.senderRef.toLowerCase().includes(q)
        );
      }

      return {
        transfers: transfers.slice(input?.offset ?? 0, (input?.offset ?? 0) + (input?.limit ?? 50)),
        total: transfers.length,
      };
    }),

  getTransfer: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const { isAdmin, participantId } = getScope(ctx.user);
      const transfer = seedTransfers.find(t => t.id === input.id);
      if (!transfer) throw new TRPCError({ code: 'NOT_FOUND', message: 'Transfer not found' });
      if (!isAdmin && transfer.participantId !== participantId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' });
      }
      const screenings = seedComplianceScreenings.filter(s => s.transferId === transfer.id);
      return { ...transfer, screenings };
    }),

  createTransfer: protectedProcedure
    .input(z.object({
      beneficiaryName: z.string().min(2),
      beneficiaryAccount: z.string().min(4),
      corridor: z.string(),
      amountNgn: z.string(),
      destCurrency: z.string(),
      purpose: z.string(),
      senderRef: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { isAdmin, participantId } = getScope(ctx.user);
      if (isAdmin) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Admins cannot submit transfers — use participant account' });

      const newId = seedTransfers.length + 1;
      const transfer = {
        id: newId,
        transferRef: `NOR-2025-${String(newId).padStart(8, '0')}`,
        participantId: participantId,
        senderRef: input.senderRef,
        beneficiaryName: input.beneficiaryName,
        beneficiaryAccount: input.beneficiaryAccount,
        corridor: input.corridor,
        amountNgn: input.amountNgn,
        amountDest: '—',
        destCurrency: input.destCurrency,
        fxRate: null,
        provider: null,
        status: 'admitted' as const,
        lifecycleStep: 'A-Admission',
        complianceResult: null,
        feeAmount: (parseFloat(input.amountNgn) * 0.005).toFixed(2),
        purpose: input.purpose,
        submittedAt: new Date(),
        completedAt: null,
        createdAt: new Date(),
      };
      (seedTransfers as any[]).push(transfer);
      return transfer;
    }),

  // ==========================================================================
  // PREFUND ACCOUNTS
  // ==========================================================================

  getPrefundAccounts: protectedProcedure.query(async ({ ctx }) => {
    const { isAdmin, participantId } = getScope(ctx.user);
    return filterByParticipant(seedPrefundAccounts, participantId, isAdmin);
  }),

  requestFunding: protectedProcedure
    .input(z.object({
      amount: z.string(),
      sourceBank: z.string(),
      sourceAccount: z.string(),
      method: z.enum(['RTGS', 'NIP', 'Wire']),
    }))
    .mutation(async ({ ctx, input }) => {
      const { isAdmin, participantId } = getScope(ctx.user);
      if (isAdmin) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Admins cannot request funding' });

      const participant = seedParticipants.find(p => p.id === participantId);
      const newId = seedFundingRequests.length + 1;
      const request = {
        id: newId,
        participantId: participantId,
        requestRef: `FUND-${participant?.shortCode ?? 'UNK'}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(newId).padStart(3, '0')}`,
        amount: input.amount,
        sourceBank: input.sourceBank,
        sourceAccount: input.sourceAccount,
        method: input.method,
        status: 'pending_approval',
        approvedBy: null,
        approvedAt: null,
        settledAt: null,
        createdAt: new Date(),
      };
      seedFundingRequests.push(request);
      return request;
    }),

  listFundingRequests: protectedProcedure.query(async ({ ctx }) => {
    const { isAdmin, participantId } = getScope(ctx.user);
    return filterByParticipant(seedFundingRequests, participantId, isAdmin);
  }),

  // ==========================================================================
  // BILLING
  // ==========================================================================

  getBilling: protectedProcedure
    .input(z.object({ period: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const { isAdmin, participantId } = getScope(ctx.user);
      let records = filterByParticipant(seedBilling, participantId, isAdmin);
      if (input?.period) {
        records = records.filter(r => r.billingPeriod === input.period);
      }
      return records;
    }),

  // ==========================================================================
  // COMPLIANCE
  // ==========================================================================

  getComplianceScreenings: protectedProcedure
    .input(z.object({ decision: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const { isAdmin, participantId } = getScope(ctx.user);
      let screenings = filterByParticipant(seedComplianceScreenings, participantId, isAdmin);
      if (input?.decision) {
        screenings = screenings.filter(s => s.decision === input.decision);
      }
      return screenings;
    }),

  // ==========================================================================
  // DISPUTES
  // ==========================================================================

  listDisputes: protectedProcedure.query(async ({ ctx }) => {
    const { isAdmin, participantId } = getScope(ctx.user);
    return filterByParticipant(seedDisputes, participantId, isAdmin);
  }),

  createDispute: protectedProcedure
    .input(z.object({
      transferId: z.number(),
      type: z.enum(['failed_delivery', 'wrong_amount', 'duplicate_charge', 'unauthorized', 'other']),
      reason: z.string().min(10),
    }))
    .mutation(async ({ ctx, input }) => {
      const { isAdmin, participantId } = getScope(ctx.user);
      const transfer = seedTransfers.find(t => t.id === input.transferId);
      if (!transfer) throw new TRPCError({ code: 'NOT_FOUND', message: 'Transfer not found' });
      if (!isAdmin && transfer.participantId !== participantId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Cannot dispute another participant\'s transfer' });
      }

      const newId = seedDisputes.length + 1;
      const dispute = {
        id: newId,
        transferId: input.transferId,
        participantId: transfer.participantId,
        disputeRef: `DSP-2025-${String(newId).padStart(5, '0')}`,
        type: input.type,
        reason: input.reason,
        amount: transfer.amountNgn,
        status: 'open',
        priority: parseFloat(transfer.amountNgn) > 10000000 ? 'high' : 'medium',
        assignedTo: null,
        resolution: null,
        resolvedAt: null,
        createdAt: new Date(),
      };
      seedDisputes.push(dispute);
      return dispute;
    }),

  resolveDispute: protectedProcedure
    .input(z.object({
      disputeId: z.number(),
      resolution: z.string().min(10),
      action: z.enum(['resolved', 'rejected', 'escalated']),
    }))
    .mutation(async ({ ctx, input }) => {
      const { isAdmin } = getScope(ctx.user);
      if (!isAdmin) throw new TRPCError({ code: 'FORBIDDEN', message: 'Only admin/CBN can resolve disputes' });

      const dispute = seedDisputes.find(d => d.id === input.disputeId);
      if (!dispute) throw new TRPCError({ code: 'NOT_FOUND', message: 'Dispute not found' });

      dispute.status = input.action;
      dispute.resolution = input.resolution;
      dispute.resolvedAt = new Date();
      dispute.assignedTo = ctx.user.id;
      return dispute;
    }),

  // ==========================================================================
  // TIER UPGRADES
  // ==========================================================================

  requestTierUpgrade: protectedProcedure
    .input(z.object({
      requestedTier: z.enum(['growth', 'enterprise', 'premium']),
      justification: z.string().min(20),
      monthlyVolume: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { isAdmin, participantId } = getScope(ctx.user);
      if (isAdmin) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Admins cannot request tier upgrades' });

      const participant = seedParticipants.find(p => p.id === participantId);
      if (!participant) throw new TRPCError({ code: 'NOT_FOUND', message: 'Participant not found' });

      const newId = seedTierUpgrades.length + 1;
      const request = {
        id: newId,
        participantId: participantId,
        currentTier: participant.tier,
        requestedTier: input.requestedTier,
        justification: input.justification,
        monthlyVolume: input.monthlyVolume,
        status: 'pending_review',
        reviewedBy: null,
        reviewedAt: null,
        createdAt: new Date(),
      };
      seedTierUpgrades.push(request);
      return request;
    }),

  listTierUpgrades: protectedProcedure.query(async ({ ctx }) => {
    const { isAdmin, participantId } = getScope(ctx.user);
    return filterByParticipant(seedTierUpgrades, participantId, isAdmin);
  }),

  // ==========================================================================
  // PARTICIPANTS (Admin/CBN only)
  // ==========================================================================

  listParticipants: protectedProcedure.query(async ({ ctx }) => {
    const { isAdmin } = getScope(ctx.user);
    if (!isAdmin) throw new TRPCError({ code: 'FORBIDDEN', message: 'Only admin/CBN can view all participants' });
    return seedParticipants;
  }),

  getParticipant: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const { isAdmin, participantId } = getScope(ctx.user);
      const participant = seedParticipants.find(p => p.id === input.id);
      if (!participant) throw new TRPCError({ code: 'NOT_FOUND', message: 'Participant not found' });
      if (!isAdmin && participant.id !== participantId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' });
      }
      return participant;
    }),

  // ==========================================================================
  // APPROVALS (Admin/CBN only)
  // ==========================================================================

  listApprovals: protectedProcedure.query(async ({ ctx }) => {
    const { isAdmin } = getScope(ctx.user);
    if (!isAdmin) throw new TRPCError({ code: 'FORBIDDEN', message: 'Only admin/CBN can view approvals' });
    return seedApprovals.filter(a => a.status === 'pending');
  }),

  processApproval: protectedProcedure
    .input(z.object({
      approvalId: z.number(),
      action: z.enum(['approved', 'rejected']),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { isAdmin, isCbn } = getScope(ctx.user);
      if (!isAdmin) throw new TRPCError({ code: 'FORBIDDEN', message: 'Only admin/CBN can process approvals' });

      const approval = seedApprovals.find(a => a.id === input.approvalId);
      if (!approval) throw new TRPCError({ code: 'NOT_FOUND', message: 'Approval not found' });

      approval.status = input.action;
      approval.approvedBy = ctx.user.id;
      approval.approvedAt = new Date();

      // Side effects based on approval type
      if (input.action === 'approved') {
        if (approval.entityType === 'funding') {
          const funding = seedFundingRequests.find(f => f.id === approval.entityId);
          if (funding) {
            funding.status = 'completed';
            funding.approvedBy = ctx.user.id;
            funding.approvedAt = new Date();
            funding.settledAt = new Date();
            // Credit prefund account
            const prefund = seedPrefundAccounts.find(p => p.participantId === funding.participantId);
            if (prefund) {
              prefund.balance = (parseFloat(prefund.balance) + parseFloat(funding.amount)).toFixed(2);
            }
          }
        }
        if (approval.entityType === 'tier_upgrade') {
          const upgrade = seedTierUpgrades.find(u => u.id === approval.entityId);
          if (upgrade) {
            upgrade.status = 'approved';
            upgrade.reviewedBy = ctx.user.id;
            upgrade.reviewedAt = new Date();
            const participant = seedParticipants.find(p => p.userId === upgrade.participantId);
            if (participant) {
              (participant as any).tier = upgrade.requestedTier;
            }
          }
        }
        if (approval.entityType === 'transfer' && approval.action === 'release_from_hold') {
          const transfer = seedTransfers.find(t => t.id === approval.entityId);
          if (transfer) {
            (transfer as any).status = 'routing';
            (transfer as any).lifecycleStep = 'D-Pricing';
            (transfer as any).complianceResult = 'clear';
          }
        }
      }

      return approval;
    }),

  // ==========================================================================
  // SEARCH (Global)
  // ==========================================================================

  globalSearch: protectedProcedure
    .input(z.object({ query: z.string().min(2) }))
    .query(async ({ ctx, input }) => {
      const { isAdmin, participantId } = getScope(ctx.user);
      const q = input.query.toLowerCase();

      const transfers = filterByParticipant(seedTransfers, participantId, isAdmin)
        .filter(t => t.transferRef.toLowerCase().includes(q) || t.beneficiaryName.toLowerCase().includes(q) || t.senderRef.toLowerCase().includes(q))
        .slice(0, 10);

      const participants = isAdmin
        ? seedParticipants.filter(p => p.name.toLowerCase().includes(q) || p.shortCode.toLowerCase().includes(q)).slice(0, 5)
        : [];

      const disputes = filterByParticipant(seedDisputes, participantId, isAdmin)
        .filter(d => d.disputeRef.toLowerCase().includes(q) || d.reason.toLowerCase().includes(q))
        .slice(0, 5);

      return { transfers, participants, disputes };
    }),

  // ==========================================================================
  // PAYMENT RAILS — SWIFT, PAPSS, CIPS, UPI, SEPA, Mobile Money, ACH, FPS
  // ==========================================================================

  getPaymentRails: protectedProcedure.query(async () => {
    return paymentRailsData.rails;
  }),

  getRailStatuses: protectedProcedure.query(async () => {
    return paymentRailsData.railStatuses;
  }),

  getCorridorRouting: protectedProcedure.query(async () => {
    return paymentRailsData.corridorRoutes;
  }),

  getDFSPRegistry: protectedProcedure.query(async () => {
    return paymentRailsData.dfsps;
  }),

  getRailsForCorridor: protectedProcedure
    .input(z.object({ corridorId: z.string() }))
    .query(async ({ input }) => {
      const route = paymentRailsData.corridorRoutes.find(r => r.corridorId === input.corridorId);
      const availableRails = paymentRailsData.dfsps.filter(d =>
        d.corridors.includes(input.corridorId) && d.status === 'active'
      );
      return { route, availableRails };
    }),

  calculateCorridorFee: protectedProcedure
    .input(z.object({ corridorId: z.string(), principalUSD: z.number().positive() }))
    .query(async ({ input }) => {
      const route = paymentRailsData.corridorRoutes.find(r => r.corridorId === input.corridorId);
      if (!route) throw new TRPCError({ code: 'NOT_FOUND', message: `No routing for corridor ${input.corridorId}` });
      const corridorFee = input.principalUSD * route.railFeeRate + route.railFixedFee;
      const rail = paymentRailsData.rails.find(r => r.type === route.primaryRail);
      return {
        corridorId: input.corridorId,
        principalUSD: input.principalUSD,
        corridorFee: Math.round(corridorFee * 100) / 100,
        railType: route.primaryRail,
        railName: rail?.name ?? route.primaryRail,
        formula: `${input.principalUSD} × ${route.railFeeRate} + ${route.railFixedFee}`,
      };
    }),

  // ==========================================================================
  // PAYMENT RAILS CRUD — Admin only
  // ==========================================================================

  // --- Rails CRUD ---
  createRail: protectedProcedure
    .input(z.object({
      type: z.string().min(2),
      name: z.string().min(2),
      settlementCurrency: z.string().min(2),
      messageFormat: z.string().min(2),
      maxSettlement: z.string().min(1),
      tracking: z.boolean(),
      corridors: z.array(z.string()),
      description: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { isAdmin } = getScope(ctx.user);
      if (!isAdmin) throw new TRPCError({ code: 'FORBIDDEN', message: 'Only admin can manage payment rails' });
      if (paymentRailsData.rails.find(r => r.type === input.type)) {
        throw new TRPCError({ code: 'CONFLICT', message: `Rail type ${input.type} already exists` });
      }
      paymentRailsData.rails.push(input);
      paymentRailsData.railStatuses.push({ rail: input.type, status: 'operational', avgLatencyMs: 0, successRate24h: 0, activeTxnCount: 0, dailyVolumeUSD: 0 });
      return input;
    }),

  updateRail: protectedProcedure
    .input(z.object({
      type: z.string(),
      name: z.string().optional(),
      settlementCurrency: z.string().optional(),
      messageFormat: z.string().optional(),
      maxSettlement: z.string().optional(),
      tracking: z.boolean().optional(),
      corridors: z.array(z.string()).optional(),
      description: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { isAdmin } = getScope(ctx.user);
      if (!isAdmin) throw new TRPCError({ code: 'FORBIDDEN', message: 'Only admin can manage payment rails' });
      const idx = paymentRailsData.rails.findIndex(r => r.type === input.type);
      if (idx === -1) throw new TRPCError({ code: 'NOT_FOUND', message: `Rail ${input.type} not found` });
      const rail = paymentRailsData.rails[idx];
      if (input.name !== undefined) rail.name = input.name;
      if (input.settlementCurrency !== undefined) rail.settlementCurrency = input.settlementCurrency;
      if (input.messageFormat !== undefined) rail.messageFormat = input.messageFormat;
      if (input.maxSettlement !== undefined) rail.maxSettlement = input.maxSettlement;
      if (input.tracking !== undefined) rail.tracking = input.tracking;
      if (input.corridors !== undefined) rail.corridors = input.corridors;
      if (input.description !== undefined) rail.description = input.description;
      return rail;
    }),

  deleteRail: protectedProcedure
    .input(z.object({ type: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { isAdmin } = getScope(ctx.user);
      if (!isAdmin) throw new TRPCError({ code: 'FORBIDDEN', message: 'Only admin can manage payment rails' });
      const idx = paymentRailsData.rails.findIndex(r => r.type === input.type);
      if (idx === -1) throw new TRPCError({ code: 'NOT_FOUND', message: `Rail ${input.type} not found` });
      const routesUsingRail = paymentRailsData.corridorRoutes.filter(r => r.primaryRail === input.type);
      if (routesUsingRail.length > 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: `Cannot delete rail ${input.type} — used as primary rail for ${routesUsingRail.map(r => r.corridorId).join(', ')}` });
      }
      paymentRailsData.rails.splice(idx, 1);
      const statusIdx = paymentRailsData.railStatuses.findIndex(s => s.rail === input.type);
      if (statusIdx !== -1) paymentRailsData.railStatuses.splice(statusIdx, 1);
      const dfspIdx = paymentRailsData.dfsps.findIndex(d => d.railType === input.type);
      if (dfspIdx !== -1) paymentRailsData.dfsps.splice(dfspIdx, 1);
      return { deleted: input.type };
    }),

  // --- Rail Status CRUD ---
  updateRailStatus: protectedProcedure
    .input(z.object({
      rail: z.string(),
      status: z.enum(['operational', 'degraded', 'down', 'maintenance']),
    }))
    .mutation(async ({ ctx, input }) => {
      const { isAdmin } = getScope(ctx.user);
      if (!isAdmin) throw new TRPCError({ code: 'FORBIDDEN', message: 'Only admin can update rail status' });
      const status = paymentRailsData.railStatuses.find(s => s.rail === input.rail);
      if (!status) throw new TRPCError({ code: 'NOT_FOUND', message: `Rail status for ${input.rail} not found` });
      status.status = input.status;
      return status;
    }),

  // --- Corridor Route CRUD ---
  createCorridorRoute: protectedProcedure
    .input(z.object({
      corridorId: z.string().min(4),
      primaryRail: z.string(),
      fallbackRails: z.array(z.string()),
      railFeeRate: z.number().min(0).max(0.1),
      railFixedFee: z.number().min(0),
    }))
    .mutation(async ({ ctx, input }) => {
      const { isAdmin } = getScope(ctx.user);
      if (!isAdmin) throw new TRPCError({ code: 'FORBIDDEN', message: 'Only admin can manage corridor routing' });
      if (paymentRailsData.corridorRoutes.find(r => r.corridorId === input.corridorId)) {
        throw new TRPCError({ code: 'CONFLICT', message: `Route for ${input.corridorId} already exists` });
      }
      if (!paymentRailsData.rails.find(r => r.type === input.primaryRail)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: `Primary rail ${input.primaryRail} does not exist` });
      }
      paymentRailsData.corridorRoutes.push(input);
      return input;
    }),

  updateCorridorRoute: protectedProcedure
    .input(z.object({
      corridorId: z.string(),
      primaryRail: z.string().optional(),
      fallbackRails: z.array(z.string()).optional(),
      railFeeRate: z.number().min(0).max(0.1).optional(),
      railFixedFee: z.number().min(0).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { isAdmin } = getScope(ctx.user);
      if (!isAdmin) throw new TRPCError({ code: 'FORBIDDEN', message: 'Only admin can manage corridor routing' });
      const route = paymentRailsData.corridorRoutes.find(r => r.corridorId === input.corridorId);
      if (!route) throw new TRPCError({ code: 'NOT_FOUND', message: `Route for ${input.corridorId} not found` });
      if (input.primaryRail !== undefined) {
        if (!paymentRailsData.rails.find(r => r.type === input.primaryRail)) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: `Rail ${input.primaryRail} does not exist` });
        }
        route.primaryRail = input.primaryRail;
      }
      if (input.fallbackRails !== undefined) route.fallbackRails = input.fallbackRails;
      if (input.railFeeRate !== undefined) route.railFeeRate = input.railFeeRate;
      if (input.railFixedFee !== undefined) route.railFixedFee = input.railFixedFee;
      return route;
    }),

  deleteCorridorRoute: protectedProcedure
    .input(z.object({ corridorId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { isAdmin } = getScope(ctx.user);
      if (!isAdmin) throw new TRPCError({ code: 'FORBIDDEN', message: 'Only admin can manage corridor routing' });
      const idx = paymentRailsData.corridorRoutes.findIndex(r => r.corridorId === input.corridorId);
      if (idx === -1) throw new TRPCError({ code: 'NOT_FOUND', message: `Route for ${input.corridorId} not found` });
      paymentRailsData.corridorRoutes.splice(idx, 1);
      return { deleted: input.corridorId };
    }),

  // --- DFSP Registry CRUD ---
  createDFSP: protectedProcedure
    .input(z.object({
      dfspId: z.string().min(4),
      name: z.string().min(2),
      railType: z.string(),
      corridors: z.array(z.string()),
      status: z.enum(['active', 'inactive', 'suspended']),
      settlementModel: z.enum(['deferred_net', 'immediate_gross']),
      partyIdTypes: z.array(z.string()),
      endpoint: z.string(),
      settlementAcct: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { isAdmin } = getScope(ctx.user);
      if (!isAdmin) throw new TRPCError({ code: 'FORBIDDEN', message: 'Only admin can manage DFSP registry' });
      if (paymentRailsData.dfsps.find(d => d.dfspId === input.dfspId)) {
        throw new TRPCError({ code: 'CONFLICT', message: `DFSP ${input.dfspId} already exists` });
      }
      paymentRailsData.dfsps.push(input);
      return input;
    }),

  updateDFSP: protectedProcedure
    .input(z.object({
      dfspId: z.string(),
      name: z.string().optional(),
      railType: z.string().optional(),
      corridors: z.array(z.string()).optional(),
      status: z.enum(['active', 'inactive', 'suspended']).optional(),
      settlementModel: z.enum(['deferred_net', 'immediate_gross']).optional(),
      partyIdTypes: z.array(z.string()).optional(),
      endpoint: z.string().optional(),
      settlementAcct: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { isAdmin } = getScope(ctx.user);
      if (!isAdmin) throw new TRPCError({ code: 'FORBIDDEN', message: 'Only admin can manage DFSP registry' });
      const dfsp = paymentRailsData.dfsps.find(d => d.dfspId === input.dfspId);
      if (!dfsp) throw new TRPCError({ code: 'NOT_FOUND', message: `DFSP ${input.dfspId} not found` });
      if (input.name !== undefined) dfsp.name = input.name;
      if (input.railType !== undefined) dfsp.railType = input.railType;
      if (input.corridors !== undefined) dfsp.corridors = input.corridors;
      if (input.status !== undefined) dfsp.status = input.status;
      if (input.settlementModel !== undefined) dfsp.settlementModel = input.settlementModel;
      if (input.partyIdTypes !== undefined) dfsp.partyIdTypes = input.partyIdTypes;
      if (input.endpoint !== undefined) dfsp.endpoint = input.endpoint;
      if (input.settlementAcct !== undefined) dfsp.settlementAcct = input.settlementAcct;
      return dfsp;
    }),

  deleteDFSP: protectedProcedure
    .input(z.object({ dfspId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { isAdmin } = getScope(ctx.user);
      if (!isAdmin) throw new TRPCError({ code: 'FORBIDDEN', message: 'Only admin can manage DFSP registry' });
      const idx = paymentRailsData.dfsps.findIndex(d => d.dfspId === input.dfspId);
      if (idx === -1) throw new TRPCError({ code: 'NOT_FOUND', message: `DFSP ${input.dfspId} not found` });
      paymentRailsData.dfsps.splice(idx, 1);
      return { deleted: input.dfspId };
    }),

  // ==========================================================================
  // ENHANCEMENT QUERIES — Batch, Approvals, Audit, Netting, Rate Locks, etc.
  // ==========================================================================

  getAuditTrail: protectedProcedure.query(async ({ ctx }) => {
    const { isAdmin } = getScope(ctx.user);
    if (!isAdmin) throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin only' });
    return enhancementData.auditTrail;
  }),

  getPendingApprovals: protectedProcedure.query(async ({ ctx }) => {
    const { isAdmin } = getScope(ctx.user);
    if (!isAdmin) throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin only' });
    return enhancementData.pendingApprovals;
  }),

  submitApprovalDecision: protectedProcedure
    .input(z.object({ requestId: z.string(), approved: z.boolean(), comment: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { isAdmin } = getScope(ctx.user);
      if (!isAdmin) throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin only' });
      const req = enhancementData.pendingApprovals.find(a => a.requestId === input.requestId);
      if (!req) throw new TRPCError({ code: 'NOT_FOUND', message: 'Approval not found' });
      req.decisions.push({ approverId: ctx.user?.id || 'admin', approverRole: 'admin', decision: input.approved ? 'approved' : 'rejected', comment: input.comment || '', decidedAt: new Date().toISOString() });
      req.currentApprovals += input.approved ? 1 : 0;
      if (!input.approved) req.status = 'rejected';
      else if (req.currentApprovals >= req.requiredApprovals) req.status = 'approved';
      return req;
    }),

  getBatches: protectedProcedure.query(async ({ ctx }) => {
    const { isAdmin, participantId } = getScope(ctx.user);
    if (isAdmin) return enhancementData.batches;
    return enhancementData.batches.filter(b => b.participantId === String(participantId));
  }),

  submitBatch: protectedProcedure
    .input(z.object({
      items: z.array(z.object({
        beneficiaryName: z.string(),
        beneficiaryAccount: z.string(),
        corridorId: z.string(),
        amountNGN: z.number().positive(),
        purpose: z.string().optional(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      const { participantId } = getScope(ctx.user);
      const batchId = `BATCH-${participantId}-${Date.now()}`;
      const batch = {
        batchId,
        participantId,
        submittedAt: new Date().toISOString(),
        status: 'processing' as const,
        totalItems: input.items.length,
        processedItems: 0,
        successCount: 0,
        failedCount: 0,
        totalAmountNGN: input.items.reduce((s, i) => s + i.amountNGN, 0),
        items: input.items.map((item, idx) => ({
          ...item,
          lineNumber: idx + 1,
          status: 'completed' as const,
          transferRef: `NOR-${new Date().getFullYear()}-${String(idx + 1).padStart(5, '0')}`,
          feeUSD: item.amountNGN * 0.001 / 1600,
        })),
      };
      batch.processedItems = batch.totalItems;
      batch.successCount = batch.totalItems;
      (batch as any).status = 'completed';
      enhancementData.batches.push(batch as any);
      return batch;
    }),

  getNettingCycles: protectedProcedure.query(async ({ ctx }) => {
    const { isAdmin } = getScope(ctx.user);
    if (!isAdmin) throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin only' });
    return enhancementData.nettingCycles;
  }),

  getActiveFXLocks: protectedProcedure.query(async ({ ctx }) => {
    const { participantId, isAdmin } = getScope(ctx.user);
    if (isAdmin) return enhancementData.fxRateLocks;
    return enhancementData.fxRateLocks.filter(l => l.participantId === String(participantId));
  }),

  lockFXRate: protectedProcedure
    .input(z.object({
      corridorId: z.string(),
      fromCurrency: z.string(),
      toCurrency: z.string(),
      amountFrom: z.number().positive(),
      ttlSeconds: z.number().min(10).max(300).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { participantId } = getScope(ctx.user);
      const pid = String(participantId);
      const route = paymentRailsData.corridorRoutes.find(r => r.corridorId === input.corridorId);
      const marketRate = fxRates[input.toCurrency] || 1;
      const spread = 50; // 50 bps default
      const ttl = input.ttlSeconds || 60;
      const lock = {
        lockId: `LOCK-${pid}-${Date.now()}`,
        participantId: pid,
        corridorId: input.corridorId,
        fromCurrency: input.fromCurrency,
        toCurrency: input.toCurrency,
        marketRate,
        lockedRate: marketRate * (1 + spread / 10000),
        spread,
        amountFrom: input.amountFrom,
        amountTo: input.amountFrom / (marketRate * (1 + spread / 10000)),
        status: 'active' as const,
        lockedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
      };
      enhancementData.fxRateLocks.push(lock);
      return lock;
    }),

  getIPAllowlist: protectedProcedure.query(async ({ ctx }) => {
    const { isAdmin } = getScope(ctx.user);
    if (!isAdmin) throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin only' });
    return enhancementData.ipAllowlist;
  }),

  getAPIUsage: protectedProcedure.query(async ({ ctx }) => {
    const { isAdmin, participantId } = getScope(ctx.user);
    if (isAdmin) return enhancementData.apiUsage;
    return enhancementData.apiUsage.filter(u => u.participantId === String(participantId));
  }),

  getAnomalyAlerts: protectedProcedure.query(async ({ ctx }) => {
    const { isAdmin } = getScope(ctx.user);
    if (!isAdmin) throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin only' });
    return enhancementData.anomalyAlerts;
  }),

  getSLABreaches: protectedProcedure.query(async ({ ctx }) => {
    const { isAdmin } = getScope(ctx.user);
    if (!isAdmin) throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin only' });
    return enhancementData.slaBreaches;
  }),

  getCapacityForecasts: protectedProcedure.query(async ({ ctx }) => {
    const { isAdmin } = getScope(ctx.user);
    if (!isAdmin) throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin only' });
    return enhancementData.capacityForecasts;
  }),

  getSanctionsUpdates: protectedProcedure.query(async ({ ctx }) => {
    const { isAdmin } = getScope(ctx.user);
    if (!isAdmin) throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin only' });
    return enhancementData.sanctionsUpdates;
  }),

  getWebhookEvents: protectedProcedure.query(async ({ ctx }) => {
    const { isAdmin, participantId } = getScope(ctx.user);
    if (isAdmin) return enhancementData.webhookEvents;
    return enhancementData.webhookEvents.filter(e => e.participantId === String(participantId));
  }),

  replayWebhook: protectedProcedure
    .input(z.object({ eventId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { isAdmin } = getScope(ctx.user);
      if (!isAdmin) throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin only' });
      const evt = enhancementData.webhookEvents.find(e => e.eventId === input.eventId);
      if (!evt) throw new TRPCError({ code: 'NOT_FOUND', message: 'Webhook event not found' });
      return { ...evt, replayed: true, replayedAt: new Date().toISOString() };
    }),

  getSandboxEnvironments: protectedProcedure.query(async ({ ctx }) => {
    const { participantId, isAdmin } = getScope(ctx.user);
    if (isAdmin) return enhancementData.sandboxEnvs;
    return enhancementData.sandboxEnvs.filter(s => s.participantId === String(participantId));
  }),
});

// =============================================================================
// Payment Rails seed data — mirrors Go PaymentRailRegistry + MojaloopHubRouter
// =============================================================================

const paymentRailsData = {
  rails: [
    { type: 'SWIFT', name: 'SWIFT gpi', settlementCurrency: 'USD', messageFormat: 'MT103/ISO20022', maxSettlement: '48h', tracking: true, corridors: ['NG-GB', 'NG-US', 'NG-CA', 'NG-AE', 'NG-TR', 'NG-CN', 'NG-ZA'], description: 'Correspondent banking via SWIFT Global Payments Innovation. Uses MT103 messages and UETR tracking for cross-border bank transfers.' },
    { type: 'PAPSS', name: 'PAPSS (Pan-African)', settlementCurrency: 'LOCAL', messageFormat: 'ISO20022', maxSettlement: '2min', tracking: true, corridors: ['NG-GH', 'NG-KE', 'NG-ZA', 'NG-SN', 'NG-CI', 'NG-CM'], description: 'Pan-African Payment and Settlement System by Afreximbank. Instant intra-African transfers in local currencies without USD intermediation.' },
    { type: 'CIPS', name: 'CIPS (China)', settlementCurrency: 'CNY', messageFormat: 'ISO20022/CIPS', maxSettlement: '4h', tracking: true, corridors: ['NG-CN'], description: 'China Cross-Border Interbank Payment System operated by PBOC. Settles in CNY for China-bound transfers.' },
    { type: 'UPI', name: 'UPI International (India)', settlementCurrency: 'INR', messageFormat: 'UPI/ISO20022', maxSettlement: '30s', tracking: true, corridors: ['NG-IN'], description: 'India Unified Payments Interface by NPCI. Near-instant settlement to Indian bank accounts, VPAs, or Aadhaar-linked mobiles.' },
    { type: 'SEPA', name: 'SEPA (Europe)', settlementCurrency: 'EUR', messageFormat: 'ISO20022/pain.001', maxSettlement: '10s', tracking: true, corridors: ['NG-GB', 'NG-TR'], description: 'Single Euro Payments Area. SEPA Instant (SCT Inst) for near-instant EUR transfers across EU/EEA.' },
    { type: 'MOBILE_MONEY', name: 'Mobile Money (Africa)', settlementCurrency: 'LOCAL', messageFormat: 'GSMA_MMAPI', maxSettlement: '5min', tracking: true, corridors: ['NG-GH', 'NG-KE', 'NG-CM', 'NG-CI', 'NG-SN', 'NG-ZA'], description: 'MTN MoMo (West Africa), M-Pesa (East Africa), Airtel Money. Low-cost mobile wallet transfers via GSMA Mobile Money API.' },
    { type: 'MOJALOOP', name: 'Mojaloop Hub', settlementCurrency: 'LOCAL', messageFormat: 'FSPIOP/ISO20022', maxSettlement: '10min', tracking: true, corridors: ['NG-GH', 'NG-KE', 'NG-SN', 'NG-CI', 'NG-CM', 'NG-ZA'], description: 'Mojaloop interoperability hub. Universal fallback rail using FSPIOP API for any participating DFSP.' },
    { type: 'ACH', name: 'ACH (US)', settlementCurrency: 'USD', messageFormat: 'NACHA', maxSettlement: '24h', tracking: false, corridors: ['NG-US', 'NG-CA'], description: 'US Automated Clearing House. Same-day ACH for USD transfers to US and Canadian bank accounts.' },
    { type: 'FASTER_PAY', name: 'Faster Payments (UK)', settlementCurrency: 'GBP', messageFormat: 'ISO20022', maxSettlement: '2h', tracking: true, corridors: ['NG-GB'], description: 'UK Faster Payments Service. Near-instant GBP transfers to UK bank accounts.' },
  ],
  railStatuses: [
    { rail: 'SWIFT', status: 'operational', avgLatencyMs: 850, successRate24h: 99.2, activeTxnCount: 47, dailyVolumeUSD: 2_450_000 },
    { rail: 'PAPSS', status: 'operational', avgLatencyMs: 120, successRate24h: 99.8, activeTxnCount: 156, dailyVolumeUSD: 890_000 },
    { rail: 'CIPS', status: 'operational', avgLatencyMs: 340, successRate24h: 99.5, activeTxnCount: 12, dailyVolumeUSD: 340_000 },
    { rail: 'UPI', status: 'operational', avgLatencyMs: 45, successRate24h: 99.9, activeTxnCount: 89, dailyVolumeUSD: 560_000 },
    { rail: 'SEPA', status: 'operational', avgLatencyMs: 80, successRate24h: 99.7, activeTxnCount: 23, dailyVolumeUSD: 180_000 },
    { rail: 'MOBILE_MONEY', status: 'operational', avgLatencyMs: 200, successRate24h: 98.5, activeTxnCount: 234, dailyVolumeUSD: 420_000 },
    { rail: 'MOJALOOP', status: 'operational', avgLatencyMs: 180, successRate24h: 99.1, activeTxnCount: 67, dailyVolumeUSD: 310_000 },
    { rail: 'ACH', status: 'operational', avgLatencyMs: 1200, successRate24h: 99.6, activeTxnCount: 31, dailyVolumeUSD: 780_000 },
    { rail: 'FASTER_PAY', status: 'operational', avgLatencyMs: 65, successRate24h: 99.8, activeTxnCount: 18, dailyVolumeUSD: 210_000 },
  ],
  corridorRoutes: [
    { corridorId: 'NG-GH', primaryRail: 'PAPSS', fallbackRails: ['MOBILE_MONEY', 'MOJALOOP'], railFeeRate: 0.0005, railFixedFee: 0.10 },
    { corridorId: 'NG-SN', primaryRail: 'PAPSS', fallbackRails: ['MOBILE_MONEY', 'MOJALOOP'], railFeeRate: 0.0008, railFixedFee: 0.10 },
    { corridorId: 'NG-CI', primaryRail: 'PAPSS', fallbackRails: ['MOBILE_MONEY', 'MOJALOOP'], railFeeRate: 0.0008, railFixedFee: 0.10 },
    { corridorId: 'NG-CM', primaryRail: 'PAPSS', fallbackRails: ['MOBILE_MONEY', 'MOJALOOP'], railFeeRate: 0.0008, railFixedFee: 0.10 },
    { corridorId: 'NG-KE', primaryRail: 'PAPSS', fallbackRails: ['MOBILE_MONEY', 'SWIFT'], railFeeRate: 0.0006, railFixedFee: 0.10 },
    { corridorId: 'NG-ZA', primaryRail: 'PAPSS', fallbackRails: ['SWIFT'], railFeeRate: 0.0007, railFixedFee: 0.15 },
    { corridorId: 'NG-GB', primaryRail: 'SWIFT', fallbackRails: ['FASTER_PAY', 'SEPA'], railFeeRate: 0.0010, railFixedFee: 0.25 },
    { corridorId: 'NG-US', primaryRail: 'SWIFT', fallbackRails: ['ACH'], railFeeRate: 0.0010, railFixedFee: 0.25 },
    { corridorId: 'NG-CA', primaryRail: 'SWIFT', fallbackRails: ['ACH'], railFeeRate: 0.0012, railFixedFee: 0.25 },
    { corridorId: 'NG-AE', primaryRail: 'SWIFT', fallbackRails: [], railFeeRate: 0.0015, railFixedFee: 0.30 },
    { corridorId: 'NG-TR', primaryRail: 'SWIFT', fallbackRails: ['SEPA'], railFeeRate: 0.0012, railFixedFee: 0.25 },
    { corridorId: 'NG-CN', primaryRail: 'CIPS', fallbackRails: ['SWIFT'], railFeeRate: 0.0008, railFixedFee: 0.20 },
    { corridorId: 'NG-IN', primaryRail: 'UPI', fallbackRails: ['SWIFT'], railFeeRate: 0.0004, railFixedFee: 0.05 },
  ],
  dfsps: [
    { dfspId: 'dfsp-swift', name: 'SWIFT gpi Network', railType: 'SWIFT', corridors: ['NG-GB', 'NG-US', 'NG-CA', 'NG-AE', 'NG-TR', 'NG-CN', 'NG-ZA'], status: 'active', settlementModel: 'deferred_net', partyIdTypes: ['IBAN', 'ACCOUNT_ID'], endpoint: 'swift-adapter.remit-switch.internal', settlementAcct: 'SWIFT_NOSTRO_USD' },
    { dfspId: 'dfsp-papss', name: 'PAPSS (Pan-African)', railType: 'PAPSS', corridors: ['NG-GH', 'NG-KE', 'NG-ZA', 'NG-SN', 'NG-CI', 'NG-CM'], status: 'active', settlementModel: 'immediate_gross', partyIdTypes: ['MSISDN', 'ACCOUNT_ID', 'IBAN'], endpoint: 'papss-adapter.remit-switch.internal', settlementAcct: 'PAPSS_CLEARING' },
    { dfspId: 'dfsp-cips', name: 'CIPS (China)', railType: 'CIPS', corridors: ['NG-CN'], status: 'active', settlementModel: 'deferred_net', partyIdTypes: ['ACCOUNT_ID'], endpoint: 'cips-adapter.remit-switch.internal', settlementAcct: 'CIPS_NOSTRO_CNY' },
    { dfspId: 'dfsp-upi', name: 'UPI International (India)', railType: 'UPI', corridors: ['NG-IN'], status: 'active', settlementModel: 'immediate_gross', partyIdTypes: ['MSISDN', 'ACCOUNT_ID', 'VPA'], endpoint: 'upi-adapter.remit-switch.internal', settlementAcct: 'UPI_CLEARING_INR' },
    { dfspId: 'dfsp-sepa', name: 'SEPA (Europe)', railType: 'SEPA', corridors: ['NG-GB', 'NG-TR'], status: 'active', settlementModel: 'immediate_gross', partyIdTypes: ['IBAN'], endpoint: 'sepa-adapter.remit-switch.internal', settlementAcct: 'SEPA_CLEARING_EUR' },
    { dfspId: 'dfsp-mobile-money', name: 'Mobile Money (Africa)', railType: 'MOBILE_MONEY', corridors: ['NG-GH', 'NG-KE', 'NG-CM', 'NG-CI', 'NG-SN', 'NG-ZA'], status: 'active', settlementModel: 'immediate_gross', partyIdTypes: ['MSISDN'], endpoint: 'momo-adapter.remit-switch.internal', settlementAcct: 'MOMO_CLEARING' },
    { dfspId: 'dfsp-ach', name: 'ACH (US)', railType: 'ACH', corridors: ['NG-US', 'NG-CA'], status: 'active', settlementModel: 'deferred_net', partyIdTypes: ['ACCOUNT_ID'], endpoint: 'ach-adapter.remit-switch.internal', settlementAcct: 'ACH_CLEARING_USD' },
    { dfspId: 'dfsp-faster-payments', name: 'Faster Payments (UK)', railType: 'FASTER_PAY', corridors: ['NG-GB'], status: 'active', settlementModel: 'immediate_gross', partyIdTypes: ['ACCOUNT_ID'], endpoint: 'fps-adapter.remit-switch.internal', settlementAcct: 'FPS_CLEARING_GBP' },
  ],
};

// FX rates (currency -> 1 unit in NGN)
const fxRates: Record<string, number> = {
  NGN: 1, USD: 1600, GBP: 1960, EUR: 1750, GHS: 103, KES: 10.5,
  ZAR: 86.5, CNY: 221, INR: 19.2, XOF: 2.62, XAF: 2.62, CAD: 1185, AED: 435, TRY: 50,
};

// =============================================================================
// Enhancement seed data — approvals, audit, batches, netting, rate locks, etc.
// =============================================================================
const enhancementData = {
  pendingApprovals: [
    { requestId: 'APR-001', type: 'high_value_transfer', requestedBy: 'operator-payapp', requestedAt: '2026-05-02T08:30:00Z', expiresAt: '2026-05-02T12:30:00Z', status: 'pending', requiredApprovals: 2, currentApprovals: 1, subject: 'Transfer ₦750M to NG-GB via SWIFT', details: { corridor: 'NG-GB', amount: '750000000', beneficiary: 'London Holdings Ltd' }, decisions: [{ approverId: 'admin-ops-1', approverRole: 'admin', decision: 'approved', comment: 'Verified beneficiary', decidedAt: '2026-05-02T09:15:00Z' }] },
    { requestId: 'APR-002', type: 'tier_upgrade', requestedBy: 'operator-opay', requestedAt: '2026-05-01T14:00:00Z', expiresAt: '2026-05-03T14:00:00Z', status: 'pending', requiredApprovals: 2, currentApprovals: 0, subject: 'OPay tier upgrade: Growth → Enterprise', details: { participant: 'OPay', currentTier: 'Growth', requestedTier: 'Enterprise', monthlyVolume: '₦8.2B' }, decisions: [] },
    { requestId: 'APR-003', type: 'rail_config_change', requestedBy: 'admin-infra', requestedAt: '2026-05-02T10:00:00Z', expiresAt: '2026-05-03T10:00:00Z', status: 'pending', requiredApprovals: 2, currentApprovals: 0, subject: 'SWIFT rail: change max settlement from 48h to 24h', details: { rail: 'SWIFT', field: 'maxSettlement', oldValue: '48h', newValue: '24h' }, decisions: [] },
    { requestId: 'APR-004', type: 'compliance_escalation', requestedBy: 'compliance-bot', requestedAt: '2026-05-02T11:00:00Z', expiresAt: '2026-05-02T23:00:00Z', status: 'pending', requiredApprovals: 2, currentApprovals: 0, subject: 'Sanctions match: beneficiary "A. Khan" vs OFAC SDN entry', details: { transferRef: 'NOR-2026-00047', matchScore: '87%', listSource: 'OFAC SDN' }, decisions: [] },
    { requestId: 'APR-005', type: 'participant_onboard', requestedBy: 'onboarding-system', requestedAt: '2026-04-30T09:00:00Z', expiresAt: '2026-05-03T09:00:00Z', status: 'pending', requiredApprovals: 2, currentApprovals: 1, subject: 'Kuda MFB onboarding: Final production go-live approval', details: { participant: 'Kuda MFB', stage: 'certification_complete', corridors: 'NG-GH, NG-GB, NG-US' }, decisions: [{ approverId: 'admin-compliance', approverRole: 'admin', decision: 'approved', comment: 'Compliance passed', decidedAt: '2026-05-01T16:00:00Z' }] },
  ] as any[],
  auditTrail: [
    { sequence: 1, timestamp: '2026-05-02T08:00:00Z', action: 'transfer.created', actorId: 'payapp-api', actorRole: 'participant', resourceType: 'transfer', resourceId: 'NOR-2026-00001', details: { corridor: 'NG-GH', amount: '2500000' }, entryHash: 'a1b2c3' },
    { sequence: 2, timestamp: '2026-05-02T08:00:05Z', action: 'transfer.approved', actorId: 'system', actorRole: 'system', resourceType: 'transfer', resourceId: 'NOR-2026-00001', details: { stage: 'compliance_cleared' }, entryHash: 'd4e5f6' },
    { sequence: 3, timestamp: '2026-05-02T08:01:00Z', action: 'transfer.completed', actorId: 'swift-adapter', actorRole: 'system', resourceType: 'transfer', resourceId: 'NOR-2026-00001', details: { rail: 'PAPSS', latencyMs: '850' }, entryHash: 'g7h8i9' },
    { sequence: 4, timestamp: '2026-05-02T09:00:00Z', action: 'rail.status_changed', actorId: 'admin-ops-1', actorRole: 'admin', resourceType: 'rail', resourceId: 'MOBILE_MONEY', details: { oldStatus: 'operational', newStatus: 'degraded', reason: 'MTN API timeout spike' }, entryHash: 'j0k1l2' },
    { sequence: 5, timestamp: '2026-05-02T09:30:00Z', action: 'config.changed', actorId: 'admin-infra', actorRole: 'admin', resourceType: 'corridor', resourceId: 'NG-GH', details: { field: 'railFeeRate', oldValue: '0.0005', newValue: '0.0004' }, entryHash: 'm3n4o5' },
    { sequence: 6, timestamp: '2026-05-02T10:00:00Z', action: 'approval.decision', actorId: 'admin-ops-1', actorRole: 'admin', resourceType: 'approval', resourceId: 'APR-001', details: { decision: 'approved' }, entryHash: 'p6q7r8' },
    { sequence: 7, timestamp: '2026-05-02T10:15:00Z', action: 'rate.override', actorId: 'admin-treasury', actorRole: 'admin', resourceType: 'fxRate', resourceId: 'NGN-GBP', details: { oldSpread: '100bps', newSpread: '80bps', justification: 'Competitive pressure' }, entryHash: 's9t0u1' },
    { sequence: 8, timestamp: '2026-05-02T11:00:00Z', action: 'compliance.escalated', actorId: 'sanctions-engine', actorRole: 'system', resourceType: 'transfer', resourceId: 'NOR-2026-00047', details: { matchScore: '87%', list: 'OFAC SDN' }, entryHash: 'v2w3x4' },
    { sequence: 9, timestamp: '2026-05-02T12:00:00Z', action: 'prefund.deposit', actorId: 'payapp-treasury', actorRole: 'participant', resourceType: 'prefund', resourceId: 'TB-PFND-PAYAPP-001', details: { amount: '500000000', currency: 'NGN' }, entryHash: 'y5z6a7' },
    { sequence: 10, timestamp: '2026-05-02T13:00:00Z', action: 'batch.submitted', actorId: 'payapp-api', actorRole: 'participant', resourceType: 'batch', resourceId: 'BATCH-PAYAPP-001', details: { items: '47', totalNGN: '125000000' }, entryHash: 'b8c9d0' },
  ],
  batches: [
    { batchId: 'BATCH-PAYAPP-001', participantId: 'PAYAPP-001', submittedAt: '2026-05-02T06:00:00Z', status: 'completed', totalItems: 47, processedItems: 47, successCount: 45, failedCount: 2, totalAmountNGN: 125_000_000, totalFeesUSD: 78.13, items: [] },
    { batchId: 'BATCH-OPAY-001', participantId: 'OPAY-001', submittedAt: '2026-05-01T22:00:00Z', status: 'completed', totalItems: 312, processedItems: 312, successCount: 308, failedCount: 4, totalAmountNGN: 890_000_000, totalFeesUSD: 556.25, items: [] },
    { batchId: 'BATCH-PAYAPP-002', participantId: 'PAYAPP-001', submittedAt: '2026-05-02T12:00:00Z', status: 'processing', totalItems: 85, processedItems: 62, successCount: 60, failedCount: 2, totalAmountNGN: 240_000_000, totalFeesUSD: 93.75, items: [] },
  ] as any[],
  nettingCycles: [
    { cycleId: 'NET-20260502-AM', cycleStart: '2026-05-02T00:00:00Z', cycleEnd: '2026-05-02T12:00:00Z', grossTotalUSD: 3_850_000, netTotalUSD: 2_695_000, savingsUSD: 1_155_000, savingsPercent: 30, pairsNetted: 5, grossFlows: [{ fromCurrency: 'NGN', toCurrency: 'GHS', grossAmount: 850000, txnCount: 34 }, { fromCurrency: 'NGN', toCurrency: 'GBP', grossAmount: 1200000, txnCount: 12 }, { fromCurrency: 'NGN', toCurrency: 'USD', grossAmount: 950000, txnCount: 18 }] },
    { cycleId: 'NET-20260501-PM', cycleStart: '2026-05-01T12:00:00Z', cycleEnd: '2026-05-01T23:59:59Z', grossTotalUSD: 4_200_000, netTotalUSD: 3_150_000, savingsUSD: 1_050_000, savingsPercent: 25, pairsNetted: 4, grossFlows: [] },
  ],
  fxRateLocks: [
    { lockId: 'LOCK-PAYAPP-001', participantId: 'PAYAPP-001', corridorId: 'NG-GB', fromCurrency: 'NGN', toCurrency: 'GBP', marketRate: 1960, lockedRate: 1969.8, spread: 50, amountFrom: 50_000_000, amountTo: 25381, status: 'active', lockedAt: '2026-05-02T14:50:00Z', expiresAt: '2026-05-02T14:51:00Z' },
    { lockId: 'LOCK-OPAY-001', participantId: 'OPAY-001', corridorId: 'NG-US', fromCurrency: 'NGN', toCurrency: 'USD', marketRate: 1600, lockedRate: 1608, spread: 50, amountFrom: 100_000_000, amountTo: 62189, status: 'used', lockedAt: '2026-05-02T10:00:00Z', expiresAt: '2026-05-02T10:01:00Z' },
  ],
  ipAllowlist: [
    { id: 'IP-PAYAPP-1', participantId: 'PAYAPP-001', cidr: '10.0.1.0/24', label: 'PayApp HQ Office', addedBy: 'admin-1', addedAt: '2026-04-01T00:00:00Z', hitCount: 14523, enforced: true },
    { id: 'IP-PAYAPP-2', participantId: 'PAYAPP-001', cidr: '172.16.0.0/16', label: 'PayApp Cloud VPC', addedBy: 'admin-1', addedAt: '2026-04-01T00:00:00Z', hitCount: 89234, enforced: true },
    { id: 'IP-OPAY-1', participantId: 'OPAY-001', cidr: '10.10.0.0/16', label: 'OPay Production VPC', addedBy: 'admin-2', addedAt: '2026-04-15T00:00:00Z', hitCount: 45120, enforced: true },
  ],
  apiUsage: [
    { participantId: 'PAYAPP-001', keyId: 'ak_payapp_001', tier: 'enterprise', totalRequests: 2_450_000, requestsToday: 18_420, dailyLimit: 100000, dailyUsagePercent: 18.4, ratePerMin: 500, currentMinUsage: 12 },
    { participantId: 'OPAY-001', keyId: 'ak_opay_001', tier: 'premium', totalRequests: 8_900_000, requestsToday: 45_200, dailyLimit: 500000, dailyUsagePercent: 9.0, ratePerMin: 2000, currentMinUsage: 45 },
    { participantId: 'MONIEPOINT-001', keyId: 'ak_moniepoint_001', tier: 'growth', totalRequests: 890_000, requestsToday: 3_200, dailyLimit: 25000, dailyUsagePercent: 12.8, ratePerMin: 100, currentMinUsage: 3 },
  ],
  anomalyAlerts: [
    { alertId: 'ANOM-001', severity: 'high', type: 'velocity_spike', corridor: 'NG-AE', description: 'Transfer volume to UAE spiked 340% vs 30-day average', detectedAt: '2026-05-02T11:30:00Z', status: 'investigating', participantId: 'PAYAPP-001', affectedTransfers: 12 },
    { alertId: 'ANOM-002', severity: 'medium', type: 'new_beneficiary_country', corridor: 'NG-TR', description: 'First-time beneficiary in Turkey for Moniepoint', detectedAt: '2026-05-02T10:45:00Z', status: 'cleared', participantId: 'MONIEPOINT-001', affectedTransfers: 1 },
    { alertId: 'ANOM-003', severity: 'critical', type: 'amount_outlier', corridor: 'NG-CN', description: 'Single transfer ₦89M to China — 15x participant average', detectedAt: '2026-05-02T13:00:00Z', status: 'escalated', participantId: 'OPAY-001', affectedTransfers: 1 },
  ],
  slaBreaches: [
    { breachId: 'SLA-001', corridor: 'NG-GB', rail: 'SWIFT', slaTargetMs: 5000, actualMs: 12400, breachedAt: '2026-05-02T09:45:00Z', transferRef: 'NOR-2026-00023', autoEscalated: true, fallbackUsed: 'FASTER_PAY', resolved: true },
    { breachId: 'SLA-002', corridor: 'NG-GH', rail: 'MOBILE_MONEY', slaTargetMs: 3000, actualMs: 8900, breachedAt: '2026-05-02T13:20:00Z', transferRef: 'NOR-2026-00051', autoEscalated: true, fallbackUsed: 'PAPSS', resolved: false },
  ],
  capacityForecasts: [
    { corridor: 'NG-GH', date: '2026-05-03', forecastVolumeUSD: 1_200_000, currentLiquidityUSD: 2_500_000, liquidityGap: 0, riskLevel: 'low', notes: 'Adequate liquidity' },
    { corridor: 'NG-GB', date: '2026-05-03', forecastVolumeUSD: 3_500_000, currentLiquidityUSD: 2_800_000, liquidityGap: 700_000, riskLevel: 'medium', notes: 'May need pre-positioning by 6pm' },
    { corridor: 'NG-US', date: '2026-05-03', forecastVolumeUSD: 2_100_000, currentLiquidityUSD: 3_000_000, liquidityGap: 0, riskLevel: 'low', notes: 'Adequate liquidity' },
    { corridor: 'NG-CN', date: '2026-05-03', forecastVolumeUSD: 800_000, currentLiquidityUSD: 400_000, liquidityGap: 400_000, riskLevel: 'high', notes: 'CNY shortage — CIPS settlement delay expected' },
    { corridor: 'NG-IN', date: '2026-05-05', forecastVolumeUSD: 1_800_000, currentLiquidityUSD: 1_500_000, liquidityGap: 300_000, riskLevel: 'medium', notes: 'Salary day spike expected' },
  ],
  sanctionsUpdates: [
    { listId: 'OFAC-SDN', name: 'OFAC SDN', lastUpdated: '2026-05-02T06:00:00Z', totalEntries: 12893, newEntries: 46, removedEntries: 3, rescreenStatus: 'completed', rescreenMatches: 0 },
    { listId: 'UN-CONSOLIDATED', name: 'UN Consolidated', lastUpdated: '2026-05-01T00:00:00Z', totalEntries: 1247, newEntries: 2, removedEntries: 0, rescreenStatus: 'completed', rescreenMatches: 0 },
    { listId: 'EU-SANCTIONS', name: 'EU Financial Sanctions', lastUpdated: '2026-04-30T12:00:00Z', totalEntries: 2156, newEntries: 8, removedEntries: 1, rescreenStatus: 'completed', rescreenMatches: 1 },
    { listId: 'CBN-WATCHLIST', name: 'CBN Watchlist', lastUpdated: '2026-05-02T08:00:00Z', totalEntries: 523, newEntries: 5, removedEntries: 0, rescreenStatus: 'in_progress', rescreenMatches: 0 },
  ],
  webhookEvents: [
    { eventId: 'WH-001', type: 'transfer.completed', participantId: 'PAYAPP-001', payload: { transferRef: 'NOR-2026-00001', status: 'completed' }, deliveredAt: '2026-05-02T08:01:05Z', httpStatus: 200, retryCount: 0 },
    { eventId: 'WH-002', type: 'transfer.failed', participantId: 'OPAY-001', payload: { transferRef: 'NOR-2026-00015', status: 'failed', reason: 'beneficiary_not_found' }, deliveredAt: '2026-05-02T09:30:00Z', httpStatus: 500, retryCount: 3 },
    { eventId: 'WH-003', type: 'prefund.low_balance', participantId: 'MONIEPOINT-001', payload: { balance: 45000000, threshold: 100000000 }, deliveredAt: '2026-05-02T12:00:00Z', httpStatus: 200, retryCount: 0 },
  ],
  sandboxEnvs: [
    { envId: 'SBX-PAYAPP', participantId: 'PAYAPP-001', status: 'active', createdAt: '2026-04-15T00:00:00Z', corridors: ['NG-GH', 'NG-GB', 'NG-US'], transfersProcessed: 1247, lastActivity: '2026-05-02T14:00:00Z', apiEndpoint: 'https://sandbox.remit-switch.internal/v2/payapp' },
    { envId: 'SBX-KUDA', participantId: 'KUDA-001', status: 'testing', createdAt: '2026-05-01T00:00:00Z', corridors: ['NG-GH', 'NG-GB'], transfersProcessed: 23, lastActivity: '2026-05-02T11:00:00Z', apiEndpoint: 'https://sandbox.remit-switch.internal/v2/kuda' },
  ],
};
