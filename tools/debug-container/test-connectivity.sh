#!/bin/bash
# =============================================================================
# Debug Container - Connectivity Test Script
# Tests connectivity to all DO Managed Services from App Platform
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0

print_header() {
    echo ""
    echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║       App Platform Connectivity Test Suite                 ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

print_section() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

pass() {
    echo -e "  ${GREEN}✓${NC} $1"
    ((PASSED++))
}

fail() {
    echo -e "  ${RED}✗${NC} $1"
    echo -e "    ${RED}Error: $2${NC}"
    ((FAILED++))
}

skip() {
    echo -e "  ${YELLOW}○${NC} $1 (skipped: $2)"
}

# =============================================================================
# PostgreSQL Tests
# =============================================================================
test_postgres() {
    print_section "PostgreSQL"

    if [ -z "$DATABASE_URL" ]; then
        skip "PostgreSQL connectivity" "DATABASE_URL not set"
        return
    fi

    # Test 1: Basic connectivity
    if psql "$DATABASE_URL" -c "SELECT 1" > /dev/null 2>&1; then
        pass "Basic connectivity (SELECT 1)"
    else
        fail "Basic connectivity" "Could not connect to PostgreSQL"
        return
    fi

    # Test 2: Check database version
    VERSION=$(psql "$DATABASE_URL" -t -c "SELECT version();" 2>/dev/null | head -1 | xargs)
    if [ -n "$VERSION" ]; then
        pass "Database version: ${VERSION:0:50}..."
    else
        fail "Get database version" "Could not retrieve version"
    fi

    # Test 3: List tables (check if migrations ran)
    TABLE_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | xargs)
    if [ -n "$TABLE_COUNT" ]; then
        pass "Schema accessible ($TABLE_COUNT tables in public schema)"
    else
        fail "Schema access" "Could not list tables"
    fi

    # Test 4: SSL verification
    SSL_MODE=$(psql "$DATABASE_URL" -t -c "SHOW ssl;" 2>/dev/null | xargs)
    if [ "$SSL_MODE" = "on" ]; then
        pass "SSL connection enabled"
    else
        echo -e "  ${YELLOW}!${NC} SSL status: $SSL_MODE"
    fi
}

# =============================================================================
# Kafka Tests
# =============================================================================
test_kafka() {
    print_section "Kafka"

    if [ -z "$KAFKA_BROKERS" ]; then
        skip "Kafka connectivity" "KAFKA_BROKERS not set"
        return
    fi

    # Write CA cert to file if provided
    if [ -n "$KAFKA_CA_CERT" ]; then
        echo "$KAFKA_CA_CERT" > /tmp/kafka-ca.crt
    fi

    # Test 1: Broker metadata using kcat with SASL
    if [ -n "$KAFKA_USERNAME" ] && [ -n "$KAFKA_PASSWORD" ]; then
        # SASL/SCRAM authentication (DO Managed Kafka)
        KCAT_OPTS="-b $KAFKA_BROKERS -X security.protocol=SASL_SSL -X sasl.mechanism=SCRAM-SHA-256 -X sasl.username=$KAFKA_USERNAME -X sasl.password=$KAFKA_PASSWORD"

        if kcat $KCAT_OPTS -L > /dev/null 2>&1; then
            pass "Broker connectivity (SASL_SSL)"
        else
            fail "Broker connectivity" "Could not connect to Kafka brokers"
            return
        fi

        # Test 2: List topics
        TOPICS=$(kcat $KCAT_OPTS -L 2>/dev/null | grep "topic" | head -5)
        if [ -n "$TOPICS" ]; then
            pass "Topic listing"
            echo "$TOPICS" | while read line; do
                echo -e "    ${NC}$line${NC}"
            done
        else
            pass "Connected (no topics found yet)"
        fi

        # Test 3: Check for expected topics
        if kcat $KCAT_OPTS -L 2>/dev/null | grep -q "signals.raw.v1"; then
            pass "Topic 'signals.raw.v1' exists"
        else
            echo -e "  ${YELLOW}!${NC} Topic 'signals.raw.v1' not found (may need creation)"
        fi

        if kcat $KCAT_OPTS -L 2>/dev/null | grep -q "signals.ai.jobs.v1"; then
            pass "Topic 'signals.ai.jobs.v1' exists"
        else
            echo -e "  ${YELLOW}!${NC} Topic 'signals.ai.jobs.v1' not found (may need creation)"
        fi
    else
        skip "SASL authentication" "KAFKA_USERNAME or KAFKA_PASSWORD not set"

        # Try without auth (unlikely to work with DO managed Kafka)
        if kcat -b "$KAFKA_BROKERS" -L > /dev/null 2>&1; then
            pass "Broker connectivity (no auth)"
        else
            fail "Broker connectivity" "Could not connect to Kafka"
        fi
    fi
}

