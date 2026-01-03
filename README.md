# Customer Signals Copilot

**Event-driven incident detection system with AI-powered summarization**

A production-ready observability platform that ingests application events, automatically detects incidents through pattern matching, and generates AI summaries to help engineers quickly understand and resolve issues.

---

## System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              CUSTOMER SIGNALS COPILOT                            │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   ┌──────────────┐      ┌─────────────────────────────────────────────────┐     │
│   │   Client     │      │                   App Platform                   │     │
│   │  Application │      │                                                  │     │
│   └──────┬───────┘      │  ┌────────────┐    ┌────────────┐               │     │
│          │              │  │ ingest-api │    │  core-api  │               │     │
│          │ POST /v1/    │  │   :3000    │    │   :3001    │               │     │
│          │ events       │  └─────┬──────┘    └─────┬──────┘               │     │
│          │              │        │                 │                      │     │
│          ▼              │        ▼                 │                      │     │
│   ┌──────────────┐      │  ┌──────────┐           │    ┌─────────────┐   │     │
│   │   Ingress    │─────▶│  │  Kafka   │           │    │  Dashboard  │   │     │
│   │   Router     │      │  │ (events) │           │    │   :3002     │   │     │
│   └──────────────┘      │  └────┬─────┘           │    └──────┬──────┘   │     │
│                         │       │                 │           │          │     │
│                         │       ▼                 ▼           ▼          │     │
│                         │  ┌─────────┐  ┌─────────────┐  ┌─────────┐    │     │
│                         │  │ Workers │  │ PostgreSQL  │  │  User   │    │     │
│                         │  │(3 types)│  │ (incidents) │  │ Browser │    │     │
│                         │  └─────────┘  └─────────────┘  └─────────┘    │     │
│                         │                                                │     │
│                         └────────────────────────────────────────────────┘     │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Component Interactions

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                  │
│                           ┌─────────────────┐                                   │
│                           │   ingest-api    │                                   │
│                           │  (HTTP Service) │                                   │
│                           └────────┬────────┘                                   │
│                                    │                                            │
│                                    │ publish                                    │
│                                    ▼                                            │
│                         ┌─────────────────────┐                                 │
│                         │       Kafka         │                                 │
│                         │  signals.raw.v1     │                                 │
│                         └──────────┬──────────┘                                 │
│                                    │                                            │
│              ┌─────────────────────┼─────────────────────┐                     │
│              │                     │                     │                      │
│              ▼                     ▼                     ▼                      │
│   ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐              │
│   │    indexer      │   │ incident-engine │   │   ai-worker     │              │
│   │    (Worker)     │   │    (Worker)     │   │    (Worker)     │              │
│   └────────┬────────┘   └────────┬────────┘   └────────┬────────┘              │
│            │                     │                     │                        │
│            ▼                     ▼                     ▼                        │
│   ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐              │
│   │   OpenSearch    │   │   PostgreSQL    │   │   Gradient AI   │              │
│   │  (event index)  │   │   (incidents)   │   │  (summaries)    │              │
│   └─────────────────┘   └─────────────────┘   └─────────────────┘              │
│            │                     │                     │                        │
│            └─────────────────────┼─────────────────────┘                        │
│                                  ▼                                              │
│                         ┌─────────────────┐                                     │
│                         │    core-api     │                                     │
│                         │  (HTTP Service) │                                     │
│                         └────────┬────────┘                                     │
│                                  │                                              │
│                                  ▼                                              │
│                         ┌─────────────────┐                                     │
│                         │    Dashboard    │                                     │
│                         │   (Next.js)     │                                     │
│                         └─────────────────┘                                     │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Event Flow

### 1. Event Ingestion Pipeline

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          EVENT INGESTION FLOW                                 │
└──────────────────────────────────────────────────────────────────────────────┘

  Client App                    ingest-api                      Kafka
      │                             │                             │
      │  POST /v1/events            │                             │
      │  X-API-Key: xxx             │                             │
      │  {event_type, message,      │                             │
      │   severity, attributes}     │                             │
      │────────────────────────────▶│                             │
      │                             │                             │
      │                             │ 1. Validate API key         │
      │                             │    (SHA256 lookup in PG)    │
      │                             │                             │
      │                             │ 2. Canonicalize event       │
      │                             │    (add timestamps, IDs)    │
      │                             │                             │
      │                             │ 3. Publish to Kafka         │
      │                             │────────────────────────────▶│
      │                             │                             │
      │     202 Accepted            │                             │
      │     {event_id, received_at} │                             │
      │◀────────────────────────────│                             │
      │                             │                             │


  Event Types Supported:
  ├── error        → Application errors (creates incidents)
  ├── http_request → HTTP traffic metrics
  ├── signup       → User registration events
  ├── deploy       → Deployment markers
  ├── feedback     → User feedback
  └── custom       → Custom event types
