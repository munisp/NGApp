#!/usr/bin/env node
// Banking tables creation script for MySQL/TiDB
const mysql = require('../node_modules/mysql2/promise.js');

const url = process.env.DATABASE_URL;
const parsed = new URL(url);

async function run() {
  const pool = mysql.createPool({
    host: parsed.hostname,
    port: parseInt(parsed.port) || 4000,
    user: parsed.username,
    password: parsed.password,
    database: parsed.pathname.slice(1),
    ssl: { rejectUnauthorized: false },
    multipleStatements: true
  });

  const conn = await pool.getConnection();
  
  const statements = [
    // Banking Institutions
    `CREATE TABLE IF NOT EXISTS banking_institutions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      cbn_code VARCHAR(10) UNIQUE NOT NULL,
      sort_code VARCHAR(10) UNIQUE NOT NULL,
      bic_code VARCHAR(11),
      name VARCHAR(255) NOT NULL,
      short_name VARCHAR(50) NOT NULL,
      license_type ENUM('commercial','merchant','microfinance','development','mortgage','payment_service_bank','non_interest') NOT NULL,
      license_number VARCHAR(50) NOT NULL,
      status ENUM('licensed','provisional','suspended','revoked','under_examination') DEFAULT 'licensed' NOT NULL,
      head_office_address TEXT,
      ceo_name VARCHAR(255),
      total_assets BIGINT,
      capital_adequacy_ratio DECIMAL(5,2),
      non_performing_loan_ratio DECIMAL(5,2),
      data_protection_officer VARCHAR(255),
      dpco_org_id INT,
      last_examination_date DATETIME,
      next_examination_date DATETIME,
      compliance_score INT DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL
    )`,
    // KYC Records
    `CREATE TABLE IF NOT EXISTS kyc_records (
      id INT AUTO_INCREMENT PRIMARY KEY,
      reference_id VARCHAR(50) UNIQUE NOT NULL,
      organization_id INT,
      bank_id INT,
      subject_type VARCHAR(30) DEFAULT 'individual' NOT NULL,
      full_name VARCHAR(255) NOT NULL,
      date_of_birth VARCHAR(20),
      nationality VARCHAR(100) DEFAULT 'Nigerian',
      bvn VARCHAR(11),
      nin VARCHAR(11),
      phone_number VARCHAR(20),
      email VARCHAR(255),
      address TEXT,
      selfie_url VARCHAR(500),
      id_document_type VARCHAR(50),
      id_document_url VARCHAR(500),
      liveness_score DECIMAL(5,2),
      face_match_score DECIMAL(5,2),
      bvn_verified TINYINT(1) DEFAULT 0,
      nin_verified TINYINT(1) DEFAULT 0,
      address_verified TINYINT(1) DEFAULT 0,
      tier ENUM('tier1','tier2','tier3') DEFAULT 'tier1' NOT NULL,
      status ENUM('pending','in_review','verified','rejected','expired','suspended') DEFAULT 'pending' NOT NULL,
      risk_rating VARCHAR(20) DEFAULT 'low',
      pep_flag TINYINT(1) DEFAULT 0,
      sanctions_flag TINYINT(1) DEFAULT 0,
      reviewed_by VARCHAR(255),
      reviewed_at DATETIME,
      rejection_reason TEXT,
      expires_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
      INDEX idx_kyc_bank (bank_id),
      INDEX idx_kyc_status (status),
      INDEX idx_kyc_bvn (bvn),
      INDEX idx_kyc_nin (nin)
    )`,
    // AML Cases
    `CREATE TABLE IF NOT EXISTS aml_cases (
      id INT AUTO_INCREMENT PRIMARY KEY,
      case_ref VARCHAR(50) UNIQUE NOT NULL,
      organization_id INT,
      bank_id INT,
      subject_name VARCHAR(255) NOT NULL,
      subject_type VARCHAR(30) DEFAULT 'individual',
      subject_bvn VARCHAR(11),
      case_type ENUM('suspicious_transaction','pep_match','sanctions_match','structuring','unusual_pattern','high_risk_country','adverse_media','threshold_breach') NOT NULL,
      status ENUM('open','under_investigation','escalated','filed_str','closed_no_action','closed_action_taken') DEFAULT 'open' NOT NULL,
      risk_score INT DEFAULT 0,
      pep_match TINYINT(1) DEFAULT 0,
      sanctions_match TINYINT(1) DEFAULT 0,
      adverse_media_match TINYINT(1) DEFAULT 0,
      transaction_amount BIGINT,
      transaction_currency VARCHAR(3) DEFAULT 'NGN',
      transaction_ref VARCHAR(100),
      source_of_funds TEXT,
      narrative TEXT,
      str_reference VARCHAR(50),
      str_filed_at DATETIME,
      assigned_to VARCHAR(255),
      escalated_to VARCHAR(255),
      closed_at DATETIME,
      closure_notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
      INDEX idx_aml_bank (bank_id),
      INDEX idx_aml_status (status),
      INDEX idx_aml_case_type (case_type)
    )`,
    // Watchlist Entries
    `CREATE TABLE IF NOT EXISTS watchlist_entries (
      id INT AUTO_INCREMENT PRIMARY KEY,
      entity_id VARCHAR(100) UNIQUE NOT NULL,
      entity_type VARCHAR(30) DEFAULT 'individual',
      primary_name VARCHAR(255) NOT NULL,
      aliases JSON,
      date_of_birth VARCHAR(20),
      nationality VARCHAR(100),
      passport_number VARCHAR(50),
      source ENUM('ofac_sdn','un_consolidated','eu_consolidated','uk_hmt','cbn_internal','interpol','efcc','nfiu','local_court') NOT NULL,
      category ENUM('sanctions','pep','adverse_media','terrorism','fraud','corruption','money_laundering') NOT NULL,
      risk_level VARCHAR(20) DEFAULT 'high',
      listing_date DATETIME,
      delisting_date DATETIME,
      is_active TINYINT(1) DEFAULT 1,
      reason TEXT,
      additional_info JSON,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
      INDEX idx_watchlist_name (primary_name),
      INDEX idx_watchlist_source (source),
      INDEX idx_watchlist_active (is_active)
    )`,
    // NIP Transactions
    `CREATE TABLE IF NOT EXISTS nip_transactions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      session_id VARCHAR(40) UNIQUE NOT NULL,
      name_enquiry_ref VARCHAR(40),
      sender_bank_code VARCHAR(10) NOT NULL,
      sender_bank_name VARCHAR(100),
      sender_account_number VARCHAR(20) NOT NULL,
      sender_account_name VARCHAR(255),
      receiver_bank_code VARCHAR(10) NOT NULL,
      receiver_bank_name VARCHAR(100),
      receiver_account_number VARCHAR(20) NOT NULL,
      receiver_account_name VARCHAR(255),
      amount BIGINT NOT NULL,
      currency VARCHAR(3) DEFAULT 'NGN',
      narration VARCHAR(255),
      status ENUM('initiated','processing','completed','failed','reversed','pending_confirmation') DEFAULT 'initiated' NOT NULL,
      response_code VARCHAR(10),
      response_message VARCHAR(255),
      nibss_ref VARCHAR(50),
      channel_code VARCHAR(10),
      aml_flagged TINYINT(1) DEFAULT 0,
      fraud_flagged TINYINT(1) DEFAULT 0,
      settlement_date DATETIME,
      initiated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
      completed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
      INDEX idx_nip_sender_bank (sender_bank_code),
      INDEX idx_nip_receiver_bank (receiver_bank_code),
      INDEX idx_nip_status (status),
      INDEX idx_nip_initiated (initiated_at)
    )`,
    // RTGS Transactions
    `CREATE TABLE IF NOT EXISTS rtgs_transactions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      reference VARCHAR(50) UNIQUE NOT NULL,
      sender_bank_code VARCHAR(10) NOT NULL,
      sender_bank_name VARCHAR(100),
      sender_account_number VARCHAR(20),
      receiver_bank_code VARCHAR(10) NOT NULL,
      receiver_bank_name VARCHAR(100),
      receiver_account_number VARCHAR(20),
      amount BIGINT NOT NULL,
      currency VARCHAR(3) DEFAULT 'NGN',
      narration TEXT,
      status ENUM('queued','processing','settled','rejected','cancelled','pending_funds') DEFAULT 'queued' NOT NULL,
      priority VARCHAR(10) DEFAULT 'normal',
      settlement_cycle VARCHAR(10),
      cbn_ref VARCHAR(50),
      rejection_reason TEXT,
      queued_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
      settled_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
      INDEX idx_rtgs_sender (sender_bank_code),
      INDEX idx_rtgs_status (status),
      INDEX idx_rtgs_queued (queued_at)
    )`,
    // SWIFT Messages
    `CREATE TABLE IF NOT EXISTS swift_messages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      message_ref VARCHAR(50) UNIQUE NOT NULL,
      message_type VARCHAR(10) NOT NULL,
      sender_bic VARCHAR(11) NOT NULL,
      sender_bank_name VARCHAR(100),
      receiver_bic VARCHAR(11) NOT NULL,
      receiver_bank_name VARCHAR(100),
      amount BIGINT,
      currency VARCHAR(3),
      value_date VARCHAR(20),
      ordering_customer VARCHAR(255),
      beneficiary_customer VARCHAR(255),
      remittance_info TEXT,
      correspondent_bic VARCHAR(11),
      status ENUM('draft','sent','acknowledged','processed','rejected','recalled') DEFAULT 'draft' NOT NULL,
      ack_nak_code VARCHAR(10),
      sanctions_screened TINYINT(1) DEFAULT 0,
      sanctions_flagged TINYINT(1) DEFAULT 0,
      raw_message TEXT,
      sent_at DATETIME,
      processed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
      INDEX idx_swift_sender (sender_bic),
      INDEX idx_swift_receiver (receiver_bic),
      INDEX idx_swift_status (status)
    )`,
    // Fraud Alerts
    `CREATE TABLE IF NOT EXISTS fraud_alerts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      alert_ref VARCHAR(50) UNIQUE NOT NULL,
      bank_id INT,
      organization_id INT,
      transaction_ref VARCHAR(100),
      transaction_amount BIGINT,
      account_number VARCHAR(20),
      alert_type ENUM('velocity_breach','unusual_amount','geo_anomaly','device_fingerprint','account_takeover','synthetic_identity','card_not_present','social_engineering','insider_threat','ml_anomaly') NOT NULL,
      risk_score INT DEFAULT 0,
      ml_model VARCHAR(100),
      ml_confidence DECIMAL(5,2),
      rule_triggered VARCHAR(255),
      status ENUM('open','investigating','confirmed_fraud','false_positive','escalated','resolved') DEFAULT 'open' NOT NULL,
      disposition VARCHAR(50),
      investigator_notes TEXT,
      assigned_to VARCHAR(255),
      blocked_at DATETIME,
      resolved_at DATETIME,
      detected_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
      INDEX idx_fraud_bank (bank_id),
      INDEX idx_fraud_status (status),
      INDEX idx_fraud_type (alert_type),
      INDEX idx_fraud_detected (detected_at)
    )`,
    // CBN Reports
    `CREATE TABLE IF NOT EXISTS cbn_reports (
      id INT AUTO_INCREMENT PRIMARY KEY,
      report_ref VARCHAR(50) UNIQUE NOT NULL,
      bank_id INT,
      organization_id INT,
      report_type ENUM('str','ctr','scuml_report','aml_annual','prudential_return','liquidity_return','capital_adequacy','credit_risk','operational_risk') NOT NULL,
      reporting_period VARCHAR(20) NOT NULL,
      status ENUM('draft','pending_review','approved','submitted','acknowledged','rejected','overdue') DEFAULT 'draft' NOT NULL,
      filing_deadline DATETIME,
      submitted_at DATETIME,
      acknowledged_at DATETIME,
      cbn_ack_ref VARCHAR(50),
      xml_payload LONGTEXT,
      pdf_url VARCHAR(500),
      total_transactions INT,
      total_amount BIGINT,
      rejection_reason TEXT,
      prepared_by VARCHAR(255),
      approved_by VARCHAR(255),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
      INDEX idx_cbn_bank (bank_id),
      INDEX idx_cbn_status (status),
      INDEX idx_cbn_type (report_type),
      INDEX idx_cbn_deadline (filing_deadline)
    )`,
    // Correspondent Banks
    `CREATE TABLE IF NOT EXISTS correspondent_banks (
      id INT AUTO_INCREMENT PRIMARY KEY,
      bank_id INT,
      correspondent_name VARCHAR(255) NOT NULL,
      correspondent_bic VARCHAR(11) UNIQUE NOT NULL,
      country VARCHAR(100) NOT NULL,
      currency VARCHAR(3) NOT NULL,
      relationship_type ENUM('nostro','vostro','loro','bilateral') NOT NULL,
      nostro_account VARCHAR(50),
      vostro_account VARCHAR(50),
      status ENUM('active','suspended','terminated','under_review') DEFAULT 'active' NOT NULL,
      daily_limit BIGINT,
      monthly_limit BIGINT,
      kyc_completed TINYINT(1) DEFAULT 0,
      aml_risk_rating VARCHAR(20) DEFAULT 'low',
      last_review_date DATETIME,
      next_review_date DATETIME,
      agreement_url VARCHAR(500),
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
      INDEX idx_corr_bank (bank_id),
      INDEX idx_corr_status (status),
      INDEX idx_corr_country (country)
    )`
  ];

  let created = 0;
  let errors = 0;
  for (const stmt of statements) {
    try {
      await conn.query(stmt);
      created++;
    } catch(e) {
      if (e.message.includes('already exists')) {
        created++;
      } else {
        console.error('Error:', e.message.substring(0, 120));
        errors++;
      }
    }
  }
  
  console.log(`Done. ${created}/${statements.length} tables created/verified. ${errors} errors.`);
  
  // Verify
  const [rows] = await conn.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = DATABASE()
    AND table_name IN ('banking_institutions','kyc_records','aml_cases','watchlist_entries',
      'nip_transactions','rtgs_transactions','swift_messages','fraud_alerts','cbn_reports','correspondent_banks')
    ORDER BY table_name
  `);
  console.log('Banking tables in DB:', rows.map(r => r.table_name || r.TABLE_NAME).join(', '));
  
  conn.release();
  await pool.end();
}

run().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
