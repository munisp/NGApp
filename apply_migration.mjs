import { drizzle } from 'drizzle-orm/mysql2';
import { readFileSync } from 'fs';

const db = drizzle(process.env.DATABASE_URL);

try {
  const sql = readFileSync('./drizzle/0035_clean_bishop.sql', 'utf-8');
  
  // Split by semicolon and execute each statement
  const statements = sql.split(';').filter(s => s.trim().length > 0);
  
  for (const statement of statements) {
    console.log('Executing:', statement.substring(0, 100) + '...');
    await db.execute(statement);
  }
  
  console.log('✅ Migration applied successfully');
} catch (error) {
  console.error('❌ Migration failed:', error.message);
  process.exit(1);
}

process.exit(0);
