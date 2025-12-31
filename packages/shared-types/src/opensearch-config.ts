/**
 * OpenSearch client configuration with TLS support
 *
 * Supports both local development (HTTP) and production (HTTPS with auth).
 * CA certificates can be provided as PEM strings or file paths.
 */

import { Client, ClientOptions } from '@opensearch-project/opensearch';
import * as fs from 'fs';

export const OPENSEARCH_INDEX = 'signals-events-v1';

export interface OpenSearchEnvConfig {
  url: string;
  username?: string;
  password?: string;
  caCert?: string;
}

/**
 * Load OpenSearch configuration from environment variables
 * Prefers OPENSEARCH_PRIVATE_URL (VPC) over OPENSEARCH_URL (public)
 */
export function loadOpenSearchEnvConfig(): OpenSearchEnvConfig {
  return {
    // Prefer OPENSEARCH_PRIVATE_URL (VPC) over OPENSEARCH_URL (public)
    url: process.env.OPENSEARCH_PRIVATE_URL || process.env.OPENSEARCH_URL || 'http://localhost:9200',
    username: process.env.OPENSEARCH_USER,
    password: process.env.OPENSEARCH_PASS,
    caCert: process.env.OPENSEARCH_CA_CERT,
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
 * Create a configured OpenSearch client.
 *
 * Environment variables:
 * - OPENSEARCH_URL: OpenSearch endpoint (default: http://localhost:9200)
 * - OPENSEARCH_USER: Username for auth
 * - OPENSEARCH_PASS: Password for auth
 * - OPENSEARCH_CA_CERT: CA certificate (PEM string or file path)
 */
export function createOpenSearchClient(): Client {
  const envConfig = loadOpenSearchEnvConfig();

  const options: ClientOptions = {
    node: envConfig.url,
  };

  // Configure auth if credentials provided
  if (envConfig.username && envConfig.password) {
    options.auth = {
      username: envConfig.username,
      password: envConfig.password,
    };
  }

  // Configure SSL if CA cert provided
  const ca = processCACert(envConfig.caCert);
  if (ca) {
    options.ssl = { ca };
  }

  return new Client(options);
}

/**
 * OpenSearch index mapping for signals-events-v1
 */
export const SIGNALS_EVENTS_MAPPING = {
  mappings: {
    properties: {
      event_id: { type: 'keyword' },
      org_id: { type: 'keyword' },
      project_id: { type: 'keyword' },
      environment: { type: 'keyword' },
      event_type: { type: 'keyword' },
      severity: { type: 'keyword' },
      occurred_at: { type: 'date' },
      received_at: { type: 'date' },
      message: {
        type: 'text',
        fields: {
          keyword: { type: 'keyword', ignore_above: 256 },
        },
      },
      attributes: {
        properties: {
          route: { type: 'keyword' },
          error_code: { type: 'keyword' },
          release: { type: 'keyword' },
          status_code: { type: 'integer' },
          method: { type: 'keyword' },
        },
      },
      fingerprint: { type: 'keyword' },
    },
  },
};

/**
 * Ensure the signals-events-v1 index exists with proper mapping.
 * Idempotent - safe to call multiple times.
 */
export async function ensureIndex(client: Client): Promise<void> {
  const indexExists = await client.indices.exists({ index: OPENSEARCH_INDEX });

  if (!indexExists.body) {
    await client.indices.create({
      index: OPENSEARCH_INDEX,
      body: SIGNALS_EVENTS_MAPPING,
    });
    console.log(`Created OpenSearch index: ${OPENSEARCH_INDEX}`);
  }
}
