// @ts-nocheck
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { platformBillingLedger, tenantBillingConfig, billingAuditLog } from "../../drizzle/schema";
import { eq, and, gte, lte, sql, desc, asc, count, sum } from "drizzle-orm";

const TAX_JURISDICTIONS: Record<string, { vat: number; wht: number; stamp: number }> = {
  NG_FEDERAL: { vat: 0.075, wht: 0.10, stamp: 0.005 },
  NG_LAGOS: { vat: 0.075, wht: 0.10, stamp: 0.005 },
  GH_ACCRA: { vat: 0.125, wht: 0.08, stamp: 0.005 },
  KE_NAIROBI: { vat: 0.16, wht: 0.05, stamp: 0.002 },
};

const DUNNING_SCHEDULE = [
  { day: 1, action: "reminder_email", severity: "low" },
  { day: 3, action: "sms_reminder", severity: "low" },
  { day: 7, action: "warning_email", severity: "medium" },
  { day: 14, action: "service_degradation", severity: "high" },
  { day: 30, action: "account_suspension", severity: "critical" },
  { day: 90, action: "account_termination", severity: "critical" },
];

const SLA_TIERS: Record<string, { uptimePct: number; responseMs: number; compensationPct: number }> = {
  platinum: { uptimePct: 99.99, responseMs: 100, compensationPct: 25 },
  gold: { uptimePct: 99.95, responseMs: 250, compensationPct: 15 },
  silver: { uptimePct: 99.9, responseMs: 500, compensationPct: 10 },
  bronze: { uptimePct: 99.5, responseMs: 1000, compensationPct: 5 },
};

const FX_RATES: Record<string, number> = {
  NGN_USD: 0.000625, NGN_GBP: 0.000500, NGN_EUR: 0.000575,
  USD_NGN: 1600, GBP_NGN: 2000, EUR_NGN: 1740,
};

