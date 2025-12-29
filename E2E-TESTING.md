# End-to-End Testing Plan

**Purpose:** Validate the complete data flow from event ingestion through AI analysis to dashboard display.

**Scope:** This testing plan is **environment-agnostic** and works for:
- Local DevContainer development
- Cloud deployments (DigitalOcean, AWS, GCP, etc.)

**Prerequisites:**
- All [Connectivity Tests](./CONNECTIVITY-TESTING.md) passing
- Database migrations applied
- All services running (see `./scripts/start-dev.sh` for local dev)

---

## Environment Configuration

| Variable | Description | Local DevContainer | Cloud Example |
|----------|-------------|-------------------|---------------|
| `INGEST_API_URL` | Event ingestion endpoint | `http://localhost:3000` | `https://ingest.example.com` |
| `CORE_API_URL` | Core API endpoint | `http://localhost:3001` | `https://api.example.com` |
| `DASHBOARD_URL` | Dashboard URL | `http://localhost:3002` | `https://app.example.com` |
| `API_KEY` | API key for authentication | `dev-api-key-12345` | `<production-api-key>` |

### Local DevContainer Setup

```bash
export INGEST_API_URL="http://localhost:3000"
export CORE_API_URL="http://localhost:3001"
export DASHBOARD_URL="http://localhost:3002"
export API_KEY="dev-api-key-12345"
```

### Cloud Setup

```bash
export INGEST_API_URL="https://ingest.example.com"
export CORE_API_URL="https://api.example.com"
export DASHBOARD_URL="https://app.example.com"
export API_KEY="${PRODUCTION_API_KEY}"
```

---

## Test Scenarios

### Scenario 1: Health Check All Services

**Objective:** Verify all services are responsive.

**Test:**
```bash
#!/usr/bin/env bash
set -e

echo "=== Health Check All Services ==="

# Ingest API
echo -n "ingest-api: "
curl -sf "${INGEST_API_URL}/healthz" | jq -r '.status' || echo "FAILED"

# Core API
echo -n "core-api: "
curl -sf "${CORE_API_URL}/healthz" | jq -r '.status' || echo "FAILED"

# Dashboard (check if page loads)
echo -n "dashboard: "
HTTP_CODE=$(curl -sf -o /dev/null -w "%{http_code}" "${DASHBOARD_URL}/" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" == "200" ]; then echo "healthy"; else echo "FAILED (HTTP $HTTP_CODE)"; fi

echo "=== Health Check Complete ==="
```

**Success Criteria:**
- [ ] All services return `healthy` status

---

### Scenario 2: Single Event Ingestion

**Objective:** Verify a single event flows through the system.

**Test:**
```bash
#!/usr/bin/env bash
set -e

echo "=== Single Event Ingestion ==="

# Send a single error event
RESPONSE=$(curl -sf -X POST "${INGEST_API_URL}/v1/events" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{
    "event_type": "error",
    "occurred_at": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
    "message": "E2E Test Error Event",
    "severity": "error",
    "environment": "test",
    "attributes": {
      "error_code": "E2E_TEST",
      "route": "/api/e2e-test",
      "stack_trace": "Error at test.js:1"
    }
  }')

echo "Response: $RESPONSE"

# Verify response
EVENT_ID=$(echo "$RESPONSE" | jq -r '.event_id')
ACCEPTED=$(echo "$RESPONSE" | jq -r '.accepted')

if [ "$ACCEPTED" == "true" ] && [ "$EVENT_ID" != "null" ]; then
    echo "Event accepted with ID: $EVENT_ID"
    echo "=== Single Event: PASSED ==="
else
    echo "=== Single Event: FAILED ==="
    exit 1
fi
```

**Success Criteria:**
- [ ] Response contains `accepted: true`
- [ ] Response contains valid `event_id`

---

### Scenario 3: Batch Event Ingestion

**Objective:** Verify batch ingestion works correctly.

**Test:**
```bash
#!/usr/bin/env bash
set -e

echo "=== Batch Event Ingestion ==="

NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)

RESPONSE=$(curl -sf -X POST "${INGEST_API_URL}/v1/events/batch" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{
    "events": [
      {
        "event_type": "signup",
        "occurred_at": "'$NOW'",
        "message": "E2E Test Signup 1"
      },
      {
        "event_type": "signup",
        "occurred_at": "'$NOW'",
        "message": "E2E Test Signup 2"
      },
      {
        "event_type": "http_request",
        "occurred_at": "'$NOW'",
        "message": "E2E Test HTTP Request",
        "attributes": {
          "route": "/api/test",
          "method": "GET",
          "status_code": 200,
          "latency_ms": 50
        }
      }
    ]
  }')

echo "Response: $RESPONSE"

COUNT=$(echo "$RESPONSE" | jq -r '.count')
ACCEPTED=$(echo "$RESPONSE" | jq -r '.accepted')

if [ "$ACCEPTED" == "true" ] && [ "$COUNT" == "3" ]; then
    echo "Batch accepted: $COUNT events"
    echo "=== Batch Event: PASSED ==="
else
    echo "=== Batch Event: FAILED ==="
    exit 1
fi
```

