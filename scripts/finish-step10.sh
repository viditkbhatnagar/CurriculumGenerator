#!/bin/bash
# Script to finish Step 10 generation by repeatedly calling the API until all modules are complete

WORKFLOW_ID="693fcaeb9460376df326dd2a"
API_URL="http://localhost:4000/api/v3/workflow"

echo "🚀 Starting Step 10 completion script"
echo "📊 Checking current status..."

while true; do
  # Get current status
  STATUS=$(curl -s "$API_URL/$WORKFLOW_ID" | jq -r '{modules: (.data.step10.moduleLessonPlans | length), total: (.data.step4.modules | length)}')
  MODULES=$(echo $STATUS | jq -r '.modules')
  TOTAL=$(echo $STATUS | jq -r '.total')
  
  echo ""
  echo "📈 Progress: $MODULES/$TOTAL modules completed"
  
  if [ "$MODULES" -ge "$TOTAL" ]; then
    echo "✅ All modules completed!"
    exit 0
  fi
  
  echo "🔄 Triggering generation for remaining modules..."
  
  # Trigger generation with 10-minute timeout
  curl -X POST "$API_URL/$WORKFLOW_ID/step10" \
    --max-time 600 \
    --silent \
    --show-error \
    > /dev/null 2>&1
  
  # Wait a bit before checking again
  echo "⏳ Waiting 30 seconds before next check..."
  sleep 30
done
