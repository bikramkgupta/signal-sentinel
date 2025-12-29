/**
 * Fastify Server Configuration
 */

import Fastify, { FastifyInstance } from 'fastify';
import { healthRoutes } from './routes/health.js';
import { eventsRoutes } from './routes/events.js';

export async function buildServer(): Promise<FastifyInstance> {
  const server = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
      transport:
        process.env.NODE_ENV === 'development'
          ? {
              target: 'pino-pretty',
              options: {
                translateTime: 'HH:MM:ss Z',
                ignore: 'pid,hostname',
              },
            }
          : undefined,
    },
    // Increase body limit for batch events
    bodyLimit: 1024 * 1024, // 1MB
  });

  // Global error handler
  server.setErrorHandler((error, request, reply) => {
    request.log.error(error);
    reply.status(500).send({
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  });

  // Register routes
  await server.register(healthRoutes);
  await server.register(eventsRoutes, { prefix: '/v1' });

  return server;
}
