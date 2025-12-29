/**
 * Incident Engine Service - Entry Point
 *
 * Consumes events from Kafka, updates metrics buckets, evaluates detection rules,
 * manages incident lifecycle, and enqueues AI jobs for new incidents.
 */

import { closeDb } from '@signals/db';
import { startConsumer, stopConsumer } from './lib/consumer.js';
import { initProducer, closeProducer } from './lib/ai-jobs.js';
import { startAutoResolveTicker, stopAutoResolveTicker } from './lib/auto-resolve.js';

let isShuttingDown = false;

async function main(): Promise<void> {
  console.log('Starting incident engine service...');

  // Initialize AI jobs producer
  await initProducer();

  // Start Kafka consumer
  await startConsumer();

  // Start auto-resolve ticker
  startAutoResolveTicker();

  console.log('Incident engine service started');

  // Graceful shutdown handler
  const shutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.log(`\nReceived ${signal}, shutting down gracefully...`);

    try {
      // Stop auto-resolve ticker
      stopAutoResolveTicker();

      // Stop consumer first
      await stopConsumer();

      // Close producer
      await closeProducer();

      // Close database connection
      await closeDb();

      console.log('Incident engine service stopped');
      process.exit(0);
    } catch (err) {
      console.error('Error during shutdown:', err);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
