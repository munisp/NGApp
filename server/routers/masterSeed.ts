/**
 * masterSeed.ts — One-click seeder that populates all platform tables with demo data.
 * Uses adminProcedure so only authenticated admins can trigger it.
 */
import { adminProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { TRPCError } from "@trpc/server";
import {
  wells, telemetryReadings, alarms, productionRecords,
  wellPhysicsParams, digitalTwinModels,
  iec62443Controls, soc2Controls, historianStreams,
  saasPlans, marketplaceApps,
  productionAllocationRules,
  reservoirSimulations, emissionSources, emissionRecords,
  droneInspections, droneFindings,
  witsmlWells, opcuaServerNodes, siteConnectivity,
} from "../../drizzle/schema";
import { sql } from "drizzle-orm";
import { nanoid } from "nanoid";

type SeedResult = { domain: string; seeded: number; skipped: boolean; error?: string };

async function countRows(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, table: any): Promise<number> {
  try {
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(table);
    return Number(count);
  } catch {
    return 0;
  }
}

export const masterSeedRouter = router({
  seedAll: adminProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    const results: SeedResult[] = [];

    // ── 1. Wells ─────────────────────────────────────────────────────────────
    try {
      const existing = await countRows(db, wells);
      if (existing > 0) {
        results.push({ domain: "Wells", seeded: 0, skipped: true });
      } else {
        const wellSeeds = [
          { wellId: "WELL-001", name: "Alpha-001", field: "Permian Basin", basin: "Delaware", country: "USA", status: "ACTIVE" as const, wellType: "OIL" as const },
          { wellId: "WELL-002", name: "Bravo-002", field: "Eagle Ford", basin: "Eagle Ford", country: "USA", status: "ACTIVE" as const, wellType: "OIL" as const },
          { wellId: "WELL-003", name: "Charlie-003", field: "Midland Basin", basin: "Midland", country: "USA", status: "ACTIVE" as const, wellType: "OIL" as const },
          { wellId: "WELL-004", name: "Delta-004", field: "Permian Basin", basin: "Delaware", country: "USA", status: "SHUT_IN" as const, wellType: "OIL" as const },
          { wellId: "WELL-005", name: "Echo-005", field: "Permian Basin", basin: "Delaware", country: "USA", status: "ACTIVE" as const, wellType: "WATER_INJECTION" as const },
          { wellId: "WELL-006", name: "Foxtrot-006", field: "Kuwait Field", basin: "Burgan", country: "Kuwait", status: "ACTIVE" as const, wellType: "OIL" as const },
          { wellId: "WELL-007", name: "Gulf-007", field: "Gulf of Mexico", basin: "GoM", country: "USA", status: "DRILLING" as const, wellType: "OIL" as const },
          { wellId: "WELL-008", name: "Hotel-008", field: "Bakken", basin: "Williston", country: "USA", status: "ACTIVE" as const, wellType: "OIL" as const },
          { wellId: "GAS-001", name: "Gas-Alpha-001", field: "Haynesville", basin: "Haynesville", country: "USA", status: "ACTIVE" as const, wellType: "GAS" as const },
          { wellId: "GAS-002", name: "Gas-Bravo-002", field: "Marcellus", basin: "Appalachian", country: "USA", status: "ACTIVE" as const, wellType: "GAS" as const },
          { wellId: "SAGD-001", name: "SAGD-Alpha-001", field: "Athabasca", basin: "Alberta Oil Sands", country: "Canada", status: "ACTIVE" as const, wellType: "OIL" as const },
          { wellId: "SAGD-002", name: "SAGD-Bravo-002", field: "Cold Lake", basin: "Alberta Oil Sands", country: "Canada", status: "ACTIVE" as const, wellType: "WATER_INJECTION" as const },
        ];
        for (const w of wellSeeds) {
          await db.insert(wells).values(w).onConflictDoNothing();
        }
        results.push({ domain: "Wells", seeded: wellSeeds.length, skipped: false });
      }
    } catch (e: any) {
      results.push({ domain: "Wells", seeded: 0, skipped: false, error: e.message });
    }

    // ── 2. Telemetry ──────────────────────────────────────────────────────────
    try {
      const existing = await countRows(db, telemetryReadings);
      if (existing > 5) {
        results.push({ domain: "Telemetry", seeded: 0, skipped: true });
      } else {
        const wellIds = ["WELL-001", "WELL-002", "WELL-003", "GAS-001", "SAGD-001"];
        let count = 0;
        const now = Date.now();
        for (const wellId of wellIds) {
          for (let i = 0; i < 24; i++) {
            const recordedAt = new Date(now - i * 3600_000);
            await db.insert(telemetryReadings).values({
              wellId,
              recordedAt,
              oilRate: 800 + Math.random() * 400,
              gasRate: 400 + Math.random() * 200,
              waterRate: 200 + Math.random() * 100,
              tubingPressure: 1000 + Math.random() * 250,
              casingPressure: 800 + Math.random() * 200,
              wellheadTemp: 120 + Math.random() * 30,
              chokePosition: 60 + Math.random() * 30,
              espFrequency: 50 + Math.random() * 10,
              espCurrent: 40 + Math.random() * 10,
              espVibration: Math.random() * 2,
              bhp: 2800 + Math.random() * 400,
              flowRate: 900 + Math.random() * 300,
            }).onConflictDoNothing();
            count++;
          }
        }
        results.push({ domain: "Telemetry (24h × 5 wells)", seeded: count, skipped: false });
      }
    } catch (e: any) {
      results.push({ domain: "Telemetry", seeded: 0, skipped: false, error: e.message });
    }

    // ── 3. Production Records ─────────────────────────────────────────────────
    try {
      const existing = await countRows(db, productionRecords);
      if (existing > 5) {
        results.push({ domain: "Production Records", seeded: 0, skipped: true });
      } else {
        const wellIds = ["WELL-001", "WELL-002", "WELL-003", "WELL-006", "SAGD-001"];
        let count = 0;
        for (const wellId of wellIds) {
          for (let d = 0; d < 30; d++) {
            const date = new Date(Date.now() - d * 86400_000);
            await db.insert(productionRecords).values({
              wellId,
              date,
              oilBbls: 900 + Math.random() * 300,
              gasMmscf: 0.45 + Math.random() * 0.15,
              waterBbls: 250 + Math.random() * 100,
              injectionBbls: wellId === "WELL-005" ? 500 + Math.random() * 100 : 0,
              uptimeHours: 22 + Math.random() * 2,
              downtime: Math.random() < 0.1 ? "Planned maintenance" : null,
            }).onConflictDoNothing();
            count++;
          }
        }
        results.push({ domain: "Production Records (30d × 5 wells)", seeded: count, skipped: false });
      }
    } catch (e: any) {
      results.push({ domain: "Production Records", seeded: 0, skipped: false, error: e.message });
    }

    // ── 4. Alarms ─────────────────────────────────────────────────────────────
    try {
      const existing = await countRows(db, alarms);
      if (existing > 3) {
        results.push({ domain: "Alarms", seeded: 0, skipped: true });
      } else {
        const alarmSeeds = [
          { alarmId: `ALM-${nanoid(8)}`, wellId: "WELL-001", tag: "WELLHEAD_PRESSURE_HI", severity: 2, state: "UNACKNOWLEDGED" as const, description: "Wellhead pressure exceeds 1800 psi setpoint", setpoint: 1800, value: 1847, unit: "psi" },
          { alarmId: `ALM-${nanoid(8)}`, wellId: "WELL-002", tag: "ESP_VIBRATION_HI", severity: 1, state: "UNACKNOWLEDGED" as const, description: "ESP vibration critical — 4.2 mm/s exceeds 3.0 mm/s limit", setpoint: 3.0, value: 4.2, unit: "mm/s" },
          { alarmId: `ALM-${nanoid(8)}`, wellId: "GAS-001", tag: "LIQUID_LOADING_RISK", severity: 2, state: "UNACKNOWLEDGED" as const, description: "Gas rate 1050 Mscf/d below Turner critical rate 1180 Mscf/d", setpoint: 1180, value: 1050, unit: "Mscf/d" },
          { alarmId: `ALM-${nanoid(8)}`, wellId: "WELL-003", tag: "SAND_PRODUCTION_HI", severity: 2, state: "ACKNOWLEDGED" as const, description: "Sand rate 85 mg/L exceeds 50 mg/L limit", setpoint: 50, value: 85, unit: "mg/L" },
          { alarmId: `ALM-${nanoid(8)}`, wellId: "SAGD-001", tag: "STEAM_CHAMBER_TEMP_LO", severity: 3, state: "UNACKNOWLEDGED" as const, description: "Steam chamber temperature 415°F below 440°F setpoint", setpoint: 440, value: 415, unit: "°F" },
        ];
        for (const a of alarmSeeds) {
          await db.insert(alarms).values(a).onConflictDoNothing();
        }
        results.push({ domain: "Alarms", seeded: alarmSeeds.length, skipped: false });
      }
    } catch (e: any) {
      results.push({ domain: "Alarms", seeded: 0, skipped: false, error: e.message });
    }

    // ── 5. Well Physics Params ────────────────────────────────────────────────
    try {
      const existing = await countRows(db, wellPhysicsParams);
      if (existing > 3) {
        results.push({ domain: "Well Physics Params", seeded: 0, skipped: true });
      } else {
        const physicsSeeds = [
          { wellId: "WELL-001", reservoirPressurePsi: 3200, qMaxBpd: 1500, skinFactor: 2, tvdFt: 8500, waterCutFraction: 0.25, gorScfPerBbl: 450, espFrequencyHz: 55, qi: 1500, di: 0.07, b: 0.4, calibratedBy: "System Seed" },
          { wellId: "WELL-002", reservoirPressurePsi: 2800, qMaxBpd: 1200, skinFactor: 0, tvdFt: 7800, waterCutFraction: 0.15, gorScfPerBbl: 380, espFrequencyHz: 50, qi: 1200, di: 0.09, b: 0.5, calibratedBy: "System Seed" },
          { wellId: "WELL-003", reservoirPressurePsi: 3500, qMaxBpd: 1800, skinFactor: 5, tvdFt: 9100, waterCutFraction: 0.35, gorScfPerBbl: 520, espFrequencyHz: 58, qi: 1800, di: 0.06, b: 0.3, calibratedBy: "System Seed" },
          { wellId: "GAS-001", reservoirPressurePsi: 4200, qMaxBpd: 8000, skinFactor: 1, tvdFt: 11500, waterCutFraction: 0.05, gorScfPerBbl: 50000, espFrequencyHz: 50, qi: 8000, di: 0.12, b: 0.6, calibratedBy: "System Seed" },
          { wellId: "SAGD-001", reservoirPressurePsi: 1200, qMaxBpd: 600, skinFactor: 0, tvdFt: 1200, waterCutFraction: 0.8, gorScfPerBbl: 20, espFrequencyHz: 45, qi: 600, di: 0.04, b: 0.8, calibratedBy: "System Seed" },
        ];
        for (const p of physicsSeeds) {
          await db.insert(wellPhysicsParams).values({ ...p, calibratedAt: new Date(), createdAt: new Date(), updatedAt: new Date() }).onConflictDoNothing();
        }
        results.push({ domain: "Well Physics Params", seeded: physicsSeeds.length, skipped: false });
      }
    } catch (e: any) {
      results.push({ domain: "Well Physics Params", seeded: 0, skipped: false, error: e.message });
    }

    // ── 6. Digital Twin Models ────────────────────────────────────────────────
    try {
      const existing = await countRows(db, digitalTwinModels);
      if (existing > 0) {
        results.push({ domain: "Digital Twin Models", seeded: 0, skipped: true });
      } else {
        const dtSeeds = [
          { modelId: "DT-WELL001", name: "Well ALPHA-001 Digital Twin", assetType: "wellhead", wellId: "WELL-001", positionLat: 31.9686, positionLon: -102.0779, sensorBindings: JSON.stringify({ wellheadPressure: "WELL-001:WHP", espFrequency: "WELL-001:ESP_FREQ", oilRate: "WELL-001:OIL_RATE" }) },
          { modelId: "DT-WELL002", name: "Well BRAVO-002 Digital Twin", assetType: "wellhead", wellId: "WELL-002", positionLat: 28.7041, positionLon: -99.0, sensorBindings: JSON.stringify({ wellheadPressure: "WELL-002:WHP", espFrequency: "WELL-002:ESP_FREQ" }) },
          { modelId: "DT-FPSO001", name: "FPSO Titan Digital Twin", assetType: "fpso", facilityId: "FPSO-001", positionLat: 28.0, positionLon: -90.5, sensorBindings: JSON.stringify({ deckPressure: "FPSO-001:DECK_P", gasExport: "FPSO-001:GAS_EXP" }) },
          { modelId: "DT-COMP001", name: "Compressor Station Alpha", assetType: "compressor", facilityId: "COMP-001", positionLat: 30.2, positionLon: -93.1, sensorBindings: JSON.stringify({ suctionPressure: "COMP-001:SUCT_P", speed: "COMP-001:SPEED" }) },
          { modelId: "DT-SAGD001", name: "SAGD Pad Alpha-001", assetType: "well", wellId: "SAGD-001", positionLat: 57.0, positionLon: -111.5, sensorBindings: JSON.stringify({ steamChamberTemp: "SAGD-001:SC_TEMP", injectionRate: "SAGD-001:INJ_RATE" }) },
        ];
        for (const d of dtSeeds) {
          await db.insert(digitalTwinModels).values({ ...d, isActive: true, createdAt: new Date(), updatedAt: new Date() }).onConflictDoNothing();
        }
        results.push({ domain: "Digital Twin Models", seeded: dtSeeds.length, skipped: false });
      }
    } catch (e: any) {
      results.push({ domain: "Digital Twin Models", seeded: 0, skipped: false, error: e.message });
    }

    // ── 7. IEC 62443 Controls ─────────────────────────────────────────────────
    try {
      const existing = await countRows(db, iec62443Controls);
      if (existing > 0) {
        results.push({ domain: "IEC 62443 Controls", seeded: 0, skipped: true });
      } else {
        const controls = [
          { controlId: "IEC-SR-1.1", zone: "ZONE_3", category: "ACCESS_CONTROL", title: "Human User Authentication", description: "All human users must authenticate using multi-factor authentication before accessing OT systems", status: "compliant", requirement: "SL-2 requirement: MFA for all human users" },
          { controlId: "IEC-SR-1.2", zone: "ZONE_3", category: "ACCESS_CONTROL", title: "Software Process Authentication", description: "All software processes and devices must authenticate before accessing OT network resources", status: "compliant", requirement: "SL-2: Certificate-based mutual TLS" },
          { controlId: "IEC-SR-2.1", zone: "ZONE_2", category: "USE_CONTROL", title: "Authorization Enforcement", description: "Enforce authorization for all users, software processes, and devices on the control system", status: "partial", requirement: "SL-2: Role-based access control" },
          { controlId: "IEC-SR-3.1", zone: "ZONE_2", category: "SYSTEM_INTEGRITY", title: "Communication Integrity", description: "Protect the integrity of transmitted information to prevent unauthorized modification", status: "compliant", requirement: "SL-3: TLS 1.3 on all SCADA communications" },
          { controlId: "IEC-SR-4.1", zone: "ZONE_3", category: "DATA_CONFIDENTIALITY", title: "Information Confidentiality", description: "Protect the confidentiality of information at rest and in transit", status: "compliant", requirement: "SL-2: AES-256 at rest, TLS 1.3 in transit" },
          { controlId: "IEC-SR-5.1", zone: "ZONE_2", category: "RESTRICTED_DATA_FLOW", title: "Network Segmentation", description: "Segment the control system from other systems using boundary protection devices", status: "compliant", requirement: "SL-2: DMZ with unidirectional gateways" },
          { controlId: "IEC-SR-6.1", zone: "ZONE_3", category: "TIMELY_RESPONSE", title: "Audit Log Accessibility", description: "Ensure audit logs are accessible to authorized users in a timely manner", status: "compliant", requirement: "SL-2: Centralized SIEM with 90-day retention" },
          { controlId: "IEC-SR-7.1", zone: "ZONE_1", category: "RESOURCE_AVAILABILITY", title: "Denial of Service Protection", description: "Protect against the effects of denial of service attacks", status: "not_started", requirement: "SL-2: Rate limiting and DDoS protection" },
        ];
        for (const c of controls) {
          await db.insert(iec62443Controls).values({ ...c, createdAt: new Date(), updatedAt: new Date() }).onConflictDoNothing();
        }
        results.push({ domain: "IEC 62443 Controls", seeded: controls.length, skipped: false });
      }
    } catch (e: any) {
      results.push({ domain: "IEC 62443 Controls", seeded: 0, skipped: false, error: e.message });
    }

    // ── 8. SOC 2 Controls ─────────────────────────────────────────────────────
    try {
      const existing = await countRows(db, soc2Controls);
      if (existing > 0) {
        results.push({ domain: "SOC 2 Controls", seeded: 0, skipped: true });
      } else {
        const controls = [
          { controlRef: "CC1.1", trustServiceCriteria: "Security", title: "Control Environment", description: "Management demonstrates commitment to integrity and ethical values", status: "in_place", evidence: "Code of conduct signed by all employees; ethics hotline operational" },
          { controlRef: "CC2.1", trustServiceCriteria: "Security", title: "Information and Communication", description: "Relevant information is identified, captured, and communicated", status: "in_place", evidence: "Monthly security briefings; incident response runbooks published" },
          { controlRef: "CC6.1", trustServiceCriteria: "Security", title: "Logical and Physical Access Controls", description: "Logical access security measures restrict access to information assets", status: "in_place", evidence: "MFA enforced; quarterly access reviews completed" },
          { controlRef: "CC7.1", trustServiceCriteria: "Availability", title: "System Operations", description: "Vulnerabilities in system components are identified and addressed", status: "in_place", evidence: "Monthly vulnerability scans; CVE patching within 30 days" },
          { controlRef: "CC8.1", trustServiceCriteria: "Security", title: "Change Management", description: "Changes to infrastructure, data, software, and procedures are authorized", status: "partial", evidence: "Change advisory board in place; automated rollback capability in progress" },
          { controlRef: "A1.1", trustServiceCriteria: "Availability", title: "Availability Commitments", description: "System availability meets committed service levels", status: "in_place", evidence: "99.9% uptime SLA achieved; automated failover tested quarterly" },
          { controlRef: "PI1.1", trustServiceCriteria: "Processing Integrity", title: "Processing Completeness", description: "System processing is complete, valid, accurate, timely, and authorized", status: "in_place", evidence: "Data validation checksums; reconciliation reports reviewed daily" },
        ];
        for (const c of controls) {
          await db.insert(soc2Controls).values({ ...c, createdAt: new Date(), updatedAt: new Date() }).onConflictDoNothing();
        }
        results.push({ domain: "SOC 2 Controls", seeded: controls.length, skipped: false });
      }
    } catch (e: any) {
      results.push({ domain: "SOC 2 Controls", seeded: 0, skipped: false, error: e.message });
    }

    // ── 9. Historian Streams ──────────────────────────────────────────────────
    try {
      const existing = await countRows(db, historianStreams);
      if (existing > 0) {
        results.push({ domain: "Historian Streams", seeded: 0, skipped: true });
      } else {
        const streams = [
          { tagName: "WELL-001.WHP", wellId: "WELL-001", description: "Wellhead Pressure", engineeringUnit: "psi", dataType: "float", sampleRateHz: 0.2, retentionDays: 365, isActive: true },
          { tagName: "WELL-001.OIL_RATE", wellId: "WELL-001", description: "Oil Production Rate", engineeringUnit: "BPD", dataType: "float", sampleRateHz: 0.017, retentionDays: 365, isActive: true },
          { tagName: "WELL-001.ESP_FREQ", wellId: "WELL-001", description: "ESP Drive Frequency", engineeringUnit: "Hz", dataType: "float", sampleRateHz: 1.0, retentionDays: 90, isActive: true },
          { tagName: "WELL-001.VIBRATION", wellId: "WELL-001", description: "ESP Vibration", engineeringUnit: "mm/s", dataType: "float", sampleRateHz: 1.0, retentionDays: 90, isActive: true },
          { tagName: "WELL-002.WHP", wellId: "WELL-002", description: "Wellhead Pressure", engineeringUnit: "psi", dataType: "float", sampleRateHz: 0.2, retentionDays: 365, isActive: true },
          { tagName: "GAS-001.GAS_RATE", wellId: "GAS-001", description: "Gas Production Rate", engineeringUnit: "Mscf/d", dataType: "float", sampleRateHz: 0.017, retentionDays: 365, isActive: true },
          { tagName: "SAGD-001.SC_TEMP", wellId: "SAGD-001", description: "Steam Chamber Temperature", engineeringUnit: "°F", dataType: "float", sampleRateHz: 0.033, retentionDays: 365, isActive: true },
          { tagName: "SAGD-001.INJ_RATE", wellId: "SAGD-001", description: "Steam Injection Rate", engineeringUnit: "BPD", dataType: "float", sampleRateHz: 0.017, retentionDays: 365, isActive: true },
        ];
        for (const s of streams) {
          await db.insert(historianStreams).values({ ...s, createdAt: new Date() }).onConflictDoNothing();
        }
        results.push({ domain: "Historian Streams", seeded: streams.length, skipped: false });
      }
    } catch (e: any) {
      results.push({ domain: "Historian Streams", seeded: 0, skipped: false, error: e.message });
    }

    // ── 10. SaaS Plans ────────────────────────────────────────────────────────
    try {
      const existing = await countRows(db, saasPlans);
      if (existing > 0) {
        results.push({ domain: "SaaS Plans", seeded: 0, skipped: true });
      } else {
        const plans = [
          { planId: "PLAN-STARTER", name: "Starter", description: "Up to 10 wells, basic monitoring", pricePerWellMonthly: 49.9, pricePerWellAnnual: 499.0, maxWells: 10, maxUsers: 5, featuresIncluded: JSON.stringify(["Well monitoring", "Basic alarms", "Email reports"]), isActive: true },
          { planId: "PLAN-PROFESSIONAL", name: "Professional", description: "Up to 50 wells, advanced analytics", pricePerWellMonthly: 39.9, pricePerWellAnnual: 399.0, maxWells: 50, maxUsers: 25, featuresIncluded: JSON.stringify(["All Starter features", "ML insights", "Digital twin", "API access", "Physics engine"]), isActive: true },
          { planId: "PLAN-ENTERPRISE", name: "Enterprise", description: "Unlimited wells, full platform", pricePerWellMonthly: 29.9, pricePerWellAnnual: 299.0, maxWells: 9999, maxUsers: 999, featuresIncluded: JSON.stringify(["All Professional features", "FPSO twin", "IEC 62443", "SOC 2", "Custom integrations", "SLA 99.9%"]), isActive: true },
        ];
        for (const p of plans) {
          await db.insert(saasPlans).values({ ...p, createdAt: new Date(), updatedAt: new Date() }).onConflictDoNothing();
        }
        results.push({ domain: "SaaS Plans", seeded: plans.length, skipped: false });
      }
    } catch (e: any) {
      results.push({ domain: "SaaS Plans", seeded: 0, skipped: false, error: e.message });
    }

    // ── 11. Marketplace Apps ──────────────────────────────────────────────────
    try {
      const existing = await countRows(db, marketplaceApps);
      if (existing > 0) {
        results.push({ domain: "Marketplace Apps", seeded: 0, skipped: true });
      } else {
        const apps = [
          { appId: "APP-PINN", name: "PINN Reservoir Simulator", description: "Physics-Informed Neural Network for reservoir pressure prediction", category: "AI_ML", version: "2.1.0", author: "OG-RMM Labs", pricingModel: "subscription", priceMonthly: 299, isActive: true, isVerified: true, runtime: "python" },
          { appId: "APP-CORROSION", name: "Corrosion Monitor Pro", description: "ML-based corrosion rate prediction using electrochemical sensors", category: "INTEGRITY", version: "1.4.2", author: "Integrity Systems Inc.", pricingModel: "subscription", priceMonthly: 149, isActive: true, isVerified: true, runtime: "python" },
          { appId: "APP-OSDU-SYNC", name: "OSDU Data Sync", description: "Bidirectional sync between OG-RMM and OSDU R3 platform", category: "INTEGRATION", version: "3.0.1", author: "DataBridge Corp", pricingModel: "free", priceMonthly: 0, isActive: true, isVerified: true, runtime: "node" },
          { appId: "APP-WITSML-BRIDGE", name: "WITSML 2.0 Bridge", description: "Real-time drilling data ingestion from WITSML 2.0 servers", category: "INTEGRATION", version: "2.2.0", author: "Drilling Tech", pricingModel: "pay_per_use", pricePerRun: 0.05, isActive: true, isVerified: false, runtime: "rust" },
          { appId: "APP-CARBON", name: "Carbon Accounting Suite", description: "Scope 1/2/3 emissions tracking with regulatory reporting", category: "ESG", version: "1.1.0", author: "GreenOps", pricingModel: "subscription", priceMonthly: 199, isActive: true, isVerified: true, runtime: "python" },
        ];
        for (const a of apps) {
          await db.insert(marketplaceApps).values({ ...a, createdAt: new Date(), updatedAt: new Date() }).onConflictDoNothing();
        }
        results.push({ domain: "Marketplace Apps", seeded: apps.length, skipped: false });
      }
    } catch (e: any) {
      results.push({ domain: "Marketplace Apps", seeded: 0, skipped: false, error: e.message });
    }

    // ── 12. Production Allocation Rules ───────────────────────────────────────
    try {
      const existing = await countRows(db, productionAllocationRules);
      if (existing > 0) {
        results.push({ domain: "Production Allocation Rules", seeded: 0, skipped: true });
      } else {
        const rules = [
          { ruleId: "ALLOC-001", name: "Permian Basin Pro-Rata", fieldId: "Permian Basin", method: "well_test_ratio", isActive: true, effectiveFrom: new Date("2026-01-01"), oilAllocationBbl: 5000, gasAllocationMcf: 2500, waterAllocationBbl: 1500 },
          { ruleId: "ALLOC-002", name: "Eagle Ford Meter-Based", fieldId: "Eagle Ford", method: "metered", isActive: true, effectiveFrom: new Date("2026-01-01"), oilAllocationBbl: 3000, gasAllocationMcf: 1800, waterAllocationBbl: 800 },
          { ruleId: "ALLOC-003", name: "SAGD Pad Allocation", fieldId: "Athabasca", method: "well_test_ratio", isActive: true, effectiveFrom: new Date("2026-01-01"), oilAllocationBbl: 600, gasAllocationMcf: 50, waterAllocationBbl: 2400 },
        ];
        for (const r of rules) {
          await db.insert(productionAllocationRules).values({ ...r, createdAt: new Date(), updatedAt: new Date() }).onConflictDoNothing();
        }
        results.push({ domain: "Production Allocation Rules", seeded: rules.length, skipped: false });
      }
    } catch (e: any) {
      results.push({ domain: "Production Allocation Rules", seeded: 0, skipped: false, error: e.message });
    }

    // ── 13. Reservoir Simulations ─────────────────────────────────────────────
    try {
      const existing = await countRows(db, reservoirSimulations);
      if (existing > 0) {
        results.push({ domain: "Reservoir Simulations", seeded: 0, skipped: true });
      } else {
        const sims = [
          { simId: "SIM-001", name: "Permian Basin Material Balance", fieldId: "Permian Basin", simulator: "opm_flow", status: "completed", cpuCores: 8, memoryGb: 16, submittedAt: new Date(Date.now() - 86400_000), startedAt: new Date(Date.now() - 82800_000), completedAt: new Date(Date.now() - 79200_000), summaryStats: JSON.stringify({ eur_mmbbl: 17.4, peak_rate_bpd: 1500, decline_rate: 0.07, recovery_factor: 0.385 }) },
          { simId: "SIM-002", name: "Athabasca SAGD Thermal", fieldId: "Athabasca", simulator: "stars", status: "completed", cpuCores: 16, memoryGb: 32, submittedAt: new Date(Date.now() - 172800_000), startedAt: new Date(Date.now() - 168000_000), completedAt: new Date(Date.now() - 158400_000), summaryStats: JSON.stringify({ eur_mmbbl: 99.0, peak_rate_bpd: 650, sor: 2.8, recovery_factor: 0.55 }) },
          { simId: "SIM-003", name: "Eagle Ford Decline Curve", fieldId: "Eagle Ford", simulator: "opm_flow", status: "running", cpuCores: 4, memoryGb: 8, submittedAt: new Date(Date.now() - 3600_000), startedAt: new Date(Date.now() - 3000_000) },
        ];
        for (const s of sims) {
          await db.insert(reservoirSimulations).values(s).onConflictDoNothing();
        }
        results.push({ domain: "Reservoir Simulations", seeded: sims.length, skipped: false });
      }
    } catch (e: any) {
      results.push({ domain: "Reservoir Simulations", seeded: 0, skipped: false, error: e.message });
    }

    // ── 14. Emission Sources & Records ────────────────────────────────────────
    try {
      const existing = await countRows(db, emissionSources);
      if (existing > 0) {
        results.push({ domain: "Emission Sources", seeded: 0, skipped: true });
      } else {
        const sources = [
          { sourceId: "EMIT-001", name: "WELL-001 Flare Stack", sourceType: "flaring", wellId: "WELL-001", emissionScope: "scope1", ghgComponent: "co2", emissionFactor: 2.69, emissionFactorUnit: "tCO2/t_gas", isActive: true },
          { sourceId: "EMIT-002", name: "WELL-002 Fugitive Emissions", sourceType: "fugitive", wellId: "WELL-002", emissionScope: "scope1", ghgComponent: "ch4", emissionFactor: 0.0023, emissionFactorUnit: "tCH4/bbl", isActive: true },
          { sourceId: "EMIT-003", name: "Compressor Station Combustion", sourceType: "combustion", facilityId: "COMP-001", emissionScope: "scope1", ghgComponent: "co2", emissionFactor: 53.06, emissionFactorUnit: "tCO2/TJ", isActive: true },
          { sourceId: "EMIT-004", name: "FPSO Grid Power", sourceType: "electricity", facilityId: "FPSO-001", emissionScope: "scope2", ghgComponent: "co2", emissionFactor: 0.233, emissionFactorUnit: "tCO2/MWh", isActive: true },
        ];
        for (const s of sources) {
          await db.insert(emissionSources).values({ ...s, createdAt: new Date(), updatedAt: new Date() }).onConflictDoNothing();
        }
        // Seed emission records (monthly)
        let emitCount = 0;
        for (let m = 0; m < 6; m++) {
          const start = new Date(Date.now() - (m + 1) * 30 * 86400_000);
          const end = new Date(Date.now() - m * 30 * 86400_000);
          for (const src of sources) {
            await db.insert(emissionRecords).values({
              sourceId: src.sourceId,
              reportingPeriodStart: start,
              reportingPeriodEnd: end,
              activityData: 100 + Math.random() * 50,
              activityUnit: "tonne",
              co2Tonnes: 2 + Math.random() * 5,
              ch4Tonnes: 0.1 + Math.random() * 0.5,
              n2oTonnes: 0.01 + Math.random() * 0.05,
              co2eTonnes: 3 + Math.random() * 6,
              calculationMethod: "emission_factor",
              verificationStatus: "verified",
              reportingStandard: "GHG_Protocol",
              createdAt: new Date(),
            }).onConflictDoNothing();
            emitCount++;
          }
        }
        results.push({ domain: "Emission Sources + Records", seeded: sources.length + emitCount, skipped: false });
      }
    } catch (e: any) {
      results.push({ domain: "Emission Sources", seeded: 0, skipped: false, error: e.message });
    }

    // ── 15. Drone Inspections ─────────────────────────────────────────────────
    try {
      const existing = await countRows(db, droneInspections);
      if (existing > 0) {
        results.push({ domain: "Drone Inspections", seeded: 0, skipped: true });
      } else {
        const inspections = [
          { inspectionId: "DRONE-001", wellId: "WELL-001", droneModel: "DJI Matrice 300 RTK", pilotName: "J. Rodriguez", inspectionType: "visual", status: "completed", flightDurationMin: 45, windSpeedKnots: 8, imageCount: 124, thermalImageCount: 0, scheduledAt: new Date(Date.now() - 7 * 86400_000), startedAt: new Date(Date.now() - 7 * 86400_000), completedAt: new Date(Date.now() - 7 * 86400_000 + 2700_000) },
          { inspectionId: "DRONE-002", facilityId: "FPSO-001", droneModel: "Skydio X2", pilotName: "A. Chen", inspectionType: "thermal", status: "completed", flightDurationMin: 90, windSpeedKnots: 12, imageCount: 256, thermalImageCount: 180, scheduledAt: new Date(Date.now() - 3 * 86400_000), startedAt: new Date(Date.now() - 3 * 86400_000), completedAt: new Date(Date.now() - 3 * 86400_000 + 5400_000) },
          { inspectionId: "DRONE-003", wellId: "WELL-003", droneModel: "DJI Matrice 300 RTK", pilotName: "J. Rodriguez", inspectionType: "gas_leak", status: "scheduled", flightDurationMin: 0, imageCount: 0, thermalImageCount: 0, scheduledAt: new Date(Date.now() + 2 * 86400_000) },
        ];
        for (const i of inspections) {
          await db.insert(droneInspections).values({ ...i, createdAt: new Date(), updatedAt: new Date() }).onConflictDoNothing();
        }
        const findingSeeds = [
          { inspectionId: "DRONE-001", findingType: "corrosion", severity: "medium", description: "Surface corrosion on wellhead flange bolts — estimated 15% cross-section loss", location: "Wellhead flange, north face", status: "open" },
          { inspectionId: "DRONE-001", findingType: "leak", severity: "high", description: "Minor hydrocarbon sheen visible on ground near valve manifold", location: "Valve manifold, south side", status: "in_progress" },
          { inspectionId: "DRONE-002", findingType: "hot_spot", severity: "low", description: "Thermal anomaly on FPSO deck — 15°C above ambient, likely insulation gap", location: "FPSO deck, section C-4", status: "open" },
        ];
        for (const f of findingSeeds) {
          await db.insert(droneFindings).values({ ...f, createdAt: new Date() }).onConflictDoNothing();
        }
        results.push({ domain: "Drone Inspections + Findings", seeded: inspections.length + findingSeeds.length, skipped: false });
      }
    } catch (e: any) {
      results.push({ domain: "Drone Inspections", seeded: 0, skipped: false, error: e.message });
    }

    // ── 16. WITSML Wells ──────────────────────────────────────────────────────
    try {
      const existing = await countRows(db, witsmlWells);
      if (existing > 0) {
        results.push({ domain: "WITSML Wells", seeded: 0, skipped: true });
      } else {
        const witsmlSeeds = [
          { uid: "witsml-well-001", name: "Alpha-001", field: "Permian Basin", country: "USA", operator: "OG-RMM Operating", statusWell: "producing", purposeWell: "production", fluidWell: "oil" },
          { uid: "witsml-well-002", name: "Bravo-002", field: "Eagle Ford", country: "USA", operator: "OG-RMM Operating", statusWell: "producing", purposeWell: "production", fluidWell: "oil" },
          { uid: "witsml-well-007", name: "Gulf-007", field: "Gulf of Mexico", country: "USA", operator: "OG-RMM Offshore", statusWell: "drilling", purposeWell: "production", fluidWell: "oil", waterDepth: 1500 },
        ];
        for (const w of witsmlSeeds) {
          await db.insert(witsmlWells).values({ ...w, createdAt: new Date(), updatedAt: new Date() }).onConflictDoNothing();
        }
        results.push({ domain: "WITSML Wells", seeded: witsmlSeeds.length, skipped: false });
      }
    } catch (e: any) {
      results.push({ domain: "WITSML Wells", seeded: 0, skipped: false, error: e.message });
    }

    // ── 17. OPC-UA Server Nodes ───────────────────────────────────────────────
    try {
      const existing = await countRows(db, opcuaServerNodes);
      if (existing > 0) {
        results.push({ domain: "OPC-UA Server Nodes", seeded: 0, skipped: true });
      } else {
        const nodes = [
          { nodeId: "ns=2;s=WELL-001.WHP", displayName: "WELL-001 Wellhead Pressure", nodeClass: "Variable", dataType: "Double", tagName: "WELL-001.WHP", wellId: "WELL-001", engineeringUnit: "psi", isActive: true },
          { nodeId: "ns=2;s=WELL-001.OIL_RATE", displayName: "WELL-001 Oil Rate", nodeClass: "Variable", dataType: "Double", tagName: "WELL-001.OIL_RATE", wellId: "WELL-001", engineeringUnit: "BPD", isActive: true },
          { nodeId: "ns=2;s=WELL-001.ESP_FREQ", displayName: "WELL-001 ESP Frequency", nodeClass: "Variable", dataType: "Double", tagName: "WELL-001.ESP_FREQ", wellId: "WELL-001", engineeringUnit: "Hz", isActive: true },
          { nodeId: "ns=2;s=WELL-002.WHP", displayName: "WELL-002 Wellhead Pressure", nodeClass: "Variable", dataType: "Double", tagName: "WELL-002.WHP", wellId: "WELL-002", engineeringUnit: "psi", isActive: true },
          { nodeId: "ns=2;s=GAS-001.GAS_RATE", displayName: "GAS-001 Gas Rate", nodeClass: "Variable", dataType: "Double", tagName: "GAS-001.GAS_RATE", wellId: "GAS-001", engineeringUnit: "Mscf/d", isActive: true },
          { nodeId: "ns=2;s=SAGD-001.SC_TEMP", displayName: "SAGD-001 Steam Chamber Temp", nodeClass: "Variable", dataType: "Double", tagName: "SAGD-001.SC_TEMP", wellId: "SAGD-001", engineeringUnit: "°F", isActive: true },
        ];
        for (const n of nodes) {
          await db.insert(opcuaServerNodes).values(n).onConflictDoNothing();
        }
        results.push({ domain: "OPC-UA Server Nodes", seeded: nodes.length, skipped: false });
      }
    } catch (e: any) {
      results.push({ domain: "OPC-UA Server Nodes", seeded: 0, skipped: false, error: e.message });
    }

    // ── 18. Site Connectivity ───────────────────────────────────────────
    try {
      const existingConn = await countRows(db, siteConnectivity);
      if (existingConn > 0) {
        results.push({ domain: "Site Connectivity", seeded: 0, skipped: true });
      } else {
        const sites = [
          { siteId: "SITE-KW001", wellId: "KW-001", siteName: "Kuwait Well KW-001 RTU", status: "ONLINE" as const, protocol: "MQTT" as const, linkQualityPct: 97, latencyMs: 45, bufferDepth: 0, isSolarPowered: false, solarVolts: null, batteryPct: null, compressorStatus: "RUNNING" as const, edgeAgentVersion: "v2.4.1", lastSeenAt: new Date() },
          { siteId: "SITE-KW002", wellId: "KW-002", siteName: "Kuwait Well KW-002 RTU", status: "DEGRADED" as const, protocol: "MODBUS_TCP" as const, linkQualityPct: 72, latencyMs: 180, bufferDepth: 12, isSolarPowered: true, solarVolts: 13.8, batteryPct: 84.0, compressorStatus: "STANDBY" as const, edgeAgentVersion: "v2.4.0", lastSeenAt: new Date(Date.now() - 120000) },
          { siteId: "SITE-PB047", wellId: "PB-047", siteName: "Permian Basin PB-047 SCADA", status: "ONLINE" as const, protocol: "OPC_UA" as const, linkQualityPct: 99, latencyMs: 12, bufferDepth: 0, isSolarPowered: false, solarVolts: null, batteryPct: null, compressorStatus: "RUNNING" as const, edgeAgentVersion: "v2.4.1", lastSeenAt: new Date() },
          { siteId: "SITE-PB052", wellId: "PB-052", siteName: "Permian Basin PB-052 SCADA", status: "OFFLINE" as const, protocol: "MODBUS_RTU" as const, linkQualityPct: 0, latencyMs: null, bufferDepth: 847, isSolarPowered: true, solarVolts: 10.2, batteryPct: 23.0, compressorStatus: "FAULT" as const, edgeAgentVersion: "v2.3.9", lastSeenAt: new Date(Date.now() - 3600000) },
          { siteId: "SITE-UAE001", wellId: "UAE-001", siteName: "Abu Dhabi UAE-001 RTU", status: "ONLINE" as const, protocol: "DNP3" as const, linkQualityPct: 94, latencyMs: 67, bufferDepth: 0, isSolarPowered: false, solarVolts: null, batteryPct: null, compressorStatus: "RUNNING" as const, edgeAgentVersion: "v2.4.1", lastSeenAt: new Date() },
          { siteId: "SITE-GOM001", wellId: "GOM-001", siteName: "Gulf of Mexico GOM-001 Subsea", status: "ONLINE" as const, protocol: "MQTT" as const, linkQualityPct: 88, latencyMs: 320, bufferDepth: 3, isSolarPowered: false, solarVolts: null, batteryPct: null, compressorStatus: "RUNNING" as const, edgeAgentVersion: "v2.4.1", lastSeenAt: new Date() },
          { siteId: "SITE-GAS001", wellId: "GAS-001", siteName: "Gas Well GAS-001 RTU", status: "BUFFERING" as const, protocol: "HART" as const, linkQualityPct: 61, latencyMs: 890, bufferDepth: 234, isSolarPowered: true, solarVolts: 12.1, batteryPct: 67.0, compressorStatus: "STANDBY" as const, edgeAgentVersion: "v2.4.0", lastSeenAt: new Date(Date.now() - 600000) },
          { siteId: "SITE-SAGD001", wellId: "SAGD-001", siteName: "SAGD-001 Steam Injection RTU", status: "MAINTENANCE" as const, protocol: "MODBUS_TCP" as const, linkQualityPct: 0, latencyMs: null, bufferDepth: 0, isSolarPowered: false, solarVolts: null, batteryPct: null, compressorStatus: "OFF" as const, edgeAgentVersion: "v2.3.8", lastSeenAt: new Date(Date.now() - 86400000) },
        ];
        for (const s of sites) {
          await db.insert(siteConnectivity).values(s).onConflictDoNothing();
        }
        results.push({ domain: "Site Connectivity", seeded: sites.length, skipped: false });
      }
    } catch (e: any) {
      results.push({ domain: "Site Connectivity", seeded: 0, skipped: false, error: e.message });
    }

    // ── Summary ───────────────────────────────────────────────────────────────
    const totalSeeded = results.reduce((s, r) => s + r.seeded, 0);
    const domains = results.length;
    const skipped = results.filter(r => r.skipped).length;
    const errors = results.filter(r => r.error).length;

    return {
      summary: { totalSeeded, domains, skipped, errors },
      results,
    };
  }),

  status: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const counts = await Promise.all([
      countRows(db, wells).then(n => ({ table: "wells", count: n })),
      countRows(db, telemetryReadings).then(n => ({ table: "telemetry_readings", count: n })),
      countRows(db, productionRecords).then(n => ({ table: "production_records", count: n })),
      countRows(db, alarms).then(n => ({ table: "alarms", count: n })),
      countRows(db, wellPhysicsParams).then(n => ({ table: "well_physics_params", count: n })),
      countRows(db, digitalTwinModels).then(n => ({ table: "digital_twin_models", count: n })),
      countRows(db, iec62443Controls).then(n => ({ table: "iec62443_controls", count: n })),
      countRows(db, soc2Controls).then(n => ({ table: "soc2_controls", count: n })),
      countRows(db, historianStreams).then(n => ({ table: "historian_streams", count: n })),
      countRows(db, saasPlans).then(n => ({ table: "saas_plans", count: n })),
      countRows(db, marketplaceApps).then(n => ({ table: "marketplace_apps", count: n })),
      countRows(db, productionAllocationRules).then(n => ({ table: "production_allocation_rules", count: n })),
      countRows(db, reservoirSimulations).then(n => ({ table: "reservoir_simulations", count: n })),
      countRows(db, emissionSources).then(n => ({ table: "emission_sources", count: n })),
      countRows(db, droneInspections).then(n => ({ table: "drone_inspections", count: n })),
      countRows(db, witsmlWells).then(n => ({ table: "witsml_wells", count: n })),
      countRows(db, opcuaServerNodes).then(n => ({ table: "opcua_server_nodes", count: n })),
    ]);
    return counts;
  }),
});
