import {
  double,
  int,
  json,
  index,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const tenants = mysqlTable("tenants", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: varchar("tenantId", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 191 }).notNull(),
  onboardingStatus: mysqlEnum("onboardingStatus", ["draft", "active", "restricted"]).notNull(),
  segment: mysqlEnum("segment", ["retail", "operations", "growth"]).notNull(),
  region: varchar("region", { length: 96 }).notNull(),
  enabledModules: json("enabledModules").$type<string[]>().notNull(),
  whiteLabel: json("whiteLabel")
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
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const tenantFeatureFlags = mysqlTable("tenantFeatureFlags", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  featureKey: varchar("featureKey", { length: 96 }).notNull(),
  label: varchar("label", { length: 191 }).notNull(),
  category: mysqlEnum("category", ["onboarding", "payments", "cards", "operations", "compliance", "platform"]).notNull(),
  description: text("description").notNull(),
  enabled: int("enabled").default(0).notNull(),
  rolloutStage: mysqlEnum("rolloutStage", ["pilot", "controlled", "general"]).notNull(),
  adminManaged: int("adminManaged").default(1).notNull(),
  dependsOn: json("dependsOn").$type<string[]>().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  tenantFeatureLookupIdx: uniqueIndex("tenant_feature_lookup_idx").on(table.tenantId, table.featureKey),
  tenantFeatureCategoryIdx: index("tenant_feature_category_idx").on(table.tenantId, table.category, table.enabled),
}));

