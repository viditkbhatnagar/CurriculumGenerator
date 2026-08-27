# Token Limit Fixes Required

## Summary

Multiple files have excessive token limits (128,000 tokens) that need to be reduced to reasonable values based on GPT-4 model capabilities.

## Files Fixed

### ✅ packages/backend/src/services/openaiService.ts

- Fixed `generateContent` default: 128000 → 4000
- Fixed `generateContentStream` default: 128000 → 4000
- Fixed default timeout: 1200000ms (20 min) → 120000ms (2 min)

### ✅ packages/backend/src/services/lessonPlanService.ts

- Fixed lesson plan generation: 128000 → 4000
- Fixed timeout: 1200000ms (20 min) → 120000ms (2 min)

## Files That Still Need Fixing

### packages/backend/src/services/workflowService.ts

Multiple locations with 128,000 token limits:

1. **Line ~697** - Step 1 generation

   ```typescript
   maxTokens: 128000, // MAXIMUM
   timeout: 1200000, // 20 minutes
   ```

   **Recommended:** `maxTokens: 8000, timeout: 180000` (3 min)

2. **Line ~1025** - Step 2 generation

   ```typescript
   maxTokens: 128000, // MAXIMUM
   timeout: 1200000, // 20 minutes
   ```

   **Recommended:** `maxTokens: 8000, timeout: 180000` (3 min)

3. **Line ~1374** - Step 3 generation

   ```typescript
   maxTokens: 128000, // MAXIMUM
   timeout: 1200000, // 20 minutes
   ```

   **Recommended:** `maxTokens: 8000, timeout: 180000` (3 min)

4. **Line ~1905** - Step 4 generation

   ```typescript
   maxTokens: 128000, // MAXIMUM
   timeout: 1800000, // 30 minutes
   ```

   **Recommended:** `maxTokens: 8000, timeout: 300000` (5 min)

5. **Line ~4675** - Step 7 generation

   ```typescript
   maxTokens: 128000, // MAXIMUM
   timeout: 1200000, // 20 minutes
   ```

   **Recommended:** `maxTokens: 8000, timeout: 300000` (5 min)

6. **Line ~6324** - Some other generation
   ```typescript
   maxTokens: 128000, // MAXIMUM token limit
   timeout: 600000, // 10 minutes
   ```
   **Recommended:** `maxTokens: 8000, timeout: 300000` (5 min)

### Reasonable Token Limits by Operation

| Operation         | Recommended maxTokens | Recommended Timeout | Reason              |
| ----------------- | --------------------- | ------------------- | ------------------- |
| Simple generation | 2,000-4,000           | 60-120s             | Short responses     |
| Module generation | 4,000-8,000           | 120-180s            | Detailed content    |
| Lesson plans      | 4,000-8,000           | 120-180s            | Structured content  |
| PPT generation    | 8,000-16,000          | 180-300s            | Many slides         |
| Case studies      | 8,000-16,000          | 180-300s            | Detailed scenarios  |
| Assessments       | 4,000-8,000           | 120-180s            | Questions + answers |
| Glossary          | 4,000-8,000           | 120-180s            | Term definitions    |

## Why These Limits?

### GPT-4 Model Limits:

- **GPT-4**: 4,096 max output tokens
- **GPT-4 Turbo**: 4,096 max output tokens
- **GPT-4o**: 16,384 max output tokens
- **GPT-4o-mini**: 16,384 max output tokens

### Current Issues:

- Requesting 128,000 tokens causes API to reject the request
- 20-30 minute timeouts are excessive and can cause connection issues
- Silent failures result in empty data being returned

### Recommended Approach:

1. **Use 4,000-8,000 tokens** for most operations (safe for all GPT-4 models)
2. **Use 8,000-16,000 tokens** only for complex operations (requires GPT-4o)
3. **Use 2-5 minute timeouts** for most operations
4. **Never exceed 16,384 tokens** (hard limit for GPT-4o)

## How to Apply Fixes

### Option 1: Manual Fix (Recommended)

Go through each file and update the token limits based on the recommendations above.

### Option 2: Automated Fix (Risky)

Run a find-replace operation:

```bash
# Find all instances
grep -r "maxTokens: 128000" packages/backend/src/

# Replace with reasonable defaults (review each case!)
# This is just an example - DO NOT run blindly
```

## Testing After Fixes

1. **Restart backend server**
2. **Try generating each step** (1-10)
3. **Monitor logs** for OpenAI errors
4. **Verify data is generated** (not empty arrays)

## Priority

**HIGH PRIORITY:**

- ✅ openaiService.ts (FIXED)
- ✅ lessonPlanService.ts (FIXED)
- ⚠️ workflowService.ts (NEEDS FIX)

**MEDIUM PRIORITY:**

- pptGenerationService.ts (16,000 is acceptable for GPT-4o)

## Notes

- The system was designed assuming "GPT-5" exists with 128k output tokens
- GPT-5 doesn't exist yet; current models are GPT-4 family
- Even when GPT-5 arrives, 128k output tokens is unlikely
- Better to generate in chunks than request massive outputs
