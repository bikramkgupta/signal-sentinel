/**
 * Configuration for Traffic Generator
 * All settings are configurable via environment variables
 */

export interface TrafficGenConfig {
  /** URL of ingest-api (use PRIVATE_URL in production) */
  ingestApiUrl: string;

  /** API key for authentication */
  apiKey: string;

  /** Enable/disable traffic generation */
  enabled: boolean;

  /** Base interval between events in milliseconds */
  eventIntervalMs: number;

  /** Interval between error events in milliseconds */
  errorIntervalMs: number;

  /** Environment to tag events with */
  environment: 'prod' | 'staging' | 'dev';
}

export function loadConfig(): TrafficGenConfig {
  // Prefer PRIVATE_URL (VPC), fall back to public URL, then localhost
  const ingestApiUrl =
    process.env.INGEST_API_PRIVATE_URL ||
    process.env.INGEST_API_URL ||
    'http://localhost:3000';

  return {
    ingestApiUrl,
    apiKey: process.env.API_KEY || 'dev-api-key-12345',
    enabled: process.env.TRAFFIC_GEN_ENABLED !== 'false', // Default: enabled
    eventIntervalMs: parseInt(process.env.EVENT_INTERVAL_MS || '6000', 10), // ~10/min
    errorIntervalMs: parseInt(process.env.ERROR_INTERVAL_MS || '420000', 10), // ~7 min
    environment: (process.env.EVENT_ENVIRONMENT || 'prod') as
      | 'prod'
      | 'staging'
      | 'dev',
  };
}