```

### 2. Event Processing (Fan-out)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         KAFKA CONSUMER FAN-OUT                                │
└──────────────────────────────────────────────────────────────────────────────┘

                              Kafka Topic
                           signals.raw.v1
                                  │
           ┌──────────────────────┼──────────────────────┐
           │                      │                      │
           ▼                      ▼                      ▼
   ┌───────────────┐     ┌───────────────┐     ┌───────────────┐
   │   indexer     │     │incident-engine│     │  (future)     │
   │               │     │               │     │  consumers    │
   │ Consumer Group│     │ Consumer Group│     │               │
   │ indexer-group │     │ engine-group  │     │               │
   └───────┬───────┘     └───────┬───────┘     └───────────────┘
           │                     │
           │                     │
           ▼                     ▼
   ┌───────────────┐     ┌───────────────┐
   │  OpenSearch   │     │  PostgreSQL   │
   │               │     │               │
   │ Index events  │     │ Create/update │
   │ for search    │     │ incidents     │
   └───────────────┘     └───────┬───────┘
                                 │
                                 │ Queue AI job
                                 ▼
                         ┌───────────────┐
                         │   ai_jobs     │
                         │   (PG table)  │
                         └───────┬───────┘
                                 │
                                 │ Poll for jobs
                                 ▼
                         ┌───────────────┐
                         │  ai-worker    │
                         │               │
                         │ Gradient AI   │
                         │ summarization │
                         └───────────────┘
```

---

## Incident Detection

### Fingerprinting & Grouping

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                      INCIDENT FINGERPRINTING                                  │
└──────────────────────────────────────────────────────────────────────────────┘

  Incoming Error Event
  ┌─────────────────────────────────────┐
  │ {                                   │
  │   event_type: "error",              │
  │   message: "DB connection timeout", │
  │   attributes: {                     │
  │     error_code: "DB_TIMEOUT",  ─────┼──┐
  │     route: "/api/users",       ─────┼──┼──┐
  │   },                                │  │  │
  │   environment: "prod"          ─────┼──┼──┼──┐
  │ }                                   │  │  │  │
  └─────────────────────────────────────┘  │  │  │
                                           │  │  │
                                           ▼  ▼  ▼
                              ┌─────────────────────────┐
                              │  Fingerprint Formula    │
                              │                         │
                              │  For errors:            │
                              │  SHA256(error_code +    │
                              │         route +         │
                              │         environment)    │
                              │                         │
                              │  Result: "abc123..."    │
                              └───────────┬─────────────┘
                                          │
                                          ▼
                    ┌─────────────────────────────────────────┐
                    │           INCIDENT MATCHING             │
                    ├─────────────────────────────────────────┤
                    │                                         │
                    │  SELECT * FROM incidents                │
                    │  WHERE fingerprint = 'abc123...'        │
                    │    AND status != 'resolved'             │
                    │                                         │
                    │  ┌─────────────┐    ┌─────────────┐    │
                    │  │   Found?    │    │ Not Found?  │    │
                    │  │             │    │             │    │
                    │  │ Increment   │    │ Create new  │    │
                    │  │ event_count │    │ incident    │    │
                    │  │             │    │             │    │
                    │  │ Update      │    │ Queue AI    │    │
                    │  │ last_seen   │    │ summary job │    │
                    │  └─────────────┘    └─────────────┘    │
                    │                                         │
                    └─────────────────────────────────────────┘
