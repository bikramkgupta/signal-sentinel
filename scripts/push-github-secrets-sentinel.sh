#!/usr/bin/env bash
# One-off: build private connection strings from doctl and push to GitHub Actions secrets.
# Requires: doctl auth, gh auth, repos bikramkgupta/signal-sentinel write access.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DO_TOKEN="$(tr -d '\n' < "${REPO_ROOT}/.DIGITALOCEAN_API_KEY")"
export DIGITALOCEAN_ACCESS_TOKEN="$DO_TOKEN"

PG_ID="fd56fcd7-4abb-492a-8214-5b9b546a40d5"
KAFKA_ID="bb7d8e42-da9b-4e80-ab8c-4869b78c31e0"
OS_ID="b23433ae-b335-476f-9498-40bc902a19d6"

echo "Resetting Postgres user password (signals_user)..."
PG_PW_JSON=$(doctl databases user reset "$PG_ID" signals_user -o json)
PG_PW=$(echo "$PG_PW_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin)[0]['password'])")
PG_HOST=$(doctl databases get "$PG_ID" -o json | python3 -c "import json,sys; d=json.load(sys.stdin); x=d[0] if isinstance(d,list) else d; print(x['private_connection']['host'])")

export PG_PW PG_HOST
DATABASE_PRIVATE_URL=$(python3 <<'PY'
import os
from urllib.parse import quote
pw = os.environ["PG_PW"]
host = os.environ["PG_HOST"]
# Use quote() not quote_plus — '+' in passwords must not become space in URI userinfo
print(f"postgresql://signals_user:{quote(pw, safe='')}@{host}:25060/signals_app?sslmode=require")
PY
)

echo "Resetting OpenSearch user password (signals_user)..."
OS_PW_JSON=$(doctl databases user reset "$OS_ID" signals_user -o json)
OS_PW=$(echo "$OS_PW_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin)[0]['password'])")
OS_HOST=$(doctl databases get "$OS_ID" -o json | python3 -c "import json,sys; d=json.load(sys.stdin); x=d[0] if isinstance(d,list) else d; print(x['private_connection']['host'])")

export OS_PW OS_HOST
OPENSEARCH_PRIVATE_URL=$(python3 <<'PY'
import os
from urllib.parse import quote
pw = os.environ["OS_PW"]
host = os.environ["OS_HOST"]
print(f"https://signals_user:{quote(pw, safe='')}@{host}:25060")
PY
)

KAFKA_HOST=$(doctl databases get "$KAFKA_ID" -o json | python3 -c "import json,sys; d=json.load(sys.stdin); x=d[0] if isinstance(d,list) else d; print(x['private_connection']['host'])")
KAFKA_PRIVATE_BROKERS="${KAFKA_HOST}:25080"

echo "Creating Spaces key + bucket (if missing)..."
KEY_NAME="sentinel-signals-$(date +%s)"
KEY_JSON=$(doctl spaces keys create "$KEY_NAME" \
  --grants 'bucket=;permission=fullaccess' \
  --output json)
SPACES_ACCESS_KEY=$(echo "$KEY_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin)[0]['access_key'])")
SPACES_SECRET_KEY=$(echo "$KEY_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin)[0]['secret_key'])")

export AWS_ACCESS_KEY_ID="$SPACES_ACCESS_KEY"
export AWS_SECRET_ACCESS_KEY="$SPACES_SECRET_KEY"
BUCKET="signals-uploads"
EP="https://syd1.digitaloceanspaces.com"
set +e
aws --endpoint-url "$EP" s3api head-bucket --bucket "$BUCKET" 2>/dev/null
HB=$?
set -e
if [ "$HB" -ne 0 ]; then
  aws --endpoint-url "$EP" s3api create-bucket --bucket "$BUCKET" \
    --create-bucket-configuration "LocationConstraint=syd1"
fi

GRADIENT_API_KEY="$(tr -d '\n' < "${REPO_ROOT}/.GRADIENT_API_KEY")"

cd "$REPO_ROOT"
echo "Pushing GitHub secrets..."

printf '%s' "$DO_TOKEN" | gh secret set DIGITALOCEAN_ACCESS_TOKEN --repo bikramkgupta/signal-sentinel
printf '%s' "$DATABASE_PRIVATE_URL" | gh secret set DATABASE_PRIVATE_URL --repo bikramkgupta/signal-sentinel
printf '%s' "$KAFKA_PRIVATE_BROKERS" | gh secret set KAFKA_PRIVATE_BROKERS --repo bikramkgupta/signal-sentinel
printf '%s' "$OPENSEARCH_PRIVATE_URL" | gh secret set OPENSEARCH_PRIVATE_URL --repo bikramkgupta/signal-sentinel
printf '%s' "$GRADIENT_API_KEY" | gh secret set GRADIENT_API_KEY --repo bikramkgupta/signal-sentinel
printf '%s' "$SPACES_ACCESS_KEY" | gh secret set SPACES_ACCESS_KEY --repo bikramkgupta/signal-sentinel
printf '%s' "$SPACES_SECRET_KEY" | gh secret set SPACES_SECRET_KEY --repo bikramkgupta/signal-sentinel

echo "Done. Listed secrets (names only):"
gh secret list --repo bikramkgupta/signal-sentinel
