/**
 * seedExpansion.ts — Expanded seed data for all 75 previously unseeded tables
 * Industry references: IEC 61511, IEC 62443, SOC 2 Type II, API RP 14C,
 *   SPE-84083, SPE-18186, ISO 14224, OSDU data standards
 */
import { getDb } from "../db";
import {
  users, devices, firmwareVersions, otaCampaigns,
  workovers, workoverCosts, permits,
  hseIncidents,
  contractors, cmmsIntegrations, cmmsWorkOrders,
  calibrationRecords,
  financialEntries,
  shiftHandovers,
  auditLog,
  securityEvents,
  silAssessments, silControls, silFunctions, silGaps, silTestRecords,
  soc2Controls, soc2AuditEvents,
  damageAssessments, damageEvidence, repairTickets, repairCostEstimates,
  geomechanicalModels, stressProfiles,
  mudInventory, mudTransactions,
  sandProductionRecords,
  producedWaterRecords,
  heavyOilParameters,
  liquidLoadingEvents,
  declineCurveParams,
  mlPredictions, modelMetrics,
  pinnModels,
  productionForecasts,
  reservoirPressureRecords,
  pressureTests,
  casingInspections,
  subseaTrees, fpsoVessels, fpsoTwinSessions,
  hpuUnits,
  actuatorCommands,
  alertThresholds,
  alarmRules,
  digitalTwinScenarios,
  drPrograms, drVens, drEvents, drAuditLog,
  federatedModels, federatedParticipants,
  marketplaceInstalls, marketplaceRuns,
  mojaloopSettlements,
  osduDatasets,
  prodmlProductionSets,
  pushSubscriptions,
  agentWorkflows, agentWorkflowRuns,
  aiCopilotChats,
  saasSubscriptions, saasUsageMetrics,
  wellAllocationFactors,
  allocatedProduction, allocationRecords,
  carbonTargets,
  regulatoryReports,
  userInvitations,
  damageImages,
  iec62443Assessments,
  incidentTriage,
  otaDeviceUpdates,
} from "../../drizzle/schema";
import { sql } from "drizzle-orm";

type SeedResult = { domain: string; seeded: number; skipped: boolean; error?: string };
type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

async function countRows(db: Db, table: any): Promise<number> {
  try {
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(table);
    return Number(count);
  } catch { return 0; }
}

const WELL_IDS = ["W-001", "W-002", "W-003", "W-004", "W-005", "W-006", "W-007", "W-008"];
const now = new Date();
const daysAgo = (n: number) => new Date(now.getTime() - n * 86400000);
const hoursAgo = (n: number) => new Date(now.getTime() - n * 3600000);