```

### Incident Lifecycle

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        INCIDENT STATE MACHINE                                 │
└──────────────────────────────────────────────────────────────────────────────┘

                    ┌─────────────────┐
                    │   First Error   │
                    │   Event Arrives │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
           ┌───────│      OPEN       │◀──────────────────┐
           │       │                 │                   │
           │       │  event_count=1  │                   │
           │       └────────┬────────┘                   │
           │                │                            │
           │                │ More matching              │
           │                │ events arrive              │
           │                │                            │
           │                ▼                            │
           │       ┌─────────────────┐                   │
           │       │      OPEN       │                   │
           │       │                 │                   │
           │       │ event_count++   │                   │
           │       │ last_seen=now   │                   │
           │       └────────┬────────┘                   │
           │                │                            │
           │                │ Engineer                   │
           │                │ investigates               │ Issue
           │                ▼                            │ recurs
           │       ┌─────────────────┐                   │
           │       │  INVESTIGATING  │                   │
           │       │                 │───────────────────┘
           │       └────────┬────────┘
           │                │
           │                │ Issue fixed
           │                ▼
           │       ┌─────────────────┐
           └──────▶│    RESOLVED     │
                   │                 │
                   │ resolved_at=now │
                   └─────────────────┘
```

---

## AI Summarization

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         AI SUMMARY GENERATION                                 │
└──────────────────────────────────────────────────────────────────────────────┘

  New Incident Created
         │
         │ Insert job
         ▼
  ┌─────────────────┐
  │    ai_jobs      │
  │   (PG Table)    │
  │                 │
  │ status: pending │
  │ incident_id: X  │
  └────────┬────────┘
           │
           │ ai-worker polls every 5s
           ▼
  ┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
  │   ai-worker     │      │   Gradient AI   │      │   PostgreSQL    │
  │                 │      │   (DO Infra)    │      │                 │
  │ 1. Claim job    │      │                 │      │                 │
  │    (lease)      │      │                 │      │                 │
  │                 │      │                 │      │                 │
  │ 2. Fetch        │      │                 │      │                 │
  │    incident +   │◀─────┼─────────────────┼──────│ incident data   │
  │    events       │      │                 │      │                 │
  │                 │      │                 │      │                 │
  │ 3. Build prompt │      │                 │      │                 │
  │    with context │      │                 │      │                 │
  │                 │      │                 │      │                 │
  │ 4. Call LLM     │─────▶│ llama3.3-70b   │      │                 │
  │                 │      │                 │      │                 │
  │ 5. Parse JSON   │◀─────│ {title,        │      │                 │
  │    response     │      │  impact,       │      │                 │
  │                 │      │  causes,       │      │                 │
  │                 │      │  next_steps}   │      │                 │
  │                 │      │                 │      │                 │
  │ 6. Store result │──────┼─────────────────┼─────▶│ ai_outputs      │
  │                 │      │                 │      │ table           │
  │                 │      │                 │      │                 │
  │ 7. Mark done    │──────┼─────────────────┼─────▶│ ai_jobs.status  │
  │                 │      │                 │      │ = completed     │
  └─────────────────┘      └─────────────────┘      └─────────────────┘


  AI Summary Output Format:
  ┌─────────────────────────────────────────┐
  │ {                                       │
  │   "title": "Database Connection Issue", │
  │   "impact": "Users unable to login",    │
  │   "likely_causes": [                    │
  │     "Connection pool exhausted",        │
  │     "Database server overload"          │
  │   ],                                    │
  │   "evidence": [                         │
  │     "15 timeout errors in 2 minutes",   │
  │     "All from /api/users endpoint"      │
  │   ],                                    │
  │   "next_steps": [                       │
  │     "Check database connection count",  │
  │     "Review recent deployments"         │
  │   ],                                    │
  │   "confidence": 0.85                    │
  │ }                                       │
  └─────────────────────────────────────────┘
