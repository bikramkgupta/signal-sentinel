#!/bin/bash
# =============================================================================
# Create DO Managed Services for Customer Signals Copilot
# =============================================================================
# This script creates all managed services required for deployment.
# Run with: ./scripts/create-managed-services.sh
#
# Note: Each service may take several minutes to provision.
# =============================================================================

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

REGION="syd1"

echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  DO Managed Services Setup - Customer Signals Copilot      ${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}Region: ${REGION}${NC}"
echo ""

# Check if doctl is authenticated
if ! doctl account get &>/dev/null; then
    echo -e "${RED}Error: doctl is not authenticated. Run 'doctl auth init' first.${NC}"
    exit 1
fi

# =============================================================================
# Helper Functions
# =============================================================================

get_cluster_id() {
    local name=$1
    doctl databases list --format ID,Name --no-header 2>/dev/null | grep "$name" | awk '{print $1}'
}

wait_for_cluster() {
    local cluster_id=$1
    local name=$2
    echo -e "${YELLOW}Waiting for ${name} to be online...${NC}"

    local max_attempts=60
    local attempt=0

    while [ $attempt -lt $max_attempts ]; do
        local status=$(doctl databases get "$cluster_id" --format Status --no-header 2>/dev/null)
        if [ "$status" = "online" ]; then
            echo -e "${GREEN}${name} is online!${NC}"
            return 0
        fi
        echo -n "."
        sleep 10
        attempt=$((attempt + 1))
    done

    echo -e "${RED}Timeout waiting for ${name}${NC}"
    return 1
}

# =============================================================================
# Step 1: PostgreSQL
# =============================================================================
echo -e "${GREEN}Step 1: Creating PostgreSQL cluster...${NC}"

# Check if already exists
PG_CLUSTER_ID=$(get_cluster_id "signals-postgres")

if [ -n "$PG_CLUSTER_ID" ]; then
    echo -e "${YELLOW}PostgreSQL cluster 'signals-postgres' already exists (ID: ${PG_CLUSTER_ID})${NC}"
else
    echo "Creating PostgreSQL cluster..."
    doctl databases create signals-postgres \
        --engine pg \
        --region "$REGION" \
        --size db-s-1vcpu-2gb \
        --version 16 \
        --wait

    PG_CLUSTER_ID=$(get_cluster_id "signals-postgres")
    echo -e "${GREEN}PostgreSQL cluster created (ID: ${PG_CLUSTER_ID})${NC}"
fi

# Create database and user
echo "Creating database 'signals_app'..."
doctl databases db create "$PG_CLUSTER_ID" signals_app 2>/dev/null || echo "Database may already exist"

echo "Creating user 'signals_user'..."
doctl databases user create "$PG_CLUSTER_ID" signals_user 2>/dev/null || echo "User may already exist"

echo -e "${GREEN}PostgreSQL setup complete!${NC}"
echo ""

# =============================================================================
# Step 2: Kafka
# =============================================================================
echo -e "${GREEN}Step 2: Creating Kafka cluster...${NC}"
echo -e "${YELLOW}NOTE: Kafka does NOT support trusted sources - this is expected${NC}"

KAFKA_CLUSTER_ID=$(get_cluster_id "signals-kafka")

if [ -n "$KAFKA_CLUSTER_ID" ]; then
    echo -e "${YELLOW}Kafka cluster 'signals-kafka' already exists (ID: ${KAFKA_CLUSTER_ID})${NC}"
else
    echo "Creating Kafka cluster (this may take 10-15 minutes)..."
    # Kafka requires minimum 3 nodes for standard sizes
    doctl databases create signals-kafka \
        --engine kafka \
        --region "$REGION" \
        --size db-s-2vcpu-4gb \
        --num-nodes 3 \
        --version 3.8 \
        --wait

    KAFKA_CLUSTER_ID=$(get_cluster_id "signals-kafka")
    echo -e "${GREEN}Kafka cluster created (ID: ${KAFKA_CLUSTER_ID})${NC}"
fi

