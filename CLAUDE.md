# Project: Sentinel

Detect incidents from customer signals in real time, with AI-generated
summaries and root-cause analysis. TypeScript/Node.js monorepo on
DigitalOcean App Platform.

## Commands

```bash
# Development (npm workspaces monorepo)
npm run dev:ingest      # Ingest API — port 3000
npm run dev:core        # Core API — port 3001
npm run dev:dashboard   # Next.js dashboard — port 3002
npm run dev:engine      # Incident engine (Kafka consumer)
npm run dev:indexer     # OpenSearch indexer (Kafka consumer)
npm run dev:ai-worker   # AI job processor

# Quality — run before committing
npm run build           # TypeScript build (all workspaces)
npm run lint            # ESLint (all workspaces)
npm test                # Vitest (all workspaces)

# Database (Drizzle ORM)
npm run db:generate     # Generate migrations from schema
npm run db:migrate      # Apply migrations
npm run db:seed         # Seed dev data (org, project, API key)

# Traffic tools
npm run loadgen -- --mode spike_errors --duration 600
npm run replay -- --file fixtures/scenarios/spike_errors.ndjson
```

## Architecture

```
services/
  ingest-api/          # HTTP → validates API key → publishes to Kafka
  core-api/            # REST API for incidents, search, metrics
  incident-engine/     # Kafka consumer → bucket upserts → incident detection
  indexer/             # Kafka consumer → OpenSearch indexing
  ai-worker/           # Leases ai_jobs from PG → calls Gradient AI
  traffic-gen/         # Continuous synthetic traffic (deployed as worker)
apps/dashboard/        # Next.js 14, shadcn/ui, Recharts
packages/
  shared-types/        # Zod schemas, EventEnvelope, fingerprint(), canonicalize()
db/                    # Drizzle schema (schema.ts), migrations, seed, Dockerfile.migrate
tools/                 # loadgen, replay CLI tools
fixtures/scenarios/    # spike_errors.ndjson, drop_signups.ndjson
.do/app.yaml           # App Platform spec (3 services, 4 workers, 1 job, 3 DBs)
```

## Code Patterns

- **Bind to `$PORT`**: `process.env.PORT || 3000`. App Platform injects PORT.
- **DB connection**: `process.env.DATABASE_PRIVATE_URL || process.env.DATABASE_URL` (VPC first).
- **Named exports only**. TypeScript strict, no `any`. Zod for validation. Drizzle for queries.
- **Kafka**: KafkaJS with SASL_SSL in prod, PLAINTEXT locally. CA cert from env var written to temp file at runtime.
- **Fingerprinting**: errors = `error_code|route|env`, signups = `signup|env`, others = `event_type|env`.
- **Metrics buckets**: 1-minute pre-aggregated counts. Incident rules query only bucket rows (max ~65), never raw events.

## Incident Detection Rules

- **Error spike** (Rule A): `count_5m >= 30 AND count_5m >= 3 * baseline_60m`
- **Signup drop** (Rule B): `count_15m <= 10 AND baseline_prev_60m >= 40`
- On trigger: find/create incident by `(project_id, env, fingerprint)`, enqueue ai_job, publish to `signals.ai.jobs.v1`.
- Auto-resolve: periodic check every 5 min, resolve if `last_seen_at > 60 min ago`.

## AI Worker

- Leases jobs: `status='queued' AND run_after <= now() AND leased_until < now()`.
- Sets `leased_until = now() + 2min` atomically.
- On success: stores AI output in `ai_outputs`, updates incident title.
- On failure: exponential backoff (base 5s, cap 120s), max 3 attempts.
- LLM: Gradient AI (OpenAI-compatible), model `llama3.3-70b-instruct`.

## Critical Gotchas

- **Metrics: pre-aggregated only**. Never `SELECT COUNT(*) FROM events`. Use `metrics_buckets` table.
- **OpenSearch version mismatch**: DevContainer runs 3.0.0 but DO managed only offers up to 2.19. Avoid 3.0-only APIs.
- **No `doctl apps console`**: It's interactive WebSocket, can't be scripted. Use `do-app-sandbox` SDK for remote container access.
- **Kafka topics must pre-exist**: `signals.raw.v1`, `signals.ai.jobs.v1`, `signals.dlq.v1` (3 partitions, replication factor 2 in prod).
- **Dashboard API calls**: Use relative paths (`/v1/incidents`) in production. `CORE_API_INTERNAL_URL` for SSR.
- **DB migrations are immutable**: Never edit a deployed migration. Always create a new one.

## Database (8 tables)

`orgs` → `projects` → `project_api_keys` (tenancy)
`incidents` → `incident_events` (incident lifecycle)
`metrics_buckets` (pre-aggregated counts, unique on `project_id|env|metric|fingerprint|bucket_start|bucket_seconds`)
`ai_jobs` (queue with leasing) → `ai_outputs` (AI summaries)

## Kafka Topics

| Topic | Key | Consumer Groups |
|-------|-----|-----------------|
| `signals.raw.v1` | `org\|project\|error_code\|route` (errors) or `org\|project\|event_type` | `indexer-group`, `incident-engine-group` |
| `signals.ai.jobs.v1` | job_id | `ai-worker-group` |
| `signals.dlq.v1` | original key | — |

## Deployment

- **Platform**: DigitalOcean App Platform, region `syd1`, VPC-connected.
- **CI/CD**: GitHub Actions (`.github/workflows/deploy.yml`) — not `deploy_on_push`.
- **Managed DBs**: PostgreSQL (PG), Kafka (KAFKA), OpenSearch (OPENSEARCH) — no versions pinned in app.yaml.
- **Pre-deploy job**: `db-migrate` runs migrations + seed before each deploy.
- **Skills directory**: Read `.claude/skills/do-app-platform-skills/` before any infra work.

## Tech Stack

Node.js 20, TypeScript 5.3, Fastify 4.25, Next.js 14, React 18, Tailwind,
shadcn/ui, Drizzle ORM, KafkaJS, OpenSearch, Gradient AI, Vitest.

## When Compacting

Preserve: modified file list, failing test output, current git branch, and
which Plan/ stage is in progress.

## Reference Docs

- Build spec: `Task.md` (full MVP specification)
- Deployment stages: `Plan/01-local-design.md` through `Plan/09-cloud-end-to-end.md`
- App Platform skills: `.claude/skills/do-app-platform-skills/SKILL.md`
- DB schema: `db/schema.ts`
- App spec: `.do/app.yaml`
