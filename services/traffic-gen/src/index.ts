/**
 * Traffic Generator Service - Entry Point
 *
 * Generates continuous synthetic traffic for testing and demos.
 * Runs indefinitely, sending events at configurable intervals.
 */

import { loadConfig, type TrafficGenConfig } from './lib/config.js';
import { IngestClient } from './lib/client.js';
import {
  generateNormalEvent,
  generateError,
  generateDeploy,
} from './lib/generator.js';

let isShuttingDown = false;
let eventTimer: ReturnType<typeof setTimeout> | null = null;
let errorTimer: ReturnType<typeof setTimeout> | null = null;
let deployTimer: ReturnType<typeof setTimeout> | null = null;

async function startTrafficGeneration(config: TrafficGenConfig): Promise<void> {
  const client = new IngestClient(config);

  // Verify connectivity before starting
  console.log(`Checking connectivity to ${config.ingestApiUrl}...`);
  const healthy = await client.healthCheck();
  if (!healthy) {
    console.warn(
      'Health check failed, but continuing (ingest-api may start later)'
    );
  } else {
    console.log('Health check passed');
  }

  let eventCount = 0;
  let errorCount = 0;

  // Regular event generation
  const sendNormalEvent = async (): Promise<void> => {
    if (isShuttingDown) return;

    const event = generateNormalEvent();
    const success = await client.sendEvent(event);

    if (success) {
      eventCount++;
      if (eventCount % 100 === 0) {
        console.log(`Sent ${eventCount} events (${errorCount} errors injected)`);
      }
    }

    if (!client.isHealthy()) {
      console.error('Too many consecutive errors, stopping traffic generation');
      shutdown('UNHEALTHY');
      return;
    }

    // Schedule next event with slight jitter
    const jitter = Math.floor(Math.random() * 2000) - 1000; // +/- 1 second
    eventTimer = setTimeout(
      () => void sendNormalEvent(),
      config.eventIntervalMs + jitter
    );
  };

  // Error injection for incident creation
  const sendErrorEvent = async (): Promise<void> => {
    if (isShuttingDown) return;

    const event = generateError();
    await client.sendEvent(event);
    errorCount++;
    console.log(`Injected error event: ${event.attributes.error_code}`);

    // Schedule next error with jitter (5-10 minute range)
    const jitter = Math.floor(Math.random() * 300000); // 0-5 minute jitter
    errorTimer = setTimeout(
      () => void sendErrorEvent(),
      config.errorIntervalMs + jitter
    );
  };

  // Occasional deploy events (every 2-4 hours)
  const sendDeployEvent = async (): Promise<void> => {
    if (isShuttingDown) return;

    const event = generateDeploy();
    await client.sendEvent(event);
    console.log(`Sent deploy event: ${event.attributes.release}`);

    // Schedule next deploy (2-4 hours)
    const interval =
      2 * 60 * 60 * 1000 + Math.floor(Math.random() * 2 * 60 * 60 * 1000);
    deployTimer = setTimeout(() => void sendDeployEvent(), interval);
  };

  console.log('Starting traffic generation...');
  console.log(
    `  Event interval: ${config.eventIntervalMs}ms (~${Math.round(60000 / config.eventIntervalMs)} events/min)`
  );
  console.log(
    `  Error interval: ${config.errorIntervalMs}ms (~${Math.round(60 / (config.errorIntervalMs / 60000))} errors/hour)`
  );

  // Start all generators
  void sendNormalEvent();

  // Delay error injection by 1 minute to establish baseline
  setTimeout(() => {
    if (!isShuttingDown) void sendErrorEvent();
  }, 60000);

  // Delay deploy events by 30 minutes
  setTimeout(() => {
    if (!isShuttingDown) void sendDeployEvent();
  }, 30 * 60 * 1000);
}

function shutdown(signal: string): void {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`\nReceived ${signal}, shutting down gracefully...`);

  // Clear all timers
  if (eventTimer) clearTimeout(eventTimer);
  if (errorTimer) clearTimeout(errorTimer);
  if (deployTimer) clearTimeout(deployTimer);

  console.log('Traffic generator stopped');
  process.exit(signal === 'UNHEALTHY' ? 1 : 0);
}

async function main(): Promise<void> {
  console.log('Starting traffic generator service...');

  const config = loadConfig();

  if (!config.enabled) {
    console.log('Traffic generation is disabled (TRAFFIC_GEN_ENABLED=false)');
    console.log('Keeping process alive for container health...');

    // Keep process alive but do nothing
    setInterval(() => {
      /* noop */
    }, 60000);
    return;
  }

  console.log('Configuration:');
  console.log(`  Ingest API URL: ${config.ingestApiUrl}`);
  console.log(`  Environment: ${config.environment}`);
  console.log(`  API Key: ${config.apiKey.substring(0, 8)}...`);

  await startTrafficGeneration(config);

  // Graceful shutdown handlers
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
