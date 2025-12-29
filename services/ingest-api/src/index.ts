/**
 * Ingest API - Entry Point
 *
 * HTTP service that:
 * - Validates API keys
 * - Normalizes events
 * - Publishes to Kafka
 */

import { buildServer } from './server.js';
import { initKafkaProducer, disconnectKafkaProducer } from './lib/kafka.js';
import { closeDb } from '@signals/db';

const PORT = parseInt(process.env.INGEST_API_PORT ?? '3000', 10);
const HOST = process.env.INGEST_API_HOST ?? '0.0.0.0';

async function main(): Promise<void> {
  console.log('Starting ingest-api...');

  // Initialize Kafka producer
  await initKafkaProducer();

  // Build and start server
  const server = await buildServer();

  try {
    await server.listen({ port: PORT, host: HOST });
    console.log(`Ingest API listening on ${HOST}:${PORT}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }

  // Graceful shutdown
  const shutdown = async (signal: string): Promise<void> => {
    console.log(`\nReceived ${signal}, shutting down gracefully...`);

    try {
      await server.close();
      await disconnectKafkaProducer();
      await closeDb();
      console.log('Shutdown complete');
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
  console.error('Failed to start server:', err);
  process.exit(1);
});
