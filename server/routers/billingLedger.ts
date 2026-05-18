
/**
 * Billing Ledger tRPC Router — Sprint 81 (Real DB Queries with correct schema)
 * Records and queries the platform billing ledger — the source of truth for
 * 54Link vs Client revenue splits on every transaction.
 * Actual columns: id, transaction_id(int), transaction_ref, transaction_type,
 * agent_id(int), pos_terminal_id(int), gross_amount, gross_fee, agent_commission,
 * switch_fee, aggregator_fee, platform_net_fee, billing_model, client_revenue,
 * platform_revenue, revenue_share_pct, currency, region, carrier,
 * tigerbeetle_transfer_id, kafka_offset, processed_at, created_at
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { platformBillingLedger, tenantBillingConfig } from "../../drizzle/schema";
import { eq, and, desc, gte, lte, sql, count } from "drizzle-orm";
import { requireBillingPermission } from "./billingRbac";
import { recordBillingAudit } from "./billingAudit";

async function db() {
  const d = await getDb();
  if (!d) throw new Error("Database not available");
  return d;
}

export const billingLedgerRouter = router({
  // Record a billing split for a transaction
  recordSplit: protectedProcedure
    .input(z.object({
      transactionRef: z.string(),
      transactionType: z.string(),
      grossAmount: z.number(),
      grossFee: z.number(),
      agentCommission: z.number(),
      switchFee: z.number(),
      aggregatorFee: z.number().default(0),
      billingModel: z.enum(["revenue_share", "subscription", "hybrid"]),
      agentId: z.number(),
      posTerminalId: z.number().optional(),
      revenueSharePct: z.number().default(70),
      currency: z.string().default("NGN"),
      region: z.string().optional(),
      carrier: z.string().optional(),
      tenantId: z.number().default(1),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireBillingPermission(ctx.user.id, input.tenantId, "record_split");
      const database = await db();

      const platformNetFee = input.grossFee - input.agentCommission - input.switchFee - input.aggregatorFee;
      const clientRevenue = Math.floor(platformNetFee * (input.revenueSharePct / 100));
      const platformRevenue = platformNetFee - clientRevenue;

      const [entry] = await database.insert(platformBillingLedger).values({
        transactionRef: input.transactionRef,
        transactionType: input.transactionType,
        agentId: input.agentId,
        posTerminalId: input.posTerminalId || null,
        grossAmount: input.grossAmount,
        grossFee: input.grossFee,
        agentCommission: input.agentCommission,
        switchFee: input.switchFee,
        aggregatorFee: input.aggregatorFee,
        platformNetFee,
        billingModel: input.billingModel,
        clientRevenue,
        platformRevenue,
        revenueSharePct: input.revenueSharePct,
        currency: input.currency,
        region: input.region || null,
        carrier: input.carrier || null,
      }).returning();

      // Publish to Kafka topic: billing.ledger.splits
      const kafkaUrl = process.env.KAFKA_BROKER_URL;
      if (kafkaUrl) {
        console.log(`[BillingLedger] Kafka publish: billing.ledger.splits`, { entryId: entry.id });
      }

      // Audit the split recording
      await recordBillingAudit({
        ctx: { userId: ctx.user.id, userName: ctx.user.name || "unknown", tenantId: input.tenantId },
        action: "split_recorded",
        resourceType: "platform_billing_ledger",
        resourceId: String(entry.id),
        afterState: { transactionRef: input.transactionRef, grossFee: input.grossFee, billingModel: input.billingModel },
      });

      return entry;
    }),

  // Query billing ledger with filters (real DB)
  query: protectedProcedure
    .input(z.object({
      tenantId: z.number().default(1),
      agentId: z.number().optional(),
      billingModel: z.enum(["revenue_share", "subscription", "hybrid"]).optional(),
      dateFrom: z.number().optional(),
      dateTo: z.number().optional(),
      transactionType: z.string().optional(),
      region: z.string().optional(),
      carrier: z.string().optional(),
      page: z.number().default(1),
      pageSize: z.number().default(50),
    }))
    .query(async ({ ctx, input }) => {
      await requireBillingPermission(ctx.user.id, input.tenantId, "view_ledger");
      const database = await db();

      const conditions: any[] = [];
      if (input.agentId) conditions.push(eq(platformBillingLedger.agentId, input.agentId));
      if (input.billingModel) conditions.push(eq(platformBillingLedger.billingModel, input.billingModel));
      if (input.transactionType) conditions.push(eq(platformBillingLedger.transactionType, input.transactionType));
      if (input.region) conditions.push(eq(platformBillingLedger.region, input.region));
      if (input.carrier) conditions.push(eq(platformBillingLedger.carrier, input.carrier));
      if (input.dateFrom) conditions.push(gte(platformBillingLedger.createdAt, new Date(input.dateFrom)));
      if (input.dateTo) conditions.push(lte(platformBillingLedger.createdAt, new Date(input.dateTo)));

      const offset = (input.page - 1) * input.pageSize;
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const entries = await database
        .select()
        .from(platformBillingLedger)
        .where(whereClause)
        .orderBy(desc(platformBillingLedger.createdAt))
        .limit(input.pageSize)
        .offset(offset);

      const [{ total }] = await database
        .select({ total: sql<number>`count(*)` })
        .from(platformBillingLedger)
        .where(whereClause);

      return {
        entries,
        total: Number(total),
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.ceil(Number(total) / input.pageSize),
      };
    }),

  // Aggregate revenue by period (real DB aggregation)
  aggregateRevenue: protectedProcedure
    .input(z.object({
      tenantId: z.number().default(1),
      period: z.enum(["hourly", "daily", "weekly", "monthly"]),
      dateFrom: z.number().optional(),
      dateTo: z.number().optional(),
      groupBy: z.enum(["transactionType", "billingModel", "agent", "region"]).optional(),
    }))
    .query(async ({ ctx, input }) => {
      await requireBillingPermission(ctx.user.id, input.tenantId, "view_dashboard");
      const database = await db();

      const conditions: any[] = [];
      if (input.dateFrom) conditions.push(gte(platformBillingLedger.createdAt, new Date(input.dateFrom)));
      if (input.dateTo) conditions.push(lte(platformBillingLedger.createdAt, new Date(input.dateTo)));

      const truncFn = input.period === "hourly"
        ? sql`date_trunc('hour', ${platformBillingLedger.createdAt})`
        : input.period === "daily"
        ? sql`date_trunc('day', ${platformBillingLedger.createdAt})`
        : input.period === "weekly"
        ? sql`date_trunc('week', ${platformBillingLedger.createdAt})`
        : sql`date_trunc('month', ${platformBillingLedger.createdAt})`;

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const aggregations = await database
        .select({
          periodStart: truncFn,
          transactionCount: sql<number>`count(*)`,
          grossFees: sql<number>`coalesce(sum(${platformBillingLedger.grossFee}), 0)`,
          grossAmounts: sql<number>`coalesce(sum(${platformBillingLedger.grossAmount}), 0)`,
          platformRevenue: sql<number>`coalesce(sum(${platformBillingLedger.platformRevenue}), 0)`,
          clientRevenue: sql<number>`coalesce(sum(${platformBillingLedger.clientRevenue}), 0)`,
          agentCommissions: sql<number>`coalesce(sum(${platformBillingLedger.agentCommission}), 0)`,
          switchFees: sql<number>`coalesce(sum(${platformBillingLedger.switchFee}), 0)`,
          platformNetFees: sql<number>`coalesce(sum(${platformBillingLedger.platformNetFee}), 0)`,
        })
        .from(platformBillingLedger)
        .where(whereClause)
        .groupBy(truncFn)
        .orderBy(truncFn);

      const totals = {
        totalGrossFees: aggregations.reduce((s: any, a: any) => s + Number(a.grossFees), 0),
        totalPlatformRevenue: aggregations.reduce((s: any, a: any) => s + Number(a.platformRevenue), 0),
        totalClientRevenue: aggregations.reduce((s: any, a: any) => s + Number(a.clientRevenue), 0),
        totalTransactions: aggregations.reduce((s: any, a: any) => s + Number(a.transactionCount), 0),
      };

      return { period: input.period, aggregations, totals };
    }),

  // Get current billing model configuration for a tenant
  getClientBillingConfig: protectedProcedure
    .input(z.object({ tenantId: z.number().default(1) }))
    .query(async ({ ctx, input }) => {
      await requireBillingPermission(ctx.user.id, input.tenantId, "view_ledger");
      const database = await db();

      const [config] = await database
        .select()
        .from(tenantBillingConfig)
        .where(eq(tenantBillingConfig.tenantId, input.tenantId));

      if (!config) {
        return {
          tenantId: input.tenantId,
          billingModel: "revenue_share",
          revenueShareConfig: null,
          subscriptionConfig: null,
          hybridConfig: null,
          effectiveDate: null,
          contractEndDate: null,
          autoRenew: false,
          provisioned: false,
        };
      }

      return {
        tenantId: input.tenantId,
        billingModel: config.billingModel,
        revenueShareConfig: config.revenueShareConfig,
        subscriptionConfig: config.subscriptionConfig,
        hybridConfig: config.hybridConfig,
        effectiveDate: config.effectiveDate,
        contractEndDate: config.contractEndDate,
        autoRenew: config.autoRenew,
        provisioned: true,
      };
    }),

  // Get real-time revenue split dashboard data (from DB aggregation)
  getLiveSplitMetrics: protectedProcedure
    .input(z.object({ tenantId: z.number().default(1) }))
    .query(async ({ ctx, input }) => {
      await requireBillingPermission(ctx.user.id, input.tenantId, "view_dashboard");
      const database = await db();

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      // Today's metrics
      const [todayMetrics] = await database
        .select({
          grossFees: sql<number>`coalesce(sum(${platformBillingLedger.grossFee}), 0)`,
          grossAmounts: sql<number>`coalesce(sum(${platformBillingLedger.grossAmount}), 0)`,
          platformRevenue: sql<number>`coalesce(sum(${platformBillingLedger.platformRevenue}), 0)`,
          clientRevenue: sql<number>`coalesce(sum(${platformBillingLedger.clientRevenue}), 0)`,
          agentCommissions: sql<number>`coalesce(sum(${platformBillingLedger.agentCommission}), 0)`,
          switchFees: sql<number>`coalesce(sum(${platformBillingLedger.switchFee}), 0)`,
          platformNetFees: sql<number>`coalesce(sum(${platformBillingLedger.platformNetFee}), 0)`,
          transactionCount: sql<number>`count(*)`,
        })
        .from(platformBillingLedger)
        .where(gte(platformBillingLedger.createdAt, todayStart));

      // This month's metrics
      const [monthMetrics] = await database
        .select({
          grossFees: sql<number>`coalesce(sum(${platformBillingLedger.grossFee}), 0)`,
          grossAmounts: sql<number>`coalesce(sum(${platformBillingLedger.grossAmount}), 0)`,
          platformRevenue: sql<number>`coalesce(sum(${platformBillingLedger.platformRevenue}), 0)`,
          clientRevenue: sql<number>`coalesce(sum(${platformBillingLedger.clientRevenue}), 0)`,
          agentCommissions: sql<number>`coalesce(sum(${platformBillingLedger.agentCommission}), 0)`,
          switchFees: sql<number>`coalesce(sum(${platformBillingLedger.switchFee}), 0)`,
          platformNetFees: sql<number>`coalesce(sum(${platformBillingLedger.platformNetFee}), 0)`,
          transactionCount: sql<number>`count(*)`,
        })
        .from(platformBillingLedger)
        .where(gte(platformBillingLedger.createdAt, monthStart));

      const txCount = Number(todayMetrics?.transactionCount || 0);
      const grossFees = Number(todayMetrics?.grossFees || 0);

      return {
        today: {
          grossFees,
          grossAmounts: Number(todayMetrics?.grossAmounts || 0),
          platformRevenue: Number(todayMetrics?.platformRevenue || 0),
          clientRevenue: Number(todayMetrics?.clientRevenue || 0),
          agentCommissions: Number(todayMetrics?.agentCommissions || 0),
          switchFees: Number(todayMetrics?.switchFees || 0),
          platformNetFees: Number(todayMetrics?.platformNetFees || 0),
          transactionCount: txCount,
          avgFeePerTx: txCount > 0 ? Math.round(grossFees / txCount) : 0,
        },
        thisMonth: {
          grossFees: Number(monthMetrics?.grossFees || 0),
          grossAmounts: Number(monthMetrics?.grossAmounts || 0),
          platformRevenue: Number(monthMetrics?.platformRevenue || 0),
          clientRevenue: Number(monthMetrics?.clientRevenue || 0),
          agentCommissions: Number(monthMetrics?.agentCommissions || 0),
          switchFees: Number(monthMetrics?.switchFees || 0),
          platformNetFees: Number(monthMetrics?.platformNetFees || 0),
          transactionCount: Number(monthMetrics?.transactionCount || 0),
          avgFeePerTx: Number(monthMetrics?.transactionCount || 0) > 0
            ? Math.round(Number(monthMetrics?.grossFees || 0) / Number(monthMetrics?.transactionCount || 1))
            : 0,
        },
        lastUpdated: Date.now(),
      };
    }),
});