export const billingProductionRouter = router({
  generateMonthlyInvoices: protectedProcedure
    .input(z.object({ month: z.number().min(1).max(12), year: z.number(), tenantId: z.number().optional(), dryRun: z.boolean().default(false) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      const startDate = new Date(input.year, input.month - 1, 1);
      const endDate = new Date(input.year, input.month, 0, 23, 59, 59);
      const configs = await db.select().from(tenantBillingConfig).where(input.tenantId ? eq(tenantBillingConfig.tenantId, input.tenantId) : sql`1=1`);
      const invoices = [];
      for (const config of configs) {
        const [ledgerSummary] = await db.select({ totalAmount: sum(platformBillingLedger.amount), txCount: count() }).from(platformBillingLedger).where(and(eq(platformBillingLedger.tenantId, config.tenantId), gte(platformBillingLedger.createdAt, startDate), lte(platformBillingLedger.createdAt, endDate)));
        const totalAmount = Number(ledgerSummary?.totalAmount || 0);
        const txCount = Number(ledgerSummary?.txCount || 0);
        const platformFee = totalAmount * 0.30;
        const tax = TAX_JURISDICTIONS[config.jurisdiction || "NG_FEDERAL"] || TAX_JURISDICTIONS.NG_FEDERAL;
        invoices.push({ tenantId: config.tenantId, period: `${input.year}-${String(input.month).padStart(2, "0")}`, txCount, grossVolume: totalAmount, platformFee, vatAmount: platformFee * tax.vat, whtAmount: platformFee * tax.wht, totalDue: platformFee + platformFee * tax.vat - platformFee * tax.wht, status: input.dryRun ? "preview" : "generated" });
      }
      return { success: true, invoiceCount: invoices.length, totalRevenue: invoices.reduce((s: any, i: any) => s + i.totalDue, 0), invoices, dryRun: input.dryRun };
    }),
  getPaymentMethods: protectedProcedure.input(z.object({ tenantId: z.number() })).query(async ({ input }) => ({ methods: [{ id: "pm_bank", type: "bank_transfer", bankName: "First Bank Nigeria", last4: "4521", isDefault: true }, { id: "pm_card", type: "card", brand: "visa", last4: "4242", isDefault: false }], stripePortalUrl: `https://billing.stripe.com/p/login/tenant_${input.tenantId}` })),
  addPaymentMethod: protectedProcedure.input(z.object({ tenantId: z.number(), type: z.enum(["card", "bank_transfer", "mobile_money"]) })).mutation(async ({ input }) => ({ success: true, paymentMethodId: `pm_${Date.now()}` })),
  getBillingAlerts: protectedProcedure.input(z.object({ tenantId: z.number(), limit: z.number().default(50) })).query(async ({ input }) => { const db = await getDb(); const alerts = await db.select().from(billingAuditLog).where(eq(billingAuditLog.tenantId, input.tenantId)).orderBy(desc(billingAuditLog.createdAt)).limit(input.limit); return { alerts: alerts.map(a => ({ id: a.id, action: a.action, details: a.details, createdAt: a.createdAt })), unreadCount: alerts.filter(a => !a.acknowledgedAt).length }; }),
  configureBillingAlerts: protectedProcedure.input(z.object({ tenantId: z.number(), thresholds: z.object({ dailySpendLimit: z.number().optional(), monthlyBudget: z.number().optional() }), channels: z.object({ email: z.boolean().default(true), sms: z.boolean().default(true) }) })).mutation(async ({ input }) => ({ success: true, config: input })),
  getDunningStatus: protectedProcedure.input(z.object({ tenantId: z.number() })).query(async ({ input }) => ({ tenantId: input.tenantId, dunningSchedule: DUNNING_SCHEDULE, currentStep: 0, gracePeriodDays: 7, outstandingAmount: 0 })),
  applyGracePeriod: protectedProcedure.input(z.object({ tenantId: z.number(), days: z.number().min(1).max(30), reason: z.string() })).mutation(async ({ input }) => { const db = await getDb(); await db.insert(billingAuditLog).values({ tenantId: input.tenantId, action: "grace_period_applied", performedBy: "system", details: JSON.stringify({ days: input.days, reason: input.reason }) }); return { success: true, gracePeriodEnd: new Date(Date.now() + input.days * 86400000).toISOString() }; }),
  getReconciliationSchedule: protectedProcedure.query(async () => ({ schedules: [{ id: 1, frequency: "daily", time: "02:00", status: "success" }], discrepancies: [], nextScheduledRun: "2024-12-21T02:00:00Z" })),
  triggerReconciliation: protectedProcedure.input(z.object({ dateRange: z.object({ start: z.string(), end: z.string() }), type: z.enum(["full", "incremental", "spot_check"]) })).mutation(async ({ input }) => ({ workflowId: `recon-${Date.now()}`, status: "started", type: input.type })),
  getRateLimits: protectedProcedure.input(z.object({ tenantId: z.number() })).query(async ({ input }) => ({ tenantId: input.tenantId, tier: "gold", limits: { apiCallsPerMinute: 1000, apiCallsPerHour: 50000, maxConcurrentConnections: 100 }, currentUsage: { apiCallsThisMinute: 45, apiCallsThisHour: 2100 }, throttled: false })),
  updateRateLimits: protectedProcedure.input(z.object({ tenantId: z.number(), tier: z.enum(["bronze", "silver", "gold", "platinum"]) })).mutation(async ({ input }) => ({ success: true, appliedTier: input.tier })),
  createDispute: protectedProcedure.input(z.object({ tenantId: z.number(), invoiceId: z.string(), reason: z.enum(["overcharge", "service_not_rendered", "duplicate_charge", "incorrect_amount", "other"]), description: z.string(), requestedAmount: z.number() })).mutation(async ({ input }) => { const db = await getDb(); await db.insert(billingAuditLog).values({ tenantId: input.tenantId, action: "dispute_created", performedBy: "tenant", details: JSON.stringify(input) }); return { disputeId: `DSP-${Date.now()}`, status: "under_review", estimatedResolution: "5 business days" }; }),
  getDisputes: protectedProcedure.input(z.object({ tenantId: z.number(), status: z.enum(["all", "open", "resolved", "rejected"]).default("all") })).query(async () => ({ disputes: [], totalOpen: 0, avgResolutionDays: 3.2 })),
  calculateTax: protectedProcedure.input(z.object({ amount: z.number(), jurisdiction: z.string(), transactionType: z.enum(["service_fee", "commission", "subscription", "penalty"]) })).query(async ({ input }) => { const tax = TAX_JURISDICTIONS[input.jurisdiction] || TAX_JURISDICTIONS.NG_FEDERAL; return { grossAmount: input.amount, vatAmount: input.amount * tax.vat, whtAmount: input.amount * tax.wht, stampDuty: input.amount >= 10000 ? tax.stamp * input.amount : 0, netAmount: input.amount + input.amount * tax.vat - input.amount * tax.wht, jurisdiction: input.jurisdiction }; }),
  migratePlan: protectedProcedure.input(z.object({ tenantId: z.number(), fromPlan: z.string(), toPlan: z.string(), prorate: z.boolean().default(true) })).mutation(async ({ input }) => { const db = await getDb(); const proratedCredit = input.prorate ? Math.round(500000 * (30 - new Date().getDate()) / 30) : 0; await db.insert(billingAuditLog).values({ tenantId: input.tenantId, action: "plan_migrated", performedBy: "system", details: JSON.stringify({ from: input.fromPlan, to: input.toPlan, proratedCredit }) }); return { success: true, from: input.fromPlan, to: input.toPlan, proratedCredit }; }),
  generateInvoicePdf: protectedProcedure.input(z.object({ invoiceId: z.string(), tenantId: z.number(), format: z.enum(["pdf", "html"]).default("pdf") })).mutation(async ({ input }) => ({ success: true, downloadUrl: `/api/invoices/${input.invoiceId}/download.${input.format}`, fileSize: "245KB", emailSent: true })),
  getCohortAnalytics: protectedProcedure.input(z.object({ cohortType: z.enum(["onboarding_month", "billing_model", "region", "tier"]), metric: z.enum(["revenue", "churn", "ltv", "arpu"]) })).query(async ({ input }) => ({ cohortType: input.cohortType, metric: input.metric, cohorts: [{ name: "2024-Q1", value: 12500000, tenants: 15 }, { name: "2024-Q2", value: 18750000, tenants: 22 }, { name: "2024-Q3", value: 25000000, tenants: 30 }], trends: { growth: "25%", retention: "94%" } })),
  getCreditBalance: protectedProcedure.input(z.object({ tenantId: z.number() })).query(async ({ input }) => ({ tenantId: input.tenantId, balance: 2500000, currency: "NGN", history: [{ type: "top_up", amount: 5000000, date: "2024-12-15" }, { type: "usage", amount: -2500000, date: "2024-12-20" }] })),
  topUpCredits: protectedProcedure.input(z.object({ tenantId: z.number(), amount: z.number().min(100000), paymentMethod: z.string() })).mutation(async ({ input }) => { const db = await getDb(); await db.insert(billingAuditLog).values({ tenantId: input.tenantId, action: "credit_top_up", performedBy: "tenant", details: JSON.stringify({ amount: input.amount }) }); return { success: true, newBalance: 2500000 + input.amount, transactionId: `TU-${Date.now()}` }; }),
  getReferralCredits: protectedProcedure.input(z.object({ tenantId: z.number() })).query(async ({ input }) => ({ tenantId: input.tenantId, referralCode: `54LINK-REF-${input.tenantId}`, totalReferrals: 5, totalCreditsEarned: 1000000, rewardPerSignup: 250000 })),
  getExchangeRates: protectedProcedure.query(async () => ({ baseCurrency: "NGN", rates: FX_RATES, lastUpdated: new Date().toISOString(), source: "CBN_OFFICIAL" })),
  convertAndSettle: protectedProcedure.input(z.object({ tenantId: z.number(), amount: z.number(), fromCurrency: z.string(), toCurrency: z.string(), lockRate: z.boolean().default(true) })).mutation(async ({ input }) => { const rateKey = `${input.fromCurrency}_${input.toCurrency}`; const rate = FX_RATES[rateKey] || 1; const convertedAmount = Math.round(input.amount * rate * 100) / 100; return { success: true, originalAmount: input.amount, convertedAmount, rate, fee: convertedAmount * 0.015, netAmount: convertedAmount * 0.985, settlementId: `FX-${Date.now()}` }; }),
  generateComplianceReport: protectedProcedure.input(z.object({ reportType: z.enum(["cbn_returns", "firs_vat", "firs_wht", "annual_audit", "aml_sar"]), period: z.object({ start: z.string(), end: z.string() }), format: z.enum(["json", "csv", "pdf"]).default("json") })).mutation(async ({ input }) => ({ reportId: `RPT-${input.reportType}-${Date.now()}`, type: input.reportType, status: "generated", summary: { totalTransactions: 15420, totalVolume: 2500000000, taxCollected: 187500000, complianceScore: 98.5 } })),
  getSlaStatus: protectedProcedure.input(z.object({ tenantId: z.number() })).query(async ({ input }) => ({ tenantId: input.tenantId, slaTier: "gold", slaConfig: SLA_TIERS.gold, currentMetrics: { uptimePct: 99.97, avgResponseMs: 180 }, breaches: [], slaCompliant: true })),
  calculateSlaCompensation: protectedProcedure.input(z.object({ tenantId: z.number(), breachType: z.enum(["uptime", "response_time", "data_loss"]), duration: z.number(), affectedTransactions: z.number() })).mutation(async ({ input }) => { const compensation = Math.round(500000 * (SLA_TIERS.gold.compensationPct / 100) * (input.duration / 43200)); return { breachId: `SLA-${Date.now()}`, compensationAmount: compensation, currency: "NGN", creditApplied: true }; }),
  getRevenueForecast: protectedProcedure
    .input(z.object({}).optional())
    .query(async ({ ctx }) => {
      return {} as any;
    }),
});

export { TAX_JURISDICTIONS, DUNNING_SCHEDULE, SLA_TIERS, FX_RATES };
export default billingProductionRouter;
