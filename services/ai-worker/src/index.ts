/**
 * AI Worker Service - Entry Point
 *
 * Processes AI jobs by calling Gradient AI and storing summaries.
 * Uses job leasing with exponential backoff retry.
 */

import { closeDb } from '@signals/db';
import { startWorker, stopWorker } from './lib/worker.js';
import { validateGradientConnection } from './lib/gradient.js';

let isShuttingDown = false;

async function main(): Promise<void> {
  console.log('Starting AI worker service...');

  // Validate required environment variables
  const required = ['GRADIENT_BASE_URL', 'GRADIENT_API_KEY', 'GRADIENT_MODEL'];
  for (const envVar of required) {
    if (!process.env[envVar]) {
      throw new Error(`Missing required environment variable: ${envVar}`);
    }
  }

  // Validate Gradient API connection before starting
  // This will fail fast if the API key is invalid
  await validateGradientConnection();

  // Start the worker
  await startWorker();

  console.log('AI worker service started');

  // Graceful shutdown handler
  const shutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.log(`\nReceived ${signal}, shutting down gracefully...`);

    try {
      // Stop worker (waits for current job to complete)
      await stopWorker();

      // Close database connection
      await closeDb();

      console.log('AI worker service stopped');
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
