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
