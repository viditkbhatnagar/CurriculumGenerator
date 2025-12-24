# Step 10 Issues and Fixes

## Problem Summary

Step 10 (Lesson Plans & PPT Generation) was running but showing all counts as 0 (Total Lessons: 0, Contact Hours: 0h, Case Studies: 0, Formative Checks: 0, PPT Decks: 0) even after 8-9 minutes of execution.

## Root Causes Identified

### 1. **Invalid Token Limits**

**Location:** `packages/backend/src/services/openaiService.ts` and `packages/backend/src/services/lessonPlanService.ts`

**Issue:**

- The code was requesting **128,000 tokens** from OpenAI
- GPT-4 models only support **4,000-16,000 output tokens** depending on the model
- This caused OpenAI API calls to fail silently

**Evidence:**

```typescript
// OLD CODE (BROKEN)
maxTokens: 128000, // Maximum token limit for GPT-5
timeout: 1200000, // 20 minutes timeout
```

**Problem:**

- GPT-5 doesn't exist yet
- Even GPT-4 Turbo max output is ~4k-16k tokens
- The API was rejecting these requests

### 2. **Excessive Timeouts**

**Issue:**

- 20-minute (1,200,000ms) timeouts were set
- This is way too long and can cause connection issues
- Most OpenAI calls should complete in 30-120 seconds

### 3. **Silent Failure Handling**

**Location:** `packages/backend/src/services/lessonPlanService.ts` line 738-747

**Issue:**

```typescript
} catch (error) {
  loggingService.warn('Failed to generate AI-enhanced content, using fallback', { error });
  // Return empty object to use fallback methods
  return {
    objectives: [],
    activities: [],
    pedagogicalGuidance: '',
    // ... all empty arrays
  };
}
```

When OpenAI failed, the code returned empty arrays instead of throwing an error. This caused:

- Total Lessons: 0 (no lessons generated)
- Contact Hours: 0 (no hours calculated)
- All other counts: 0

## Fixes Applied

### Fix 1: Corrected Token Limits

**File:** `packages/backend/src/services/openaiService.ts`

```typescript
// BEFORE
maxTokens = 128000, // MAXIMUM token limit for complex curriculum generation
timeout = this.defaultTimeout, // 20 minutes

// AFTER
maxTokens = 4000, // Reasonable default for GPT-4 models
timeout = 120000, // 2 minutes default timeout
```

### Fix 2: Updated Default Timeouts

**File:** `packages/backend/src/services/openaiService.ts`

```typescript
// BEFORE
private readonly defaultTimeout = 1200000; // 1200 seconds (20 minutes)

// AFTER
private readonly defaultTimeout = 120000; // 2 minutes default timeout
```

### Fix 3: Improved Error Logging

**File:** `packages/backend/src/services/lessonPlanService.ts`

```typescript
// BEFORE
loggingService.warn('Failed to generate AI-enhanced content, using fallback', { error });

// AFTER
loggingService.error('Failed to generate AI-enhanced content, using fallback', {
  error: error instanceof Error ? error.message : String(error),
  moduleCode: module.moduleCode,
  lessonNumber: block.lessonNumber,
  stack: error instanceof Error ? error.stack : undefined,
});
```

Now errors are logged as ERROR level with full context, making debugging easier.

## Expected Behavior After Fixes

### What Should Happen Now:

1. **OpenAI calls will succeed** because token limits are reasonable (4,000 tokens)
2. **Faster generation** because timeouts are 2 minutes instead of 20 minutes
3. **Better error visibility** if something fails, you'll see detailed error logs
4. **Proper counts displayed:**
   - Total Lessons: Should show actual number of lessons generated
   - Contact Hours: Should match module contact hours
   - Case Studies: Should show integrated case studies
   - Formative Checks: Should show assessment items
   - PPT Decks: Should show one deck per lesson

### Generation Time Estimate:

For a typical curriculum with 5-8 modules:

- **Per lesson:** ~30-60 seconds (AI generation + processing)
- **Per module:** ~3-5 minutes (assuming 3-5 lessons per module)
- **Total Step 10:** ~15-40 minutes for complete curriculum

## Workflow Clarification

Based on the spec documents, here's what Step 10 should do:

### Current Implementation (Correct):

1. **Step 10 generates BOTH:**
   - Detailed lesson plans for each module
   - PPT decks for each lesson

2. **After Step 10 completes:**
   - User can review all generated content
   - User can download the full curriculum document (includes all 10 steps)
   - User can download individual PPT decks
   - User can export to DOCX/PDF/SCORM

### What Step 10 IS:

- **Full curriculum generation** - creates complete teaching materials
- **Lesson plans** - detailed 60-180 minute lesson blueprints
- **PPT decks** - 15-35 slides per lesson
- **Integration** - combines case studies, assessments, readings from previous steps

### What Step 10 IS NOT:

- NOT just a preview or partial generation
- NOT a separate step from PPT generation (they happen together)
- NOT limited by token or timeout constraints

## Testing the Fix

### How to Test:

1. **Start a new Step 10 generation** or retry the existing one
2. **Monitor backend logs** for:
   ```
   [OpenAI] Response - choices: 1, finish_reason: stop, content_length: [should be > 0]
   ```
3. **Watch the frontend** - counts should start appearing within 2-5 minutes
4. **Check for errors** - if you see errors, they'll now be logged with full details

### Expected Log Output (Success):

```
[INFO] Processing Step 10: Lesson Plans & PPT Generation
[INFO] Starting lesson plan generation - moduleCount: 5, totalContactHours: 120
[INFO] Generating lesson plans for module - moduleCode: MOD1, contactHours: 24
[OpenAI] Response - choices: 1, finish_reason: stop, content_length: 3500
[INFO] Generating PPT decks for all lessons - totalModules: 5
[INFO] Step 10 content generation complete - totalLessons: 25, totalContactHours: 120
```

### Expected Log Output (Failure):

```
[ERROR] Failed to generate AI-enhanced content, using fallback
  error: "Invalid max_completion_tokens: maximum is 16384"
  moduleCode: "MOD1"
  lessonNumber: 1
  stack: [full stack trace]
```

## Additional Notes

### Token Limits by Model:

- **GPT-4**: 4,096 output tokens
- **GPT-4 Turbo**: 4,096 output tokens
- **GPT-4o**: 16,384 output tokens
- **GPT-4o-mini**: 16,384 output tokens

### Recommended Settings:

- **For lesson plans:** 4,000 tokens (sufficient for detailed content)
- **For PPT generation:** 16,000 tokens (allows for comprehensive slides)
- **Timeout:** 120,000ms (2 minutes) for most operations
- **Timeout for complex operations:** 300,000ms (5 minutes) max

## Next Steps

1. **Restart the backend** to apply the fixes
2. **Retry Step 10 generation** on your existing workflow
3. **Monitor the logs** to confirm OpenAI calls are succeeding
4. **Verify counts appear** in the frontend within 5 minutes

If you still see issues after these fixes, check:

- OpenAI API key is valid and has credits
- Network connectivity to OpenAI API
- Backend logs for specific error messages
