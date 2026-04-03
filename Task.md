Build Prompt: Sentinel (Spec v3, AI-buildable)

Goal

Build an MVP that ingests synthetic events, computes rolling baselines efficiently, detects incidents, indexes/searches events, and generates AI incident summaries with retries.

Hard requirements
	•	Producers are separate tools, not part of the app.
	•	Local parity via Docker Compose (Kafka, Postgres, OpenSearch, MinIO optional).
	•	Production parity for DO managed services: TLS with CA certs via env vars.
	•	No “query the world per event.” Baselines must be explicit state.

⸻

Services
	1.	ingest-api (HTTP)

	•	Validates API key, normalizes to Event Envelope, publishes to Kafka.
	•	Endpoints:
	•	POST /v1/events (single)
	•	POST /v1/events/batch
	•	GET /healthz

	2.	incident-engine (Kafka consumer)

	•	Consumes events, updates stats buckets via incremental upserts, opens/updates incidents.
	•	Enqueues AI summary work into Postgres ai_jobs and also publishes job id to Kafka.

	3.	indexer (Kafka consumer)

	•	Consumes events, indexes into OpenSearch signals-events-v1.

	4.	ai-worker (job runner)

	•	Consumes job notifications (Kafka) AND pulls leasable jobs from Postgres.
	•	Calls Gradient AI, stores output, retries with backoff, marks failed after 3.

	5.	core-api (HTTP)

	•	Incidents list/detail from Postgres.
	•	Event search proxied to OpenSearch.
	•	Endpoints:
	•	GET /v1/incidents?project_id&env&status
	•	GET /v1/incidents/{id}
	•	GET /v1/search/events?q=&filters=

	6.	event-producer-loadgen (tool)

	•	Generates scenarios and sends to ingest-api.

	7.	event-producer-replay (tool)

	•	Replays NDJSON fixtures to ingest-api.

⸻

Shared contract (must be a shared library)

Create packages/shared-types imported by all services.

Event Envelope (JSON, canonical)

Topic: signals.raw.v1

{
  "schema_version": "1.0",
  "event_id": "uuid",
  "occurred_at": "RFC3339",
  "received_at": "RFC3339",
  "org_id": "org_123",
  "project_id": "proj_123",
  "environment": "prod|staging|dev",
  "event_type": "error|http_request|signup|deploy|feedback|custom",
  "severity": "debug|info|warn|error|critical",
  "message": "string",
  "attributes": {
    "route": "/checkout",
    "method": "POST",
    "status_code": 503,
    "error_code": "UPSTREAM_TIMEOUT",
    "release": "2025.12.27.1"
  },
  "payload": {}
}

Canonical rules (shared-types must enforce)
	•	Require: event_type, occurred_at, message.
	•	Default: environment=dev, severity=info.
	•	Generate event_id if missing.
	•	received_at set by ingest-api only.
	•	Provide deterministic fingerprint() helper for incidents:
	•	for errors: error_code|route|environment
	•	for signups drop: signup|environment

Shared-types deliverables
	•	JSON schema + validator.
	•	Type definitions.
	•	canonicalize(event) to normalize.
	•	Test vectors: known inputs produce identical normalized outputs.

⸻

Kafka topics
	•	signals.raw.v1 (events)
	•	signals.ai.jobs.v1 (job notifications, payload is {"job_id":"uuid"})
	•	signals.dlq.v1 (failures)

Kafka key:
	•	Errors: org|project|error_code|route
	•	Else: org|project|event_type

⸻

Postgres schema (exact tables)

Tenancy and keys
	•	orgs(id text pk, name text, created_at timestamptz)
	•	projects(id text pk, org_id text fk, name text, created_at timestamptz)
	•	project_api_keys(id uuid pk, project_id text fk, key_hash text, created_at timestamptz, revoked_at timestamptz null, last_used_at timestamptz null)

Incidents
	•	incidents( id uuid pk, org_id text, project_id text, environment text, fingerprint text, status text,            -- open|investigating|resolved severity text,          -- warn|error|critical title text, opened_at timestamptz, last_seen_at timestamptz, resolved_at timestamptz null )
Unique: (project_id, environment, fingerprint, status != 'resolved') enforced in app logic.
	•	incident_events( id bigserial pk, incident_id uuid fk, event_id uuid, occurred_at timestamptz, event_type text, severity text, attributes_json jsonb )

Stats buckets (explicit baseline state)
	•	metrics_buckets( id bigserial pk, org_id text, project_id text, environment text, metric_name text,            -- error_count, signup_count fingerprint text,            -- for error_count use error fingerprint, for signup_count use 'signup|env' bucket_start timestamptz,    -- aligned to minute bucket_seconds int,          -- 60 for MVP value int, updated_at timestamptz )
