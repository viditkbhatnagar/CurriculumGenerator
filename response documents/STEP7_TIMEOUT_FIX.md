# Step 7 Timeout Fix

**Date**: 2025-12-08
**Issue**: "Request timed out. The operation is taking longer than expected."

---

## 🐛 Problem

Step 7 assessment generation was timing out after 20 minutes on the frontend and 15 minutes on the backend. However, for large curricula with many modules, generation can take **30-40 minutes**, which exceeded the configured timeouts.

### Generation Time Breakdown

For a typical 6-module curriculum with 2 formatives per module:

- **Formative Generation**: ~3 minutes per module × 6 = 18 minutes
- **Summative Generation**: ~5 minutes
- **Sample Questions**: ~15 minutes (5 types: MCQ, SJT, Case, Essay, Practical)
- **LMS Packages**: ~2 minutes
- **Total**: ~25 minutes

For larger curricula (8+ modules) or with 3 formatives per module:

- **8 modules × 3 formatives**: 8 × 3 × 3 = 72 minutes formative generation alone
- **Total**: Can exceed 80+ minutes

---

## ✅ Fixes Applied

### Fix 1: Frontend Timeout Extension

**File**: `packages/frontend/src/lib/api.ts`

**Change**: Increased frontend request timeout from 20 minutes to 30 minutes

```typescript
// OLD
const REQUEST_TIMEOUT = 1200000; // 20 minutes

// NEW
const REQUEST_TIMEOUT = 1800000; // 30 minutes
```

**Lines Changed**:

- Line 8: `REQUEST_TIMEOUT = 1800000`
- Line 63: Updated comment to "30-minute timeout"

### Fix 2: Backend Timeout Extension

**File**: `packages/backend/src/routes/workflowRoutes.ts`

**Change**: Increased backend request timeout from 15 minutes to 30 minutes

```typescript
// OLD
extendTimeout(900000), // 15 minutes

// NEW
extendTimeout(1800000), // 30 minutes
```

**Line Changed**: Line 981

### Fix 3: Form Timer Update

**File**: `packages/frontend/src/components/workflow/Step7Form.tsx`

**Change**: Updated estimated generation time display

```typescript
// OLD
startGeneration(workflow._id, 7, 900); // 15 minutes estimated

// NEW
startGeneration(workflow._id, 7, 1800); // 30 minutes estimated
```

**Line Changed**: Line 123

---

## 🚀 How to Apply the Fixes

### Step 1: Restart Backend Server

The backend timeout change requires a restart:

```bash
# Stop the current backend process (Ctrl+C in the backend terminal)
cd packages/backend
npm run dev
```

**Expected Output**:

```
Server running on http://localhost:4000 (or your configured port)
MongoDB connected
```

### Step 2: Rebuild Frontend

The frontend needs to be rebuilt to pick up the new timeout:

```bash
# In the frontend terminal, stop current process (Ctrl+C)
cd packages/frontend

# Optional: Clear build cache
rm -rf .next

# Restart dev server
npm run dev
```

**Expected Output**:

```
- Local:        http://localhost:3000
- ready started server on 0.0.0.0:3000, url: http://localhost:3000
```

### Step 3: Hard Refresh Browser

**Critical**: You MUST clear your browser cache to load the new code:

- **Chrome/Edge**: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
- **Firefox**: `Ctrl+F5` (Windows) or `Cmd+Shift+R` (Mac)
- **Safari**: `Cmd+Option+R`

Or use DevTools:

1. Open DevTools (F12)
2. Go to Application tab
3. Click "Clear Storage" in left sidebar
4. Click "Clear site data" button

### Step 4: Try Generation Again

1. Navigate back to your workflow at Step 7
2. Click "Generate Assessment Package"
3. **Be patient**: Generation can take 30-40 minutes for large curricula
4. Keep the browser tab open and active
5. Watch for progress updates in the UI

---

## ⏱️ Expected Generation Times

### Small Curriculum (4-6 modules, 2 formatives per module)

- **Expected Time**: 20-25 minutes
- **Will Complete**: ✅ Yes, well under 30-minute timeout

### Medium Curriculum (6-8 modules, 2 formatives per module)

- **Expected Time**: 25-30 minutes
- **Will Complete**: ✅ Yes, should complete within timeout

### Large Curriculum (8-10 modules, 3 formatives per module)

- **Expected Time**: 35-45 minutes
- **Risk**: ⚠️ May timeout if >40 minutes

### Very Large Curriculum (10+ modules, 3 formatives per module)

- **Expected Time**: 45+ minutes
- **Risk**: ❌ Will likely timeout

---

## 🎯 Recommendations for Large Curricula

If your curriculum has **8+ modules** or you're generating **3 formatives per module**, consider these options:

### Option 1: Reduce Formatives Per Module (Recommended)

Instead of 3 formatives per module, use 2:

