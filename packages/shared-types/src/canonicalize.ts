/**
 * Event canonicalization - normalizes raw events into the canonical envelope format
 */

import { randomUUID } from 'crypto';
import type { RawEventInput, EventEnvelope } from './event-envelope.js';

/**
 * Context required for canonicalization
 * These values come from the authenticated API key
 */
export interface CanonicalizationContext {
  org_id: string;
  project_id: string;
}

/**
 * Canonicalize a raw event input into a full EventEnvelope.
 *
 * Rules from spec:
 * - Require: event_type, occurred_at, message
 * - Default: environment=dev, severity=info
 * - Generate event_id if missing
 * - received_at set by ingest-api only (here)
 */
export function canonicalize(
  input: RawEventInput,
  context: CanonicalizationContext
): EventEnvelope {
  return {
    schema_version: '1.0',
    event_id: input.event_id ?? randomUUID(),
    occurred_at: input.occurred_at,
    received_at: new Date().toISOString(),
    org_id: context.org_id,
    project_id: context.project_id,
    environment: input.environment ?? 'dev',
    event_type: input.event_type,
    severity: input.severity ?? 'info',
    message: input.message,
    attributes: input.attributes ?? {},
    payload: input.payload ?? {},
  };
}

/**
 * Batch canonicalize multiple events
 */
export function canonicalizeMany(
  inputs: RawEventInput[],
  context: CanonicalizationContext
): EventEnvelope[] {
  return inputs.map((input) => canonicalize(input, context));
}
