/**
 * AI Routes - Stats, Activity, and Job Queue
 */

import { FastifyInstance } from 'fastify';
import { db } from '@signals/db';
import { sql } from 'drizzle-orm';

export async function aiRoutes(app: FastifyInstance) {
  /**
   * GET /v1/ai/stats - Overall AI statistics
   */
  app.get('/v1/ai/stats', async (_request, reply) => {
    try {
      // Get all stats with raw SQL for simplicity
      const statsResult = await db.execute(sql`
        SELECT
          (SELECT COUNT(*) FROM ai_outputs) as total_summaries,
          (SELECT COUNT(*) FROM ai_outputs WHERE created_at > NOW() - INTERVAL '24 hours') as summaries_last_24h,
          (SELECT AVG(CAST(content_json->>'confidence' AS numeric)) FROM ai_outputs WHERE output_type = 'summary') as avg_confidence
      `);

      const jobsResult = await db.execute(sql`
        SELECT status, COUNT(*) as count FROM ai_jobs GROUP BY status
      `);

      const modelsResult = await db.execute(sql`
        SELECT model, COUNT(*) as count FROM ai_outputs GROUP BY model
      `);

      const stats = statsResult.rows[0] as any;
      const jobsByStatus: Record<string, number> = {};
      for (const row of jobsResult.rows as any[]) {
        jobsByStatus[row.status] = Number(row.count);
      }

      const totalJobs = Object.values(jobsByStatus).reduce<number>((a, b) => a + b, 0);
      const successRate = totalJobs > 0
        ? ((jobsByStatus['succeeded'] || 0) / totalJobs) * 100
        : 0;

      return {
        total_summaries: Number(stats.total_summaries || 0),
        summaries_last_24h: Number(stats.summaries_last_24h || 0),
        success_rate: Math.round(successRate * 10) / 10,
        avg_confidence: stats.avg_confidence
          ? Math.round(Number(stats.avg_confidence) * 100) / 100
          : null,
        jobs_by_status: jobsByStatus,
        models_used: (modelsResult.rows as any[]).map(m => ({
          model: m.model,
          count: Number(m.count),
        })),
      };
    } catch (err) {
      console.error('Failed to fetch AI stats:', err);
      return reply.status(500).send({ error: 'Failed to fetch AI stats' });
    }
  });

  /**
   * GET /v1/ai/activity - Recent AI activity
   */
  app.get('/v1/ai/activity', async (request, reply) => {
    try {
      const { limit = 20 } = request.query as { limit?: number };
      const safeLimit = Math.min(Number(limit) || 20, 100);

      const result = await db.execute(sql`
        SELECT
          ao.id,
          ao.incident_id,
          ao.output_type,
          ao.model,
          ao.content_json,
          ao.created_at,
          i.title as incident_title,
          i.severity as incident_severity
        FROM ai_outputs ao
        LEFT JOIN incidents i ON ao.incident_id = i.id
        ORDER BY ao.created_at DESC
        LIMIT ${safeLimit}
      `);

      return {
        activity: (result.rows as any[]).map(a => ({
          id: a.id,
          incident_id: a.incident_id,
          incident_title: a.incident_title,
          incident_severity: a.incident_severity,
          output_type: a.output_type,
          model: a.model,
          confidence: a.content_json?.confidence,
          title: a.content_json?.title,
          created_at: a.created_at,
        })),
      };
    } catch (err) {
      console.error('Failed to fetch AI activity:', err);
      return reply.status(500).send({ error: 'Failed to fetch AI activity' });
    }
  });

  /**
   * GET /v1/ai/jobs - Pending and recent jobs
   */
  app.get('/v1/ai/jobs', async (request, reply) => {
    try {
      const { status, limit = 20 } = request.query as {
        status?: string;
        limit?: number;
      };
      const safeLimit = Math.min(Number(limit) || 20, 100);

      let query = sql`
        SELECT
          aj.id,
          aj.incident_id,
          aj.job_type,
          aj.status,
          aj.attempt_count,
          aj.max_attempts,
          aj.run_after,
          aj.leased_until,
          aj.last_error,
          aj.created_at,
          aj.updated_at,
          i.title as incident_title
        FROM ai_jobs aj
        LEFT JOIN incidents i ON aj.incident_id = i.id
      `;

      if (status) {
        query = sql`${query} WHERE aj.status = ${status}`;
      }

      query = sql`${query} ORDER BY aj.created_at DESC LIMIT ${safeLimit}`;

      const result = await db.execute(query);

      return {
        jobs: (result.rows as any[]).map(j => ({
          id: j.id,
          incident_id: j.incident_id,
          incident_title: j.incident_title,
          job_type: j.job_type,
          status: j.status,
          attempt_count: j.attempt_count,
          max_attempts: j.max_attempts,
          run_after: j.run_after,
          leased_until: j.leased_until,
          last_error: j.last_error,
          created_at: j.created_at,
          updated_at: j.updated_at,
        })),
      };
    } catch (err) {
      console.error('Failed to fetch AI jobs:', err);
      return reply.status(500).send({ error: 'Failed to fetch AI jobs' });
    }
  });
}