export const customers = mysqlTable("customers", {
  id: int("id").autoincrement().primaryKey(),
  customerId: varchar("customerId", { length: 64 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  name: varchar("name", { length: 191 }).notNull(),
  segment: varchar("segment", { length: 96 }).notNull(),
  tier: varchar("tier", { length: 64 }).notNull(),
  location: varchar("location", { length: 128 }).notNull(),
  relationshipManager: varchar("relationshipManager", { length: 128 }).notNull(),
  risk: varchar("risk", { length: 64 }).notNull(),
  status: mysqlEnum("status", ["Active", "Pending", "Review", "Dormant"]).notNull(),
  bvn: varchar("bvn", { length: 32 }).notNull(),
  phone: varchar("phone", { length: 32 }).notNull(),
  balance: double("balance").default(0).notNull(),
  lastTouchpointLabel: varchar("lastTouchpointLabel", { length: 128 }).notNull(),
  lastTouchpointAt: timestamp("lastTouchpointAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  customerTenantStatusIdx: index("customer_tenant_status_idx").on(table.tenantId, table.status, table.segment),
  customerManagerTouchpointIdx: index("customer_manager_touchpoint_idx").on(table.relationshipManager, table.lastTouchpointAt),
  customerBvnIdx: uniqueIndex("customer_bvn_idx").on(table.bvn),
}));

export const customerCards = mysqlTable("customerCards", {
  id: int("id").autoincrement().primaryKey(),
  cardId: varchar("cardId", { length: 64 }).notNull().unique(),
  customerId: varchar("customerId", { length: 64 }).notNull(),
  cardType: mysqlEnum("cardType", ["virtual", "physical"]).notNull(),
  brand: mysqlEnum("brand", ["visa", "mastercard"]).notNull(),
  lastFour: varchar("lastFour", { length: 4 }).notNull(),
  expiryDate: varchar("expiryDate", { length: 16 }).notNull(),
  cardHolder: varchar("cardHolder", { length: 191 }).notNull(),
  balance: double("balance").default(0).notNull(),
  isLocked: int("isLocked").default(0).notNull(),
  controls: json("controls").$type<{ online: boolean; atm: boolean; international: boolean }>().notNull(),
  spendingLimits: json("spendingLimits").$type<{ daily: number; atm: number; online: number }>().notNull(),
  colorTone: mysqlEnum("colorTone", ["blue", "graphite"]).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const customerCardEvents = mysqlTable("customerCardEvents", {
  id: int("id").autoincrement().primaryKey(),
  eventId: varchar("eventId", { length: 64 }).notNull().unique(),
  cardId: varchar("cardId", { length: 64 }).notNull(),
  customerId: varchar("customerId", { length: 64 }).notNull(),
  title: varchar("title", { length: 191 }).notNull(),
  detail: text("detail").notNull(),
  severity: mysqlEnum("severity", ["info", "warning", "success"]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const customerSavedBillers = mysqlTable("customerSavedBillers", {
  id: int("id").autoincrement().primaryKey(),
  billerRecordId: varchar("billerRecordId", { length: 64 }).notNull().unique(),
  customerId: varchar("customerId", { length: 64 }).notNull(),
  category: mysqlEnum("category", ["electricity", "water", "internet", "school", "airtime"]).notNull(),
  provider: varchar("provider", { length: 191 }).notNull(),
  billerId: varchar("billerId", { length: 96 }).notNull(),
  customerReference: varchar("customerReference", { length: 128 }).notNull(),
  nickname: varchar("nickname", { length: 128 }).notNull(),
  lastAmount: double("lastAmount").default(0).notNull(),
  verifiedName: varchar("verifiedName", { length: 191 }),
  lastPaidAt: timestamp("lastPaidAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const customerBillPayments = mysqlTable("customerBillPayments", {
  id: int("id").autoincrement().primaryKey(),
  paymentId: varchar("paymentId", { length: 64 }).notNull().unique(),
  customerId: varchar("customerId", { length: 64 }).notNull(),
  category: mysqlEnum("category", ["electricity", "water", "internet", "school", "airtime"]).notNull(),
  provider: varchar("provider", { length: 191 }).notNull(),
  amount: double("amount").default(0).notNull(),
  status: mysqlEnum("status", ["scheduled", "paid", "pending"]).notNull(),
  paidAt: timestamp("paidAt").defaultNow().notNull(),
  reference: varchar("reference", { length: 128 }).notNull(),
  billerId: varchar("billerId", { length: 96 }),
  customerReference: varchar("customerReference", { length: 128 }),
  customerName: varchar("customerName", { length: 191 }),
  scheduledFor: timestamp("scheduledFor"),
  evidenceStatus: mysqlEnum("evidenceStatus", ["verified", "ready", "scheduled"]),
  channel: mysqlEnum("channel", ["self-service", "saved-biller", "operator-assisted"]),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const customerTransfers = mysqlTable("customerTransfers", {
  id: int("id").autoincrement().primaryKey(),
  transferId: varchar("transferId", { length: 64 }).notNull().unique(),
  customerId: varchar("customerId", { length: 64 }).notNull(),
  beneficiaryId: varchar("beneficiaryId", { length: 64 }),
  beneficiaryName: varchar("beneficiaryName", { length: 191 }).notNull(),
  amount: double("amount").default(0).notNull(),
  narration: text("narration"),
  transferType: mysqlEnum("transferType", ["bank", "wallet", "workflow"]).notNull(),
  status: mysqlEnum("status", ["draft", "otp_pending", "submitted", "completed", "failed"]).notNull(),
  bankCode: varchar("bankCode", { length: 32 }),
  bankName: varchar("bankName", { length: 96 }),
  accountNumber: varchar("accountNumber", { length: 32 }),
  accountName: varchar("accountName", { length: 191 }),
  workflowId: varchar("workflowId", { length: 64 }),
  otpReference: varchar("otpReference", { length: 64 }),
  otpIssuedAt: timestamp("otpIssuedAt"),
  confirmedAt: timestamp("confirmedAt"),
  approvalState: mysqlEnum("approvalState", ["not_required", "pending_review", "approved"]),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  transferCustomerStatusIdx: index("transfer_customer_status_idx").on(table.customerId, table.status, table.createdAt),
  transferApprovalIdx: index("transfer_approval_idx").on(table.customerId, table.approvalState, table.updatedAt),
  transferOtpIdx: index("transfer_otp_idx").on(table.otpReference, table.status),
}));

export const customerApprovals = mysqlTable("customerApprovals", {
  id: int("id").autoincrement().primaryKey(),
  approvalId: varchar("approvalId", { length: 64 }).notNull().unique(),
  customerId: varchar("customerId", { length: 64 }).notNull(),
  entityType: mysqlEnum("entityType", ["card_control", "scheduled_bill", "statement_export"]).notNull(),
  entityId: varchar("entityId", { length: 64 }).notNull(),
  title: varchar("title", { length: 191 }).notNull(),
  detail: text("detail").notNull(),
  route: varchar("route", { length: 191 }).notNull(),
  state: mysqlEnum("state", ["pending", "approved", "rejected"]).notNull(),
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

export const customerStatementExports = mysqlTable("customerStatementExports", {
  id: int("id").autoincrement().primaryKey(),
  exportRequestId: varchar("exportRequestId", { length: 64 }).notNull().unique(),
  customerId: varchar("customerId", { length: 64 }).notNull(),
  exportJobId: varchar("exportJobId", { length: 64 }).notNull(),
  format: mysqlEnum("format", ["csv", "xlsx"]).notNull(),
  rowCount: int("rowCount").default(0).notNull(),
  title: varchar("title", { length: 191 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const customerStatements = mysqlTable("customerStatements", {
  id: int("id").autoincrement().primaryKey(),
  statementId: varchar("statementId", { length: 64 }).notNull().unique(),
  customerId: varchar("customerId", { length: 64 }).notNull(),
  title: varchar("title", { length: 191 }).notNull(),
  detail: text("detail").notNull(),
  amount: double("amount").default(0).notNull(),
  direction: mysqlEnum("direction", ["credit", "debit"]).notNull(),
  statementType: mysqlEnum("statementType", ["transfer", "bill_payment", "workflow", "deposit"]).notNull(),
  status: mysqlEnum("status", ["completed", "pending", "prepared"]).notNull(),
  occurredAt: timestamp("occurredAt").defaultNow().notNull(),
  reference: varchar("reference", { length: 128 }),
  category: varchar("category", { length: 96 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  statementCustomerOccurredIdx: index("statement_customer_occurred_idx").on(table.customerId, table.occurredAt),
  statementCustomerTypeIdx: index("statement_customer_type_idx").on(table.customerId, table.statementType, table.status),
}));

export const customerNotifications = mysqlTable("customerNotifications", {
  id: int("id").autoincrement().primaryKey(),
  notificationId: varchar("notificationId", { length: 64 }).notNull().unique(),
  customerId: varchar("customerId", { length: 64 }).notNull(),
  title: varchar("title", { length: 191 }).notNull(),
  message: text("message").notNull(),
  notificationType: mysqlEnum("notificationType", ["info", "success", "warning", "error"]).notNull(),
  isRead: int("isRead").default(0).notNull(),
  actionUrl: varchar("actionUrl", { length: 191 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  notificationCustomerReadIdx: index("notification_customer_read_idx").on(table.customerId, table.isRead, table.createdAt),
}));

export const customerSessionPreferences = mysqlTable("customerSessionPreferences", {
  id: int("id").autoincrement().primaryKey(),
  actorId: varchar("actorId", { length: 96 }).notNull(),
  actorRole: varchar("actorRole", { length: 64 }).notNull(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  activeCustomerId: varchar("activeCustomerId", { length: 64 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  sessionActorLookupIdx: uniqueIndex("session_actor_lookup_idx").on(table.actorId, table.actorRole, table.tenantId),
}));

export const workflowCases = mysqlTable("workflowCases", {
  id: int("id").autoincrement().primaryKey(),
  workflowId: varchar("workflowId", { length: 64 }).notNull().unique(),
  customer: varchar("customer", { length: 191 }).notNull(),
  product: varchar("product", { length: 128 }).notNull(),
  stage: varchar("stage", { length: 128 }).notNull(),
  status: varchar("status", { length: 64 }).notNull(),
  channel: varchar("channel", { length: 96 }).notNull(),
  amount: double("amount").default(0).notNull(),
  nextAction: text("nextAction").notNull(),
  slaHours: int("slaHours").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  workflowStageStatusIdx: index("workflow_stage_status_idx").on(table.stage, table.status, table.updatedAt),
  workflowProductStatusIdx: index("workflow_product_status_idx").on(table.product, table.status, table.createdAt),
}));

export const operatorActions = mysqlTable("operatorActions", {
  id: int("id").autoincrement().primaryKey(),
  actionId: varchar("actionId", { length: 64 }).notNull().unique(),
  domainKey: varchar("domainKey", { length: 96 }).notNull(),
  title: varchar("title", { length: 191 }).notNull(),
  detail: text("detail").notNull(),
  owner: varchar("owner", { length: 128 }).notNull(),
  dueAt: timestamp("dueAt").notNull(),
  route: varchar("route", { length: 191 }).notNull(),
  status: mysqlEnum("status", ["Pending", "In progress", "Done"]).notNull(),
  roles: json("roles").$type<string[]>().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  operatorDomainStatusIdx: index("operator_domain_status_idx").on(table.domainKey, table.status, table.dueAt),
  operatorRouteStatusIdx: index("operator_route_status_idx").on(table.route, table.status, table.dueAt),
}));

export const auditEntries = mysqlTable("auditEntries", {
  id: int("id").autoincrement().primaryKey(),
  auditId: varchar("auditId", { length: 64 }).notNull().unique(),
  timestampAt: timestamp("timestampAt").defaultNow().notNull(),
  actorRole: varchar("actorRole", { length: 64 }).notNull(),
  actorId: varchar("actorId", { length: 96 }).notNull(),
  entityType: varchar("entityType", { length: 96 }).notNull(),
  entityId: varchar("entityId", { length: 96 }).notNull(),
  action: varchar("action", { length: 96 }).notNull(),
  outcome: text("outcome").notNull(),
  severity: mysqlEnum("severity", ["info", "warning", "critical"]).notNull(),
  route: varchar("route", { length: 191 }).notNull(),
  middleware: json("middleware").$type<string[]>().notNull(),
  detail: text("detail").notNull(),
}, (table) => ({
  auditRouteTimestampIdx: index("audit_route_timestamp_idx").on(table.route, table.timestampAt),
  auditSeverityTimestampIdx: index("audit_severity_timestamp_idx").on(table.severity, table.timestampAt),
}));

export const exportJobs = mysqlTable("exportJobs", {
  id: int("id").autoincrement().primaryKey(),
  exportJobId: varchar("exportJobId", { length: 64 }).notNull().unique(),
  domainKey: varchar("domainKey", { length: 96 }).notNull(),
  title: varchar("title", { length: 191 }).notNull(),
  format: mysqlEnum("format", ["csv", "json", "xlsx"]).notNull(),
  status: mysqlEnum("status", ["Ready", "Queued", "Failed"]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  requestedByRole: varchar("requestedByRole", { length: 64 }).notNull(),
  route: varchar("route", { length: 191 }).notNull(),
  rowCount: int("rowCount").default(0).notNull(),
  approvalState: mysqlEnum("approvalState", ["Signed", "Pending review"]).notNull(),
  approvalSignature: varchar("approvalSignature", { length: 191 }).notNull(),
  downloadUrl: varchar("downloadUrl", { length: 255 }).notNull(),
  retainedUntil: timestamp("retainedUntil"),
  reportVersion: varchar("reportVersion", { length: 96 }),
  approvalChain: json("approvalChain").$type<string[]>().notNull(),
  signedBy: json("signedBy").$type<string[]>().notNull(),
}, (table) => ({
  exportDomainApprovalIdx: index("export_domain_approval_idx").on(table.domainKey, table.approvalState, table.createdAt),
  exportRouteStatusIdx: index("export_route_status_idx").on(table.route, table.status, table.createdAt),
}));

export const billingAccounts = mysqlTable("billingAccounts", {
  id: int("id").autoincrement().primaryKey(),
  billingAccountId: varchar("billingAccountId", { length: 64 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  accountName: varchar("accountName", { length: 191 }).notNull(),
  billingModel: mysqlEnum("billingModel", ["subscription", "usage", "hybrid", "revenue_share"]).notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  status: mysqlEnum("status", ["draft", "active", "suspended", "closed"]).notNull(),
  contractStartAt: timestamp("contractStartAt").notNull(),
  contractEndAt: timestamp("contractEndAt"),
  defaultRateCardId: varchar("defaultRateCardId", { length: 64 }).notNull(),
  minimumCommitAmount: double("minimumCommitAmount").default(0).notNull(),
  defaultBillingPeriodType: mysqlEnum("defaultBillingPeriodType", ["monthly", "quarterly", "semi_annual", "annual", "custom"]).default("monthly").notNull(),
  invoiceDueDays: int("invoiceDueDays").default(14).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  billingAccountTenantIdx: index("billing_account_tenant_idx").on(table.tenantId, table.status),
}));

export const billingRateCards = mysqlTable("billingRateCards", {
  id: int("id").autoincrement().primaryKey(),
  rateCardId: varchar("rateCardId", { length: 64 }).notNull().unique(),
  billingAccountId: varchar("billingAccountId", { length: 64 }),
  name: varchar("name", { length: 191 }).notNull(),
  version: int("version").default(1).notNull(),
  status: mysqlEnum("status", ["draft", "approved", "active", "retired"]).notNull(),
  effectiveFrom: timestamp("effectiveFrom").notNull(),
  effectiveTo: timestamp("effectiveTo"),
  pricingCurrency: varchar("pricingCurrency", { length: 3 }).notNull(),
  createdBy: varchar("createdBy", { length: 96 }).notNull(),
  approvalState: mysqlEnum("approvalState", ["pending", "approved", "rejected"]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  billingRateCardLookupIdx: index("billing_rate_card_lookup_idx").on(table.billingAccountId, table.status, table.effectiveFrom),
}));

export const billingRateCardLines = mysqlTable("billingRateCardLines", {
  id: int("id").autoincrement().primaryKey(),
  rateCardLineId: varchar("rateCardLineId", { length: 64 }).notNull().unique(),
  rateCardId: varchar("rateCardId", { length: 64 }).notNull(),
  meterKey: varchar("meterKey", { length: 96 }).notNull(),
  productKey: varchar("productKey", { length: 96 }).notNull(),
  chargeType: mysqlEnum("chargeType", ["flat", "per_unit", "tiered", "minimum", "percentage"]).notNull(),
  unitPrice: double("unitPrice").default(0).notNull(),
  includedUnits: int("includedUnits").default(0).notNull(),
  tierStart: int("tierStart"),
  tierEnd: int("tierEnd"),
  minimumCharge: double("minimumCharge"),
  maximumCharge: double("maximumCharge"),
  pricingFormula: json("pricingFormula").$type<Record<string, unknown>>(),
  settlementLedgerCode: varchar("settlementLedgerCode", { length: 96 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  billingRateCardLineLookupIdx: index("billing_rate_card_line_lookup_idx").on(table.rateCardId, table.meterKey, table.productKey),
}));

export const billingUsageEvents = mysqlTable("billingUsageEvents", {
  id: int("id").autoincrement().primaryKey(),
  usageEventId: varchar("usageEventId", { length: 64 }).notNull().unique(),
  idempotencyKey: varchar("idempotencyKey", { length: 128 }).notNull(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  billingAccountId: varchar("billingAccountId", { length: 64 }).notNull(),
  sourceService: varchar("sourceService", { length: 96 }).notNull(),
  sourceEventType: varchar("sourceEventType", { length: 96 }).notNull(),
  meterKey: varchar("meterKey", { length: 96 }).notNull(),
  productKey: varchar("productKey", { length: 96 }).notNull(),
  quantity: int("quantity").default(0).notNull(),
  unitAmount: double("unitAmount"),
  currency: varchar("currency", { length: 3 }).notNull(),
  eventTimestamp: timestamp("eventTimestamp").notNull(),
  ingestedAt: timestamp("ingestedAt").defaultNow().notNull(),
  correlationId: varchar("correlationId", { length: 128 }),
  actorId: varchar("actorId", { length: 96 }),
  resourceId: varchar("resourceId", { length: 96 }),
  payload: json("payload").$type<Record<string, unknown>>().notNull(),
  status: mysqlEnum("status", ["pending", "rated", "ignored", "failed"]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  billingUsageTenantIdx: index("billing_usage_tenant_idx").on(table.tenantId, table.eventTimestamp),
  billingUsageMeterIdx: index("billing_usage_meter_idx").on(table.meterKey, table.productKey, table.eventTimestamp),
  billingUsageIdempotencyIdx: uniqueIndex("billing_usage_idempotency_idx").on(table.idempotencyKey),
}));

export const billingRatedEvents = mysqlTable("billingRatedEvents", {
  id: int("id").autoincrement().primaryKey(),
  ratedEventId: varchar("ratedEventId", { length: 64 }).notNull().unique(),
  usageEventId: varchar("usageEventId", { length: 64 }).notNull(),
  rateCardId: varchar("rateCardId", { length: 64 }).notNull(),
  rateCardLineId: varchar("rateCardLineId", { length: 64 }).notNull(),
  billingPeriodKey: varchar("billingPeriodKey", { length: 32 }).notNull(),
  quantityRated: int("quantityRated").default(0).notNull(),
  billableUnits: double("billableUnits").default(0).notNull(),
  amountAccrued: double("amountAccrued").default(0).notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  ratingExplanation: json("ratingExplanation").$type<Record<string, unknown>>().notNull(),
  ratedAt: timestamp("ratedAt").defaultNow().notNull(),
}, (table) => ({
  billingRatedEventLookupIdx: index("billing_rated_event_lookup_idx").on(table.billingPeriodKey, table.rateCardId, table.ratedAt),
}));

export const billingAccrualSnapshots = mysqlTable("billingAccrualSnapshots", {
  id: int("id").autoincrement().primaryKey(),
  accrualSnapshotId: varchar("accrualSnapshotId", { length: 64 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  billingAccountId: varchar("billingAccountId", { length: 64 }).notNull(),
  billingPeriodKey: varchar("billingPeriodKey", { length: 32 }).notNull(),
  meterKey: varchar("meterKey", { length: 96 }).notNull(),
  productKey: varchar("productKey", { length: 96 }).notNull(),
  ratedEventCount: int("ratedEventCount").default(0).notNull(),
  usageQuantity: int("usageQuantity").default(0).notNull(),
  accruedAmount: double("accruedAmount").default(0).notNull(),
  unratedEventCount: int("unratedEventCount").default(0).notNull(),
  lastUsageAt: timestamp("lastUsageAt"),
  lastRatedAt: timestamp("lastRatedAt"),
  snapshotStatus: mysqlEnum("snapshotStatus", ["healthy", "lagging", "review"]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  billingAccrualTenantIdx: index("billing_accrual_tenant_idx").on(table.tenantId, table.billingPeriodKey, table.accruedAmount),
  billingAccrualMeterIdx: index("billing_accrual_meter_idx").on(table.meterKey, table.productKey, table.billingPeriodKey),
}));

export const billingContractOverrides = mysqlTable("billingContractOverrides", {
  id: int("id").autoincrement().primaryKey(),
  contractOverrideId: varchar("contractOverrideId", { length: 64 }).notNull().unique(),
  billingAccountId: varchar("billingAccountId", { length: 64 }).notNull(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  overrideType: mysqlEnum("overrideType", ["unit_price", "included_units", "minimum_commit", "billing_model", "billing_period"]).notNull(),
  meterKey: varchar("meterKey", { length: 96 }),
  productKey: varchar("productKey", { length: 96 }),
  valueNumber: double("valueNumber"),
  valueText: varchar("valueText", { length: 96 }),
  effectiveFrom: timestamp("effectiveFrom").notNull(),
  effectiveTo: timestamp("effectiveTo"),
  status: mysqlEnum("status", ["draft", "active", "expired"]).notNull(),
  createdBy: varchar("createdBy", { length: 96 }).notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  billingContractOverrideLookupIdx: index("billing_contract_override_lookup_idx").on(table.billingAccountId, table.overrideType, table.status, table.effectiveFrom),
}));

export const billingDiscountRules = mysqlTable("billingDiscountRules", {
  id: int("id").autoincrement().primaryKey(),
  discountRuleId: varchar("discountRuleId", { length: 64 }).notNull().unique(),
  billingAccountId: varchar("billingAccountId", { length: 64 }).notNull(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  name: varchar("name", { length: 191 }).notNull(),
  discountType: mysqlEnum("discountType", ["percentage", "fixed", "threshold_percentage"]).notNull(),
  meterKey: varchar("meterKey", { length: 96 }),
  productKey: varchar("productKey", { length: 96 }),
  percentage: double("percentage"),
  fixedAmount: double("fixedAmount"),
  thresholdAmount: double("thresholdAmount"),
  effectiveFrom: timestamp("effectiveFrom").notNull(),
  effectiveTo: timestamp("effectiveTo"),
  status: mysqlEnum("status", ["draft", "active", "expired"]).notNull(),
  createdBy: varchar("createdBy", { length: 96 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  billingDiscountRuleLookupIdx: index("billing_discount_rule_lookup_idx").on(table.billingAccountId, table.status, table.effectiveFrom),
}));

export const billingRevenueShareRules = mysqlTable("billingRevenueShareRules", {
  id: int("id").autoincrement().primaryKey(),
  revenueShareRuleId: varchar("revenueShareRuleId", { length: 64 }).notNull().unique(),
  billingAccountId: varchar("billingAccountId", { length: 64 }).notNull(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  name: varchar("name", { length: 191 }).notNull(),
  target: mysqlEnum("target", ["platform", "partner_bank", "aggregator", "reseller"]).notNull(),
  percentage: double("percentage").default(0).notNull(),
  beneficiaryName: varchar("beneficiaryName", { length: 191 }).notNull(),
  settlementLedgerCode: varchar("settlementLedgerCode", { length: 96 }),
  effectiveFrom: timestamp("effectiveFrom").notNull(),
  effectiveTo: timestamp("effectiveTo"),
  status: mysqlEnum("status", ["draft", "active", "expired"]).notNull(),
  createdBy: varchar("createdBy", { length: 96 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  billingRevenueShareLookupIdx: index("billing_revenue_share_lookup_idx").on(table.billingAccountId, table.status, table.effectiveFrom),
}));

export const billingInvoices = mysqlTable("billingInvoices", {
  id: int("id").autoincrement().primaryKey(),
  billingInvoiceId: varchar("billingInvoiceId", { length: 64 }).notNull().unique(),
  invoiceNumber: varchar("invoiceNumber", { length: 96 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  billingAccountId: varchar("billingAccountId", { length: 64 }).notNull(),
  billingPeriodKey: varchar("billingPeriodKey", { length: 32 }).notNull(),
  billingPeriodType: mysqlEnum("billingPeriodType", ["monthly", "quarterly", "semi_annual", "annual", "custom"]).notNull(),
  periodStartAt: timestamp("periodStartAt").notNull(),
  periodEndAt: timestamp("periodEndAt").notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  subtotalAmount: double("subtotalAmount").default(0).notNull(),
  discountAmount: double("discountAmount").default(0).notNull(),
  revenueShareAmount: double("revenueShareAmount").default(0).notNull(),
  minimumCommitAdjustment: double("minimumCommitAdjustment").default(0).notNull(),
  taxAmount: double("taxAmount").default(0).notNull(),
  totalAmount: double("totalAmount").default(0).notNull(),
  status: mysqlEnum("status", ["draft", "pending_approval", "approved", "rejected", "issued", "paid", "void"]).notNull(),
  approvalStatus: mysqlEnum("approvalStatus", ["pending", "approved", "rejected", "skipped"]).notNull(),
  generatedAt: timestamp("generatedAt").defaultNow().notNull(),
  dueAt: timestamp("dueAt").notNull(),
  approvalStepCount: int("approvalStepCount").default(0).notNull(),
  issuedAt: timestamp("issuedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  billingInvoiceLookupIdx: index("billing_invoice_lookup_idx").on(table.billingAccountId, table.billingPeriodKey, table.status),
}));

export const billingInvoiceLines = mysqlTable("billingInvoiceLines", {
  id: int("id").autoincrement().primaryKey(),
  billingInvoiceLineId: varchar("billingInvoiceLineId", { length: 96 }).notNull().unique(),
  billingInvoiceId: varchar("billingInvoiceId", { length: 64 }).notNull(),
  lineType: mysqlEnum("lineType", ["usage", "discount", "revenue_share", "minimum_commit", "tax"]).notNull(),
  meterKey: varchar("meterKey", { length: 96 }),
  productKey: varchar("productKey", { length: 96 }),
  description: varchar("description", { length: 191 }).notNull(),
  quantity: double("quantity").default(0).notNull(),
  unitPrice: double("unitPrice").default(0).notNull(),
  amount: double("amount").default(0).notNull(),
  metadata: json("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  billingInvoiceLineLookupIdx: index("billing_invoice_line_lookup_idx").on(table.billingInvoiceId, table.lineType),
}));

export const billingInvoiceApprovals = mysqlTable("billingInvoiceApprovals", {
  id: int("id").autoincrement().primaryKey(),
  billingInvoiceApprovalId: varchar("billingInvoiceApprovalId", { length: 96 }).notNull().unique(),
  billingInvoiceId: varchar("billingInvoiceId", { length: 64 }).notNull(),
  stageKey: varchar("stageKey", { length: 96 }).notNull(),
  actorRole: mysqlEnum("actorRole", ["operations", "treasury", "compliance", "branch"]).notNull(),
  status: mysqlEnum("status", ["pending", "approved", "rejected", "skipped"]).notNull(),
  actedAt: timestamp("actedAt"),
  note: text("note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  billingInvoiceApprovalLookupIdx: index("billing_invoice_approval_lookup_idx").on(table.billingInvoiceId, table.status, table.actorRole),
}));

export const partnerOnboardingRecords = mysqlTable("partnerOnboardingRecords", {
  id: int("id").autoincrement().primaryKey(),
  partnerId: varchar("partnerId", { length: 64 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  partnerName: varchar("partnerName", { length: 191 }).notNull(),
  legalEntity: varchar("legalEntity", { length: 191 }).notNull(),
  partnerType: mysqlEnum("partnerType", ["mfb", "fintech", "cooperative", "agency", "enterprise"]).notNull(),
  region: varchar("region", { length: 96 }).notNull(),
  stage: mysqlEnum("stage", ["draft", "submitted", "compliance_review", "commercial_review", "operations_review", "approved", "provisioning", "launch_ready", "launched"]).notNull(),
  requestedModules: json("requestedModules").$type<string[]>().notNull(),
  primaryContact: json("primaryContact")
    .$type<{ name: string; role: string; email: string; phone: string }>()
    .notNull(),
  operationsContact: json("operationsContact")
    .$type<{ name: string; role: string; email: string; phone: string }>()
    .notNull(),
  commercial: json("commercial")
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
  compliance: json("compliance")
    .$type<{
      kybStatus: "not_started" | "in_review" | "approved" | "rejected";
      requiredDocumentCount: number;
      submittedDocumentCount: number;
      riskRating: "low" | "medium" | "high";
      notes?: string;
      lastReviewedAt?: string;
    }>()
    .notNull(),
  branding: json("branding")
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
  checklist: json("checklist")
    .$type<Array<{ key: string; label: string; owner: "partner" | "compliance" | "operations"; completed: boolean }>>()
    .notNull(),
  blockers: json("blockers").$type<string[]>().notNull(),
  readinessScore: int("readinessScore").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  submittedAt: timestamp("submittedAt"),
  launchedAt: timestamp("launchedAt"),
  lastSubmittedBy: varchar("lastSubmittedBy", { length: 96 }),
}, (table) => ({
  partnerTenantStageIdx: index("partner_tenant_stage_idx").on(table.tenantId, table.stage, table.updatedAt),
  partnerReadinessIdx: index("partner_readiness_idx").on(table.stage, table.readinessScore),
}));

export const partnerApprovalRecords = mysqlTable("partnerApprovalRecords", {
  id: int("id").autoincrement().primaryKey(),
  approvalId: varchar("approvalId", { length: 64 }).notNull().unique(),
  partnerId: varchar("partnerId", { length: 64 }).notNull(),
  stage: mysqlEnum("stage", ["compliance_review", "commercial_review", "operations_review", "launch_signoff"]).notNull(),
  title: varchar("title", { length: 191 }).notNull(),
  detail: text("detail").notNull(),
  state: mysqlEnum("state", ["pending", "approved", "rejected"]).notNull(),
  requiredRole: mysqlEnum("requiredRole", ["branch", "operations", "treasury", "compliance"]).notNull(),
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

export const farmers = mysqlTable("farmers", {
  id: int("id").autoincrement().primaryKey(),
  farmerId: varchar("farmerId", { length: 32 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  bvn: varchar("bvn", { length: 11 }).notNull(),
  phone: varchar("phone", { length: 15 }).notNull(),
  region: varchar("region", { length: 100 }).notNull(),
  localGovernment: varchar("localGovernment", { length: 100 }).notNull(),
  farmSizeHectares: double("farmSizeHectares").notNull(),
  primaryCrop: varchar("primaryCrop", { length: 100 }).notNull(),
  secondaryCrops: json("secondaryCrops").$type<string[]>().notNull(),
  cooperativeId: varchar("cooperativeId", { length: 64 }),
  cooperativeName: varchar("cooperativeName", { length: 200 }),
  bankAccountNumber: varchar("bankAccountNumber", { length: 20 }),
  riskScore: double("riskScore").notNull(),
  riskTier: varchar("riskTier", { length: 20 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  geoCoordinates: json("geoCoordinates").$type<{ latitude: number; longitude: number }>(),
  registrationChannel: varchar("registrationChannel", { length: 50 }).notNull().default("platform"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("farmers_tenant_idx").on(table.tenantId),
  index("farmers_region_idx").on(table.region),
]);

export const agriLoans = mysqlTable("agriLoans", {
  id: int("id").autoincrement().primaryKey(),
  loanId: varchar("loanId", { length: 32 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  farmerId: varchar("farmerId", { length: 32 }).notNull(),
  loanType: varchar("loanType", { length: 50 }).notNull(),
  productCode: varchar("productCode", { length: 50 }).notNull(),
  principalAmount: double("principalAmount").notNull(),
  interestRateBps: int("interestRateBps").notNull(),
  tenorMonths: int("tenorMonths").notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("NGN"),
  purpose: text("purpose").notNull(),
  collateralType: varchar("collateralType", { length: 100 }).notNull(),
  collateralValue: double("collateralValue").notNull(),
  cropCycle: varchar("cropCycle", { length: 50 }).notNull(),
  expectedHarvestDate: varchar("expectedHarvestDate", { length: 20 }).notNull(),
  disbursementDate: varchar("disbursementDate", { length: 30 }),
  maturityDate: varchar("maturityDate", { length: 30 }),
  outstandingBalance: double("outstandingBalance").notNull(),
  totalRepaid: double("totalRepaid").notNull().default(0),
  status: varchar("status", { length: 30 }).notNull().default("pending_approval"),
  approvalStatus: varchar("approvalStatus", { length: 30 }).notNull().default("pending"),
  riskGrade: varchar("riskGrade", { length: 5 }).notNull(),
  repaymentSchedule: json("repaymentSchedule").$type<object[]>().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("agriLoans_tenant_idx").on(table.tenantId),
  index("agriLoans_farmer_idx").on(table.farmerId),
]);

export const cropInsurancePolicies = mysqlTable("cropInsurancePolicies", {
  id: int("id").autoincrement().primaryKey(),
  policyId: varchar("policyId", { length: 32 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  farmerId: varchar("farmerId", { length: 32 }).notNull(),
  policyType: varchar("policyType", { length: 50 }).notNull(),
  cropCovered: varchar("cropCovered", { length: 100 }).notNull(),
  coverageAreaHectares: double("coverageAreaHectares").notNull(),
  sumInsured: double("sumInsured").notNull(),
  premiumAmount: double("premiumAmount").notNull(),
  premiumFrequency: varchar("premiumFrequency", { length: 20 }).notNull().default("annual"),
  policyStart: varchar("policyStart", { length: 20 }).notNull(),
  policyEnd: varchar("policyEnd", { length: 20 }).notNull(),
  weatherTrigger: json("weatherTrigger").$type<object>(),
  claims: json("claims").$type<object[]>().notNull(),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  underwriter: varchar("underwriter", { length: 200 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("cropIns_tenant_idx").on(table.tenantId),
  index("cropIns_farmer_idx").on(table.farmerId),
]);

export const valueChainContracts = mysqlTable("valueChainContracts", {
  id: int("id").autoincrement().primaryKey(),
  contractId: varchar("contractId", { length: 32 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  contractType: varchar("contractType", { length: 50 }).notNull(),
  buyerName: varchar("buyerName", { length: 200 }).notNull(),
  buyerId: varchar("buyerId", { length: 64 }).notNull(),
  sellerFarmerId: varchar("sellerFarmerId", { length: 32 }).notNull(),
  commodity: varchar("commodity", { length: 100 }).notNull(),
  quantityTonnes: double("quantityTonnes").notNull(),
  pricePerTonne: double("pricePerTonne").notNull(),
  totalValue: double("totalValue").notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("NGN"),
  deliveryLocation: varchar("deliveryLocation", { length: 200 }).notNull(),
  deliveryDeadline: varchar("deliveryDeadline", { length: 20 }).notNull(),
  warehouseReceiptId: varchar("warehouseReceiptId", { length: 32 }),
  qualityGrade: varchar("qualityGrade", { length: 20 }).notNull().default("Grade A"),
  milestones: json("milestones").$type<object[]>().notNull(),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("vcc_tenant_idx").on(table.tenantId),
  index("vcc_seller_idx").on(table.sellerFarmerId),
]);

// ── Teller Operations ──

export const tellerSessions = mysqlTable("tellerSessions", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: varchar("sessionId", { length: 32 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  tellerId: varchar("tellerId", { length: 64 }).notNull(),
  tellerName: varchar("tellerName", { length: 200 }).notNull(),
  branchCode: varchar("branchCode", { length: 20 }).notNull(),
  branchName: varchar("branchName", { length: 200 }).notNull(),
  windowNumber: int("windowNumber").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("open"),
  openedAt: varchar("openedAt", { length: 30 }).notNull(),
  closedAt: varchar("closedAt", { length: 30 }),
  openingBalance: double("openingBalance").notNull(),
  currentBalance: double("currentBalance").notNull(),
  transactionCount: int("transactionCount").notNull().default(0),
  cashDrawer: json("cashDrawer").$type<object>().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("teller_tenant_idx").on(table.tenantId),
  index("teller_branch_idx").on(table.branchCode),
]);

export const tellerTransactions = mysqlTable("tellerTransactions", {
  id: int("id").autoincrement().primaryKey(),
  txnId: varchar("txnId", { length: 32 }).notNull().unique(),
  sessionId: varchar("sessionId", { length: 32 }).notNull(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  txnType: varchar("txnType", { length: 30 }).notNull(),
  customerId: varchar("customerId", { length: 64 }).notNull(),
  amount: double("amount").notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("NGN"),
  reference: varchar("reference", { length: 100 }),
  status: varchar("status", { length: 20 }).notNull().default("completed"),
  processedAt: varchar("processedAt", { length: 30 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("ttxn_session_idx").on(table.sessionId),
  index("ttxn_tenant_idx").on(table.tenantId),
]);

export const vaultOperations = mysqlTable("vaultOperations", {
  id: int("id").autoincrement().primaryKey(),
  operationId: varchar("operationId", { length: 32 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  operationType: varchar("operationType", { length: 30 }).notNull(),
  fromLocation: varchar("fromLocation", { length: 100 }).notNull(),
  toLocation: varchar("toLocation", { length: 100 }).notNull(),
  amount: double("amount").notNull(),
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

export const murabahaContracts = mysqlTable("murabahaContracts", {
  id: int("id").autoincrement().primaryKey(),
  contractId: varchar("contractId", { length: 32 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  customerId: varchar("customerId", { length: 64 }).notNull(),
  customerName: varchar("customerName", { length: 200 }).notNull(),
  assetDescription: text("assetDescription").notNull(),
  assetCategory: varchar("assetCategory", { length: 50 }).notNull(),
  costPrice: double("costPrice").notNull(),
  profitMarginPct: double("profitMarginPct").notNull(),
  sellingPrice: double("sellingPrice").notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("NGN"),
  tenorMonths: int("tenorMonths").notNull(),
  instalmentAmount: double("instalmentAmount").notNull(),
  totalPaid: double("totalPaid").notNull().default(0),
  outstandingBalance: double("outstandingBalance").notNull(),
  disbursementDate: varchar("disbursementDate", { length: 30 }),
  maturityDate: varchar("maturityDate", { length: 30 }),
  status: varchar("status", { length: 30 }).notNull().default("pending_sharia_review"),
  shariaCompliance: varchar("shariaCompliance", { length: 30 }).notNull(),
  shariaBoardReference: text("shariaBoardReference"),
  instalmentSchedule: json("instalmentSchedule").$type<object[]>().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("murabaha_tenant_idx").on(table.tenantId),
  index("murabaha_customer_idx").on(table.customerId),
]);

export const ijaraContracts = mysqlTable("ijaraContracts", {
  id: int("id").autoincrement().primaryKey(),
  contractId: varchar("contractId", { length: 32 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  customerId: varchar("customerId", { length: 64 }).notNull(),
  customerName: varchar("customerName", { length: 200 }).notNull(),
  assetDescription: text("assetDescription").notNull(),
  assetCategory: varchar("assetCategory", { length: 50 }).notNull(),
  assetValue: double("assetValue").notNull(),
  rentalAmount: double("rentalAmount").notNull(),
  rentalFrequency: varchar("rentalFrequency", { length: 20 }).notNull().default("monthly"),
  currency: varchar("currency", { length: 3 }).notNull().default("NGN"),
  leaseStart: varchar("leaseStart", { length: 20 }).notNull(),
  leaseEnd: varchar("leaseEnd", { length: 20 }).notNull(),
  tenorMonths: int("tenorMonths").notNull(),
  residualValue: double("residualValue").notNull(),
  purchaseOption: int("purchaseOption").notNull().default(1),
  purchasePrice: double("purchasePrice"),
  totalRentPaid: double("totalRentPaid").notNull().default(0),
  status: varchar("status", { length: 30 }).notNull().default("active"),
  shariaCompliance: varchar("shariaCompliance", { length: 30 }).notNull(),
  maintenanceResponsibility: varchar("maintenanceResponsibility", { length: 20 }).notNull().default("lessor"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("ijara_tenant_idx").on(table.tenantId),
  index("ijara_customer_idx").on(table.customerId),
]);

export const mudarabahContracts = mysqlTable("mudarabahContracts", {
  id: int("id").autoincrement().primaryKey(),
  contractId: varchar("contractId", { length: 32 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  investorId: varchar("investorId", { length: 64 }).notNull(),
  investorName: varchar("investorName", { length: 200 }).notNull(),
  fundManagerId: varchar("fundManagerId", { length: 64 }).notNull(),
  investmentPurpose: text("investmentPurpose").notNull(),
  capitalAmount: double("capitalAmount").notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("NGN"),
  profitSharingRatioInvestor: double("profitSharingRatioInvestor").notNull(),
  profitSharingRatioManager: double("profitSharingRatioManager").notNull(),
  investmentPeriodMonths: int("investmentPeriodMonths").notNull(),
  startDate: varchar("startDate", { length: 20 }).notNull(),
  maturityDate: varchar("maturityDate", { length: 20 }).notNull(),
  realizedProfit: double("realizedProfit").notNull().default(0),
  realizedLoss: double("realizedLoss").notNull().default(0),
  distributions: json("distributions").$type<object[]>().notNull(),
  status: varchar("status", { length: 30 }).notNull().default("active"),
  shariaCompliance: varchar("shariaCompliance", { length: 30 }).notNull(),
  riskCategory: varchar("riskCategory", { length: 30 }).notNull().default("moderate"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("mudarabah_tenant_idx").on(table.tenantId),
  index("mudarabah_investor_idx").on(table.investorId),
]);

// ── Trade Finance ──

export const lettersOfCredit = mysqlTable("lettersOfCredit", {
  id: int("id").autoincrement().primaryKey(),
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
  amount: double("amount").notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("USD"),
  commodity: varchar("commodity", { length: 200 }),
  incoterm: varchar("incoterm", { length: 10 }),
  portOfLoading: varchar("portOfLoading", { length: 200 }),
  portOfDischarge: varchar("portOfDischarge", { length: 200 }),
  latestShipDate: varchar("latestShipDate", { length: 20 }),
  expiryDate: varchar("expiryDate", { length: 20 }).notNull(),
  documentsRequired: json("documentsRequired").$type<string[]>().notNull(),
  amendments: json("amendments").$type<object[]>().notNull(),
  status: varchar("status", { length: 30 }).notNull().default("draft"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("lc_tenant_idx").on(table.tenantId),
  index("lc_applicant_idx").on(table.applicantId),
]);

export const warehouseReceipts = mysqlTable("warehouseReceipts", {
  id: int("id").autoincrement().primaryKey(),
  receiptId: varchar("receiptId", { length: 32 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  depositorId: varchar("depositorId", { length: 64 }).notNull(),
  depositorName: varchar("depositorName", { length: 200 }).notNull(),
  warehouseId: varchar("warehouseId", { length: 64 }).notNull(),
  warehouseName: varchar("warehouseName", { length: 200 }),
  location: varchar("location", { length: 200 }).notNull(),
  commodity: varchar("commodity", { length: 100 }).notNull(),
  quantity: double("quantity").notNull(),
  quantityUnit: varchar("quantityUnit", { length: 20 }).notNull().default("tonnes"),
  qualityGrade: varchar("qualityGrade", { length: 20 }).notNull().default("Grade A"),
  storageStartDate: varchar("storageStartDate", { length: 20 }).notNull(),
  expiryDate: varchar("expiryDate", { length: 20 }),
  marketValue: double("marketValue").notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("NGN"),
  pledgedAsCollateral: int("pledgedAsCollateral").notNull().default(0),
  collateralLoanId: varchar("collateralLoanId", { length: 32 }),
  insurancePolicyId: varchar("insurancePolicyId", { length: 32 }),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("whr_tenant_idx").on(table.tenantId),
  index("whr_depositor_idx").on(table.depositorId),
]);

export const bankGuarantees = mysqlTable("bankGuarantees", {
  id: int("id").autoincrement().primaryKey(),
  guaranteeId: varchar("guaranteeId", { length: 32 }).notNull().unique(),
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
  guaranteeType: varchar("guaranteeType", { length: 30 }).notNull().default("performance"),
  applicantId: varchar("applicantId", { length: 64 }).notNull(),
  applicantName: varchar("applicantName", { length: 200 }).notNull(),
  beneficiaryName: varchar("beneficiaryName", { length: 200 }).notNull(),
  amount: double("amount").notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("USD"),
  purpose: text("purpose").notNull(),
  effectiveDate: varchar("effectiveDate", { length: 20 }).notNull(),
  expiryDate: varchar("expiryDate", { length: 20 }).notNull(),
  claimDeadline: varchar("claimDeadline", { length: 20 }),
  commissionRate: double("commissionRate").notNull(),
  commissionAmount: double("commissionAmount").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
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
