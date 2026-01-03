# CLAUDE.md

> AI assistant configuration for **customer-signals-copilot**

---

## ⚠️ MANDATORY: Read Before Any Work

### Required Skills Directory
```
.claude/skills/do-app-platform-skills/

cd .claude/skills/do-app-platform-skills/ && git remote -v`
```

**Before touching deployment, infrastructure, databases, or networking:**
1. Read `SKILL.md` in the root of that directory
2. Read the relevant skill in `skills/<topic>/SKILL.md`

| Task | Skill to Read First |
|------|---------------------|
| Create/modify `.do/app.yaml` | `skills/designer/SKILL.md` |
| CI/CD, GitHub Actions | `skills/deployment/SKILL.md` |
| Debug running containers | `skills/troubleshooting/SKILL.md` |
| Database connections, pooling | `skills/postgres/SKILL.md` |
| Domains, CORS, routing | `skills/networking/SKILL.md` |
| Kafka, OpenSearch, Redis | `skills/managed-db-services/SKILL.md` |

---

## 🚨 Critical: Remote Container Access

### Use `do-app-sandbox` SDK — Never `doctl apps console`

| Task | ✅ Correct Tool | ❌ Wrong Tool |
|------|-----------------|---------------|
| Live troubleshooting | `do-app-sandbox` | `doctl apps console` |
| Read logs from container | `do-app-sandbox` | `doctl apps console` |
| Execute commands remotely | `do-app-sandbox` | `doctl apps console` |
| Upload hotfix files | `do-app-sandbox` | `doctl apps console` |

**Why?** `doctl apps console` opens an interactive WebSocket terminal. It cannot be scripted or automated — it just hangs waiting for human input.

```python
# ✅ CORRECT: do-app-sandbox Python SDK
from do_app_sandbox import AppSandbox

sandbox = AppSandbox(app_id="your-app-id", component="incident-engine")
result = sandbox.exec("cat /app/logs/error.log")
print(result.stdout)

# Upload a file to running container
sandbox.upload("./local-fix.js", "/app/hotfix.js")
```

```bash
# ❌ WRONG: doctl apps console - interactive only, breaks automation
doctl apps console <app-id> <component>  # Opens WebSocket, can't script this
```

---

## Project Overview

**customer-signals-copilot** — Event-driven incident detection system

### Architecture
```
┌─────────────┐     ┌─────────────────┐     ┌──────────────────┐
│ ingest-api  │────▶│ Kafka           │────▶│ incident-engine  │──▶ PostgreSQL
│ (HTTP)      │     │ signals.raw.v1  │     │ (worker)         │
└─────────────┘     └────────┬────────┘     └──────────────────┘
                             │
                             ├────────────▶ indexer ──▶ OpenSearch
                             │
┌─────────────┐     ┌────────┴────────┐     ┌──────────────────┐
│ ai_jobs     │◀────│ incidents       │     │ Gradient AI      │
│ (PG table)  │     │ (PG table)      │     │ (DO inference)   │
└──────┬──────┘     └─────────────────┘     └────────┬─────────┘
       │                                             │
       └──────────▶ ai-worker ───────────────────────┘
