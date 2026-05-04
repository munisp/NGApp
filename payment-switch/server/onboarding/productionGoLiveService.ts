import { eq, and, desc } from "drizzle-orm";
import { getDb } from "../db";
import {
  productionCredentials,
  goLiveChecklist,
  productionMonitoring,
  incidentReports,
  certificationResults,
} from "../../drizzle/schema";
import crypto from "crypto";

/**
 * Generate production API key
 */
export function generateProductionApiKey(): string {
  return `pk_live_${crypto.randomBytes(32).toString('hex')}`;
}

/**
 * Generate production API secret
 */
export function generateProductionApiSecret(): string {
  return `sk_live_${crypto.randomBytes(48).toString('hex')}`;
}

/**
 * Generate webhook secret
 */
export function generateWebhookSecret(): string {
  return `whsec_${crypto.randomBytes(32).toString('hex')}`;
}

/**
 * Check if application is ready for production
 */
export async function validateGoLiveReadiness(applicationId: number): Promise<{
  ready: boolean;
  missingItems: string[];
  checklist: any;
}> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get checklist
  const [checklist] = await db
    .select()
    .from(goLiveChecklist)
    .where(eq(goLiveChecklist.applicationId, applicationId))
    .limit(1);

  if (!checklist) {
    return {
      ready: false,
      missingItems: ["Go-live checklist not initialized"],
      checklist: null,
    };
  }

  const missingItems: string[] = [];

  if (!checklist.certificationPassed) missingItems.push("Certification not passed");
  if (!checklist.securityAuditCompleted) missingItems.push("Security audit not completed");
  if (!checklist.complianceVerified) missingItems.push("Compliance not verified");
  if (!checklist.integrationTested) missingItems.push("Integration not tested");
  if (!checklist.documentationReviewed) missingItems.push("Documentation not reviewed");
  if (!checklist.supportContactsProvided) missingItems.push("Support contacts not provided");
  if (!checklist.disasterRecoveryPlanSubmitted) missingItems.push("Disaster recovery plan not submitted");
  if (!checklist.productionEndpointsConfigured) missingItems.push("Production endpoints not configured");

  return {
    ready: missingItems.length === 0,
    missingItems,
    checklist,
  };
}

/**
 * Initialize go-live checklist
 */
export async function initializeGoLiveChecklist(applicationId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Check if checklist already exists
  const existing = await db
    .select()
    .from(goLiveChecklist)
    .where(eq(goLiveChecklist.applicationId, applicationId))
    .limit(1);

  if (existing.length > 0) {
    return existing[0];
  }

  // Create new checklist
  const result = await db.insert(goLiveChecklist).values({
    applicationId,
  });

  return { id: result[0].insertId, applicationId };
}

/**
 * Update checklist item
 */
export async function updateChecklistItem(
  applicationId: number,
  updates: Partial<{
    certificationPassed: boolean;
    securityAuditCompleted: boolean;
    complianceVerified: boolean;
    integrationTested: boolean;
    documentationReviewed: boolean;
    supportContactsProvided: boolean;
    disasterRecoveryPlanSubmitted: boolean;
    productionEndpointsConfigured: boolean;
  }>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(goLiveChecklist)
    .set(updates)
    .where(eq(goLiveChecklist.applicationId, applicationId));

  // Check if all items are completed
  const [checklist] = await db
    .select()
    .from(goLiveChecklist)
    .where(eq(goLiveChecklist.applicationId, applicationId))
    .limit(1);

  if (checklist) {
    const allCompleted =
      checklist.certificationPassed &&
      checklist.securityAuditCompleted &&
      checklist.complianceVerified &&
      checklist.integrationTested &&
      checklist.documentationReviewed &&
      checklist.supportContactsProvided &&
      checklist.disasterRecoveryPlanSubmitted &&
      checklist.productionEndpointsConfigured;

    if (allCompleted !== checklist.allItemsCompleted) {
      await db
        .update(goLiveChecklist)
        .set({ allItemsCompleted: allCompleted })
        .where(eq(goLiveChecklist.applicationId, applicationId));
    }
  }

  return { success: true };
}

/**
 * Request production access
 */
