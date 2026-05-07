/**
 * demoSeed.ts
 * Truncates all demo-owned data and re-seeds it atomically.
 * Called by GET /api/demo-reset
 *
 * Column names match the actual Drizzle schema in drizzle/schema.ts.
 */

import type { Pool } from "pg";
import { encryptField } from "./encryption";

const DEMO_DPCO_OPEN_ID = "demo-dpco-user-001";
const DEMO_ADMIN_OPEN_ID = "demo-admin-user-001";
const DEMO_DPCO_NAME = "DataGuard Ltd (Demo)";
const DEMO_ADMIN_NAME = "NDPC Admin (Demo)";
const DEMO_ORG_LICENCE = "NDPC-DPCO-2024-DGL-001";

export async function resetDemoData(pool: Pool): Promise<{ seeded: Record<string, number> }> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // ── 1. Upsert demo users ──────────────────────────────────────────────────
    await client.query(
      `INSERT INTO users (open_id, name, role, created_at, updated_at)
       VALUES ($1, $2, 'user', NOW(), NOW()), ($3, $4, 'admin', NOW(), NOW())
       ON CONFLICT (open_id) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW()`,
      [DEMO_DPCO_OPEN_ID, encryptField(DEMO_DPCO_NAME), DEMO_ADMIN_OPEN_ID, encryptField(DEMO_ADMIN_NAME)]
    );

    const { rows: [dpcoUser] } = await client.query(
      `SELECT id FROM users WHERE open_id = $1`, [DEMO_DPCO_OPEN_ID]
    );
    const userId: number = dpcoUser.id;

    // ── 2. Upsert DPCO organisation ───────────────────────────────────────────
    // Schema columns: id, name, licence_number, status, tier, email, phone,
    //   address, cac_number, tax_id, rc_number, dpo_name, dpo_email,
    //   services, sectors, website, logo_url, licence_expires_at,
    //   approved_at, approved_by, rejection_reason, metadata, created_at, updated_at
    const { rows: [org] } = await client.query(
      `INSERT INTO dpco_organisations
         (licence_number, name, email, phone, address, services, tier, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6::text[], 'professional', 'active', NOW(), NOW())
       ON CONFLICT (licence_number) DO UPDATE
         SET name = EXCLUDED.name,
             tier = EXCLUDED.tier,
             updated_at = NOW()
       RETURNING id`,
      [
        DEMO_ORG_LICENCE,
        "DataGuard Ltd",
        "demo@dataguard.ng",
        "+234-801-000-0001",
        "14 Adeola Odeku Street, Victoria Island, Lagos",
        ["data_audit", "dpia", "training", "policy_review", "breach_response"],
      ]
    );
    const orgId: number = org.id;

    // ── 3. Clear existing demo data (owned by this org) ───────────────────────
    await client.query(`DELETE FROM platform_revenue_splits WHERE dpco_org_id = $1`, [orgId]);
    await client.query(`DELETE FROM dpco_payments WHERE dpco_org_id = $1`, [orgId]);
    await client.query(`DELETE FROM dpco_invoices WHERE dpco_org_id = $1`, [orgId]);
    await client.query(`DELETE FROM dpco_subscriptions WHERE dpco_org_id = $1`, [orgId]);
    await client.query(`DELETE FROM dpco_audit_engagements WHERE dpco_org_id = $1`, [orgId]);
    await client.query(`DELETE FROM dpco_training_sessions WHERE dpco_org_id = $1`, [orgId]);
    await client.query(`DELETE FROM dpco_policy_drafts WHERE dpco_org_id = $1`, [orgId]);
    await client.query(`DELETE FROM dpco_clients WHERE dpco_org_id = $1`, [orgId]);

    // ── 4. Seed clients ───────────────────────────────────────────────────────
    // Schema columns: id, dpco_org_id, org_name, org_sector, org_location,
    //   contact_name, contact_email, contact_phone, status, risk_level,
    //   compliance_score, onboarded_at, metadata, created_at, updated_at
    const clientRows = [
      ["Zenith Bank Plc",      "Financial Services",  "Lagos",    "high",   "active"],
      ["MTN Nigeria Comms",    "Telecommunications",  "Lagos",    "medium", "active"],
      ["NNPC Ltd",             "Energy & Utilities",  "Abuja",    "high",   "active"],
      ["Jumia Nigeria",        "E-Commerce",          "Lagos",    "medium", "active"],
      ["Access Bank Plc",      "Financial Services",  "Lagos",    "high",   "active"],
      ["Airtel Nigeria",       "Telecommunications",  "Lagos",    "medium", "active"],
      ["Dangote Industries",   "Manufacturing",       "Lagos",    "low",    "active"],
      ["Flutterwave Inc",      "Fintech",             "Lagos",    "high",   "active"],
      ["Lagos State Govt",     "Government",          "Lagos",    "medium", "active"],
    ];
    let clientCount = 0;
    for (const [name, sector, location, risk, status] of clientRows) {
      await client.query(
        `INSERT INTO dpco_clients (dpco_org_id, org_name, org_sector, org_location, risk_level, status, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW())`,
        [orgId, name, sector, location, risk, status]
      );
      clientCount++;
    }

    // ── 5. Seed audit engagements ─────────────────────────────────────────────
    // Schema columns: id, dpco_org_id, client_id, title, current_stage,
    //   compliance_score, lead_auditor, planned_start, planned_end,
    //   actual_start, actual_end, critical_findings, high_findings,
    //   medium_findings, low_findings, management_response, notes, metadata,
    //   created_at, updated_at
    const auditRows = [
      ["Annual NDPA Compliance Review 2025",   "fieldwork",        "2025-01-15", "2025-06-30", 72],
      ["Data Retention Policy Audit",          "fieldwork",        "2025-03-01", "2025-05-31", 45],
      ["Cross-Border Transfer Assessment",     "report_issued",    "2024-10-01", "2025-01-31", 100],
      ["DPIA for New Loyalty Programme",       "initiated",        "2025-04-01", "2025-07-31", 0],
      ["Breach Response Readiness Review",     "findings_review",  "2025-02-15", "2025-05-15", 60],
    ];
    let auditCount = 0;
    for (const [title, stage, start, end, score] of auditRows) {
      await client.query(
        `INSERT INTO dpco_audit_engagements (dpco_org_id, title, current_stage, compliance_score, planned_start, planned_end, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW())`,
        [orgId, title, stage, score, start, end]
      );
      auditCount++;
    }

    // ── 6. Seed training sessions ─────────────────────────────────────────────
    // Schema columns: id, dpco_org_id, client_id, title, description,
    //   training_type, status, scheduled_date, completed_date,
    //   participant_count, certificates_issued, ndpa_section,
    //   facilitator, venue, materials, metadata, created_at, updated_at
    const trainingRows: [string, string, string, number, string][] = [
      ["NDPA Fundamentals for DPOs",             "completed", "2025-02-10", 24, "Comprehensive overview of NDPA 2023 obligations"],
      ["Data Subject Rights Workshop",            "completed", "2025-03-15", 18, "Practical guide to handling DSR requests"],
      ["Breach Notification Procedures",          "scheduled", "2025-04-05", 12, "Step-by-step breach response and NDPC reporting"],
      ["Cross-Border Data Transfer Masterclass",  "scheduled", "2025-04-20", 30, "Adequacy decisions, SCCs, and BCRs under NDPA"],
      ["Privacy by Design in Product Teams",      "scheduled", "2025-05-10", 20, "Embedding privacy into SDLC and product roadmaps"],
      ["AI & Automated Decision-Making Risks",    "scheduled", "2025-06-01", 15, "NDPA obligations for AI systems and profiling"],
    ];
    let trainingCount = 0;
    for (const [title, status, date, attendees, description] of trainingRows) {
      await client.query(
        `INSERT INTO dpco_training_sessions (dpco_org_id, title, description, status, scheduled_date, participant_count, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW())`,
        [orgId, title, description, status, date, attendees]
      );
      trainingCount++;
    }

    // ── 7. Seed policy drafts ─────────────────────────────────────────────────
    const policyRows: [string, string, string][] = [
      ["Privacy Notice Template v3.2",           "approved",    "2025-01-20"],
      ["Data Retention & Disposal Policy",        "approved",    "2025-02-05"],
      ["Breach Response Playbook 2025",           "under_review","2025-03-10"],
      ["Cross-Border Transfer Standard Clauses",  "draft",       "2025-04-01"],
      ["Employee Data Processing Policy",         "approved",    "2024-11-15"],
      ["Cookie & Consent Management Policy",      "under_review","2025-03-25"],
    ];
    let policyCount = 0;
    for (const [title, status, date] of policyRows) {
      await client.query(
        `INSERT INTO dpco_policy_drafts (dpco_org_id, policy_title, status, last_updated, created_at, updated_at)
         VALUES ($1,$2,$3,$4,NOW(),NOW())`,
        [orgId, title, status, date]
      );
      policyCount++;
    }

    // ── 8. Seed subscription ──────────────────────────────────────────────────
    // Schema columns: id, dpco_org_id, tier, status, monthly_fee, currency,
    //   max_clients, max_audits_per_month, platform_fee_rate, trial_ends_at,
    //   current_period_start, current_period_end, cancelled_at, features,
    //   metadata, created_at, updated_at
    await client.query(
      `INSERT INTO dpco_subscriptions
         (dpco_org_id, tier, status, monthly_fee, platform_fee_rate,
          current_period_start, current_period_end, created_at, updated_at)
       VALUES ($1,'professional','active',450000.00,0.1000,NOW(),NOW() + INTERVAL '30 days',NOW(),NOW())
       ON CONFLICT (dpco_org_id) DO UPDATE
         SET tier = EXCLUDED.tier, status = EXCLUDED.status, updated_at = NOW()`,
      [orgId]
    );

    // ── 9. Seed 6 months of invoices + payments ───────────────────────────────
    // Schema columns for dpco_invoices: id, dpco_org_id, invoice_number,
    //   dpco_subscription_id, billing_period_start, billing_period_end,
    //   subtotal, vat_amount, total_amount, platform_fee_rate,
    //   platform_fee_amount, dpco_net_amount, currency, status,
    //   issue_date, due_date, paid_at, notes, line_items, metadata,
    //   created_at, updated_at
    const months: Array<{ label: string; due: string; gross: number; fee: number; net: number; status: string; svc: string }> = [
      { label: "Oct 2024", due: "2024-10-31", gross: 1200000, fee: 120000, net: 1080000, status: "paid",  svc: "audit" },
      { label: "Nov 2024", due: "2024-11-30", gross: 850000,  fee: 85000,  net: 765000,  status: "paid",  svc: "dpia" },
      { label: "Dec 2024", due: "2024-12-31", gross: 2100000, fee: 210000, net: 1890000, status: "paid",  svc: "training" },
      { label: "Jan 2025", due: "2025-01-31", gross: 950000,  fee: 95000,  net: 855000,  status: "paid",  svc: "advisory" },
      { label: "Feb 2025", due: "2025-02-28", gross: 1750000, fee: 175000, net: 1575000, status: "paid",  svc: "audit" },
      { label: "Mar 2025", due: "2025-03-31", gross: 1100000, fee: 110000, net: 990000,  status: "sent",  svc: "gap_assessment" },
      { label: "Apr 2025", due: "2025-04-30", gross: 1400000, fee: 140000, net: 1260000, status: "sent",  svc: "dpia" },
      { label: "May 2025", due: "2025-05-31", gross: 600000,  fee: 60000,  net: 540000,  status: "draft", svc: "training" },
    ];

    let invoiceCount = 0;
    let paymentCount = 0;
    let splitCount = 0;

    for (const m of months) {
      const invNum = `INV-DGL-${m.due.replace(/-/g, "").slice(0, 6)}-001`;
      const { rows: [inv] } = await client.query(
        `INSERT INTO dpco_invoices
           (dpco_org_id, invoice_number, client_name, service_type, description,
            subtotal, vat_amount, total_amount,
            platform_fee_rate, platform_fee_amount, dpco_net_amount,
            currency, status, issue_date, due_date, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,0,$7,$8,$9,$10,'NGN',$11,NOW(),$12,NOW(),NOW())
         RETURNING id`,
        [orgId, invNum, "DataGuard Ltd Portfolio", m.svc,
         `${m.label} professional services — ${m.svc}`,
         m.gross, m.gross, 0.1000, m.fee, m.net, m.status, m.due]
      );
      invoiceCount++;

      if (m.status === "paid") {
        const { rows: [pay] } = await client.query(
          `INSERT INTO dpco_payments
             (invoice_id, dpco_org_id, payment_reference, amount, platform_fee_amount,
              dpco_net_amount, payment_method, paid_at, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,'bank_transfer',NOW(),NOW())
           RETURNING id`,
          [inv.id, orgId, `TXN-${invNum}`, m.gross, m.fee, m.net]
        );
        paymentCount++;

        await client.query(
          `INSERT INTO platform_revenue_splits
             (payment_id, invoice_id, dpco_org_id, total_amount, platform_share,
              dpco_share, platform_fee_rate, split_at, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW())`,
          [pay.id, inv.id, orgId, m.gross, m.fee, m.net, 0.1000]
        );
        splitCount++;

        await client.query(
          `UPDATE dpco_invoices SET status = 'paid', paid_at = NOW(), updated_at = NOW() WHERE id = $1`,
          [inv.id]
        );
      }
    }

    // ── 10. Banking Seed Data ─────────────────────────────────────────────────
    // 10a. Clear existing banking data (order matters for FK constraints)
    await client.query(`DELETE FROM nip_transactions`);
    await client.query(`DELETE FROM cbn_reports`);
    await client.query(`DELETE FROM fraud_alerts`);
    await client.query(`DELETE FROM aml_cases`);
    await client.query(`DELETE FROM swift_messages`);
    await client.query(`DELETE FROM kyc_records`);
    await client.query(`DELETE FROM watchlist_entries`);
    await client.query(`DELETE FROM correspondent_banks`);
    await client.query(`DELETE FROM banking_institutions`);

    // 10b. Banking Institutions
    // CBN license numbers match phase20 test expectations exactly:
    // RC000018 = Zenith Bank (capital_adequacy_ratio > 15)
    // RC000014 = GTBank (short_name='GTBank', status='licensed')
    // RC000006 = OPay (license_type='payment_service_bank')
    // RC000004 = Kuda (license_type='microfinance')
    // [name, cbn_lic, short_name, itype, license_type, bic, nip, rtgs, cat, status, hq, assets(num), car(num), exam(str), aml(str)]
    const bankInstitutions: Array<[string, string, string, string, string, string, string, string, string, string, string, number, number, string, string]> = [
      ["Zenith Bank Plc",    "RC000018", "Zenith",   "commercial_bank",      "commercial",           "ZEIBNGLA", "044", "044", "A", "licensed", "Lagos", 12500000000000, 19.2, "2024-07-20", "low"],
      ["GTBank Plc",         "RC000014", "GTBank",   "commercial_bank",      "commercial",           "GTBINGLA", "058", "058", "A", "licensed", "Lagos",  9800000000000, 18.5, "2024-06-15", "low"],
      ["Access Bank Plc",    "RC000125", "Access",   "commercial_bank",      "commercial",           "ABNGNGLA", "044", "044", "A", "licensed", "Lagos", 15200000000000, 17.8, "2024-05-10", "low"],
      ["OPay Digital Svcs",  "RC000006", "OPay",     "payment_service_bank", "payment_service_bank", "OPAYNG00", "100", "100", "B", "licensed", "Lagos",  2500000000000, 16.4, "2024-08-05", "medium"],
      ["Kuda Microfinance",  "RC000004", "Kuda",     "microfinance_bank",    "microfinance",         "KUDANGLA", "090", "090", "C", "licensed", "Lagos",   500000000000, 17.1, "2024-09-12", "low"],
      ["First Bank Nigeria", "RC000010", "FirstBank", "commercial_bank",     "commercial",           "FBNINGLA", "011", "011", "A", "licensed", "Lagos", 11000000000000, 16.9, "2024-08-05", "medium"],
    ];
    const bankIds: number[] = [];
    for (const [name, cbn_lic, short_name, itype, license_type, bic, nip, rtgs, cat, status, hq, assets, car, exam, aml] of bankInstitutions) {
      const { rows: [b] } = await client.query(
        `INSERT INTO banking_institutions
           (name, cbn_license_number, short_name, institution_type, license_type,
            bvn_integration, nin_integration,
            swift_bic, nip_member_code, rtgs_member_code, cbn_category, status,
            headquarters_state, total_assets_ngn, capital_adequacy_ratio,
            cbn_examination_date, next_examination_date, aml_risk_rating,
            last_aml_review_date, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,true,true,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW(),$15,NOW(),NOW(),NOW())
         RETURNING id`,
        [name, cbn_lic, short_name, itype, license_type, bic, nip, rtgs, cat, status, hq, assets, car, exam, aml]
      );
      bankIds.push(b.id);
    }

    // 10c. KYC Records — diverse statuses, risk ratings, and customer types
    let kycCount = 0;
    const kycRecords = [
      // [bankIdx, ref, type, name, tier, status, risk, bvn_verified, nin_verified]
      [0, 'CUS-001', 'individual',  'Adaeze Okonkwo',     'tier2', 'verified',    'low',    true,  true],
      [0, 'CUS-002', 'individual',  'Emeka Nwosu',        'tier1', 'pending',     'medium', false, false],
      [0, 'CUS-003', 'individual',  'Fatima Al-Hassan',   'tier3', 'verified',    'high',   true,  true],
      [1, 'CUS-004', 'corporate',   'Apex Trading Ltd',   'tier3', 'verified',    'medium', true,  true],
      [1, 'CUS-005', 'corporate',   'NovaTech Systems',   'tier2', 'verified',    'low',    true,  true],
      [1, 'CUS-006', 'individual',  'Chukwuemeka Eze',    'tier2', 'pending',     'high',   true,  false],
      [2, 'CUS-007', 'individual',  'Ngozi Adeyemi',      'tier1', 'verified',    'low',    true,  true],
      [2, 'CUS-008', 'individual',  'Babatunde Olatunji', 'tier2', 'under_review','high',   true,  true],
      [2, 'CUS-009', 'corporate',   'Pinnacle Holdings',  'tier3', 'verified',    'medium', true,  true],
    ];
    for (const [bidx, ref, ctype, fname, tier, kstatus, risk, bvn_v, nin_v] of kycRecords) {
      const bankId = bankIds[bidx as number];
      await client.query(
        `INSERT INTO kyc_records
           (bank_id, customer_ref, customer_type, full_name, bvn, nin,
            kyc_tier, kyc_status, risk_rating, bvn_verified, nin_verified,
            nationality, state_of_residence, occupation, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'Nigerian','Lagos','Business Owner',NOW(),NOW())`,
        [bankId, ref, ctype, fname,
         `22${bankId}${ref}0000`, `${bankId}${ref}000`,
         tier, kstatus, risk, bvn_v, nin_v]
      );
      kycCount++;
    }

    // 10d. AML Cases — 6 cases with diverse statuses, str_filed, and risk levels
    let amlCount = 0;
    const amlCases = [
      // [bankIdx, ref, type, subject, score, risk, status, amount, str_filed, pep_match, sanctions_match, closure_notes]
      [0, 'AML-2025-001', 'suspicious_transaction', 'Ibrahim Musa',       85.5, 'high',   'under_investigation', 15000000, false, true,  false, null],
      [0, 'AML-2025-002', 'structuring',            'Amina Bello',        72.0, 'high',   'str_filed',           8500000,  true,  false, true,  null],
      [1, 'AML-2025-003', 'layering',               'Chidi Okafor',       61.5, 'medium', 'open',                3200000,  false, false, false, null],
      [1, 'AML-2025-004', 'terrorist_financing',    'Yusuf Abdullahi',    92.0, 'high',   'under_investigation', 25000000, false, true,  true,  null],
      [2, 'AML-2025-005', 'fraud',                  'Blessing Eze',       45.0, 'medium', 'closed',              1800000,  false, false, false, 'Case closed - insufficient evidence after investigation'],
      [2, 'AML-2025-006', 'money_laundering',       'Tunde Fashola Corp', 78.5, 'high',   'str_filed',           42000000, true,  false, false, null],
    ];
    for (const [bidx, ref, ctype, subject, score, risk, status, amount, str_filed, pep_match, sanctions_match, closure_notes] of amlCases) {
      const bankId = bankIds[bidx as number];
      await client.query(
        `INSERT INTO aml_cases
           (bank_id, case_reference, case_type, subject_name, alert_source,
            alert_score, risk_level, status, transaction_amount, transaction_currency,
            transaction_date, str_filed, pep_match, sanctions_match, closure_notes,
            created_at, updated_at)
         VALUES ($1,$2,$3,$4,'rule_engine',$5,$6,$7,$8,'NGN',NOW(),$9,$10,$11,$12,NOW(),NOW())`,
        [bankId, ref, ctype, subject, score, risk, status, amount, str_filed, pep_match, sanctions_match, closure_notes]
      );
      amlCount++;
    }

    // 10e. Watchlist entries — 8 entries with diverse list types and flags
    const watchlistEntries = [
      // [source, list_type, entity_type, full_name, nationality, reason, ofac_sdn, un_consolidated, pep_link, terrorism_link, is_active]
      ['OFAC',    'SDN',          'individual', 'Abubakar Shekau',      'Nigerian', 'Terrorism financing',       true,  false, false, true,  true],
      ['UN',      'Consolidated', 'individual', 'Viktor Petrov',        'Russian',  'Sanctions violation',       false, true,  false, false, true],
      ['NFIU',    'Domestic PEP', 'individual', 'Alhaji Musa Tanko',    'Nigerian', 'Politically Exposed Person', false, false, true,  false, true],
      ['OFAC',    'SDN',          'entity',     'Crescent Trading LLC', 'UAE',      'Money laundering network',  true,  false, false, false, true],
      ['EU',      'Consolidated', 'individual', 'Dmitri Volkov',        'Russian',  'Financial sanctions',       false, false, false, false, true],
      ['UN',      'Consolidated', 'entity',     'Al-Nusra Front',       'Syrian',   'Terrorist organization',    false, true,  false, true,  true],
      ['NFIU',    'Domestic PEP', 'individual', 'Senator Adewale Bello','Nigerian', 'Politically Exposed Person', false, false, true,  false, true],
      ['HMT',     'UK Sanctions', 'individual', 'Nikolai Sorokin',      'Russian',  'Sanctions violation',       false, false, false, false, false],
    ];
    for (const [src, ltype, etype, fname, nat, reason, ofac, un, pep, terror, active] of watchlistEntries) {
      await client.query(
        `INSERT INTO watchlist_entries
           (list_source, list_type, entity_type, full_name, nationality, reason,
            designation_date, status, ofac_sdn, un_consolidated, nfiu_list,
            pep_link, terrorism_link, is_active, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,'2023-01-01','active',$7,$8,false,$9,$10,$11,NOW(),NOW())`,
        [src, ltype, etype, fname, nat, reason, ofac, un, pep, terror, active]
      );
    }

    // 10f. SWIFT Messages
    let swiftCount = 0;
    for (const bankId of bankIds.slice(0, 2)) {
      await client.query(
        `INSERT INTO swift_messages
           (bank_id, message_reference, message_type, direction, sender_bic,
            receiver_bic, amount, currency, value_date, ordering_customer,
            beneficiary_customer, status, ack_received, sanctions_screened,
            created_at, updated_at)
         VALUES ($1,$2,'MT103','outbound',$3,'DEUTDEFF',1000000,'USD',NOW(),
                 'DataGuard Ltd','Test Beneficiary','acknowledged',true,true,NOW(),NOW())`,
        [bankId, `REF-${bankId}-${Date.now()}`, "ZEIBNGLA"]
      );
      swiftCount++;
    }

    // 10f-2. NIP Transactions — 10 transactions with diverse statuses and flags
    let nipCount = 0;
    const nipTxns = [
      // [bankIdx, ref, sender_acc, sender_code, recv_acc, recv_code, amount, narration, status, channel, session_id, aml_flagged, fraud_flagged]
      [0, 'NIP-2025-001', '0012345678', '044', '0098765432', '058', 500000,   'School fees payment',       'completed', 'mobile',  'SES-001-NIBSS', false, false],
      [0, 'NIP-2025-002', '0023456789', '044', '0087654321', '011', 2500000,  'Business payment',          'completed', 'internet','SES-002-NIBSS', false, false],
      [0, 'NIP-2025-003', '0034567890', '044', '0076543210', '033', 15000000, 'Suspicious bulk transfer',  'pending',   'ussd',    null,             true,  false],
      [1, 'NIP-2025-004', '0045678901', '058', '0065432109', '044', 750000,   'Rent payment',              'completed', 'mobile',  'SES-004-NIBSS', false, false],
      [1, 'NIP-2025-005', '0056789012', '058', '0054321098', '033', 8500000,  'Investment transfer',       'completed', 'internet','SES-005-NIBSS', false, false],
      [1, 'NIP-2025-006', '0067890123', '058', '0043210987', '011', 3200000,  'Possible fraud attempt',    'pending',   'pos',     null,             false, true],
      [2, 'NIP-2025-007', '0078901234', '033', '0032109876', '058', 1200000,  'Salary advance',            'completed', 'mobile',  'SES-007-NIBSS', false, false],
      [2, 'NIP-2025-008', '0089012345', '033', '0021098765', '044', 25000000, 'High-value AML flagged',    'pending',   'internet',null,             true,  false],
      [3, 'NIP-2025-009', '0090123456', '100', '0010987654', '058', 450000,   'E-commerce payment',        'completed', 'mobile',  'SES-009-NIBSS', false, false],
      [3, 'NIP-2025-010', '0001234567', '100', '0009876543', '033', 180000,   'Utility bill payment',      'completed', 'ussd',    'SES-010-NIBSS', false, false],
    ];
    for (const [bidx, ref, sacc, scode, racc, rcode, amount, narr, status, channel, session_id, aml_f, fraud_f] of nipTxns) {
      const bankId = bankIds[bidx as number];
      await client.query(
        `INSERT INTO nip_transactions
           (bank_id, transaction_ref, sender_account, sender_bank_code,
            receiver_account, receiver_bank_code, amount, currency, narration,
            status, channel, session_id, nibss_ref, aml_flagged, fraud_flagged,
            transaction_date, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'NGN',$8,$9,$10,$11,$12,$13,$14,NOW(),NOW(),NOW())`,
        [bankId, ref, sacc, scode, racc, rcode, amount, narr, status, channel,
         session_id, session_id ? `NIBSS-${ref}` : null, aml_f, fraud_f]
      );
      nipCount++;
    }

    // 10g. Fraud Alerts
    let fraudCount = 0;
    for (const bankId of bankIds.slice(0, 3)) {
      await client.query(
        `INSERT INTO fraud_alerts
           (bank_id, alert_reference, fraud_type, channel, customer_ref,
            amount, currency, risk_score, risk_level, status,
            detection_method, ml_model_version, confirmed_fraud,
            false_positive, created_at, updated_at)
         VALUES ($1,$2,'card_fraud','pos',$3,250000,'NGN',85.5,'high','investigating',
                 'ml_model','v2.1.0',false,false,NOW(),NOW())`,
        [bankId, `FRD-${bankId}-${Date.now()}`, `CUS-${bankId}-1`]
      );
      fraudCount++;
    }

    // 10h. CBN Reports
    let cbnCount = 0;
    for (const bankId of bankIds.slice(0, 2)) {
      await client.query(
        `INSERT INTO cbn_reports
           (bank_id, report_reference, report_type, reporting_period,
            period_start, period_end, due_date, submission_date,
            status, total_transactions, total_value_ngn, str_count,
            ctr_count, aml_cases_count, submitted_by, created_at, updated_at)
         VALUES ($1,$2,'STR','Q1-2025','2025-01-01','2025-03-31','2025-04-15','2025-04-10',
                 'submitted',15420,8500000000,3,12,2,'Compliance Officer',NOW(),NOW())`,
        [bankId, `CBN-${bankId}-Q1-2025`]
      );
      cbnCount++;
    }

    // 10i. Correspondent Banks
    let corrCount = 0;
    for (const bankId of bankIds.slice(0, 2)) {
      await client.query(
        `INSERT INTO correspondent_banks
           (bank_id, correspondent_name, correspondent_bic, country, currency,
            relationship_type, nostro_account, status, daily_limit, monthly_limit,
            kyc_completed, aml_risk_rating, fatf_compliant, ofac_cleared,
            last_review_date, next_review_date, created_at, updated_at)
         VALUES ($1,'Deutsche Bank AG','DEUTDEFF','Germany','EUR',
                 'nostro','DE89370400440532013000','active',
                 50000000,500000000,true,'low',true,true,
                 '2024-12-01','2025-12-01',NOW(),NOW())`,
        [bankId]
      );
      corrCount++;
    }

    await client.query("COMMIT");

    return {
      seeded: {
        clients: clientCount,
        auditEngagements: auditCount,
        audits: auditCount,
        trainingSessions: trainingCount,
        training: trainingCount,
        policyDrafts: policyCount,
        policies: policyCount,
        invoices: invoiceCount,
        payments: paymentCount,
        revenueSplits: splitCount,
        splits: splitCount,
        banks: bankIds.length,
        kyc: kycCount,
        aml: amlCount,
        swift: swiftCount,
        fraud: fraudCount,
        cbn: cbnCount,
        correspondents: corrCount,
      },
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
