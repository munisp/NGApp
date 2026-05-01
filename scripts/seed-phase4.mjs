/**
 * seed-phase4.mjs — Phase 25 comprehensive seed script
 * Populates: enforcement_cases, financial_ledger, tia_assessments,
 *            penalty_appeals, enforcement_actions, in_app_notifications,
 *            evidence_packages, remediation_workflows
 *
 * Uses DATABASE_URL (TiDB/MySQL-compatible) from environment.
 */
import mysql from "mysql2/promise";

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
  console.error("❌ DATABASE_URL not set");
  process.exit(1);
}

// Parse MySQL URL
const urlObj = new URL(DB_URL);
const connConfig = {
  host: urlObj.hostname,
  port: parseInt(urlObj.port || "4000"),
  user: urlObj.username,
  password: urlObj.password,
  database: urlObj.pathname.replace(/^\//, "").split("?")[0],
  ssl: { rejectUnauthorized: false },
  multipleStatements: true,
};

async function run() {
  const conn = await mysql.createConnection(connConfig);
  console.log("✅ Connected to TiDB");

  try {
    // ── Get existing org IDs ─────────────────────────────────────────────────
    const [orgRows] = await conn.query("SELECT id, name, sector FROM organizations ORDER BY id LIMIT 10");
    if (orgRows.length === 0) {
      console.log("⚠️  No organizations found. Creating sample organizations first...");
      await conn.query(`
        INSERT IGNORE INTO organizations (name, sector, country, compliance_score, compliance_status, risk_score, contact_email, regulatory_id, created_at)
        VALUES
          ('First Bank Nigeria', 'Banking', 'NG', 82, 'certified', 25, 'dpo@firstbank.ng', 'NITDA-FBN-001', NOW()),
          ('MTN Nigeria', 'Telecom', 'NG', 71, 'compliant', 35, 'privacy@mtn.ng', 'NITDA-MTN-002', NOW()),
          ('Lagos University Teaching Hospital', 'Healthcare', 'NG', 65, 'under_review', 45, 'dpo@luth.ng', 'NITDA-LUTH-003', NOW()),
          ('Federal Ministry of Finance', 'Government', 'NG', 88, 'certified', 15, 'dataprotection@finance.gov.ng', 'NITDA-FMF-004', NOW()),
          ('Dangote Industries', 'Energy', 'NG', 58, 'non_compliant', 62, 'privacy@dangote.com', 'NITDA-DAN-005', NOW()),
          ('Flutterwave', 'Fintech', 'NG', 76, 'compliant', 30, 'dpo@flutterwave.com', 'NITDA-FLW-006', NOW()),
          ('Airtel Nigeria', 'Telecom', 'NG', 69, 'under_review', 40, 'privacy@airtel.ng', 'NITDA-AIR-007', NOW()),
          ('Zenith Bank', 'Banking', 'NG', 85, 'certified', 20, 'dpo@zenithbank.com', 'NITDA-ZEN-008', NOW())
      `);
      const [newOrgs] = await conn.query("SELECT id, name, sector FROM organizations ORDER BY id LIMIT 10");
      orgRows.push(...newOrgs);
    }
    const orgIds = orgRows.map(r => r.id);
    console.log(`✅ Using ${orgIds.length} organizations: ${orgRows.map(r => r.name).join(", ")}`);

    // ── Get existing penalty IDs ─────────────────────────────────────────────
    const [penaltyRows] = await conn.query("SELECT id FROM financial_penalties ORDER BY id LIMIT 20");
    let penaltyIds = penaltyRows.map(r => r.id);

    // Create penalties if none exist
    if (penaltyIds.length === 0) {
      console.log("⚠️  No penalties found. Creating sample penalties...");
      for (let i = 0; i < orgIds.length; i++) {
        const orgId = orgIds[i];
        const amounts = [500000, 1200000, 3500000, 750000, 2000000];
        const amount = amounts[i % amounts.length];
        const statuses = ["pending", "overdue", "completed", "disputed", "processing"];
        await conn.query(
          `INSERT INTO financial_penalties (organization_id, amount, currency, status, description, due_date, created_at)
           VALUES (?, ?, 'NGN', ?, ?, DATE_ADD(NOW(), INTERVAL 30 DAY), NOW())`,
          [orgId, amount, statuses[i % statuses.length], `NDPR violation — data residency breach (Ref: NITDA-${String(i + 1).padStart(4, "0")})`]
        );
      }
      const [newPenalties] = await conn.query("SELECT id FROM financial_penalties ORDER BY id LIMIT 20");
      penaltyIds = newPenalties.map(r => r.id);
    }
    console.log(`✅ Using ${penaltyIds.length} penalties`);

    // ── Enforcement Cases ────────────────────────────────────────────────────
    const [existingCases] = await conn.query("SELECT COUNT(*) as cnt FROM enforcement_cases");
    if (existingCases[0].cnt < 5) {
      console.log("🌱 Seeding enforcement_cases...");
      const caseStatuses = ["open", "under_investigation", "notice_issued", "escalated_to_nitda", "settled"];
      const caseSeverities = ["critical", "high", "medium", "high", "critical"];
      for (let i = 0; i < Math.min(orgIds.length, 5); i++) {
        const penaltyId = penaltyIds[i] ?? null;
        const caseRef = `NDSEP-CASE-${String(i + 1).padStart(6, "0")}`;
        await conn.query(
          `INSERT IGNORE INTO enforcement_cases
           (organization_id, penalty_id, case_reference, status, severity, escalation_reason, nitda_reference_number, assigned_officer_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1, NOW())`,
          [
            orgIds[i],
            penaltyId,
            caseRef,
            caseStatuses[i],
            caseSeverities[i],
            `Persistent non-compliance with NDPR Section ${10 + i} — data localisation requirements`,
            `NITDA-ENF-2026-${String(i + 1).padStart(4, "0")}`,
          ]
        );
      }
      const [caseCount] = await conn.query("SELECT COUNT(*) as cnt FROM enforcement_cases");
      console.log(`✅ enforcement_cases: ${caseCount[0].cnt} rows`);
    } else {
      console.log(`⏭️  enforcement_cases already has ${existingCases[0].cnt} rows`);
    }

    // ── TIA Assessments ──────────────────────────────────────────────────────
    const [existingTia] = await conn.query("SELECT COUNT(*) as cnt FROM tia_assessments");
    if (existingTia[0].cnt < 5) {
      console.log("🌱 Seeding tia_assessments...");
      const tiaStatuses = ["draft", "submitted", "under_review", "approved", "rejected"];
      const riskLevels = ["low", "medium", "high", "critical", "medium"];
      const destinations = ["US", "UK", "EU", "CN", "ZA"];
      for (let i = 0; i < Math.min(orgIds.length, 5); i++) {
        await conn.query(
          `INSERT INTO tia_assessments
           (organization_id, transfer_destination, data_categories, recipient_name, recipient_country,
            legal_basis, safeguards, risk_level, status, assessment_notes, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          [
            orgIds[i],
            destinations[i],
            JSON.stringify(["personal_data", "financial_data", "health_data"].slice(0, i % 3 + 1)),
            `${["AWS", "Google Cloud", "Microsoft Azure", "Alibaba Cloud", "Oracle"][i]} EMEA`,
            destinations[i],
            ["adequacy_decision", "standard_contractual_clauses", "binding_corporate_rules", "explicit_consent", "vital_interests"][i],
            `Data Processing Agreement with ${["GDPR", "UK GDPR", "CCPA", "PIPL", "POPIA"][i]} compliance clauses`,
            riskLevels[i],
            tiaStatuses[i],
            `Transfer Impact Assessment for ${["customer PII", "transaction records", "patient records", "employee data", "operational data"][i]} to ${destinations[i]}`,
          ]
        );
      }
      const [tiaCount] = await conn.query("SELECT COUNT(*) as cnt FROM tia_assessments");
      console.log(`✅ tia_assessments: ${tiaCount[0].cnt} rows`);
    } else {
      console.log(`⏭️  tia_assessments already has ${existingTia[0].cnt} rows`);
    }

    // ── Penalty Appeals ──────────────────────────────────────────────────────
    const [existingAppeals] = await conn.query("SELECT COUNT(*) as cnt FROM penalty_appeals");
    if (existingAppeals[0].cnt < 3) {
      console.log("🌱 Seeding penalty_appeals...");
      const appealStatuses = ["submitted", "under_review", "upheld", "reduced", "dismissed"];
      for (let i = 0; i < Math.min(penaltyIds.length, 3); i++) {
        await conn.query(
          `INSERT INTO penalty_appeals
           (penalty_id, organization_id, submitted_by, contact_email, grounds_for_appeal, evidence_summary, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
          [
            penaltyIds[i],
            orgIds[i % orgIds.length],
            ["Chief Compliance Officer", "Data Protection Officer", "Legal Counsel"][i],
            [`compliance@${["firstbank", "mtn", "luth"][i]}.ng`],
            ["Procedural irregularity in penalty assessment", "Penalty amount disproportionate to violation severity", "Technical breach without malicious intent"][i] + ". We respectfully request a review of the penalty issued under NDPR enforcement action.",
            `Supporting documents: appeal_brief_${i + 1}.pdf, remediation_evidence_${i + 1}.pdf. Mitigating factors: First-time offence, immediate remediation steps taken, full cooperation with NITDA investigation.`,
            appealStatuses[i],
          ]
        );
      }
      const [appealCount] = await conn.query("SELECT COUNT(*) as cnt FROM penalty_appeals");
      console.log(`✅ penalty_appeals: ${appealCount[0].cnt} rows`);
    } else {
      console.log(`⏭️  penalty_appeals already has ${existingAppeals[0].cnt} rows`);
    }

    // ── Enforcement Actions ──────────────────────────────────────────────────
    const [existingActions] = await conn.query("SELECT COUNT(*) as cnt FROM enforcement_actions");
    if (existingActions[0].cnt < 5) {
      console.log("🌱 Seeding enforcement_actions...");
      const [caseRows] = await conn.query("SELECT id FROM enforcement_cases ORDER BY id LIMIT 5");
      const caseIds = caseRows.map(r => r.id);
      const actionTypes = ["warning_letter", "formal_notice", "penalty_issued", "suspension_order", "compliance_directive"];
      const actionStatuses = ["pending", "sent", "acknowledged", "completed", "overdue"];
      for (let i = 0; i < Math.min(caseIds.length, 5); i++) {
        await conn.query(
          `INSERT INTO enforcement_actions
           (case_id, action_type, description, status, due_date, completed_at, created_by, created_at)
           VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? DAY), ?, 1, NOW())`,
          [
            caseIds[i] ?? null,
            actionTypes[i],
            `${["Formal warning letter issued under NDPR Section 2.1", "Compliance notice requiring immediate remediation", "Financial penalty assessment and issuance", "Temporary suspension of data processing activities", "Mandatory compliance directive with 30-day deadline"][i]}`,
            actionStatuses[i],
            [14, 30, 7, 60, 21][i],
            i < 2 ? new Date().toISOString().slice(0, 19).replace("T", " ") : null,
          ]
        );
      }
      const [actionCount] = await conn.query("SELECT COUNT(*) as cnt FROM enforcement_actions");
      console.log(`✅ enforcement_actions: ${actionCount[0].cnt} rows`);
    } else {
      console.log(`⏭️  enforcement_actions already has ${existingActions[0].cnt} rows`);
    }

    // ── In-App Notifications ─────────────────────────────────────────────────
    const [existingNotifs] = await conn.query("SELECT COUNT(*) as cnt FROM in_app_notifications");
    if (existingNotifs[0].cnt < 10) {
      console.log("🌱 Seeding in_app_notifications...");
      const notifications = [
        { title: "Critical Penalty Issued", message: "A ₦3,500,000 penalty has been issued to Dangote Industries for NDPR data residency violation.", severity: "critical", category: "penalty", action_url: "/financial" },
        { title: "Enforcement Case Opened", message: "Case NDSEP-CASE-000001 has been opened for First Bank Nigeria — persistent non-compliance.", severity: "critical", category: "enforcement", action_url: "/enforcement-cases" },
        { title: "TIA Assessment Submitted", message: "MTN Nigeria has submitted a Transfer Impact Assessment for data transfer to the United States.", severity: "warning", category: "tia", action_url: "/tia" },
        { title: "Penalty Appeal Filed", message: "Lagos University Teaching Hospital has filed an appeal against penalty #3.", severity: "info", category: "appeal", action_url: "/financial" },
        { title: "Compliance Score Improved", message: "Flutterwave's compliance score improved from 68% to 76% following remediation.", severity: "info", category: "compliance", action_url: "/compliance" },
        { title: "SLA Breach Warning", message: "Citizen data request NDSEP-CR-000012 is approaching its 30-day SLA deadline.", severity: "warning", category: "citizen_rights", action_url: "/citizen-rights" },
        { title: "Certificate Granted", message: "Zenith Bank has been granted NDPR compliance certification (valid 12 months).", severity: "info", category: "certificate", action_url: "/verify" },
        { title: "Kafka Event Bus Alert", message: "Event bus topic ndsep.penalty.issued has 127 pending messages — consumer lag detected.", severity: "warning", category: "system", action_url: "/event-bus" },
        { title: "Workflow Engine Health", message: "Temporal workflow engine: 3 workflows failed in the last hour. Review required.", severity: "critical", category: "system", action_url: "/temporal" },
        { title: "New Organization Registered", message: "Paystack Nigeria has completed portal onboarding and is pending compliance review.", severity: "info", category: "portal", action_url: "/portal-review" },
        { title: "Bulk Penalty Import", message: "12 penalties were bulk-imported from CSV by admin. Total amount: ₦8,250,000.", severity: "warning", category: "penalty", action_url: "/financial" },
        { title: "BGP Route Anomaly", message: "Suspicious BGP route advertisement detected from AS37148 — possible hijacking attempt.", severity: "critical", category: "network", action_url: "/bgp" },
      ];
      for (let i = 0; i < notifications.length; i++) {
        const n = notifications[i];
        const orgId = orgIds[i % orgIds.length];
        const isRead = i < 5 ? 1 : 0;
        await conn.query(
          `INSERT INTO in_app_notifications
           (title, message, severity, category, organization_id, user_id, action_url, metadata, is_read, created_at)
           VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, DATE_SUB(NOW(), INTERVAL ? HOUR))`,
          [
            n.title, n.message, n.severity, n.category, orgId, n.action_url,
            JSON.stringify({ seeded: true, index: i }),
            isRead,
            i * 2,
          ]
        );
      }
      const [notifCount] = await conn.query("SELECT COUNT(*) as cnt FROM in_app_notifications");
      console.log(`✅ in_app_notifications: ${notifCount[0].cnt} rows`);
    } else {
      console.log(`⏭️  in_app_notifications already has ${existingNotifs[0].cnt} rows`);
    }

    // ── Evidence Packages ────────────────────────────────────────────────────
    const [existingEvidence] = await conn.query("SELECT COUNT(*) as cnt FROM evidence_packages");
    if (existingEvidence[0].cnt < 5) {
      console.log("🌱 Seeding evidence_packages...");
      const evidenceTypes = ["audit_report", "network_capture", "compliance_certificate", "violation_screenshot", "remediation_proof"];
      const [caseRows2] = await conn.query("SELECT id FROM enforcement_cases ORDER BY id LIMIT 5");
      const caseIds2 = caseRows2.map(r => r.id);
      for (let i = 0; i < Math.min(orgIds.length, 5); i++) {
        await conn.query(
          `INSERT INTO evidence_packages
           (organization_id, case_id, title, description, evidence_type, file_url, file_hash, collected_by, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'verified', NOW())`,
          [
            orgIds[i],
            caseIds2[i] ?? null,
            `${["Q1 2026 Data Audit Report", "Network Traffic Capture — March 2026", "NDPR Compliance Certificate", "Data Exfiltration Screenshot", "Remediation Completion Report"][i]}`,
            `Evidence package for ${orgRows[i]?.name ?? "Organization"} — ${evidenceTypes[i].replace(/_/g, " ")}`,
            evidenceTypes[i],
            `https://storage.ndsep.gov.ng/evidence/${orgIds[i]}/${evidenceTypes[i]}_${Date.now()}.pdf`,
            `sha256:${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("")}`,
          ]
        );
      }
      const [evidenceCount] = await conn.query("SELECT COUNT(*) as cnt FROM evidence_packages");
      console.log(`✅ evidence_packages: ${evidenceCount[0].cnt} rows`);
    } else {
      console.log(`⏭️  evidence_packages already has ${existingEvidence[0].cnt} rows`);
    }

    // ── Remediation Workflows ────────────────────────────────────────────────
    const [existingRemediation] = await conn.query("SELECT COUNT(*) as cnt FROM remediation_workflows");
    if (existingRemediation[0].cnt < 5) {
      console.log("🌱 Seeding remediation_workflows...");
      const remStatuses = ["pending", "in_progress", "completed", "overdue", "in_progress"];
      const remTypes = ["data_localisation", "consent_management", "breach_notification", "dpo_appointment", "cross_border_transfer"];
      for (let i = 0; i < Math.min(orgIds.length, 5); i++) {
        const completedAt = i === 2 ? new Date().toISOString().slice(0, 19).replace("T", " ") : null;
        await conn.query(
          `INSERT INTO remediation_workflows
           (org_id, violation_type, status, steps, assigned_to, due_date, completed_at, notes, created_at)
           VALUES (?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 45 DAY), ?, ?, NOW())`,
          [
            String(orgIds[i]),
            remTypes[i],
            remStatuses[i],
            JSON.stringify([
              { step: 1, title: "Initial Assessment", status: i > 0 ? "completed" : "pending", completedAt: i > 0 ? new Date().toISOString() : null },
              { step: 2, title: "Remediation Plan", status: i > 1 ? "completed" : i === 1 ? "in_progress" : "pending", completedAt: i > 1 ? new Date().toISOString() : null },
              { step: 3, title: "Implementation", status: i > 2 ? "completed" : "pending", completedAt: i > 2 ? new Date().toISOString() : null },
              { step: 4, title: "Verification & Sign-off", status: i === 2 ? "completed" : "pending", completedAt: i === 2 ? new Date().toISOString() : null },
            ]),
            `Officer ${["Chidi Okeke", "Amina Hassan", "Emeka Nwosu", "Fatima Bello", "Tunde Adeyemi"][i]}`,
            completedAt,
            `Remediation workflow for ${remTypes[i].replace(/_/g, " ")} violation — ${["Critical priority", "High priority", "Completed successfully", "Overdue — escalation required", "In progress"][i]}`,
          ]
        );
      }
      const [remCount] = await conn.query("SELECT COUNT(*) as cnt FROM remediation_workflows");
      console.log(`✅ remediation_workflows: ${remCount[0].cnt} rows`);
    } else {
      console.log(`⏭️  remediation_workflows already has ${existingRemediation[0].cnt} rows`);
    }

    // ── Financial Ledger ─────────────────────────────────────────────────────
    const [existingLedger] = await conn.query("SELECT COUNT(*) as cnt FROM financial_ledger");
    if (existingLedger[0].cnt < 10) {
      console.log("🌱 Seeding financial_ledger...");
      const txTypes = ["penalty_payment", "penalty_reversal", "appeal_reduction", "interest_accrual", "settlement"];
      for (let i = 0; i < Math.min(penaltyIds.length, 8); i++) {
        const amount = [500000, 1200000, 3500000, 750000, 2000000, 850000, 1500000, 600000][i];
        await conn.query(
          `INSERT INTO financial_ledger
           (penalty_id, organization_id, transaction_type, amount, currency, reference, description, status, created_at)
           VALUES (?, ?, ?, ?, 'NGN', ?, ?, 'completed', DATE_SUB(NOW(), INTERVAL ? DAY))`,
          [
            penaltyIds[i],
            orgIds[i % orgIds.length],
            txTypes[i % txTypes.length],
            amount,
            `NDSEP-TXN-${String(i + 1).padStart(8, "0")}`,
            `${txTypes[i % txTypes.length].replace(/_/g, " ")} for penalty #${penaltyIds[i]}`,
            i * 3,
          ]
        );
      }
      const [ledgerCount] = await conn.query("SELECT COUNT(*) as cnt FROM financial_ledger");
      console.log(`✅ financial_ledger: ${ledgerCount[0].cnt} rows`);
    } else {
      console.log(`⏭️  financial_ledger already has ${existingLedger[0].cnt} rows`);
    }

    // ── Summary ──────────────────────────────────────────────────────────────
    console.log("\n🎉 Phase 4 seed complete!");
    const tables = [
      "organizations", "financial_penalties", "enforcement_cases", "tia_assessments",
      "penalty_appeals", "enforcement_actions", "in_app_notifications",
      "evidence_packages", "remediation_workflows", "financial_ledger",
    ];
    for (const table of tables) {
      try {
        const [cnt] = await conn.query(`SELECT COUNT(*) as cnt FROM ${table}`);
        console.log(`  ${table}: ${cnt[0].cnt} rows`);
      } catch (e) {
        console.log(`  ${table}: ⚠️  ${e.message}`);
      }
    }
  } finally {
    await conn.end();
  }
}

run().catch(e => { console.error("❌ Seed failed:", e.message); process.exit(1); });
