import { randomUUID } from "crypto";
import compression from "compression";
import express, { type Request } from "express";
import fs from "fs";
import helmet from "helmet";
import hpp from "hpp";
import { createServer } from "http";
import path from "path";
import rateLimit from "express-rate-limit";
import { fileURLToPath } from "url";

import { globalErrorHandler } from "./lib/errorHandler";
import { logger } from "./lib/logger";
import { requestLogger } from "./lib/requestLogger";
import { validateBody, customerCreateSchema, customerUpdateSchema, transferCreateSchema, billingUsageEventSchema, billingRateCardCreateSchema, partnerOnboardingCreateSchema } from "./lib/validation";
import { authMiddleware, requireRole, requirePermission } from "./lib/auth";
import { validateAndLog } from "./lib/envValidation";
import { auditLog } from "./lib/auditLog";
import { metricsMiddleware, metricsEndpoint, registry } from "./lib/metrics";
import { generateOpenAPISpec } from "./lib/openapi";
import { WebSocketServer, WebSocket } from "ws";

import {
  ensurePlatformSeed,
  getCustomerSessionPreference,
  listTenantConfigurations,
  loadRuntimeStateFromDb,
  provisionPartnerTenant,
  syncRuntimeStateToDb,
  upsertCustomerSessionPreference,
} from "./platformPersistence";
import { closeDbPool, getDb } from "./db";
import { sql } from "drizzle-orm";
import {
  createPartnerOnboardingDraft,
  getPartnerOnboardingRecord,
  hydratePartnerOnboardingState,
  listPartnerApprovalRecords,
  listPartnerOnboardingRecords,
  resolvePartnerApproval,
  serializePartnerOnboardingState,
  submitPartnerOnboarding,
  updatePartnerOnboardingDraft,
} from "./partnerOnboardingRuntime";
import {
  notifyPartnerApprovalDecision,
  notifyPartnerLaunchReady,
  notifyPartnerOnboardingSubmission,
} from "./partnerOnboardingNotifications";
import {
  createBillingContractOverride,
  createBillingDiscountRule,
  createBillingRateCard,
  createBillingRevenueShareRule,
  createBillingUsageEvent,
  ensureBillingEngineSeed,
  generateBillingInvoices,
  getBillingDashboard,
  listBillingAccrualSnapshots,
  listBillingContractOverrides,
  listBillingDiscountRules,
  listBillingInvoiceApprovals,
  listBillingInvoiceLines,
  listBillingInvoices,
  listBillingRateCards,
  listBillingRevenueShareRules,
  listBillingUsageEvents,
  refreshBillingAccrualSnapshots,
  resolveBillingInvoiceApproval,
} from "./billingEngine";
import {
  createBillingApprovalMatrix,
  createBillingInvoiceDispute,
  exportBillingInvoice,
  generateBillingInvoicesWithMatrix,
  getBillingExtendedDashboard,
  ingestBillingUsageViaMiddleware,
  listBillingApprovalMatrices,
  listBillingErpPostingAttempts,
  listBillingInvoiceDisputes,
  markBillingErpPostingResult,
  queueBillingInvoiceErpPosting,
  resolveBillingInvoiceDispute,
} from "./billingAutomation";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const persistenceDirectory = path.join(__dirname, ".runtime-data");
const persistenceFile = path.join(persistenceDirectory, "platform-state.json");
const ledgerContractCatalogFile = path.join(__dirname, "..", "shared", "generated", "ledger_posting_contracts.json");

const runtimeEnvironment = process.env.NODE_ENV || "development";
const strictProductionRuntime = runtimeEnvironment === "production";
const runtimeConfigWarnings: Array<{ key: string; detail: string }> = [];

const readRuntimeValue = (
  keys: string[],
  fallback: string,
  options?: {
    requireInProduction?: boolean;
    label?: string;
  },
) => {
  for (const key of keys) {
    const value = process.env[key];
    if (value && value.trim().length > 0) {
      return value;
    }
  }

  const label = options?.label || keys[0] || "unknown";
  if (options?.requireInProduction && strictProductionRuntime) {
    throw new Error(`Missing required runtime configuration: ${label}`);
  }

  runtimeConfigWarnings.push({
    key: label,
    detail: `Using non-production fallback for ${label}. Override via ${keys.join(" or ")} before real deployment.`,
  });
  return fallback;
};

const tenantId = readRuntimeValue(["PLATFORM_TENANT_ID", "TENANT_ID"], "54bank-platform-prod", { label: "tenant identity" });
const defaultTenantSecret = readRuntimeValue(
  ["PLATFORM_TENANT_SECRET", "TENANT_SECRET"],
  "REPLACE_ME_TENANT_SECRET",
  { requireInProduction: true, label: "tenant secret" },
);
const platformBaseUrl = readRuntimeValue(["PLATFORM_BASE_URL", "VITE_PLATFORM_BASE_URL"], "https://platform.54bank.app", {
  label: "platform base URL",
});
const requestTimeoutMs = Number.parseInt(process.env.REQUEST_TIMEOUT_MS || "15000", 10);
const upstreamTimeoutMs = Number.parseInt(process.env.UPSTREAM_TIMEOUT_MS || String(requestTimeoutMs), 10);
const upstreamRetryCount = Number.parseInt(process.env.UPSTREAM_RETRY_COUNT || "2", 10);
const rateLimitWindowMs = Number.parseInt(process.env.RATE_LIMIT_WINDOW_MS || "60000", 10);
const rateLimitMaxWrites = Number.parseInt(process.env.RATE_LIMIT_MAX_WRITES || "120", 10);
const healthCacheSeconds = Number.parseInt(process.env.HEALTH_CACHE_SECONDS || "5", 10);
const staticAssetCacheSeconds = Number.parseInt(process.env.STATIC_ASSET_CACHE_SECONDS || "86400", 10);
const writeRequestBuckets = new Map<string, { count: number; resetAt: number }>();

const serviceEndpoints = {
  teller: readRuntimeValue(["TELLER_SERVICE_URL"], "https://teller.middleware.54bank.app", { label: "teller service URL" }),
  reconciliation: readRuntimeValue(["RECONCILIATION_SERVICE_URL"], "https://reconciliation.middleware.54bank.app", {
    label: "reconciliation service URL",
  }),
  erpnext: readRuntimeValue(["ERPNEXT_SERVICE_URL"], "https://erpnext.middleware.54bank.app", { label: "ERPNext service URL" }),
  islamic: readRuntimeValue(["ISLAMIC_BANKING_SERVICE_URL"], "https://islamic.middleware.54bank.app", {
    label: "Islamic banking service URL",
  }),
  ledger: readRuntimeValue(["LEDGER_SERVICE_URL"], "https://ledger.middleware.54bank.app", { label: "ledger service URL" }),
  payment: readRuntimeValue(["PAYMENT_SERVICE_URL"], "https://payments.middleware.54bank.app", { label: "payment service URL" }),
  customer: readRuntimeValue(["CUSTOMER_SERVICE_URL"], "https://customer.middleware.54bank.app", { label: "customer service URL" }),
  tenant: readRuntimeValue(["TENANT_SERVICE_URL"], "https://tenant.middleware.54bank.app", { label: "tenant service URL" }),
  tradeFinance: readRuntimeValue(["TRADE_FINANCE_SERVICE_URL"], "https://trade.middleware.54bank.app", {
    label: "trade-finance service URL",
  }),
  dispute: readRuntimeValue(["DISPUTE_SERVICE_URL"], "https://dispute.middleware.54bank.app", { label: "dispute service URL" }),
  insurance: readRuntimeValue(["INSURANCE_SERVICE_URL"], "https://insurance.middleware.54bank.app", { label: "insurance service URL" }),
};

const runtimeTenantConfigurationSeed = {
  tenantId,
  name: "Recovered 54Bank tenant",
  onboardingStatus: "active",
  segment: "operations",
  region: "Recovered consolidated platform",
  enabledModules: ["customer-operations", "customer-servicing", "kyc", "cards", "payments"],
  featureFlags: [
    {
      key: "tenant_governance",
      label: "Tenant governance",
      category: "operations",
      description: "Fallback tenant-governance view when the recovered tenant-service is unavailable.",
      enabled: true,
      rolloutStage: "general",
      adminManaged: true,
      dependsOn: ["tenant-service", "gateway", "authz"],
    },
  ],
  whiteLabel: {
    displayName: "54Bank Recovered",
    legalEntity: "54Bank Recovery Workspace",
    supportEmail: "platform-operations@54bank.app",
    primaryColor: "#0f766e",
    accentColor: "#f59e0b",
    logoUrl: "https://assets.54bank.app/logos/54bank-recovered.png",
    loginHeadline: "Recovered tenant controls are available even while upstream tenant APIs are being restored.",
    customDomain: "",
  },
};

const middlewareConfig = {
  tigerbeetle: {
    addresses: readRuntimeValue(["TIGERBEETLE_ADDRESSES", "TIGERBEETLE_ADDRESS"], "tigerbeetle:3000", {
      label: "TigerBeetle addresses",
    }),
    clusterId: readRuntimeValue(["TIGERBEETLE_CLUSTER_ID"], "54bankcluster00000000000000000000", {
      label: "TigerBeetle cluster ID",
    }),
    ledgerScope: "financial-system-of-record",
  },
  kafka: {
    brokers: readRuntimeValue(["KAFKA_BOOTSTRAP_SERVERS"], "kafka:9092", { label: "Kafka bootstrap servers" }),
    defaultTopicPrefix: readRuntimeValue(["KAFKA_TOPIC_PREFIX"], "54bank", { label: "Kafka topic prefix" }),
  },
  dapr: {
    httpPort: readRuntimeValue(["DAPR_HTTP_PORT"], "3500", { label: "Dapr HTTP port" }),
    placementAddress: readRuntimeValue(["DAPR_PLACEMENT_ADDRESS"], "dapr-placement:50006", { label: "Dapr placement address" }),
  },
  temporal: {
    hostPort: readRuntimeValue(["TEMPORAL_ADDRESS"], "temporal-frontend:7233", { label: "Temporal address" }),
    namespace: readRuntimeValue(["TEMPORAL_NAMESPACE"], "banking", { label: "Temporal namespace" }),
  },
  keycloak: {
    issuer: readRuntimeValue(["KEYCLOAK_ISSUER_URL"], "https://identity.54bank.app/realms/54bank", { label: "Keycloak issuer URL" }),
    clientId: readRuntimeValue(["KEYCLOAK_CLIENT_ID"], "54bank-operations-ui", { label: "Keycloak client ID" }),
    clientSecret: readRuntimeValue(["KEYCLOAK_CLIENT_SECRET"], "REPLACE_ME_KEYCLOAK_SECRET", {
      requireInProduction: true,
      label: "Keycloak client secret",
    }),
  },
  permify: {
    endpoint: readRuntimeValue(["PERMIFY_URL"], "http://permify:3476", { label: "Permify URL" }),
    tenantId: readRuntimeValue(["PERMIFY_TENANT_ID"], tenantId, { label: "Permify tenant ID" }),
  },
  redis: {
    url: readRuntimeValue(["REDIS_URL"], "redis://redis-master:6379/0", { label: "Redis URL" }),
  },
  apisix: {
    adminUrl: readRuntimeValue(["APISIX_ADMIN_URL"], "http://apisix-admin.default.svc.cluster.local:9180", {
      label: "APISIX admin URL",
    }),
    publicGatewayUrl: readRuntimeValue(["APISIX_PUBLIC_URL"], "https://api.54bank.app/gateway", { label: "APISIX public URL" }),
  },
  mojaloop: {
    endpoint: readRuntimeValue(["MOJALOOP_API_URL"], "http://mojaloop-switch.default.svc.cluster.local:4000", {
      label: "Mojaloop API URL",
    }),
    fspId: readRuntimeValue(["MOJALOOP_FSP_ID"], tenantId, { label: "Mojaloop FSP ID" }),
    fspSecret: readRuntimeValue(["MOJALOOP_FSP_SECRET"], "REPLACE_ME_MOJALOOP_SECRET", {
      requireInProduction: true,
      label: "Mojaloop FSP secret",
    }),
  },
  postgres: {
    url: readRuntimeValue(["DATABASE_URL"], "postgresql://app_user:REPLACE_ME_DB_PASSWORD@postgres-primary:5432/app_db?sslmode=require", {
      requireInProduction: true,
      label: "database URL",
    }),
  },
  lakehouse: {
    endpoint: readRuntimeValue(["LAKEHOUSE_API_URL"], "http://lakehouse-query.default.svc.cluster.local:8000", {
      label: "lakehouse API URL",
    }),
    dataset: readRuntimeValue(["LAKEHOUSE_DATASET"], "54bank_operational_analytics", { label: "lakehouse dataset" }),
  },
  fluvio: {
    endpoint: readRuntimeValue(["FLUVIO_ADDR"], "fluvio-sc-public:9003", { label: "Fluvio address" }),
  },
};

type JsonRecord = Record<string, unknown>;
type HealthStatus = "healthy" | "degraded" | "down" | "unknown";
type Trend = "up" | "down" | "flat";
type CustomerStatus = "Active" | "Pending" | "Review" | "Dormant";
type CustomerSegment = "Agriculture" | "Trade" | "Retail" | "Public sector";
type CustomerTier = "Tier 1" | "Tier 2" | "Tier 3";
type CustomerRisk = "Low" | "Medium" | "High";
type WorkflowStage = "Origination" | "KYC" | "Approval" | "Fulfilment" | "Monitoring";
type WorkflowStatus = "Ready" | "In Progress" | "Blocked";
type OperatorActionStatus = "Pending" | "In progress" | "Done";
type OperatorRole = "branch" | "operations" | "treasury" | "compliance";
type AuditSeverity = "info" | "warning" | "critical";
type ExportStatus = "Ready" | "Queued" | "Failed";

interface LedgerPostingContract {
  domain: string;
  postingMode: string;
  tigerBeetlePosting: string;
  kafkaPublication: string;
  postgresPersistence: string;
  redisInvalidation: string;
  lakehousePublication: string;
  workflowProgression: string;
  authContext: string;
  middleware: string[];
  recommendedPostingSeams: string[];
  detail: string;
}

interface ProductSurface {
  key: string;
  title: string;
  category: "retail" | "operations" | "treasury" | "trade" | "partnerships";
  summary: string;
  route: string;
  status: HealthStatus;
  services: string[];
}

interface CustomerRecord {
  id: string;
  name: string;
  segment: CustomerSegment;
  tier: CustomerTier;
  location: string;
  relationshipManager: string;
  risk: CustomerRisk;
  status: CustomerStatus;
  bvn: string;
  phone: string;
  balance: number;
  lastTouchpoint: string;
}

interface WorkflowCase {
  id: string;
  customer: string;
  product: string;
  stage: WorkflowStage;
  status: WorkflowStatus;
  channel: string;
  amount: number;
  nextAction: string;
  slaHours: number;
}

interface OperatorAction {
  id: string;
  domainKey: string;
  title: string;
  detail: string;
  owner: string;
  due: string;
  route: string;
  status: OperatorActionStatus;
  roles: OperatorRole[];
}

interface RoleProfile {
  role: OperatorRole;
  title: string;
  description: string;
  defaultRoute: string;
  permissions: string[];
  visibleDomains: string[];
  exportScopes: string[];
}

interface AuditEntry {
  id: string;
  timestamp: string;
  actorRole: OperatorRole;
  actorId: string;
  entityType: string;
  entityId: string;
  action: string;
  outcome: string;
  severity: AuditSeverity;
  route: string;
  middleware: string[];
  detail: string;
}

interface ExportJob {
  id: string;
  domainKey: string;
  title: string;
  format: "csv" | "json" | "xlsx";
  status: ExportStatus;
  createdAt: string;
  requestedByRole: OperatorRole;
  route: string;
  rowCount: number;
  approvalState: "Signed" | "Pending review";
  approvalSignature: string;
  downloadUrl: string;
  retainedUntil?: string;
  reportVersion?: string;
  approvalChain?: string[];
  signedBy?: string[];
}

interface MiddlewareSurface {
  key: keyof typeof middlewareConfig;
  title: string;
  status: HealthStatus;
  scope: string;
  languages: string[];
  directlyIntegrated: boolean;
  notes: string;
  services: string[];
}

const roleProfiles: RoleProfile[] = [
  {
    role: "branch",
    title: "Branch operations",
    description: "Frontline account servicing, teller balancing, assisted onboarding, and exception capture.",
    defaultRoute: "/",
    permissions: ["customer.read", "customer.write", "workflow.advance", "teller.session.review", "export.customer.summary"],
    visibleDomains: ["customer-operations", "teller-operations", "mortgage-servicing", "education-loans", "esusu-groups", "virtual-accounts", "islamic-banking"],
    exportScopes: ["customers", "teller-sessions", "education-loans", "esusu", "virtual-accounts"],
  },
  {
    role: "operations",
    title: "Central operations",
    description: "Shared workflow management, dispute handling, ERPNext retry governance, and service coordination.",
    defaultRoute: "/",
    permissions: ["customer.read", "customer.write", "workflow.advance", "dispute.manage", "erpnext.retry", "export.workflow"],
    visibleDomains: ["customer-operations", "mortgage-servicing", "education-loans", "esusu-groups", "virtual-accounts", "dispute-management", "erpnext-sync", "trade-finance"],
    exportScopes: ["customers", "workflows", "actions", "disputes", "mortgage", "education-loans", "esusu", "virtual-accounts"],
  },
  {
    role: "treasury",
    title: "Treasury and ledger control",
    description: "TigerBeetle oversight, reconciliation, liquidity control, and settlement routing posture.",
    defaultRoute: "/ledger-sync",
    permissions: ["ledger.read", "ledger.reconcile", "settlement.review", "export.ledger", "trade.approve"],
    visibleDomains: ["ledger-reconciliation", "trade-finance", "erpnext-sync"],
    exportScopes: ["ledger", "reconciliation", "trade-finance"],
  },
  {
    role: "compliance",
    title: "Compliance and risk",
    description: "KYC and case review, policy exceptions, insurance controls, and regulatory evidence trails.",
    defaultRoute: "/disputes",
    permissions: ["compliance.review", "workflow.block", "export.audit", "insurance.review", "customer.read"],
    visibleDomains: ["customer-operations", "agricultural-insurance", "dispute-management", "islamic-banking"],
    exportScopes: ["audit", "compliance", "insurance", "disputes"],
  },
];

const defaultProducts: ProductSurface[] = [
  {
    key: "customer-operations",
    title: "Customer operations",
    category: "operations",
    summary: "Customer onboarding, workflow progression, and relationship servicing across banking lines.",
    route: "/",
    status: "healthy",
    services: ["customer-service", "kyc-service", "search-service"],
  },
  {
    key: "teller-operations",
    title: "Teller operations",
    category: "operations",
    summary: "Branch sessions, till balancing, vault funding, and over-the-counter cash processing.",
    route: "/teller",
    status: "degraded",
    services: ["teller-service", "ledger-service", "reconciliation-service"],
  },
  {
    key: "islamic-banking",
    title: "Islamic banking",
    category: "retail",
    summary: "Murabaha, Ijara, and Mudarabah products with Sharia-compliant schedules and portfolio controls.",
    route: "/islamic-banking",
    status: "degraded",
    services: ["islamic-banking-service", "finance-service", "insurance-service"],
  },
  {
    key: "mortgage-servicing",
    title: "Mortgage servicing",
    category: "retail",
    summary: "Origination, underwriting, collateral perfection, disbursement readiness, and arrears intervention for property-backed lending.",
    route: "/mortgage",
    status: "degraded",
    services: ["mortgage-service", "document-service", "compliance-service"],
  },
  {
    key: "education-loans",
    title: "Education loans",
    category: "retail",
    summary: "School-fee origination, guarantor review, disbursement readiness, and delinquency intervention for education financing.",
    route: "/education-loans",
    status: "degraded",
    services: ["education-loan-service", "document-service", "collections-service"],
  },
  {
    key: "esusu-groups",
    title: "Esusu groups",
    category: "retail",
    summary: "Rotating savings collections, contribution reminders, group-health monitoring, and payout readiness for communal savings circles.",
    route: "/esusu",
    status: "degraded",
    services: ["esusu-service", "notification-service", "agent-service"],
  },
  {
    key: "virtual-accounts",
    title: "Virtual accounts",
    category: "retail",
    summary: "Dedicated and dynamic VAN operations, collection monitoring, account suspension controls, and settlement evidence for inbound payment rails.",
    route: "/virtual-accounts",
    status: "healthy",
    services: ["virtual-account-service", "payment-service", "ledger-service"],
  },
  {
    key: "trade-finance",
    title: "Trade finance",
    category: "trade",
    summary: "Letters of credit, warehouse receipts, FX approval flows, and partner settlement readiness.",
    route: "/trade-finance",
    status: "healthy",
    services: ["trade-finance-service", "fx-service", "compliance-service"],
  },
  {
    key: "agricultural-insurance",
    title: "Agricultural insurance",
    category: "retail",
    summary: "Parametric crop cover, claims readiness, and rural risk controls across weather-linked programs.",
    route: "/agricultural-insurance",
    status: "degraded",
    services: ["agricultural-insurance-service", "insurance-service", "compliance-service"],
  },
  {
    key: "dispute-management",
    title: "Dispute management",
    category: "operations",
    summary: "Case intake, evidence review, reversal posture, and customer-remediation controls.",
    route: "/disputes",
    status: "degraded",
    services: ["dispute-service", "transfer-service", "merchant-service"],
  },
  {
    key: "erpnext-sync",
    title: "ERPNext sync",
    category: "partnerships",
    summary: "Accounting document mapping, outbound sync monitoring, and retry governance.",
    route: "/erpnext-sync",
    status: "degraded",
    services: ["erpnext-integration", "billing-service", "finance-service"],
  },
  {
    key: "ledger-reconciliation",
    title: "Ledger reconciliation",
    category: "treasury",
    summary: "TigerBeetle to PostgreSQL parity checks, discrepancy triage, and repair controls.",
    route: "/ledger-sync",
    status: "healthy",
    services: ["ledger-service", "reconciliation-service", "lakehouse-api"],
  },
];

interface CustomerCardProfile {
  id: string;
  customerId: string;
  type: "virtual" | "physical";
  brand: "visa" | "mastercard";
  lastFour: string;
  expiryDate: string;
  cardHolder: string;
  balance: number;
  isLocked: boolean;
  controls: {
    online: boolean;
    atm: boolean;
    international: boolean;
  };
  spendingLimits: {
    daily: number;
    atm: number;
    online: number;
  };
  colorTone: "blue" | "graphite";
  updatedAt: string;
}

interface CustomerCardEvent {
  id: string;
  cardId: string;
  customerId: string;
  title: string;
  detail: string;
  severity: "info" | "warning" | "success";
  createdAt: string;
}

interface CustomerBillPaymentRecord {
  id: string;
  customerId: string;
  category: "electricity" | "water" | "internet" | "school" | "airtime";
  provider: string;
  amount: number;
  status: "scheduled" | "paid" | "pending";
  paidAt: string;
  reference: string;
  billerId?: string;
  customerReference?: string;
  customerName?: string;
  scheduledFor?: string;
  evidenceStatus?: "verified" | "ready" | "scheduled";
  channel?: "self-service" | "saved-biller" | "operator-assisted";
}

interface CustomerSavedBiller {
  id: string;
  customerId: string;
  category: CustomerBillPaymentRecord["category"];
  provider: string;
  billerId: string;
  customerReference: string;
  nickname: string;
  lastAmount: number;
  verifiedName?: string;
  lastPaidAt?: string;
  createdAt: string;
}

interface CustomerStatementRecord {
  id: string;
  customerId: string;
  title: string;
  detail: string;
  amount: number;
  direction: "credit" | "debit";
  type: "transfer" | "bill_payment" | "workflow" | "deposit";
  status: "completed" | "pending" | "prepared";
  timestamp: string;
  reference?: string;
  category?: string;
}

interface CustomerTransferRecord {
  id: string;
  customerId: string;
  beneficiaryId?: string;
  beneficiaryName: string;
  amount: number;
  narration?: string;
  transferType: "bank" | "wallet" | "workflow";
  status: "draft" | "otp_pending" | "submitted" | "completed" | "failed";
  createdAt: string;
  bankCode?: string;
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
  workflowId?: string;
  otpReference?: string;
  otpIssuedAt?: string;
  confirmedAt?: string;
  approvalState?: "not_required" | "pending_review" | "approved";
}

interface CustomerApprovalRequest {
  id: string;
  customerId: string;
  entityType: "card_control" | "scheduled_bill" | "statement_export";
  entityId: string;
  title: string;
  detail: string;
  route: string;
  state: "pending" | "approved" | "rejected";
  requestedAt: string;
  requestedByRole: OperatorRole | "customer";
  requestedById: string;
  approvalRole: OperatorRole;
  resolvedAt?: string;
  resolutionNote?: string;
}

interface CustomerTransferOtpRequest {
  transferId: string;
  otpReference: string;
  expiresAt: string;
  maskedDestination: string;
  previewCode: string;
}

interface CustomerStatementExportLink {
  exportJob: ExportJob;
  approvalRequest?: CustomerApprovalRequest;
}

const customers: CustomerRecord[] = [
  {
    id: "CUS-001",
    name: "Amina Yusuf Farms",
    segment: "Agriculture",
    tier: "Tier 1",
    location: "Kaduna",
    relationshipManager: "M. Danjuma",
    risk: "Medium",
    status: "Active",
    bvn: "22188439014",
    phone: "08030000001",
    balance: 12450000,
    lastTouchpoint: "10 minutes ago",
  },
  {
    id: "CUS-002",
    name: "Sadiq Trade Exporters",
    segment: "Trade",
    tier: "Tier 2",
    location: "Kano",
    relationshipManager: "K. Ibrahim",
    risk: "High",
    status: "Review",
    bvn: "22188439015",
    phone: "08030000002",
    balance: 28650000,
    lastTouchpoint: "35 minutes ago",
  },
  {
    id: "CUS-003",
    name: "Grace Community Cooperative",
    segment: "Retail",
    tier: "Tier 1",
    location: "Jos",
    relationshipManager: "A. Effiong",
    risk: "Low",
    status: "Pending",
    bvn: "22188439016",
    phone: "08030000003",
    balance: 3750000,
    lastTouchpoint: "1 hour ago",
  },
  {
    id: "CUS-004",
    name: "Haruna Agent Network",
    segment: "Retail",
    tier: "Tier 2",
    location: "Abuja",
    relationshipManager: "L. Hassan",
    risk: "Medium",
    status: "Active",
    bvn: "22188439017",
    phone: "08030000004",
    balance: 9450000,
    lastTouchpoint: "22 minutes ago",
  },
  {
    id: "CUS-005",
    name: "Kaduna Milling Consortium",
    segment: "Agriculture",
    tier: "Tier 2",
    location: "Kaduna",
    relationshipManager: "B. Okorie",
    risk: "Medium",
    status: "Review",
    bvn: "22188439018",
    phone: "08030000005",
    balance: 41200000,
    lastTouchpoint: "12 minutes ago",
  },
  {
    id: "CUS-006",
    name: "Lagos Merchant Acquiring Pool",
    segment: "Trade",
    tier: "Tier 1",
    location: "Lagos",
    relationshipManager: "T. Bello",
    risk: "Low",
    status: "Active",
    bvn: "22188439019",
    phone: "08030000006",
    balance: 22850000,
    lastTouchpoint: "6 minutes ago",
  },
];

