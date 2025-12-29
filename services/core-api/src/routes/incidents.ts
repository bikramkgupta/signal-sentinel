/**
 * Incidents Routes
 *
 * GET /v1/incidents - List incidents with filters
 * GET /v1/incidents/:id - Get incident detail with AI summary
 */

import { FastifyInstance } from 'fastify';
import { db, incidents, incidentEvents, aiOutputs } from '@signals/db';
import { eq, desc, and, sql } from 'drizzle-orm';

interface ListQuerystring {
  status?: 'open' | 'investigating' | 'resolved';
  project_id?: string;
  environment?: string;
  limit?: number;
  offset?: number;
}

interface IncidentParams {
  id: string;
}

export async function incidentsRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /v1/incidents
   * List incidents with optional filters
   */
  app.get<{ Querystring: ListQuerystring }>(
    '/v1/incidents',
    async (request, reply) => {
      const {
        status,
        project_id,
        environment,
        limit = 50,
        offset = 0,
      } = request.query;

      // Build conditions
      const conditions = [];
      if (status) {
        conditions.push(eq(incidents.status, status));
      }
      if (project_id) {
        conditions.push(eq(incidents.project_id, project_id));
      }
      if (environment) {
        conditions.push(eq(incidents.environment, environment));
      }

      // Query with conditions
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const results = await db
        .select({
          id: incidents.id,
          org_id: incidents.org_id,
          project_id: incidents.project_id,
          environment: incidents.environment,
          fingerprint: incidents.fingerprint,
          status: incidents.status,
          severity: incidents.severity,
          title: incidents.title,
          opened_at: incidents.opened_at,
          last_seen_at: incidents.last_seen_at,
          resolved_at: incidents.resolved_at,
        })
        .from(incidents)
        .where(whereClause)
        .orderBy(desc(incidents.opened_at))
        .limit(Math.min(limit, 100))
        .offset(offset);

      // Get total count
      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(incidents)
        .where(whereClause);

      const total = Number(countResult[0]?.count ?? 0);

      return reply.send({
        incidents: results,
        pagination: {
          total,
          limit: Math.min(limit, 100),
          offset,
          has_more: offset + results.length < total,
        },
      });
    }
  );

  /**
   * GET /v1/incidents/:id
   * Get incident detail with events and AI summary
   */
  app.get<{ Params: IncidentParams }>(
    '/v1/incidents/:id',
    async (request, reply) => {
      const { id } = request.params;

      // Fetch incident
      const incidentResult = await db
        .select()
        .from(incidents)
        .where(eq(incidents.id, id))
        .limit(1);

      if (incidentResult.length === 0) {
        return reply.status(404).send({ error: 'Incident not found' });
      }

      const incident = incidentResult[0];

      // Fetch recent events (limit 100)
      const events = await db
        .select({
          id: incidentEvents.id,
          event_id: incidentEvents.event_id,
          occurred_at: incidentEvents.occurred_at,
          event_type: incidentEvents.event_type,
          severity: incidentEvents.severity,
          attributes: incidentEvents.attributes_json,
        })
        .from(incidentEvents)
        .where(eq(incidentEvents.incident_id, id))
        .orderBy(desc(incidentEvents.occurred_at))
        .limit(100);

      // Fetch AI summary if available
      const summaryResult = await db
        .select({
          id: aiOutputs.id,
          output_type: aiOutputs.output_type,
          model: aiOutputs.model,
          content: aiOutputs.content_json,
          created_at: aiOutputs.created_at,
        })
        .from(aiOutputs)
        .where(eq(aiOutputs.incident_id, id))
        .orderBy(desc(aiOutputs.created_at))
        .limit(1);

      const summary = summaryResult.length > 0 ? summaryResult[0] : null;

      return reply.send({
        incident,
        events,
        ai_summary: summary
          ? {
              ...(summary.content as Record<string, unknown>),
              model: summary.model,
              generated_at: summary.created_at,
            }
          : null,
      });
    }
  );
}
