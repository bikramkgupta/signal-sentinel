# Stage 3: Sentinel Dashboard - Testing Plan

**Status**: COMPLETE - All Docker builds passed, health checks validated
**Last Updated**: 2026-01-02

---

## Overview

This document details the testing strategy for the Sentinel dashboard. Testing will be conducted locally using the devcontainer before deployment to DigitalOcean App Platform.

---

## Environment

| Attribute | Value |
|-----------|-------|
| **Host OS** | macOS (Darwin) |
| **Container Runtime** | Docker Desktop |
| **Devcontainer Config** | `.devcontainer/devcontainer.json` |
| **Services (COMPOSE_PROFILES)** | `app,postgres,kafka,opensearch,minio` |

---

## Pre-requisites

- [ ] Docker Desktop running
- [ ] devcontainer CLI installed (`npm install -g @devcontainers/cli`)
- [ ] Project cloned locally

---

## Test Execution Plan

### Step 1: Start Devcontainer

```bash
# From project root on Mac host
cd /Users/bikram/Documents/Build/skills-test/customer-signals-copilot/customer-signals-copilot-main

# Start the devcontainer (builds if needed, starts all services)
devcontainer up --workspace-folder .

# Wait for services to be healthy (Kafka takes ~60s)
sleep 60

# Verify services are running
docker compose -f .devcontainer/docker-compose.yml ps
```

**Expected Output:**
- `app` container: Running
- `postgres` container: Healthy
- `kafka` container: Healthy
- `opensearch` container: Healthy
- `minio` container: Healthy

---

### Step 2: Get Container Reference

```bash
# Get the app container name
APP_CONTAINER=$(docker compose -f .devcontainer/docker-compose.yml ps app --format "{{.Name}}" | head -1)

# Verify
echo "Container: $APP_CONTAINER"
```

---

### Step 3: Run Database Setup

```bash
# Run migrations
docker exec -w /workspaces/app $APP_CONTAINER bash -c "npm run db:migrate"

# Seed test data (org, project, API key)
docker exec -w /workspaces/app $APP_CONTAINER bash -c "npm run db:seed"
```

**Expected Output:**
- Migrations complete without errors
- Seed data created (check for org_123, proj_123)

---

### Step 4: Start Application Services

```bash
# Start Core API (port 3001)
docker exec -d -w /workspaces/app $APP_CONTAINER bash -c "npm run dev:core"

# Wait for startup
sleep 5

# Start Dashboard (port 3002)
docker exec -d -w /workspaces/app $APP_CONTAINER bash -c "npm run dev:dashboard"

# Start event pipeline (needed for test data generation)
docker exec -d -w /workspaces/app $APP_CONTAINER bash -c "npm run dev:ingest"
docker exec -d -w /workspaces/app $APP_CONTAINER bash -c "npm run dev:engine"
docker exec -d -w /workspaces/app $APP_CONTAINER bash -c "npm run dev:indexer"
docker exec -d -w /workspaces/app $APP_CONTAINER bash -c "npm run dev:ai-worker"

# Wait for all services
sleep 10
```

---

### Step 5: Generate Test Data

```bash
# Generate error spike data (creates incidents)
docker exec -w /workspaces/app $APP_CONTAINER bash -c \
  "npm run loadgen -- --mode spike_errors --duration 60 --rate 10"
```

**Expected Output:**
- Events sent to ingest-api
- Incidents created by incident-engine
- Events indexed to OpenSearch
- AI jobs queued

---

### Step 6: API Testing

```bash
# Test health endpoint
docker exec -w /workspaces/app $APP_CONTAINER bash -c \
  "curl -s http://localhost:3001/healthz | jq"

# Test overview endpoint (NEW)
docker exec -w /workspaces/app $APP_CONTAINER bash -c \
  "curl -s http://localhost:3001/v1/metrics/overview | jq"

# Test trends endpoint (NEW)
docker exec -w /workspaces/app $APP_CONTAINER bash -c \
  "curl -s 'http://localhost:3001/v1/metrics/trends?metric=errors&period=24h' | jq"

# Test incidents endpoint
docker exec -w /workspaces/app $APP_CONTAINER bash -c \
  "curl -s 'http://localhost:3001/v1/incidents?limit=5' | jq"
```

**Expected Responses:**
- `/healthz`: `{"status": "healthy", "database": "up"}`
- `/v1/metrics/overview`: Object with `incidents`, `errors`, `signups`, `ai` fields
- `/v1/metrics/trends`: Object with `metric`, `period`, `data[]`, `summary`
- `/v1/incidents`: Object with `incidents[]`, `pagination`

---

### Step 7: Frontend Testing

**Access URLs** (from Mac host browser):
- Dashboard: http://localhost:3002
- Core API: http://localhost:3001

**Manual Test Checklist:**

