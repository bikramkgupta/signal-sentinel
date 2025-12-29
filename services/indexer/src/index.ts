/**
 * Indexer Service - Entry Point
 *
 * Consumes events from Kafka (signals.raw.v1) and indexes them to OpenSearch.
 * Uses bulk indexing with idempotent writes (doc ID = event_id).
 */

import { startConsumer, stopConsumer } from './lib/consumer.js';
import { createBulkIndexer, initializeIndex } from './lib/opensearch.js';

let isShuttingDown = false;

async function main(): Promise<void> {
  console.log('Starting indexer service...');

  // Initialize OpenSearch index mapping
  console.log('Ensuring OpenSearch index exists...');
  await initializeIndex();

  // Create bulk indexer
  const bulkIndexer = createBulkIndexer({
    batchSize: 100,
    flushIntervalMs: 5000,
  });

  // Start Kafka consumer
  await startConsumer({ bulkIndexer });

  console.log('Indexer service started');

  // Graceful shutdown handler
  const shutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.log(`\nReceived ${signal}, shutting down gracefully...`);

    try {
      // Stop consumer first to prevent new messages
      await stopConsumer();

      // Flush and close the bulk indexer
      await bulkIndexer.close();

      console.log('Indexer service stopped');
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