export async function requestProductionAccess(
  applicationId: number,
  userId: number,
  config: {
    productionEndpoint: string;
    productionWebhookUrl?: string;
    dailyTransactionLimit: number;
    monthlyTransactionLimit?: number;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Validate readiness
  const validation = await validateGoLiveReadiness(applicationId);
  if (!validation.ready) {
    throw new Error(`Not ready for production: ${validation.missingItems.join(", ")}`);
  }

  // Generate credentials
  const apiKey = generateProductionApiKey();
  const apiSecret = generateProductionApiSecret();
  const webhookSecret = generateWebhookSecret();

  // Create production credentials
  const result = await db.insert(productionCredentials).values({
    applicationId,
    userId,
    productionApiKey: apiKey,
    productionApiSecret: apiSecret,
    productionWebhookSecret: webhookSecret,
    productionEndpoint: config.productionEndpoint,
    productionWebhookUrl: config.productionWebhookUrl || null,
    dailyTransactionLimit: config.dailyTransactionLimit,
    monthlyTransactionLimit: config.monthlyTransactionLimit || null,
    status: "pending",
  });

  return {
    id: result[0].insertId,
    apiKey,
    apiSecret,
    webhookSecret,
  };
}

/**
 * Activate production access (Admin only)
 */
export async function activateProductionAccess(
  credentialId: number,
  adminUserId: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(productionCredentials)
    .set({
      status: "active",
      activatedAt: new Date(),
      activatedBy: adminUserId,
    })
    .where(eq(productionCredentials.id, credentialId));

  return { success: true };
}

/**
 * Get production credentials
 */
export async function getProductionCredentials(applicationId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const credentials = await db
    .select()
    .from(productionCredentials)
    .where(eq(productionCredentials.applicationId, applicationId))
    .orderBy(desc(productionCredentials.createdAt))
    .limit(1);

  return credentials[0] || null;
}

/**
 * Get monitoring data
 */
export async function getMonitoringData(
  credentialId: number,
  startDate?: Date,
  endDate?: Date
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  let query = db
    .select()
    .from(productionMonitoring)
    .where(eq(productionMonitoring.credentialId, credentialId));

  // Note: Date filtering would require additional where conditions
  // For simplicity, returning all data for now

  const data = await query.orderBy(desc(productionMonitoring.date)).limit(30);

  return data;
}

/**
 * Record monitoring metrics
 */
export async function recordMonitoringMetrics(
  credentialId: number,
  metrics: {
    totalTransactions: number;
    successfulTransactions: number;
    failedTransactions: number;
    averageResponseTime?: number;
    peakTps?: number;
    uptimePercentage?: number;
    errorRate?: number;
    alertsTriggered?: number;
    incidentsReported?: number;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(productionMonitoring).values({
    credentialId,
    date: new Date(),
    ...metrics,
  });

  return { success: true };
}

/**
 * Create incident report
 */
export async function createIncidentReport(
  credentialId: number,
  userId: number,
  incident: {
    incidentType: "outage" | "performance_degradation" | "security_breach" | "data_issue" | "integration_failure" | "other";
    severity: "low" | "medium" | "high" | "critical";
    title: string;
    description: string;
    affectedTransactions?: number;
    estimatedDowntime?: number;
    financialImpact?: number;
    occurredAt: Date;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(incidentReports).values({
    credentialId,
    reportedBy: userId,
    ...incident,
  });

  return { id: result[0].insertId };
}

/**
 * Update incident status
 */
export async function updateIncidentStatus(
  incidentId: number,
  updates: {
    status?: "open" | "investigating" | "resolved" | "closed";
    resolution?: string;
    resolvedBy?: number;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const updateData: any = { ...updates };
  
  if (updates.status === "resolved" || updates.status === "closed") {
    updateData.resolvedAt = new Date();
  }

  await db
    .update(incidentReports)
    .set(updateData)
    .where(eq(incidentReports.id, incidentId));

  return { success: true };
}

/**
 * Get incidents for a credential
 */
export async function getIncidents(credentialId: number, status?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  let query = db
    .select()
    .from(incidentReports)
    .where(eq(incidentReports.credentialId, credentialId));

  const incidents = await query.orderBy(desc(incidentReports.occurredAt));

  return incidents;
}

/**
 * Get go-live checklist
 */
export async function getGoLiveChecklist(applicationId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [checklist] = await db
    .select()
    .from(goLiveChecklist)
    .where(eq(goLiveChecklist.applicationId, applicationId))
    .limit(1);

  return checklist || null;
}
