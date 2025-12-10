# Step 7 Streaming Implementation Guide

**Date**: 2025-12-08
**Solution**: Real-time streaming with Server-Sent Events (SSE)

---

## 🎯 Problem Solved

The previous implementation had **timeout issues** for large curricula because:

1. Frontend waited for entire generation to complete (30-40 minutes)
2. No feedback during generation
3. Connection could timeout before completion
4. If generation failed, all progress was lost

## ✅ Streaming Solution

Instead of waiting for everything to complete, we now:

1. ✅ **Stream results in real-time** - See data as it's generated
2. ✅ **Save incrementally to database** - After each module/batch completes
3. ✅ **No timeout issues** - Connection stays alive with periodic data flow
4. ✅ **Better UX** - Real-time progress and results
5. ✅ **Partial recovery** - If generation fails, keep what was generated

---

## 🏗️ Architecture

### Data Flow:

```
Frontend (Step7Form)
    ↓
    uses useStep7Streaming hook
    ↓
    POST /api/v3/workflow/:id/step7/stream
    ↓
Backend (step7StreamRoutes)
    ↓
    calls workflowService.processStep7Streaming()
    ↓
    calls assessmentGeneratorService.generateAssessments()
    ↓
    [For each batch generated]
        ↓
        Save to database (workflow.step7)
        ↓
        Send SSE event to frontend
        ↓
        Frontend updates UI in real-time
```

### Batching Strategy:

1. **Formative Assessments**: After each module completes (e.g., Module 1/6, Module 2/6, ...)
2. **Summative Assessments**: After all summatives complete
3. **Sample Questions**: After each type completes (MCQ, SJT, Case, Essay, Practical)
4. **LMS Packages**: After packages are generated

---

## 📦 Files Created/Modified

### Backend

#### 1. **NEW**: `packages/backend/src/routes/step7StreamRoutes.ts`

- SSE endpoint: `POST /api/v3/workflow/:id/step7/stream`
- Sets SSE headers (`text/event-stream`, `no-cache`, `keep-alive`)
- Sends data events as each batch completes
- Handles errors and completion

#### 2. **Modified**: `packages/backend/src/services/workflowService.ts`

- Added `processStep7Streaming()` method (lines 2361-2548)
- Initializes `workflow.step7` with empty arrays
- Saves to database after each batch
- Sends `dataCallback` to frontend with new data

#### 3. **Modified**: `packages/backend/src/services/assessmentGeneratorService.ts`

- Added `data` field to progress callbacks
- **Line 211-222**: Formative batch callback with data
- **Line 504-513**: Summative batch callback with data
- **Line 568-580**: Sample batch callback with data
- **Line 796-805**: LMS batch callback with data

#### 4. **Modified**: `packages/backend/src/index.ts`

- Line 39: Import `step7StreamRoutes`
- Line 240: Register streaming routes

### Frontend

#### 5. **NEW**: `packages/frontend/src/hooks/useStep7Streaming.ts`

- Custom hook to handle SSE streaming
- Manages connection state, progress, and counts
- Parses SSE events and updates UI state
- Provides `startStreaming()` and `stopStreaming()` methods

---

## 🚀 How to Use Streaming in Step7Form

### Option 1: Add Streaming Alongside Existing (Recommended for Testing)

Add streaming as an **additional button** so you can test both approaches:

```typescript
// In Step7Form.tsx
import { useStep7Streaming } from '@/hooks/useStep7Streaming';

function Step7Form({ workflow, onComplete, onRefresh }: Props) {
  const submitStep7 = useSubmitStep7(); // Existing non-streaming
  const streaming = useStep7Streaming(); // New streaming

  // Existing handleGenerate stays the same
  const handleGenerate = async () => {
    // ... existing code
  };

  // New streaming handler
  const handleGenerateStreaming = () => {
    streaming.startStreaming(workflow._id, formData);
  };

  return (
    <div>
      {/* Existing Generate Button */}
      <button onClick={handleGenerate}>
        Generate Assessment Package (Traditional)
      </button>

      {/* NEW: Streaming Generate Button */}
      <button onClick={handleGenerateStreaming} disabled={streaming.isStreaming}>
        {streaming.isStreaming ? 'Generating (Streaming)...' : 'Generate with Streaming'}
      </button>

      {/* Display streaming progress */}
      {streaming.isStreaming && (
        <div>
          <p>Stage: {streaming.progress?.stage}</p>
          <p>Current: {streaming.progress?.currentModule || streaming.progress?.currentType}</p>
          <p>Progress: {streaming.progress?.completedSteps}/{streaming.progress?.totalSteps}</p>

          {/* Real-time counts */}
          <div>
            <p>Formatives: {streaming.formativeCount}</p>
            <p>Summatives: {streaming.summativeCount}</p>
            <p>Samples - MCQ: {streaming.sampleCounts.mcq}, SJT: {streaming.sampleCounts.sjt}</p>
          </div>
        </div>
      )}

      {/* Display streaming error */}
      {streaming.error && <div className="error">{streaming.error}</div>}
    </div>
  );
}
```

