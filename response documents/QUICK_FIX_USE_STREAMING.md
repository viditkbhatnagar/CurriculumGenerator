# Quick Fix: Use Streaming for Complete Question Generation

**Problem**: Generating 120+ complete questions (10-12 per formative × 12 assessments) takes 40+ minutes and causes timeout.

**Solution**: Use the streaming endpoint I already built - it saves incrementally and never times out!

---

## Option 1: Quick Fix - Use Streaming Endpoint Directly (RECOMMENDED)

### Step 1: Update the form to use streaming endpoint

Open: `packages/frontend/src/components/workflow/Step7Form.tsx`

**Find line ~116** (the handleGenerate function) and replace it with:

```typescript
const handleGenerate = async () => {
  setError(null);

  console.log('[Step7Form] Using STREAMING endpoint for complete question generation');

  // Use STREAMING endpoint instead of regular endpoint
  const token = localStorage.getItem('auth_token');
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  try {
    const response = await fetch(`${API_BASE_URL}/api/v3/workflow/${workflow._id}/step7/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(formData),
    });

    if (!response.ok) {
      throw new Error('Failed to start generation');
    }

    // Read the stream
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No reader available');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data:')) {
          try {
            const data = JSON.parse(line.slice(5).trim());
            console.log('[SSE]', data.type, data);

            if (data.type === 'complete') {
              console.log('[Step7Form] Generation complete!');
              onRefresh(); // Reload workflow data
              return;
            } else if (data.type === 'error') {
              throw new Error(data.error);
            }
          } catch (e) {
            console.error('[SSE] Parse error:', e);
          }
        }
      }
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to generate assessments';
    console.error('Failed to generate assessments:', err);
    setError(errorMessage);
  }
};
```

**That's it!** The streaming endpoint will:

- Save each formative assessment as it's generated (every 4 minutes)
- Never timeout because data keeps flowing
- Store everything in the database incrementally

---

## Option 2: Reduce Questions Per Assessment (Temporary Fix)

If you want to keep using the non-streaming endpoint, reduce the number of questions:

Open: `packages/backend/src/services/assessmentGeneratorService.ts`

**Find line ~316** and change:

```typescript
"description": "A 10-12 question quiz covering fundamental concepts from this module",
```

To:

```typescript
"description": "A 5-6 question quiz covering fundamental concepts from this module",
```

**And find line ~356** and change:

```typescript
2. For quizzes: Include 10-12 detailed questions with all options and correct answers
```

To:

```typescript
2. For quizzes: Include 5-6 detailed questions with all options and correct answers
```

This will generate ~60 questions instead of 120, which should complete in ~20 minutes.

---

## Option 3: Use the Full Streaming UI (Best Long-term)

I already created a complete streaming hook. Add it to your Step7Form:

**At the top of Step7Form.tsx**, add:

```typescript
import { useStep7Streaming } from '@/hooks/useStep7Streaming';
```

**In the component**, add:

```typescript
const streaming = useStep7Streaming();

const handleGenerateStreaming = () => {
  streaming.startStreaming(workflow._id, formData);
};

// Auto-refresh when complete
useEffect(() => {
  if (!streaming.isStreaming && streaming.formativeCount > 0) {
    onRefresh();
  }
}, [streaming.isStreaming, streaming.formativeCount]);
```

**Replace the generate button**:

```typescript
<button
  onClick={handleGenerateStreaming}
  disabled={streaming.isStreaming}
>
  {streaming.isStreaming ? 'Generating...' : 'Generate Assessment Package'}
</button>

{/* Show progress */}
{streaming.isStreaming && (
  <div>
    <p>Formatives: {streaming.formativeCount}</p>
    <p>Summatives: {streaming.summativeCount}</p>
    <p>Stage: {streaming.progress?.stage}</p>
  </div>
)}
```

---

## Why Streaming?

| Approach              | Questions | Time    | Timeout Risk | Database Saves     |
| --------------------- | --------- | ------- | ------------ | ------------------ |
| **Non-streaming**     | 120+      | 40+ min | ❌ High      | 1 at end           |
| **Streaming**         | 120+      | 40+ min | ✅ None      | 12 (every 3-4 min) |
| **Reduced questions** | 60        | ~20 min | ⚠️ Medium    | 1 at end           |

**Streaming is the ONLY scalable solution for complete question generation!**

---

## Recommended Action

**Use Option 1** (Quick Fix with streaming endpoint) - it's the simplest change and will work immediately.

Just update the `handleGenerate` function in Step7Form.tsx and click "Generate Assessment Package" again.

You'll see in the console:

```
[Step7Form] Using STREAMING endpoint
[SSE] progress {stage: "formative", currentModule: "mod1", ...}
[SSE] data {type: "formative_batch", formatives: [...]}
[SSE] complete {data: {...}}
[Step7Form] Generation complete!
```

And the frontend will auto-refresh when done!
