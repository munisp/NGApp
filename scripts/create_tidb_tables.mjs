import mysql from 'mysql2/promise';

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) { console.error('No DATABASE_URL'); process.exit(1); }

// Parse mysql URL
const url = new URL(DB_URL.replace('mysql://', 'http://'));
const sslParam = url.searchParams.get('ssl');
const sslConfig = sslParam ? JSON.parse(decodeURIComponent(sslParam)) : { rejectUnauthorized: true };

const conn = await mysql.createConnection({
  host: url.hostname,
  port: parseInt(url.port) || 4000,
  user: url.username,
  password: url.password,
  database: url.pathname.slice(1),
  ssl: sslConfig,
});

console.log('Connected to TiDB!');

const statements = [
  `CREATE TABLE IF NOT EXISTS document_vault (
    id INT AUTO_INCREMENT PRIMARY KEY, document_id VARCHAR(255) NOT NULL UNIQUE, organization_id INT,
    document_type VARCHAR(100) NOT NULL DEFAULT 'general', file_name VARCHAR(500) NOT NULL DEFAULT 'unknown',
    file_size BIGINT DEFAULT 0, mime_type VARCHAR(200) DEFAULT 'application/octet-stream',
    storage_key TEXT NOT NULL, description TEXT DEFAULT NULL,
    expiry_date DATETIME, uploaded_by INT, uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP, status VARCHAR(50) DEFAULT 'active'
  )`,
  `CREATE TABLE IF NOT EXISTS api_keys (
    id INT AUTO_INCREMENT PRIMARY KEY, key_id VARCHAR(255) NOT NULL UNIQUE, key_hash VARCHAR(255) NOT NULL DEFAULT '',
    name VARCHAR(255) NOT NULL DEFAULT 'API Key', organization_id INT,
    scopes TEXT DEFAULT '["read"]', expires_at DATETIME, last_used_at DATETIME,
    revoked_at DATETIME, created_by INT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) DEFAULT 'active', request_count INT DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS webhook_endpoints (
    id INT AUTO_INCREMENT PRIMARY KEY, endpoint_id VARCHAR(255) NOT NULL UNIQUE, organization_id INT,
    url TEXT NOT NULL, events TEXT DEFAULT '[]', secret VARCHAR(500) NOT NULL DEFAULT '',
    description TEXT DEFAULT NULL, created_by INT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_delivered_at DATETIME, status VARCHAR(50) DEFAULT 'active',
    delivery_count INT DEFAULT 0, failure_count INT DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS cross_sector_data_shares (
    id INT AUTO_INCREMENT PRIMARY KEY, share_id VARCHAR(255) NOT NULL UNIQUE, organization_id INT,
    source_sector VARCHAR(100) NOT NULL DEFAULT 'banking', target_sector VARCHAR(100) NOT NULL DEFAULT 'telecom',
    data_type VARCHAR(100) NOT NULL DEFAULT 'compliance', justification TEXT DEFAULT NULL,
    data_elements TEXT DEFAULT '[]', requested_by INT, requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    reviewed_at DATETIME, review_notes TEXT DEFAULT NULL, shared_at DATETIME, status VARCHAR(50) DEFAULT 'pending'
  )`,
  `CREATE TABLE IF NOT EXISTS compliance_certificates (
    id INT AUTO_INCREMENT PRIMARY KEY, cert_number VARCHAR(255) NOT NULL UNIQUE, organization_id INT,
    cert_type VARCHAR(100) DEFAULT 'ndpa_compliance', issued_by INT, issued_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME, status VARCHAR(50) DEFAULT 'active', notes TEXT DEFAULT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS compliance_score_history (
    id INT AUTO_INCREMENT PRIMARY KEY, organization_id INT,
    score DECIMAL(5,2) NOT NULL DEFAULT 0, scored_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    scored_by VARCHAR(100) DEFAULT 'system', notes TEXT DEFAULT NULL
  )`,
  `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS risk_score DECIMAL(5,3) DEFAULT 0`,
  `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS risk_level VARCHAR(50) DEFAULT 'low'`,
  `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS risk_scored_at DATETIME`,
  `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS registration_number VARCHAR(255)`,
];

