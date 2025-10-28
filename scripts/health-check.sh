#!/bin/bash

# Health check script for all services
# Usage: ./scripts/health-check.sh [environment]

set -e

ENVIRONMENT=${1:-local}

case $ENVIRONMENT in
  local)
    API_URL="http://localhost:4000"
    FRONTEND_URL="http://localhost:3000"
    AI_SERVICE_URL="http://localhost:5000"
    ;;
  staging)
    API_URL="https://staging-api.curriculum-app.example.com"
    FRONTEND_URL="https://staging.curriculum-app.example.com"
    AI_SERVICE_URL="https://staging-ai.curriculum-app.example.com"
    ;;
  production)
    API_URL="https://api.curriculum-app.example.com"
    FRONTEND_URL="https://curriculum-app.example.com"
    AI_SERVICE_URL="https://ai.curriculum-app.example.com"
    ;;
  *)
    echo "Error: Environment must be 'local', 'staging', or 'production'"
    exit 1
    ;;
esac

echo "Running health checks for $ENVIRONMENT environment..."
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

check_service() {
  local name=$1
  local url=$2
  local timeout=${3:-5}
  
  echo -n "Checking $name... "
  
  if response=$(curl -s -f -m $timeout "$url" 2>&1); then
    echo -e "${GREEN}✓ OK${NC}"
    return 0
  else
    echo -e "${RED}✗ FAILED${NC}"
    echo "  Error: $response"
    return 1
  fi
}

check_service_with_details() {
  local name=$1
  local url=$2
  
  echo -n "Checking $name... "
  
  if response=$(curl -s -f -m 5 "$url" 2>&1); then
    echo -e "${GREEN}✓ OK${NC}"
    echo "$response" | jq '.' 2>/dev/null || echo "$response"
    return 0
  else
    echo -e "${RED}✗ FAILED${NC}"
    echo "  Error: $response"
    return 1
  fi
}

# Track failures
FAILURES=0

# Check API
if ! check_service_with_details "API Health" "$API_URL/health"; then
  ((FAILURES++))
fi
echo ""

# Check Frontend
if ! check_service "Frontend" "$FRONTEND_URL"; then
  ((FAILURES++))
fi
echo ""

# Check AI Service (if accessible)
if [ "$ENVIRONMENT" = "local" ]; then
  if ! check_service_with_details "AI Service Health" "$AI_SERVICE_URL/health"; then
    ((FAILURES++))
  fi
  echo ""
fi

# Check database connectivity (via API)
echo -n "Checking Database connectivity... "
if response=$(curl -s -f -m 5 "$API_URL/health/db" 2>&1); then
  echo -e "${GREEN}✓ OK${NC}"
else
  echo -e "${YELLOW}⚠ WARNING${NC}"
  echo "  Note: Database health endpoint may not be implemented"
fi
echo ""

# Check Redis connectivity (via API)
echo -n "Checking Redis connectivity... "
if response=$(curl -s -f -m 5 "$API_URL/health/redis" 2>&1); then
  echo -e "${GREEN}✓ OK${NC}"
else
  echo -e "${YELLOW}⚠ WARNING${NC}"
  echo "  Note: Redis health endpoint may not be implemented"
fi
echo ""

# Summary
echo "================================"
if [ $FAILURES -eq 0 ]; then
  echo -e "${GREEN}All health checks passed!${NC}"
  exit 0
else
  echo -e "${RED}$FAILURES health check(s) failed!${NC}"
  exit 1
fi
