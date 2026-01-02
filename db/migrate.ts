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
import { existsSync, readdirSync } from 'fs';

async function runMigrations() {
  console.log('=== Migration Runner Starting ===');
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('Working directory:', process.cwd());

  // Prefer DATABASE_PRIVATE_URL (VPC) over DATABASE_URL (public) for trusted sources
  const connectionString = process.env.DATABASE_PRIVATE_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('ERROR: DATABASE_URL environment variable is required');
    console.error('Available env vars:', Object.keys(process.env).filter(k => k.includes('DATABASE') || k.includes('DB')).join(', '));
    process.exit(1);
  }

  console.log('Using connection:', connectionString.replace(/:[^:@]+@/, ':****@'));

  // Check migrations folder
  const migrationsFolder = process.env.MIGRATIONS_FOLDER || './db/migrations';
  console.log('Migrations folder:', migrationsFolder);

  if (!existsSync(migrationsFolder)) {
    console.error('ERROR: Migrations folder does not exist:', migrationsFolder);
    console.log('Directory contents of /app:', existsSync('/app') ? readdirSync('/app').join(', ') : 'N/A');
    console.log('Directory contents of /app/db:', existsSync('/app/db') ? readdirSync('/app/db').join(', ') : 'N/A');
    process.exit(1);
  }

  const migrationFiles = readdirSync(migrationsFolder);
  console.log('Migration files found:', migrationFiles.join(', '));

  console.log('Connecting to database...');

  // DigitalOcean managed databases use self-signed certificates
  // We need to strip sslmode from URL and configure ssl separately
  const urlWithoutSslMode = connectionString.replace(/[?&]sslmode=\w+/g, '').replace(/\?$/, '');
  console.log('Connection (cleaned):', urlWithoutSslMode.replace(/:[^:@]+@/, ':****@'));

  const pool = new Pool({
    connectionString: urlWithoutSslMode,
    ssl: {
      rejectUnauthorized: false, // Accept DigitalOcean's self-signed certificate
    },
    connectionTimeoutMillis: 10000,
  });

  // Test connection first
  try {
    const client = await pool.connect();
    console.log('Database connection successful');
    client.release();
  } catch (connErr) {
    console.error('ERROR: Failed to connect to database:', connErr);
    process.exit(1);
  }

  const db = drizzle(pool);

  console.log('Running migrations...');

  try {
    await migrate(db, { migrationsFolder });
    console.log('=== Migrations completed successfully! ===');
  } catch (error) {
    console.error('ERROR: Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();
