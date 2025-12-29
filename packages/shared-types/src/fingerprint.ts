/**
 * Fingerprint generation for incident detection
 *
 * Fingerprints are deterministic identifiers used to group related events
 * into incidents. Events with the same fingerprint belong to the same incident.
 */

import type { EventEnvelope } from './event-envelope.js';

/**
 * Generate a deterministic fingerprint for an event.
 *
 * Rules from spec:
 * - For errors: error_code|route|environment
 * - For signups: signup|environment
 * - For other event types: event_type|environment
 */
export function fingerprint(event: EventEnvelope): string {
  if (event.event_type === 'error') {
    const errorCode = (event.attributes.error_code as string) ?? 'unknown';
    const route = (event.attributes.route as string) ?? 'unknown';
    return `${errorCode}|${route}|${event.environment}`;
  }

  if (event.event_type === 'signup') {
    return `signup|${event.environment}`;
  }

  // Default for other event types
  return `${event.event_type}|${event.environment}`;
}

/**
 * Get the metric name for bucket aggregation based on event type.
 *
 * Returns:
 * - 'error_count' for error events
 * - 'signup_count' for signup events
 * - null for other event types (not tracked in buckets)
 */
export function getMetricName(event: EventEnvelope): string | null {
  if (event.event_type === 'error') {
    return 'error_count';
  }

  if (event.event_type === 'signup') {
    return 'signup_count';
  }

  return null;
}

/**
 * Align a timestamp to the start of its minute bucket.
 * This is used for metrics_buckets table to aggregate events by minute.
 */
export function alignToMinuteBucket(timestamp: Date | string): Date {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  return new Date(Math.floor(date.getTime() / 60000) * 60000);
}
