/**
 * Database Connection - Drizzle ORM with TLS support
 *
 * Environment variables:
 * - DATABASE_URL: Postgres connection string
 * - PG_SSLMODE: disable|require|verify-ca|verify-full (default: disable)
 * - PG_CA_CERT: CA certificate (PEM string or file path)
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool, PoolConfig } from 'pg';
import * as fs from 'fs';
import * as schema from './schema.js';

export * from './schema.js';

type SSLMode = 'disable' | 'require' | 'verify-ca' | 'verify-full';

interface PgEnvConfig {
  connectionString: string;
  sslMode: SSLMode;
  caCert?: string;
}

/**
 * Load Postgres configuration from environment variables
 * Uses DATABASE_URL from App Platform binding (VPC-enabled)
 * Falls back to DATABASE_PRIVATE_URL for local dev
 */
function loadPgEnvConfig(): PgEnvConfig {
  const rawConnectionString = process.env.DATABASE_URL || process.env.DATABASE_PRIVATE_URL;
  if (!rawConnectionString) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  // Strip sslmode from connection string - we configure SSL separately
  // This is needed for DigitalOcean managed databases with self-signed certs
  const connectionString = rawConnectionString.replace(/[?&]sslmode=\w+/g, '').replace(/\?$/, '');

  return {
    connectionString,
    // Default to 'require' for production (DigitalOcean requires SSL)
    sslMode: (process.env.PG_SSLMODE ?? 'require') as SSLMode,
    caCert: process.env.PG_CA_CERT,
  };
}

/**
 * Process CA certificate - handles both PEM strings and file paths.
 */
function processCACert(caCert: string | undefined): string | undefined {
  if (!caCert) return undefined;

  // Check if it's a PEM string
  if (caCert.includes('-----BEGIN')) {
    return caCert;
  }

  // Otherwise, treat as a file path
  try {
    return fs.readFileSync(caCert, 'utf-8');
  } catch {
    console.warn(`Failed to read CA cert file: ${caCert}`);
    return undefined;
  }
}

/**
 * Build pool configuration with TLS support
 */
function buildPoolConfig(): PoolConfig {
  const envConfig = loadPgEnvConfig();

  const config: PoolConfig = {
    connectionString: envConfig.connectionString,
    max: 10, // Connection pool size
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  };

  // Configure SSL based on sslMode
  if (envConfig.sslMode !== 'disable') {
    const caCert = processCACert(envConfig.caCert);

    if (caCert) {
      config.ssl = {
        ca: caCert,
        rejectUnauthorized: envConfig.sslMode === 'verify-full' || envConfig.sslMode === 'verify-ca',
      };
    } else {
      // SSL required but no CA cert - accept any certificate
      config.ssl = {
        rejectUnauthorized: false,
      };
    }
  }

  return config;
}

// Create connection pool
const pool = new Pool(buildPoolConfig());

// Create Drizzle instance
export const db = drizzle(pool, { schema });

// Export pool for cleanup
export { pool };

/**
 * Close the database connection pool.
 * Call this when shutting down the application.
 */
export async function closeDb(): Promise<void> {
  await pool.end();
}

/**
 * Health check - verifies database connectivity
 */
export async function checkDbHealth(): Promise<boolean> {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}
