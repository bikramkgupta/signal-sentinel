/**
 * Health Check Route
 */

import { FastifyInstance } from 'fastify';
import { checkDbHealth } from '@signals/db';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/healthz', async (_request, reply) => {
    const dbHealthy = await checkDbHealth();

    if (!dbHealthy) {
      return reply.status(503).send({
        status: 'unhealthy',
        database: 'down',
      });
    }

    return reply.send({
      status: 'healthy',
      database: 'up',
    });
  });
}
