#!/usr/bin/env bash
#
# =============================================================================
# DEVELOPMENT ONLY - Start All Services
# =============================================================================
# This script is intended for LOCAL DEVELOPMENT in the DevContainer.
# DO NOT use in production environments.
#
# Usage:
#   ./scripts/start-dev.sh              # Start app services only
#   ./scripts/start-dev.sh --with-load  # Start app services + loadgen
#   ./scripts/start-dev.sh --load-only  # Start only loadgen (services already running)
#
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
PID_DIR="$PROJECT_ROOT/.dev-pids"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse arguments
WITH_LOAD=false
LOAD_ONLY=false
LOAD_SCENARIO="normal"

while [[ $# -gt 0 ]]; do
    case $1 in
        --with-load)
            WITH_LOAD=true
            shift
            ;;
        --load-only)
            LOAD_ONLY=true
            shift
            ;;
        --scenario=*)
            LOAD_SCENARIO="${1#*=}"
            shift
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--with-load] [--load-only] [--scenario=<name>]"
            exit 1
            ;;
    esac
done

echo -e "${YELLOW}============================================${NC}"
echo -e "${YELLOW}  DEV ENVIRONMENT - Starting Services      ${NC}"
echo -e "${YELLOW}============================================${NC}"
echo ""

# -----------------------------------------------------------------------------
# Environment Variables (DevContainer defaults)
# -----------------------------------------------------------------------------
# These can be overridden by a .env file in the project root

# Database
export DATABASE_URL="${DATABASE_URL:-postgresql://postgres:password@postgres:5432/app?sslmode=disable}"
export PG_SSLMODE="${PG_SSLMODE:-disable}"

# Kafka
export KAFKA_BROKERS="${KAFKA_BROKERS:-kafka:9092}"
export KAFKA_SECURITY_PROTOCOL="${KAFKA_SECURITY_PROTOCOL:-PLAINTEXT}"

# OpenSearch
export OPENSEARCH_URL="${OPENSEARCH_URL:-http://opensearch:9200}"

# S3-compatible Storage (MinIO)
export SPACES_ENDPOINT="${SPACES_ENDPOINT:-http://minio:9000}"
export SPACES_KEY_ID="${SPACES_KEY_ID:-rustfsadmin}"
export SPACES_SECRET_KEY="${SPACES_SECRET_KEY:-rustfsadmin}"
export SPACES_BUCKET_NAME="${SPACES_BUCKET_NAME:-signals-local}"
export SPACES_FORCE_PATH_STYLE="${SPACES_FORCE_PATH_STYLE:-true}"

# Gradient AI (optional - AI summaries will fail without this)
export GRADIENT_BASE_URL="${GRADIENT_BASE_URL:-https://inference.do-ai.run/v1}"
export GRADIENT_API_KEY="${GRADIENT_API_KEY:-}"
export GRADIENT_MODEL="${GRADIENT_MODEL:-llama3.3-70b-instruct}"

# Service Ports
export INGEST_API_PORT="${INGEST_API_PORT:-3000}"
export CORE_API_PORT="${CORE_API_PORT:-3001}"
export DASHBOARD_PORT="${DASHBOARD_PORT:-3002}"

# Source .env file if it exists (overrides above defaults)
if [ -f "$PROJECT_ROOT/.env" ]; then
    echo -e "${BLUE}Loading environment from .env file...${NC}"
    set -a
    source "$PROJECT_ROOT/.env"
    set +a
fi

# -----------------------------------------------------------------------------
# Create PID directory
# -----------------------------------------------------------------------------
mkdir -p "$PID_DIR"

cd "$PROJECT_ROOT"

# -----------------------------------------------------------------------------
# Function to start a service
# -----------------------------------------------------------------------------
start_service() {
    local name=$1
    local script=$2
    local port=$3

    echo -e "${BLUE}Starting $name${NC}$([ "$port" != "N/A" ] && echo " on port $port")..."
    npm run "$script" > "$PID_DIR/$name.log" 2>&1 &
    local pid=$!
    echo $pid > "$PID_DIR/$name.pid"
    echo -e "  PID: $pid, Log: .dev-pids/$name.log"
}

# -----------------------------------------------------------------------------
# Start application services
# -----------------------------------------------------------------------------
if [ "$LOAD_ONLY" = false ]; then
    # Check if services are already running
    if [ -f "$PID_DIR/ingest-api.pid" ] && kill -0 "$(cat "$PID_DIR/ingest-api.pid")" 2>/dev/null; then
        echo -e "${YELLOW}App services appear to be already running.${NC}"
        echo -e "Run ${BLUE}./scripts/stop-dev.sh${NC} first, or use ${BLUE}--load-only${NC} to just start loadgen."
        if [ "$WITH_LOAD" = false ]; then
            exit 1
        fi
    else
        echo "Starting application services..."
        echo ""

        # Start all backend services
        start_service "ingest-api" "dev:ingest" "3000"
        start_service "indexer" "dev:indexer" "N/A"
        start_service "incident-engine" "dev:engine" "N/A"
        start_service "ai-worker" "dev:ai-worker" "N/A"
        start_service "core-api" "dev:core" "3001"
        start_service "dashboard" "dev:dashboard" "3002"

        echo ""
        echo "Waiting for services to initialize..."
        sleep 5
    fi
