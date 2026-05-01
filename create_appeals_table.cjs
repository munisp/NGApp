// TiDB/MySQL version — uses mysql2 driver
const mysql = require('mysql2/promise');
const rawUrl = process.env.DATABASE_URL;
if (!rawUrl) { console.log('No DATABASE_URL'); process.exit(1); }

// Parse mysql://user:pass@host:port/db?ssl=...
const url = new URL(rawUrl);
const conn = mysql.createPool({
  host: url.hostname,
  port: parseInt(url.port) || 4000,
  user: url.username,
  password: url.password,
  database: url.pathname.replace('/', ''),
  ssl: { rejectUnauthorized: true },
});

async function run() {
  try {
    // TiDB doesn't support CREATE TYPE ENUM — use VARCHAR instead
    await conn.query(`
      CREATE TABLE IF NOT EXISTS penalty_appeals (
        id INT AUTO_INCREMENT PRIMARY KEY,
        penalty_id INT NOT NULL,
        organization_id INT NOT NULL,
        submitted_by VARCHAR(256) NOT NULL,
        contact_email VARCHAR(256) NOT NULL,
        grounds_for_appeal TEXT NOT NULL,
        evidence_summary TEXT,
        evidence_urls JSON,
        requested_outcome VARCHAR(64) DEFAULT 'reduction',
        status VARCHAR(32) DEFAULT 'submitted',
        reviewed_by INT,
        review_notes TEXT,
        reviewed_at DATETIME,
        temporal_workflow_id VARCHAR(256),
        escrow_transfer_id VARCHAR(128),
        created_at DATETIME DEFAULT NOW() NOT NULL,
        updated_at DATETIME DEFAULT NOW() ON UPDATE NOW() NOT NULL
      )
    `);
    console.log('penalty_appeals table created successfully on TiDB');
  } catch(e) {
    console.error('Error:', e.message);
  } finally {
    await conn.end();
  }
}
run();
