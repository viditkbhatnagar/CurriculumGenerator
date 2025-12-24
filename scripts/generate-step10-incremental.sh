#!/bin/bash
# Script to generate Step 10 modules one at a time
# Each module is generated, saved, and then the next one starts

WORKFLOW_ID="693fcaeb9460376df326dd2a"
API_URL="http://localhost:4000/api/v3/workflow"

echo "🚀 Starting incremental Step 10 generation"
echo "📊 Each module will be generated and saved before moving to the next"
echo ""

while true; do
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "📈 Checking current status..."
  
  # Get current status
  STATUS=$(curl -s "$API_URL/$WORKFLOW_ID" | jq -r '{modules: (.data.step10.moduleLessonPlans | length), total: (.data.step4.modules | length), lessons: .data.step10.summary.totalLessons}')
  MODULES=$(echo $STATUS | jq -r '.modules')
  TOTAL=$(echo $STATUS | jq -r '.total')
  LESSONS=$(echo $STATUS | jq -r '.lessons')
  
  echo "   Modules: $MODULES/$TOTAL"
  echo "   Lessons: $LESSONS"
  echo ""
  
  if [ "$MODULES" -ge "$TOTAL" ]; then
    echo "✅ All modules completed!"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    exit 0
  fi
  
  NEXT_MODULE=$((MODULES + 1))
  echo "🔄 Generating module $NEXT_MODULE/$TOTAL..."
  echo "⏱️  This will take 10-15 minutes..."
  echo ""
  
  # Trigger generation for next module
  RESPONSE=$(curl -X POST "$API_URL/$WORKFLOW_ID/step10/next-module" \
    --max-time 900 \
    --silent \
    --show-error \
    2>&1)
  
  # Check if successful
  if echo "$RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
    SUCCESS=$(echo "$RESPONSE" | jq -r '.success')
    if [ "$SUCCESS" = "true" ]; then
      NEW_MODULES=$(echo "$RESPONSE" | jq -r '.data.modulesGenerated')
      NEW_LESSONS=$(echo "$RESPONSE" | jq -r '.data.step10.summary.totalLessons')
      MESSAGE=$(echo "$RESPONSE" | jq -r '.message')
      
      echo "✅ $MESSAGE"
      echo "   Total modules: $NEW_MODULES/$TOTAL"
      echo "   Total lessons: $NEW_LESSONS"
      echo ""
    else
      ERROR=$(echo "$RESPONSE" | jq -r '.error')
      echo "❌ Error: $ERROR"
      echo "   Retrying in 30 seconds..."
      sleep 30
    fi
  else
    echo "❌ Request failed or timed out"
    echo "   Response: $RESPONSE"
    echo "   Retrying in 30 seconds..."
    sleep 30
  fi
  
  echo ""
done
