import mysql from 'mysql2/promise';
const DB_URL = process.env.DATABASE_URL;
const url = new URL(DB_URL.replace('mysql://', 'http://'));
const sslParam = url.searchParams.get('ssl');
const sslConfig = sslParam ? JSON.parse(decodeURIComponent(sslParam)) : { rejectUnauthorized: true };
const conn = await mysql.createConnection({ host: url.hostname, port: parseInt(url.port)||4000, user: url.username, password: url.password, database: url.pathname.slice(1), ssl: sslConfig });
console.log('Connected!');

const stmts = [
  `CREATE TABLE IF NOT EXISTS api_keys (
    id INT AUTO_INCREMENT PRIMARY KEY, key_id VARCHAR(255) NOT NULL UNIQUE, key_hash VARCHAR(255) NOT NULL DEFAULT '',
    name VARCHAR(255) NOT NULL DEFAULT 'API Key', organization_id INT,
    scopes TEXT, expires_at DATETIME, last_used_at DATETIME,
    revoked_at DATETIME, created_by INT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) DEFAULT 'active', request_count INT DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS webhook_endpoints (
    id INT AUTO_INCREMENT PRIMARY KEY, endpoint_id VARCHAR(255) NOT NULL UNIQUE, organization_id INT,
    url TEXT NOT NULL, events TEXT, secret VARCHAR(500) NOT NULL DEFAULT '',
    description TEXT, created_by INT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_delivered_at DATETIME, status VARCHAR(50) DEFAULT 'active',
    delivery_count INT DEFAULT 0, failure_count INT DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS cross_sector_data_shares (
    id INT AUTO_INCREMENT PRIMARY KEY, share_id VARCHAR(255) NOT NULL UNIQUE, organization_id INT,
    source_sector VARCHAR(100) NOT NULL DEFAULT 'banking', target_sector VARCHAR(100) NOT NULL DEFAULT 'telecom',
    data_type VARCHAR(100) NOT NULL DEFAULT 'compliance', justification TEXT,
    data_elements TEXT, requested_by INT, requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    reviewed_at DATETIME, review_notes TEXT, shared_at DATETIME, status VARCHAR(50) DEFAULT 'pending'
  )`,
];

for (const s of stmts) {
  try { await conn.execute(s); process.stdout.write('.'); }
  catch(e) { console.error('\n', e.message.slice(0,100)); }
}

// Seed api_keys
const [orgs] = await conn.execute('SELECT id, name FROM organizations LIMIT 20');
for (const org of orgs.slice(0,8)) {
  const keyId = `kid_${Math.random().toString(36).slice(2,10)}`;
  try {
    await conn.execute(`INSERT IGNORE INTO api_keys (key_id, key_hash, name, organization_id, scopes, expires_at, status, request_count) VALUES (?, ?, ?, ?, '["read","write"]', DATE_ADD(NOW(), INTERVAL 365 DAY), 'active', ?)`,
      [keyId, `hash_${keyId}`, `${org.name} API Key`, org.id, Math.floor(Math.random()*10000)]);
  } catch(e) {}
}

// Seed webhook_endpoints
for (const org of orgs.slice(0,6)) {
  const epId = `whe_${Math.random().toString(36).slice(2,10)}`;
  try {
    await conn.execute(`INSERT IGNORE INTO webhook_endpoints (endpoint_id, organization_id, url, events, secret, description, status, delivery_count) VALUES (?, ?, ?, '["breach.created","penalty.issued"]', ?, 'Primary webhook endpoint', 'active', ?)`,
      [epId, org.id, `https://api.${org.name.toLowerCase().replace(/\s+/g,'-')}.com/ndsep-webhook`, `whsec_${Math.random().toString(36).slice(2,20)}`, Math.floor(Math.random()*500)]);
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
      [shareId, orgs[i % orgs.length].id, src, tgt, statuses[i % statuses.length]]);
  } catch(e) {}
}

console.log('\nFixed!');
const [t] = await conn.execute("SELECT COUNT(*) as cnt FROM information_schema.tables WHERE table_schema = DATABASE()");
console.log('Total tables:', t[0].cnt);
await conn.end();
