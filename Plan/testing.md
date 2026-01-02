# Sentinel Dashboard - Testing Plan

**Status**: PENDING
**Last Updated**: 2026-01-01

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
cd /Users/bikram/Documents/Build/skills-test/customer-signals-copilot/customer-signals-copilot-claude

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
  "curl -s http://localhost:3001/api/healthz | jq"

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
- `/api/healthz`: `{"status": "ok"}`
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

### Step 9: Cleanup

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
| | | | |

---

## Known Issues

| Issue | Workaround |
|-------|------------|
| Kafka takes 60s+ to start | Wait or check `docker compose logs kafka` |
| Shell config warnings | Ignore - commands still execute |
| Port conflicts | Use dynamic ports (already configured) |

---

## Next Steps After Testing

1. [ ] All tests pass locally
2. [ ] Commit changes to `claude` branch
3. [ ] Create PR to `main`
4. [ ] Deploy to DigitalOcean App Platform (separate session)
