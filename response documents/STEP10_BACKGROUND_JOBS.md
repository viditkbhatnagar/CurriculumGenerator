# Step 10 Background Job Queue System

## Overview

Step 10 lesson plan generation now uses a **production-ready background job queue** system powered by Bull/Redis. This eliminates HTTP timeouts, survives server restarts, and provides automatic retries.

## Architecture

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│   Frontend  │─────▶│   API Route  │─────▶│  Job Queue  │
│   (React)   │      │  (Express)   │      │   (Bull)    │
└─────────────┘      └──────────────┘      └─────────────┘
                                                    │
                                                    ▼
                                            ┌─────────────┐
                                            │   Worker    │
                                            │  Process    │
                                            └─────────────┘
                                                    │
                                                    ▼
                                            ┌─────────────┐
                                            │   MongoDB   │
                                            │  (Storage)  │
                                            └─────────────┘
```

## Features

### ✅ Production-Ready

- **No HTTP Timeouts**: Jobs run in the background, API returns immediately
- **Survives Restarts**: Jobs persist in Redis and resume after server restart
- **Automatic Retries**: Failed jobs retry up to 3 times with exponential backoff
- **Progress Tracking**: Real-time progress updates via polling or WebSocket
- **Graceful Shutdown**: Properly closes connections on server shutdown

### ✅ Scalable

- **One Module at a Time**: Generates modules sequentially to avoid MongoDB timeouts
- **Auto-Chaining**: Automatically queues the next module after completion
- **Concurrent Workers**: Can run multiple worker processes for parallel processing
- **Job Deduplication**: Prevents duplicate jobs with unique job IDs

### ✅ Observable

- **Status Endpoint**: Check progress at any time
- **Job History**: Keeps last 100 completed and 200 failed jobs
- **Detailed Logging**: Comprehensive logs for debugging
- **Error Tracking**: Failed jobs include error messages and stack traces

## API Endpoints

### 1. Start Generation (Queue Jobs)

```http
POST /api/v3/workflow/:id/step10
```

**Response:**

```json
{
  "success": true,
  "data": {
    "jobsQueued": 1,
    "modulesGenerated": 7,
    "totalModules": 8,
    "estimatedTimeMinutes": 15
  },
  "message": "Step 10 generation started. 1 module(s) will be generated in the background."
}
```

**Behavior:**

- Returns immediately (no waiting)
- Queues only the next module (not all remaining)
- Prevents duplicate jobs if already running
- Each module auto-queues the next one after completion

### 2. Check Status

```http
GET /api/v3/workflow/:id/step10/status
```

**Response:**

```json
{
  "success": true,
  "data": {
    "workflowId": "...",
    "modulesGenerated": 7,
    "totalModules": 8,
    "allComplete": false,
    "totalLessons": 100,
    "totalContactHours": 150,
    "jobs": {
      "total": 1,
      "active": 1,
      "completed": 0,
      "failed": 0,
      "details": [
        {
          "jobId": "step10-...-module-7",
          "moduleIndex": 7,
          "state": "active",
          "progress": 45,
          "attemptsMade": 0
        }
      ]
    },
    "status": "in_progress"
  }
}
```

**Status Values:**

- `pending`: No jobs queued yet
- `in_progress`: Jobs are running
- `complete`: All modules generated
- `failed`: Jobs failed after retries

### 3. Get Generated Data

```http
GET /api/v3/workflow/:id/step10
```

Returns the complete Step 10 data (same as before).

## Frontend Integration

### React Hook

```typescript
import { useStep10Status } from '../hooks/useStep10Status';

function Step10View({ workflowId }: { workflowId: string }) {
  const { status, loading, error, progressPercentage, estimatedTimeRemaining } =
    useStep10Status(workflowId, 5000); // Poll every 5 seconds

  if (loading && !status) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h2>Step 10: Lesson Plans</h2>

      {status?.status === 'in_progress' && (
        <div>
          <ProgressBar value={progressPercentage} />
          <p>
            Generating module {status.modulesGenerated + 1} of {status.totalModules}
          </p>
          <p>Estimated time remaining: {estimatedTimeRemaining} minutes</p>
        </div>
      )}

      {status?.allComplete && (
        <div>
          <p>✅ All {status.totalModules} modules generated!</p>
          <p>Total lessons: {status.totalLessons}</p>
          <p>Total contact hours: {status.totalContactHours}</p>
        </div>
      )}

      {status?.status === 'failed' && (
        <div>
          <p>❌ Generation failed. Please try again.</p>
        </div>
      )}
    </div>
  );
}
```

### Manual Polling

```typescript
// Start generation
const response = await api.post(`/workflow/${workflowId}/step10`);