```

---

## Data Storage

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          DATA STORAGE ARCHITECTURE                            │
└──────────────────────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────────────────┐
  │                            PostgreSQL                                    │
  │                    (Source of Truth for State)                          │
  ├─────────────────────────────────────────────────────────────────────────┤
  │                                                                          │
  │   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
  │   │    orgs     │  │  projects   │  │  incidents  │  │  ai_jobs    │   │
  │   │             │  │             │  │             │  │             │   │
  │   │ id          │  │ id          │  │ id          │  │ id          │   │
  │   │ name        │◀─│ org_id      │◀─│ project_id  │  │ incident_id │   │
  │   │ created_at  │  │ name        │  │ fingerprint │  │ status      │   │
  │   └─────────────┘  │ created_at  │  │ title       │  │ attempts    │   │
  │                    └─────────────┘  │ status      │  │ created_at  │   │
  │                                     │ severity    │  └─────────────┘   │
  │   ┌─────────────┐                   │ event_count │                    │
  │   │project_api_ │                   │ first_seen  │  ┌─────────────┐   │
  │   │   keys      │                   │ last_seen   │  │ ai_outputs  │   │
  │   │             │                   │ ai_summary  │  │             │   │
  │   │ project_id  │                   └─────────────┘  │ incident_id │   │
  │   │ key_hash    │                                    │ summary     │   │
  │   │ last_used   │  ┌─────────────┐                   │ created_at  │   │
  │   └─────────────┘  │metrics_bucket│                   └─────────────┘   │
  │                    │             │                                      │
  │                    │ bucket_time │  (Pre-aggregated metrics for        │
  │                    │ metric_name │   fast dashboard queries)           │
  │                    │ value       │                                      │
  │                    └─────────────┘                                      │
  │                                                                          │
  └─────────────────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────────────────┐
  │                              Kafka                                       │
  │                     (Event Streaming Backbone)                          │
  ├─────────────────────────────────────────────────────────────────────────┤
  │                                                                          │
  │   Topic: signals.raw.v1                                                  │
  │   ├── All ingested events (canonical format)                            │
  │   ├── Partitioned by project_id                                         │
  │   └── Retention: 7 days                                                 │
  │                                                                          │
  │   Topic: signals.dlq.v1                                                  │
  │   └── Dead letter queue for failed processing                           │
  │                                                                          │
  │   Consumer Groups:                                                       │
  │   ├── indexer-group        → OpenSearch indexing                        │
  │   ├── incident-engine-group → Incident detection                        │
  │   └── ai-worker-group      → (reserved for future)                      │
  │                                                                          │
  └─────────────────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────────────────┐
  │                            OpenSearch                                    │
  │                    (Full-Text Search & Analytics)                       │
  ├─────────────────────────────────────────────────────────────────────────┤
  │                                                                          │
  │   Index: signals-events-v1                                               │
  │   ├── All events indexed for search                                     │
  │   ├── Mappings optimized for:                                           │
  │   │   ├── Full-text search (message field)                              │
  │   │   ├── Faceted filtering (event_type, severity, environment)         │
  │   │   └── Time-range queries (occurred_at)                              │
  │   └── Retention: 30 days (configurable)                                 │
  │                                                                          │
  │   Use Cases:                                                             │
  │   ├── "Search all errors containing 'timeout'"                          │
  │   ├── "Events from /api/checkout in last hour"                          │
  │   └── "Error trends by route"                                           │
  │                                                                          │
  └─────────────────────────────────────────────────────────────────────────┘
```

---

## Services Reference

| Service | Type | Port | Purpose |
|---------|------|------|---------|
| `ingest-api` | HTTP | 3000 | Event ingestion, Kafka producer |
| `core-api` | HTTP | 3001 | REST API for incidents, search, metrics |
| `dashboard` | HTTP | 3002 | Next.js web UI |
| `incident-engine` | Worker | - | Kafka consumer, incident detection |
| `indexer` | Worker | - | Kafka consumer, OpenSearch indexing |
| `ai-worker` | Worker | - | AI summary job processor |
| `traffic-gen` | Worker | - | Synthetic traffic generator (demo/testing) |

---

## Quick Start

### Local Development

```bash
# Install dependencies
npm install

# Start infrastructure (PostgreSQL, Kafka, OpenSearch)
# Using devcontainer or docker-compose

# Run database migrations and seed
npm run db:migrate
npm run db:seed

# Start services (in separate terminals)
npm run dev:ingest      # Port 3000
npm run dev:core        # Port 3001
npm run dev:engine      # Kafka consumer
npm run dev:indexer     # Kafka consumer
npm run dev:dashboard   # Port 3002

# Generate test traffic
npm run loadgen -- --scenario=normal --duration=60
```

### Production (DigitalOcean App Platform)

```bash
# Validate app spec
doctl apps spec validate .do/app.yaml

# Deploy
doctl apps create --spec .do/app.yaml
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js 20 LTS |
| Language | TypeScript 5.3 (strict mode) |
| Backend | Fastify 4.25 |
| Frontend | Next.js 14, React 18, Tailwind CSS |
| Database | PostgreSQL 18 + Drizzle ORM |
| Search | OpenSearch 3.0 |
| Streaming | Kafka (KafkaJS) |
| AI | Gradient AI (DigitalOcean) with Llama 3.3 70B |
| Platform | DigitalOcean App Platform |

---

## License

MIT
