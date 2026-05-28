/**
 * Migration: Add media_urls, report_url, ai_defect_summary columns to drone_inspections
 * Uses pg (postgres) via the DATABASE_URL / POSTGRES_URL env var
 */
import { createRequire } from "module";
const require = createRequire(import.meta.url);

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
if (!connectionString) {
  console.error("No POSTGRES_URL or DATABASE_URL env var found");
  process.exit(1);
}

// Use the pg package that's available via drizzle-orm
const { Client } = require("pg");
const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  await client.query(`
    ALTER TABLE drone_inspections
    ADD COLUMN IF NOT EXISTS media_urls TEXT,
    ADD COLUMN IF NOT EXISTS report_url TEXT,
    ADD COLUMN IF NOT EXISTS ai_defect_summary TEXT;
  `);
  console.log("✅ Added media_urls, report_url, ai_defect_summary to drone_inspections");
} catch (err) {
  console.error("Migration error:", err.message);
} finally {
  await client.end();
}
