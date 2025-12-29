# Manual Testing Commands

This document contains verified working commands for manually testing and debugging the development environment.

## Prerequisites

All commands assume you are running inside the DevContainer. Container hostnames (e.g., `opensearch`, `kafka`) are accessible from within the DevContainer.

---

## Kafka

Container: `customer-signals-copilot-claude-kafka-1`
Commands are in `/usr/bin/` (no `.sh` extension)

### List Topics
```bash
docker exec customer-signals-copilot-claude-kafka-1 /usr/bin/kafka-topics --bootstrap-server localhost:9092 --list
```

### Describe a Topic
```bash
docker exec customer-signals-copilot-claude-kafka-1 /usr/bin/kafka-topics --bootstrap-server localhost:9092 --describe --topic signals.raw.v1
```

### Consume Messages (Recent)
```bash
# Consume last 5 messages with timeout
docker exec customer-signals-copilot-claude-kafka-1 /usr/bin/kafka-console-consumer \
  --bootstrap-server localhost:9092 \
  --topic signals.raw.v1 \
  --from-beginning \
  --max-messages 5 \
  --timeout-ms 10000
```

### List Consumer Groups
```bash
docker exec customer-signals-copilot-claude-kafka-1 /usr/bin/kafka-consumer-groups --bootstrap-server localhost:9092 --list
```

### Check Consumer Group Lag
```bash
docker exec customer-signals-copilot-claude-kafka-1 /usr/bin/kafka-consumer-groups \
  --bootstrap-server localhost:9092 \
  --describe \
  --group <group-name>
```

### Available Topics
- `signals.raw.v1` - Raw ingested events
- `signals.ai.jobs.v1` - AI processing jobs

---

## OpenSearch

Hostname: `opensearch` (from inside DevContainer)
Port: 9200

### List Indices
```bash
curl http://opensearch:9200/_cat/indices?v
```

### Cluster Health
```bash
curl http://opensearch:9200/_cluster/health?pretty
```

### Count Documents
```bash
curl http://opensearch:9200/signals-events-v1/_count?pretty
```

### Search Events (Recent)
```bash
curl "http://opensearch:9200/signals-events-v1/_search?pretty&size=5"
```

### Search with Query
```bash
curl -X POST "http://opensearch:9200/signals-events-v1/_search?pretty" \
  -H 'Content-Type: application/json' \
  -d '{"query": {"match": {"message": "error"}}}'
```

### Search by Event Type
```bash
curl -X POST "http://opensearch:9200/signals-events-v1/_search?pretty" \
  -H 'Content-Type: application/json' \
  -d '{"query": {"term": {"event_type": "error"}}}'
```

### Search by Time Range
```bash
curl -X POST "http://opensearch:9200/signals-events-v1/_search?pretty" \
  -H 'Content-Type: application/json' \
  -d '{
    "query": {
      "range": {
        "occurred_at": {
          "gte": "now-1h",
          "lte": "now"
        }
      }
    }
  }'
```

### View Index Mapping
```bash
curl http://opensearch:9200/signals-events-v1/_mapping?pretty
```

---

## PostgreSQL

Container: `customer-signals-copilot-claude-postgres-1`
Database: `app`

### Interactive Shell
```bash
docker exec -it customer-signals-copilot-claude-postgres-1 psql -U postgres -d app
```

### Count Incidents
```bash
docker exec customer-signals-copilot-claude-postgres-1 psql -U postgres -d app \
  -c "SELECT COUNT(*) FROM incidents;"
```

### View Incidents
```bash
docker exec customer-signals-copilot-claude-postgres-1 psql -U postgres -d app \
  -c "SELECT id, status, severity, title, opened_at FROM incidents ORDER BY opened_at DESC;"
```

### View Incident Events
```bash
docker exec customer-signals-copilot-claude-postgres-1 psql -U postgres -d app \
  -c "SELECT * FROM incident_events ORDER BY occurred_at DESC LIMIT 10;"
```

### View AI Outputs
```bash
docker exec customer-signals-copilot-claude-postgres-1 psql -U postgres -d app \
  -c "SELECT incident_id, output_type, model, created_at FROM ai_outputs;"
```

### List Tables
```bash
docker exec customer-signals-copilot-claude-postgres-1 psql -U postgres -d app \
  -c "\\dt"
```

---

## Core-API

Host: `localhost`
Port: 3001

### Health Check
```bash
curl http://localhost:3001/healthz
```

### List Incidents
```bash
curl http://localhost:3001/v1/incidents | jq
```

### Get Single Incident
```bash
curl http://localhost:3001/v1/incidents/<incident-id> | jq
```

### Search Events
```bash
curl "http://localhost:3001/v1/search/events?limit=10" | jq
```

### Search with Query
```bash
curl "http://localhost:3001/v1/search/events?q=error&limit=10" | jq
```

### Filter by Event Type
```bash
curl "http://localhost:3001/v1/search/events?event_type=error&limit=10" | jq
```

### Filter by Severity
```bash
curl "http://localhost:3001/v1/search/events?severity=error&limit=10" | jq
```

---

## OpenSearch Dashboards

Access via browser at the forwarded port (check VS Code Ports panel).

### Create Index Pattern (Manual)
1. Open OpenSearch Dashboards UI
2. Go to Management -> Index Patterns
3. Create pattern: `signals-events-v1`
4. Select `occurred_at` as time field
5. Save

### Create Index Pattern (API)
```bash
curl -X POST "http://opensearch-dashboards:5601/api/saved_objects/index-pattern/signals-events-v1" \
  -H "osd-xsrf: true" \
  -H "Content-Type: application/json" \
  -d '{"attributes":{"title":"signals-events-v1","timeFieldName":"occurred_at"}}'
```

---

## Service Logs

Logs are stored in `.dev-pids/` directory:

```bash
# View specific service log
tail -f .dev-pids/ingest-api.log
tail -f .dev-pids/indexer.log
tail -f .dev-pids/incident-engine.log
tail -f .dev-pids/ai-worker.log
tail -f .dev-pids/core-api.log
tail -f .dev-pids/dashboard.log
tail -f .dev-pids/loadgen.log
```

---

## Quick Health Check

Run all health checks at once:

```bash
echo "=== Core-API ===" && curl -s http://localhost:3001/healthz | jq
echo "=== OpenSearch ===" && curl -s http://opensearch:9200/_cluster/health | jq -r '.status'
echo "=== Event Count ===" && curl -s http://opensearch:9200/signals-events-v1/_count | jq -r '.count'
echo "=== Incident Count ===" && docker exec customer-signals-copilot-claude-postgres-1 psql -U postgres -d app -t -c "SELECT COUNT(*) FROM incidents;"
echo "=== Kafka Topics ===" && docker exec customer-signals-copilot-claude-kafka-1 /usr/bin/kafka-topics --bootstrap-server localhost:9092 --list
```
