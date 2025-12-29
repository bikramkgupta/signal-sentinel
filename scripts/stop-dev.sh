#!/usr/bin/env bash
#
# =============================================================================
# DEVELOPMENT ONLY - Stop All Services
# =============================================================================
# This script is intended for LOCAL DEVELOPMENT in the DevContainer.
# DO NOT use in production environments.
#
# Usage:
#   ./scripts/stop-dev.sh           # Stop all services including loadgen
#   ./scripts/stop-dev.sh --quiet   # Stop without verbose output
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
QUIET=false
while [[ $# -gt 0 ]]; do
    case $1 in
        --quiet|-q)
            QUIET=true
            shift
            ;;
        *)
            shift
            ;;
    esac
done

if [ "$QUIET" = false ]; then
    echo -e "${YELLOW}============================================${NC}"
    echo -e "${YELLOW}  DEV ENVIRONMENT - Stopping All Services  ${NC}"
    echo -e "${YELLOW}============================================${NC}"
    echo ""
fi

# Check if PID directory exists
if [ ! -d "$PID_DIR" ]; then
    if [ "$QUIET" = false ]; then
        echo -e "${YELLOW}No services appear to be running (PID directory not found).${NC}"
    fi
    exit 0
fi

# Function to stop a service
stop_service() {
    local name=$1
    local pid_file="$PID_DIR/$name.pid"

    if [ -f "$pid_file" ]; then
        local pid
        pid=$(cat "$pid_file")
        if kill -0 "$pid" 2>/dev/null; then
            if [ "$QUIET" = false ]; then
                echo -e "Stopping $name (PID: $pid)..."
            fi

            # Try graceful shutdown first (SIGTERM)
            kill "$pid" 2>/dev/null || true

            # Wait up to 5 seconds for graceful shutdown
            local count=0
            while kill -0 "$pid" 2>/dev/null && [ $count -lt 5 ]; do
                sleep 1
                count=$((count + 1))
            done

            # Force kill if still running (SIGKILL)
            if kill -0 "$pid" 2>/dev/null; then
                if [ "$QUIET" = false ]; then
                    echo -e "  ${YELLOW}Force killing $name...${NC}"
                fi
                kill -9 "$pid" 2>/dev/null || true
            fi

            if [ "$QUIET" = false ]; then
                echo -e "  ${GREEN}Stopped${NC}"
            fi
        else
            if [ "$QUIET" = false ]; then
                echo -e "$name: ${YELLOW}Not running${NC} (stale PID file)"
            fi
        fi
        rm -f "$pid_file"
    else
        if [ "$QUIET" = false ]; then
            echo -e "$name: ${YELLOW}No PID file${NC}"
        fi
    fi
}

# Stop all services (reverse order of start, loadgen first)
stop_service "loadgen"
stop_service "dashboard"
stop_service "core-api"
stop_service "ai-worker"
stop_service "incident-engine"
stop_service "indexer"
stop_service "ingest-api"

# Clean up log files older than 7 days (optional maintenance)
find "$PID_DIR" -name "*.log" -mtime +7 -delete 2>/dev/null || true

if [ "$QUIET" = false ]; then
    echo ""
    echo -e "${GREEN}============================================${NC}"
    echo -e "${GREEN}  All services stopped!                    ${NC}"
    echo -e "${GREEN}============================================${NC}"
    echo ""
    echo "Logs are still available in: .dev-pids/*.log"
    echo -e "To start services again: ${BLUE}./scripts/start-dev.sh${NC}"
    echo ""
fi