Unique index: (project_id, environment, metric_name, fingerprint, bucket_start, bucket_seconds)

Incident-engine must ONLY do incremental upserts into this table, never scanning huge ranges per event.

AI jobs and outputs (retry + leasing)
	•	ai_jobs( id uuid pk, incident_id uuid fk, job_type text,                -- incident_summary status text,                  -- queued|running|succeeded|failed attempt_count int, max_attempts int, run_after timestamptz,        -- next eligible time leased_until timestamptz null, last_error text null, created_at timestamptz, updated_at timestamptz )
	•	ai_outputs( id uuid pk, incident_id uuid fk, output_type text,             -- summary model text, content_json jsonb, created_at timestamptz )

⸻

OpenSearch

Index: signals-events-v1

Mapping requirements:
	•	org_id, project_id, environment, event_type, severity: keyword
	•	occurred_at: date
	•	message: text + keyword subfield
	•	attributes.route, attributes.error_code, attributes.release: keyword
	•	attributes.status_code: integer

Indexer behavior:
	•	Idempotent by event_id (use event_id as document id).

⸻

Incident detection rules (efficient, bucket-based)

Incident-engine logic:

Bucket update

For each event:
	1.	Compute fingerprint (using shared-types).
	2.	Determine metric_name:
	•	error_count if event_type=error
	•	signup_count if event_type=signup
	3.	Align bucket_start to the minute of occurred_at.
	4.	Upsert metrics_buckets value += 1.

Rule A: Error spike (simple MVP)
	•	Evaluate only when event_type=error.
	•	Compute:
	•	count_5m = sum(value) over last 5 minutes buckets for (error_count, fingerprint)
	•	baseline_60m = average of 5-minute sums over previous 60 minutes
	•	Trigger if:
	•	count_5m >= 30 AND count_5m >= 3 * max(1, baseline_60m)
Performance requirement:
	•	The query must only touch at most ~65 buckets (minute buckets), not raw events.

Rule B: Signup drop
	•	Evaluate when event_type=signup OR on a periodic tick (optional).
	•	count_15m = sum last 15 buckets for signup fingerprint
	•	baseline_prev_60m = average 15m window over previous 60m
	•	Trigger if:
	•	count_15m <= 10 AND baseline_prev_60m >= 40

Incident lifecycle
	•	On trigger:
	•	Find open incident by (project_id, environment, fingerprint) else create.
	•	Update last_seen_at.
	•	Insert representative row into incident_events referencing this event.
	•	Enqueue AI job:
	•	Insert ai_jobs(status='queued', attempt_count=0, max_attempts=3, run_after=now())
	•	Publish {"job_id": "<id>"} to signals.ai.jobs.v1 (notification only).
	•	Auto-resolve (periodic worker in incident-engine every 5 minutes):
	•	If now() - last_seen_at > 60 minutes, set status='resolved', set resolved_at.

⸻

AI worker behavior (rate limiting + retries)

Job acquisition (must implement leasing)
	•	Select job:
	•	status='queued' AND run_after <= now() AND (leased_until IS NULL OR leased_until < now())
	•	Atomically set:
	•	status='running', leased_until=now()+2 minutes
	•	If execution finishes:
	•	On success: status='succeeded', leased_until=NULL
	•	On failure:
	•	attempt_count += 1
	•	If attempt_count >= max_attempts: status='failed'
	•	Else status='queued', set run_after = now() + backoff(attempt_count)
Backoff:
	•	exponential with jitter: base=5s, cap=120s, attempts 1..3.

LLM call contract (Gradient OpenAI compatible)
	•	Env: GRADIENT_BASE_URL, GRADIENT_API_KEY, GRADIENT_MODEL
	•	Prompt must request strict JSON output:

{
  "title": "...",
  "impact": "...",
  "likely_causes": ["..."],
  "evidence": ["..."],
  "next_steps": ["..."],
  "confidence": 0.0
}

	•	Store output in ai_outputs(output_type='summary').
	•	Update incident title with returned title if non-empty.

Input assembly:
	•	Fetch incident record.
	•	Fetch last N incident_events for that incident (e.g., 50).
	•	Optional: fetch top matching events from OpenSearch (not required for MVP).

⸻

TLS and managed service parity (mandatory connector knobs)

All services that connect to Kafka, Postgres, OpenSearch must support these env vars:

