# Quick Deploy Guide - All Fixes

## What's Been Fixed

1. ✅ **Lesson-by-Lesson Generation** - Real-time progress tracking
2. ✅ **Download URLs** - Now use production API URL instead of localhost

## Deploy Commands

```bash
# Stage all changes
git add .

# Commit with descriptive message
git commit -m "Fix: Download URLs use production API + lesson-by-lesson progress complete"

# Push to GitHub
git push origin main
```

## What Happens Next

1. **GitHub receives your push**
2. **Render detects the change** (webhook)
3. **Backend deploys** (curriculum-api-bsac) - ~5 minutes
4. **Frontend deploys** (curriculum-frontend-xfyx) - ~5-10 minutes
5. **Both services restart** with new code

## Monitor Deployment

### Render Dashboard

1. Go to https://dashboard.render.com
2. Check both services:
   - `curriculum-api-bsac` (backend)
   - `curriculum-frontend-xfyx` (frontend)
3. Wait for "Live" status (green)

### Deployment Logs

Watch the logs to see progress:

- Backend: Building, installing dependencies, starting server
- Frontend: Building Next.js, optimizing, deploying

## After Deployment - Test Checklist

### Test 1: Download URLs (Critical)

1. Navigate to your curriculum
2. Complete all 10 steps (or use existing)
3. Click "Complete & Review"
4. Click "Download Word Document"
5. **Expected:** Download starts immediately
6. **Before:** "localhost refused to connect" error

### Test 2: Lesson-by-Lesson Progress

1. Navigate to Step 10
2. Click "Generate Lesson Plans & PowerPoints"
3. **Expected:** See lessons appear one at a time
4. **Expected:** Auto-refresh every 5 seconds
5. **Expected:** Progress metrics update in real-time

### Test 3: Verify URLs in Browser

1. Open browser DevTools (F12)
2. Go to Network tab
3. Click download button
4. Check request URL
5. **Expected:** `https://curriculum-api-bsac.onrender.com/...`
6. **Before:** `http://localhost:4000/...`

## Quick Test Commands

### Check Frontend Environment Variable

```bash
# In Render Dashboard > curriculum-frontend-xfyx > Environment
# Verify this is set:
NEXT_PUBLIC_API_URL=https://curriculum-api-bsac.onrender.com
```

### Check Backend is Running

```bash
curl https://curriculum-api-bsac.onrender.com/health
# Should return: {"status":"ok"}
```

### Check Frontend is Running

```bash
curl https://curriculum-frontend-xfyx.onrender.com
# Should return: HTML page
```

## Troubleshooting

### Issue: Download still goes to localhost

**Cause:** Frontend didn't rebuild or environment variable not set
**Solution:**

1. Check Render frontend environment variables
2. Verify `NEXT_PUBLIC_API_URL` is set
3. Trigger manual deploy if needed

### Issue: Lesson progress not showing

**Cause:** Backend not deployed or database connection issue
**Solution:**

1. Check Render backend logs
2. Look for "Saving lesson progress" messages
3. Verify MongoDB connection is working

### Issue: 502 Bad Gateway

**Cause:** Backend not responding or crashed
**Solution:**

1. Check Render backend logs for errors
2. Look for crash messages
3. Check if backend service is "Live"

## Expected Timeline

- **Commit to GitHub:** Instant
- **Render detects change:** 10-30 seconds
- **Backend build starts:** 1 minute
- **Backend build completes:** 3-5 minutes
- **Frontend build starts:** 1 minute
- **Frontend build completes:** 5-10 minutes
- **Total time:** 10-15 minutes

## Success Indicators

### Backend Deployed Successfully

```
✅ Build successful
✅ Service is Live
✅ Logs show: "Server listening on port 4000"
✅ Health check passes
```

### Frontend Deployed Successfully

```
✅ Build successful
✅ Service is Live
✅ Logs show: "Ready in X ms"
✅ Website loads
```

### Downloads Working

```
✅ Click download → file downloads
✅ No localhost errors
✅ Network tab shows production URL
✅ File is valid and opens correctly
```

### Lesson Progress Working

```
✅ Lessons appear one at a time
✅ Auto-refresh shows updates
✅ Progress metrics update
✅ No timeout errors
```

## Files Changed

### Frontend

- `packages/frontend/src/components/workflow/FinalReviewView.tsx` - Download URLs fixed

### Backend

- `packages/backend/src/services/workflowService.ts` - Lesson progress callback
- `packages/backend/src/services/lessonPlanService.ts` - Progress integration
- `packages/backend/src/routes/workflowRoutes.ts` - Background processing

### Documentation

- `DOWNLOAD_URL_FIX.md` - Download URL fix details
- `STEP10_LESSON_BY_LESSON_COMPLETE.md` - Lesson progress implementation
- `STEP10_TESTING_GUIDE.md` - Testing instructions
- `STEP10_VISUAL_GUIDE.md` - Visual examples
- `NEXT_STEPS_CHECKLIST.md` - Action checklist
- `QUICK_DEPLOY_GUIDE.md` - This file

## Post-Deployment

After successful deployment and testing:

1. ✅ Mark download URL issue as resolved
2. ✅ Mark lesson-by-lesson generation as complete
3. 🔍 Test 7th module generation (if applicable)
4. 📊 Monitor Render logs for any errors
5. 🎉 Celebrate working downloads!

## Need Help?

If issues persist after deployment:

1. **Check Render Logs**
   - Backend: Look for errors, crashes, or warnings
   - Frontend: Look for build errors or runtime errors

2. **Check Environment Variables**
   - Verify `NEXT_PUBLIC_API_URL` is set correctly
   - Verify it matches your backend URL exactly

3. **Test Locally**
   - Pull latest code
   - Run `npm install` in both packages
   - Test locally to isolate issue

4. **Report Back**
   - Share Render logs
   - Share browser console errors
   - Share Network tab screenshots

---

**Ready to deploy!** Run the commands above and monitor the deployment. 🚀
