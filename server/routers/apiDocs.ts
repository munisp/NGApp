import { router, publicProcedure } from "../_core/trpc";

export const apiDocsRouter = router({
  getSpec: publicProcedure.query(() => {
    return {
      openapi: "3.0.3",
      info: {
        title: "54Link POS Shell API",
        version: "1.0.0",
        description: "Comprehensive POS platform API with 359 routers covering transactions, agents, merchants, compliance, analytics, and more.",
      },
      servers: [{ url: "/api/trpc", description: "tRPC endpoint" }],
      tags: [
        { name: "transactions", description: "Cash In/Out, Transfer, Card, QR, NFC, Airtime, Bills" },
        { name: "agents", description: "Agent management, onboarding, performance, tiers" },
        { name: "merchants", description: "Merchant onboarding, settlement, analytics" },
        { name: "fraud", description: "Fraud detection, alerts, scoring, investigation" },
        { name: "compliance", description: "KYC, AML, regulatory reporting, audit" },
        { name: "analytics", description: "Dashboards, reports, real-time metrics" },
        { name: "settlement", description: "Batch processing, reconciliation, netting" },
        { name: "disputes", description: "Customer disputes, arbitration, refunds" },
        { name: "loyalty", description: "Points, tiers, rewards, challenges" },
        { name: "notifications", description: "SMS, email, push, in-app" },
        { name: "system", description: "Health, config, feature flags, monitoring" },
      ],
      routerCount: 359,
      databaseTables: 127,
      microservices: {
        go: "tb-sidecar (TigerBeetle offline ledger)",
        rust: "fraud-engine (real-time fraud detection)",
        python: "ml-service (ML models for churn, fraud, forecasting)",
      },
    };
  }),
});