export async function runExpansionSeed(db: Db): Promise<SeedResult[]> {
  const results: SeedResult[] = [];

  // ── 1. USERS ──────────────────────────────────────────────────────────────
  try {
    const existing = await countRows(db, users);
    if (existing === 0) {
      await db.insert(users).values([
        { openId: "owner-001", name: "James Okafor", email: "james.okafor@ogrmm.com", role: "admin", loginMethod: "oauth", createdAt: daysAgo(180) },
        { openId: "op-002", name: "Sarah Mitchell", email: "sarah.mitchell@ogrmm.com", role: "user", loginMethod: "oauth", createdAt: daysAgo(90) },
        { openId: "op-003", name: "Carlos Mendez", email: "carlos.mendez@ogrmm.com", role: "user", loginMethod: "oauth", createdAt: daysAgo(60) },
        { openId: "op-004", name: "Fatima Al-Rashid", email: "fatima.alrashid@ogrmm.com", role: "user", loginMethod: "oauth", createdAt: daysAgo(45) },
        { openId: "op-005", name: "David Chen", email: "david.chen@ogrmm.com", role: "user", loginMethod: "oauth", createdAt: daysAgo(30) },
      ] as any[]);
      results.push({ domain: "users", seeded: 5, skipped: false });
    } else {
      results.push({ domain: "users", seeded: 0, skipped: true });
    }
  } catch (e: any) { results.push({ domain: "users", seeded: 0, skipped: false, error: e.message }); }

  // ── 2. DEVICES ────────────────────────────────────────────────────────────
  try {
    const existing = await countRows(db, devices);
    if (existing === 0) {
      await db.insert(devices).values([
        { deviceId: "DEV-001", wellId: "W-001", name: "ESP Controller Alpha-1", deviceType: "ESP_CONTROLLER", manufacturer: "Schlumberger", model: "REDA ESP-3000", firmwareVersion: "3.2.1", status: "ONLINE", ipAddress: "192.168.10.11", macAddress: "AA:BB:CC:DD:EE:01", protocol: "MODBUS_TCP", lastSeenAt: hoursAgo(1) },
        { deviceId: "DEV-002", wellId: "W-002", name: "RTU Bravo-2", deviceType: "RTU", manufacturer: "Emerson", model: "ROC809", firmwareVersion: "2.8.0", status: "ONLINE", ipAddress: "192.168.10.12", macAddress: "AA:BB:CC:DD:EE:02", protocol: "MODBUS_RTU", lastSeenAt: hoursAgo(2) },
        { deviceId: "DEV-003", wellId: "W-003", name: "Pressure Transmitter Charlie-3", deviceType: "PRESSURE_TRANSMITTER", manufacturer: "Yokogawa", model: "EJX110A", firmwareVersion: "1.5.2", status: "ONLINE", ipAddress: "192.168.10.13", macAddress: "AA:BB:CC:DD:EE:03", protocol: "HART", lastSeenAt: hoursAgo(1) },
        { deviceId: "DEV-004", wellId: "W-004", name: "Flow Meter Delta-4", deviceType: "FLOW_METER", manufacturer: "Endress+Hauser", model: "Promag 53", firmwareVersion: "2.1.0", status: "DEGRADED", ipAddress: "192.168.10.14", macAddress: "AA:BB:CC:DD:EE:04", protocol: "PROFIBUS", lastSeenAt: hoursAgo(6) },
        { deviceId: "DEV-005", wellId: "W-005", name: "Edge Gateway Echo-5", deviceType: "EDGE_GATEWAY", manufacturer: "Moxa", model: "UC-8112A", firmwareVersion: "4.0.1", status: "ONLINE", ipAddress: "192.168.10.15", macAddress: "AA:BB:CC:DD:EE:05", protocol: "MQTT", lastSeenAt: hoursAgo(0) },
        { deviceId: "DEV-006", wellId: "W-006", name: "Vibration Sensor Foxtrot-6", deviceType: "VIBRATION_SENSOR", manufacturer: "Emerson", model: "CSI 9420", firmwareVersion: "1.9.3", status: "ONLINE", ipAddress: "192.168.10.16", macAddress: "AA:BB:CC:DD:EE:06", protocol: "WIRELESS_HART", lastSeenAt: hoursAgo(3) },
      ] as any[]);
      results.push({ domain: "devices", seeded: 6, skipped: false });
    } else {
      results.push({ domain: "devices", seeded: 0, skipped: true });
    }
  } catch (e: any) { results.push({ domain: "devices", seeded: 0, skipped: false, error: e.message }); }

  // ── 3. FIRMWARE VERSIONS ──────────────────────────────────────────────────
  try {
    const existing = await countRows(db, firmwareVersions);
    if (existing === 0) {
      await db.insert(firmwareVersions).values([
        { version: "3.2.1", deviceType: "ESP_CONTROLLER", releaseNotes: "Improved VFD control algorithm, reduced harmonic distortion", isStable: true, checksum: "sha256:abc123def456", firmwareUrl: "https://cdn.ogrmm.com/fw/esp-3.2.1.bin" },
        { version: "2.8.0", deviceType: "RTU", releaseNotes: "Added DNP3 Level 2 support, improved Modbus timeout handling", isStable: true, checksum: "sha256:bcd234efg567", firmwareUrl: "https://cdn.ogrmm.com/fw/rtu-2.8.0.bin" },
        { version: "4.0.1", deviceType: "EDGE_GATEWAY", releaseNotes: "TLS 1.3 support, MQTT 5.0 protocol, OPC-UA 1.04 compliance", isStable: true, checksum: "sha256:cde345fgh678", firmwareUrl: "https://cdn.ogrmm.com/fw/gateway-4.0.1.bin" },
      ] as any[]);
      results.push({ domain: "firmwareVersions", seeded: 3, skipped: false });
    } else {
      results.push({ domain: "firmwareVersions", seeded: 0, skipped: true });
    }
  } catch (e: any) { results.push({ domain: "firmwareVersions", seeded: 0, skipped: false, error: e.message }); }

  // ── 4. OTA CAMPAIGNS ──────────────────────────────────────────────────────
  try {
    const existing = await countRows(db, otaCampaigns);
    if (existing === 0) {
      await db.insert(otaCampaigns).values([
        { name: "Q1 2026 ESP Controller Update", targetDeviceType: "ESP_CONTROLLER", status: "COMPLETED", scheduledAt: daysAgo(20), completedAt: daysAgo(18), totalDevices: 3, successCount: 3, failureCount: 0 },
        { name: "Edge Gateway Security Patch", targetDeviceType: "EDGE_GATEWAY", status: "IN_PROGRESS", scheduledAt: daysAgo(5), totalDevices: 2, successCount: 1, failureCount: 0 },
      ] as any[]);
      results.push({ domain: "otaCampaigns", seeded: 2, skipped: false });
    } else {
      results.push({ domain: "otaCampaigns", seeded: 0, skipped: true });
    }
  } catch (e: any) { results.push({ domain: "otaCampaigns", seeded: 0, skipped: false, error: e.message }); }

  // ── 5. WORKOVERS ──────────────────────────────────────────────────────────
  try {
    const existing = await countRows(db, workovers);
    if (existing === 0) {
      const wos = await db.insert(workovers).values([
        { jobId: "WO-2026-001", wellId: "W-001", jobType: "ESP_REPLACEMENT", status: "COMPLETED", priority: "HIGH", description: "Replace failed ESP unit — motor winding failure confirmed by vibration analysis", trigger: "ALARM", assignedTo: "Carlos Mendez", estimatedDays: 5, actualDays: 6, budgetUsd: "185000", startDate: daysAgo(45), endDate: daysAgo(39) },
        { jobId: "WO-2026-002", wellId: "W-003", jobType: "ACID_STIMULATION", status: "IN_PROGRESS", priority: "MEDIUM", description: "Matrix acid job to restore permeability — PI decline 35% over 6 months", trigger: "PRODUCTION_DECLINE", assignedTo: "Sarah Mitchell", estimatedDays: 3, budgetUsd: "95000", startDate: daysAgo(2) },
        { jobId: "WO-2026-003", wellId: "W-005", jobType: "SAND_CONTROL", status: "PLANNED", priority: "HIGH", description: "Install standalone screen completion — sand onset detected at 2800 psi drawdown", trigger: "SAND_DETECTION", assignedTo: "James Okafor", estimatedDays: 8, budgetUsd: "320000" },
        { jobId: "WO-2026-004", wellId: "W-007", jobType: "WELLBORE_CLEANOUT", status: "COMPLETED", priority: "LOW", description: "Scale removal from tubing — 40% flow restriction confirmed by caliper log", trigger: "ROUTINE", assignedTo: "David Chen", estimatedDays: 2, actualDays: 2, budgetUsd: "42000", startDate: daysAgo(90), endDate: daysAgo(88) },
      ] as any[]).returning();
      if (wos[0]) {
        await db.insert(workoverCosts).values([
          { workoverId: wos[0].id, category: "EQUIPMENT", description: "ESP unit 562 series — 562 HP, 60 Hz", amountUsd: "95000", vendor: "Schlumberger", invoiceRef: "SLB-2026-0341", recordedAt: daysAgo(39) },
          { workoverId: wos[0].id, category: "LABOR", description: "Rig crew 6 days × 12 persons", amountUsd: "72000", vendor: "Halliburton", invoiceRef: "HAL-2026-0892", recordedAt: daysAgo(39) },
          { workoverId: wos[0].id, category: "CHEMICALS", description: "Scale inhibitor and corrosion inhibitor package", amountUsd: "18000", vendor: "ChampionX", invoiceRef: "CHX-2026-0123", recordedAt: daysAgo(39) },
        ] as any[]);
      }
      results.push({ domain: "workovers", seeded: 4, skipped: false });
    } else {
      results.push({ domain: "workovers", seeded: 0, skipped: true });
    }
  } catch (e: any) { results.push({ domain: "workovers", seeded: 0, skipped: false, error: e.message }); }

  // ── 6. PERMITS ────────────────────────────────────────────────────────────
  try {
    const existing = await countRows(db, permits);
    if (existing === 0) {
      await db.insert(permits).values([
        { permitId: "PTW-2026-001", wellId: "W-001", permitType: "HOT_WORK", status: "CLOSED", title: "ESP Replacement — Hot Work Authorization", issuedBy: "James Okafor", approvedBy: "Sarah Mitchell", issuedAt: daysAgo(45), expiresAt: daysAgo(39), closedAt: daysAgo(39) },
        { permitId: "PTW-2026-002", wellId: "W-003", permitType: "CONFINED_SPACE", status: "ACTIVE", title: "Acid Stimulation — Confined Space Entry", issuedBy: "Carlos Mendez", approvedBy: "James Okafor", issuedAt: daysAgo(2), expiresAt: daysAgo(-1) },
        { permitId: "PTW-2026-003", wellId: "W-005", permitType: "EXCAVATION", status: "PENDING_APPROVAL", title: "Sand Control Installation — Excavation Permit", issuedBy: "David Chen", issuedAt: now, expiresAt: daysAgo(-14) },
      ] as any[]);
      results.push({ domain: "permits", seeded: 3, skipped: false });
    } else {
      results.push({ domain: "permits", seeded: 0, skipped: true });
    }
  } catch (e: any) { results.push({ domain: "permits", seeded: 0, skipped: false, error: e.message }); }

  // ── 7. HSE INCIDENTS ──────────────────────────────────────────────────────
  try {
    const existing = await countRows(db, hseIncidents);
    if (existing === 0) {
      await db.insert(hseIncidents).values([
        { incidentId: "HSE-2026-001", wellId: "W-001", incidentType: "NEAR_MISS", severity: "LOW", title: "Dropped object — wrench from rig floor", description: "8-inch wrench dropped from 3m height during ESP installation. No injuries.", reportedBy: "Carlos Mendez", occurredAt: daysAgo(44), status: "CLOSED", rootCause: "Inadequate tool tethering" },
        { incidentId: "HSE-2026-002", wellId: "W-003", incidentType: "FIRST_AID", severity: "MEDIUM", title: "Chemical splash — acid stimulation prep", description: "Operator received HCl splash to forearm during acid mixing. First aid administered.", reportedBy: "Sarah Mitchell", occurredAt: daysAgo(2), status: "UNDER_INVESTIGATION", rootCause: "PPE inspection failure" },
        { incidentId: "HSE-2025-047", wellId: "W-007", incidentType: "ENVIRONMENTAL", severity: "MEDIUM", title: "Minor hydrocarbon spill — wellhead area", description: "Approximately 50 litres of crude oil spilled during tubing connection. Contained within secondary containment bund.", reportedBy: "David Chen", occurredAt: daysAgo(95), status: "CLOSED", rootCause: "Worn tubing thread protector" },
      ] as any[]);
      results.push({ domain: "hseIncidents", seeded: 3, skipped: false });
    } else {
      results.push({ domain: "hseIncidents", seeded: 0, skipped: true });
    }
  } catch (e: any) { results.push({ domain: "hseIncidents", seeded: 0, skipped: false, error: e.message }); }

  // ── 8. CONTRACTORS ────────────────────────────────────────────────────────
  try {
    const existing = await countRows(db, contractors);
    if (existing === 0) {
      await db.insert(contractors).values([
        { name: "Mike Thompson", company: "Halliburton Energy Services", specialization: "WELL_SERVICES", email: "m.thompson@halliburton.com", phone: "+1-713-759-2600", country: "USA", available: true },
        { name: "Jean-Pierre Dubois", company: "Schlumberger Limited", specialization: "ARTIFICIAL_LIFT", email: "jp.dubois@slb.com", phone: "+1-713-513-2000", country: "USA", available: true },
        { name: "Aisha Nwosu", company: "Baker Hughes", specialization: "DRILLING", email: "a.nwosu@bakerhughes.com", phone: "+1-713-439-8600", country: "USA", available: false },
        { name: "Lars Eriksson", company: "ChampionX Corporation", specialization: "CHEMICAL_SERVICES", email: "l.eriksson@championx.com", phone: "+1-281-228-2900", country: "USA", available: true },
      ] as any[]);
      results.push({ domain: "contractors", seeded: 4, skipped: false });
    } else {
      results.push({ domain: "contractors", seeded: 0, skipped: true });
    }
  } catch (e: any) { results.push({ domain: "contractors", seeded: 0, skipped: false, error: e.message }); }

  // ── 9. CMMS INTEGRATIONS + WORK ORDERS ───────────────────────────────────
  try {
    const existing = await countRows(db, cmmsIntegrations);
    if (existing === 0) {
      await db.insert(cmmsIntegrations).values([
        { tenantId: "TENANT-001", cmmsSystem: "SAP_PM", baseUrl: "https://sap.ogrmm.com/api/pm", authType: "API_KEY", isActive: true, lastTestAt: hoursAgo(4), syncInterval: 60 },
        { tenantId: "TENANT-001", cmmsSystem: "MAXIMO", baseUrl: "https://maximo.ogrmm.com/oslc", authType: "BASIC", isActive: false, lastTestAt: daysAgo(30), syncInterval: 120 },
      ] as any[]);
      await db.insert(cmmsWorkOrders).values([
        { externalId: "WO-4521893", cmmsSystem: "SAP_PM", workOrderNumber: "WO-4521893", title: "ESP Preventive Maintenance — 6-month service", description: "Inspect ESP motor, pump, seal section. Replace worn bearings.", wellId: "W-001", priority: "MEDIUM", workOrderType: "PREVENTIVE", status: "COMPLETED", assignedTo: "Carlos Mendez", plannedStart: daysAgo(30), plannedEnd: daysAgo(29), actualStart: daysAgo(30) },
        { externalId: "WO-4521894", cmmsSystem: "SAP_PM", workOrderNumber: "WO-4521894", title: "Flow Meter Calibration — Annual", description: "Calibrate Promag 53 flow meter against master meter.", wellId: "W-004", priority: "LOW", workOrderType: "INSPECTION", status: "OPEN", assignedTo: "David Chen", plannedStart: daysAgo(-7), plannedEnd: daysAgo(-6) },
      ] as any[]);
      results.push({ domain: "cmmsIntegrations", seeded: 2, skipped: false });
    } else {
      results.push({ domain: "cmmsIntegrations", seeded: 0, skipped: true });
    }
  } catch (e: any) { results.push({ domain: "cmmsIntegrations", seeded: 0, skipped: false, error: e.message }); }

  // ── 10. CALIBRATION RECORDS ───────────────────────────────────────────────
  try {
    const existing = await countRows(db, calibrationRecords);
    if (existing === 0) {
      await db.insert(calibrationRecords).values([
        { sensorId: "DEV-003", wellId: "W-003", sensorType: "PRESSURE_TRANSMITTER", tag: "PT-3001", status: "CALIBRATED", driftPct: "0.05", lastCalibratedAt: daysAgo(30), nextDueAt: daysAgo(-335), intervalDays: 365, certificateRef: "CAL-CERT-2026-001", nistTraceable: true, technician: "David Chen" },
        { sensorId: "DEV-004", wellId: "W-004", sensorType: "FLOW_METER", tag: "FT-4001", status: "CALIBRATED", driftPct: "0.08", lastCalibratedAt: daysAgo(90), nextDueAt: daysAgo(-275), intervalDays: 365, certificateRef: "CAL-CERT-2026-002", nistTraceable: true, technician: "Carlos Mendez" },
        { sensorId: "DEV-006", wellId: "W-006", sensorType: "VIBRATION_SENSOR", tag: "VT-6001", status: "CALIBRATED", driftPct: "0.03", lastCalibratedAt: daysAgo(15), nextDueAt: daysAgo(-350), intervalDays: 365, certificateRef: "CAL-CERT-2026-003", nistTraceable: true, technician: "Sarah Mitchell" },
      ] as any[]);
      results.push({ domain: "calibrationRecords", seeded: 3, skipped: false });
    } else {
      results.push({ domain: "calibrationRecords", seeded: 0, skipped: true });
    }
  } catch (e: any) { results.push({ domain: "calibrationRecords", seeded: 0, skipped: false, error: e.message }); }

  // ── 11. FINANCIAL ENTRIES ─────────────────────────────────────────────────
  try {
    const existing = await countRows(db, financialEntries);
    if (existing === 0) {
      await db.insert(financialEntries).values([
        { entryType: "OPEX", category: "CHEMICAL_INJECTION", wellId: "W-001", fieldId: "FIELD-ALPHA", description: "Scale inhibitor — monthly injection", amountUsd: "12500", currency: "USD", entryDate: daysAgo(30), period: "2026-03", approvedBy: "James Okafor" },
        { entryType: "CAPEX", category: "EQUIPMENT", wellId: "W-001", fieldId: "FIELD-ALPHA", description: "ESP replacement — REDA 562 series", amountUsd: "185000", currency: "USD", entryDate: daysAgo(39), period: "2026-03", approvedBy: "James Okafor" },
        { entryType: "OPEX", category: "WELL_SERVICES", wellId: "W-003", fieldId: "FIELD-BRAVO", description: "Acid stimulation — matrix job", amountUsd: "95000", currency: "USD", entryDate: daysAgo(2), period: "2026-04", approvedBy: "Sarah Mitchell" },
        { entryType: "OPEX", category: "UTILITIES", wellId: null, fieldId: "FIELD-ALPHA", description: "Power consumption — ESP wells Q1 2026", amountUsd: "48200", currency: "USD", entryDate: daysAgo(14), period: "2026-03", approvedBy: "James Okafor" },
        { entryType: "REVENUE", category: "OIL_SALES", wellId: null, fieldId: "FIELD-ALPHA", description: "Crude oil sales — March 2026", amountUsd: "4250000", currency: "USD", entryDate: daysAgo(14), period: "2026-03", approvedBy: "James Okafor" },
      ] as any[]);
      results.push({ domain: "financialEntries", seeded: 5, skipped: false });
    } else {
      results.push({ domain: "financialEntries", seeded: 0, skipped: true });
    }
  } catch (e: any) { results.push({ domain: "financialEntries", seeded: 0, skipped: false, error: e.message }); }

  // ── 12. SHIFT HANDOVERS ───────────────────────────────────────────────────
  try {
    const existing = await countRows(db, shiftHandovers);
    if (existing === 0) {
      await db.insert(shiftHandovers).values([
        { shiftId: "SH-2026-001", shiftType: "MORNING", date: daysAgo(1), outgoingOperator: "Carlos Mendez", incomingOperator: "Sarah Mitchell", summary: "W-001 ESP running stable at 48 Hz. W-003 acid job in progress — pump rate 2.5 BPM. W-005 sand alarm cleared after choke adjustment.", criticalAlarms: 0, activeWorkovers: 1 },
        { shiftId: "SH-2026-002", shiftType: "EVENING", date: daysAgo(1), outgoingOperator: "Sarah Mitchell", incomingOperator: "David Chen", summary: "W-003 acid job completed — well on cleanup. W-004 flow meter showing intermittent readings — maintenance ticket raised. All other wells normal.", criticalAlarms: 1, activeWorkovers: 1 },
        { shiftId: "SH-2026-003", shiftType: "NIGHT", date: daysAgo(1), outgoingOperator: "David Chen", incomingOperator: "Carlos Mendez", summary: "Quiet shift. W-004 flow meter issue persists — DEV-004 flagged for calibration. W-001 production rate 850 BOPD, on target.", criticalAlarms: 0, activeWorkovers: 0 },
      ] as any[]);
      results.push({ domain: "shiftHandovers", seeded: 3, skipped: false });
    } else {
      results.push({ domain: "shiftHandovers", seeded: 0, skipped: true });
    }
  } catch (e: any) { results.push({ domain: "shiftHandovers", seeded: 0, skipped: false, error: e.message }); }

  // ── 13. AUDIT LOG ─────────────────────────────────────────────────────────
  try {
    const existing = await countRows(db, auditLog);
    if (existing === 0) {
      await db.insert(auditLog).values([
        { userId: "owner-001", action: "WELL_STATUS_CHANGE", resource: "wells", resourceId: "W-001", details: { from: "shut_in", to: "active", reason: "ESP replacement complete" }, ipAddress: "10.0.1.50", userAgent: "Mozilla/5.0", outcome: "SUCCESS" },
        { userId: "op-002", action: "ALARM_ACKNOWLEDGE", resource: "alarms", resourceId: "ALM-2026-0041", details: { alarmType: "HIGH_VIBRATION", wellId: "W-001" }, ipAddress: "10.0.1.51", userAgent: "Mozilla/5.0", outcome: "SUCCESS" },
        { userId: "op-003", action: "WORKOVER_CREATE", resource: "workovers", resourceId: "WO-2026-003", details: { jobType: "SAND_CONTROL", wellId: "W-005" }, ipAddress: "10.0.1.52", userAgent: "Mozilla/5.0", outcome: "SUCCESS" },
        { userId: "owner-001", action: "USER_INVITE", resource: "user_invitations", resourceId: "INV-001", details: { invitedEmail: "new.engineer@ogrmm.com", role: "user" }, ipAddress: "10.0.1.50", userAgent: "Mozilla/5.0", outcome: "SUCCESS" },
      ] as any[]);
      results.push({ domain: "auditLog", seeded: 4, skipped: false });
    } else {
      results.push({ domain: "auditLog", seeded: 0, skipped: true });
    }
  } catch (e: any) { results.push({ domain: "auditLog", seeded: 0, skipped: false, error: e.message }); }

  // ── 14. SECURITY EVENTS ───────────────────────────────────────────────────
  try {
    const existing = await countRows(db, securityEvents);
    if (existing === 0) {
      await db.insert(securityEvents).values([
        { eventId: "SEC-2026-001", eventType: "UNAUTHORIZED_ACCESS", severity: "HIGH", source: "192.168.10.99", target: "DEV-002", description: "Failed Modbus read attempt from unauthorized IP — 47 attempts in 60 seconds", mitigated: true, mitigatedAt: daysAgo(10), mitigatedBy: "James Okafor", iec62443Zone: "ZONE_2" },
        { eventId: "SEC-2026-002", eventType: "FIRMWARE_TAMPER", severity: "CRITICAL", source: "DEV-004", target: "DEV-004", description: "Firmware checksum mismatch detected on Flow Meter Delta-4 — possible supply chain compromise", mitigated: false, iec62443Zone: "ZONE_1" },
        { eventId: "SEC-2026-003", eventType: "ANOMALOUS_TRAFFIC", severity: "MEDIUM", source: "192.168.10.14", target: "HISTORIAN", description: "Unusual data volume from DEV-004 — 10x normal Modbus polling rate", mitigated: true, mitigatedAt: daysAgo(5), mitigatedBy: "Carlos Mendez", iec62443Zone: "ZONE_2" },
      ] as any[]);
      results.push({ domain: "securityEvents", seeded: 3, skipped: false });
    } else {
      results.push({ domain: "securityEvents", seeded: 0, skipped: true });
    }
  } catch (e: any) { results.push({ domain: "securityEvents", seeded: 0, skipped: false, error: e.message }); }

  // ── 15. SIL ASSESSMENTS + CONTROLS + FUNCTIONS + GAPS + TEST RECORDS ─────
  try {
    const existing = await countRows(db, silAssessments);
    if (existing === 0) {
      const assessments = await db.insert(silAssessments).values([
        { title: "ESP Safety Instrumented System — Alpha Field", description: "SIL assessment for ESP over-pressure protection system per IEC 61511", scope: "W-001 through W-004 ESP installations", targetSilLevel: "SIL_2", achievedSilLevel: "SIL_2", phase: "OPERATION", assessorName: "Dr. Elena Vasquez", assessorOrg: "TÜV Rheinland", assessmentDate: daysAgo(90), nextReviewDate: daysAgo(-275), pfdAvg: "0.0085" },
        { title: "Gas Detection System — Bravo Field", description: "SIL assessment for H2S and hydrocarbon gas detection per IEC 61511", scope: "FIELD-BRAVO surface facilities", targetSilLevel: "SIL_1", achievedSilLevel: "SIL_1", phase: "OPERATION", assessorName: "Dr. Elena Vasquez", assessorOrg: "TÜV Rheinland", assessmentDate: daysAgo(60), nextReviewDate: daysAgo(-305), pfdAvg: "0.032" },
      ] as any[]).returning();

      if (assessments[0]) {
        const controls = await db.insert(silControls).values([
          { assessmentId: assessments[0].id, clauseRef: "IEC 61511-1 Cl. 9.3", controlTitle: "SIL Verification", controlDescription: "Quantitative verification that SIL 2 PFD target is achieved", category: "DESIGN", silApplicability: "SIL_2", status: "COMPLIANT", evidence: "PFD calculation report TÜV-2026-001" },
          { assessmentId: assessments[0].id, clauseRef: "IEC 61511-1 Cl. 11.6", controlTitle: "Proof Test Procedure", controlDescription: "Documented proof test procedure with test interval ≤ 12 months", category: "OPERATION", silApplicability: "SIL_2", status: "COMPLIANT", evidence: "Proof test procedure OG-PT-001 Rev 3" },
          { assessmentId: assessments[0].id, clauseRef: "IEC 61511-1 Cl. 11.9", controlTitle: "Management of Change", controlDescription: "MOC procedure for SIS modifications", category: "MANAGEMENT", silApplicability: "SIL_2", status: "PARTIAL_COMPLIANCE", gapDescription: "MOC procedure does not cover firmware updates", remediationAction: "Update MOC procedure to include firmware change control" },
        ] as any[]).returning();

        await db.insert(silGaps).values([
          { assessmentId: assessments[0].id, controlId: controls[2].id, gapTitle: "MOC procedure gap — firmware updates", severity: "MEDIUM", description: "IEC 61511-1 Cl. 11.9 requires MOC to cover all SIS modifications including firmware. Current procedure excludes firmware.", impactedSilLevel: "SIL_2", remediationPlan: "Revise MOC-SIS-001 to include firmware change control section", owner: "James Okafor", targetDate: daysAgo(-30), status: "OPEN" },
        ] as any[]);
      }

      const silFunc = await db.insert(silFunctions).values([
        { functionId: "SIF-001", name: "ESP Over-Pressure Shutdown", description: "Shuts down ESP if tubing pressure exceeds 4500 psi", processHazard: "Tubing burst — hydrocarbon release", initiatingEvent: "ESP blockage or valve closure", safeguard: "Pressure transmitter PT-1001 + PLC + solenoid valve XV-1001", consequenceCategory: "MAJOR", targetSil: "SIL_2", achievedSil: "SIL_2", pfdAvg: "0.0085", rrf: "118" },
        { functionId: "SIF-002", name: "H2S High-High Shutdown", description: "Initiates site evacuation and shuts down all ignition sources if H2S > 20 ppm", processHazard: "H2S exposure — fatality risk", initiatingEvent: "H2S release from wellhead or separator", safeguard: "Gas detector GD-2001 + PLC + PA system + ESD", consequenceCategory: "CATASTROPHIC", targetSil: "SIL_2", achievedSil: "SIL_2", pfdAvg: "0.0062", rrf: "161" },
      ] as any[]).returning();

      if (silFunc[0]) {
        await db.insert(silTestRecords).values([
          { silFunctionId: silFunc[0].id, testDate: daysAgo(30), testType: "PROOF_TEST", testResult: "PASS", responseTimeSec: "0.45", testedBy: "Carlos Mendez", witnessedBy: "Sarah Mitchell", nextTestDue: daysAgo(-335) },
          { silFunctionId: silFunc[0].id, testDate: daysAgo(395), testType: "PROOF_TEST", testResult: "PASS", responseTimeSec: "0.52", testedBy: "Carlos Mendez", witnessedBy: "James Okafor", nextTestDue: daysAgo(-30) },
        ] as any[]);
      }
      results.push({ domain: "silAssessments", seeded: 2, skipped: false });
    } else {
      results.push({ domain: "silAssessments", seeded: 0, skipped: true });
    }
  } catch (e: any) { results.push({ domain: "silAssessments", seeded: 0, skipped: false, error: e.message }); }

  // ── 16. SOC2 CONTROLS + AUDIT EVENTS ─────────────────────────────────────
  try {
    const existing = await countRows(db, soc2Controls);
    if (existing === 0) {
      await db.insert(soc2Controls).values([
        { controlRef: "CC6.1", trustServiceCriteria: "CC", title: "Logical Access Controls", description: "The entity implements logical access security measures to protect against threats from sources outside its system boundaries", controlType: "PREVENTIVE", frequency: "CONTINUOUS", owner: "James Okafor", status: "EFFECTIVE", lastTestedAt: daysAgo(30), testResult: "PASS", evidence: "Access control matrix reviewed, MFA enforced for all admin accounts" },
        { controlRef: "CC6.2", trustServiceCriteria: "CC", title: "Authentication Mechanisms", description: "Prior to issuing system credentials and granting system access, the entity registers and authorizes new internal and external users", controlType: "PREVENTIVE", frequency: "CONTINUOUS", owner: "James Okafor", status: "EFFECTIVE", lastTestedAt: daysAgo(30), testResult: "PASS", evidence: "User provisioning workflow documented, Manus OAuth enforced" },
        { controlRef: "CC7.1", trustServiceCriteria: "CC", title: "Vulnerability Management", description: "To meet its objectives, the entity uses detection and monitoring procedures to identify changes to configurations that result in the introduction of new vulnerabilities", controlType: "DETECTIVE", frequency: "MONTHLY", owner: "Carlos Mendez", status: "EFFECTIVE", lastTestedAt: daysAgo(14), testResult: "PASS", evidence: "NVD CVE scan completed, 0 critical vulnerabilities unmitigated" },
        { controlRef: "A1.1", trustServiceCriteria: "A", title: "Availability Monitoring", description: "The entity maintains, monitors, and evaluates current processing capacity and use of system components to manage capacity demand", controlType: "DETECTIVE", frequency: "CONTINUOUS", owner: "Sarah Mitchell", status: "EFFECTIVE", lastTestedAt: daysAgo(7), testResult: "PASS", evidence: "Grafana uptime dashboard — 99.94% availability last 90 days" },
      ] as any[]);
      await db.insert(soc2AuditEvents).values([
        { eventTime: hoursAgo(2), userId: "owner-001", userEmail: "james.okafor@ogrmm.com", ipAddress: "10.0.1.50", action: "LOGIN", resource: "auth", outcome: "SUCCESS", details: { method: "oauth", mfa: true } },
        { eventTime: hoursAgo(4), userId: "op-002", userEmail: "sarah.mitchell@ogrmm.com", ipAddress: "10.0.1.51", action: "DATA_EXPORT", resource: "production_records", outcome: "SUCCESS", details: { format: "CSV", rowCount: 1440 } },
        { eventTime: daysAgo(1), userId: "op-003", userEmail: "carlos.mendez@ogrmm.com", ipAddress: "10.0.1.52", action: "ALARM_ACKNOWLEDGE", resource: "alarms", resourceId: "ALM-2026-0041", outcome: "SUCCESS", details: { alarmType: "HIGH_VIBRATION" } },
      ] as any[]);
      results.push({ domain: "soc2Controls", seeded: 4, skipped: false });
    } else {
      results.push({ domain: "soc2Controls", seeded: 0, skipped: true });
    }
  } catch (e: any) { results.push({ domain: "soc2Controls", seeded: 0, skipped: false, error: e.message }); }

  // ── 17. DAMAGE ASSESSMENTS ────────────────────────────────────────────────
  try {
    const existing = await countRows(db, damageAssessments);
    if (existing === 0) {
      const assessments = await db.insert(damageAssessments).values([
        { assessmentId: "DA-2026-001", wellId: "W-001", assetType: "ESP", damageClassification: "MECHANICAL", damageCause: "WEAR", severity: "HIGH", description: "ESP motor winding failure — insulation resistance < 1 MΩ. Pump impeller wear confirmed by performance curve deviation.", discoveredAt: daysAgo(47), reportedBy: "Carlos Mendez", status: "REPAIRED" },
        { assessmentId: "DA-2026-002", wellId: "W-004", assetType: "FLOW_METER", damageClassification: "ELECTRICAL", damageCause: "CORROSION", severity: "MEDIUM", description: "Intermittent signal loss from Promag 53 — internal corrosion of signal cable connector. Moisture ingress through cable gland.", discoveredAt: daysAgo(3), reportedBy: "David Chen", status: "UNDER_ASSESSMENT" },
      ] as any[]).returning();

      if (assessments[0]) {
        await db.insert(damageEvidence).values([
          { assessmentId: assessments[0].id, evidenceType: "PHOTO", description: "Motor winding discoloration — thermal damage visible", fileUrl: "https://cdn.ogrmm.com/evidence/DA-2026-001-motor.jpg", uploadedBy: "Carlos Mendez", uploadedAt: daysAgo(47) },
          { assessmentId: assessments[0].id, evidenceType: "TEST_REPORT", description: "Insulation resistance test report — 0.8 MΩ measured", fileUrl: "https://cdn.ogrmm.com/evidence/DA-2026-001-IR-test.pdf", uploadedBy: "Carlos Mendez", uploadedAt: daysAgo(47) },
        ] as any[]);
        const ticket = await db.insert(repairTickets).values([
          { ticketId: "RT-2026-001", assessmentId: assessments[0].id, wellId: "W-001", title: "ESP Motor Replacement — W-001", description: "Replace failed ESP motor unit. Inspect pump and seal section. Pressure test before re-run.", priority: "HIGH", status: "CLOSED", assignedTo: "Carlos Mendez", estimatedHours: 48, actualHours: 52, completedAt: daysAgo(39) },
        ] as any[]).returning();
        if (ticket[0]) {
          await db.insert(repairCostEstimates).values([
            { ticketId: ticket[0].id, category: "PARTS", description: "ESP motor replacement unit", estimatedCost: "95000", actualCost: "97500", currency: "USD" },
            { ticketId: ticket[0].id, category: "LABOR", description: "Rig crew and ESP specialist", estimatedCost: "72000", actualCost: "74000", currency: "USD" },
          ] as any[]);
        }
      }
      results.push({ domain: "damageAssessments", seeded: 2, skipped: false });
    } else {
      results.push({ domain: "damageAssessments", seeded: 0, skipped: true });
    }
  } catch (e: any) { results.push({ domain: "damageAssessments", seeded: 0, skipped: false, error: e.message }); }

  // ── 18. GEOMECHANICS ──────────────────────────────────────────────────────
  try {
    const existing = await countRows(db, geomechanicalModels);
    if (existing === 0) {
      const models = await db.insert(geomechanicalModels).values([
        { modelId: "GEO-001", wellId: "W-001", name: "Alpha-1 Geomechanical Model", method: "EATON", reservoirDepthFt: 8500, overburdenGradientPsiPerFt: "1.0", porePressureGradientPsiPerFt: "0.465", fracGradientPsiPerFt: "0.72", collapseGradientPsiPerFt: "0.52", ucsKpsi: "8.5", biotCoefficient: "0.85", poissonRatio: "0.28", youngModulusGpsi: "1.2", notes: "Calibrated against LOT at 8200 ft. Eaton exponent 1.2." },
        { modelId: "GEO-002", wellId: "W-005", name: "Echo-5 Geomechanical Model", method: "EATON", reservoirDepthFt: 6200, overburdenGradientPsiPerFt: "0.98", porePressureGradientPsiPerFt: "0.452", fracGradientPsiPerFt: "0.68", collapseGradientPsiPerFt: "0.48", ucsKpsi: "6.2", biotCoefficient: "0.82", poissonRatio: "0.31", youngModulusGpsi: "0.9", notes: "Sand onset risk at drawdown > 2800 psi. Recommend standalone screen." },
      ] as any[]).returning();

      if (models[0]) {
        // stressProfiles: modelId, wellId, depthFt, overburdenPpg, porePressurePpg, shminPpg, fractureGradientPpg, collapseGradientPpg
        await db.insert(stressProfiles).values([
          { modelId: models[0].id, wellId: "W-001", depthFt: 7000, overburdenPpg: "14.2", porePressurePpg: "8.9", shminPpg: "12.1", fractureGradientPpg: "13.8", collapseGradientPpg: "10.0" },
          { modelId: models[0].id, wellId: "W-001", depthFt: 8000, overburdenPpg: "14.5", porePressurePpg: "9.1", shminPpg: "12.4", fractureGradientPpg: "14.0", collapseGradientPpg: "10.3" },
          { modelId: models[0].id, wellId: "W-001", depthFt: 8500, overburdenPpg: "14.7", porePressurePpg: "9.3", shminPpg: "12.6", fractureGradientPpg: "14.2", collapseGradientPpg: "10.5" },
        ] as any[]);
      }
      results.push({ domain: "geomechanicalModels", seeded: 2, skipped: false });
    } else {
      results.push({ domain: "geomechanicalModels", seeded: 0, skipped: true });
    }
  } catch (e: any) { results.push({ domain: "geomechanicalModels", seeded: 0, skipped: false, error: e.message }); }

  // ── 19. MUD MANAGEMENT ────────────────────────────────────────────────────
  // mudInventory: locationId, locationName, mudType, mudGrade, currentVolumeBbl, maxCapacityBbl, ...
  // mudTransactions: inventoryId, transactionType, volumeBbl, costUsd, wellId, fromLocationId, toLocationId, referenceNumber, performedBy, notes, transactionAt
  try {
    const existing = await countRows(db, mudInventory);
    if (existing === 0) {
      const inv = await db.insert(mudInventory).values([
        { locationId: "MUD-LOC-001", locationName: "Alpha Field Mud Pit A", mudType: "WBM", mudGrade: "STANDARD", currentVolumeBbl: 450, maxCapacityBbl: 600, reorderPointBbl: 150, costPerBblUsd: "85", supplierName: "Halliburton Baroid", lastReceivedAt: daysAgo(5) },
        { locationId: "MUD-LOC-002", locationName: "Charlie-3 Mud Pit", mudType: "OBM", mudGrade: "HIGH_PERFORMANCE", currentVolumeBbl: 380, maxCapacityBbl: 500, reorderPointBbl: 100, costPerBblUsd: "145", supplierName: "M-I SWACO", lastReceivedAt: daysAgo(3) },
      ] as any[]).returning();
      if (inv[0]) {
        await db.insert(mudTransactions).values([
          { inventoryId: inv[0].id, transactionType: "RECEIVED", volumeBbl: 50, costUsd: "4250", wellId: "W-001", referenceNumber: "MUD-PO-2026-041", performedBy: "Carlos Mendez", transactionAt: daysAgo(5), notes: "Barite delivery — weight up to 9.2 ppg" },
          { inventoryId: inv[0].id, transactionType: "DISPOSED", volumeBbl: 30, wellId: "W-001", referenceNumber: "MUD-DISP-2026-012", performedBy: "Carlos Mendez", transactionAt: daysAgo(1), notes: "Discard high-solids mud — retort solids > 8%" },
        ] as any[]);
      }
      results.push({ domain: "mudInventory", seeded: 2, skipped: false });
    } else {
      results.push({ domain: "mudInventory", seeded: 0, skipped: true });
    }
  } catch (e: any) { results.push({ domain: "mudInventory", seeded: 0, skipped: false, error: e.message }); }

  // ── 20. SAND PRODUCTION RECORDS ───────────────────────────────────────────
  // sandProductionRecords: wellId, recordedAt, sandRateMgL, cumulativeSandKg, drawdownPsi, flowRateBpd, waterCut, sandRisk, criticalDrawdownPsi, safetyMarginPsi, sandControlMethod, completionType, ucsPsi, actionTaken, notes
  try {
    const existing = await countRows(db, sandProductionRecords);
    if (existing === 0) {
      await db.insert(sandProductionRecords).values(
        WELL_IDS.slice(0, 4).flatMap((wellId, wi) =>
          Array.from({ length: 7 }, (_, i) => ({
            wellId,
            recordedAt: daysAgo(6 - i),
            sandRateMgL: (0.5 + wi * 0.8 + i * 0.05).toFixed(2),
            cumulativeSandKg: ((wi + 1) * 45 + i * 2.5).toFixed(1),
            drawdownPsi: 2200 + wi * 200,
            flowRateBpd: 850 - wi * 80,
            waterCut: (0.15 + wi * 0.05).toFixed(2),
            sandRisk: (wi >= 2 ? "HIGH" : "MODERATE") as "HIGH" | "MODERATE" | "LOW" | "CRITICAL",
            criticalDrawdownPsi: 2800 + wi * 100,
            safetyMarginPsi: 600 - wi * 100,
            sandControlMethod: (wi >= 2 ? "STANDALONE_SCREEN" : "NONE") as any,
          }))
        ) as any[]
      );
      results.push({ domain: "sandProductionRecords", seeded: 28, skipped: false });
    } else {
      results.push({ domain: "sandProductionRecords", seeded: 0, skipped: true });
    }
  } catch (e: any) { results.push({ domain: "sandProductionRecords", seeded: 0, skipped: false, error: e.message }); }

  // ── 21. PRODUCED WATER RECORDS ────────────────────────────────────────────
  try {
    const existing = await countRows(db, producedWaterRecords);
    if (existing === 0) {
      await db.insert(producedWaterRecords).values(
        Array.from({ length: 14 }, (_, i) => ({
          fieldId: i < 7 ? "FIELD-ALPHA" : "FIELD-BRAVO",
          recordDate: daysAgo(13 - i),
          producedWaterBbl: 1200 + (i % 7) * 80,
          injectedWaterBbl: 950 + (i % 7) * 60,
          disposedWaterBbl: 180,
          recycledWaterBbl: 70,
          oilInWaterMgL: 18 + (i % 3) * 5,
          tssMgL: 45 + (i % 4) * 8,
          phValue: 7.2 + (i % 3) * 0.1,
          chlorideMgL: 35000 + (i % 5) * 2000,
          waterQualityStatus: (i % 7 === 3 ? "NON_COMPLIANT" : "COMPLIANT") as "COMPLIANT" | "NON_COMPLIANT" | "MARGINAL",
          injectionEfficiencyPct: 88 + (i % 5) * 2,
          recyclingRatePct: 5.8 + (i % 3) * 0.5,
          treatmentCostUsd: 4200 + (i % 4) * 300,
        }))
      );
      results.push({ domain: "producedWaterRecords", seeded: 14, skipped: false });
    } else {
      results.push({ domain: "producedWaterRecords", seeded: 0, skipped: true });
    }
  } catch (e: any) { results.push({ domain: "producedWaterRecords", seeded: 0, skipped: false, error: e.message }); }

  // ── 22. HEAVY OIL PARAMETERS ──────────────────────────────────────────────
  // heavyOilParameters: wellId, apiGravity, reservoirTempF, currentRateBpd, waterCut, steamInjectionCweBpd, steamQuality, gorScfPerBbl, netPayFt, porosityFraction, eorMethod, steamCostUsdPerBblCwe, currentViscosityCp, recommendedEorMethod, projectedRateUpliftPct, steamToOilRatio, thermalEfficiencyPct, netBenefitUsdPerYear, computedAt, notes
  try {
    const existing = await countRows(db, heavyOilParameters);
    if (existing === 0) {
      await db.insert(heavyOilParameters).values([
        { wellId: "W-007", apiGravity: 14.5, reservoirTempF: 82, currentRateBpd: 320, waterCut: 0.38, steamInjectionCweBpd: 850, steamQuality: 0.72, gorScfPerBbl: 45, netPayFt: 28, porosityFraction: 0.31, eorMethod: "SAGD", steamCostUsdPerBblCwe: 12.5, currentViscosityCp: 8500, recommendedEorMethod: "SAGD", projectedRateUpliftPct: 45, steamToOilRatio: 3.2, thermalEfficiencyPct: 68, netBenefitUsdPerYear: 2850000, computedAt: daysAgo(7), notes: "SAGD candidate — steam chamber developing. API 14.5 requires diluent for pipeline transport." },
        { wellId: "W-008", apiGravity: 16.2, reservoirTempF: 90, currentRateBpd: 280, waterCut: 0.42, steamInjectionCweBpd: 620, steamQuality: 0.75, gorScfPerBbl: 62, netPayFt: 22, porosityFraction: 0.28, eorMethod: "CSS", steamCostUsdPerBblCwe: 11.8, currentViscosityCp: 4200, recommendedEorMethod: "CSS", projectedRateUpliftPct: 38, steamToOilRatio: 2.8, thermalEfficiencyPct: 72, netBenefitUsdPerYear: 1920000, computedAt: daysAgo(7), notes: "CSS (cyclic steam stimulation) — 3rd cycle. Good response." },
      ] as any[]);
      results.push({ domain: "heavyOilParameters", seeded: 2, skipped: false });
    } else {
      results.push({ domain: "heavyOilParameters", seeded: 0, skipped: true });
    }
  } catch (e: any) { results.push({ domain: "heavyOilParameters", seeded: 0, skipped: false, error: e.message }); }

  // ── 23. LIQUID LOADING EVENTS ─────────────────────────────────────────────
  // liquidLoadingEvents: wellId, detectedAt, wellheadPressurePsia, wellheadTempF, gasRateMscfd, tubingIdIn, criticalVelocityFps, actualVelocityFps, criticalRateMscfd, velocityRatio, loadingStatus, daysToLoading, declineRateMscfdPerDay, remediationMethod, remediationAppliedAt, remediationNotes, urgency, resolvedAt, notes
  try {
    const existing = await countRows(db, liquidLoadingEvents);
    if (existing === 0) {
      await db.insert(liquidLoadingEvents).values([
        { wellId: "W-006", detectedAt: daysAgo(5), wellheadPressurePsia: 380, wellheadTempF: 142, gasRateMscfd: 850, tubingIdIn: 2.441, criticalVelocityFps: 8.2, actualVelocityFps: 6.8, criticalRateMscfd: 1020, velocityRatio: 0.83, loadingStatus: "LOADING", daysToLoading: 0, declineRateMscfdPerDay: 12, remediationMethod: "GAS_LIFT", urgency: "HIGH", notes: "Increase gas injection rate to 0.5 MMscf/d or install plunger lift" },
        { wellId: "W-006", detectedAt: daysAgo(30), wellheadPressurePsia: 410, wellheadTempF: 148, gasRateMscfd: 920, tubingIdIn: 2.441, criticalVelocityFps: 8.5, actualVelocityFps: 7.1, criticalRateMscfd: 1050, velocityRatio: 0.88, loadingStatus: "AT_RISK", daysToLoading: 14, declineRateMscfdPerDay: 8, remediationMethod: "MONITORING", urgency: "MEDIUM", resolvedAt: daysAgo(20), notes: "Monitor closely — approaching critical velocity" },
      ] as any[]);
      results.push({ domain: "liquidLoadingEvents", seeded: 2, skipped: false });
    } else {
      results.push({ domain: "liquidLoadingEvents", seeded: 0, skipped: true });
    }
  } catch (e: any) { results.push({ domain: "liquidLoadingEvents", seeded: 0, skipped: false, error: e.message }); }

  // ── 24. DECLINE CURVE PARAMS ──────────────────────────────────────────────
  // declineCurveParams: wellId, curveType, qi, di, b, economicLimit, eurBbls, remainingLifeYears, fittedAt, createdBy, notes
  try {
    const existing = await countRows(db, declineCurveParams);
    if (existing === 0) {
      await db.insert(declineCurveParams).values(
        WELL_IDS.map((wellId, i) => ({
          wellId,
          curveType: (i % 3 === 0 ? "EXPONENTIAL" : i % 3 === 1 ? "HYPERBOLIC" : "HARMONIC") as "EXPONENTIAL" | "HYPERBOLIC" | "HARMONIC",
          qi: 1200 - i * 80,
          di: 0.08 + i * 0.01,
          b: i % 3 === 1 ? 0.5 : null,
          economicLimit: 20,
          eurBbls: (850 - i * 60) * 365 * 3,
          remainingLifeYears: 12 - i,
          fittedAt: daysAgo(7),
          createdBy: "ML-SERVICE",
        }))
      );
      results.push({ domain: "declineCurveParams", seeded: 8, skipped: false });
    } else {
      results.push({ domain: "declineCurveParams", seeded: 0, skipped: true });
    }
  } catch (e: any) { results.push({ domain: "declineCurveParams", seeded: 0, skipped: false, error: e.message }); }

  // ── 25. ML PREDICTIONS + MODEL METRICS ───────────────────────────────────
  // mlPredictions: wellId, modelType, healthScore, failureProbability, daysToFailure, confidence, anomalyScore, features, recommendation, modelVersion, predictedAt
  // modelMetrics: tag, modelType, mae, rmse, mape, bias, r2, trainingSamples, horizon, trainedAt
  try {
    const existing = await countRows(db, mlPredictions);
    if (existing === 0) {
      await db.insert(mlPredictions).values(
        WELL_IDS.flatMap((wellId, wi) => [
          { wellId, modelType: "ANOMALY_DETECTION" as const, healthScore: 0.88 - wi * 0.04, failureProbability: 0.12 + wi * 0.03, daysToFailure: 180 - wi * 15, confidence: 0.94, anomalyScore: 0.08 + wi * 0.02, features: { vibration: 0.28 + wi * 0.02, temperature: 112 + wi * 3, current: 48 - wi * 1 }, recommendation: wi >= 3 ? "Schedule inspection within 30 days" : "Continue monitoring", modelVersion: "2.1.0", predictedAt: hoursAgo(1) },
          { wellId, modelType: "PRODUCTION_FORECAST" as const, healthScore: 0.92 - wi * 0.03, failureProbability: 0.05 + wi * 0.01, confidence: 0.89, features: { reservoir_pressure: 4200 - wi * 100, water_cut: 0.15 + wi * 0.05, esp_frequency: 48 - wi * 0.5 }, recommendation: wi >= 4 ? "Optimize ESP frequency for current IPR" : "Production on target", modelVersion: "3.0.0", predictedAt: hoursAgo(6) },
        ])
      );
      await db.insert(modelMetrics).values([
        { tag: "ANOMALY-V2.1", modelType: "ANOMALY_DETECTION" as const, mae: "0.031", rmse: "0.042", mape: "3.2", bias: "0.001", r2: "0.961", trainingSamples: 125000, horizon: 24, trainedAt: daysAgo(30) },
        { tag: "FORECAST-V3.0", modelType: "PRODUCTION_FORECAST" as const, mae: "35.6", rmse: "48.2", mape: "4.8", bias: "-1.2", r2: "0.943", trainingSamples: 89000, horizon: 720, trainedAt: daysAgo(14) },
      ] as any[]);
      results.push({ domain: "mlPredictions", seeded: 16, skipped: false });
    } else {
      results.push({ domain: "mlPredictions", seeded: 0, skipped: true });
    }
  } catch (e: any) { results.push({ domain: "mlPredictions", seeded: 0, skipped: false, error: e.message }); }

  // ── 26. PINN MODELS ───────────────────────────────────────────────────────
  // pinnModels: modelId, name, modelType, wellId, fieldId, onnxUrl, trainingDataPoints, validationRmse, physicsLossWeight, dataLossWeight, epochs, status, trainedAt, inferenceCount
  try {
    const existing = await countRows(db, pinnModels);
    if (existing === 0) {
      await db.insert(pinnModels).values([
        { modelId: "PINN-001", name: "Alpha-1 PINN Production Model", modelType: "PRODUCTION_FORECAST" as const, wellId: "W-001", fieldId: "FIELD-ALPHA", onnxUrl: "https://cdn.ogrmm.com/models/pinn-001.onnx", trainingDataPoints: 45000, validationRmse: "42.5", physicsLossWeight: 0.4, dataLossWeight: 0.6, epochs: 15000, status: "ACTIVE" as const, trainedAt: daysAgo(7), inferenceCount: 1440 },
        { modelId: "PINN-002", name: "Charlie-3 PINN Reservoir Model", modelType: "RESERVOIR_SIMULATION" as const, wellId: "W-003", fieldId: "FIELD-BRAVO", onnxUrl: "https://cdn.ogrmm.com/models/pinn-002.onnx", trainingDataPoints: 38000, validationRmse: "58.2", physicsLossWeight: 0.5, dataLossWeight: 0.5, epochs: 12000, status: "ACTIVE" as const, trainedAt: daysAgo(14), inferenceCount: 720 },
      ] as any[]);
      results.push({ domain: "pinnModels", seeded: 2, skipped: false });
    } else {
      results.push({ domain: "pinnModels", seeded: 0, skipped: true });
    }
  } catch (e: any) { results.push({ domain: "pinnModels", seeded: 0, skipped: false, error: e.message }); }

  // ── 27. PRODUCTION FORECASTS ──────────────────────────────────────────────
  // productionForecasts: wellId, forecastName, declineType, initialRateBopd, declineRateMonthly, bFactor, forecastYears, eurBbl, p10EurBbl, p50EurBbl, p90EurBbl, oilPriceUsdPerBbl, npv10M, createdBy
  try {
    const existing = await countRows(db, productionForecasts);
    if (existing === 0) {
      await db.insert(productionForecasts).values(
        WELL_IDS.map((wellId, i) => ({
          wellId,
          forecastName: `${wellId} ${i % 2 === 0 ? "PINN" : "Decline Curve"} Forecast — Q1 2026`,
          declineType: (i % 3 === 0 ? "EXPONENTIAL" : i % 3 === 1 ? "HYPERBOLIC" : "HARMONIC") as any,
          initialRateBopd: 850 - i * 60,
          declineRateMonthly: 0.025 + i * 0.003,
          bFactor: i % 3 === 1 ? 0.5 : null,
          forecastYears: 15,
          eurBbl: (850 - i * 60) * 365 * 10,
          p10EurBbl: (900 - i * 60) * 365 * 10,
          p50EurBbl: (850 - i * 60) * 365 * 10,
          p90EurBbl: (800 - i * 60) * 365 * 10,
          oilPriceUsdPerBbl: 85,
          npv10M: (850 - i * 60) * 365 * 10 * 85 / 1000000 * 0.62,
          createdBy: "ML-SERVICE",
        }))
      );
      results.push({ domain: "productionForecasts", seeded: 8, skipped: false });
    } else {
      results.push({ domain: "productionForecasts", seeded: 0, skipped: true });
    }
  } catch (e: any) { results.push({ domain: "productionForecasts", seeded: 0, skipped: false, error: e.message }); }

  // ── 28. RESERVOIR PRESSURE RECORDS ────────────────────────────────────────
  // reservoirPressureRecords: fieldId, wellId, recordDate, measuredPressurePsia, measurementMethod, depthFt, waterCutFrac, gasCap, aquiferStrength, notes
  try {
    const existing = await countRows(db, reservoirPressureRecords);
    if (existing === 0) {
      await db.insert(reservoirPressureRecords).values(
        WELL_IDS.flatMap((wellId, wi) =>
          Array.from({ length: 12 }, (_, i) => ({
            fieldId: wi < 4 ? "FIELD-ALPHA" : "FIELD-BRAVO",
            wellId,
            recordDate: daysAgo(330 - i * 30),
            measuredPressurePsia: 4200 - wi * 150 - i * 8,
            measurementMethod: (i % 3 === 0 ? "BUILDUP_TEST" : "FLOWING_GRADIENT") as any,
            depthFt: 8500 - wi * 200,
            waterCutFrac: 0.15 + wi * 0.05,
            gasCap: false,
            aquiferStrength: (["NONE", "WEAK", "MODERATE", "STRONG"] as const)[wi % 4],
          }))
        )
      );
      results.push({ domain: "reservoirPressureRecords", seeded: 96, skipped: false });
    } else {
      results.push({ domain: "reservoirPressureRecords", seeded: 0, skipped: true });
    }
  } catch (e: any) { results.push({ domain: "reservoirPressureRecords", seeded: 0, skipped: false, error: e.message }); }

  // ── 29. PRESSURE TESTS ────────────────────────────────────────────────────
  // pressureTests: wellId, testDate, testType, testPressurePsi, holdTimeMins, pressureDropPsi, acceptanceCriteriaPsi, passed, testFluid, notes, testedBy
  try {
    const existing = await countRows(db, pressureTests);
    if (existing === 0) {
      await db.insert(pressureTests).values([
        { wellId: "W-001", testDate: daysAgo(30), testType: "PRESSURE_INTEGRITY_TEST" as const, testPressurePsi: 5200, holdTimeMins: 30, pressureDropPsi: 12, acceptanceCriteriaPsi: 50, passed: true, testFluid: "WATER", notes: "PIT prior to ESP installation. Passed — pressure drop 12 psi < 50 psi acceptance.", testedBy: "Carlos Mendez" },
        { wellId: "W-003", testDate: daysAgo(3), testType: "INJECTIVITY_TEST" as const, testPressurePsi: 3800, holdTimeMins: 60, pressureDropPsi: 0, acceptanceCriteriaPsi: 0, passed: true, testFluid: "ACID", notes: "Injectivity test prior to acid stimulation. Injection rate 2.5 BPM at 3800 psi.", testedBy: "Sarah Mitchell" },
        { wellId: "W-007", testDate: daysAgo(180), testType: "PRESSURE_INTEGRITY_TEST" as const, testPressurePsi: 4200, holdTimeMins: 30, pressureDropPsi: 8, acceptanceCriteriaPsi: 50, passed: true, testFluid: "WATER", notes: "Annual casing integrity test. Passed.", testedBy: "David Chen" },
      ] as any[]);
      results.push({ domain: "pressureTests", seeded: 3, skipped: false });
    } else {
      results.push({ domain: "pressureTests", seeded: 0, skipped: true });
    }
  } catch (e: any) { results.push({ domain: "pressureTests", seeded: 0, skipped: false, error: e.message }); }

  // ── 30. CASING INSPECTIONS ────────────────────────────────────────────────
  // casingInspections: wellId, inspectionDate, inspectionType, casingString, topDepthFt, bottomDepthFt, wallThicknessIn, corrosionPct, ovalityPct, integrityScore, anomaliesFound, passedTest, nextInspectionDue, notes, inspectedBy
  try {
    const existing = await countRows(db, casingInspections);
    if (existing === 0) {
      await db.insert(casingInspections).values([
        { wellId: "W-001", inspectionDate: daysAgo(45), inspectionType: "CALIPER_LOG" as const, casingString: "PRODUCTION", topDepthFt: 0, bottomDepthFt: 8500, wallThicknessIn: 0.408, corrosionPct: 8.5, ovalityPct: 0.3, integrityScore: 92, anomaliesFound: false, passedTest: true, nextInspectionDue: daysAgo(-320), notes: "Minor scale buildup 6200-6400 ft. Overall good condition.", inspectedBy: "Carlos Mendez" },
        { wellId: "W-007", inspectionDate: daysAgo(180), inspectionType: "ELECTROMAGNETIC_INSPECTION" as const, casingString: "INTERMEDIATE", topDepthFt: 0, bottomDepthFt: 6200, wallThicknessIn: 0.472, corrosionPct: 22.3, ovalityPct: 0.8, integrityScore: 74, anomaliesFound: true, passedTest: true, nextInspectionDue: daysAgo(-180), notes: "Pitting corrosion at 4200-4350 ft — likely CO2 corrosion. Wall loss 22% approaching 25% threshold. Recommend corrosion inhibitor injection and re-inspection in 6 months.", inspectedBy: "Sarah Mitchell" },
      ] as any[]);
      results.push({ domain: "casingInspections", seeded: 2, skipped: false });
    } else {
      results.push({ domain: "casingInspections", seeded: 0, skipped: true });
    }
  } catch (e: any) { results.push({ domain: "casingInspections", seeded: 0, skipped: false, error: e.message }); }

  // ── 31. SUBSEA TREES + FPSO ───────────────────────────────────────────────
  // fpsoVessels: vesselId, name, imoNumber, field, status, latitude, longitude, storageBbls, currentInventoryBbls, processingCapacityBpd, currentProductionBpd, dataClassification
  // subseaTrees: treeId, wellId, fpsoId, name, status, waterDepthM, latitude, longitude, flowlineId, umbilicalId, masterValveOpen, wingValveOpen, swabValveOpen, annulusMasterOpen, wellheadPressureBar, flowTempC
  // fpsoTwinSessions: sessionId, fpsoId, userId, streamUrl, status, gpuNodeId, startedAt, endedAt, durationSec
  try {
    const existing = await countRows(db, fpsoVessels);
    if (existing === 0) {
      const fpso = await db.insert(fpsoVessels).values([
        { vesselId: "FPSO-001", name: "Offshore Pioneer", imoNumber: "IMO9876543", field: "FIELD-ALPHA", status: "OPERATIONAL" as const, latitude: "3.2847", longitude: "6.9521", storageBbls: 2000000, currentInventoryBbls: 1560000, processingCapacityBpd: 150000, currentProductionBpd: 142000, dataClassification: "CONFIDENTIAL" },
      ] as any[]).returning();

      if (fpso[0]) {
        await db.insert(subseaTrees).values([
          { treeId: "SST-001", wellId: "W-001", fpsoId: fpso[0].vesselId, name: "Alpha-1 Subsea Tree", status: "OPEN" as const, waterDepthM: 1200, latitude: "3.2850", longitude: "6.9525", flowlineId: "FL-001", umbilicalId: "UMB-001", masterValveOpen: true, wingValveOpen: true, swabValveOpen: false, annulusMasterOpen: false, wellheadPressureBar: 265, flowTempC: 82 },
          { treeId: "SST-002", wellId: "W-002", fpsoId: fpso[0].vesselId, name: "Bravo-2 Subsea Tree", status: "OPEN" as const, waterDepthM: 1185, latitude: "3.2855", longitude: "6.9530", flowlineId: "FL-002", umbilicalId: "UMB-002", masterValveOpen: true, wingValveOpen: true, swabValveOpen: false, annulusMasterOpen: false, wellheadPressureBar: 258, flowTempC: 79 },
        ] as any[]);
        await db.insert(fpsoTwinSessions).values([
          { sessionId: "FTS-001", fpsoId: fpso[0].vesselId, userId: 1, streamUrl: "wss://twin.ogrmm.com/fpso-001/stream", status: "ACTIVE" as const, gpuNodeId: "GPU-NODE-03", startedAt: hoursAgo(8) },
        ] as any[]);
      }
      results.push({ domain: "fpsoVessels", seeded: 1, skipped: false });
    } else {
      results.push({ domain: "fpsoVessels", seeded: 0, skipped: true });
    }
  } catch (e: any) { results.push({ domain: "fpsoVessels", seeded: 0, skipped: false, error: e.message }); }

  // ── 32. HPU UNITS ─────────────────────────────────────────────────────────
  // hpuUnits: hpuId, fpsoId, wellId, name, status, systemPressureBar, reservoirLevelPct, pumpAStatus, pumpBStatus, filterDpBar, oilTempC
  try {
    const existing = await countRows(db, hpuUnits);
    if (existing === 0) {
      await db.insert(hpuUnits).values([
        { hpuId: "HPU-001", wellId: "W-001", name: "Alpha-1 Hydraulic Power Unit", status: "RUNNING" as const, systemPressureBar: 210, reservoirLevelPct: 82, pumpAStatus: "RUNNING" as const, pumpBStatus: "STANDBY" as const, filterDpBar: 0.8, oilTempC: 48 },
        { hpuId: "HPU-002", wellId: "W-003", name: "Charlie-3 HPU", status: "RUNNING" as const, systemPressureBar: 250, reservoirLevelPct: 75, pumpAStatus: "RUNNING" as const, pumpBStatus: "STANDBY" as const, filterDpBar: 1.2, oilTempC: 52 },
      ] as any[]);
      results.push({ domain: "hpuUnits", seeded: 2, skipped: false });
    } else {
      results.push({ domain: "hpuUnits", seeded: 0, skipped: true });
    }
  } catch (e: any) { results.push({ domain: "hpuUnits", seeded: 0, skipped: false, error: e.message }); }

  // ── 33. ACTUATOR COMMANDS ─────────────────────────────────────────────────
  // actuatorCommands: commandId, wellId, assetId, assetName, commandType, targetValue, status, issuedBy, approvedBy, confirmationCode, executedAt, failureReason, auditTrail
  try {
    const existing = await countRows(db, actuatorCommands);
    if (existing === 0) {
      await db.insert(actuatorCommands).values([
        { commandId: "CMD-001", wellId: "W-001", assetId: "DEV-001", assetName: "ESP Controller Alpha-1", commandType: "SET_FREQUENCY" as const, targetValue: "48.0", status: "EXECUTED" as const, issuedBy: "Carlos Mendez", approvedBy: "James Okafor", confirmationCode: "CONF-001-48HZ", executedAt: hoursAgo(4), auditTrail: [{ ts: hoursAgo(4).toISOString(), action: "ISSUED" }, { ts: hoursAgo(4).toISOString(), action: "APPROVED" }, { ts: hoursAgo(4).toISOString(), action: "EXECUTED" }] },
        { commandId: "CMD-002", wellId: "W-002", assetId: "DEV-002", assetName: "RTU Bravo-2", commandType: "OPEN_VALVE" as const, targetValue: "100", status: "EXECUTED" as const, issuedBy: "Sarah Mitchell", approvedBy: "James Okafor", confirmationCode: "CONF-002-OPEN", executedAt: hoursAgo(2), auditTrail: [{ ts: hoursAgo(2).toISOString(), action: "ISSUED" }, { ts: hoursAgo(2).toISOString(), action: "EXECUTED" }] },
        { commandId: "CMD-003", wellId: "W-005", assetId: "DEV-005", assetName: "Edge Gateway Echo-5", commandType: "SET_CHOKE" as const, targetValue: "32", status: "PENDING" as const, issuedBy: "James Okafor", auditTrail: [{ ts: hoursAgo(1).toISOString(), action: "ISSUED" }] },
      ] as any[]);
      results.push({ domain: "actuatorCommands", seeded: 3, skipped: false });
    } else {
      results.push({ domain: "actuatorCommands", seeded: 0, skipped: true });
    }
  } catch (e: any) { results.push({ domain: "actuatorCommands", seeded: 0, skipped: false, error: e.message }); }

  // ── 34. ALERT THRESHOLDS ──────────────────────────────────────────────────
  // alertThresholds: wellId, sensorType, minValue, maxValue, unit, enabled, createdBy
  try {
    const existing = await countRows(db, alertThresholds);
    if (existing === 0) {
      await db.insert(alertThresholds).values(
        WELL_IDS.flatMap(wellId => [
          { wellId, sensorType: "PRESSURE_TRANSMITTER" as const, minValue: 200, maxValue: 4500, unit: "psi", enabled: true, createdBy: "James Okafor" },
          { wellId, sensorType: "VIBRATION_SENSOR" as const, minValue: 0, maxValue: 0.45, unit: "in/s", enabled: true, createdBy: "James Okafor" },
          { wellId, sensorType: "TEMPERATURE_SENSOR" as const, minValue: 20, maxValue: 135, unit: "°C", enabled: true, createdBy: "James Okafor" },
          { wellId, sensorType: "FLOW_METER" as const, minValue: 0, maxValue: 1500, unit: "BOPD", enabled: true, createdBy: "James Okafor" },
        ])
      );
      results.push({ domain: "alertThresholds", seeded: 32, skipped: false });
    } else {
      results.push({ domain: "alertThresholds", seeded: 0, skipped: true });
    }
  } catch (e: any) { results.push({ domain: "alertThresholds", seeded: 0, skipped: false, error: e.message }); }

  // ── 35. ALARM RULES ───────────────────────────────────────────────────────
  // alarmRules: ruleId, wellId, tag, sensorField, condition, threshold, deadBand, severity, description, unit, isa182Category, enabled
  try {
    const existing = await countRows(db, alarmRules);
    if (existing === 0) {
      await db.insert(alarmRules).values([
        { ruleId: "RULE-001", wellId: "W-001", tag: "VT-1001", sensorField: "vibration_rms", condition: "GREATER_THAN" as const, threshold: 0.45, deadBand: 0.05, severity: "CRITICAL" as const, description: "ESP High Vibration — Critical shutdown threshold", unit: "in/s", isa182Category: "BAD_ACTOR", enabled: true },
        { ruleId: "RULE-002", wellId: "W-001", tag: "PT-1001", sensorField: "tubing_pressure", condition: "GREATER_THAN" as const, threshold: 4200, deadBand: 50, severity: "WARNING" as const, description: "High Tubing Pressure — Warning threshold", unit: "psi", isa182Category: "PROCESS_ALERT", enabled: true },
        { ruleId: "RULE-003", wellId: "W-005", tag: "SAND-5001", sensorField: "sand_rate_mg_l", condition: "GREATER_THAN" as const, threshold: 2.0, deadBand: 0.2, severity: "WARNING" as const, description: "Sand Rate High — reduce drawdown", unit: "mg/L", isa182Category: "PROCESS_ALERT", enabled: true },
        { ruleId: "RULE-004", wellId: "W-001", tag: "TT-1001", sensorField: "motor_temp", condition: "GREATER_THAN" as const, threshold: 135, deadBand: 5, severity: "CRITICAL" as const, description: "Motor Temperature Critical — shutdown required", unit: "°C", isa182Category: "SAFETY_ALERT", enabled: true },
      ] as any[]);
      results.push({ domain: "alarmRules", seeded: 4, skipped: false });
    } else {
      results.push({ domain: "alarmRules", seeded: 0, skipped: true });
    }
  } catch (e: any) { results.push({ domain: "alarmRules", seeded: 0, skipped: false, error: e.message }); }

  // ── 36. DIGITAL TWIN SCENARIOS ────────────────────────────────────────────
  // digitalTwinScenarios: scenarioId, wellId, name, reservoirPressurePsi, skinFactor, perforationInterval, espFrequencyHz, chokeOpeningPct, predictedRateBpd, iprAofBpd, optimumRateBpd, createdBy
  try {
    const existing = await countRows(db, digitalTwinScenarios);
    if (existing === 0) {
      await db.insert(digitalTwinScenarios).values([
        { scenarioId: "DTS-001", wellId: "W-001", name: "ESP Frequency Optimization", reservoirPressurePsi: 4200, skinFactor: 2.1, perforationInterval: 45, espFrequencyHz: 48, chokeOpeningPct: 100, predictedRateBpd: 847, iprAofBpd: 1250, optimumRateBpd: 847, createdBy: "PINN-ML-SERVICE" },
        { scenarioId: "DTS-002", wellId: "W-003", name: "Post-Acid Stimulation Forecast", reservoirPressurePsi: 3980, skinFactor: 2.0, perforationInterval: 38, espFrequencyHz: 50, chokeOpeningPct: 100, predictedRateBpd: 785, iprAofBpd: 1100, optimumRateBpd: 785, createdBy: "Sarah Mitchell" },
        { scenarioId: "DTS-003", wellId: "W-005", name: "Sand Control Impact Assessment", reservoirPressurePsi: 3850, skinFactor: 1.5, perforationInterval: 32, espFrequencyHz: 46, chokeOpeningPct: 80, predictedRateBpd: 681, iprAofBpd: 980, optimumRateBpd: 681, createdBy: "James Okafor" },
      ] as any[]);
      results.push({ domain: "digitalTwinScenarios", seeded: 3, skipped: false });
    } else {
      results.push({ domain: "digitalTwinScenarios", seeded: 0, skipped: true });
    }
  } catch (e: any) { results.push({ domain: "digitalTwinScenarios", seeded: 0, skipped: false, error: e.message }); }

  // ── 37. DEMAND RESPONSE (OpenADR 3.0 schema) ─────────────────────────────
  try {
    const existing = await countRows(db, drPrograms);
    if (existing === 0) {
      const programs = await db.insert(drPrograms).values([
        { programId: "DRP-001", name: "Peak Shaving — ESP Load Management", programType: "PEAK_SHAVING" as const, country: "NG", status: "ACTIVE" as const, description: "Curtail ESP load during grid peak hours to earn demand response incentive", createdBy: "owner-001" },
      ] as any[]).returning();

      if (programs[0]) {
        const ven = await db.insert(drVens).values([
          { venId: "VEN-001", venName: "Alpha Field VEN", programId: programs[0].id, facilityId: "FIELD-ALPHA", resourceType: "ESP_LOAD" as const, maxLoadKw: 2400, currentLoadKw: 2100, availableKw: 850, status: "REGISTERED" as const },
        ] as any[]).returning();

        if (ven[0]) {
          await db.insert(drEvents).values([
            { eventId: "DRE-001", programId: programs[0].id, eventName: "Peak Curtailment Event 1", status: "COMPLETED" as const, priority: 1, startTime: daysAgo(5), endTime: daysAgo(5), signalType: "LOAD_CURTAILMENT" as const, payloadValue: "600", payloadUnit: "kW", createdBy: "GRID-001" },
            { eventId: "DRE-002", programId: programs[0].id, eventName: "Peak Curtailment Event 2", status: "COMPLETED" as const, priority: 2, startTime: daysAgo(2), endTime: daysAgo(2), signalType: "LOAD_CURTAILMENT" as const, payloadValue: "750", payloadUnit: "kW", createdBy: "GRID-001" },
          ] as any[]);
          await db.insert(drAuditLog).values([
            { eventId: "DRE-001", programId: programs[0].id, venId: "VEN-001", tag: "DISPATCH", setpointKw: 600, baselineKw: 2100, actualKw: 1520, deviationKw: 20, curtailmentKw: 580, dispatchedAt: daysAgo(5) },
          ] as any[]);
        }
      }
      results.push({ domain: "drPrograms", seeded: 1, skipped: false });
    } else {
      results.push({ domain: "drPrograms", seeded: 0, skipped: true });
    }
  } catch (e: any) { results.push({ domain: "drPrograms", seeded: 0, skipped: false, error: e.message }); }

  // ── 38. FEDERATED MODELS ──────────────────────────────────────────────────
  try {
    const existing = await countRows(db, federatedModels);
    if (existing === 0) {
      const fedModel = await db.insert(federatedModels).values([
        { modelId: "FED-001", name: "Cross-Field ESP Failure Prediction", modelType: "ANOMALY_DETECTION" as const, aggregationStrategy: "FEDAVG" as const, globalRound: 12, participantCount: 3, minParticipants: 3, globalAccuracy: "0.943", globalLoss: "0.042", status: "ACTIVE" as const, lastAggregatedAt: daysAgo(7) },
      ] as any[]).returning();

      if (fedModel[0]) {
        await db.insert(federatedParticipants).values([
          { modelId: fedModel[0].id, tenantId: "TENANT-001", participantName: "Operator Alpha", localDataPoints: 45000, localAccuracy: "0.951", lastContributedAt: daysAgo(7), contributionRound: 12, status: "ACTIVE" as const, joinedAt: daysAgo(90) },
          { modelId: fedModel[0].id, tenantId: "TENANT-002", participantName: "Operator Bravo", localDataPoints: 38000, localAccuracy: "0.938", lastContributedAt: daysAgo(7), contributionRound: 12, status: "ACTIVE" as const, joinedAt: daysAgo(90) },
          { modelId: fedModel[0].id, tenantId: "TENANT-003", participantName: "Operator Charlie", localDataPoints: 29000, localAccuracy: "0.941", lastContributedAt: daysAgo(7), contributionRound: 12, status: "ACTIVE" as const, joinedAt: daysAgo(60) },
        ] as any[]);
      }
      results.push({ domain: "federatedModels", seeded: 1, skipped: false });
    } else {
      results.push({ domain: "federatedModels", seeded: 0, skipped: true });
    }
  } catch (e: any) { results.push({ domain: "federatedModels", seeded: 0, skipped: false, error: e.message }); }

  // ── 39. MARKETPLACE INSTALLS + RUNS ───────────────────────────────────────
  try {
    const existing = await countRows(db, marketplaceInstalls);
    if (existing === 0) {
      await db.insert(marketplaceInstalls).values([
        { appId: "APP-001", tenantId: "TENANT-001", installedBy: "owner-001", configJson: { apiEndpoint: "https://api.ogrmm.com/ml", modelVersion: "2.1" }, isActive: true, installedAt: daysAgo(30), runCount: 48 },
        { appId: "APP-003", tenantId: "TENANT-001", installedBy: "owner-001", configJson: { reportFrequency: "daily", recipients: ["james.okafor@ogrmm.com"] }, isActive: true, installedAt: daysAgo(14), runCount: 14 },
      ] as any[]);
      await db.insert(marketplaceRuns).values([
        { runId: "RUN-001", appId: "APP-001", tenantId: "TENANT-001", triggeredBy: "SCHEDULE" as const, outputData: { anomalies: 0, warnings: 2 }, status: "SUCCESS" as const, startedAt: hoursAgo(6), completedAt: hoursAgo(5), durationMs: 3420000 },
        { runId: "RUN-002", appId: "APP-001", tenantId: "TENANT-001", triggeredBy: "ALARM" as const, outputData: { riskScore: 0.18, level: "LOW" }, status: "SUCCESS" as const, startedAt: hoursAgo(2), completedAt: hoursAgo(2), durationMs: 145000 },
      ] as any[]);
      results.push({ domain: "marketplaceInstalls", seeded: 2, skipped: false });
    } else {
      results.push({ domain: "marketplaceInstalls", seeded: 0, skipped: true });
    }
  } catch (e: any) { results.push({ domain: "marketplaceInstalls", seeded: 0, skipped: false, error: e.message }); }

  // ── 40. MOJALOOP SETTLEMENTS ──────────────────────────────────────────────
  try {
    const existing = await countRows(db, mojaloopSettlements);
    if (existing === 0) {
      await db.insert(mojaloopSettlements).values([
        { settlementId: "SETTLE-001", counterparty: "Halliburton Energy Services", counterpartyIdType: "BUSINESS_ID" as const, counterpartyIdValue: "HAL-US-001", amountUsd: "185000", currency: "USD", settlementType: "VENDOR_PAYMENT" as const, wellId: "W-001", status: "COMPLETED" as const, initiatedBy: "owner-001", completedAt: daysAgo(35), valueDate: daysAgo(35) },
        { settlementId: "SETTLE-002", counterparty: "ChampionX Corporation", counterpartyIdType: "BUSINESS_ID" as const, counterpartyIdValue: "CHX-US-001", amountUsd: "12500", currency: "USD", settlementType: "VENDOR_PAYMENT" as const, wellId: "W-001", status: "COMPLETED" as const, initiatedBy: "owner-001", completedAt: daysAgo(12), valueDate: daysAgo(12) },
      ] as any[]);
      results.push({ domain: "mojaloopSettlements", seeded: 2, skipped: false });
    } else {
      results.push({ domain: "mojaloopSettlements", seeded: 0, skipped: true });
    }
  } catch (e: any) { results.push({ domain: "mojaloopSettlements", seeded: 0, skipped: false, error: e.message }); }

  // ── 41. OSDU DATASETS ─────────────────────────────────────────────────────
  try {
    const existing = await countRows(db, osduDatasets);
    if (existing === 0) {
      await db.insert(osduDatasets).values([
        { datasetId: "OSDU-001", kind: "osdu:wks:dataset--File.Generic:1.0.0", namespace: "ogrmm", version: 1, acl: { viewers: ["data.default.viewers@ogrmm.com"], owners: ["data.default.owners@ogrmm.com"] }, legal: { legaltags: ["ogrmm-default-legal"], otherRelevantDataCountries: ["NG"] }, data: { name: "Alpha-1 Well Log — LAS 2.0", description: "Composite well log — GR, RHOB, NPHI, DT, RT, SP from 0-8500 ft", wellId: "W-001" }, status: "ACTIVE" as const },
        { datasetId: "OSDU-002", kind: "osdu:wks:dataset--File.Generic:1.0.0", namespace: "ogrmm", version: 1, acl: { viewers: ["data.default.viewers@ogrmm.com"], owners: ["data.default.owners@ogrmm.com"] }, legal: { legaltags: ["ogrmm-default-legal"], otherRelevantDataCountries: ["NG"] }, data: { name: "Bravo Field 3D Seismic — SEG-Y", description: "Full-field 3D seismic survey — 12 km × 8 km, 25m bin size, 2022 vintage" }, status: "ACTIVE" as const },
      ] as any[]);
      results.push({ domain: "osduDatasets", seeded: 2, skipped: false });
    } else {
      results.push({ domain: "osduDatasets", seeded: 0, skipped: true });
    }
  } catch (e: any) { results.push({ domain: "osduDatasets", seeded: 0, skipped: false, error: e.message }); }

  // ── 42. PRODML PRODUCTION SETS ────────────────────────────────────────────
  try {
    const existing = await countRows(db, prodmlProductionSets);
    if (existing === 0) {
      await db.insert(prodmlProductionSets).values([
        { uid: "PRODML-001", uidWell: "W-001", dTimStart: daysAgo(30), dTimEnd: daysAgo(1), oilVolume: "24650", gasVolume: "14.8", waterVolume: "4380", condensateVolume: "0", injectedWaterVolume: "3200", volumeUom: "bbl", pressureAvg: "3850", tempAvg: "185" },
      ] as any[]);
      results.push({ domain: "prodmlProductionSets", seeded: 1, skipped: false });
    } else {
      results.push({ domain: "prodmlProductionSets", seeded: 0, skipped: true });
    }
  } catch (e: any) { results.push({ domain: "prodmlProductionSets", seeded: 0, skipped: false, error: e.message }); }

  // ── 43. PUSH SUBSCRIPTIONS ────────────────────────────────────────────────
  try {
    const existing = await countRows(db, pushSubscriptions);
    if (existing === 0) {
      await db.insert(pushSubscriptions).values([
        { userId: 1, endpoint: "https://fcm.googleapis.com/fcm/send/placeholder-001", p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlIizaATAVIw3", auth: "tBHIyp9Vfs0K55fS_T3GIw", userAgent: "Mozilla/5.0 Chrome/120" },
        { userId: 2, endpoint: "https://fcm.googleapis.com/fcm/send/placeholder-002", p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlIizaATAVIw4", auth: "tBHIyp9Vfs0K55fS_T3GIx", userAgent: "Mozilla/5.0 Chrome/120" },
      ] as any[]);
      results.push({ domain: "pushSubscriptions", seeded: 2, skipped: false });
    } else {
      results.push({ domain: "pushSubscriptions", seeded: 0, skipped: true });
    }
  } catch (e: any) { results.push({ domain: "pushSubscriptions", seeded: 0, skipped: false, error: e.message }); }

  // ── 44. AGENT WORKFLOWS + RUNS ────────────────────────────────────────────
  try {
    const existing = await countRows(db, agentWorkflows);
    if (existing === 0) {
      const workflows = await db.insert(agentWorkflows).values([
        { workflowId: "WF-001", name: "Daily Production Report", description: "Automated daily production summary — aggregates all well data, generates PDF report, emails to stakeholders", triggerType: "SCHEDULE" as const, triggerConfig: { cron: "0 0 6 * * *" }, steps: [{ step: 1, action: "AGGREGATE_PRODUCTION" }, { step: 2, action: "GENERATE_PDF" }, { step: 3, action: "SEND_EMAIL" }], isActive: true, createdBy: "owner-001" },
        { workflowId: "WF-002", name: "ESP Failure Response", description: "Automated response to ESP failure alarm — creates workover, notifies contractor, updates CMMS", triggerType: "ALARM" as const, triggerConfig: { alarmType: "ESP_FAILURE" }, steps: [{ step: 1, action: "CREATE_WORKOVER" }, { step: 2, action: "NOTIFY_CONTRACTOR" }, { step: 3, action: "UPDATE_CMMS" }], isActive: true, createdBy: "owner-001" },
      ] as any[]).returning();

      if (workflows[0]) {
        await db.insert(agentWorkflowRuns).values([
          { runId: "WFR-001", workflowId: workflows[0].id, status: "COMPLETED" as const, currentStep: 3, totalSteps: 3, context: { date: daysAgo(1).toISOString() }, stepResults: [{ step: 1, status: "ok" }, { step: 2, status: "ok" }, { step: 3, status: "ok" }], triggeredBy: "SCHEDULE", startedAt: daysAgo(1), completedAt: daysAgo(1), durationMs: 3420000 },
          { runId: "WFR-002", workflowId: workflows[0].id, status: "COMPLETED" as const, currentStep: 3, totalSteps: 3, context: { date: daysAgo(2).toISOString() }, stepResults: [{ step: 1, status: "ok" }, { step: 2, status: "ok" }, { step: 3, status: "ok" }], triggeredBy: "SCHEDULE", startedAt: daysAgo(2), completedAt: daysAgo(2), durationMs: 3180000 },
        ] as any[]);
      }
      results.push({ domain: "agentWorkflows", seeded: 2, skipped: false });
    } else {
      results.push({ domain: "agentWorkflows", seeded: 0, skipped: true });
    }
  } catch (e: any) { results.push({ domain: "agentWorkflows", seeded: 0, skipped: false, error: e.message }); }

  // ── 45. AI COPILOT CHATS ──────────────────────────────────────────────────
  try {
    const existing = await countRows(db, aiCopilotChats);
    if (existing === 0) {
      await db.insert(aiCopilotChats).values([
        { userId: "owner-001", sessionId: "SESSION-001", role: "user" as const, content: "What is the current ESP failure risk for W-001?", contextWellId: "W-001", createdAt: hoursAgo(3) },
        { userId: "owner-001", sessionId: "SESSION-001", role: "assistant" as const, content: "Based on the PINN model and current telemetry, W-001 has a LOW ESP failure risk (score: 0.18). Vibration is 0.28 in/s (threshold: 0.45), motor temperature is 112°C (threshold: 135°C), and current draw is nominal at 48A. No immediate action required. Recommend monitoring vibration trend over next 24 hours.", contextWellId: "W-001", createdAt: hoursAgo(3) },
        { userId: "op-002", sessionId: "SESSION-002", role: "user" as const, content: "What is the expected production uplift from the acid job on W-003?", contextWellId: "W-003", createdAt: hoursAgo(8) },
        { userId: "op-002", sessionId: "SESSION-002", role: "assistant" as const, content: "Based on the pressure test results (skin = 8.5) and the PINN model, the acid stimulation on W-003 is expected to reduce skin to approximately 2.0-2.5, resulting in a production increase of 160-180 BOPD (from 612 to ~780 BOPD). This represents a 27% uplift. The payback period at $85/bbl is approximately 7 days.", contextWellId: "W-003", createdAt: hoursAgo(8) },
      ] as any[]);
      results.push({ domain: "aiCopilotChats", seeded: 4, skipped: false });
    } else {
      results.push({ domain: "aiCopilotChats", seeded: 0, skipped: true });
    }
  } catch (e: any) { results.push({ domain: "aiCopilotChats", seeded: 0, skipped: false, error: e.message }); }

  // ── 46. SAAS SUBSCRIPTIONS + USAGE METRICS ────────────────────────────────
  try {
    const existing = await countRows(db, saasSubscriptions);
    if (existing === 0) {
      await db.insert(saasSubscriptions).values([
        { subscriptionId: "SUB-001", tenantId: "TENANT-001", planId: "PLAN-ENTERPRISE", billingCycle: "ANNUAL" as const, status: "ACTIVE" as const, stripeSubscriptionId: "sub_placeholder_001", stripeCustomerId: "cus_placeholder_001", currentPeriodStart: daysAgo(90), currentPeriodEnd: daysAgo(-275), wellCount: 8, monthlyRevenue: "12400" },
        { subscriptionId: "SUB-002", tenantId: "TENANT-002", planId: "PLAN-PROFESSIONAL", billingCycle: "MONTHLY" as const, status: "ACTIVE" as const, stripeSubscriptionId: "sub_placeholder_002", stripeCustomerId: "cus_placeholder_002", currentPeriodStart: daysAgo(14), currentPeriodEnd: daysAgo(-16), wellCount: 3, monthlyRevenue: "4200" },
      ] as any[]);
      await db.insert(saasUsageMetrics).values(
        Array.from({ length: 7 }, (_, i) => ({
          tenantId: "TENANT-001",
          metricDate: daysAgo(6 - i),
          activeWells: 8,
          activeUsers: 4 + (i % 2),
          apiCallsTotal: 48200 + i * 1200,
          dataIngestGb: 2.4 + i * 0.1,
          storageUsedGb: 145 + i * 2,
          aiCopilotQueries: 12 + (i % 5),
          optimizationRuns: 8 + (i % 3),
        }))
      );
      results.push({ domain: "saasSubscriptions", seeded: 2, skipped: false });
    } else {
      results.push({ domain: "saasSubscriptions", seeded: 0, skipped: true });
    }
  } catch (e: any) { results.push({ domain: "saasSubscriptions", seeded: 0, skipped: false, error: e.message }); }

  // ── 47. WELL ALLOCATION FACTORS + ALLOCATED PRODUCTION + ALLOCATION RECORDS
  try {
    const existing = await countRows(db, wellAllocationFactors);
    if (existing === 0) {
      await db.insert(wellAllocationFactors).values(
        WELL_IDS.map((wellId, i) => ({
          ruleId: `ALLOC-RULE-${i + 1}`,
          wellId,
          oilFactor: (0.85 + i * 0.02).toFixed(4),
          gasFactor: (0.88 + i * 0.015).toFixed(4),
          waterFactor: (0.92 + i * 0.01).toFixed(4),
          basisType: (i % 2 === 0 ? "WELL_TEST" : "SIMULATION") as any,
          basisDate: daysAgo(30),
        })) as any[]
      );
      await db.insert(allocatedProduction).values(
        WELL_IDS.map((wellId, i) => ({
          allocationDate: daysAgo(1),
          wellId,
          ruleId: `ALLOC-RULE-${i + 1}`,
          allocatedOilBbl: Math.round((850 - i * 60) * 0.97),
          allocatedGasMcf: parseFloat(((0.52 - i * 0.04) * 0.97).toFixed(3)),
          allocatedWaterBbl: Math.round((150 + i * 30) * 0.97),
          allocationMethod: "WELL_TEST_FACTOR" as const,
        }))
      );
      await db.insert(allocationRecords).values([
        { wellId: "W-001", separatorId: "SEP-001", date: daysAgo(1), allocatedOilBbls: 4850, allocatedGasMmscf: "2.92", allocatedWaterBbls: 1820, allocationFactor: "0.97", method: "WELL_TEST_FACTOR" as const, imbalanceBbls: 25 },
      ] as any[]);
      results.push({ domain: "wellAllocationFactors", seeded: 8, skipped: false });
    } else {
      results.push({ domain: "wellAllocationFactors", seeded: 0, skipped: true });
    }
  } catch (e: any) { results.push({ domain: "wellAllocationFactors", seeded: 0, skipped: false, error: e.message }); }

  // ── 48. CARBON TARGETS ────────────────────────────────────────────────────
  try {
    const existing = await countRows(db, carbonTargets);
    if (existing === 0) {
      await db.insert(carbonTargets).values([
        { targetYear: 2026, scope: "SCOPE_1_2" as const, baselineYear: 2022, baselineCo2eTonnes: "42000", targetCo2eTonnes: "28000", reductionPercent: "33.3", actualCo2eTonnes: "35000", status: "ON_TRACK" as const },
        { targetYear: 2025, scope: "SCOPE_1_2" as const, baselineYear: 2022, baselineCo2eTonnes: "42000", targetCo2eTonnes: "35000", reductionPercent: "16.7", actualCo2eTonnes: "38000", status: "ACHIEVED" as const },
      ] as any[]);
      results.push({ domain: "carbonTargets", seeded: 2, skipped: false });
    } else {
      results.push({ domain: "carbonTargets", seeded: 0, skipped: true });
    }
  } catch (e: any) { results.push({ domain: "carbonTargets", seeded: 0, skipped: false, error: e.message }); }

  // ── 49. REGULATORY REPORTS ────────────────────────────────────────────────
  try {
    const existing = await countRows(db, regulatoryReports);
    if (existing === 0) {
      await db.insert(regulatoryReports).values([
        { reportId: "REG-2026-Q1", reportType: "PRODUCTION_REPORT" as const, period: "Q1 2026", status: "SUBMITTED" as const, language: "en", generatedAt: daysAgo(7), submittedAt: daysAgo(5), submittedBy: "James Okafor", submissionRef: "DPR-2026-Q1-001", fileUrl: "https://cdn.ogrmm.com/regulatory/DPR-Q1-2026.pdf", notes: "Quarterly production report — all fields. Submitted 5 days early." },
        { reportId: "REG-2026-ENV-01", reportType: "ENVIRONMENTAL_REPORT" as const, period: "January 2026", status: "SUBMITTED" as const, language: "en", generatedAt: daysAgo(46), submittedAt: daysAgo(45), submittedBy: "Carlos Mendez", submissionRef: "NESREA-ENV-JAN-2026-001", fileUrl: "https://cdn.ogrmm.com/regulatory/NESREA-ENV-JAN-2026.pdf", notes: "Monthly environmental compliance report. Accepted without queries." },
        { reportId: "REG-2026-HSE-01", reportType: "HSE_STATISTICS" as const, period: "Q1 2026", status: "DRAFT" as const, language: "en", generatedAt: daysAgo(3), notes: "Q1 HSE statistics — 1 first aid incident, 0 LTIs, 0 environmental incidents." },
      ] as any[]);
      results.push({ domain: "regulatoryReports", seeded: 3, skipped: false });
    } else {
      results.push({ domain: "regulatoryReports", seeded: 0, skipped: true });
    }
  } catch (e: any) { results.push({ domain: "regulatoryReports", seeded: 0, skipped: false, error: e.message }); }

  // ── 50. USER INVITATIONS ──────────────────────────────────────────────────
  try {
    const existing = await countRows(db, userInvitations);
    if (existing === 0) {
      await db.insert(userInvitations).values([
        { email: "new.engineer@ogrmm.com", role: "user" as const, token: "inv-tok-abc123def456", invitedBy: "owner-001", inviterName: "James Okafor", message: "Welcome to OG-RMM Platform. Please complete your registration.", status: "PENDING" as const, expiresAt: daysAgo(-7) },
        { email: "contractor@halliburton.com", role: "user" as const, token: "inv-tok-xyz789ghi012", invitedBy: "op-002", inviterName: "Sarah Mitchell", message: "Contractor access for WO-2026-002 acid stimulation job.", status: "ACCEPTED" as const, expiresAt: daysAgo(-3), acceptedAt: daysAgo(1) },
      ] as any[]);
      results.push({ domain: "userInvitations", seeded: 2, skipped: false });
    } else {
      results.push({ domain: "userInvitations", seeded: 0, skipped: true });
    }
  } catch (e: any) { results.push({ domain: "userInvitations", seeded: 0, skipped: false, error: e.message }); }

  // ── 51. IEC 62443 ASSESSMENTS ──────────────────────────────────────────────
  try {
    const existing = await countRows(db, iec62443Assessments);
    if (existing === 0) {
      await db.insert(iec62443Assessments).values([
        {
          assessmentDate: daysAgo(90),
          assessorName: "Dr. Ahmed Al-Rashidi",
          assessorOrg: "TUV SUD Middle East",
          targetSl: "SL_3",
          achievedSl: "SL_2",
          overallScore: "72.5",
          findings: JSON.stringify(["Zone 2 firewall rules incomplete", "OPC-UA server lacks authentication"]),
          recommendations: JSON.stringify(["Implement IEC 62443-3-3 SR 3.1 access control", "Deploy unidirectional gateways for Zone 1 to Zone 2"]),
          reportUrl: "https://s3.ogrmm.com/assessments/iec62443-2026-q1.pdf",
          status: "COMPLETED",
          createdAt: daysAgo(88),
        },
        {
          assessmentDate: daysAgo(30),
          assessorName: "Fatima Al-Zahrawi",
          assessorOrg: "Bureau Veritas OG",
          targetSl: "SL_2",
          achievedSl: "SL_2",
          overallScore: "85.0",
          findings: JSON.stringify(["All Zone 1 PLCs patched", "Historian access restricted to read-only"]),
          recommendations: JSON.stringify(["Maintain quarterly vulnerability scans", "Extend MFA to all SCADA operator accounts"]),
          reportUrl: "https://s3.ogrmm.com/assessments/iec62443-2026-q2.pdf",
          status: "COMPLETED",
          createdAt: daysAgo(28),
        },
      ] as any[]);
      results.push({ domain: "iec62443Assessments", seeded: 2, skipped: false });
    } else {
      results.push({ domain: "iec62443Assessments", seeded: 0, skipped: true });
    }
  } catch (e: any) { results.push({ domain: "iec62443Assessments", seeded: 0, skipped: false, error: e.message }); }

  // ── 52. INCIDENT TRIAGE ──────────────────────────────────────────────────────
  try {
    const existing = await countRows(db, incidentTriage);
    if (existing === 0) {
      await db.insert(incidentTriage).values([
        {
          eventId: "EVT-SEC-001",
          workflowId: "WF-TRIAGE-001",
          status: "COMPLETED",
          openCtiScore: "7.8",
          tlpClassification: "TLP:AMBER",
          finalSeverity: "HIGH",
          nodeIsolated: true,
          networkPolicyId: "NP-SCADA-ZONE2",
          alertGroupId: "AG-ESP-ANOMALY-001",
          recommendedAction: "Isolate PLC-WELL-007, apply firmware patch CVE-2024-12345, restore after validation",
          nodeReadmittedAt: daysAgo(1),
          nodeReadmittedBy: "sec-ops-001",
          completedAt: daysAgo(1),
          createdAt: daysAgo(3),
        },
        {
          eventId: "EVT-SEC-002",
          workflowId: "WF-TRIAGE-002",
          status: "IN_PROGRESS",
          openCtiScore: "5.2",
          tlpClassification: "TLP:GREEN",
          finalSeverity: "MEDIUM",
          nodeIsolated: false,
          networkPolicyId: "NP-HISTORIAN",
          alertGroupId: "AG-HISTORIAN-ANOMALY",
          recommendedAction: "Monitor historian access patterns, block external IP range 192.168.100.0/24",
          createdAt: daysAgo(1),
        },
      ] as any[]);
      results.push({ domain: "incidentTriage", seeded: 2, skipped: false });
    } else {
      results.push({ domain: "incidentTriage", seeded: 0, skipped: true });
    }
  } catch (e: any) { results.push({ domain: "incidentTriage", seeded: 0, skipped: false, error: e.message }); }

  // ── 53. DAMAGE IMAGES ────────────────────────────────────────────────────────
  try {
    const existing = await countRows(db, damageImages);
    if (existing === 0) {
      await db.insert(damageImages).values([
        {
          assessmentId: 1,
          s3Key: "damage/DA-2026-001/img-001.jpg",
          s3Url: "https://s3.ogrmm.com/damage/DA-2026-001/img-001.jpg",
          filename: "wellhead-damage-north-face.jpg",
          mimeType: "image/jpeg",
          fileSizeBytes: 2847392,
          lat: "29.3117",
          lng: "47.4818",
          capturedAt: daysAgo(14),
          aiSeverity: "SEVERELY_DAMAGED",
          aiConfidence: "0.91",
          aiSummary: "Wellhead flange shows blast overpressure deformation, valve actuator destroyed",
          aiAssetType: "WELLHEAD",
          uploadedBy: "drone-pilot-001",
          createdAt: daysAgo(14),
        },
        {
          assessmentId: 1,
          s3Key: "damage/DA-2026-001/img-002.jpg",
          s3Url: "https://s3.ogrmm.com/damage/DA-2026-001/img-002.jpg",
          filename: "christmas-tree-lateral-view.jpg",
          mimeType: "image/jpeg",
          fileSizeBytes: 3124567,
          lat: "29.3118",
          lng: "47.4819",
          capturedAt: daysAgo(14),
          aiSeverity: "MODERATELY_DAMAGED",
          aiConfidence: "0.87",
          aiSummary: "Christmas tree wing valves intact but hydraulic control lines severed",
          aiAssetType: "CHRISTMAS_TREE",
          uploadedBy: "drone-pilot-001",
          createdAt: daysAgo(14),
        },
      ] as any[]);
      results.push({ domain: "damageImages", seeded: 2, skipped: false });
    } else {
      results.push({ domain: "damageImages", seeded: 0, skipped: true });
    }
  } catch (e: any) { results.push({ domain: "damageImages", seeded: 0, skipped: false, error: e.message }); }

  // ── 54. OTA DEVICE UPDATES ───────────────────────────────────────────────────
  try {
    const existing = await countRows(db, otaDeviceUpdates);
    if (existing === 0) {
      await db.insert(otaDeviceUpdates).values([
        {
          campaignId: 1,
          deviceId: 1,
          deviceDeviceId: "DEV-001",
          fromVersion: "3.1.0",
          toVersion: "3.2.1",
          status: "success" as const,
          progress: 100,
          startedAt: daysAgo(5),
          completedAt: daysAgo(5),
          retryCount: 0,
          createdAt: daysAgo(6),
          updatedAt: daysAgo(5),
        },
        {
          campaignId: 1,
          deviceId: 2,
          deviceDeviceId: "DEV-002",
          fromVersion: "3.1.0",
          toVersion: "3.2.1",
          status: "failed" as const,
          progress: 45,
          startedAt: daysAgo(5),
          completedAt: daysAgo(5),
          errorMessage: "Connection timeout during firmware flash at 45%",
          retryCount: 2,
          createdAt: daysAgo(6),
          updatedAt: daysAgo(5),
        },
        {
          campaignId: 1,
          deviceId: 3,
          deviceDeviceId: "DEV-003",
          fromVersion: "3.1.0",
          toVersion: "3.2.1",
          status: "pending" as const,
          progress: 0,
          retryCount: 0,
          createdAt: daysAgo(6),
          updatedAt: daysAgo(6),
        },
      ] as any[]);
      results.push({ domain: "otaDeviceUpdates", seeded: 3, skipped: false });
    } else {
      results.push({ domain: "otaDeviceUpdates", seeded: 0, skipped: true });
    }
  } catch (e: any) { results.push({ domain: "otaDeviceUpdates", seeded: 0, skipped: false, error: e.message }); }

  return results;
}