const customerCards: CustomerCardProfile[] = [
  {
    id: "CARD-001",
    customerId: "CUS-001",
    type: "physical",
    brand: "visa",
    lastFour: "4401",
    expiryDate: "09/29",
    cardHolder: "Amina Yusuf Farms",
    balance: 1245000,
    isLocked: false,
    controls: { online: true, atm: true, international: false },
    spendingLimits: { daily: 350000, atm: 120000, online: 180000 },
    colorTone: "blue",
    updatedAt: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
  },
  {
    id: "CARD-002",
    customerId: "CUS-001",
    type: "virtual",
    brand: "mastercard",
    lastFour: "9088",
    expiryDate: "04/28",
    cardHolder: "Amina Yusuf Farms",
    balance: 420000,
    isLocked: true,
    controls: { online: true, atm: false, international: false },
    spendingLimits: { daily: 150000, atm: 0, online: 90000 },
    colorTone: "graphite",
    updatedAt: new Date(Date.now() - 1000 * 60 * 42).toISOString(),
  },
  {
    id: "CARD-003",
    customerId: "CUS-002",
    type: "physical",
    brand: "visa",
    lastFour: "5520",
    expiryDate: "01/30",
    cardHolder: "Sadiq Trade Exporters",
    balance: 2150000,
    isLocked: false,
    controls: { online: true, atm: true, international: true },
    spendingLimits: { daily: 500000, atm: 150000, online: 250000 },
    colorTone: "blue",
    updatedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
];

const customerCardEvents: CustomerCardEvent[] = [
  {
    id: "CEVT-001",
    cardId: "CARD-001",
    customerId: "CUS-001",
    title: "ATM limit adjusted",
    detail: "Daily ATM limit raised after servicing review.",
    severity: "success",
    createdAt: new Date(Date.now() - 1000 * 60 * 55).toISOString(),
  },
  {
    id: "CEVT-002",
    cardId: "CARD-002",
    customerId: "CUS-001",
    title: "Virtual card locked",
    detail: "International usage remained blocked pending operator confirmation.",
    severity: "warning",
    createdAt: new Date(Date.now() - 1000 * 60 * 95).toISOString(),
  },
  {
    id: "CEVT-003",
    cardId: "CARD-003",
    customerId: "CUS-002",
    title: "Cross-border control confirmed",
    detail: "International spend control retained for trade settlement journeys.",
    severity: "info",
    createdAt: new Date(Date.now() - 1000 * 60 * 70).toISOString(),
  },
];

const customerSavedBillers: CustomerSavedBiller[] = [
  {
    id: "BILLER-001",
    customerId: "CUS-001",
    category: "electricity",
    provider: "Kaduna Electric",
    billerId: "KEDCO-4401",
    customerReference: "METER-554401",
    nickname: "Farm power",
    lastAmount: 48500,
    verifiedName: "Amina Yusuf Farms Yard",
    lastPaidAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 8).toISOString(),
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 34).toISOString(),
  },
  {
    id: "BILLER-002",
    customerId: "CUS-001",
    category: "internet",
    provider: "Swift Fibre",
    billerId: "SWIFT-2209",
    customerReference: "ACC-220998",
    nickname: "Office data",
    lastAmount: 32000,
    verifiedName: "Amina Yusuf Farms HQ",
    lastPaidAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12).toISOString(),
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 44).toISOString(),
  },
  {
    id: "BILLER-003",
    customerId: "CUS-002",
    category: "school",
    provider: "Northern Business School",
    billerId: "NBS-1180",
    customerReference: "STUDENT-1180",
    nickname: "Executive tuition",
    lastAmount: 210000,
    verifiedName: "Sadiq Trade Exporters Training Desk",
    lastPaidAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 19).toISOString(),
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 63).toISOString(),
  },
];

const customerBillPayments: CustomerBillPaymentRecord[] = [
  {
    id: "CBILL-001",
    customerId: "CUS-001",
    category: "electricity",
    provider: "Kaduna Electric",
    amount: 48500,
    status: "paid",
    paidAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 8).toISOString(),
    reference: "54B-UTIL-4401",
    billerId: "BILLER-001",
    customerReference: "METER-554401",
    customerName: "Amina Yusuf Farms Yard",
    evidenceStatus: "verified",
    channel: "saved-biller",
  },
  {
    id: "CBILL-002",
    customerId: "CUS-001",
    category: "internet",
    provider: "Swift Fibre",
    amount: 32000,
    status: "scheduled",
    paidAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2).toISOString(),
    reference: "54B-DATA-2209",
    billerId: "BILLER-002",
    customerReference: "ACC-220998",
    customerName: "Amina Yusuf Farms HQ",
    scheduledFor: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2).toISOString(),
    evidenceStatus: "scheduled",
    channel: "saved-biller",
  },
  {
    id: "CBILL-003",
    customerId: "CUS-002",
    category: "school",
    provider: "Northern Business School",
    amount: 210000,
    status: "paid",
    paidAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 19).toISOString(),
    reference: "54B-SCHOOL-1180",
    billerId: "BILLER-003",
    customerReference: "STUDENT-1180",
    customerName: "Sadiq Trade Exporters Training Desk",
    evidenceStatus: "ready",
    channel: "operator-assisted",
  },
];

const customerTransfers: CustomerTransferRecord[] = [
  {
    id: "CTR-001",
    customerId: "CUS-001",
    beneficiaryName: "Amina Input Suppliers",
    amount: 185000,
    narration: "Input restock settlement",
    transferType: "bank",
    status: "completed",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
    bankCode: "058",
    bankName: "GTBank",
    accountNumber: "0123456789",
    accountName: "Amina Input Suppliers",
    confirmedAt: new Date(Date.now() - 1000 * 60 * 60 * 6 + 1000 * 60 * 2).toISOString(),
    approvalState: "not_required",
  },
  {
    id: "CTR-002",
    customerId: "CUS-001",
    beneficiaryName: "Workflow desk release",
    amount: 950000,
    narration: "Collateral top-up for workflow case",
    transferType: "workflow",
    status: "submitted",
    createdAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
    workflowId: "WF-1182",
    confirmedAt: new Date(Date.now() - 1000 * 60 * 88).toISOString(),
    approvalState: "approved",
  },
];

const customerApprovals: CustomerApprovalRequest[] = [
  {
    id: "CAP-001",
    customerId: "CUS-001",
    entityType: "card_control",
    entityId: "CARD-002",
    title: "Approve virtual card unlock",
    detail: "International usage unlock requires branch review before customer self-service can resume.",
    route: "/customer/cards",
    state: "pending",
    requestedAt: new Date(Date.now() - 1000 * 60 * 42).toISOString(),
    requestedByRole: "customer",
    requestedById: "CUS-001",
    approvalRole: "branch",
  },
  {
    id: "CAP-002",
    customerId: "CUS-001",
    entityType: "scheduled_bill",
    entityId: "CBILL-002",
    title: "Approve scheduled data payment",
    detail: "Scheduled Swift Fibre payment is awaiting branch confirmation before release.",
    route: "/customer/bills",
    state: "pending",
    requestedAt: new Date(Date.now() - 1000 * 60 * 24).toISOString(),
    requestedByRole: "customer",
    requestedById: "CUS-001",
    approvalRole: "branch",
  },
];

const defaultCustomerApprovals: CustomerApprovalRequest[] = customerApprovals.map((approval) => ({ ...approval }));

const workflowCases: WorkflowCase[] = [
  {
    id: "WF-1182",
    customer: "Amina Yusuf Farms",
    product: "Trade finance",
    stage: "Approval",
    status: "In Progress",
    channel: "Branch plus ops desk",
    amount: 18500000,
    nextAction: "Confirm collateral perfection and release import settlement memo.",
    slaHours: 6,
  },
  {
    id: "WF-1183",
    customer: "Sadiq Trade Exporters",
    product: "Dispute management",
    stage: "KYC",
    status: "Ready",
    channel: "PWA operations",
    amount: 3200000,
    nextAction: "Collect merchant evidence pack and validate customer narrative.",
    slaHours: 8,
  },
  {
    id: "WF-1184",
    customer: "Grace Community Cooperative",
    product: "Agricultural insurance",
    stage: "Origination",
    status: "Blocked",
    channel: "Field onboarding",
    amount: 4500000,
    nextAction: "Resolve missing farm-plot coordinates before underwriting handoff.",
    slaHours: 12,
  },
  {
    id: "WF-1185",
    customer: "Haruna Agent Network",
    product: "Agent settlement service",
    stage: "Fulfilment",
    status: "In Progress",
    channel: "Agent banking hub",
    amount: 2750000,
    nextAction: "Approve float top-up and release assisted settlement batch.",
    slaHours: 26,
  },
  {
    id: "WF-1186",
    customer: "Kaduna Milling Consortium",
    product: "Seasonal crop loan service review",
    stage: "Monitoring",
    status: "Blocked",
    channel: "Agriculture desk",
    amount: 22500000,
    nextAction: "Repair warehouse receipt mismatch and resume disbursement service track.",
    slaHours: 30,
  },
  {
    id: "WF-1187",
    customer: "Lagos Merchant Acquiring Pool",
    product: "Merchant settlement analytics",
    stage: "Approval",
    status: "Ready",
    channel: "Merchant service console",
    amount: 8200000,
    nextAction: "Approve export-ready merchant fee package for downstream reconciliation.",
    slaHours: 18,
  },
  {
    id: "WF-1188",
    customer: "Grace Community Cooperative",
    product: "Customer onboarding service",
    stage: "KYC",
    status: "In Progress",
    channel: "Customer mobile onboarding",
    amount: 850000,
    nextAction: "Complete document review and customer risk grading before account activation.",
    slaHours: 10,
  },
  {
    id: "WF-1189",
    customer: "Sadiq Trade Exporters",
    product: "Dispute repair workflow",
    stage: "Monitoring",
    status: "Blocked",
    channel: "Operations queue",
    amount: 1600000,
    nextAction: "Escalate exception backlog and confirm reversal funding path.",
    slaHours: 34,
  },
  {
    id: "WF-1190",
    customer: "Adebisi Family Housing Cooperative",
    product: "Mortgage servicing",
    stage: "Approval",
    status: "In Progress",
    channel: "Mortgage desk",
    amount: 68500000,
    nextAction: "Confirm property valuation variance and refresh debt-service coverage sign-off before offer issuance.",
    slaHours: 20,
  },
  {
    id: "WF-1191",
    customer: "Sunrise Estate Subscribers",
    product: "Mortgage servicing",
    stage: "Fulfilment",
    status: "Blocked",
    channel: "Branch plus legal desk",
    amount: 41200000,
    nextAction: "Resolve title-document exception and requeue legal perfection before disbursement release.",
    slaHours: 36,
  },
];

const operatorActions: OperatorAction[] = [
  {
    id: "ACTN-301",
    domainKey: "trade-finance",
    title: "Review letter-of-credit discrepancy pack",
    detail: "Confirm amendment approval and partner-bank response before settlement release.",
    owner: "Trade desk",
    due: "Due in 45 min",
    route: "/trade-finance",
    status: "Pending",
    roles: ["operations", "treasury"],
  },
  {
    id: "ACTN-302",
    domainKey: "dispute-management",
    title: "Complete card dispute evidence sweep",
    detail: "Collect merchant receipt and customer narrative before reversal posture is finalized.",
    owner: "Dispute operations",
    due: "Due in 1h 20m",
    route: "/disputes",
    status: "In progress",
    roles: ["operations", "compliance"],
  },
  {
    id: "ACTN-303",
    domainKey: "agricultural-insurance",
    title: "Validate weather-trigger claim cohort",
    detail: "Compare rainfall trigger feed with enrolled crop-cover policy group before payout sign-off.",
    owner: "Insurance desk",
    due: "Due today",
    route: "/agricultural-insurance",
    status: "Pending",
    roles: ["compliance", "operations"],
  },
  {
    id: "ACTN-304",
    domainKey: "ledger-reconciliation",
    title: "Acknowledge unrepaired ledger variance",
    detail: "Review TigerBeetle to PostgreSQL delta and assign the next repair owner.",
    owner: "Ledger control",
    due: "Due in 2h",
    route: "/ledger-sync",
    status: "Pending",
    roles: ["treasury"],
  },
  {
    id: "ACTN-305",
    domainKey: "analytics",
    title: "Approve billing evidence package",
    detail: "Validate signed settlement exports and release the commercial pack for finance review.",
    owner: "Commercial analytics",
    due: "Due in 55 min",
    route: "/billing",
    status: "In progress",
    roles: ["operations", "treasury"],
  },
  {
    id: "ACTN-306",
    domainKey: "analytics",
    title: "Review adoption drift for assisted channels",
    detail: "Compare customer onboarding throughput with branch and mobile conversion posture before publishing analytics notes.",
    owner: "Adoption desk",
    due: "Due today",
    route: "/usage-analytics",
    status: "Pending",
    roles: ["operations", "compliance"],
  },
  {
    id: "ACTN-307",
    domainKey: "operations",
    title: "Escalate alert backlog across payment and identity rails",
    detail: "Route unresolved warning events into operations and security owners with signed audit continuity.",
    owner: "Alert desk",
    due: "Due in 35 min",
    route: "/alerts",
    status: "Pending",
    roles: ["operations", "compliance"],
  },
  {
    id: "ACTN-308",
    domainKey: "operations",
    title: "Confirm customer card-control exceptions",
    detail: "Review lock-state overrides and international control changes before the next servicing window.",
    owner: "Customer servicing",
    due: "Due in 90 min",
    route: "/customer/cards",
    status: "In progress",
    roles: ["operations", "branch"],
  },
  {
    id: "ACTN-309",
    domainKey: "mortgage-servicing",
    title: "Approve collateral perfection exception pack",
    detail: "Validate title remediation evidence, refreshed valuation notes, and affordability override before offer issuance proceeds.",
    owner: "Mortgage desk",
    due: "Due in 2h 15m",
    route: "/mortgage",
    status: "Pending",
    roles: ["branch", "operations"],
  },
  {
    id: "ACTN-310",
    domainKey: "mortgage-servicing",
    title: "Review arrears early-warning outreach",
    detail: "Confirm branch contact attempts and repayment restructuring posture for the flagged mortgage cohort.",
    owner: "Collections support",
    due: "Due today",
    route: "/mortgage",
    status: "In progress",
    roles: ["operations"],
  },
  {
    id: "ACTN-311",
    domainKey: "education-loans",
    title: "Approve guarantor and admission exception pack",
    detail: "Validate guarantor evidence, admission-letter refresh, and school-fee disbursement guardrails before release proceeds.",
    owner: "Education finance desk",
    due: "Due in 1h 35m",
    route: "/education-loans",
    status: "Pending",
    roles: ["branch", "operations"],
  },
  {
    id: "ACTN-312",
    domainKey: "education-loans",
    title: "Review delinquency outreach and rollover posture",
    detail: "Confirm guardian contact attempts, rescheduling posture, and fee-cycle continuity for the flagged student-finance cohort.",
    owner: "Collections support",
    due: "Due today",
    route: "/education-loans",
    status: "In progress",
    roles: ["operations"],
  },
  {
    id: "ACTN-313",
    domainKey: "esusu-groups",
    title: "Approve contribution-cycle exception and payout hold",
    detail: "Validate missed-contribution remediation, payout readiness, and agent follow-through before the next group rotation closes.",
    owner: "Esusu operations desk",
    due: "Due in 58m",
    route: "/esusu",
    status: "Pending",
    roles: ["branch", "operations"],
  },
  {
    id: "ACTN-314",
    domainKey: "esusu-groups",
    title: "Review reminder cadence and group-health outreach",
    detail: "Confirm reminder-channel timing, defaulter outreach posture, and collection continuity for the flagged savings circles.",
    owner: "Community collections",
    due: "Due today",
    route: "/esusu",
    status: "In progress",
    roles: ["operations"],
  },
  {
    id: "ACTN-315",
    domainKey: "virtual-accounts",
    title: "Approve dedicated VAN suspension and settlement hold",
    detail: "Validate account suspension, inbound settlement posture, and downstream collection routing for the flagged virtual account cohort.",
    owner: "Collections switch desk",
    due: "Due in 44m",
    route: "/virtual-accounts",
    status: "Pending",
    roles: ["branch", "operations"],
  },
  {
    id: "ACTN-316",
    domainKey: "virtual-accounts",
    title: "Review dynamic VAN issuance and payment exceptions",
    detail: "Confirm one-time account issuance, failed inbound payment retries, and merchant allocation posture for the active VAN batch.",
    owner: "Payments operations",
    due: "Due today",
    route: "/virtual-accounts",
    status: "In progress",
    roles: ["operations"],
  },
];

const defaultOperatorActions: OperatorAction[] = operatorActions.map((action) => ({ ...action, roles: [...action.roles] }));

const auditTrail: AuditEntry[] = [
  {
    id: "AUD-901",
    timestamp: new Date(Date.now() - 1000 * 60 * 40).toISOString(),
    actorRole: "treasury",
    actorId: "treasury.lead",
    entityType: "ledger_discrepancy",
    entityId: "REC-4401",
    action: "review_started",
    outcome: "Variance triage opened for TigerBeetle/PostgreSQL parity drift.",
    severity: "warning",
    route: "/ledger-sync",
    middleware: ["TigerBeetle", "Postgres", "Kafka", "Lakehouse"],
    detail: "The reconciliation desk reviewed the latest discrepancy snapshot and queued a manual repair decision.",
  },
  {
    id: "AUD-902",
    timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    actorRole: "operations",
    actorId: "ops.supervisor",
    entityType: "erpnext_sync",
    entityId: "ERP-771",
    action: "retry_queued",
    outcome: "Retry scheduled with dependency-aware posture.",
    severity: "info",
    route: "/erpnext-sync",
    middleware: ["Kafka", "Postgres", "Lakehouse"],
    detail: "The accounting integration queue now retains retry evidence and exposes the action through the workbench.",
  },
  {
    id: "AUD-903",
    timestamp: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    actorRole: "operations",
    actorId: "billing.controller",
    entityType: "billing_export",
    entityId: "BILL-READY-402",
    action: "approval_signed",
    outcome: "Billing export package signed for finance review.",
    severity: "info",
    route: "/billing",
    middleware: ["Postgres", "Lakehouse", "Kafka"],
    detail: "The commercial desk signed the latest settlement evidence package and queued it for finance distribution.",
  },
  {
    id: "AUD-904",
    timestamp: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
    actorRole: "compliance",
    actorId: "alert.supervisor",
    entityType: "alert_queue",
    entityId: "ALT-RECON-18",
    action: "escalation_opened",
    outcome: "Alert backlog escalated for payment and identity review.",
    severity: "critical",
    route: "/alerts",
    middleware: ["Kafka", "Redis", "APISIX"],
    detail: "A warning cluster spanning payment retries and identity review has been escalated into the shared alert desk.",
  },
  {
    id: "AUD-905",
    timestamp: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
    actorRole: "operations",
    actorId: "analytics.operator",
    entityType: "usage_analytics",
    entityId: "ANA-220",
    action: "export_refreshed",
    outcome: "Usage analytics evidence pack refreshed with customer and merchant adoption posture.",
    severity: "warning",
    route: "/usage-analytics",
    middleware: ["Lakehouse", "Kafka", "Postgres"],
    detail: "Adoption analytics was refreshed after a branch-channel lag triggered review of onboarding throughput.",
  },
  {
    id: "AUD-908",
    timestamp: new Date(Date.now() - 1000 * 60 * 6).toISOString(),
    actorRole: "operations",
    actorId: "customer.servicing.lead",
    entityType: "customer_card",
    entityId: "CRD-1001",
    action: "card_controls_reviewed",
    outcome: "Card control overrides verified for retained servicing evidence.",
    severity: "info",
    route: "/customer/cards",
    middleware: ["Redis", "Postgres", "Permify"],
    detail: "The servicing desk reviewed international and online card controls and retained the result for later customer evidence.",
  },
  {
    id: "AUD-909",
    timestamp: new Date(Date.now() - 1000 * 60 * 22).toISOString(),
    actorRole: "operations",
    actorId: "mortgage.supervisor",
    entityType: "mortgage_case",
    entityId: "WF-1190",
    action: "underwriting_review_started",
    outcome: "Mortgage affordability and valuation exception review opened.",
    severity: "warning",
    route: "/mortgage",
    middleware: ["Temporal", "Kafka", "Postgres"],
    detail: "The mortgage desk opened a routed underwriting review so collateral and affordability evidence stay visible in the shared shell.",
  },
  {
    id: "AUD-910",
    timestamp: new Date(Date.now() - 1000 * 60 * 9).toISOString(),
    actorRole: "branch",
    actorId: "branch.mortgage.officer",
    entityType: "mortgage_case",
    entityId: "WF-1191",
    action: "collateral_exception_flagged",
    outcome: "Title-perfection exception escalated before disbursement release.",
    severity: "critical",
    route: "/mortgage",
    middleware: ["Temporal", "Kafka", "Postgres", "Permify"],
    detail: "The routed mortgage workflow now records legal-perfection blockers as explicit audit evidence instead of burying them in overview posture.",
  },
  {
    id: "AUD-911",
    timestamp: new Date(Date.now() - 1000 * 60 * 16).toISOString(),
    actorRole: "operations",
    actorId: "education.finance.supervisor",
    entityType: "education_loan_case",
    entityId: "WF-1192",
    action: "guarantor_review_started",
    outcome: "Education-loan guarantor and admission review opened.",
    severity: "warning",
    route: "/education-loans",
    middleware: ["Temporal", "Kafka", "Postgres"],
    detail: "The education-loan desk opened a routed guarantor and admission review so school-fee disbursement blockers stay visible in the shared shell.",
  },
  {
    id: "AUD-912",
    timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    actorRole: "branch",
    actorId: "branch.education.officer",
    entityType: "education_loan_case",
    entityId: "WF-1193",
    action: "fee_disbursement_hold_flagged",
    outcome: "School-fee disbursement hold escalated pending guarantor remediation.",
    severity: "critical",
    route: "/education-loans",
    middleware: ["Temporal", "Kafka", "Postgres", "Permify"],
    detail: "The routed education-loan workflow now records guarantor and admission blockers as explicit audit evidence instead of hiding them in overview posture.",
  },
  {
    id: "AUD-913",
    timestamp: new Date(Date.now() - 1000 * 60 * 19).toISOString(),
    actorRole: "operations",
    actorId: "esusu.supervisor",
    entityType: "esusu_group",
    entityId: "ESU-4401",
    action: "collection_cycle_review_started",
    outcome: "Contribution-cycle and payout review opened for flagged esusu groups.",
    severity: "warning",
    route: "/esusu",
    middleware: ["Temporal", "Kafka", "Postgres", "Redis"],
    detail: "The routed esusu desk opened a collection-cycle review so reminder cadence and payout readiness stay visible in the shared shell.",
  },
  {
    id: "AUD-914",
    timestamp: new Date(Date.now() - 1000 * 60 * 7).toISOString(),
    actorRole: "branch",
    actorId: "agent.esusu.fieldlead",
    entityType: "esusu_group",
    entityId: "ESU-4402",
    action: "payout_hold_flagged",
    outcome: "Payout hold escalated after missed-contribution and identity verification exceptions.",
    severity: "critical",
    route: "/esusu",
    middleware: ["Temporal", "Kafka", "Postgres", "Redis", "APISIX"],
    detail: "The routed esusu workflow now records contribution and payout blockers as explicit audit evidence instead of leaving them implied inside service notes.",
  },
  {
    id: "AUD-915",
    timestamp: new Date(Date.now() - 1000 * 60 * 16).toISOString(),
    actorRole: "operations",
    actorId: "payments.van.supervisor",
    entityType: "virtual_account",
    entityId: "VAN-9801",
    action: "dedicated_van_suspension_review_started",
    outcome: "Dedicated VAN suspension and settlement review opened for a flagged collections account.",
    severity: "warning",
    route: "/virtual-accounts",
    middleware: ["TigerBeetle", "Kafka", "Postgres"],
    detail: "The routed VAN desk opened a suspension review so inbound settlement posture and collection continuity stay visible in the shared shell.",
  },
  {
    id: "AUD-916",
    timestamp: new Date(Date.now() - 1000 * 60 * 6).toISOString(),
    actorRole: "branch",
    actorId: "branch.collections.officer",
    entityType: "virtual_account",
    entityId: "VAN-9824",
    action: "dynamic_van_payment_exception_flagged",
    outcome: "Dynamic VAN payment exception escalated after failed inbound allocation and retry mismatch.",
    severity: "critical",
    route: "/virtual-accounts",
    middleware: ["TigerBeetle", "Kafka", "Postgres", "Redis"],
    detail: "The routed virtual-account workflow now records issuance and payment-allocation blockers as explicit audit evidence instead of leaving them inside middleware summaries.",
  },
];

const defaultAuditTrail: AuditEntry[] = auditTrail.map((entry) => ({ ...entry, middleware: [...entry.middleware] }));

const exportJobs: ExportJob[] = [
  {
    id: "EXP-201",
    domainKey: "ledger-reconciliation",
    title: "Ledger variance summary",
    format: "csv",
    status: "Ready",
    createdAt: new Date(Date.now() - 1000 * 60 * 70).toISOString(),
    requestedByRole: "treasury",
    route: "/ledger-sync",
    rowCount: 42,
    approvalState: "Signed",
    approvalSignature: "TREASURY-OPS-SIGNOFF",
    downloadUrl: "/api/platform/exports/EXP-201/download",
  },
  {
    id: "EXP-202",
    domainKey: "dispute-management",
    title: "Dispute case review pack",
    format: "json",
    status: "Ready",
    createdAt: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    requestedByRole: "compliance",
    route: "/disputes",
    rowCount: 18,
    approvalState: "Signed",
    approvalSignature: "COMPLIANCE-LEGAL-SIGNOFF",
    downloadUrl: "/api/platform/exports/EXP-202/download",
  },
  {
    id: "EXP-203",
    domainKey: "analytics",
    title: "Billing settlement readiness pack",
    format: "xlsx",
    status: "Ready",
    createdAt: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    requestedByRole: "operations",
    route: "/billing",
    rowCount: 27,
    approvalState: "Signed",
    approvalSignature: "BILLING-FINANCE-SIGNOFF",
    downloadUrl: "/api/platform/exports/EXP-203/download",
  },
  {
    id: "EXP-204",
    domainKey: "analytics",
    title: "Usage analytics adoption snapshot",
    format: "csv",
    status: "Ready",
    createdAt: new Date(Date.now() - 1000 * 60 * 11).toISOString(),
    requestedByRole: "operations",
    route: "/usage-analytics",
    rowCount: 54,
    approvalState: "Pending review",
    approvalSignature: "ANALYTICS-OPS-REVIEW",
    downloadUrl: "/api/platform/exports/EXP-204/download",
  },
  {
    id: "EXP-205",
    domainKey: "operations",
    title: "Alert desk escalation package",
    format: "json",
    status: "Ready",
    createdAt: new Date(Date.now() - 1000 * 60 * 9).toISOString(),
    requestedByRole: "compliance",
    route: "/alerts",
    rowCount: 13,
    approvalState: "Signed",
    approvalSignature: "ALERT-COMPLIANCE-SIGNOFF",
    downloadUrl: "/api/platform/exports/EXP-205/download",
  },
  {
    id: "EXP-206",
    domainKey: "customer-operations",
    title: "Customer card-control audit pack",
    format: "csv",
    status: "Ready",
    createdAt: new Date(Date.now() - 1000 * 60 * 7).toISOString(),
    requestedByRole: "operations",
    route: "/customer/cards",
    rowCount: 16,
    approvalState: "Signed",
    approvalSignature: "CUSTOMER-SERVICING-SIGNOFF",
    downloadUrl: "/api/platform/exports/EXP-206/download",
  },
  {
    id: "EXP-207",
    domainKey: "mortgage-servicing",
    title: "Mortgage underwriting exception pack",
    format: "json",
    status: "Ready",
    createdAt: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    requestedByRole: "operations",
    route: "/mortgage",
    rowCount: 14,
    approvalState: "Signed",
    approvalSignature: "MORTGAGE-OPS-SIGNOFF",
    downloadUrl: "/api/platform/exports/EXP-207/download",
  },
  {
    id: "EXP-208",
    domainKey: "education-loans",
    title: "Education-loan disbursement exception pack",
    format: "json",
    status: "Ready",
    createdAt: new Date(Date.now() - 1000 * 60 * 14).toISOString(),
    requestedByRole: "operations",
    route: "/education-loans",
    rowCount: 11,
    approvalState: "Signed",
    approvalSignature: "EDU-FINANCE-SIGNOFF",
    downloadUrl: "/api/platform/exports/EXP-208/download",
  },
  {
    id: "EXP-209",
    domainKey: "esusu-groups",
    title: "Esusu payout and defaulter review pack",
    format: "json",
    status: "Ready",
    createdAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    requestedByRole: "operations",
    route: "/esusu",
    rowCount: 17,
    approvalState: "Signed",
    approvalSignature: "ESUSU-OPS-SIGNOFF",
    downloadUrl: "/api/platform/exports/EXP-209/download",
  },
  {
    id: "EXP-210",
    domainKey: "virtual-accounts",
    title: "VAN suspension and settlement evidence pack",
    format: "json",
    status: "Ready",
    createdAt: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
    requestedByRole: "operations",
    route: "/virtual-accounts",
    rowCount: 24,
    approvalState: "Signed",
    approvalSignature: "VAN-OPS-SIGNOFF",
    downloadUrl: "/api/platform/exports/EXP-210/download",
  },
];

type PersistedRuntimeState = {
  customers?: CustomerRecord[];
  customerCards?: CustomerCardProfile[];
  customerCardEvents?: CustomerCardEvent[];
  customerSavedBillers?: CustomerSavedBiller[];
  customerBillPayments?: CustomerBillPaymentRecord[];
  customerTransfers?: CustomerTransferRecord[];
  customerApprovals?: CustomerApprovalRequest[];
  workflowCases?: WorkflowCase[];
  operatorActions?: OperatorAction[];
  auditTrail?: AuditEntry[];
  exportJobs?: ExportJob[];
  partnerOnboardingRecords?: ReturnType<typeof serializePartnerOnboardingState>["partnerOnboardingRecords"];
  partnerApprovalRecords?: ReturnType<typeof serializePartnerOnboardingState>["partnerApprovalRecords"];
};

function replaceCollection<T>(target: T[], source?: T[]) {
  if (!Array.isArray(source)) return;
  target.splice(0, target.length, ...source);
}

function parseAuditSequence(id: string) {
  const match = /^AUD-(\d+)$/.exec(id);
  return match ? Number(match[1]) : 900;
}

