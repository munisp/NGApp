import {
  doublePrecision,
  integer,
  jsonb,
  index,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: text("role").default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const tenants = pgTable("tenants", {
  id: serial("id").primaryKey(),
  tenantId: varchar("tenantId", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 191 }).notNull(),
  onboardingStatus: text("onboardingStatus").notNull(),
  segment: text("segment").notNull(),
  region: varchar("region", { length: 96 }).notNull(),
  enabledModules: jsonb("enabledModules").$type<string[]>().notNull(),
  whiteLabel: jsonb("whiteLabel")
    .$type<{
      displayName: string;
      legalEntity: string;
      supportEmail: string;
      primaryColor: string;
      accentColor: string;
      logoUrl: string;
      loginHeadline: string;
      customDomain?: string;
    }>()
    .notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const tenantFeatureFlags = pgTable("tenantFeatureFlags", {
  id: serial("id").primaryKey(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  featureKey: varchar("featureKey", { length: 96 }).notNull(),
  label: varchar("label", { length: 191 }).notNull(),
  category: text("category").notNull(),
  description: text("description").notNull(),
  enabled: integer("enabled").default(0).notNull(),
  rolloutStage: text("rolloutStage").notNull(),
  adminManaged: integer("adminManaged").default(1).notNull(),
  dependsOn: jsonb("dependsOn").$type<string[]>().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  tenantFeatureLookupIdx: uniqueIndex("tenant_feature_lookup_idx").on(table.tenantId, table.featureKey),
  tenantFeatureCategoryIdx: index("tenant_feature_category_idx").on(table.tenantId, table.category, table.enabled),
}));

export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  customerId: varchar("customerId", { length: 64 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  name: varchar("name", { length: 191 }).notNull(),
  segment: varchar("segment", { length: 96 }).notNull(),
  tier: varchar("tier", { length: 64 }).notNull(),
  location: varchar("location", { length: 128 }).notNull(),
  relationshipManager: varchar("relationshipManager", { length: 128 }).notNull(),
  risk: varchar("risk", { length: 64 }).notNull(),
  status: text("status").notNull(),
  bvn: varchar("bvn", { length: 32 }).notNull(),
  phone: varchar("phone", { length: 32 }).notNull(),
  balance: doublePrecision("balance").default(0).notNull(),
  lastTouchpointLabel: varchar("lastTouchpointLabel", { length: 128 }).notNull(),
  lastTouchpointAt: timestamp("lastTouchpointAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  customerTenantStatusIdx: index("customer_tenant_status_idx").on(table.tenantId, table.status, table.segment),
  customerManagerTouchpointIdx: index("customer_manager_touchpoint_idx").on(table.relationshipManager, table.lastTouchpointAt),
  customerBvnIdx: uniqueIndex("customer_bvn_idx").on(table.bvn),
}));

export const customerCards = pgTable("customerCards", {
  id: serial("id").primaryKey(),
  cardId: varchar("cardId", { length: 64 }).notNull().unique(),
  customerId: varchar("customerId", { length: 64 }).notNull(),
  cardType: text("cardType").notNull(),
  brand: text("brand").notNull(),
  lastFour: varchar("lastFour", { length: 4 }).notNull(),
  expiryDate: varchar("expiryDate", { length: 16 }).notNull(),
  cardHolder: varchar("cardHolder", { length: 191 }).notNull(),
  balance: doublePrecision("balance").default(0).notNull(),
  isLocked: integer("isLocked").default(0).notNull(),
  controls: jsonb("controls").$type<{ online: boolean; atm: boolean; international: boolean }>().notNull(),
  spendingLimits: jsonb("spendingLimits").$type<{ daily: number; atm: number; online: number }>().notNull(),
  colorTone: text("colorTone").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const customerCardEvents = pgTable("customerCardEvents", {
  id: serial("id").primaryKey(),
  eventId: varchar("eventId", { length: 64 }).notNull().unique(),
  cardId: varchar("cardId", { length: 64 }).notNull(),
  customerId: varchar("customerId", { length: 64 }).notNull(),
  title: varchar("title", { length: 191 }).notNull(),
  detail: text("detail").notNull(),
  severity: text("severity").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const customerSavedBillers = pgTable("customerSavedBillers", {
  id: serial("id").primaryKey(),
  billerRecordId: varchar("billerRecordId", { length: 64 }).notNull().unique(),
  customerId: varchar("customerId", { length: 64 }).notNull(),
  category: text("category").notNull(),
  provider: varchar("provider", { length: 191 }).notNull(),
  billerId: varchar("billerId", { length: 96 }).notNull(),
  customerReference: varchar("customerReference", { length: 128 }).notNull(),
  nickname: varchar("nickname", { length: 128 }).notNull(),
  lastAmount: doublePrecision("lastAmount").default(0).notNull(),
  verifiedName: varchar("verifiedName", { length: 191 }),
  lastPaidAt: timestamp("lastPaidAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const customerBillPayments = pgTable("customerBillPayments", {
  id: serial("id").primaryKey(),
  paymentId: varchar("paymentId", { length: 64 }).notNull().unique(),
  customerId: varchar("customerId", { length: 64 }).notNull(),
  category: text("category").notNull(),
  provider: varchar("provider", { length: 191 }).notNull(),
  amount: doublePrecision("amount").default(0).notNull(),
  status: text("status").notNull(),
  paidAt: timestamp("paidAt").defaultNow().notNull(),
  reference: varchar("reference", { length: 128 }).notNull(),
  billerId: varchar("billerId", { length: 96 }),
  customerReference: varchar("customerReference", { length: 128 }),
  customerName: varchar("customerName", { length: 191 }),
  scheduledFor: timestamp("scheduledFor"),
  evidenceStatus: text("evidenceStatus"),
  channel: text("channel"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const customerTransfers = pgTable("customerTransfers", {
  id: serial("id").primaryKey(),
  transferId: varchar("transferId", { length: 64 }).notNull().unique(),
  customerId: varchar("customerId", { length: 64 }).notNull(),
  beneficiaryId: varchar("beneficiaryId", { length: 64 }),
  beneficiaryName: varchar("beneficiaryName", { length: 191 }).notNull(),
  amount: doublePrecision("amount").default(0).notNull(),
  narration: text("narration"),
  transferType: text("transferType").notNull(),
  status: text("status").notNull(),
  bankCode: varchar("bankCode", { length: 32 }),
  bankName: varchar("bankName", { length: 96 }),
  accountNumber: varchar("accountNumber", { length: 32 }),
  accountName: varchar("accountName", { length: 191 }),
  workflowId: varchar("workflowId", { length: 64 }),
  otpReference: varchar("otpReference", { length: 64 }),
  otpIssuedAt: timestamp("otpIssuedAt"),
  confirmedAt: timestamp("confirmedAt"),
  approvalState: text("approvalState"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  transferCustomerStatusIdx: index("transfer_customer_status_idx").on(table.customerId, table.status, table.createdAt),
  transferApprovalIdx: index("transfer_approval_idx").on(table.customerId, table.approvalState, table.updatedAt),
  transferOtpIdx: index("transfer_otp_idx").on(table.otpReference, table.status),
}));

export const customerApprovals = pgTable("customerApprovals", {
  id: serial("id").primaryKey(),
  approvalId: varchar("approvalId", { length: 64 }).notNull().unique(),
  customerId: varchar("customerId", { length: 64 }).notNull(),
  entityType: text("entityType").notNull(),
  entityId: varchar("entityId", { length: 64 }).notNull(),
  title: varchar("title", { length: 191 }).notNull(),
  detail: text("detail").notNull(),
  route: varchar("route", { length: 191 }).notNull(),
  state: text("state").notNull(),
  requestedAt: timestamp("requestedAt").defaultNow().notNull(),
  requestedByRole: varchar("requestedByRole", { length: 64 }).notNull(),
  requestedById: varchar("requestedById", { length: 96 }).notNull(),
  approvalRole: varchar("approvalRole", { length: 64 }).notNull(),
  resolvedAt: timestamp("resolvedAt"),
  resolutionNote: text("resolutionNote"),
}, (table) => ({
  approvalCustomerStateIdx: index("approval_customer_state_idx").on(table.customerId, table.state, table.requestedAt),
  approvalRoleStateIdx: index("approval_role_state_idx").on(table.approvalRole, table.state, table.requestedAt),
}));

export const customerStatementExports = pgTable("customerStatementExports", {
  id: serial("id").primaryKey(),
  exportRequestId: varchar("exportRequestId", { length: 64 }).notNull().unique(),
  customerId: varchar("customerId", { length: 64 }).notNull(),
  exportJobId: varchar("exportJobId", { length: 64 }).notNull(),
  format: text("format").notNull(),
  rowCount: integer("rowCount").default(0).notNull(),
  title: varchar("title", { length: 191 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const customerStatements = pgTable("customerStatements", {
  id: serial("id").primaryKey(),
  statementId: varchar("statementId", { length: 64 }).notNull().unique(),
  customerId: varchar("customerId", { length: 64 }).notNull(),
  title: varchar("title", { length: 191 }).notNull(),
  detail: text("detail").notNull(),
  amount: doublePrecision("amount").default(0).notNull(),
  direction: text("direction").notNull(),
  statementType: text("statementType").notNull(),
  status: text("status").notNull(),
  occurredAt: timestamp("occurredAt").defaultNow().notNull(),
  reference: varchar("reference", { length: 128 }),
  category: varchar("category", { length: 96 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  statementCustomerOccurredIdx: index("statement_customer_occurred_idx").on(table.customerId, table.occurredAt),
  statementCustomerTypeIdx: index("statement_customer_type_idx").on(table.customerId, table.statementType, table.status),
}));

export const customerNotifications = pgTable("customerNotifications", {
  id: serial("id").primaryKey(),
  notificationId: varchar("notificationId", { length: 64 }).notNull().unique(),
  customerId: varchar("customerId", { length: 64 }).notNull(),
  title: varchar("title", { length: 191 }).notNull(),
  message: text("message").notNull(),
  notificationType: text("notificationType").notNull(),
  isRead: integer("isRead").default(0).notNull(),
  actionUrl: varchar("actionUrl", { length: 191 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  notificationCustomerReadIdx: index("notification_customer_read_idx").on(table.customerId, table.isRead, table.createdAt),
}));

export const customerSessionPreferences = pgTable("customerSessionPreferences", {
  id: serial("id").primaryKey(),
  actorId: varchar("actorId", { length: 96 }).notNull(),
  actorRole: varchar("actorRole", { length: 64 }).notNull(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  activeCustomerId: varchar("activeCustomerId", { length: 64 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  sessionActorLookupIdx: uniqueIndex("session_actor_lookup_idx").on(table.actorId, table.actorRole, table.tenantId),
}));

export const workflowCases = pgTable("workflowCases", {
  id: serial("id").primaryKey(),
  workflowId: varchar("workflowId", { length: 64 }).notNull().unique(),
  customer: varchar("customer", { length: 191 }).notNull(),
  product: varchar("product", { length: 128 }).notNull(),
  stage: varchar("stage", { length: 128 }).notNull(),
  status: varchar("status", { length: 64 }).notNull(),
  channel: varchar("channel", { length: 96 }).notNull(),
  amount: doublePrecision("amount").default(0).notNull(),
  nextAction: text("nextAction").notNull(),
  slaHours: integer("slaHours").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  workflowStageStatusIdx: index("workflow_stage_status_idx").on(table.stage, table.status, table.updatedAt),
  workflowProductStatusIdx: index("workflow_product_status_idx").on(table.product, table.status, table.createdAt),
}));

export const operatorActions = pgTable("operatorActions", {
  id: serial("id").primaryKey(),
  actionId: varchar("actionId", { length: 64 }).notNull().unique(),
  domainKey: varchar("domainKey", { length: 96 }).notNull(),
  title: varchar("title", { length: 191 }).notNull(),
  detail: text("detail").notNull(),
  owner: varchar("owner", { length: 128 }).notNull(),
  dueAt: timestamp("dueAt").notNull(),
  route: varchar("route", { length: 191 }).notNull(),
  status: text("status").notNull(),
  roles: jsonb("roles").$type<string[]>().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  operatorDomainStatusIdx: index("operator_domain_status_idx").on(table.domainKey, table.status, table.dueAt),
  operatorRouteStatusIdx: index("operator_route_status_idx").on(table.route, table.status, table.dueAt),
}));

export const auditEntries = pgTable("auditEntries", {
  id: serial("id").primaryKey(),
  auditId: varchar("auditId", { length: 64 }).notNull().unique(),
  timestampAt: timestamp("timestampAt").defaultNow().notNull(),
  actorRole: varchar("actorRole", { length: 64 }).notNull(),
  actorId: varchar("actorId", { length: 96 }).notNull(),
  entityType: varchar("entityType", { length: 96 }).notNull(),
  entityId: varchar("entityId", { length: 96 }).notNull(),
  action: varchar("action", { length: 96 }).notNull(),
  outcome: text("outcome").notNull(),
  severity: text("severity").notNull(),
  route: varchar("route", { length: 191 }).notNull(),
  middleware: jsonb("middleware").$type<string[]>().notNull(),
  detail: text("detail").notNull(),
}, (table) => ({
  auditRouteTimestampIdx: index("audit_route_timestamp_idx").on(table.route, table.timestampAt),
  auditSeverityTimestampIdx: index("audit_severity_timestamp_idx").on(table.severity, table.timestampAt),
}));

export const exportJobs = pgTable("exportJobs", {
  id: serial("id").primaryKey(),
  exportJobId: varchar("exportJobId", { length: 64 }).notNull().unique(),
  domainKey: varchar("domainKey", { length: 96 }).notNull(),
  title: varchar("title", { length: 191 }).notNull(),
  format: text("format").notNull(),
  status: text("status").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  requestedByRole: varchar("requestedByRole", { length: 64 }).notNull(),
  route: varchar("route", { length: 191 }).notNull(),
  rowCount: integer("rowCount").default(0).notNull(),
  approvalState: text("approvalState").notNull(),
  approvalSignature: varchar("approvalSignature", { length: 191 }).notNull(),
  downloadUrl: varchar("downloadUrl", { length: 255 }).notNull(),
  retainedUntil: timestamp("retainedUntil"),
  reportVersion: varchar("reportVersion", { length: 96 }),
  approvalChain: jsonb("approvalChain").$type<string[]>().notNull(),
  signedBy: jsonb("signedBy").$type<string[]>().notNull(),
}, (table) => ({
  exportDomainApprovalIdx: index("export_domain_approval_idx").on(table.domainKey, table.approvalState, table.createdAt),
  exportRouteStatusIdx: index("export_route_status_idx").on(table.route, table.status, table.createdAt),
}));

export const billingAccounts = pgTable("billingAccounts", {
  id: serial("id").primaryKey(),
  billingAccountId: varchar("billingAccountId", { length: 64 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  accountName: varchar("accountName", { length: 191 }).notNull(),
  billingModel: text("billingModel").notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  status: text("status").notNull(),
  contractStartAt: timestamp("contractStartAt").notNull(),
  contractEndAt: timestamp("contractEndAt"),
  defaultRateCardId: varchar("defaultRateCardId", { length: 64 }).notNull(),
  minimumCommitAmount: doublePrecision("minimumCommitAmount").default(0).notNull(),
  defaultBillingPeriodType: text("defaultBillingPeriodType").default("monthly").notNull(),
  invoiceDueDays: integer("invoiceDueDays").default(14).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  billingAccountTenantIdx: index("billing_account_tenant_idx").on(table.tenantId, table.status),
}));

export const billingRateCards = pgTable("billingRateCards", {
  id: serial("id").primaryKey(),
  rateCardId: varchar("rateCardId", { length: 64 }).notNull().unique(),
  billingAccountId: varchar("billingAccountId", { length: 64 }),
  name: varchar("name", { length: 191 }).notNull(),
  version: integer("version").default(1).notNull(),
  status: text("status").notNull(),
  effectiveFrom: timestamp("effectiveFrom").notNull(),
  effectiveTo: timestamp("effectiveTo"),
  pricingCurrency: varchar("pricingCurrency", { length: 3 }).notNull(),
  createdBy: varchar("createdBy", { length: 96 }).notNull(),
  approvalState: text("approvalState").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  billingRateCardLookupIdx: index("billing_rate_card_lookup_idx").on(table.billingAccountId, table.status, table.effectiveFrom),
}));

export const billingRateCardLines = pgTable("billingRateCardLines", {
  id: serial("id").primaryKey(),
  rateCardLineId: varchar("rateCardLineId", { length: 64 }).notNull().unique(),
  rateCardId: varchar("rateCardId", { length: 64 }).notNull(),
  meterKey: varchar("meterKey", { length: 96 }).notNull(),
  productKey: varchar("productKey", { length: 96 }).notNull(),
  chargeType: text("chargeType").notNull(),
  unitPrice: doublePrecision("unitPrice").default(0).notNull(),
  includedUnits: integer("includedUnits").default(0).notNull(),
  tierStart: integer("tierStart"),
  tierEnd: integer("tierEnd"),
  minimumCharge: doublePrecision("minimumCharge"),
  maximumCharge: doublePrecision("maximumCharge"),
  pricingFormula: jsonb("pricingFormula").$type<Record<string, unknown>>(),
  settlementLedgerCode: varchar("settlementLedgerCode", { length: 96 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  billingRateCardLineLookupIdx: index("billing_rate_card_line_lookup_idx").on(table.rateCardId, table.meterKey, table.productKey),
}));

export const billingUsageEvents = pgTable("billingUsageEvents", {
  id: serial("id").primaryKey(),
  usageEventId: varchar("usageEventId", { length: 64 }).notNull().unique(),
  idempotencyKey: varchar("idempotencyKey", { length: 128 }).notNull(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  billingAccountId: varchar("billingAccountId", { length: 64 }).notNull(),
  sourceService: varchar("sourceService", { length: 96 }).notNull(),
  sourceEventType: varchar("sourceEventType", { length: 96 }).notNull(),
  meterKey: varchar("meterKey", { length: 96 }).notNull(),
  productKey: varchar("productKey", { length: 96 }).notNull(),
  quantity: integer("quantity").default(0).notNull(),
  unitAmount: doublePrecision("unitAmount"),
  currency: varchar("currency", { length: 3 }).notNull(),
  eventTimestamp: timestamp("eventTimestamp").notNull(),
  ingestedAt: timestamp("ingestedAt").defaultNow().notNull(),
  correlationId: varchar("correlationId", { length: 128 }),
  actorId: varchar("actorId", { length: 96 }),
  resourceId: varchar("resourceId", { length: 96 }),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  status: text("status").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  billingUsageTenantIdx: index("billing_usage_tenant_idx").on(table.tenantId, table.eventTimestamp),
  billingUsageMeterIdx: index("billing_usage_meter_idx").on(table.meterKey, table.productKey, table.eventTimestamp),
  billingUsageIdempotencyIdx: uniqueIndex("billing_usage_idempotency_idx").on(table.idempotencyKey),
}));

export const billingRatedEvents = pgTable("billingRatedEvents", {
  id: serial("id").primaryKey(),
  ratedEventId: varchar("ratedEventId", { length: 64 }).notNull().unique(),
  usageEventId: varchar("usageEventId", { length: 64 }).notNull(),
  rateCardId: varchar("rateCardId", { length: 64 }).notNull(),
  rateCardLineId: varchar("rateCardLineId", { length: 64 }).notNull(),
  billingPeriodKey: varchar("billingPeriodKey", { length: 32 }).notNull(),
  quantityRated: integer("quantityRated").default(0).notNull(),
  billableUnits: doublePrecision("billableUnits").default(0).notNull(),
  amountAccrued: doublePrecision("amountAccrued").default(0).notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  ratingExplanation: jsonb("ratingExplanation").$type<Record<string, unknown>>().notNull(),
  ratedAt: timestamp("ratedAt").defaultNow().notNull(),
}, (table) => ({
  billingRatedEventLookupIdx: index("billing_rated_event_lookup_idx").on(table.billingPeriodKey, table.rateCardId, table.ratedAt),
}));

export const billingAccrualSnapshots = pgTable("billingAccrualSnapshots", {
  id: serial("id").primaryKey(),
  accrualSnapshotId: varchar("accrualSnapshotId", { length: 64 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  billingAccountId: varchar("billingAccountId", { length: 64 }).notNull(),
  billingPeriodKey: varchar("billingPeriodKey", { length: 32 }).notNull(),
  meterKey: varchar("meterKey", { length: 96 }).notNull(),
  productKey: varchar("productKey", { length: 96 }).notNull(),
  ratedEventCount: integer("ratedEventCount").default(0).notNull(),
  usageQuantity: integer("usageQuantity").default(0).notNull(),
  accruedAmount: doublePrecision("accruedAmount").default(0).notNull(),
  unratedEventCount: integer("unratedEventCount").default(0).notNull(),
  lastUsageAt: timestamp("lastUsageAt"),
  lastRatedAt: timestamp("lastRatedAt"),
  snapshotStatus: text("snapshotStatus").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  billingAccrualTenantIdx: index("billing_accrual_tenant_idx").on(table.tenantId, table.billingPeriodKey, table.accruedAmount),
  billingAccrualMeterIdx: index("billing_accrual_meter_idx").on(table.meterKey, table.productKey, table.billingPeriodKey),
}));

export const billingContractOverrides = pgTable("billingContractOverrides", {
  id: serial("id").primaryKey(),
  contractOverrideId: varchar("contractOverrideId", { length: 64 }).notNull().unique(),
  billingAccountId: varchar("billingAccountId", { length: 64 }).notNull(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  overrideType: text("overrideType").notNull(),
  meterKey: varchar("meterKey", { length: 96 }),
  productKey: varchar("productKey", { length: 96 }),
  valueNumber: doublePrecision("valueNumber"),
  valueText: varchar("valueText", { length: 96 }),
  effectiveFrom: timestamp("effectiveFrom").notNull(),
  effectiveTo: timestamp("effectiveTo"),
  status: text("status").notNull(),
  createdBy: varchar("createdBy", { length: 96 }).notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  billingContractOverrideLookupIdx: index("billing_contract_override_lookup_idx").on(table.billingAccountId, table.overrideType, table.status, table.effectiveFrom),
}));

export const billingDiscountRules = pgTable("billingDiscountRules", {
  id: serial("id").primaryKey(),
  discountRuleId: varchar("discountRuleId", { length: 64 }).notNull().unique(),
  billingAccountId: varchar("billingAccountId", { length: 64 }).notNull(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  name: varchar("name", { length: 191 }).notNull(),
  discountType: text("discountType").notNull(),
  meterKey: varchar("meterKey", { length: 96 }),
  productKey: varchar("productKey", { length: 96 }),
  percentage: doublePrecision("percentage"),
  fixedAmount: doublePrecision("fixedAmount"),
  thresholdAmount: doublePrecision("thresholdAmount"),
  effectiveFrom: timestamp("effectiveFrom").notNull(),
  effectiveTo: timestamp("effectiveTo"),
  status: text("status").notNull(),
  createdBy: varchar("createdBy", { length: 96 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  billingDiscountRuleLookupIdx: index("billing_discount_rule_lookup_idx").on(table.billingAccountId, table.status, table.effectiveFrom),
}));

export const billingRevenueShareRules = pgTable("billingRevenueShareRules", {
  id: serial("id").primaryKey(),
  revenueShareRuleId: varchar("revenueShareRuleId", { length: 64 }).notNull().unique(),
  billingAccountId: varchar("billingAccountId", { length: 64 }).notNull(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  name: varchar("name", { length: 191 }).notNull(),
  target: text("target").notNull(),
  percentage: doublePrecision("percentage").default(0).notNull(),
  beneficiaryName: varchar("beneficiaryName", { length: 191 }).notNull(),
  settlementLedgerCode: varchar("settlementLedgerCode", { length: 96 }),
  effectiveFrom: timestamp("effectiveFrom").notNull(),
  effectiveTo: timestamp("effectiveTo"),
  status: text("status").notNull(),
  createdBy: varchar("createdBy", { length: 96 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  billingRevenueShareLookupIdx: index("billing_revenue_share_lookup_idx").on(table.billingAccountId, table.status, table.effectiveFrom),
}));

export const billingInvoices = pgTable("billingInvoices", {
  id: serial("id").primaryKey(),
  billingInvoiceId: varchar("billingInvoiceId", { length: 64 }).notNull().unique(),
  invoiceNumber: varchar("invoiceNumber", { length: 96 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  billingAccountId: varchar("billingAccountId", { length: 64 }).notNull(),
  billingPeriodKey: varchar("billingPeriodKey", { length: 32 }).notNull(),
  billingPeriodType: text("billingPeriodType").notNull(),
  periodStartAt: timestamp("periodStartAt").notNull(),
  periodEndAt: timestamp("periodEndAt").notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  subtotalAmount: doublePrecision("subtotalAmount").default(0).notNull(),
  discountAmount: doublePrecision("discountAmount").default(0).notNull(),
  revenueShareAmount: doublePrecision("revenueShareAmount").default(0).notNull(),
  minimumCommitAdjustment: doublePrecision("minimumCommitAdjustment").default(0).notNull(),
  taxAmount: doublePrecision("taxAmount").default(0).notNull(),
  totalAmount: doublePrecision("totalAmount").default(0).notNull(),
  status: text("status").notNull(),
  approvalStatus: text("approvalStatus").notNull(),
  generatedAt: timestamp("generatedAt").defaultNow().notNull(),
  dueAt: timestamp("dueAt").notNull(),
  approvalStepCount: integer("approvalStepCount").default(0).notNull(),
  issuedAt: timestamp("issuedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  billingInvoiceLookupIdx: index("billing_invoice_lookup_idx").on(table.billingAccountId, table.billingPeriodKey, table.status),
}));

export const billingInvoiceLines = pgTable("billingInvoiceLines", {
  id: serial("id").primaryKey(),
  billingInvoiceLineId: varchar("billingInvoiceLineId", { length: 96 }).notNull().unique(),
  billingInvoiceId: varchar("billingInvoiceId", { length: 64 }).notNull(),
  lineType: text("lineType").notNull(),
  meterKey: varchar("meterKey", { length: 96 }),
  productKey: varchar("productKey", { length: 96 }),
  description: varchar("description", { length: 191 }).notNull(),
  quantity: doublePrecision("quantity").default(0).notNull(),
  unitPrice: doublePrecision("unitPrice").default(0).notNull(),
  amount: doublePrecision("amount").default(0).notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  billingInvoiceLineLookupIdx: index("billing_invoice_line_lookup_idx").on(table.billingInvoiceId, table.lineType),
}));

export const billingInvoiceApprovals = pgTable("billingInvoiceApprovals", {
  id: serial("id").primaryKey(),
  billingInvoiceApprovalId: varchar("billingInvoiceApprovalId", { length: 96 }).notNull().unique(),
  billingInvoiceId: varchar("billingInvoiceId", { length: 64 }).notNull(),
  stageKey: varchar("stageKey", { length: 96 }).notNull(),
  actorRole: text("actorRole").notNull(),
  status: text("status").notNull(),
  actedAt: timestamp("actedAt"),
  note: text("note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  billingInvoiceApprovalLookupIdx: index("billing_invoice_approval_lookup_idx").on(table.billingInvoiceId, table.status, table.actorRole),
}));

export const partnerOnboardingRecords = pgTable("partnerOnboardingRecords", {
  id: serial("id").primaryKey(),
  partnerId: varchar("partnerId", { length: 64 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  partnerName: varchar("partnerName", { length: 191 }).notNull(),
  legalEntity: varchar("legalEntity", { length: 191 }).notNull(),
  partnerType: text("partnerType").notNull(),
  region: varchar("region", { length: 96 }).notNull(),
  stage: text("stage").notNull(),
  requestedModules: jsonb("requestedModules").$type<string[]>().notNull(),
  primaryContact: jsonb("primaryContact")
    .$type<{ name: string; role: string; email: string; phone: string }>()
    .notNull(),
  operationsContact: jsonb("operationsContact")
    .$type<{ name: string; role: string; email: string; phone: string }>()
    .notNull(),
  commercial: jsonb("commercial")
    .$type<{
      plan: "starter" | "growth" | "enterprise";
      billingModel: string;
      revenueSharePct: number;
      settlementBank: string;
      settlementAccountName: string;
      settlementAccountNumber: string;
      settlementFrequency: "daily" | "weekly" | "monthly";
      goLiveTarget?: string;
    }>()
    .notNull(),
  compliance: jsonb("compliance")
    .$type<{
      kybStatus: "not_started" | "in_review" | "approved" | "rejected";
      requiredDocumentCount: number;
      submittedDocumentCount: number;
      riskRating: "low" | "medium" | "high";
      notes?: string;
      lastReviewedAt?: string;
    }>()
    .notNull(),
  branding: jsonb("branding")
    .$type<{
      displayName: string;
      supportEmail: string;
      primaryColor: string;
      accentColor: string;
      logoUrl: string;
      loginHeadline: string;
      customDomain?: string;
    }>()
    .notNull(),
  checklist: jsonb("checklist")
    .$type<Array<{ key: string; label: string; owner: "partner" | "compliance" | "operations"; completed: boolean }>>()
    .notNull(),
  blockers: jsonb("blockers").$type<string[]>().notNull(),
  readinessScore: integer("readinessScore").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  submittedAt: timestamp("submittedAt"),
  launchedAt: timestamp("launchedAt"),
  lastSubmittedBy: varchar("lastSubmittedBy", { length: 96 }),
}, (table) => ({
  partnerTenantStageIdx: index("partner_tenant_stage_idx").on(table.tenantId, table.stage, table.updatedAt),
  partnerReadinessIdx: index("partner_readiness_idx").on(table.stage, table.readinessScore),
}));

export const partnerApprovalRecords = pgTable("partnerApprovalRecords", {
  id: serial("id").primaryKey(),
  approvalId: varchar("approvalId", { length: 64 }).notNull().unique(),
  partnerId: varchar("partnerId", { length: 64 }).notNull(),
  stage: text("stage").notNull(),
  title: varchar("title", { length: 191 }).notNull(),
  detail: text("detail").notNull(),
  state: text("state").notNull(),
  requiredRole: text("requiredRole").notNull(),
  requestedAt: timestamp("requestedAt").defaultNow().notNull(),
  requestedById: varchar("requestedById", { length: 96 }).notNull(),
  resolvedAt: timestamp("resolvedAt"),
  resolutionNote: text("resolutionNote"),
}, (table) => ({
  partnerApprovalStateIdx: index("partner_approval_state_idx").on(table.partnerId, table.state, table.requestedAt),
  partnerApprovalRoleIdx: index("partner_approval_role_idx").on(table.requiredRole, table.state, table.requestedAt),
}));

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Tenant = typeof tenants.$inferSelect;
export type InsertTenant = typeof tenants.$inferInsert;
export type TenantFeatureFlag = typeof tenantFeatureFlags.$inferSelect;
export type InsertTenantFeatureFlag = typeof tenantFeatureFlags.$inferInsert;
export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = typeof customers.$inferInsert;
export type CustomerCard = typeof customerCards.$inferSelect;
export type InsertCustomerCard = typeof customerCards.$inferInsert;
export type CustomerCardEvent = typeof customerCardEvents.$inferSelect;
export type InsertCustomerCardEvent = typeof customerCardEvents.$inferInsert;
export type CustomerSavedBiller = typeof customerSavedBillers.$inferSelect;
export type InsertCustomerSavedBiller = typeof customerSavedBillers.$inferInsert;
export type CustomerBillPayment = typeof customerBillPayments.$inferSelect;
export type InsertCustomerBillPayment = typeof customerBillPayments.$inferInsert;
export type CustomerTransfer = typeof customerTransfers.$inferSelect;
export type InsertCustomerTransfer = typeof customerTransfers.$inferInsert;
export type CustomerApproval = typeof customerApprovals.$inferSelect;
export type InsertCustomerApproval = typeof customerApprovals.$inferInsert;
export type CustomerStatementExport = typeof customerStatementExports.$inferSelect;
export type InsertCustomerStatementExport = typeof customerStatementExports.$inferInsert;
export type CustomerStatement = typeof customerStatements.$inferSelect;
export type InsertCustomerStatement = typeof customerStatements.$inferInsert;
export type CustomerNotification = typeof customerNotifications.$inferSelect;
export type InsertCustomerNotification = typeof customerNotifications.$inferInsert;
export type WorkflowCase = typeof workflowCases.$inferSelect;
export type InsertWorkflowCase = typeof workflowCases.$inferInsert;
export type OperatorAction = typeof operatorActions.$inferSelect;
export type InsertOperatorAction = typeof operatorActions.$inferInsert;
export type AuditEntry = typeof auditEntries.$inferSelect;
export type InsertAuditEntry = typeof auditEntries.$inferInsert;
export type ExportJob = typeof exportJobs.$inferSelect;
export type InsertExportJob = typeof exportJobs.$inferInsert;
export type BillingAccount = typeof billingAccounts.$inferSelect;
export type InsertBillingAccount = typeof billingAccounts.$inferInsert;
export type BillingRateCard = typeof billingRateCards.$inferSelect;
export type InsertBillingRateCard = typeof billingRateCards.$inferInsert;
export type BillingRateCardLine = typeof billingRateCardLines.$inferSelect;
export type InsertBillingRateCardLine = typeof billingRateCardLines.$inferInsert;
export type BillingUsageEvent = typeof billingUsageEvents.$inferSelect;
export type InsertBillingUsageEvent = typeof billingUsageEvents.$inferInsert;
export type BillingRatedEvent = typeof billingRatedEvents.$inferSelect;
export type InsertBillingRatedEvent = typeof billingRatedEvents.$inferInsert;
export type BillingAccrualSnapshot = typeof billingAccrualSnapshots.$inferSelect;
export type InsertBillingAccrualSnapshot = typeof billingAccrualSnapshots.$inferInsert;
export type BillingContractOverride = typeof billingContractOverrides.$inferSelect;
export type InsertBillingContractOverride = typeof billingContractOverrides.$inferInsert;
export type BillingDiscountRule = typeof billingDiscountRules.$inferSelect;
export type InsertBillingDiscountRule = typeof billingDiscountRules.$inferInsert;
export type BillingRevenueShareRule = typeof billingRevenueShareRules.$inferSelect;
export type InsertBillingRevenueShareRule = typeof billingRevenueShareRules.$inferInsert;
export type BillingInvoice = typeof billingInvoices.$inferSelect;
export type InsertBillingInvoice = typeof billingInvoices.$inferInsert;
export type BillingInvoiceLine = typeof billingInvoiceLines.$inferSelect;
export type InsertBillingInvoiceLine = typeof billingInvoiceLines.$inferInsert;
export type BillingInvoiceApproval = typeof billingInvoiceApprovals.$inferSelect;
export type InsertBillingInvoiceApproval = typeof billingInvoiceApprovals.$inferInsert;
export type PartnerOnboardingRecord = typeof partnerOnboardingRecords.$inferSelect;
export type InsertPartnerOnboardingRecord = typeof partnerOnboardingRecords.$inferInsert;
export type PartnerApprovalRecord = typeof partnerApprovalRecords.$inferSelect;
export type InsertPartnerApprovalRecord = typeof partnerApprovalRecords.$inferInsert;

// ── Agriculture Banking ──

export const farmers = pgTable("farmers", {
  id: serial("id").primaryKey(),
  farmerId: varchar("farmerId", { length: 32 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  bvn: varchar("bvn", { length: 11 }).notNull(),
  phone: varchar("phone", { length: 15 }).notNull(),
  region: varchar("region", { length: 100 }).notNull(),
  localGovernment: varchar("localGovernment", { length: 100 }).notNull(),
  farmSizeHectares: doublePrecision("farmSizeHectares").notNull(),
  primaryCrop: varchar("primaryCrop", { length: 100 }).notNull(),
  secondaryCrops: jsonb("secondaryCrops").$type<string[]>().notNull(),
  cooperativeId: varchar("cooperativeId", { length: 64 }),
  cooperativeName: varchar("cooperativeName", { length: 200 }),
  bankAccountNumber: varchar("bankAccountNumber", { length: 20 }),
  riskScore: doublePrecision("riskScore").notNull(),
  riskTier: varchar("riskTier", { length: 20 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  geoCoordinates: jsonb("geoCoordinates").$type<{ latitude: number; longitude: number }>(),
  registrationChannel: varchar("registrationChannel", { length: 50 }).notNull().default("platform"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => [
  index("farmers_tenant_idx").on(table.tenantId),
  index("farmers_region_idx").on(table.region),
]);

export const agriLoans = pgTable("agriLoans", {
  id: serial("id").primaryKey(),
  loanId: varchar("loanId", { length: 32 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  farmerId: varchar("farmerId", { length: 32 }).notNull(),
  loanType: varchar("loanType", { length: 50 }).notNull(),
  productCode: varchar("productCode", { length: 50 }).notNull(),
  principalAmount: doublePrecision("principalAmount").notNull(),
  interestRateBps: integer("interestRateBps").notNull(),
  tenorMonths: integer("tenorMonths").notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("NGN"),
  purpose: text("purpose").notNull(),
  collateralType: varchar("collateralType", { length: 100 }).notNull(),
  collateralValue: doublePrecision("collateralValue").notNull(),
  cropCycle: varchar("cropCycle", { length: 50 }).notNull(),
  expectedHarvestDate: varchar("expectedHarvestDate", { length: 20 }).notNull(),
  disbursementDate: varchar("disbursementDate", { length: 30 }),
  maturityDate: varchar("maturityDate", { length: 30 }),
  outstandingBalance: doublePrecision("outstandingBalance").notNull(),
  totalRepaid: doublePrecision("totalRepaid").notNull().default(0),
  status: varchar("status", { length: 30 }).notNull().default("pending_approval"),
  approvalStatus: varchar("approvalStatus", { length: 30 }).notNull().default("pending"),
  riskGrade: varchar("riskGrade", { length: 5 }).notNull(),
  repaymentSchedule: jsonb("repaymentSchedule").$type<object[]>().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => [
  index("agriLoans_tenant_idx").on(table.tenantId),
  index("agriLoans_farmer_idx").on(table.farmerId),
]);

export const cropInsurancePolicies = pgTable("cropInsurancePolicies", {
  id: serial("id").primaryKey(),
  policyId: varchar("policyId", { length: 32 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  farmerId: varchar("farmerId", { length: 32 }).notNull(),
  policyType: varchar("policyType", { length: 50 }).notNull(),
  cropCovered: varchar("cropCovered", { length: 100 }).notNull(),
  coverageAreaHectares: doublePrecision("coverageAreaHectares").notNull(),
  sumInsured: doublePrecision("sumInsured").notNull(),
  premiumAmount: doublePrecision("premiumAmount").notNull(),
  premiumFrequency: varchar("premiumFrequency", { length: 20 }).notNull().default("annual"),
  policyStart: varchar("policyStart", { length: 20 }).notNull(),
  policyEnd: varchar("policyEnd", { length: 20 }).notNull(),
  weatherTrigger: jsonb("weatherTrigger").$type<object>(),
  claims: jsonb("claims").$type<object[]>().notNull(),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  underwriter: varchar("underwriter", { length: 200 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => [
  index("cropIns_tenant_idx").on(table.tenantId),
  index("cropIns_farmer_idx").on(table.farmerId),
]);

export const valueChainContracts = pgTable("valueChainContracts", {
  id: serial("id").primaryKey(),
  contractId: varchar("contractId", { length: 32 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  contractType: varchar("contractType", { length: 50 }).notNull(),
  buyerName: varchar("buyerName", { length: 200 }).notNull(),
  buyerId: varchar("buyerId", { length: 64 }).notNull(),
  sellerFarmerId: varchar("sellerFarmerId", { length: 32 }).notNull(),
  commodity: varchar("commodity", { length: 100 }).notNull(),
  quantityTonnes: doublePrecision("quantityTonnes").notNull(),
  pricePerTonne: doublePrecision("pricePerTonne").notNull(),
  totalValue: doublePrecision("totalValue").notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("NGN"),
  deliveryLocation: varchar("deliveryLocation", { length: 200 }).notNull(),
  deliveryDeadline: varchar("deliveryDeadline", { length: 20 }).notNull(),
  warehouseReceiptId: varchar("warehouseReceiptId", { length: 32 }),
  qualityGrade: varchar("qualityGrade", { length: 20 }).notNull().default("Grade A"),
  milestones: jsonb("milestones").$type<object[]>().notNull(),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => [
  index("vcc_tenant_idx").on(table.tenantId),
  index("vcc_seller_idx").on(table.sellerFarmerId),
]);

// ── Teller Operations ──

export const tellerSessions = pgTable("tellerSessions", {
  id: serial("id").primaryKey(),
  sessionId: varchar("sessionId", { length: 32 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  tellerId: varchar("tellerId", { length: 64 }).notNull(),
  tellerName: varchar("tellerName", { length: 200 }).notNull(),
  branchCode: varchar("branchCode", { length: 20 }).notNull(),
  branchName: varchar("branchName", { length: 200 }).notNull(),
  windowNumber: integer("windowNumber").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("open"),
  openedAt: varchar("openedAt", { length: 30 }).notNull(),
  closedAt: varchar("closedAt", { length: 30 }),
  openingBalance: doublePrecision("openingBalance").notNull(),
  currentBalance: doublePrecision("currentBalance").notNull(),
  transactionCount: integer("transactionCount").notNull().default(0),
  cashDrawer: jsonb("cashDrawer").$type<object>().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => [
  index("teller_tenant_idx").on(table.tenantId),
  index("teller_branch_idx").on(table.branchCode),
]);

export const tellerTransactions = pgTable("tellerTransactions", {
  id: serial("id").primaryKey(),
  txnId: varchar("txnId", { length: 32 }).notNull().unique(),
  sessionId: varchar("sessionId", { length: 32 }).notNull(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  txnType: varchar("txnType", { length: 30 }).notNull(),
  customerId: varchar("customerId", { length: 64 }).notNull(),
  amount: doublePrecision("amount").notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("NGN"),
  reference: varchar("reference", { length: 100 }),
  status: varchar("status", { length: 20 }).notNull().default("completed"),
  processedAt: varchar("processedAt", { length: 30 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("ttxn_session_idx").on(table.sessionId),
  index("ttxn_tenant_idx").on(table.tenantId),
]);

export const vaultOperations = pgTable("vaultOperations", {
  id: serial("id").primaryKey(),
  operationId: varchar("operationId", { length: 32 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  operationType: varchar("operationType", { length: 30 }).notNull(),
  fromLocation: varchar("fromLocation", { length: 100 }).notNull(),
  toLocation: varchar("toLocation", { length: 100 }).notNull(),
  amount: doublePrecision("amount").notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("NGN"),
  authorizedBy: varchar("authorizedBy", { length: 100 }).notNull(),
  dualControlBy: varchar("dualControlBy", { length: 100 }),
  status: varchar("status", { length: 30 }).notNull().default("completed"),
  reason: text("reason").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("vault_tenant_idx").on(table.tenantId),
]);

// ── Islamic Banking ──

export const murabahaContracts = pgTable("murabahaContracts", {
  id: serial("id").primaryKey(),
  contractId: varchar("contractId", { length: 32 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  customerId: varchar("customerId", { length: 64 }).notNull(),
  customerName: varchar("customerName", { length: 200 }).notNull(),
  assetDescription: text("assetDescription").notNull(),
  assetCategory: varchar("assetCategory", { length: 50 }).notNull(),
  costPrice: doublePrecision("costPrice").notNull(),
  profitMarginPct: doublePrecision("profitMarginPct").notNull(),
  sellingPrice: doublePrecision("sellingPrice").notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("NGN"),
  tenorMonths: integer("tenorMonths").notNull(),
  instalmentAmount: doublePrecision("instalmentAmount").notNull(),
  totalPaid: doublePrecision("totalPaid").notNull().default(0),
  outstandingBalance: doublePrecision("outstandingBalance").notNull(),
  disbursementDate: varchar("disbursementDate", { length: 30 }),
  maturityDate: varchar("maturityDate", { length: 30 }),
  status: varchar("status", { length: 30 }).notNull().default("pending_sharia_review"),
  shariaCompliance: varchar("shariaCompliance", { length: 30 }).notNull(),
  shariaBoardReference: text("shariaBoardReference"),
  instalmentSchedule: jsonb("instalmentSchedule").$type<object[]>().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => [
  index("murabaha_tenant_idx").on(table.tenantId),
  index("murabaha_customer_idx").on(table.customerId),
]);

export const ijaraContracts = pgTable("ijaraContracts", {
  id: serial("id").primaryKey(),
  contractId: varchar("contractId", { length: 32 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  customerId: varchar("customerId", { length: 64 }).notNull(),
  customerName: varchar("customerName", { length: 200 }).notNull(),
  assetDescription: text("assetDescription").notNull(),
  assetCategory: varchar("assetCategory", { length: 50 }).notNull(),
  assetValue: doublePrecision("assetValue").notNull(),
  rentalAmount: doublePrecision("rentalAmount").notNull(),
  rentalFrequency: varchar("rentalFrequency", { length: 20 }).notNull().default("monthly"),
  currency: varchar("currency", { length: 3 }).notNull().default("NGN"),
  leaseStart: varchar("leaseStart", { length: 20 }).notNull(),
  leaseEnd: varchar("leaseEnd", { length: 20 }).notNull(),
  tenorMonths: integer("tenorMonths").notNull(),
  residualValue: doublePrecision("residualValue").notNull(),
  purchaseOption: integer("purchaseOption").notNull().default(1),
  purchasePrice: doublePrecision("purchasePrice"),
  totalRentPaid: doublePrecision("totalRentPaid").notNull().default(0),
  status: varchar("status", { length: 30 }).notNull().default("active"),
  shariaCompliance: varchar("shariaCompliance", { length: 30 }).notNull(),
  maintenanceResponsibility: varchar("maintenanceResponsibility", { length: 20 }).notNull().default("lessor"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => [
  index("ijara_tenant_idx").on(table.tenantId),
  index("ijara_customer_idx").on(table.customerId),
]);

export const mudarabahContracts = pgTable("mudarabahContracts", {
  id: serial("id").primaryKey(),
  contractId: varchar("contractId", { length: 32 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  investorId: varchar("investorId", { length: 64 }).notNull(),
  investorName: varchar("investorName", { length: 200 }).notNull(),
  fundManagerId: varchar("fundManagerId", { length: 64 }).notNull(),
  investmentPurpose: text("investmentPurpose").notNull(),
  capitalAmount: doublePrecision("capitalAmount").notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("NGN"),
  profitSharingRatioInvestor: doublePrecision("profitSharingRatioInvestor").notNull(),
  profitSharingRatioManager: doublePrecision("profitSharingRatioManager").notNull(),
  investmentPeriodMonths: integer("investmentPeriodMonths").notNull(),
  startDate: varchar("startDate", { length: 20 }).notNull(),
  maturityDate: varchar("maturityDate", { length: 20 }).notNull(),
  realizedProfit: doublePrecision("realizedProfit").notNull().default(0),
  realizedLoss: doublePrecision("realizedLoss").notNull().default(0),
  distributions: jsonb("distributions").$type<object[]>().notNull(),
  status: varchar("status", { length: 30 }).notNull().default("active"),
  shariaCompliance: varchar("shariaCompliance", { length: 30 }).notNull(),
  riskCategory: varchar("riskCategory", { length: 30 }).notNull().default("moderate"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => [
  index("mudarabah_tenant_idx").on(table.tenantId),
  index("mudarabah_investor_idx").on(table.investorId),
]);

// ── Trade Finance ──

export const lettersOfCredit = pgTable("lettersOfCredit", {
  id: serial("id").primaryKey(),
  lcId: varchar("lcId", { length: 32 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  lcType: varchar("lcType", { length: 30 }).notNull().default("irrevocable"),
  applicantId: varchar("applicantId", { length: 64 }).notNull(),
  applicantName: varchar("applicantName", { length: 200 }).notNull(),
  beneficiaryName: varchar("beneficiaryName", { length: 200 }).notNull(),
  beneficiaryBank: varchar("beneficiaryBank", { length: 200 }),
  beneficiaryCountry: varchar("beneficiaryCountry", { length: 100 }),
  issuingBank: varchar("issuingBank", { length: 200 }).notNull().default("54Bank"),
  advisingBank: varchar("advisingBank", { length: 200 }),
  amount: doublePrecision("amount").notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("USD"),
  commodity: varchar("commodity", { length: 200 }),
  incoterm: varchar("incoterm", { length: 10 }),
  portOfLoading: varchar("portOfLoading", { length: 200 }),
  portOfDischarge: varchar("portOfDischarge", { length: 200 }),
  latestShipDate: varchar("latestShipDate", { length: 20 }),
  expiryDate: varchar("expiryDate", { length: 20 }).notNull(),
  documentsRequired: jsonb("documentsRequired").$type<string[]>().notNull(),
  amendments: jsonb("amendments").$type<object[]>().notNull(),
  status: varchar("status", { length: 30 }).notNull().default("draft"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => [
  index("lc_tenant_idx").on(table.tenantId),
  index("lc_applicant_idx").on(table.applicantId),
]);

export const warehouseReceipts = pgTable("warehouseReceipts", {
  id: serial("id").primaryKey(),
  receiptId: varchar("receiptId", { length: 32 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  depositorId: varchar("depositorId", { length: 64 }).notNull(),
  depositorName: varchar("depositorName", { length: 200 }).notNull(),
  warehouseId: varchar("warehouseId", { length: 64 }).notNull(),
  warehouseName: varchar("warehouseName", { length: 200 }),
  location: varchar("location", { length: 200 }).notNull(),
  commodity: varchar("commodity", { length: 100 }).notNull(),
  quantity: doublePrecision("quantity").notNull(),
  quantityUnit: varchar("quantityUnit", { length: 20 }).notNull().default("tonnes"),
  qualityGrade: varchar("qualityGrade", { length: 20 }).notNull().default("Grade A"),
  storageStartDate: varchar("storageStartDate", { length: 20 }).notNull(),
  expiryDate: varchar("expiryDate", { length: 20 }),
  marketValue: doublePrecision("marketValue").notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("NGN"),
  pledgedAsCollateral: integer("pledgedAsCollateral").notNull().default(0),
  collateralLoanId: varchar("collateralLoanId", { length: 32 }),
  insurancePolicyId: varchar("insurancePolicyId", { length: 32 }),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => [
  index("whr_tenant_idx").on(table.tenantId),
  index("whr_depositor_idx").on(table.depositorId),
]);

export const bankGuarantees = pgTable("bankGuarantees", {
  id: serial("id").primaryKey(),
  guaranteeId: varchar("guaranteeId", { length: 32 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  guaranteeType: varchar("guaranteeType", { length: 30 }).notNull().default("performance"),
  applicantId: varchar("applicantId", { length: 64 }).notNull(),
  applicantName: varchar("applicantName", { length: 200 }).notNull(),
  beneficiaryName: varchar("beneficiaryName", { length: 200 }).notNull(),
  amount: doublePrecision("amount").notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("USD"),
  purpose: text("purpose").notNull(),
  effectiveDate: varchar("effectiveDate", { length: 20 }).notNull(),
  expiryDate: varchar("expiryDate", { length: 20 }).notNull(),
  claimDeadline: varchar("claimDeadline", { length: 20 }),
  commissionRate: doublePrecision("commissionRate").notNull(),
  commissionAmount: doublePrecision("commissionAmount").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => [
  index("bg_tenant_idx").on(table.tenantId),
  index("bg_applicant_idx").on(table.applicantId),
]);

// ── Type Exports (Banking Verticals) ──

export type Farmer = typeof farmers.$inferSelect;
export type InsertFarmer = typeof farmers.$inferInsert;
export type AgriLoan = typeof agriLoans.$inferSelect;
export type InsertAgriLoan = typeof agriLoans.$inferInsert;
export type CropInsurancePolicy = typeof cropInsurancePolicies.$inferSelect;
export type InsertCropInsurancePolicy = typeof cropInsurancePolicies.$inferInsert;
export type ValueChainContract = typeof valueChainContracts.$inferSelect;
export type InsertValueChainContract = typeof valueChainContracts.$inferInsert;
export type TellerSession = typeof tellerSessions.$inferSelect;
export type InsertTellerSession = typeof tellerSessions.$inferInsert;
export type TellerTransaction = typeof tellerTransactions.$inferSelect;
export type InsertTellerTransaction = typeof tellerTransactions.$inferInsert;
export type VaultOperation = typeof vaultOperations.$inferSelect;
export type InsertVaultOperation = typeof vaultOperations.$inferInsert;
export type MurabahaContract = typeof murabahaContracts.$inferSelect;
export type InsertMurabahaContract = typeof murabahaContracts.$inferInsert;
export type IjaraContract = typeof ijaraContracts.$inferSelect;
export type InsertIjaraContract = typeof ijaraContracts.$inferInsert;
export type MudarabahContract = typeof mudarabahContracts.$inferSelect;
export type InsertMudarabahContract = typeof mudarabahContracts.$inferInsert;
export type LetterOfCredit = typeof lettersOfCredit.$inferSelect;
export type InsertLetterOfCredit = typeof lettersOfCredit.$inferInsert;
export type WarehouseReceipt = typeof warehouseReceipts.$inferSelect;
export type InsertWarehouseReceipt = typeof warehouseReceipts.$inferInsert;
export type BankGuarantee = typeof bankGuarantees.$inferSelect;
export type InsertBankGuarantee = typeof bankGuarantees.$inferInsert;

// ── Mortgage Servicing ──────────────────────────────────────────────────────

export const mortgageApplications = pgTable("mortgageApplications", {
  id: serial("id").primaryKey(),
  mortgageId: varchar("mortgageId", { length: 64 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 128 }).notNull(),
  applicantId: varchar("applicantId", { length: 64 }).notNull(),
  applicantName: varchar("applicantName", { length: 255 }).notNull(),
  propertyValue: doublePrecision("propertyValue").notNull(),
  loanAmount: doublePrecision("loanAmount").notNull(),
  downPayment: doublePrecision("downPayment").notNull(),
  interestRatePct: doublePrecision("interestRatePct").notNull(),
  tenorMonths: integer("tenorMonths").notNull(),
  mortgageType: varchar("mortgageType", { length: 32 }).notNull(),
  emi: doublePrecision("emi").notNull(),
  ltvPct: doublePrecision("ltvPct").notNull(),
  ltvGrade: varchar("ltvGrade", { length: 2 }).notNull(),
  dtiRatio: doublePrecision("dtiRatio").notNull(),
  propertyAddress: text("propertyAddress"),
  propertyType: varchar("propertyType", { length: 32 }),
  status: varchar("status", { length: 32 }).notNull().default("pending"),
  disbursedAt: timestamp("disbursedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => [
  index("idx_mortgage_tenant").on(table.tenantId),
  index("idx_mortgage_applicant").on(table.applicantId),
  index("idx_mortgage_status").on(table.status),
]);

// ── Education Loans ─────────────────────────────────────────────────────────

export const educationLoans = pgTable("educationLoans", {
  id: serial("id").primaryKey(),
  loanId: varchar("loanId", { length: 64 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 128 }).notNull(),
  studentId: varchar("studentId", { length: 64 }),
  studentName: varchar("studentName", { length: 255 }).notNull(),
  institutionName: varchar("institutionName", { length: 255 }).notNull(),
  programName: varchar("programName", { length: 255 }),
  loanAmount: doublePrecision("loanAmount").notNull(),
  interestRate: doublePrecision("interestRate").notNull(),
  tenorMonths: integer("tenorMonths").notNull(),
  graceMonths: integer("graceMonths").notNull(),
  emi: doublePrecision("emi").notNull(),
  totalDisbursed: doublePrecision("totalDisbursed").default(0),
  totalRepaid: doublePrecision("totalRepaid").default(0),
  outstandingBalance: doublePrecision("outstandingBalance").notNull(),
  cosignerName: varchar("cosignerName", { length: 255 }),
  cosignerType: varchar("cosignerType", { length: 32 }),
  status: varchar("status", { length: 32 }).notNull().default("pending"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => [
  index("idx_edloan_tenant").on(table.tenantId),
  index("idx_edloan_student").on(table.studentId),
]);

// ── Esusu Groups ────────────────────────────────────────────────────────────

export const esusuGroups = pgTable("esusuGroups", {
  id: serial("id").primaryKey(),
  groupId: varchar("groupId", { length: 64 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 128 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  organiserId: varchar("organiserId", { length: 64 }).notNull(),
  organiserName: varchar("organiserName", { length: 255 }).notNull(),
  contributionAmount: doublePrecision("contributionAmount").notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("NGN"),
  frequency: varchar("frequency", { length: 16 }).notNull(),
  maxMembers: integer("maxMembers").notNull(),
  currentCycle: integer("currentCycle").default(0),
  totalCycles: integer("totalCycles").default(0),
  status: varchar("status", { length: 32 }).notNull().default("forming"),
  startDate: timestamp("startDate"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => [
  index("idx_esusu_tenant").on(table.tenantId),
  index("idx_esusu_organiser").on(table.organiserId),
]);

// ── Virtual Accounts ────────────────────────────────────────────────────────

export const virtualAccounts = pgTable("virtualAccounts", {
  id: serial("id").primaryKey(),
  accountId: varchar("accountId", { length: 64 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 128 }).notNull(),
  van: varchar("van", { length: 20 }).notNull().unique(),
  parentAccountId: varchar("parentAccountId", { length: 64 }),
  ownerId: varchar("ownerId", { length: 64 }).notNull(),
  ownerName: varchar("ownerName", { length: 255 }).notNull(),
  ownerType: varchar("ownerType", { length: 32 }).notNull(),
  purpose: text("purpose"),
  currency: varchar("currency", { length: 3 }).notNull().default("NGN"),
  balance: doublePrecision("balance").default(0),
  availableBalance: doublePrecision("availableBalance").default(0),
  holdAmount: doublePrecision("holdAmount").default(0),
  dailyLimit: doublePrecision("dailyLimit"),
  monthlyLimit: doublePrecision("monthlyLimit"),
  status: varchar("status", { length: 16 }).notNull().default("active"),
  expiryDate: timestamp("expiryDate"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => [
  index("idx_van_tenant").on(table.tenantId),
  index("idx_van_owner").on(table.ownerId),
  uniqueIndex("idx_van_number").on(table.van),
]);

// ── Agent Banking ───────────────────────────────────────────────────────────

export const agentBankingAgents = pgTable("agentBankingAgents", {
  id: serial("id").primaryKey(),
  agentId: varchar("agentId", { length: 64 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 128 }).notNull(),
  agentCode: varchar("agentCode", { length: 20 }).notNull().unique(),
  businessName: varchar("businessName", { length: 255 }).notNull(),
  ownerName: varchar("ownerName", { length: 255 }).notNull(),
  phoneNumber: varchar("phoneNumber", { length: 20 }).notNull(),
  email: varchar("email", { length: 255 }),
  bvn: varchar("bvn", { length: 11 }),
  lga: varchar("lga", { length: 128 }),
  state: varchar("state", { length: 64 }),
  agentType: varchar("agentType", { length: 20 }).notNull(),
  superAgentId: varchar("superAgentId", { length: 64 }),
  floatBalance: doublePrecision("floatBalance").default(0),
  commissionEarned: doublePrecision("commissionEarned").default(0),
  transactionCount: integer("transactionCount").default(0),
  kycStatus: varchar("kycStatus", { length: 16 }).default("pending"),
  status: varchar("status", { length: 16 }).notNull().default("active"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => [
  index("idx_agent_tenant").on(table.tenantId),
  index("idx_agent_code").on(table.agentCode),
]);

// ── Group Lending ───────────────────────────────────────────────────────────

export const lendingGroups = pgTable("lendingGroups", {
  id: serial("id").primaryKey(),
  groupId: varchar("groupId", { length: 64 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 128 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  purpose: text("purpose"),
  groupLeaderId: varchar("groupLeaderId", { length: 64 }).notNull(),
  groupLeaderName: varchar("groupLeaderName", { length: 255 }),
  maxMembers: integer("maxMembers").notNull(),
  liabilityType: varchar("liabilityType", { length: 32 }).notNull(),
  status: varchar("status", { length: 32 }).notNull().default("forming"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => [
  index("idx_lgroup_tenant").on(table.tenantId),
  index("idx_lgroup_leader").on(table.groupLeaderId),
]);

// ── Identity & Channels ─────────────────────────────────────────────────────

export const identityProfiles = pgTable("identityProfiles", {
  id: serial("id").primaryKey(),
  profileId: varchar("profileId", { length: 64 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 128 }).notNull(),
  customerId: varchar("customerId", { length: 64 }).notNull(),
  customerName: varchar("customerName", { length: 255 }),
  email: varchar("email", { length: 255 }),
  phoneNumber: varchar("phoneNumber", { length: 20 }).notNull(),
  bvn: varchar("bvn", { length: 11 }),
  nin: varchar("nin", { length: 11 }),
  mfaEnabled: integer("mfaEnabled").default(0),
  mfaMethods: jsonb("mfaMethods"),
  activeChannels: jsonb("activeChannels"),
  status: varchar("status", { length: 16 }).notNull().default("active"),
  lastLoginAt: timestamp("lastLoginAt"),
  failedAttempts: integer("failedAttempts").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => [
  index("idx_identity_tenant").on(table.tenantId),
  index("idx_identity_customer").on(table.customerId),
]);

// ── Dispute Management ──────────────────────────────────────────────────────

export const disputeCases = pgTable("disputeCases", {
  id: serial("id").primaryKey(),
  disputeId: varchar("disputeId", { length: 64 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 128 }).notNull(),
  customerId: varchar("customerId", { length: 64 }),
  customerName: varchar("customerName", { length: 255 }).notNull(),
  category: varchar("category", { length: 64 }).notNull(),
  description: text("description"),
  transactionId: varchar("transactionId", { length: 64 }),
  transactionAmount: doublePrecision("transactionAmount"),
  disputedAmount: doublePrecision("disputedAmount"),
  channel: varchar("channel", { length: 16 }),
  priority: varchar("priority", { length: 16 }).default("medium"),
  status: varchar("status", { length: 32 }).notNull().default("filed"),
  slaDeadline: timestamp("slaDeadline"),
  assignedTo: varchar("assignedTo", { length: 64 }),
  resolution: varchar("resolution", { length: 32 }),
  resolutionAmount: doublePrecision("resolutionAmount"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => [
  index("idx_dispute_tenant").on(table.tenantId),
  index("idx_dispute_customer").on(table.customerId),
  index("idx_dispute_status").on(table.status),
]);

// ── Ledger Reconciliation ───────────────────────────────────────────────────

export const reconciliationRuns = pgTable("reconciliationRuns", {
  id: serial("id").primaryKey(),
  runId: varchar("runId", { length: 64 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 128 }).notNull(),
  runType: varchar("runType", { length: 16 }).notNull(),
  scope: varchar("scope", { length: 32 }).notNull(),
  status: varchar("status", { length: 48 }).notNull(),
  totalEntriesChecked: integer("totalEntriesChecked").default(0),
  matches: integer("matches").default(0),
  discrepancies: integer("discrepancies").default(0),
  autoRepaired: integer("autoRepaired").default(0),
  manualTriage: integer("manualTriage").default(0),
  durationMs: integer("durationMs"),
  startTime: timestamp("startTime"),
  endTime: timestamp("endTime"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("idx_recon_tenant").on(table.tenantId),
  index("idx_recon_status").on(table.status),
]);

// ── ERPNext Sync ────────────────────────────────────────────────────────────

export const erpnextSyncJobs = pgTable("erpnextSyncJobs", {
  id: serial("id").primaryKey(),
  jobId: varchar("jobId", { length: 64 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 128 }).notNull(),
  syncType: varchar("syncType", { length: 32 }).notNull(),
  direction: varchar("direction", { length: 16 }).notNull(),
  status: varchar("status", { length: 32 }).notNull(),
  recordsProcessed: integer("recordsProcessed").default(0),
  recordsFailed: integer("recordsFailed").default(0),
  recordsSkipped: integer("recordsSkipped").default(0),
  retryCount: integer("retryCount").default(0),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => [
  index("idx_erpnext_tenant").on(table.tenantId),
  index("idx_erpnext_status").on(table.status),
]);

// ── Regulatory Reporting ────────────────────────────────────────────────────

export const regulatoryReports = pgTable("regulatoryReports", {
  id: serial("id").primaryKey(),
  reportId: varchar("reportId", { length: 64 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 128 }).notNull(),
  reportType: varchar("reportType", { length: 48 }).notNull(),
  period: varchar("period", { length: 10 }).notNull(),
  status: varchar("status", { length: 16 }).notNull().default("generated"),
  submittedTo: varchar("submittedTo", { length: 16 }),
  submittedAt: timestamp("submittedAt"),
  data: jsonb("data"),
  summary: jsonb("summary"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => [
  index("idx_regrep_tenant").on(table.tenantId),
  index("idx_regrep_type").on(table.reportType),
]);

// ── New Type Exports ────────────────────────────────────────────────────────

export type MortgageApplication = typeof mortgageApplications.$inferSelect;
export type InsertMortgageApplication = typeof mortgageApplications.$inferInsert;
export type EducationLoan = typeof educationLoans.$inferSelect;
export type InsertEducationLoan = typeof educationLoans.$inferInsert;
export type EsusuGroup = typeof esusuGroups.$inferSelect;
export type InsertEsusuGroup = typeof esusuGroups.$inferInsert;
export type VirtualAccount = typeof virtualAccounts.$inferSelect;
export type InsertVirtualAccount = typeof virtualAccounts.$inferInsert;
export type AgentBankingAgent = typeof agentBankingAgents.$inferSelect;
export type InsertAgentBankingAgent = typeof agentBankingAgents.$inferInsert;
export type LendingGroup = typeof lendingGroups.$inferSelect;
export type InsertLendingGroup = typeof lendingGroups.$inferInsert;
export type IdentityProfile = typeof identityProfiles.$inferSelect;
export type InsertIdentityProfile = typeof identityProfiles.$inferInsert;
export type DisputeCase = typeof disputeCases.$inferSelect;
export type InsertDisputeCase = typeof disputeCases.$inferInsert;
export type ReconciliationRun = typeof reconciliationRuns.$inferSelect;
export type InsertReconciliationRun = typeof reconciliationRuns.$inferInsert;
export type ErpnextSyncJob = typeof erpnextSyncJobs.$inferSelect;
export type InsertErpnextSyncJob = typeof erpnextSyncJobs.$inferInsert;
export type RegulatoryReport = typeof regulatoryReports.$inferSelect;
export type InsertRegulatoryReport = typeof regulatoryReports.$inferInsert;

// ────────────────────────────────────────────────────────────────
// Core Banking Tables — accounts, transactions, GL, loans, etc.
// ────────────────────────────────────────────────────────────────

export const accounts = pgTable("accounts", {
  id: serial("id").primaryKey(),
  accountId: varchar("accountId", { length: 64 }).notNull().unique(),
  customerId: varchar("customerId", { length: 64 }).notNull(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  accountName: varchar("accountName", { length: 191 }).notNull(),
  accountType: text("accountType").notNull(), // savings, current, fixed_deposit, loan, gl
  currency: varchar("currency", { length: 3 }).notNull().default("NGN"),
  balance: doublePrecision("balance").default(0).notNull(),
  availableBalance: doublePrecision("availableBalance").default(0).notNull(),
  ledgerBalance: doublePrecision("ledgerBalance").default(0).notNull(),
  status: text("status").notNull().default("active"), // active, dormant, frozen, closed
  branchCode: varchar("branchCode", { length: 16 }).notNull(),
  openedAt: timestamp("openedAt").defaultNow().notNull(),
  lastTransactionAt: timestamp("lastTransactionAt"),
  version: integer("version").default(1).notNull(),
  tigerbeetleAccountId: varchar("tigerbeetleAccountId", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  accountCustomerIdx: index("account_customer_idx").on(table.customerId, table.status),
  accountTenantIdx: index("account_tenant_idx").on(table.tenantId, table.accountType, table.status),
  accountBranchIdx: index("account_branch_idx").on(table.branchCode, table.status),
}));

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  transactionId: varchar("transactionId", { length: 64 }).notNull().unique(),
  accountId: varchar("accountId", { length: 64 }).notNull(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  type: text("type").notNull(), // credit, debit
  amount: doublePrecision("amount").notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("NGN"),
  narration: text("narration").notNull(),
  reference: varchar("reference", { length: 128 }).notNull().unique(),
  channel: text("channel").notNull(), // mobile, web, ussd, pos, atm, branch
  counterpartyAccountId: varchar("counterpartyAccountId", { length: 64 }),
  counterpartyName: varchar("counterpartyName", { length: 191 }),
  balanceAfter: doublePrecision("balanceAfter").notNull(),
  status: text("status").notNull().default("completed"), // pending, completed, failed, reversed
  valueDate: timestamp("valueDate").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  txnAccountDateIdx: index("txn_account_date_idx").on(table.accountId, table.createdAt),
  txnReferenceIdx: uniqueIndex("txn_reference_idx").on(table.reference),
  txnTenantDateIdx: index("txn_tenant_date_idx").on(table.tenantId, table.createdAt),
}));

export const journalEntries = pgTable("journalEntries", {
  id: serial("id").primaryKey(),
  entryId: varchar("entryId", { length: 64 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  accountId: varchar("accountId", { length: 64 }).notNull(),
  glAccountCode: varchar("glAccountCode", { length: 32 }).notNull(),
  type: text("type").notNull(), // debit, credit
  amount: doublePrecision("amount").notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("NGN"),
  narration: text("narration").notNull(),
  transactionRef: varchar("transactionRef", { length: 128 }).notNull(),
  batchId: varchar("batchId", { length: 64 }),
  reversalOf: varchar("reversalOf", { length: 64 }),
  postingDate: timestamp("postingDate").defaultNow().notNull(),
  valueDate: timestamp("valueDate").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  jeAccountIdx: index("je_account_idx").on(table.accountId, table.createdAt),
  jeGlCodeIdx: index("je_gl_code_idx").on(table.glAccountCode, table.postingDate),
  jeBatchIdx: index("je_batch_idx").on(table.batchId),
}));

export const glAccounts = pgTable("glAccounts", {
  id: serial("id").primaryKey(),
  glAccountCode: varchar("glAccountCode", { length: 32 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  name: varchar("name", { length: 191 }).notNull(),
  category: text("category").notNull(), // asset, liability, equity, income, expense
  subcategory: text("subcategory").notNull(),
  parentCode: varchar("parentCode", { length: 32 }),
  currency: varchar("currency", { length: 3 }).notNull().default("NGN"),
  balance: doublePrecision("balance").default(0).notNull(),
  status: text("status").notNull().default("active"),
  isControlAccount: integer("isControlAccount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  glCategoryIdx: index("gl_category_idx").on(table.tenantId, table.category),
}));

export const loans = pgTable("loans", {
  id: serial("id").primaryKey(),
  loanId: varchar("loanId", { length: 64 }).notNull().unique(),
  customerId: varchar("customerId", { length: 64 }).notNull(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  loanType: text("loanType").notNull(), // term, overdraft, mortgage, agri, sme
  principalAmount: doublePrecision("principalAmount").notNull(),
  outstandingBalance: doublePrecision("outstandingBalance").notNull(),
  interestRate: doublePrecision("interestRate").notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("NGN"),
  tenor: integer("tenor").notNull(),
  tenorUnit: text("tenorUnit").notNull().default("months"),
  disbursementDate: timestamp("disbursementDate"),
  maturityDate: timestamp("maturityDate"),
  nextPaymentDate: timestamp("nextPaymentDate"),
  nextPaymentAmount: doublePrecision("nextPaymentAmount"),
  status: text("status").notNull().default("pending"), // pending, active, overdue, default, closed, written_off
  classificationIFRS9: text("classificationIFRS9").default("stage1"), // stage1, stage2, stage3
  collateralValue: doublePrecision("collateralValue"),
  approvedBy: varchar("approvedBy", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  loanCustomerIdx: index("loan_customer_idx").on(table.customerId, table.status),
  loanPaymentIdx: index("loan_payment_idx").on(table.nextPaymentDate, table.status),
  loanTenantIdx: index("loan_tenant_idx").on(table.tenantId, table.loanType, table.status),
}));

export const loanRepayments = pgTable("loanRepayments", {
  id: serial("id").primaryKey(),
  repaymentId: varchar("repaymentId", { length: 64 }).notNull().unique(),
  loanId: varchar("loanId", { length: 64 }).notNull(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  principalPortion: doublePrecision("principalPortion").notNull(),
  interestPortion: doublePrecision("interestPortion").notNull(),
  penaltyPortion: doublePrecision("penaltyPortion").default(0).notNull(),
  totalAmount: doublePrecision("totalAmount").notNull(),
  dueDate: timestamp("dueDate").notNull(),
  paidDate: timestamp("paidDate"),
  status: text("status").notNull().default("scheduled"), // scheduled, paid, overdue, partial, waived
  transactionRef: varchar("transactionRef", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  repaymentLoanIdx: index("repayment_loan_idx").on(table.loanId, table.dueDate),
}));

export const transfers = pgTable("transfers", {
  id: serial("id").primaryKey(),
  transferId: varchar("transferId", { length: 64 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  sourceAccountId: varchar("sourceAccountId", { length: 64 }).notNull(),
  destinationAccountId: varchar("destinationAccountId", { length: 64 }),
  destinationBank: varchar("destinationBank", { length: 64 }),
  destinationAccountNumber: varchar("destinationAccountNumber", { length: 32 }),
  beneficiaryName: varchar("beneficiaryName", { length: 191 }),
  amount: doublePrecision("amount").notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("NGN"),
  channel: text("channel").notNull(), // nip, rtgs, internal, mojaloop, swift
  narration: text("narration").notNull(),
  nipSessionId: varchar("nipSessionId", { length: 64 }),
  mojaloopTransferId: varchar("mojaloopTransferId", { length: 64 }),
  status: text("status").notNull().default("pending"), // pending, processing, completed, failed, reversed
  failureReason: text("failureReason"),
  idempotencyKey: varchar("idempotencyKey", { length: 128 }).unique(),
  transferDate: timestamp("transferDate").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  transferDateIdx: index("transfer_date_idx").on(table.transferDate, table.status),
  transferSourceIdx: index("transfer_source_idx").on(table.sourceAccountId, table.createdAt),
  transferIdempotencyIdx: uniqueIndex("transfer_idempotency_idx").on(table.idempotencyKey),
}));

export const settlements = pgTable("settlements", {
  id: serial("id").primaryKey(),
  settlementId: varchar("settlementId", { length: 64 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  windowId: varchar("windowId", { length: 64 }).notNull(),
  model: text("model").notNull(), // dns, rtgs, cross_border
  corridor: varchar("corridor", { length: 64 }),
  totalDebits: doublePrecision("totalDebits").notNull(),
  totalCredits: doublePrecision("totalCredits").notNull(),
  netPosition: doublePrecision("netPosition").notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("NGN"),
  participantCount: integer("participantCount").notNull(),
  transferCount: integer("transferCount").notNull(),
  status: text("status").notNull().default("open"), // open, closed, settling, settled, disputed
  openedAt: timestamp("openedAt").defaultNow().notNull(),
  closedAt: timestamp("closedAt"),
  settledAt: timestamp("settledAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  settlementDateIdx: index("settlement_date_idx").on(table.openedAt, table.status),
}));

export const amlAlerts = pgTable("amlAlerts", {
  id: serial("id").primaryKey(),
  alertId: varchar("alertId", { length: 64 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  customerId: varchar("customerId", { length: 64 }).notNull(),
  entityType: text("entityType").notNull(), // customer, account, transaction
  entityId: varchar("entityId", { length: 64 }).notNull(),
  ruleId: varchar("ruleId", { length: 64 }).notNull(),
  ruleName: varchar("ruleName", { length: 191 }).notNull(),
  riskScore: doublePrecision("riskScore").notNull(),
  severity: text("severity").notNull(), // low, medium, high, critical
  status: text("status").notNull().default("pending"), // pending, investigating, escalated, closed_false_positive, closed_str_filed
  assignedTo: varchar("assignedTo", { length: 128 }),
  notes: text("notes"),
  detectedAt: timestamp("detectedAt").defaultNow().notNull(),
  resolvedAt: timestamp("resolvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  amlPendingRiskIdx: index("aml_pending_risk_idx").on(table.status, table.riskScore),
  amlCustomerIdx: index("aml_customer_idx").on(table.customerId, table.detectedAt),
}));

export const kycVerifications = pgTable("kycVerifications", {
  id: serial("id").primaryKey(),
  verificationId: varchar("verificationId", { length: 64 }).notNull().unique(),
  customerId: varchar("customerId", { length: 64 }).notNull(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  verificationType: text("verificationType").notNull(), // bvn, nin, passport, utility_bill, cac
  documentReference: varchar("documentReference", { length: 128 }),
  provider: varchar("provider", { length: 64 }).notNull(), // nibss, nimc, smile_id, youverify
  providerResponse: jsonb("providerResponse"),
  matchScore: doublePrecision("matchScore"),
  status: text("status").notNull().default("pending"), // pending, verified, failed, expired
  verifiedAt: timestamp("verifiedAt"),
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  kycCustomerIdx: index("kyc_customer_idx").on(table.customerId, table.verifiedAt),
}));

export const fxTrades = pgTable("fxTrades", {
  id: serial("id").primaryKey(),
  tradeId: varchar("tradeId", { length: 64 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  buyCurrency: varchar("buyCurrency", { length: 3 }).notNull(),
  sellCurrency: varchar("sellCurrency", { length: 3 }).notNull(),
  buyAmount: doublePrecision("buyAmount").notNull(),
  sellAmount: doublePrecision("sellAmount").notNull(),
  exchangeRate: doublePrecision("exchangeRate").notNull(),
  tradeType: text("tradeType").notNull(), // spot, forward, swap
  counterparty: varchar("counterparty", { length: 128 }),
  valueDate: timestamp("valueDate").notNull(),
  status: text("status").notNull().default("pending"), // pending, confirmed, settled, cancelled
  traderId: varchar("traderId", { length: 128 }),
  approvedBy: varchar("approvedBy", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  fxValueDateIdx: index("fx_value_date_idx").on(table.valueDate, table.status),
}));

export const nostroAccounts = pgTable("nostroAccounts", {
  id: serial("id").primaryKey(),
  nostroId: varchar("nostroId", { length: 64 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  correspondentBank: varchar("correspondentBank", { length: 191 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  accountNumber: varchar("accountNumber", { length: 64 }).notNull(),
  swiftCode: varchar("swiftCode", { length: 11 }).notNull(),
  balance: doublePrecision("balance").default(0).notNull(),
  lastReconciledAt: timestamp("lastReconciledAt"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const auditTrail = pgTable("auditTrail", {
  id: serial("id").primaryKey(),
  auditId: varchar("auditId", { length: 64 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  entityType: text("entityType").notNull(),
  entityId: varchar("entityId", { length: 64 }).notNull(),
  action: text("action").notNull(), // create, update, delete, approve, reject, login, logout
  actorId: varchar("actorId", { length: 128 }).notNull(),
  actorRole: varchar("actorRole", { length: 64 }).notNull(),
  changes: jsonb("changes"),
  ipAddress: varchar("ipAddress", { length: 45 }),
  userAgent: text("userAgent"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  auditEntityIdx: index("audit_entity_idx").on(table.entityType, table.entityId, table.createdAt),
  auditActorIdx: index("audit_actor_idx").on(table.actorId, table.createdAt),
  auditTenantIdx: index("audit_tenant_idx").on(table.tenantId, table.createdAt),
}));

export const swiftMessages = pgTable("swiftMessages", {
  id: serial("id").primaryKey(),
  messageId: varchar("messageId", { length: 64 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  messageType: varchar("messageType", { length: 8 }).notNull(), // MT103, MT202, MT940, MT950
  direction: text("direction").notNull(), // inbound, outbound
  senderBic: varchar("senderBic", { length: 11 }).notNull(),
  receiverBic: varchar("receiverBic", { length: 11 }).notNull(),
  amount: doublePrecision("amount"),
  currency: varchar("currency", { length: 3 }),
  valueDate: timestamp("valueDate"),
  rawMessage: text("rawMessage").notNull(),
  status: text("status").notNull().default("received"), // received, parsed, processed, failed, acknowledged
  relatedTransferId: varchar("relatedTransferId", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  swiftTypeIdx: index("swift_type_idx").on(table.messageType, table.createdAt),
}));

export const nipTransactions = pgTable("nipTransactions", {
  id: serial("id").primaryKey(),
  nipId: varchar("nipId", { length: 64 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  sessionId: varchar("sessionId", { length: 64 }).notNull().unique(),
  direction: text("direction").notNull(), // inbound, outbound
  sourceBank: varchar("sourceBank", { length: 8 }).notNull(),
  destinationBank: varchar("destinationBank", { length: 8 }).notNull(),
  sourceAccount: varchar("sourceAccount", { length: 20 }).notNull(),
  destinationAccount: varchar("destinationAccount", { length: 20 }).notNull(),
  amount: doublePrecision("amount").notNull(),
  narration: text("narration").notNull(),
  responseCode: varchar("responseCode", { length: 4 }),
  status: text("status").notNull().default("pending"), // pending, successful, failed, reversed
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  nipSessionIdx: uniqueIndex("nip_session_idx").on(table.sessionId),
  nipDateIdx: index("nip_date_idx").on(table.createdAt, table.status),
}));

export const cardTransactions = pgTable("cardTransactions", {
  id: serial("id").primaryKey(),
  cardTxnId: varchar("cardTxnId", { length: 64 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  cardId: varchar("cardId", { length: 64 }).notNull(),
  accountId: varchar("accountId", { length: 64 }).notNull(),
  merchantName: varchar("merchantName", { length: 191 }),
  merchantCategory: varchar("merchantCategory", { length: 8 }),
  amount: doublePrecision("amount").notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("NGN"),
  type: text("type").notNull(), // purchase, withdrawal, refund, reversal
  channel: text("channel").notNull(), // pos, atm, ecommerce, contactless
  authorizationCode: varchar("authorizationCode", { length: 12 }),
  stan: varchar("stan", { length: 12 }),
  rrn: varchar("rrn", { length: 24 }),
  status: text("status").notNull().default("approved"), // approved, declined, reversed, disputed
  declineReason: text("declineReason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  cardTxnCardIdx: index("card_txn_card_idx").on(table.cardId, table.createdAt),
  cardTxnAccountIdx: index("card_txn_account_idx").on(table.accountId, table.createdAt),
}));

export const trialBalances = pgTable("trialBalances", {
  id: serial("id").primaryKey(),
  trialBalanceId: varchar("trialBalanceId", { length: 64 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  glAccountCode: varchar("glAccountCode", { length: 32 }).notNull(),
  periodStart: timestamp("periodStart").notNull(),
  periodEnd: timestamp("periodEnd").notNull(),
  openingBalance: doublePrecision("openingBalance").notNull(),
  totalDebits: doublePrecision("totalDebits").notNull(),
  totalCredits: doublePrecision("totalCredits").notNull(),
  closingBalance: doublePrecision("closingBalance").notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("NGN"),
  status: text("status").notNull().default("draft"), // draft, finalized, audited
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  tbPeriodIdx: index("tb_period_idx").on(table.tenantId, table.periodEnd, table.glAccountCode),
}));

// Type exports for new tables
export type Account = typeof accounts.$inferSelect;
export type InsertAccount = typeof accounts.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = typeof transactions.$inferInsert;
export type JournalEntry = typeof journalEntries.$inferSelect;
export type InsertJournalEntry = typeof journalEntries.$inferInsert;
export type GLAccount = typeof glAccounts.$inferSelect;
export type InsertGLAccount = typeof glAccounts.$inferInsert;
export type Loan = typeof loans.$inferSelect;
export type InsertLoan = typeof loans.$inferInsert;
export type LoanRepayment = typeof loanRepayments.$inferSelect;
export type InsertLoanRepayment = typeof loanRepayments.$inferInsert;
export type Transfer = typeof transfers.$inferSelect;
export type InsertTransfer = typeof transfers.$inferInsert;
export type Settlement = typeof settlements.$inferSelect;
export type InsertSettlement = typeof settlements.$inferInsert;
export type AMLAlert = typeof amlAlerts.$inferSelect;
export type InsertAMLAlert = typeof amlAlerts.$inferInsert;
export type KYCVerification = typeof kycVerifications.$inferSelect;
export type InsertKYCVerification = typeof kycVerifications.$inferInsert;
export type FXTrade = typeof fxTrades.$inferSelect;
export type InsertFXTrade = typeof fxTrades.$inferInsert;
export type NostroAccount = typeof nostroAccounts.$inferSelect;
export type InsertNostroAccount = typeof nostroAccounts.$inferInsert;
export type AuditTrailEntry = typeof auditTrail.$inferSelect;
export type InsertAuditTrailEntry = typeof auditTrail.$inferInsert;
export type SwiftMessage = typeof swiftMessages.$inferSelect;
export type InsertSwiftMessage = typeof swiftMessages.$inferInsert;
export type NIPTransaction = typeof nipTransactions.$inferSelect;
export type InsertNIPTransaction = typeof nipTransactions.$inferInsert;
export type CardTransaction = typeof cardTransactions.$inferSelect;
export type InsertCardTransaction = typeof cardTransactions.$inferInsert;
export type TrialBalance = typeof trialBalances.$inferSelect;
export type InsertTrialBalance = typeof trialBalances.$inferInsert;
