#!/bin/bash

# Test script for PPT generation
# Replace with your actual workflow ID

WORKFLOW_ID="693b01239460376d324f37e"

echo "=== Testing PPT Validation ==="
curl -s "http://localhost:4000/api/v3/ppt/validate/${WORKFLOW_ID}" | jq '.'

echo -e "\n\n=== Testing Single Module PPT Generation ==="
# First, get module IDs from validation
MODULE_ID=$(curl -s "http://localhost:4000/api/v3/ppt/validate/${WORKFLOW_ID}" | jq -r '.data.modules[0].id')
echo "Using module ID: $MODULE_ID"

if [ "$MODULE_ID" != "null" ] && [ -n "$MODULE_ID" ]; then
  echo "Generating PPT for module: $MODULE_ID"
  curl -X POST "http://localhost:4000/api/v3/ppt/generate/module/${WORKFLOW_ID}/${MODULE_ID}" \
    -H "Content-Type: application/json" \
    --output test-module.pptx
  
  if [ -f test-module.pptx ]; then
    echo "PPT file created: test-module.pptx ($(ls -lh test-module.pptx | awk '{print $5}'))"
  else
    echo "Failed to create PPT file"
  fi
else
  echo "No module ID found"
fi
