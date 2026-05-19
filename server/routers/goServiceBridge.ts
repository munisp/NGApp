import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getAllServiceConfigs, getServiceHealth } from "../adapters/goServiceAdapter";
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
    return configs.map(c => ({
      name: c.name,
      url: c.url,
      port: c.port,
      circuit: c.circuit.state,
      failures: c.circuit.failures,
      health: getServiceHealth(c.name),
    }));
  }),

  workflowCreate: protectedProcedure.input(z.object({ name: z.string() })).mutation(async ({ input }) => {
    return workflowAdapter.createWorkflow(input);
  }),
  workflowList: protectedProcedure.query(async () => {
    return workflowAdapter.listWorkflows();
  }),
  ledgerTransfer: protectedProcedure.input(z.object({ from: z.string(), to: z.string(), amount: z.number() })).mutation(async ({ input }) => {
    return tigerbeetleAdapter.createTransfer(input);
  }),
  ledgerBalance: protectedProcedure.input(z.object({ accountId: z.string() })).query(async ({ input }) => {
    return tigerbeetleAdapter.getAccountBalance(input);
  }),
  mdmCheckDevice: protectedProcedure.input(z.object({ deviceId: z.string() })).query(async ({ input }) => {
    return mdmAdapter.checkDevice(input);
  }),
  pbacAuthorize: protectedProcedure.input(z.object({ userId: z.string(), resource: z.string(), action: z.string() })).query(async ({ input }) => {
    return pbacAdapter.authorize(input);
  }),
  queueEnqueue: protectedProcedure.input(z.object({ payload: z.any() })).mutation(async ({ input }) => {
    return connectivityAdapter.enqueue(input);
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
  ussdCreateSession: protectedProcedure.input(z.object({ phoneNumber: z.string() })).mutation(async ({ input }) => {
    return ussdGatewayAdapter.createSession(input);
  }),
  ussdProcess: protectedProcedure.input(z.object({ sessionId: z.string(), input: z.string() })).mutation(async ({ input: i }) => {
    return ussdTxAdapter.processTransaction(i);
  }),
  orgTree: protectedProcedure.query(async () => {
    return hierarchyAdapter.getOrgTree();
  }),
  settlementInitiate: protectedProcedure.input(z.object({ batchId: z.string() })).mutation(async ({ input }) => {
    return settlementAdapter.initiateSettlement(input);
  }),
  settlementBatch: protectedProcedure.mutation(async () => {
    return settlementAdapter.createBatch();
  }),
  atUssdCallback: protectedProcedure.input(z.object({ sessionId: z.string(), text: z.string() })).mutation(async ({ input }) => {
    return atUssdAdapter.handleCallback(input);
  }),
  analyticsSearch: protectedProcedure.input(z.object({ query: z.string() })).query(async ({ input }) => {
    return opensearchAdapter.search(input);
  }),
  revenueReconcile: protectedProcedure.mutation(async () => {
    return revenueReconcilerAdapter.reconcile();
  }),
});
