/**
 * Core API Service - Entry Point
 *
 * Provides REST API for incidents and event search.
 */

import { closeDb } from '@signals/db';
import { buildServer } from './server.js';
import { closeSearchClient } from './routes/search.js';

const PORT = parseInt(process.env.CORE_API_PORT ?? '3001', 10);
const HOST = process.env.CORE_API_HOST ?? '0.0.0.0';

async function main(): Promise<void> {
  console.log('Starting core-api service...');

  const server = await buildServer();

  // Graceful shutdown handler
  const shutdown = async (signal: string) => {
    console.log(`\nReceived ${signal}, shutting down gracefully...`);

    try {
      await server.close();
      await closeSearchClient();
      await closeDb();

      console.log('Core API service stopped');
      process.exit(0);
    } catch (err) {
      console.error('Error during shutdown:', err);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Start server
  await server.listen({ port: PORT, host: HOST });
  console.log(`Core API listening on http://${HOST}:${PORT}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