# =============================================================================
# OpenSearch Tests
# =============================================================================
test_opensearch() {
    print_section "OpenSearch"

    if [ -z "$OPENSEARCH_URL" ]; then
        skip "OpenSearch connectivity" "OPENSEARCH_URL not set"
        return
    fi

    # Test 1: Cluster health
    HEALTH=$(curl -sf "$OPENSEARCH_URL/_cluster/health" 2>/dev/null)
    if [ -n "$HEALTH" ]; then
        STATUS=$(echo "$HEALTH" | jq -r '.status' 2>/dev/null)
        CLUSTER_NAME=$(echo "$HEALTH" | jq -r '.cluster_name' 2>/dev/null)
        pass "Cluster health: $STATUS (cluster: $CLUSTER_NAME)"
    else
        fail "Cluster health check" "Could not connect to OpenSearch"
        return
    fi

    # Test 2: Get cluster info
    INFO=$(curl -sf "$OPENSEARCH_URL" 2>/dev/null)
    if [ -n "$INFO" ]; then
        VERSION=$(echo "$INFO" | jq -r '.version.number' 2>/dev/null)
        pass "OpenSearch version: $VERSION"
    else
        fail "Get cluster info" "Could not retrieve cluster info"
    fi

    # Test 3: List indices
    INDICES=$(curl -sf "$OPENSEARCH_URL/_cat/indices?format=json" 2>/dev/null)
    if [ -n "$INDICES" ]; then
        INDEX_COUNT=$(echo "$INDICES" | jq '. | length' 2>/dev/null)
        pass "Index listing ($INDEX_COUNT indices)"
    else
        pass "Connected (no indices yet)"
    fi

    # Test 4: Check for expected index
    if curl -sf "$OPENSEARCH_URL/signals-events-v1" > /dev/null 2>&1; then
        pass "Index 'signals-events-v1' exists"
    else
        echo -e "  ${YELLOW}!${NC} Index 'signals-events-v1' not found (created by indexer)"
    fi
}

# =============================================================================
# Spaces (S3) Tests
# =============================================================================
test_spaces() {
    print_section "Spaces (S3-compatible)"

    if [ -z "$SPACES_ENDPOINT" ] || [ -z "$SPACES_ACCESS_KEY" ] || [ -z "$SPACES_SECRET_KEY" ]; then
        skip "Spaces connectivity" "SPACES_* environment variables not fully set"
        return
    fi

    if [ -z "$SPACES_BUCKET" ]; then
        skip "Spaces bucket test" "SPACES_BUCKET not set"
        return
    fi

    # Configure AWS CLI for Spaces
    export AWS_ACCESS_KEY_ID="$SPACES_ACCESS_KEY"
    export AWS_SECRET_ACCESS_KEY="$SPACES_SECRET_KEY"

    # Test 1: List bucket contents
    if aws s3 ls "s3://$SPACES_BUCKET" --endpoint-url "$SPACES_ENDPOINT" > /dev/null 2>&1; then
        pass "Bucket '$SPACES_BUCKET' accessible"
    else
        fail "Bucket access" "Could not access bucket '$SPACES_BUCKET'"
        return
    fi

    # Test 2: Write test file
    TEST_KEY="debug-test-$(date +%s).txt"
    echo "Debug container test at $(date)" > /tmp/test-upload.txt

    if aws s3 cp /tmp/test-upload.txt "s3://$SPACES_BUCKET/$TEST_KEY" --endpoint-url "$SPACES_ENDPOINT" > /dev/null 2>&1; then
        pass "Write test file to bucket"

        # Test 3: Read test file
        if aws s3 cp "s3://$SPACES_BUCKET/$TEST_KEY" /tmp/test-download.txt --endpoint-url "$SPACES_ENDPOINT" > /dev/null 2>&1; then
            pass "Read test file from bucket"

            # Test 4: Delete test file
            if aws s3 rm "s3://$SPACES_BUCKET/$TEST_KEY" --endpoint-url "$SPACES_ENDPOINT" > /dev/null 2>&1; then
                pass "Delete test file from bucket"
            else
                echo -e "  ${YELLOW}!${NC} Could not delete test file (cleanup manually)"
            fi
        else
            fail "Read test file" "Could not read from bucket"
        fi
    else
        fail "Write test file" "Could not write to bucket"
    fi

    # Cleanup
    rm -f /tmp/test-upload.txt /tmp/test-download.txt
}

