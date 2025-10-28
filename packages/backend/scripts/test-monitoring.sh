#!/bin/bash

# Test Monitoring Setup Script
# This script tests all monitoring endpoints

echo "🔍 Testing Monitoring and Logging Setup"
echo "========================================"
echo ""

BASE_URL="http://localhost:4000"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to test endpoint
test_endpoint() {
    local endpoint=$1
    local description=$2
    
    echo -n "Testing $description... "
    
    response=$(curl -s -w "\n%{http_code}" "$BASE_URL$endpoint")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" -eq 200 ] || [ "$http_code" -eq 503 ]; then
        echo -e "${GREEN}✓${NC} (HTTP $http_code)"
        echo "$body" | jq '.' 2>/dev/null || echo "$body"
        echo ""
    else
        echo -e "${RED}✗${NC} (HTTP $http_code)"
        echo "$body"
        echo ""
    fi
}

# Check if server is running
echo "Checking if server is running..."
if ! curl -s "$BASE_URL/health" > /dev/null 2>&1; then
    echo -e "${RED}✗ Server is not running at $BASE_URL${NC}"
    echo "Please start the server with: npm run dev"
    exit 1
fi
echo -e "${GREEN}✓ Server is running${NC}"
echo ""

# Test health endpoints
echo "📊 Health Check Endpoints"
echo "------------------------"
test_endpoint "/health" "Comprehensive Health Check"
test_endpoint "/health/ready" "Readiness Probe"
test_endpoint "/health/live" "Liveness Probe"

# Test metrics endpoint
echo "📈 Metrics Endpoints"
echo "-------------------"
test_endpoint "/metrics" "Metrics (1 hour window)"
test_endpoint "/metrics?window=300000" "Metrics (5 minute window)"

# Test alerts endpoint
echo "🚨 Alerts Endpoints"
echo "------------------"
test_endpoint "/alerts" "Recent Alerts"
test_endpoint "/alerts?limit=5" "Recent Alerts (limit 5)"

# Test status endpoint
echo "ℹ️  Status Endpoint"
echo "------------------"
test_endpoint "/status" "Service Status"

echo ""
echo "========================================"
echo "✅ Monitoring setup test complete!"
echo ""
echo "Next steps:"
echo "1. Check logs in console for structured logging"
echo "2. Configure CloudWatch (optional): Set AWS credentials in .env"
echo "3. Configure Sentry (optional): Set SENTRY_DSN in .env"
echo "4. Monitor /metrics endpoint for application metrics"
echo "5. Set up alerts based on /alerts endpoint"
echo ""
echo "Documentation:"
echo "- Full guide: packages/backend/MONITORING.md"
echo "- Quick start: packages/backend/MONITORING_QUICKSTART.md"
