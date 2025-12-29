/**
 * @signals/shared-types
 *
 * Shared type definitions, validators, and utilities for the Customer Signals Copilot.
 * This package is used by all services in the monorepo.
 */

// Core types
export type {
  Environment,
  EventType,
  Severity,
  IncidentStatus,
  EventAttributes,
  EventEnvelope,
  RawEventInput,
  AISummary,
} from './event-envelope.js';

export { TOPICS, METRICS } from './event-envelope.js';

// Validation
export {
  EnvironmentSchema,
  EventTypeSchema,
  SeveritySchema,
  EventAttributesSchema,
  EventEnvelopeSchema,
  RawEventInputSchema,
  AISummarySchema,
  BatchEventsSchema,
  validateRawEvent,
  validateEventEnvelope,
  safeValidateRawEvent,
  safeValidateEventEnvelope,
} from './validator.js';

// Canonicalization
export type { CanonicalizationContext } from './canonicalize.js';
export { canonicalize, canonicalizeMany } from './canonicalize.js';

// Fingerprinting
export {
  fingerprint,
  getMetricName,
  alignToMinuteBucket,
} from './fingerprint.js';

// Kafka utilities
export { kafkaKey, aiJobKafkaKey } from './kafka-key.js';

export type { KafkaEnvConfig, SecurityProtocol } from './kafka-config.js';
export {
  createKafkaClient,
  loadKafkaEnvConfig,
  CONSUMER_GROUPS,
} from './kafka-config.js';

// OpenSearch utilities
export type { OpenSearchEnvConfig } from './opensearch-config.js';
export {
  createOpenSearchClient,
  loadOpenSearchEnvConfig,
  ensureIndex,
  OPENSEARCH_INDEX,
  SIGNALS_EVENTS_MAPPING,
} from './opensearch-config.js';
