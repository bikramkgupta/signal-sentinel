/**
 * Core API Server Setup
 */

import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { healthRoutes } from './routes/health.js';
import { incidentsRoutes } from './routes/incidents.js';
import { searchRoutes } from './routes/search.js';
import { aiRoutes } from './routes/ai.js';

export async function buildServer(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
    },
  });

  // Enable CORS for dashboard access
  await app.register(cors, {
    origin: true, // Allow all origins in development
  });

  // Register routes
  await app.register(healthRoutes);
  await app.register(incidentsRoutes);
  await app.register(searchRoutes);
  await app.register(aiRoutes);

  return app;
}