// Poll for status
const interval = setInterval(async () => {
  const status = await api.get(`/workflow/${workflowId}/step10/status`);

  if (status.data.data.allComplete) {
    clearInterval(interval);
    console.log('Generation complete!');
  }
}, 5000);
```

## Configuration

### Queue Settings

Located in `packages/backend/src/queues/step10Queue.ts`:

```typescript
defaultJobOptions: {
  attempts: 3,              // Retry up to 3 times
  backoff: {
    type: 'exponential',
    delay: 60000,           // Start with 1 minute delay
  },
  removeOnComplete: 100,    // Keep last 100 completed jobs
  removeOnFail: 200,        // Keep last 200 failed jobs
}
```

### Redis Connection

Uses the same Redis instance as sessions/cache:

```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```

## Deployment

### Single Server (Current)

The queue processor runs in the same process as the API server:

```bash
npm run dev        # Development
npm run start      # Production
```

### Separate Worker Process (Recommended for Production)

For better scalability, run workers separately:

```bash
# Terminal 1: API Server
npm run start

# Terminal 2: Worker Process
npm run start:worker
```

Create `packages/backend/src/worker-step10.ts`:

```typescript
import './queues/step10Queue'; // Initialize and process jobs

console.log('Step 10 worker started');

// Keep process alive
process.on('SIGTERM', async () => {
  const { closeStep10Queue } = await import('./queues/step10Queue');
  await closeStep10Queue();
  process.exit(0);
});
```

### Docker/Kubernetes

```yaml
# API Service
apiVersion: apps/v1
kind: Deployment
metadata:
  name: curriculum-api
spec:
  replicas: 2
  template:
    spec:
      containers:
        - name: api
          image: curriculum-generator:latest
          command: ['npm', 'run', 'start']
          env:
            - name: REDIS_HOST
              value: 'redis-service'

---
# Worker Service
apiVersion: apps/v1
kind: Deployment
metadata:
  name: curriculum-worker
spec:
  replicas: 3 # Scale workers independently
  template:
    spec:
      containers:
        - name: worker
          image: curriculum-generator:latest
          command: ['npm', 'run', 'start:worker']
          env:
            - name: REDIS_HOST
              value: 'redis-service'
```

## Monitoring

### Bull Board (Optional)

Add Bull Board for a web UI to monitor jobs:

```bash
npm install @bull-board/express @bull-board/api
```

```typescript
import { createBullBoard } from '@bull-board/api';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { step10Queue } from './queues/step10Queue';

const serverAdapter = new ExpressAdapter();
createBullBoard({
  queues: [new BullAdapter(step10Queue)],
  serverAdapter,
});

app.use('/admin/queues', serverAdapter.getRouter());
```

Access at: `http://localhost:4000/admin/queues`

### Metrics

Track job metrics:

```typescript
// In your metrics endpoint
const jobCounts = await step10Queue.getJobCounts();

metrics.step10Jobs = {
  waiting: jobCounts.waiting,
  active: jobCounts.active,
  completed: jobCounts.completed,
  failed: jobCounts.failed,
};
```

## Troubleshooting

### Jobs Not Processing

1. **Check Redis connection:**

   ```bash
   redis-cli ping
   ```

2. **Check queue status:**

   ```bash
   curl http://localhost:4000/api/v3/workflow/:id/step10/status
   ```

3. **Check logs:**
   ```bash
   tail -f dev.log | grep "Step 10"
   ```

### Jobs Failing

1. **Check error messages:**

   ```typescript
   const jobs = await step10Queue.getFailed();
   jobs.forEach((job) => console.log(job.failedReason));
   ```

2. **Retry failed jobs:**

   ```typescript
   const jobs = await step10Queue.getFailed();
   await Promise.all(jobs.map((job) => job.retry()));
   ```

3. **Clear failed jobs:**
   ```typescript
   await step10Queue.clean(0, 'failed');
   ```

### MongoDB Timeouts

The queue system handles this automatically:

- Each module is a separate job (10-15 minutes)
- Jobs retry on failure
- Progress is saved after each module

If timeouts persist:

1. Check MongoDB connection settings in `packages/backend/src/db/index.ts`
2. Increase `socketTimeoutMS` if needed
3. Check network connectivity to MongoDB

## Benefits Over Previous Approach

| Feature           | Old (HTTP)        | New (Queue)              |
| ----------------- | ----------------- | ------------------------ |
| HTTP Timeout      | ❌ 30 min limit   | ✅ No limit              |
| Server Restart    | ❌ Loses progress | ✅ Resumes automatically |
| Retry on Failure  | ❌ Manual         | ✅ Automatic (3x)        |
| Progress Tracking | ❌ None           | ✅ Real-time             |
| Scalability       | ❌ Single process | ✅ Multiple workers      |
| Production Ready  | ❌ No             | ✅ Yes                   |

## Summary

The background job queue system provides a **production-ready, scalable, and reliable** solution for Step 10 generation. It eliminates all timeout issues, survives server restarts, and provides excellent observability.

**Key Points:**

- ✅ No more HTTP timeouts
- ✅ Automatic retries on failure
- ✅ Survives server restarts
- ✅ Real-time progress tracking
- ✅ Production-ready and scalable
- ✅ Easy to monitor and debug

The system is now ready for production deployment!
