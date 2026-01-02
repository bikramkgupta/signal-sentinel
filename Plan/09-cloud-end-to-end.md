# Stage 9: Cloud End-to-End Validation

**Status**: TODO
**Prerequisites**: Production app deployed (Stage 8)

---

## Overview

Validate the complete data flow from event ingestion through AI summarization.

---

## Application URL

```bash
APP_URL=$(doctl apps get $APP_ID --format DefaultIngress --no-header)
echo $APP_URL
```

App URL: `https://signals-copilot-_____.ondigitalocean.app`

---

## Tests

### 9.1 Database Seeding

Before testing, ensure seed data exists (org, project, API key):

```bash
# Option 1: Run seed via debug container
doctl apps console $DEBUG_APP_ID debug
psql "$DATABASE_PRIVATE_URL" -f /path/to/seed.sql

# Option 2: Manual insert
psql "$DATABASE_PRIVATE_URL" << 'EOF'
INSERT INTO orgs (id, name) VALUES ('org_123', 'Test Organization');
INSERT INTO projects (id, org_id, name) VALUES ('proj_123', 'org_123', 'Test Project');
INSERT INTO project_api_keys (id, project_id, key_hash)
VALUES ('key_123', 'proj_123', encode(sha256('test-api-key-12345'::bytea), 'hex'));
EOF
```

- [ ] Seed data inserted

### 9.2 Event Ingestion

```bash
curl -X POST $APP_URL/v1/events \
  -H "Content-Type: application/json" \
  -H "X-API-Key: test-api-key-12345" \
  -d '{
    "events": [{
      "event_type": "error",
      "environment": "production",
      "severity": "error",
      "message": "NullPointerException in UserService.authenticate()",
      "occurred_at": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
      "attributes": {
        "route": "/api/login",
        "error_code": "NPE_001",
        "release": "v1.2.3"
      }
    }]
  }'
```

- [ ] Response: `202 Accepted`
- [ ] Body: `{"accepted":1,"failed":0}`

### 9.3 Kafka Message Flow

Verify messages are flowing through Kafka:

```bash
# Via debug container
doctl apps console $DEBUG_APP_ID debug

# Check signals.raw.v1 topic has messages
kcat -b $KAFKA_PRIVATE_BROKERS -C -t signals.raw.v1 -c 1 \
  -X security.protocol=SASL_SSL \
  -X sasl.mechanisms=SCRAM-SHA-256 \
  -X sasl.username=$KAFKA_USERNAME \
  -X sasl.password=$KAFKA_PASSWORD
```

- [ ] Message visible in `signals.raw.v1` topic

### 9.4 Kafka Consumer Groups

```bash
# Check consumer groups are registered
kcat -b $KAFKA_BROKERS -L \
  -X security.protocol=SASL_SSL \
  -X sasl.mechanisms=SCRAM-SHA-256 \
  -X sasl.username=$KAFKA_USERNAME \
  -X sasl.password=$KAFKA_PASSWORD | grep -E "(group|indexer|incident|ai)"
```

- [ ] `indexer-group` registered
- [ ] `incident-engine-group` registered
- [ ] `ai-worker-group` registered

### 9.5 OpenSearch Indexing

```bash
# Check event was indexed
curl -k "$OPENSEARCH_PRIVATE_URL/signals-events-v1/_search?pretty" \
  -H "Content-Type: application/json" \
  -d '{"query":{"match_all":{}},"size":1}'
```

- [ ] Event document returned

### 9.6 Incident Creation

```bash
curl $APP_URL/v1/incidents | jq
```

- [ ] Incident created for test event
- [ ] Status: `open`
- [ ] Severity: `error`

### 9.7 AI Summary Generation

Wait 30-60 seconds for AI worker to process:

```bash
# Check via API
curl "$APP_URL/v1/incidents" | jq '.[0].ai_summary'

# Or via database
psql "$DATABASE_PRIVATE_URL" -c "SELECT * FROM ai_outputs ORDER BY created_at DESC LIMIT 1"
```

- [ ] AI summary generated (or job in queue if Gradient not configured)

### 9.8 Dashboard Validation

Open browser: `$APP_URL`

- [ ] Overview page loads with stats
- [ ] Stats show: 1 incident, error count
- [ ] Incidents page lists test incident
- [ ] Incident detail shows AI summary (if available)
- [ ] Dark mode toggle works
- [ ] Search page functional

---

## Final Validation Checklist

| Test | Status |
|------|--------|
| Event ingestion via API | [ ] |
| Kafka message flow | [ ] |
| Consumer groups active | [ ] |
| OpenSearch indexing | [ ] |
| Incident creation | [ ] |
| AI summarization | [ ] |
| Dashboard display | [ ] |

---

## Load Test (Optional)

If you want to validate under load:

```bash
# Via loadgen tool (if available)
npm run loadgen -- --mode spike_errors --duration 60 --rate 10

# This sends 10 events/second for 60 seconds
# Expected: ~600 events, multiple incidents created
```

---

## Cleanup Test Data (Optional)

```bash
# Clear test incidents
psql "$DATABASE_PRIVATE_URL" -c "DELETE FROM incidents WHERE environment = 'production' AND title LIKE '%NullPointerException%'"

# Clear OpenSearch test data
curl -k -X DELETE "$OPENSEARCH_PRIVATE_URL/signals-events-v1"
```

---

## Deployment Complete

- [ ] All tests passed
- [ ] Production app is fully functional
- [ ] Ready for real traffic

---

## Next Steps

1. **Configure custom domain** (optional)
2. **Set up monitoring/alerts** (optional)
3. **Enable CI/CD workflow** (`.github/workflows/deploy.yml`)
4. **Archive debug container** (keep for troubleshooting)
