/**
 * Event ingestion endpoints
 *
 * POST /v1/events - Single event
 * POST /v1/events/batch - Batch events (max 100)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  safeValidateRawEvent,
  BatchEventsSchema,
  canonicalize,
  canonicalizeMany,
  type RawEventInput,
} from '@signals/shared-types';
import { validateApiKey } from '../lib/auth.js';
import { publishEvent, publishEvents } from '../lib/kafka.js';

/**
 * Pre-handler hook for API key authentication
 */
async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const apiKey = request.headers['x-api-key'] as string | undefined;
  const authResult = await validateApiKey(apiKey);

  if (!authResult.valid) {
    reply.status(401).send({ error: authResult.error });
    return;
  }

  // Attach context to request for use in handlers
  request.authContext = authResult.context!;
}

// Extend FastifyRequest to include authContext
declare module 'fastify' {
  interface FastifyRequest {
    authContext?: {
      org_id: string;
      project_id: string;
    };
  }
}

export async function eventsRoutes(fastify: FastifyInstance): Promise<void> {
  // Add authentication hook to all routes in this plugin
  fastify.addHook('preHandler', authenticate);

  /**
   * POST /v1/events - Ingest a single event
   */
  fastify.post('/events', async (request, reply) => {
    const validationResult = safeValidateRawEvent(request.body);

    if (!validationResult.success) {
      return reply.status(400).send({
        error: 'Invalid event format',
        details: validationResult.error.errors,
      });
    }

    const rawEvent = validationResult.data as RawEventInput;
    const event = canonicalize(rawEvent, request.authContext!);

    try {
      await publishEvent(event);

      return reply.status(202).send({
        accepted: true,
        event_id: event.event_id,
        received_at: event.received_at,
      });
    } catch (error) {
      request.log.error(error, 'Failed to publish event to Kafka');
      return reply.status(500).send({
        error: 'Failed to process event',
      });
    }
  });

  /**
   * POST /v1/events/batch - Ingest multiple events
   */
  fastify.post('/events/batch', async (request, reply) => {
    const batchResult = BatchEventsSchema.safeParse(request.body);

    if (!batchResult.success) {
      return reply.status(400).send({
        error: 'Invalid batch format',
        details: batchResult.error.errors,
      });
    }

    const rawEvents = batchResult.data.events as RawEventInput[];
    const events = canonicalizeMany(rawEvents, request.authContext!);

    try {
      await publishEvents(events);

      return reply.status(202).send({
        accepted: true,
        count: events.length,
        event_ids: events.map((e) => e.event_id),
        received_at: events[0].received_at,
      });
    } catch (error) {
      request.log.error(error, 'Failed to publish batch to Kafka');
      return reply.status(500).send({
        error: 'Failed to process events',
      });
    }
  });
}
