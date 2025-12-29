/**
 * Kafka partition key generation
 *
 * Keys ensure related events are processed by the same consumer partition,
 * which is important for maintaining order and efficient state management.
 */

import type { EventEnvelope } from './event-envelope.js';

/**
 * Generate a Kafka partition key for an event.
 *
 * Rules from spec:
 * - Errors: org|project|error_code|route
 * - Else: org|project|event_type
 *
 * This ensures:
 * - Events for the same error type + route go to the same partition
 * - Other event types are partitioned by org/project/type
 */
export function kafkaKey(event: EventEnvelope): string {
  if (event.event_type === 'error') {
    const errorCode = (event.attributes.error_code as string) ?? 'unknown';
    const route = (event.attributes.route as string) ?? 'unknown';
    return `${event.org_id}|${event.project_id}|${errorCode}|${route}`;
  }

  return `${event.org_id}|${event.project_id}|${event.event_type}`;
}

/**
 * Generate a Kafka key for AI job notifications.
 * Uses incident fingerprint to ensure related jobs go to same partition.
 */
export function aiJobKafkaKey(incidentId: string): string {
  return incidentId;
}