- **Time Saved**: ~30% reduction in generation time
- **Quality Impact**: Minimal - 2 formatives per module is still comprehensive
- **How**: Change "Assessments per Module" field from 3 to 2

### Option 2: Generate Formative Only First

Break the generation into two steps:

1. **First**: Generate "Formative Only" assessments
2. **Then**: Regenerate with "Both Formative & Summative"

**How**:

1. Set "Assessment Structure" to "Formative Only"
2. Click "Generate Assessment Package"
3. Wait ~15-20 minutes
4. Once complete, click "Regenerate"
5. Change to "Both Formative & Summative"
6. Generate again

### Option 3: Increase Timeout Further (Advanced)

If you consistently have very large curricula, you can increase the timeout to 60 minutes:

**Frontend** (`packages/frontend/src/lib/api.ts`):

```typescript
const REQUEST_TIMEOUT = 3600000; // 60 minutes
```

**Backend** (`packages/backend/src/routes/workflowRoutes.ts`):

```typescript
extendTimeout(3600000), // 60 minutes
```

**Caution**: Very long timeouts can cause:

- Server resource exhaustion
- Deployment platform timeouts (Render, Heroku have 30-60 min limits)
- Poor user experience

---

## 🔍 Monitoring Generation Progress

### Backend Logs to Watch

Open your backend terminal and watch for these logs:

```
[INFO] [Step 7] Received preferences { formativePerModule: 2, type: "number", raw: 2 }
[INFO] Starting Step 7 comprehensive assessment generation
[INFO] Starting Assessment Generation
[INFO] [Step 7] Generating Formative Assessments (1/4)
[INFO] [Step 7] Module 1/6 formatives complete
[INFO] [Step 7] Module 2/6 formatives complete
...
[INFO] [Step 7] Generating Summative Assessments (2/4)
[INFO] [Step 7] Summative assessments complete
[INFO] [Step 7] Generating Sample Questions (3/4)
[INFO] [Step 7] Generated mcq samples
[INFO] [Step 7] Generated sjt samples
...
[INFO] [Step 7] Generating LMS Packages (4/4)
[INFO] [Step 7] Complete
```

### If Generation Appears Stuck

If you see no new logs for **more than 5 minutes**, it may indicate:

1. OpenAI API is slow to respond (check OpenAI status page)
2. OpenAI rate limits being hit (check your API quota)
3. Network issues between your server and OpenAI

**What to Do**:

- Wait another 5 minutes (OpenAI can be slow)
- Check backend terminal for errors
- Check OpenAI dashboard for API usage and rate limits

---

## 🐛 Troubleshooting

### Issue: Still timing out after 30 minutes

**Possible Causes**:

1. Curriculum has too many modules (8+)
2. Formatives per module set to 3
3. OpenAI API is slow

**Solutions**:

1. Reduce formatives per module to 2
2. Check backend logs to see which stage is slow
3. Check OpenAI API status: https://status.openai.com
4. Consider Option 2 or 3 above

### Issue: Generation completes but with errors

**Check**:

- Backend logs for error messages
- Whether partial data was generated (some formatives but not all)
- Database for the workflow's step7 data

**Solution**:

- Click "Regenerate" to try again
- If persistent, check OpenAI API key and quota

### Issue: Browser tab becomes unresponsive

**Cause**: Long-running requests can cause browser to throttle inactive tabs

**Solution**:

- Keep the browser tab **active and visible** during generation
- Don't switch to other tabs for extended periods
- Consider using browser extensions to prevent tab throttling

---

## 📊 How Many Modules Does Your Curriculum Have?

To check how many modules your curriculum has:

1. Look at Step 4 (Course Framework & MLOs) in your workflow
2. Count the number of modules listed
3. Or check the left sidebar progress indicator

**Time Estimates**:

- **4 modules**: ~20 minutes
- **6 modules**: ~25 minutes
- **8 modules**: ~30 minutes
- **10 modules**: ~40 minutes (may timeout)
- **12+ modules**: Consider splitting into multiple courses

---

## ✅ Success Criteria

**The fix is working if**:

1. ✅ Generation runs for 30+ minutes without timeout error
2. ✅ Backend logs show progress through all 4 stages
3. ✅ Generation completes successfully
4. ✅ All assessments, samples, and validation are generated
5. ✅ Can approve and progress to Step 8

---

## 📝 Summary

### What Was Changed

- ✅ Frontend timeout: 20 min → 30 min
- ✅ Backend timeout: 15 min → 30 min
- ✅ Form timer display: Updated to reflect 30 min estimate

### What You Need to Do

1. Restart backend server
2. Rebuild and restart frontend
3. Hard refresh browser (clear cache)
4. Try generation again
5. Be patient - can take 30+ minutes

### If It Still Times Out

- Reduce formatives per module to 2
- Or generate formative only first, then regenerate
- Or increase timeout to 60 minutes (advanced)

---

**Fix Applied**: 2025-12-08
**Status**: ✅ **READY FOR TESTING**