Postgres
	•	DATABASE_URL
	•	PG_SSLMODE (default disable locally, require in prod)
	•	PG_CA_CERT (path or PEM string)

Kafka
	•	KAFKA_BROKERS
	•	KAFKA_SECURITY_PROTOCOL (PLAINTEXT|SASL_SSL|SSL)
	•	KAFKA_SASL_USERNAME, KAFKA_SASL_PASSWORD
	•	KAFKA_CA_CERT

OpenSearch
	•	OPENSEARCH_URL
	•	OPENSEARCH_USER, OPENSEARCH_PASS
	•	OPENSEARCH_CA_CERT

Instruction: CA cert may be provided as PEM text in env var. Write it to a temp file at runtime if library requires a file path.

⸻

Producers (separate tools)

loadgen
	•	Modes: normal, spike_errors, drop_signups, deploy_then_spike
	•	Sends to INGEST_API_URL with PROJECT_API_KEY.
	•	Options: --rate, --duration, --concurrency, --seed.

replay
	•	Reads NDJSON fixture files from /fixtures/scenarios/*.ndjson
	•	Sends to ingest-api with optional --speed time warp.

Fixtures:
	•	spike_errors.ndjson
	•	drop_signups.ndjson
	•	deploy_then_spike.ndjson

⸻

Acceptance checklist
	1.	Run loadgen spike_errors for 10 minutes.
	2.	Confirm:

	•	OpenSearch has documents for the last 10 minutes.
	•	Postgres has an open incident for that fingerprint.
	•	An AI job exists and completes, output visible via GET /v1/incidents/{id}.

	3.	Kill ai-worker mid-run, restart, confirm lease prevents duplicate completion.
	4.	Force LLM errors, confirm backoff and failed state after 3 attempts.
	5.	Confirm no heavy queries: incident-engine only reads bucket ranges (minutes), not raw events.

⸻

Build order (recommended)
	1.	packages/shared-types
	2.	Postgres migrations
	3.	ingest-api
	4.	indexer
	5.	incident-engine (buckets + rules + job insert + notify)
	6.	ai-worker (leasing + retries + Gradient)
	7.	core-api
	8.	producers + fixtures
	9.	dashboard (Next.js UI)
	10.	traffic-gen (deployed continuous traffic worker)

⸻

Implementation Reference (exact versions and paths)

This section documents the actual implementation choices. Use these exact
versions and patterns when reproducing the build.

Tech stack versions

| Component | Version | Notes |
|-----------|---------|-------|
| Node.js | 20 LTS (node:20-alpine) | All Dockerfiles use this base |
| TypeScript | ^5.3.0 | Strict mode, no `any` |
| Fastify | 4.25 | HTTP services (ingest-api, core-api) |
| Next.js | 14 | Dashboard (apps/dashboard/) |
| React | 18 | With shadcn/ui, Radix, Tailwind |
| Drizzle ORM | latest | Database queries + migrations |
| KafkaJS | latest | All Kafka producers/consumers |
| Vitest | ^1.6.0 | Test framework |
| Zod | latest | Input validation (shared-types) |

DigitalOcean managed service versions (doctl verified 2026-04-02)

| Service | Available Versions | Used in DevContainer | Notes |
|---------|-------------------|---------------------|-------|
| PostgreSQL | 14, 15, 16, 17, 18 | postgres:18 | app.yaml does not pin version |
| Kafka | 3.8 | cp-kafka:7.7.0 (~3.7) | Minor gap, unlikely to cause issues |
| OpenSearch | 1, 2.19 | opensearch:3.0.0 | MISMATCH: DO max is 2.19, devcontainer uses 3.0 |

Monorepo structure

	npm workspaces (NOT pnpm/yarn)
	Root package.json defines workspaces: packages/*, services/*, apps/*, tools/*, db

File layout per service

Each service follows the same pattern:
	services/<name>/
	  ├── src/index.ts        # Entry point
	  ├── package.json        # @signals/<name> namespace
	  ├── tsconfig.json
	  └── Dockerfile          # Multi-stage: base → deps → builder → runner (node:20-alpine)

Dashboard layout:
	apps/dashboard/
	  ├── src/app/            # Next.js App Router pages
	  ├── src/components/     # shadcn/ui components + custom
	  ├── src/lib/            # Utilities (cn(), API helpers)
	  ├── Dockerfile          # Multi-stage with .next/static flattening
	  └── next.config.js      # output: 'standalone'

Database package:
	db/
	  ├── schema.ts           # 8 tables defined with Drizzle ORM
	  ├── migrate.ts          # Migration runner
	  ├── seed.ts             # Seeds org_123, proj_123, dev-api-key-12345
	  ├── drizzle.config.ts
	  ├── migrations/         # Generated SQL migrations
	  └── Dockerfile.migrate  # PRE_DEPLOY job in App Platform

Shared types package:
	packages/shared-types/src/
	  ├── event-envelope.ts   # EventEnvelope, RawEventInput, AISummary types
	  ├── validator.ts        # Zod schema + validation
	  ├── canonicalize.ts     # Normalize raw input → EventEnvelope
	  ├── fingerprint.ts      # fingerprint(), getMetricName(), alignToMinuteBucket()
	  ├── kafka-config.ts     # SASL_SSL/PLAINTEXT config builder, CA cert temp file
	  ├── kafka-key.ts        # Partition key: org|project|error_code|route or org|project|event_type
	  ├── opensearch-config.ts # OpenSearch client config with CA cert support
	  └── index.ts            # Re-exports

Environment variables per service

ingest-api: DATABASE_URL, DATABASE_PRIVATE_URL, KAFKA_BROKERS, KAFKA_PRIVATE_BROKERS,
  KAFKA_USERNAME, KAFKA_PASSWORD, KAFKA_CA_CERT, KAFKA_TOPIC

core-api: DATABASE_URL, DATABASE_PRIVATE_URL, OPENSEARCH_URL, OPENSEARCH_PRIVATE_URL

incident-engine: DATABASE_URL, DATABASE_PRIVATE_URL, KAFKA_BROKERS, KAFKA_PRIVATE_BROKERS,
  KAFKA_USERNAME, KAFKA_PASSWORD, KAFKA_CA_CERT, KAFKA_TOPIC, KAFKA_GROUP_ID,
  KAFKA_AI_JOBS_TOPIC

indexer: KAFKA_BROKERS, KAFKA_PRIVATE_BROKERS, KAFKA_USERNAME, KAFKA_PASSWORD,
  KAFKA_CA_CERT, KAFKA_TOPIC, KAFKA_GROUP_ID, OPENSEARCH_URL, OPENSEARCH_PRIVATE_URL

ai-worker: DATABASE_URL, DATABASE_PRIVATE_URL, KAFKA_BROKERS, KAFKA_PRIVATE_BROKERS,
  KAFKA_USERNAME, KAFKA_PASSWORD, KAFKA_CA_CERT, KAFKA_AI_JOBS_TOPIC, KAFKA_GROUP_ID,
  GRADIENT_BASE_URL, GRADIENT_API_KEY, GRADIENT_MODEL

dashboard: CORE_API_INTERNAL_URL (set to ${core-api.PRIVATE_URL} in app.yaml)

traffic-gen: INGEST_API_PRIVATE_URL, API_KEY, TRAFFIC_GEN_ENABLED, EVENT_INTERVAL_MS,
  ERROR_INTERVAL_MS, EVENT_ENVIRONMENT, BURST_ENABLED, BURST_INTERVAL_MS, BURST_SIZE

Seed data (created by db/seed.ts)

	org_id: org_123, name: "Demo Organization"
	project_id: proj_123, name: "Demo Project"
	API key: dev-api-key-12345 (stored as SHA-256 hash)

Dockerfile pattern (all services)

	FROM node:20-alpine AS base
	FROM base AS deps       # npm ci --omit=dev for production deps
	FROM base AS builder    # npm run build (TypeScript compile)
	FROM base AS runner     # Copy dist + node_modules, USER node, CMD ["node", "dist/index.js"]

App Platform deployment

	CI/CD: GitHub Actions (.github/workflows/deploy.yml)
	  - Uses digitalocean/app_action/deploy@v2
	  - NOT deploy_on_push (can't inject GitHub Secrets into ${VAR} placeholders)
	Spec: .do/app.yaml
	  - 3 HTTP services: ingest-api (:3000), core-api (:3001), dashboard (:3002)
	  - 4 workers: indexer, incident-engine, ai-worker, traffic-gen
	  - 1 PRE_DEPLOY job: db-migrate
	  - 3 managed DBs: db (PG), kafka (KAFKA), search (OPENSEARCH)
	  - Ingress: path-based routing, preserve_path_prefix=true
	  - Region: syd1, VPC-connected

Dashboard design

	Product name: "Sentinel"
	UI: shadcn/ui + Radix, dark mode via next-themes
	Charts: Recharts for time-series
	Pages: Overview (stats, charts), Incidents (list, detail with AI summary),
	  Search (OpenSearch query), Settings
	API routes added to core-api: GET /v1/metrics/overview, GET /v1/metrics/trends