# =============================================================================
# Environment Variable Summary
# =============================================================================
print_env_summary() {
    print_section "Environment Variables"

    echo "  PostgreSQL:"
    [ -n "$DATABASE_URL" ] && echo -e "    ${GREEN}✓${NC} DATABASE_URL is set" || echo -e "    ${RED}✗${NC} DATABASE_URL not set"

    echo ""
    echo "  Kafka:"
    [ -n "$KAFKA_BROKERS" ] && echo -e "    ${GREEN}✓${NC} KAFKA_BROKERS is set" || echo -e "    ${RED}✗${NC} KAFKA_BROKERS not set"
    [ -n "$KAFKA_USERNAME" ] && echo -e "    ${GREEN}✓${NC} KAFKA_USERNAME is set" || echo -e "    ${RED}✗${NC} KAFKA_USERNAME not set"
    [ -n "$KAFKA_PASSWORD" ] && echo -e "    ${GREEN}✓${NC} KAFKA_PASSWORD is set" || echo -e "    ${RED}✗${NC} KAFKA_PASSWORD not set"
    [ -n "$KAFKA_CA_CERT" ] && echo -e "    ${GREEN}✓${NC} KAFKA_CA_CERT is set" || echo -e "    ${YELLOW}○${NC} KAFKA_CA_CERT not set"

    echo ""
    echo "  OpenSearch:"
    [ -n "$OPENSEARCH_URL" ] && echo -e "    ${GREEN}✓${NC} OPENSEARCH_URL is set" || echo -e "    ${RED}✗${NC} OPENSEARCH_URL not set"

    echo ""
    echo "  Spaces:"
    [ -n "$SPACES_ENDPOINT" ] && echo -e "    ${GREEN}✓${NC} SPACES_ENDPOINT is set" || echo -e "    ${RED}✗${NC} SPACES_ENDPOINT not set"
    [ -n "$SPACES_BUCKET" ] && echo -e "    ${GREEN}✓${NC} SPACES_BUCKET is set" || echo -e "    ${RED}✗${NC} SPACES_BUCKET not set"
    [ -n "$SPACES_ACCESS_KEY" ] && echo -e "    ${GREEN}✓${NC} SPACES_ACCESS_KEY is set" || echo -e "    ${RED}✗${NC} SPACES_ACCESS_KEY not set"
    [ -n "$SPACES_SECRET_KEY" ] && echo -e "    ${GREEN}✓${NC} SPACES_SECRET_KEY is set" || echo -e "    ${RED}✗${NC} SPACES_SECRET_KEY not set"
}

# =============================================================================
# Summary
# =============================================================================
print_summary() {
    echo ""
    echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║                      Test Summary                          ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "  Tests Passed:  ${GREEN}$PASSED${NC}"
    echo -e "  Tests Failed:  ${RED}$FAILED${NC}"
    echo ""

    if [ $FAILED -eq 0 ]; then
        echo -e "  ${GREEN}════════════════════════════════════════════════════════${NC}"
        echo -e "  ${GREEN}  ALL CONNECTIVITY TESTS PASSED!                        ${NC}"
        echo -e "  ${GREEN}  Ready to deploy application services.                 ${NC}"
        echo -e "  ${GREEN}════════════════════════════════════════════════════════${NC}"
        exit 0
    else
        echo -e "  ${RED}════════════════════════════════════════════════════════${NC}"
        echo -e "  ${RED}  SOME TESTS FAILED                                     ${NC}"
        echo -e "  ${RED}  Please fix connectivity issues before deploying.      ${NC}"
        echo -e "  ${RED}════════════════════════════════════════════════════════${NC}"
        exit 1
    fi
}

# =============================================================================
# Main
# =============================================================================
main() {
    print_header
    print_env_summary

    test_postgres
    test_kafka
    test_opensearch
    test_spaces

    print_summary
}

# Run if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
