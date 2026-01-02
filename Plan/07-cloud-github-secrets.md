# Stage 7: Cloud GitHub Secrets

**Status**: TODO
**Prerequisites**: Debug validation passed (Stage 6)

---

## Overview

Configure GitHub repository secrets for production deployment. These secrets are referenced in `.do/app.yaml` using `${SECRET_NAME}` syntax.

---

## Required Secrets

| Secret Name | Source | Set? |
|-------------|--------|------|
| `DIGITALOCEAN_ACCESS_TOKEN` | DO Console → API → Tokens | [ ] |
| `DATABASE_PRIVATE_URL` | Stage 5 connection info | [ ] |
| `KAFKA_PRIVATE_BROKERS` | Stage 5 connection info | [ ] |
| `OPENSEARCH_PRIVATE_URL` | Stage 5 connection info | [ ] |
| `GRADIENT_API_KEY` | DO Console → Serverless → Model Access Keys | [ ] |
| `SPACES_ACCESS_KEY` | DO Console → Spaces → Manage Keys | [ ] |
| `SPACES_SECRET_KEY` | DO Console → Spaces → Manage Keys | [ ] |

---

## Secret Values Reference

### DATABASE_PRIVATE_URL
```
postgresql://signals_user:<PASSWORD>@private-signals-postgres-do-user-<ID>.e.db.ondigitalocean.com:25060/signals_app?sslmode=require
```

### KAFKA_PRIVATE_BROKERS
```
private-signals-kafka-do-user-<ID>.e.db.ondigitalocean.com:25080
```

### OPENSEARCH_PRIVATE_URL
```
https://signals_user:<PASSWORD>@private-signals-opensearch-do-user-<ID>.e.db.ondigitalocean.com:25060
```

---

## Set Secrets via GitHub CLI

```bash
# Set each secret (will prompt for value)
gh secret set DIGITALOCEAN_ACCESS_TOKEN
gh secret set DATABASE_PRIVATE_URL
gh secret set KAFKA_PRIVATE_BROKERS
gh secret set OPENSEARCH_PRIVATE_URL
gh secret set GRADIENT_API_KEY
gh secret set SPACES_ACCESS_KEY
gh secret set SPACES_SECRET_KEY
```

---

## Set Secrets via GitHub Web UI

1. Navigate to: Repository → Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Add each secret with name and value
4. Repeat for all 7 secrets

---

## Verification

```bash
# List all secrets (values are hidden)
gh secret list
```

Expected output:
```
DIGITALOCEAN_ACCESS_TOKEN  Updated 2026-01-01
DATABASE_PRIVATE_URL       Updated 2026-01-01
KAFKA_PRIVATE_BROKERS      Updated 2026-01-01
OPENSEARCH_PRIVATE_URL     Updated 2026-01-01
GRADIENT_API_KEY           Updated 2026-01-01
SPACES_ACCESS_KEY          Updated 2026-01-01
SPACES_SECRET_KEY          Updated 2026-01-01
```

---

## Notes

### GRADIENT_API_KEY
- Obtain from: DO Console → Serverless → Model Access Keys
- Required for AI summarization feature
- If not available, AI worker will fail but other services will work

### SPACES_ACCESS_KEY / SPACES_SECRET_KEY
- Obtain from: DO Console → Spaces → Manage Keys
- Used for file uploads (if applicable)
- Can be skipped if file uploads not needed initially

---

## Checklist

- [ ] All 7 secrets added to GitHub
- [ ] `gh secret list` shows all secrets
- [ ] Ready for production deployment (Stage 8)
