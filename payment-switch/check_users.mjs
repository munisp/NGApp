import { drizzle } from 'drizzle-orm/mysql2';
import { users } from './drizzle/schema.ts';

const db = drizzle(process.env.DATABASE_URL);

try {
  const allUsers = await db.select().from(users).limit(5);
  console.log('Users in database:', JSON.stringify(allUsers, null, 2));
  console.log('Total users found:', allUsers.length);
} catch (error) {
  console.error('Error:', error.message);
}

process.exit(0);