fi

# -----------------------------------------------------------------------------
# Start loadgen if requested
# -----------------------------------------------------------------------------
if [ "$WITH_LOAD" = true ] || [ "$LOAD_ONLY" = true ]; then
    echo ""
    echo -e "${BLUE}Starting loadgen with scenario: $LOAD_SCENARIO${NC}"

    # Kill any existing loadgen
    if [ -f "$PID_DIR/loadgen.pid" ]; then
        kill "$(cat "$PID_DIR/loadgen.pid")" 2>/dev/null || true
        rm -f "$PID_DIR/loadgen.pid"
    fi

    npm run loadgen -- --scenario="$LOAD_SCENARIO" > "$PID_DIR/loadgen.log" 2>&1 &
    LOADGEN_PID=$!
    echo $LOADGEN_PID > "$PID_DIR/loadgen.pid"
    echo -e "  Loadgen PID: $LOADGEN_PID, Log: .dev-pids/loadgen.log"
fi

# -----------------------------------------------------------------------------
# Print summary
# -----------------------------------------------------------------------------
echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  Services started!                        ${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo "Service URLs:"
echo "  - ingest-api:  http://localhost:3000"
echo "  - core-api:    http://localhost:3001"
echo "  - dashboard:   http://localhost:3002"
echo ""
echo "Logs are in: .dev-pids/*.log"
echo ""
echo -e "To stop all services: ${BLUE}./scripts/stop-dev.sh${NC}"
echo -e "To view logs: ${BLUE}tail -f .dev-pids/<service>.log${NC}"
echo ""

# -----------------------------------------------------------------------------
# Health check
# -----------------------------------------------------------------------------
if [ "$LOAD_ONLY" = false ]; then
    echo "Checking service health..."

    check_health() {
        local name=$1
        local url=$2
        local max_attempts=10
        local attempt=1

        while [ $attempt -le $max_attempts ]; do
            if curl -sf "$url" > /dev/null 2>&1; then
                echo -e "  $name: ${GREEN}OK${NC}"
                return 0
            fi
            sleep 1
            attempt=$((attempt + 1))
        done
        echo -e "  $name: ${RED}FAILED${NC} (check .dev-pids/$name.log)"
        return 1
    }

    check_health "ingest-api" "http://localhost:3000/healthz" || true
    check_health "core-api" "http://localhost:3001/healthz" || true
    echo -e "  dashboard: ${YELLOW}Compiling...${NC} (Next.js, check .dev-pids/dashboard.log)"
fi

# -----------------------------------------------------------------------------
# Configure OpenSearch Dashboards index pattern
# -----------------------------------------------------------------------------
echo ""
echo -n "Waiting for OpenSearch Dashboards..."

# Wait for OpenSearch Dashboards to be ready (up to 60 seconds)
OSD_READY=false
for i in {1..60}; do
    if curl -sf "http://opensearch-dashboards:5601/api/status" > /dev/null 2>&1; then
        OSD_READY=true
        echo -e " ${GREEN}Ready${NC}"
        break
    fi
    echo -n "."
    sleep 1
done

if [ "$OSD_READY" = false ]; then
    echo -e " ${YELLOW}Timeout${NC}"
    echo -e "  OpenSearch Dashboards: ${YELLOW}Not available yet (may still be starting)${NC}"
else
    # Check if index pattern already exists
    if curl -sf "http://opensearch-dashboards:5601/api/saved_objects/index-pattern/signals-events-v1" \
        -H "osd-xsrf: true" > /dev/null 2>&1; then
        echo -e "  OpenSearch Dashboards: ${GREEN}Index pattern already configured${NC}"
    else
        # Create index pattern
        if curl -sf -X POST "http://opensearch-dashboards:5601/api/saved_objects/index-pattern/signals-events-v1" \
            -H "osd-xsrf: true" \
            -H "Content-Type: application/json" \
            -d '{"attributes":{"title":"signals-events-v1","timeFieldName":"occurred_at"}}' \
            > /dev/null 2>&1; then
            echo -e "  OpenSearch Dashboards: ${GREEN}Index pattern created${NC}"
        else
            echo -e "  OpenSearch Dashboards: ${RED}Failed to create index pattern${NC}"
        fi
    fi
fi

echo ""
echo -e "${GREEN}Done!${NC}"