for (const stmt of statements) {
  try {
    await conn.execute(stmt);
    process.stdout.write('.');
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME' || e.message.includes('Duplicate column')) {
      process.stdout.write('s'); // skip existing
    } else {
      console.error('\nError:', e.message.substring(0, 120));
    }
  }
}

// Seed new tables with realistic data
const [orgs] = await conn.execute('SELECT id, name, sector FROM organizations LIMIT 20');
const orgList = orgs;

// Seed compliance_certificates
for (const org of orgList.slice(0, 10)) {
  const certNum = `NDSEP-NDPA-${Date.now()}-${org.id}`;
  const expires = new Date(Date.now() + 365*86400000).toISOString().slice(0,19).replace('T',' ');
  try {
    await conn.execute(`INSERT IGNORE INTO compliance_certificates (cert_number, organization_id, cert_type, issued_at, expires_at, status) VALUES (?, ?, 'ndpa_compliance', NOW(), ?, 'active')`, [certNum, org.id, expires]);
  } catch(e) {}
}

// Seed document_vault
const docTypes = ['ropa', 'dpia', 'privacy_policy', 'consent_form', 'audit_report', 'training_record'];
for (const org of orgList.slice(0, 15)) {
  const docType = docTypes[org.id % docTypes.length];
  const docId = `DOC-${Date.now()}-${org.id}`;
  try {
    await conn.execute(`INSERT IGNORE INTO document_vault (document_id, organization_id, document_type, file_name, file_size, mime_type, storage_key, status) VALUES (?, ?, ?, ?, ?, 'application/pdf', ?, 'active')`,
      [docId, org.id, docType, `${docType}_${org.id}.pdf`, Math.floor(Math.random()*500000+50000), `vault/${org.id}/${docId}.pdf`]);
  } catch(e) {}
}

// Seed api_keys
for (const org of orgList.slice(0, 8)) {
  const keyId = `kid_${Math.random().toString(36).slice(2)}`;
  try {
    await conn.execute(`INSERT IGNORE INTO api_keys (key_id, key_hash, name, organization_id, scopes, expires_at, status, request_count) VALUES (?, ?, ?, ?, '["read","write"]', DATE_ADD(NOW(), INTERVAL 365 DAY), 'active', ?)`,
      [keyId, `hash_${keyId}`, `${org.name} API Key`, org.id, Math.floor(Math.random()*10000)]);
  } catch(e) {}
}

// Seed cross_sector_data_shares
const sectors = ['banking','telecom','healthcare','energy','insurance','fintech'];
for (let i = 0; i < 12; i++) {
  const shareId = `XSD-${Date.now()}-${i}`;
  const src = sectors[i % sectors.length];
  const tgt = sectors[(i+2) % sectors.length];
  const statuses = ['pending','approved','rejected','pending','approved'];
  try {
    await conn.execute(`INSERT IGNORE INTO cross_sector_data_shares (share_id, organization_id, source_sector, target_sector, data_type, justification, data_elements, requested_by, status) VALUES (?, ?, ?, ?, 'compliance_data', 'Regulatory cross-sector verification per NDPA Section 52', '["org_id","compliance_score","breach_count"]', 1, ?)`,
      [shareId, orgList[i % orgList.length].id, src, tgt, statuses[i % statuses.length]]);
  } catch(e) {}
}

// Seed compliance_score_history
for (const org of orgList) {
  for (let d = 0; d < 6; d++) {
    const score = (50 + Math.random()*50).toFixed(2);
    try {
      await conn.execute(`INSERT INTO compliance_score_history (organization_id, score, scored_at, scored_by) VALUES (?, ?, DATE_SUB(NOW(), INTERVAL ? MONTH), 'system')`,
        [org.id, score, d]);
    } catch(e) {}
  }
}

console.log('\nAll done!');
const [tables] = await conn.execute("SELECT COUNT(*) as cnt FROM information_schema.tables WHERE table_schema = DATABASE()");
console.log('Total tables:', tables[0].cnt);
await conn.end();
