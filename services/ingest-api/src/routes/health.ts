/**
 * Health check endpoint
 */

import type { FastifyInstance } from 'fastify';
import { checkDbHealth } from '@signals/db';

export async function healthRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/healthz', async (_request, reply) => {
    const dbHealthy = await checkDbHealth();

    if (!dbHealthy) {
      return reply.status(503).send({
        status: 'unhealthy',
        database: 'disconnected',
      });
    }

    return reply.send({
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  });
}