# Create topics
echo "Creating topic 'signals.raw.v1'..."
doctl databases topics create "$KAFKA_CLUSTER_ID" signals.raw.v1 \
    --partition-count 3 \
    --replication-factor 2 2>/dev/null || echo "Topic may already exist"

echo "Creating topic 'signals.ai.jobs.v1'..."
doctl databases topics create "$KAFKA_CLUSTER_ID" signals.ai.jobs.v1 \
    --partition-count 3 \
    --replication-factor 2 2>/dev/null || echo "Topic may already exist"

echo "Creating topic 'signals.dlq.v1'..."
doctl databases topics create "$KAFKA_CLUSTER_ID" signals.dlq.v1 \
    --partition-count 3 \
    --replication-factor 2 2>/dev/null || echo "Topic may already exist"

echo -e "${GREEN}Kafka setup complete!${NC}"
echo ""

# =============================================================================
# Step 3: OpenSearch
# =============================================================================
echo -e "${GREEN}Step 3: Creating OpenSearch cluster...${NC}"

OS_CLUSTER_ID=$(get_cluster_id "signals-opensearch")

if [ -n "$OS_CLUSTER_ID" ]; then
    echo -e "${YELLOW}OpenSearch cluster 'signals-opensearch' already exists (ID: ${OS_CLUSTER_ID})${NC}"
else
    echo "Creating OpenSearch cluster (this may take 10-15 minutes)..."
    doctl databases create signals-opensearch \
        --engine opensearch \
        --region "$REGION" \
        --size db-s-2vcpu-4gb \
        --version 2 \
        --wait

    OS_CLUSTER_ID=$(get_cluster_id "signals-opensearch")
    echo -e "${GREEN}OpenSearch cluster created (ID: ${OS_CLUSTER_ID})${NC}"
fi

# Create user
echo "Creating user 'signals_user'..."
doctl databases user create "$OS_CLUSTER_ID" signals_user 2>/dev/null || echo "User may already exist"

echo -e "${GREEN}OpenSearch setup complete!${NC}"
echo ""

# =============================================================================
# Step 4: Spaces Bucket
# =============================================================================
echo -e "${GREEN}Step 4: Spaces bucket...${NC}"
echo -e "${YELLOW}NOTE: Spaces bucket 'signals-uploads' should be created via DO Console${NC}"
echo -e "${YELLOW}      Go to: Spaces Object Storage → Create Space → Name: signals-uploads → Region: syd1${NC}"
echo ""

# doctl doesn't support creating Spaces buckets directly
# The bucket creation needs to be done via:
# 1. DO Console (recommended)
# 2. s3cmd with Spaces credentials
# 3. DO API directly

# =============================================================================
# Verification
# =============================================================================
echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Verification                                              ${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo ""

echo "Database clusters:"
doctl databases list --format ID,Name,Engine,Region,Status

echo ""
echo "Cluster details:"
echo ""

if [ -n "$PG_CLUSTER_ID" ]; then
    echo "PostgreSQL (signals-postgres):"
    echo "  ID: $PG_CLUSTER_ID"
    doctl databases db list "$PG_CLUSTER_ID" --format Name 2>/dev/null | head -5
fi

if [ -n "$KAFKA_CLUSTER_ID" ]; then
    echo ""
    echo "Kafka (signals-kafka):"
    echo "  ID: $KAFKA_CLUSTER_ID"
    echo "  Topics:"
    doctl databases topics list "$KAFKA_CLUSTER_ID" --format Name 2>/dev/null | head -5
fi

if [ -n "$OS_CLUSTER_ID" ]; then
    echo ""
    echo "OpenSearch (signals-opensearch):"
    echo "  ID: $OS_CLUSTER_ID"
fi

echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Managed services setup complete!                          ${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
echo ""
echo "Next steps:"
echo "  1. Create Spaces bucket 'signals-uploads' via DO Console (if not done)"
echo "  2. Push code to GitHub"
echo "  3. Deploy debug container via GitHub Actions"
echo "  4. Run connectivity tests"
echo ""
