# Download URL Fix - Using Production API URL

## Issue

The download buttons (Word, PDF, PPT, SCORM) were using hardcoded `localhost:4000` URLs instead of the production API URL, even though `NEXT_PUBLIC_API_URL` was set in Render environment variables.

## Root Cause

In `FinalReviewView.tsx`, the download URLs were hardcoded:

```tsx
// BEFORE (Wrong)
<a href={`http://localhost:4000/api/v3/workflow/${workflow._id}/export/word`} download>
```

This meant the frontend was always pointing to localhost, regardless of the environment variable setting.

## Solution

Changed all hardcoded URLs to use the `NEXT_PUBLIC_API_URL` environment variable:

```tsx
// AFTER (Correct)
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

<a href={`${API_BASE}/api/v3/workflow/${workflow._id}/export/word`} download>
```

## Files Modified

### `packages/frontend/src/components/workflow/FinalReviewView.tsx`

**Changes:**

1. Added `API_BASE` constant at the top of the file
2. Replaced 4 hardcoded URLs:
   - Word export: `${API_BASE}/api/v3/workflow/${workflow._id}/export/word`
   - PDF export: `${API_BASE}/api/v3/workflow/${workflow._id}/export/pdf`
   - PPT generation: `${API_BASE}/api/v3/ppt/generate/all/${workflow._id}`
   - SCORM export: `${API_BASE}/api/v3/workflow/${workflow._id}/export/scorm`

## How It Works

### Development (Local)

- `NEXT_PUBLIC_API_URL` is not set (or set to `http://localhost:4000`)
- Falls back to `http://localhost:4000`
- Downloads work locally

### Production (Render)

- `NEXT_PUBLIC_API_URL` is set to `https://curriculum-api-bsac.onrender.com`
- Uses production API URL
- Downloads work in production

## Environment Variable Setup

### Render Frontend Service

```
NEXT_PUBLIC_API_URL=https://curriculum-api-bsac.onrender.com
```

This variable is already set in your Render frontend service (as shown in the screenshot).

## Testing

After deploying this fix:

1. **Navigate to Final Review page**
   - Complete all 10 steps
   - Click "Complete & Review" button

2. **Test Download Buttons**
   - Click "Download Word Document"
   - Should download from: `https://curriculum-api-bsac.onrender.com/api/v3/workflow/{id}/export/word`
   - NOT from: `http://localhost:4000/...`

3. **Verify in Browser**
   - Open browser DevTools (F12)
   - Go to Network tab
   - Click download button
   - Check the request URL - should be production URL

## Expected Behavior

### ✅ Success

- Download starts immediately
- File downloads successfully
- No "localhost refused to connect" error

### ❌ Before Fix

- Browser tries to connect to localhost
- "This site can't be reached" error
- Download fails

## Related Files

Other files already using the correct pattern:

- `packages/frontend/src/app/workflow/[id]/export/page.tsx` ✅
- `packages/frontend/src/components/workflow/Step7Form.tsx` ✅
- `packages/frontend/src/app/workflow/admin/page.tsx` ✅

## Deployment

This fix requires a frontend rebuild to take effect:

```bash
git add packages/frontend/src/components/workflow/FinalReviewView.tsx
git commit -m "Fix download URLs to use production API URL instead of localhost"
git push origin main
```

Render will automatically rebuild and deploy the frontend (5-10 minutes).

## Verification Checklist

After deployment:

- [ ] Navigate to Final Review page
- [ ] Click "Download Word Document"
- [ ] Verify download starts (not localhost error)
- [ ] Click "Download PDF"
- [ ] Verify download starts
- [ ] Check browser Network tab shows production URL
- [ ] Verify file downloads successfully

## Notes

- The `|| 'http://localhost:4000'` fallback is intentional for local development
- This pattern is consistent with other files in the codebase
- The environment variable is read at build time by Next.js
- Changes require a rebuild to take effect (Render does this automatically)

## Related Issues

This is the same issue that was previously fixed for the API calls but was missed for the download links. The download links use `<a href>` tags instead of `fetch()` calls, so they weren't caught in the initial fix.

---

**Status:** ✅ Fixed and ready for deployment