### Option 2: Replace Existing Implementation

Once tested and working, replace the traditional approach entirely:

```typescript
function Step7Form({ workflow, onComplete, onRefresh }: Props) {
  const streaming = useStep7Streaming();

  const handleGenerate = () => {
    streaming.startStreaming(workflow._id, formData);
  };

  // Add useEffect to refresh data when complete
  useEffect(() => {
    if (!streaming.isStreaming && streaming.formativeCount > 0) {
      // Streaming completed successfully
      onRefresh(); // Reload workflow data to show results
    }
  }, [streaming.isStreaming, streaming.formativeCount]);

  return (
    // ... UI with streaming progress
  );
}
```

---

## 📊 SSE Event Types

The streaming endpoint sends these event types:

### 1. `connected`

```json
{
  "type": "connected",
  "message": "Stream established"
}
```

**When**: Immediately after connection established
**Action**: Log confirmation

### 2. `progress`

```json
{
  "type": "progress",
  "progress": {
    "stage": "formative",
    "currentModule": "Module 1: Introduction",
    "totalSteps": 6,
    "completedSteps": 0,
    "estimatedTimeRemaining": 1080
  }
}
```

**When**: Before starting each batch
**Action**: Update progress display

### 3. `data`

```json
{
  "type": "data",
  "data": {
    "type": "formative_batch",
    "moduleId": "Module 1: Introduction",
    "formatives": [...],
    "totalCount": 2
  }
}
```

**When**: After each batch completes and saves to database
**Action**: Update counts, display new data

**Data Types**:

- `formative_batch`: Formatives for one module
- `summative_batch`: All summatives
- `sample_batch`: One sample type (MCQ, SJT, etc.)
- `lms_batch`: LMS packages

### 4. `complete`

```json
{
  "type": "complete",
  "data": {
    "step7": {...},
    "summary": {
      "formativeCount": 12,
      "summativeCount": 1,
      "sampleQuestionsTotal": 55
    }
  },
  "message": "Step 7 complete"
}
```

**When**: All generation finished successfully
**Action**: Close stream, refresh data, show success message

### 5. `error`

```json
{
  "type": "error",
  "error": "Failed to generate summative assessments"
}
```

**When**: Generation fails
**Action**: Show error message, close stream

---

## 🧪 Testing the Streaming Implementation

### Step 1: Restart Backend

```bash
cd packages/backend
npm run dev
```

**Verify**: Check that streaming routes are registered:

```
[INFO] Step 7 Streaming routes registered
```

### Step 2: Update Frontend

Add the streaming button to Step7Form (see "Option 1" above)

### Step 3: Test with Small Curriculum

1. Navigate to a workflow with **4-6 modules**
2. Click "Generate with Streaming"
3. **Watch for**:
   - "Connected" message in browser console
   - Progress updates every few seconds
   - Formative count increasing (2, 4, 6, 8, ...)
   - Real-time display of progress

### Step 4: Monitor Backend Logs

```
[INFO] [Step 7 Stream] Starting generation
[INFO] [Step 7 Stream] Saved formatives for module {moduleId: "mod1", count: 2}
[INFO] [Step 7 Stream] Saved formatives for module {moduleId: "mod2", count: 2}
[INFO] [Step 7 Stream] Saved summatives {count: 1}
[INFO] [Step 7 Stream] Saved samples {type: "mcq", count: 30}
[INFO] [Step 7 Stream] Streaming generation complete
```

### Step 5: Monitor Frontend Console

```
[SSE] Received: {type: "connected", message: "Stream established"}
[SSE] Received: {type: "progress", progress: {stage: "formative", ...}}
[SSE] Received: {type: "data", data: {type: "formative_batch", ...}}
[SSE] Received: {type: "complete", ...}
```

### Step 6: Verify Database

Check MongoDB to see incremental saves:

```javascript
db.curriculumworkflows.findOne({ _id: ObjectId('...') }).step7;
```

**Expected**: Should see formatives, summatives, samples incrementally added

---

## 🎯 Benefits Over Non-Streaming

| Feature              | Non-Streaming          | Streaming                |
| -------------------- | ---------------------- | ------------------------ |
| **Timeout Risk**     | ❌ High (30-40 min)    | ✅ None (keeps alive)    |
| **User Feedback**    | ❌ No feedback         | ✅ Real-time progress    |
| **Partial Recovery** | ❌ Lose all on error   | ✅ Keep generated data   |
| **Database Saves**   | ❌ Once at end         | ✅ After each batch      |
| **Scalability**      | ❌ Limited by timeout  | ✅ Works for any size    |
| **UX**               | ❌ "Black box" waiting | ✅ Engaging, transparent |

