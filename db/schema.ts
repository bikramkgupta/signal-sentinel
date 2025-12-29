/**
 * Database Schema - Drizzle ORM definitions
 *
 * Tables from Task.md specification:
 * 1. orgs - Tenancy
 * 2. projects - Projects per org
 * 3. project_api_keys - API key hashes
 * 4. incidents - Open/resolved incidents
 * 5. incident_events - Events linked to incidents
 * 6. metrics_buckets - 1-minute aggregation (for efficient baseline queries)
 * 7. ai_jobs - Job queue with leasing
 * 8. ai_outputs - AI summaries
 */

import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  bigserial,
  jsonb,
  unique,
  index,
} from 'drizzle-orm/pg-core';

// ============================================================================
// Tenancy Tables
// ============================================================================

export const orgs = pgTable('orgs', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const projects = pgTable('projects', {
  id: text('id').primaryKey(),
  org_id: text('org_id').notNull().references(() => orgs.id),
  name: text('name').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const projectApiKeys = pgTable('project_api_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  project_id: text('project_id').notNull().references(() => projects.id),
  key_hash: text('key_hash').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  revoked_at: timestamp('revoked_at', { withTimezone: true }),
  last_used_at: timestamp('last_used_at', { withTimezone: true }),
});

// ============================================================================
// Incidents Tables
// ============================================================================

export const incidents = pgTable('incidents', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: text('org_id').notNull(),
  project_id: text('project_id').notNull(),
  environment: text('environment').notNull(),
  fingerprint: text('fingerprint').notNull(),
  status: text('status').notNull(), // open|investigating|resolved
  severity: text('severity').notNull(), // warn|error|critical
  title: text('title').notNull(),
  opened_at: timestamp('opened_at', { withTimezone: true }).defaultNow().notNull(),
  last_seen_at: timestamp('last_seen_at', { withTimezone: true }).defaultNow().notNull(),
  resolved_at: timestamp('resolved_at', { withTimezone: true }),
}, (table) => ({
  // Index for finding open incidents by project/environment/fingerprint
  lookupIdx: index('idx_incidents_lookup').on(
    table.project_id,
    table.environment,
    table.fingerprint,
    table.status
  ),
  // Index for auto-resolve queries
  lastSeenIdx: index('idx_incidents_last_seen').on(table.status, table.last_seen_at),
}));

export const incidentEvents = pgTable('incident_events', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  incident_id: uuid('incident_id').notNull().references(() => incidents.id),
  event_id: uuid('event_id').notNull(),
  occurred_at: timestamp('occurred_at', { withTimezone: true }).notNull(),
  event_type: text('event_type').notNull(),
  severity: text('severity').notNull(),
  attributes_json: jsonb('attributes_json'),
}, (table) => ({
  incidentIdx: index('idx_incident_events_incident').on(table.incident_id),
}));

// ============================================================================
// Metrics Buckets (Explicit Baseline State)
// ============================================================================

export const metricsBuckets = pgTable('metrics_buckets', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  org_id: text('org_id').notNull(),
  project_id: text('project_id').notNull(),
  environment: text('environment').notNull(),
  metric_name: text('metric_name').notNull(), // error_count, signup_count
  fingerprint: text('fingerprint').notNull(), // error fingerprint or 'signup|env'
  bucket_start: timestamp('bucket_start', { withTimezone: true }).notNull(),
  bucket_seconds: integer('bucket_seconds').notNull(), // 60 for MVP
  value: integer('value').notNull().default(0),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  // Unique constraint for upsert
  uniqueBucket: unique('unique_bucket').on(
    table.project_id,
    table.environment,
    table.metric_name,
    table.fingerprint,
    table.bucket_start,
    table.bucket_seconds
  ),
  // Index for range queries (baseline calculation)
  rangeIdx: index('idx_buckets_range').on(
    table.project_id,
    table.environment,
    table.metric_name,
    table.fingerprint,
    table.bucket_start
  ),
}));

// ============================================================================
// AI Jobs (Retry + Leasing)
// ============================================================================

export const aiJobs = pgTable('ai_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  incident_id: uuid('incident_id').notNull().references(() => incidents.id),
  job_type: text('job_type').notNull(), // incident_summary
  status: text('status').notNull(), // queued|running|succeeded|failed
  attempt_count: integer('attempt_count').notNull().default(0),
  max_attempts: integer('max_attempts').notNull().default(3),
  run_after: timestamp('run_after', { withTimezone: true }).defaultNow().notNull(),
  leased_until: timestamp('leased_until', { withTimezone: true }),
  last_error: text('last_error'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  // Index for job acquisition query
  pendingIdx: index('idx_ai_jobs_pending').on(
    table.status,
    table.run_after,
    table.leased_until
  ),
}));

export const aiOutputs = pgTable('ai_outputs', {
  id: uuid('id').primaryKey().defaultRandom(),
  incident_id: uuid('incident_id').notNull().references(() => incidents.id),
  output_type: text('output_type').notNull(), // summary
  model: text('model').notNull(),
  content_json: jsonb('content_json').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  incidentIdx: index('idx_ai_outputs_incident').on(table.incident_id),
}));

// ============================================================================
// Type Exports
// ============================================================================

export type Org = typeof orgs.$inferSelect;
export type NewOrg = typeof orgs.$inferInsert;

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;

export type ProjectApiKey = typeof projectApiKeys.$inferSelect;
export type NewProjectApiKey = typeof projectApiKeys.$inferInsert;

export type Incident = typeof incidents.$inferSelect;
export type NewIncident = typeof incidents.$inferInsert;

export type IncidentEvent = typeof incidentEvents.$inferSelect;
export type NewIncidentEvent = typeof incidentEvents.$inferInsert;

export type MetricsBucket = typeof metricsBuckets.$inferSelect;
export type NewMetricsBucket = typeof metricsBuckets.$inferInsert;

export type AiJob = typeof aiJobs.$inferSelect;
export type NewAiJob = typeof aiJobs.$inferInsert;

export type AiOutput = typeof aiOutputs.$inferSelect;
export type NewAiOutput = typeof aiOutputs.$inferInsert;
