/**
 * Kafka client configuration with TLS support
 *
 * Supports both local development (PLAINTEXT) and production (SASL_SSL).
 * CA certificates can be provided as PEM strings or file paths.
 */

import { Kafka, KafkaConfig, SASLOptions } from 'kafkajs';
import * as fs from 'fs';

export type SecurityProtocol = 'PLAINTEXT' | 'SASL_SSL' | 'SSL';

export interface KafkaEnvConfig {
  brokers: string;
  securityProtocol: SecurityProtocol;
  saslUsername?: string;
  saslPassword?: string;
  caCert?: string;
}

/**
 * Load Kafka configuration from environment variables
 *
 * Supports both old and new env var names for compatibility:
 * - KAFKA_USERNAME / KAFKA_SASL_USERNAME
 * - KAFKA_PASSWORD / KAFKA_SASL_PASSWORD
 *
 * Prefers KAFKA_PRIVATE_BROKERS (VPC) over KAFKA_BROKERS (public).
 * Auto-detects SASL_SSL if username/password are provided.
 */
export function loadKafkaEnvConfig(): KafkaEnvConfig {
  // Support both KAFKA_USERNAME and KAFKA_SASL_USERNAME
  const username = process.env.KAFKA_USERNAME ?? process.env.KAFKA_SASL_USERNAME;
  const password = process.env.KAFKA_PASSWORD ?? process.env.KAFKA_SASL_PASSWORD;

  // Auto-detect security protocol: if credentials are provided, use SASL_SSL
  const explicitProtocol = process.env.KAFKA_SECURITY_PROTOCOL as SecurityProtocol | undefined;
  const securityProtocol = explicitProtocol ?? (username && password ? 'SASL_SSL' : 'PLAINTEXT');

  return {
    // Prefer KAFKA_PRIVATE_BROKERS (VPC) over KAFKA_BROKERS (public)
    brokers: process.env.KAFKA_PRIVATE_BROKERS || process.env.KAFKA_BROKERS || 'localhost:9092',
    securityProtocol,
    saslUsername: username,
    saslPassword: password,
    caCert: process.env.KAFKA_CA_CERT,
  };
}

/**
 * Process CA certificate - handles both PEM strings and file paths.
 * If provided as a PEM string, writes to a temp file and returns the content.
 */
function processCACert(caCert: string | undefined): string | undefined {
  if (!caCert) return undefined;

  // Check if it's a PEM string (starts with -----BEGIN)
  if (caCert.includes('-----BEGIN')) {
    return caCert;
  }

  // Otherwise, treat as a file path and read it
  try {
    return fs.readFileSync(caCert, 'utf-8');
  } catch {
    console.warn(`Failed to read CA cert file: ${caCert}`);
    return undefined;
  }
}

/**
 * Create a configured Kafka client.
 *
 * Environment variables:
 * - KAFKA_BROKERS: Comma-separated broker list (default: localhost:9092)
 * - KAFKA_SECURITY_PROTOCOL: PLAINTEXT|SASL_SSL|SSL (default: PLAINTEXT)
 * - KAFKA_SASL_USERNAME: SASL username (required for SASL_SSL)
 * - KAFKA_SASL_PASSWORD: SASL password (required for SASL_SSL)
 * - KAFKA_CA_CERT: CA certificate (PEM string or file path)
 */
export function createKafkaClient(clientId: string): Kafka {
  const envConfig = loadKafkaEnvConfig();
  const brokers = envConfig.brokers.split(',').map((b) => b.trim());

  const config: KafkaConfig = {
    clientId,
    brokers,
    retry: {
      initialRetryTime: 100,
      retries: 8,
    },
  };

  // Configure SSL if not PLAINTEXT
  if (envConfig.securityProtocol !== 'PLAINTEXT') {
    const ca = processCACert(envConfig.caCert);
    config.ssl = ca ? { ca } : true;
  }

  // Configure SASL for SASL_SSL
  if (envConfig.securityProtocol === 'SASL_SSL') {
    if (!envConfig.saslUsername || !envConfig.saslPassword) {
      throw new Error('KAFKA_USERNAME and KAFKA_PASSWORD required for SASL_SSL');
    }

    // DigitalOcean Managed Kafka uses SCRAM-SHA-256
    const sasl: SASLOptions = {
      mechanism: 'scram-sha-256',
      username: envConfig.saslUsername,
      password: envConfig.saslPassword,
    };
    config.sasl = sasl;
  }

  return new Kafka(config);
}

/**
 * Consumer group IDs for each service
 */
export const CONSUMER_GROUPS = {
  INCIDENT_ENGINE: 'incident-engine-group',
  INDEXER: 'indexer-group',
  AI_WORKER: 'ai-worker-group',
} as const;