---

## 🐛 Troubleshooting

### Issue: No SSE events received

**Check**:

1. Browser console for "[SSE] Received" logs
2. Backend logs for "[Step 7 Stream]" messages
3. Network tab in DevTools - should show `/step7/stream` request

**Solution**:

- Ensure backend is running and routes are registered
- Check CORS settings if frontend/backend on different domains
- Verify authentication token is valid

### Issue: Stream stops mid-way

**Possible Causes**:

1. OpenAI API error
2. Database connection lost
3. Network interruption

**Solution**:

- Check backend logs for errors
- Verify OpenAI API key and quota
- Check MongoDB connection

### Issue: Counts not updating in UI

**Check**:

- useState updates in `useStep7Streaming`
- Console logs showing SSE data events
- State management in Step7Form

**Solution**:

- Verify `handleMessage` in hook is parsing data correctly
- Check that `setState` is being called with new counts

---

## 🔒 Security Considerations

### Authentication

- SSE endpoint requires JWT token (same as non-streaming)
- Token passed in `Authorization` header
- Validated via `validateJWT` middleware

### Rate Limiting

- Same OpenAI rate limit protections apply
- 1-second delays between API calls
- Sequential module processing

### Error Handling

- Errors don't crash the stream
- Partial data is preserved
- Client notified via `error` event

---

## 📈 Performance Metrics

### Expected Timeline (6-module curriculum, 2 formatives per module):

| Stage     | Batch     | Time        | Database Saves | SSE Events          |
| --------- | --------- | ----------- | -------------- | ------------------- |
| Formative | Module 1  | ~3 min      | 1              | 2 (progress + data) |
| Formative | Module 2  | ~3 min      | 1              | 2                   |
| Formative | Module 3  | ~3 min      | 1              | 2                   |
| Formative | Module 4  | ~3 min      | 1              | 2                   |
| Formative | Module 5  | ~3 min      | 1              | 2                   |
| Formative | Module 6  | ~3 min      | 1              | 2                   |
| Summative | All       | ~5 min      | 1              | 2                   |
| Samples   | MCQ       | ~3 min      | 1              | 2                   |
| Samples   | SJT       | ~3 min      | 1              | 2                   |
| Samples   | Case      | ~3 min      | 1              | 2                   |
| Samples   | Essay     | ~3 min      | 1              | 2                   |
| Samples   | Practical | ~3 min      | 1              | 2                   |
| LMS       | All       | ~30 sec     | 1              | 2                   |
| **Total** | -         | **~38 min** | **13 saves**   | **26 events**       |

### Database Impact:

- **Old**: 1 save at end (30-40 min)
- **New**: 13 saves throughout (every 2-3 min)
- **Trade-off**: More database writes, but safer and better UX

---

## 🚀 Deployment Considerations

### Backend

- No special configuration needed
- SSE works with standard HTTP/HTTPS
- Compatible with Render, Heroku, AWS, etc.

### Reverse Proxy (Nginx, etc.)

If using a reverse proxy, ensure buffering is disabled for SSE:

```nginx
location /api/v3/workflow {
    proxy_pass http://backend;
    proxy_buffering off;  # Important for SSE
    proxy_set_header X-Accel-Buffering no;  # Also important
}
```

### Load Balancers

- SSE requires sticky sessions (same backend for duration)
- Enable session affinity/stickiness in load balancer config

---

## ✅ Migration Checklist

- [ ] Backend routes registered (step7StreamRoutes)
- [ ] workflowService.processStep7Streaming() added
- [ ] assessmentGeneratorService callbacks include data
- [ ] Frontend useStep7Streaming hook created
- [ ] Step7Form updated to use streaming (Option 1 or 2)
- [ ] Tested with small curriculum (4-6 modules)
- [ ] Tested with large curriculum (8+ modules)
- [ ] Verified database incremental saves
- [ ] Verified frontend real-time updates
- [ ] Error handling tested
- [ ] Documented for team

---

## 📝 Next Steps

### Phase 1: Testing (Current)

1. Add streaming button to Step7Form
2. Test with existing curricula
3. Verify counts update in real-time
4. Check database saves

### Phase 2: Full Integration

1. Replace non-streaming approach entirely
2. Remove old `useSubmitStep7` from Step7Form
3. Add better progress visualization
4. Add pause/resume functionality (future)

### Phase 3: Enhancement (Future)

1. Add visual progress bar for each stage
2. Show preview of generated assessments as they arrive
3. Add ability to cancel generation mid-stream
4. Add reconnection logic if stream drops

---

**Implementation Complete**: 2025-12-08
**Status**: ✅ **READY FOR TESTING**
