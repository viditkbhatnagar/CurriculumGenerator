#!/bin/bash

echo "🚀 Starting Curriculum Generator App in development mode..."

# Check if MongoDB is running
if ! pgrep -x mongod > /dev/null; then
    echo "⚠️  MongoDB is not running. Please start MongoDB first:"
    echo "   macOS: brew services start mongodb-community"
    echo "   Linux: sudo systemctl start mongod"
    exit 1
fi

# Check if Redis is running
if ! pgrep -x redis-server > /dev/null; then
    echo "⚠️  Redis is not running. Please start Redis first:"
    echo "   macOS: brew services start redis"
    echo "   Linux: sudo systemctl start redis"
    exit 1
fi

# Start all services concurrently
echo "Starting all services..."
echo ""

# Use trap to handle Ctrl+C
trap 'echo "Stopping all services..."; kill 0' SIGINT

# Start backend
(cd packages/backend && npm run dev) &

# Start backend worker
(cd packages/backend && npm run worker) &

# Start frontend (this will be the main process)
cd packages/frontend && npm run dev

# Wait for all background processes
wait
