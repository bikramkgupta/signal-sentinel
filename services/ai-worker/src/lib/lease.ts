/**
 * Job Lease Manager
 *
 * Implements atomic job acquisition with 2-minute lease.
 * Uses optimistic locking to prevent double-processing.
 */

import { db, aiJobs, AiJob } from '@signals/db';
import { eq, and, sql, or, isNull, lte } from 'drizzle-orm';

const LEASE_DURATION_MS = 2 * 60 * 1000; // 2 minutes

/**
 * Acquire a lease on a pending job.
 * Returns the job if acquired, null if no jobs available.
 *
 * Uses atomic UPDATE with conditions to prevent race conditions.
 */
export async function acquireJob(): Promise<AiJob | null> {
  const now = new Date();

  // Find and lock a job atomically
  // Eligible jobs are:
  // 1. status = 'queued' AND run_after <= now AND (leased_until IS NULL OR leased_until < now)
  // 2. status = 'running' AND leased_until < now (crashed/timed-out jobs)
  // 3. attempt_count < max_attempts
  const result = await db
    .update(aiJobs)
    .set({
      status: 'running',
      leased_until: new Date(now.getTime() + LEASE_DURATION_MS),
      attempt_count: sql`${aiJobs.attempt_count} + 1`,
      updated_at: now,
    })
    .where(
      and(
        or(
          // Queued jobs ready to run
          and(
            eq(aiJobs.status, 'queued'),
            lte(aiJobs.run_after, now),
            or(isNull(aiJobs.leased_until), lte(aiJobs.leased_until, now))
          ),
          // Running jobs with expired leases (crashed workers)
          and(
            eq(aiJobs.status, 'running'),
            lte(aiJobs.leased_until, now)
          )
        ),
        sql`${aiJobs.attempt_count} < ${aiJobs.max_attempts}`
      )
    )
    .returning();

  if (result.length === 0) {
    return null;
  }

  const job = result[0];
  console.log(`Acquired job: ${job.id} (attempt ${job.attempt_count}/${job.max_attempts})`);
  return job;
}

/**
 * Mark a job as succeeded.
 */
export async function completeJob(jobId: string): Promise<void> {
  await db
    .update(aiJobs)
    .set({
      status: 'succeeded',
      leased_until: null,
      updated_at: new Date(),
    })
    .where(eq(aiJobs.id, jobId));

  console.log(`Job completed: ${jobId}`);
}

/**
 * Mark a job as failed.
 * If retries remain, schedules for retry with exponential backoff.
 * Otherwise, marks as permanently failed.
 */
export async function failJob(
  jobId: string,
  error: string,
  attemptCount: number,
  maxAttempts: number
): Promise<void> {
  const now = new Date();

  if (attemptCount >= maxAttempts) {
    // Permanently failed
    await db
      .update(aiJobs)
      .set({
        status: 'failed',
        last_error: error,
        leased_until: null,
        updated_at: now,
      })
      .where(eq(aiJobs.id, jobId));

    console.log(`Job permanently failed: ${jobId} - ${error}`);
  } else {
    // Schedule retry with exponential backoff
    // Base: 5s, Cap: 120s
    const backoffMs = Math.min(5000 * Math.pow(2, attemptCount - 1), 120000);
    const runAfter = new Date(now.getTime() + backoffMs);

    await db
      .update(aiJobs)
      .set({
        status: 'queued',
        last_error: error,
        leased_until: null,
        run_after: runAfter,
        updated_at: now,
      })
      .where(eq(aiJobs.id, jobId));

    console.log(`Job scheduled for retry: ${jobId} in ${backoffMs}ms`);
  }
}

/**
 * Renew a job's lease (extend timeout).
 */
export async function renewLease(jobId: string): Promise<void> {
  const now = new Date();

  await db
    .update(aiJobs)
    .set({
      leased_until: new Date(now.getTime() + LEASE_DURATION_MS),
      updated_at: now,
    })
    .where(eq(aiJobs.id, jobId));
}
