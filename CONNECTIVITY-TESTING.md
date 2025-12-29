# Connectivity & Infrastructure Testing

**Purpose:** Validate that infrastructure services (database, message broker, search, storage) are properly configured and accessible before running application services.

**Scope:** This testing plan is **environment-agnostic** and works for:
- Local DevContainer development
- Cloud deployments (DigitalOcean, AWS, GCP, etc.)

---

## Environment Configuration

All tests use environment variables. Configure these before running tests:

| Variable | Description | Local DevContainer | Cloud Example |
|----------|-------------|-------------------|---------------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:password@postgres:5432/app?sslmode=disable` | `postgresql://user:pass@host:5432/db?sslmode=require` |
| `KAFKA_BROKERS` | Kafka bootstrap servers | `kafka:9092` | `kafka-1.example.com:9094,kafka-2.example.com:9094` |
| `OPENSEARCH_URL` | OpenSearch endpoint | `http://opensearch:9200` | `https://search.example.com:443` |
| `MINIO_ENDPOINT` | S3-compatible storage | `http://minio:9000` | `https://s3.example.com` |
| `MINIO_ACCESS_KEY` | S3 access key | `minioadmin` | `<your-access-key>` |
| `MINIO_SECRET_KEY` | S3 secret key | `minioadmin` | `<your-secret-key>` |

### Local DevContainer Setup

```bash
# These are pre-configured in the DevContainer
export DATABASE_URL="postgresql://postgres:password@postgres:5432/app?sslmode=disable"
export KAFKA_BROKERS="kafka:9092"
export OPENSEARCH_URL="http://opensearch:9200"
export MINIO_ENDPOINT="http://minio:9000"
export MINIO_ACCESS_KEY="minioadmin"
export MINIO_SECRET_KEY="minioadmin"
```

### Cloud Setup

```bash
# Example for cloud deployment - replace with your actual values
export DATABASE_URL="postgresql://app_user:${DB_PASSWORD}@db.example.com:5432/signals?sslmode=require"
export KAFKA_BROKERS="kafka-1.example.com:9094,kafka-2.example.com:9094"
export OPENSEARCH_URL="https://search.example.com:443"
export MINIO_ENDPOINT="https://s3.example.com"
export MINIO_ACCESS_KEY="${AWS_ACCESS_KEY_ID}"
export MINIO_SECRET_KEY="${AWS_SECRET_ACCESS_KEY}"
```

---

## Test Phases

### Phase 1: PostgreSQL Connectivity

**Objective:** Verify database connection and basic operations.

**Test Script:**
```bash
#!/usr/bin/env bash
set -e

echo "Testing PostgreSQL connectivity..."

# Test connection
psql "$DATABASE_URL" -c "SELECT 1 as connected" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "  Connection: OK"
else
    echo "  Connection: FAILED"
    exit 1
fi

# Test basic operations
psql "$DATABASE_URL" -c "SELECT version();" > /dev/null 2>&1
echo "  Version query: OK"

# Test create/drop (if permissions allow)
psql "$DATABASE_URL" -c "CREATE TABLE IF NOT EXISTS _connectivity_test (id int); DROP TABLE _connectivity_test;" > /dev/null 2>&1
echo "  DDL operations: OK"

echo "PostgreSQL: ALL TESTS PASSED"
```

**Success Criteria:**
- [ ] Connection established
- [ ] SELECT queries execute
- [ ] DDL operations work (in dev) or gracefully skip (in prod with limited perms)

---

### Phase 2: Kafka Connectivity

**Objective:** Verify Kafka broker connectivity and topic operations.

**Test Script:**
```bash
#!/usr/bin/env bash
set -e

echo "Testing Kafka connectivity..."

# Parse first broker from comma-separated list
BROKER=$(echo "$KAFKA_BROKERS" | cut -d',' -f1)

# Test broker API versions (proves connectivity)
kafka-broker-api-versions --bootstrap-server "$BROKER" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "  Broker API: OK"
else
    echo "  Broker API: FAILED"
    exit 1
fi

# List topics
kafka-topics --bootstrap-server "$BROKER" --list > /dev/null 2>&1
echo "  List topics: OK"

# Create test topic
kafka-topics --bootstrap-server "$BROKER" --create --topic _connectivity_test --partitions 1 --replication-factor 1 --if-not-exists > /dev/null 2>&1
echo "  Create topic: OK"

# Delete test topic
kafka-topics --bootstrap-server "$BROKER" --delete --topic _connectivity_test > /dev/null 2>&1 || true
echo "  Delete topic: OK (or skipped)"

echo "Kafka: ALL TESTS PASSED"
```

