/**
 * Migration Runner
 *
 * Run with: npm run migrate --workspace=db
 *
 * This script applies pending migrations to the database.
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

async function runMigrations() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL environment variable is required');
    process.exit(1);
  }

  console.log('Connecting to database...');

  const pool = new Pool({
    connectionString,
    ssl: process.env.PG_SSLMODE === 'disable' ? false : { rejectUnauthorized: false },
  });

  const db = drizzle(pool);

  console.log('Running migrations...');

  try {
    await migrate(db, { migrationsFolder: './migrations' });
    console.log('Migrations completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();
