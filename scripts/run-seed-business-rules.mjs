import mysql from 'mysql2/promise';
import { readFileSync } from 'fs';

const conn = await mysql.createConnection({
  uri: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  multipleStatements: false,
});

const sql = readFileSync(new URL('./seed-business-rules.sql', import.meta.url), 'utf8');
const stmts = sql.split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('/*'));

let ok = 0, errors = 0;
for (const stmt of stmts) {
  try {
    const [r] = await conn.execute(stmt);
    if (r.affectedRows !== undefined) {
      console.log(`OK [${r.affectedRows} rows]: ${stmt.substring(0, 70).replace(/\n/g, ' ')}`);
      ok++;
    } else if (Array.isArray(r) && r.length > 0) {
      console.log('Result:', JSON.stringify(r[0]));
      ok++;
    }
  } catch(e) {
    console.log(`ERR: ${stmt.substring(0, 70).replace(/\n/g, ' ')} -> ${e.message}`);
    errors++;
  }
}
console.log(`\nDone. OK: ${ok}, Errors: ${errors}`);
await conn.end();
