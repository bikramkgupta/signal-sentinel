# Stage 6: Cloud Debug Validation

**Status**: COMPLETE
**Prerequisites**: Users & topics created (Stage 5)

---

## Overview

Configure trusted sources and deploy a debug container to validate VPC connectivity before deploying the production app.

**All captured values (IDs, passwords, URLs) are stored in `.env.secrets`** - this file contains status tracking only.

---

## Tasks

### 6.1 Get VPC CIDR

```bash
doctl vpcs get $VPC_ID --format IPRange
```

- [x] VPC CIDR saved to `.env.secrets` as `VPC_CIDR` (`10.126.0.0/20`)

### 6.2 Configure Trusted Sources (VPC CIDR)

```bash
# PostgreSQL
doctl databases firewalls append $PG_ID --rule ip_addr:10.126.0.0/20

# OpenSearch
doctl databases firewalls append $OS_ID --rule ip_addr:10.126.0.0/20
```

- [x] PostgreSQL trusted source added
- [x] OpenSearch trusted source added

**Note**: Kafka does NOT support trusted sources - skip.

### 6.3 Deploy Debug Container

```bash
doctl apps create --spec .do/app-debug.yaml
```

- [x] App created
- [x] App ID saved to `.env.secrets` as `DEBUG_APP_ID` (`057623bb-7434-4706-bb76-af6834681f33`)

### 6.4 Run Connectivity Tests

```bash
# Access debug container console
doctl apps console $DEBUG_APP_ID debug

# Inside container:
./test-db.sh postgres
./test-db.sh opensearch
./test-connectivity.sh
```

---

## Validation Checklist

| Service | Private URL | Status |
|---------|-------------|--------|
| PostgreSQL | [x] Pass | v16.11 |
| Kafka | [x] Pass | 3 brokers, 3 topics |
| OpenSearch | [x] Pass | v2.17.1 |

---

## Artifact Storage

All captured values are stored in `.env.secrets` (gitignored):
- `VPC_ID` - VPC UUID
- `VPC_CIDR` - VPC CIDR range for trusted sources
- `DEBUG_APP_ID` - Debug container app ID (`057623bb-7434-4706-bb76-af6834681f33`)

**To resume this stage**, read `.env.secrets` for context.

---

## Next Steps

Once all connectivity tests pass, proceed to Stage 7: Cloud Secrets & CI/CD