```

### Services (`@signals/*` namespace)

| Service | Local Dev | App Platform | Type | Purpose |
|---------|-----------|--------------|------|---------|
| `ingest-api` | :3000 | :8080 via `$PORT` | HTTP | Event ingestion, Kafka producer |
| `core-api` | :3001 | :8080 via `$PORT` | HTTP | REST API for incidents/search |
| `incident-engine` | — | — | Worker | Incident detection, lifecycle |
| `indexer` | — | — | Worker | OpenSearch indexing |
| `ai-worker` | — | — | Worker | Gradient AI summaries |
| `dashboard` | :3002 | :8080 via `$PORT` | HTTP | Web UI |

> **Note:** App Platform injects `$PORT` env var. Services bind to `$PORT` (or default for local). The `http_port` in `.do/app.yaml` tells App Platform which port to route to.

---

## Development Commands

**Use `npm` — this is an npm workspaces monorepo.**

### Start Services
```bash
npm run dev:ingest      # Port 3000
npm run dev:core        # Port 3001
npm run dev:engine      # Kafka consumer
npm run dev:indexer     # Kafka consumer
npm run dev:ai-worker   # Job processor
npm run dev:dashboard   # Port 3002
```

### Quality Checks
```bash
npm run lint            # ESLint
npm test                # Vitest
npm run build           # TypeScript build
```

### Database
```bash
npm run db:generate     # Generate Drizzle migrations
npm run db:migrate      # Apply migrations
npm run db:seed         # Seed development data
```

### Testing Tools
```bash
npm run loadgen         # Synthetic event generator
npm run replay          # NDJSON fixture replayer
```

---

## Codebase Map

```
├── services/                 # Fastify microservices
│   ├── ingest-api/          # Event ingestion
│   ├── core-api/            # REST API
│   ├── incident-engine/     # Kafka → incidents
│   ├── indexer/             # Kafka → OpenSearch
│   └── ai-worker/           # Job queue processor
├── apps/dashboard/          # Next.js frontend
├── packages/
│   ├── shared-types/        # Zod schemas, fingerprinting
│   └── db/                  # Drizzle ORM (if exists)
├── db/                      # Schema and migrations
├── tools/                   # loadgen, replay, debug
├── fixtures/scenarios/      # Test data
├── .do/                     # App Platform spec
│   └── app.yaml
├── .claude/skills/          # ⚠️ READ THESE FOR DEPLOYMENTS
│   └── do-app-platform-skills/
└── Plan/                    # Implementation docs
```

### Key Files

| File | When to Read |
|------|--------------|
| `packages/shared-types/src/fingerprint.ts` | Changing incident grouping logic |
| `db/schema.ts` | Database schema changes |
| `.do/app.yaml` | Any infrastructure changes |
| `Plan/*.md` | Understanding project phases |

---

## Code Patterns

### Environment-Portable Design

Code must work in **local dev**, **Docker Compose**, AND **App Platform**.

| Principle | Pattern |
|-----------|---------|
| **Bind to `$PORT`** | App Platform injects port; use `process.env.PORT \|\| 3000` |
| **Never hardcode addresses** | Use env vars: `API_URL=''` means relative URLs |
| **Public services = path routing** | Frontend calls `/v1/api/*`, App Platform routes to correct service |
| **Internal services = no routes** | Workers, internal APIs use `${service.PRIVATE_URL}` |
| **Flatten Dockerfile output** | Copy `.next/static` to `./.next/static`, not nested monorepo paths |

#### Port Binding
```typescript
// ✅ App Platform injects PORT; local dev uses default
const port = process.env.PORT || 3000
server.listen({ port, host: '0.0.0.0' })

// ❌ Hardcoded port - works locally, ignored by App Platform
server.listen({ port: 3001 })  // App Platform uses http_port from app.yaml
```

#### Service Communication
```typescript
// ✅ Public-facing service (dashboard → core-api via path routing)
const API_BASE = process.env.NEXT_PUBLIC_API_URL || ''
fetch(`${API_BASE}/v1/incidents`)  // Relative URL works in App Platform

// ✅ Internal service-to-service (worker → internal-api)
const INTERNAL_API = process.env.INTERNAL_API_URL  // Set to ${internal-api.PRIVATE_URL}
fetch(`${INTERNAL_API}/process`)

// ❌ Breaks in production
fetch('http://localhost:3001/v1/incidents')
fetch('http://core-api:3001/v1/incidents')  // Docker Compose DNS only
```

#### Internal vs Public Services
```yaml
# app.yaml - Public service (has routes)
services:
  - name: core-api
    http_port: 8080
    routes:
      - path: /v1/incidents

# app.yaml - Internal service (no routes = private, use PRIVATE_URL)
services:
  - name: internal-processor
    http_port: 8080
    # No routes! Access via ${internal-processor.PRIVATE_URL}
```

#### Dockerfile Structure (Monorepos)
```dockerfile
# ✅ Flatten to production structure
COPY --from=builder /app/apps/dashboard/.next/static ./.next/static

# ❌ Nested path - server.js can't find assets
COPY --from=builder /app/apps/dashboard/.next/static ./apps/dashboard/.next/static
```

### Database Connection Priority
```typescript
// Prefers VPC connection (faster, more secure)
const url = process.env.DATABASE_PRIVATE_URL || process.env.DATABASE_URL;
```

### Event Fingerprinting
```typescript
// packages/shared-types/src/fingerprint.ts
// Errors:  error_code | route | environment
// Events:  event_type | environment
```

### Metrics: Pre-aggregated Only
```sql
-- ✅ Use metrics_buckets table (1-minute aggregations)
SELECT * FROM metrics_buckets WHERE bucket_time > NOW() - INTERVAL '1 hour';

-- ❌ Never range-scan raw events
SELECT COUNT(*) FROM events WHERE created_at > ...;
```

### AI Job Queue
- PostgreSQL-based with leasing (`ai_jobs` table)
- `status`: pending → processing → completed/failed
- Max 3 attempts with exponential backoff

### Dashboard API
```typescript
// Production: relative paths (same domain via path routing)
fetch('/api/incidents')

// Local dev only: set NEXT_PUBLIC_API_URL
fetch(`${process.env.NEXT_PUBLIC_API_URL}/incidents`)
```

---

## Don't Do This

### ❌ Using `doctl apps console` for automation
It's interactive-only. Use `do-app-sandbox` SDK.

### ❌ Skipping the skills directory
Always check `.claude/skills/do-app-platform-skills/` before deployment work.

### ❌ Computing metrics on-the-fly
Use pre-aggregated `metrics_buckets` table.

### ❌ Raw SQL in application code
Use Drizzle ORM for all queries.

### ❌ Hardcoding API URLs in dashboard
Use relative paths in production.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js 20 LTS |
| Language | TypeScript 5.3 (strict) |
| Backend | Fastify 4.25 |
| Frontend | Next.js 14, React 18, Tailwind, shadcn/ui |
| Database | PostgreSQL 18 + Drizzle ORM |
| Search | OpenSearch 3.0 |
| Queue | Kafka (KafkaJS) |
| AI | Gradient AI (DO serverless) |
| Testing | Vitest |
| Platform | DigitalOcean App Platform |

---

## DevContainer

Open with VS Code/Cursor Dev Containers extension. Provides:
- PostgreSQL
- Kafka + Zookeeper  
- OpenSearch
- MinIO (S3-compatible)

**Do not modify:**
- Workspace path: `/workspaces/app`
- Docker Compose service names

---

## Deployment

- **Platform**: DigitalOcean App Platform
- **Spec**: `.do/app.yaml`
- **CI/CD**: GitHub Actions (`.github/workflows/deploy.yml`)
- **Migrations**: Separate job via `db/Dockerfile.migrate`
- **Secrets**: GitHub Secrets → App Platform env vars

**Before deploying, always:**
1. Read `.claude/skills/do-app-platform-skills/skills/deployment/SKILL.md`
2. Validate spec: `doctl apps spec validate .do/app.yaml`

---

## AI Assistant Rules

### Before Any Code Changes
1. Run `npm run lint && npm test` after modifications
2. Follow existing patterns in similar services
3. Validate `.do/app.yaml` if changed

### For Deployment/Infra Work
1. Invoke `/do-app-platform-skills` — routes to the right sub-skill
2. Use subagents for parallel exploration/planning when scope is uncertain
3. Use `do-app-sandbox` SDK for remote container access
4. **NEVER** use `doctl apps console` for scripted operations

### When Adding Dependencies
- Ask before adding new packages
- Prefer existing workspace packages

### Code Style
- TypeScript strict mode, no `any`
- Zod for input validation
- Drizzle for database queries
- Explicit error handling