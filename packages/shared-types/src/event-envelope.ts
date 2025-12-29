/**
 * Event Envelope - Core type definitions for the Customer Signals Copilot
 *
 * This is the canonical event format used across all services.
 * Topic: signals.raw.v1
 */

export type Environment = 'prod' | 'staging' | 'dev';

export type EventType =
  | 'error'
  | 'http_request'
  | 'signup'
  | 'deploy'
  | 'feedback'
  | 'custom';

export type Severity = 'debug' | 'info' | 'warn' | 'error' | 'critical';

export type IncidentStatus = 'open' | 'investigating' | 'resolved';

export interface EventAttributes {
  route?: string;
  method?: string;
  status_code?: number;
  error_code?: string;
  release?: string;
  [key: string]: unknown;
}

/**
 * The canonical Event Envelope format.
 * All events flowing through the system must conform to this shape.
 */
export interface EventEnvelope {
  schema_version: '1.0';
  event_id: string;
  occurred_at: string;      // RFC3339
  received_at: string;      // RFC3339
  org_id: string;
  project_id: string;
  environment: Environment;
  event_type: EventType;
  severity: Severity;
  message: string;
  attributes: EventAttributes;
  payload: Record<string, unknown>;
}

/**
 * Raw event input from external sources.
 * Some fields are optional and will be filled with defaults by canonicalize().
 */
export interface RawEventInput {
  event_type: EventType;
  occurred_at: string;
  message: string;
  org_id?: string;
  project_id?: string;
  environment?: Environment;
  severity?: Severity;
  event_id?: string;
  attributes?: EventAttributes;
  payload?: Record<string, unknown>;
}

/**
 * AI Summary output format from Gradient AI
 */
export interface AISummary {
  title: string;
  impact: string;
  likely_causes: string[];
  evidence: string[];
  next_steps: string[];
  confidence: number;
}

/**
 * Kafka topic names
 */
export const TOPICS = {
  RAW_EVENTS: 'signals.raw.v1',
  AI_JOBS: 'signals.ai.jobs.v1',
  DLQ: 'signals.dlq.v1',
} as const;

/**
 * Metric names for bucket aggregation
 */
export const METRICS = {
  ERROR_COUNT: 'error_count',
  SIGNUP_COUNT: 'signup_count',
} as const;