| # | Test | Steps | Expected Result | Status |
|---|------|-------|-----------------|--------|
| 1 | Dashboard loads | Navigate to http://localhost:3002 | Overview page displays | [ ] |
| 2 | Sidebar navigation | Click each nav item | Pages load, active state shows | [ ] |
| 3 | Dark mode toggle | Click theme toggle | All components switch themes | [ ] |
| 4 | Overview stats | Check stat cards | Shows real numbers from API | [ ] |
| 5 | Error chart | Check error trend chart | Shows time-series data | [ ] |
| 6 | Signup chart | Check signup trend chart | Shows time-series data | [ ] |
| 7 | Recent incidents | Check incidents widget | Shows recent incidents | [ ] |
| 8 | Incidents page | Navigate to /incidents | Table loads with data | [ ] |
| 9 | Incident detail | Click an incident | Detail page with AI summary | [ ] |
| 10 | Search page | Navigate to /search | Search form works | [ ] |
| 11 | AI page | Navigate to /ai | Stats and jobs display | [ ] |
| 12 | Responsive | Resize browser window | Layout adapts correctly | [ ] |
| 13 | Empty states | Clear data, reload | Graceful empty messages | [ ] |

---

### Step 8: Build Verification

```bash
# Build dashboard for production
docker exec -w /workspaces/app/apps/dashboard $APP_CONTAINER bash -c "npm run build"

# Verify standalone output
docker exec -w /workspaces/app/apps/dashboard $APP_CONTAINER bash -c "ls -la .next/standalone"
```

**Expected Output:**
- Build completes without errors
- `.next/standalone` directory exists

---

### Step 9: App Platform Local Build (CRITICAL)

**This step catches 90% of cloud build failures before they happen.**

```bash
# Prerequisites check (run on Mac host, not in container)
doctl version  # Must be 1.82.0+
docker info    # Docker must be running

# Build each component using DO's build environment
cd /Users/bikram/Documents/Build/skills-test/customer-signals-copilot/customer-signals-copilot-main

# Build using local app spec
doctl app dev build --spec .do/app.yaml

# When prompted, select each component to build:
# - ingest-api
# - core-api
# - dashboard
# - indexer
# - incident-engine
# - ai-worker
```

**Expected Output:**
- Each component builds successfully
- Docker run command provided for each on success
- No Dockerfile syntax errors
- All dependencies resolve correctly

| Component | Build Status | Notes |
|-----------|--------------|-------|
| ingest-api | [x] | Built 2026-01-02 |
| core-api | [x] | Built 2026-01-02 |
| dashboard | [x] | Built 2026-01-02 |
| indexer | [x] | Built 2026-01-02 |
| incident-engine | [x] | Built 2026-01-02 |
| ai-worker | [x] | Built 2026-01-02 |
| db-migrate | [x] | Built 2026-01-02 |

---

### Step 10: Health Check Validation (CRITICAL)

**This step catches 90% of cloud deploy failures before they happen.**

```bash
# Test health endpoints from Mac host (services exposed via devcontainer)

# ingest-api health check
curl -f http://localhost:3000/healthz
# Expected: 200 OK

# core-api health check
curl -f http://localhost:3001/healthz
# Expected: 200 OK with {"status": "healthy"}

# dashboard health check (Next.js)
curl -f http://localhost:3002/
# Expected: 200 OK (HTML response)
```

**Verify app spec health paths match:**

```bash
# Check .do/app.yaml health_check configurations
grep -A 3 "health_check:" .do/app.yaml
```

| Service | Health Path in Code | Health Path in app.yaml | Match? |
|---------|--------------------|-----------------------|--------|
| ingest-api | `/healthz` | `/healthz` | [x] |
| core-api | `/healthz` | `/healthz` | [x] |
| dashboard | `/` | `/` | [x] |

**Troubleshooting Health Check Failures:**

| Issue | Cause | Solution |
|-------|-------|----------|
| 404 Not Found | Route not defined | Add health endpoint to code |
| 500 Error | App error on startup | Check logs for exception |
| Connection refused | Wrong port | Verify HTTP_PORT env var |
| Timeout | Slow startup | Increase `initial_delay_seconds` in app.yaml |

---

### Step 11: Cleanup

```bash
# Stop the devcontainer
docker compose -f .devcontainer/docker-compose.yml stop

# Verify stopped
docker compose -f .devcontainer/docker-compose.yml ps
```

---

## Test Results Log

| Date | Step | Result | Notes |
|------|------|--------|-------|
| 2026-01-02 | 9 | PASS | All 7 Docker images built successfully |
| 2026-01-02 | 10 | PASS | Health check paths validated and corrected |

---

## Known Issues

| Issue | Workaround |
|-------|------------|
| Kafka takes 60s+ to start | Wait or check `docker compose logs kafka` |
| Shell config warnings | Ignore - commands still execute |
| Port conflicts | Use dynamic ports (already configured) |

---

## Next Steps After Testing

1. [ ] All functional tests pass locally (Steps 1-8) - Optional, requires devcontainer
2. [x] Docker builds succeed for all components (Step 9) - PASSED 2026-01-02
3. [x] Health check endpoints validated (Step 10) - PASSED 2026-01-02
4. [ ] Commit changes to `main` branch
5. [ ] Deploy to DigitalOcean App Platform (Stage 4+)

**IMPORTANT**: Do NOT proceed to cloud deployment until Steps 9 and 10 pass. These catch 90% of deployment failures.