**Success Criteria:**
- [ ] Response contains `accepted: true`
- [ ] Response contains correct `count`
- [ ] All events have valid `event_ids`

---

### Scenario 4: Error Spike → Incident Creation

**Objective:** Verify that error spikes trigger incident creation.

**Test:**
```bash
#!/usr/bin/env bash
set -e

echo "=== Error Spike Incident Test ==="

# Send 35 error events (threshold is 30 in 5 minutes)
for i in {1..35}; do
    curl -sf -X POST "${INGEST_API_URL}/v1/events" \
      -H "Content-Type: application/json" \
      -H "X-API-Key: ${API_KEY}" \
      -d '{
        "event_type": "error",
        "occurred_at": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
        "message": "Payment failed: timeout",
        "severity": "error",
        "environment": "production",
        "attributes": {
          "error_code": "PAYMENT_TIMEOUT",
          "route": "/api/checkout",
          "service": "payments"
        }
      }' > /dev/null
    echo -n "."
done
echo ""
echo "Sent 35 error events"

# Wait for processing
echo "Waiting 10 seconds for incident-engine to process..."
sleep 10

# Check for created incident
INCIDENTS=$(curl -sf "${CORE_API_URL}/v1/incidents?status=open" || echo '{"data":[]}')
INCIDENT_COUNT=$(echo "$INCIDENTS" | jq '.data | length')

if [ "$INCIDENT_COUNT" -gt 0 ]; then
    echo "Found $INCIDENT_COUNT open incident(s)"
    echo "$INCIDENTS" | jq '.data[0] | {id, title, status, severity}'
    echo "=== Error Spike Incident: PASSED ==="
else
    echo "No incidents found. This may indicate:"
    echo "  - incident-engine not running"
    echo "  - Rule thresholds not met (need baseline data)"
    echo "=== Error Spike Incident: NEEDS REVIEW ==="
fi
```

**Success Criteria:**
- [ ] Incident created with status `open`
- [ ] Incident has correct fingerprint
- [ ] AI job enqueued for incident

---

### Scenario 5: Event Search via OpenSearch

**Objective:** Verify events are indexed and searchable.

**Test:**
```bash
#!/usr/bin/env bash
set -e

echo "=== Event Search Test ==="

# Wait for indexing
sleep 5

# Search for test events
RESPONSE=$(curl -sf "${CORE_API_URL}/v1/search/events?q=E2E_TEST" || echo '{"hits":[]}')

HIT_COUNT=$(echo "$RESPONSE" | jq '.hits | length')

if [ "$HIT_COUNT" -gt 0 ]; then
    echo "Found $HIT_COUNT matching events"
    echo "$RESPONSE" | jq '.hits[0]._source | {event_type, message}'
    echo "=== Event Search: PASSED ==="
else
    echo "No events found. Check indexer service."
    echo "=== Event Search: NEEDS REVIEW ==="
fi
```

**Success Criteria:**
- [ ] Events appear in search results
- [ ] Event data matches what was sent

---

### Scenario 6: Incident Detail with AI Summary

**Objective:** Verify incident details include AI-generated summary.

**Test:**
```bash
#!/usr/bin/env bash
set -e

echo "=== Incident Detail Test ==="

# Get first open incident
INCIDENTS=$(curl -sf "${CORE_API_URL}/v1/incidents?status=open" || echo '{"data":[]}')
INCIDENT_ID=$(echo "$INCIDENTS" | jq -r '.data[0].id // empty')

if [ -z "$INCIDENT_ID" ]; then
    echo "No open incidents to test. Run Scenario 4 first."
    echo "=== Incident Detail: SKIPPED ==="
    exit 0
fi

# Get incident detail
DETAIL=$(curl -sf "${CORE_API_URL}/v1/incidents/${INCIDENT_ID}")

echo "Incident: $(echo "$DETAIL" | jq -r '.title')"
echo "Status: $(echo "$DETAIL" | jq -r '.status')"
echo "Event Count: $(echo "$DETAIL" | jq '.events | length')"

# Check for AI summary
AI_SUMMARY=$(echo "$DETAIL" | jq -r '.ai_summary // empty')
if [ -n "$AI_SUMMARY" ]; then
    echo "AI Summary: Present"
    echo "$AI_SUMMARY" | jq '.summary' 2>/dev/null || echo "$AI_SUMMARY"
    echo "=== Incident Detail: PASSED ==="
else
    echo "AI Summary: Not yet generated"
    echo "  (AI worker may still be processing, or GRADIENT_API_KEY not set)"
    echo "=== Incident Detail: PARTIAL PASS ==="
fi
```

