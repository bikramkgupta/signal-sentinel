/**
 * Zod validation schemas for event envelopes
 */

import { z } from 'zod';

export const EnvironmentSchema = z.enum(['prod', 'staging', 'dev']);

export const EventTypeSchema = z.enum([
  'error',
  'http_request',
  'signup',
  'deploy',
  'feedback',
  'custom',
]);

export const SeveritySchema = z.enum(['debug', 'info', 'warn', 'error', 'critical']);

export const EventAttributesSchema = z.record(z.unknown()).default({});

/**
 * Schema for the canonical Event Envelope
 */
export const EventEnvelopeSchema = z.object({
  schema_version: z.literal('1.0'),
  event_id: z.string().uuid(),
  occurred_at: z.string().datetime({ offset: true }),
  received_at: z.string().datetime({ offset: true }),
  org_id: z.string().min(1),
  project_id: z.string().min(1),
  environment: EnvironmentSchema,
  event_type: EventTypeSchema,
  severity: SeveritySchema,
  message: z.string().min(1),
  attributes: EventAttributesSchema,
  payload: z.record(z.unknown()).default({}),
});

/**
 * Schema for raw event input (before canonicalization)
 */
export const RawEventInputSchema = z.object({
  event_type: EventTypeSchema,
  occurred_at: z.string().datetime({ offset: true }),
  message: z.string().min(1),
  org_id: z.string().optional(),
  project_id: z.string().optional(),
  environment: EnvironmentSchema.optional(),
  severity: SeveritySchema.optional(),
  event_id: z.string().uuid().optional(),
  attributes: z.record(z.unknown()).optional(),
  payload: z.record(z.unknown()).optional(),
});

/**
 * Schema for AI Summary output
 */
export const AISummarySchema = z.object({
  title: z.string(),
  impact: z.string(),
  likely_causes: z.array(z.string()),
  evidence: z.array(z.string()),
  next_steps: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});

/**
 * Schema for batch event submission
 */
export const BatchEventsSchema = z.object({
  events: z.array(RawEventInputSchema).min(1).max(100),
});

/**
 * Validate a raw event input
 */
export function validateRawEvent(input: unknown): z.infer<typeof RawEventInputSchema> {
  return RawEventInputSchema.parse(input);
}

/**
 * Validate a canonical event envelope
 */
export function validateEventEnvelope(input: unknown): z.infer<typeof EventEnvelopeSchema> {
  return EventEnvelopeSchema.parse(input);
}

/**
 * Safe validation that returns a result object instead of throwing
 */
export function safeValidateRawEvent(input: unknown) {
  return RawEventInputSchema.safeParse(input);
}

export function safeValidateEventEnvelope(input: unknown) {
  return EventEnvelopeSchema.safeParse(input);
}
