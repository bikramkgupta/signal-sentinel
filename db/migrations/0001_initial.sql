-- Customer Signals Copilot - Initial Schema
-- This migration creates all tables required by the application.

-- ============================================================================
-- Tenancy Tables
-- ============================================================================

CREATE TABLE IF NOT EXISTS orgs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL REFERENCES projects(id),
  key_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ
);

-- ============================================================================
-- Incidents Tables
-- ============================================================================

CREATE TABLE IF NOT EXISTS incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  environment TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  status TEXT NOT NULL, -- open|investigating|resolved
  severity TEXT NOT NULL, -- warn|error|critical
  title TEXT NOT NULL,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- Index for finding open incidents by project/environment/fingerprint
CREATE INDEX IF NOT EXISTS idx_incidents_lookup
  ON incidents(project_id, environment, fingerprint, status);

-- Index for auto-resolve queries
CREATE INDEX IF NOT EXISTS idx_incidents_last_seen
  ON incidents(status, last_seen_at);

CREATE TABLE IF NOT EXISTS incident_events (
  id BIGSERIAL PRIMARY KEY,
  incident_id UUID NOT NULL REFERENCES incidents(id),
  event_id UUID NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  attributes_json JSONB
);

CREATE INDEX IF NOT EXISTS idx_incident_events_incident
  ON incident_events(incident_id);

-- ============================================================================
-- Metrics Buckets (Explicit Baseline State)
-- ============================================================================

CREATE TABLE IF NOT EXISTS metrics_buckets (
  id BIGSERIAL PRIMARY KEY,
  org_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  environment TEXT NOT NULL,
  metric_name TEXT NOT NULL, -- error_count, signup_count
  fingerprint TEXT NOT NULL, -- error fingerprint or 'signup|env'
  bucket_start TIMESTAMPTZ NOT NULL,
  bucket_seconds INTEGER NOT NULL, -- 60 for MVP
  value INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique constraint for upsert
CREATE UNIQUE INDEX IF NOT EXISTS unique_bucket
  ON metrics_buckets(project_id, environment, metric_name, fingerprint, bucket_start, bucket_seconds);

-- Index for range queries (baseline calculation)
CREATE INDEX IF NOT EXISTS idx_buckets_range
  ON metrics_buckets(project_id, environment, metric_name, fingerprint, bucket_start);

-- ============================================================================
-- AI Jobs (Retry + Leasing)
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES incidents(id),
  job_type TEXT NOT NULL, -- incident_summary
  status TEXT NOT NULL, -- queued|running|succeeded|failed
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  run_after TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  leased_until TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for job acquisition query
CREATE INDEX IF NOT EXISTS idx_ai_jobs_pending
  ON ai_jobs(status, run_after, leased_until);

CREATE TABLE IF NOT EXISTS ai_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES incidents(id),
  output_type TEXT NOT NULL, -- summary
  model TEXT NOT NULL,
  content_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_outputs_incident
  ON ai_outputs(incident_id);