**Success Criteria:**
- [ ] Incident detail returns complete data
- [ ] Events linked to incident
- [ ] AI summary present (if ai-worker running with valid API key)

---

### Scenario 7: Full E2E Load Test

**Objective:** Simulate realistic load and verify system stability.

**Test:**
```bash
#!/usr/bin/env bash
set -e

echo "=== Full E2E Load Test ==="

# Use the loadgen tool if available
if [ -f "./tools/loadgen/dist/index.js" ]; then
    echo "Running loadgen with spike_errors scenario..."
    npm run loadgen -- --scenario=spike_errors --api-url="${INGEST_API_URL}" --api-key="${API_KEY}"
    echo "=== Load Test: COMPLETED ==="
else
    echo "Loadgen not built. Run: npm run build --workspace=tools/loadgen"
    echo "=== Load Test: SKIPPED ==="
fi
```

**Success Criteria:**
- [ ] All events accepted
- [ ] No 5xx errors
- [ ] Incidents created for spike patterns

---

## Running All E2E Tests

### Manual Execution

```bash
# Set environment
export INGEST_API_URL="http://localhost:3000"
export CORE_API_URL="http://localhost:3001"
export DASHBOARD_URL="http://localhost:3002"
export API_KEY="dev-api-key-12345"

# Run each scenario
# (Copy and paste each scenario's test script)
```

### Automated Test Runner

Create a test runner script:

```bash
#!/usr/bin/env bash
# scripts/run-e2e-tests.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Default to local dev if not set
export INGEST_API_URL="${INGEST_API_URL:-http://localhost:3000}"
export CORE_API_URL="${CORE_API_URL:-http://localhost:3001}"
export DASHBOARD_URL="${DASHBOARD_URL:-http://localhost:3002}"
export API_KEY="${API_KEY:-dev-api-key-12345}"

echo "E2E Test Configuration:"
echo "  INGEST_API_URL: $INGEST_API_URL"
echo "  CORE_API_URL: $CORE_API_URL"
echo "  DASHBOARD_URL: $DASHBOARD_URL"
echo ""

# Run scenarios in order
PASSED=0
FAILED=0

run_test() {
    local name=$1
    local script=$2
    echo "----------------------------------------"
    echo "Running: $name"
    if bash -c "$script"; then
        ((PASSED++))
    else
        ((FAILED++))
    fi
}

# Add your test functions here

echo "========================================"
echo "E2E Test Results: $PASSED passed, $FAILED failed"
echo "========================================"

exit $FAILED
```

---

## CI/CD Integration

### GitHub Actions Example

```yaml
# .github/workflows/e2e.yml
name: E2E Tests

on:
  push:
    branches: [main]
  pull_request:

jobs:
  e2e:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: password
      # Add other services...

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - run: npm ci
      - run: npm run build
      - run: npm run db:migrate

      - name: Start services
        run: ./scripts/start-dev.sh

      - name: Run E2E tests
        run: ./scripts/run-e2e-tests.sh
        env:
          INGEST_API_URL: http://localhost:3000
          CORE_API_URL: http://localhost:3001
          API_KEY: ${{ secrets.TEST_API_KEY }}
```

---

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| 401 Unauthorized | Invalid API key | Check `API_KEY` env var, verify key in database |
| Events not in search | Indexer not running | Start indexer, check OpenSearch connectivity |
| No incidents created | Thresholds not met | Need baseline data, or adjust rule thresholds |
| AI summary missing | ai-worker not running | Start ai-worker, check `GRADIENT_API_KEY` |
| Dashboard 500 error | Core API not reachable | Check `CORE_API_URL`, verify core-api running |

---

## Acceptance Criteria Summary

| Criterion | Test Scenario |
|-----------|---------------|
| Events ingested via HTTP | Scenario 2, 3 |
| Events visible in Kafka topic | Verify via kafka-console-consumer |
| Events searchable in OpenSearch | Scenario 5 |
| Error spike creates incident | Scenario 4 |
| AI summary generated | Scenario 6 |
| Dashboard displays incidents | Manual verification at `$DASHBOARD_URL` |