function maxAuditSequence(entries: AuditEntry[]) {
  return entries.reduce((maxValue, entry) => Math.max(maxValue, parseAuditSequence(entry.id)), 900);
}

let auditSequence = maxAuditSequence(auditTrail);
let persistenceChain: Promise<void> = Promise.resolve();

function currentRuntimeState(): PersistedRuntimeState {
  return {
    customers: customers ?? [],
    customerCards: customerCards ?? [],
    customerCardEvents: customerCardEvents ?? [],
    customerSavedBillers: customerSavedBillers ?? [],
    customerBillPayments: customerBillPayments ?? [],
    customerTransfers: customerTransfers ?? [],
    customerApprovals: customerApprovals ?? [],
    workflowCases: workflowCases ?? [],
    operatorActions: operatorActions ?? [],
    auditTrail: auditTrail ?? [],
    exportJobs: exportJobs ?? [],
    ...serializePartnerOnboardingState(),
  };
}

function persistRuntimeState() {
  const payload = currentRuntimeState();
  fs.mkdirSync(persistenceDirectory, { recursive: true });
  fs.writeFileSync(persistenceFile, JSON.stringify(payload, null, 2));
  persistenceChain = persistenceChain
    .then(async () => {
      await syncRuntimeStateToDb(
        tenantId,
        {
          ...payload,
          tenantConfiguration: runtimeTenantConfigurationSeed,
        } as any,
      );
    })
    .catch((error) => {
      logger.error("Unable to persist platform runtime state", { error: String(error) });
    });
}

async function refreshPartnerOnboardingRuntimeFromDb() {
  const parsed = await loadRuntimeStateFromDb();
  if (!parsed) return;
  hydratePartnerOnboardingState({
    partnerOnboardingRecords: parsed.partnerOnboardingRecords,
    partnerApprovalRecords: parsed.partnerApprovalRecords,
  });
}


async function hydrateRuntimeState() {
  try {
    await ensurePlatformSeed(
      tenantId,
      {
        ...currentRuntimeState(),
        tenantConfiguration: runtimeTenantConfigurationSeed,
      } as any,
    );

    const fileState: PersistedRuntimeState | null = fs.existsSync(persistenceFile)
      ? (JSON.parse(fs.readFileSync(persistenceFile, "utf8")) as PersistedRuntimeState)
      : null;
    const parsed = await loadRuntimeStateFromDb();
    const source = (parsed ?? fileState) as PersistedRuntimeState | null;
    if (source) {
      replaceCollection(customers, source.customers);
      replaceCollection(customerCards, source.customerCards);
      replaceCollection(customerCardEvents, source.customerCardEvents);
      replaceCollection(customerSavedBillers, source.customerSavedBillers);
      replaceCollection(customerBillPayments, source.customerBillPayments);
      replaceCollection(customerTransfers, source.customerTransfers);
      replaceCollection(customerApprovals, source.customerApprovals);
      replaceCollection(workflowCases, source.workflowCases);
      replaceCollection(operatorActions, source.operatorActions);
      replaceCollection(auditTrail, source.auditTrail);
      auditSequence = maxAuditSequence(auditTrail);
      replaceCollection(exportJobs, source.exportJobs);
      const fallbackPartnerState = {
        partnerOnboardingRecords: source.partnerOnboardingRecords ?? fileState?.partnerOnboardingRecords,
        partnerApprovalRecords: source.partnerApprovalRecords ?? fileState?.partnerApprovalRecords,
      };
      hydratePartnerOnboardingState(fallbackPartnerState);
      if (
        parsed &&
        ((!parsed.partnerOnboardingRecords?.length && (fileState?.partnerOnboardingRecords?.length ?? 0) > 0) ||
          (!parsed.partnerApprovalRecords?.length && (fileState?.partnerApprovalRecords?.length ?? 0) > 0))
      ) {
        persistRuntimeState();
      }
      return;
    }

    return;
  } catch (error) {
    logger.error("Unable to hydrate persisted runtime state", { error: String(error) });
  }
}

void hydrateRuntimeState();
void ensureBillingEngineSeed().catch((error) => {
  logger.error("Unable to seed billing engine runtime", { error: String(error) });
});

function getRoleProfile(role: OperatorRole) {
  return roleProfiles.find((item) => item.role === role) || roleProfiles[1];
}

function readRole(req: Request): OperatorRole {
  const raw = String(req.header("x-operator-role") || req.query.role || "operations").toLowerCase();
  if (raw === "branch" || raw === "operations" || raw === "treasury" || raw === "compliance") {
    return raw;
  }
  return "operations";
}

function readActorId(req: Request, role: OperatorRole) {
  return String(req.header("x-actor-id") || `${role}.default`);
}

function nextCustomerId() {
  return `CUS-${String(customers.length + 1).padStart(3, "0")}`;
}

function nextAuditId() {
  auditSequence += 1;
  return `AUD-${String(auditSequence).padStart(3, "0")}`;
}

function nextExportId() {
  return `EXP-${String(exportJobs.length + 201).padStart(3, "0")}`;
}

function nextCardEventId() {
  return `CEVT-${String(customerCardEvents.length + 1).padStart(3, "0")}`;
}

function nextSavedBillerId() {
  return `BILLER-${String(customerSavedBillers.length + 1).padStart(3, "0")}`;
}

function nextBillPaymentId() {
  return `CBILL-${String(customerBillPayments.length + 1).padStart(3, "0")}`;
}

function nextTransferId() {
  return `CTR-${String(customerTransfers.length + 1).padStart(3, "0")}`;
}

function nextApprovalId() {
  return `CAP-${String(customerApprovals.length + 1).padStart(3, "0")}`;
}

function resolveCustomerId(req: Request) {
  const requested = String(req.query.customerId || req.header("x-customer-id") || customers[0]?.id || "");
  return customers.some((item) => item.id === requested) ? requested : customers[0]?.id || requested;
}

function buildCustomerStatements(customerId: string): CustomerStatementRecord[] {
  const customer = customers.find((item) => item.id === customerId);
  const billRows = customerBillPayments
    .filter((item) => item.customerId === customerId)
    .map<CustomerStatementRecord>((item) => ({
      id: `stmt-${item.id}`,
      customerId,
      title: `${item.provider} bill payment`,
      detail: item.customerReference ? `${item.category} for ${item.customerReference}` : `${item.category} bill servicing event`,
      amount: item.amount,
      direction: "debit",
      type: "bill_payment",
      status: item.status === "paid" ? "completed" : "pending",
      timestamp: item.paidAt,
      reference: item.reference,
      category: item.category,
    }));

  const transferRows = customerTransfers
    .filter((item) => item.customerId === customerId && ["submitted", "completed"].includes(item.status))
    .map<CustomerStatementRecord>((item) => ({
      id: `stmt-${item.id}`,
      customerId,
      title: `${item.beneficiaryName} transfer`,
      detail: item.narration || `${item.transferType} transfer servicing event`,
      amount: item.amount,
      direction: "debit",
      type: "transfer",
      status: item.status === "completed" ? "completed" : "pending",
      timestamp: item.confirmedAt || item.createdAt,
      reference: item.id,
      category: item.transferType,
    }));

  const workflowRows = workflowCases
    .filter((item) => item.customer === customer?.name)
    .slice(0, 4)
    .map<CustomerStatementRecord>((item) => ({
      id: `stmt-${item.id}`,
      customerId,
      title: item.product,
      detail: item.nextAction,
      amount: Math.max(50000, Math.round(item.amount * 0.08)),
      direction: item.status === "Ready" ? "credit" : "debit",
      type: "workflow",
      status: item.status === "Ready" ? "completed" : item.status === "Blocked" ? "pending" : "prepared",
      timestamp: new Date(Date.now() - item.slaHours * 3600_000).toISOString(),
      reference: item.id,
      category: item.stage.toLowerCase(),
    }));

  const depositRows: CustomerStatementRecord[] = customer
    ? [
        {
          id: `stmt-deposit-${customer.id}`,
          customerId,
          title: "Relationship credit sweep",
          detail: `Servicing balance refresh for ${customer.name}`,
          amount: Math.max(150000, Math.round(customer.balance * 0.04)),
          direction: "credit",
          type: "deposit",
          status: "completed",
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
          reference: `DEP-${customer.id}`,
          category: customer.segment.toLowerCase(),
        },
      ]
    : [];

  return [...billRows, ...transferRows, ...workflowRows, ...depositRows].sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime());
}
const defaultExportJobs: ExportJob[] = exportJobs.map((job) => ({
  ...job,
  approvalChain: job.approvalChain ? [...job.approvalChain] : undefined,
  signedBy: job.signedBy ? [...job.signedBy] : undefined,
}));

function ensureApprovalRequest(
  input: Omit<CustomerApprovalRequest, "id" | "requestedAt" | "state"> & { state?: CustomerApprovalRequest["state"] },
) {
  const existing = customerApprovals.find((item) => item.entityId === input.entityId && item.entityType === input.entityType && item.state === "pending");
  if (existing) {
    return existing;
  }
  const request: CustomerApprovalRequest = {
    id: nextApprovalId(),
    customerId: input.customerId,
    entityType: input.entityType,
    entityId: input.entityId,
    title: input.title,
    detail: input.detail,
    route: input.route,
    state: input.state || "pending",
    requestedAt: new Date().toISOString(),
    requestedByRole: input.requestedByRole,
    requestedById: input.requestedById,
    approvalRole: input.approvalRole,
  };
  customerApprovals.unshift(request);
  persistRuntimeState();
  return request;
}

function resolveApprovalRequest(approvalId: string, state: "approved" | "rejected", resolutionNote?: string) {
  const request = customerApprovals.find((item) => item.id === approvalId);
  if (!request) {
    return null;
  }
  request.state = state;
  request.resolvedAt = new Date().toISOString();
  request.resolutionNote = resolutionNote;
  persistRuntimeState();
  return request;
}

function recordAudit(entry: Omit<AuditEntry, "id" | "timestamp">) {
  const record: AuditEntry = {
    id: nextAuditId(),
    timestamp: new Date().toISOString(),
    ...entry,
  };
  auditTrail.unshift(record);
  persistRuntimeState();
  return record;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(input: string, init: RequestInit, attempt = 0): Promise<Response> {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), upstreamTimeoutMs);

  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
    });

    if (!response.ok && response.status >= 500 && attempt < upstreamRetryCount) {
      await sleep(150 * (attempt + 1));
      return fetchWithRetry(input, init, attempt + 1);
    }

    return response;
  } catch (error) {
    if (attempt < upstreamRetryCount) {
      await sleep(150 * (attempt + 1));
      return fetchWithRetry(input, init, attempt + 1);
    }
    throw error;
  } finally {
    clearTimeout(timeoutHandle);
  }
}

function buildUpstreamHeaders() {
  return {
    "Content-Type": "application/json",
    "X-Tenant-Id": tenantId,
    "X-Tenant-Secret": defaultTenantSecret,
    "X-Platform-Origin": platformBaseUrl,
  };
}

async function readUpstreamFailure(response: Response) {
  const contentType = response.headers.get("content-type") || "";

  try {
    if (contentType.includes("application/json")) {
      const payload = (await response.json()) as Record<string, unknown>;
      return JSON.stringify(payload).slice(0, 280);
    }

    return (await response.text()).slice(0, 280);
  } catch {
    return "unreadable upstream error body";
  }
}

async function requestJson<T>(baseUrl: string, apiPath: string) {
  const response = await fetchWithRetry(`${baseUrl}${apiPath}`, {
    headers: buildUpstreamHeaders(),
  });

  if (!response.ok) {
    const detail = await readUpstreamFailure(response);
    throw new Error(`Upstream GET ${apiPath} failed with status ${response.status}: ${detail}`);
  }

  return (await response.json()) as T;
}

