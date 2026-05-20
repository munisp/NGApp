import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  getAllServiceConfigs,
  getServiceHealth,
} from "../adapters/goServiceAdapter";
import * as workflowAdapter from "../adapters/workflowAdapter";
import * as tigerbeetleAdapter from "../adapters/tigerbeetleAdapter";
import * as mdmAdapter from "../adapters/mdmAdapter";
import * as pbacAdapter from "../adapters/pbacAdapter";
import * as connectivityAdapter from "../adapters/connectivityAdapter";
import * as billingAdapter from "../adapters/billingAdapter";
import * as rbacAdapter from "../adapters/rbacAdapter";
import * as ussdGatewayAdapter from "../adapters/ussdGatewayAdapter";
import * as ussdTxAdapter from "../adapters/ussdTxAdapter";
import * as hierarchyAdapter from "../adapters/hierarchyAdapter";
import * as settlementAdapter from "../adapters/settlementAdapter";
import * as atUssdAdapter from "../adapters/atUssdAdapter";
import * as opensearchAdapter from "../adapters/opensearchAdapter";
import * as revenueReconcilerAdapter from "../adapters/revenueReconcilerAdapter";

export const goServiceBridgeRouter = router({
  serviceHealth: protectedProcedure.query(async () => {
    const configs = getAllServiceConfigs();
    const health = getServiceHealth();
    return configs.map(c => ({
      name: c.name,
      baseUrl: c.baseUrl,
      timeout: c.timeout,
      retries: c.retries,
      circuit: health[c.name]?.state ?? "closed",
      failures: health[c.name]?.failures ?? 0,
      health: health[c.name] ?? {
        state: "closed" as const,
        failures: 0,
        lastFailure: 0,
      },
    }));
  }),

  workflowCreate: protectedProcedure
    .input(
      z.object({
        name: z.string(),
        steps: z
          .array(z.object({ name: z.string(), type: z.string() }))
          .default([]),
      })
    )
    .mutation(async ({ input }) => {
      return workflowAdapter.createWorkflow(input);
    }),
  workflowList: protectedProcedure.query(async () => {
    return workflowAdapter.listWorkflows();
  }),
  ledgerTransfer: protectedProcedure
    .input(
      z.object({
        debitAccountId: z.string(),
        creditAccountId: z.string(),
        amount: z.number(),
        ledger: z.number().default(1),
        code: z.number().default(1),
      })
    )
    .mutation(async ({ input }) => {
      return tigerbeetleAdapter.createTransfer(input);
    }),
  ledgerBalance: protectedProcedure
    .input(z.object({ accountId: z.string() }))
    .query(async ({ input }) => {
      return tigerbeetleAdapter.getAccountBalance(input.accountId);
    }),
  mdmCheckDevice: protectedProcedure
    .input(
      z.object({ deviceId: z.string(), agentCode: z.string().default("") })
    )
    .query(async ({ input }) => {
      return mdmAdapter.checkDevice(input.deviceId, input.agentCode);
    }),
  pbacAuthorize: protectedProcedure
    .input(
      z.object({
        userId: z.string(),
        resource: z.string(),
        action: z.string(),
      })
    )
    .query(async ({ input }) => {
      return pbacAdapter.authorize(input.userId, input.resource, input.action);
    }),
  queueEnqueue: protectedProcedure
    .input(
      z.object({
        payload: z.record(z.string(), z.unknown()),
        priority: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      return connectivityAdapter.enqueue(input.payload, input.priority);
    }),
  queueStats: protectedProcedure.query(async () => {
    return connectivityAdapter.getQueueStats();
  }),
  billingCurrentPeriod: protectedProcedure.query(async () => {
    return billingAdapter.getCurrentPeriod();
  }),
  rbacListRoles: protectedProcedure.query(async () => {
    return rbacAdapter.listRoles();
  }),
  ussdCreateSession: protectedProcedure
    .input(
      z.object({
        phoneNumber: z.string(),
        serviceCode: z.string().default("*384#"),
      })
    )
    .mutation(async ({ input }) => {
      return ussdGatewayAdapter.createSession(
        input.phoneNumber,
        input.serviceCode
      );
    }),
  ussdProcess: protectedProcedure
    .input(
      z.object({
        sessionId: z.string(),
        input: z.string(),
        type: z.string().default("transfer"),
        amount: z.number().default(0),
        phoneNumber: z.string().default(""),
      })
    )
    .mutation(async ({ input: i }) => {
      return ussdTxAdapter.processTransaction(
        i.sessionId,
        i.type,
        i.amount,
        i.phoneNumber
      );
    }),
  orgTree: protectedProcedure.query(async () => {
    return hierarchyAdapter.getOrgTree();
  }),
  settlementInitiate: protectedProcedure
    .input(
      z.object({
        agentCode: z.string(),
        amount: z.number(),
        bankAccount: z.string(),
        bankCode: z.string(),
        reference: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      return settlementAdapter.initiateSettlement(input);
    }),
  settlementBatch: protectedProcedure
    .input(
      z.object({
        settlements: z
          .array(
            z.object({
              agentCode: z.string(),
              amount: z.number(),
              bankAccount: z.string(),
              bankCode: z.string(),
            })
          )
          .default([]),
      })
    )
    .mutation(async ({ input }) => {
      return settlementAdapter.createBatch(input.settlements);
    }),
  atUssdCallback: protectedProcedure
    .input(
      z.object({
        sessionId: z.string(),
        phoneNumber: z.string().default(""),
        networkCode: z.string().default(""),
        serviceCode: z.string().default(""),
        text: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      return atUssdAdapter.handleCallback(input);
    }),
  analyticsSearch: protectedProcedure
    .input(
      z.object({
        query: z.string(),
        index: z.string().default("transactions"),
      })
    )
    .query(async ({ input }) => {
      return opensearchAdapter.search(input);
    }),
  revenueReconcile: protectedProcedure.mutation(async () => {
    return revenueReconcilerAdapter.reconcile({
      periodStart: new Date(Date.now() - 86400000).toISOString(),
      periodEnd: new Date().toISOString(),
    });
  }),
});
