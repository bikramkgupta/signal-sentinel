# Stage 8: Cloud Deploy Production

**Status**: DONE
**Completed**: 2026-01-02
**Prerequisites**: GitHub secrets configured (Stage 7)
**App URL**: https://signals-copilot-ut9gy.ondigitalocean.app

---

## Overview

Deploy the full production application with all services and workers.

---

## Pre-Deployment Checklist

### Build Validation (CRITICAL - from Stage 3)
- [ ] `doctl app dev build` passed for ALL components locally
- [ ] Health check endpoints verified locally (`curl -f localhost:PORT/healthz`)
- [ ] Health paths in app.yaml match actual endpoints

### Configuration
- [ ] `.do/app.yaml` has correct VPC ID (`20ccc9c3-2bad-40dc-9669-8d5ef784b765`)
- [ ] All SECRET type env vars reference `${SECRET_NAME}` format
- [ ] `deploy_on_push` set to preferred value
- [ ] All 7 GitHub secrets are configured
- [ ] Debug container connectivity tests passed (Stage 6)

**STOP**: If local builds or health checks failed in Stage 3, fix them before proceeding. Cloud builds take 5-10 minutes to fail on errors that local builds catch in seconds.

---

## Deploy

```bash
doctl apps create --spec .do/app.yaml
```

- [ ] App creation started
- [ ] Capture app ID: `APP_ID=`

---

## Monitor Deployment

### Get App ID
```bash
APP_ID=$(doctl apps list --format ID,Spec.Name --no-header | grep signals-copilot | awk '{print $1}')
```

### Watch Build Logs
```bash
# Each service builds separately
doctl apps logs $APP_ID --type build --follow
```

### Watch Deployment Logs
```bash
doctl apps logs $APP_ID --type deploy --follow
```

### Check Status
```bash
doctl apps get $APP_ID --format DefaultIngress,ActiveDeployment.Phase
```

---

## Build Progress

| Component | Build Status | Notes |
|-----------|--------------|-------|
| ingest-api | [ ] | |
| core-api | [ ] | |
| dashboard | [ ] | |
| indexer | [ ] | |
| incident-engine | [ ] | |
| ai-worker | [ ] | |
| db-migrate (PRE_DEPLOY) | [ ] | Runs first |

---

## Health Check Verification

**Note**: These should already pass since you validated them locally in Stage 3, Step 10.

| Service | Endpoint | Expected | Verified Local | Cloud Status |
|---------|----------|----------|----------------|--------------|
| ingest-api | /healthz | 200 OK | [ ] (Stage 3) | [ ] |
| core-api | /api/healthz | 200 OK | [ ] (Stage 3) | [ ] |
| dashboard | / | 200 OK | [ ] (Stage 3) | [ ] |

```bash
# Test health endpoints in cloud
APP_URL=$(doctl apps get $APP_ID --format DefaultIngress --no-header)
curl -sf $APP_URL/healthz && echo "ingest-api OK" || echo "ingest-api FAILED"
curl -sf $APP_URL/api/healthz && echo "core-api OK" || echo "core-api FAILED"
curl -sf $APP_URL/ > /dev/null && echo "dashboard OK" || echo "dashboard FAILED"
```

### If Health Check Fails in Cloud but Passed Locally

| Symptom | Likely Cause | Solution |
|---------|--------------|----------|
| Timeout | Missing env var at runtime | Check `${SECRET_NAME}` bindings |
| 500 error | Database not connected | Verify trusted sources (Stage 6) |
| Connection refused | Wrong HTTP_PORT | Check app.yaml `http_port` matches code |

---

## Worker Verification

Workers don't have HTTP endpoints, so verify via logs:

```bash
# Check indexer is consuming
doctl apps logs $APP_ID indexer --follow

# Check incident-engine is consuming
doctl apps logs $APP_ID incident-engine --follow

# Check ai-worker is processing
doctl apps logs $APP_ID ai-worker --follow
```

Expected log patterns:
- `indexer`: "Kafka consumer connected", "Processing batch"
- `incident-engine`: "Kafka consumer connected", "Processing event"
- `ai-worker`: "Connected to database", "Waiting for jobs"

---

## Deployment Result

- [x] App URL: https://signals-copilot-ut9gy.ondigitalocean.app
- [x] All 3 HTTP services healthy (ingest-api, core-api, dashboard)
- [x] All 3 workers running (indexer, incident-engine, ai-worker)
- [x] No deployment errors

### Deployment Method

**GitHub Actions with app_action v2** (not deploy_on_push)

The native `deploy_on_push` doesn't inject GitHub Secrets into `${VAR}` placeholders.
Use `.github/workflows/deploy.yml` with `digitalocean/app_action/deploy@v2` instead.

---

## Troubleshooting

### Build Failures
```bash
# View detailed build logs
doctl apps logs $APP_ID --type build --component <component-name>
```

### Runtime Errors
```bash
# View runtime logs for specific component
doctl apps logs $APP_ID --type run --component <component-name> --follow
```

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Build fails | Dockerfile/dependency issue | Should have been caught by `doctl app dev build` in Stage 3 |
| Health check timeout | App not starting | Should have been caught locally in Stage 3, Step 10 |
| Database connection refused | Trusted sources not configured | Add VPC IP (Stage 6) |
| Kafka auth failed | Wrong credentials | Verify KAFKA_USERNAME/PASSWORD bindings |
| PRE_DEPLOY job failed | Migration error | Check DATABASE_URL connectivity |

### Why Local Validation Matters

| Failure Type | Cloud Feedback Time | Local Feedback Time |
|--------------|---------------------|---------------------|
| Dockerfile syntax error | 5-10 minutes | 30 seconds |
| Missing dependency | 5-10 minutes | 30 seconds |
| Health check returns 404 | 5-10 minutes | 1 second |
| Health check returns 500 | 5-10 minutes | 1 second |

**If you skipped Stage 3 Steps 9-10, go back and run them now.**

---

## Rollback

If deployment fails:

```bash
# Delete the app
doctl apps delete $APP_ID

# Fix issues in app.yaml or secrets

# Redeploy
doctl apps create --spec .do/app.yaml
```

Note: Managed databases persist independently and won't be affected.
