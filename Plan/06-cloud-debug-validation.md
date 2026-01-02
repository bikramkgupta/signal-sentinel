# Stage 6: Cloud Debug Validation

**Status**: TODO
**Prerequisites**: Users & topics created (Stage 5)

---

## Overview

Deploy the debug container to validate VPC connectivity before deploying the production app.

---

## Tasks

### 6.1 Update app-debug.yaml

Update `.do/app-debug.yaml` with actual connection strings from Stage 5:

- [ ] Update `DATABASE_PRIVATE_URL` value (line ~53)
- [ ] Update `OPENSEARCH_PRIVATE_URL` value (line ~89)

**Note**: These are hardcoded in the debug spec (not secrets) for testing purposes.

### 6.2 Deploy Debug Container

```bash
doctl apps create --spec .do/app-debug.yaml
```

- [ ] App created successfully
- [ ] Capture app ID: `DEBUG_APP_ID=`

### 6.3 Get VPC Egress IP

```bash
DEBUG_APP_ID=$(doctl apps list --format ID,Spec.Name --no-header | grep signals-debug | awk '{print $1}')
doctl apps get $DEBUG_APP_ID -o json | jq -r '.. | .egress_ips? // empty | .[]'
```

- [ ] VPC Egress IP: `____________`

### 6.4 Configure Trusted Sources

```bash
# Add VPC egress IP to PostgreSQL trusted sources
doctl databases firewalls append $PG_ID --rule ip_addr:<VPC_EGRESS_IP>

# Add VPC egress IP to OpenSearch trusted sources
doctl databases firewalls append $OS_ID --rule ip_addr:<VPC_EGRESS_IP>
```

- [ ] PostgreSQL trusted source added
- [ ] OpenSearch trusted source added

**Note**: Kafka does NOT support trusted sources - skip this step for Kafka.

### 6.5 Run Connectivity Tests

```bash
# Access debug container console
doctl apps console $DEBUG_APP_ID debug

# Inside container, run:
./test-db.sh postgres       # Test PostgreSQL (public + private)
./test-db.sh opensearch     # Test OpenSearch (public + private)
./test-connectivity.sh      # Test all services including Kafka
```

---

## Validation Checklist

| Service | Public URL | Private URL | Status |
|---------|------------|-------------|--------|
| PostgreSQL | [ ] Pass | [ ] Pass | |
| Kafka | [ ] Pass | [ ] Pass | |
| OpenSearch | [ ] Pass | [ ] Pass | |

---

## Troubleshooting

### Connection Refused
1. Check trusted sources: `doctl databases firewalls list $PG_ID`
2. Verify VPC egress IP is correct
3. Wait 2-3 minutes for trusted source propagation

### DNS Resolution Failure
1. Verify VPC ID matches: `doctl vpcs list`
2. Check private hostname format (should start with `private-`)
3. Test DNS: `dig private-signals-postgres-...`

### SSL/TLS Errors
1. DigitalOcean uses self-signed certificates
2. Services should use `rejectUnauthorized=false` or accept CA cert
3. For psql: use `sslmode=require` (not `verify-full`)

---

## Debug Container Console Commands

```bash
# PostgreSQL test
psql "$DATABASE_PRIVATE_URL" -c "SELECT 1"

# OpenSearch test
curl -k "$OPENSEARCH_PRIVATE_URL/_cluster/health?pretty"

# Kafka test (produce)
echo "test" | kcat -b $KAFKA_PRIVATE_BROKERS -P -t signals.raw.v1 \
  -X security.protocol=SASL_SSL \
  -X sasl.mechanisms=SCRAM-SHA-256 \
  -X sasl.username=$KAFKA_USERNAME \
  -X sasl.password=$KAFKA_PASSWORD

# Kafka test (consume)
kcat -b $KAFKA_PRIVATE_BROKERS -C -t signals.raw.v1 -c 1 \
  -X security.protocol=SASL_SSL \
  -X sasl.mechanisms=SCRAM-SHA-256 \
  -X sasl.username=$KAFKA_USERNAME \
  -X sasl.password=$KAFKA_PASSWORD
```

---

## Next Steps

Once all connectivity tests pass:
1. Keep debug container running (useful for troubleshooting production)
2. Proceed to Stage 7: Configure GitHub Secrets