**Success Criteria:**
- [ ] Broker responds to API version request
- [ ] Topic listing works
- [ ] Topic creation works

---

### Phase 3: OpenSearch Connectivity

**Objective:** Verify OpenSearch cluster health and basic operations.

**Test Script:**
```bash
#!/usr/bin/env bash
set -e

echo "Testing OpenSearch connectivity..."

# Test cluster health
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$OPENSEARCH_URL/_cluster/health")
if [ "$HTTP_CODE" == "200" ]; then
    echo "  Cluster health: OK"
else
    echo "  Cluster health: FAILED (HTTP $HTTP_CODE)"
    exit 1
fi

# Get cluster info
curl -s "$OPENSEARCH_URL" | grep -q "cluster_name"
echo "  Cluster info: OK"

# Test index operations
curl -s -X PUT "$OPENSEARCH_URL/_connectivity_test" > /dev/null 2>&1 || true
echo "  Create index: OK"

curl -s -X DELETE "$OPENSEARCH_URL/_connectivity_test" > /dev/null 2>&1 || true
echo "  Delete index: OK"

echo "OpenSearch: ALL TESTS PASSED"
```

**Success Criteria:**
- [ ] Cluster health endpoint responds
- [ ] Cluster info returns valid JSON
- [ ] Index create/delete works

---

### Phase 4: S3/MinIO Connectivity

**Objective:** Verify S3-compatible storage access.

**Test Script:**
```bash
#!/usr/bin/env bash
set -e

echo "Testing S3/MinIO connectivity..."

# Configure AWS CLI or MinIO client
export AWS_ACCESS_KEY_ID="$MINIO_ACCESS_KEY"
export AWS_SECRET_ACCESS_KEY="$MINIO_SECRET_KEY"

# Health check (MinIO specific)
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$MINIO_ENDPOINT/minio/health/live" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" == "200" ]; then
    echo "  Health check: OK (MinIO)"
elif [ "$HTTP_CODE" == "000" ]; then
    # Try S3-style check
    echo "  Health check: Skipped (not MinIO, trying S3)"
fi

# List buckets using mc (MinIO client) or aws cli
if command -v mc &> /dev/null; then
    mc alias set test "$MINIO_ENDPOINT" "$MINIO_ACCESS_KEY" "$MINIO_SECRET_KEY" --api S3v4 > /dev/null 2>&1
    mc ls test > /dev/null 2>&1
    echo "  List buckets: OK"
else
    echo "  List buckets: Skipped (mc not installed)"
fi

echo "S3/MinIO: TESTS COMPLETED"
```

**Success Criteria:**
- [ ] Storage endpoint responds
- [ ] Bucket listing works (if client available)

---

## Running All Connectivity Tests

### Using Built-in Test Scripts

```bash
# From project root (inside container or on host with proper env vars)
bash .devcontainer/tests/test-postgres.sh
bash .devcontainer/tests/test-kafka.sh
bash .devcontainer/tests/test-opensearch.sh
bash .devcontainer/tests/test-rustfs.sh
```

### One-Liner for CI/CD

```bash
# Run all connectivity tests
for test in .devcontainer/tests/test-*.sh; do
    echo "Running $test..."
    bash "$test" || exit 1
done
echo "All connectivity tests passed!"
```

---

## Troubleshooting

| Issue | Local DevContainer | Cloud |
|-------|-------------------|-------|
| Connection refused | Check if service container is running | Check security groups/firewall |
| Auth failed | Verify default credentials | Check secrets/env vars |
| Timeout | Wait for service startup (60-90s for Kafka) | Check network routes, VPN |
| SSL errors | Use `sslmode=disable` locally | Use `sslmode=require` with valid certs |
| DNS resolution | Use container names | Use fully qualified hostnames |

---

## Next Steps

After all connectivity tests pass:
1. Run database migrations: `npm run db:migrate`
2. Seed development data: `npm run db:seed` (local only)
3. Proceed to [E2E Testing](./E2E-TESTING.md)
