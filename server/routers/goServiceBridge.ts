// @ts-nocheck
/**
 * Go Service Bridge Router (S88-16)
 *
 * tRPC procedures that expose all 15 Go microservice endpoints
 * through the Node.js API layer. Each procedure delegates to the
 * corresponding typed adapter with circuit breaker protection.
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";

// Import all adapters
import * as workflow from "../adapters/workflowAdapter";
import * as tigerbeetle from "../adapters/tigerbeetleAdapter";
import * as mdm from "../adapters/mdmAdapter";
import * as pbac from "../adapters/pbacAdapter";
import * as connectivity from "../adapters/connectivityAdapter";
import * as billing from "../adapters/billingAdapter";
import * as rbac from "../adapters/rbacAdapter";
import * as ussdGw from "../adapters/ussdGatewayAdapter";
import * as ussdTx from "../adapters/ussdTxAdapter";
import * as hierarchy from "../adapters/hierarchyAdapter";
import * as settlement from "../adapters/settlementAdapter";
import * as atUssd from "../adapters/atUssdAdapter";
import * as opensearch from "../adapters/opensearchAdapter";
import * as revenue from "../adapters/revenueReconcilerAdapter";
import { getAllServiceConfigs, getServiceHealth } from "../adapters/goServiceAdapter";

export const goServiceBridgeRouter = router({
  // ─── Service Health ──────────────────────────────────────────
  serviceHealth: protectedProcedure.query(async () => {
    const configs = getAllServiceConfigs();
    const health = getServiceHealth();
    return {
      services: configs.map((c: any) => ({
        name: c.name,
        baseUrl: c.baseUrl,
        circuit: health[c.name]?.state || "unknown",
        failures: health[c.name]?.failures || 0,
      })),
    };
  }),

  // ─── Workflow Orchestrator ───────────────────────────────────
  workflowCreate: protectedProcedure
    .input(z.object({
      name: z.string(),
      description: z.string().optional(),
      steps: z.array(z.object({ name: z.string(), type: z.string(), assigneeRole: z.string().optional() })),
    }))
    .mutation(async ({ input }) => workflow.createWorkflow(input)),

  workflowAdvance: protectedProcedure
    .input(z.object({ workflowId: z.string(), stepIndex: z.number() }))
    .mutation(async ({ input }) => workflow.advanceWorkflow(input.workflowId, input.stepIndex)),

  workflowList: protectedProcedure
    .input(z.object({ status: z.string().optional() }).optional())
    .query(async ({ input }) => workflow.listWorkflows(input?.status)),

  // ─── TigerBeetle Ledger ──────────────────────────────────────
  ledgerCreateAccount: protectedProcedure
    .input(z.object({ id: z.string(), ledger: z.number(), code: z.number() }))
    .mutation(async ({ input }) => tigerbeetle.createAccount(input.id, input.ledger, input.code)),

  ledgerTransfer: protectedProcedure
    .input(z.object({
      debitAccountId: z.string(),
      creditAccountId: z.string(),
      amount: z.number(),
      ledger: z.number(),
      code: z.number(),
      userData: z.string().optional(),
    }))
    .mutation(async ({ input }) => tigerbeetle.createTransfer(input)),

  ledgerBalance: protectedProcedure
    .input(z.object({ accountId: z.string() }))
    .query(async ({ input }) => tigerbeetle.getAccountBalance(input.accountId)),

  // ─── MDM Compliance ──────────────────────────────────────────
  mdmCheckDevice: protectedProcedure
    .input(z.object({ deviceId: z.string(), agentCode: z.string() }))
    .query(async ({ input }) => mdm.checkDevice(input.deviceId, input.agentCode)),

  mdmListDevices: protectedProcedure
    .input(z.object({ agentCode: z.string().optional() }).optional())
    .query(async ({ input }) => mdm.listDevices(input?.agentCode)),

  // ─── PBAC Authorization ──────────────────────────────────────
  pbacAuthorize: protectedProcedure
    .input(z.object({
      subject: z.string(),
      resource: z.string(),
      action: z.string(),
      context: z.record(z.unknown()).optional(),
    }))
    .query(async ({ input }) => pbac.authorize(input.subject, input.resource, input.action, input.context)),

  pbacListPolicies: protectedProcedure.query(async () => pbac.listPolicies()),

  pbacCreatePolicy: protectedProcedure
    .input(z.object({
      name: z.string(),
      effect: z.enum(["allow", "deny"]),
      subjects: z.array(z.string()),
      resources: z.array(z.string()),
      actions: z.array(z.string()),
      priority: z.number(),
    }))
    .mutation(async ({ input }) => pbac.createPolicy(input)),

  // ─── Connectivity Resilience ─────────────────────────────────
  queueEnqueue: protectedProcedure
    .input(z.object({ payload: z.unknown(), priority: z.number().optional() }))
    .mutation(async ({ input }) => connectivity.enqueue(input.payload, input.priority)),

  queueStats: protectedProcedure.query(async () => connectivity.getQueueStats()),

  queueDrain: protectedProcedure.mutation(async () => connectivity.drainQueue()),

  // ─── Billing Aggregator ──────────────────────────────────────
  billingCurrentPeriod: protectedProcedure.query(async () => billing.getCurrentPeriod()),

  billingSetModel: protectedProcedure
    .input(z.object({
      type: z.enum(["flat", "tiered", "volume", "per-transaction"]),
      rates: z.record(z.number()),
      effectiveDate: z.string(),
    }))
    .mutation(async ({ input }) => billing.setBillingModel(input)),

  billingGenerateInvoice: protectedProcedure
    .input(z.object({ periodId: z.string() }))
    .mutation(async ({ input }) => billing.generateInvoice(input.periodId)),

  // ─── RBAC Service ────────────────────────────────────────────
  rbacListRoles: protectedProcedure.query(async () => rbac.listRoles()),

  rbacCreateRole: protectedProcedure
    .input(z.object({ name: z.string(), permissions: z.array(z.string()), description: z.string().optional() }))
    .mutation(async ({ input }) => rbac.createRole(input.name, input.permissions, input.description)),

  rbacCheckPermission: protectedProcedure
    .input(z.object({ userId: z.string(), permission: z.string() }))
    .query(async ({ input }) => rbac.checkPermission(input.userId, input.permission)),

  // ─── USSD Gateway ────────────────────────────────────────────
  ussdCreateSession: protectedProcedure
    .input(z.object({ phoneNumber: z.string(), serviceCode: z.string() }))
    .mutation(async ({ input }) => ussdGw.createSession(input.phoneNumber, input.serviceCode)),

  ussdCallback: protectedProcedure
    .input(z.object({ sessionId: z.string(), input: z.string() }))
    .mutation(async ({ input }) => ussdGw.handleCallback(input.sessionId, input.input)),

  ussdStats: protectedProcedure.query(async () => ussdGw.getStats()),

  // ─── USSD Transaction Processor ──────────────────────────────
  ussdProcess: protectedProcedure
    .input(z.object({ sessionId: z.string(), type: z.string(), amount: z.number(), phoneNumber: z.string() }))
    .mutation(async ({ input }) => ussdTx.processTransaction(input.sessionId, input.type, input.amount, input.phoneNumber)),

  ussdValidate: protectedProcedure
    .input(z.object({ type: z.string(), amount: z.number(), phoneNumber: z.string() }))
    .query(async ({ input }) => ussdTx.validateTransaction(input.type, input.amount, input.phoneNumber)),

  // ─── Hierarchy Engine ────────────────────────────────────────
  orgTree: protectedProcedure
    .input(z.object({ rootId: z.string().optional() }).optional())
    .query(async ({ input }) => hierarchy.getOrgTree(input?.rootId)),

  agentHierarchy: protectedProcedure
    .input(z.object({ agentCode: z.string() }))
    .query(async ({ input }) => hierarchy.getAgentHierarchy(input.agentCode)),

  // ─── Settlement Gateway ──────────────────────────────────────
  settlementInitiate: protectedProcedure
    .input(z.object({
      agentCode: z.string(),
      amount: z.number(),
      bankAccount: z.string(),
      bankCode: z.string(),
      reference: z.string().optional(),
    }))
    .mutation(async ({ input }) => settlement.initiateSettlement(input)),

  settlementStatus: protectedProcedure
    .input(z.object({ settlementId: z.string() }))
    .query(async ({ input }) => settlement.getSettlementStatus(input.settlementId)),

  settlementBatch: protectedProcedure
    .input(z.object({
      settlements: z.array(z.object({
        agentCode: z.string(),
        amount: z.number(),
        bankAccount: z.string(),
        bankCode: z.string(),
      })),
    }))
    .mutation(async ({ input }) => settlement.createBatch(input.settlements)),

  // ─── AT USSD Handler ─────────────────────────────────────────
  atUssdCallback: protectedProcedure
    .input(z.object({
      sessionId: z.string(),
      phoneNumber: z.string(),
      networkCode: z.string(),
      serviceCode: z.string(),
      text: z.string(),
    }))
    .mutation(async ({ input }) => atUssd.handleCallback(input)),

  atUssdSessions: protectedProcedure
    .input(z.object({ limit: z.number().optional() }).optional())
    .query(async ({ input }) => atUssd.listSessions(input?.limit)),

  // ─── OpenSearch Analytics ────────────────────────────────────
  analyticsSearch: protectedProcedure
    .input(z.object({
      index: z.string(),
      query: z.string(),
      from: z.number().optional(),
      size: z.number().optional(),
    }))
    .query(async ({ input }) => opensearch.search(input)),

  analyticsAggregate: protectedProcedure
    .input(z.object({
      index: z.string(),
      aggregations: z.record(z.unknown()),
    }))
    .query(async ({ input }) => opensearch.aggregate(input)),

  // ─── Revenue Reconciler ──────────────────────────────────────
  revenueReconcile: protectedProcedure
    .input(z.object({
      periodStart: z.string(),
      periodEnd: z.string(),
      agentCode: z.string().optional(),
      includeDetails: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => revenue.reconcile(input)),

  revenueReport: protectedProcedure
    .input(z.object({
      periodStart: z.string(),
      periodEnd: z.string(),
      agentCode: z.string().optional(),
    }))
    .query(async ({ input }) => revenue.generateReport(input)),
});
