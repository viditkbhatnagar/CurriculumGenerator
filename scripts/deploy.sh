#!/bin/bash

# Deployment script for Curriculum Generator App on Render
# Usage: ./scripts/deploy.sh [environment]
# Example: ./scripts/deploy.sh production

set -e

ENVIRONMENT=${1:-staging}

echo "Deploying to $ENVIRONMENT environment on Render..."

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(staging|production)$ ]]; then
  echo "Error: Environment must be 'staging' or 'production'"
  exit 1
fi

# Check if Render CLI is installed
if ! command -v render &> /dev/null; then
    echo "⚠️  Render CLI is not installed. Install it with:"
    echo "   npm install -g @render-com/cli"
    echo ""
    echo "Alternatively, deployment will happen automatically when you push to the main branch."
    exit 1
fi

# Trigger manual deployment via Render CLI
echo "Triggering deployment on Render..."

if [ "$ENVIRONMENT" = "production" ]; then
  BRANCH="main"
else
  BRANCH="staging"
fi

echo "Deploying from branch: $BRANCH"

# Note: Render auto-deploys on git push, so we just need to push
echo "Pushing to $BRANCH branch..."
git push origin $BRANCH

echo ""
echo "✅ Deployment triggered!"
echo ""
echo "Monitor deployment progress:"
echo "  - Render Dashboard: https://dashboard.render.com"
echo ""
echo "Services being deployed:"
echo "  - Frontend Web Service"
echo "  - Backend API Web Service"
echo "  - Background Worker Service"
echo ""

# Wait a bit for deployment to start
sleep 5

# Run health checks
echo "Waiting for services to be ready (this may take a few minutes)..."
sleep 30

echo "Running health checks..."
if [ "$ENVIRONMENT" = "production" ]; then
  API_URL="https://curriculum-api.onrender.com"
else
  API_URL="https://curriculum-api-staging.onrender.com"
fi

MAX_RETRIES=10
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  if curl -f -s $API_URL/health > /dev/null; then
    echo "✅ Health check passed!"
    echo ""
    echo "Deployment to $ENVIRONMENT completed successfully!"
    echo ""
    echo "Access your application:"
    if [ "$ENVIRONMENT" = "production" ]; then
      echo "  Frontend: https://curriculum-frontend.onrender.com"
      echo "  API: https://curriculum-api.onrender.com"
    else
      echo "  Frontend: https://curriculum-frontend-staging.onrender.com"
      echo "  API: https://curriculum-api-staging.onrender.com"
    fi
    exit 0
  else
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo "Health check attempt $RETRY_COUNT/$MAX_RETRIES failed, retrying in 10 seconds..."
    sleep 10
  fi
done

echo "⚠️  Health check failed after $MAX_RETRIES attempts."
echo "Check the Render dashboard for deployment status: https://dashboard.render.com"
exit 1
