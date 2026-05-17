/**
 * Platform Proxy tRPC Router
 * Proxies all 200+ platform microservices through the tRPC layer.
 * Each sub-router maps to one microservice domain.
 *
 * Services are called via platformFetch() which:
 *  - Injects mTLS client certificates (getMtlsAgent)
 *  - Adds Authorization: Bearer <PLATFORM_API_KEY>
 *  - Targets PLATFORM_BASE_URL (APISix gateway)
 *
 * Default base URL: http://localhost:8080 (APISix dev gateway)
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { proxyFetch } from "../_core/platformClient";
import { ENV } from "../_core/env";

// ── Helper ────────────────────────────────────────────────────────────────────
async function proxyGet(path: string, params?: Record<string, string>) {
  const url = new URL(path, ENV.platformBaseUrl);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await proxyFetch(url.toString(), { method: "GET" });
  if (!res.ok) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Platform service error: ${res.status}` });
  return res.json();
}

async function proxyPost(path: string, body: unknown) {
  const url = `${ENV.platformBaseUrl}${path}`;
  const res = await proxyFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Platform service error: ${res.status}` });
  return res.json();
}
async function proxyPutt(path: string, body: unknown) {
  const url = `${ENV.platformBaseUrl}${path}`;
  const res = await proxyFetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Platform service error: ${res.status}` });
  return res.json();
}

async function proxyDelete(path: string) {
  const url = `${ENV.platformBaseUrl}${path}`;
  const res = await proxyFetch(url, { method: "DELETE" });
  if (!res.ok) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Platform service error: ${res.status}` });
  return res.json();
}

export const platformProxyRouter = router({

  // ── Core Banking (Go) ──────────────────────────────────────────────────────
  coreBanking: router({
    accountBalance: protectedProcedure
      .input(z.object({ accountNumber: z.string() }))
      .query(({ input }) => proxyGet(`/v1/core-banking/accounts/${input.accountNumber}/balance`)),
    accountStatement: protectedProcedure
      .input(z.object({ accountNumber: z.string(), from: z.string(), to: z.string() }))
      .query(({ input }) => proxyGet(`/v1/core-banking/accounts/${input.accountNumber}/statement`, { from: input.from, to: input.to })),
    transfer: protectedProcedure
      .input(z.object({ from: z.string(), to: z.string(), amount: z.number(), narration: z.string() }))
      .mutation(({ input }) => proxyPost("/v1/core-banking/transfers", input)),
    reversal: protectedProcedure
      .input(z.object({ transactionRef: z.string(), reason: z.string() }))
      .mutation(({ input }) => proxyPost("/v1/core-banking/reversals", input)),
    nameEnquiry: protectedProcedure
      .input(z.object({ accountNumber: z.string(), bankCode: z.string() }))
      .query(({ input }) => proxyGet("/v1/core-banking/name-enquiry", { accountNumber: input.accountNumber, bankCode: input.bankCode })),
  }),

  // ── Float Management (Go) ──────────────────────────────────────────────────
  float: router({
    balance: protectedProcedure
      .input(z.object({ agentId: z.string() }))
      .query(({ input }) => proxyGet(`/v1/float/agents/${input.agentId}/balance`)),
    topUp: protectedProcedure
      .input(z.object({ agentId: z.string(), amount: z.number(), channel: z.string() }))
      .mutation(({ input }) => proxyPost("/v1/float/top-up", input)),
    history: protectedProcedure
      .input(z.object({ agentId: z.string(), page: z.number().default(1), limit: z.number().default(20) }))
      .query(({ input }) => proxyGet(`/v1/float/agents/${input.agentId}/history`, { page: String(input.page), limit: String(input.limit) })),
    lock: protectedProcedure
      .input(z.object({ agentId: z.string(), amount: z.number(), ref: z.string() }))
      .mutation(({ input }) => proxyPost("/v1/float/lock", input)),
    unlock: protectedProcedure
      .input(z.object({ lockRef: z.string() }))
      .mutation(({ input }) => proxyPost("/v1/float/unlock", input)),
  }),

  // ── KYC Service (Go) ──────────────────────────────────────────────────────
  kyc: router({
    initiateLiveness: protectedProcedure
      .input(z.object({ agentId: z.string(), challenge: z.string().optional() }))
      .mutation(({ input }) => proxyPost("/v1/kyc/liveness/initiate", input)),
    submitLiveness: protectedProcedure
      .input(z.object({ sessionId: z.string(), videoUrl: z.string() }))
      .mutation(({ input }) => proxyPost("/v1/kyc/liveness/submit", input)),
    initiateOcr: protectedProcedure
      .input(z.object({ sessionId: z.string(), docType: z.string(), imageUrl: z.string() }))
      .mutation(({ input }) => proxyPost("/v1/kyc/ocr/initiate", input)),
    getStatus: protectedProcedure
      .input(z.object({ sessionId: z.string() }))
      .query(({ input }) => proxyGet(`/v1/kyc/sessions/${input.sessionId}`)),
    bvnVerify: protectedProcedure
      .input(z.object({ bvn: z.string(), dob: z.string() }))
      .mutation(({ input }) => proxyPost("/v1/kyc/bvn/verify", input)),
    ninVerify: protectedProcedure
      .input(z.object({ nin: z.string() }))
      .mutation(({ input }) => proxyPost("/v1/kyc/nin/verify", input)),
  }),

  // ── Geofencing Service (Go) ────────────────────────────────────────────────
  geofencing: router({
    checkZone: protectedProcedure
      .input(z.object({ lat: z.number(), lng: z.number(), agentId: z.string() }))
      .query(({ input }) => proxyGet("/v1/geofencing/check", { lat: String(input.lat), lng: String(input.lng), agentId: input.agentId })),
    zones: protectedProcedure.query(() => proxyGet("/v1/geofencing/zones")),
    createZone: protectedProcedure
      .input(z.object({ name: z.string(), type: z.string(), coordinates: z.array(z.object({ lat: z.number(), lng: z.number() })), radius: z.number().optional() }))
      .mutation(({ input }) => proxyPost("/v1/geofencing/zones", input)),
    agentLocation: protectedProcedure
      .input(z.object({ agentId: z.string(), lat: z.number(), lng: z.number(), accuracy: z.number().optional() }))
      .mutation(({ input }) => proxyPost("/v1/geofencing/agent-location", input)),
  }),

  // ── Offline Queue / Resilience (Rust) ─────────────────────────────────────
  offline: router({
    enqueue: protectedProcedure
      .input(z.object({ agentId: z.string(), payload: z.record(z.string(), z.unknown()), type: z.string() }))
      .mutation(({ input }) => proxyPost("/v1/offline/queue", input)),
    flush: protectedProcedure
      .input(z.object({ agentId: z.string() }))
      .mutation(({ input }) => proxyPost("/v1/offline/flush", input)),
    status: protectedProcedure
      .input(z.object({ agentId: z.string() }))
      .query(({ input }) => proxyGet(`/v1/offline/agents/${input.agentId}/status`)),
    queueDepth: protectedProcedure
      .input(z.object({ agentId: z.string() }))
      .query(({ input }) => proxyGet(`/v1/offline/agents/${input.agentId}/depth`)),
  }),

  // ── TigerBeetle Ledger (Rust) ──────────────────────────────────────────────
  ledger: router({
    createAccount: protectedProcedure
      .input(z.object({ id: z.string(), ledger: z.number(), code: z.number(), flags: z.number().optional() }))
      .mutation(({ input }) => proxyPost("/v1/ledger/accounts", input)),
    createTransfer: protectedProcedure
      .input(z.object({ debitAccountId: z.string(), creditAccountId: z.string(), amount: z.bigint(), ledger: z.number(), code: z.number() }))
      .mutation(({ input }) => proxyPost("/v1/ledger/transfers", { ...input, amount: input.amount.toString() })),
    lookupAccount: protectedProcedure
      .input(z.object({ id: z.string() }))
      .query(({ input }) => proxyGet(`/v1/ledger/accounts/${input.id}`)),
    lookupTransfer: protectedProcedure
      .input(z.object({ id: z.string() }))
      .query(({ input }) => proxyGet(`/v1/ledger/transfers/${input.id}`)),
  }),

  // ── Fraud Detection / ML (Python) ─────────────────────────────────────────
  fraud: router({
    score: protectedProcedure
      .input(z.object({ transactionRef: z.string(), amount: z.number(), agentId: z.string(), channel: z.string(), lat: z.number().optional(), lng: z.number().optional() }))
      .mutation(({ input }) => proxyPost("/v1/fraud/score", input)),
    report: protectedProcedure
      .input(z.object({ agentId: z.string(), from: z.string(), to: z.string() }))
      .query(({ input }) => proxyGet("/v1/fraud/report", { agentId: input.agentId, from: input.from, to: input.to })),
    amlCheck: protectedProcedure
      .input(z.object({ customerId: z.string(), amount: z.number(), counterparty: z.string() }))
      .mutation(({ input }) => proxyPost("/v1/fraud/aml-check", input)),
    blacklistCheck: protectedProcedure
      .input(z.object({ bvn: z.string().optional(), nin: z.string().optional(), phone: z.string().optional() }))
      .query(({ input }) => proxyGet("/v1/fraud/blacklist-check", Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined) as [string, string][])),
    ),
  }),

  // ── NIBSS / NIP (Go) ──────────────────────────────────────────────────────
  nibss: router({
    nameEnquiry: protectedProcedure
      .input(z.object({ accountNumber: z.string(), bankCode: z.string() }))
      .query(({ input }) => proxyGet("/v1/nibss/name-enquiry", input)),
    transfer: protectedProcedure
      .input(z.object({ sessionId: z.string(), amount: z.number(), debitAccount: z.string(), creditAccount: z.string(), creditBankCode: z.string(), narration: z.string() }))
      .mutation(({ input }) => proxyPost("/v1/nibss/transfer", input)),
    status: protectedProcedure
      .input(z.object({ sessionId: z.string() }))
      .query(({ input }) => proxyGet(`/v1/nibss/status/${input.sessionId}`)),
  }),

  // ── USSD (Go) ─────────────────────────────────────────────────────────────
  ussd: router({
    session: protectedProcedure
      .input(z.object({ sessionId: z.string(), phoneNumber: z.string(), text: z.string(), serviceCode: z.string() }))
      .mutation(({ input }) => proxyPost("/v1/ussd/session", input)),
    history: protectedProcedure
      .input(z.object({ phoneNumber: z.string(), page: z.number().default(1) }))
      .query(({ input }) => proxyGet("/v1/ussd/history", { phoneNumber: input.phoneNumber, page: String(input.page) })),
  }),

  // ── Communication Hub / Termii (Python) ───────────────────────────────────
  comms: router({
    sendSms: protectedProcedure
      .input(z.object({ to: z.string(), message: z.string(), channel: z.enum(["sms", "whatsapp", "rcs", "voice"]).default("sms") }))
      .mutation(({ input }) => proxyPost("/v1/comms/send", input)),
    sendOtp: protectedProcedure
      .input(z.object({ phone: z.string(), channel: z.enum(["sms", "whatsapp"]).default("sms") }))
      .mutation(({ input }) => proxyPost("/v1/comms/otp/send", input)),
    verifyOtp: protectedProcedure
      .input(z.object({ phone: z.string(), otp: z.string() }))
      .mutation(({ input }) => proxyPost("/v1/comms/otp/verify", input)),
    sendReceipt: protectedProcedure
      .input(z.object({ transactionRef: z.string(), channel: z.enum(["sms", "whatsapp", "email"]).default("sms") }))
      .mutation(({ input }) => proxyPost("/v1/comms/receipt", input)),
    whatsappTemplate: protectedProcedure
      .input(z.object({ to: z.string(), templateName: z.string(), params: z.record(z.string(), z.string()) }))
      .mutation(({ input }) => proxyPost("/v1/comms/whatsapp/template", input)),
    telegramNotify: protectedProcedure
      .input(z.object({ chatId: z.string(), message: z.string() }))
      .mutation(({ input }) => proxyPost("/v1/comms/telegram/notify", input)),
  }),

  // ── Analytics / BI (Python) ───────────────────────────────────────────────
  analytics: router({
    agentPerformance: protectedProcedure
      .input(z.object({ agentId: z.string(), period: z.enum(["day", "week", "month", "year"]).default("month") }))
      .query(({ input }) => proxyGet("/v1/analytics/agent-performance", input)),
    transactionHeatmap: protectedProcedure
      .input(z.object({ from: z.string(), to: z.string(), resolution: z.enum(["hour", "day", "week"]).default("day") }))
      .query(({ input }) => proxyGet("/v1/analytics/transaction-heatmap", input)),
    revenueForcast: protectedProcedure
      .input(z.object({ months: z.number().default(3) }))
      .query(({ input }) => proxyGet("/v1/analytics/revenue-forecast", { months: String(input.months) })),
    churnPrediction: protectedProcedure
      .input(z.object({ agentId: z.string() }))
      .query(({ input }) => proxyGet(`/v1/analytics/churn-prediction/${input.agentId}`)),
    networkMap: protectedProcedure.query(() => proxyGet("/v1/analytics/network-map")),
  }),

  // ── ERP / ERPNext (Python) ────────────────────────────────────────────────
  erp: router({
    syncTransaction: protectedProcedure
      .input(z.object({ transactionRef: z.string() }))
      .mutation(({ input }) => proxyPost("/v1/erp/sync/transaction", input)),
    syncAgent: protectedProcedure
      .input(z.object({ agentId: z.string() }))
      .mutation(({ input }) => proxyPost("/v1/erp/sync/agent", input)),
    getJournalEntry: protectedProcedure
      .input(z.object({ ref: z.string() }))
      .query(({ input }) => proxyGet(`/v1/erp/journal-entries/${input.ref}`)),
    vatReport: protectedProcedure
      .input(z.object({ period: z.string() }))
      .query(({ input }) => proxyGet("/v1/erp/vat-report", { period: input.period })),
    stockLevels: protectedProcedure.query(() => proxyGet("/v1/erp/stock/levels")),
  }),

  // ── Storefront / E-commerce (Python) ──────────────────────────────────────
  storefront: router({
    products: protectedProcedure
      .input(z.object({ category: z.string().optional(), page: z.number().default(1) }))
      .query(({ input }) => proxyGet("/v1/storefront/products", { page: String(input.page), ...(input.category ? { category: input.category } : {}) })),
    order: protectedProcedure
      .input(z.object({ items: z.array(z.object({ productId: z.string(), qty: z.number() })), agentId: z.string() }))
      .mutation(({ input }) => proxyPost("/v1/storefront/orders", input)),
    orderStatus: protectedProcedure
      .input(z.object({ orderId: z.string() }))
      .query(({ input }) => proxyGet(`/v1/storefront/orders/${input.orderId}`)),
    ads: protectedProcedure.query(() => proxyGet("/v1/storefront/ads")),
  }),

  // ── Cross-border Payments (Go) ─────────────────────────────────────────────
  crossBorder: router({
    papssTransfer: protectedProcedure
      .input(z.object({ amount: z.number(), currency: z.string(), destinationCountry: z.string(), beneficiary: z.record(z.string(), z.string()) }))
      .mutation(({ input }) => proxyPost("/v1/cross-border/papss/transfer", input)),
    swiftTransfer: protectedProcedure
      .input(z.object({ amount: z.number(), currency: z.string(), swift: z.string(), iban: z.string(), beneficiary: z.record(z.string(), z.string()) }))
      .mutation(({ input }) => proxyPost("/v1/cross-border/swift/transfer", input)),
    fxRate: protectedProcedure
      .input(z.object({ from: z.string(), to: z.string() }))
      .query(({ input }) => proxyGet("/v1/cross-border/fx-rate", input)),
    upiPay: protectedProcedure
      .input(z.object({ vpa: z.string(), amount: z.number(), note: z.string().optional() }))
      .mutation(({ input }) => proxyPost("/v1/cross-border/upi/pay", input)),
    pixPay: protectedProcedure
      .input(z.object({ pixKey: z.string(), amount: z.number(), description: z.string().optional() }))
      .mutation(({ input }) => proxyPost("/v1/cross-border/pix/pay", input)),
  }),

  // ── Loyalty / Gamification (Python) ───────────────────────────────────────
  loyalty: router({
    points: protectedProcedure
      .input(z.object({ agentId: z.string() }))
      .query(({ input }) => proxyGet(`/v1/loyalty/agents/${input.agentId}/points`)),
    leaderboard: protectedProcedure
      .input(z.object({ period: z.enum(["week", "month", "all"]).default("month"), limit: z.number().default(10) }))
      .query(({ input }) => proxyGet("/v1/loyalty/leaderboard", { period: input.period, limit: String(input.limit) })),
    redeem: protectedProcedure
      .input(z.object({ agentId: z.string(), rewardId: z.string(), points: z.number() }))
      .mutation(({ input }) => proxyPost("/v1/loyalty/redeem", input)),
    challenges: protectedProcedure
      .input(z.object({ agentId: z.string() }))
      .query(({ input }) => proxyGet(`/v1/loyalty/agents/${input.agentId}/challenges`)),
  }),

  // ── Compliance / CBN Reporting (Python) ───────────────────────────────────
  compliance: router({
    cbnMonthly: protectedProcedure
      .input(z.object({ period: z.string() }))
      .mutation(({ input }) => proxyPost("/v1/compliance/cbn/monthly", input)),
    amlReport: protectedProcedure
      .input(z.object({ from: z.string(), to: z.string() }))
      .query(({ input }) => proxyGet("/v1/compliance/aml/report", input)),
    sarSubmit: protectedProcedure
      .input(z.object({ agentId: z.string(), description: z.string(), transactions: z.array(z.string()) }))
      .mutation(({ input }) => proxyPost("/v1/compliance/sar/submit", input)),
    blacklistSync: protectedProcedure.mutation(() => proxyPost("/v1/compliance/blacklist/sync", {})),
  }),

  // ── MDM / Device Management (Go) ──────────────────────────────────────────
  mdm: router({
    enroll: protectedProcedure
      .input(z.object({ serialNumber: z.string(), model: z.string(), agentId: z.string() }))
      .mutation(({ input }) => proxyPost("/v1/mdm/enroll", input)),
    command: protectedProcedure
      .input(z.object({ deviceToken: z.string(), command: z.enum(["lock", "unlock", "wipe", "reboot", "update"]), params: z.record(z.string(), z.string()).optional() }))
      .mutation(({ input }) => proxyPost("/v1/mdm/command", input)),
    otaUpdate: protectedProcedure
      .input(z.object({ deviceToken: z.string(), version: z.string(), url: z.string() }))
      .mutation(({ input }) => proxyPost("/v1/mdm/ota", input)),
    heartbeat: protectedProcedure
      .input(z.object({ deviceToken: z.string(), status: z.string(), appVersion: z.string() }))
      .mutation(({ input }) => proxyPost("/v1/mdm/heartbeat", input)),
  }),

  // ── Wallet / Stablecoin (Python) ───────────────────────────────────────────
  wallet: router({
    balance: protectedProcedure
      .input(z.object({ walletId: z.string() }))
      .query(({ input }) => proxyGet(`/v1/wallet/${input.walletId}/balance`)),
    transfer: protectedProcedure
      .input(z.object({ from: z.string(), to: z.string(), amount: z.number(), asset: z.string().default("NGN") }))
      .mutation(({ input }) => proxyPost("/v1/wallet/transfer", input)),
    stablecoinMint: protectedProcedure
      .input(z.object({ amount: z.number(), walletId: z.string() }))
      .mutation(({ input }) => proxyPost("/v1/wallet/stablecoin/mint", input)),
    stablecoinBurn: protectedProcedure
      .input(z.object({ amount: z.number(), walletId: z.string() }))
      .mutation(({ input }) => proxyPost("/v1/wallet/stablecoin/burn", input)),
  }),

  // ── Smart Contracts / DeFi (Python) ───────────────────────────────────────
  contracts: router({
    escrowCreate: protectedProcedure
      .input(z.object({ amount: z.number(), beneficiary: z.string(), condition: z.string(), expiresAt: z.string() }))
      .mutation(({ input }) => proxyPost("/v1/contracts/escrow/create", input)),
    escrowRelease: protectedProcedure
      .input(z.object({ escrowId: z.string() }))
      .mutation(({ input }) => proxyPost(`/v1/contracts/escrow/${input.escrowId}/release`, {})),
    escrowRefund: protectedProcedure
      .input(z.object({ escrowId: z.string(), reason: z.string() }))
      .mutation(({ input }) => proxyPost(`/v1/contracts/escrow/${input.escrowId}/refund`, { reason: input.reason })),
    status: protectedProcedure
      .input(z.object({ escrowId: z.string() }))
      .query(({ input }) => proxyGet(`/v1/contracts/escrow/${input.escrowId}`)),
  }),

  // ── Bills / VAS (Go) ──────────────────────────────────────────────────────
  bills: router({
    categories: protectedProcedure.query(() => proxyGet("/v1/bills/categories")),
    billers: protectedProcedure
      .input(z.object({ categoryId: z.string() }))
      .query(({ input }) => proxyGet("/v1/bills/billers", { categoryId: input.categoryId })),
    validate: protectedProcedure
      .input(z.object({ billerId: z.string(), customerId: z.string() }))
      .query(({ input }) => proxyGet("/v1/bills/validate", input)),
    pay: protectedProcedure
      .input(z.object({ billerId: z.string(), customerId: z.string(), amount: z.number(), agentId: z.string() }))
      .mutation(({ input }) => proxyPost("/v1/bills/pay", input)),
    airtime: protectedProcedure
      .input(z.object({ phone: z.string(), amount: z.number(), network: z.string() }))
      .mutation(({ input }) => proxyPost("/v1/bills/airtime", input)),
    data: protectedProcedure
      .input(z.object({ phone: z.string(), planId: z.string(), network: z.string() }))
      .mutation(({ input }) => proxyPost("/v1/bills/data", input)),
    electricity: protectedProcedure
      .input(z.object({ meterNumber: z.string(), amount: z.number(), disco: z.string() }))
      .mutation(({ input }) => proxyPost("/v1/bills/electricity", input)),
    cableTv: protectedProcedure
      .input(z.object({ smartCardNumber: z.string(), planId: z.string(), provider: z.string() }))
      .mutation(({ input }) => proxyPost("/v1/bills/cable-tv", input)),
  }),

  // ── Multi-SIM / Carrier (Go) ───────────────────────────────────────────────
  multiSim: router({
    profiles: protectedProcedure
      .input(z.object({ agentId: z.string() }))
      .query(({ input }) => proxyGet(`/v1/multi-sim/agents/${input.agentId}/profiles`)),
    activate: protectedProcedure
      .input(z.object({ agentId: z.string(), iccid: z.string(), carrier: z.string() }))
      .mutation(({ input }) => proxyPost("/v1/multi-sim/activate", input)),
    deactivate: protectedProcedure
      .input(z.object({ profileId: z.string() }))
      .mutation(({ input }) => proxyPost(`/v1/multi-sim/profiles/${input.profileId}/deactivate`, {})),
    signalStrength: protectedProcedure
      .input(z.object({ agentId: z.string() }))
      .query(({ input }) => proxyGet(`/v1/multi-sim/agents/${input.agentId}/signal`)),
  }),

  // ── NFC / QR (Go) ─────────────────────────────────────────────────────────
  nfc: router({
    read: protectedProcedure
      .input(z.object({ tagData: z.string(), agentId: z.string() }))
      .mutation(({ input }) => proxyPost("/v1/nfc/read", input)),
    write: protectedProcedure
      .input(z.object({ tagData: z.string(), payload: z.record(z.string(), z.string()) }))
      .mutation(({ input }) => proxyPost("/v1/nfc/write", input)),
    generateQr: protectedProcedure
      .input(z.object({ agentId: z.string(), amount: z.number().optional(), expiresIn: z.number().default(300) }))
      .mutation(({ input }) => proxyPost("/v1/nfc/qr/generate", input)),
    scanQr: protectedProcedure
      .input(z.object({ code: z.string() }))
      .query(({ input }) => proxyGet("/v1/nfc/qr/scan", { code: input.code })),
  }),

  // ── Flagsmith Feature Flags (Go) ──────────────────────────────────────────
  flags: router({
    all: protectedProcedure.query(() => proxyGet("/v1/flags")),
    get: protectedProcedure
      .input(z.object({ key: z.string() }))
      .query(({ input }) => proxyGet(`/v1/flags/${input.key}`)),
    set: protectedProcedure
      .input(z.object({ key: z.string(), enabled: z.boolean(), value: z.string().optional() }))
      .mutation(({ input }) => proxyPost("/v1/flags", input)),
  }),

  // ── Permify RBAC (Go) ─────────────────────────────────────────────────────
  rbac: router({
    check: protectedProcedure
      .input(z.object({ subject: z.string(), permission: z.string(), resource: z.string() }))
      .query(({ input }) => proxyGet("/v1/rbac/check", input)),
    assign: protectedProcedure
      .input(z.object({ subject: z.string(), role: z.string(), resource: z.string() }))
      .mutation(({ input }) => proxyPost("/v1/rbac/assign", input)),
    revoke: protectedProcedure
      .input(z.object({ subject: z.string(), role: z.string(), resource: z.string() }))
      .mutation(({ input }) => proxyDelete(`/v1/rbac/assign/${input.subject}/${input.role}/${input.resource}`)),
  }),

  // ── Temporal Workflows (Go) ───────────────────────────────────────────────
  workflows: router({
    start: protectedProcedure
      .input(z.object({ workflowType: z.string(), input: z.record(z.string(), z.unknown()), taskQueue: z.string().default("pos-shell") }))
      .mutation(({ input }) => proxyPost("/v1/workflows/start", input)),
    status: protectedProcedure
      .input(z.object({ workflowId: z.string() }))
      .query(({ input }) => proxyGet(`/v1/workflows/${input.workflowId}/status`)),
    signal: protectedProcedure
      .input(z.object({ workflowId: z.string(), signalName: z.string(), payload: z.record(z.string(), z.unknown()).optional() }))
      .mutation(({ input }) => proxyPost(`/v1/workflows/${input.workflowId}/signal`, input)),
    terminate: protectedProcedure
      .input(z.object({ workflowId: z.string(), reason: z.string() }))
      .mutation(({ input }) => proxyPost(`/v1/workflows/${input.workflowId}/terminate`, { reason: input.reason })),
  }),

  // ── Kafka Events (Go) ─────────────────────────────────────────────────────
  events: router({
    publish: protectedProcedure
      .input(z.object({ topic: z.string(), key: z.string(), payload: z.record(z.string(), z.unknown()) }))
      .mutation(({ input }) => proxyPost("/v1/events/publish", input)),
    topics: protectedProcedure.query(() => proxyGet("/v1/events/topics")),
    consumerGroups: protectedProcedure.query(() => proxyGet("/v1/events/consumer-groups")),
  }),

  // ── Dapr State / Pub-Sub (Go) ─────────────────────────────────────────────
  dapr: router({
    getState: protectedProcedure
      .input(z.object({ store: z.string(), key: z.string() }))
      .query(({ input }) => proxyGet(`/v1/dapr/state/${input.store}/${input.key}`)),
    setState: protectedProcedure
      .input(z.object({ store: z.string(), key: z.string(), value: z.unknown() }))
      .mutation(({ input }) => proxyPost(`/v1/dapr/state/${input.store}`, input)),
    publish: protectedProcedure
      .input(z.object({ pubsub: z.string(), topic: z.string(), data: z.record(z.string(), z.unknown()) }))
      .mutation(({ input }) => proxyPost(`/v1/dapr/publish/${input.pubsub}/${input.topic}`, input.data)),
  }),

  // ── KEDA Autoscaling (Go) ─────────────────────────────────────────────────
  scaling: router({
    metrics: protectedProcedure.query(() => proxyGet("/v1/scaling/metrics")),
    scaleTargets: protectedProcedure.query(() => proxyGet("/v1/scaling/targets")),
    triggerScale: protectedProcedure
      .input(z.object({ target: z.string(), replicas: z.number() }))
      .mutation(({ input }) => proxyPost("/v1/scaling/trigger", input)),
  }),

    // ── Istio Service Mesh (Go) ─────────────────────────────────────────────
  mesh: router({
    services: protectedProcedure.query(() => proxyGet("/v1/mesh/services")),
    trafficPolicy: protectedProcedure
      .input(z.object({ service: z.string(), policy: z.record(z.string(), z.unknown()) }))
      .mutation(({ input }) => proxyPost(`/v1/mesh/services/${input.service}/traffic-policy`, input.policy)),
    circuitBreaker: protectedProcedure
      .input(z.object({ service: z.string() }))
      .query(({ input }) => proxyGet(`/v1/mesh/services/${input.service}/circuit-breaker`)),
  }),

  // ── Payment Gateway (Python) ──────────────────────────────────────────────
  paymentGateway: router({
    initiate: protectedProcedure
      .input(z.object({ amount: z.number(), currency: z.string(), gateway: z.string(), reference: z.string(), metadata: z.record(z.string(), z.unknown()).optional() }))
      .mutation(({ input }) => proxyPost("/v1/payment-gateway/initiate", input)),
    verify: protectedProcedure
      .input(z.object({ reference: z.string(), gateway: z.string() }))
      .query(({ input }) => proxyGet(`/v1/payment-gateway/verify/${input.gateway}/${input.reference}`)),
    refund: protectedProcedure
      .input(z.object({ reference: z.string(), amount: z.number(), reason: z.string().optional() }))
      .mutation(({ input }) => proxyPost("/v1/payment-gateway/refund", input)),
    availableGateways: protectedProcedure.query(() => proxyGet("/v1/payment-gateway/available")),
    webhookLogs: protectedProcedure
      .input(z.object({ gateway: z.string().optional(), limit: z.number().default(20) }))
      .query(({ input }) => proxyGet("/v1/payment-gateway/webhook-logs", { limit: String(input.limit), ...(input.gateway ? { gateway: input.gateway } : {}) })),
  }),

  // ── Hierarchy Engine (Go) ─────────────────────────────────────────────────
  hierarchy: router({
    getTree: protectedProcedure
      .input(z.object({ tenantId: z.string().optional() }))
      .query(({ input }) => proxyGet("/v1/hierarchy/tree", input.tenantId ? { tenantId: input.tenantId } : {})),
    getNode: protectedProcedure
      .input(z.object({ nodeId: z.string() }))
      .query(({ input }) => proxyGet(`/v1/hierarchy/nodes/${input.nodeId}`)),
    getChildren: protectedProcedure
      .input(z.object({ nodeId: z.string() }))
      .query(({ input }) => proxyGet(`/v1/hierarchy/nodes/${input.nodeId}/children`)),
    getAncestors: protectedProcedure
      .input(z.object({ nodeId: z.string() }))
      .query(({ input }) => proxyGet(`/v1/hierarchy/nodes/${input.nodeId}/ancestors`)),
    moveNode: protectedProcedure
      .input(z.object({ nodeId: z.string(), newParentId: z.string() }))
      .mutation(({ input }) => proxyPost(`/v1/hierarchy/nodes/${input.nodeId}/move`, { newParentId: input.newParentId })),
    agentSupervisors: protectedProcedure
      .input(z.object({ agentCode: z.string() }))
      .query(({ input }) => proxyGet(`/v1/hierarchy/agents/${input.agentCode}/supervisors`)),
  }),

  // ── Auth Service (Go) ─────────────────────────────────────────────────────
  authService: router({
    validateToken: protectedProcedure
      .input(z.object({ token: z.string() }))
      .mutation(({ input }) => proxyPost("/v1/auth/validate", input)),
    refreshToken: protectedProcedure
      .input(z.object({ refreshToken: z.string() }))
      .mutation(({ input }) => proxyPost("/v1/auth/refresh", input)),
    revokeToken: protectedProcedure
      .input(z.object({ tokenId: z.string() }))
      .mutation(({ input }) => proxyDelete(`/v1/auth/tokens/${input.tokenId}`)),
    activeSessions: protectedProcedure
      .input(z.object({ userId: z.string() }))
      .query(({ input }) => proxyGet(`/v1/auth/sessions/${input.userId}`)),
    revokeAllSessions: protectedProcedure
      .input(z.object({ userId: z.string() }))
      .mutation(({ input }) => proxyPost(`/v1/auth/sessions/${input.userId}/revoke-all`, {})),
  }),
});
