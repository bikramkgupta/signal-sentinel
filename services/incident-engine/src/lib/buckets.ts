/**
 * Bucket Upsert Service
 *
 * Manages metrics_buckets for 1-minute aggregation.
 * Uses atomic upsert with increment for event counting.
 */

import { db, metricsBuckets } from '@signals/db';
import { sql, and, eq, gte, lt } from 'drizzle-orm';
import {
  EventEnvelope,
  fingerprint,
  getMetricName,
  alignToMinuteBucket,
} from '@signals/shared-types';

const BUCKET_SECONDS = 60; // 1-minute buckets

/**
 * Upsert a bucket with atomic increment.
 * Creates the bucket if it doesn't exist, otherwise increments the value.
 */
export async function upsertBucket(event: EventEnvelope): Promise<void> {
  const metricName = getMetricName(event);
  if (!metricName) {
    // Event type not tracked in buckets
    return;
  }

  const fp = fingerprint(event);
  const bucketStart = alignToMinuteBucket(event.occurred_at);

  // Use ON CONFLICT for atomic upsert with increment
  await db
    .insert(metricsBuckets)
    .values({
      org_id: event.org_id,
      project_id: event.project_id,
      environment: event.environment,
      metric_name: metricName,
      fingerprint: fp,
      bucket_start: bucketStart,
      bucket_seconds: BUCKET_SECONDS,
      value: 1,
    })
    .onConflictDoUpdate({
      target: [
        metricsBuckets.project_id,
        metricsBuckets.environment,
        metricsBuckets.metric_name,
        metricsBuckets.fingerprint,
        metricsBuckets.bucket_start,
        metricsBuckets.bucket_seconds,
      ],
      set: {
        value: sql`${metricsBuckets.value} + 1`,
        updated_at: sql`NOW()`,
      },
    });
}

/**
 * Get the sum of bucket values over a time range.
 */
export async function getBucketSum(params: {
  projectId: string;
  environment: string;
  metricName: string;
  fingerprint: string;
  startTime: Date;
  endTime: Date;
}): Promise<number> {
  const result = await db
    .select({
      total: sql<number>`COALESCE(SUM(${metricsBuckets.value}), 0)`,
    })
    .from(metricsBuckets)
    .where(
      and(
        eq(metricsBuckets.project_id, params.projectId),
        eq(metricsBuckets.environment, params.environment),
        eq(metricsBuckets.metric_name, params.metricName),
        eq(metricsBuckets.fingerprint, params.fingerprint),
        gte(metricsBuckets.bucket_start, params.startTime),
        lt(metricsBuckets.bucket_start, params.endTime)
      )
    );

  return Number(result[0]?.total ?? 0);
}

/**
 * Get count for the last N minutes.
 */
export async function getCountLastNMinutes(params: {
  projectId: string;
  environment: string;
  metricName: string;
  fingerprint: string;
  minutes: number;
  referenceTime?: Date;
}): Promise<number> {
  const now = params.referenceTime ?? new Date();
  const startTime = new Date(now.getTime() - params.minutes * 60 * 1000);

  return getBucketSum({
    projectId: params.projectId,
    environment: params.environment,
    metricName: params.metricName,
    fingerprint: params.fingerprint,
    startTime,
    endTime: now,
  });
}

/**
 * Get baseline average count per 5 minutes over the last N minutes.
 * Excludes the most recent window to avoid counting current spike.
 */
export async function getBaselineAverage(params: {
  projectId: string;
  environment: string;
  metricName: string;
  fingerprint: string;
  baselineMinutes: number;
  windowMinutes: number;
  referenceTime?: Date;
}): Promise<number> {
  const now = params.referenceTime ?? new Date();
  // Start baseline from windowMinutes ago to exclude current window
  const endTime = new Date(now.getTime() - params.windowMinutes * 60 * 1000);
  const startTime = new Date(endTime.getTime() - params.baselineMinutes * 60 * 1000);

  const total = await getBucketSum({
    projectId: params.projectId,
    environment: params.environment,
    metricName: params.metricName,
    fingerprint: params.fingerprint,
    startTime,
    endTime,
  });

  // Calculate average per window
  const numWindows = params.baselineMinutes / params.windowMinutes;
  return numWindows > 0 ? total / numWindows : 0;
}
