/**
 * Metrics Routes - Dashboard Overview and Trends
 */

import { FastifyInstance } from 'fastify';
import { db } from '@signals/db';
import { sql } from 'drizzle-orm';

export async function metricsRoutes(app: FastifyInstance) {
  /**
   * GET /v1/metrics/overview - Dashboard overview statistics
   */
  app.get('/v1/metrics/overview', async (_request, reply) => {
    try {
      // Get incident counts
      const incidentStats = await db.execute(sql`
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'open') as open,
          COUNT(*) FILTER (WHERE status = 'investigating') as investigating,
          COUNT(*) FILTER (WHERE resolved_at > NOW() - INTERVAL '24 hours') as resolved_last_24h
        FROM incidents
      `);

      // Get error metrics from buckets (last 24h)
      const errorStats = await db.execute(sql`
        SELECT
          COALESCE(SUM(value), 0) as total_last_24h,
          COALESCE(AVG(value), 0) as rate_per_minute
        FROM metrics_buckets
        WHERE metric_name = 'error_count'
          AND bucket_start > NOW() - INTERVAL '24 hours'
      `);

      // Get signup metrics from buckets (last 24h)
      const signupStats = await db.execute(sql`
        SELECT
          COALESCE(SUM(value), 0) as total_last_24h
        FROM metrics_buckets
        WHERE metric_name = 'signup_count'
          AND bucket_start > NOW() - INTERVAL '24 hours'
      `);

      // Calculate hourly signup rate
      const signupHourlyResult = await db.execute(sql`
        SELECT
          COALESCE(SUM(value), 0) / GREATEST(
            EXTRACT(EPOCH FROM (NOW() - MIN(bucket_start))) / 3600.0,
            1
          ) as rate_per_hour
        FROM metrics_buckets
        WHERE metric_name = 'signup_count'
          AND bucket_start > NOW() - INTERVAL '24 hours'
      `);

      // Get AI stats
      const aiStats = await db.execute(sql`
        SELECT
          (SELECT COUNT(*) FROM ai_outputs) as total_summaries,
          (SELECT COUNT(*) FROM ai_jobs WHERE status = 'queued') as pending_jobs
      `);

      const aiSuccessResult = await db.execute(sql`
        SELECT
          COUNT(*) FILTER (WHERE status = 'succeeded') as succeeded,
          COUNT(*) as total
        FROM ai_jobs
      `);

      const incidents = incidentStats.rows[0] as any;
      const errors = errorStats.rows[0] as any;
      const signups = signupStats.rows[0] as any;
      const signupHourly = signupHourlyResult.rows[0] as any;
      const ai = aiStats.rows[0] as any;
      const aiSuccess = aiSuccessResult.rows[0] as any;

      const successRate = Number(aiSuccess.total) > 0
        ? (Number(aiSuccess.succeeded) / Number(aiSuccess.total)) * 100
        : 100;

      return {
        incidents: {
          total: Number(incidents.total || 0),
          open: Number(incidents.open || 0),
          investigating: Number(incidents.investigating || 0),
          resolved_last_24h: Number(incidents.resolved_last_24h || 0),
        },
        errors: {
          total_last_24h: Number(errors.total_last_24h || 0),
          rate_per_minute: Math.round(Number(errors.rate_per_minute || 0) * 100) / 100,
        },
        signups: {
          total_last_24h: Number(signups.total_last_24h || 0),
          rate_per_hour: Math.round(Number(signupHourly.rate_per_hour || 0) * 100) / 100,
        },
        ai: {
          total_summaries: Number(ai.total_summaries || 0),
          success_rate: Math.round(successRate * 10) / 10,
          pending_jobs: Number(ai.pending_jobs || 0),
        },
      };
    } catch (err) {
      console.error('Failed to fetch metrics overview:', err);
      return reply.status(500).send({ error: 'Failed to fetch metrics overview' });
    }
  });

  /**
   * GET /v1/metrics/trends - Time-series data for charts
   */
  app.get('/v1/metrics/trends', async (request, reply) => {
    try {
      const { metric = 'errors', period = '24h' } = request.query as {
        metric?: 'errors' | 'signups';
        period?: '1h' | '24h' | '7d';
      };

      // Map metric name to database metric_name
      const metricName = metric === 'errors' ? 'error_count' : 'signup_count';

      // Build different queries based on period (SQL INTERVAL needs literal strings)
      let result;
      let summaryResult;

      if (period === '1h') {
        result = await db.execute(sql`
          SELECT
            date_trunc('minute', bucket_start) as timestamp,
            SUM(value) as value
          FROM metrics_buckets
          WHERE metric_name = ${metricName}
            AND bucket_start > NOW() - INTERVAL '1 hour'
          GROUP BY date_trunc('minute', bucket_start)
          ORDER BY timestamp ASC
        `);

        summaryResult = await db.execute(sql`
          SELECT
            COALESCE(SUM(value), 0) as total,
            COALESCE(AVG(value), 0) as average,
            COALESCE(MAX(value), 0) as max,
            COALESCE(MIN(value), 0) as min
          FROM (
            SELECT
              date_trunc('minute', bucket_start) as timestamp,
              SUM(value) as value
            FROM metrics_buckets
            WHERE metric_name = ${metricName}
              AND bucket_start > NOW() - INTERVAL '1 hour'
            GROUP BY date_trunc('minute', bucket_start)
          ) as grouped_data
        `);
      } else if (period === '7d') {
        result = await db.execute(sql`
          SELECT
            date_trunc('hour', bucket_start) as timestamp,
            SUM(value) as value
          FROM metrics_buckets
          WHERE metric_name = ${metricName}
            AND bucket_start > NOW() - INTERVAL '7 days'
          GROUP BY date_trunc('hour', bucket_start)
          ORDER BY timestamp ASC
        `);

        summaryResult = await db.execute(sql`
          SELECT
            COALESCE(SUM(value), 0) as total,
            COALESCE(AVG(value), 0) as average,
            COALESCE(MAX(value), 0) as max,
            COALESCE(MIN(value), 0) as min
          FROM (
            SELECT
              date_trunc('hour', bucket_start) as timestamp,
              SUM(value) as value
            FROM metrics_buckets
            WHERE metric_name = ${metricName}
              AND bucket_start > NOW() - INTERVAL '7 days'
            GROUP BY date_trunc('hour', bucket_start)
          ) as grouped_data
        `);
      } else {
        // Default: 24h
        result = await db.execute(sql`
          SELECT
            date_trunc('hour', bucket_start) as timestamp,
            SUM(value) as value
          FROM metrics_buckets
          WHERE metric_name = ${metricName}
            AND bucket_start > NOW() - INTERVAL '24 hours'
          GROUP BY date_trunc('hour', bucket_start)
          ORDER BY timestamp ASC
        `);

        summaryResult = await db.execute(sql`
          SELECT
            COALESCE(SUM(value), 0) as total,
            COALESCE(AVG(value), 0) as average,
            COALESCE(MAX(value), 0) as max,
            COALESCE(MIN(value), 0) as min
          FROM (
            SELECT
              date_trunc('hour', bucket_start) as timestamp,
              SUM(value) as value
            FROM metrics_buckets
            WHERE metric_name = ${metricName}
              AND bucket_start > NOW() - INTERVAL '24 hours'
            GROUP BY date_trunc('hour', bucket_start)
          ) as grouped_data
        `);
      }

      const summary = summaryResult.rows[0] as any;

      return {
        metric,
        period,
        data: (result.rows as any[]).map(r => ({
          timestamp: r.timestamp,
          value: Number(r.value || 0),
        })),
        summary: {
          total: Number(summary.total || 0),
          average: Math.round(Number(summary.average || 0) * 100) / 100,
          max: Number(summary.max || 0),
          min: Number(summary.min || 0),
        },
      };
    } catch (err) {
      console.error('Failed to fetch metrics trends:', err);
      return reply.status(500).send({ error: 'Failed to fetch metrics trends' });
    }
  });
}
