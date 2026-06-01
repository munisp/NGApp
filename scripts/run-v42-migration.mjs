import pg from 'pg';
import fs from 'fs';
import crypto from 'crypto';

const pgUrl = process.env.POSTGRES_URL;
if (!pgUrl) {
  console.error('POSTGRES_URL not set');
  process.exit(1);
}

const client = new pg.Client({ connectionString: pgUrl });
await client.connect();

// Check what's already in migrations table
const existing = await client.query('SELECT hash FROM drizzle.__drizzle_migrations');
console.log('Existing migrations in DB:', existing.rows.length);

// Read journal
const journal = JSON.parse(fs.readFileSync('drizzle/meta/_journal.json', 'utf8'));
const entries = journal.entries;
console.log('Total migrations in journal:', entries.length);

// Mark all but last as applied
for (const e of entries.slice(0, -1)) {
  const sqlFile = `drizzle/${e.tag}.sql`;
  if (fs.existsSync(sqlFile)) {
    const content = fs.readFileSync(sqlFile, 'utf8');
    const h = crypto.createHash('sha256').update(content).digest('hex');
    await client.query(
      'INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [h, e.when]
    );
  }
}
console.log('Marked prior migrations as applied');

// Now run the last migration (0020_slow_kronos)
const lastEntry = entries[entries.length - 1];
const lastSql = fs.readFileSync(`drizzle/${lastEntry.tag}.sql`, 'utf8');
const statements = lastSql.split('--> statement-breakpoint').map(s => s.trim()).filter(s => s.length > 0);
console.log(`Running ${statements.length} statements from ${lastEntry.tag}`);

let ok = 0, skipped = 0, errors = 0;
for (let i = 0; i < statements.length; i++) {
  try {
    await client.query(statements[i]);
    ok++;
    process.stdout.write('.');
  } catch(e) {
    if (e.code === '42P07' || e.code === '42710' || e.code === '42701') {
      skipped++;
      process.stdout.write('s');
    } else {
      errors++;
      console.log(`\nError at stmt ${i}: [${e.code}] ${e.message.slice(0,120)}`);
    }
  }
}

// Mark last migration as applied
const lastContent = fs.readFileSync(`drizzle/${lastEntry.tag}.sql`, 'utf8');
const lastHash = crypto.createHash('sha256').update(lastContent).digest('hex');
await client.query(
  'INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2) ON CONFLICT DO NOTHING',
  [lastHash, lastEntry.when]
);

console.log(`\nDone: ${ok} applied, ${skipped} skipped, ${errors} errors`);
await client.end();