async function sendJson<T>(baseUrl: string, apiPath: string, method: "POST" | "PUT", body: Record<string, unknown>) {
  const response = await fetchWithRetry(`${baseUrl}${apiPath}`, {
    method,
    headers: buildUpstreamHeaders(),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await readUpstreamFailure(response);
    throw new Error(`Upstream ${method} ${apiPath} failed with status ${response.status}: ${detail}`);
  }

  return (await response.json()) as T;
}

function serviceHealth(name: string, route: string, status: HealthStatus, description: string, dependencies: string[], latencyMs?: number) {
  return { name, route, status, description, dependencies, latencyMs };
}

function buildDomainOverview(domainKey: string, route: string) {
  const domain = defaultProducts.find((product) => product.key === domainKey) ?? null;
  const actions = operatorActions.filter((action) => action.domainKey === domainKey);
  const exports = exportJobs.filter((job) => job.route === route);
  const audits = auditTrail.filter((entry) => entry.route === route).slice(0, 12);

  return {
    asOf: new Date().toISOString(),
    domain,
    metrics: {
      openActions: actions.filter((action) => action.status !== "Done").length,
      pendingActions: actions.filter((action) => action.status === "Pending").length,
      signedExports: exports.filter((job) => job.approvalState === "Signed").length,
      auditEvents: audits.length,
    },
    actions: actions.slice(0, 12),
    exports: exports.slice(0, 12),
    audits,
  };
}

const ledgerPostingContracts: LedgerPostingContract[] = (() => {
  try {
    const raw = fs.readFileSync(ledgerContractCatalogFile, "utf8");
    const parsed = JSON.parse(raw) as { domains?: LedgerPostingContract[] };
    return parsed.domains ?? [];
  } catch {
    return [];
  }
})();

function getLedgerPostingContract(domain: string) {
  return ledgerPostingContracts.find((item) => item.domain === domain) ?? null;
}

function buildLedgerPostingPreview(domain: string, seam?: string, amount?: number, actorId?: string) {
  const contract = getLedgerPostingContract(domain);
  if (!contract) {
    return null;
  }

  const selectedSeam = seam && contract.recommendedPostingSeams.includes(seam) ? seam : contract.recommendedPostingSeams[0];
  const postingAmount = Number.isFinite(amount) && typeof amount === "number" && amount > 0 ? amount : 250000;
  const timestamp = new Date().toISOString();
  const postingId = `LPOST-${Date.now()}`;

  return {
    postingId,
    domain,
    seam: selectedSeam,
    amount: postingAmount,
    currency: "NGN",
    status: "queued_for_commit",
    contract,
    middleware: contract.middleware,
    downstreamSinks: {
      kafka: contract.kafkaPublication,
      postgres: contract.postgresPersistence,
      redis: contract.redisInvalidation,
      lakehouse: contract.lakehousePublication,
    },
    authContext: contract.authContext,
    initiatedBy: actorId ?? "system.preview",
    initiatedAt: timestamp,
    tigerBeetleTransferCode: `${domain}:${selectedSeam}:${postingId}`,
    workflowProgression: contract.workflowProgression,
  };
}

function buildSearchResults(query: string) {
  const lowered = query.toLowerCase();
  const customerResults = customers
    .filter((customer) => [customer.id, customer.name, customer.location, customer.segment, customer.relationshipManager].join(" ").toLowerCase().includes(lowered))
    .map((customer) => ({
      id: customer.id,
      type: "customer",
      title: customer.name,
      subtitle: `${customer.segment} · ${customer.status}`,
      meta: `${customer.location} · ${customer.relationshipManager}`,
      route: "/#customer-registry",
    }));
  const workflowResults = workflowCases
    .filter((item) => [item.id, item.customer, item.product, item.stage, item.nextAction].join(" ").toLowerCase().includes(lowered))
    .map((item) => ({
      id: item.id,
      type: "workflow",
      title: item.id,
      subtitle: `${item.customer} · ${item.product}`,
      meta: `${item.stage} · ${item.status}`,
      route: "/#operations",
    }));
  const actionResults = operatorActions
    .filter((item) => [item.id, item.title, item.detail, item.owner].join(" ").toLowerCase().includes(lowered))
    .map((item) => ({
      id: item.id,
      type: "action",
      title: item.title,
      subtitle: `${item.owner} · ${item.status}`,
      meta: item.detail,
      route: item.route,
    }));
  return [...customerResults, ...workflowResults, ...actionResults];
}

function withLedgerOutcome<T extends JsonRecord>(domain: string, source: string, payload: T, connected: boolean): T & {
  ledgerOutcome: {
    domain: string;
    source: string;
    connected: boolean;
    tigerBeetlePosting: string;
    middleware: string[];
    downstreamSinks: string[];
    recommendedPostingSeams: string[];
    detail: string;
  };
} {
  const contract = getLedgerPostingContract(domain);
  const domainSeams: Record<string, string[]> = {
    teller: ["cash transaction posting", "vault funding", "session balancing"],
    "islamic-banking": ["contract review", "approved exposure adjustment"],
    "ledger-sync": ["reconciliation repair", "discrepancy acknowledgement"],
    "erpnext-sync": ["post-reconciliation accounting confirmation"],
  };

  const middleware = contract?.middleware ?? (connected ? ["TigerBeetle", "Kafka", "Postgres"] : ["Postgres"]);
  const downstreamSinks = contract
    ? [contract.kafkaPublication, contract.postgresPersistence, contract.redisInvalidation, contract.lakehousePublication]
    : connected
      ? ["Kafka", "Postgres", "Redis", "Lakehouse"]
      : ["Postgres"];

  return {
    ...payload,
    ledgerOutcome: {
      domain,
      source,
      connected,
      tigerBeetlePosting: contract?.tigerBeetlePosting ?? (connected ? "service_reported" : "not_connected"),
      middleware,
      downstreamSinks,
      recommendedPostingSeams: contract?.recommendedPostingSeams ?? domainSeams[domain] ?? ["workflow confirmation", "final settlement boundary"],
      detail: contract?.detail ?? (connected
        ? `${domain} overview is using the active service response and can surface downstream ledger status.`
        : `${domain} overview is using a local fallback response until the upstream service is reachable.`),
    },
  } satisfies JsonRecord;
}

function withMiddlewareContract<T extends JsonRecord>(
  domain: string,
  action: string,
  payload: T,
  options: {
    kafkaPublication: "queued" | "not_applicable" | "conditional";
    cacheInvalidation: "refreshed" | "not_required" | "pending";
    workflowProgression: "advanced" | "awaiting_confirmation" | "awaiting_review" | "not_changed";
    tigerBeetlePosting: "queued_for_downstream" | "gated_by_workflow" | "not_applicable";
    middleware: string[];
    detail: string;
  },
): T & {
  middlewareContract: {
    domain: string;
    action: string;
    authContext: {
      issuer: string;
      gateway: string;
      authzEndpoint: string;
    };
    kafkaPublication: string;
    cacheInvalidation: string;
    workflowProgression: string;
    tigerBeetlePosting: string;
    middleware: string[];
    detail: string;
  };
} {
  return {
    ...payload,
    middlewareContract: {
      domain,
      action,
      authContext: {
        issuer: middlewareConfig.keycloak.issuer,
        gateway: middlewareConfig.apisix.publicGatewayUrl,
        authzEndpoint: middlewareConfig.permify.endpoint,
      },
      kafkaPublication: options.kafkaPublication,
      cacheInvalidation: options.cacheInvalidation,
      workflowProgression: options.workflowProgression,
      tigerBeetlePosting: options.tigerBeetlePosting,
      middleware: options.middleware,
      detail: options.detail,
    },
  } satisfies JsonRecord;
}

async function getTellerOverview() {
  try {
    return withLedgerOutcome(
      "teller",
      "service",
      await requestJson<JsonRecord>(serviceEndpoints.teller, "/api/v1/tellers/overview"),
      true,
    );
  } catch {
    return withLedgerOutcome(
      "teller",
      "fallback",
      {
        asOf: new Date().toISOString(),
        sessions: [],
        recentTransactions: [],
        summary: { sessionsUnderReview: 0, activeSessions: 0, cashOnTill: 0 },
      },
      false,
    );
  }
}

async function getReconciliationOverview() {
  try {
    return withLedgerOutcome(
      "ledger-sync",
      "service",
      await requestJson<JsonRecord>(serviceEndpoints.reconciliation, "/api/v1/reconciliation/overview"),
      true,
    );
  } catch {
    return withLedgerOutcome(
      "ledger-sync",
      "fallback",
      {
        asOf: new Date().toISOString(),
        latestSnapshot: {
          snapshotId: "unavailable",
          state: "unknown",
          discrepancyCount: 0,
          autoResolvedCount: 0,
          manualReviewCount: 0,
          lastRunAt: new Date().toISOString(),
          summary: "Reconciliation service is currently unavailable; the platform is showing retained reconciliation posture until the middleware endpoint responds.",
        },
        discrepancies: [],
      },
      false,
    );
  }
}

async function getERPNextOverview() {
  try {
    return withLedgerOutcome(
      "erpnext-sync",
      "service",
      await requestJson<JsonRecord>(serviceEndpoints.erpnext, "/api/v1/erpnext/overview"),
      true,
    );
  } catch {
    return withLedgerOutcome(
      "erpnext-sync",
      "fallback",
      {
        asOf: new Date().toISOString(),
        config: { enabled: false, mode: "unknown", mappedDocuments: [] },
        syncHistory: [],
        metrics: { queued: 0, retrying: 0, degraded: 0, succeeded: 0, failed: 0 },
      },
      false,
    );
  }
}

async function getIslamicOverview() {
  try {
    return withLedgerOutcome(
      "islamic-banking",
      "service",
      await requestJson<JsonRecord>(serviceEndpoints.islamic, "/api/v1/islamic-banking/overview"),
      true,
    );
  } catch {
    return withLedgerOutcome(
      "islamic-banking",
      "fallback",
      {
        asOf: new Date().toISOString(),
        summary: {
          activeContracts: 0,
          approvedExposure: 0,
          outstandingExposure: 0,
          delinquentContracts: 0,
          takafulCoverageRate: 0,
        },
        contracts: [],
      },
      false,
    );
  }
}

async function getTenantConfigurationsOverview() {
  const fallbackTenant = runtimeTenantConfigurationSeed;
  const fallbackItems = [
    {
      tenantId,
      name: fallbackTenant.name,
      onboardingStatus: fallbackTenant.onboardingStatus,
      segment: fallbackTenant.segment,
      region: fallbackTenant.region,
      enabledModules: fallbackTenant.enabledModules,
      featureFlags: fallbackTenant.featureFlags,
      whiteLabel: fallbackTenant.whiteLabel,
    },
  ];
  const localTenantConfigurations = await listTenantConfigurations().catch(() => []);

  try {
    const tenantList = await requestJson<{ tenants?: Array<Record<string, unknown>> }>(serviceEndpoints.tenant, "/api/v1/tenants");
    const tenants = Array.isArray(tenantList.tenants) ? tenantList.tenants : [];

    const recoveredItems = await Promise.all(
      tenants.map(async (tenant) => {
        const upstreamTenantId = String(tenant.tenant_id || tenantId);
        const [featurePayload, brandingPayload] = await Promise.all([
          requestJson<{ features?: Array<Record<string, unknown>> }>(serviceEndpoints.tenant, `/api/v1/tenants/${encodeURIComponent(upstreamTenantId)}/config/features`).catch(() => ({ features: [] })),
          requestJson<Record<string, unknown>>(serviceEndpoints.tenant, `/api/v1/tenants/${encodeURIComponent(upstreamTenantId)}/config/branding`).catch(() => ({} as Record<string, unknown>)),
        ]);

        const features = Array.isArray(featurePayload.features) ? featurePayload.features : [];
        const enabledModules = features.filter((feature) => Boolean(feature.is_enabled)).map((feature) => String(feature.feature_name || "module"));
        const branding = brandingPayload as Record<string, unknown>;

        return {
          tenantId: upstreamTenantId,
          name: String(tenant.name || upstreamTenantId),
          onboardingStatus:
            tenant.status === "active" ? "active" : tenant.status === "suspended" ? "restricted" : "draft",
          segment: inferTenantSegment(String(tenant.billing_plan || "standard")),
          region: String(tenant.namespace || "Recovered backend tenant"),
          enabledModules,
          featureFlags: features.map((feature) => ({
            key: String(feature.feature_name || "feature"),
            label: toTitleCase(String(feature.feature_name || "feature")),
            category: "operations",
            description: `Recovered backend feature flag for ${String(feature.feature_name || "feature")}.`,
            enabled: Boolean(feature.is_enabled),
            rolloutStage: resolveRolloutStage(Number(feature.rollout_pct || 0)),
            adminManaged: true,
          })),
          whiteLabel: {
            displayName: String(branding.company_name || tenant.name || upstreamTenantId),
            legalEntity: String(branding.company_name || tenant.name || upstreamTenantId),
            supportEmail: String(branding.support_email || tenant.contact_email || "platform-operations@54bank.app"),
            primaryColor: String(branding.primary_color || "#0f766e"),
            accentColor: String(branding.secondary_color || "#f59e0b"),
            logoUrl: String(branding.logo_url || `https://assets.54bank.app/logos/generated/${encodeURIComponent(upstreamTenantId.slice(0, 3).toLowerCase())}.png`),
            loginHeadline: `${String(branding.company_name || tenant.name || upstreamTenantId)} tenant controls are served from the recovered backend configuration plane.`,
            customDomain: String(branding.custom_domain || ""),
          },
        };
      }),
    );

    const itemMap = new Map<string, Record<string, unknown>>();
    for (const item of recoveredItems) {
      itemMap.set(String(item.tenantId), item);
    }
    for (const item of localTenantConfigurations) {
      itemMap.set(String(item.tenantId), item as unknown as Record<string, unknown>);
    }

    const items = Array.from(itemMap.values());
    return { asOf: new Date().toISOString(), items, total: items.length, source: recoveredItems.length ? "tenant-service+db" : "db" };
  } catch {
    const items = localTenantConfigurations.length ? localTenantConfigurations : fallbackItems;
    return {
      asOf: new Date().toISOString(),
      items,
      total: items.length,
      source: localTenantConfigurations.length ? "db-fallback" : "server-fallback",
    };
  }
}

function inferTenantSegment(plan: string): "retail" | "operations" | "growth" {
  const normalized = plan.toLowerCase();
  if (normalized.includes("enterprise") || normalized.includes("ops") || normalized.includes("control")) {
    return "operations";
  }
  if (normalized.includes("growth") || normalized.includes("partner") || normalized.includes("launch")) {
    return "growth";
  }
  return "retail";
}

function resolveRolloutStage(rolloutPct: number): "pilot" | "controlled" | "general" {
  if (rolloutPct >= 100) {
    return "general";
  }
  if (rolloutPct >= 50) {
    return "controlled";
  }
  return "pilot";
}

function toTitleCase(value: string) {
  return value
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function computeOverviewMetrics({ teller, erpnext, islamic, reconciliation }: { teller: JsonRecord; erpnext: JsonRecord; islamic: JsonRecord; reconciliation: JsonRecord }) {
  const tellerSessions = Array.isArray(teller.sessions) ? teller.sessions.length : 0;
  const discrepancies = Array.isArray(reconciliation.discrepancies) ? reconciliation.discrepancies.length : 0;
  const syncHistory = Array.isArray(erpnext.syncHistory) ? erpnext.syncHistory.length : 0;
  const islamicContracts = Array.isArray(islamic.contracts) ? islamic.contracts.length : 0;

  return [
    {
      label: "Visible banking domains",
      value: String(defaultProducts.length),
      detail: "The original core banking workbench embeds the restored domains and middleware posture.",
      trend: "up" as Trend,
    },
    {
      label: "Managed customers",
      value: String(customers.length),
      detail: "Customer records can be created and reviewed through the integrated banking shell.",
      trend: "up" as Trend,
    },
    {
      label: "Open teller sessions",
      value: String(tellerSessions),
      detail: "Active branch cash sessions currently surfaced through the teller workspace.",
      trend: tellerSessions > 0 ? ("up" as Trend) : ("flat" as Trend),
    },
    {
      label: "ERPNext sync backlog",
      value: String(syncHistory),
      detail: "Tracked outbound accounting sync items available from the ERPNext workspace.",
      trend: syncHistory > 0 ? ("down" as Trend) : ("flat" as Trend),
    },
    {
      label: "Islamic contracts",
      value: String(islamicContracts),
      detail: "Murabaha, Ijara, and Mudarabah contracts surfaced through the restored Islamic banking route.",
      trend: islamicContracts > 0 ? ("up" as Trend) : ("flat" as Trend),
    },
    {
      label: "Ledger discrepancies",
      value: String(discrepancies),
      detail: "Current TigerBeetle/PostgreSQL parity exceptions visible in the reconciliation workspace.",
      trend: discrepancies > 0 ? ("down" as Trend) : ("flat" as Trend),
    },
  ];
}

function buildTigerBeetleSurfaces(): MiddlewareSurface[] {
  return [
    {
      key: "tigerbeetle",
      title: "TigerBeetle ledger plane",
      status: "healthy",
      scope: "System of record for selected financial posting domains rather than every service.",
      languages: ["Go", "Python", "Rust-adjacent validators"],
      directlyIntegrated: true,
      notes: "Direct implementation is concentrated in ledger, reconciliation, billing, virtual accounts, mortgage, and education-loan flows.",
      services: ["ledger-service", "reconciliation-service", "virtual-account-service", "billing", "mortgage-service", "education-loan-service"],
    },
    {
      key: "kafka",
      title: "Kafka event backbone",
      status: "healthy",
      scope: "Domain events, retries, notifications, and downstream analytics fan-out.",
      languages: ["Go", "Python"],
      directlyIntegrated: true,
      notes: "TigerBeetle outcomes should be published into Kafka after posting or reconciliation decisions, not before ledger commitment.",
      services: ["payment-service", "customer-onboarding", "sms-notification-service", "education-loan-service"],
    },
    {
      key: "dapr",
      title: "Dapr invocation and state",
      status: "degraded",
      scope: "Selective state-store and service-invocation paths in hardened services.",
      languages: ["Go", "Python"],
      directlyIntegrated: false,
      notes: "Dapr is materially present but not yet universal across every TigerBeetle-adjacent service.",
      services: ["payment-service", "agricultural-service", "wallet-service", "sms-notification-service"],
    },
    {
      key: "temporal",
      title: "Temporal workflow plane",
      status: "healthy",
      scope: "Workflow orchestration for onboarding, payments, mortgage, and selected remediation flows.",
      languages: ["Go", "Python"],
      directlyIntegrated: false,
      notes: "TigerBeetle posting state should be carried explicitly in workflow activities rather than assumed by downstream steps.",
      services: ["customer-onboarding", "payment-service", "mortgage-service", "workflows"],
    },
    {
      key: "keycloak",
      title: "Keycloak identity plane",
      status: "degraded",
      scope: "Identity and realm-based authentication for protected routes and operator personas.",
      languages: ["Go", "YAML"],
      directlyIntegrated: false,
      notes: "Keycloak is real in the wider platform but not every frontend action is yet bound to live token issuance in this workbench shim.",
      services: ["onboarding-system", "api-gateway", "tenant-service"],
    },
    {
      key: "permify",
      title: "Permify authorization plane",
      status: "degraded",
      scope: "Fail-closed permission checks for selected transaction and account operations.",
      languages: ["Go", "Python"],
      directlyIntegrated: false,
      notes: "Permify is materially present, but policy enforcement still looks domain-specific rather than universal across all services.",
      services: ["payment-service", "shared/go/authz", "shared/python/authz"],
    },
    {
      key: "redis",
      title: "Redis cache and idempotency",
      status: "healthy",
      scope: "Rate limiting, idempotency, cached status, OTP, and operational throttling.",
      languages: ["Go", "Python"],
      directlyIntegrated: false,
      notes: "Redis supports TigerBeetle-adjacent flows as cache and control-plane state, not as financial truth.",
      services: ["payment-service", "sms-notification-service", "shared cache layers"],
    },
    {
      key: "apisix",
      title: "APISIX gateway",
      status: "degraded",
      scope: "Route protection, rate limiting, and tenant/header injection.",
      languages: ["Lua", "YAML", "Go"],
      directlyIntegrated: false,
      notes: "APISIX fronts the service estate and can carry Keycloak and Permify context, but TigerBeetle itself sits behind the business services rather than the gateway.",
      services: ["api-gateway", "developer-platform-service", "omnichannel-communication"],
    },
    {
      key: "mojaloop",
      title: "Mojaloop settlement rail",
      status: "degraded",
      scope: "Specialized cross-network and interoperable settlement routing.",
      languages: ["Go"],
      directlyIntegrated: false,
      notes: "Mojaloop is present in payment/trade-style seams, but the footprint remains narrow compared with Kafka, Redis, or TigerBeetle.",
      services: ["payment-service"],
    },
    {
      key: "postgres",
      title: "PostgreSQL persistence",
      status: "healthy",
      scope: "Primary persistence plus mirror and reconciliation evidence around the ledger plane.",
      languages: ["Go", "Python"],
      directlyIntegrated: true,
      notes: "TigerBeetle is paired with Postgres-backed metadata, replay, and reconciliation records instead of replacing service persistence entirely.",
      services: ["ledger-service", "reconciliation-service", "customer-service", "payment-service"],
    },
    {
      key: "lakehouse",
      title: "Lakehouse analytics plane",
      status: "healthy",
      scope: "Operational event publishing, analytics ingest, and portfolio reporting.",
      languages: ["Go", "Python"],
      directlyIntegrated: false,
      notes: "Lakehouse publishing is broad and should remain downstream of committed business and ledger outcomes.",
      services: ["ledger-service", "payment-service", "customer-onboarding", "reporting-service"],
    },
    {
      key: "fluvio",
      title: "Fluvio localized streams",
      status: "degraded",
      scope: "Niche streaming use in esusu, offline, and specialized domain flows.",
      languages: ["YAML", "Go", "Python"],
      directlyIntegrated: false,
      notes: "Fluvio is present but the footprint is narrow; it is not yet a primary TigerBeetle-adjacent event backbone.",
      services: ["esusu-service", "mobile-sync-service", "mobile-offline-service"],
    },
  ];
}

async function startServer() {
  // Environment validation (fail-fast in production)
  const resolvedEnv = validateAndLog();

  const app = express();
  const server = createServer(app);

  // WebSocket server for real-time updates (#17)
  const wss = new WebSocketServer({ server, path: "/ws" });
  const wsClients = new Set<WebSocket>();
  wss.on("connection", (ws) => {
    wsClients.add(ws);
    ws.on("close", () => wsClients.delete(ws));
    ws.send(JSON.stringify({ type: "connected", timestamp: new Date().toISOString() }));
  });
  function broadcastEvent(event: { type: string; domain?: string; data?: unknown }) {
    const msg = JSON.stringify({ ...event, timestamp: new Date().toISOString() });
    Array.from(wsClients).forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    });
  }

  app.disable("x-powered-by");
  app.set("trust proxy", true);

  // Security: Helmet (comprehensive HTTP security headers)
  app.use(helmet({
    contentSecurityPolicy: runtimeEnvironment === "production" ? {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https:"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    } : false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: "same-origin" },
    crossOriginResourcePolicy: { policy: "same-origin" },
    dnsPrefetchControl: { allow: false },
    frameguard: { action: "deny" },
    hsts: { maxAge: 31536000, includeSubDomains: true },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    xContentTypeOptions: true,
    xPermittedCrossDomainPolicies: { permittedPolicies: "none" },
  }));

  // Security: HTTP Parameter Pollution protection
  app.use(hpp());

  // Security: Global rate limiter (reads)
  app.use("/api/", rateLimit({
    windowMs: 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, please try again later" },
    skip: (req) => req.method === "OPTIONS",
  }));

  // Security: Stricter rate limiter for mutations
  app.use("/api/", rateLimit({
    windowMs: 60 * 1000,
    max: rateLimitMaxWrites,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Write rate limit exceeded" },
    skip: (req) => !["POST", "PUT", "PATCH", "DELETE"].includes(req.method),
  }));

  // Prometheus metrics middleware (#12)
  app.use(metricsMiddleware());

  // Correlation ID middleware (#11)
  app.use((req, _res, next) => {
    if (!req.headers["x-correlation-id"]) {
      req.headers["x-correlation-id"] = randomUUID();
    }
    next();
  });

  // Authentication middleware (#3) — enabled via ENABLE_AUTH=true
  app.use(authMiddleware());

  // API versioning header (#15)
  app.use("/api/", (_req, res, next) => {
    res.setHeader("X-API-Version", "v1");
    res.setHeader("X-Platform-Version", "1.0.0");
    next();
  });

  app.use(
    compression({
      threshold: 1024,
      filter: (req, res) => {
        if (req.headers["x-no-compression"]) {
          return false;
        }
        return compression.filter(req, res);
      },
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));
  app.use(requestLogger);
  app.use((req, res, next) => {
    const requestId = req.header("x-request-id") || randomUUID();
    const origin = req.header("origin");
    const derivedOrigin = `${req.protocol}://${req.get("host")}`;
    const allowedOrigins = new Set([platformBaseUrl, derivedOrigin]);

    res.setHeader("x-request-id", requestId);
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-DNS-Prefetch-Control", "off");
    res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    if (req.secure || req.header("x-forwarded-proto") === "https") {
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
    if (process.env.NODE_ENV === "production") {
      res.setHeader(
        "Content-Security-Policy",
        "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; script-src 'self' 'unsafe-inline'; connect-src 'self' https:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
      );
    }

    if (origin && !allowedOrigins.has(origin) && ["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
      res.status(403).json({ error: "Origin not allowed" });
      return;
    }

    if (req.path.startsWith("/api/")) {
      res.setHeader("Cache-Control", req.method === "GET" ? "private, max-age=15, stale-while-revalidate=30" : "no-store");
    }

    next();
  });
  app.use((req, res, next) => {
    req.setTimeout(requestTimeoutMs);
    res.setTimeout(requestTimeoutMs);
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => {
      controller.abort();
      if (!res.headersSent) {
        res.status(503).json({ error: "Request timed out", timeoutMs: requestTimeoutMs });
      }
    }, requestTimeoutMs);

    res.on("finish", () => clearTimeout(timeoutHandle));
    res.on("close", () => clearTimeout(timeoutHandle));
    res.locals.abortSignal = controller.signal;
    next();
  });
  app.use((req, res, next) => {
    if (!req.path.startsWith("/api/") || !["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
      next();
      return;
    }

    const now = Date.now();
    const bucketKey = req.header("x-forwarded-for") || req.ip || "unknown";
    const current = writeRequestBuckets.get(bucketKey);

    if (!current || current.resetAt <= now) {
      writeRequestBuckets.set(bucketKey, { count: 1, resetAt: now + rateLimitWindowMs });
      next();
      return;
    }

    if (current.count >= rateLimitMaxWrites) {
      res.setHeader("Retry-After", String(Math.ceil((current.resetAt - now) / 1000)));
      res.status(429).json({ error: "Rate limit exceeded", windowMs: rateLimitWindowMs, maxWrites: rateLimitMaxWrites });
      return;
    }

    current.count += 1;
    next();
  });

  app.get("/healthz", async (_req, res) => {
    let dbStatus: "connected" | "disconnected" | "unconfigured" = "unconfigured";
    if (process.env.DATABASE_URL) {
      try {
        const db = await getDb();
        if (db) {
          await db.execute(sql`SELECT 1`);
          dbStatus = "connected";
        }
      } catch {
        dbStatus = "disconnected";
      }
    }
    const status = dbStatus === "disconnected" ? "degraded" : "ok";
    const health = {
      status,
      app: "54bank-core-banking",
      asOf: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      memory: process.memoryUsage(),
      environment: runtimeEnvironment,
      persistence: fs.existsSync(persistenceFile) ? "available" : "initializing",
      database: dbStatus,
      configurationWarnings: runtimeConfigWarnings.length,
    };
    res.setHeader("Cache-Control", `public, max-age=${healthCacheSeconds}, stale-while-revalidate=${healthCacheSeconds}`);
    res.status(status === "ok" ? 200 : 503).json(health);
  });

  app.get("/api/platform/security/posture", (_req, res) => {
    res.json({
      asOf: new Date().toISOString(),
      headers: {
        referrerPolicy: "strict-origin-when-cross-origin",
        frameOptions: "DENY",
        contentTypeOptions: "nosniff",
        permissionsPolicy: "camera=(), microphone=(), geolocation=()",
        crossOriginOpenerPolicy: "same-origin",
        crossOriginResourcePolicy: "same-origin",
      },
      originProtection: {
        writeMethodsRestricted: true,
        allowedBaseUrl: platformBaseUrl,
      },
      runtimeDefaults: {
        tenantId,
        platformBaseUrl,
        requestBodyLimit: "1mb",
        requestTimeoutMs,
        upstreamTimeoutMs,
        upstreamRetryCount,
      },
      configurationWarnings: runtimeConfigWarnings,
      strictProductionRuntime,
      rateLimiting: {
        writeMethodsOnly: true,
        windowMs: rateLimitWindowMs,
        maxWrites: rateLimitMaxWrites,
      },
    });
  });

  app.get("/api/platform/products", async (_req, res) => {
    res.json({ asOf: new Date().toISOString(), products: defaultProducts });
  });

  app.get("/api/platform/roles", (_req, res) => {
    res.json({ asOf: new Date().toISOString(), items: roleProfiles, total: roleProfiles.length });
  });

  app.get("/api/platform/tenants/configurations", async (_req, res) => {
    res.json(await getTenantConfigurationsOverview());
  });

  app.put("/api/platform/tenants/configurations/:tenantId/feature-flags/:featureKey", async (req, res) => {
    const resolvedTenantId = req.params.tenantId;
    const featureKey = req.params.featureKey;
    const payload = req.body as { enabled?: boolean; rolloutPct?: number };

    try {
      await sendJson(
        serviceEndpoints.tenant,
        `/api/v1/tenants/${encodeURIComponent(resolvedTenantId)}/config/features/${encodeURIComponent(featureKey)}`,
        "PUT",
        {
          is_enabled: Boolean(payload.enabled),
          rollout_pct: typeof payload.rolloutPct === "number" ? payload.rolloutPct : payload.enabled ? 100 : 0,
        },
      );
    } catch {
      await sendJson(
        serviceEndpoints.tenant,
        `/api/v1/tenants/${encodeURIComponent(resolvedTenantId)}/config/features`,
        "POST",
        {
          feature_name: featureKey,
          is_enabled: Boolean(payload.enabled),
          rollout_pct: typeof payload.rolloutPct === "number" ? payload.rolloutPct : payload.enabled ? 100 : 0,
        },
      );
    }

    recordAudit({
      actorRole: readRole(req),
      actorId: readActorId(req, readRole(req)),
      entityType: "tenant_feature_flag",
      entityId: `${resolvedTenantId}:${featureKey}`,
      action: "tenant_feature_updated",
      outcome: `Tenant feature ${featureKey} updated through the recovered tenant-service bridge.`,
      severity: "info",
      route: "/admin/modules",
      middleware: ["Tenant service", "Postgres", "Permify"],
      detail: "Admin governance changes now attempt to persist through the recovered backend before falling back to local runtime state.",
    });

    res.json(await getTenantConfigurationsOverview());
  });

  app.put("/api/platform/tenants/configurations/:tenantId/branding", async (req, res) => {
    const resolvedTenantId = req.params.tenantId;
    const payload = req.body as {
      displayName?: string;
      primaryColor?: string;
      accentColor?: string;
      customDomain?: string;
      supportEmail?: string;
      logoUrl?: string;
    };

    const brandingBody = {
      company_name: payload.displayName || "Recovered 54Bank tenant",
      primary_color: payload.primaryColor || "#0f766e",
      secondary_color: payload.accentColor || "#f59e0b",
      custom_domain: payload.customDomain || "",
      support_email: payload.supportEmail || "platform-operations@54bank.app",
      logo_url: payload.logoUrl || "https://assets.54bank.app/logos/54bank-recovered.png",
      support_phone: "+234-000-000-0000",
      favicon_url: payload.logoUrl || "https://assets.54bank.app/logos/54bank-favicon.png",
    };

    try {
      await sendJson(
        serviceEndpoints.tenant,
        `/api/v1/tenants/${encodeURIComponent(resolvedTenantId)}/config/branding`,
        "PUT",
        brandingBody,
      );
    } catch {
      await sendJson(
        serviceEndpoints.tenant,
        `/api/v1/tenants/${encodeURIComponent(resolvedTenantId)}/config/branding`,
        "POST",
        brandingBody,
      );
    }

    recordAudit({
      actorRole: readRole(req),
      actorId: readActorId(req, readRole(req)),
      entityType: "tenant_branding",
      entityId: resolvedTenantId,
      action: "tenant_branding_updated",
      outcome: `Tenant branding for ${resolvedTenantId} updated through the recovered tenant-service bridge.`,
      severity: "info",
      route: "/admin/modules",
      middleware: ["Tenant service", "Postgres", "Permify"],
      detail: "White-label changes now persist through the recovered backend bridge instead of remaining local-only draft state.",
    });

    res.json(await getTenantConfigurationsOverview());
  });

  app.get("/api/platform/auth/context", (req, res) => {
    const role = readRole(req);
    const profile = getRoleProfile(role);
    res.json({
      asOf: new Date().toISOString(),
      tenantId,
      role,
      actorId: readActorId(req, role),
      issuer: middlewareConfig.keycloak.issuer,
      authzEndpoint: middlewareConfig.permify.endpoint,
      gateway: middlewareConfig.apisix.publicGatewayUrl,
      permissions: profile.permissions,
      visibleDomains: profile.visibleDomains,
      exportScopes: profile.exportScopes,
      defaultRoute: profile.defaultRoute,
    });
  });

  app.get("/api/platform/integrations/tigerbeetle", (_req, res) => {
    const middleware = buildTigerBeetleSurfaces();
    res.json({
      asOf: new Date().toISOString(),
      directIntegrationAssessment: {
        robust: true,
        universal: false,
        summary:
          "TigerBeetle is a real financial core dependency for selected services, but it is not directly integrated into every service in the platform.",
      },
      config: middlewareConfig,
      middleware,
    });
  });

  app.get("/api/platform/overview", async (_req, res) => {
    const [teller, erpnext, islamic, reconciliation] = await Promise.all([
      getTellerOverview(),
      getERPNextOverview(),
      getIslamicOverview(),
      getReconciliationOverview(),
    ]);

    const serviceHealthItems = [
      serviceHealth("Customer service", "/", "healthy", "Customer profiles, workflow transitions, documents, notes, and segments.", ["PostgreSQL", "KYC service", "search-service"]),
      serviceHealth("Teller service", "/teller", (Array.isArray(teller.sessions) && teller.sessions.length > 0 ? "healthy" : "degraded") as HealthStatus, "Branch cash operations, till sessions, and counter transactions.", ["PostgreSQL", "ledger-service", "reconciliation-service", "TigerBeetle"]),
      serviceHealth("ERPNext integration", "/erpnext-sync", ((erpnext.config as JsonRecord | undefined)?.enabled ? "healthy" : "degraded") as HealthStatus, "Outbound accounting synchronization, document mapping, and retry handling.", ["billing-service", "finance-service", "ERPNext tenant", "Kafka"]),
      serviceHealth("Islamic banking service", "/islamic-banking", (Array.isArray(islamic.contracts) && islamic.contracts.length > 0 ? "healthy" : "degraded") as HealthStatus, "Sharia-compliant financing and investment products.", ["finance-service", "insurance-service", "compliance-service"]),
      serviceHealth("Trade finance service", "/trade-finance", "degraded", "Letters of credit, documentary trade controls, and FX-dependent execution visibility.", ["fx-service", "compliance-service", "partner-bank-service", "TigerBeetle", "Lakehouse"]),
      serviceHealth("Agricultural insurance service", "/agricultural-insurance", "degraded", "Parametric crop cover, weather-triggered policy posture, and rural claims readiness.", ["insurance-service", "weather-intelligence", "compliance-service", "Fluvio"]),
      serviceHealth("Dispute service", "/disputes", "degraded", "Customer remediation, case investigation, and reversal posture across payment rails.", ["transfer-service", "merchant-service", "customer-service", "Permify"]),
      serviceHealth("Reconciliation service", "/ledger-sync", ((reconciliation.latestSnapshot as JsonRecord | undefined)?.state === "critical" ? "degraded" : "healthy") as HealthStatus, "TigerBeetle parity checks, discrepancy triage, and repair posture.", ["TigerBeetle", "PostgreSQL", "lakehouse-api", "Kafka"]),
    ];

    res.json({
      asOf: new Date().toISOString(),
      products: defaultProducts,
      serviceHealth: serviceHealthItems,
      metrics: computeOverviewMetrics({ teller, erpnext, islamic, reconciliation }),
    });
  });

  app.get("/api/platform/customers", (req, res) => {
    const role = readRole(req);
    const q = String(req.query.q || "").toLowerCase();
    const segment = String(req.query.segment || "All");
    const status = String(req.query.status || "All");
    const results = customers.filter((customer) => {
      const matchesQuery = !q || [customer.id, customer.name, customer.location, customer.relationshipManager, customer.bvn, customer.phone].join(" ").toLowerCase().includes(q);
      const matchesSegment = segment === "All" || customer.segment === segment;
      const matchesStatus = status === "All" || customer.status === status;
      return matchesQuery && matchesSegment && matchesStatus;
    });
    res.json({ asOf: new Date().toISOString(), role, items: results, total: results.length });
  });

  app.post("/api/platform/customers", validateBody(customerCreateSchema), (req, res) => {
    const role = readRole(req);
    const payload = req.body as Record<string, unknown>;
    const customer: CustomerRecord = {
      id: nextCustomerId(),
      name: String(payload.name),
      segment: String(payload.segment || "Agriculture") as CustomerSegment,
      tier: String(payload.tier || "Tier 1") as CustomerTier,
      location: String(payload.location),
      relationshipManager: String(payload.relationshipManager),
      risk: String(payload.risk || "Medium") as CustomerRisk,
      status: "Pending" as CustomerStatus,
      bvn: String(payload.bvn || "Pending capture"),
      phone: String(payload.phone || "Pending capture"),
      balance: Number(payload.balance || 0),
      lastTouchpoint: "Just now",
    };
    customers.unshift(customer);
    recordAudit({
      actorRole: role,
      actorId: readActorId(req, role),
      entityType: "customer",
      entityId: customer.id,
      action: "created",
      outcome: `Customer ${customer.name} was created in the integrated banking workbench.`,
      severity: "info",
      route: "/",
      middleware: ["Postgres", "Kafka", "Lakehouse"],
      detail: "The platform workbench created a customer record and marked it for downstream service synchronization.",
    });
    res.status(201).json(customer);
  });

  app.put("/api/platform/customers/:customerId", (req, res) => {
    const role = readRole(req);
    const target = customers.find((item) => item.id === req.params.customerId);
    if (!target) {
      res.status(404).json({ message: "Customer not found" });
      return;
    }
    Object.assign(target, req.body, { lastTouchpoint: "Just now" });
    recordAudit({
      actorRole: role,
      actorId: readActorId(req, role),
      entityType: "customer",
      entityId: target.id,
      action: "updated",
      outcome: `Customer ${target.name} was updated.`,
      severity: "info",
      route: "/",
      middleware: ["Postgres", "Lakehouse"],
      detail: "A customer profile update was recorded and is ready for downstream synchronization.",
    });
    res.json(target);
  });

  app.delete("/api/platform/customers/:customerId", (req, res) => {
    const role = readRole(req);
    const customerIndex = customers.findIndex((item) => item.id === req.params.customerId);
    if (customerIndex < 0) {
      res.status(404).json({ message: "Customer not found" });
      return;
    }

    const [removedCustomer] = customers.splice(customerIndex, 1);
    recordAudit({
      actorRole: role,
      actorId: readActorId(req, role),
      entityType: "customer",
      entityId: removedCustomer.id,
      action: "deleted",
      outcome: `Customer ${removedCustomer.name} was removed from the active registry.`,
      severity: "warning",
      route: "/",
      middleware: ["Postgres", "Lakehouse"],
      detail: "The customer registry delete flow was executed from the integrated banking workbench and queued for downstream synchronization.",
    });
    res.json({ id: removedCustomer.id, removed: true });
  });

  app.get("/api/platform/customer-servicing/cards", (req, res) => {
    const customerId = resolveCustomerId(req);
    const items = customerCards.filter((item) => item.customerId === customerId);
    res.json({ asOf: new Date().toISOString(), customerId, items, total: items.length });
  });

  app.put("/api/platform/customer-servicing/cards/:cardId", (req, res) => {
    const role = readRole(req);
    const card = customerCards.find((item) => item.id === req.params.cardId);
    if (!card) {
      res.status(404).json({ message: "Card not found" });
      return;
    }
    Object.assign(card, req.body, { updatedAt: new Date().toISOString() });
    const approvalRequest = card.isLocked || card.controls.international
      ? ensureApprovalRequest({
          customerId: card.customerId,
          entityType: "card_control",
          entityId: card.id,
          title: `Approve card-control change for •••• ${card.lastFour}`,
          detail: "High-risk card servicing changes require branch review before they are treated as fully approved.",
          route: "/customer/cards",
          requestedByRole: role,
          requestedById: readActorId(req, role),
          approvalRole: "branch",
        })
      : undefined;
    customerCardEvents.unshift({
      id: nextCardEventId(),
      cardId: card.id,
      customerId: card.customerId,
      title: card.isLocked ? "Card locked" : "Card controls updated",
      detail: "A servicing operator updated card controls or spending posture through the active platform endpoint.",
      severity: card.isLocked ? "warning" : "success",
      createdAt: new Date().toISOString(),
    });
    recordAudit({
      actorRole: role,
      actorId: readActorId(req, role),
      entityType: "customer_card",
      entityId: card.id,
      action: "updated",
      outcome: `Customer card ${card.lastFour} servicing controls were updated.`,
      severity: card.isLocked ? "warning" : "info",
      route: "/customer/cards",
      middleware: ["Postgres", "Redis", "APISIX"],
      detail: "The customer servicing endpoint recorded a card-control update and refreshed the local operational evidence layer.",
    });
    res.json({ card, approvalRequest });
  });

  app.get("/api/platform/customer-servicing/card-events", (req, res) => {
    const customerId = resolveCustomerId(req);
    const items = customerCardEvents.filter((item) => item.customerId === customerId);
    res.json({ asOf: new Date().toISOString(), customerId, items, total: items.length });
  });

  app.get("/api/platform/customer-servicing/session-preference", async (req, res) => {
    const role = readRole(req);
    const actorId = readActorId(req, role);
    const tenantScope = String(req.query.tenantId || tenantId);
    const preference = await getCustomerSessionPreference({ actorId, actorRole: role, tenantId: tenantScope });
    res.json(preference);
  });

  app.put("/api/platform/customer-servicing/session-preference", async (req, res) => {
    const role = readRole(req);
    const actorId = readActorId(req, role);
    const tenantScope = String(req.body?.tenantId || req.query.tenantId || tenantId);
    const payload = req.body as { activeCustomerId?: string };
    const requestedCustomerId = payload.activeCustomerId;

    if (!requestedCustomerId || !customers.some((item) => item.id === requestedCustomerId)) {
      res.status(400).json({ message: "activeCustomerId must reference an existing customer" });
      return;
    }

    const preference = await upsertCustomerSessionPreference({
      actorId,
      actorRole: role,
      tenantId: tenantScope,
      activeCustomerId: requestedCustomerId,
    });

    recordAudit({
      actorRole: role,
      actorId,
      entityType: "customer_session",
      entityId: requestedCustomerId,
      action: "active_customer_selected",
      outcome: `Active customer context was updated to ${requestedCustomerId}.`,
      severity: "info",
      route: "/customer/dashboard",
      middleware: ["Postgres", "Session preference"],
      detail: "The customer shell persisted the active customer selection through the database-backed session preference endpoint.",
    });

    res.json(preference);
  });

  app.get("/api/platform/customer-servicing/beneficiaries", (req, res) => {
    const customerId = resolveCustomerId(req);
    const transferDerived = customerTransfers
      .filter((item) => item.customerId === customerId && (item.beneficiaryName || item.accountName))
      .map((item) => ({
        id: item.beneficiaryId || `beneficiary-${item.id}`,
        customerId,
        name: item.beneficiaryName || item.accountName || "Transfer destination",
        phone: customers.find((entry) => entry.id === item.beneficiaryId)?.phone || "+234 800 000 0000",
        location: item.bankName || item.transferType || "customer-servicing",
        addedAt: item.createdAt,
        source: item.workflowId ? "workflow" : item.beneficiaryId ? "customer" : "transfer",
      }));
    const seeded = customers
      .filter((item) => item.id !== customerId)
      .slice(0, 8)
      .map((item) => ({
        id: `beneficiary-${item.id}`,
        customerId,
        name: item.name,
        phone: item.phone,
        location: item.location,
        addedAt: new Date().toISOString(),
        source: "customer" as const,
      }));
    const items = [...transferDerived, ...seeded].filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index);
    res.json({ asOf: new Date().toISOString(), customerId, items, total: items.length });
  });

  app.post("/api/platform/customer-servicing/beneficiaries", (req, res) => {
    const role = readRole(req);
    const payload = req.body as { customerId?: string; name?: string; phone?: string; location?: string; source?: "customer" | "manual" | "workflow" | "transfer" };
    const customerId = payload.customerId && customers.some((item) => item.id === payload.customerId) ? payload.customerId : resolveCustomerId(req);
    if (!payload.name) {
      res.status(400).json({ message: "name is required" });
      return;
    }
    const beneficiary = {
      id: `beneficiary-manual-${Date.now()}`,
      customerId,
      name: payload.name,
      phone: payload.phone || "+234 800 000 0000",
      location: payload.location || "manual beneficiary",
      addedAt: new Date().toISOString(),
      source: payload.source || "manual",
    };
    customerTransfers.unshift({
      id: nextTransferId(),
      customerId,
      beneficiaryId: beneficiary.id,
      beneficiaryName: beneficiary.name,
      amount: 0,
      narration: "Beneficiary saved",
      transferType: "bank",
      status: "draft",
      createdAt: beneficiary.addedAt,
      accountName: beneficiary.name,
      approvalState: "not_required",
    });
    recordAudit({
      actorRole: role,
      actorId: readActorId(req, role),
      entityType: "customer_transfer",
      entityId: beneficiary.id,
      action: "beneficiary_saved",
      outcome: `Beneficiary ${beneficiary.name} was saved for customer servicing.`,
      severity: "info",
      route: "/customer/transfers",
      middleware: ["Postgres", "Kafka"],
      detail: "The customer transfer surface saved a beneficiary into the persisted servicing state.",
    });
    res.status(201).json(beneficiary);
  });

  app.get("/api/platform/customer-servicing/notifications", (req, res) => {
    const customerId = resolveCustomerId(req);
    const items = auditTrail
      .filter((entry) => entry.route.startsWith("/customer") || entry.entityId === customerId)
      .slice(0, 25)
      .map((entry, index) => ({
        id: `notification-${entry.id}`,
        customerId,
        title: entry.outcome || "Customer servicing update",
        message: entry.detail || `${entry.entityType.replaceAll("_", " ")} updated in the active platform runtime.`,
        type: entry.severity === "critical" ? "error" : entry.severity === "warning" ? "warning" : "info",
        read: false,
        createdAt: entry.timestamp,
        actionUrl: entry.route,
      }));
    res.json({ asOf: new Date().toISOString(), customerId, items, total: items.length });
  });

  app.post("/api/platform/customer-servicing/notifications", (req, res) => {
    const payload = req.body as { customerId?: string; title?: string; message?: string; type?: "info" | "success" | "warning" | "error"; actionUrl?: string };
    const customerId = payload.customerId && customers.some((item) => item.id === payload.customerId) ? payload.customerId : resolveCustomerId(req);
    if (!payload.title || !payload.message) {
      res.status(400).json({ message: "title and message are required" });
      return;
    }
    const notification = {
      id: `notification-${Date.now()}`,
      customerId,
      title: payload.title,
      message: payload.message,
      type: payload.type || "info",
      read: false,
      createdAt: new Date().toISOString(),
      actionUrl: payload.actionUrl,
    };
    auditTrail.unshift({
      id: nextAuditId(),
      timestamp: notification.createdAt,
      actorRole: readRole(req),
      actorId: readActorId(req, readRole(req)),
      entityType: "customer_notification",
      entityId: notification.id,
      action: "created",
      outcome: notification.title,
      severity: notification.type === "error" ? "critical" : notification.type === "warning" ? "warning" : "info",
      route: notification.actionUrl || "/customer/dashboard",
      middleware: ["Postgres", "Notification rail"],
      detail: notification.message,
    });
    res.status(201).json(notification);
  });

  app.put("/api/platform/customer-servicing/notifications/:notificationId", (req, res) => {
    const payload = req.body as { read?: boolean };
    res.json({
      id: req.params.notificationId,
      customerId: resolveCustomerId(req),
      title: "Notification updated",
      message: "Notification state was updated through the persisted servicing endpoint.",
      type: "info",
      read: payload.read ?? true,
      createdAt: new Date().toISOString(),
    });
  });

  app.get("/api/platform/customer-servicing/billers", (req, res) => {
    const customerId = resolveCustomerId(req);
    const items = customerSavedBillers.filter((item) => item.customerId === customerId);
    res.json({ asOf: new Date().toISOString(), customerId, items, total: items.length });
  });

  app.post("/api/platform/customer-servicing/billers", (req, res) => {
    const role = readRole(req);
    const payload = req.body as Partial<CustomerSavedBiller>;
    const customerId = payload.customerId && customers.some((item) => item.id === payload.customerId) ? payload.customerId : resolveCustomerId(req);
    if (!payload.provider || !payload.customerReference || !payload.category) {
      res.status(400).json({ message: "provider, customerReference, and category are required" });
      return;
    }
    const item: CustomerSavedBiller = {
      id: nextSavedBillerId(),
      customerId,
      category: payload.category,
      provider: payload.provider,
      billerId: payload.billerId || `BILL-${Date.now()}`,
      customerReference: payload.customerReference,
      nickname: payload.nickname || payload.provider,
      lastAmount: Number(payload.lastAmount || 0),
      verifiedName: payload.verifiedName || customers.find((entry) => entry.id === customerId)?.name,
      lastPaidAt: payload.lastPaidAt,
      createdAt: new Date().toISOString(),
    };
    customerSavedBillers.unshift(item);
    recordAudit({
      actorRole: role,
      actorId: readActorId(req, role),
      entityType: "saved_biller",
      entityId: item.id,
      action: "created",
      outcome: `Saved biller ${item.provider} was registered for customer servicing.`,
      severity: "info",
      route: "/customer/bills",
      middleware: ["Postgres", "Kafka"],
      detail: "The customer billing surface persisted a saved biller through the active platform endpoint.",
    });
    res.status(201).json(item);
  });

  app.delete("/api/platform/customer-servicing/billers/:billerId", (req, res) => {
    const role = readRole(req);
    const index = customerSavedBillers.findIndex((item) => item.id === req.params.billerId);
    if (index === -1) {
      res.status(404).json({ message: "Saved biller not found" });
      return;
    }
    const [removed] = customerSavedBillers.splice(index, 1);
    recordAudit({
      actorRole: role,
      actorId: readActorId(req, role),
      entityType: "saved_biller",
      entityId: removed.id,
      action: "deleted",
      outcome: `Saved biller ${removed.provider} was removed from the servicing profile.`,
      severity: "warning",
      route: "/customer/bills",
      middleware: ["Postgres", "Kafka"],
      detail: "The active billing endpoint removed a persisted saved-biller profile.",
    });
    res.json({ id: removed.id, removed: true });
  });

  app.get("/api/platform/customer-servicing/bills", (req, res) => {
    const customerId = resolveCustomerId(req);
    const items = customerBillPayments.filter((item) => item.customerId === customerId).sort((left, right) => new Date(right.paidAt).getTime() - new Date(left.paidAt).getTime());
    res.json({ asOf: new Date().toISOString(), customerId, items, total: items.length });
  });

  app.post("/api/platform/customer-servicing/bills", (req, res) => {
    const role = readRole(req);
    const payload = req.body as Partial<CustomerBillPaymentRecord>;
    const customerId = payload.customerId && customers.some((item) => item.id === payload.customerId) ? payload.customerId : resolveCustomerId(req);
    if (!payload.provider || !payload.category || !payload.amount) {
      res.status(400).json({ message: "provider, category, and amount are required" });
      return;
    }
    const payment: CustomerBillPaymentRecord = {
      id: nextBillPaymentId(),
      customerId,
      category: payload.category,
      provider: payload.provider,
      amount: Number(payload.amount),
      status: payload.status || (payload.scheduledFor ? "scheduled" : "paid"),
      paidAt: payload.paidAt || payload.scheduledFor || new Date().toISOString(),
      reference: payload.reference || `54B-${Date.now()}`,
      billerId: payload.billerId,
      customerReference: payload.customerReference,
      customerName: payload.customerName || customers.find((item) => item.id === customerId)?.name,
      scheduledFor: payload.scheduledFor,
      evidenceStatus: payload.evidenceStatus || (payload.scheduledFor ? "scheduled" : "ready"),
      channel: payload.channel || (payload.billerId ? "saved-biller" : "self-service"),
    };
    customerBillPayments.unshift(payment);
    const approvalRequest = payment.status === "scheduled"
      ? ensureApprovalRequest({
          customerId,
          entityType: "scheduled_bill",
          entityId: payment.id,
          title: `Approve scheduled payment for ${payment.provider}`,
          detail: "Scheduled customer payments require branch approval before execution in the servicing ledger.",
          route: "/customer/bills",
          requestedByRole: role,
          requestedById: readActorId(req, role),
          approvalRole: "branch",
        })
      : undefined;
    recordAudit({
      actorRole: role,
      actorId: readActorId(req, role),
      entityType: "bill_payment",
      entityId: payment.id,
      action: payment.status === "scheduled" ? "scheduled" : "paid",
      outcome: `Customer bill payment for ${payment.provider} was ${payment.status}.`,
      severity: payment.status === "scheduled" ? "warning" : "info",
      route: "/customer/bills",
      middleware: ["Postgres", "Kafka", "Permify"],
      detail: "The customer billing endpoint recorded a servicing payment event through the active adapter server.",
    });
    res.status(201).json({ payment, approvalRequest });
  });

  app.get("/api/platform/customer-servicing/transfers", (req, res) => {
    const customerId = resolveCustomerId(req);
    const items = customerTransfers
      .filter((item) => item.customerId === customerId)
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
    res.json({ asOf: new Date().toISOString(), customerId, items, total: items.length });
  });

  app.post("/api/platform/customer-servicing/transfers", validateBody(transferCreateSchema), (req, res) => {
    const role = readRole(req);
    const payload = req.body as Record<string, unknown>;
    const payloadCustomerId = String(payload.customerId || "");
    const customerId = payloadCustomerId && customers.some((item) => item.id === payloadCustomerId) ? payloadCustomerId : resolveCustomerId(req);
    const amount = Number(payload.amount);
    const transfer: CustomerTransferRecord = {
      id: nextTransferId(),
      customerId,
      beneficiaryId: payload.beneficiaryId ? String(payload.beneficiaryId) : undefined,
      beneficiaryName: String(payload.beneficiaryName || payload.accountName || "Transfer destination"),
      amount,
      narration: payload.narration ? String(payload.narration) : undefined,
      transferType: String(payload.transferType) as "bank" | "wallet" | "workflow",
      status: "draft",
      createdAt: new Date().toISOString(),
      bankCode: payload.bankCode ? String(payload.bankCode) : undefined,
      bankName: payload.bankName ? String(payload.bankName) : undefined,
      accountNumber: payload.accountNumber ? String(payload.accountNumber) : undefined,
      accountName: payload.accountName ? String(payload.accountName) : undefined,
      workflowId: payload.workflowId ? String(payload.workflowId) : undefined,
      approvalState: amount >= 500000 ? "pending_review" : "not_required",
    };
    customerTransfers.unshift(transfer);
    recordAudit({
      actorRole: role,
      actorId: readActorId(req, role),
      entityType: "customer_transfer",
      entityId: transfer.id,
      action: "created",
      outcome: `Transfer draft ${transfer.id} was created for ${transfer.beneficiaryName}.`,
      severity: transfer.approvalState === "pending_review" ? "warning" : "info",
      route: "/customer/transfers",
      middleware: ["Postgres", "Redis", "Kafka"],
      detail: "The customer transfer servicing endpoint created a draft transfer and recorded the next lifecycle step.",
    });
    res.status(201).json(
      withMiddlewareContract("customer-transfers", "draft_created", { transfer }, {
        kafkaPublication: "queued",
        cacheInvalidation: "refreshed",
        workflowProgression: transfer.approvalState === "pending_review" ? "awaiting_review" : "awaiting_confirmation",
        tigerBeetlePosting: "gated_by_workflow",
        middleware: ["Postgres", "Redis", "Kafka"],
        detail: "Transfer creation now exposes downstream publication and lifecycle posture alongside the draft payload.",
      }),
    );
  });

  app.post("/api/platform/customer-servicing/transfers/:transferId/otp", (req, res) => {
    const role = readRole(req);
    const transfer = customerTransfers.find((item) => item.id === req.params.transferId);
    if (!transfer) {
      res.status(404).json({ message: "Transfer not found" });
      return;
    }
    transfer.status = "otp_pending";
    transfer.otpReference = `OTP-${Date.now()}`;
    transfer.otpIssuedAt = new Date().toISOString();
    const otp: CustomerTransferOtpRequest = {
      transferId: transfer.id,
      otpReference: transfer.otpReference,
      expiresAt: new Date(Date.now() + 1000 * 60 * 5).toISOString(),
      maskedDestination: transfer.accountNumber ? `••••${transfer.accountNumber.slice(-4)}` : transfer.beneficiaryName,
      previewCode: "542001",
    };
    recordAudit({
      actorRole: role,
      actorId: readActorId(req, role),
      entityType: "customer_transfer",
      entityId: transfer.id,
      action: "otp_requested",
      outcome: `OTP challenge issued for transfer ${transfer.id}.`,
      severity: "info",
      route: "/customer/transfers",
      middleware: ["Redis", "APISIX"],
      detail: "The transfer servicing endpoint issued an OTP challenge for customer confirmation.",
    });
    res.json(
      withMiddlewareContract("customer-transfers", "otp_requested", { transfer, otp }, {
        kafkaPublication: "not_applicable",
        cacheInvalidation: "not_required",
        workflowProgression: "awaiting_confirmation",
        tigerBeetlePosting: "gated_by_workflow",
        middleware: ["Redis", "APISIX"],
        detail: "OTP issuance now reports the auth and edge middleware posture before funds can move into confirmation.",
      }),
    );
  });

  app.post("/api/platform/customer-servicing/transfers/:transferId/confirm", (req, res) => {
    const role = readRole(req);
    const payload = req.body as { otpReference?: string; otpCode?: string };
    const transfer = customerTransfers.find((item) => item.id === req.params.transferId);
    if (!transfer) {
      res.status(404).json({ message: "Transfer not found" });
      return;
    }
    if (!payload.otpReference || payload.otpReference !== transfer.otpReference || payload.otpCode !== "542001") {
      res.status(400).json({ message: "OTP confirmation failed" });
      return;
    }
    transfer.status = transfer.approvalState === "pending_review" ? "submitted" : "completed";
    transfer.confirmedAt = new Date().toISOString();
    const statement: CustomerStatementRecord = {
      id: `stmt-${transfer.id}`,
      customerId: transfer.customerId,
      title: `${transfer.beneficiaryName} transfer`,
      detail: transfer.narration || `${transfer.transferType} transfer confirmed through active servicing endpoint`,
      amount: transfer.amount,
      direction: "debit",
      type: "transfer",
      status: transfer.status === "completed" ? "completed" : "pending",
      timestamp: transfer.confirmedAt,
      reference: transfer.id,
      category: transfer.transferType,
    };
    recordAudit({
      actorRole: role,
      actorId: readActorId(req, role),
      entityType: "customer_transfer",
      entityId: transfer.id,
      action: transfer.status === "completed" ? "completed" : "submitted",
      outcome: `Transfer ${transfer.id} was ${transfer.status} after customer confirmation.`,
      severity: transfer.status === "completed" ? "info" : "warning",
      route: "/customer/transfers",
      middleware: ["Postgres", "Kafka", "Permify"],
      detail: "The transfer servicing endpoint moved the transfer into the post-confirmation lifecycle and refreshed the statements evidence layer.",
    });
    res.json(
      withMiddlewareContract("customer-transfers", transfer.status === "completed" ? "confirmed" : "submitted_for_review", { transfer, statement }, {
        kafkaPublication: "queued",
        cacheInvalidation: "refreshed",
        workflowProgression: transfer.status === "completed" ? "advanced" : "awaiting_review",
        tigerBeetlePosting: transfer.status === "completed" ? "queued_for_downstream" : "gated_by_workflow",
        middleware: ["Postgres", "Kafka", "Permify"],
        detail: "Transfer confirmation now exposes whether downstream ledger and approval middleware can continue from the current lifecycle state.",
      }),
    );
  });

  app.get("/api/platform/customer-servicing/approvals", (req, res) => {
    const customerId = resolveCustomerId(req);
    const source = customerApprovals.length > 0 ? customerApprovals : defaultCustomerApprovals;
    const items = source
      .filter((item) => item.customerId === customerId)
      .sort((left, right) => new Date(right.requestedAt).getTime() - new Date(left.requestedAt).getTime());
    res.json({ asOf: new Date().toISOString(), customerId, items, total: items.length });
  });

  app.post("/api/platform/customer-servicing/approvals/:approvalId/approve", (req, res) => {
    const role = readRole(req);
    const payload = req.body as { resolutionNote?: string };
    const currentApproval = customerApprovals.find((item) => item.id === req.params.approvalId);
    if (!currentApproval) {
      res.status(404).json({ message: "Approval request not found" });
      return;
    }
    if (currentApproval.approvalRole !== role) {
      res.status(403).json({
        message: `This approval requires the ${currentApproval.approvalRole} role`,
        requiredRole: currentApproval.approvalRole,
        currentRole: role,
      });
      return;
    }
    const approvalRequest = resolveApprovalRequest(req.params.approvalId, "approved", payload.resolutionNote);
    if (!approvalRequest) {
      res.status(404).json({ message: "Approval request not found" });
      return;
    }
    if (approvalRequest.entityType === "card_control") {
      const card = customerCards.find((item) => item.id === approvalRequest.entityId);
      if (card) {
        card.isLocked = false;
        card.updatedAt = new Date().toISOString();
      }
    }
    if (approvalRequest.entityType === "scheduled_bill") {
      const payment = customerBillPayments.find((item) => item.id === approvalRequest.entityId);
      if (payment) {
        payment.status = "paid";
        payment.paidAt = new Date().toISOString();
        payment.evidenceStatus = "verified";
      }
    }
    if (approvalRequest.entityType === "statement_export") {
      const job = exportJobs.find((item) => item.id === approvalRequest.entityId);
      if (job) {
        job.approvalState = "Signed";
        job.status = "Ready";
      }
    }
    recordAudit({
      actorRole: role,
      actorId: readActorId(req, role),
      entityType: "customer_approval",
      entityId: approvalRequest.id,
      action: "approved",
      outcome: `${approvalRequest.title} was approved by ${role}.`,
      severity: "info",
      route: approvalRequest.route,
      middleware: ["Permify", "Kafka", "Postgres"],
      detail: "An operator approval resolved a customer-servicing lifecycle gate in the active environment.",
    });
    res.json(
      withMiddlewareContract("customer-approvals", "approved", { approvalRequest }, {
        kafkaPublication: "queued",
        cacheInvalidation: "refreshed",
        workflowProgression: "advanced",
        tigerBeetlePosting: approvalRequest.entityType === "statement_export" ? "not_applicable" : "queued_for_downstream",
        middleware: ["Permify", "Kafka", "Postgres"],
        detail: "Approval responses now surface authorization, publication, and downstream lifecycle posture in one contract.",
      }),
    );
  });

  app.post("/api/platform/customer-servicing/approvals/:approvalId/reject", (req, res) => {
    const role = readRole(req);
    const payload = req.body as { resolutionNote?: string };
    const currentApproval = customerApprovals.find((item) => item.id === req.params.approvalId);
    if (!currentApproval) {
      res.status(404).json({ message: "Approval request not found" });
      return;
    }
    if (currentApproval.approvalRole !== role) {
      res.status(403).json({
        message: `This approval requires the ${currentApproval.approvalRole} role`,
        requiredRole: currentApproval.approvalRole,
        currentRole: role,
      });
      return;
    }
    const approvalRequest = resolveApprovalRequest(req.params.approvalId, "rejected", payload.resolutionNote);
    if (!approvalRequest) {
      res.status(404).json({ message: "Approval request not found" });
      return;
    }
    recordAudit({
      actorRole: role,
      actorId: readActorId(req, role),
      entityType: "customer_approval",
      entityId: approvalRequest.id,
      action: "rejected",
      outcome: `${approvalRequest.title} was rejected by ${role}.`,
      severity: "warning",
      route: approvalRequest.route,
      middleware: ["Permify", "Kafka", "Postgres"],
      detail: "An operator rejection returned the servicing request to customer follow-up or manual review.",
    });
    res.json(
      withMiddlewareContract("customer-approvals", "rejected", { approvalRequest }, {
        kafkaPublication: "queued",
        cacheInvalidation: "refreshed",
        workflowProgression: "not_changed",
        tigerBeetlePosting: "gated_by_workflow",
        middleware: ["Permify", "Kafka", "Postgres"],
        detail: "Rejected approvals now surface the authorization and downstream follow-up posture expected by the workbench.",
      }),
    );
  });

  app.get("/api/platform/customer-servicing/statement-exports", (req, res) => {
    const customerId = resolveCustomerId(req);
    const items = exportJobs.filter((item) => item.domainKey === "customer-statements" && item.approvalSignature.includes(customerId));
    res.json({ asOf: new Date().toISOString(), customerId, items, total: items.length });
  });

  app.post("/api/platform/customer-servicing/statement-exports", (req, res) => {
    const role = readRole(req);
    const customerId = resolveCustomerId(req);
    const payload = req.body as { format?: ExportJob["format"]; rowCount?: number; title?: string };
    const exportId = nextExportId();
    const exportJob: ExportJob = {
      id: exportId,
      domainKey: "customer-statements",
      title: payload.title || `Customer statement export ${customerId}`,
      format: payload.format || "csv",
      status: "Queued",
      createdAt: new Date().toISOString(),
      requestedByRole: role,
      route: "/customer/statements",
      rowCount: Number(payload.rowCount || 12),
      approvalState: "Pending review",
      approvalSignature: `CUSTOMER-${customerId}`,
      downloadUrl: `/api/platform/exports/${exportId}/download`,
      retainedUntil: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
      reportVersion: `v${exportJobs.length + 1}`,
      approvalChain: ["Customer servicing", "Branch operations"],
      signedBy: [],
    };
    exportJobs.unshift(exportJob);
    const approvalRequest = ensureApprovalRequest({
      customerId,
      entityType: "statement_export",
      entityId: exportJob.id,
      title: `Approve statement export for ${customerId}`,
      detail: "Statement exports require operator sign-off before the package becomes downloadable.",
      route: "/customer/statements",
      requestedByRole: role,
      requestedById: readActorId(req, role),
      approvalRole: "branch",
    });
    recordAudit({
      actorRole: role,
      actorId: readActorId(req, role),
      entityType: "statement_export",
      entityId: exportJob.id,
      action: "requested",
      outcome: `Statement export ${exportJob.id} was requested for ${customerId}.`,
      severity: "info",
      route: "/customer/statements",
      middleware: ["Lakehouse", "Permify", "Postgres"],
      detail: "The statement servicing endpoint created an export package and routed it into the approval chain.",
    });
    res.status(201).json({ exportJob, approvalRequest });
  });

  app.get("/api/platform/customer-servicing/statements", (req, res) => {
    const customerId = resolveCustomerId(req);
    const items = buildCustomerStatements(customerId);
    res.json({ asOf: new Date().toISOString(), customerId, items, total: items.length });
  });
  app.get("/api/platform/customer-servicing/qr-overview", (req, res) => {
    const customerId = resolveCustomerId(req);
    const recentAudit = auditTrail
      .filter(
        (entry) =>
          entry.route === "/customer/qr" ||
          (entry.entityId === customerId && ["transfer", "notification", "statement_export"].includes(entry.entityType)),
      )
      .slice(0, 6);
    const latestTransfer = customerTransfers.find((item) => item.customerId === customerId);
    res.json({
      asOf: new Date().toISOString(),
      customerId,
      featureEnabled: true,
      serviceStatus: "healthy",
      settlementRoute: "/teller",
      lastUsedAt: recentAudit[0]?.timestamp ?? latestTransfer?.confirmedAt ?? latestTransfer?.createdAt,
      supportedFlows: [
        {
          key: "merchant_scan",
          label: "Merchant scan and pay",
          detail: "Prepare a QR payment handoff with teller-assisted settlement and transfer confirmation controls.",
          route: "/customer/transfers",
          status: "ready",
        },
        {
          key: "teller_capture",
          label: "Teller capture review",
          detail: "Continue exceptional settlement handling through the teller workspace when operator review is required.",
          route: "/teller",
          status: "ready",
        },
        {
          key: "control_follow_up",
          label: "Control center follow-up",
          detail: "Review downstream audit, export, and workflow signals for QR-linked servicing events.",
          route: "/control-center",
          status: "review",
        },
      ],
      complianceChecks: [
        "Tenant QR module enabled and aligned to active onboarding posture.",
        "Transfer confirmation and approval controls remain in the same customer-servicing chain.",
        "Operator follow-up continues through teller and control-center audit surfaces.",
      ],
      recentAudit,
    });
  });
  app.get("/api/platform/workflows", (_req, res) => {

    res.json({ asOf: new Date().toISOString(), items: workflowCases, total: workflowCases.length });
  });

  app.post("/api/platform/workflows/:workflowId/advance", (req, res) => {
    const role = readRole(req);
    const item = workflowCases.find((entry) => entry.id === req.params.workflowId);
    if (!item) {
      res.status(404).json({ message: "Workflow not found" });
      return;
    }
    const stages: WorkflowStage[] = ["Origination", "KYC", "Approval", "Fulfilment", "Monitoring"];
    const stageIndex = stages.indexOf(item.stage);
    item.stage = stages[Math.min(stageIndex + 1, stages.length - 1)];
    item.status = item.stage === "Monitoring" ? "Ready" : "In Progress";
    item.slaHours = Math.max(item.slaHours - 2, 1);
    item.nextAction = item.stage === "Monitoring" ? "Monitor performance, repayment health, and control exceptions." : `Continue ${item.stage.toLowerCase()} tasks and capture evidence.`;
    recordAudit({
      actorRole: role,
      actorId: readActorId(req, role),
      entityType: "workflow",
      entityId: item.id,
      action: "advanced",
      outcome: `Workflow moved to ${item.stage}.`,
      severity: item.stage === "Monitoring" ? "info" : "warning",
      route: "/#operations",
      middleware: ["Temporal", "Kafka", "Postgres"],
      detail: "The platform advanced a workflow stage and refreshed the downstream action posture.",
    });
    res.json(
      withMiddlewareContract("workflow-cases", "advanced", { ...item }, {
        kafkaPublication: "queued",
        cacheInvalidation: "refreshed",
        workflowProgression: "advanced",
        tigerBeetlePosting: "gated_by_workflow",
        middleware: ["Temporal", "Kafka", "Postgres"],
        detail: "Workflow advancement now exposes the orchestration and downstream publication posture expected by the shared workbench.",
      }),
    );
  });

  app.get("/api/platform/partner-onboarding", async (_req, res) => {
    await refreshPartnerOnboardingRuntimeFromDb();
    const items = listPartnerOnboardingRecords();
    res.json({ asOf: new Date().toISOString(), items, total: items.length, approvals: listPartnerApprovalRecords() });
  });

  app.get("/api/platform/partner-onboarding/:partnerId", async (req, res) => {
    await refreshPartnerOnboardingRuntimeFromDb();
    const partner = getPartnerOnboardingRecord(req.params.partnerId);
    if (!partner) {
      res.status(404).json({ message: "Partner onboarding record not found" });
      return;
    }
    res.json({ partner, approvals: listPartnerApprovalRecords(partner.id) });
  });

  app.post("/api/platform/partner-onboarding", async (req, res) => {
    await refreshPartnerOnboardingRuntimeFromDb();
    const role = readRole(req);
    const actorId = readActorId(req, role);
    const partner = createPartnerOnboardingDraft({ ...(req.body ?? {}), actorId });
    persistRuntimeState();
    recordAudit({
      actorRole: role,
      actorId,
      entityType: "partner_onboarding",
      entityId: partner.id,
      action: "draft_created",
      outcome: `Partner onboarding draft created for ${partner.partnerName}.`,
      severity: "info",
      route: "/admin/onboarding",
      middleware: ["Postgres", "Kafka"],
      detail: "A new white-label partner onboarding draft was created through the active onboarding workspace.",
    });
    res.status(201).json({ partner, approvals: listPartnerApprovalRecords(partner.id) });
  });

  app.put("/api/platform/partner-onboarding/:partnerId", async (req, res) => {
    await refreshPartnerOnboardingRuntimeFromDb();
    const role = readRole(req);
    const actorId = readActorId(req, role);
    const partner = updatePartnerOnboardingDraft(req.params.partnerId, req.body ?? {});
    if (!partner) {
      res.status(404).json({ message: "Partner onboarding record not found" });
      return;
    }
    persistRuntimeState();
    recordAudit({
      actorRole: role,
      actorId,
      entityType: "partner_onboarding",
      entityId: partner.id,
      action: "draft_updated",
      outcome: `Partner onboarding draft updated for ${partner.partnerName}.`,
      severity: "info",
      route: "/partner/onboarding",
      middleware: ["Postgres", "Kafka"],
      detail: "Partner onboarding draft data was updated through the self-service or admin workspace.",
    });
    res.json({ partner, approvals: listPartnerApprovalRecords(partner.id) });
  });

  app.post("/api/platform/partner-onboarding/:partnerId/submit", async (req, res) => {
    await refreshPartnerOnboardingRuntimeFromDb();
    const role = readRole(req);
    const actorId = readActorId(req, role);
    const partner = submitPartnerOnboarding(req.params.partnerId, actorId);
    if (!partner) {
      res.status(404).json({ message: "Partner onboarding record not found" });
      return;
    }
    persistRuntimeState();
    recordAudit({
      actorRole: role,
      actorId,
      entityType: "partner_onboarding",
      entityId: partner.id,
      action: "submitted",
      outcome: `Partner onboarding application submitted for ${partner.partnerName}.`,
      severity: "warning",
      route: "/admin/onboarding",
      middleware: ["Kafka", "Postgres", "Permify"],
      detail: "The partner onboarding workflow opened approval stages for compliance, commercial, operations, and launch sign-off.",
    });
    const approvals = listPartnerApprovalRecords(partner.id);
    void notifyPartnerOnboardingSubmission(partner, approvals).catch((error) => {
      logger.warn("Unable to deliver partner onboarding submission notification", { error: String(error) });
    });
    res.json({ partner, approvals });
  });

  app.post("/api/platform/partner-onboarding/:partnerId/approvals/:approvalId/approve", async (req, res) => {
    await refreshPartnerOnboardingRuntimeFromDb();
    const role = readRole(req);
    const actorId = readActorId(req, role);
    const result = resolvePartnerApproval(req.params.partnerId, req.params.approvalId, "approved", req.body?.resolutionNote, role);
    if (result.error === "not_found") {
      res.status(404).json({ message: "Partner approval request not found" });
      return;
    }
    if (result.error === "forbidden") {
      res.status(403).json({
        message: `Approval requires ${result.approval.requiredRole} role`,
        requiredRole: result.approval.requiredRole,
        currentRole: role,
      });
      return;
    }
    persistRuntimeState();
    recordAudit({
      actorRole: role,
      actorId,
      entityType: "partner_approval",
      entityId: result.approval.id,
      action: "approved",
      outcome: `${result.approval.title} approved for ${result.partner.partnerName}.`,
      severity: "info",
      route: "/admin/onboarding",
      middleware: ["Permify", "Kafka", "Postgres"],
      detail: "A partner onboarding approval stage was resolved through the admin onboarding console.",
    });
    const approvals = listPartnerApprovalRecords(result.partner.id);
    let tenantConfiguration = null;
    if (result.partner.stage === "launch_ready") {
      tenantConfiguration = await provisionPartnerTenant({
        tenantId: result.partner.tenantId,
        name: result.partner.partnerName,
        legalEntity: result.partner.legalEntity,
        region: result.partner.region,
        requestedModules: result.partner.requestedModules,
        whiteLabel: {
          displayName: result.partner.branding.displayName,
          legalEntity: result.partner.legalEntity,
          supportEmail: result.partner.branding.supportEmail,
          primaryColor: result.partner.branding.primaryColor,
          accentColor: result.partner.branding.accentColor,
          logoUrl: result.partner.branding.logoUrl,
          loginHeadline: result.partner.branding.loginHeadline,
          customDomain: result.partner.branding.customDomain,
        },
      });
    }
    void notifyPartnerApprovalDecision(result.partner, result.approval).catch((error) => {
      logger.warn("Unable to deliver partner approval notification", { error: String(error) });
    });
    if (result.partner.stage === "launch_ready") {
      void notifyPartnerLaunchReady(result.partner).catch((error) => {
        logger.warn("Unable to deliver partner launch-ready notification", { error: String(error) });
      });
    }
    res.json({ partner: result.partner, approval: result.approval, approvals, tenantConfiguration });
  });

  app.post("/api/platform/partner-onboarding/:partnerId/approvals/:approvalId/reject", async (req, res) => {
    await refreshPartnerOnboardingRuntimeFromDb();
    const role = readRole(req);
    const actorId = readActorId(req, role);
    const result = resolvePartnerApproval(req.params.partnerId, req.params.approvalId, "rejected", req.body?.resolutionNote, role);
    if (result.error === "not_found") {
      res.status(404).json({ message: "Partner approval request not found" });
      return;
    }
    if (result.error === "forbidden") {
      res.status(403).json({
        message: `Approval requires ${result.approval.requiredRole} role`,
        requiredRole: result.approval.requiredRole,
        currentRole: role,
      });
      return;
    }
    persistRuntimeState();
    recordAudit({
      actorRole: role,
      actorId,
      entityType: "partner_approval",
      entityId: result.approval.id,
      action: "rejected",
      outcome: `${result.approval.title} rejected for ${result.partner.partnerName}.`,
      severity: "warning",
      route: "/admin/onboarding",
      middleware: ["Permify", "Kafka", "Postgres"],
      detail: "A partner onboarding approval stage was rejected and the partner now has an explicit onboarding blocker.",
    });
    const approvals = listPartnerApprovalRecords(result.partner.id);
    void notifyPartnerApprovalDecision(result.partner, result.approval).catch((error) => {
      logger.warn("Unable to deliver partner approval notification", { error: String(error) });
    });
    res.json({ partner: result.partner, approval: result.approval, approvals });
  });

  app.get("/api/platform/actions", (req, res) => {
    const role = readRole(req);
    const rawDomain = String(req.query.domainKey || req.query.domain || "").trim();
    const normalizedDomain = rawDomain.toLowerCase();
    const actionSource = operatorActions.length ? operatorActions : defaultOperatorActions;
    const items = actionSource.filter((action) => {
      const treatAsWorkspaceDomain = normalizedDomain === "operations" || normalizedDomain === "operator";
      const matchesDomain =
        !normalizedDomain ||
        treatAsWorkspaceDomain ||
        action.domainKey === normalizedDomain ||
        action.domainKey.includes(normalizedDomain) ||
        normalizedDomain.includes(action.domainKey);
      const matchesRole = action.roles.includes(role);
      return matchesDomain && matchesRole;
    });
    res.json({ asOf: new Date().toISOString(), items, total: items.length, role, domain: normalizedDomain || undefined });
  });

  app.post("/api/platform/actions/:actionId/status", (req, res) => {
    const role = readRole(req);
    const item = operatorActions.find((entry) => entry.id === req.params.actionId);
    if (!item) {
      res.status(404).json({ message: "Action not found" });
      return;
    }
    if (!item.roles.includes(role)) {
      res.status(403).json({ message: "Action is not available for this role" });
      return;
    }
    const nextStatus = (req.body?.status as OperatorActionStatus | undefined) || (item.status === "Pending" ? "In progress" : item.status === "In progress" ? "Done" : "Done");
    item.status = nextStatus;
    const middleware = item.domainKey === "ledger-reconciliation" ? ["TigerBeetle", "Postgres", "Kafka"] : ["Postgres", "Lakehouse"];
    recordAudit({
      actorRole: role,
      actorId: readActorId(req, role),
      entityType: "operator_action",
      entityId: item.id,
      action: "status_changed",
      outcome: `Action ${item.title} marked ${nextStatus}.`,
      severity: nextStatus === "Done" ? "info" : "warning",
      route: item.route,
      middleware,
      detail: item.detail,
    });
    res.json(
      withMiddlewareContract("operator-actions", nextStatus === "Done" ? "completed" : "progressed", { action: item }, {
        kafkaPublication: middleware.includes("Kafka") ? "queued" : "conditional",
        cacheInvalidation: "refreshed",
        workflowProgression: nextStatus === "Done" ? "advanced" : "awaiting_review",
        tigerBeetlePosting: item.domainKey === "ledger-reconciliation" && nextStatus === "Done" ? "queued_for_downstream" : item.domainKey === "ledger-reconciliation" ? "gated_by_workflow" : "not_applicable",
        middleware,
        detail: "Operator action updates now surface authorization, publication, cache, workflow, and ledger-posting posture in a consistent middleware contract.",
      }),
    );
  });

  app.get("/api/platform/audit", (req, res) => {
    const role = readRole(req);
    const rawDomain = String(req.query.domainKey || req.query.domain || "").trim().toLowerCase();
    const treatAsWorkspaceDomain = rawDomain === "operations" || rawDomain === "operator";
    const auditSource = auditTrail.length ? auditTrail : defaultAuditTrail;
    const items = auditSource.filter((entry) => {
      if (!rawDomain || treatAsWorkspaceDomain) {
        return true;
      }
      return entry.route.toLowerCase().includes(rawDomain) || entry.entityType.toLowerCase().includes(rawDomain) || entry.action.toLowerCase().includes(rawDomain);
    });
    res.json({ asOf: new Date().toISOString(), role, items, total: items.length, domain: rawDomain || undefined });
  });

  app.get("/api/platform/exports", (req, res) => {
    const role = readRole(req);
    const profile = getRoleProfile(role);
    const exportSource = exportJobs.length ? exportJobs : defaultExportJobs;
    const items = exportSource.filter((job) => profile.exportScopes.some((scope) => job.domainKey.includes(scope) || job.title.toLowerCase().includes(scope)) || job.requestedByRole === role);
    res.json({ asOf: new Date().toISOString(), role, items, total: items.length });
  });

  app.post("/api/platform/exports", (req, res) => {
    const role = readRole(req);
    const payload = req.body as Partial<ExportJob> & { domainKey?: string; title?: string };
    if (!payload.domainKey || !payload.title) {
      res.status(400).json({ message: "domainKey and title are required" });
      return;
    }
    const exportId = nextExportId();
    const job: ExportJob = {
      id: exportId,
      domainKey: payload.domainKey,
      title: payload.title,
      format: payload.format || "csv",
      status: "Ready",
      createdAt: new Date().toISOString(),
      requestedByRole: role,
      route: payload.route || "/",
      rowCount: Number(payload.rowCount || 24),
      approvalState: role === "branch" ? "Pending review" : "Signed",
      approvalSignature: `${role.toUpperCase()}-AUTO-SIGNOFF`,
      downloadUrl: `/api/platform/exports/${exportId}/download`,
      retainedUntil: payload.retainedUntil || new Date(Date.now() + 1000 * 60 * 60 * 24 * 90).toISOString(),
      reportVersion: payload.reportVersion || `v${exportJobs.length + 1}`,
      approvalChain: payload.approvalChain || [roleProfiles.find((profile) => profile.role === role)?.title || role],
      signedBy: payload.signedBy || [`${role.toUpperCase()}-AUTO-SIGNOFF`],
    };
    exportJobs.unshift(job);
    recordAudit({
      actorRole: role,
      actorId: readActorId(req, role),
      entityType: "export",
      entityId: job.id,
      action: "generated",
      outcome: `Export ${job.title} prepared as ${job.format}.`,
      severity: "info",
      route: job.route,
      middleware: ["Postgres", "Lakehouse", "Permify"],
      detail: "A role-scoped export package was generated from the operational workbench.",
    });
    res.status(201).json(job);
  });

  app.get("/api/platform/billing/dashboard", async (_req, res) => {
    await ensureBillingEngineSeed();
    await refreshBillingAccrualSnapshots();
    const dashboard = await getBillingDashboard();
    res.json({
      asOf: new Date().toISOString(),
      ...dashboard,
      middleware: ["Kafka", "Dapr", "Redis", "Permify", "Keycloak", "TigerBeetle", "Lakehouse"],
    });
  });

  app.get("/api/platform/billing/rate-cards", async (_req, res) => {
    await ensureBillingEngineSeed();
    const items = await listBillingRateCards();
    res.json({ asOf: new Date().toISOString(), items, total: items.length });
  });

  app.post("/api/platform/billing/rate-cards", async (req, res) => {
    await ensureBillingEngineSeed();
    const role = readRole(req);
    const actorId = readActorId(req, role);
    const card = await createBillingRateCard({
      billingAccountId: req.body?.billingAccountId,
      name: String(req.body?.name || "Draft billing rate card"),
      pricingCurrency: String(req.body?.pricingCurrency || "NGN"),
      createdBy: actorId,
    });
    if (!card) {
      res.status(500).json({ message: "Unable to create billing rate card" });
      return;
    }
    recordAudit({
      actorRole: role,
      actorId,
      entityType: "billing_rate_card",
      entityId: card.id,
      action: "draft_created",
      outcome: `Billing rate card ${card.name} created for commercial review.`,
      severity: "info",
      route: "/billing-engine",
      middleware: ["Keycloak", "Permify", "Postgres"],
      detail: "A draft billing rate card was created through the next-generation billing workspace.",
    });
    res.status(201).json(card);
  });

  app.get("/api/platform/billing/usage-events", async (_req, res) => {
    await ensureBillingEngineSeed();
    const items = await listBillingUsageEvents(100);
    res.json({ asOf: new Date().toISOString(), items, total: items.length });
  });

  app.post("/api/platform/billing/usage-events", validateBody(billingUsageEventSchema), async (req, res) => {
    await ensureBillingEngineSeed();
    const role = readRole(req);
    const actorId = readActorId(req, role);
    const usageEvent = await createBillingUsageEvent({
      tenantId,
      idempotencyKey: String(req.body?.idempotencyKey || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
      sourceService: String(req.body?.sourceService || "billing-gateway"),
      sourceEventType: String(req.body?.sourceEventType || "usage.manual_capture"),
      meterKey: String(req.body?.meterKey || "active_customer"),
      productKey: String(req.body?.productKey || "customer"),
      quantity: Number(req.body?.quantity || 0),
      unitAmount: req.body?.unitAmount !== undefined ? Number(req.body.unitAmount) : undefined,
      currency: String(req.body?.currency || "NGN"),
      eventTimestamp: String(req.body?.eventTimestamp || new Date().toISOString()),
      correlationId: req.body?.correlationId ? String(req.body.correlationId) : undefined,
      actorId,
      resourceId: req.body?.resourceId ? String(req.body.resourceId) : undefined,
      payload: {
        ...(req.body?.payload && typeof req.body.payload === "object" ? req.body.payload : {}),
        middleware: ["Kafka", "Dapr", "Redis", "APISIX", "OpenAppSec"],
      },
    });
    if (!usageEvent) {
      res.status(500).json({ message: "Unable to capture billing usage event" });
      return;
    }
    recordAudit({
      actorRole: role,
      actorId,
      entityType: "billing_usage_event",
      entityId: usageEvent.id,
      action: "usage_captured",
      outcome: `${usageEvent.meterKey} usage captured from ${usageEvent.sourceService}.`,
      severity: "info",
      route: "/billing-engine",
      middleware: ["Kafka", "Dapr", "Postgres", "Redis"],
      detail: "A billable platform event was ingested and rated for the accrued-charge dashboard.",
    });
    res.status(201).json(usageEvent);
  });

  app.get("/api/platform/billing/accruals", async (_req, res) => {
    await ensureBillingEngineSeed();
    await refreshBillingAccrualSnapshots();
    const items = await listBillingAccrualSnapshots();
    res.json({ asOf: new Date().toISOString(), items, total: items.length });
  });

  app.get("/api/platform/billing/invoices", async (_req, res) => {
    await ensureBillingEngineSeed();
    const [items, lines, approvals] = await Promise.all([
      listBillingInvoices(),
      listBillingInvoiceLines(),
      listBillingInvoiceApprovals(),
    ]);
    res.json({ asOf: new Date().toISOString(), items, lines, approvals, total: items.length });
  });

  app.post("/api/platform/billing/invoices/generate", async (req, res) => {
    await ensureBillingEngineSeed();
    const role = readRole(req);
    const actorId = readActorId(req, role);
    const generated = await generateBillingInvoices({
      billingAccountId: req.body?.billingAccountId ? String(req.body.billingAccountId) : undefined,
      periodType: req.body?.periodType ? String(req.body.periodType) as "monthly" | "quarterly" | "semi_annual" | "annual" | "custom" : undefined,
      generatedBy: actorId,
    });
    recordAudit({
      actorRole: role,
      actorId,
      entityType: "billing_invoice_run",
      entityId: generated.invoices[0]?.id || "invoice-run",
      action: "invoice_run_generated",
      outcome: `Generated ${generated.invoices.length} billing invoices for approval workflow.`,
      severity: "info",
      route: "/billing-engine",
      middleware: ["Temporal", "Postgres", "Kafka", "Redis"],
      detail: "The billing engine generated invoices with billing-period logic and approval-lane scaffolding.",
    });
    res.status(201).json({ asOf: new Date().toISOString(), ...generated, total: generated.invoices.length });
  });

  app.post("/api/platform/billing/invoices/:invoiceId/approvals/:approvalId", async (req, res) => {
    await ensureBillingEngineSeed();
    const role = readRole(req);
    const actorId = readActorId(req, role);
    const invoice = await resolveBillingInvoiceApproval({
      invoiceId: req.params.invoiceId,
      approvalId: req.params.approvalId,
      actorRole: role,
      decision: String(req.body?.decision || "approve") === "reject" ? "reject" : "approve",
      note: req.body?.note ? String(req.body.note) : undefined,
    });
    if (!invoice) {
      res.status(404).json({ message: "Billing invoice approval step not found" });
      return;
    }
    recordAudit({
      actorRole: role,
      actorId,
      entityType: "billing_invoice",
      entityId: invoice.id,
      action: invoice.approvalStatus === "rejected" ? "approval_rejected" : "approval_resolved",
      outcome: `Billing invoice ${invoice.invoiceNumber} moved to ${invoice.status}.`,
      severity: invoice.approvalStatus === "rejected" ? "warning" : "info",
      route: "/billing-engine",
      middleware: ["Permify", "Keycloak", "Temporal", "Postgres"],
      detail: "An invoice approval lane was resolved from the next-generation billing control workspace.",
    });
    res.json(invoice);
  });

  app.get("/api/platform/billing/dashboard/extended", async (_req, res) => {
    res.json({ asOf: new Date().toISOString(), ...(await getBillingExtendedDashboard()) });
  });

  app.get("/api/platform/billing/approval-matrices", async (_req, res) => {
    const items = await listBillingApprovalMatrices();
    res.json({ asOf: new Date().toISOString(), items, total: items.length });
  });

  app.post("/api/platform/billing/approval-matrices", async (req, res) => {
    const role = readRole(req);
    const actorId = readActorId(req, role);
    const tenantId = String(req.body?.tenantId || "54bank-platform-prod");
    const item = await createBillingApprovalMatrix({
      tenantId,
      billingAccountId: String(req.body?.billingAccountId || "BAC-001"),
      name: String(req.body?.name || "Tenant approval matrix"),
      status: (req.body?.status === "retired" ? "retired" : req.body?.status === "draft" ? "draft" : "active"),
      createdBy: actorId,
      stages: Array.isArray(req.body?.stages) && req.body.stages.length > 0
        ? req.body.stages.map((stage: Record<string, unknown>, index: number) => ({
            stageKey: String(stage.stageKey || `stage_${index + 1}`),
            actorRole: (stage.actorRole === "treasury" || stage.actorRole === "compliance" || stage.actorRole === "branch" ? stage.actorRole : "operations") as "operations" | "treasury" | "compliance" | "branch",
            label: String(stage.label || `Stage ${index + 1}`),
            minimumAmount: typeof stage.minimumAmount === "number" ? stage.minimumAmount : undefined,
            maximumAmount: typeof stage.maximumAmount === "number" ? stage.maximumAmount : undefined,
            autoApprove: Boolean(stage.autoApprove),
          }))
        : [
            { stageKey: "operations_review", actorRole: "operations", label: "Operations review", minimumAmount: 0 },
            { stageKey: "treasury_signoff", actorRole: "treasury", label: "Treasury sign-off", minimumAmount: 500000 },
          ],
    });
    recordAudit({
      actorRole: role,
      actorId,
      entityType: "billing_approval_matrix",
      entityId: item.id,
      action: "matrix_created",
      outcome: `Billing approval matrix ${item.name} saved for ${tenantId}.`,
      severity: "info",
      route: "/billing-engine",
      middleware: ["Permify", "Keycloak", "Postgres"],
      detail: "Tenant-level approval matrices are now configurable through the billing engine workspace.",
    });
    res.status(201).json(item);
  });

  app.post("/api/platform/billing/invoices/generate-advanced", async (req, res) => {
    const role = readRole(req);
    const actorId = readActorId(req, role);
    const generated = await generateBillingInvoicesWithMatrix({
      billingAccountId: req.body?.billingAccountId ? String(req.body.billingAccountId) : undefined,
      periodType: req.body?.periodType ? String(req.body.periodType) as "monthly" | "quarterly" | "semi_annual" | "annual" | "custom" : undefined,
      generatedBy: actorId,
    });
    recordAudit({
      actorRole: role,
      actorId,
      entityType: "billing_invoice_run",
      entityId: generated.invoices[0]?.id || "invoice-run-advanced",
      action: "invoice_run_generated",
      outcome: `Advanced invoice run generated ${generated.invoices.length} invoices with tenant approval matrices.`,
      severity: "info",
      route: "/billing-engine",
      middleware: ["Temporal", "Permify", "Postgres", "Kafka"],
      detail: "The billing engine generated invoices using tenant-specific approval matrix rules.",
    });
    res.status(201).json({ asOf: new Date().toISOString(), ...generated, total: generated.invoices.length });
  });

  app.get("/api/platform/billing/invoices/:invoiceId/export", async (req, res) => {
    const format = req.query.format === "csv" || req.query.format === "html" ? req.query.format : "json";
    const bundle = await exportBillingInvoice(req.params.invoiceId, format);
    if (!bundle) {
      res.status(404).json({ message: "Billing invoice export not found" });
      return;
    }
    res.setHeader("Content-Disposition", `attachment; filename="${bundle.fileName}"`);
    res.type(bundle.contentType).send(bundle.body);
  });

  app.get("/api/platform/billing/erp-postings", async (_req, res) => {
    const items = await listBillingErpPostingAttempts();
    res.json({ asOf: new Date().toISOString(), items, total: items.length });
  });

  app.post("/api/platform/billing/invoices/:invoiceId/erp-post", async (req, res) => {
    const role = readRole(req);
    const actorId = readActorId(req, role);
    const item = await queueBillingInvoiceErpPosting({
      invoiceId: req.params.invoiceId,
      erpSystem: req.body?.erpSystem === "lakehouse_finance" ? "lakehouse_finance" : "erpnext",
    });
    if (!item) {
      res.status(404).json({ message: "Billing invoice not found for ERP posting" });
      return;
    }
    recordAudit({
      actorRole: role,
      actorId,
      entityType: "billing_invoice",
      entityId: item.invoiceId,
      action: "erp_post_queued",
      outcome: `Invoice ${item.invoiceNumber} queued for ${item.erpSystem} posting.`,
      severity: "info",
      route: "/billing-engine",
      middleware: ["ERPNext", "Kafka", "Postgres", "Lakehouse"],
      detail: "Billing invoices can now be queued for ERP posting with typed commercial payloads.",
    });
    res.status(201).json(item);
  });

  app.post("/api/platform/billing/erp-postings/:attemptId/resolve", async (req, res) => {
    const item = await markBillingErpPostingResult({
      attemptId: req.params.attemptId,
      status: req.body?.status === "failed" ? "failed" : "posted",
      errorMessage: req.body?.errorMessage ? String(req.body.errorMessage) : undefined,
    });
    if (!item) {
      res.status(404).json({ message: "ERP posting attempt not found" });
      return;
    }
    res.json(item);
  });

  app.get("/api/platform/billing/disputes", async (_req, res) => {
    const items = await listBillingInvoiceDisputes();
    res.json({ asOf: new Date().toISOString(), items, total: items.length });
  });

  app.post("/api/platform/billing/disputes", async (req, res) => {
    const role = readRole(req);
    const actorId = readActorId(req, role);
    const item = await createBillingInvoiceDispute({
      invoiceId: String(req.body?.invoiceId || "BINV-001"),
      tenantId: String(req.body?.tenantId || "54bank-platform-prod"),
      severity: req.body?.severity === "high" ? "high" : req.body?.severity === "low" ? "low" : "medium",
      reasonCode: req.body?.reasonCode === "pricing_dispute" || req.body?.reasonCode === "tax_dispute" || req.body?.reasonCode === "contract_dispute" || req.body?.reasonCode === "duplicate_invoice" ? req.body.reasonCode : "usage_dispute",
      title: String(req.body?.title || "Billing dispute"),
      detail: String(req.body?.detail || "Billing exception raised for invoice review."),
      openedBy: actorId,
      assignedRole: req.body?.assignedRole === "treasury" || req.body?.assignedRole === "compliance" || req.body?.assignedRole === "branch" ? req.body.assignedRole : "operations",
    });
    recordAudit({
      actorRole: role,
      actorId,
      entityType: "billing_dispute",
      entityId: item.id,
      action: "opened",
      outcome: `Billing dispute ${item.title} opened for invoice ${item.invoiceId}.`,
      severity: item.severity === "high" ? "warning" : "info",
      route: "/billing-engine",
      middleware: ["Permify", "Postgres", "OpenSearch"],
      detail: "Billing disputes now have an explicit review lifecycle in the billing control tower.",
    });
    res.status(201).json(item);
  });

  app.post("/api/platform/billing/disputes/:disputeId/resolve", async (req, res) => {
    const item = await resolveBillingInvoiceDispute({
      disputeId: req.params.disputeId,
      status: req.body?.status === "rejected" ? "rejected" : req.body?.status === "resolved" ? "resolved" : "under_review",
      resolutionNote: req.body?.resolutionNote ? String(req.body.resolutionNote) : undefined,
    });
    if (!item) {
      res.status(404).json({ message: "Billing dispute not found" });
      return;
    }
    res.json(item);
  });

  app.post("/api/platform/billing/usage-events/ingest", async (req, res) => {
    const tenantId = String(req.body?.tenantId || "54bank-platform-prod");
    const usageEvent = await ingestBillingUsageViaMiddleware({
      tenantId,
      billingAccountId: req.body?.billingAccountId ? String(req.body.billingAccountId) : undefined,
      sourceService: String(req.body?.sourceService || "middleware.billing.gateway"),
      sourceEventType: String(req.body?.sourceEventType || "usage.bridge"),
      meterKey: String(req.body?.meterKey || "transfer_posted"),
      productKey: String(req.body?.productKey || "payments"),
      quantity: Number(req.body?.quantity || 1),
      currency: req.body?.currency ? String(req.body.currency) : undefined,
      actorId: req.body?.actorId ? String(req.body.actorId) : undefined,
      resourceId: req.body?.resourceId ? String(req.body.resourceId) : undefined,
      correlationId: req.body?.correlationId ? String(req.body.correlationId) : undefined,
      payload: typeof req.body?.payload === "object" && req.body.payload ? req.body.payload as Record<string, unknown> : undefined,
      bridge: req.body?.bridge === "dapr" || req.body?.bridge === "fluvio" || req.body?.bridge === "tigerbeetle" ? req.body.bridge : "kafka",
    });
    if (!usageEvent) {
      res.status(500).json({ message: "Unable to ingest billing usage event through middleware bridge" });
      return;
    }
    res.status(201).json(usageEvent);
  });

  app.get("/api/platform/billing/contract-overrides", async (_req, res) => {
    await ensureBillingEngineSeed();
    const items = await listBillingContractOverrides();
    res.json({ asOf: new Date().toISOString(), items, total: items.length });
  });

  app.post("/api/platform/billing/contract-overrides", async (req, res) => {
    await ensureBillingEngineSeed();
    const role = readRole(req);
    const actorId = readActorId(req, role);
    const created = await createBillingContractOverride({
      billingAccountId: String(req.body?.billingAccountId || "BAC-001"),
      tenantId,
      overrideType: String(req.body?.overrideType || "unit_price") as "unit_price" | "included_units" | "minimum_commit" | "billing_model" | "billing_period",
      meterKey: req.body?.meterKey ? String(req.body.meterKey) : undefined,
      productKey: req.body?.productKey ? String(req.body.productKey) : undefined,
      valueNumber: req.body?.valueNumber !== undefined ? Number(req.body.valueNumber) : undefined,
      valueText: req.body?.valueText ? String(req.body.valueText) : undefined,
      effectiveFrom: String(req.body?.effectiveFrom || new Date().toISOString()),
      effectiveTo: req.body?.effectiveTo ? String(req.body.effectiveTo) : undefined,
      status: String(req.body?.status || "active") as "draft" | "active" | "expired",
      createdBy: actorId,
      notes: req.body?.notes ? String(req.body.notes) : undefined,
    });
    if (!created) {
      res.status(500).json({ message: "Unable to create billing contract override" });
      return;
    }
    res.status(201).json(created);
  });

  app.get("/api/platform/billing/discount-rules", async (_req, res) => {
    await ensureBillingEngineSeed();
    const items = await listBillingDiscountRules();
    res.json({ asOf: new Date().toISOString(), items, total: items.length });
  });

  app.post("/api/platform/billing/discount-rules", async (req, res) => {
    await ensureBillingEngineSeed();
    const role = readRole(req);
    const actorId = readActorId(req, role);
    const created = await createBillingDiscountRule({
      billingAccountId: String(req.body?.billingAccountId || "BAC-001"),
      tenantId,
      name: String(req.body?.name || "Commercial discount"),
      discountType: String(req.body?.discountType || "percentage") as "percentage" | "fixed" | "threshold_percentage",
      meterKey: req.body?.meterKey ? String(req.body.meterKey) : undefined,
      productKey: req.body?.productKey ? String(req.body.productKey) : undefined,
      percentage: req.body?.percentage !== undefined ? Number(req.body.percentage) : undefined,
      fixedAmount: req.body?.fixedAmount !== undefined ? Number(req.body.fixedAmount) : undefined,
      thresholdAmount: req.body?.thresholdAmount !== undefined ? Number(req.body.thresholdAmount) : undefined,
      effectiveFrom: String(req.body?.effectiveFrom || new Date().toISOString()),
      effectiveTo: req.body?.effectiveTo ? String(req.body.effectiveTo) : undefined,
      status: String(req.body?.status || "active") as "draft" | "active" | "expired",
      createdBy: actorId,
    });
    if (!created) {
      res.status(500).json({ message: "Unable to create billing discount rule" });
      return;
    }
    res.status(201).json(created);
  });

  app.get("/api/platform/billing/revenue-share-rules", async (_req, res) => {
    await ensureBillingEngineSeed();
    const items = await listBillingRevenueShareRules();
    res.json({ asOf: new Date().toISOString(), items, total: items.length });
  });

  app.post("/api/platform/billing/revenue-share-rules", async (req, res) => {
    await ensureBillingEngineSeed();
    const role = readRole(req);
    const actorId = readActorId(req, role);
    const created = await createBillingRevenueShareRule({
      billingAccountId: String(req.body?.billingAccountId || "BAC-001"),
      tenantId,
      name: String(req.body?.name || "Revenue-share rule"),
      target: String(req.body?.target || "partner_bank") as "platform" | "partner_bank" | "aggregator" | "reseller",
      percentage: Number(req.body?.percentage || 0),
      beneficiaryName: String(req.body?.beneficiaryName || "Partner beneficiary"),
      settlementLedgerCode: req.body?.settlementLedgerCode ? String(req.body.settlementLedgerCode) : undefined,
      effectiveFrom: String(req.body?.effectiveFrom || new Date().toISOString()),
      effectiveTo: req.body?.effectiveTo ? String(req.body.effectiveTo) : undefined,
      status: String(req.body?.status || "active") as "draft" | "active" | "expired",
      createdBy: actorId,
    });
    if (!created) {
      res.status(500).json({ message: "Unable to create billing revenue-share rule" });
      return;
    }
    res.status(201).json(created);
  });

  app.get("/api/platform/exports/:exportId/download", (req, res) => {
    const role = readRole(req);
    const profile = getRoleProfile(role);
    const job = exportJobs.find((item) => item.id === req.params.exportId);
    if (!job) {
      res.status(404).json({ message: "Export not found" });
      return;
    }
    const allowed = profile.exportScopes.some((scope) => job.domainKey.includes(scope) || job.title.toLowerCase().includes(scope)) || job.requestedByRole === role;
    if (!allowed) {
      res.status(403).json({ message: "Export is not available for this role" });
      return;
    }
    const payload = {
      id: job.id,
      title: job.title,
      format: job.format,
      rowCount: job.rowCount,
      requestedByRole: job.requestedByRole,
      approvalState: job.approvalState,
      approvalSignature: job.approvalSignature,
      generatedAt: job.createdAt,
      retainedUntil: job.retainedUntil,
      reportVersion: job.reportVersion,
      approvalChain: job.approvalChain,
      signedBy: job.signedBy,
      middleware: ["Postgres", "Lakehouse", "Permify"],
      route: job.route,
    };
    res.setHeader("Content-Disposition", `attachment; filename="${job.id}.${job.format === "json" ? "json" : job.format}"`);
    if (job.format === "json") {
      res.type("application/json").send(JSON.stringify(payload, null, 2));
      return;
    }
    const header = "id,title,format,rowCount,requestedByRole,approvalState,approvalSignature,generatedAt,retainedUntil,reportVersion,approvalChain,signedBy,route\n";
    const row = `${job.id},${job.title},${job.format},${job.rowCount},${job.requestedByRole},${job.approvalState},${job.approvalSignature},${job.createdAt},${job.retainedUntil || ""},${job.reportVersion || ""},${(job.approvalChain || []).join("|")},${(job.signedBy || []).join("|")},${job.route}\n`;
    res.type(job.format === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "text/csv").send(header + row);
  });

  app.get("/api/platform/search", (req, res) => {
    const q = String(req.query.q || "").trim();
    res.json({ asOf: new Date().toISOString(), items: q ? buildSearchResults(q) : buildSearchResults("") });
  });

  app.get("/api/platform/teller/overview", async (_req, res) => {
    res.json(await getTellerOverview());
  });

  app.get("/api/platform/reconciliation/overview", async (_req, res) => {
    res.json(await getReconciliationOverview());
  });

  app.get("/api/platform/erpnext/overview", async (_req, res) => {
    res.json(await getERPNextOverview());
  });

  app.get("/api/platform/islamic-banking/overview", async (_req, res) => {
    res.json(await getIslamicOverview());
  });

  app.get("/api/platform/trade-finance/overview", (_req, res) => {
    res.json(buildDomainOverview("trade-finance", "/trade-finance"));
  });

  app.get("/api/platform/disputes/overview", (_req, res) => {
    res.json(buildDomainOverview("dispute-management", "/disputes"));
  });

  app.get("/api/platform/agricultural-insurance/overview", (_req, res) => {
    res.json(
      withLedgerOutcome(
        "agricultural-insurance",
        "fallback",
        buildDomainOverview("agricultural-insurance", "/agricultural-insurance") as JsonRecord,
        false,
      ),
    );
  });

  app.post("/api/platform/ledger-posting/:domain/preview", (req, res) => {
    const role = readRole(req);
    const actorId = readActorId(req, role);
    const domain = String(req.params.domain || "").trim().toLowerCase();
    const seam = typeof req.body?.seam === "string" ? req.body.seam : undefined;
    const amount = typeof req.body?.amount === "number" ? req.body.amount : undefined;
    const preview = buildLedgerPostingPreview(domain, seam, amount, actorId);

    if (!preview) {
      res.status(404).json({ message: "Ledger posting contract not found" });
      return;
    }

    recordAudit({
      actorRole: role,
      actorId,
      entityType: "ledger_posting_preview",
      entityId: preview.postingId,
      action: "preview_created",
      outcome: `${preview.domain} posting preview queued for ${preview.seam}.`,
      severity: "info",
      route:
        preview.domain === "teller"
          ? "/teller"
          : preview.domain === "islamic-banking"
            ? "/islamic-banking"
            : "/agricultural-insurance",
      middleware: preview.middleware,
      detail: preview.contract.detail,
    });

    res.json(
      withMiddlewareContract("ledger-posting", "preview_created", { preview }, {
        kafkaPublication: "queued",
        cacheInvalidation: "refreshed",
        workflowProgression: "awaiting_review",
        tigerBeetlePosting: preview.contract.tigerBeetlePosting === "conditional_on_claim_settlement" ? "gated_by_workflow" : "queued_for_downstream",
        middleware: preview.middleware,
        detail: preview.contract.detail,
      }),
    );
  });

  app.get("/api/platform/mortgage/overview", (_req, res) => {
    res.json(buildDomainOverview("mortgage-servicing", "/mortgage"));
  });

  app.get("/api/platform/education-loans/overview", (_req, res) => {
    res.json(buildDomainOverview("education-loans", "/education-loans"));
  });

  app.get("/api/platform/esusu/overview", (_req, res) => {
    res.json(buildDomainOverview("esusu-groups", "/esusu"));
  });

  app.get("/api/platform/virtual-accounts/overview", (_req, res) => {
    res.json(buildDomainOverview("virtual-accounts", "/virtual-accounts"));
  });

  // ── Microservice Proxy Configuration ──
  // Each banking vertical is implemented as a standalone microservice:
  //   - agriculture-banking-rs  (Rust/Actix)  → :8090
  //   - teller-operations-go    (Go)          → :8091
  //   - islamic-banking-py      (Python)      → :8092
  //   - trade-finance-go        (Go)          → :8093
  // In production, APISIX or an API gateway handles routing.
  // Below we register proxy-passthrough endpoints that forward to the
  // microservices when they are running, or return service-unavailable status.

  // --- Prometheus metrics endpoint (#12) ---
  app.get("/metrics", metricsEndpoint);

  // --- OpenAPI / Swagger (#28) ---
  app.get("/api/docs", (_req, res) => {
    res.json(generateOpenAPISpec());
  });
  app.get("/api/docs/ui", (_req, res) => {
    res.setHeader("Content-Type", "text/html");
    res.send(`<!DOCTYPE html><html><head><title>54Bank API Documentation</title>
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist/swagger-ui.css" />
      </head><body><div id="swagger-ui"></div>
      <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist/swagger-ui-bundle.js"></script>
      <script>SwaggerUIBundle({ url: "/api/docs", dom_id: "#swagger-ui" });</script>
      </body></html>`);
  });

  // --- Aggregated health check (#8) ---
  const serviceUrls: Record<string, string> = {};
  const healthCheckServices = () => Object.entries(serviceUrls);

  app.get("/healthz/services", async (_req, res) => {
    const results: Record<string, { status: string; latencyMs: number }> = {};
    const checks = healthCheckServices().map(async ([name, url]) => {
      const start = Date.now();
      try {
        const resp = await fetch(`${url}/healthz`, { signal: AbortSignal.timeout(3000) });
        results[name] = { status: resp.ok ? "healthy" : "degraded", latencyMs: Date.now() - start };
      } catch {
        results[name] = { status: "down", latencyMs: Date.now() - start };
      }
    });
    await Promise.allSettled(checks);
    const allHealthy = Object.values(results).every((r) => r.status === "healthy");
    res.status(allHealthy ? 200 : 207).json({
      status: allHealthy ? "healthy" : "degraded",
      services: results,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      wsClients: wsClients.size,
    });
  });

  // --- Audit trail endpoints (#16) ---
  app.get("/api/platform/audit", (_req, res) => {
    const filters = {
      domain: _req.query.domain as string | undefined,
      userId: _req.query.userId as string | undefined,
      action: _req.query.action as string | undefined,
      from: _req.query.from as string | undefined,
      to: _req.query.to as string | undefined,
      limit: _req.query.limit ? Number(_req.query.limit) : undefined,
    };
    res.json(auditLog.query(filters));
  });
  app.get("/api/platform/audit/stats", (_req, res) => {
    res.json(auditLog.getStats());
  });

  // --- Full-text search across domains (#20) ---
  app.get("/api/platform/search", async (req, res) => {
    const query = String(req.query.q ?? "").toLowerCase().trim();
    if (!query) {
      res.status(400).json({ error: "Query parameter 'q' is required" });
      return;
    }
    const domain = req.query.domain as string | undefined;
    const limit = Math.min(Number(req.query.limit ?? 50), 200);

    const searchDomains: { name: string; url: string }[] = [];
    if (!domain || domain === "disputes") searchDomains.push({ name: "disputes", url: `${DISPUTE_SERVICE_URL}/v1/disputes/cases` });
    if (!domain || domain === "customers") searchDomains.push({ name: "customers", url: "" });

    const results: Array<{ domain: string; id: string; match: string; score: number }> = [];
    for (const d of searchDomains) {
      try {
        if (!d.url) continue;
        const resp = await fetch(d.url, { signal: AbortSignal.timeout(5000) });
        if (!resp.ok) continue;
        const data = await resp.json() as Record<string, unknown>[];
        const items = Array.isArray(data) ? data : [];
        for (const item of items) {
          const text = JSON.stringify(item).toLowerCase();
          if (text.includes(query)) {
            results.push({
              domain: d.name,
              id: String((item as Record<string, unknown>).id ?? ""),
              match: text.slice(0, 200),
              score: (text.match(new RegExp(query, "g")) ?? []).length,
            });
          }
        }
      } catch { /* service not available */ }
    }

    results.sort((a, b) => b.score - a.score);
    res.json({ query, results: results.slice(0, limit), total: results.length });
  });

  // Service URL registry
  const AGRICULTURE_SERVICE_URL = process.env.AGRICULTURE_SERVICE_URL || "http://localhost:8090";
  const TELLER_SERVICE_URL = process.env.TELLER_SERVICE_URL || "http://localhost:8091";
  const ISLAMIC_BANKING_SERVICE_URL = process.env.ISLAMIC_BANKING_SERVICE_URL || "http://localhost:8092";
  const TRADE_FINANCE_SERVICE_URL = process.env.TRADE_FINANCE_SERVICE_URL || "http://localhost:8093";
  const MORTGAGE_SERVICE_URL = process.env.MORTGAGE_SERVICE_URL || "http://localhost:8094";
  const ESUSU_SERVICE_URL = process.env.ESUSU_SERVICE_URL || "http://localhost:8095";
  const VIRTUAL_ACCOUNTS_SERVICE_URL = process.env.VIRTUAL_ACCOUNTS_SERVICE_URL || "http://localhost:8096";
  const AGENT_BANKING_SERVICE_URL = process.env.AGENT_BANKING_SERVICE_URL || "http://localhost:8097";
  const GROUP_LENDING_SERVICE_URL = process.env.GROUP_LENDING_SERVICE_URL || "http://localhost:8098";
  const EDUCATION_LOANS_SERVICE_URL = process.env.EDUCATION_LOANS_SERVICE_URL || "http://localhost:8099";
  const LEDGER_RECON_SERVICE_URL = process.env.LEDGER_RECON_SERVICE_URL || "http://localhost:8100";
  const IDENTITY_CHANNELS_SERVICE_URL = process.env.IDENTITY_CHANNELS_SERVICE_URL || "http://localhost:8101";
  const DISPUTE_SERVICE_URL = process.env.DISPUTE_SERVICE_URL || "http://localhost:8102";
  const ERPNEXT_SYNC_SERVICE_URL = process.env.ERPNEXT_SYNC_SERVICE_URL || "http://localhost:8103";
  const REGULATORY_SERVICE_URL = process.env.REGULATORY_SERVICE_URL || "http://localhost:8104";
  const SECURITY_GATEWAY_URL = process.env.SECURITY_GATEWAY_URL || "http://localhost:8105";
  const RESILIENCE_SERVICE_URL = process.env.RESILIENCE_SERVICE_URL || "http://localhost:8106";
  const PAYMENTS_HUB_URL = process.env.PAYMENTS_HUB_URL || "http://localhost:8107";
  const SAVINGS_PRODUCTS_URL = process.env.SAVINGS_PRODUCTS_URL || "http://localhost:8108";
  const CARD_MANAGEMENT_URL = process.env.CARD_MANAGEMENT_URL || "http://localhost:8109";
  const TREASURY_LIQUIDITY_URL = process.env.TREASURY_LIQUIDITY_URL || "http://localhost:8110";
  const CUSTOMER_ENGAGEMENT_URL = process.env.CUSTOMER_ENGAGEMENT_URL || "http://localhost:8111";
  const FRAUD_DETECTION_URL = process.env.FRAUD_DETECTION_URL || "http://localhost:8112";

  // Register all services for health aggregation (#8)
  Object.assign(serviceUrls, {
    "agriculture": AGRICULTURE_SERVICE_URL,
    "teller": TELLER_SERVICE_URL,
    "islamic-banking": ISLAMIC_BANKING_SERVICE_URL,
    "trade-finance": TRADE_FINANCE_SERVICE_URL,
    "mortgage": MORTGAGE_SERVICE_URL,
    "esusu": ESUSU_SERVICE_URL,
    "virtual-accounts": VIRTUAL_ACCOUNTS_SERVICE_URL,
    "agent-banking": AGENT_BANKING_SERVICE_URL,
    "group-lending": GROUP_LENDING_SERVICE_URL,
    "education-loans": EDUCATION_LOANS_SERVICE_URL,
    "ledger-recon": LEDGER_RECON_SERVICE_URL,
    "identity-channels": IDENTITY_CHANNELS_SERVICE_URL,
    "disputes": DISPUTE_SERVICE_URL,
    "erpnext-sync": ERPNEXT_SYNC_SERVICE_URL,
    "regulatory": REGULATORY_SERVICE_URL,
    "security-gateway": SECURITY_GATEWAY_URL,
    "resilience": RESILIENCE_SERVICE_URL,
    "payments-hub": PAYMENTS_HUB_URL,
    "savings-products": SAVINGS_PRODUCTS_URL,
    "card-management": CARD_MANAGEMENT_URL,
    "treasury-liquidity": TREASURY_LIQUIDITY_URL,
    "customer-engagement": CUSTOMER_ENGAGEMENT_URL,
    "fraud-detection": FRAUD_DETECTION_URL,
  });

  async function proxyToService(serviceUrl: string, servicePath: string, req: Request, res: express.Response): Promise<void> {
    try {
      const url = `${serviceUrl}${servicePath}`;
      const correlationId = req.headers["x-correlation-id"] as string || randomUUID();
      const headers: Record<string, string> = {
        "content-type": "application/json",
        "x-correlation-id": correlationId,
        "x-tenant-id": req.tenantId ?? "default",
        "x-forwarded-for": req.ip ?? "unknown",
      };
      const fetchOptions: RequestInit = {
        method: req.method,
        headers,
        signal: AbortSignal.timeout(10_000),
      };
      if (req.method !== "GET" && req.method !== "HEAD") {
        fetchOptions.body = JSON.stringify(req.body);
      }
      const upstream = await fetch(url, fetchOptions);
      const data = await upstream.text();
      res.set("x-correlation-id", correlationId);
      res.status(upstream.status).set("content-type", "application/json").send(data);
    } catch (err) {
      const isTimeout = err instanceof DOMException && err.name === "TimeoutError";
      res.status(503).json({
        message: isTimeout ? "Service request timed out (10s)" : "Banking service unavailable — start the microservice or configure the upstream URL",
        service: serviceUrl,
        path: servicePath,
        hint: "Run the service with Docker or directly, then retry",
      });
    }
  }

  // Agriculture Banking proxy routes
  app.all("/api/platform/agriculture/farmers", (req, res) => {
    void proxyToService(AGRICULTURE_SERVICE_URL, "/v1/agriculture/farmers", req, res);
  });
  app.all("/api/platform/agriculture/farmers/:id", (req, res) => {
    void proxyToService(AGRICULTURE_SERVICE_URL, `/v1/agriculture/farmers/${req.params.id}`, req, res);
  });
  app.all("/api/platform/agriculture/loans", (req, res) => {
    void proxyToService(AGRICULTURE_SERVICE_URL, "/v1/agriculture/loans", req, res);
  });
  app.all("/api/platform/agriculture/loans/:id", (req, res) => {
    void proxyToService(AGRICULTURE_SERVICE_URL, `/v1/agriculture/loans/${req.params.id}`, req, res);
  });
  app.all("/api/platform/agriculture/loans/:id/disburse", (req, res) => {
    void proxyToService(AGRICULTURE_SERVICE_URL, `/v1/agriculture/loans/${req.params.id}/disburse`, req, res);
  });
  app.all("/api/platform/agriculture/loans/:id/repay", (req, res) => {
    void proxyToService(AGRICULTURE_SERVICE_URL, `/v1/agriculture/loans/${req.params.id}/repay`, req, res);
  });
  app.all("/api/platform/agriculture/insurance", (req, res) => {
    void proxyToService(AGRICULTURE_SERVICE_URL, "/v1/agriculture/insurance", req, res);
  });
  app.all("/api/platform/agriculture/insurance/:id", (req, res) => {
    void proxyToService(AGRICULTURE_SERVICE_URL, `/v1/agriculture/insurance/${req.params.id}`, req, res);
  });
  app.all("/api/platform/agriculture/insurance/:id/claim", (req, res) => {
    void proxyToService(AGRICULTURE_SERVICE_URL, `/v1/agriculture/insurance/${req.params.id}/claim`, req, res);
  });
  app.all("/api/platform/agriculture/value-chain", (req, res) => {
    void proxyToService(AGRICULTURE_SERVICE_URL, "/v1/agriculture/value-chain", req, res);
  });
  app.all("/api/platform/agriculture/value-chain/:id", (req, res) => {
    void proxyToService(AGRICULTURE_SERVICE_URL, `/v1/agriculture/value-chain/${req.params.id}`, req, res);
  });
  app.all("/api/platform/agriculture/value-chain/:id/milestone", (req, res) => {
    void proxyToService(AGRICULTURE_SERVICE_URL, `/v1/agriculture/value-chain/${req.params.id}/milestone`, req, res);
  });

  // Teller Operations proxy routes
  app.all("/api/platform/teller/sessions", (req, res) => {
    void proxyToService(TELLER_SERVICE_URL, "/v1/teller/sessions", req, res);
  });
  app.all("/api/platform/teller/sessions/:id", (req, res) => {
    void proxyToService(TELLER_SERVICE_URL, `/v1/teller/sessions/${req.params.id}`, req, res);
  });
  app.all("/api/platform/teller/sessions/:id/close", (req, res) => {
    void proxyToService(TELLER_SERVICE_URL, `/v1/teller/sessions/${req.params.id}/close`, req, res);
  });
  app.all("/api/platform/teller/sessions/:id/transaction", (req, res) => {
    void proxyToService(TELLER_SERVICE_URL, `/v1/teller/sessions/${req.params.id}/transaction`, req, res);
  });
  app.all("/api/platform/teller/sessions/:id/cash-count", (req, res) => {
    void proxyToService(TELLER_SERVICE_URL, `/v1/teller/sessions/${req.params.id}/cash-count`, req, res);
  });
  app.all("/api/platform/teller/vault", (req, res) => {
    void proxyToService(TELLER_SERVICE_URL, "/v1/teller/vault", req, res);
  });

  // Islamic Banking proxy routes
  app.all("/api/platform/islamic-banking/murabaha", (req, res) => {
    void proxyToService(ISLAMIC_BANKING_SERVICE_URL, "/v1/islamic-banking/murabaha", req, res);
  });
  app.all("/api/platform/islamic-banking/murabaha/:id", (req, res) => {
    void proxyToService(ISLAMIC_BANKING_SERVICE_URL, `/v1/islamic-banking/murabaha/${req.params.id}`, req, res);
  });
  app.all("/api/platform/islamic-banking/murabaha/:id/disburse", (req, res) => {
    void proxyToService(ISLAMIC_BANKING_SERVICE_URL, `/v1/islamic-banking/murabaha/${req.params.id}/disburse`, req, res);
  });
  app.all("/api/platform/islamic-banking/murabaha/:id/repay", (req, res) => {
    void proxyToService(ISLAMIC_BANKING_SERVICE_URL, `/v1/islamic-banking/murabaha/${req.params.id}/repay`, req, res);
  });
  app.all("/api/platform/islamic-banking/ijara", (req, res) => {
    void proxyToService(ISLAMIC_BANKING_SERVICE_URL, "/v1/islamic-banking/ijara", req, res);
  });
  app.all("/api/platform/islamic-banking/ijara/:id", (req, res) => {
    void proxyToService(ISLAMIC_BANKING_SERVICE_URL, `/v1/islamic-banking/ijara/${req.params.id}`, req, res);
  });
  app.all("/api/platform/islamic-banking/mudarabah", (req, res) => {
    void proxyToService(ISLAMIC_BANKING_SERVICE_URL, "/v1/islamic-banking/mudarabah", req, res);
  });
  app.all("/api/platform/islamic-banking/mudarabah/:id", (req, res) => {
    void proxyToService(ISLAMIC_BANKING_SERVICE_URL, `/v1/islamic-banking/mudarabah/${req.params.id}`, req, res);
  });
  app.all("/api/platform/islamic-banking/mudarabah/:id/distribute", (req, res) => {
    void proxyToService(ISLAMIC_BANKING_SERVICE_URL, `/v1/islamic-banking/mudarabah/${req.params.id}/distribute`, req, res);
  });

  // Trade Finance proxy routes
  app.all("/api/platform/trade-finance/letters-of-credit", (req, res) => {
    void proxyToService(TRADE_FINANCE_SERVICE_URL, "/v1/trade-finance/letters-of-credit", req, res);
  });
  app.all("/api/platform/trade-finance/letters-of-credit/:id", (req, res) => {
    void proxyToService(TRADE_FINANCE_SERVICE_URL, `/v1/trade-finance/letters-of-credit/${req.params.id}`, req, res);
  });
  app.all("/api/platform/trade-finance/letters-of-credit/:id/issue", (req, res) => {
    void proxyToService(TRADE_FINANCE_SERVICE_URL, `/v1/trade-finance/letters-of-credit/${req.params.id}/issue`, req, res);
  });
  app.all("/api/platform/trade-finance/letters-of-credit/:id/amend", (req, res) => {
    void proxyToService(TRADE_FINANCE_SERVICE_URL, `/v1/trade-finance/letters-of-credit/${req.params.id}/amend`, req, res);
  });
  app.all("/api/platform/trade-finance/letters-of-credit/:id/present-documents", (req, res) => {
    void proxyToService(TRADE_FINANCE_SERVICE_URL, `/v1/trade-finance/letters-of-credit/${req.params.id}/present-documents`, req, res);
  });
  app.all("/api/platform/trade-finance/letters-of-credit/:id/settle", (req, res) => {
    void proxyToService(TRADE_FINANCE_SERVICE_URL, `/v1/trade-finance/letters-of-credit/${req.params.id}/settle`, req, res);
  });
  app.all("/api/platform/trade-finance/warehouse-receipts", (req, res) => {
    void proxyToService(TRADE_FINANCE_SERVICE_URL, "/v1/trade-finance/warehouse-receipts", req, res);
  });
  app.all("/api/platform/trade-finance/warehouse-receipts/:id", (req, res) => {
    void proxyToService(TRADE_FINANCE_SERVICE_URL, `/v1/trade-finance/warehouse-receipts/${req.params.id}`, req, res);
  });
  app.all("/api/platform/trade-finance/warehouse-receipts/:id/pledge", (req, res) => {
    void proxyToService(TRADE_FINANCE_SERVICE_URL, `/v1/trade-finance/warehouse-receipts/${req.params.id}/pledge`, req, res);
  });
  app.all("/api/platform/trade-finance/warehouse-receipts/:id/release", (req, res) => {
    void proxyToService(TRADE_FINANCE_SERVICE_URL, `/v1/trade-finance/warehouse-receipts/${req.params.id}/release`, req, res);
  });
  app.all("/api/platform/trade-finance/guarantees", (req, res) => {
    void proxyToService(TRADE_FINANCE_SERVICE_URL, "/v1/trade-finance/guarantees", req, res);
  });

  // Mortgage Servicing proxy routes (Rust :8094)
  app.all("/api/platform/mortgage/applications", (req, res) => {
    void proxyToService(MORTGAGE_SERVICE_URL, "/v1/mortgage/applications", req, res);
  });
  app.all("/api/platform/mortgage/applications/:id", (req, res) => {
    void proxyToService(MORTGAGE_SERVICE_URL, `/v1/mortgage/applications/${req.params.id}`, req, res);
  });
  app.all("/api/platform/mortgage/applications/:id/approve", (req, res) => {
    void proxyToService(MORTGAGE_SERVICE_URL, `/v1/mortgage/applications/${req.params.id}/approve`, req, res);
  });
  app.all("/api/platform/mortgage/applications/:id/disburse", (req, res) => {
    void proxyToService(MORTGAGE_SERVICE_URL, `/v1/mortgage/applications/${req.params.id}/disburse`, req, res);
  });
  app.all("/api/platform/mortgage/applications/:id/repay", (req, res) => {
    void proxyToService(MORTGAGE_SERVICE_URL, `/v1/mortgage/applications/${req.params.id}/repay`, req, res);
  });
  app.all("/api/platform/mortgage/applications/:id/prepay", (req, res) => {
    void proxyToService(MORTGAGE_SERVICE_URL, `/v1/mortgage/applications/${req.params.id}/prepay`, req, res);
  });
  app.all("/api/platform/mortgage/applications/:id/schedule", (req, res) => {
    void proxyToService(MORTGAGE_SERVICE_URL, `/v1/mortgage/applications/${req.params.id}/schedule`, req, res);
  });
  app.all("/api/platform/mortgage/payments", (req, res) => {
    void proxyToService(MORTGAGE_SERVICE_URL, "/v1/mortgage/payments", req, res);
  });

  // Esusu Groups proxy routes (Go :8095)
  app.all("/api/platform/esusu/groups", (req, res) => {
    void proxyToService(ESUSU_SERVICE_URL, "/v1/esusu/groups", req, res);
  });
  app.all("/api/platform/esusu/groups/:id", (req, res) => {
    void proxyToService(ESUSU_SERVICE_URL, `/v1/esusu/groups/${req.params.id}`, req, res);
  });
  app.all("/api/platform/esusu/groups/:id/members", (req, res) => {
    void proxyToService(ESUSU_SERVICE_URL, `/v1/esusu/groups/${req.params.id}/members`, req, res);
  });
  app.all("/api/platform/esusu/groups/:id/activate", (req, res) => {
    void proxyToService(ESUSU_SERVICE_URL, `/v1/esusu/groups/${req.params.id}/activate`, req, res);
  });
  app.all("/api/platform/esusu/groups/:id/contribute", (req, res) => {
    void proxyToService(ESUSU_SERVICE_URL, `/v1/esusu/groups/${req.params.id}/contribute`, req, res);
  });
  app.all("/api/platform/esusu/groups/:id/disburse", (req, res) => {
    void proxyToService(ESUSU_SERVICE_URL, `/v1/esusu/groups/${req.params.id}/disburse`, req, res);
  });
  app.all("/api/platform/esusu/contributions", (req, res) => {
    void proxyToService(ESUSU_SERVICE_URL, "/v1/esusu/contributions", req, res);
  });

  // Virtual Accounts proxy routes (Go :8096)
  app.all("/api/platform/virtual-accounts/accounts", (req, res) => {
    void proxyToService(VIRTUAL_ACCOUNTS_SERVICE_URL, "/v1/virtual-accounts/accounts", req, res);
  });
  app.all("/api/platform/virtual-accounts/accounts/:id", (req, res) => {
    void proxyToService(VIRTUAL_ACCOUNTS_SERVICE_URL, `/v1/virtual-accounts/accounts/${req.params.id}`, req, res);
  });
  app.all("/api/platform/virtual-accounts/accounts/:id/credit", (req, res) => {
    void proxyToService(VIRTUAL_ACCOUNTS_SERVICE_URL, `/v1/virtual-accounts/accounts/${req.params.id}/credit`, req, res);
  });
  app.all("/api/platform/virtual-accounts/accounts/:id/debit", (req, res) => {
    void proxyToService(VIRTUAL_ACCOUNTS_SERVICE_URL, `/v1/virtual-accounts/accounts/${req.params.id}/debit`, req, res);
  });
  app.all("/api/platform/virtual-accounts/accounts/:id/hold", (req, res) => {
    void proxyToService(VIRTUAL_ACCOUNTS_SERVICE_URL, `/v1/virtual-accounts/accounts/${req.params.id}/hold`, req, res);
  });
  app.all("/api/platform/virtual-accounts/accounts/:id/release", (req, res) => {
    void proxyToService(VIRTUAL_ACCOUNTS_SERVICE_URL, `/v1/virtual-accounts/accounts/${req.params.id}/release`, req, res);
  });
  app.all("/api/platform/virtual-accounts/accounts/:id/close", (req, res) => {
    void proxyToService(VIRTUAL_ACCOUNTS_SERVICE_URL, `/v1/virtual-accounts/accounts/${req.params.id}/close`, req, res);
  });
  app.all("/api/platform/virtual-accounts/accounts/:id/transactions", (req, res) => {
    void proxyToService(VIRTUAL_ACCOUNTS_SERVICE_URL, `/v1/virtual-accounts/accounts/${req.params.id}/transactions`, req, res);
  });
  app.all("/api/platform/virtual-accounts/transactions", (req, res) => {
    void proxyToService(VIRTUAL_ACCOUNTS_SERVICE_URL, "/v1/virtual-accounts/transactions", req, res);
  });

  // Agent Banking proxy routes (Go :8097)
  app.all("/api/platform/agent-banking/agents", (req, res) => {
    void proxyToService(AGENT_BANKING_SERVICE_URL, "/v1/agent-banking/agents", req, res);
  });
  app.all("/api/platform/agent-banking/agents/:id", (req, res) => {
    void proxyToService(AGENT_BANKING_SERVICE_URL, `/v1/agent-banking/agents/${req.params.id}`, req, res);
  });
  app.all("/api/platform/agent-banking/agents/:id/float-topup", (req, res) => {
    void proxyToService(AGENT_BANKING_SERVICE_URL, `/v1/agent-banking/agents/${req.params.id}/float-topup`, req, res);
  });
  app.all("/api/platform/agent-banking/agents/:id/transaction", (req, res) => {
    void proxyToService(AGENT_BANKING_SERVICE_URL, `/v1/agent-banking/agents/${req.params.id}/transaction`, req, res);
  });
  app.all("/api/platform/agent-banking/agents/:id/terminals", (req, res) => {
    void proxyToService(AGENT_BANKING_SERVICE_URL, `/v1/agent-banking/agents/${req.params.id}/terminals`, req, res);
  });
  app.all("/api/platform/agent-banking/agents/:id/transactions", (req, res) => {
    void proxyToService(AGENT_BANKING_SERVICE_URL, `/v1/agent-banking/agents/${req.params.id}/transactions`, req, res);
  });
  app.all("/api/platform/agent-banking/agents/:id/verify-kyc", (req, res) => {
    void proxyToService(AGENT_BANKING_SERVICE_URL, `/v1/agent-banking/agents/${req.params.id}/verify-kyc`, req, res);
  });
  app.all("/api/platform/agent-banking/transactions", (req, res) => {
    void proxyToService(AGENT_BANKING_SERVICE_URL, "/v1/agent-banking/transactions", req, res);
  });

  // Group Lending proxy routes (Go :8098)
  app.all("/api/platform/group-lending/groups", (req, res) => {
    void proxyToService(GROUP_LENDING_SERVICE_URL, "/v1/group-lending/groups", req, res);
  });
  app.all("/api/platform/group-lending/groups/:id", (req, res) => {
    void proxyToService(GROUP_LENDING_SERVICE_URL, `/v1/group-lending/groups/${req.params.id}`, req, res);
  });
  app.all("/api/platform/group-lending/groups/:id/members", (req, res) => {
    void proxyToService(GROUP_LENDING_SERVICE_URL, `/v1/group-lending/groups/${req.params.id}/members`, req, res);
  });
  app.all("/api/platform/group-lending/groups/:id/apply", (req, res) => {
    void proxyToService(GROUP_LENDING_SERVICE_URL, `/v1/group-lending/groups/${req.params.id}/apply`, req, res);
  });
  app.all("/api/platform/group-lending/groups/:id/approve", (req, res) => {
    void proxyToService(GROUP_LENDING_SERVICE_URL, `/v1/group-lending/groups/${req.params.id}/approve`, req, res);
  });
  app.all("/api/platform/group-lending/groups/:id/disburse", (req, res) => {
    void proxyToService(GROUP_LENDING_SERVICE_URL, `/v1/group-lending/groups/${req.params.id}/disburse`, req, res);
  });
  app.all("/api/platform/group-lending/groups/:id/repay", (req, res) => {
    void proxyToService(GROUP_LENDING_SERVICE_URL, `/v1/group-lending/groups/${req.params.id}/repay`, req, res);
  });

  // Education Loans proxy routes (Python :8099)
  app.all("/api/platform/education-loans/loans", (req, res) => {
    void proxyToService(EDUCATION_LOANS_SERVICE_URL, "/v1/education-loans/loans", req, res);
  });
  app.all("/api/platform/education-loans/loans/:id", (req, res) => {
    void proxyToService(EDUCATION_LOANS_SERVICE_URL, `/v1/education-loans/loans/${req.params.id}`, req, res);
  });
  app.all("/api/platform/education-loans/loans/:id/approve", (req, res) => {
    void proxyToService(EDUCATION_LOANS_SERVICE_URL, `/v1/education-loans/loans/${req.params.id}/approve`, req, res);
  });
  app.all("/api/platform/education-loans/loans/:id/disburse", (req, res) => {
    void proxyToService(EDUCATION_LOANS_SERVICE_URL, `/v1/education-loans/loans/${req.params.id}/disburse`, req, res);
  });
  app.all("/api/platform/education-loans/loans/:id/repay", (req, res) => {
    void proxyToService(EDUCATION_LOANS_SERVICE_URL, `/v1/education-loans/loans/${req.params.id}/repay`, req, res);
  });
  app.all("/api/platform/education-loans/loans/:id/defer", (req, res) => {
    void proxyToService(EDUCATION_LOANS_SERVICE_URL, `/v1/education-loans/loans/${req.params.id}/defer`, req, res);
  });
  app.all("/api/platform/education-loans/loans/:id/schedule", (req, res) => {
    void proxyToService(EDUCATION_LOANS_SERVICE_URL, `/v1/education-loans/loans/${req.params.id}/schedule`, req, res);
  });
  app.all("/api/platform/education-loans/loans/:id/disbursements", (req, res) => {
    void proxyToService(EDUCATION_LOANS_SERVICE_URL, `/v1/education-loans/loans/${req.params.id}/disbursements`, req, res);
  });
  app.all("/api/platform/education-loans/repayments", (req, res) => {
    void proxyToService(EDUCATION_LOANS_SERVICE_URL, "/v1/education-loans/repayments", req, res);
  });

  // Ledger Reconciliation proxy routes (Rust :8100)
  app.all("/api/platform/reconciliation/runs", (req, res) => {
    void proxyToService(LEDGER_RECON_SERVICE_URL, "/v1/reconciliation/runs", req, res);
  });
  app.all("/api/platform/reconciliation/runs/:id", (req, res) => {
    void proxyToService(LEDGER_RECON_SERVICE_URL, `/v1/reconciliation/runs/${req.params.id}`, req, res);
  });
  app.all("/api/platform/reconciliation/discrepancies", (req, res) => {
    void proxyToService(LEDGER_RECON_SERVICE_URL, "/v1/reconciliation/discrepancies", req, res);
  });
  app.all("/api/platform/reconciliation/discrepancies/:id", (req, res) => {
    void proxyToService(LEDGER_RECON_SERVICE_URL, `/v1/reconciliation/discrepancies/${req.params.id}`, req, res);
  });
  app.all("/api/platform/reconciliation/discrepancies/:id/resolve", (req, res) => {
    void proxyToService(LEDGER_RECON_SERVICE_URL, `/v1/reconciliation/discrepancies/${req.params.id}/resolve`, req, res);
  });
  app.all("/api/platform/reconciliation/discrepancies/:id/escalate", (req, res) => {
    void proxyToService(LEDGER_RECON_SERVICE_URL, `/v1/reconciliation/discrepancies/${req.params.id}/escalate`, req, res);
  });
  app.all("/api/platform/reconciliation/gl-assertions", (req, res) => {
    void proxyToService(LEDGER_RECON_SERVICE_URL, "/v1/reconciliation/gl-assertions", req, res);
  });

  // Identity & Channels proxy routes (Go :8101)
  app.all("/api/platform/identity/profiles", (req, res) => {
    void proxyToService(IDENTITY_CHANNELS_SERVICE_URL, "/v1/identity/profiles", req, res);
  });
  app.all("/api/platform/identity/profiles/:id", (req, res) => {
    void proxyToService(IDENTITY_CHANNELS_SERVICE_URL, `/v1/identity/profiles/${req.params.id}`, req, res);
  });
  app.all("/api/platform/identity/profiles/:id/devices", (req, res) => {
    void proxyToService(IDENTITY_CHANNELS_SERVICE_URL, `/v1/identity/profiles/${req.params.id}/devices`, req, res);
  });
  app.all("/api/platform/identity/profiles/:id/enable-mfa", (req, res) => {
    void proxyToService(IDENTITY_CHANNELS_SERVICE_URL, `/v1/identity/profiles/${req.params.id}/enable-mfa`, req, res);
  });
  app.all("/api/platform/identity/profiles/:id/otp", (req, res) => {
    void proxyToService(IDENTITY_CHANNELS_SERVICE_URL, `/v1/identity/profiles/${req.params.id}/otp`, req, res);
  });
  app.all("/api/platform/identity/profiles/:id/verify-otp", (req, res) => {
    void proxyToService(IDENTITY_CHANNELS_SERVICE_URL, `/v1/identity/profiles/${req.params.id}/verify-otp`, req, res);
  });
  app.all("/api/platform/identity/profiles/:id/sessions", (req, res) => {
    void proxyToService(IDENTITY_CHANNELS_SERVICE_URL, `/v1/identity/profiles/${req.params.id}/sessions`, req, res);
  });
  app.all("/api/platform/identity/sessions", (req, res) => {
    void proxyToService(IDENTITY_CHANNELS_SERVICE_URL, "/v1/identity/sessions", req, res);
  });

  // Dispute Management proxy routes (Python :8102)
  app.all("/api/platform/disputes/cases", (req, res) => {
    void proxyToService(DISPUTE_SERVICE_URL, "/v1/disputes/cases", req, res);
  });
  app.all("/api/platform/disputes/cases/:id", (req, res) => {
    void proxyToService(DISPUTE_SERVICE_URL, `/v1/disputes/cases/${req.params.id}`, req, res);
  });
  app.all("/api/platform/disputes/cases/:id/evidence", (req, res) => {
    void proxyToService(DISPUTE_SERVICE_URL, `/v1/disputes/cases/${req.params.id}/evidence`, req, res);
  });
  app.all("/api/platform/disputes/cases/:id/investigate", (req, res) => {
    void proxyToService(DISPUTE_SERVICE_URL, `/v1/disputes/cases/${req.params.id}/investigate`, req, res);
  });
  app.all("/api/platform/disputes/cases/:id/resolve", (req, res) => {
    void proxyToService(DISPUTE_SERVICE_URL, `/v1/disputes/cases/${req.params.id}/resolve`, req, res);
  });
  app.all("/api/platform/disputes/cases/:id/escalate", (req, res) => {
    void proxyToService(DISPUTE_SERVICE_URL, `/v1/disputes/cases/${req.params.id}/escalate`, req, res);
  });
  app.all("/api/platform/disputes/cases/:id/chargeback", (req, res) => {
    void proxyToService(DISPUTE_SERVICE_URL, `/v1/disputes/cases/${req.params.id}/chargeback`, req, res);
  });
  app.all("/api/platform/disputes/categories", (req, res) => {
    void proxyToService(DISPUTE_SERVICE_URL, "/v1/disputes/categories", req, res);
  });

  // ERPNext Sync proxy routes (Python :8103)
  app.all("/api/platform/erpnext/sync-jobs", (req, res) => {
    void proxyToService(ERPNEXT_SYNC_SERVICE_URL, "/v1/erpnext/sync-jobs", req, res);
  });
  app.all("/api/platform/erpnext/sync-jobs/:id", (req, res) => {
    void proxyToService(ERPNEXT_SYNC_SERVICE_URL, `/v1/erpnext/sync-jobs/${req.params.id}`, req, res);
  });
  app.all("/api/platform/erpnext/sync-jobs/:id/execute", (req, res) => {
    void proxyToService(ERPNEXT_SYNC_SERVICE_URL, `/v1/erpnext/sync-jobs/${req.params.id}/execute`, req, res);
  });
  app.all("/api/platform/erpnext/sync-jobs/:id/retry", (req, res) => {
    void proxyToService(ERPNEXT_SYNC_SERVICE_URL, `/v1/erpnext/sync-jobs/${req.params.id}/retry`, req, res);
  });
  app.all("/api/platform/erpnext/journal-entries", (req, res) => {
    void proxyToService(ERPNEXT_SYNC_SERVICE_URL, "/v1/erpnext/journal-entries", req, res);
  });
  app.all("/api/platform/erpnext/coa-mappings", (req, res) => {
    void proxyToService(ERPNEXT_SYNC_SERVICE_URL, "/v1/erpnext/coa-mappings", req, res);
  });
  app.all("/api/platform/erpnext/coa-mappings/:id", (req, res) => {
    void proxyToService(ERPNEXT_SYNC_SERVICE_URL, `/v1/erpnext/coa-mappings/${req.params.id}`, req, res);
  });

  // Regulatory Reporting proxy routes (Python :8104)
  app.all("/api/platform/regulatory/reports", (req, res) => {
    void proxyToService(REGULATORY_SERVICE_URL, "/v1/regulatory/reports", req, res);
  });
  app.all("/api/platform/regulatory/reports/:id", (req, res) => {
    void proxyToService(REGULATORY_SERVICE_URL, `/v1/regulatory/reports/${req.params.id}`, req, res);
  });
  app.all("/api/platform/regulatory/reports/:id/submit", (req, res) => {
    void proxyToService(REGULATORY_SERVICE_URL, `/v1/regulatory/reports/${req.params.id}/submit`, req, res);
  });
  app.all("/api/platform/regulatory/report-types", (req, res) => {
    void proxyToService(REGULATORY_SERVICE_URL, "/v1/regulatory/report-types", req, res);
  });
  app.all("/api/platform/regulatory/str-filings", (req, res) => {
    void proxyToService(REGULATORY_SERVICE_URL, "/v1/regulatory/str-filings", req, res);
  });
  app.all("/api/platform/regulatory/ctr-filings", (req, res) => {
    void proxyToService(REGULATORY_SERVICE_URL, "/v1/regulatory/ctr-filings", req, res);
  });
  app.all("/api/platform/regulatory/capital-adequacy", (req, res) => {
    void proxyToService(REGULATORY_SERVICE_URL, "/v1/regulatory/capital-adequacy", req, res);
  });
  app.all("/api/platform/regulatory/liquidity-ratio", (req, res) => {
    void proxyToService(REGULATORY_SERVICE_URL, "/v1/regulatory/liquidity-ratio", req, res);
  });
  app.all("/api/platform/regulatory/ecl-provision", (req, res) => {
    void proxyToService(REGULATORY_SERVICE_URL, "/v1/regulatory/ecl-provision", req, res);
  });

  // Security Gateway proxy routes
  app.all("/api/platform/security/evaluate", (req, res) => {
    void proxyToService(SECURITY_GATEWAY_URL, "/v1/security/evaluate", req, res);
  });
  app.all("/api/platform/security/policies", (req, res) => {
    void proxyToService(SECURITY_GATEWAY_URL, "/v1/security/policies", req, res);
  });
  app.all("/api/platform/security/roles", (req, res) => {
    void proxyToService(SECURITY_GATEWAY_URL, "/v1/security/roles", req, res);
  });
  app.all("/api/platform/security/role-bindings", (req, res) => {
    void proxyToService(SECURITY_GATEWAY_URL, "/v1/security/role-bindings", req, res);
  });
  app.all("/api/platform/security/vulnerability-scan", (req, res) => {
    void proxyToService(SECURITY_GATEWAY_URL, "/v1/security/vulnerability-scan", req, res);
  });
  app.all("/api/platform/security/traffic-stats", (req, res) => {
    void proxyToService(SECURITY_GATEWAY_URL, "/v1/security/traffic-stats", req, res);
  });
  app.all("/api/platform/security/events", (req, res) => {
    void proxyToService(SECURITY_GATEWAY_URL, "/v1/security/events", req, res);
  });
  app.all("/api/platform/security/config", (req, res) => {
    void proxyToService(SECURITY_GATEWAY_URL, "/v1/security/config", req, res);
  });

  // Resilience Service proxy routes
  app.all("/api/platform/resilience/queue", (req, res) => {
    void proxyToService(RESILIENCE_SERVICE_URL, "/v1/resilience/queue", req, res);
  });
  app.all("/api/platform/resilience/queue/process", (req, res) => {
    void proxyToService(RESILIENCE_SERVICE_URL, "/v1/resilience/queue/process", req, res);
  });
  app.all("/api/platform/resilience/queue/stats", (req, res) => {
    void proxyToService(RESILIENCE_SERVICE_URL, "/v1/resilience/queue/stats", req, res);
  });
  app.all("/api/platform/resilience/sync", (req, res) => {
    void proxyToService(RESILIENCE_SERVICE_URL, "/v1/resilience/sync", req, res);
  });
  app.all("/api/platform/resilience/conflicts/resolve", (req, res) => {
    void proxyToService(RESILIENCE_SERVICE_URL, "/v1/resilience/conflicts/resolve", req, res);
  });
  app.all("/api/platform/resilience/config", (req, res) => {
    void proxyToService(RESILIENCE_SERVICE_URL, "/v1/resilience/config", req, res);
  });

  // Payments Hub proxy routes (Go :8107)
  app.all("/api/platform/payments/nip", (req, res) => {
    void proxyToService(PAYMENTS_HUB_URL, "/v1/payments/nip", req, res);
  });
  app.all("/api/platform/payments/ussd", (req, res) => {
    void proxyToService(PAYMENTS_HUB_URL, "/v1/payments/ussd", req, res);
  });
  app.all("/api/platform/payments/qr/merchants", (req, res) => {
    void proxyToService(PAYMENTS_HUB_URL, "/v1/payments/qr/merchants", req, res);
  });
  app.all("/api/platform/payments/qr/pay", (req, res) => {
    void proxyToService(PAYMENTS_HUB_URL, "/v1/payments/qr/pay", req, res);
  });
  app.all("/api/platform/payments/billers", (req, res) => {
    void proxyToService(PAYMENTS_HUB_URL, "/v1/payments/billers", req, res);
  });
  app.all("/api/platform/payments/bill-pay", (req, res) => {
    void proxyToService(PAYMENTS_HUB_URL, "/v1/payments/bill-pay", req, res);
  });
  app.all("/api/platform/payments/remittance", (req, res) => {
    void proxyToService(PAYMENTS_HUB_URL, "/v1/payments/remittance", req, res);
  });
  app.all("/api/platform/payments", (req, res) => {
    void proxyToService(PAYMENTS_HUB_URL, "/v1/payments", req, res);
  });

  // Savings Products proxy routes (Go :8108)
  app.all("/api/platform/savings/accounts", (req, res) => {
    void proxyToService(SAVINGS_PRODUCTS_URL, "/v1/savings/accounts", req, res);
  });
  app.all("/api/platform/savings/deposit", (req, res) => {
    void proxyToService(SAVINGS_PRODUCTS_URL, "/v1/savings/deposit", req, res);
  });
  app.all("/api/platform/savings/withdraw", (req, res) => {
    void proxyToService(SAVINGS_PRODUCTS_URL, "/v1/savings/withdraw", req, res);
  });
  app.all("/api/platform/savings/interest/calculate", (req, res) => {
    void proxyToService(SAVINGS_PRODUCTS_URL, "/v1/savings/interest/calculate", req, res);
  });
  app.all("/api/platform/savings/transactions", (req, res) => {
    void proxyToService(SAVINGS_PRODUCTS_URL, "/v1/savings/transactions", req, res);
  });

  // Card Management proxy routes (Go :8109)
  app.all("/api/platform/cards", (req, res) => {
    void proxyToService(CARD_MANAGEMENT_URL, "/v1/cards", req, res);
  });
  app.all("/api/platform/cards/virtual", (req, res) => {
    void proxyToService(CARD_MANAGEMENT_URL, "/v1/cards/virtual", req, res);
  });
  app.all("/api/platform/cards/pin", (req, res) => {
    void proxyToService(CARD_MANAGEMENT_URL, "/v1/cards/pin", req, res);
  });
  app.all("/api/platform/cards/limits", (req, res) => {
    void proxyToService(CARD_MANAGEMENT_URL, "/v1/cards/limits", req, res);
  });
  app.all("/api/platform/cards/controls", (req, res) => {
    void proxyToService(CARD_MANAGEMENT_URL, "/v1/cards/controls", req, res);
  });
  app.all("/api/platform/cards/tokenize", (req, res) => {
    void proxyToService(CARD_MANAGEMENT_URL, "/v1/cards/tokenize", req, res);
  });
  app.all("/api/platform/cards/authorize", (req, res) => {
    void proxyToService(CARD_MANAGEMENT_URL, "/v1/cards/authorize", req, res);
  });
  app.all("/api/platform/cards/transactions", (req, res) => {
    void proxyToService(CARD_MANAGEMENT_URL, "/v1/cards/transactions", req, res);
  });

  // Treasury & Liquidity proxy routes (Python :8110)
  app.all("/api/platform/treasury/forecasts", (req, res) => {
    void proxyToService(TREASURY_LIQUIDITY_URL, "/v1/treasury/forecasts", req, res);
  });
  app.all("/api/platform/treasury/placements", (req, res) => {
    void proxyToService(TREASURY_LIQUIDITY_URL, "/v1/treasury/placements", req, res);
  });
  app.all("/api/platform/treasury/fx/rates", (req, res) => {
    void proxyToService(TREASURY_LIQUIDITY_URL, "/v1/treasury/fx/rates", req, res);
  });
  app.all("/api/platform/treasury/fx/deals", (req, res) => {
    void proxyToService(TREASURY_LIQUIDITY_URL, "/v1/treasury/fx/deals", req, res);
  });
  app.all("/api/platform/treasury/investments", (req, res) => {
    void proxyToService(TREASURY_LIQUIDITY_URL, "/v1/treasury/investments", req, res);
  });
  app.all("/api/platform/treasury/alm", (req, res) => {
    void proxyToService(TREASURY_LIQUIDITY_URL, "/v1/treasury/alm", req, res);
  });

  // Customer Engagement proxy routes (Python :8111)
  app.all("/api/platform/engagement/messages", (req, res) => {
    void proxyToService(CUSTOMER_ENGAGEMENT_URL, "/v1/engagement/messages", req, res);
  });
  app.all("/api/platform/engagement/messages/bulk", (req, res) => {
    void proxyToService(CUSTOMER_ENGAGEMENT_URL, "/v1/engagement/messages/bulk", req, res);
  });
  app.all("/api/platform/engagement/recommendations/:customerId", (req, res) => {
    void proxyToService(CUSTOMER_ENGAGEMENT_URL, `/v1/engagement/recommendations/${req.params.customerId}`, req, res);
  });
  app.all("/api/platform/engagement/customer360/:customerId", (req, res) => {
    void proxyToService(CUSTOMER_ENGAGEMENT_URL, `/v1/engagement/customer360/${req.params.customerId}`, req, res);
  });
  app.all("/api/platform/engagement/surveys", (req, res) => {
    void proxyToService(CUSTOMER_ENGAGEMENT_URL, "/v1/engagement/surveys", req, res);
  });
  app.all("/api/platform/engagement/surveys/analytics", (req, res) => {
    void proxyToService(CUSTOMER_ENGAGEMENT_URL, "/v1/engagement/surveys/analytics", req, res);
  });
  app.all("/api/platform/engagement/referrals", (req, res) => {
    void proxyToService(CUSTOMER_ENGAGEMENT_URL, "/v1/engagement/referrals", req, res);
  });
  app.all("/api/platform/engagement/referrals/:id/convert", (req, res) => {
    void proxyToService(CUSTOMER_ENGAGEMENT_URL, `/v1/engagement/referrals/${req.params.id}/convert`, req, res);
  });

  // Fraud Detection proxy routes (Rust :8112)
  app.all("/api/platform/fraud/screen", (req, res) => {
    void proxyToService(FRAUD_DETECTION_URL, "/v1/fraud/screen", req, res);
  });
  app.all("/api/platform/fraud/screenings", (req, res) => {
    void proxyToService(FRAUD_DETECTION_URL, "/v1/fraud/screenings", req, res);
  });
  app.all("/api/platform/fraud/watchlist", (req, res) => {
    void proxyToService(FRAUD_DETECTION_URL, "/v1/fraud/watchlist", req, res);
  });
  app.all("/api/platform/fraud/profiles/:customerId", (req, res) => {
    void proxyToService(FRAUD_DETECTION_URL, `/v1/fraud/profiles/${req.params.customerId}`, req, res);
  });

  // B1: Teller Operations enhanced routes
  app.all("/api/platform/teller/reconciliation", (req, res) => {
    void proxyToService(TELLER_SERVICE_URL, "/v1/teller/reconciliation", req, res);
  });
  app.all("/api/platform/teller/reversals", (req, res) => {
    void proxyToService(TELLER_SERVICE_URL, "/v1/teller/reversals", req, res);
  });
  app.all("/api/platform/teller/queue", (req, res) => {
    void proxyToService(TELLER_SERVICE_URL, "/v1/teller/queue", req, res);
  });
  app.all("/api/platform/teller/till-limits", (req, res) => {
    void proxyToService(TELLER_SERVICE_URL, "/v1/teller/till-limits", req, res);
  });
  app.all("/api/platform/teller/receipts", (req, res) => {
    void proxyToService(TELLER_SERVICE_URL, "/v1/teller/receipts", req, res);
  });

  // B2: Islamic Banking enhanced routes
  app.all("/api/platform/islamic/sukuk", (req, res) => {
    void proxyToService(ISLAMIC_BANKING_SERVICE_URL, "/v1/islamic/sukuk", req, res);
  });
  app.all("/api/platform/islamic/takaful", (req, res) => {
    void proxyToService(ISLAMIC_BANKING_SERVICE_URL, "/v1/islamic/takaful", req, res);
  });
  app.all("/api/platform/islamic/wakala", (req, res) => {
    void proxyToService(ISLAMIC_BANKING_SERVICE_URL, "/v1/islamic/wakala", req, res);
  });
  app.all("/api/platform/islamic/istisna", (req, res) => {
    void proxyToService(ISLAMIC_BANKING_SERVICE_URL, "/v1/islamic/istisna", req, res);
  });
  app.all("/api/platform/islamic/sharia-review", (req, res) => {
    void proxyToService(ISLAMIC_BANKING_SERVICE_URL, "/v1/islamic/sharia-review", req, res);
  });

  app.use(globalErrorHandler);

  const staticPath = process.env.NODE_ENV === "production" ? path.resolve(__dirname, "public") : path.resolve(__dirname, "..", "dist", "public");

  app.use(
    express.static(staticPath, {
      etag: true,
      maxAge: staticAssetCacheSeconds * 1000,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith("index.html")) {
          res.setHeader("Cache-Control", "no-store");
          return;
        }
        res.setHeader("Cache-Control", `public, max-age=${staticAssetCacheSeconds}, immutable`);
      },
    }),
  );

  app.get("*", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.sendFile(path.join(staticPath, "index.html"));
  });

  const port = process.env.PORT || 3000;
  let shuttingDown = false;

  const shutdown = async (signal: string) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    logger.info(`Received ${signal}; draining connections before shutdown.`);

    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });

    await closeDbPool();
    process.exit(0);
  };

  process.once("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
  process.once("SIGINT", () => {
    void shutdown("SIGINT");
  });

  server.listen(port, () => {
    logger.info(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch((error) => logger.error("Server startup failed", { error: String(error) }));
